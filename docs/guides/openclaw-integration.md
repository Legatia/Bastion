# Agent Integration Guide

Bastion works with **any AI agent that makes HTTP or HTTPS requests**. No code changes needed — just route traffic through the Bastion proxy.

## Quick Start

### Option A: Environment Variable (Universal)

```bash
# Start Bastion proxy
bastion start

# Run your agent with proxy env set
export HTTP_PROXY=http://localhost:3000
export HTTPS_PROXY=http://localhost:3000
python agent.py
```

### Option B: Bastion Launcher (Recommended)

```bash
# Bastion sets proxy env automatically and launches your agent
bastion start -- python agent.py
```

This method:
1. Starts the Bastion proxy in the foreground
2. Sets `HTTP_PROXY` and `HTTPS_PROXY` automatically
3. Launches your agent as a child process
4. All outbound requests are monitored and policy-checked

---

## Framework Examples

### Python (LangChain, CrewAI, AutoGPT)

```bash
# Any Python agent that uses requests, httpx, or urllib
bastion start -- python agent.py
```

Or set the proxy in your code:

```python
import os
os.environ["HTTP_PROXY"] = "http://localhost:3000"
os.environ["HTTPS_PROXY"] = "http://localhost:3000"
```

Most Python HTTP libraries (requests, httpx, aiohttp, urllib3) respect these environment variables automatically.

### Node.js / TypeScript

```bash
bastion start -- node agent.js
```

Or use `global-agent` for programmatic setup:

```javascript
import { bootstrap } from 'global-agent';
bootstrap(); // Reads HTTP_PROXY from env
```

### Go

```bash
bastion start -- ./my-agent
```

Go's `net/http` package respects `HTTP_PROXY` and `HTTPS_PROXY` by default.

### Any Other Language

If your agent makes HTTP requests, it works with Bastion. Set the proxy environment variables before starting your agent:

```bash
export HTTP_PROXY=http://localhost:3000
export HTTPS_PROXY=http://localhost:3000
./my-agent
```

---

## Auto-Configure with `bastion enable`

For agents with known configuration files, Bastion can auto-inject proxy settings:

```bash
# Auto-configure a supported agent
bastion enable --agent <type> [--port <PORT>] [--configure-only]
```

**Supported types:** `autogpt`, `langchain`

This modifies the agent's config files to route through Bastion. Use `bastion disable --agent <type>` to revert.

---

## Custom Port

```bash
# Use port 8080 instead of default 3000
bastion start --port 8080 -- python agent.py
```

---

## Daemon Mode

```bash
# Run Bastion in the background
bastion start --daemon

# Check status
bastion status

# View logs
bastion logs -f

# Stop
bastion stop
```

---

## Verifying It Works

```bash
# Check if Bastion daemon is running
bastion status

# View intercepted requests in real-time
bastion logs -f

# Check recent audit trail
bastion audit --limit 20
```

---

## What Gets Protected

Once your agent is routed through Bastion, every outbound request is evaluated against your policies:

- **API Calls** to OpenAI, Anthropic, Google, and any other endpoint
- **HTTP Requests** made by agent tools and plugins
- **Spending** (enforce daily/monthly limits)
- **Data Leakage** (DLP scans for PII, API keys, secrets)
- **Rate Limits** (per-second, per-minute, per-hour)
- **Domain Control** (allow/block lists)

---

## Disabling Protection

```bash
# Stop the proxy
bastion stop

# Or remove auto-configured settings
bastion disable --agent <type>
```

---

## How It Works

1. **Proxy Interception**: Bastion runs a local HTTP/HTTPS proxy on `127.0.0.1`
2. **Environment Injection**: Your agent's HTTP library reads `HTTP_PROXY` and routes through Bastion
3. **Policy Evaluation**: Each request is sent to the Bastion backend for authorization
4. **Allow/Block**: Allowed requests proceed to the target. Blocked requests return 403

This is **transparent to your agent** — no SDK, no code changes, no vendor lock-in.

---

## Security Notes

- Bastion proxy runs **locally on your machine** (`127.0.0.1`)
- All decisions are logged in an **encrypted audit trail**
- Fail-closed: if the backend is unreachable, requests are blocked
- You can disable Bastion anytime with `bastion stop`

---

## Next Steps

1. [Configure policies](/policies/overview) in the dashboard
2. Set up [spending limits](/policies/spending-limits)
3. Enable [DLP scanning](/policies/dlp)
4. Monitor agents with [MoltMind](/cli/moltmind)

**Questions?** Check the main README or run `bastion --help`.
