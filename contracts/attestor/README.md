# Bastion Attestor Contract

Minimal event-only attestation contract for Bastion policy changes and critical decision receipts.

## Prerequisites

- Foundry installed (`forge --version`)
- A deployer private key funded on Avalanche Fuji

## Build

```bash
cd contracts/attestor
forge build
```

## Deploy to Avalanche Fuji

```bash
export FUJI_RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
export DEPLOYER_PRIVATE_KEY="0x<deployer_private_key>"

forge create src/BastionAttestor.sol:BastionAttestor \
  --rpc-url $FUJI_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --chain-id 43113
```

After deployment, copy the deployed contract address into backend env:

```bash
ATTESTATION_CONTRACT_ADDRESS=0x...
ATTESTATION_NETWORK=avalanche-fuji
ATTESTATION_WALLET_NAME=bastion-attestor
```

Then restart the backend.
