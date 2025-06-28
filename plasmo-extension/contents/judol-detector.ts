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

// --- NEW Interfaces to match backend ---
interface AnalysisDetail {
  matched_keywords?: string[]
  keyword_score?: number
  regex_score?: number
}

interface AnalysisResult {
  is_gambling: boolean
  confidence: number
  selector: string
  type: "text" | "image_url"
  details: AnalysisDetail
}
// --- END NEW Interfaces ---

const storage = new Storage()

let isAnalyzing = false
let analysisResults: AnalysisResult[] | null = null
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
    const images = Array.from(document.querySelectorAll("img"))
    const imageUrls = images.map((img) => img.src).filter(Boolean)

    // Get page content
    const pageData = {
      html: document.documentElement.outerHTML,
      url: window.location.href,
      title: document.title,
      image_urls: imageUrls
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
      processAnalysisResults(analysisResults)
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
function processAnalysisResults(results: AnalysisResult[]) {
  console.log("Judol Detector: Processing analysis results:", results)

  // Start observing for future DOM changes
  observeDynamicContent()

  if (!results || results.length === 0) {
    console.log(
      "Judol Detector: No suspicious content found or analysis results are missing."
    )
    return
  }

  // Find the highest confidence score from all results
  const maxConfidence = results.reduce(
    (max, item) => Math.max(max, item.confidence),
    0
  )

  console.log(
    `Judol Detector: Max confidence: ${maxConfidence}, Threshold: ${settings.threshold}`
  )

  if (maxConfidence >= settings.threshold) {
    console.log(
      "Judol Detector: Confidence is above threshold. Applying blocking mode:",
      settings.blockingMode
    )
    // Apply blocking based on mode, passing the results to each function
    if (settings.blockingMode === "highlight") {
      highlightSuspiciousContent(results)
    } else if (settings.blockingMode === "blur") {
      blurSuspiciousContent(results)
    } else if (settings.blockingMode === "hide") {
      hideSuspiciousContent(results)
    }

    // Show notification if enabled
    if (settings.showNotifications) {
      sendMessage({
        action: "showNotification",
        data: {
          message: `Suspicious gambling content detected (${Math.round(
            maxConfidence * 100
          )}% confidence)`
        }
      })
    }
  }
}

// Highlight suspicious content
function highlightSuspiciousContent(results: AnalysisResult[]) {
  console.log("Judol Detector: Highlighting suspicious content.")
  if (!results) {
    console.log("Judol Detector: No suspicious elements to highlight.")
    return
  }

  results.forEach((element) => {
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

        domElements.forEach((domElement: HTMLElement) => {
          if (isPageStructureElement(domElement)) {
            console.log(
              "Judol Detector: Skipping highlight on critical element:",
              domElement
            )
            return
          }
          domElement.style.backgroundColor = "yellow"
          domElement.style.border = "2px solid red"
          domElement.title = `Suspicious content detected with ${
            element.confidence * 100
          }% confidence. Keywords: ${element.details.matched_keywords?.join(", ")}`
        })
      } catch (e) {
        console.error(
          `Judol Detector: Failed to apply highlight for selector "${element.selector}":`,
          e
        )
      }
    }
  })
}

// Blur suspicious content
function blurSuspiciousContent(results: AnalysisResult[]) {
  console.log("Judol Detector: Blurring suspicious content.")
  if (!results) {
    console.log("Judol Detector: No suspicious elements to blur.")
    return
  }

  results.forEach((element) => {
    if (element.confidence >= settings.threshold) {
      try {
        const domElements = document.querySelectorAll(element.selector)
        console.log(
          `Judol Detector: Found ${domElements.length} elements with selector "${element.selector}" to blur.`
        )
        domElements.forEach((domElement: HTMLElement) => {
          if (isPageStructureElement(domElement)) {
            console.log(
              "Judol Detector: Skipping blur on critical element:",
              domElement
            )
            return
          }
          const wrapper = domElement.parentElement?.classList.contains(
            "judol-blur-wrapper"
          )
            ? domElement.parentElement
            : document.createElement("div")

          // Avoid re-wrapping
          if (!wrapper.classList.contains("judol-blur-wrapper")) {
            wrapper.classList.add("judol-blur-wrapper")
            wrapper.style.position = "relative"
            wrapper.style.display = "inline-block" // Or block, depending on element
            domElement.parentNode.insertBefore(wrapper, domElement)
            wrapper.appendChild(domElement)
          }

          const overlay = document.createElement("div")
          overlay.classList.add("judol-blur-overlay")
          overlay.style.position = "absolute"
          overlay.style.top = "0"
          overlay.style.left = "0"
          overlay.style.width = "100%"
          overlay.style.height = "100%"
          overlay.style.backgroundColor = "rgba(255, 255, 255, 0.5)"
          overlay.style.backdropFilter = "blur(10px)"
          overlay.style.zIndex = "9998"
          overlay.style.textAlign = "center"
          overlay.style.color = "black"
          overlay.style.fontSize = "14px"
          overlay.style.display = "flex"
          overlay.style.justifyContent = "center"
          overlay.style.alignItems = "center"
          overlay.innerHTML = `
            <div style="padding: 10px; background: white; border-radius: 5px;">
              Potentially suspicious content hidden.<br/>
              (Confidence: ${Math.round(element.confidence * 100)}%)
              <button class="judol-unblur-btn" style="margin-left: 10px; padding: 2px 5px; border: 1px solid #ccc; cursor: pointer;">Show</button>
            </div>`
          wrapper.appendChild(overlay)

          const unblurBtn = overlay.querySelector(
            ".judol-unblur-btn"
          ) as HTMLButtonElement
          unblurBtn.onclick = (e) => {
            e.stopPropagation()
            wrapper.removeChild(overlay)
          }
        })
      } catch (e) {
        console.error(
          `Judol Detector: Failed to apply blur for selector "${element.selector}":`,
          e
        )
      }
    }
  })
}

// Hide suspicious content
function hideSuspiciousContent(results: AnalysisResult[]) {
  console.log("Judol Detector: Hiding suspicious content.")
  if (!results) {
    console.log("Judol Detector: No suspicious elements to hide.")
    return
  }

  results.forEach((element) => {
    if (element.confidence >= settings.threshold) {
      try {
        const domElements = document.querySelectorAll(element.selector)
        console.log(
          `Judol Detector: Found ${domElements.length} elements with selector "${element.selector}" to hide.`
        )
        domElements.forEach((domElement: HTMLElement) => {
          if (isPageStructureElement(domElement)) {
            console.log(
              "Judol Detector: Skipping hide on critical element:",
              domElement
            )
            return
          }
          domElement.style.display = "none"
        })
      } catch (e) {
        console.error(
          `Judol Detector: Failed to hide content for selector "${element.selector}":`,
          e
        )
      }
    }
  })
}

// Clear all highlights, blurs, etc.
function clearHighlights() {
  console.log("Judol Detector: Clearing all visual markers.")
  const highlighted = document.querySelectorAll(
    '[style*="background-color: yellow"]'
  )
  highlighted.forEach((el: HTMLElement) => {
    el.style.backgroundColor = ""
    el.style.border = ""
    el.title = ""
  })

  const blurOverlays = document.querySelectorAll(".judol-blur-overlay")
  blurOverlays.forEach((overlay) => overlay.remove())

  // Restore hidden elements (this is tricky, might need a better approach)
  // For now, let's assume we don't restore hidden elements on the fly
  // unless we add a class to track them.
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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAnalysisResults") {
    // The popup is asking for the analysis results. Send them back directly.
    sendResponse(analysisResults)
    return true // Keep message port open for async response
  }

  if (request.action === "updateSettings") {
    console.log(
      "Judol Detector: Received new settings from popup:",
      request.settings
    )
    settings = request.settings
    // Refresh the highlighting/blurring based on new settings
    if (analysisResults && analysisResults.length > 0) {
      clearHighlights()
      processAnalysisResults(analysisResults)
    }
    sendResponse({ success: true })
    return true
  }

  if (request.action === "clearHighlights") {
    clearHighlights()
    sendResponse({ success: true })
    return true
  }

  if (request.action === "startAnalysis") {
    // Re-run analysis when requested from popup
    startAnalysis().then(() => {
      sendResponse({ success: true })
    })
    return true // Keep message port open for async response
  }
})

// Initialize when script loads
init()
