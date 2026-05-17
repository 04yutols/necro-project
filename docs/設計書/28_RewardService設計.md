# 28 — RewardService 詳細設計

> 対象タスク: `CH1_TODO.md` Phase A  
> `src/services/RewardService.ts` — ドロップ処理（R/SR/SSR武器 + 残滓 + モンスタードロップ）

---

## 1. ギャップ分析（現状 vs 必要）

| 観点 | 現状 | 必要 |
|---|---|---|
| 戻り値型 | `{ items: string[], monsters: string[] }` | 完全型付き `StageDropResult` |
| WEAPON 処理 | `itemId` 文字列を返すだけ | `items.json` から `ItemData` を生成 |
| RESIDUE 処理 | 未実装 | ランダム main stat + sub options で `AbyssalResidueData` を生成 |
| MATERIAL 処理 | 未実装 | `materials.json` から `ResidueMatData` を返す |
| MONSTER 処理 | 未実装 | 第1章では drop table に MONSTER エントリなし → スケルトン維持 |
| Hidden UR | 未実装 | `isHidden: true` → 第2章以降に先送り（スキップ） |
| 乱数注入 | `Math.random()` ハードコード | `rng?: () => number` パラメータで注入可能にしテスト容易化 |

---

## 2. 型定義

### `StageDropResult`（新規）

```typescript
export interface StageDropResult {
  weapons:   ItemData[];
  consumables: ItemData[];
  residues:  AbyssalResidueData[];
  materials: ResidueMatData[];
  monsters:  MonsterData[];      // 第1章では常に []
}
```

### ResidueSlot（内部定数）

```typescript
const RESIDUE_SLOTS = ['head', 'arms', 'chest', 'waist', 'legs'] as const;
type ResidueSlot = typeof RESIDUE_SLOTS[number];
```

---

## 3. 内部データ定数

### 3-a. メインステータスプール（スロット別）

| slot | 候補 |
|---|---|
| `head` | HP_FLAT[320-560], HP%[8-14] |
| `arms` | ATK_FLAT[80-140], ATK%[8-14] |
| `chest` | ATK%[8-16], HP%[8-16], DEF%[8-16], CRIT_RATE[5-12], CRIT_DMG[10-24] |
| `waist` | ATK%[8-16], HP%[8-16], DARK_DMG_BOOST[10-22], FIRE_DMG_BOOST[10-22], WATER_DMG_BOOST[10-22] |
| `legs` | CRIT_RATE[5-16], CRIT_DMG[10-32], SPD%[5-12] |

値は `range[0] + rng() * (range[1] - range[0])` で 1桁丸め。

### 3-b. サブオプションプール（共通10種）

```
ATK%[2-8], HP%[2-8], DEF%[2-8],
ATK_FLAT[10-40], HP_FLAT[50-150], DEF_FLAT[10-40],
CRIT_RATE[1-7], CRIT_DMG[2-14], EFFECT_HIT[1-6], EFFECT_RES[1-6]
```

メインステータスと重複しない候補から抽選（型が同一のものを除外）。

### 3-c. サブ数・maxExp（レアリティ別）

| rarity | subCount | maxExp |
|---|---|---|
| COMMON | 1-2 | 800 |
| RARE | 2-3 | 2500 |
| EPIC | 3-4 | 5000 |
| LEGENDARY | 4 | 8000 |

### 3-d. 残滓名プール

```typescript
const RESIDUE_NAMES: Record<AbyssalResidueData['rarity'], string[]> = {
  COMMON:    ['骸の指輪', '虚ろの護符', '亡者の欠片', '幽霊の痕跡'],
  RARE:      ['深淵の残滓', '魔骨の砕片', '怨霊の結晶', '冥界の遺物'],
  EPIC:      ['奈落の紋章', '魂喰いの印', '深淵王の礎', '竜骨の至宝'],
  LEGENDARY: ['神骸の結晶', '深淵神の欠片'],
};
```

---

## 4. 主要メソッド設計

### 4-a. `generateResidueId()`（private static）

```typescript
private static generateResidueId(): string {
  // crypto.randomUUID() はNext.jsサーバーサイドで使用可。
  // クライアント（BattleCanvas）でも Web Crypto API により使用可。
  return `res_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
```

### 4-b. `generateResidue(rarity, rng)` → `AbyssalResidueData`（private static）

```typescript
private static generateResidue(
  rarity: AbyssalResidueData['rarity'],
  rng: () => number = Math.random,
): AbyssalResidueData {
  // 1. ランダムスロット選択
  const slot = RESIDUE_SLOTS[Math.floor(rng() * RESIDUE_SLOTS.length)] as ResidueSlot;

  // 2. メインステータス選択・値ロール
  const mainPool = MAIN_STAT_POOLS[slot];
  const mainDef = mainPool[Math.floor(rng() * mainPool.length)];
  const mainValue = parseFloat((mainDef.range[0] + rng() * (mainDef.range[1] - mainDef.range[0])).toFixed(1));

  // 3. サブ数確定
  const [subMin, subMax] = SUB_COUNT_RANGE[rarity];
  const subCount = subMin + Math.floor(rng() * (subMax - subMin + 1));

  // 4. サブオプション抽選（メイン型と重複除外）
  const available = SUB_OPTION_POOL.filter(s => s.type !== mainDef.type);
  const shuffled = [...available].sort(() => rng() - 0.5);
  const subOptions = shuffled.slice(0, subCount).map(s => ({
    type: s.type,
    value: parseFloat((s.range[0] + rng() * (s.range[1] - s.range[0])).toFixed(1)),
  }));

  // 5. 名前選択
  const namePool = RESIDUE_NAMES[rarity];
  const name = namePool[Math.floor(rng() * namePool.length)];

  return {
    id:         RewardService.generateResidueId(),
    name,
    itemId:     slot,
    rarity,
    mainStat:   { type: mainDef.type, value: mainValue },
    subOptions,
    level:      1,
    exp:        0,
    maxExp:     MAX_EXP[rarity],
  };
}
```

### 4-c. `processDropTable(dropTable, discoveryBonusRate, rng)` → `StageDropResult`（public）

```typescript
public processDropTable(
  dropTable: DropEntry[],
  discoveryBonusRate: number = 0,
  rng: () => number = Math.random,
): StageDropResult {
  const result: StageDropResult = { weapons: [], residues: [], materials: [], monsters: [] };
  const mds = MasterDataService.getInstance();
  const multiplier = 1 + discoveryBonusRate / 100;

  for (const entry of dropTable) {
    // Hidden UR は第2章以降（スキップ）
    if (entry.isHidden) continue;

    const roll = rng();
    if (roll >= entry.rate * multiplier) continue;

    switch (entry.type) {
      case 'WEAPON': {
        if (!entry.itemId) break;
        const master = mds.getItem(entry.itemId);
        if (!master) break;
        // インスタンス ID を付与してコピー生成（rank=0 初期状態）
        const weapon: ItemData = {
          ...master,
          id:   `${master.id}_${Date.now()}_${Math.floor(rng() * 1e5)}`,
          rank: 0,
        };
        result.weapons.push(weapon);
        break;
      }
      case 'RESIDUE': {
        const rarity = (entry.rarity ?? 'COMMON') as AbyssalResidueData['rarity'];
        result.residues.push(RewardService.generateResidue(rarity, rng));
        break;
      }
      case 'MATERIAL': {
        if (!entry.itemId) break;
        const mat = mds.getMaterial(entry.itemId);
        if (mat) result.materials.push({ ...mat, id: `${mat.id}_${Date.now()}` });
        break;
      }
      case 'MONSTER': {
        // 第1章ドロップテーブルには MONSTER エントリなし → 将来拡張用
        break;
      }
    }
  }

  return result;
}
```

### 4-d. `calculateExp`（既存維持・シグネチャ変更なし）

```typescript
public calculateExp(baseExp: number, player: CharacterData): number { /* 既存ロジック */ }
```

---

## 5. useGameStore — 追加アクション

`setInventoryItems` / `setAbyssalResidues` は配列全体を上書きするため、
ドロップ追加に不向き。以下を新規追加する。

```typescript
// GameState インターフェース追加
addInventoryItems:   (items: ItemData[]) => void;
addAbyssalResidues:  (residues: AbyssalResidueData[]) => void;
addResidueMaterials: (mats: ResidueMatData[]) => void;

// 実装（useGameStore create 内）
addInventoryItems: (items) => set((state) => ({
  inventoryItems: [...state.inventoryItems, ...items],
})),
addAbyssalResidues: (residues) => set((state) => ({
  abyssalResidues: [...state.abyssalResidues, ...residues],
})),
addResidueMaterials: (mats) => set((state) => ({
  residueMaterials: [...state.residueMaterials, ...mats],
})),
```

---

## 6. 呼び出しフロー（ResultScreen）

```
BattleCanvas: バトル終了シグナル
  → ResultScreen が stageData.rewards.dropTable を取得
  → new RewardService().processDropTable(dropTable, discoveryBonusRate)
  → StageDropResult を useGameStore に適用:
       addInventoryItems([...result.weapons, ...result.consumables])
       addAbyssalResidues(result.residues)
       addResidueMaterials(result.materials)
  → calculateExp(stageData.rewards.baseExp, player) → addExp(exp)
  → addGold(stageData.rewards.baseGold)
  → addClearedStage(stageId)
```

ResultScreen は現在 `src/components/battle/ResultScreen.tsx` にある。
DB 連携前は全てクライアント側（Phase A の DB タスクとは独立実装可）。

---

## 7. テスト仕様（`RewardService.test.ts`）

| # | テストケース | アサーション |
|---|---|---|
| 1 | WEAPON ドロップ rate=1.0 | weapons.length=1, id≠master.id, rank=0 |
| 2 | WEAPON ドロップ rate=0.0 | weapons.length=0 |
| 3 | RESIDUE RARE 生成 | rarity='RARE', subOptions.length∈[2,3], level=1, maxExp=2500 |
| 4 | RESIDUE EPIC 生成 | rarity='EPIC', subOptions.length∈[3,4] |
| 5 | MATERIAL ドロップ | materials[0].id が 'bone_chip_' で始まる, expValue=120 |
| 6 | isHidden=true → スキップ | weapons.length=0（rate=1.0 でも） |
| 7 | discoveryBonusRate=50 で rate=0.68 のドロップ → 命中 | rng()=0.99 で rate×1.5=1.02 → roll < 1.02 → 取得 |
| 8 | 同一 rng() で決定論的に同じ結果 | 2回呼び出し結果が一致 |
| 9 | RESIDUE メインとサブが重複しない | mainStat.type ∉ subOptions.map(s=>s.type) |
| 10 | calculateExp — MAGICAL 1.1× | result = Math.floor(baseExp × levelFactor × 1.1) |

---

## 8. 実装チェックリスト

```
[ ] 定数（MAIN_STAT_POOLS / SUB_OPTION_POOL / RESIDUE_NAMES / SUB_COUNT_RANGE / MAX_EXP）定義
[ ] generateResidueId() 実装
[ ] generateResidue(rarity, rng) 実装
[ ] processDropTable(dropTable, discoveryBonusRate, rng) 実装
[ ] 旧 calculateDrops を削除（または processDropTable に統合）
[ ] useGameStore: addInventoryItems / addAbyssalResidues / addResidueMaterials 追加
[ ] RewardService.test.ts 10ケース全Pass
[ ] npx tsc --noEmit エラー 0
```

---

## 9. 対象外（第2章以降 DEFERRED）

- `isHidden: true` UR 武器の第一発見者システム（`ItemSerialCounter` + `Prisma $transaction`）
- MONSTER ドロップ（第1章ドロップテーブルに存在しない）
- 武器の確定排出・ピックアップレート
- DB 保存（`processStageResult` Phase A DB タスクで実装）
