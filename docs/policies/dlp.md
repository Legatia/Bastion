# Data Loss Prevention (DLP)

Detect and block sensitive data in agent communications to prevent data leaks, credential exposure, and compliance violations.

## Overview

The Data Loss Prevention policy scans all agent actions for sensitive data patterns including API keys, credentials, personal identifiable information (PII), and confidential data. When detected, actions are automatically blocked to prevent data exfiltration.

## Use Cases

- **Credential Protection**: Prevent accidental exposure of API keys, passwords, and tokens
- **PII Compliance**: Block transmission of credit cards, SSNs, phone numbers (GDPR, CCPA, HIPAA)
- **IP Protection**: Prevent leakage of private keys, database URLs, and connection strings
- **Security Hardening**: Stop agents from sending sensitive data to unauthorized endpoints

## How It Works

### Scanning Process

1. Agent attempts an action (HTTP request, file write, etc.)
2. Bastion extracts content from:
   - Request URL
   - HTTP headers
   - Request body (JSON, form data, plain text)
3. Content is scanned against 30+ sensitive data patterns
4. If HIGH or CRITICAL severity data is found → **BLOCKED**
5. If MEDIUM or LOW severity data is found → **LOGGED** (optional block)

### Severity Levels

| Severity | Action | Examples |
|----------|--------|----------|
| **CRITICAL** | Always BLOCK | API keys, passwords, private keys, credit cards |
| **HIGH** | Block by default | Bearer tokens, database URLs, AWS keys |
| **MEDIUM** | Warn (optional block) | Phone numbers, routing numbers |
| **LOW** | Log only | Email addresses, IP addresses |

## Detection Patterns

Bastion includes 30+ built-in patterns for sensitive data detection:

### API Keys & Tokens (CRITICAL)

| Pattern | Example | Regex |
|---------|---------|-------|
| **OpenAI API Key** | `sk-proj-...` | `sk-[a-zA-Z0-9]{48}` |
| **Anthropic API Key** | `sk-ant-api03-...` | `sk-ant-api03-[a-zA-Z0-9_-]{95}` |
| **AWS Access Key** | `AKIAIOSFODNN7EXAMPLE` | `(A3T[A-Z0-9]|AKIA|AGPA|AIDA)[A-Z0-9]{16}` |
| **AWS Secret Key** | `aws_secret_access_key=...` | `aws_secret_access_key[\s:=]+["']?([a-zA-Z0-9/+=]{40})` |
| **GitHub Token** | `ghp_...`, `gho_...` | `gh[pousr]_[A-Za-z0-9_]{36,}` |
| **Slack Token** | `xoxb-...` | `xox[baprs]-[0-9]{10,13}-...` |
| **Stripe API Key** | `sk_live_...`, `pk_test_...` | `(sk|pk)_(test|live)_[a-zA-Z0-9]{24,}` |
| **JWT Token** | `eyJ...` | `eyJ[a-zA-Z0-9_-]{10,}\...\.` |
| **Bearer Token** | `Bearer abc123...` | `[Bb]earer\s+[a-zA-Z0-9_\-\.=]{20,}` |
| **Generic API Key** | `api_key=abc123...` | `[aA][pP][iI]_?[kK][eE][yY][\s:=]+["']?([a-zA-Z0-9_-]{32,})` |
| **Google API Key** | `AIza...` | `AIza[0-9A-Za-z_-]{35}` |
| **Google OAuth** | `ya29....` | `ya29\.[0-9A-Za-z_-]+` |
| **Azure Key** | `(40-char base64)` | `[a-zA-Z0-9+/]{40}==` |
| **Heroku API Key** | `UUID format` | `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-...` |

### Credentials (CRITICAL/HIGH)

| Pattern | Example | Severity |
|---------|---------|----------|
| **Password** | `password="secret123"` | HIGH |
| **Database URL** | `postgres://user:pass@host/db` | CRITICAL |
| **Connection String** | `Server=...;User Id=...;Password=...` | CRITICAL |
| **URL with Credentials** | `https://user:pass@example.com` | HIGH |

### Personal Identifiable Information (CRITICAL/MEDIUM)

| Pattern | Example | Severity |
|---------|---------|----------|
| **Credit Card Number** | `4532-1234-5678-9010` | CRITICAL |
| **Social Security Number** | `123-45-6789` | CRITICAL |
| **Phone Number** | `+1-555-123-4567` | MEDIUM |
| **Email Address** | `user@example.com` | LOW |
| **IP Address** | `192.168.1.1` | LOW |
| **MAC Address** | `00:1B:63:84:45:E6` | LOW |

### Cryptographic Keys (CRITICAL)

| Pattern | Example | Severity |
|---------|---------|----------|
| **RSA Private Key** | `-----BEGIN RSA PRIVATE KEY-----` | CRITICAL |
| **SSH Private Key** | `-----BEGIN OPENSSH PRIVATE KEY-----` | CRITICAL |
| **PGP Private Key** | `-----BEGIN PGP PRIVATE KEY BLOCK-----` | CRITICAL |

### Financial Information (HIGH/MEDIUM)

| Pattern | Example | Severity |
|---------|---------|----------|
| **IBAN** | `GB82 WEST 1234 5698 7654 32` | HIGH |
| **Bank Routing Number** | `123456789` (9 digits) | MEDIUM |

### Healthcare (HIGH)

| Pattern | Example | Severity |
|---------|---------|----------|
| **Medical Record Number** | `MRN: ABC123456` | HIGH |

## Configuration

### Basic Configuration

```json
{
  "name": "API Key Protection",
  "type": "DLP",
  "enabled": true,
  "config": {
    "severity": "HIGH",
    "enabled_patterns": [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "AWS_ACCESS_KEY",
      "GITHUB_TOKEN"
    ]
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `severity` | string | No | Minimum severity to block: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Default: `HIGH` |
| `enabled_patterns` | array | No | Specific patterns to check. If omitted, all patterns are checked |
| `block_on_match` | boolean | No | Whether to block when matches are found. Default: `true` |

## Examples

### Example 1: Comprehensive DLP

Block all HIGH and CRITICAL sensitive data:

```json
{
  "name": "Full DLP Protection",
  "type": "DLP",
  "enabled": true,
  "config": {
    "severity": "HIGH"
  }
}
```

This blocks:
- ✅ API keys (OpenAI, AWS, Stripe, etc.)
- ✅ Passwords and credentials
- ✅ Credit cards and SSNs
- ✅ Private cryptographic keys
- ✅ Database connection strings
- ❌ Does NOT block: Email addresses, IP addresses (LOW severity)

### Example 2: API Key Protection Only

Block only API keys and tokens:

```json
{
  "name": "API Key Protection",
  "type": "DLP",
  "enabled": true,
  "config": {
    "enabled_patterns": [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "AWS_ACCESS_KEY",
      "AWS_SECRET_KEY",
      "GITHUB_TOKEN",
      "STRIPE_KEY",
      "BEARER_TOKEN"
    ]
  }
}
```

### Example 3: PII Protection (GDPR/CCPA Compliance)

Block personal identifiable information:

```json
{
  "name": "PII Protection",
  "type": "DLP",
  "enabled": true,
  "config": {
    "enabled_patterns": [
      "CREDIT_CARD",
      "SSN",
      "PHONE_NUMBER",
      "EMAIL_ADDRESS",
      "IBAN"
    ]
  }
}
```

### Example 4: Monitor-Only Mode

Log sensitive data without blocking (useful for initial deployment):

```json
{
  "name": "DLP Monitoring",
  "type": "DLP",
  "enabled": true,
  "config": {
    "severity": "CRITICAL",
    "block_on_match": false
  }
}
```

This will:
- ✅ Detect and log all sensitive data
- ✅ Create audit trail entries
- ❌ NOT block actions
- Use this to understand what would be blocked before full enforcement

### Example 5: Financial Services Compliance

Block financial and personal data for fintech applications:

```json
{
  "name": "Financial Compliance",
  "type": "DLP",
  "enabled": true,
  "config": {
    "enabled_patterns": [
      "CREDIT_CARD",
      "SSN",
      "IBAN",
      "ROUTING_NUMBER",
      "BANK_ACCOUNT"
    ]
  }
}
```

## Dashboard Configuration

### Creating via Dashboard

1. Navigate to [https://bastion.legatia.solutions/policies](https://bastion.legatia.solutions/policies)
2. Click "Create Policy"
3. Select "Data Loss Prevention"
4. Configure:
   - **Policy Name**: Descriptive name
   - **Severity Level**: Minimum severity to block
   - **Enabled Patterns**: Select specific patterns or leave empty for all
5. Click "Create"

## Monitoring

### Real-Time Detection

Watch DLP detections in real-time:

```bash
bastion logs -f
```

Output:
```
[10:30:15] http_request - {"url": "https://api.example.com/upload"}
   🛑 BLOCKED: DLP detected sensitive data
   Reason: OpenAI API Key detected
   Redacted: sk-pr***...***jX9K
```

### View DLP Blocks

See all actions blocked by DLP:

```bash
bastion audit --blocked-only | grep "DLP"
```

Output:
```
[2025-01-30T10:30:15Z] 🛑 BLOCKED - http_request
  Reason: DLP detected sensitive data: OpenAI API Key
  Pattern: OPENAI_API_KEY
  Redacted: sk-***...***jX9K

[2025-01-30T11:15:22Z] 🛑 BLOCKED - http_request
  Reason: DLP detected sensitive data: Credit Card Number
  Pattern: CREDIT_CARD
  Redacted: 4532-****-****-9010
```

### Statistics

View DLP detection statistics:

```bash
bastion stats --range week
```

Output:
```
📊 DLP Statistics (this week)

Total Scans: 15,432
Sensitive Data Detected: 47 (0.3%)
Blocked: 47 (100%)

Top Detected Patterns:
  OpenAI API Key: 23
  AWS Access Key: 12
  Credit Card: 8
  JWT Token: 4
```

## Best Practices

### 1. Progressive Rollout

Start with monitoring, then enforce:

**Week 1-2**: Monitor only
```json
{
  "config": {
    "block_on_match": false,
    "severity": "CRITICAL"
  }
}
```

**Week 3+**: Full enforcement
```json
{
  "config": {
    "block_on_match": true,
    "severity": "HIGH"
  }
}
```

### 2. Environment-Specific Policies

Use different DLP policies for dev vs prod:

**Development**: Lenient (allow test data)
```json
{
  "name": "Dev DLP",
  "agent_ids": ["dev-agent-id"],
  "config": { "severity": "CRITICAL" }
}
```

**Production**: Strict (block everything)
```json
{
  "name": "Prod DLP",
  "agent_ids": ["prod-agent-id"],
  "config": { "severity": "HIGH" }
}
```

### 3. Layer with Other Policies

Combine DLP with allowlists for defense in depth:

```json
[
  {
    "name": "DLP Protection",
    "type": "DLP",
    "config": { "severity": "HIGH" }
  },
  {
    "name": "Trusted Domains Only",
    "type": "ALLOWLIST",
    "config": {
      "domains": ["api.trusted.com", "internal.company.com"]
    }
  }
]
```

### 4. Regular Pattern Updates

Review and update patterns quarterly:
- New API key formats
- Emerging threat patterns
- Company-specific sensitive data

### 5. Redaction in Logs

Bastion automatically redacts sensitive data in logs:
- `sk-proj-abc123...xyz789` → `sk-pr***...***z789`
- `4532-1234-5678-9010` → `4532-****-****-9010`

Verify redaction is working:
```bash
bastion audit --verbose | grep "Redacted"
```

## Advanced Configuration

### Custom Patterns via Webhooks

For organization-specific sensitive data, use custom webhooks:

```json
{
  "name": "Custom DLP",
  "type": "CUSTOM_WEBHOOK",
  "config": {
    "webhook_url": "https://your-dlp-server.com/scan",
    "method": "POST"
  }
}
```

Your webhook receives:
```json
{
  "action": {
    "type": "http_request",
    "details": {
      "url": "https://api.example.com",
      "body": "content to scan"
    }
  }
}
```

Return:
```json
{
  "allowed": false,
  "reason": "Internal project code detected: PROJ-123"
}
```

### Combining Multiple DLP Policies

Layer specific policies for granular control:

```json
[
  {
    "name": "Critical DLP (Block)",
    "type": "DLP",
    "config": {
      "severity": "CRITICAL",
      "block_on_match": true
    }
  },
  {
    "name": "High DLP (Log Only)",
    "type": "DLP",
    "config": {
      "severity": "HIGH",
      "block_on_match": false
    }
  }
]
```

## Performance Considerations

### Scanning Overhead

DLP scanning adds latency:
- **Small requests** (<10KB): ~5-10ms
- **Medium requests** (10-100KB): ~10-50ms
- **Large requests** (100KB-1MB): ~50-500ms

### Optimization

**Content Size Limit**: Bastion limits scans to 1MB
- Larger content is automatically blocked
- Configure custom limits via webhooks

**Timeout Protection**: Scans timeout after 5 seconds
- Prevents ReDoS (Regular Expression Denial of Service)
- Complex patterns are skipped if timeout is reached

**Pattern Selection**: Only enable patterns you need
```json
{
  "enabled_patterns": ["OPENAI_API_KEY", "AWS_ACCESS_KEY"]
}
```
This scans only 2 patterns instead of 30+, reducing overhead by ~90%.

## Troubleshooting

### False Positives

**Problem**: Legitimate data is being flagged as sensitive

**Solutions**:
1. Review pattern matches:
   ```bash
   bastion audit --verbose | grep "Pattern:"
   ```
2. Adjust severity level
3. Disable specific patterns causing false positives
4. Use allowlists for trusted destinations

### Pattern Not Detecting

**Problem**: Expected sensitive data is not being blocked

**Solutions**:
1. Verify pattern is enabled:
   ```bash
   bastion audit --verbose | grep "enabled_patterns"
   ```
2. Check severity level (LOW patterns may not be blocked)
3. Test pattern manually with test data
4. Check if content is encrypted/encoded

### Performance Issues

**Problem**: Requests are slow due to DLP scanning

**Solutions**:
1. Reduce number of patterns checked
2. Increase severity threshold (block only CRITICAL)
3. Disable DLP for high-throughput endpoints
4. Use custom webhooks with optimized scanning

## Limitations

### What DLP Can't Do

- **Encrypted Content**: Can't scan encrypted payloads (HTTPS bodies are visible, but encrypted at-rest data is not)
- **Binary Data**: Only scans text content, not binary files
- **Obfuscated Data**: Can't detect base64-encoded or otherwise obfuscated secrets
- **Context-Aware Detection**: Doesn't understand semantic meaning of data

### Workarounds

**Binary Scanning**: Use custom webhooks with specialized tools

**Obfuscation Detection**: Add patterns for common encodings:
```regex
base64_pattern: [A-Za-z0-9+/]{40,}={0,2}
```

**Semantic Analysis**: Use AI-powered DLP via custom webhooks

## Compliance

### GDPR (EU)

DLP helps with GDPR Article 32 (Security of Processing):
- ✅ Prevents unauthorized transmission of personal data
- ✅ Detects credit cards, phone numbers, emails
- ✅ Audit trail for data access

### CCPA (California)

Supports CCPA compliance by:
- ✅ Blocking transmission of consumer personal information
- ✅ Logging all PII-related actions
- ✅ Enabling data minimization

### HIPAA (Healthcare)

Protects Protected Health Information (PHI):
- ✅ Blocks medical record numbers
- ✅ Prevents PHI transmission to unauthorized endpoints
- ✅ Creates audit logs required by HIPAA

### PCI DSS (Payment Cards)

Supports PCI DSS Requirement 3 (Protect Stored Cardholder Data):
- ✅ Blocks credit card numbers in transit
- ✅ Redacts card numbers in logs
- ✅ Monitors for data leakage

## Related Policies

Combine DLP with other policies for comprehensive protection:

- **[Allowlist](/policies/allow-block-lists)**: Only allow trusted destinations
- **[Pattern Matching](/policies/pattern-matching)**: Block dangerous SQL/XSS patterns
- **[Custom Webhooks](/policies/webhooks)**: Advanced custom DLP logic
- **[File Protection](/policies/file-protection)**: Prevent reading sensitive files

## Next Steps

- [Configure Allowlists](/policies/allow-block-lists)
- [Set Up Pattern Matching](/policies/pattern-matching)
- [View Policy Examples](/guides/policy-examples)
- [GDPR Compliance Guide](/guides/compliance)
