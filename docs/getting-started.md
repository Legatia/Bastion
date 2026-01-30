# Getting Started

Get your first AI agent protected with Bastion in under 5 minutes.

## Prerequisites

- **Rust** (1.70+) - [Install Rust](https://rustup.rs/)
- **Node.js** (18+) - For running the backend locally
- **PostgreSQL** (optional) - For persistent storage

## Step 1: Install the CLI

```bash
# Clone the repository
git clone https://github.com/bastion/bastion.git
cd bastion/cli

# Build and install
cargo install --path .

# Verify installation
bastion --version
# Output: bastion 0.1.0
```

## Step 2: Start the Backend

In a separate terminal, start the Bastion backend:

```bash
cd bastion/backend
npm install
npm run dev
```

The backend will start on `http://localhost:3000`.

## Step 3: Start the Dashboard

In another terminal, start the dashboard:

```bash
cd bastion/dashboard
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3001`.

## Step 4: Create an Account

1. Open http://localhost:3001 in your browser
2. Sign up for a new account
3. Navigate to Settings → API Keys
4. Generate a new API key
5. Copy the key (starts with `bst_`)

## Step 5: Login with CLI

```bash
bastion login --key bst_your_api_key_here

# Or use interactive mode
bastion login
# Then paste your key when prompted
```

You should see:
```
✅ Login successful!

Your API Key: bst_d...
Environment: dev
Backend URL: http://localhost:3000/v1

Next step: Run `bastion init` in your agent directory
```

## Step 6: Initialize Your Agent

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

## Step 7: Configure Policies

Before running your agent, set up some policies in the dashboard:

1. Go to http://localhost:3001/policies
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

## Step 8: Run Your Agent

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
   Dashboard: http://localhost:3001

📊 Monitoring agent actions...

🤖 Launching agent: python agent.py
✓ Agent started (PID: 12345)
```

Your agent is now protected! All HTTP/HTTPS requests will be intercepted and evaluated against your policies.

## Step 9: Monitor Your Agent

### In Real-Time
Watch the CLI output to see actions being evaluated:

```
[10:30:15] http_request - {"method": "GET", "url": "https://api.example.com/data"}
   ✓ ALLOWED

[10:30:18] http_request - {"method": "POST", "url": "https://blocked-domain.com"}
   🛑 BLOCKED: Domain not in allow list
```

### In the Dashboard
Open http://localhost:3001/audit to see:
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

## Step 10: Test Your Policies

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
- 💬 [GitHub Discussions](https://github.com/bastion/bastion/discussions)
- 🐛 [Report an Issue](https://github.com/bastion/bastion/issues)
- 📧 Email: support@bastion.ai
