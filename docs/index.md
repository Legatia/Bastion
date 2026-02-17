---
layout: home

hero:
  name: Bastion
  text: Cross-Platform Firewall for AI Agents
  tagline: Protect autonomous systems with real-time policy enforcement, behavioral monitoring, and on-chain identity.
  image:
    src: /logo.svg
    alt: Bastion
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Legatia/Bastion

features:
  - icon: 🛡️
    title: Zero Code Changes
    details: Add security to any AI agent without modifying your application code. Use our CLI proxy or the native Desktop App.

  - icon: 🧠
    title: MoltMind Monitoring
    details: Behavioral baselines and anomaly detection. Detect when your agents drift from their intended purpose or exhibit risky patterns.

  - icon: 🆔
    title: On-Chain Identity
    details: ERC-8004 registration on Avalanche. Give your agents verifiable, decentralised identity for trustless agent-to-agent interactions.

  - icon: ⚡
    title: Real-Time Protection
    details: Every action is evaluated against policies (DLP, rate limits, spending caps) before execution. Blocks happen in sub-50ms.

  - icon: 📊
    title: Multi-Platform
    details: Manage agents from the CLI on your server or with our premium Desktop App for Mac, Linux, and Windows.

  - icon: 🔧
    title: Flexible Policies
    details: 30+ DLP patterns, spending limits, rate limiting, and custom webhooks. Build policies for any use case in seconds.

---

## What is Bastion?

Bastion is a **programmable firewall for AI agents**. It sits between your autonomous AI system and the outside world, intercepting and evaluating every action before it executes.

Think of it as a **circuit breaker for AI** - preventing hallucinations, mistakes, and malicious behavior from causing real-world harm.

## Why Bastion?

Autonomous AI agents are powerful but unpredictable. They can:
- 💸 Spend unlimited money on API calls or transactions
- 🗑️ Delete critical files or data
- 📤 Leak sensitive information (PII, API keys, secrets)
- 🔥 Make requests to malicious domains
- ⚡ Overwhelm services with excessive requests

**Bastion prevents all of this** with policy-based controls that require zero changes to your agent code.

## How It Works

```bash
# 1. Install the CLI
cargo install bastion-cli

# 2. Login and initialize
bastion login --key bst_your_api_key
bastion init

# 3. Start your agent with protection
bastion start -- python agent.py

# That's it! Your agent is now protected.
```

Bastion creates a local HTTP proxy that intercepts all network requests. Each request is evaluated against your policies in the dashboard. Allowed requests proceed normally. Blocked requests return 403 FORBIDDEN.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │         │              │         │             │
│  AI Agent   ├────────►│  Bastion CLI │────────►│  Bastion    │
│             │         │   (Proxy)    │         │  Backend    │
│             │         │              │         │  (Policies) │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Allowed?
                              ▼
                        ┌──────────────┐
                        │              │
                        │  Real Target │
                        │  (APIs, etc) │
                        │              │
                        └──────────────┘
```

## Use Cases

### Trading Bots
Enforce stop-loss limits, maximum transaction amounts, and trading hour restrictions. Never lose more than your risk tolerance.

### Data Processing Agents
Prevent data exfiltration with DLP policies. Block requests containing PII, API keys, or sensitive patterns.

### DevOps Agents
Restrict deployments to business hours. Require approval for production operations. Block dangerous commands.

### Customer Support Bots
Ensure agents never leak customer data. Block requests with credit card numbers, SSNs, or other PII.

### General Autonomous Systems
Rate limit API calls. Block malicious domains. Enforce spending budgets. Prevent any action you define.

## Key Features

### 🎛️ Comprehensive Policy Types
- **Spending Limits** - Maximum transaction amounts per time window
- **Rate Limiting** - Max requests per second/minute/hour/day
- **File Protection** - Block operations on critical paths
- **Data Loss Prevention** - Detect and block PII, secrets, API keys
- **Time Windows** - Restrict operations to specific hours/days
- **Pattern Matching** - Block SQL injection, XSS, dangerous patterns
- **Allow/Block Lists** - Explicit domain and address control
- **Custom Webhooks** - Route decisions to your own logic

### 🛠️ Production-Grade CLI
- **Daemon Mode** - Run in background with automatic restart
- **Graceful Shutdown** - Clean process termination
- **Log Rotation** - Automatic log management
- **Health Checks** - Monitor backend connectivity
- **Audit Logs** - View all actions from CLI
- **Statistics** - Track usage and block rates
- **Policy Testing** - Dry-run mode to test policies

### 📈 Observability
- Real-time action monitoring
- Immutable audit trail
- Usage statistics and metrics
- Block rate tracking
- Custom alerting (coming soon)

## Choose Your Platform

Bastion offers two ways to protect your agents, tailored to your environment.

| Feature | Bastion CLI | Bastion Desktop |
| :--- | :--- | :--- |
| **Best For** | Servers, CI/CD, Production | Local Dev, Research, Monitoring |
| **Setup** | `cargo install` | Native Installer (Mac/Win/Linux) |
| **Interface** | CLI / Dashboard | Native GUI + Dashboard |
| **Monitoring** | Stdout / Audit Logs | Real-time Health Badges & Alerts |
| **Identity** | `bastion register` | Identity Management Wizard |
| **Agent Setup** | `bastion start -- <cmd>` | Integrated Install Wizard |

## Getting Started

Ready to protect your AI agents? Follow our [Getting Started Guide](/getting-started) to install Bastion and secure your first agent in under 5 minutes.

## Open Source

Bastion is open source and free to use. We believe security for AI agents should be accessible to everyone.

[View on GitHub →](https://github.com/Legatia/Bastion)
