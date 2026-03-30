-- CreateTable
CREATE TABLE "SavedSourceTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedNegativeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSourceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedSourceTemplate_organizationId_name_key" ON "SavedSourceTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SavedSourceTemplate_organizationId_createdAt_idx" ON "SavedSourceTemplate"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedSourceTemplate" ADD CONSTRAINT "SavedSourceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSourceTemplate" ADD CONSTRAINT "SavedSourceTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
