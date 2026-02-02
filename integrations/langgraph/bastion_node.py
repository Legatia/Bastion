
class BastionNode:
    """
    Bastion Protocol Node for LangGraph.
    Intercepts state transitions and validates tool calls against the Sidecar.
    """
    def __init__(self, sidecar_url="http://localhost:3000"):
        self.sidecar_url = sidecar_url

    def guardrail(self, state):
        """
        Inject this function node before any Tool execution node.
        """
        import requests
        
        last_message = state.get("messages", [])[-1]
        
        # Check if the last message has tool calls
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                payload = {
                    "to": tool_call.get("name", "unknown_tool"),
                    "value": "0",
                    "data": str(tool_call.get("args", {}))
                }
                
                try:
                    response = requests.post(f"{self.sidecar_url}/sign", json=payload)
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("status") != "signed":
                         raise ValueError("Sidecar refused to sign.")
                         
                except Exception as e:
                    # Block execution by returning an error state or raising exception
                    print(f"Bastion Blocked: {e}")
                    return {"messages": [("system", f"Security Policy Violation: {e}")]}
        
        return state
