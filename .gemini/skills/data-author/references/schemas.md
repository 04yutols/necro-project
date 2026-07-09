# Necromance Brave Data Schemas

Reference this file for exact field types and design criteria when authoring game data.

## 1. enemies.json (EnemyData)
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique ID (snake_case), must match key. |
| `name` | string | English internal name. |
| `nameJa` | string | Japanese display name. |
| `nameEn` | string | English display name (UPPERCASE). |
| `tier` | `MINION` \| `ELITE` \| `BOSS` | Enemy tier. |
| `tribe` | `UNDEAD` \| `DEMON` \| `BEAST` \| `HUMANOID` \| `DRAGON` \| `ORC` | Tribe. |
| `stats` | object | `{ hp, atk, def, spd, critRate, critDmg, effectHit, effectRes }` |
| `resistances` | object | ElementType keys, values are % (positive=resist, negative=weak). |
| `weaknesses` | ElementType[] | Displayed weaknesses (should align with negative resistances). |
| `shieldHp` | number | Optional. Spectral shield HP. |
| `gimmicks` | BossGimmick[] | Optional (Elite/Boss). `{ trigger, effect, value }` |
| `dropTable` | DropEntry[] | `{ type, itemId?, monsterId?, rarity?, rate, isHidden? }` |
| `battle` | object | `{ color (HEX), sprite (WRAITH\|GIANT\|WYRM), size (0.5-1.1) }` |

### Stats Criteria
| Tier | HP Range | Shield HP |
|---|---|---|
| `MINION` | 200 - 400 | None |
| `ELITE` | 500 - 900 | 150 - 280 |
| `BOSS` | 900 - 2000 | 280 - 400 |

## 2. stages.json (StageData)
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique ID. |
| `name` | string | English internal name. |
| `nameJa` | string | Japanese display name. |
| `nameEn` | string | English display name (UPPERCASE). |
| `chapter` | number | Chapter number. |
| `chapterName` | string | Chapter title. |
| `area` | number | Area index. |
| `nodeType` | `SAFE` \| `DUNGEON` \| `BOSS` | Node type. |
| `element` | ElementType | Node color/theme. |
| `difficulty` | number | 1 - 5 rating. |
| `waveCount` | number | Match waves array length. |
| `unlockRequires` | string[] | Array of stage IDs required to unlock this. |
| `waves` | StageWaveData[] | `{ label, role (WARMUP\|SHIELD\|BOSS), enemyIds[], intent }` |
| `rewards` | object | `{ baseExp, baseGold, dropTable[] }` |
| `position` | object | `{ x, y }` pixel coordinates on AreaMap. |
| `isAreaBoss` | boolean | Optional. True for area bosses. |

## 3. monsters.json (MonsterData base)
| Field | Type | Description |
|---|---|---|
| `name` | string | Display name (Key is the ID). |
| `tribe` | Tribe | Tribe. |
| `cost` | number | Deployment cost (1 - 6). |
| `stats` | object | BaseStats object. |
| `resistances` | object | Resistances object. |

## 4. items.json (ItemData/Weapon)
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique ID. |
| `name` | string | Japanese display name. |
| `type` | `WEAPON` | Item type. |
| `rarity` | `R` \| `SR` \| `SSR` \| `UR` | Rarity. |
| `weaponRarity` | string | Same as rarity. |
| `archetype` | `LOW` \| `MID` \| `HIGH` \| `MYTHIC` | Power archetype. |
| `rank` | number | 1 - 5 (Resonance rank). |
| `ilv` | number | 1 - 90 (Item level). |
| `isUnique` | boolean | true for unique items. |
| `stats` | object | Fixed stats (usually empty, handled by rank/ilv). |
| `subOptions` | SubOption[] | `{ type, value }` |
| `passiveA/B` | WeaponPassive | `{ nameJa, descTemplate, values[], condition?, systemTag? }` |

## 5. ch1_scenes.json (Story Scene)
| Field | Type | Description |
|---|---|---|
| `id` | string | UPPER_SNAKE_CASE unique ID. |
| `type` | SceneType | `DIALOGUE` \| `MONOLOGUE` \| `ENVIRONMENT` \| `CHAPTER_TITLE` |
| `trigger` | object | `{ type (STAGE_CLEAR\|etc.), stageId?, bossStageId?, flagKey? }` |
| `onComplete` | object | `{ setFlag?, navigateTo?, unlockArea? }` |
| `lines` | object[] | `{ speaker, speakerJa, text, portraits[], expression?, vfx?, bgm? }` |

## 6. characters.json (Story Character)
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique ID. |
| `nameJa` | string | Japanese display name. |
| `nameEn` | string | English display name. |
| `color` | string | HEX color for dialogue name. |
| `portraitBase` | string | Path prefix for portrait images. |
| `expressions` | string[] | Array of valid expression IDs. |
