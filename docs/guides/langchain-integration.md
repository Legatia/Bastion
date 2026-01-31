# LangChain Integration

> 🔜 **Coming Soon** - SDK package in development

LangChain integration will be available via our official middleware package.

## Installation (Preview)

```bash
pip install bastion-langchain
```

## Usage (Preview)

```python
from langchain import LLMChain
from bastion_langchain import BastionMiddleware

# Initialize Bastion middleware
bastion = BastionMiddleware(
    api_key="your_bastion_api_key",
    proxy_url="http://localhost:3000"
)

# Wrap your chain
chain = LLMChain(llm=your_llm, prompt=your_prompt)
protected_chain = bastion.protect(chain)

# Run with protection
result = protected_chain.run(input="Your query")
```

## Current Workaround

Until the SDK is ready, use the proxy method:

```bash
# Start Bastion proxy
bastion start -d

# Set proxy in your Python environment
import os
os.environ['HTTP_PROXY'] = 'http://localhost:3000'
os.environ['HTTPS_PROXY'] = 'http://localhost:3000'

# Run your LangChain code normally
```

## Policy Integration

The SDK will support:
- **Tool Call Filtering**: Block specific tools/functions
- **Token Limits**: Prevent excessive LLM usage
- **Data Validation**: Validate inputs/outputs
- **Audit Logging**: Track all chain executions

Stay tuned for the official release!
