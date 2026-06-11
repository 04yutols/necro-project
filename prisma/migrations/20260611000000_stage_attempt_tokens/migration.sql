-- Stage start attempts are short-lived, single-use result tokens.
CREATE TABLE "StageAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageAttempt_userId_stageId_consumedAt_idx" ON "StageAttempt"("userId", "stageId", "consumedAt");
CREATE INDEX "StageAttempt_characterId_stageId_idx" ON "StageAttempt"("characterId", "stageId");
CREATE INDEX "StageAttempt_expiresAt_idx" ON "StageAttempt"("expiresAt");

ALTER TABLE "StageAttempt" ADD CONSTRAINT "StageAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StageAttempt" ADD CONSTRAINT "StageAttempt_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
