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
  suspicious_elements?: Array<{
    selector: string
    text: string
    confidence: number
    matched_keywords: string[]
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
  console.log("Judol Detector: Initializing content script.")
  // Get settings
  settings = await getSettings()
  console.log("Judol Detector: Settings loaded:", settings)

  if (!settings.enabled) {
    console.log("Judol Detector: Extension is disabled. Exiting.")
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

    const loadedSettings = {
      enabled: enabled === undefined ? true : Boolean(enabled),
      threshold: typeof threshold === "number" ? threshold : 0.5,
      blockingMode: (["highlight", "blur", "hide"].includes(blockingMode)
        ? blockingMode
        : "highlight") as "highlight" | "blur" | "hide",
      showNotifications:
        showNotifications === undefined ? true : Boolean(showNotifications)
    }
    console.log("Judol Detector: Loaded settings from storage:", loadedSettings)
    return loadedSettings
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

// Helper function to check if an element is critical page structure
function isPageStructureElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  const criticalTags = [
    "html",
    "head",
    "body",
    "header",
    "nav",
    "main",
    "footer"
  ]

  if (criticalTags.includes(tagName)) {
    console.log(
      `Judol Detector: Element <${tagName}> is a critical tag.`,
      element
    )
    return true
  }

  // Check if element is a navigation or layout container
  const classList = Array.from(element.classList)
  const criticalClasses = [
    "header",
    "nav",
    "navigation",
    "menu",
    "sidebar",
    "footer",
    "layout",
    "container",
    "wrapper",
    "main"
  ]

  // Use exact match to avoid false positives on partial class names
  const isCritical = criticalClasses.some((cls) =>
    classList.some((elementClass) => elementClass.toLowerCase() === cls)
  )

  if (isCritical) {
    console.log(`Judol Detector: Element has a critical class.`, element)
  }

  return isCritical
}

// Start content analysis
async function startAnalysis() {
  if (isAnalyzing) {
    console.log("Judol Detector: Analysis already in progress.")
    return
  }

  console.log("Judol Detector: Starting content analysis.")
  isAnalyzing = true

  try {
    // Get page content
    const pageData = {
      html: document.documentElement.outerHTML,
      url: window.location.href,
      title: document.title
    }

    // Send to background script for analysis
    console.log(
      "Judol Detector: Sending page data to background script for analysis."
    )
    const response = (await sendMessage({
      action: "analyzeContent",
      data: pageData
    })) as any

    console.log(
      "Judol Detector: Received analysis response from background script:",
      response
    )
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
  console.log("Judol Detector: Processing analysis results:", analysisResults)

  // Start observing for future DOM changes
  observeDynamicContent()

  if (!analysisResults || !analysisResults.overall.is_judol) {
    console.log(
      "Judol Detector: No suspicious content found or analysis results are missing."
    )
    return
  }

  const confidence = analysisResults.overall.confidence
  const threshold = settings.threshold
  console.log(
    `Judol Detector: Overall confidence: ${confidence}, Threshold: ${threshold}`
  )

  if (confidence >= threshold) {
    console.log(
      "Judol Detector: Confidence is above threshold. Applying blocking mode:",
      settings.blockingMode
    )
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
  console.log("Judol Detector: Highlighting suspicious content.")
  if (!analysisResults?.suspicious_elements) {
    console.log("Judol Detector: No suspicious elements to highlight.")
    return
  }

  analysisResults.suspicious_elements.forEach((element) => {
    console.log(`Judol Detector: Checking element for highlighting:`, element)
    if (element.confidence >= settings.threshold) {
      try {
        const domElements = document.querySelectorAll(element.selector)
        console.log(
          `Judol Detector: Found ${domElements.length} elements with selector "${element.selector}"`
        )

        // Safety check: don't highlight too many elements at once
        if (domElements.length > 10) {
          console.warn(
            `Selector "${element.selector}" matches too many elements (${domElements.length}). Skipping to avoid highlighting entire page.`
          )
          return
        }

        domElements.forEach((domElement) => {
          const htmlElement = domElement as HTMLElement

          // Skip if element is already highlighted or if it's a critical page element
          if (
            htmlElement.hasAttribute("data-judol-highlighted") ||
            isPageStructureElement(htmlElement)
          ) {
            console.log(
              "Judol Detector: Skipping element for highlighting (already highlighted or is a structure element).",
              htmlElement
            )
            return
          }

          console.log("Judol Detector: Highlighting element:", htmlElement)
          // Apply highlighting styles
          htmlElement.style.border = "2px solid #ef4444"
          htmlElement.style.backgroundColor = "rgba(239, 68, 68, 0.1)"
          htmlElement.style.borderRadius = "4px"
          htmlElement.title = `Suspicious content detected (${Math.round(element.confidence * 100)}% confidence)`
          htmlElement.setAttribute("data-judol-highlighted", "true")
          htmlElement.setAttribute(
            "data-judol-original-border",
            htmlElement.style.border || ""
          )
          htmlElement.setAttribute(
            "data-judol-original-background",
            htmlElement.style.backgroundColor || ""
          )
        })
      } catch (error) {
        console.warn(
          "Failed to highlight element with selector:",
          element.selector,
          error
        )
      }
    }
  })
}

// Blur suspicious content
function blurSuspiciousContent() {
  console.log("Judol Detector: Blurring suspicious content.")
  if (!analysisResults?.suspicious_elements) {
    console.log("Judol Detector: No suspicious elements to blur.")
    return
  }

  analysisResults.suspicious_elements.forEach((element) => {
    console.log(`Judol Detector: Checking element for blurring:`, element)
    if (element.confidence >= settings.threshold) {
      try {
        const domElements = document.querySelectorAll(element.selector)
        console.log(
          `Judol Detector: Found ${domElements.length} elements with selector "${element.selector}"`
        )

        // Safety check: don't blur too many elements at once
        if (domElements.length > 10) {
          console.warn(
            `Selector "${element.selector}" matches too many elements (${domElements.length}). Skipping to avoid blurring entire page.`
          )
          return
        }

        domElements.forEach((domElement) => {
          const htmlElement = domElement as HTMLElement

          // Skip if element is already blurred or if it's a critical page element
          if (
            htmlElement.hasAttribute("data-judol-blurred") ||
            isPageStructureElement(htmlElement)
          ) {
            console.log(
              "Judol Detector: Skipping element for blurring (already blurred or is a structure element).",
              htmlElement
            )
            return
          }

          console.log("Judol Detector: Blurring element:", htmlElement)
          // Apply blur styles
          htmlElement.style.filter = "blur(5px)"
          htmlElement.style.pointerEvents = "none"
          htmlElement.style.transition = "filter 0.3s ease"
          htmlElement.title = `Content blurred due to suspicious gambling content`
          htmlElement.setAttribute("data-judol-blurred", "true")
          htmlElement.setAttribute(
            "data-judol-original-filter",
            htmlElement.style.filter || ""
          )
          htmlElement.setAttribute(
            "data-judol-original-pointer-events",
            htmlElement.style.pointerEvents || ""
          )
        })
      } catch (error) {
        console.warn(
          "Failed to blur element with selector:",
          element.selector,
          error
        )
      }
    }
  })
}

// Hide suspicious content
function hideSuspiciousContent() {
  console.log("Judol Detector: Hiding suspicious content.")
  if (!analysisResults?.suspicious_elements) {
    console.log("Judol Detector: No suspicious elements to hide.")
    return
  }

  analysisResults.suspicious_elements.forEach((element) => {
    console.log(`Judol Detector: Checking element for hiding:`, element)
    if (element.confidence >= settings.threshold) {
      try {
        const domElements = document.querySelectorAll(element.selector)
        console.log(
          `Judol Detector: Found ${domElements.length} elements with selector "${element.selector}"`
        )

        // Safety check: don't hide too many elements at once
        if (domElements.length > 10) {
          console.warn(
            `Selector "${element.selector}" matches too many elements (${domElements.length}). Skipping to avoid hiding entire page.`
          )
          return
        }

        domElements.forEach((domElement) => {
          const htmlElement = domElement as HTMLElement

          // Skip if element is already hidden or if it's a critical page element
          if (
            htmlElement.hasAttribute("data-judol-hidden") ||
            isPageStructureElement(htmlElement)
          ) {
            console.log(
              "Judol Detector: Skipping element for hiding (already hidden or is a structure element).",
              htmlElement
            )
            return
          }

          console.log("Judol Detector: Hiding element:", htmlElement)
          // Store original display value before hiding
          htmlElement.setAttribute(
            "data-judol-original-display",
            htmlElement.style.display || ""
          )
          htmlElement.style.display = "none"
          htmlElement.setAttribute("data-judol-hidden", "true")
        })
      } catch (error) {
        console.warn(
          "Failed to hide element with selector:",
          element.selector,
          error
        )
      }
    }
  })
}

// Clear all highlights and effects
function clearHighlights() {
  // Remove all applied styles using the data attributes we set
  const highlightedElements = document.querySelectorAll(
    "[data-judol-highlighted]"
  )
  const blurredElements = document.querySelectorAll("[data-judol-blurred]")
  const hiddenElements = document.querySelectorAll("[data-judol-hidden]")

  // Clear highlighted elements and restore original styles
  highlightedElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    const originalBorder = htmlElement.getAttribute(
      "data-judol-original-border"
    )
    const originalBackground = htmlElement.getAttribute(
      "data-judol-original-background"
    )

    htmlElement.style.border = originalBorder || ""
    htmlElement.style.backgroundColor = originalBackground || ""
    htmlElement.style.borderRadius = ""
    htmlElement.title = ""
    htmlElement.removeAttribute("data-judol-highlighted")
    htmlElement.removeAttribute("data-judol-original-border")
    htmlElement.removeAttribute("data-judol-original-background")
  })

  // Clear blurred elements and restore original styles
  blurredElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    const originalFilter = htmlElement.getAttribute(
      "data-judol-original-filter"
    )
    const originalPointerEvents = htmlElement.getAttribute(
      "data-judol-original-pointer-events"
    )

    htmlElement.style.filter = originalFilter || ""
    htmlElement.style.pointerEvents = originalPointerEvents || ""
    htmlElement.style.transition = ""
    htmlElement.title = ""
    htmlElement.removeAttribute("data-judol-blurred")
    htmlElement.removeAttribute("data-judol-original-filter")
    htmlElement.removeAttribute("data-judol-original-pointer-events")
  })

  // Clear hidden elements and restore original styles
  hiddenElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    const originalDisplay = htmlElement.getAttribute(
      "data-judol-original-display"
    )

    htmlElement.style.display = originalDisplay || ""
    htmlElement.removeAttribute("data-judol-hidden")
    htmlElement.removeAttribute("data-judol-original-display")
  })
}

let observer: MutationObserver | null = null
let debounceTimeout: number

// Observe for dynamic content changes
function observeDynamicContent() {
  if (observer) {
    return // Already observing
  }

  const targetNode = document.body
  if (!targetNode) {
    console.log("Judol Detector: Could not find document.body to observe.")
    return
  }

  const config = { childList: true, subtree: true }

  const callback = function (
    mutationsList: MutationRecord[],
    obs: MutationObserver
  ) {
    const hasAddedNodes = mutationsList.some((m) => m.addedNodes.length > 0)

    if (hasAddedNodes) {
      console.log("Judol Detector: Dynamic content change detected.")
      window.clearTimeout(debounceTimeout)
      debounceTimeout = window.setTimeout(() => {
        console.log("Judol Detector: Re-running analysis for dynamic content.")
        clearHighlights()
        startAnalysis()
      }, 1000) // 1-second debounce
    }
  }

  observer = new MutationObserver(callback)
  observer.observe(targetNode, config)
  console.log(
    "Judol Detector: MutationObserver is now watching for dynamic content."
  )
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
    // Refresh the highlighting/blurring based on new settings
    if (analysisResults && analysisResults.overall.is_judol) {
      clearHighlights()
      processAnalysisResults()
    }
    sendResponse({ success: true })
  }
})

// Initialize when script loads
init()
