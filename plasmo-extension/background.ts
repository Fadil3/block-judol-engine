import { Storage } from "@plasmohq/storage"

const API_BASE_URL = "http://localhost:8000"
const storage = new Storage()

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Judol Content Blocker installed")

  // Set default settings
  storage.setItem("enabled", true)
  storage.setItem("threshold", 0.5)
  storage.setItem("apiUrl", API_BASE_URL)
  storage.setItem("blockingMode", "highlight")
  storage.setItem("showNotifications", true)
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
    analyzeContent(request.data)
      .then((result) => {
        sendResponse({ success: true, data: result })
      })
      .catch((error) => {
        console.error("Analysis failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep the message channel open for async response
  }

  if (request.action === "showNotification") {
    showNotification(request.data)
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

// Show notification
async function showNotification(data) {
  const showNotifications = await storage.get("showNotifications")

  if (!showNotifications) return

  const notificationOptions = {
    type: "basic" as const,
    iconUrl: "icon.png",
    title: "Judol Content Detected",
    message: data.message || "Suspicious gambling content found on this page"
  }

  chrome.notifications.create(notificationOptions)
}

export {}
