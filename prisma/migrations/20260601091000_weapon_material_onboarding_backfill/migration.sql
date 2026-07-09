-- Existing accounts receive the same onboarding pack as newly-created characters.
INSERT INTO "WeaponMaterial" ("userId", "type", "name", "quantity")
SELECT "id", 'IDEA_COMMON', '凡骨のイデア', 8
FROM "User"
ON CONFLICT ("userId", "type") DO NOTHING;

INSERT INTO "WeaponMaterial" ("userId", "type", "name", "quantity")
SELECT "id", 'ABYSSAL_OBSIDIAN', '深淵の黒鋼', 10
FROM "User"
ON CONFLICT ("userId", "type") DO NOTHING;
