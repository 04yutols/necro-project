# Necromance Brave — 設計書インデックス

> 最終更新: 2026-05-10
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
| 深淵の残滓の厳選・スコア・錬成を変えたい | [11_深淵の残滓システム.md](11_深淵の残滓システム.md) |
| 残滓UI/UXの実装判断を確認したい | [12_深淵の残滓UIUX実装設計.md](12_深淵の残滓UIUX実装設計.md) |
| 深淵の残滓の排出・強化・リテンション設計を知りたい | [11_深淵の残滓システム.md](11_深淵の残滓システム.md) |
| 武器のレアリティ・パッシブ・限界突破設計を知りたい | [13_武器システム.md](13_武器システム.md) |
| 武器UI/UX・防具/装飾品廃止後の装備画面を確認したい | [14_武器UIUX実装設計.md](14_武器UIUX実装設計.md) |
| ワールド・ダンジョン・敵の階層設計と周回ループを知りたい | [15_ワールド・ダンジョン・エネミー設計.md](15_ワールド・ダンジョン・エネミー設計.md) |
| 魔神化の仕様・Tier設計ルール・新フォームの作り方を知りたい | [16_魔神化システム.md](16_魔神化システム.md) |
| 状態異常の種別・発動式・AV遅延ギミックの数値を知りたい | [17_状態異常システム.md](17_状態異常システム.md) |
| 種族シナジーの組み合わせ・数値・クロス共鳴を知りたい | [18_種族シナジーシステム.md](18_種族シナジーシステム.md) |
| スキルの power 倍率・奥義設計・状態異常レートを知りたい | [19_スキルバランス設計書.md](19_スキルバランス設計書.md) |
| VFX / アニメーションの仕様・フレームスペック・実装方針を知りたい | [21_VFXアニメーションカタログ.md](21_VFXアニメーションカタログ.md) |
| チュートリアルのスコープ・段階的解放・ツールチップ設計を知りたい | [20_チュートリアル設計.md](20_チュートリアル設計.md) |
| ストーリー進行・会話UI・章管理・トリガー設計を知りたい | [22_ストーリー進行システム.md](22_ストーリー進行システム.md) |
| BGM構成・SE仕様・AudioService・音量設定を知りたい | [23_サウンド設計.md](23_サウンド設計.md) |
| 隊列ヘイト・ドラッグ並び替え・コスト超過UI・ソートフィルタを知りたい | [24_パーティ編成システム詳細.md](24_パーティ編成システム詳細.md) |
| 認証・クラウドセーブ・ランキング・世界ログ・CI/CDの設計を知りたい | [25_オンラインゲーム設計.md](25_オンラインゲーム設計.md) |
| Phase A コアロジックの実装仕様（ヘイト/ギミック/魔神化/WeaponPassive）を知りたい | [26_コアロジック実装設計.md](26_コアロジック実装設計.md) |
| enemies.json/demonForms.json/items.json の第1章データ仕様を知りたい | [27_マスターデータ設計.md](27_マスターデータ設計.md) |
| RewardService のドロップ生成・残滓ランダム生成・useGameStore 追加アクションを知りたい | [28_RewardService設計.md](28_RewardService設計.md) |

## 重要ファイルパス一覧

```
src/types/game.ts               — 全型定義の正典
src/logic/StatSystem.ts         — ステータス集計・表示ラベル・旧オプション互換
src/logic/BattleEngine.ts       — 戦闘ロジック（純粋クラス）
src/logic/GameManager.ts        — ゲームループ（サーバーサイド）
src/store/useGameStore.ts       — Zustand 全クライアント状態
src/services/MasterDataService.ts — シングルトン、JSON読み込み
src/app/page.tsx                — SPA エントリ、タブルーティング
src/components/legion/LegionHub.tsx   — EQUIP画面・武器/5部位残滓ロードアウト
src/logic/WeaponSystem.ts       — 武器基礎ATK・共鳴・打ち直し・分解計算
src/logic/ResidueScore.ts       — 深淵の残滓スコア・5部位メタデータ
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
