-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "negativeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
