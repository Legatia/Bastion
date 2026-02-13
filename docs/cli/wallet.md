# Agent Wallet Management

Bastion integrates with the **Coinbase Developer Platform (CDP)** to provide agents with secure, managed wallets. This enables agents to perform on-chain transactions (swaps, transfers, staking) under the protection of Bastion policies.

## CLI Commands

### `bastion wallet`
Display the current wallet associated with the agent.

**Usage:**
```bash
bastion wallet
```

**Output:**
```
💳 Agent Wallet (Base)
Address: 0x123...abc
Balance: 0.05 ETH
Status: ✅ Active
```

## Security

Wallets are managed natively via CDP. The agent only has access to the wallet's public address and can only initiate transactions that pass your **Spending Limit** and **Address Allow-list** policies in Bastion.

- **Private Keys**: Never exposed to the agent or the CLI.
- **Policy Enforcement**: Every transaction is intercepted by the Bastion proxy for approval.
- **Spending Caps**: Set daily or per-transaction limits in the Bastion Dashboard.
