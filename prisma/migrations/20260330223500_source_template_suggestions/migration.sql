ALTER TABLE "Organization"
ADD COLUMN "businessFocus" TEXT,
ADD COLUMN "targetAudience" TEXT;

CREATE TABLE "SourceTemplateSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedKeywords" TEXT[],
    "recommendedNegativeKeywords" TEXT[],
    "sources" JSONB NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceTemplateSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceTemplateSuggestion_organizationId_profileHash_idx" ON "SourceTemplateSuggestion"("organizationId", "profileHash");
CREATE INDEX "SourceTemplateSuggestion_organizationId_createdAt_idx" ON "SourceTemplateSuggestion"("organizationId", "createdAt");

ALTER TABLE "SourceTemplateSuggestion"
ADD CONSTRAINT "SourceTemplateSuggestion_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
