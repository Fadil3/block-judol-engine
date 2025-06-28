import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import "./popup.css"

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

function IndexPopup() {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [analysisResults, setAnalysisResults] = useState<
    AnalysisResult[] | null
  >(null)
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    threshold: 0.5,
    blockingMode: "highlight",
    showNotifications: true
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializePopup = async () => {
      await loadSettings()
      await getCurrentTab()
    }
    initializePopup()
  }, [])

  useEffect(() => {
    if (currentTab) {
      loadPageStatus()
    } else {
      setLoading(false)
    }
  }, [currentTab])

  const loadSettings = async () => {
    try {
      const loadedSettings = await storage.getAll()

      // Handle boolean conversion from string storage
      const parseBooleanFromStorage = (value: any): boolean => {
        if (value === undefined || value === null) return true // default to true
        if (typeof value === "boolean") return value
        if (typeof value === "string") return value === "true"
        return Boolean(value)
      }

      setSettings({
        enabled: parseBooleanFromStorage(loadedSettings.enabled),
        threshold:
          typeof loadedSettings.threshold === "string"
            ? parseFloat(loadedSettings.threshold) || 0.5
            : loadedSettings.threshold || 0.5,
        blockingMode: (["highlight", "blur", "hide"].includes(
          loadedSettings.blockingMode
        )
          ? loadedSettings.blockingMode
          : "highlight") as "highlight" | "blur" | "hide",
        showNotifications: parseBooleanFromStorage(
          loadedSettings.showNotifications
        )
      })
    } catch (error) {
      console.error("Failed to load settings:", error)
    }
  }

  const getCurrentTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      setCurrentTab(tab || null)
    } catch (error) {
      console.error("Failed to get current tab:", error)
      setCurrentTab(null)
    }
  }

  const loadPageStatus = async () => {
    if (!currentTab) {
      setLoading(false)
      return
    }

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: "getAnalysisResults"
      })

      if (response) {
        setAnalysisResults(response)
      }
    } catch (error) {
      console.log("No content script response:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = async (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await storage.set(key, value)

    // Send updated settings to content script
    if (currentTab) {
      try {
        await chrome.tabs.sendMessage(currentTab.id, {
          action: "updateSettings",
          settings: newSettings
        })
      } catch (error) {
        console.log("Could not send settings to content script:", error)
      }
    }

    if (key === "enabled" && !value && currentTab) {
      chrome.tabs.reload(currentTab.id)
    }
  }

  const scanPage = async () => {
    if (!currentTab) return

    try {
      await chrome.tabs.sendMessage(currentTab.id, { action: "startAnalysis" })
      setTimeout(() => {
        loadPageStatus()
      }, 2000)
    } catch (error) {
      console.error("Scan failed:", error)
    }
  }

  const clearHighlights = async () => {
    if (!currentTab) return

    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: "clearHighlights"
      })
    } catch (error) {
      console.error("Clear highlights failed:", error)
    }
  }

  const getStatusInfo = () => {
    // 1. Handle initial or empty states
    if (!analysisResults || analysisResults.length === 0) {
      return {
        className: "safe",
        text: "Page is safe",
        stats: "No suspicious content detected"
      }
    }

    // 2. Filter for items that are actually above the set threshold
    const suspiciousItems = analysisResults.filter(
      (r) => r.confidence >= settings.threshold
    )

    // 3. If no items meet the threshold, the page is considered safe
    if (suspiciousItems.length === 0) {
      return {
        className: "safe",
        text: "Page is safe",
        stats: "No suspicious content detected"
      }
    }

    // 4. If we have suspicious items, find the most severe one
    const topResult = suspiciousItems.reduce(
      (max, item) => (item.confidence > max.confidence ? item : max),
      suspiciousItems[0]
    )

    const confidence = topResult.confidence
    const suspiciousCount = suspiciousItems.length
    const keywords = [
      ...new Set(
        suspiciousItems.flatMap((r) => r.details.matched_keywords || [])
      )
    ]

    // 5. Determine the warning level based on the highest confidence score
    if (confidence > 0.8) {
      return {
        className: "danger",
        text: "High risk content detected",
        stats: `Confidence: ${Math.round(confidence * 100)}% | Suspicious: ${suspiciousCount} | Keywords: ${keywords.slice(0, 3).join(", ")}`
      }
    } else {
      return {
        className: "warning",
        text: "Potentially suspicious content",
        stats: `Confidence: ${Math.round(confidence * 100)}% | Suspicious: ${suspiciousCount} | Keywords: ${keywords.slice(0, 3).join(", ")}`
      }
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="popup-container">
      <div className="header">
        <h1>🛡️ Judol Blocker</h1>
        <p>Keep your browsing safe</p>
      </div>

      <div className="main-content">
        <div className="status-section">
          <div className={`status-indicator ${statusInfo.className}`}>
            <div className={`status-dot ${statusInfo.className}`}></div>
            <div className="status-text">{statusInfo.text}</div>
          </div>
          <div className="stats" title={statusInfo.stats}>
            {statusInfo.stats}
          </div>
        </div>

        <div className="controls-section">
          <div className="control-group">
            <label>Extension Status</label>
            <button
              className={`toggle-btn ${settings.enabled ? "active" : ""}`}
              onClick={() => updateSetting("enabled", !settings.enabled)}>
              {settings.enabled ? "🟢 Enabled" : "🔴 Disabled"}
            </button>
          </div>

          <div className="control-group">
            <label htmlFor="blocking-mode">Blocking Mode</label>
            <select
              id="blocking-mode"
              value={settings.blockingMode}
              onChange={(e) => updateSetting("blockingMode", e.target.value)}>
              <option value="highlight">Highlight</option>
              <option value="blur">Blur</option>
              <option value="hide">Hide</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="threshold">
              Detection Threshold: {Math.round(settings.threshold * 100)}%
            </label>
            <input
              type="range"
              id="threshold"
              min="0"
              max="1"
              step="0.1"
              value={settings.threshold}
              onChange={(e) =>
                updateSetting("threshold", parseFloat(e.target.value))
              }
            />
          </div>

          <div className="control-group">
            <label>Notifications</label>
            <button
              className={`toggle-btn ${settings.showNotifications ? "active" : ""}`}
              onClick={() =>
                updateSetting("showNotifications", !settings.showNotifications)
              }>
              {settings.showNotifications ? "🔔 On" : "🔕 Off"}
            </button>
          </div>
        </div>

        <div className="actions-section">
          <button className="action-btn primary" onClick={scanPage}>
            🔍 Scan Page
          </button>
          <button className="action-btn secondary" onClick={clearHighlights}>
            ✨ Clear Highlights
          </button>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
