# Bastion Protocol: Project Summary

## 🛡️ Mission
Bastion Protocol is an "Insurance Layer" for the Agent Economy, providing **Immutable Supervision** for Autonomous Agents. It acts as a programmable firewall that mathematically guarantees agents cannot perform unauthorized actions.

## 🏗️ Architecture Completed

### 1. The Controller (Rust Sidecar)
*   **Location**: `/cli`
*   **Status**: ✅ Functional (Real Signing)
*   **Role**: Runs locally with the agent. Intercepts intentions, checks policies, and signs operations.
*   **Key Tech**: `ethers-rs`, `axum`, `dialoguer` (Onboarding Wizard).

### 2. The Supervisor (Smart Contracts)
*   **Location**: `/contracts`
*   **Status**: ✅ Deployed (Local)
*   **Role**: The on-chain authority. Validates signatures and enforces policy hashes.
*   **Key Tech**: Solidity, Foundry.

### 3. The Monitor (Visual Dashboard)
*   **Location**: `/dashboard`
*   **Status**: ✅ Complete (UI + Mock Data)
*   **Role**: Human interface for configuring policies and forensic analysis.
*   **Privacy Features**:
    *   **DLP**: Blocks PII (SSN, Keys).
    *   **Encryption**: Decrypts logs locally (Private Execution).
*   **Key Tech**: Next.js 14, Cyberpunk Theme, Interactive Parallax.

### 4. The Privacy Core (ZK Precompile)
*   **Location**: `/subnet-evm-precompile`
*   **Status**: ✅ MVP Implemented
*   **Role**: Native Avalanche extension to verify ZK Proofs at high speed.
*   **Key Tech**: Go, Groth16.

## 🚀 How to Run

### 1. Start the Sidecar
```bash
cd cli
cargo run -- init  # Run the interactive wizard
cargo run -- start --port 3001
```

### 2. Launch the Dashboard
```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

### 3. Verify Privacy Core
```bash
cd subnet-evm-precompile
go run cmd/tester/main.go
```

## 🔮 Next Steps (Roadmap)
1.  **Integration**: Connect the [policies.tsx](file:///Users/tobiasd/Desktop/Watcher/Bastion/dashboard/pages/policies.tsx) Deploy button to the real `bastion-cli` via API.
2.  **ZK Prover**: Integrate a Rust-based Prover (e.g., Arkworks) into the CLI to replace the mock proof generation.
3.  **Mainnet**: Deploy the Stateful Precompile to a live Avalanche Subnet.

## 💼 Business Model (SaaS)
Bastion Protocol operates as a **B2B Infrastructure Provider**, offering an "Insurance Layer" for AI Agents.

### 1. Subscription Revenue (SaaS)
*   **Starter ($15/mo)**: 1 Agent, Basic Policy, 7-Day Logs. Ideal for Solopreneurs.
*   **Growth ($99/mo)**: 5 Agents, Advanced Logic, 30-Day Logs, Slack Alerts. Target: Small Teams.
*   **Pro ($299/mo)**: Unlimited Agents, Compliance Reporting, API Access. Target: Scale-ups.
*   **Enterprise (Custom)**: Dedicated Subnet, SLA, Audit Logs.

### 2. Transaction Fees (SaaS Paymaster)
*   Bastion abstracts gas fees for agents.
*   Customers pay monthly in Fiat/USD.
*   Bastion manages the on-chain gas (AVAX) and charges a service markup.

**Note**: Bastion is a **Tokenless Protocol**. There is no governance token; the focus is purely on providing enterprise-grade security infrastructure.
