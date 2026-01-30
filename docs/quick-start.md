# Quick Start

Protect your first AI agent in 2 minutes.

## Installation

```bash
# Clone and install
git clone https://github.com/bastion/bastion.git
cd bastion/cli
cargo install --path .
```

## Setup

```bash
# 1. Start backend (terminal 1)
cd bastion/backend && npm install && npm run dev

# 2. Start dashboard (terminal 2)
cd bastion/dashboard && npm install && npm run dev

# 3. Get API key from http://localhost:3001/settings
# 4. Login with CLI
bastion login --key bst_your_key_here
```

## Protect Your Agent

```bash
# Navigate to your agent directory
cd /path/to/your/agent

# Initialize
bastion init

# Run with protection
bastion start -- python agent.py
```

## Create Your First Policy

1. Open http://localhost:3001/policies
2. Click "Create Policy"
3. Select "Rate Limiting"
4. Set:
   - Max Requests: 100
   - Time Window: 1 minute
5. Save and enable

## Monitor Actions

```bash
# View real-time logs
bastion logs -f

# Check statistics
bastion stats

# View audit log
bastion audit
```

## What's Next?

- 📚 [Complete Getting Started Guide](/getting-started)
- 🎛️ [All CLI Commands](/cli/commands)
- 🔒 [Policy Types](/policies/overview)
- 🚀 [Production Deployment](/guides/production)

That's it! Your agent is now protected by Bastion.
