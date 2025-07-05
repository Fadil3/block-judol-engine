import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

// --- STYLE INJECTION ---
// We inject styles directly into the head to ensure they are always applied
// and have priority over the website's own styles.
const BJE_STYLE_ID = "block-judol-engine-styles"

function injectStyles() {
  if (document.getElementById(BJE_STYLE_ID)) {
    return
  }

  const style = document.createElement("style")
  style.id = BJE_STYLE_ID
  style.textContent = `
    .judol-highlighted {
      background-color: yellow !important;
      border: 2px solid red !important;
      border-radius: 4px;
    }
    
    .judol-blur-wrapper {
      position: relative !important;
      display: inline-block !important;
      vertical-align: top; /* Helps with layout */
    }
    
    .judol-blur-overlay {
      position: absolute !important;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      z-index: 999999 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      color: white !important;
      font-family: sans-serif;
      font-size: 14px;
      text-align: center;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .judol-overlay-content {
      padding: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      border-radius: 5px;
      pointer-events: none; /* Allow clicks to go to the button */
    }
    
    .judol-unblur-btn {
      margin-top: 8px !important;
      padding: 4px 10px !important;
      border: 1px solid #ccc !important;
      background-color: #f0f0f0 !important;
      color: #333 !important;
      cursor: pointer !important;
      border-radius: 3px !important;
      pointer-events: all; /* Make sure the button is clickable */
    }
    
    .judol-unblur-btn:hover {
      background-color: #e0e0e0 !important;
    }
  `
  document.head.appendChild(style)
}
// --- END STYLE INJECTION ---

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface Settings {
  enabled: boolean
  threshold: number
  blockingMode: "highlight" | "blur" | "hide"
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
  blockingMode: "highlight"
}

// Initialize the content script
async function init() {
  console.log("Judol Detector: Initializing content script.")

  // --- Inject styles as the first step ---
  injectStyles()

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

    const loadedSettings = {
      enabled: enabled === undefined ? true : Boolean(enabled),
      threshold: typeof threshold === "number" ? threshold : 0.5,
      blockingMode: (["highlight", "blur", "hide"].includes(blockingMode)
        ? blockingMode
        : "highlight") as "highlight" | "blur" | "hide"
    }
    console.log("Judol Detector: Loaded settings from storage:", loadedSettings)
    return loadedSettings
  } catch (error) {
    console.error("Failed to load settings:", error)
    return {
      enabled: true,
      threshold: 0.5,
      blockingMode: "highlight"
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

// Get stored block stats
async function getBlockStats(): Promise<{ text: number; images: number }> {
  const statsJSON = await storage.get("blockStats")
  try {
    if (statsJSON) {
      const stats = JSON.parse(statsJSON)
      return {
        text: stats.text || 0,
        images: stats.images || 0
      }
    }
  } catch (e) {
    // ignore parsing errors and return default
  }
  return { text: 0, images: 0 }
}

// Process analysis results
function processAnalysisResults(results: AnalysisResult[]) {
  console.log("Judol Detector: Processing analysis results:", results)

  // --- FIX: Disconnect observer to prevent infinite loops ---
  if (observer) {
    observer.disconnect()
    console.log(
      "Judol Detector: Observer disconnected during DOM manipulation."
    )
  }

  // Clear any existing highlights *before* processing new results
  clearHighlights()

  if (!results || results.length === 0) {
    console.log(
      "Judol Detector: No suspicious content found or analysis results are missing."
    )
    // Reconnect observer and exit if there's nothing to do
    if (observer) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "href"]
      })
    }
    return
  }

  const suspiciousItems = results.filter(
    (item) => item.confidence >= settings.threshold
  )

  // Find the highest confidence score from all results
  const maxConfidence = suspiciousItems.reduce(
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

    // Increment block stats
    const textBlocked = suspiciousItems.filter(
      (item) => item.type === "text"
    ).length
    const imagesBlocked = suspiciousItems.filter(
      (item) => item.type === "image_url"
    ).length

    if (textBlocked > 0 || imagesBlocked > 0) {
      getBlockStats().then((stats) => {
        const newStats = {
          text: stats.text + textBlocked,
          images: stats.images + imagesBlocked
        }
        storage.set("blockStats", JSON.stringify(newStats))
        console.log("Judol Detector: Updated block stats:", newStats)
      })
    }

    // Apply blocking based on mode, passing the results to each function
    if (settings.blockingMode === "highlight") {
      highlightSuspiciousContent(results)
    } else if (settings.blockingMode === "blur") {
      blurSuspiciousContent(results)
    } else if (settings.blockingMode === "hide") {
      hideSuspiciousContent(results)
    }
  }

  // --- FIX: Reconnect observer after all DOM changes are done ---
  if (observer) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href"]
    })
    console.log("Judol Detector: Observer reconnected.")
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
          domElement.classList.add("judol-highlighted")
          domElement.title = `Suspicious content detected with ${
            element.confidence * 100
          }% confidence. Keywords: ${element.details.matched_keywords?.join(
            ", "
          )}`
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
            domElement.parentNode.insertBefore(wrapper, domElement)
            wrapper.appendChild(domElement)
          }

          // Avoid adding multiple overlays
          if (wrapper.querySelector(".judol-blur-overlay")) {
            return
          }

          const overlay = document.createElement("div")
          overlay.classList.add("judol-blur-overlay")
          overlay.innerHTML = `<button class="judol-unblur-btn">Show</button>`
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
          domElement.classList.add("judol-hidden")
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
  // Remove highlight class
  const highlighted = document.querySelectorAll(".judol-highlighted")
  highlighted.forEach((el: HTMLElement) => {
    el.classList.remove("judol-highlighted")
    el.title = ""
  })

  // Remove blur overlays
  const blurOverlays = document.querySelectorAll(".judol-blur-overlay")
  blurOverlays.forEach((overlay) => overlay.remove())

  // Restore hidden elements
  const hidden = document.querySelectorAll(".judol-hidden")
  hidden.forEach((el: HTMLElement) => {
    el.classList.remove("judol-hidden")
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
  const config = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href"]
  }

  const callback = function (
    mutationsList: MutationRecord[],
    obs: MutationObserver
  ) {
    // Debounce re-analysis to avoid performance issues
    if (reanalysisTimer) {
      clearTimeout(reanalysisTimer)
    }
    reanalysisTimer = setTimeout(() => {
      console.log("Judol Detector: Dynamic content change detected.")
      console.log("Judol Detector: Re-running analysis for dynamic content.")
      // No need to clear highlights here, processAnalysisResults does it.
      startAnalysis()
    }, 500) // Debounce for 500ms
  }

  observer = new MutationObserver(callback)
  observer.observe(targetNode, config)
  console.log(
    "Judol Detector: MutationObserver is now watching for dynamic content."
  )
}

let reanalysisTimer: NodeJS.Timeout | null = null

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
    // This will disconnect the observer, clear, and then re-apply with new settings
    startAnalysis()
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
