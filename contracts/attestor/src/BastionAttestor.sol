// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title BastionAttestor
/// @notice Emits immutable policy and decision attestation events for off-chain indexing.
contract BastionAttestor {
    event PolicyAttested(
        bytes32 digest,
        string userId,
        string policyId,
        string eventType,
        address indexed sender
    );

    event DecisionAttested(
        bytes32 digest,
        string userId,
        string agentId,
        string actionType,
        string decision,
        string logId,
        address indexed sender
    );

    function attestPolicy(
        bytes32 digest,
        string calldata userId,
        string calldata policyId,
        string calldata eventType
    ) external {
        emit PolicyAttested(digest, userId, policyId, eventType, msg.sender);
    }

    function attestDecision(
        bytes32 digest,
        string calldata userId,
        string calldata agentId,
        string calldata actionType,
        string calldata decision,
        string calldata logId
    ) external {
        emit DecisionAttested(digest, userId, agentId, actionType, decision, logId, msg.sender);
    }
}
