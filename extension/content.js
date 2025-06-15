// Content script for detecting and highlighting judol content

let isAnalyzing = false;
let analysisResults = null;
let settings = {};

// Initialize the content script
async function init() {
  // Get settings
  settings = await getSettings();

  if (!settings.enabled) {
    return;
  }

  // Start analysis after page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAnalysis);
  } else {
    startAnalysis();
  }
}

// Start content analysis
async function startAnalysis() {
  if (isAnalyzing) return;

  isAnalyzing = true;

  try {
    // Get page content
    const pageData = {
      html: document.documentElement.outerHTML,
      url: window.location.href,
      title: document.title,
    };

    // Send to background script for analysis
    const response = await sendMessage({
      action: "analyzeContent",
      data: pageData,
    });

    if (response.success) {
      analysisResults = response.data;
      processAnalysisResults();
    } else {
      console.error("Analysis failed:", response.error);
    }
  } catch (error) {
    console.error("Content analysis error:", error);
  } finally {
    isAnalyzing = false;
  }
}

// Process analysis results and apply blocking
function processAnalysisResults() {
  if (!analysisResults) return;

  const { overall, suspicious_elements } = analysisResults;

  // Update badge
  chrome.runtime.sendMessage({
    action: "updateBadge",
    data: {
      is_judol: overall.is_judol,
      suspicious_count: suspicious_elements.length,
    },
  });

  // Apply blocking based on mode
  if (overall.is_judol || suspicious_elements.length > 0) {
    applySuspiciousElementBlocking();

    if (settings.showNotifications && overall.is_judol) {
      showJudolWarning();
    }
  }
}

// Apply blocking to suspicious elements
function applySuspiciousElementBlocking() {
  if (!analysisResults.suspicious_elements) return;

  analysisResults.suspicious_elements.forEach((element) => {
    try {
      const domElements = document.querySelectorAll(element.selector);

      domElements.forEach((domElement) => {
        switch (settings.blockingMode) {
          case "highlight":
            highlightElement(domElement, element);
            break;
          case "blur":
            blurElement(domElement);
            break;
          case "hide":
            hideElement(domElement);
            break;
        }
      });
    } catch (error) {
      console.error(
        "Error applying blocking to element:",
        element.selector,
        error
      );
    }
  });
}

// Highlight suspicious element
function highlightElement(element, data) {
  element.classList.add("judol-highlighted");
  element.setAttribute("data-judol-confidence", data.confidence.toFixed(2));
  element.setAttribute("data-judol-keywords", data.matched_keywords.join(", "));

  // Add tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "judol-tooltip";
  tooltip.innerHTML = `
    <strong>Suspicious Content Detected</strong><br>
    Confidence: ${(data.confidence * 100).toFixed(1)}%<br>
    Keywords: ${data.matched_keywords.join(", ")}
  `;

  element.appendChild(tooltip);

  // Show tooltip on hover
  element.addEventListener("mouseenter", () => {
    tooltip.style.display = "block";
  });

  element.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });
}

// Blur suspicious element
function blurElement(element) {
  element.classList.add("judol-blurred");

  // Add click to reveal
  const overlay = document.createElement("div");
  overlay.className = "judol-blur-overlay";
  overlay.innerHTML =
    "<span>Click to reveal potentially suspicious content</span>";

  element.style.position = "relative";
  element.appendChild(overlay);

  overlay.addEventListener("click", () => {
    element.classList.remove("judol-blurred");
    overlay.remove();
  });
}

// Hide suspicious element
function hideElement(element) {
  element.classList.add("judol-hidden");

  // Add placeholder
  const placeholder = document.createElement("div");
  placeholder.className = "judol-hidden-placeholder";
  placeholder.innerHTML =
    "<span>Content hidden due to suspicious gambling-related content</span>";

  element.parentNode.insertBefore(placeholder, element);

  // Add show button
  const showButton = document.createElement("button");
  showButton.textContent = "Show Content";
  showButton.className = "judol-show-button";
  showButton.addEventListener("click", () => {
    element.classList.remove("judol-hidden");
    placeholder.remove();
  });

  placeholder.appendChild(showButton);
}

// Show judol warning notification
function showJudolWarning() {
  // Remove existing warning
  const existing = document.querySelector(".judol-warning");
  if (existing) existing.remove();

  const warning = document.createElement("div");
  warning.className = "judol-warning";
  warning.innerHTML = `
    <div class="judol-warning-content">
      <h3>⚠️ Gambling Content Detected</h3>
      <p>This page contains content related to online gambling (judol). Please browse responsibly.</p>
      <div class="judol-warning-stats">
        <span>Confidence: ${(analysisResults.overall.confidence * 100).toFixed(
          1
        )}%</span>
        <span>Suspicious Elements: ${
          analysisResults.total_suspicious_elements
        }</span>
      </div>
      <button class="judol-warning-close">×</button>
    </div>
  `;

  document.body.appendChild(warning);

  // Auto hide after 5 seconds
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
    }
  }, 5000);

  // Close button
  warning
    .querySelector(".judol-warning-close")
    .addEventListener("click", () => {
      warning.remove();
    });
}

// Helper function to send messages to background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// Get extension settings
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["enabled", "threshold", "blockingMode", "showNotifications"],
      (result) => {
        resolve({
          enabled: result.enabled ?? true,
          threshold: result.threshold ?? 0.5,
          blockingMode: result.blockingMode ?? "highlight",
          showNotifications: result.showNotifications ?? true,
        });
      }
    );
  });
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    // Reload settings and reapply if needed
    getSettings().then((newSettings) => {
      settings = newSettings;

      if (!settings.enabled) {
        // Remove all applied effects
        removeAllEffects();
      } else if (analysisResults) {
        // Reapply with new settings
        removeAllEffects();
        processAnalysisResults();
      }
    });
  }
});

// Remove all applied effects
function removeAllEffects() {
  // Remove highlights
  document.querySelectorAll(".judol-highlighted").forEach((el) => {
    el.classList.remove("judol-highlighted");
    el.removeAttribute("data-judol-confidence");
    el.removeAttribute("data-judol-keywords");
    const tooltip = el.querySelector(".judol-tooltip");
    if (tooltip) tooltip.remove();
  });

  // Remove blurs
  document.querySelectorAll(".judol-blurred").forEach((el) => {
    el.classList.remove("judol-blurred");
    const overlay = el.querySelector(".judol-blur-overlay");
    if (overlay) overlay.remove();
  });

  // Remove hidden elements
  document.querySelectorAll(".judol-hidden").forEach((el) => {
    el.classList.remove("judol-hidden");
  });

  document.querySelectorAll(".judol-hidden-placeholder").forEach((el) => {
    el.remove();
  });

  // Remove warning
  const warning = document.querySelector(".judol-warning");
  if (warning) warning.remove();
}

// Initialize when script loads
init();
