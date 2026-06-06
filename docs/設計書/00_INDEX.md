# Necromance Brave — 設計書インデックス

> 最終更新: 2026-05-26
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
| Prismaスキーマ拡張・NextAuth v5 セットアップ・バトル結合フローを知りたい | [29_DB認証結合設計.md](29_DB認証結合設計.md) |
| パーティ編成UIの画面遷移・魔物選択・魔物詳細UXを知りたい | [33_パーティ編成UIUX実装設計.md](33_パーティ編成UIUX実装設計.md) |
| 第1章バトルUIの魔神化VFX・魔神技ボタン・倍速・隊列バッジを知りたい | [34_バトルUIUX実装設計.md](34_バトルUIUX実装設計.md) |
| 第1章の品質演出・音響・鑑定VFX・霧解除演出を知りたい | [35_品質演出仕上げ実装設計.md](35_品質演出仕上げ実装設計.md) |
| 第1章オンライン機能の保存・ランキング・世界ログ実装を知りたい | [36_オンライン機能実装設計.md](36_オンライン機能実装設計.md) |
| ログインフロー・キャラ作成・DB同期の全体アーキテクチャを知りたい | [37_オンラインゲームアーキテクチャ再設計.md](37_オンラインゲームアーキテクチャ再設計.md) |
| 登録/ログイン/キャラ作成の画面遷移・DBバインディング・エラー処理を知りたい | [38_ログイン登録フロー設計.md](38_ログイン登録フロー設計.md) |
| `fetchPlayerAction` のIDOR対策・所有者確認実装を知りたい | [52_SEC2_fetchPlayerAction_IDOR設計.md](52_SEC2_fetchPlayerAction_IDOR設計.md) |
| `GameManager.updateParty` のDB保存・所有魔物検証を知りたい | [53_SEC3_GameManager_updateParty永続化設計.md](53_SEC3_GameManager_updateParty永続化設計.md) |
| 報酬インスタンスIDの暗号論的生成・SEC-4対応を知りたい | [54_SEC4_暗号論的ID生成設計.md](54_SEC4_暗号論的ID生成設計.md) |
| `critRate` とドロップ率ボーナスの分離・SEC-5対応を知りたい | [55_SEC5_ドロップ率ボーナスcritRate分離設計.md](55_SEC5_ドロップ率ボーナスcritRate分離設計.md) |
| 残滓強化素材スタックの1個単位消費・BUG-4対応を知りたい | [56_BUG4_残滓強化素材スタック消費設計.md](56_BUG4_残滓強化素材スタック消費設計.md) |
| BURN持続ダメージの免疫チェック・BUG-5対応を知りたい | [57_BUG5_BURN免疫チェック設計.md](57_BUG5_BURN免疫チェック設計.md) |
| 敵HPのランタイム分離・BUG-6対応を知りたい | [58_BUG6_敵HPランタイム分離設計.md](58_BUG6_敵HPランタイム分離設計.md) |
| `getMutableStats` の型安全化・BUG-7対応を知りたい | [59_BUG7_getMutableStats型安全化設計.md](59_BUG7_getMutableStats型安全化設計.md) |
| 状態異常行動スキップ時のターン進行・BUG-8対応を知りたい | [60_BUG8_状態異常行動スキップターン進行設計.md](60_BUG8_状態異常行動スキップターン進行設計.md) |
| `NecroStatus.exp` テストモック欠落・BUG-9対応を知りたい | [61_BUG9_NecroStatus_expテストモック整合設計.md](61_BUG9_NecroStatus_expテストモック整合設計.md) |
| 軍団追撃の複数敵ターゲット分散・BUG-10対応を知りたい | [62_BUG10_軍団追撃ターゲット分散設計.md](62_BUG10_軍団追撃ターゲット分散設計.md) |
| 残滓サブオプションシャッフルのFisher-Yates準拠・PERF-1対応を知りたい | [63_PERF1_残滓シャッフルFisherYates設計.md](63_PERF1_残滓シャッフルFisherYates設計.md) |
| MasterDataService getterの型安全化・QUALITY-1対応を知りたい | [64_QUALITY1_MasterDataService型安全化設計.md](64_QUALITY1_MasterDataService型安全化設計.md) |
| JobService.changeJobの不変更新化・QUALITY-2対応を知りたい | [65_QUALITY2_JobService_changeJob不変更新設計.md](65_QUALITY2_JobService_changeJob不変更新設計.md) |
| 状態異常DoTの最大HP参照・BUG-2対応を知りたい | [66_BUG2_状態異常DoT最大HP参照設計.md](66_BUG2_状態異常DoT最大HP参照設計.md) |
| JWTセッションの一括失効・SEC-6対応を知りたい | [67_SEC6_JWTセッション失効設計.md](67_SEC6_JWTセッション失効設計.md) |
| ステージ開始トークン・不正クリア防止・SEC-8対応を知りたい | [68_SEC8_ステージ開始トークン設計.md](68_SEC8_ステージ開始トークン設計.md) |
| BattleEngineのAoEスキル対象解決・IMP-1対応を知りたい | [69_IMP1_BattleEngine_AoEスキル対象解決設計.md](69_IMP1_BattleEngine_AoEスキル対象解決設計.md) |
| BattleEngineのSUMMON_MINIONS実体化・IMP-2対応を知りたい | [70_IMP2_BattleEngine_SUMMON_MINIONS実体化設計.md](70_IMP2_BattleEngine_SUMMON_MINIONS実体化設計.md) |
| 敵・ボスバランスを手動調整する手順を知りたい | [71_IMP3_敵ボスバランス手動調整手順.md](71_IMP3_敵ボスバランス手動調整手順.md) |
| ステージ進行・推奨Lv導線を手動調整したい | [72_IMP7_ステージ難易度導線手動調整手順.md](72_IMP7_ステージ難易度導線手動調整手順.md) |
| ドロップ期待値・UR非掲載・報酬経済を手動調整したい | [73_ドロップ経済手動調整手順.md](73_ドロップ経済手動調整手順.md) |
| スキル倍率・コスト・状態異常率を手動調整したい | [74_スキル倍率手動調整手順.md](74_スキル倍率手動調整手順.md) |
| 敵・ダンジョン・ドロップなどマスターデータを新規作成したい | [75_マスターデータ制作運用手順.md](75_マスターデータ制作運用手順.md) |
| マスターデータ管理GUIツール（/admin）の仕様を知りたい | [82_マスターデータ管理ツール仕様書.md](82_マスターデータ管理ツール仕様書.md) |
| Phase 1 実装詳細設計・HTTP証跡・監査結果を確認したい | [83_Phase1_管理ツール詳細設計と証跡.md](83_Phase1_管理ツール詳細設計と証跡.md) |
| ドレインスキルのHP吸収・IMP-4対応を知りたい | [76_IMP4_ドレインスキルHP吸収設計.md](76_IMP4_ドレインスキルHP吸収設計.md) |
| 職業別の通常攻撃種別・IMP-5対応を知りたい | [77_IMP5_職業別通常攻撃種別設計.md](77_IMP5_職業別通常攻撃種別設計.md) |
| ターン順序プレビューUI・IMP-6対応を知りたい | [78_IMP6_ターン順序プレビューUI設計.md](78_IMP6_ターン順序プレビューUI設計.md) |
| 最終WAVEクリアループと攻撃連打防止・BUG-11対応を知りたい | [79_BUG11_最終WAVEクリアループと多重入力防止設計.md](79_BUG11_最終WAVEクリアループと多重入力防止設計.md) |
| スキルMPリソース再設計・IMP-8対応を知りたい | [80_IMP8_スキルMPリソース再設計.md](80_IMP8_スキルMPリソース再設計.md) |
| 序盤バランス・EXP曲線・戦闘後MP全回復・IMP-9対応を知りたい | [81_IMP9_序盤バランスと戦闘後MP全回復再設計.md](81_IMP9_序盤バランスと戦闘後MP全回復再設計.md) |
| 武器打ち直しのILv毎成長・20Lv節目サブステ・サーバー永続化・IMP-10対応を知りたい | [91_IMP10_武器打ち直しILv成長とサーバー永続化設計.md](91_IMP10_武器打ち直しILv成長とサーバー永続化設計.md) |
| 武器レアリティ別のサブオプション枠数・倍率・属性特化・IMP-11対応を知りたい | [92_IMP11_武器レアリティ別サブオプション再設計.md](92_IMP11_武器レアリティ別サブオプション再設計.md) |
| 深淵の残滓のChapter 2開放・チュートリアル接続を知りたい | [93_深淵の残滓Chapter2開放再設計.md](93_深淵の残滓Chapter2開放再設計.md) |
| ストーリーJSONを2章以降へ拡張する章別レジストリ設計を知りたい | [94_ストーリー章別JSONレジストリ設計.md](94_ストーリー章別JSONレジストリ設計.md) |
| エリアマップを管理画面から追加・編集し、ステージ追加をプレイ画面へ反映する設計を知りたい | [95_エリアマップ管理とステージ反映設計.md](95_エリアマップ管理とステージ反映設計.md) |
| 主人公の職業別Lv1〜100基礎ステータス・%パッシブ・死霊術Lv補正を知りたい | [96_主人公成長と職業基礎ステータス再設計.md](96_主人公成長と職業基礎ステータス再設計.md) |

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
src/services/RankingService.ts  — StageRecord / PlayerStats ランキング集計
src/services/WorldEventService.ts — WorldLog 永続化・Pusher配信
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
