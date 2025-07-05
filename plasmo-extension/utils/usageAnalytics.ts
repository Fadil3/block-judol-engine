// Usage Analytics Utility Functions

export interface UsageEvent {
  timestamp: number
  type: "text" | "image"
  count: number
  plan: string
  pageUrl?: string
}

export interface UsageStats {
  totalKeywords: number
  totalImages: number
  averagePerDay: number
  peakUsageDay: string
  conversionRate: number
}

export class UsageAnalytics {
  private events: UsageEvent[] = []

  // Track a usage event
  trackEvent(
    type: "text" | "image",
    count: number,
    plan: string,
    pageUrl?: string
  ) {
    const event: UsageEvent = {
      timestamp: Date.now(),
      type,
      count,
      plan,
      pageUrl
    }

    this.events.push(event)
    this.saveEvents()
  }

  // Get usage statistics
  getStats(): UsageStats {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const recentEvents = this.events.filter((e) => e.timestamp > thirtyDaysAgo)

    const totalKeywords = recentEvents
      .filter((e) => e.type === "text")
      .reduce((sum, e) => sum + e.count, 0)

    const totalImages = recentEvents
      .filter((e) => e.type === "image")
      .reduce((sum, e) => sum + e.count, 0)

    const averagePerDay = (totalKeywords + totalImages) / 30

    // Find peak usage day
    const dailyUsage = new Map<string, number>()
    recentEvents.forEach((event) => {
      const date = new Date(event.timestamp).toDateString()
      dailyUsage.set(date, (dailyUsage.get(date) || 0) + event.count)
    })

    let peakUsageDay = ""
    let maxUsage = 0
    dailyUsage.forEach((usage, date) => {
      if (usage > maxUsage) {
        maxUsage = usage
        peakUsageDay = date
      }
    })

    // Calculate conversion rate (free to paid)
    const freeUsers = new Set(
      this.events.filter((e) => e.plan === "free").map((e) => e.pageUrl)
    )
    const paidUsers = new Set(
      this.events.filter((e) => e.plan !== "free").map((e) => e.pageUrl)
    )
    const conversionRate =
      paidUsers.size / (freeUsers.size + paidUsers.size) || 0

    return {
      totalKeywords,
      totalImages,
      averagePerDay,
      peakUsageDay,
      conversionRate
    }
  }

  // Get usage by plan
  getUsageByPlan() {
    const planUsage = new Map<string, { keywords: number; images: number }>()

    this.events.forEach((event) => {
      const current = planUsage.get(event.plan) || { keywords: 0, images: 0 }

      if (event.type === "text") {
        current.keywords += event.count
      } else {
        current.images += event.count
      }

      planUsage.set(event.plan, current)
    })

    return Object.fromEntries(planUsage)
  }

  // Get top blocked domains
  getTopBlockedDomains(limit: number = 10) {
    const domainCount = new Map<string, number>()

    this.events.forEach((event) => {
      if (event.pageUrl) {
        try {
          const domain = new URL(event.pageUrl).hostname
          domainCount.set(domain, (domainCount.get(domain) || 0) + event.count)
        } catch (e) {
          // Invalid URL, skip
        }
      }
    })

    return Array.from(domainCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, count]) => ({ domain, count }))
  }

  // Export data for analysis
  exportData() {
    return {
      events: this.events,
      stats: this.getStats(),
      planUsage: this.getUsageByPlan(),
      topDomains: this.getTopBlockedDomains()
    }
  }

  // Clear old events (keep last 90 days)
  cleanup() {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
    this.events = this.events.filter((e) => e.timestamp > ninetyDaysAgo)
    this.saveEvents()
  }

  private saveEvents() {
    try {
      localStorage.setItem("usageAnalytics", JSON.stringify(this.events))
    } catch (e) {
      console.warn("Failed to save usage analytics:", e)
    }
  }

  private loadEvents() {
    try {
      const saved = localStorage.getItem("usageAnalytics")
      if (saved) {
        this.events = JSON.parse(saved)
      }
    } catch (e) {
      console.warn("Failed to load usage analytics:", e)
      this.events = []
    }
  }

  constructor() {
    this.loadEvents()
  }
}

// Global analytics instance
export const analytics = new UsageAnalytics()

// Helper functions for easy tracking
export const trackKeywordBlock = (
  count: number = 1,
  plan: string,
  pageUrl?: string
) => {
  analytics.trackEvent("text", count, plan, pageUrl)
}

export const trackImageBlock = (
  count: number = 1,
  plan: string,
  pageUrl?: string
) => {
  analytics.trackEvent("image", count, plan, pageUrl)
}

export const getUsageStats = () => analytics.getStats()
export const getUsageByPlan = () => analytics.getUsageByPlan()
export const getTopBlockedDomains = (limit?: number) =>
  analytics.getTopBlockedDomains(limit)
export const exportAnalyticsData = () => analytics.exportData()
