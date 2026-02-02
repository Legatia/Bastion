# Allow and Block Lists

Control which domains, URLs, and endpoints your AI agents can access using explicit allowlists (whitelists) and blocklists (blacklists).

## Overview

Allowlists and Blocklists provide explicit control over agent network access. Allowlists permit only specified domains (deny by default), while Blocklists deny specific domains (allow by default). These policies are essential for preventing agents from accessing malicious or unauthorized endpoints.

## Policy Types

### Allowlist (Whitelist)

**Security Model**: Deny by default, allow only specified domains

**Use When**:
- You know exactly which APIs your agent needs
- Maximum security is required
- Operating in regulated industries

**Example**: Only allow OpenAI and Stripe APIs
```json
{
  "name": "Trusted APIs Only",
  "type": "ALLOWLIST",
  "enabled": true,
  "config": {
    "domains": [
      "api.openai.com",
      "api.stripe.com",
      "api.internal-company.com"
    ]
  }
}
```

### Blocklist (Blacklist)

**Security Model**: Allow by default, deny only specified domains

**Use When**:
- You want flexibility but need to block known bad actors
- Your agent needs broad internet access
- You're responding to specific threats

**Example**: Block known malicious domains
```json
{
  "name": "Block Malicious Domains",
  "type": "BLOCKLIST",
  "enabled": true,
  "config": {
    "domains": [
      "malicious-domain.com",
      "phishing-site.net",
      "data-exfiltration-server.com"
    ]
  }
}
```

## Configuration

### Allowlist Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domains` | array | Yes | List of allowed domains |
| `url_patterns` | array | No | Regex patterns for URL matching |
| `exact_match` | boolean | No | Require exact domain match (default: false) |

```json
{
  "name": "API Allowlist",
  "type": "ALLOWLIST",
  "enabled": true,
  "config": {
    "domains": [
      "api.openai.com",
      "api.anthropic.com",
      "api.stripe.com"
    ],
    "url_patterns": [
      "^https://api\\.internal\\.company\\.com/.*"
    ],
    "exact_match": true
  }
}
```

### Blocklist Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domains` | array | Yes | List of blocked domains |
| `url_patterns` | array | No | Regex patterns for URL matching |
| `reason` | string | No | Custom block reason message |

```json
{
  "name": "Malicious Domain Blocklist",
  "type": "BLOCKLIST",
  "enabled": true,
  "config": {
    "domains": [
      "malware-domain.com",
      "phishing-site.net"
    ],
    "reason": "Domain flagged as malicious by security team"
  }
}
```

## Examples

### Example 1: Strict Allowlist (Recommended)

Only allow essential APIs:

```json
{
  "name": "Essential APIs",
  "type": "ALLOWLIST",
  "enabled": true,
  "config": {
    "domains": [
      "api.openai.com",
      "api.anthropic.com",
      "api.stripe.com",
      "api.weatherapi.com",
      "internal-api.company.com"
    ]
  }
}
```

**Result**:
- ✅ Requests to `api.openai.com` → ALLOWED
- ✅ Requests to `api.stripe.com` → ALLOWED
- ❌ Requests to `unknown-api.com` → BLOCKED
- ❌ Requests to `malicious-domain.com` → BLOCKED

### Example 2: Development Allowlist

Allow common development services:

```json
{
  "name": "Dev Services",
  "type": "ALLOWLIST",
  "enabled": true,
  "agent_ids": ["dev-agent-id"],
  "config": {
    "domains": [
      "api.openai.com",
      "localhost",
      "127.0.0.1",
      "webhook.site",
      "httpbin.org"
    ]
  }
}
```

### Example 3: Block Known Threats

Deny access to known malicious domains:

```json
{
  "name": "Security Blocklist",
  "type": "BLOCKLIST",
  "enabled": true,
  "config": {
    "domains": [
      "malware-c2.com",
      "phishing-attack.net",
      "data-leak-server.com"
    ],
    "reason": "Domain flagged by security intelligence"
  }
}
```

### Example 4: Wildcard Patterns

Use regex patterns for flexible matching:

```json
{
  "name": "Internal APIs Only",
  "type": "ALLOWLIST",
  "enabled": true,
  "config": {
    "url_patterns": [
      "^https://.*\\.company\\.com/.*",
      "^https://api\\.openai\\.com/.*"
    ]
  }
}
```

This allows:
- ✅ `https://api.company.com/v1/data`
- ✅ `https://internal.company.com/service`
- ✅ `https://api.openai.com/v1/chat`
- ❌ `https://external-api.com/data`

## Best Practices

### 1. Prefer Allowlists Over Blocklists

**Allowlist** (Recommended):
- ✅ Secure by default
- ✅ Explicit about what's permitted
- ✅ Scales with security posture
- ❌ Requires upfront knowledge of needed domains

**Blocklist**:
- ✅ Flexible for exploratory agents
- ✅ Easy to add threats as discovered
- ❌ Reactive security model
- ❌ Doesn't protect against unknown threats

### 2. Start with Allowlist in Production

```json
{
  "name": "Production Allowlist",
  "type": "ALLOWLIST",
  "agent_ids": ["prod-agent-id"],
  "config": {
    "domains": ["known", "trusted", "apis"]
  }
}
```

### 3. Use Blocklist for Development

```json
{
  "name": "Dev Blocklist",
  "type": "BLOCKLIST",
  "agent_ids": ["dev-agent-id"],
  "config": {
    "domains": ["obvious", "malicious", "sites"]
  }
}
```

### 4. Combine Both for Defense in Depth

```json
[
  {
    "name": "Trusted APIs",
    "type": "ALLOWLIST",
    "config": { "domains": [...] }
  },
  {
    "name": "Known Threats",
    "type": "BLOCKLIST",
    "config": { "domains": [...] }
  }
]
```

### 5. Regular Updates

- Add new trusted APIs to allowlist
- Remove deprecated APIs
- Update blocklist from threat intelligence feeds
- Review audit logs monthly

## Monitoring

### View Blocked Requests

```bash
bastion audit --blocked-only | grep "not in allow list\|in block list"
```

Output:
```
[2025-01-30T10:30:15Z] 🛑 BLOCKED - http_request
  URL: https://unknown-api.com/data
  Reason: Domain not in allow list

[2025-01-30T11:15:22Z] 🛑 BLOCKED - http_request
  URL: https://malicious-domain.com/exfiltrate
  Reason: Domain in block list
```

### Statistics

```bash
bastion stats --range week
```

Output:
```
📊 Allow/Block List Statistics (this week)

Allowlist:
  Total Checks: 15,432
  Allowed: 15,210 (98.6%)
  Blocked: 222 (1.4%)

Blocklist:
  Total Checks: 15,432
  Blocked: 12 (0.08%)

Top Blocked Domains:
  unknown-external-api.com: 87
  test-malicious-site.net: 45
  random-endpoint.com: 35
```

## Troubleshooting

### Legitimate Requests Blocked

**Problem**: Agent can't access a needed API

**Solution**:
1. Check audit logs for blocked domain:
   ```bash
   bastion audit --blocked-only
   ```
2. Add to allowlist:
   ```json
   {
     "domains": ["api.openai.com", "new-needed-api.com"]
   }
   ```
3. Test:
   ```bash
   bastion test --action-type http_request --url https://new-needed-api.com
   ```

### Blocklist Not Working

**Problem**: Agent can still access blocked domains

**Solutions**:
1. Verify policy is enabled
2. Check agent_ids are correct
3. Ensure exact domain match (including subdomains)
4. Review policy priority

## Related Policies

- **[DLP](/policies/dlp)**: Scan content for sensitive data
- **[Rate Limiting](/policies/rate-limiting)**: Limit request frequency
- **[Pattern Matching](/policies/pattern-matching)**: Block dangerous patterns
- **[Custom Webhooks](/policies/webhooks)**: Dynamic allowlist/blocklist logic

## Next Steps

- [Configure DLP](/policies/dlp)
- [Set Up Rate Limiting](/policies/rate-limiting)
- [View Policy Examples](/guides/policy-examples)
