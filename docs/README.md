# Bastion Documentation

This directory contains the source for Bastion's documentation site, built with [VitePress](https://vitepress.dev/).

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

The docs will be available at http://localhost:5173

### Build

```bash
npm run build
```

Output in `.vitepress/dist/`

### Preview Build

```bash
npm run preview
```

## Structure

```
docs/
├── .vitepress/          # VitePress configuration
│   └── config.mjs       # Site config and theme
├── index.md             # Homepage
├── getting-started.md   # Getting started guide
├── quick-start.md       # Quick start guide
├── cli/                 # CLI documentation
│   ├── overview.md
│   ├── commands.md
│   ├── moltmind.md
│   ├── identity.md
│   ├── wallet.md
│   └── troubleshooting.md
├── concepts/            # Core concepts
│   └── how-it-works.md
├── desktop/             # Desktop app documentation
│   └── overview.md
├── policies/            # Policy documentation
│   ├── overview.md
│   ├── spending-limits.md
│   ├── rate-limiting.md
│   ├── file-protection.md
│   ├── dlp.md
│   ├── time-windows.md
│   ├── allow-block-lists.md
│   ├── pattern-matching.md
│   └── webhooks.md
└── guides/              # How-to guides and integrations
    ├── first-agent.md
    ├── openclaw-integration.md
    ├── langchain-integration.md
    ├── crewai-integration.md
    └── autogpt-integration.md
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in Vercel
3. Vercel auto-detects VitePress
4. Deploy!

Or use Vercel CLI:

```bash
npm i -g vercel
vercel
```

### Netlify

```bash
# Build command
npm run build

# Publish directory
.vitepress/dist
```

### GitHub Pages

```bash
# Build
npm run build

# Deploy (if using gh-pages)
npm i -g gh-pages
gh-pages -d .vitepress/dist
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--port", "3000", "--host"]
```

## Writing Documentation

### Markdown Features

VitePress supports:
- GitHub-flavored Markdown
- Code syntax highlighting
- Custom containers (tip, warning, danger)
- Mermaid diagrams
- LaTeX math

### Code Blocks

\`\`\`bash
bastion start -- python agent.py
\`\`\`

### Custom Containers

\`\`\`::: tip
This is a helpful tip!
:::

::: warning
This is a warning!
:::

::: danger
This is dangerous!
:::\`\`\`

### Internal Links

```markdown
[Getting Started](/getting-started)
[CLI Commands](/cli/commands)
```

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b docs/my-improvement`
3. Make changes
4. Test locally: `npm run dev`
5. Commit: `git commit -m "docs: improve X"`
6. Push: `git push origin docs/my-improvement`
7. Create Pull Request

## Style Guide

- Use clear, concise language
- Include code examples
- Add command outputs
- Link to related pages
- Use consistent formatting
- Test all commands

## License

MIT
