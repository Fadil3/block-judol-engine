# Monetization System Documentation

## Overview

The extension now includes a comprehensive monetization system with usage-based limits for different subscription tiers.

## Subscription Plans

### Free Plan

- **Keywords:** 1,000 blocks per month
- **Images:** 100 blocks per month
- **Price:** Free

### Monthly Plan

- **Keywords:** 100,000 blocks per month
- **Images:** 5,000 blocks per month
- **Price:** $9.99/month

### Yearly Plan

- **Keywords:** 1,000,000 blocks per month
- **Images:** 50,000 blocks per month
- **Price:** $99.99/year

## Features Implemented

### 1. Usage Tracking

- Persistent storage of usage statistics
- Automatic reset on monthly/yearly cycles
- Real-time usage display

### 2. Visual Progress Indicators

- Progress bars showing usage percentage
- Color-coded indicators (green = safe, red = exceeded)
- Remaining blocks counter
- Plan badges

### 3. Limit Enforcement

- Scan functionality disabled when limits exceeded
- Warning messages for limit violations
- Upgrade prompts when needed

### 4. User Interface

- Clean, modern design
- Responsive layout
- Clear usage statistics
- Easy plan management

## Technical Implementation

### Storage Structure

```typescript
interface SubscriptionStatus {
  plan: SubscriptionPlan
  usage: UsageStats
  isActive: boolean
}

interface UsageStats {
  keywordsUsed: number
  imagesUsed: number
  resetDate: string
}
```

### Key Functions

- `loadSubscriptionStatus()` - Loads user's subscription data
- `updateUsage()` - Updates usage statistics
- `checkUsageLimits()` - Validates current usage against limits
- `formatNumber()` - Formats large numbers (K, M)

### CSS Classes

- `.usage-numbers` - Usage counter display
- `.remaining-blocks` - Remaining blocks text
- `.progress-bar.exceeded` - Exceeded limit styling
- `.limit-warning` - Warning message styling
- `.subscription-info` - Plan information section

## Production Deployment

### 1. Remove Test Features

Before deploying to production, remove these test buttons:

- "🧪 Simulate Usage"
- "🔄 Reset Usage"
- "📅 Monthly" (test upgrade)
- "📅 Yearly" (test upgrade)

### 2. Connect Payment System

Update the upgrade button URL:

```typescript
onClick={() => window.open("https://your-payment-page.com", "_blank")}
```

### 3. Implement Usage Tracking

Connect the `updateUsage()` function to actual content blocking events:

```typescript
// When content is blocked
await updateUsage(currentKeywords + 1, currentImages + 1)
```

### 4. Add Analytics

Track usage patterns and conversion rates for optimization.

## Usage Examples

### Checking Limits

```typescript
const limits = checkUsageLimits()
if (limits.keywordsExceeded) {
  // Show upgrade prompt
}
```

### Updating Usage

```typescript
await updateUsage(
  subscriptionStatus.usage.keywordsUsed + 1,
  subscriptionStatus.usage.imagesUsed + 1
)
```

### Formatting Numbers

```typescript
formatNumber(1500) // Returns "1.5K"
formatNumber(1000000) // Returns "1.0M"
```

## Future Enhancements

### 1. Advanced Analytics

- Usage heatmaps
- Conversion tracking
- A/B testing for pricing

### 2. Additional Features

- Usage history charts
- Export usage data
- Custom limits for enterprise

### 3. Payment Integration

- Stripe integration
- PayPal support
- Subscription management portal

## Testing

### Manual Testing

1. Load extension with free plan
2. Use "Simulate Usage" to test limits
3. Verify warning messages appear
4. Test plan upgrades
5. Verify usage resets

### Automated Testing

- Unit tests for usage calculations
- Integration tests for storage
- UI tests for limit enforcement

## Support

For questions about the monetization system, refer to:

- Usage tracking implementation
- Payment integration guides
- Analytics setup documentation
