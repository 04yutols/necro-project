# Data Authoring Workflows

## Workflow: Adding a New Boss Battle

1. **Character/Enemy Design**:
   - Define the Boss in `enemies.json`.
   - Set `tier: "BOSS"`.
   - Assign appropriate `stats` (HP 900-2000) and `shieldHp` (280-400).
   - Add `gimmicks` (e.g., `HP_BELOW_50` -> `ENRAGE`).
   - Define its `dropTable` (e.g., SSR Weapon).

2. **Stage Setup**:
   - Create a new node in `stages.json`.
   - Set `nodeType: "BOSS"` and `isAreaBoss: true`.
   - Add waves, placing the Boss in the final wave.
   - Configure `unlockRequires` to point to the preceding node.
   - Set `position` coordinates to place it correctly on the map.

3. **Rewards**:
   - Ensure any weapons or materials in `dropTable` are defined in `items.json` or `materials.json`.

4. **Story Integration (Optional)**:
   - Add a scene in `ch1_scenes.json`.
   - Set `trigger.type: "BOSS_CLEAR"` and `trigger.bossStageId` to your new stage ID.
   - Write the dialogue using existing `characters.json` IDs.

## Workflow: Creating a New Weapon

1. **Item Definition**:
   - Add entry to `items.json`.
   - Choose an `archetype` (MID, HIGH, SUPPORT) and `rarity`.
   - Set up `passiveA` (and `passiveB` if SR+).
   - Use `{value}%` in `descTemplate` and provide 5 values in the `values` array for ranks 1-5.

2. **Drop Placement**:
   - Add the new `itemId` to the `dropTable` of relevant `enemies.json` or `stages.json` nodes.

## Workflow: validation
- Always run `npx tsc --noEmit` after manual JSON edits to check for type inconsistencies (if applicable).
- Verify all JSON keys match their internal `id` fields.
