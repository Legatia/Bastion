"""
Bastion ERC-8004 Agent Verification Helper

Use this module to verify that another agent has an on-chain identity
before trusting or paying them.

Usage:
    from bastion.erc8004 import verify_agent, get_agent_identity

    # Check if an agent is verified
    if verify_agent("https://bastion-gamma.vercel.app/v1/agents/abc123/profile.json"):
        print("Agent is verified!")

    # Get full identity details
    identity = get_agent_identity("https://bastion-gamma.vercel.app/v1/agents/abc123/profile.json")
    if identity:
        print(f"On-chain ID: {identity['onchain_id']}")
        print(f"Owner: {identity['owner_address']}")
"""

import requests
from typing import Optional, TypedDict
from web3 import Web3

# ERC-8004 Identity Registry addresses
REGISTRIES = {
    "base-sepolia": {
        "address": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        "rpc_url": "https://sepolia.base.org",
        "chain_id": 84532,
    },
    "base": {
        "address": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        "rpc_url": "https://mainnet.base.org",
        "chain_id": 8453,
    },
}

# Minimal ABI for ERC-8004 Identity Registry
IDENTITY_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
]


class AgentReputation(TypedDict, total=False):
    protected: bool
    healthScore: Optional[int]           # 0-100, None if MoltMind not active
    identityCoherence: Optional[int]     # 0-100
    behavioralStability: Optional[int]   # 0-100
    interactionHealth: Optional[int]     # 0-100
    policyLevel: str                     # 'strict' | 'standard' | 'permissive' | 'none'
    activePolicies: list[str]            # e.g. ['DLP', 'RATE_LIMIT']
    uptimeDays: int
    lastChecked: str                     # ISO timestamp


class AgentIdentity(TypedDict):
    onchain_id: int
    registry_chain: str
    registry_address: str
    owner_address: str
    agent_uri: str
    reputation: Optional[AgentReputation]


def fetch_registration_file(agent_uri: str, timeout: int = 10) -> Optional[dict]:
    """Fetch the ERC-8004 registration file from an agent URI."""
    try:
        response = requests.get(agent_uri, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[Bastion] Failed to fetch registration file: {e}")
        return None


def parse_agent_registry(agent_registry: str) -> tuple[str, int, str]:
    """
    Parse an ERC-8004 agent registry string.
    Format: {namespace}:{chainId}:{registryAddress}
    Example: eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
    """
    parts = agent_registry.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid agent registry format: {agent_registry}")
    
    namespace = parts[0]
    chain_id = int(parts[1])
    registry_address = parts[2]
    
    return namespace, chain_id, registry_address


def verify_onchain(
    agent_id: int,
    registry_address: str,
    chain_id: int,
    expected_uri: Optional[str] = None,
) -> Optional[str]:
    """
    Verify an agent exists on-chain and return the owner address.
    Returns None if agent is not registered or verification fails.
    """
    # Find the right RPC URL
    rpc_url = None
    for chain_name, config in REGISTRIES.items():
        if config["chain_id"] == chain_id:
            rpc_url = config["rpc_url"]
            break
    
    if not rpc_url:
        print(f"[Bastion] Unknown chain ID: {chain_id}")
        return None
    
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(registry_address),
            abi=IDENTITY_REGISTRY_ABI,
        )
        
        # Check owner (will revert if token doesn't exist)
        owner = contract.functions.ownerOf(agent_id).call()
        
        # Optionally verify the tokenURI matches expected
        if expected_uri:
            on_chain_uri = contract.functions.tokenURI(agent_id).call()
            if on_chain_uri != expected_uri:
                print(f"[Bastion] URI mismatch: expected {expected_uri}, got {on_chain_uri}")
                return None
        
        return owner
    
    except Exception as e:
        print(f"[Bastion] On-chain verification failed: {e}")
        return None


def verify_agent(agent_uri: str) -> bool:
    """
    Verify that an agent has a valid on-chain identity.
    
    Args:
        agent_uri: The URL to the agent's ERC-8004 registration file
    
    Returns:
        True if the agent is verified on-chain, False otherwise
    """
    identity = get_agent_identity(agent_uri)
    return identity is not None


def get_agent_identity(agent_uri: str) -> Optional[AgentIdentity]:
    """
    Get the full on-chain identity details for an agent.
    
    Args:
        agent_uri: The URL to the agent's ERC-8004 registration file
    
    Returns:
        AgentIdentity dict if verified, None if not verified
    """
    # 1. Fetch registration file
    registration = fetch_registration_file(agent_uri)
    if not registration:
        return None
    
    # 2. Check for registrations
    registrations = registration.get("registrations", [])
    if not registrations:
        print("[Bastion] Agent has no on-chain registrations")
        return None

    # 3. Try ALL registrations (not just the first) until one verifies
    agent_id = None
    agent_registry = None
    owner = None
    chain_id = None
    registry_address = None

    for reg in registrations:
        reg_agent_id = reg.get("agentId")
        reg_agent_registry = reg.get("agentRegistry")

        if not reg_agent_id or not reg_agent_registry:
            continue

        try:
            namespace, reg_chain_id, reg_registry_address = parse_agent_registry(reg_agent_registry)
        except ValueError:
            continue

        reg_owner = verify_onchain(reg_agent_id, reg_registry_address, reg_chain_id, agent_uri)
        if reg_owner:
            agent_id = reg_agent_id
            agent_registry = reg_agent_registry
            owner = reg_owner
            chain_id = reg_chain_id
            registry_address = reg_registry_address
            break

    if not owner:
        print("[Bastion] No registration could be verified on-chain")
        return None

    # 4. Determine chain name
    chain_name = "unknown"
    for name, config in REGISTRIES.items():
        if config["chain_id"] == chain_id:
            chain_name = name
            break
    
    # Extract reputation attestation if present
    reputation = registration.get("reputation")

    return AgentIdentity(
        onchain_id=agent_id,
        registry_chain=chain_name,
        registry_address=registry_address,
        owner_address=owner,
        agent_uri=agent_uri,
        reputation=reputation,
    )


# Convenience function for Bastion-hosted agents
def verify_bastion_agent(agent_id: str, base_url: str = "https://bastion-gamma.vercel.app") -> bool:
    """
    Verify a Bastion-hosted agent by ID.
    
    Args:
        agent_id: The Bastion agent ID (UUID)
        base_url: The Bastion backend URL
    
    Returns:
        True if verified, False otherwise
    """
    agent_uri = f"{base_url}/v1/agents/{agent_id}/profile.json"
    return verify_agent(agent_uri)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python verify.py <agent_uri>")
        print("  Example: python verify.py https://bastion-gamma.vercel.app/v1/agents/abc123/profile.json")
        sys.exit(1)
    
    agent_uri = sys.argv[1]
    print(f"Verifying agent: {agent_uri}\n")
    
    identity = get_agent_identity(agent_uri)
    if identity:
        print("Agent is verified on-chain!")
        print(f"   On-chain ID: #{identity['onchain_id']}")
        print(f"   Chain: {identity['registry_chain']}")
        print(f"   Owner: {identity['owner_address']}")

        rep = identity.get("reputation")
        if rep:
            print(f"\n   Reputation:")
            print(f"   Protected:  {rep.get('protected', False)}")
            print(f"   Health:     {rep.get('healthScore', 'N/A')}/100")
            print(f"   Policy:     {rep.get('policyLevel', 'unknown')}")
            print(f"   Policies:   {', '.join(rep.get('activePolicies', []))}")
            print(f"   Uptime:     {rep.get('uptimeDays', 0)} days")
    else:
        print("Agent is NOT verified")
        sys.exit(1)
