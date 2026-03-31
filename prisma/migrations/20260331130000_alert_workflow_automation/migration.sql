ALTER TABLE "AlertRule"
ADD COLUMN "autoStage" "SignalStage",
ADD COLUMN "autoAssignUserId" TEXT,
ADD COLUMN "autoNextStep" TEXT;
