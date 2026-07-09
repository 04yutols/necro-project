# 完了済み一覧

> 設計書の完成・実装の完了・設計上の意思決定をアーカイブする。
> ここに載っているものは再設計・再確認不要。

---

## 設計書（全25冊 完成）

| No | ファイル | 内容 |
|---|---|---|
| 01 | 01_ゲームデザイン.md | ゲーム概要・コアループ・職業一覧・収益化 |
| 02 | 02_アーキテクチャ.md | ファイル構成・責務分担・ルーティング |
| 03 | 03_バトルシステム.md | ダメージ式・スキル・VFX・WAVEフロー |
| 04 | 04_データモデル.md | Prismaスキーマ・TypeScript型・マスターデータJSON |
| 05 | 05_死霊術システム.md | Lv/Rank・コスト制編成・魂石化・種族シナジー概要 |
| 06 | 06_UIコンポーネント.md | コンポーネント一覧・画面遷移 |
| 07 | 07_デザインシステム.md | Gothic-Morphism・カラートークン・タイポ |
| 08 | 08_テスト戦略.md | Jest / Playwright 方針 |
| 09 | 09_ステータスシステム.md | 8種ステータス・計算式・表示ラベル |
| 10 | 10_職業転職システム.md | 12職業・解放条件・転職UI |
| 11 | 11_深淵の残滓システム.md | 4層RNG・スコア・錬成・スタミナレス確定 |
| 12 | 12_深淵の残滓UIUX実装設計.md | 残滓UI実装仕様 |
| 13 | 13_武器システム.md | レアリティ・パッシブ・限界突破・分解 |
| 14 | 14_武器UIUX実装設計.md | 武器UI実装仕様 |
| 15 | 15_ワールド・ダンジョン・エネミー設計.md | ワールド構造・ノード進行・敵設計 |
| 16 | 16_魔神化システム.md | 12職業フォーム・Tier設計・魔神技 |
| 17 | 17_状態異常システム.md | 6種定義・発動式・AV遅延 |
| 18 | 18_種族シナジーシステム.md | 6種族・3層構造・クロス共鳴 |
| 19 | 19_スキルバランス設計書.md | power倍率基準・奥義設計・状態異常予算式 |
| 20 | 20_チュートリアル設計.md | 6フェーズ解放・4種ヒント・スキップ仕様 |
| 21 | 21_VFXアニメーションカタログ.md | CSS/PixiJS/Framer Motionカタログ・SSR/UR演出 |
| 22 | 22_ストーリー進行システム.md | 第1章13シーン台詞・UIコンポーネント仕様 |
| 23 | 23_サウンド設計.md | BGM12シーン・SE40種・AudioService実装仕様 |
| 24 | 24_パーティ編成システム詳細.md | ヘイト分散・ドラッグ並び替え・CostIndicator |
| 25 | 25_オンラインゲーム設計.md | 認証・クラウドセーブ・ランキング・世界ログ・CI/CD |

---

## コード実装済み

| システム | ファイル | 内容 |
|---|---|---|
| 職業システム Tier1/2 | `src/logic/JobSystem.ts` | 12職業・解放条件・転職 |
| 永続パッシブ蓄積 | `src/services/JobService.ts` | onLevelUp でマイルストーン累積 |
| BattleEngine | `src/logic/BattleEngine.ts` | ターン制バトル・シナジー統合済み |
| 状態異常システム | `src/logic/StatusAilmentSystem.ts` | 6種・immuneTypes・durationBonus対応 |
| 魔神化システム | `src/logic/DemonizationSystem.ts` | demonGauge / isDemonMode |
| 種族シナジーシステム | `src/logic/TribeSynergySystem.ts` | 3層・クロス共鳴・BattleEngine統合済み |
| 武器計算 | `src/logic/WeaponSystem.ts` | FinalATK・共鳴・打ち直し |
| 残滓スコア | `src/logic/ResidueScore.ts` | 5部位・スコア計算 |
| ステータス集計 | `src/logic/StatSystem.ts` | 装備・パッシブ・残滓合算 |
| 死霊術 Lv/Rank | `src/services/NecroService.ts` | RankUp転生・魂石化 |
| 軍団編成（3枠） | `src/components/legion/LegionHub.tsx` | SynergyBanner実装済み |
| NecroLab | `src/components/necro/NecroLab.tsx` | 残滓EQUIP/ENHANCE |
| エリアマップ | `src/components/map/AreaMap.tsx` | 7リージョン実装済み |
| Zustand ストア | `src/store/useGameStore.ts` | 全クライアント状態管理 |
| マスターデータ | `src/data/master/` | jobs/monsters/items/stages/skills（第1章分） |

---

## 意思決定（解決済みQ&A）

| 質問 | 決定内容 |
|---|---|
| スタミナ方針 | **完全廃止**。無制限周回。リテンションは4層RNG・残滓スコアで担保 |
| パーティ仲間 | **アルド + モンスター軍団（3スロット）のみ**。ヒューマン仲間は第1部に存在しない |
| オンライン | **オンラインゲームとして実装**。NextAuth.js v5 + クラウドセーブ + ランキング + 世界ログ |
| リリーススコープ | **第1章「亡国の王都」のみ**で一旦完成。第2章以降は先送り |
