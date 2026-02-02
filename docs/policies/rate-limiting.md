# Rate Limiting

Control the frequency of agent actions to prevent API abuse, resource exhaustion, and service disruption.

## Overview

The Rate Limiting policy restricts the number of actions an agent can perform within a specified time window. This prevents agents from overwhelming external APIs, exhausting quotas, or triggering rate limits on third-party services.

## Use Cases

- **API Protection**: Respect third-party API rate limits (OpenAI: 3500 RPM, Stripe: 100 RPS)
- **Cost Control**: Reduce unnecessary API calls to minimize costs
- **Service Protection**: Prevent overwhelming your own backend services
- **Debugging**: Slow down agents during development to observe behavior
- **Compliance**: Enforce SLAs and fair usage policies

## Configuration

### Basic Configuration

```json
{
  "name": "OpenAI Rate Limit",
  "type": "RATE_LIMIT",
  "enabled": true,
  "config": {
    "max_requests": 100,
    "window": "60",
    "unit": "seconds"
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_requests` | number | Yes | Maximum number of requests allowed |
| `window` | number | Yes | Time window duration |
| `unit` | string | Yes | Time unit: `seconds`, `minutes`, `hours`, `days` |

### Time Unit Options

| Unit | Description | Example Window |
|------|-------------|----------------|
| `seconds` | Per-second rate limiting | 10 requests / 1 second |
| `minutes` | Per-minute rate limiting | 100 requests / 1 minute |
| `hours` | Per-hour rate limiting | 1000 requests / 1 hour |
| `days` | Per-day rate limiting | 10000 requests / 1 day |

## How It Works

### Sliding Window Algorithm

Bastion uses a **sliding window** approach for accurate rate limiting:

1. Agent attempts an action
2. Bastion queries the database for actions in the last N seconds/minutes/hours/days
3. If `count >= max_requests`, the action is **BLOCKED**
4. If within limit, the action is **ALLOWED** and timestamp is recorded

### Example: 100 requests per minute

```
Time    Request Count   Status
10:00   50              ALLOWED
10:30   75              ALLOWED
10:45   99              ALLOWED
10:50   100             ALLOWED (last one!)
10:55   Attempt         BLOCKED (limit reached)
11:00   50              ALLOWED (old requests expired)
```

## Examples

### Example 1: OpenAI API Rate Limit

OpenAI allows 3,500 requests per minute on paid plans:

```json
{
  "name": "OpenAI RPM Limit",
  "type": "RATE_LIMIT",
  "enabled": true,
  "config": {
    "max_requests": 3500,
    "window": 1,
    "unit": "minutes"
  }
}
```

### Example 2: Conservative API Usage

Limit agent to 10 requests per second to avoid overwhelming services:

```json
{
  "name": "Conservative Rate Limit",
  "type": "RATE_LIMIT",
  "enabled": true,
  "config": {
    "max_requests": 10,
    "window": 1,
    "unit": "seconds"
  }
}
```

### Example 3: Daily Quota

Enforce a daily quota of 10,000 requests:

```json
{
  "name": "Daily Quota",
  "type": "RATE_LIMIT",
  "enabled": true,
  "config": {
    "max_requests": 10000,
    "window": 1,
    "unit": "days"
  }
}
```

### Example 4: Development Throttling

Slow down agents during development for easier debugging:

```json
{
  "name": "Dev Throttle",
  "type": "RATE_LIMIT",
  "enabled": true,
  "config": {
    "max_requests": 1,
    "window": 2,
    "unit": "seconds"
  }
}
```

This allows only 1 request every 2 seconds (0.5 RPS).

## Dashboard Configuration

### Creating via Dashboard

1. Navigate to [https://bastion.legatia.solutions/policies](https://bastion.legatia.solutions/policies)
2. Click "Create Policy"
3. Select "Rate Limiting"
4. Configure:
   - **Policy Name**: Descriptive name
   - **Max Requests**: Number of requests allowed
   - **Time Window**: Duration (number)
   - **Time Unit**: Select from dropdown (seconds/minutes/hours/days)
5. Click "Create"

## Monitoring

### Real-Time Monitoring

Watch rate limit enforcement in real-time:

```bash
bastion logs -f
```

Output:
```
[10:30:15] http_request - {"url": "https://api.openai.com/..."}
   ✓ ALLOWED (95/100 requests in last minute)

[10:30:16] http_request - {"url": "https://api.openai.com/..."}
   🛑 BLOCKED: Rate limit exceeded (100/100 requests)
```

### Check Statistics

View rate limit statistics:

```bash
bastion stats --range hour
```

Output:
```
📊 Rate Limit Statistics (last hour)

Total Requests: 5,432
Blocked by Rate Limit: 127 (2.3%)
Peak Rate: 98 requests/minute (at 10:30 AM)

Average Rate: 90.5 requests/minute
```

### Audit Blocked Requests

See which requests were rate-limited:

```bash
bastion audit --blocked-only | grep "Rate limit"
```

## Best Practices

### 1. Layer Multiple Time Windows

Combine short-term and long-term limits:

```json
[
  {
    "name": "Burst Protection",
    "config": { "max_requests": 10, "window": 1, "unit": "seconds" }
  },
  {
    "name": "Minute Limit",
    "config": { "max_requests": 100, "window": 1, "unit": "minutes" }
  },
  {
    "name": "Daily Quota",
    "config": { "max_requests": 10000, "window": 1, "unit": "days" }
  }
]
```

This prevents both burst attacks (10 RPS) and sustained overuse (daily quota).

### 2. Match Third-Party Limits

Set your rate limits slightly below third-party limits to avoid hitting their restrictions:

```json
{
  "name": "OpenAI (Safe)",
  "config": {
    "max_requests": 3000,  // OpenAI allows 3500, we use 3000
    "window": 1,
    "unit": "minutes"
  }
}
```

### 3. Per-API Rate Limits

Different APIs have different limits:

```json
{
  "name": "OpenAI Limit",
  "action_filter": { "url_pattern": "api.openai.com" },
  "config": { "max_requests": 3000, "window": 1, "unit": "minutes" }
},
{
  "name": "Stripe Limit",
  "action_filter": { "url_pattern": "api.stripe.com" },
  "config": { "max_requests": 100, "window": 1, "unit": "seconds" }
}
```

### 4. Development vs Production

Use different limits for different environments:

**Development**:
```json
{
  "name": "Dev Rate Limit",
  "agent_ids": ["dev-agent-id"],
  "config": { "max_requests": 10, "window": 1, "unit": "minutes" }
}
```

**Production**:
```json
{
  "name": "Prod Rate Limit",
  "agent_ids": ["prod-agent-id"],
  "config": { "max_requests": 3000, "window": 1, "unit": "minutes" }
}
```

### 5. Gradual Rollout

Start strict, then loosen based on observed behavior:

```
Day 1-7:   10 req/min
Day 8-14:  50 req/min
Day 15+:   100 req/min
```

## Advanced Configuration

### Per-Endpoint Rate Limits

Apply different limits to different endpoints:

```json
{
  "name": "Write Endpoint Limit",
  "type": "RATE_LIMIT",
  "config": {
    "max_requests": 10,
    "window": 1,
    "unit": "minutes",
    "action_filter": {
      "method": "POST|PUT|DELETE"
    }
  }
},
{
  "name": "Read Endpoint Limit",
  "type": "RATE_LIMIT",
  "config": {
    "max_requests": 100,
    "window": 1,
    "unit": "minutes",
    "action_filter": {
      "method": "GET"
    }
  }
}
```

### Token Bucket Implementation

For more sophisticated rate limiting, use custom webhooks to implement token bucket algorithms:

```json
{
  "name": "Token Bucket Rate Limit",
  "type": "CUSTOM_WEBHOOK",
  "config": {
    "webhook_url": "https://your-server.com/rate-limit",
    "method": "POST"
  }
}
```

Your webhook can implement:
- Token bucket (allow bursts with refill rate)
- Leaky bucket (smooth out traffic)
- Adaptive rate limits (adjust based on load)

## Common Rate Limits by Service

### OpenAI

| Plan | Limit |
|------|-------|
| Free | 3 RPM |
| Pay-as-you-go | 3,500 RPM |
| Enterprise | Custom |

### Anthropic (Claude)

| Plan | Limit |
|------|-------|
| Free | 5 RPM |
| Pro | 1,000 RPM |
| Enterprise | Custom |

### Stripe

| Endpoint | Limit |
|----------|-------|
| Read | 100 RPS |
| Write | 100 RPS (lower for some endpoints) |

### AWS

| Service | Limit |
|---------|-------|
| S3 | 3,500 PUT/s, 5,500 GET/s per prefix |
| Lambda | 1,000 concurrent executions (soft limit) |
| DynamoDB | 40,000 RCU/WCU (adjustable) |

## Troubleshooting

### Policy Not Triggering

**Problem**: Agent exceeds expected rate but isn't blocked

**Solutions**:
1. Check policy is enabled
2. Verify time unit is correct (seconds vs minutes)
3. Check agent_ids match
4. Review action filters

### Too Restrictive

**Problem**: Legitimate requests are being blocked

**Solutions**:
1. Increase `max_requests`
2. Increase `window` duration
3. Split into separate policies for different operations
4. Review audit logs to understand actual usage patterns

### Inconsistent Enforcement

**Problem**: Rate limit seems to vary

**Solutions**:
1. Check if multiple policies are active
2. Verify sliding window implementation (not fixed window)
3. Check system clock synchronization

## Limitations

### What Rate Limiting Can't Do

- **Cross-Agent Limiting**: Limits are per-agent, not account-wide
- **Distributed Rate Limiting**: Doesn't coordinate across multiple Bastion instances
- **Client-Side Awareness**: Agent doesn't know its current rate limit status
- **Predictive Throttling**: Doesn't prevent bursts, only blocks when limit is reached

### Workarounds

**Cross-Agent Limits**: Use custom webhooks with shared state

**Distributed Coordination**: Use Redis-backed rate limiting via webhooks

**Client-Side Feedback**: Query usage stats via API before making requests

## Related Policies

Combine rate limiting with other policies:

- **[Spending Limits](/policies/spending-limits)**: Control costs
- **[Time Windows](/policies/time-windows)**: Restrict to business hours
- **[Pattern Matching](/policies/pattern-matching)**: Block dangerous patterns
- **[Allowlist](/policies/allow-block-lists)**: Whitelist specific domains

## Performance Impact

### Overhead

Rate limiting adds minimal overhead:
- **Latency**: ~5ms per request (database query)
- **Memory**: Negligible (timestamp storage)
- **Database**: 1 read + 1 write per request

### Optimization

For high-throughput scenarios:
- Use longer time windows (reduces DB queries)
- Enable database query caching
- Use custom webhooks with Redis for distributed rate limiting

## Next Steps

- [Configure Spending Limits](/policies/spending-limits)
- [Set Up Time Windows](/policies/time-windows)
- [View Policy Examples](/guides/policy-examples)
