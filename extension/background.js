// Background script for the Judol Content Blocker extension

const API_BASE_URL = "http://localhost:8000";

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Judol Content Blocker installed");

  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    threshold: 0.5,
    apiUrl: API_BASE_URL,
    blockingMode: "highlight", // 'highlight', 'blur', 'hide'
    showNotifications: true,
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Skip chrome:// and extension pages
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://")
    ) {
      return;
    }

    // Get settings and check if enabled
    chrome.storage.sync.get(["enabled"], (result) => {
      if (result.enabled) {
        // Inject content script if not already injected
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["content.js"],
          })
          .catch((err) => {
            // Script might already be injected, ignore error
            console.log("Content script already injected or failed:", err);
          });
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeContent") {
    analyzeContent(request.data)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error("Analysis error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === "updateBadge") {
    updateBadge(sender.tab.id, request.data);
  }
});

// Analyze content using the API
async function analyzeContent(data) {
  try {
    const settings = await getSettings();

    const response = await fetch(`${settings.apiUrl}/analyze/html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: data.html,
        url: data.url,
        threshold: settings.threshold,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API call failed:", error);

    // Fallback to keyword-based detection
    return performKeywordAnalysis(data.html);
  }
}

// Fallback keyword-based analysis
function performKeywordAnalysis(html) {
  const keywords = [
    "gacor",
    "maxwin",
    "rtp live",
    "slot gacor",
    "judi online",
    "pragmatic play",
    "pg soft",
    "scatter",
    "jackpot",
    "bet",
  ];

  const text = html.toLowerCase();
  const matches = [];
  let score = 0;

  keywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      matches.push(keyword);
      score += 10;
    }
  });

  return {
    overall: {
      is_judol: score > 20,
      confidence: Math.min(score / 100, 1),
      keyword_score: score,
      matched_keywords: matches,
    },
    suspicious_elements: [],
    total_suspicious_elements: 0,
  };
}

// Update extension badge
function updateBadge(tabId, data) {
  if (data.is_judol) {
    chrome.action.setBadgeText({
      text: data.suspicious_count.toString(),
      tabId: tabId,
    });
    chrome.action.setBadgeBackgroundColor({
      color: "#FF4444",
      tabId: tabId,
    });
  } else {
    chrome.action.setBadgeText({
      text: "",
      tabId: tabId,
    });
  }
}

// Get extension settings
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["enabled", "threshold", "apiUrl", "blockingMode", "showNotifications"],
      (result) => {
        resolve({
          enabled: result.enabled ?? true,
          threshold: result.threshold ?? 0.5,
          apiUrl: result.apiUrl ?? API_BASE_URL,
          blockingMode: result.blockingMode ?? "highlight",
          showNotifications: result.showNotifications ?? true,
        });
      }
    );
  });
}
