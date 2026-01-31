# Bastion + OpenClaw Integration Guide

## 🚀 Quick Start

### One-Command Setup

```bash
# Auto-configure OpenClaw to use Bastion
bastion enable --agent openclaw
```

This command will:
1. ✅ Backup your existing `~/.openclaw/openclaw.json`
2. ✅ Add proxy configuration to OpenClaw's gateway
3. ✅ Start Bastion proxy in the background
4. ✅ You're ready to go!

### Run OpenClaw Normally

```bash
# Just run OpenClaw as usual
openclaw

# All API calls are now automatically monitored by Bastion! 🛡️
```

---

## 📋 What Gets Configured

The `bastion enable` command modifies `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "trustedProxies": ["127.0.0.1"],
    "httpProxy": "http://localhost:3000",
    "httpsProxy": "http://localhost:3000"
  },
  "bastion": {
    "enabled": true,
    "port": 3000,
    "configured_at": "2026-01-31T19:00:00Z"
  }
}
```

---

## 🎛️ Advanced Options

### Configure Only (Don't Start Daemon)

```bash
bastion enable --agent openclaw --configure-only
```

This updates the config file but doesn't start the proxy. Useful if you want to start it manually later.

### Custom Port

```bash
bastion enable --agent openclaw --port 8080
```

Uses port 8080 instead of the default 3000.

---

## 🛑 Disabling Bastion

```bash
# Remove Bastion configuration from OpenClaw
bastion disable --agent openclaw

# Stop the daemon
bastion stop
```

Your original config is backed up at `~/.openclaw/openclaw.json.backup`.

---

## 🔍 Verifying It Works

```bash
# Check if Bastion daemon is running
bastion status

# View intercepted requests in real-time
bastion logs -f

# Check recent audit trail
bastion audit --limit 20
```

---

## 🎯 What Gets Protected

Once enabled, Bastion intercepts and can block:

- **API Calls** to OpenAI, Anthropic, Google, etc.
- **HTTP Requests** made by OpenClaw's tools
- **File Operations** (if configured with file protection policies)
- **Spending** (enforce daily/monthly limits)
- **Data Leakage** (DLP scans for PII, API keys, secrets)

---

## 📊 Example Policy Setup

```bash
# After enabling, create policies via the dashboard:
# http://localhost:3001/policies

# Or use the CLI test feature:
bastion test --action-type http_request --url https://api.openai.com
```

---

## 🔧 Troubleshooting

### OpenClaw Config Not Found

```bash
❌ OpenClaw config not found at: ~/.openclaw/openclaw.json

# Solution: Run OpenClaw first to initialize it
openclaw
```

### Daemon Won't Start

```bash
# Check if port is already in use
lsof -i :3000

# Try a different port
bastion enable --agent openclaw --port 8080
```

### Restore Original Config

```bash
# Your original config is backed up automatically
cp ~/.openclaw/openclaw.json.backup ~/.openclaw/openclaw.json
```

---

## 🌐 Supported Agents

### ✅ Fully Supported
- **OpenClaw** - Auto-configuration ready

### 🚧 Coming Soon
- **AutoGPT** - Manual setup via environment variables
- **LangChain** - SDK package `bastion-langchain`
- **CrewAI** - Integration in development

---

## 💡 How It Works

1. **Proxy Interception**: Bastion runs a local HTTP/HTTPS proxy
2. **Config Injection**: OpenClaw's gateway is configured to route through this proxy
3. **Policy Evaluation**: Each request is sent to Bastion backend for authorization
4. **Allow/Block**: If allowed, request proceeds; if blocked, it's rejected with 403

This is **transparent to OpenClaw** - no code changes needed!

---

## 🔒 Security Notes

- Bastion proxy runs **locally on your machine** (`127.0.0.1`)
- Original config is **automatically backed up**
- All decisions are logged in an **encrypted audit trail**
- You can disable Bastion anytime with `bastion disable`

---

## 📚 Next Steps

1. ✅ Configure policies in the dashboard
2. ✅ Set up spending limits
3. ✅ Enable DLP scanning
4. ✅ Monitor your agents with peace of mind!

**Questions?** Check the main README or run `bastion --help`.
