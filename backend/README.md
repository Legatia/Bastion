# Bastion Backend API

The core backend service for Bastion Protocol - a policy evaluation engine for AI agent security.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

```bash
# Copy environment variables
cp .env.example .env

# Edit .env and add your PostgreSQL connection string
# DATABASE_URL="postgresql://user:password@localhost:5432/bastion"

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 3. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Core Authorization

**POST /v1/authorize**
- Main policy evaluation endpoint
- Checks if an action should be allowed or blocked

### Policy Management

- `GET /v1/policies` - List all policies
- `POST /v1/policies` - Create new policy
- `PUT /v1/policies/:id` - Update policy
- `DELETE /v1/policies/:id` - Delete policy

### Action Logs

- `GET /v1/logs` - Get action logs (audit trail)
- `GET /v1/logs/:id` - Get specific log entry

### Analytics

- `GET /v1/analytics/summary` - Usage summary and metrics
- `GET /v1/analytics/agents` - Per-agent analytics

### Agent Management

- `GET /v1/agents` - List agents
- `POST /v1/agents` - Create agent

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Database commands
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
```
