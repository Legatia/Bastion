# MASTER DEVELOPMENT PROMPT: Aegis Protocol MVP

**Role:** You are a Senior Blockchain Architect specializing in **Avalanche Subnets** and **Account Abstraction (ERC-4337)**.

**Objective:**
Scaffold the complete repository for **Aegis Protocol**, a decentralized "Risk Management & Insurance Layer" for AI Agents.

**Context:**
Aegis is a hackathon project. We need a working MVP that demonstrates:
1.  **The Smart Account:** A wallet that *cannot* execute transactions unless approved by the Aegis Policy Engine.
2.  **The Policy Engine:** A smart contract that enforces rules (e.g., "Max Spend = 1 USDC").
3.  **The Paymaster:** A mechanism to allow "Gasless" transactions (simulating the SaaS subscription model).

## 1. Directory Structure
Initialize a monorepo with the following structure:
*   `/contracts`: Foundry project for Solidity smart contracts.
*   `/subnet`: Avalanche Subnet configuration (genesis.json).
*   `/cli`: Rust CLI (`aegis-cli`) for the "Sidecar" (Client).
*   `/dashboard`: Next.js web app for setting policies.
*   `/integrations`: Adapters for major frameworks.
    *   `/clawdbot`: Node.js plugin (`clawdbot-plugin-aegis`).
    *   `/langgraph`: Python node (`AegisNode`).
    *   `/crewai`: Python class override (`AegisAgent`).

## 2. Smart Contract Specs (Solidity)
Create the following contracts in `/contracts`:

*   **`AegisAccount.sol`**:
    *   Inherit from standard ERC-4337 `SimpleAccount`.
    *   **CRITICAL MODIFICATION:** Override the `validateUserOp` function. It MUST require **two** signatures:
        1.  `userSignature` (The Agent).
        2.  `aegisSignature` (The Policy Validator).
    *   If `aegisSignature` is missing or invalid, the transaction MUST revert.

*   **`PolicyRegistry.sol`**:
    *   A mapping of `UserAddress -> PolicyHash`.
    *   Function `setPolicy(bytes32 policyHash)`: Allows a user to update their security rules.

*   **`SaaSPaymaster.sol`**:
    *   An ERC-4337 Paymaster.
    *   Logic: "If the user has `creditBalance > 0` in our off-chain database (simulated via an Oracle or whitelist), pay the gas for them."

## 3. The "Sidecar" SDK (Rust)
Develop the CLI tool in **Rust** for maximum performance and cross-platform compatibility (Windows/Linux/macOS).

*   **Crate Name:** `aegis-cli`
*   **Functionality:**
    *   Expose a local HTTP/RPC server (e.g., `localhost:3000`).
    *   Intercept Agent requests.
    *   `sign_intent(payload)`: Sign the UserOp with the Agent's local key.
    *   `submit_to_bundler(user_op)`: Forward the signed op to the Aegis Subnet Bundler.
*   **Why Rust?** To produce a single, dependency-free binary (`aegis.exe`) that is easy to deploy on enterprise servers.

## 4. The UI/UX Stack

### A. The "Sidecar" (CLI Tool)
*   **Target:** The server where the Agent runs (Linux/Windows).
*   **Tech:** **Rust** (Clap for CLI, Tokio for Async).
*   **Interface:** CLI Only.
    *   `aegis init`: Wraps the local agent.
    *   `aegis monitor`: Shows real-time heartbeat connection to the Validator.
*   **Function:** Silent background process. Intercepts outgoing requests and forwards them to the Validator.

### B. The "Command Center" (Web Dashboard)
*   **Target:** The Human Manager.
*   **Tech:** Next.js + Tailwind CSS (Dark Mode / Cyberpunk aesthetic).
*   **Key Screens:**
    1.  **Global Map:** Visualization of all active agents and their status (Active/Blocked).
    2.  **Policy Builder:** A "Zapier-style" drag-and-drop editor to create rules without coding Solidity.
    3.  **Forensic Log:** A searchable table of all "Blocked Transactions" with links to the on-chain proofs.
    4.  **Billing:** Simple view of "Aegis Credits" remaining (SaaS Model).

## 5. Development Constraints
*   **Framework:** Use **Foundry** (forge) for contracts.
*   **Network:** Local Anvil testnet configured to mimic an Avalanche Subnet.
*   **Security:** Add comments explaining where the "ZK Proof Verification" hook will go in V2.

**Action:**
Generate the file structure and the code for `AegisAccount.sol` and `SaaSPaymaster.sol` first.
