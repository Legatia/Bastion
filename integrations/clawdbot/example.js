const AegisPlugin = require('./index');

async function run() {
    const aegis = new AegisPlugin({ sidecarUrl: 'http://localhost:3001' }); // Using 3001 as verified in previous steps

    const toolName = "send_crypto";
    const args = { amount: 100, currency: "USDC", to: "0xBadActor" };

    try {
        console.log("Attempting to run tool...");
        await aegis.onToolCall(toolName, args);
        console.log("Tool execution started!");
    } catch (err) {
        console.error("Tool execution aborted.");
    }
}

run();
