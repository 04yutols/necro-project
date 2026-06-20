-- P4: finalize PlayerSaveV1 as the single source of truth, then drop legacy mirrors.

ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "saveVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve orphaned legacy characters instead of deleting them while tightening userId.
INSERT INTO "User" ("id", "name", "displayName")
SELECT 'p4-orphan-' || c."id", c."name", c."name"
FROM "Character" c
WHERE c."userId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Character"
SET "userId" = 'p4-orphan-' || "id"
WHERE "userId" IS NULL;

UPDATE "Character" c
SET "playerState" = jsonb_build_object(
  'schemaVersion', 1,
  'player', jsonb_build_object(
    'name', COALESCE(c."playerState" #>> '{player,name}', c."name", 'アルド'),
    'currentJobId', COALESCE(c."playerState" #>> '{player,currentJobId}', c."currentJobId", 'warrior'),
    'gold', CASE
      WHEN (c."playerState" #>> '{player,gold}') ~ '^[0-9]+$'
        THEN (c."playerState" #>> '{player,gold}')::int
      ELSE COALESCE(c."gold", 50000)
    END,
    'clearedStages', COALESCE(
      CASE WHEN jsonb_typeof(c."playerState" #> '{player,clearedStages}') = 'array'
        THEN c."playerState" #> '{player,clearedStages}'
      END,
      to_jsonb(COALESCE(c."clearedStages", ARRAY[]::text[]))
    ),
    'jobs', COALESCE(
      CASE WHEN jsonb_typeof(c."playerState" #> '{player,jobs}') = 'array'
        THEN c."playerState" #> '{player,jobs}'
      END,
      NULLIF((
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('jobId', uj."jobId", 'level', uj."level", 'exp', uj."exp") ORDER BY uj."jobId"),
          '[]'::jsonb
        )
        FROM "UserJob" uj
        WHERE uj."characterId" = c."id"
      ), '[]'::jsonb),
      jsonb_build_array(jsonb_build_object(
        'jobId', COALESCE(c."currentJobId", 'warrior'),
        'level', 1,
        'exp', 0
      ))
    ),
    'passives', jsonb_build_object(
      'passiveAtkBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveAtkBonus}') ~ '^-?[0-9]+$'
        THEN (c."playerState" #>> '{player,passives,passiveAtkBonus}')::int ELSE COALESCE(c."passiveAtkBonus", 0) END,
      'passiveDefBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveDefBonus}') ~ '^-?[0-9]+$'
        THEN (c."playerState" #>> '{player,passives,passiveDefBonus}')::int ELSE COALESCE(c."passiveDefBonus", 0) END,
      'passiveSpdBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveSpdBonus}') ~ '^-?[0-9]+$'
        THEN (c."playerState" #>> '{player,passives,passiveSpdBonus}')::int ELSE COALESCE(c."passiveSpdBonus", 0) END,
      'passiveCritRateBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveCritRateBonus}') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (c."playerState" #>> '{player,passives,passiveCritRateBonus}')::float ELSE COALESCE(c."passiveCritRateBonus", 0) END,
      'passiveCritDmgBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveCritDmgBonus}') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (c."playerState" #>> '{player,passives,passiveCritDmgBonus}')::float ELSE COALESCE(c."passiveCritDmgBonus", 0) END,
      'passiveHpBonus', CASE WHEN (c."playerState" #>> '{player,passives,passiveHpBonus}') ~ '^-?[0-9]+$'
        THEN (c."playerState" #>> '{player,passives,passiveHpBonus}')::int ELSE COALESCE(c."passiveHpBonus", 0) END
    ),
    'necroStatus', jsonb_build_object(
      'level', CASE WHEN (c."playerState" #>> '{player,necroStatus,level}') ~ '^[0-9]+$'
        THEN (c."playerState" #>> '{player,necroStatus,level}')::int ELSE COALESCE(c."necroLevel", 1) END,
      'rank', CASE WHEN (c."playerState" #>> '{player,necroStatus,rank}') ~ '^[0-9]+$'
        THEN (c."playerState" #>> '{player,necroStatus,rank}')::int ELSE COALESCE(c."necroRank", 1) END,
      'maxCost', CASE WHEN (c."playerState" #>> '{player,necroStatus,maxCost}') ~ '^[0-9]+$'
        THEN (c."playerState" #>> '{player,necroStatus,maxCost}')::int ELSE COALESCE(c."necroMaxCost", 10) END,
      'baseStatsBonus', CASE WHEN (c."playerState" #>> '{player,necroStatus,baseStatsBonus}') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (c."playerState" #>> '{player,necroStatus,baseStatsBonus}')::float ELSE COALESCE(c."necroBaseStatsBonus", 1.0) END,
      'exp', CASE WHEN (c."playerState" #>> '{player,necroStatus,exp}') ~ '^[0-9]+$'
        THEN (c."playerState" #>> '{player,necroStatus,exp}')::int ELSE COALESCE(c."necroExp", 0) END
    ),
    'equipmentIds', jsonb_build_object(
      'weapon', COALESCE(c."playerState" #>> '{player,equipmentIds,weapon}', c."equipWeaponId"),
      'sub', COALESCE(c."playerState" #>> '{player,equipmentIds,sub}', c."equipSubId"),
      'head', COALESCE(c."playerState" #>> '{player,equipmentIds,head}', c."equipHeadId"),
      'body', COALESCE(c."playerState" #>> '{player,equipmentIds,body}', c."equipBodyId"),
      'arms', COALESCE(c."playerState" #>> '{player,equipmentIds,arms}', c."equipArmsId"),
      'legs', COALESCE(c."playerState" #>> '{player,equipmentIds,legs}', c."equipLegsId"),
      'acc1', COALESCE(c."playerState" #>> '{player,equipmentIds,acc1}', c."equipAcc1Id"),
      'acc2', COALESCE(c."playerState" #>> '{player,equipmentIds,acc2}', c."equipAcc2Id")
    ),
    'partyMonsterIds', COALESCE(
      CASE WHEN jsonb_typeof(c."playerState" #> '{player,partyMonsterIds}') = 'array'
        THEN c."playerState" #> '{player,partyMonsterIds}'
      END,
      jsonb_build_array(c."partySlot0Id", c."partySlot1Id", c."partySlot2Id")
    ),
    'equippedResidueIds', COALESCE(
      CASE WHEN jsonb_typeof(c."playerState" #> '{player,equippedResidueIds}') = 'array'
        THEN c."playerState" #> '{player,equippedResidueIds}'
      END,
      jsonb_build_array(
        c."equippedResidue0Id",
        c."equippedResidue1Id",
        c."equippedResidue2Id",
        c."equippedResidue3Id",
        c."equippedResidue4Id"
      )
    )
  ),
  'weaponMaterials', COALESCE(
    CASE WHEN jsonb_typeof(c."playerState" -> 'weaponMaterials') = 'array'
      THEN c."playerState" -> 'weaponMaterials'
    END,
    (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('type', wm."type", 'name', wm."name", 'quantity', wm."quantity") ORDER BY wm."type"),
        '[]'::jsonb
      )
      FROM "WeaponMaterial" wm
      WHERE wm."userId" = c."userId"
    )
  ),
  'residueMaterials', COALESCE(
    CASE WHEN jsonb_typeof(c."playerState" -> 'residueMaterials') = 'array'
      THEN c."playerState" -> 'residueMaterials'
    END,
    '[]'::jsonb
  ),
  'transmutationPoints', CASE
    WHEN (c."playerState" #>> '{transmutationPoints}') ~ '^[0-9]+$'
      THEN (c."playerState" #>> '{transmutationPoints}')::int
    ELSE 0
  END
);

ALTER TABLE "Character" ALTER COLUMN "playerState" SET NOT NULL;

DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;

ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";

ALTER TABLE "Monster" DROP COLUMN IF EXISTS "spiritCoreId";
DROP TABLE IF EXISTS "SpiritCore" CASCADE;

DROP TABLE IF EXISTS "UserJob" CASCADE;
DROP TABLE IF EXISTS "Job" CASCADE;
DROP TABLE IF EXISTS "WeaponMaterial" CASCADE;

ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_userId_fkey";

ALTER TABLE "Character" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "gold";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "hp";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "atk";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "def";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "spd";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "critRate";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "critDmg";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "effectHit";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "effectRes";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveAtkBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveDefBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveSpdBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveCritRateBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveCritDmgBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "passiveHpBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "currentJobId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipWeaponId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipSubId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipHeadId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipBodyId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipArmsId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipLegsId";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipAcc1Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equipAcc2Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "necroLevel";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "necroRank";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "necroExp";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "necroMaxCost";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "necroBaseStatsBonus";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "partySlot0Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "partySlot1Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "partySlot2Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "clearedStages";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equippedResidue0Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equippedResidue1Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equippedResidue2Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equippedResidue3Id";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "equippedResidue4Id";

ALTER TABLE "Character" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Character_userId_key" ON "Character"("userId");
ALTER TABLE "Character"
  ADD CONSTRAINT "Character_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
