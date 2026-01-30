# Policy Overview

Policies are the rules that control what your AI agents can and cannot do. Bastion evaluates every action against all enabled policies before allowing it to proceed.

## Policy Types

Bastion supports 8 policy types:

| Type | Purpose | Use Case |
|------|---------|----------|
| **Spending Limits** | Cap transaction amounts | Prevent excessive costs |
| **Rate Limiting** | Limit requests per time | Prevent API abuse |
| **File Protection** | Block file operations | Protect critical files |
| **Data Loss Prevention** | Detect and block sensitive data | Prevent data leaks |
| **Time Windows** | Restrict by time/day | Business hours only |
| **Pattern Matching** | Block dangerous patterns | SQL injection, XSS |
| **Allow/Block Lists** | Domain/URL control | Explicit permissions |
| **Custom Webhooks** | Your own logic | Complex custom rules |

## How Policies Work

### Evaluation Flow

```
Action Occurs
    ↓
Load All Enabled Policies
    ↓
Evaluate Each Policy in Parallel
    ↓
ANY policy blocks? → BLOCK action
ALL policies allow? → ALLOW action
    ↓
Log Decision to Audit Trail
    ↓
Return Result to Agent
```

### Example

Agent tries to POST to `https://api.example.com/charge`:

```javascript
// Policy 1: Rate Limiting
if (requestsInLast1Min >= 100) {
  return { allowed: false, reason: "Rate limit exceeded" }
}
// ✅ PASS (only 45 requests)

// Policy 2: Spending Limit
if (transactionAmount > 10000) {
  return { allowed: false, reason: "Exceeds spending limit" }
}
// ✅ PASS (amount is $500)

// Policy 3: Allow List
if (!allowedDomains.includes("api.example.com")) {
  return { allowed: false, reason: "Domain not in allow list" }
}
// ✅ PASS (domain is allowed)

// All policies passed
return { allowed: true }
```

**Result:** Action ALLOWED ✅

## Policy Configuration

### In Dashboard

1. Navigate to http://localhost:3001/policies
2. Click "Create Policy"
3. Select policy type
4. Configure parameters
5. Enable/disable
6. Save

### Example: Rate Limiting Policy

```json
{
  "name": "API Rate Limit",
  "type": "RATE_LIMITING",
  "enabled": true,
  "config": {
    "max_requests": 100,
    "time_window": 60,
    "time_unit": "seconds"
  }
}
```

### Example: Spending Limit Policy

```json
{
  "name": "Max Transaction Size",
  "type": "SPENDING_LIMIT",
  "enabled": true,
  "config": {
    "max_amount": 10000,
    "currency": "USD",
    "time_window": 86400,
    "time_unit": "seconds"
  }
}
```

## Policy Evaluation Details

### Parallel Evaluation

All policies are evaluated concurrently for performance:

```javascript
const results = await Promise.all([
  evaluateRateLimit(action),
  evaluateSpendingLimit(action),
  evaluateAllowList(action),
  evaluateDLP(action),
])

// Block if ANY policy blocks
const allowed = results.every(r => r.allowed)
```

**Performance:** 5-10ms for typical policy set

### Short-Circuit Evaluation

For performance, evaluation stops early if:
- A policy blocks (no need to check others)
- Backend times out (fail-open after 2s)
- Critical error occurs

### Caching

Policy rules are cached in memory:
- **Cache duration:** 60 seconds
- **Update trigger:** Dashboard changes
- **Invalidation:** Automatic on save

## Policy Priority

Policies don't have explicit priorities. Instead:
- **All enabled policies must pass** for an action to be allowed
- **Any policy can block** an action
- **Order doesn't matter** (parallel evaluation)

Think of policies as **AND conditions**:
```
Action is ALLOWED if:
  Rate Limit passes AND
  Spending Limit passes AND
  Allow List passes AND
  DLP passes AND
  Time Window passes
```

## Policy Scope

### Global Policies

Apply to all agents:
```json
{
  "scope": "global",
  "agent_ids": null
}
```

### Agent-Specific Policies

Apply to specific agents only:
```json
{
  "scope": "agent",
  "agent_ids": ["550e8400-..."]
}
```

### Action-Specific Policies

Apply only to certain action types:
```json
{
  "action_types": ["http_request", "file_operation"]
}
```

## Testing Policies

Before deploying, test your policies:

### Dry-Run Mode

```bash
bastion test \
  --action-type http_request \
  --url https://api.example.com \
  --method POST
```

Output:
```
✅ Action would be ALLOWED
or
🛑 Action would be BLOCKED
  Reason: Rate limit exceeded
```

### Dashboard Test Mode

1. Go to Policies page
2. Click "Test" on any policy
3. Enter test data
4. See result

## Common Patterns

### Layered Security

Combine multiple policy types:

```
1. Allow List (only trusted domains)
2. Rate Limiting (prevent abuse)
3. DLP (prevent data leaks)
4. Time Windows (business hours only)
```

### Progressive Restrictions

Start permissive, then tighten:

```
Week 1: Monitor only (log but don't block)
Week 2: Block obvious violations
Week 3: Tighten limits based on data
Week 4: Full enforcement
```

### Emergency Override

Disable all policies temporarily:

```bash
# Via dashboard: "Disable All" button
# Or via API:
curl -X POST http://localhost:3000/v1/policies/disable-all \
  -H "X-API-Key: bst_..."
```

## Best Practices

### 1. Start Conservative

Begin with loose limits:
```
Rate Limit: 1000/min (not 10/min)
Spending: $10k/day (not $100/day)
```

Monitor for a week, then tighten.

### 2. Use Allow Lists

More secure than block lists:
```json
{
  "type": "ALLOW_LIST",
  "domains": [
    "api.stripe.com",
    "api.openai.com",
    "api.trusted.com"
  ]
}
```

### 3. Layer Policies

Multiple complementary policies:
- Rate limit (100/min)
- Spending limit ($1k/hour)
- Allow list (trusted domains only)
- DLP (block credit cards)

### 4. Test Before Deploy

Always test new policies:
```bash
bastion test --action-type http_request --url ...
```

### 5. Monitor Audit Logs

Check regularly for:
- Unusual block patterns
- False positives
- Policy effectiveness

```bash
bastion audit --blocked-only
bastion stats --range week
```

## Policy Lifecycle

### 1. Create
Define policy in dashboard

### 2. Test
Verify behavior with test mode

### 3. Deploy
Enable policy for agents

### 4. Monitor
Watch audit logs and stats

### 5. Adjust
Tune parameters based on data

### 6. Archive
Disable obsolete policies

## Next Steps

- [Spending Limits](/policies/spending-limits) - Cap transaction amounts
- [Rate Limiting](/policies/rate-limiting) - Limit request rates
- [File Protection](/policies/file-protection) - Protect critical files
- [Data Loss Prevention](/policies/dlp) - Block sensitive data
- [Time Windows](/policies/time-windows) - Time-based restrictions
- [Allow/Block Lists](/policies/allow-block-lists) - Domain control
- [Custom Webhooks](/policies/webhooks) - Custom logic
- [Policy Examples](/guides/policy-examples) - Real-world examples
