# Bastion Protocol

**Protect any AI agent in 60 seconds. Zero code changes.**

Bastion is a pure backend SaaS platform that acts as a programmable firewall for AI agents. Block dangerous transactions, enforce data loss prevention rules, and create immutable audit trails - all without touching blockchain or requiring code modifications.

## 🚀 Quick Start

### 1. Start Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL
npm run db:push
npm run db:seed  # Create test user
npm run dev
```

Backend will run on `http://localhost:3000`

### 2. Install CLI

```bash
cd cli
cargo build --release
# Binary will be at target/release/bastion-cli

# Or add to PATH
cargo install --path .
```

### 3. Login & Initialize

```bash
# Login (creates API key)
bastion login

# Initialize in your agent directory
cd /path/to/your/agent
bastion init

# Run your agent with protection
bastion start -- python agent.py
```

## 🛡️ What It Does

### Intercepts Dangerous Operations

```bash
[10:30:15] http_request - POST https://api.stripe.com/charges
   ✓ ALLOWED

[10:30:22] file_delete - database.db
   🛑 BLOCKED: Critical file protection

[10:30:45] http_request - $600 charge
   🛑 BLOCKED: Daily limit exceeded ($450/$500)
```

### Supports Multiple Policy Types

1. **Spending Limits** - Max $500/day
2. **Rate Limiting** - Max 100 requests/hour
3. **File Protection** - Block deletes in /data
4. **DLP** - Detect PII, API keys, secrets
5. **Time Windows** - Only 9am-5pm weekdays
6. **Pattern Matching** - Block SQL injections
7. **Custom Webhooks** - Your own logic
8. **Allow/Blocklists** - Explicit control

## 📁 Project Structure

```
/backend          # Node.js/TypeScript API
  /src
    /routes       # API endpoints
    /services     # Policy evaluation engine
    /middleware   # Auth, logging
    /types        # TypeScript types
  /prisma         # Database schema

/cli              # Rust CLI tool
  /src
    main.rs       # CLI commands & HTTP proxy

/dashboard        # Next.js web interface
  /pages          # Policy builder, logs, analytics

/integrations     # Framework plugins
  /clawdbot       # Node.js plugin
  /langgraph      # Python integration
  /crewai         # Python integration
```

## 🎯 Use Cases

### Trading Bot Protection
```bash
Policy: Block any trade >$100
Result: Bot bug tries $10k trade → BLOCKED
Saved: $10,000
```

### Customer Support Agent
```bash
Policy: Block if customer data in API call
Result: Agent tries to send SSN to logging service → BLOCKED
Saved: GDPR violation
```

### DevOps Agent
```bash
Policy: No deployments outside business hours
Result: Agent tries deploy at 2am → BLOCKED
Saved: Production incident
```

## 🔧 Development

### Backend Commands

```bash
npm run dev         # Start with hot reload
npm run build       # Build for production
npm run db:generate # Generate Prisma client
npm run db:push     # Push schema to DB
npm run db:seed     # Create test data
npm run test:api    # Run API tests
```

### CLI Commands

```bash
cargo build         # Build debug
cargo build --release  # Build optimized
cargo run -- login  # Test login
cargo run -- start -- python agent.py  # Test agent launch
```

### Testing the Flow

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start CLI
cd cli && cargo run -- start -- python examples/demo-agent.py

# Terminal 3: Watch logs
curl http://localhost:3000/v1/logs -H "X-API-Key: YOUR_KEY"
```

## 🌐 API Endpoints

### Core
- `POST /v1/authorize` - Evaluate action against policies
- `GET /health` - Health check

### Policies
- `GET /v1/policies` - List policies
- `POST /v1/policies` - Create policy
- `PUT /v1/policies/:id` - Update policy
- `DELETE /v1/policies/:id` - Delete policy

### Logs & Analytics
- `GET /v1/logs` - Audit trail
- `GET /v1/analytics/summary` - Usage metrics
- `GET /v1/analytics/agents` - Per-agent stats

### Agents
- `GET /v1/agents` - List agents
- `POST /v1/agents` - Register agent
- `PUT /v1/agents/:id/heartbeat` - Update status

## 💰 Pricing Model (SaaS)

```
Starter:    $29/mo  - 1 agent, 10k checks/mo
Growth:    $149/mo  - 5 agents, 100k checks/mo, alerts
Pro:       $499/mo  - Unlimited agents, SSO, API access
Enterprise: Custom  - Dedicated, SLA, compliance reporting
```

## 🗺️ Roadmap

### ✅ MVP (Current)
- [x] Backend API with policy engine
- [x] CLI proxy interceptor
- [x] 8 policy types
- [x] Audit logging
- [x] Usage metrics

### 🚧 Phase 2 (Next 4 weeks)
- [ ] Web dashboard (policy builder, live monitoring)
- [ ] Framework integrations (LangChain, AutoGPT plugins)
- [ ] Python runtime injection
- [ ] Beta launch with 10 customers

### 🔮 Phase 3 (Month 6+)
- [ ] ZK privacy mode (premium feature)
- [ ] Blockchain attestation (optional add-on)
- [ ] MPC key management
- [ ] Custom subnet deployment (enterprise)

## 📊 Architecture

```
AI Agent (Unchanged)
    ↓
Bastion CLI (Local Proxy)
    ↓ HTTPS
Bastion Backend API (Policy Evaluation)
    ↓
PostgreSQL (Policies, Logs, Metrics)
    ↓
Dashboard (Next.js)
```

**Key Decisions:**
- ✅ Pure backend (no blockchain) = <$5k bootstrap
- ✅ SaaS pricing = Stable recurring revenue
- ✅ CLI-first = Zero code changes needed
- ✅ Policy engine in backend = Fast (<200ms)
- ✅ Optional blockchain later = Best of both worlds

## 📝 Example Policy

Create a spending limit policy:

```bash
curl -X POST http://localhost:3000/v1/policies \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Spending Limit",
    "type": "SPENDING_LIMIT",
    "config": {
      "max_amount": 500,
      "window": "24h"
    },
    "enabled": true,
    "priority": 10
  }'
```

## 🚀 Deployment

We support one-click deployment to Vercel (recommended).

[**Read the Deployment Guide**](./DEPLOYMENT.md)

## 🤝 Contributing

This is a hackathon project. Contributions welcome after MVP launch.

## 📄 License

MIT License - See LICENSE file

## 🔗 Links

- **Deployment Guide**: [`/DEPLOYMENT.md`](./DEPLOYMENT.md)
- **Referral System**: [`/REFERRAL_SYSTEM.md`](./REFERRAL_SYSTEM.md)
- **Backend API**: `http://localhost:3000`
- **Dashboard**: `http://localhost:3002`

---

**Built for bootstrapping. Ready to scale.**
