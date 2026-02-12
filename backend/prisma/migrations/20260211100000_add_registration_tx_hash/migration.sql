-- Add registrationTxHash to agents for audit trail
ALTER TABLE "agents" ADD COLUMN "registrationTxHash" TEXT;
