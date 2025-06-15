// Popup script for Judol Content Blocker

let currentTab = null;
let analysisResults = null;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await getCurrentTab();
  await loadPageStatus();
  setupEventListeners();
});

// Load extension settings
async function loadSettings() {
  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get(
      ["enabled", "threshold", "blockingMode", "showNotifications"],
      resolve
    );
  });

  // Update UI with current settings
  document
    .getElementById("toggle-enabled")
    .classList.toggle("active", settings.enabled !== false);
  document.getElementById("blocking-mode").value =
    settings.blockingMode || "highlight";
  document.getElementById("threshold-slider").value = settings.threshold || 0.5;
  document.getElementById("threshold-value").textContent = `${Math.round(
    (settings.threshold || 0.5) * 100
  )}%`;
  document
    .getElementById("toggle-notifications")
    .classList.toggle("active", settings.showNotifications !== false);
}

// Get current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
}

// Load page analysis status
async function loadPageStatus() {
  if (!currentTab) return;

  try {
    // Get analysis results from content script
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: "getAnalysisResults",
    });

    if (response && response.results) {
      analysisResults = response.results;
      updateStatusDisplay();
    } else {
      // No results yet, show safe status
      updateStatusDisplay(null);
    }
  } catch (error) {
    console.log("No content script response:", error);
    updateStatusDisplay(null);
  } finally {
    // Hide loading, show main content
    document.getElementById("loading").style.display = "none";
    document.getElementById("main-content").style.display = "block";
  }
}

// Update status display
function updateStatusDisplay(results = analysisResults) {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const stats = document.getElementById("stats");

  if (!results || !results.overall.is_judol) {
    // Safe page
    statusDot.className = "status-dot safe";
    statusText.textContent = "Page is safe";
    stats.textContent = "No suspicious gambling content detected";
  } else {
    // Suspicious page
    const confidence = results.overall.confidence;
    const suspiciousCount = results.total_suspicious_elements;

    if (confidence > 0.8) {
      statusDot.className = "status-dot danger";
      statusText.textContent = "High risk content detected";
    } else {
      statusDot.className = "status-dot warning";
      statusText.textContent = "Potentially suspicious content";
    }

    stats.innerHTML = `
      Confidence: ${Math.round(confidence * 100)}%<br>
      Suspicious elements: ${suspiciousCount}<br>
      Keywords found: ${results.overall.matched_keywords.length}
    `;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Enable/disable toggle
  document.getElementById("toggle-enabled").addEventListener("click", () => {
    const toggle = document.getElementById("toggle-enabled");
    const isEnabled = !toggle.classList.contains("active");

    toggle.classList.toggle("active", isEnabled);

    chrome.storage.sync.set({ enabled: isEnabled });

    // Reload page if disabled
    if (!isEnabled) {
      chrome.tabs.reload(currentTab.id);
    }
  });

  // Blocking mode change
  document.getElementById("blocking-mode").addEventListener("change", (e) => {
    chrome.storage.sync.set({ blockingMode: e.target.value });
  });

  // Threshold slider
  document.getElementById("threshold-slider").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("threshold-value").textContent = `${Math.round(
      value * 100
    )}%`;
    chrome.storage.sync.set({ threshold: value });
  });

  // Notifications toggle
  document
    .getElementById("toggle-notifications")
    .addEventListener("click", () => {
      const toggle = document.getElementById("toggle-notifications");
      const isEnabled = !toggle.classList.contains("active");

      toggle.classList.toggle("active", isEnabled);
      chrome.storage.sync.set({ showNotifications: isEnabled });
    });

  // Scan page button
  document.getElementById("scan-page").addEventListener("click", async () => {
    const button = document.getElementById("scan-page");
    const originalText = button.textContent;

    button.textContent = "🔄 Scanning...";
    button.disabled = true;

    try {
      // Trigger new scan
      await chrome.tabs.sendMessage(currentTab.id, { action: "startAnalysis" });

      // Wait a bit and reload status
      setTimeout(async () => {
        await loadPageStatus();
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Scan failed:", error);
      button.textContent = "❌ Scan failed";
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  });

  // Clear highlights button
  document
    .getElementById("clear-highlights")
    .addEventListener("click", async () => {
      try {
        await chrome.tabs.sendMessage(currentTab.id, {
          action: "clearHighlights",
        });
      } catch (error) {
        console.error("Clear highlights failed:", error);
      }
    });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    loadSettings();
  }
});
