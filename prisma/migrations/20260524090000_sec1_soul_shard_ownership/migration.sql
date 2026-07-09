-- SEC-1: SoulShard ownership for authenticated Server Actions.

ALTER TABLE "SoulShard" ADD COLUMN "characterId" TEXT;

CREATE INDEX "SoulShard_characterId_idx" ON "SoulShard"("characterId");

ALTER TABLE "SoulShard"
  ADD CONSTRAINT "SoulShard_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
