-- AlterTable
ALTER TABLE "agents" ADD COLUMN "cdpWalletAddress" TEXT,
ADD COLUMN "cdpAccountName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agents_cdpAccountName_key" ON "agents"("cdpAccountName");
