-- Phase D online features: cloud inventory owner, rankings, item serials, world log.

ALTER TABLE "Item" ADD COLUMN "ownerId" TEXT;

CREATE TABLE "ItemSerialCounter" (
    "itemName" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ItemSerialCounter_pkey" PRIMARY KEY ("itemName")
);

CREATE TABLE "StageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "turnCount" INTEGER NOT NULL,
    "clearTimeSec" INTEGER NOT NULL DEFAULT 0,
    "totalDamage" INTEGER NOT NULL DEFAULT 0,
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerStats" (
    "userId" TEXT NOT NULL,
    "totalDamage" BIGINT NOT NULL DEFAULT 0,
    "bossKillCount" INTEGER NOT NULL DEFAULT 0,
    "bestResidueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "WorldLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StageRecord_userId_stageId_key" ON "StageRecord"("userId", "stageId");
CREATE INDEX "StageRecord_stageId_turnCount_idx" ON "StageRecord"("stageId", "turnCount");
CREATE INDEX "StageRecord_stageId_clearTimeSec_idx" ON "StageRecord"("stageId", "clearTimeSec");
CREATE INDEX "WorldLog_createdAt_idx" ON "WorldLog"("createdAt");
CREATE INDEX "WorldLog_type_createdAt_idx" ON "WorldLog"("type", "createdAt");

ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StageRecord" ADD CONSTRAINT "StageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldLog" ADD CONSTRAINT "WorldLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
