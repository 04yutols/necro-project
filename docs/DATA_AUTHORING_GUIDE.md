# データ作成ガイド — JSON & ストーリー編集マニュアル

全マスターデータは `src/data/master/` と `src/data/story/` に JSON で管理されている。
コードを触らずに追加できるものとそうでないものを区別して把握すること。

---

## 目次

1. [共通ルール](#1-共通ルール)
2. [enemies.json — 敵データ](#2-enemiesjson--敵データ)
3. [stages.json — ダンジョン定義](#3-stagesjson--ダンジョン定義)
4. [monsters.json — 召喚モンスター](#4-monstersjson--召喚モンスター)
5. [items.json — 武器・アイテム](#5-itemsjson--武器アイテム)
6. [materials.json — 強化素材](#6-materialsjson--強化素材)
7. [ch1_scenes.json — ストーリーシーン](#7-ch1_scenesjson--ストーリーシーン)
8. [characters.json — ストーリーキャラクター](#8-charactersjson--ストーリーキャラクター)
9. [コード変更が必要なケース](#9-コード変更が必要なケース)
10. [クロスリファレンス一覧](#10-クロスリファレンス一覧)

---

## 1. 共通ルール

- **キーは英小文字スネークケース** (`area1_node1`, `grave_soldier`)
- **キーとオブジェクト内の `id` フィールドは必ず一致させる**（MasterDataService がキーで引くため）
- **参照先が存在しないIDを使わない** — `enemyIds`, `unlockRequires`, `dropTable.itemId` はすべて対応するエントリが必要
- JSON 追加後は `npx tsc --noEmit` で型エラーがないか確認する
- `any` キャストで読んでいるので JSON の型ミスはランタイムまで検出されない。値の型は各節のフィールド表に従うこと

---

## 2. `enemies.json` — 敵データ

バトルに登場する敵キャラクター。`stages.json` の `waves[].enemyIds` から参照される。

### フィールド定義

```jsonc
"grave_soldier": {
  "id": "grave_soldier",          // キーと一致させる（必須）
  "name": "Grave Soldier",        // 英語名（内部用）
  "nameJa": "墓荒らしの骸兵",      // 日本語表示名
  "nameEn": "GRAVE SOLDIER",      // 英語表示名（UI用・大文字）
  "tier": "MINION",               // EnemyTier: MINION | ELITE | BOSS
  "tribe": "UNDEAD",              // Tribe: UNDEAD | DEMON | BEAST | HUMANOID | DRAGON | ORC
  "stats": {
    "hp": 230, "atk": 56, "def": 28, "spd": 82,
    "critRate": 0, "critDmg": 150, "effectHit": 0, "effectRes": 0
  },
  "resistances": {                // ElementType をキーに。正=耐性, 負=弱点（%）
    "LIGHT": -30, "FIRE": -10, "DARK": 35
  },
  "weaknesses": ["LIGHT", "FIRE"],  // BattleCanvas の弱点表示用（resistancesと合わせる）
  "shieldHp": 190,                // 霊的防壁HP。省略するとシールドなし
  "gimmicks": [                   // ELITE/BOSS のみ。省略可
    { "trigger": "HP_BELOW_50", "effect": "ENRAGE", "value": 1 }
  ],
  "dropTable": [                  // ドロップテーブル（個別ドロップ、rateは0〜1）
    { "type": "WEAPON", "itemId": "bone_cleaver", "rarity": "R", "rate": 0.42 },
    { "type": "MATERIAL", "itemId": "bone_chip", "rarity": "COMMON", "rate": 0.85 }
  ],
  "battle": {
    "color": "#9ca3af",           // HEX カラー（HP バーや演出色）
    "sprite": "WRAITH",           // WRAITH | GIANT | WYRM
    "size": 0.72                  // スプライトスケール（0.5〜1.1 推奨）
  },
  "description": "設計意図メモ"
}
```

### tier 設計基準

| tier | HP目安 | 役割 | shieldHp |
|---|---|---|---|
| `MINION` | 200〜400 | WAVE1の露払い・ゲージ蓄積 | なし |
| `ELITE` | 500〜900 | WAVE2の防壁持ち精鋭 | 150〜280 |
| `BOSS` | 900〜2000 | WAVE3の章ボス | 280〜400 |

### gimmick 種別

| trigger | effect | 意味 |
|---|---|---|
| `HP_BELOW_50` | `ENRAGE` | HP50%以下でATK強化 |
| `HP_BELOW_50` | `REVIVE` | HP0で1回復活 |
| `TURN_3` | `AV_DELAY` | 3ターン後に行動を遅延 |
| `ON_SHIELD_BREAK` | `SUMMON_MINIONS` | 防壁破壊時に雑魚を増援召喚 |

### 追加手順

1. `enemies.json` に新エントリを追加
2. 使う `itemId` が `items.json` または `materials.json` に存在するか確認
3. `stages.json` の任意 WAVE の `enemyIds` に追加

---

## 3. `stages.json` — ダンジョン定義

マップに表示されるノードとバトル構成。`AreaMap.tsx` が直接 import して描画する。

### フィールド定義

```jsonc
"area1_node1": {
  "id": "area1_node1",
  "name": "Grave Road Outside the Capital",
  "nameJa": "王都外縁の墓道",
  "nameEn": "GRAVE ROAD",
  "chapter": 1,
  "chapterName": "亡国の王都",
  "area": 1,                      // エリア番号（マップグループ分けに使用）
  "nodeType": "DUNGEON",          // SAFE | DUNGEON | BOSS
  "element": "DARK",              // ノードの属性色（ElementType）
  "difficulty": 1,                // 1〜5 目安（表示用）
  "description": "説明文（ステージ選択画面に表示）",
  "waveCount": 3,                 // waves 配列の長さと一致させる
  "unlockRequires": [],           // 解放に必要な stageId の配列。空=最初から解放
  "waves": [
    {
      "label": "WAVE 1",
      "role": "WARMUP",           // WARMUP | SHIELD | BOSS
      "enemyIds": ["grave_soldier", "rot_hound"],
      "intent": "設計意図メモ（コードには影響しない）"
    }
  ],
  "rewards": {
    "baseExp": 620,
    "baseGold": 1180,
    "dropTable": [
      { "type": "WEAPON", "itemId": "bone_cleaver", "rarity": "R", "rate": 0.55 },
      { "type": "RESIDUE", "rarity": "RARE", "rate": 0.65 }  // itemId 不要
    ]
  },
  "position": { "x": 188, "y": 422 },  // AreaMap 上のピクセル座標
  "isAreaBoss": true                    // ボスノードのみ true（省略可）
}
```

### nodeType の違い

| nodeType | 戦闘 | 用途 |
|---|---|---|
| `SAFE` | なし | 拠点・ロアー説明。`waveCount: 0`, `waves: []` |
| `DUNGEON` | あり | 通常ステージ |
| `BOSS` | あり | エリアボス。`isAreaBoss: true` を付ける |

### dropTable の type 別ルール

| type | 必要フィールド | 備考 |
|---|---|---|
| `WEAPON` | `itemId`, `rarity` | `items.json` にエントリが必要 |
| `RESIDUE` | `rarity` のみ | `RARE` / `EPIC` / `LEGENDARY` |
| `MATERIAL` | `itemId`, `rarity` | `materials.json` にエントリが必要 |
| `MONSTER` | `monsterId` | `monsters.json` にエントリが必要 |

`isHidden: true` を付けると UI でドロップ率が非表示になる（UR向け）。

### 解放チェーンの設計

```
area1_safe (解放不要)
  └─ area1_node1  ← unlockRequires: []
      └─ area1_node2 ← unlockRequires: ["area1_node1"]
          └─ area1_boss ← unlockRequires: ["area1_node2"]
              └─ area1_node3 ← unlockRequires: ["area1_boss"]
```

`unlockRequires` は配列なので複数条件も可能。

### 追加手順

1. `stages.json` に新エントリを追加
2. `position` を他ノードとかぶらないよう設定（AreaMap はピクセル座標で描画）
3. `unlockRequires` に前提ステージのIDを設定
4. `waves[].enemyIds` が `enemies.json` に存在するか確認
5. ストーリーを発火したい場合は `ch1_scenes.json` にシーンを追加

---

## 4. `monsters.json` — 召喚モンスター

プレイヤーが編成する死霊術のモンスター。`enemies.json` とは別ファイル。

### フィールド定義

```jsonc
"skeleton": {
  "name": "Skeleton",             // id は JSON キーで管理（"id"フィールドなし）
  "tribe": "UNDEAD",              // Tribe: UNDEAD | DEMON | BEAST | HUMANOID | DRAGON | ORC
  "cost": 1,                      // 編成コスト（1〜6 推奨）
  "stats": {
    "hp": 40, "atk": 12, "def": 8, "spd": 50,
    "critRate": 0, "critDmg": 150, "effectHit": 0, "effectRes": 0
  },
  "resistances": {
    "LIGHT": -50, "DARK": 50, "THUNDER": -15
  }
}
```

**注意**: `monsters.json` はプレイヤー保有モンスターの **ベース定義** のみ。  
実際のインベントリデータは Zustand Store（`inventoryMonsters`）に持ち、DB は Prisma の `Monster` テーブルに保存される。

### cost 設計基準

| cost | 相当感 |
|---|---|
| 1 | 雑魚クラス |
| 2 | 標準モンスター |
| 3 | 強めのモンスター |
| 4〜6 | エリートクラス（UR相当） |

---

## 5. `items.json` — 武器・アイテム

現状は **武器（WEAPON）のみ** 管理。将来的に消耗品も追加予定。

### フィールド定義

```jsonc
"bone_cleaver": {
  "id": "bone_cleaver",
  "name": "骨砕きの短剣",
  "type": "WEAPON",
  "rarity": "R",                  // R | SR | SSR | UR
  "weaponRarity": "R",            // rarity と同じ値を入れる
  "archetype": "MID",             // MID | HIGH | SUPPORT（内部分類）
  "rank": 1,                      // 1〜5（強化ランク上限）
  "ilv": 40,                      // アイテムレベル（表示用）
  "isUnique": false,              // ユニーク武器（1個のみ所持）は true
  "stats": {},                    // 固定ステータス（現在未使用）
  "subOptions": [
    { "type": "ATK%", "value": 6.2 }  // サブオプション（最大2個）
  ],
  "passiveA": {
    "nameJa": "パッシブ名",
    "descTemplate": "{value}%のATKが上昇する。",  // {value} に values[rank] が入る
    "values": [4, 5, 6, 7, 8],     // rank 1〜5 の値
    "condition": "BLEED",          // 発動条件（省略可）
    "systemTag": "SOUL_SHATTER"    // BattleEngine の特殊処理タグ（省略可）
  },
  "passiveB": { ... },            // passiveA と同構造
  "flavor": "フレーバーテキスト"
}
```

### systemTag 一覧（BattleEngine が参照）

| systemTag | 効果 |
|---|---|
| `SOUL_SHATTER` | 霊的防壁破壊時に追加ダメージ |
| `DEMON_MODE` | 魔神化ゲージ回復 |
| `ACTION_VALUE` | 会心時に行動順を前倒し |
| `GIANT_KILLING` | 特定条件下でダメージ倍率上昇 |

**新しい systemTag を追加する場合は `BattleEngine.ts` の実装も必要**（コード変更あり）。

---

## 6. `materials.json` — 強化素材

残滓強化に使う素材アイテム。`enemies.json` の `dropTable` から `MATERIAL` タイプで参照される。

### フィールド定義

```jsonc
"bone_chip": {
  "id": "bone_chip",
  "name": "骸の欠片",
  "quantity": 1,                  // デフォルト所持数（将来用）
  "expValue": 120,                // 残滓に与える強化経験値
  "rarity": "COMMON"             // COMMON | RARE | EPIC
}
```

### expValue 基準

| rarity | expValue 目安 |
|---|---|
| `COMMON` | 100〜200 |
| `RARE` | 500〜900 |
| `EPIC` | 1500〜3000 |

---

## 7. `ch1_scenes.json` — ストーリーシーン

**コードを一切触らずに追加可能**。ファイルは `scenes` 配列で管理。

### フィールド定義

```jsonc
{
  "id": "CH1_NODE1_AFTER",         // 大文字スネークケース。ユニークであること
  "type": "DIALOGUE",             // SceneType: DIALOGUE | MONOLOGUE | ENVIRONMENT | CHAPTER_TITLE
  "sequence": 13,                  // アーカイブ表示順（再生順序には影響しない）
  "trigger": {                    // 発火条件（下記トリガー種別参照）
    "type": "STAGE_CLEAR",
    "stageId": "area1_node1"
  },
  "background": "BLUR_MAP",       // 背景種別（下記参照）
  "isSkippable": true,            // プロローグ以外は true 推奨
  "archiveTitle": "初戦の手応え",  // アーカイブ一覧での表示名
  "archiveChapter": 1,            // アーカイブのチャプター分類（0=プロローグ）
  "onComplete": {                  // シーン終了時の副作用（省略可）
    "setFlag": "LINE_DEATH_SEEN", // ストーリーフラグをセット
    "navigateTo": "HOME",         // 画面遷移（"HOME" | "MAP" など）
    "unlockArea": "area2"         // エリア解放
  },
  "lines": [
    {
      "speaker": "aldo",           // characters.json の id / "narrator" / null
      "speakerJa": "アルド",       // 表示名（speaker が "narrator" でも省略可）
      "text": "セリフ本文",
      "textEn": "English text",    // 省略可（ログ画面用）
      "portraits": [               // 立ち絵指定（省略可）
        { "characterId": "aldo", "position": "LEFT", "expression": "determined" },
        { "characterId": "line", "position": "RIGHT", "expression": "smile" }
      ],
      "expression": "determined",  // speaker 自身の表情変化（portraits と併用可）
      "vfx": "soulChain",          // 演出エフェクト（省略可）
      "bgm": "battle_theme"        // BGM 変更（省略可）
    }
  ]
}
```

### トリガー種別

| type | 追加フィールド | 発火タイミング |
|---|---|---|
| `GAME_START` | なし | 初回起動時（プロローグのみ使用） |
| `STAGE_ENTER` | `stageId` | ステージ入場ボタン押下時 |
| `STAGE_CLEAR` | `stageId` | バトル終了・クリア確定時 |
| `BOSS_CLEAR` | `bossStageId` | BOSS ノードのクリア時（STAGE_CLEAR と同時発火可） |
| `FLAG_SET` | `flagKey` | onComplete で setFlag されたフラグが立った直後 |
| `AREA_UNLOCK` | `areaId` | onComplete で unlockArea されたエリアが解放時 |
| `DEMONIZE_FIRST` | なし | 初回魔神化発動時（1回のみ） |
| `MANUAL` | `sceneId` | アーカイブからの手動再生専用 |

**同じ stageId に複数シーン設定可能** — sequence の小さい順にキューへ積まれる。

### type 別の表示コンポーネント

| type | 表示形式 |
|---|---|
| `DIALOGUE` | キャラ立ち絵 + セリフ（下部）。portraits 指定推奨 |
| `MONOLOGUE` | 全画面テキスト + ナレーション |
| `ENVIRONMENT` | 背景 + テキストのみ（立ち絵なし） |
| `CHAPTER_TITLE` | 章タイトルカード。lines は空配列でよい |

### background 種別

| 値 | 見た目 |
|---|---|
| `DARK` | 真っ黒 |
| `SEPIA` | セピア調フィルター |
| `BLOOD_RED` | 血のような赤暗闇 |
| `RUIN_LIGHT` | 廃墟の逆光 |
| `BLUR_MAP` | マップ画面をぼかした背景 |
| `STAGE_DARK` | ステージ暗転 |

### vfx 一覧

| 値 | 演出 |
|---|---|
| `soulChain` | 魂の鎖エフェクト |
| `demonRingConverge` | 魔族の紋章収束 |
| `ssrGoldPillar` | 金の光柱 |
| `cursedPillarBreath` | 呪いの吐息 |

### 追加手順

1. `ch1_scenes.json` の `scenes` 配列に新しいオブジェクトを追記
2. `id` がファイル内でユニークか確認
3. `trigger.stageId` が `stages.json` に存在するか確認
4. `speaker` が `characters.json` に存在するか確認（`narrator` は特別扱いで常に有効）
5. 保存 → `useStoryTrigger` が自動的に新シーンを検出して発火

---

## 8. `characters.json` — ストーリーキャラクター

ストーリーシーンで立ち絵を表示するキャラクターの設定。

### フィールド定義

```jsonc
"aldo": {
  "id": "aldo",
  "nameJa": "アルド",
  "nameEn": "Aldo",
  "color": "#B09FF8",             // セリフ名表示色（HEX）
  "glow": "rgba(176,159,248,0.55)", // グロー色
  "portraitBase": "/images/story/aldo",  // 立ち絵画像のベースパス
  "expressions": ["default", "determined", "sad", "angry", "shocked", "smile"]
  // expressions に含まれない値を DialogueLine.expression に使うとフォールバックする
}
```

立ち絵画像は `{portraitBase}/{expression}.png` のパスで参照される（現状は未実装、SVGプレースホルダー）。

### 追加手順

1. `characters.json` に新エントリを追加
2. `ch1_scenes.json` の `speaker` / `portraits[].characterId` で参照

---

## 9. コード変更が必要なケース

JSON だけでは完結しない追加作業の一覧。

| やりたいこと | 必要なコード変更 |
|---|---|
| 新しい `systemTag` を武器に追加 | `BattleEngine.ts` に処理を実装 |
| 新しい `gimmick.effect` を追加 | `BattleEngine.ts` に処理を実装 |
| 新しい `vfx` を追加 | `DialogueScene.tsx` / `MonologueOverlay.tsx` に演出追加 |
| 新しい `background` 種別を追加 | ストーリーコンポーネントに背景定義を追加 |
| 第2章エリアのマップを追加 | `AreaMap.tsx` のエリアグループ定義を拡張 |
| 新しい `sprite` 種別を追加 | `BattleCanvas.tsx` のスプライト描画処理を追加 |
| プロローグ以外の `GAME_START` トリガー | `useStoryTrigger.ts` に追加ロジックが必要 |

---

## 10. クロスリファレンス一覧

JSONファイル間の参照関係。追加・削除時にここを確認すること。

```
stages.json
  waves[].enemyIds ──────────────→ enemies.json（キー）
  rewards.dropTable.itemId ──────→ items.json（キー）
  rewards.dropTable.itemId ──────→ materials.json（キー）
  rewards.dropTable.monsterId ───→ monsters.json（キー）

enemies.json
  dropTable.itemId ──────────────→ items.json（キー）
  dropTable.itemId ──────────────→ materials.json（キー）

ch1_scenes.json
  trigger.stageId ───────────────→ stages.json（キー）
  trigger.bossStageId ───────────→ stages.json（キー）
  lines[].speaker ───────────────→ characters.json（キー）/ "narrator" は固定
  lines[].portraits[].characterId→ characters.json（キー）

items.json
  （他ファイルから参照されるのみ。参照元はなし）

materials.json
  （他ファイルから参照されるのみ。参照元はなし）

monsters.json
  （他ファイルから参照されるのみ。参照元はなし）
```
