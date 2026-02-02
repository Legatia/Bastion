# File Protection

Prevent AI agents from reading, writing, or deleting critical files and directories.

## Overview

File Protection policies block file system operations on specified paths, protecting configuration files, sensitive data, system files, and critical application code from accidental or malicious modification.

## Configuration

```json
{
  "name": "Protect Critical Files",
  "type": "FILE_PROTECTION",
  "enabled": true,
  "config": {
    "protected_paths": [
      "/etc/passwd",
      "/etc/shadow",
      "~/.ssh/",
      "~/.aws/credentials",
      "/app/config/database.yml",
      "/app/.env"
    ],
    "operations": ["read", "write", "delete"]
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protected_paths` | array | Yes | File/directory paths to protect |
| `operations` | array | Yes | Operations to block: `read`, `write`, `delete` |
| `recursive` | boolean | No | Apply to subdirectories (default: true) |

## Examples

### Protect Configuration Files

```json
{
  "name": "Config File Protection",
  "type": "FILE_PROTECTION",
  "enabled": true,
  "config": {
    "protected_paths": [
      "/app/.env",
      "/app/config/",
      "~/.bastion/"
    ],
    "operations": ["write", "delete"]
  }
}
```

### Protect SSH Keys

```json
{
  "name": "SSH Key Protection",
  "type": "FILE_PROTECTION",
  "enabled": true,
  "config": {
    "protected_paths": [
      "~/.ssh/id_rsa",
      "~/.ssh/id_ed25519"
    ],
    "operations": ["read", "write", "delete"]
  }
}
```

## Related Policies

- **[DLP](/policies/dlp)**: Scan file content for sensitive data
- **[Pattern Matching](/policies/pattern-matching)**: Block dangerous patterns

## Next Steps

- [Configure DLP](/policies/dlp)
- [View Policy Examples](/guides/policy-examples)
