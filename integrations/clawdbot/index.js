const axios = require('axios');

/**
 * Bastion Protocol Plugin for Clawdbot
 * Intercepts tool calls and verifies them against the local Bastion Sidecar.
 */
class BastionPlugin {
    constructor(config = {}) {
        this.sidecarUrl = config.sidecarUrl || 'http://localhost:3000';
    }

    /**
     * Hook to be called before tool execution.
     * @param {string} toolName - Name of the tool being called.
     * @param {object} args - Arguments passed to the tool.
     * @returns {Promise<void>} - Resolves if allowed, throws if blocked.
     */
    async onToolCall(toolName, args) {
        try {
            console.log(`[Bastion] Verifying tool call: ${toolName}`);

            // 1. Construct the intent payload
            const payload = {
                to: toolName, // Mapping tool name to 'to' field for MVP
                value: "0",
                data: JSON.stringify(args)
            };

            // 2. Ask Sidecar to sign/verify
            // In a real implementation, the Sidecar would check the policy before signing.
            // If the policy fails, the Sidecar refuses to sign.
            const response = await axios.post(`${this.sidecarUrl}/sign`, payload);

            if (response.data && response.data.status === 'signed') {
                console.log(`[Bastion] Tool call APPROVED. Signature: ${response.data.signature}`);
                return; // Allowed
            } else {
                throw new Error('Sidecar refused to sign transaction.');
            }

        } catch (error) {
            console.error(`[Bastion] BLOCKED: ${error.message}`);
            throw new Error(`Bastion Policy Violation: ${error.message}`);
        }
    }
}

module.exports = BastionPlugin;
