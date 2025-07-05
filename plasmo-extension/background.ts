import { Storage } from "@plasmohq/storage"

const API_BASE_URL = "http://localhost:8000"
const storage = new Storage()

// Extension installation or update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Judol Content Blocker installed/updated.")

  // Manually check if settings exist before setting a default value.
  // This prevents overwriting user settings on extension updates.
  const currentMode = await storage.get("blockingMode")
  if (currentMode === undefined) {
    await storage.set("blockingMode", "blur") // Default to blur
  }

  const currentEnabled = await storage.get("enabled")
  if (currentEnabled === undefined) {
    await storage.set("enabled", true)
  }

  const currentThreshold = await storage.get("threshold")
  if (currentThreshold === undefined) {
    await storage.set("threshold", 0.5)
  }

  const currentApiUrl = await storage.get("apiUrl")
  if (currentApiUrl === undefined) {
    await storage.set("apiUrl", API_BASE_URL)
  }

  console.log("Judol Content Blocker: Default settings ensured.")
})

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Skip chrome:// and extension pages
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://")
    ) {
      return
    }

    // Get settings and check if enabled
    storage.get("enabled").then((enabled) => {
      if (enabled) {
        // Inject content script if not already injected
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
          })
          .catch((err) => {
            // Script might already be injected, ignore error
            console.log("Content script already injected or failed:", err)
          })
      }
    })
  }
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeContent") {
    // Use an immediately-invoked async function to handle the promise
    ;(async () => {
      try {
        const result = await analyzeContent(request.data)
        sendResponse({ success: true, data: result })
      } catch (error) {
        console.error("Analysis failed in background script:", error)
        sendResponse({ success: false, error: error.message })
      }
    })()
    return true // Keep the message channel open for the async response
  }
})

// Analyze content using the API
async function analyzeContent(pageData) {
  try {
    const apiUrl = (await storage.get("apiUrl")) || API_BASE_URL

    const response = await fetch(`${apiUrl}/analyze/html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        html: pageData.html,
        url: pageData.url,
        image_urls: pageData.image_urls,
        threshold: 0.5
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("API call failed:", error)
    throw error
  }
}

export {}
