# Spending Limits

Enforce maximum transaction amounts over time windows to prevent excessive costs from AI agent operations.

## Overview

The Spending Limit policy tracks cumulative transaction values within a specified time window and blocks actions that would exceed the configured threshold. This prevents runaway costs from AI agents making expensive API calls, blockchain transactions, or other financial operations.

## Use Cases

- **Trading Bots**: Limit maximum losses per day/week/month
- **API-Heavy Agents**: Cap spending on paid APIs (OpenAI, cloud services)
- **Blockchain Agents**: Restrict transaction amounts for DeFi operations
- **Cloud Operations**: Prevent excessive infrastructure costs

## Configuration

### Basic Configuration

```json
{
  "name": "Daily Spending Cap",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 1000,
    "currency": "USD",
    "window": "24h"
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_amount` | number | Yes | Maximum amount allowed in the time window |
| `currency` | string | No | Currency code (USD, EUR, ETH, etc.). Default: USD |
| `window` | string | Yes | Time window: `1h`, `24h`, `7d`, `30d` |

### Time Window Options

- `1h` - 1 hour (3600 seconds)
- `24h` - 24 hours (86400 seconds)
- `7d` - 7 days (604800 seconds)
- `30d` - 30 days (2592000 seconds)

## How It Works

### Evaluation Flow

1. Agent attempts an action with a transaction value
2. Bastion extracts the amount from the action details
3. Bastion queries the database for total spending in the current window
4. If `current_spending + new_amount > max_amount`, the action is **BLOCKED**
5. If within limits, the action is **ALLOWED** and the amount is tracked

### Amount Detection

Bastion automatically detects transaction amounts from:
- HTTP request bodies containing `amount`, `value`, or `total` fields
- Blockchain transaction `value` fields
- API calls with pricing metadata

## Examples

### Example 1: Daily Trading Limit

Prevent a trading bot from losing more than $500 per day:

```json
{
  "name": "Max Daily Loss",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 500,
    "currency": "USD",
    "window": "24h"
  }
}
```

**Scenario:**
- 10:00 AM: Bot makes trade, loses $200 → **ALLOWED** (total: $200)
- 02:00 PM: Bot makes trade, loses $150 → **ALLOWED** (total: $350)
- 06:00 PM: Bot attempts trade, would lose $300 → **BLOCKED** (would exceed $500)

### Example 2: Weekly API Budget

Cap OpenAI API spending at $100 per week:

```json
{
  "name": "Weekly OpenAI Budget",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 100,
    "currency": "USD",
    "window": "7d"
  }
}
```

### Example 3: Monthly Cloud Budget

Limit AWS/GCP spending to $1000 per month:

```json
{
  "name": "Monthly Cloud Cap",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 1000,
    "currency": "USD",
    "window": "30d"
  }
}
```

### Example 4: Hourly Rate Limit for High-Frequency Trading

Prevent flash crashes by limiting hourly trading volume:

```json
{
  "name": "HFT Hourly Cap",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 10000,
    "currency": "USD",
    "window": "1h"
  }
}
```

## Dashboard Configuration

### Creating via Dashboard

1. Navigate to [https://bastion.legatia.solutions/policies](https://bastion.legatia.solutions/policies)
2. Click "Create Policy"
3. Select "Spending Limits"
4. Configure:
   - **Policy Name**: Descriptive name
   - **Max Amount**: Numeric value
   - **Currency**: Currency code
   - **Time Window**: Select from dropdown
5. Click "Create"

## Monitoring

### View Spending

Check current spending against limits:

```bash
bastion stats --range today
```

Output:
```
📊 Spending Statistics (today)

Total Spent: $450.00 / $1,000.00
Remaining: $550.00
Time Until Reset: 6 hours 23 minutes

Top Spending Categories:
  OpenAI API: $300.00
  AWS Services: $150.00
```

### Audit Blocked Transactions

View transactions that were blocked due to spending limits:

```bash
bastion audit --blocked-only | grep "Spending limit"
```

## Best Practices

### 1. Layer Multiple Time Windows

Combine short and long-term limits:

```json
[
  {
    "name": "Hourly Cap",
    "config": { "max_amount": 100, "window": "1h" }
  },
  {
    "name": "Daily Cap",
    "config": { "max_amount": 1000, "window": "24h" }
  },
  {
    "name": "Monthly Cap",
    "config": { "max_amount": 10000, "window": "30d" }
  }
]
```

### 2. Start Conservative

Begin with strict limits and gradually increase based on observed behavior:

```
Week 1: $100/day
Week 2: $500/day (if no issues)
Week 3: $1000/day (if performing well)
```

### 3. Separate by Agent

Different agents may need different limits:

```json
{
  "name": "Production Bot Limit",
  "agent_ids": ["prod-agent-id"],
  "config": { "max_amount": 5000 }
},
{
  "name": "Test Bot Limit",
  "agent_ids": ["test-agent-id"],
  "config": { "max_amount": 100 }
}
```

### 4. Monitor Trends

Review spending patterns weekly:
- Are limits being hit frequently?
- Is spending consistent or spiky?
- Which operations cost the most?

## Advanced Configuration

### Per-API Spending Limits

Target specific APIs:

```json
{
  "name": "OpenAI Specific Limit",
  "type": "SPENDING_LIMIT",
  "config": {
    "max_amount": 200,
    "window": "24h",
    "action_filter": {
      "url_pattern": "api.openai.com"
    }
  }
}
```

### Dynamic Limits Based on Performance

Use custom webhooks to adjust limits based on agent performance:

```json
{
  "name": "Performance-Based Limit",
  "type": "CUSTOM_WEBHOOK",
  "config": {
    "webhook_url": "https://your-server.com/check-spending",
    "method": "POST"
  }
}
```

Your webhook can implement dynamic logic:
- If agent is profitable, allow more spending
- If agent is losing money, reduce limits
- Adjust based on market conditions

## Limitations

### What Spending Limits Can't Do

- **Track External Costs**: Only tracks costs visible in intercepted requests
- **Cross-Agent Totals**: Limits are per-agent, not account-wide
- **Real-Time Price Updates**: Uses static pricing, not live market rates
- **Non-HTTP Operations**: Can't track spending outside HTTP requests

### Workarounds

**Account-Wide Limits**: Use custom webhooks to query total spending across all agents

**Real-Time Pricing**: Integrate with pricing APIs via custom webhooks

**External Cost Tracking**: Send cost data to Bastion API separately

## Troubleshooting

### Policy Not Triggering

**Problem**: Spending exceeds limits but actions aren't blocked

**Solutions**:
1. Check policy is enabled
2. Verify agent_ids are correct
3. Ensure amount fields are being detected:
   ```bash
   bastion audit --verbose | grep "amount"
   ```

### Amount Not Detected

**Problem**: Transaction amounts aren't being tracked

**Solutions**:
1. Check request body format
2. Use standard field names: `amount`, `value`, `total`
3. Add custom amount extraction logic via webhooks

### False Positives

**Problem**: Legitimate transactions are blocked

**Solutions**:
1. Increase max_amount
2. Adjust time window (e.g., 24h → 7d)
3. Use separate limits for different operation types

## Related Policies

Combine spending limits with other policies for comprehensive protection:

- **[Rate Limiting](/policies/rate-limiting)**: Limit request frequency
- **[Time Windows](/policies/time-windows)**: Restrict operations to business hours
- **[Custom Webhooks](/policies/webhooks)**: Dynamic spending logic

## Next Steps

- [Configure Rate Limiting](/policies/rate-limiting)
- [Set Up Monitoring](/guides/monitoring)
- [View Policy Examples](/guides/policy-examples)
