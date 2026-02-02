# Pattern Matching

Block actions containing dangerous patterns like SQL injection, XSS, command injection, and other security threats.

## Overview

Pattern Matching policies use regular expressions to detect and block dangerous patterns in agent requests, preventing common web vulnerabilities and injection attacks.

## Configuration

```json
{
  "name": "SQL Injection Protection",
  "type": "PATTERN_MATCH",
  "enabled": true,
  "config": {
    "patterns": [
      "(?i)(union.*select|select.*from|insert.*into|delete.*from|drop.*table)",
      "(?i)(exec\\s*\\(|system\\s*\\(|eval\\s*\\()",
      "(?i)(<script|javascript:|onerror=)"
    ],
    "severity": "HIGH"
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `patterns` | array | Yes | Regular expression patterns to match |
| `severity` | string | No | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (default: HIGH) |
| `case_sensitive` | boolean | No | Case-sensitive matching (default: false) |

## Examples

### SQL Injection Protection

```json
{
  "name": "SQLi Protection",
  "type": "PATTERN_MATCH",
  "enabled": true,
  "config": {
    "patterns": [
      "(?i)union.*select",
      "(?i)or\\s+1\\s*=\\s*1",
      "(?i)drop\\s+table",
      "(?i)--;\\s*$"
    ]
  }
}
```

### XSS Protection

```json
{
  "name": "XSS Protection",
  "type": "PATTERN_MATCH",
  "enabled": true,
  "config": {
    "patterns": [
      "(?i)<script[^>]*>",
      "(?i)javascript:",
      "(?i)on(load|error|click)\\s*=",
      "(?i)<iframe"
    ]
  }
}
```

### Command Injection Protection

```json
{
  "name": "Command Injection Protection",
  "type": "PATTERN_MATCH",
  "enabled": true,
  "config": {
    "patterns": [
      ";\\s*(rm|cat|ls|wget|curl)",
      "\\|\\s*(nc|ncat|netcat)",
      "&&\\s*(chmod|chown)"
    ]
  }
}
```

## Common Patterns

### OWASP Top 10 Patterns

```regex
# SQL Injection
(?i)(union.*select|select.*from|insert.*into|delete.*from|drop.*table)

# XSS
(?i)(<script|javascript:|onerror=|<iframe)

# Command Injection
(;|\\||&&)\\s*(rm|cat|ls|wget|curl|nc|chmod)

# Path Traversal
\\.\\./|\\.\\.\\\\

# LDAP Injection
[*()\\|&]

# XML Injection
(?i)<!\\[CDATA\\[|<!DOCTYPE|<!ENTITY
```

## Monitoring

```bash
bastion audit --blocked-only | grep "Pattern match"
```

## Related Policies

- **[DLP](/policies/dlp)**: Detect sensitive data patterns
- **[Allowlist](/policies/allow-block-lists)**: Restrict to trusted domains
- **[Custom Webhooks](/policies/webhooks)**: Advanced pattern detection

## Next Steps

- [Configure DLP](/policies/dlp)
- [Set Up Allowlists](/policies/allow-block-lists)
- [View Policy Examples](/guides/policy-examples)
