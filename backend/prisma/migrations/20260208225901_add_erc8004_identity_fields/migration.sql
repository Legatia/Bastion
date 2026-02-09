-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "agentURI" TEXT,
ADD COLUMN     "onchainId" TEXT,
ADD COLUMN     "ownerAddress" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "registryAddress" TEXT,
ADD COLUMN     "registryChain" TEXT;
