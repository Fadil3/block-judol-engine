import headerImage from "data-base64:~assets/header.png"
import settingsImage from "data-base64:~assets/settings.png"
import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import "./popup.css"

import { SettingsPage } from "~components/settings"

interface Settings {
  enabled: boolean
  threshold: number
  blockingMode: "blur" | "hide"
}

interface BlockStats {
  text: number
  images: number
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

// --- NEW Monetization Interfaces ---
interface SubscriptionPlan {
  name: "free" | "monthly" | "yearly"
  keywordLimit: number
  imageLimit: number
  price?: number
}

interface UsageStats {
  keywordsUsed: number
  imagesUsed: number
  resetDate: string // ISO date string for when usage resets
}

interface SubscriptionStatus {
  plan: SubscriptionPlan
  usage: UsageStats
  isActive: boolean
}
// --- END NEW Interfaces ---

const storage = new Storage()

// Subscription plans configuration
const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    name: "free",
    keywordLimit: 1000,
    imageLimit: 100
  },
  monthly: {
    name: "monthly",
    keywordLimit: 100000,
    imageLimit: 5000,
    price: 9.99
  },
  yearly: {
    name: "yearly",
    keywordLimit: 1000000,
    imageLimit: 50000,
    price: 99.99
  }
}

function IndexPopup() {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [analysisResults, setAnalysisResults] = useState<
    AnalysisResult[] | null
  >(null)
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    threshold: 0.5,
    blockingMode: "blur"
  })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState("main") // "main" or "settings"
  const [blockStats, setBlockStats] = useState<BlockStats>({
    text: 0,
    images: 0
  })
  // --- NEW State for monetization ---
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>({
      plan: SUBSCRIPTION_PLANS.monthly,
      usage: {
        keywordsUsed: 50000,
        imagesUsed: 2500,
        resetDate: new Date().toISOString()
      },
      isActive: true
    })
  // --- END NEW State ---

  useEffect(() => {
    const initializePopup = async () => {
      await loadSettings()
      await loadBlockStats()
      await loadSubscriptionStatus()
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

  // Listen for content blocking events from content script
  useEffect(() => {
    const handleMessage = async (
      message: any,
      sender: any,
      sendResponse: any
    ) => {
      if (message.action === "contentBlocked") {
        const success = await handleContentBlocked(message.type, message.count)
        sendResponse({ success })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [subscriptionStatus])

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
        blockingMode: (["blur", "hide"].includes(loadedSettings.blockingMode)
          ? loadedSettings.blockingMode
          : "blur") as "blur" | "hide"
      })
    } catch (error) {
      console.error("Failed to load settings:", error)
    }
  }

  const loadBlockStats = async () => {
    const statsJSON = await storage.get("blockStats")
    if (statsJSON) {
      try {
        setBlockStats(JSON.parse(statsJSON))
      } catch (e) {
        console.error("Failed to parse block stats", e)
      }
    }
  }

  const loadSubscriptionStatus = async () => {
    try {
      const subscriptionData = await storage.get("subscriptionStatus")
      if (subscriptionData) {
        const parsed = JSON.parse(subscriptionData)

        // Check if monthly reset is needed
        const resetDate = new Date(parsed.usage.resetDate)
        const now = new Date()
        const needsReset =
          now.getMonth() !== resetDate.getMonth() ||
          now.getFullYear() !== resetDate.getFullYear()

        if (needsReset) {
          // Reset usage for new month
          const updatedStatus = {
            ...parsed,
            usage: {
              keywordsUsed: 0,
              imagesUsed: 0,
              resetDate: now.toISOString()
            }
          }
          await storage.set("subscriptionStatus", JSON.stringify(updatedStatus))
          setSubscriptionStatus(updatedStatus)
        } else {
          setSubscriptionStatus(parsed)
        }
      } else {
        // Initialize with monthly plan, half used
        const initialStatus: SubscriptionStatus = {
          plan: SUBSCRIPTION_PLANS.monthly,
          usage: {
            keywordsUsed: 50000,
            imagesUsed: 2500,
            resetDate: new Date().toISOString()
          },
          isActive: true
        }
        await storage.set("subscriptionStatus", JSON.stringify(initialStatus))
        setSubscriptionStatus(initialStatus)
      }
    } catch (error) {
      console.error("Failed to load subscription status:", error)
      // Fallback to free plan on error
      const fallbackStatus: SubscriptionStatus = {
        plan: SUBSCRIPTION_PLANS.free,
        usage: {
          keywordsUsed: 0,
          imagesUsed: 0,
          resetDate: new Date().toISOString()
        },
        isActive: true
      }
      setSubscriptionStatus(fallbackStatus)
    }
  }

  const updateUsage = async (keywordsUsed: number, imagesUsed: number) => {
    const newUsage = {
      ...subscriptionStatus.usage,
      keywordsUsed,
      imagesUsed
    }

    const newStatus = {
      ...subscriptionStatus,
      usage: newUsage
    }

    setSubscriptionStatus(newStatus)
    await storage.set("subscriptionStatus", JSON.stringify(newStatus))
  }

  const checkUsageLimits = () => {
    const { plan, usage } = subscriptionStatus
    return {
      keywordsExceeded: usage.keywordsUsed >= plan.keywordLimit,
      imagesExceeded: usage.imagesUsed >= plan.imageLimit,
      keywordsRemaining: Math.max(0, plan.keywordLimit - usage.keywordsUsed),
      imagesRemaining: Math.max(0, plan.imageLimit - usage.imagesUsed)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toString()
  }

  const getNextResetDate = (): string => {
    const resetDate = new Date(subscriptionStatus.usage.resetDate)
    const nextMonth = new Date(
      resetDate.getFullYear(),
      resetDate.getMonth() + 1,
      1
    )
    return nextMonth.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  // Function to handle actual content blocking (called from content script)
  const handleContentBlocked = async (
    type: "text" | "image",
    count: number = 1
  ) => {
    const limits = checkUsageLimits()

    if (type === "text" && limits.keywordsExceeded) {
      console.warn("Keyword limit exceeded, content not blocked")
      return false
    }

    if (type === "image" && limits.imagesExceeded) {
      console.warn("Image limit exceeded, content not blocked")
      return false
    }

    const newKeywordsUsed =
      type === "text"
        ? subscriptionStatus.usage.keywordsUsed + count
        : subscriptionStatus.usage.keywordsUsed

    const newImagesUsed =
      type === "image"
        ? subscriptionStatus.usage.imagesUsed + count
        : subscriptionStatus.usage.imagesUsed

    await updateUsage(newKeywordsUsed, newImagesUsed)
    return true
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

    // Check usage limits before scanning
    const limits = checkUsageLimits()
    if (limits.keywordsExceeded || limits.imagesExceeded) {
      alert(
        "Usage limit reached! Please upgrade your plan to continue scanning."
      )
      return
    }

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

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname
    } catch (e) {
      return url
    }
  }

  const getStatusInfo = () => {
    // 1. Handle initial or empty states
    if (!analysisResults || analysisResults.length === 0) {
      return {
        className: "safe",
        text: "Page is safe",
        number: 0,
        stats: "0 word or image related to judol in this page"
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
        number: 0,
        stats: "0 word or image related to judol in this page"
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
        text: "HIGH RISK CONTENT DETECTED",
        number: suspiciousCount,
        stats: `${suspiciousCount} word or image related to judol in this page`
      }
    } else {
      return {
        className: "warning",
        text: "Potentially suspicious content",
        number: suspiciousCount,
        stats: `${suspiciousCount} word or image related to judol in this page`
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

  if (view === "settings") {
    return (
      <SettingsPage
        threshold={settings.threshold}
        onThresholdChange={(value) => updateSetting("threshold", value)}
        onBack={() => setView("main")}
      />
    )
  }

  return (
    <div className="popup-container">
      <div className="header">
        <img src={headerImage} className="logo" alt="Logo" />
        <img
          src={settingsImage}
          className="settings-icon"
          alt="Settings"
          onClick={() => setView("settings")}
        />
      </div>
      <div className="inner-container">
        <div className="main-content">
          <div className="page-url" title={currentTab?.url}>
            {currentTab?.url ? getHostname(currentTab.url) : "Current Page"}
          </div>

          <div className="status-section">
            <div className={`status-indicator ${statusInfo.className}`}>
              <div className={`status-dot ${statusInfo.className}`}></div>
              <div className={`status-text ${statusInfo.className}`}>
                {statusInfo.text}
              </div>
            </div>
            <div className="stats" title={statusInfo.stats}>
              {statusInfo.number > 0 ? (
                <>
                  <span className="suspicious-count">{statusInfo.number}</span>{" "}
                  word or image related to judol in this page
                </>
              ) : (
                <>
                  <span className="safe-count">0</span> word or image related to
                  judol in this page
                </>
              )}
            </div>
          </div>

          <div className="control-group">
            <label htmlFor="blocking-mode">Blocking Mode</label>
            <select
              id="blocking-mode"
              value={settings.blockingMode}
              onChange={(e) => updateSetting("blockingMode", e.target.value)}>
              <option value="blur">Blur</option>
              <option value="hide">Hide</option>
            </select>
          </div>

          <div className="stats-section">
            <div className="stats-title">BLOCKED AMOUNT</div>
            <div className="stats-container">
              {/* WORD BLOCKS */}
              <div className="stat-item">
                <div className="progress-bar-container large">
                  <div
                    className="progress-bar large"
                    style={{
                      width: `${Math.min((subscriptionStatus.usage.keywordsUsed / subscriptionStatus.plan.keywordLimit) * 100, 100)}%`
                    }}></div>
                </div>
                <div className="progress-labels">
                  <span className="progress-label min">0</span>
                  <span className="progress-label mid">
                    {formatNumber(subscriptionStatus.plan.keywordLimit / 2)}
                  </span>
                  <span className="progress-label max">
                    {formatNumber(subscriptionStatus.plan.keywordLimit)}
                  </span>
                </div>
                <div className="blocks-left">
                  <span className="blocks-left-number">
                    {formatNumber(
                      subscriptionStatus.plan.keywordLimit -
                        subscriptionStatus.usage.keywordsUsed
                    )}
                  </span>{" "}
                  word blocks left this month
                </div>
              </div>
              {/* IMAGE BLOCKS */}
              <div className="stat-item">
                <div className="progress-bar-container large">
                  <div
                    className="progress-bar large"
                    style={{
                      width: `${Math.min((subscriptionStatus.usage.imagesUsed / subscriptionStatus.plan.imageLimit) * 100, 100)}%`
                    }}></div>
                </div>
                <div className="progress-labels">
                  <span className="progress-label min">0</span>
                  <span className="progress-label mid">
                    {formatNumber(subscriptionStatus.plan.imageLimit / 2)}
                  </span>
                  <span className="progress-label max">
                    {formatNumber(subscriptionStatus.plan.imageLimit)}
                  </span>
                </div>
                <div className="blocks-left">
                  <span className="blocks-left-number">
                    {formatNumber(
                      subscriptionStatus.plan.imageLimit -
                        subscriptionStatus.usage.imagesUsed
                    )}
                  </span>{" "}
                  image blocks left this month
                </div>
              </div>
            </div>
          </div>

          <div className="controls-section">
            <div className="control-group">
              <label>Status</label>
              <button
                className={`status-pill ${settings.enabled ? "enabled" : "disabled"}`}
                onClick={() => updateSetting("enabled", !settings.enabled)}>
                <span className="status-pill-icon">
                  {settings.enabled ? (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="12" fill="#1DCD9F" />
                      <polygon points="10,8 16,12 10,16" fill="#fff" />
                    </svg>
                  ) : (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="12" fill="#FF4D4F" />
                      <rect x="8" y="8" width="2.5" height="8" fill="#fff" />
                      <rect x="13.5" y="8" width="2.5" height="8" fill="#fff" />
                    </svg>
                  )}
                </span>
                <span className="status-pill-label">
                  {settings.enabled ? "ENABLE" : "DISABLE"}
                </span>
              </button>
            </div>
            <button className="subscribe-btn">
              SUBSCRIBE FOR UNLIMITED BLOCK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
