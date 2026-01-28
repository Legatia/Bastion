# Bastion Protocol: Pure Backend Development Plan

**Decision Date:** 2026-01-28
**Strategic Direction:** Backend-first SaaS, blockchain as optional premium feature later

---

## Executive Summary

**The Pivot:**
- FROM: Blockchain-first with smart contracts, subnet validators, gas sponsorship
- TO: Pure backend SaaS with optional blockchain attestation later

**Why:**
- Bootstrap with <$5k vs $50-100k capital requirement
- Zero gas fees = massive competitive advantage
- 10x faster performance (50-200ms vs 3-15 seconds)
- Enterprise-friendly (no crypto complexity)
- Ship in 3-4 weeks vs 8-12 weeks

**Core Value Proposition:**
"Protect any AI agent in 60 seconds. Zero code changes."

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Unchanged)                      │
│         Python / Node.js / Any Language                      │
│         (Stripe, AWS, SendGrid, SQL, File Ops)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ All operations intercepted
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Bastion CLI (Local Supervisor)                  │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  HTTP/HTTPS Proxy (Port 8080)                      │     │
│  │  ├─ Intercepts API calls (Stripe, AWS, etc)        │     │
│  │  └─ Forwards to backend for policy check           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Runtime Injection (Python/Node.js)                │     │
│  │  ├─ Wraps: open(), remove(), subprocess.run()      │     │
│  │  ├─ Wraps: Database operations                     │     │
│  │  └─ Checks with backend before execution           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Local Dashboard (Port 3001)                       │     │
│  │  └─ Real-time monitoring of agent actions          │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS API Calls
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Bastion Backend API (SaaS)                      │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Policy Evaluation Engine                          │     │
│  │  ├─ Parse action (tool, args, endpoint)            │     │
│  │  ├─ Fetch user policies from DB                    │     │
│  │  ├─ Evaluate: allowed/blocked                      │     │
│  │  └─ Return: decision + reason                      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  PostgreSQL Database                               │     │
│  │  ├─ Users & API keys                               │     │
│  │  ├─ Policies (JSON rules)                          │     │
│  │  ├─ Action logs (audit trail)                      │     │
│  │  └─ Billing & usage metrics                        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  REST API Endpoints                                │     │
│  │  ├─ POST /v1/authorize (policy check)              │     │
│  │  ├─ GET  /v1/policies (list user policies)         │     │
│  │  ├─ POST /v1/policies (create/update)              │     │
│  │  ├─ GET  /v1/logs (audit trail)                    │     │
│  │  └─ GET  /v1/analytics (usage stats)               │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Web Dashboard (Next.js)                           │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  /dashboard                                        │     │
│  │  ├─ Live agent monitoring                          │     │
│  │  ├─ Policy builder (visual editor)                 │     │
│  │  ├─ Audit logs (searchable, filterable)            │     │
│  │  ├─ Analytics & metrics                            │     │
│  │  └─ Billing & subscription management              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP Backend (Week 1-4)

### Week 1: Backend API Core

**Tech Stack:**
- **Runtime:** Node.js (TypeScript) OR Rust (Axum) - Decision needed
- **Database:** PostgreSQL + Prisma (Node) or SQLx (Rust)
- **Hosting:** Railway / Fly.io / Render ($20-50/month)
- **Auth:** JWT tokens for API authentication

**Deliverables:**

1. **API Endpoints:**
   ```
   POST /v1/authorize
   Request:
   {
     "api_key": "bst_live_xxx",
     "action": {
       "type": "http_request",
       "method": "POST",
       "url": "https://api.stripe.com/v1/charges",
       "body": {"amount": 50000, "currency": "usd"}
     }
   }

   Response:
   {
     "allowed": false,
     "reason": "Daily spending limit exceeded ($450/$500)",
     "policy_id": "pol_123",
     "log_id": "log_456"
   }
   ```

2. **Database Schema:**
   ```sql
   -- Users table
   CREATE TABLE users (
     id UUID PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     api_key VARCHAR(64) UNIQUE NOT NULL,
     subscription_tier VARCHAR(50),
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Policies table
   CREATE TABLE policies (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     name VARCHAR(255),
     rules JSONB NOT NULL,
     enabled BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Action logs table
   CREATE TABLE action_logs (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     policy_id UUID REFERENCES policies(id),
     action JSONB NOT NULL,
     decision VARCHAR(20), -- 'allowed' or 'blocked'
     reason TEXT,
     timestamp TIMESTAMP DEFAULT NOW()
   );

   -- Usage metrics (for billing)
   CREATE TABLE usage_metrics (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     date DATE,
     checks_count INTEGER DEFAULT 0,
     blocked_count INTEGER DEFAULT 0
   );
   ```

3. **Policy Evaluation Engine:**
   ```typescript
   interface Policy {
     type: 'spending_limit' | 'rate_limit' | 'pattern_match' | 'custom';
     config: {
       // For spending_limit
       max_amount?: number;
       window?: '1h' | '24h' | '7d' | '30d';

       // For rate_limit
       max_requests?: number;
       per?: '1m' | '1h' | '24h';

       // For pattern_match
       pattern?: string; // regex
       field?: string; // which field to check

       // For custom
       webhook_url?: string; // Call external API for decision
     };
   }

   async function evaluatePolicy(
     action: Action,
     policy: Policy
   ): Promise<{allowed: boolean, reason?: string}> {
     // Implementation
   }
   ```

**Success Criteria:**
- API responds in <200ms average
- Handles 1000 req/sec (load test)
- 99.9% uptime

---

### Week 2: CLI Interceptor (HTTP Proxy)

**Tech Stack:**
- **Language:** Rust (for performance + single binary distribution)
- **Libraries:**
  - `hyper` or `reqwest` for HTTP proxy
  - `tokio` for async runtime
  - `clap` for CLI interface
  - `serde` for JSON handling

**Deliverables:**

1. **HTTP/HTTPS Proxy:**
   ```rust
   // Intercepts all HTTP requests
   async fn handle_request(
       req: Request<Body>,
       client: Client<HttpsConnector>,
       bastion_api: String,
   ) -> Result<Response<Body>, Error> {
       // 1. Extract request details
       let method = req.method().clone();
       let uri = req.uri().clone();
       let body = hyper::body::to_bytes(req.into_body()).await?;

       // 2. Check with Bastion API
       let decision = check_policy(&bastion_api, &method, &uri, &body).await?;

       // 3. If blocked, return error
       if !decision.allowed {
           return Ok(Response::builder()
               .status(403)
               .body(Body::from(decision.reason))
               .unwrap());
       }

       // 4. If allowed, forward to real API
       forward_request(client, method, uri, body).await
   }
   ```

2. **CLI Commands:**
   ```bash
   # Install (one-time)
   curl -sSL https://bastion.sh/install | sh

   # Login
   bastion login

   # Initialize in agent directory
   bastion init

   # Start agent with protection
   bastion start python agent.py
   bastion start node index.js
   bastion start ./my-agent-binary

   # Monitor running agents
   bastion status

   # View real-time logs
   bastion logs --follow

   # Stop protection
   bastion stop
   ```

3. **Agent Launcher:**
   ```rust
   // Start agent with environment variables
   fn launch_agent(command: &str, args: Vec<&str>) -> Result<Child, Error> {
       Command::new(command)
           .args(args)
           .env("HTTP_PROXY", "http://localhost:8080")
           .env("HTTPS_PROXY", "http://localhost:8080")
           .env("BASTION_ENABLED", "true")
           .spawn()
   }
   ```

**Success Criteria:**
- CLI binary <20MB (portable)
- Proxy adds <10ms latency per request
- Works on macOS, Linux, Windows
- Intercepts 80%+ of HTTP API calls

---

### Week 3: Runtime Injection (Python)

**Deliverables:**

1. **Python Hook Injector:**
   ```python
   # bastion_injector.py (bundled with CLI)
   import sys
   import builtins
   import os
   import subprocess
   import requests

   BASTION_API = os.getenv('BASTION_API_URL', 'https://api.bastion.sh')
   API_KEY = os.getenv('BASTION_API_KEY')

   def check_policy(action_type, details):
       """Check with Bastion backend before allowing action."""
       resp = requests.post(f'{BASTION_API}/v1/authorize', json={
           'api_key': API_KEY,
           'action': {'type': action_type, 'details': details}
       }, timeout=2)
       return resp.json()

   # Wrap file operations
   _original_open = builtins.open
   def bastion_open(file, mode='r', *args, **kwargs):
       if any(m in mode for m in ['w', 'a', 'x']):
           decision = check_policy('file_write', {'path': str(file), 'mode': mode})
           if not decision['allowed']:
               raise PermissionError(f"Bastion blocked: {decision['reason']}")
       return _original_open(file, mode, *args, **kwargs)
   builtins.open = bastion_open

   # Wrap os.remove
   _original_remove = os.remove
   def bastion_remove(path):
       decision = check_policy('file_delete', {'path': path})
       if not decision['allowed']:
           raise PermissionError(f"Bastion blocked: {decision['reason']}")
       return _original_remove(path)
   os.remove = bastion_remove

   # Wrap subprocess
   _original_run = subprocess.run
   def bastion_run(args, *argv, **kwargs):
       decision = check_policy('subprocess', {'command': args})
       if not decision['allowed']:
           raise PermissionError(f"Bastion blocked: {decision['reason']}")
       return _original_run(args, *argv, **kwargs)
   subprocess.run = bastion_run
   ```

2. **CLI Integration:**
   ```bash
   # When user runs: bastion start python agent.py
   # CLI does:
   python -c "import bastion_injector; exec(open('agent.py').read())"
   ```

**Success Criteria:**
- Intercepts file writes, deletes, subprocess calls
- <5ms overhead per operation
- No crashes on edge cases

---

### Week 4: Web Dashboard MVP

**Tech Stack:**
- Next.js 14 (App Router)
- TailwindCSS
- Recharts (analytics)
- Stripe (billing)

**Deliverables:**

1. **Pages:**
   - `/login` - Authentication
   - `/dashboard` - Overview + live monitoring
   - `/policies` - Visual policy builder
   - `/logs` - Searchable audit trail
   - `/settings` - API keys, billing

2. **Policy Builder UI:**
   ```tsx
   // Visual drag-and-drop or form-based
   <PolicyBuilder>
     <PolicyType select="spending_limit" />
     <Input label="Max Amount" value="$500" />
     <Select label="Time Window" value="24h" />
     <Button>Save Policy</Button>
   </PolicyBuilder>
   ```

3. **Live Monitoring:**
   ```tsx
   // Real-time feed of agent actions
   <LiveFeed>
     <ActionItem
       time="10:30:15"
       action="stripe_charge"
       amount="$45.00"
       status="approved"
     />
     <ActionItem
       time="10:30:22"
       action="file_delete"
       path="database.db"
       status="blocked"
       reason="Critical file protection"
     />
   </LiveFeed>
   ```

**Success Criteria:**
- Responsive design (mobile-friendly)
- Real-time updates (<2s latency)
- Policy creation in <60 seconds

---

## Phase 2: Launch & Validation (Week 5-8)

### Week 5: Integration Testing

**Deliverables:**
1. End-to-end tests with real agents:
   - LangChain agent making API calls
   - Trading bot with Stripe integration
   - File manipulation agent

2. Documentation:
   - Quickstart guide
   - API reference
   - Policy examples library

3. Beta program:
   - 10 pilot users
   - Collect feedback
   - Fix critical bugs

---

### Week 6-7: Framework Integrations

**Deliverables:**

1. **LangChain Plugin:**
   ```python
   from bastion import wrap_tools
   from langchain.agents import initialize_agent

   tools = wrap_tools([
       StripeChargeTool(),
       SendEmailTool(),
       SQLQueryTool()
   ])

   agent = initialize_agent(tools, llm)
   ```

2. **AutoGPT Plugin:**
   ```python
   # Auto-detect and wrap tools
   bastion.auto_protect_agent()
   ```

3. **CrewAI Integration:**
   ```python
   from bastion import BastionAgent

   agent = BastionAgent(
       role="Finance Manager",
       tools=[stripe_tool, quickbooks_tool]
   )
   ```

---

### Week 8: Marketing Launch

**Activities:**
1. **Content:**
   - Blog post: "Protecting AI Agents Without Blockchain"
   - Demo video: "Zero to Protected in 60 Seconds"
   - Case study: Trading bot saves $10k from bug

2. **Distribution:**
   - ProductHunt launch
   - Hacker News post
   - AI/ML subreddit posts
   - Direct outreach to 100 companies using AI agents

3. **Landing Page:**
   - Hero: "Protect Any AI Agent in 60 Seconds"
   - Demo: Interactive CLI walkthrough
   - Pricing table
   - Testimonials from beta users

**Target:**
- 1,000 website visitors
- 50 signups
- 10 paying customers ($1k MRR)

---

## Revenue Model

### Pricing Tiers

```
┌──────────────────────────────────────────────────────────┐
│  Starter - $29/month                                     │
├──────────────────────────────────────────────────────────┤
│  • 1 agent                                               │
│  • 10,000 policy checks/month                            │
│  • Basic policies (spend limits, rate limits)            │
│  • 7-day log retention                                   │
│  • Email support                                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Growth - $149/month                                     │
├──────────────────────────────────────────────────────────┤
│  • 5 agents                                              │
│  • 100,000 policy checks/month                           │
│  • Advanced policies (regex, DLP, custom webhooks)       │
│  • 30-day log retention                                  │
│  • Slack/Discord/Email alerts                            │
│  • Priority support                                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Pro - $499/month                                        │
├──────────────────────────────────────────────────────────┤
│  • Unlimited agents                                      │
│  • Unlimited checks                                      │
│  • All policy types + custom logic                       │
│  • 1-year log retention                                  │
│  • Real-time monitoring dashboard                        │
│  • API access for custom integrations                    │
│  • SSO (SAML/OAuth)                                      │
│  • SLA guarantee (99.9% uptime)                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Enterprise - Custom ($2k-10k/month)                     │
├──────────────────────────────────────────────────────────┤
│  • Everything in Pro                                     │
│  • Dedicated deployment (VPC/on-premise)                 │
│  • Custom SLA (99.99%)                                   │
│  • White-label option                                    │
│  • Compliance reporting (SOC2, HIPAA, etc)               │
│  • Dedicated account manager                             │
│  • Optional: Blockchain attestation add-on               │
└──────────────────────────────────────────────────────────┘
```

### Revenue Projections

**Month 1-3 (MVP + Launch):**
- 20 customers @ $100 avg = $2k MRR
- Costs: $500/month (hosting + tools)
- Net: $1.5k/month

**Month 4-6 (Growth):**
- 50 customers @ $120 avg = $6k MRR
- Costs: $800/month
- Net: $5.2k/month

**Month 7-12 (Scale):**
- 150 customers @ $150 avg = $22.5k MRR = $270k ARR
- Costs: $2k/month
- Net: $20.5k/month
- **Profitable without fundraising ✓**

---

## Phase 3: Premium Features (Month 6-12)

### Optional Add-Ons (Revenue Expansion)

**1. ZK Privacy Mode ($299/month add-on)**
- Agent generates ZK proofs of policy compliance
- Backend verifies without seeing strategy
- Target: Hedge funds, competitive traders

**2. Blockchain Attestation ($199/month add-on)**
- Weekly batch of policy decisions to Avalanche C-Chain
- Immutable audit trail
- Target: Financial institutions, regulated industries

**3. Custom Subnet Deployment ($5k/month)**
- Dedicated Avalanche subnet for enterprise
- Full decentralization option
- Target: Large enterprises, DAOs

---

## What We're NOT Building (Yet)

### Deferred to Post-PMF

❌ **Custom Avalanche Subnet** (Cost: $60-180k/year)
- Defer until $50k+ MRR
- Use C-Chain for blockchain features if needed

❌ **Gas Sponsorship Paymaster** (Cost: $20-50k working capital)
- Users pay their own fees initially
- Add as premium feature when revenue allows

❌ **$BASTION Token** (Complexity: High)
- Pure SaaS model initially
- Consider token only if needed for fundraising

❌ **Smart Contract Enforcement** (Time: 8-12 weeks)
- Backend enforcement sufficient for 90% of market
- Add for crypto-native segment later

❌ **ZK Proof Generation** (Complexity: Medium)
- Start with standard policy checks
- Add ZK as premium tier in Month 6+

---

## Technical Decisions Needed

### Decision 1: Backend Language
**Options:**
- **Node.js/TypeScript:** Faster to build, larger ecosystem
- **Rust:** Better performance, single binary, type-safe

**Recommendation:** Node.js for speed to market (can rewrite performance-critical parts in Rust later)

### Decision 2: Database
**Options:**
- **PostgreSQL:** Battle-tested, full-featured
- **SQLite:** Simple, file-based (for MVP only)

**Recommendation:** PostgreSQL (Railway has free tier)

### Decision 3: CLI Distribution
**Options:**
- **npm package:** `npm install -g @bastion/cli`
- **Standalone binary:** Download .exe/.app
- **Curl script:** `curl -sSL bastion.sh/install | sh`

**Recommendation:** All three (npm for devs, binary for non-devs, curl for servers)

### Decision 4: Hosting
**Options:**
- **Railway:** $5/month, easy deploy, Postgres included
- **Fly.io:** $0-10/month, global edge deployment
- **Render:** $7/month, simple UI

**Recommendation:** Railway (best DX for MVP)

---

## Risk Mitigation

### Technical Risks

**Risk 1: CLI Can Be Bypassed**
- **Mitigation:** Market as "protection against bugs/accidents" not "unhackable"
- **Later:** Add SDK mode with stronger guarantees for paranoid customers

**Risk 2: Performance Overhead**
- **Mitigation:** Load test early, optimize hot paths
- **Target:** <10ms overhead per operation

**Risk 3: Cross-Platform Compatibility**
- **Mitigation:** Test on macOS/Linux/Windows from day 1
- **Fallback:** Web-based monitoring if CLI doesn't work

### Business Risks

**Risk 1: Low Adoption (High Friction)**
- **Mitigation:** Make onboarding <60 seconds
- **Metric:** Track time-to-first-policy

**Risk 2: Pricing Too Low**
- **Mitigation:** Start higher ($29 vs $9), easier to discount
- **Strategy:** Offer annual discount (2 months free)

**Risk 3: Enterprise Sales Cycle Too Long**
- **Mitigation:** Focus on SMB/developers initially
- **Pivot:** Add self-serve enterprise tier ($499/mo)

---

## Success Metrics

### Week 4 (MVP Complete)
- [ ] Backend API deployed and responding <200ms
- [ ] CLI intercepts HTTP requests successfully
- [ ] Dashboard displays live agent activity
- [ ] End-to-end test passes (agent → CLI → backend → decision)

### Week 8 (Launch)
- [ ] 50 signups
- [ ] 10 paying customers
- [ ] $1k MRR
- [ ] 1 case study/testimonial

### Month 6 (Validation)
- [ ] 50 paying customers
- [ ] $6k MRR
- [ ] <5% monthly churn
- [ ] 1 enterprise customer ($500+/month)

### Month 12 (Scale Decision Point)
- [ ] $20k+ MRR ($240k ARR)
- [ ] Profitable (>80% gross margin)
- [ ] Decision: Bootstrap to $1M ARR or raise Series A

---

## Next Immediate Actions

### This Week
1. **Decide:** Node.js or Rust for backend?
2. **Setup:** Repository structure
3. **Design:** Database schema (finalize)
4. **Prototype:** Basic HTTP proxy in CLI
5. **Deploy:** Railway project + Postgres

### Next Week
1. **Build:** Core policy evaluation engine
2. **Build:** CLI HTTP interceptor
3. **Test:** End-to-end flow
4. **Document:** API specification

---

## Future Enhancements (Post-Bootstrap)

### When Revenue Allows

**Add ZK Privacy Mode:**
- Integrate arkworks/bellman for proof generation
- Market to hedge funds as "strategy protection"
- Premium pricing: $299-999/month

**Add Blockchain Attestation:**
- Deploy simple logger contract to Avalanche C-Chain
- Batch policy decisions weekly
- Marketing: "Blockchain-verified audit trail"

**Add Custom Subnet:**
- For enterprises needing full decentralization
- Custom pricing: $5k-20k/month
- Reuse existing `/subnet` and `/contracts` code

**Add MPC Key Management:**
- For customers who want non-custodial but strong enforcement
- Partner with Fireblocks/Turnkey
- Premium feature: $500+/month

---

## Appendix: Key Differentiators

### vs Traditional Security Tools
- **Them:** Monitor and alert after the fact
- **Us:** Block dangerous actions before execution

### vs Blockchain-Only Solutions
- **Them:** 3-15 second latency, $0.10+ per check, complex setup
- **Us:** 50-200ms latency, $0.0001 per check, 60-second setup

### vs Code-Based Solutions (SDK-only)
- **Them:** Requires code changes, developer time, redeployment
- **Us:** Zero code changes, install CLI, works immediately

---

**Status:** Ready for implementation
**Timeline:** 4 weeks to MVP, 8 weeks to paying customers
**Capital Required:** $2-5k (hosting, tools, marketing)
**Expected Outcome:** $20k+ MRR by Month 12 without fundraising
