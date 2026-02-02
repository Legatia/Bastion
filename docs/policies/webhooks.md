# Custom Webhooks

Implement custom policy logic by routing authorization decisions to your own external service.

## Overview

Custom Webhook policies allow you to implement complex, dynamic authorization logic that can't be expressed through built-in policies. Your webhook receives action details and returns an allow/block decision.

## Configuration

```json
{
  "name": "Custom Authorization Logic",
  "type": "CUSTOM_WEBHOOK",
  "enabled": true,
  "config": {
    "webhook_url": "https://your-server.com/authorize",
    "method": "POST",
    "timeout": 2000,
    "headers": {
      "Authorization": "Bearer your-secret-token",
      "Content-Type": "application/json"
    }
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `webhook_url` | string | Yes | Your webhook endpoint URL |
| `method` | string | No | HTTP method (default: `POST`) |
| `timeout` | number | No | Request timeout in ms (default: 2000, max: 5000) |
| `headers` | object | No | Custom HTTP headers |

## Request Format

Bastion sends this payload to your webhook:

```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "action": {
    "type": "http_request",
    "details": {
      "method": "POST",
      "url": "https://api.example.com/endpoint",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"data\":\"value\"}"
    }
  },
  "timestamp": "2025-01-30T10:30:15Z"
}
```

## Response Format

Your webhook must return within the timeout period:

### Allow Action

```json
{
  "allowed": true
}
```

### Block Action

```json
{
  "allowed": false,
  "reason": "Account balance insufficient",
  "metadata": {
    "balance": 10.50,
    "required": 25.00
  }
}
```

## Use Cases

### 1. Dynamic Spending Limits

Adjust spending limits based on agent performance:

```javascript
// your-webhook-server/authorize
app.post('/authorize', async (req, res) => {
  const { agent_id, action } = req.body;

  // Get agent's current profitability
  const profit = await getAgentProfit(agent_id);

  // If profitable, allow higher spending
  const maxSpending = profit > 0 ? 10000 : 1000;

  const amount = extractAmount(action);

  if (amount > maxSpending) {
    return res.json({
      allowed: false,
      reason: `Spending limit: $${maxSpending} (current profit: $${profit})`
    });
  }

  res.json({ allowed: true });
});
```

### 2. Multi-Factor Authorization

Require approval for high-risk operations:

```javascript
app.post('/authorize', async (req, res) => {
  const { action } = req.body;

  // Check if high-risk operation
  if (isHighRisk(action)) {
    // Send notification to admin
    await sendApprovalRequest(action);

    return res.json({
      allowed: false,
      reason: "Waiting for admin approval"
    });
  }

  res.json({ allowed: true });
});
```

### 3. External Threat Intelligence

Check URLs against threat intelligence feeds:

```javascript
app.post('/authorize', async (req, res) => {
  const { action } = req.body;

  const url = action.details.url;

  // Query threat intelligence API
  const isMalicious = await checkThreatIntelligence(url);

  if (isMalicious) {
    return res.json({
      allowed: false,
      reason: "URL flagged by threat intelligence"
    });
  }

  res.json({ allowed: true });
});
```

### 4. Business Logic Rules

Implement complex business rules:

```javascript
app.post('/authorize', async (req, res) => {
  const { agent_id, action } = req.body;

  // Check multiple conditions
  const agentConfig = await getAgentConfig(agent_id);
  const marketStatus = await getMarketStatus();
  const riskLevel = calculateRisk(action);

  // Complex decision logic
  if (
    agentConfig.tradingEnabled &&
    marketStatus === 'OPEN' &&
    riskLevel < agentConfig.maxRisk &&
    isWithinTradingHours()
  ) {
    return res.json({ allowed: true });
  }

  res.json({
    allowed: false,
    reason: "Trading conditions not met"
  });
});
```

## Best Practices

### 1. Fast Response Times

Webhooks must respond within timeout (default: 2s):

```javascript
// Use caching for frequently accessed data
const cache = new NodeCache({ stdTTL: 60 });

app.post('/authorize', async (req, res) => {
  const cachedResult = cache.get(req.body.agent_id);
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // Expensive operation
  const result = await complexCheck(req.body);
  cache.set(req.body.agent_id, result);

  res.json(result);
});
```

### 2. Secure Your Webhook

Verify requests come from Bastion:

```javascript
app.post('/authorize', async (req, res) => {
  const signature = req.headers['x-bastion-signature'];

  // Verify HMAC signature
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process request
  // ...
});
```

### 3. Handle Errors Gracefully

```javascript
app.post('/authorize', async (req, res) => {
  try {
    const result = await authorizeAction(req.body);
    res.json(result);
  } catch (error) {
    console.error('Authorization error:', error);

    // Fail open or closed?
    res.json({
      allowed: true,  // or false
      reason: 'Authorization service error'
    });
  }
});
```

### 4. Log All Decisions

```javascript
app.post('/authorize', async (req, res) => {
  const decision = await makeDecision(req.body);

  // Log for audit
  await logDecision({
    agent_id: req.body.agent_id,
    action: req.body.action,
    decision: decision,
    timestamp: new Date()
  });

  res.json(decision);
});
```

## Monitoring

```bash
bastion audit | grep "CUSTOM_WEBHOOK"
```

## Limitations

- **Latency**: Adds webhook roundtrip time (typically 50-500ms)
- **Availability**: If webhook is down, policy fails open by default
- **Security**: Webhook must be secured properly to prevent abuse

## Examples Repository

See full webhook examples:
- [Node.js Express Example](https://github.com/bastion/examples/webhook-nodejs)
- [Python Flask Example](https://github.com/bastion/examples/webhook-python)
- [Go Example](https://github.com/bastion/examples/webhook-go)

## Related Policies

- **[All Other Policies](/policies/overview)**: Use webhooks to extend any policy type

## Next Steps

- [View Policy Examples](/guides/policy-examples)
- [Deploy Webhook Server](/guides/production)
