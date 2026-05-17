---
name: data-author
description: JSON data authoring for Necromance Brave. Use when translating text descriptions of characters, weapons, stages, enemies, or story scenes into structured JSON master data.
---

# Data Authoring Skill

This skill enables precise generation and maintenance of Necromance Brave master data JSON files.

## Workflow Decision Tree

1. **What are you adding?**
   - **Enemy/Boss?** -> See `references/workflows.md#adding-a-new-boss-battle`
   - **Stage/Dungeon?** -> See `references/workflows.md#adding-a-new-boss-battle` (Stage section)
   - **Weapon/Item?** -> See `references/workflows.md#creating-a-new-weapon`
   - **Story Scene?** -> See `references/schemas.md#5-ch1_scenesjson-story-scene`
2. **Are there dependencies?**
   - Check `references/cross_references.md` to ensure all IDs exist in other files.
3. **Is the data balanced?**
   - Use `references/schemas.md#stats-criteria` for HP and Shield ranges.

## Guidelines

- **Symmetry**: JSON key MUST match the `id` field.
- **Language**: Provide both `nameJa` and `nameEn`. Upper case for `nameEn` in UI contexts.
- **Precision**: If user input is vague, follow the criteria in `references/schemas.md`. If critical intent is missing (e.g. boss gimmick type), ASK THE USER.

## Resources

- **[references/schemas.md](references/schemas.md)**: Detailed field definitions and stat ranges.
- **[references/cross_references.md](references/cross_references.md)**: ID relationship map.
- **[references/workflows.md](references/workflows.md)**: Step-by-step guides for common tasks.

## Validation

After generating JSON, simulate a validation check:
1. Ensure no ID collisions.
2. Verify all referenced items/enemies exist.
3. Check for trailing commas or syntax errors (ensure valid JSON).
