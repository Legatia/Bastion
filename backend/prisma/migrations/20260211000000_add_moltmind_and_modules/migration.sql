-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('OPENCLAW', 'BASTION_PROXY', 'ERC8004_LITE', 'ERC8004_STANDARD', 'ERC8004_REALTIME', 'MOLTMIND');

-- AlterTable: Add module billing fields to users
ALTER TABLE "users" ADD COLUMN "openclawPurchased" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Module Subscriptions (per-agent billing)
CREATE TABLE "module_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "module" "ModuleType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceAtActivation" INTEGER,
    "stripeSubscriptionId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "module_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Behavioral Events
CREATE TABLE "behavioral_events" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "contentLength" INTEGER,
    "contentHash" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "topicTags" TEXT[],
    "targetAgentId" TEXT,
    "responseTimeMs" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Agent Baselines
CREATE TABLE "agent_baselines" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Cognitive Alerts
CREATE TABLE "cognitive_alerts" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "driftScore" DOUBLE PRECISION NOT NULL,
    "details" JSONB NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cognitive_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Agent Health Scores
CREATE TABLE "agent_health_scores" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "identityCoherence" INTEGER NOT NULL,
    "behavioralStability" INTEGER NOT NULL,
    "interactionHealth" INTEGER NOT NULL,
    "activeFlags" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_subscriptions_userId_active_idx" ON "module_subscriptions"("userId", "active");
CREATE UNIQUE INDEX "module_subscriptions_userId_agentId_module_key" ON "module_subscriptions"("userId", "agentId", "module");

CREATE INDEX "behavioral_events_agentId_timestamp_idx" ON "behavioral_events"("agentId", "timestamp");
CREATE INDEX "behavioral_events_agentId_eventType_idx" ON "behavioral_events"("agentId", "eventType");

CREATE INDEX "agent_baselines_agentId_isActive_idx" ON "agent_baselines"("agentId", "isActive");

CREATE INDEX "cognitive_alerts_agentId_createdAt_idx" ON "cognitive_alerts"("agentId", "createdAt");
CREATE INDEX "cognitive_alerts_alertType_severity_idx" ON "cognitive_alerts"("alertType", "severity");

CREATE INDEX "agent_health_scores_agentId_computedAt_idx" ON "agent_health_scores"("agentId", "computedAt");

-- AddForeignKey
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_subscriptions" ADD CONSTRAINT "module_subscriptions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "behavioral_events" ADD CONSTRAINT "behavioral_events_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_baselines" ADD CONSTRAINT "agent_baselines_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cognitive_alerts" ADD CONSTRAINT "cognitive_alerts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_health_scores" ADD CONSTRAINT "agent_health_scores_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
