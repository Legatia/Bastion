
# Placeholder for CrewAI Agent Class
# Assumes 'crewai' package structure

import requests

class AegisAgent:
    """
    Wrapper/Mixin for CrewAI Agent to enforce Aegis Policy.
    """
    def __init__(self, agent_instance, sidecar_url="http://localhost:3000"):
        self.agent = agent_instance
        self.sidecar_url = sidecar_url

    def execute_task(self, task):
        """
        Intercepts task execution.
        """
        print(f"[Aegis] Validating Task: {task.description}")
        
        payload = {
            "to": "task_execution",
            "value": "0",
            "data": task.description
        }

        try:
            response = requests.post(f"{self.sidecar_url}/sign", json=payload)
            if response.status_code == 200 and response.json().get("status") == "signed":
                print("[Aegis] Task Approved.")
                # Proceed with original agent execution
                return self.agent.execute_task(task)
            else:
                return "Task Blocked by Aegis Policy."
        except Exception as e:
            return f"Aegis Error: {e}"
