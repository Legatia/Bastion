<div align="center">
  <img src="logo.png" alt="Bastion" width="200"/>

  # Bastion

  ### The Security Layer for Autonomous AI Agents

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

</div>

---

## What is Bastion?

Bastion is a policy engine, identity layer, and cognitive monitor for AI agents. It sits between your agent and the outside world, enforcing security policies in real time.

- **Policy Engine** -- 9 policy types (DLP, rate limits, spending caps, blocklists, time windows, etc.)
- **On-Chain Identity (ERC-8004)** -- Register agents on Base with verifiable identity and reputation attestations
- **MoltMind Cognitive Monitor** -- Behavioral drift detection, health scoring, and anomaly alerts
- **CDP Wallets** -- Coinbase-managed wallets for agent-native payments and x402 support

**Works with any agent framework.** OpenClaw, LangChain, CrewAI, LangGraph, AutoGPT -- anything that makes HTTP requests.

---

## Architecture

```
backend/          Express API (TypeScript) -- policy engine, billing, webhooks, ERC-8004, MoltMind
cli/              Rust CLI -- bastion login, init, start, status, update
dashboard/        Next.js dashboard -- agents, policies, analytics, billing
desktop/          Tauri desktop app (React + Rust)
bastion-core/     Shared Rust core library
integrations/     Framework examples (CrewAI, LangGraph, ERC-8004 verifier)
```

### Backend Services

| Service | Purpose |
|---------|---------|
| `policy-evaluator` | Evaluates 9 policy types against incoming authorize requests |
| `dlp-scanner` | 30+ regex patterns for PII, secrets, API keys |
| `quota-service` | Tier-based feature gating and usage limits |
| `stripe-service` | Checkout sessions, customer portal, webhook verification |
| `erc8004` | On-chain agent registration and verification on Base |
| `cdp-wallet-service` | Coinbase Developer Platform wallet provisioning |
| `baselineEngine` | Calculates behavioral baselines per agent |
| `driftDetector` | Detects cognitive drift and generates health scores |
| `moltmind-scheduler` | Background jobs: drift detection (1h), baseline recalculation (24h), data cleanup (24h) |
| `billing-service` | Tier-based invoice calculation with coupon/discount support |

---

## Pricing

| | Free | Starter ($29/mo) | Pro ($79/mo) | Enterprise |
|---|---|---|---|---|
| Agents | 2 | 10 | 25 | Unlimited |
| Policy engine | Yes | Yes | Yes | Yes |
| Authorize checks/day | 1,000 | 50,000 | Unlimited | Unlimited |
| CDP Wallet | -- | Yes | Yes | Yes |
| ERC-8004 registration | -- | Daily | Real-time | Real-time |
| x402 support | -- | Yes | Yes | Yes |
| MoltMind health score | -- | Yes | Yes | Yes |
| MoltMind full (alerts, drift, analysis) | -- | -- | Yes | Yes |

**OpenClaw Runtime**: $99 one-time add-on.

Billing is handled via Stripe. Manage your subscription from the dashboard or the Stripe Customer Portal.

---

## Quick Start

### CLI Install

```bash
curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash
bastion login     # Authenticate with your API key
bastion init      # Register your agent
bastion start     # Proxy runs on localhost:3000
```

### Get an API Key

Sign up at [bastion.legatia.solutions](https://bastion.legatia.solutions) and copy your API key from the profile page.

### Point Your Agent

```python
# Set the proxy for any HTTP-based agent
export HTTP_PROXY=http://localhost:3000
```

Every outbound request now goes through Bastion's policy engine.

---

## API Endpoints

All endpoints are under `/v1/`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/authorize` | API Key | Evaluate an action against policies |
| `*` | `/agents` | API Key | CRUD agents, provision CDP wallets |
| `*` | `/policies` | API Key | CRUD security policies |
| `GET` | `/logs` | API Key | Encrypted audit logs |
| `GET` | `/analytics` | API Key | Usage analytics and summaries |
| `GET` | `/agents/:id/profile.json` | Public | ERC-8004 registration file |
| `POST` | `/agents/:id/verify` | API Key | Prepare on-chain registration tx |
| `POST` | `/agents/:id/register` | API Key | Server-side registration via CDP wallet |
| `GET` | `/agents/:id/wallet` | API Key | CDP wallet address and balances |
| `GET` | `/agents/:id/health` | API Key | MoltMind health score (STARTER+) |
| `GET` | `/agents/:id/alerts` | API Key | Cognitive alerts (PRO) |
| `POST` | `/agents/:id/analyze` | API Key | On-demand drift analysis (PRO) |
| `GET` | `/modules` | API Key | Current tier and features |
| `GET` | `/modules/pricing` | Public | Tier pricing table |
| `POST` | `/modules/checkout` | API Key | Start Stripe checkout |
| `POST` | `/modules/portal` | API Key | Open Stripe Customer Portal |
| `POST` | `/webhooks/stripe` | Stripe Sig | Stripe webhook handler |

---

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL
- Rust toolchain (for CLI and desktop)

### Backend

```bash
cd backend
cp .env.example .env       # Fill in DATABASE_URL, JWT_SECRET, Stripe keys
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev                 # Runs on localhost:3001
```

### CLI

```bash
cd cli
cargo build --release
```

### Environment Variables

See [`backend/.env.example`](./backend/.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `STRIPE_SECRET_KEY` | Production | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Production | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_STARTER` | Production | Stripe Price ID for Starter tier |
| `STRIPE_PRICE_ID_PRO` | Production | Stripe Price ID for Pro tier |
| `STRIPE_PRICE_ID_OPENCLAW` | Production | Stripe Price ID for OpenClaw one-time |
| `BACKEND_URL` | Production | Public backend URL (for ERC-8004 agent URIs) |
| `FRONTEND_URL` | Production | Dashboard URL (for Stripe redirects) |
| `CDP_API_KEY_NAME` | Optional | Coinbase Developer Platform API key |
| `CDP_API_KEY_PRIVATE_KEY` | Optional | Coinbase Developer Platform private key |
| `ENCRYPTION_KEY` | Recommended | AES-256 key for audit log encryption |

---

## Security

- AES-256-GCM encrypted audit logs
- Rate limiting on all endpoints (auth, authorize, webhooks, policies)
- Stripe webhook signature verification with idempotency tracking
- CORS whitelist (no wildcards)
- HMAC-SHA256 webhook verification
- DLP scanner with 30+ built-in patterns for PII, secrets, and API keys

---

## Contributing

We welcome contributions in:

- **Integrations** -- LangChain, CrewAI, LangGraph, AutoGPT examples
- **DLP Patterns** -- More detection rules for secrets and PII
- **Testing** -- Edge cases, security audits
- **Documentation** -- Guides and tutorials

---

## Community

- **GitHub Issues**: [Report bugs](https://github.com/Legatia/Bastion/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/Legatia/Bastion/discussions)
- **Email**: bastion.feedback@legatia.solutions

**Security issues?** Email bastion.feedback@legatia.solutions

---

<div align="center">

**MIT Licensed** | Self-host for free | Or use the hosted service at [bastion.legatia.solutions](https://bastion.legatia.solutions)

</div>
