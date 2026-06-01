-- Align existing owned weapon instances with the IMP-11 fixed sub-option rules.
-- Weapon sub-options are master-defined in the current system, so rebasing by
-- weapon name does not discard player-rolled values.
UPDATE "Item"
SET "subOptions" = '[{"type":"ATK%","value":6.2}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '骨砕きの短剣';

UPDATE "Item"
SET "subOptions" = '[{"type":"CRIT_DMG","value":8.5}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '煤火の見習い杖';

UPDATE "Item"
SET "subOptions" = '[{"type":"EFFECT_HIT","value":7.0}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '弔鐘の司祭杖';

UPDATE "Item"
SET "subOptions" = '[{"type":"CRIT_RATE","value":5.2}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '墓棘の短剣';

UPDATE "Item"
SET "subOptions" = '[{"type":"CRIT_RATE","value":6.4}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '血啜りの処刑剣';

UPDATE "Item"
SET "subOptions" = '[{"type":"CRIT_DMG","value":16},{"type":"DARK_DMG_BOOST","value":13}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '霊銀の斬骨刀';

UPDATE "Item"
SET "subOptions" = '[{"type":"ATK%","value":12},{"type":"DARK_DMG_BOOST","value":7.5}]'::jsonb
WHERE "type" = 'WEAPON' AND "name" = '怨嗟顕現・喰魂';
