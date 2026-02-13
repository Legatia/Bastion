# Getting Started

Get your first AI agent protected with Bastion in under 5 minutes.

## Prerequisites

- **Rust** (1.70+) - [Install Rust](https://rustup.rs/) (Only needed for CLI)
- **Node.js** (18+) - For running the backend locally
- **PostgreSQL** (optional) - For persistent storage

## Fast Track: Bastion Desktop

If you want to get started with a visual interface and zero terminal setup, download the **Bastion Desktop App**.

1.  **Download** the installer for your OS ([Mac](https://github.com/Legatia/Bastion/releases) / [Windows](https://github.com/Legatia/Bastion/releases) / [Linux](https://github.com/Legatia/Bastion/releases)).
2.  **Run the Install Wizard** — it will handle OpenClaw installation, proxy setup, and API key configuration for you.
3.  **Start Protecting** — manage your agents, policies, and identity from the native dashboard.

---

## Step 1: Install the CLI (Alternative)

```bash
# One-line install (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash

# Verify installation
bastion --version
```

Or build from source (requires Rust 1.70+):

```bash
git clone https://github.com/Legatia/Bastion.git
cd Bastion/cli
cargo install --path .
```

## Step 2: Choose Your Backend

You can use either the **hosted backend** (recommended) or run it **locally** for development.

### Option A: Use Hosted Backend (Recommended)

The production backend is already running at `https://bastion-gamma.vercel.app/v1`. No setup needed - just login with `--env prod`:

```bash
bastion login --key bst_your_api_key --env prod
```

### Option B: Run Backend Locally (Development)

For local development and testing:

```bash
cd bastion/backend
npm install
npm run dev
```

The backend will start on `http://localhost:3000/v1`.

## Step 3: Choose Your Plan

Bastion provides 4 tiers to scale with your agent deployment.

| Tier | Price | Capacity | Key Features |
| :--- | :--- | :--- | :--- |
| **Free** | $0 | 2 Agents | Basic Policies, REST API |
| **Starter** | $29/mo | 10 Agents | DLP Patterns, Behavioral Alerts |
| **Pro** | $79/mo | 25 Agents | ERC-8004 Identity, Priority Support |
| **Enterprise** | Custom | Unlimited | Custom SLAs, On-prem Support |

1. Open https://bastion.legatia.solutions in your browser
2. Sign up for a new account
3. Navigate to Settings → API Keys
4. Generate a new API key
5. Copy the key (starts with `bst_`)

## Step 4: Login with CLI

**Using Production Backend** (recommended):
```bash
bastion login --key bst_your_api_key_here --env prod
```

**Using Local Backend** (development):
```bash
bastion login --key bst_your_api_key_here --env dev
```

You should see:
```
✅ Login successful!

Your API Key: bst_d...
Environment: prod
Backend URL: https://bastion-gamma.vercel.app/v1

Next step: Run `bastion init` in your agent directory
```

## Quick Path: Using OpenClaw?

**If you're using OpenClaw**, skip to the one-command setup instead:

```bash
bastion enable --agent openclaw
```

This automatically:
1. ✅ Configures `~/.openclaw/openclaw.json` with proxy settings
2. ✅ Starts Bastion daemon in background
3. ✅ Creates backup of original config

Then just run `openclaw` normally - it's fully protected!

**[→ View full OpenClaw integration guide](/guides/openclaw-integration)**

---

## Step 5: Initialize Your Agent

Navigate to your agent's project directory:

```bash
cd /path/to/your/agent
bastion init
```

You'll be prompted for:
- **Agent name** - A friendly name (e.g., "trading-bot")
- **Language** - python, javascript, go, etc.
- **Framework** - langchain, autogpt, custom

Example:
```
🛡️  Bastion Protocol Setup

Logged in as: you@example.com

Agent name: my-trading-bot
Language: python
Framework: custom

🔄 Creating agent...
✅ Agent created!

Agent ID: 550e8400-e29b-41d4-a716-446655440000
Config saved to: .bastion-agent.json

Next step: Run your agent with Bastion protection:
  bastion start -- python agent.py
```

This creates a `.bastion-agent.json` file in your project:

```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-trading-bot",
  "language": "python",
  "framework": "custom",
  "enabled": true,
  "created_at": "2025-01-30T10:30:00Z"
}
```

## Step 6: Configure Policies

Before running your agent, set up some policies in the dashboard:

1. Go to https://bastion.legatia.solutions/policies
2. Click "Create Policy"
3. Choose a policy type (e.g., Rate Limiting)
4. Configure the policy:
   ```
   Name: API Rate Limit
   Type: Rate Limiting
   Max Requests: 100
   Time Window: 1 minute
   Enabled: Yes
   ```
5. Save the policy

## Step 7: Run Your Agent

Start your agent with Bastion protection:

```bash
# Foreground mode (recommended for testing)
bastion start -- python agent.py

# Or daemon mode (for production)
bastion start --daemon -- python agent.py
```

Output:
```
🛡️  Starting Bastion Supervisor

✓ Loaded configuration
✓ Backend: http://localhost:3000/v1
✓ Proxy listening on port: 3000

🚀 Bastion Supervisor active!
   Proxy: http://localhost:3000
   Dashboard: https://bastion.legatia.solutions

📊 Monitoring agent actions...

🤖 Launching agent: python agent.py
✓ Agent started (PID: 12345)
```

Your agent is now protected! All HTTP/HTTPS requests will be intercepted and evaluated against your policies.

## Step 8: Monitor Your Agent

### In Real-Time
Watch the CLI output to see actions being evaluated:

```
[10:30:15] http_request - {"method": "GET", "url": "https://api.example.com/data"}
   ✓ ALLOWED

[10:30:18] http_request - {"method": "POST", "url": "https://blocked-domain.com"}
   🛑 BLOCKED: Domain not in allow list
```

### In the Dashboard
Open https://bastion.legatia.solutions/audit to see:
- All actions (allowed and blocked)
- Timestamps and details
- Which policies triggered
- Agent performance metrics

### Via CLI
```bash
# Check daemon status
bastion status

# View logs
bastion logs -n 100

# Follow logs in real-time
bastion logs -f

# View audit trail
bastion audit --limit 50

# Show statistics
bastion stats --range today
```

## Step 9: Test Your Policies

Use the test command to simulate actions without actually executing them:

```bash
# Test an HTTP request
bastion test \
  --action-type http_request \
  --url https://api.example.com \
  --method POST

# Output:
# ✅ Action would be ALLOWED
# or
# 🛑 Action would be BLOCKED
```

## Next Steps

Congratulations! You now have a protected AI agent. Here's what to explore next:

### Learn More
- 📚 [How Bastion Works](/concepts/how-it-works) - Understanding the architecture
- 🎛️ [Policy Types](/policies/overview) - All available policy options
- 🛠️ [CLI Reference](/cli/commands) - Complete command documentation

### Advanced Guides
- 🚀 [Production Deployment](/guides/production) - Deploy to production
- 🧪 [Testing Policies](/guides/testing) - Validate your policies
- 📊 [Monitoring & Alerts](/guides/monitoring) - Set up alerting

### Build Custom Policies
- 🔌 [Custom Webhooks](/policies/webhooks) - Route decisions to your code
- 📝 [Policy Examples](/guides/policy-examples) - Real-world use cases

## Common Issues

### Backend Not Reachable
```bash
bastion health
# If this fails, make sure:
# 1. Backend is running: cd backend && npm run dev
# 2. Check firewall settings
# 3. Verify backend URL in config: cat ~/.bastion/config.json
```

### Agent Not Using Proxy
Make sure your agent respects the `HTTP_PROXY` and `HTTPS_PROXY` environment variables. Most HTTP libraries do this by default, but some may need explicit configuration.

**Python (requests library)**:
```python
import requests

# This will automatically use HTTP_PROXY if set
response = requests.get("https://api.example.com")
```

**Node.js**:
```javascript
// Most libraries respect HTTP_PROXY automatically
// But you can also use global-agent:
import { bootstrap } from 'global-agent';
bootstrap();
```

### Port Already in Use
If port 3000 is already taken:
```bash
bastion start --port 8080 -- python agent.py
```

## Getting Help

- 📖 [Troubleshooting Guide](/cli/troubleshooting)
- 💬 [GitHub Discussions](https://github.com/Legatia/Bastion/discussions)
- 🐛 [Report an Issue](https://github.com/Legatia/Bastion/issues)
- 📧 Email: bastion.feedback@legatia.solutions
