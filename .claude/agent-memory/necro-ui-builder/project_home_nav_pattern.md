---
name: project-home-nav-pattern
description: HomeHero.tsx NAV_BUTTONS structure, locked-button convention, and unlock-check source of truth for HOME quick menu entries
metadata:
  type: project
---

`src/components/home/HomeHero.tsx` renders a single-column vertical list of nav
buttons (`NAV_BUTTONS`, `gridTemplateColumns: '1fr'`) inside a scrollable
container (`overflow-y-auto` on the outer wrapper) — adding a new button just
appends a row and does not require grid/column changes or layout rework.

Each button config object has: `id` (Tab value), `label` (JP), `sub` (EN caps
subtitle, or a JP "unlock condition" string when locked), `icon` (lucide,
swapped to `Lock` when locked), `color`/`border`/`bg`/`glow` (feature theme
color, swapped to muted gray `#8b7da8` / `rgba(139,125,168,0.32)` /
`rgba(32,26,44,0.42)` when locked), and `locked: boolean`.

**Locked-button tap behavior (confirmed 2026-07-09 by reading the LAB button
before adding YOMI): tapping a locked button is a no-op** — `onClick` checks
`if (isLocked) return;` before calling `setCurrentTab`. It does NOT navigate to
the target tab to show a "locked" placeholder screen. `disabled={isLocked}` is
also set on the `motion.button`. Same pattern used in
`src/components/layout/BottomNavBar.tsx`'s TABS array for LAB/YOMI.

**Unlock checks must go through the dedicated logic module, never inline
string checks on `clearedStages`:**
- `isAbyssalResidueUnlocked(player.clearedStages)` from
  `src/logic/AbyssalResidueUnlockSystem.ts` — gates the LAB/深淵の残滓 button.
- `isYomiUnlocked(player.clearedStages)` from `src/logic/YomiUnlockSystem.ts`
  — gates the YOMI/黄泉の階層 button (unlocks on clearing
  `CH1_FINAL_NODE_ID` = `'area1_node3'`, defined in `YomiFloors.ts`). Direct
  string literals like `'yomi_'` must not be hardcoded elsewhere — this
  module is the single source of truth per project convention.

**Why:** HOME's NAV_BUTTONS had a "design leak" where YOMI (end-game content,
already wired into BottomNavBar) had no HOME entry point — MAP/JOB/LAB/EQUIP/
LOGS existed but YOMI was missing. Added 2026-07-09, placed adjacent to LAB to
group end-game-content buttons, using Void Purple (`#8B00FF`) to match
BottomNavBar and `YomiTowerScreen.tsx` styling.

**How to apply:** When adding any new HOME quick-menu entry, follow this same
locked/unlocked object shape, source the unlock boolean from a dedicated
`src/logic/*UnlockSystem.ts` function (create one if it doesn't exist), and
match the color scheme already used for that feature elsewhere in the app
(BottomNavBar tab, the feature's own screen component) rather than inventing a
new color.
