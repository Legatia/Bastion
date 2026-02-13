# On-Chain Identity (ERC-8004)

Bastion provides agents with a verifiable, cryptographic identity on the Base blockchain using the **ERC-8004** standard. This allows agents to be "registered" such that other services and agents can verify their authenticity and history.

## CLI Commands

### `bastion register`
Register the current agent on-chain. This performs the following:
1.  Creates a cryptographic commitment of the agent's ID and owner.
2.  Submits the registration to the ERC-8004 registry on Base.
3.  Links the on-chain identity to your Bastion account.

**Usage:**
```bash
bastion register --chain base-mainnet
```

### `bastion verify`
Verify the identity status of an agent.
- Checks if the agent is registered on-chain.
- Validates the owner's signature.
- Confirms the identity hasn't been revoked.

**Usage:**
```bash
bastion verify --agent-id <ID>
```

## Why Identity Matters?

In an autonomous agent economy, trust is the primary bottleneck.
- **Agent-to-Agent Commerce**: Use on-chain identity to authorize payments or share sensitive data.
- **Compliance**: Prove exactly which agent performed an action for audit purposes.
- **Reputation**: Build a history of "Good Behavior" that other agents can trust.
