-- AlterTable
ALTER TABLE "Signal"
ADD COLUMN "firstResponseAt" TIMESTAMP(3),
ADD COLUMN "meetingBookedAt" TIMESTAMP(3),
ADD COLUMN "pipelineValueUsd" INTEGER,
ADD COLUMN "estimatedHoursSaved" INTEGER,
ADD COLUMN "outcomeNotes" TEXT;

-- CreateIndex
CREATE INDEX "Signal_organizationId_firstResponseAt_idx" ON "Signal"("organizationId", "firstResponseAt");

-- CreateIndex
CREATE INDEX "Signal_organizationId_meetingBookedAt_idx" ON "Signal"("organizationId", "meetingBookedAt");
