# 14 — 武器UI/UX実装設計

> 最終更新: 2026-05-07  
> 対応実装: `src/components/legion/LegionHub.tsx`, `src/logic/WeaponSystem.ts`, `src/store/useGameStore.ts`

## 1. 方針

装備画面の実運用スロットは **武器 + 深淵の残滓** のみに統一する。
防具・装飾品はゲーム設計から外れたため、UI上では表示しない。

既存の `EquipmentSlots` / Prisma 互換フィールドには `body` / `acc1` などが残るが、
これは旧データ互換のための保持であり、新規UX・新規マスターデータ・ステータス閲覧では参照しない。

## 2. 画面構造

### ユニット詳細

- 左列: 武器スロットのみ
- 右列: 深淵の残滓 5スロット
- 下部: 合計ステータス、会心、属性ダメージ最大値、詳細ステータス導線

武器スロット選択時は武器庫へ遷移し、選択した武器の詳細・最終ATKプレビュー・パッシブを確認できる。

### 武器庫

タブは以下の3つ。

| タブ | 役割 |
|---|---|
| 装備 | 武器選択、FinalATKプレビュー、パッシブ確認、装備 |
| 共鳴 | 魂のイデア消費によるランクアップ、黒鋼消費による打ち直し |
| 分解 | 不要武器をイデアへ変換。URは分解不可 |

## 3. 表示する武器情報

- レアリティ: `R / SR / SSR / UR`
- 呼称: `凡庸 / 業物 / 遺物 / 理外の呪装`
- アーキタイプ: `LOW / MID / HIGH / MYTHIC`
- `ILv`
- 魂の共鳴ランク `R0〜R5`
- `WeaponBaseATK`
- `FinalATK`
- `ATKBonus%`
- 装備中武器との差分
- Effect A / Effect B の説明

## 4. ステータス連携

`src/logic/WeaponSystem.ts` を武器数理の正とする。

- `calculateWeaponBaseAttack`
  - レアリティ、アーキタイプ、ILv、共鳴ランクから基礎ATKを算出
- `calculateWeaponAttackBreakdown`
  - `FinalATK = (CharacterBaseATK + WeaponBaseATK) × (1 + ATKBonus%) + FlatATK`
- `getWeaponEffectiveSubOptions`
  - 低/中/高/神話型のサブステ係数を反映

`StatSystem` は武器システム対応アイテムの場合のみ `WeaponSystem` の基礎ATKとサブステ係数を使う。
旧モック武器は従来の `stats.atk` を維持して扱える。

## 5. 強化素材

| 素材 | 用途 |
|---|---|
| 凡骨のイデア | R武器の共鳴、将来的な上位変換 |
| 業物のイデア | SR武器の共鳴 |
| 英雄のイデア | SSR武器の共鳴、ILv90打ち直し |
| 深淵の黒鋼 | ILv打ち直し |

UR武器は怨念が固定化した異質な存在として扱い、完凸固定・分解不可にする。

## 6. 未実装として残すもの

- サーバー側 `WeaponService` トランザクション
- Prisma `Item` モデルへの `rank/archetype/ilv/passiveA/passiveB` 永続化
- `systemTag` の戦闘中効果反映
- UR発現トリガーの周回カウント連携
- 共鳴/打ち直し時の専用フルスクリーン演出

