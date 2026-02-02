# Time Windows

Restrict agent operations to specific days of the week and hours of the day to enforce business schedules and reduce risk during off-hours.

## Overview

Time Window policies allow or block actions based on the current time. This ensures agents only operate during approved hours, preventing unauthorized after-hours activity, reducing weekend costs, and aligning with business operations.

## Use Cases

- **Business Hours Only**: Restrict agents to 9 AM - 5 PM weekdays
- **Weekend Shutdown**: Disable agents on Saturday and Sunday
- **After-Hours Protection**: Block high-risk operations outside business hours
- **Timezone Compliance**: Enforce regional working hours
- **Maintenance Windows**: Block agent activity during system maintenance

## Configuration

### Basic Configuration

```json
{
  "name": "Business Hours Only",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "America/Los_Angeles",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "start_time": "09:00",
    "end_time": "17:00"
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timezone` | string | Yes | IANA timezone (e.g., "America/New_York", "Europe/London") |
| `days` | array | Yes | Allowed days: `["Monday", ...]` |
| `start_time` | string | Yes | Start time in HH:MM format (24-hour) |
| `end_time` | string | Yes | End time in HH:MM format (24-hour) |
| `invert` | boolean | No | If true, BLOCK during specified window (default: false) |

## Examples

### Example 1: Standard Business Hours

Allow operations Monday-Friday, 9 AM - 5 PM PST:

```json
{
  "name": "Standard Business Hours",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "America/Los_Angeles",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "start_time": "09:00",
    "end_time": "17:00"
  }
}
```

### Example 2: 24/7 Operations (Weekdays Only)

Allow all hours on weekdays, block weekends:

```json
{
  "name": "Weekdays Only",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "UTC",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "start_time": "00:00",
    "end_time": "23:59"
  }
}
```

### Example 3: Block After-Hours (Inverted)

Block high-risk operations outside business hours:

```json
{
  "name": "Block After-Hours Trading",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "America/New_York",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "start_time": "18:00",
    "end_time": "08:00",
    "invert": true
  }
}
```

This BLOCKS operations between 6 PM and 8 AM.

### Example 4: Weekend Maintenance Window

Block all operations on weekends:

```json
{
  "name": "Weekend Shutdown",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "Europe/London",
    "days": ["Saturday", "Sunday"],
    "start_time": "00:00",
    "end_time": "23:59",
    "invert": true
  }
}
```

### Example 5: Trading Hours Only

Align with stock market hours (9:30 AM - 4 PM ET):

```json
{
  "name": "NYSE Trading Hours",
  "type": "TIME_WINDOW",
  "enabled": true,
  "config": {
    "timezone": "America/New_York",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "start_time": "09:30",
    "end_time": "16:00"
  }
}
```

## Common Timezones

| Region | Timezone |
|--------|----------|
| **US East Coast** | `America/New_York` |
| **US West Coast** | `America/Los_Angeles` |
| **US Central** | `America/Chicago` |
| **UK** | `Europe/London` |
| **Europe (CET)** | `Europe/Paris`, `Europe/Berlin` |
| **Asia (Japan)** | `Asia/Tokyo` |
| **Asia (Singapore)** | `Asia/Singapore` |
| **Australia (Sydney)** | `Australia/Sydney` |
| **UTC** | `UTC` |

[Full timezone list →](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Monitoring

### View Time-Based Blocks

```bash
bastion audit --blocked-only | grep "time window"
```

Output:
```
[2025-01-30T19:30:15Z] 🛑 BLOCKED - http_request
  URL: https://api.stripe.com/v1/charges
  Reason: Outside allowed time window (business hours: Mon-Fri 9AM-5PM PST)
```

## Best Practices

### 1. Layer Time Windows

Combine global and specific policies:

```json
[
  {
    "name": "Global Business Hours",
    "type": "TIME_WINDOW",
    "config": {
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "start_time": "08:00",
      "end_time": "18:00"
    }
  },
  {
    "name": "High-Risk Operations Restricted",
    "type": "TIME_WINDOW",
    "action_filter": { "url_pattern": "*/admin/*" },
    "config": {
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "start_time": "09:00",
      "end_time": "17:00"
    }
  }
]
```

### 2. Account for Daylight Saving Time

IANA timezones automatically handle DST. Use:
- `America/New_York` (handles EST/EDT automatically)
- NOT: `EST` or `UTC-5` (doesn't handle DST)

### 3. Test Before Deploying

```bash
bastion test --action-type http_request --url https://api.example.com
```

Verify current time falls within expected window.

## Related Policies

- **[Rate Limiting](/policies/rate-limiting)**: Limit request frequency
- **[Spending Limits](/policies/spending-limits)**: Cap costs
- **[Custom Webhooks](/policies/webhooks)**: Dynamic time-based logic

## Next Steps

- [Configure Rate Limiting](/policies/rate-limiting)
- [Set Up Spending Limits](/policies/spending-limits)
- [View Policy Examples](/guides/policy-examples)
