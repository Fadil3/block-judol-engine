import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface Settings {
  enabled: boolean
  threshold: number
  blockingMode: "highlight" | "blur" | "hide"
  showNotifications: boolean
}

interface AnalysisResults {
  overall: {
    is_judol: boolean
    confidence: number
    matched_keywords: string[]
  }
  total_suspicious_elements: number
  elements?: Array<{
    id: string
    is_suspicious: boolean
    confidence: number
  }>
}

const storage = new Storage()

let isAnalyzing = false
let analysisResults: AnalysisResults | null = null
let settings: Settings = {
  enabled: true,
  threshold: 0.5,
  blockingMode: "highlight",
  showNotifications: true
}

// Initialize the content script
async function init() {
  // Get settings
  settings = await getSettings()

  if (!settings.enabled) {
    return
  }

  // Start analysis after page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAnalysis)
  } else {
    startAnalysis()
  }
}

// Get settings from storage
async function getSettings(): Promise<Settings> {
  try {
    const enabled = await storage.get("enabled")
    const threshold = await storage.get("threshold")
    const blockingMode = await storage.get("blockingMode")
    const showNotifications = await storage.get("showNotifications")

    return {
      enabled: enabled === undefined ? true : Boolean(enabled),
      threshold: typeof threshold === "number" ? threshold : 0.5,
      blockingMode: (["highlight", "blur", "hide"].includes(blockingMode)
        ? blockingMode
        : "highlight") as "highlight" | "blur" | "hide",
      showNotifications:
        showNotifications === undefined ? true : Boolean(showNotifications)
    }
  } catch (error) {
    console.error("Failed to load settings:", error)
    return {
      enabled: true,
      threshold: 0.5,
      blockingMode: "highlight",
      showNotifications: true
    }
  }
}

// Start content analysis
async function startAnalysis() {
  if (isAnalyzing) return

  isAnalyzing = true

  try {
    // Get page content
    const pageData = {
      html: document.documentElement.outerHTML,
      url: window.location.href,
      title: document.title
    }

    // Send to background script for analysis
    const response = (await sendMessage({
      action: "analyzeContent",
      data: pageData
    })) as any

    if (response?.success) {
      analysisResults = response.data
      processAnalysisResults()
    } else {
      console.error("Analysis failed:", response?.error)
    }
  } catch (error) {
    console.error("Analysis error:", error)
  } finally {
    isAnalyzing = false
  }
}

// Process analysis results
function processAnalysisResults() {
  if (!analysisResults || !analysisResults.overall.is_judol) {
    return
  }

  const confidence = analysisResults.overall.confidence
  const threshold = settings.threshold

  if (confidence >= threshold) {
    // Apply blocking based on mode
    if (settings.blockingMode === "highlight") {
      highlightSuspiciousContent()
    } else if (settings.blockingMode === "blur") {
      blurSuspiciousContent()
    } else if (settings.blockingMode === "hide") {
      hideSuspiciousContent()
    }

    // Show notification if enabled
    if (settings.showNotifications) {
      sendMessage({
        action: "showNotification",
        data: {
          message: `Suspicious gambling content detected (${Math.round(confidence * 100)}% confidence)`
        }
      })
    }
  }
}

// Highlight suspicious content
function highlightSuspiciousContent() {
  if (!analysisResults?.elements) return

  analysisResults.elements.forEach((element) => {
    if (element.is_suspicious && element.confidence >= settings.threshold) {
      const domElement = document.querySelector(
        `[data-element-id="${element.id}"]`
      ) as HTMLElement
      if (domElement) {
        domElement.style.border = "2px solid #ef4444"
        domElement.style.backgroundColor = "rgba(239, 68, 68, 0.1)"
        domElement.title = `Suspicious content detected (${Math.round(element.confidence * 100)}% confidence)`
      }
    }
  })
}

// Blur suspicious content
function blurSuspiciousContent() {
  if (!analysisResults?.elements) return

  analysisResults.elements.forEach((element) => {
    if (element.is_suspicious && element.confidence >= settings.threshold) {
      const domElement = document.querySelector(
        `[data-element-id="${element.id}"]`
      ) as HTMLElement
      if (domElement) {
        domElement.style.filter = "blur(5px)"
        domElement.style.pointerEvents = "none"
        domElement.title = `Content blurred due to suspicious gambling content`
      }
    }
  })
}

// Hide suspicious content
function hideSuspiciousContent() {
  if (!analysisResults?.elements) return

  analysisResults.elements.forEach((element) => {
    if (element.is_suspicious && element.confidence >= settings.threshold) {
      const domElement = document.querySelector(
        `[data-element-id="${element.id}"]`
      ) as HTMLElement
      if (domElement) {
        domElement.style.display = "none"
      }
    }
  })
}

// Clear all highlights and effects
function clearHighlights() {
  // Remove all applied styles
  const elements = document.querySelectorAll(
    "[style*='border: 2px solid #ef4444'], [style*='filter: blur'], [style*='display: none']"
  )
  elements.forEach((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.border = ""
    htmlElement.style.backgroundColor = ""
    htmlElement.style.filter = ""
    htmlElement.style.pointerEvents = ""
    htmlElement.style.display = ""
    htmlElement.title = ""
  })
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(response)
      }
    })
  })
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAnalysisResults") {
    sendResponse({ results: analysisResults })
  }

  if (request.action === "startAnalysis") {
    startAnalysis()
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep message channel open
  }

  if (request.action === "clearHighlights") {
    clearHighlights()
    sendResponse({ success: true })
  }

  if (request.action === "updateSettings") {
    settings = request.settings
    sendResponse({ success: true })
  }
})

// Initialize when script loads
init()
