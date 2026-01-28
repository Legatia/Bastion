# Aegis Protocol: Technical Integration Design (Top 3 Agents)

## 1. Clawdbot (Priority #1 - Dogfooding)
**Architecture:** Plugin System (Node.js/TypeScript)
*   **Touchpoint:** The `tools` execution layer. Clawdbot executes tools like `exec`, `write`, `browser`.
*   **Integration:**
    1.  Create `clawdbot-plugin-aegis`.
    2.  Hook: Intercept `tool_call` events.
    3.  Logic:
        ```typescript
        on('tool_call', async (tool, args) => {
            const intent = { tool: tool.name, params: args };
            const approval = await aegisSidecar.verify(intent);
            if (!approval.ok) throw new Error("Aegis Blocked: " + approval.reason);
            return next(); // Proceed to actual tool
        });
        ```
*   **User Config:** `clawdbot config set plugins.aegis.apiKey "sk_..."`

## 2. LangGraph (The Enterprise Standard)
**Architecture:** Graph Nodes (Python)
*   **Touchpoint:** The State Graph transitions.
*   **Integration:**
    1.  Create `AegisNode` class.
    2.  Usage: Developers insert this node *before* any "Action" node.
    3.  Logic:
        ```python
        def aegis_guardrail(state: AgentState):
            last_message = state['messages'][-1]
            if last_message.tool_calls:
                # Send to Aegis Sidecar
                verdict = aegis.check(last_message.tool_calls)
                if not verdict.allowed:
                    return Command(update={"error": "Blocked"}, goto=END)
            return state
        ```
*   **Value:** "Conditional Edge" security. The graph physically cannot traverse to the `Tools` node if Aegis rejects the state.

## 3. CrewAI (The Multi-Agent Leader)
**Architecture:** Task Delegation (Python)
*   **Touchpoint:** The `Agent` class execution loop.
*   **Integration:**
    1.  Create custom `AegisAgent` class (inherits from `Agent`).
    2.  Override `execute_task()`.
    3.  Logic:
        ```python
        class SafeAgent(Agent):
            def execute_task(self, task):
                # Pre-check: Is this task allowed by policy?
                if not aegis.validate_task(task.description):
                    return "Task rejected by Safety Policy."
                return super().execute_task(task)
        ```
*   **Value:** Prevents "Agent A" from assigning a malicious/expensive task to "Agent B."

---

**Summary:**
*   **Clawdbot:** Tool Interception.
*   **LangGraph:** Graph Node Guardrail.
*   **CrewAI:** Agent Class Inheritance.

This covers the "Big 3" patterns: **Plugin**, **Graph**, and **OOP Inheritance**.
