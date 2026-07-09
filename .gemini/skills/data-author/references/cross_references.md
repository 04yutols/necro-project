# Data Cross-References

When adding or modifying data, ensure all referenced IDs exist in their respective files.

| Source File | Field | Target File | Target Field |
|---|---|---|---|
| `stages.json` | `waves[].enemyIds` | `enemies.json` | Key / `id` |
| `stages.json` | `rewards.dropTable[].itemId` | `items.json` | Key / `id` |
| `stages.json` | `rewards.dropTable[].itemId` | `materials.json` | Key / `id` |
| `stages.json` | `rewards.dropTable[].monsterId` | `monsters.json` | Key |
| `stages.json` | `unlockRequires[]` | `stages.json` | Key / `id` |
| `enemies.json` | `dropTable[].itemId` | `items.json` | Key / `id` |
| `enemies.json` | `dropTable[].itemId` | `materials.json` | Key / `id` |
| `ch1_scenes.json` | `trigger.stageId` | `stages.json` | Key / `id` |
| `ch1_scenes.json` | `trigger.bossStageId` | `stages.json` | Key / `id` |
| `ch1_scenes.json` | `lines[].speaker` | `characters.json` | Key / `id` |
| `ch1_scenes.json` | `lines[].portraits[].characterId` | `characters.json` | Key / `id` |

## Validation Steps
1. **ID Consistency**: Ensure `id` field inside the object matches the JSON key.
2. **Reference Integrity**: If you add an item to a drop table, it MUST exist in `items.json` or `materials.json`.
3. **Trigger Verification**: For story scenes, ensure the `stageId` exists and is the intended trigger point.
4. **Coordinate Check**: For `stages.json`, ensure `position` coordinates (x, y) do not overlap with existing nodes on the AreaMap.
