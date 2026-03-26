-- CreateEnum
CREATE TYPE "SignalStage" AS ENUM ('TO_REVIEW', 'IN_PROGRESS', 'OUTREACH', 'QUALIFIED', 'WON', 'LOST', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIGNAL_WORKFLOW_UPDATED';

-- AlterTable
ALTER TABLE "Signal"
ADD COLUMN "stage" "SignalStage" NOT NULL DEFAULT 'TO_REVIEW',
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "nextStep" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Signal_organizationId_stage_idx" ON "Signal"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Signal_organizationId_assigneeId_idx" ON "Signal"("organizationId", "assigneeId");

-- AddForeignKey
ALTER TABLE "Signal"
ADD CONSTRAINT "Signal_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
