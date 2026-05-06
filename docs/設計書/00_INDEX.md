# Necromance Brave — 設計書インデックス

> 最終更新: 2026-05-06  
> AIエージェントの新セッション開始時はまずこのファイルを読む。

## プロジェクト概要

**ネクロマンス・ブレイブ** — 魔族の少年が「親友への復讐」と「魔王への道」という2つの相反する目的を追うダークファンタジーRPG。勇者の力（職業システム）と魔族の力（死霊術）を組み合わせて戦う。Gothic-Morphism デザイン（Void Purple #8B00FF / Obsidian Glass）で Star Rail / Genshin クオリティを目指す。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Framework | Next.js 15 (App Router, SPA) |
| UI | React 19, Tailwind CSS v4, Framer Motion |
| Game | PixiJS 8 (BattleCanvas, MapCanvas) |
| State | Zustand 5 |
| Backend | Next.js Server Actions, Prisma 6 |
| DB | PostgreSQL |
| Test | Jest (unit), Playwright (E2E) |

## コア定数

| 定数 | 値 |
|---|---|
| ステータス種別 | 8種: hp / atk / def / spd / critRate / critDmg / effectHit / effectRes |
| 戦闘リソース | Energy: currentEnergy / maxEnergy（旧 `mpCost` 名はマスターデータ互換のため維持） |
| 属性ダメージ加成 | FIRE / WATER / THUNDER / EARTH / WIND / ICE / LIGHT / DARK |
| 属性種別 | 9種: FIRE / WATER / THUNDER / EARTH / WIND / LIGHT / DARK / ICE / NONE |
| 攻撃種別 | 6種: SLASH / STRIKE / PROJECTILE / MAGIC / SUMMON / HEAL |
| 職業数 | 12種実装済 (Tier1: 4, Tier2: 8) |
| パーティ枠 | 3スロット固定 |
| 死霊術最大Lv | 99 (到達→RankUp転生) |
| 死霊術最大Rank | 10 |
| 深淵の残滓最大Lv | 20 |
| 魔神化ゲージ | 0-100 (満タンで発動、3ターン継続) |
| バトルWAVE | 最大3 (10ターン毎に進行) |

## 「この質問ならこの設計書」早引き表

| やりたいこと | 読む設計書 |
|---|---|
| ゲームの全体像・ストーリーを知りたい | [01_ゲームデザイン.md](01_ゲームデザイン.md) |
| コードのどのファイルが何をするか知りたい | [02_アーキテクチャ.md](02_アーキテクチャ.md) |
| ダメージ計算式・スキル・VFXを変えたい | [03_バトルシステム.md](03_バトルシステム.md) |
| Prismaスキーマ・型定義を変えたい | [04_データモデル.md](04_データモデル.md) |
| 死霊術・モンスター編成ロジックを変えたい | [05_死霊術システム.md](05_死霊術システム.md) |
| 新しい画面・コンポーネントを追加したい | [06_UIコンポーネント.md](06_UIコンポーネント.md) |
| デザイン・カラー・アニメーションのルールを知りたい | [07_デザインシステム.md](07_デザインシステム.md) |
| テストを追加・修正したい | [08_テスト戦略.md](08_テスト戦略.md) |
| ステータス計算・装備画面の表示を変えたい | [09_ステータスシステム.md](09_ステータスシステム.md) |
| 職業・転職UI・解放条件を変えたい | [10_職業転職システム.md](10_職業転職システム.md) |

## 重要ファイルパス一覧

```
src/types/game.ts               — 全型定義の正典
src/logic/StatSystem.ts         — ステータス集計・表示ラベル・旧オプション互換
src/logic/BattleEngine.ts       — 戦闘ロジック（純粋クラス）
src/logic/GameManager.ts        — ゲームループ（サーバーサイド）
src/store/useGameStore.ts       — Zustand 全クライアント状態
src/services/MasterDataService.ts — シングルトン、JSON読み込み
src/app/page.tsx                — SPA エントリ、タブルーティング
src/components/legion/LegionHub.tsx   — EQUIP画面（1342行）
src/components/battle/BattleCanvas.tsx — バトル画面（PixiJS）
src/data/master/               — マスターデータ JSON 5ファイル
prisma/schema.prisma           — DBスキーマ
src/app/globals.css            — Gothic-Morphism CSS変数
tailwind.config.ts             — デザイントークン定義
```

## 既存 docs/ ファイルの位置付け

| ファイル | 位置付け |
|---|---|
| `docs/requirements.md` | GDD原文（GDD-001〜GDD-008）。設計書01の参照元として保持 |
| `docs/追加要件.md` | 追加要件のドラフト。設計書01に反映済み |
| `docs/TDD.md` | 技術メモ（旧版）。設計書02/03/04/08に吸収済み |
| `docs/battle-skill-effects.md` | スキル・VFX設計メモ。設計書03に統合済み |
| `docs/AGENT_DESIGN.md` | エージェント運用設計。設計書外のメタドキュメント |
