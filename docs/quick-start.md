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
# 1. Get API key from https://bastion.legatia.solutions/settings

# 2. Login with CLI (production backend)
bastion login --key bst_your_key_here --env prod

# Or for local development:
# cd bastion/backend && npm run dev
# bastion login --key bst_your_key_here --env dev
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

1. Open https://bastion.legatia.solutions/policies
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
