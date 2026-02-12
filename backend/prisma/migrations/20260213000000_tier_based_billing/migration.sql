-- Tier-Based Billing Migration
-- Replaces TRIAL/STARTER/GROWTH/PRO/ENTERPRISE with FREE/STARTER/PRO/ENTERPRISE

-- Add stripeSubscriptionId to users
ALTER TABLE "users" ADD COLUMN "stripeSubscriptionId" TEXT;

-- Create new enum, migrate data, swap
CREATE TYPE "SubscriptionTier_new" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
ALTER TABLE "users" ADD COLUMN "tier_new" "SubscriptionTier_new" NOT NULL DEFAULT 'FREE';

-- All existing users get FREE by default
UPDATE "users" SET "tier_new" = 'FREE' WHERE "tier" = 'TRIAL';
UPDATE "users" SET "tier_new" = 'FREE' WHERE "tier" = 'GROWTH';

-- Users with active paid module subscriptions get STARTER
UPDATE "users" SET "tier_new" = 'STARTER'
  WHERE "id" IN (
    SELECT DISTINCT "userId" FROM "module_subscriptions"
    WHERE "active" = true AND "stripeSubscriptionId" IS NOT NULL AND "module" != 'OPENCLAW'
  );

-- Preserve existing STARTER/PRO/ENTERPRISE mappings
UPDATE "users" SET "tier_new" = 'STARTER' WHERE "tier" = 'STARTER' AND "tier_new" = 'FREE';
UPDATE "users" SET "tier_new" = 'PRO' WHERE "tier" = 'PRO';
UPDATE "users" SET "tier_new" = 'ENTERPRISE' WHERE "tier" = 'ENTERPRISE';

-- Drop trialEndsAt column (no longer needed)
ALTER TABLE "users" DROP COLUMN IF EXISTS "trialEndsAt";

-- Swap columns
ALTER TABLE "users" DROP COLUMN "tier";
ALTER TABLE "users" RENAME COLUMN "tier_new" TO "tier";

-- Drop old enum and rename new one
DROP TYPE "SubscriptionTier";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
