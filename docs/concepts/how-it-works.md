# How Bastion Works

Understanding Bastion's architecture and request flow.

## Overview

Bastion acts as a **transparent HTTP/HTTPS proxy** between your AI agent and the outside world. Every network request your agent makes flows through Bastion, where it's evaluated against your policies before being allowed or blocked.

## Architecture

```
┌─────────────────┐
│                 │
│   AI Agent      │  Your autonomous system
│   (Python/JS)   │  Runs normally, no code changes
│                 │
└────────┬────────┘
         │
         │ All HTTP/HTTPS traffic
         │ via environment variables:
         │ HTTP_PROXY=http://localhost:3000
         │ HTTPS_PROXY=http://localhost:3000
         │
         ▼
┌─────────────────┐
│                 │
│  Bastion CLI    │  Local proxy server
│  (Rust)         │  Port 3000 (configurable)
│                 │  Intercepts all requests
└────────┬────────┘
         │
         │ For each request:
         │ 1. Extract action details
         │ 2. Call backend API
         │ 3. Get allow/block decision
         │
         ▼
┌─────────────────┐
│                 │
│ Bastion Backend │  Policy engine
│ (Node.js)       │  PostgreSQL database
│                 │  Evaluates all policies
└────────┬────────┘
         │
         │ Decision: ALLOWED or BLOCKED
         │
         ▼
┌─────────────────┐
│                 │
│  If ALLOWED:    │  Forward to destination
│  Real API       │  Return response to agent
│                 │
│  If BLOCKED:    │  Return 403 FORBIDDEN
│                 │  Log the violation
└─────────────────┘
```

## Request Flow

### 1. Agent Makes Request

Your agent makes a normal HTTP request:

```python
import requests

response = requests.get("https://api.example.com/data")
```

### 2. Proxy Intercepts

Because `HTTP_PROXY` is set, the request goes to Bastion first:

```
GET https://api.example.com/data
↓
http://localhost:3000 (Bastion proxy)
```

### 3. Action Extraction

Bastion extracts action details:

```json
{
  "type": "http_request",
  "details": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "host": "api.example.com",
    "headers": {...}
  }
}
```

### 4. Policy Evaluation

Bastion calls the backend API:

```
POST http://localhost:3000/v1/authorize
{
  "api_key": "bst_...",
  "agent_id": "550e8400-...",
  "action": {
    "type": "http_request",
    "details": {...}
  }
}
```

### 5. Backend Checks Policies

The backend evaluates ALL enabled policies:

```javascript
// Rate limiting
if (requestsInLastMinute >= 100) {
  return { allowed: false, reason: "Rate limit exceeded" }
}

// Allow/block lists
if (!allowedDomains.includes("api.example.com")) {
  return { allowed: false, reason: "Domain not allowed" }
}

// Data loss prevention
if (containsPII(request.body)) {
  return { allowed: false, reason: "PII detected" }
}

// All policies passed
return { allowed: true }
```

### 6. Decision Enforcement

**If ALLOWED:**
```
Bastion → Forward request → api.example.com
Bastion ← Return response ← api.example.com
Agent ← Return response ← Bastion

Agent receives normal response, continues working
```

**If BLOCKED:**
```
Bastion → Return 403 FORBIDDEN → Agent

Agent receives error response
```

### 7. Logging

Every action is logged to the audit trail:

```json
{
  "timestamp": "2025-01-30T10:30:15Z",
  "agent_id": "550e8400-...",
  "action_type": "http_request",
  "details": {...},
  "allowed": false,
  "reason": "Rate limit exceeded",
  "policies_evaluated": ["rate-limiting", "allow-list"]
}
```

## HTTPS Tunneling

For HTTPS requests, Bastion uses the HTTP CONNECT method to establish a tunnel:

```
1. Agent sends CONNECT api.example.com:443
2. Bastion evaluates policies on the connection
3. If allowed, Bastion establishes TCP tunnel
4. Agent and server communicate over TLS through the tunnel
5. Bastion monitors traffic metadata (host, timing, size)
```

**Note:** Bastion does NOT decrypt HTTPS traffic. It only sees:
- The destination hostname
- Request timing and size
- Response size

This preserves end-to-end encryption while still enforcing policies.

## Environment Variables

When you run `bastion start -- python agent.py`, Bastion sets:

```bash
HTTP_PROXY=http://localhost:3000
HTTPS_PROXY=http://localhost:3000
BASTION_ENABLED=true
```

Most HTTP libraries respect these automatically:
- ✅ Python `requests`
- ✅ Node.js `axios`, `fetch`, `got`
- ✅ Go `net/http`
- ✅ Java `HttpClient`
- ✅ Rust `reqwest`

## Policy Evaluation

Policies are evaluated in parallel for maximum performance:

```javascript
const policyResults = await Promise.all([
  checkRateLimit(action),
  checkSpendingLimit(action),
  checkAllowList(action),
  checkDLP(action),
  checkTimeWindow(action),
  checkCustomWebhook(action),
])

// If ANY policy blocks, the action is blocked
const allowed = policyResults.every(r => r.allowed)
```

### Evaluation Time

- **Target:** < 10ms per request
- **Timeout:** 2 seconds (fail-open)
- **Caching:** Policy rules cached in memory

## Fail-Open vs Fail-Closed

Bastion uses a **fail-open** design for reliability:

```javascript
try {
  const decision = await backend.authorize(action)
  return decision.allowed
} catch (error) {
  // Backend unreachable or timeout
  console.warn("Policy check failed, allowing by default")
  return true  // Fail open
}
```

**Why fail-open?**
- Prevents false positives from stopping agents
- Backend maintenance doesn't break all agents
- Network issues don't halt operations

**Security consideration:**
- This is a deliberate trade-off
- For critical agents, you can implement fail-closed logic
- Monitor backend health actively

## Performance

### Latency

Request overhead:
- **Policy check:** 5-10ms
- **Proxy overhead:** 1-2ms
- **Total added latency:** ~10ms

For comparison:
- Typical API call: 100-500ms
- Bastion overhead: ~2% of total request time

### Throughput

Single Bastion instance can handle:
- **1,000+ requests/second** (simple policies)
- **500+ requests/second** (complex policies with DLP)

### Resource Usage

Typical daemon:
- **Memory:** 10-50 MB
- **CPU:** < 1% idle, 5-10% under load
- **Disk:** Minimal (logs only)

## Security Model

### Threat Model

Bastion protects against:
- ✅ Agent errors and hallucinations
- ✅ Excessive spending
- ✅ Data leakage
- ✅ Malicious destinations
- ✅ Resource exhaustion

Bastion does NOT protect against:
- ❌ Compromised agent code (Bastion runs in same security context)
- ❌ Local file system access (only HTTP/HTTPS)
- ❌ Non-HTTP protocols (databases, SSH, etc.)

### Trust Boundaries

```
┌───────────────────────────────────────┐
│  Trusted Zone                         │
│  ┌───────────┐    ┌───────────┐      │
│  │  Agent    │───►│  Bastion  │      │
│  │           │    │  CLI      │      │
│  └───────────┘    └───────────┘      │
│                                       │
│  Same process, same user, same host  │
└───────────────────┬───────────────────┘
                    │
                    │ API calls (authenticated)
                    │
┌───────────────────▼───────────────────┐
│  Backend (Policy Engine)              │
│  ┌─────────────────────────────────┐  │
│  │  Policy Evaluation              │  │
│  │  Database                       │  │
│  │  Audit Logs                     │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### Authentication

- API key required for all backend requests
- Keys stored locally in `~/.bastion/config.json` (mode 600)
- Keys should be treated as secrets (rotate regularly)

## Limitations

### Protocol Support

Currently supports:
- ✅ HTTP (GET, POST, PUT, DELETE, PATCH, etc.)
- ✅ HTTPS (via CONNECT tunneling)

Not yet supported:
- ❌ WebSockets (coming soon)
- ❌ gRPC (coming soon)
- ❌ Direct TCP/UDP
- ❌ Database protocols (PostgreSQL, MySQL, Redis)

### Proxy Bypass

Agents can bypass Bastion by:
- Unsetting environment variables
- Using libraries that ignore proxy settings
- Making system calls directly

**Mitigation:**
- Bastion is defense-in-depth, not sandboxing
- Use container isolation for untrusted agents
- Monitor for environment variable changes

### Language Support

Works with any language that respects HTTP_PROXY:
- ✅ Python
- ✅ JavaScript/Node.js
- ✅ Go
- ✅ Java
- ✅ Rust
- ✅ Ruby
- ✅ PHP
- ⚠️ Some libraries need explicit configuration

## Next Steps

- [Architecture Deep Dive](/concepts/architecture) - System design details
- [Security Model](/concepts/security) - Security considerations
- [Policies](/concepts/policies) - How policies work
- [Production Guide](/guides/production) - Deploy to production
