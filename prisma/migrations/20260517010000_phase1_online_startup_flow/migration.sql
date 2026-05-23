-- Phase 1 online startup flow: cloud-loaded character state, party slots, and residue loadout.

ALTER TABLE "Character" ADD COLUMN "gold" INTEGER NOT NULL DEFAULT 50000;
ALTER TABLE "Character" ADD COLUMN "necroExp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN "partySlot0Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "partySlot1Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "partySlot2Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "equippedResidue0Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "equippedResidue1Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "equippedResidue2Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "equippedResidue3Id" TEXT;
ALTER TABLE "Character" ADD COLUMN "equippedResidue4Id" TEXT;

ALTER TABLE "Monster" ADD COLUMN "masterId" TEXT;
ALTER TABLE "Monster" ADD COLUMN "characterId" TEXT;
ALTER TABLE "Monster" ADD COLUMN "resistances" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX "Monster_characterId_idx" ON "Monster"("characterId");
CREATE INDEX "Character_partySlot0Id_idx" ON "Character"("partySlot0Id");
CREATE INDEX "Character_partySlot1Id_idx" ON "Character"("partySlot1Id");
CREATE INDEX "Character_partySlot2Id_idx" ON "Character"("partySlot2Id");

ALTER TABLE "Character" ADD CONSTRAINT "Character_partySlot0Id_fkey" FOREIGN KEY ("partySlot0Id") REFERENCES "Monster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_partySlot1Id_fkey" FOREIGN KEY ("partySlot1Id") REFERENCES "Monster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_partySlot2Id_fkey" FOREIGN KEY ("partySlot2Id") REFERENCES "Monster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_equippedResidue0Id_fkey" FOREIGN KEY ("equippedResidue0Id") REFERENCES "AbyssalResidue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_equippedResidue1Id_fkey" FOREIGN KEY ("equippedResidue1Id") REFERENCES "AbyssalResidue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_equippedResidue2Id_fkey" FOREIGN KEY ("equippedResidue2Id") REFERENCES "AbyssalResidue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_equippedResidue3Id_fkey" FOREIGN KEY ("equippedResidue3Id") REFERENCES "AbyssalResidue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_equippedResidue4Id_fkey" FOREIGN KEY ("equippedResidue4Id") REFERENCES "AbyssalResidue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
