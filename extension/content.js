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
        applyAction(domElement, element);
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

function applyAction(domElement, itemData) {
  chrome.storage.local.get("blocking_mode", (result) => {
    const mode = result.blocking_mode || "blur"; // Default to blur
    switch (mode) {
      case "blur":
        blurElement(domElement, itemData); // Pass the DOM element and the data
        break;
      case "hide":
        hideElement(domElement);
        break;
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
function blurElement(element, item) {
  if (!element) return;

  const wrapper = document.createElement("div");
  wrapper.className = "judol-overlay-wrapper";

  // Get the position and size of the element
  const rect = element.getBoundingClientRect();

  // Adjust for scroll position
  wrapper.style.top = `${rect.top + window.scrollY}px`;
  wrapper.style.left = `${rect.left + window.scrollX}px`;
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = `${rect.height}px`;

  document.body.appendChild(wrapper);

  // --- NEW: Handle sub-region blurring ---
  if (item.regions && item.image_size) {
    // This is an image with specific regions to blur
    const parentImageRect = element.getBoundingClientRect();
    const scaleX = parentImageRect.width / item.image_size.w;
    const scaleY = parentImageRect.height / item.image_size.h;

    item.regions.forEach((region) => {
      const regionBox = region.box_px; // [x, y, w, h]
      const overlay = document.createElement("div");
      overlay.className = "judol-blur-overlay";

      overlay.style.left = `${regionBox[0] * scaleX}px`;
      overlay.style.top = `${regionBox[1] * scaleY}px`;
      overlay.style.width = `${regionBox[2] * scaleX}px`;
      overlay.style.height = `${regionBox[3] * scaleY}px`;

      wrapper.appendChild(overlay);
    });
  } else {
    // This is a text element or a full-image blur, apply a single overlay
    const overlay = document.createElement("div");
    overlay.className = "judol-blur-overlay judol-full-blur";
    wrapper.appendChild(overlay);
  }
  // --- END NEW ---

  // Create and append the info box
  const infoBox = document.createElement("div");
  infoBox.className = "judol-info-box";
  // Note: For multi-region, confidence/keywords of the first region is shown.
  // A more advanced UI could show details for each region on hover.
  const representativeConfidence =
    item.confidence || (item.regions && item.regions[0].confidence) || 0;
  const representativeKeywords =
    item.matched_keywords ||
    (item.regions && item.regions[0].matched_keywords) ||
    [];
  infoBox.innerHTML = `
    <strong>Suspicious Content Detected</strong><br>
    Confidence: ${(representativeConfidence * 100).toFixed(1)}%<br>
    Keywords: ${representativeKeywords.join(", ")}
  `;

  wrapper.appendChild(infoBox);

  // Add click to reveal for the whole wrapper
  wrapper.addEventListener("click", () => {
    wrapper.remove();
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

function getVisibleElementsAndAnalyze() {
  console.log("Judol Protector: Analyzing page content...");
  const backendImageBatch = [];
  const minSize = 50; // 50x50 pixels

  // --- NEW: Client-side instant keyword detection ---
  const instantBlockKeywords = [
    "judi",
    "slot",
    "gacor",
    "toto",
    "bet",
    "casino",
    "spin",
    "togel",
  ];

  document.querySelectorAll("img").forEach((img) => {
    const rect = img.getBoundingClientRect();
    if (rect.width > minSize && rect.height > minSize && img.src) {
      const lowercasedSrc = img.src.toLowerCase();
      const matchedKeyword = instantBlockKeywords.find((keyword) =>
        lowercasedSrc.includes(keyword)
      );

      if (matchedKeyword) {
        // INSTANTLY blur if a keyword is found in the URL
        console.log(
          `Judol Protector: Instantly blurring image with keyword '${matchedKeyword}' in URL:`,
          img.src
        );
        applyAction(img, {
          type: "image",
          selector: img.src,
          regions: [
            {
              box_px: [0, 0, rect.width, rect.height],
              confidence: 0.99,
              matched_keywords: [matchedKeyword],
            },
          ],
          image_size: { w: rect.width, h: rect.height },
        });
      } else {
        // If no instant match, add to the batch for backend analysis
        if (!backendImageBatch.some((item) => item.url === img.src)) {
          backendImageBatch.push(img.src);
        }
      }
    }
  });

  // Send the remaining images to the backend if there are any
  if (backendImageBatch.length > 0) {
    console.log(
      `Judol Protector: Sending ${backendImageBatch.length} images for backend analysis.`
    );
    chrome.runtime.sendMessage({
      type: "analyze_images_and_text",
      html: document.body.innerHTML,
      image_urls: backendImageBatch,
      url: window.location.href,
    });
  }
}

function initialize() {
  // Analyze on initial load
  getVisibleElementsAndAnalyze();

  // Re-analyze on DOM changes
  const observer = new MutationObserver(
    debounce(getVisibleElementsAndAnalyze, 500)
  );
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Main execution ---
// Use a timeout to ensure the page has had time to render dynamic content
setTimeout(initialize, 1000);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "analysis_result") {
    console.log("Judol Protector: Received analysis result:", request.data);
    const data = request.data;
    if (data && data.suspicious_elements) {
      updatePopup(data);

      // --- NEW: Filter and Poll for Elements ---
      const confidenceThreshold = 0.5;
      let pendingItems = data.suspicious_elements.filter((item) => {
        // Filter by type and confidence score
        if (
          item.type !== "image" ||
          !item.regions ||
          item.regions.length === 0
        ) {
          return false;
        }
        // Check the confidence of the most confident region
        const maxConfidence = Math.max(
          ...item.regions.map((r) => r.confidence)
        );
        return maxConfidence >= confidenceThreshold;
      });

      if (pendingItems.length === 0) {
        console.log("Judol Protector: No items above confidence threshold.");
        return;
      }

      let attempts = 0;
      const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds

      const poller = setInterval(() => {
        attempts++;
        pendingItems = pendingItems.filter((item) => {
          // Use "starts with" selector for resilience
          const elements = document.querySelectorAll(
            `img[src^="${item.selector}"]`
          );
          if (elements.length > 0) {
            console.log(
              `Judol Protector: Found and blurring ${elements.length} element(s) for`,
              item.selector
            );
            elements.forEach((domElement) => applyAction(domElement, item));
            return false; // Remove from pending list
          }
          return true; // Keep in pending list
        });

        if (pendingItems.length === 0 || attempts >= maxAttempts) {
          clearInterval(poller);
          if (pendingItems.length > 0) {
            console.log(
              "Judol Protector: Timed out waiting for elements:",
              pendingItems.map((i) => i.selector)
            );
          }
        }
      }, 500);
    }
  }
});
