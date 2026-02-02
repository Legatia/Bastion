# Your First Protected Agent

Build and protect a simple AI agent from scratch.

## What We'll Build

A Python agent that:
- Calls the OpenAI API
- Fetches data from external APIs
- Is protected by Bastion policies

## Prerequisites

- Python 3.8+
- Bastion CLI installed
- OpenAI API key

## Step 1: Create Agent

Create a new directory and Python script:

```bash
mkdir my-first-agent
cd my-first-agent
```

Create `agent.py`:

```python
import requests
import openai
import time

# Simple AI agent that makes API calls
class SimpleAgent:
    def __init__(self):
        self.openai_key = "sk-..."  # Your key

    def run(self):
        print("🤖 Agent starting...")

        while True:
            # 1. Fetch data from external API
            print("\n📡 Fetching weather data...")
            weather = self.fetch_weather()
            print(f"✅ Weather: {weather}")

            # 2. Call OpenAI API
            print("\n🧠 Calling OpenAI...")
            response = self.ask_openai(
                f"Summarize this weather in one sentence: {weather}"
            )
            print(f"✅ AI says: {response}")

            # 3. Post to webhook
            print("\n📤 Posting to webhook...")
            self.post_webhook(response)
            print("✅ Posted successfully")

            # Wait before next iteration
            time.sleep(10)

    def fetch_weather(self):
        """Fetch weather data from API"""
        response = requests.get(
            "https://api.weatherapi.com/v1/current.json",
            params={
                "key": "your-weather-api-key",
                "q": "San Francisco"
            }
        )
        data = response.json()
        return {
            "temp": data["current"]["temp_f"],
            "condition": data["current"]["condition"]["text"]
        }

    def ask_openai(self, prompt):
        """Call OpenAI API"""
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.openai_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )
        return response.json()["choices"][0]["message"]["content"]

    def post_webhook(self, data):
        """Post results to webhook"""
        requests.post(
            "https://webhook.site/your-unique-url",
            json={"message": data}
        )

if __name__ == "__main__":
    agent = SimpleAgent()
    agent.run()
```

Install dependencies:

```bash
pip install requests openai
```

## Step 2: Test Agent (Unprotected)

Run the agent normally:

```bash
python agent.py
```

You should see:
```
🤖 Agent starting...

📡 Fetching weather data...
✅ Weather: {'temp': 68, 'condition': 'Sunny'}

🧠 Calling OpenAI...
✅ AI says: It's a beautiful sunny day in San Francisco with...

📤 Posting to webhook...
✅ Posted successfully
```

**Problem:** This agent can:
- Make unlimited OpenAI API calls ($$$)
- Call any domain
- Leak data to any webhook
- Run forever without limits

## Step 3: Initialize Bastion

Stop the agent (Ctrl+C) and initialize Bastion:

```bash
bastion init
```

Fill in:
```
Agent name: weather-agent
Language: python
Framework: custom
```

## Step 4: Configure Policies

Open https://bastion.legatia.solutions/policies and create:

### Policy 1: Rate Limiting

```
Name: OpenAI Rate Limit
Type: Rate Limiting
Max Requests: 10
Time Window: 1 minute
Action Types: http_request
Domain Pattern: api.openai.com
```

### Policy 2: Allow List

```
Name: Allowed Domains
Type: Allow List
Domains:
  - api.openai.com
  - api.weatherapi.com
  - webhook.site
```

### Policy 3: Spending Limit

```
Name: Daily Spending Cap
Type: Spending Limit (coming soon)
Max Amount: $10.00
Time Window: 1 day
```

## Step 5: Run with Protection

Start your agent with Bastion:

```bash
bastion start -- python agent.py
```

Output:
```
🛡️  Starting Bastion Supervisor

✓ Loaded configuration
✓ Backend: http://localhost:3000/v1
✓ Proxy listening on port: 3000

🚀 Bastion Supervisor active!

🤖 Launching agent: python agent.py
✓ Agent started (PID: 12345)

[10:30:15] http_request - {"url": "https://api.weatherapi.com/..."}
   ✓ ALLOWED

[10:30:16] http_request - {"url": "https://api.openai.com/..."}
   ✓ ALLOWED

[10:30:17] http_request - {"url": "https://webhook.site/..."}
   ✓ ALLOWED
```

## Step 6: Test Policy Enforcement

### Test 1: Rate Limit

Modify `agent.py` to call OpenAI more frequently:

```python
# Change sleep time
time.sleep(1)  # Was 10, now 1
```

Restart:
```bash
bastion start -- python agent.py
```

After 10 requests in a minute:
```
[10:31:05] http_request - {"url": "https://api.openai.com/..."}
   🛑 BLOCKED: Rate limit exceeded (10 requests/minute)
```

Your agent will receive a 403 error.

### Test 2: Domain Allow List

Try calling an unauthorized domain:

```python
# Add to agent.py
def call_unauthorized_api(self):
    requests.get("https://malicious-domain.com/steal-data")
```

Result:
```
[10:31:10] http_request - {"url": "https://malicious-domain.com/..."}
   🛑 BLOCKED: Domain not in allow list
```

## Step 7: Monitor Your Agent

### Real-time Monitoring

Watch actions as they happen:
```bash
bastion logs -f
```

### Check Statistics

```bash
bastion stats --range today
```

Output:
```
📊 Usage Statistics (today)

Total Requests: 156
Allowed: 145
Blocked: 11
Block Rate: 7.05%
```

### View Audit Trail

```bash
bastion audit --limit 20
```

See all actions with timestamps and decisions.

## Step 8: Improve Policies

Based on monitoring, adjust policies:

### Add Time Window

Only allow during business hours:

```
Name: Business Hours Only
Type: Time Window
Days: Monday-Friday
Hours: 9:00 AM - 5:00 PM
Timezone: America/Los_Angeles
```

### Add DLP

Prevent leaking API keys:

```
Name: No API Keys in Requests
Type: Data Loss Prevention
Patterns:
  - sk-[a-zA-Z0-9]{32,}
  - Bearer\s+[a-zA-Z0-9]+
```

## Complete Example

Here's the final protected agent:

**agent.py:**
```python
import requests
import time
import sys

class WeatherAgent:
    def __init__(self):
        self.weather_key = "YOUR_WEATHER_KEY"
        self.openai_key = "YOUR_OPENAI_KEY"
        self.webhook_url = "https://webhook.site/YOUR_ID"

    def run(self):
        print("🤖 Weather Agent v1.0 (Protected by Bastion)")

        iteration = 0
        while True:
            iteration += 1
            print(f"\n--- Iteration {iteration} ---")

            try:
                # Fetch weather
                weather = self.fetch_weather()

                # Generate summary
                summary = self.summarize(weather)

                # Post results
                self.post_results(summary)

            except Exception as e:
                print(f"❌ Error: {e}")
                if "403" in str(e):
                    print("🛑 Blocked by Bastion policy")

            # Sleep between iterations
            time.sleep(30)

    def fetch_weather(self):
        print("📡 Fetching weather...")
        response = requests.get(
            "https://api.weatherapi.com/v1/current.json",
            params={"key": self.weather_key, "q": "San Francisco"}
        )
        response.raise_for_status()
        return response.json()

    def summarize(self, weather):
        print("🧠 Generating AI summary...")
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.openai_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo",
                "messages": [{
                    "role": "user",
                    "content": f"Summarize in one sentence: {weather}"
                }],
                "max_tokens": 50
            }
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def post_results(self, summary):
        print("📤 Posting results...")
        response = requests.post(
            self.webhook_url,
            json={"summary": summary, "timestamp": time.time()}
        )
        response.raise_for_status()
        print("✅ Success!")

if __name__ == "__main__":
    agent = WeatherAgent()
    agent.run()
```

**.bastion-agent.json:**
```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "weather-agent",
  "language": "python",
  "framework": "custom",
  "enabled": true,
  "created_at": "2025-01-30T10:30:00Z"
}
```

**Start command:**
```bash
bastion start --daemon -- python agent.py
```

## What You Learned

✅ How to initialize Bastion for an agent
✅ How to configure policies
✅ How to run agents with protection
✅ How to monitor agent behavior
✅ How policies block dangerous actions
✅ How to view audit logs and statistics

## Next Steps

- [Production Deployment](/guides/production) - Deploy to production
- [Policy Examples](/guides/policy-examples) - More policy configurations
- [Testing Guide](/guides/testing) - Test your policies
- [All Policy Types](/policies/overview) - Explore all policy options
