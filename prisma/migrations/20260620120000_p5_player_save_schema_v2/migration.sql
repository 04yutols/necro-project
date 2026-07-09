-- P5: promote PlayerSave schema marker to v2.
-- Shape is intentionally unchanged; application code owns forward migration.

ALTER TABLE "Character" ALTER COLUMN "saveVersion" SET DEFAULT 2;

UPDATE "Character"
SET
  "playerState" = jsonb_set("playerState"::jsonb, '{schemaVersion}', '2'::jsonb, true),
  "saveVersion" = 2
WHERE
  jsonb_typeof("playerState"::jsonb) = 'object'
  AND COALESCE(
    CASE
      WHEN "playerState"->>'schemaVersion' ~ '^[0-9]+$' THEN ("playerState"->>'schemaVersion')::int
      ELSE 0
    END,
    0
  ) < 2;

UPDATE "Character"
SET "saveVersion" = 2
WHERE "saveVersion" < 2;
