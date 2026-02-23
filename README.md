<div align="center">
  <img src="logo.png" alt="Bastion" width="200"/>

  # Bastion Protocol

  ### Runtime security for AI agents

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
  [![Rust](https://img.shields.io/badge/Rust-CLI-orange)](https://www.rust-lang.org/)

</div>

---

## What is Bastion Protocol?

Bastion Protocol is the security layer for autonomous AI agents. It sits between your agent and the outside world as an HTTP proxy, enforcing security policies in real time. Zero code changes. Sub-50ms latency.

- **Policy Engine** — 9 policy types (DLP, rate limits, spending caps, blocklists, time windows, etc.) with 30+ built-in detection patterns
- **Industry Profiles** — Interchangeable policy bundles that can be applied, exported, and imported per tenant
- **On-Chain Identity (ERC-8004)** — Register agents on Avalanche with verifiable identity and reputation scores
- **MoltMind Behavioral Monitor** — Statistical baselines, drift detection, health scoring, and anomaly alerts
- **CDP Wallets** — Coinbase-managed wallets for agent transactions and x402 support

**Works with any agent framework.** LangChain, CrewAI, LangGraph, AutoGPT — anything that makes HTTP requests. No SDK or code changes needed.

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
| `erc8004` | On-chain agent registration and verification on Avalanche |
| `cdp-wallet-service` | Coinbase Developer Platform wallet provisioning |
| `baselineEngine` | Calculates behavioral baselines per agent |
| `driftDetector` | Detects cognitive drift and generates health scores |
| `behavioralCollector` | Collects and stores agent behavioral data |
| `moltmind-scheduler` | Background jobs: drift detection (1h), baseline recalculation (24h), data cleanup (24h) |
| `billing-service` | Tier-based invoice calculation with coupon/discount support |
| `coupon-manager` | Referral coupons with monthly usage limits |
| `encryption-service` | AES-256-GCM encrypted audit logs (zero-knowledge) |

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

**Agent Runtime Manager**: $99 one-time add-on — desktop process lifecycle management for your agents.

Billing is handled via Stripe. Manage your subscription from the dashboard or the Stripe Customer Portal.

---

## Quick Start

### 1. Install

```bash
curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash
```

### 2. Login

Get an API key at [bastion.legatia.solutions/profile](https://bastion.legatia.solutions/profile), then:

```bash
bastion login     # Paste your API key — auto-chains into agent setup
```

### 3. Start the proxy

```bash
bastion start                          # Foreground on localhost:3000
bastion start --daemon                 # Background mode
bastion start -- python agent.py       # Launch agent with proxy env auto-set
```

### 4. Point your agent

```bash
export HTTP_PROXY=http://localhost:3000
export HTTPS_PROXY=http://localhost:3000
```

Every outbound request now goes through Bastion's policy engine.

### Supported Platforms

The installer auto-detects your architecture. Pre-built binaries for:

| Platform | Asset |
|----------|-------|
| macOS Apple Silicon | `bastion-darwin-arm64` |
| macOS Intel | `bastion-darwin-amd64` |
| Linux x86_64 | `bastion-linux-amd64` |
| Linux ARM64 (Jetson, Pi 4/5) | `bastion-linux-arm64` |
| Linux ARMv7 (Pi 3/4, robotic boards) | `bastion-linux-armv7` |

---

## CLI Commands

| Command | Tier | Description |
|---------|------|-------------|
| `bastion login` | FREE | Authenticate with API key (chains into init) |
| `bastion init` | FREE | Register an agent in the current directory |
| `bastion start` | FREE | Start the local supervisor proxy |
| `bastion stop` | FREE | Stop the running daemon |
| `bastion status` | FREE | Check daemon status |
| `bastion logs` | FREE | View daemon logs (`-f` to follow) |
| `bastion restart` | FREE | Restart the daemon |
| `bastion list` | FREE | List all registered agents |
| `bastion config` | FREE | View/update agent configuration |
| `bastion policy` | FREE | Manage security policies (list/create/toggle/delete) |
| `bastion audit` | FREE | View audit log of agent actions |
| `bastion stats` | FREE | Show usage statistics |
| `bastion test` | FREE | Dry-run a policy check |
| `bastion validate` | FREE | Validate configuration files |
| `bastion health` | FREE | Check backend connectivity |
| `bastion update` | FREE | Self-update to latest version |
| `bastion delete` | FREE | Delete an agent |
| `bastion wallet` | STARTER+ | Show CDP wallet address and balances |
| `bastion verify` | STARTER+ | Prepare ERC-8004 on-chain registration tx |
| `bastion register` | STARTER+ | Register agent on-chain via CDP wallet (automated) |
| `bastion moltmind` | STARTER+ | Behavioral monitoring (health, alerts, baselines, analysis) |

---

## API Endpoints

All endpoints are under `/v1/`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/authorize` | API Key | Evaluate an action against policies |
| `*` | `/agents` | API Key | CRUD agents, provision CDP wallets |
| `*` | `/policies` | API Key | CRUD security policies |
| `GET` | `/industry-profiles` | API Key | List built-in industry profiles + active profile |
| `GET` | `/industry-profiles/changelog` | API Key | List applied profile/version history derived from policy tags |
| `POST` | `/industry-profiles/:profileId/apply` | API Key | Apply a built-in profile overlay to tenant policies |
| `GET` | `/industry-profiles/export` | API Key | Export tenant policy bundle as profile JSON |
| `POST` | `/industry-profiles/import` | API Key | Import and apply a tenant profile bundle |
| `GET` | `/logs` | API Key | Encrypted audit logs |
| `GET` | `/analytics` | API Key | Usage analytics and summaries |
| `GET` | `/agents/:id/profile.json` | Public | ERC-8004 registration file |
| `POST` | `/agents/:id/verify` | API Key | Prepare on-chain registration tx |
| `POST` | `/agents/:id/register` | API Key | Server-side registration via CDP wallet |
| `GET` | `/attest/wallet` | Public | Attestation wallet address, network, and balances |
| `GET` | `/attest/status` | Public | Attestation configuration and health status |
| `GET` | `/admin/launch-metrics` | API Key (Admin) | Launch funnel and revenue snapshot (30d default) |
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
| `STRIPE_PRICE_ID_OPENCLAW` | Production | Stripe Price ID for Agent Runtime one-time |
| `BACKEND_URL` | Production | Public backend URL (for ERC-8004 agent URIs) |
| `FRONTEND_URL` | Production | Dashboard URL (for Stripe redirects) |
| `CDP_API_KEY_ID` | Optional | Coinbase Developer Platform API key ID |
| `CDP_API_KEY_SECRET` | Optional | Coinbase Developer Platform API key secret |
| `CDP_WALLET_SECRET` | Optional | Coinbase Developer Platform wallet secret |
| `ADMIN_EMAILS` | Optional | Comma-separated admin account emails for dashboard admin access |
| `ATTESTATION_CONTRACT_ADDRESS` | Optional | On-chain attestation contract address for policy/decision receipts |
| `ATTESTATION_NETWORK` | Optional | Network for attestations (default `avalanche`) |
| `ATTESTATION_WALLET_NAME` | Optional | CDP wallet name used for attestations (default `bastion-attestor`) |
| `ATTESTATION_RPC_URL` | Optional | RPC URL override for `/v1/attest/status` contract code checks |
| `ATTEST_DECISION_ACTION_TYPES` | Optional | Comma-separated critical action types to anchor (e.g. `payment,transfer,swap`) |
| `ATTEST_HEALTH_ENABLED` | Optional | Enable periodic MoltMind health checkpoint attestations (default `false`) |
| `ATTEST_HEALTH_INTERVAL_HOURS` | Optional | Checkpoint interval in hours (default `24`, max `168`) |
| `ATTEST_HEALTH_MIN_EVENTS` | Optional | Minimum events in interval to attest when no high/critical alerts (default `10`) |
| `ATTEST_MAX_TX_PER_HOUR` | Optional | Attestation tx safety cap per hour (default `400`) |
| `ATTEST_MAX_TX_PER_DAY` | Optional | Attestation tx safety cap per day (default `5000`) |
| `ENCRYPTION_KEY` | Recommended | AES-256 key for audit log encryption |

Desktop runtime installer overrides (optional, for Tauri app runtime installs):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_INSTALLER_URL_UNIX` | Optional | Override installer URL on Unix-like systems (default `https://openclaw.ai/install.sh`) |
| `OPENCLAW_INSTALLER_URL_WINDOWS` | Optional | Override installer URL on Windows (default `https://openclaw.ai/install.ps1`) |
| `OPENCLAW_INSTALLER_SHA256_UNIX` | Recommended | Expected SHA-256 for Unix installer script |
| `OPENCLAW_INSTALLER_SHA256_WINDOWS` | Recommended | Expected SHA-256 for Windows installer script |
| `OPENCLAW_INSTALLER_ALLOW_UNPINNED` | Optional | Allow installer run without checksum pinning (`true` by default; set `false` to enforce pinning) |
| `OPENCLAW_INSTALLER_SKIP_DOCTOR` | Optional | Skip `openclaw doctor` post-install health check (`false` by default) |

---

## Security

- AES-256-GCM encrypted audit logs (zero-knowledge — Bastion cannot decrypt)
- Fail-closed policy enforcement (blocks traffic when backend is unreachable)
- Config file permissions restricted to owner (0600 on Unix)
- Rate limiting on all endpoints (auth, authorize, webhooks, policies)
- Stripe webhook signature verification with idempotency tracking
- CORS whitelist (no wildcards)
- HMAC-SHA256 webhook verification
- DLP scanner with 30+ built-in patterns for PII, secrets, and API keys
- Cryptographically random referral codes

---

## On-Chain Attestations

Bastion can anchor policy changes and critical decision receipts on-chain using a dedicated CDP wallet (`bastion-attestor` by default).

- Contract source: `contracts/attestor/src/BastionAttestor.sol`
- Wallet endpoint: `GET /v1/attest/wallet`
- Status endpoint: `GET /v1/attest/status`
- Triggered on:
  - Policy `create/update/delete`
  - Critical `/authorize` decisions (blocked/error/spending/critical action types)
  - Periodic MoltMind health checkpoints (score + alert summary hash)

### Deploy to Avalanche Mainnet (Recommended)

```bash
cd contracts/attestor
forge create src/BastionAttestor.sol:BastionAttestor \
  --rpc-url https://api.avax.network/ext/bc/C/rpc \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --chain-id 43114 \
  --broadcast
```

Then set:

```bash
ATTESTATION_CONTRACT_ADDRESS=0x...
ATTESTATION_NETWORK=avalanche
ATTESTATION_WALLET_NAME=bastion-attestor
ATTEST_HEALTH_ENABLED=true
ATTEST_HEALTH_INTERVAL_HOURS=24
ATTEST_HEALTH_MIN_EVENTS=10
ATTEST_MAX_TX_PER_HOUR=400
ATTEST_MAX_TX_PER_DAY=5000
```

Restart the backend after updating env vars.

---

## Contributing

We welcome contributions in:

- **Integrations** -- LangChain, CrewAI, LangGraph, AutoGPT, and other framework examples
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

**MIT Licensed** | Built by [Legatia](https://legatia.solutions) | Hosted service at [bastion.legatia.solutions](https://bastion.legatia.solutions)

</div>
