-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'TRIAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
