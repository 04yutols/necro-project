# 88 — Phase 4 詳細設計書

> 作成日: 2026-06-01  
> フェーズ: Phase 4 — ダメージシミュレータ  
> ステータス: 設計完了

---

## 1. 概要

Phase 4 では `/admin/simulator` ルートを新設し、BattleEngine の計算式を管理ツールから直接検証できる  
**ダメージシミュレータ** を実装する。  
マスターデータ上の職業・スキル・敵のパラメータから期待ダメージを即時プレビューし、  
バランス調整サイクルを短縮することが目的。

---

## 2. 機能仕様

### 2.1 入力パラメータ

| セクション | パラメータ | 入力形式 | デフォルト |
|---|---|---|---|
| アタッカー | 職業 | セレクト（jobs.json） | warrior |
| アタッカー | ATK (手動上書き) | 数値入力 | 職業自動計算値 |
| アタッカー | critRate (%) | 数値入力 | 職業自動計算値 |
| アタッカー | critDmg (%) | 数値入力 | 職業自動計算値 |
| アタッカー | 属性ダメージ加成 (%) | 数値入力 | 0 |
| スキル | 対象スキル | セレクト（職業の解放スキル一覧） | 職業の第1スキル |
| スキル | power 手動上書き | 数値入力 | スキルの power 値 |
| 防衛側 | 対象敵 or カスタム | セレクト + カスタムモード | grave_soldier |
| 防衛側 | DEF (手動上書き) | 数値入力 | 敵の def 値 |
| 防衛側 | 属性耐性 (%) | 数値入力 | 敵のスキル属性に対応する resistance 値 |

### 2.2 出力

| 値 | 説明 |
|---|---|
| 通常ダメージ | isCritical = false での計算結果 |
| クリティカルダメージ | isCritical = true での計算結果 |
| 期待値 | `normal × (1 - critRate/100) + critical × (critRate/100)` |
| 計算ブレークダウン | baseDmg / defMult / elementMult / resistance 各乗数を表示 |
| 判定 | 弱点 (resistance < 0) / 耐性 (resistance > 0) バッジ |

---

## 3. ダメージ計算方式

`calculateBattleDamage` (`src/logic/BattleDamage.ts`) をそのまま呼び出す。  
クライアントサイドで直接実行するため、`rng` を差し替えて確定計算する。

```typescript
// 通常ダメージ
const normalResult = calculateBattleDamage({ ...input, rng: () => 1 });    // critRate < 100 → 非クリティカル

// クリティカルダメージ  
const critResult   = calculateBattleDamage({ ...input, rng: () => 0 });    // 必ずクリティカル

// 期待値
const critRateFrac = Math.min(100, attackerStats.critRate) / 100;
const expected     = Math.round(
  normalResult.damage * (1 - critRateFrac) + critResult.damage * critRateFrac
);
```

### 3.1 アタッカーステータス自動計算

```typescript
// INITIAL_PLAYER_BASE_STATS × job.statModifiers
const jobStats = calculateJobAdjustedStats(INITIAL_PLAYER_BASE_STATS, jobData);
// level bonuses: passiveAtkBonus / passiveDefBonus 累積
let passiveAtk = 0;
for (let lv = 1; lv <= selectedLevel; lv++) {
  const bonus = jobData.levelBonuses?.[lv.toString()];
  if (bonus?.passiveAtkBonus) passiveAtk += bonus.passiveAtkBonus;
}
const finalAtk = jobStats.atk + passiveAtk + manualAtkOffset;
```

---

## 4. ファイル構成

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/app/admin/simulator/page.tsx` | Server Component | master data 読み込み + Client に渡す |
| `src/components/admin/SimulatorClient.tsx` | Client Component | UI + リアルタイム計算 |
| `src/components/admin/AdminNav.tsx` | 既存更新 | 「シミュ」リンク追加 |
| `src/app/admin/page.tsx` | 既存更新 | ダッシュボードにシミュレータカード追加 |

---

## 5. UI レイアウト

```
┌─────────────────────────────────────────────────────┐
│ DAMAGE SIMULATOR                                     │
│                                                      │
│ [アタッカー設定]    [スキル設定]    [防衛側設定]       │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ 職業: 剣士 ▼ │  │ スキル    │  │ 対象敵: ▼    │  │
│  │ ATK: 6       │  │ 渾身斬り ▼│  │ DEF: 3       │  │
│  │ critRate: 4  │  │ power: 1.5│  │ 耐性: 0%     │  │
│  │ critDmg: 157 │  └───────────┘  └──────────────┘  │
│  │ 属性加成: 0% │                                     │
│  └──────────────┘                                    │
│                                                      │
│ ┌─────────────────────────────────────────────────┐  │
│ │   通常ダメージ   クリティカル    期待値           │  │
│ │      ██ 8           ██ 12        ██ 8            │  │
│ │                                                  │  │
│ │ [計算ブレークダウン]                              │  │
│ │ baseDmg: 6×1.5=9 → defMult×0.87 → final 8       │  │
│ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 6. 型定義（SimulatorClient に局所定義）

```typescript
type JobEntry  = { id: string; displayName: string; statModifiers: Record<string, number>; levelBonuses?: Record<string, Record<string, number>>; skills: { level: number; skillId: string }[] };
type SkillEntry= { id: string; name: string; power: number; element: ElementType; mpCost: number };
type EnemyEntry= { id: string; nameJa: string; stats: BaseStats; resistances: Record<string, number> };

type SimResult = {
  normal:   number;
  critical: number;
  expected: number;
  baseDmg:  number;
  defMult:  number;
  elementMult: number;
  resistanceMult: number;
  isCritPossible: boolean;
  isWeakness: boolean;
  isResisted: boolean;
};
```
