const BastionPlugin = require('./index');

async function run() {
    const bastion = new BastionPlugin({ sidecarUrl: 'http://localhost:3000' });

    const toolName = "send_crypto";
    const args = { amount: 100, currency: "USDC", to: "0xBadActor" };

    try {
        console.log("Attempting to run tool...");
        await bastion.onToolCall(toolName, args);
        console.log("Tool execution started!");
    } catch (err) {
        console.error("Tool execution aborted.");
    }
}

run();
