# Necromance Brave マスターデータスキーマ

実フィールド定義は `src/types/game.ts`（EnemyData / StageData / JobData / SkillData /
DemonFormData / ItemData / MonsterData / ResidueMatData / ResidueNameData / AreaData）が正。
ここでは authoring に必要な要点と基準値をまとめる。

## 1. enemies.json (EnemyData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` | string | snake_case。キーと一致させる。 |
| `name` | string | 英語内部名。 |
| `nameJa` / `nameEn` | string | 日本語表示名 / 英語表示名（UPPERCASE）。 |
| `tier` | `MINION` \| `ELITE` \| `BOSS` | 階級。 |
| `tribe` | `UNDEAD` \| `DEMON` \| `BEAST` \| `HUMANOID` \| `DRAGON` \| `ORC` | 種族。 |
| `stats` | object | `{ hp, atk, def, spd, critRate, critDmg, effectHit, effectRes }`（8種）。 |
| `resistances` | object | ElementType キー、% 値（正=耐性、負=弱点）。 |
| `weaknesses` | ElementType[] | 表示用弱点。負の resistances と整合させる。 |
| `shieldHp` / `maxShieldHp` | number | 任意。霊的防壁 HP（両方同値で設定）。 |
| `gimmicks` | BossGimmick[] | 任意（ELITE/BOSS）。`{ trigger, effect, value? }`。trigger: HP_BELOW_50 / TURN_3 / ON_SHIELD_BREAK / ON_REVIVE。effect: ENRAGE / AV_DELAY / REVIVE / SUMMON_MINIONS。 |
| `necromance` | object | 任意。`{ captureRate, allyCost, allyStats, skillIds[] }` — ネクロマンスで味方化したときの設定。skillIds は skills.json 参照。 |
| `dropTable` | DropEntry[] | `{ type (WEAPON/MATERIAL/CONSUMABLE/RESIDUE/MONSTER), itemId?, monsterId?, rarity?, quantity?, rate, isHidden? }` |
| `battle` | object | `{ color (HEX), sprite (WRAITH\|GIANT\|WYRM), size (0.5-1.1) }` |
| `description` | string | 任意。設計意図メモ。 |

### Stats Criteria（第1章実数値ベース）

| Tier | HP | Shield HP | 実例 |
|---|---|---|---|
| `MINION` | 12 - 46 | なし | grave_soldier hp15, bloodmire_leech hp46 |
| `ELITE` | 36 - 72 | 18 - 24 | abyss_warden hp36/sh18, bone_colossus hp72/sh24 |
| `BOSS` | 90 - 150 | 34 - 48 | ossuary_wyrm_lord hp90/sh34, blood_mire_queen hp150/sh48 |

後続章は緩やかにスケールさせる。隣接ステージ間の総 EHP 増加は、明示的な推奨ゲートが
ない限り 2.5 倍未満に抑える。critDmg の基礎は 150。

## 2. stages.json (StageData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` | string | キーと一致。 |
| `name` / `nameJa` / `nameEn` | string | 内部名 / 日本語 / 英語（UPPERCASE）。 |
| `chapter` / `chapterName` | number / string | 章番号・章タイトル。 |
| `area` | number | エリア番号。(chapter, area) の組が areas.json に存在すること。 |
| `nodeType` | `SAFE` \| `DUNGEON` \| `BOSS` | ノード種別。SAFE は waveCount 0。 |
| `element` | ElementType | ノードの色/テーマ。 |
| `difficulty` | number | 0 - 5。 |
| `description` | string | 説明文。 |
| `waveCount` | number | waves 配列長と一致させる。 |
| `areaGimmick` | `SLIP_DAMAGE` \| `STATUS_AILMENT` \| `NONE` | 任意。エリアギミック。 |
| `unlockRequires` | string[] | 解放に必要なステージ ID。 |
| `waves` | StageWaveData[] | `{ label, role (WARMUP\|SHIELD\|ELITE\|BOSS), enemyIds[], intent }` |
| `rewards` | object | `{ baseExp, baseGold, dropTable: DropEntry[] }` |
| `position` | object | AreaMap 上の `{ x, y }` ピクセル座標。既存ノードと重ねない。 |
| `isAreaBoss` | boolean | 任意。エリアボスなら true。 |

## 3. monsters.json (MonsterData ベース) — **キーが ID（`id` フィールドなし）**

| Field | Type | Description |
|---|---|---|
| `name` | string | 英語内部名。 |
| `tribe` | Tribe | 種族。 |
| `cost` | number | 編成コスト（1 - 6）。necroStatus.maxCost に対し検証される。 |
| `stats` | object | BaseStats（8種）。 |
| `resistances` | object | Resistances。 |

## 4. items.json (ItemData) — キー = `id`

`type` は `WEAPON` か `CONSUMABLE`（現データの実使用範囲）。

**武器:**
| Field | Type | Description |
|---|---|---|
| `id` / `name` | string | name は日本語表示名。 |
| `type` | `WEAPON` | |
| `rarity` / `weaponRarity` | `R` \| `SR` \| `SSR` \| `UR` | 同値を設定。 |
| `archetype` | `LOW` \| `MID` \| `HIGH` \| `MYTHIC` | パワーアーキタイプ。 |
| `rank` | number | 0 - 5（魂の共鳴ランク）。 |
| `ilv` | number | 1 - 90（打ち直しで上昇）。 |
| `isUnique` | boolean | UR は true + `isUR: true`。 |
| `stats` | object | 通常は空 `{}`（rank/ilv で計算）。 |
| `subOptions` | SubOption[] | `{ type ('ATK%'/'CRIT_RATE'/'CRIT_DMG'/'DARK_DMG_BOOST' 等), value }` |
| `passiveA` / `passiveB` | WeaponPassive | `{ nameJa, descTemplate ('{value}%' 埋め込み), values[5] (ランク1-5), condition?, systemTag? }`。SR 以上は passiveB も設定。 |
| `icon` / `flavor` | string | 任意。 |

**消耗品:** `{ id, name, type: 'CONSUMABLE', rarity, quantity?, battleUsable?, battleEffect: { type (HEAL_HP/RESTORE_ENERGY/RESTORE_SOUL), value } }`

## 5. skills.json (SkillData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` | string | 例: `skill_warrior_1`, `ult_warrior`。 |
| `name` | string | 日本語スキル名。 |
| `mpCost` | number | エネルギーコスト（旧名のまま互換維持）。 |
| `power` | number | 倍率。設計書19 §2.2 のレンジに従う。 |
| `type` | `PHYSICAL` \| `MAGICAL` \| `HEAL` | |
| `element` | ElementType | NONE 可。 |
| `attackType` | `SLASH` \| `STRIKE` \| `PROJECTILE` \| `MAGIC` \| `SUMMON` \| `HEAL` | |
| `targetType` | `SINGLE` \| `ALL_ENEMIES` \| `SELF` \| `ALLY` | |
| `effectKey` | string | `<element>_<attackType>` 小文字（例: `dark_slash`）。 |
| `isUltimate` | boolean | 任意。true で maxEnergy 全消費の奥義。 |
| `ailments` | `{ type: AilmentType, baseRate }[]` | 任意。BLEED/POISON/BURN/FREEZE/PARALYSIS/WEAKEN。 |
| `healSelfPct` / `flags` | number / string[] | 任意。 |
| `description` | string | 30文字以内推奨。 |

## 6. jobs.json (JobData) — **キーが ID（`id` フィールドなし）**

Tier1 ×4 + Tier2 ×8 の 12 職業構成。

| Field | Type | Description |
|---|---|---|
| `name` / `displayName` / `nameEn` / `title` | string | 内部名 / 日本語名 / 英語名 / 肩書。 |
| `tier` | 1 \| 2 | |
| `category` | `PHYSICAL` \| `MAGICAL` | |
| `baseAttackType` | SkillAttackType | 通常攻撃の種別。 |
| `unlock` | object | 任意（Tier2）。`{ jobs: [{ jobId, minLevel }], clearedStageId? }` |
| `statModifiers` | Partial\<BaseStats\> | 職業補正倍率。 |
| `energyCurve` | object | `{ baseMaxEnergy, ultimateCost, spGrowthPerLevel }` |
| `levelBonuses` | Record<level, Partial\<PassiveBonuses\>> | 転職後も残る永続パッシブ。 |
| `skills` | `{ level, skillId }[]` | **文字列配列ではない。** 習得レベル付き。 |
| `baseStatsByLevel` | Record<"1".."100", BaseStats> | 装備なし基礎ステータステーブル。 |

## 7. demonForms.json (DemonFormData) — **キー = `jobId`**

12 形態（jobs.json の全職業と 1:1 対応）。

| Field | Type | Description |
|---|---|---|
| `jobId` | string | キーと一致。jobs.json のキーに存在すること。 |
| `formName` / `tier` / `concept` | string / 1\|2 / string | |
| `effectA` | object | `{ descJa, statBoosts (BaseStats キーの倍率), flags? }` |
| `effectB` | object | `{ descJa, riskType (SELF_DAMAGE/ENERGY_DRAIN/GLASS_CANNON/SETUP_DEPENDENT/null), riskValue?, onAttackEffect? }` |
| `ultimateSkill` | object | `{ nameJa, damage: { power, element, targetType (SINGLE\|ALL), attackType?, flags? }, lingering: { type (FIELD\|PARTY_BUFF\|ENEMY_DEBUFF), descJa, duration } }` |
| `visual` | object | `{ color, soft, icon }` |

## 8. materials.json (ResidueMatData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` / `name` | string | |
| `quantity` | number | 基本 1。 |
| `expValue` | number | 残滓強化時の EXP 値。 |
| `rarity` | `COMMON` \| `RARE` \| `EPIC` \| `LEGENDARY` | |

## 9. areas.json (AreaData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` | string | 例: `ch1_area1`。 |
| `chapter` / `area` | number | stages.json の (chapter, area) から参照される。 |
| `nameJa` / `nameEn` / `description` | string | |
| `color` | string | HEX。 |
| `position` | `{ x, y }` | ワールドマップ座標。 |
| `sortOrder` | number | 任意。 |

## 10. residueNames.json (ResidueNameData) — キー = `id`

| Field | Type | Description |
|---|---|---|
| `id` / `name` | string | id はキーと一致。name は日本語表示名。 |
| `rarity` | `COMMON` \| `RARE` \| `EPIC` \| `LEGENDARY` | 各rarityに最低1件必要。 |
| `chapter` | number | 名称の世界観上の出典章。 |
| `origin` | string | 由来を示す短いフレーバー。 |
| `tags` | string[] | 亡国、王権、深淵などの検索・重複確認用タグ。 |

`mainStat` / `subOptions` / `stats` / `power` / `effect` は禁止。残滓性能は
`RewardService` の決定論的抽選が所有し、名称制作と混ぜない。

## 11. src/data/story/ （master 外・参考）

`ch1_scenes.json` は `{ "scenes": [...] }` — **配列**（キー付きオブジェクトではない）。

| Field | Type | Description |
|---|---|---|
| `id` | string | UPPER_SNAKE_CASE（例: `PROLOGUE_00`）。 |
| `type` | `DIALOGUE` \| `MONOLOGUE` \| `ENVIRONMENT` \| `CHAPTER_TITLE` | |
| `sequence` | number | 再生順。 |
| `trigger` | object | `{ type (GAME_START/FLAG_SET/STAGE_ENTER/STAGE_CLEAR/BOSS_CLEAR/DEMONIZE_FIRST/AREA_UNLOCK), stageId?, flagKey? }` |
| `background` / `isSkippable` | string / boolean | |
| `archiveTitle` / `archiveChapter` | string / number | ストーリーアーカイブ表示用。 |
| `lines` | object[] | `{ speaker (characters.json の id), speakerJa?, text, textEn?, expression?, ... }` |

`characters.json`: `{ id, nameJa, nameEn, color (HEX), glow, portraitBase, expressions[] }`。
登録済み: `aldo`, `line`, `demon_king`, `narrator`。
