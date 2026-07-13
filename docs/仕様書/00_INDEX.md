# Necromance Brave — 正式仕様書インデックス

> 最終更新: 2026-07-13 ｜ 生成方法: コードからのリバースエンジニアリング（**コードが唯一の真実**）
> 全13本は執筆後に独立エージェントがコード突き合わせ検証（計167件の定量主張チェック・9件修正）と横断整合チェックを通過済み。

**この `docs/仕様書/` が現行仕様の正典。** 旧 `docs/設計書/`（136本）は意図・経緯の歴史的資料であり、現状とズレがある（各仕様書末尾の「旧設計書との差異」節と [99_旧ドキュメント棚卸し.md](99_旧ドキュメント棚卸し.md) を参照）。

## 「この質問ならこの仕様書」早引き表

| 知りたいこと | 読む仕様書 |
|---|---|
| ゲームの全体像・第1章リリーススコープ・先送り事項 | [01_ゲーム概要とスコープ.md](01_ゲーム概要とスコープ.md) |
| 技術スタック・ディレクトリ構成・タブ遷移・状態管理・CI | [02_アーキテクチャ.md](02_アーキテクチャ.md) |
| 型定義（game.ts）・マスターデータ10ファイルのスキーマと件数・相互参照規則 | [03_型とマスターデータ.md](03_型とマスターデータ.md) |
| ダメージ計算式・AVターン順・WAVE進行・状態異常・種族シナジー・魔神化・ボス/エリアギミック | [04_バトルシステム.md](04_バトルシステム.md) |
| EXP曲線・職業/転職・SP・死霊術Lv/Rank・ネクロマンス捕獲・ステータス集計 | [05_成長システム.md](05_成長システム.md) |
| 武器・深淵の残滓・ソウルシャード・霊核・ドロップ経済 | [06_装備とアイテム経済.md](06_装備とアイテム経済.md) |
| エリア/ステージグラフ・解放チェーン・敵スケーリング・黄泉の階層 | [07_ワールドステージと黄泉.md](07_ワールドステージと黄泉.md) |
| 画面/コンポーネント一覧・Gothic-Morphismトークン・Motion規約・iOS Safari規則 | [08_UI画面とデザインシステム.md](08_UI画面とデザインシステム.md) |
| Prismaスキーマ（11モデル）・playerStateブロブ・セーブ/ロードフロー | [09_データベースと永続化.md](09_データベースと永続化.md) |
| 認証・Server Actions・SEC-1〜8対策・ランキング・世界ログ・レート制限 | [10_オンライン機能とセキュリティ.md](10_オンライン機能とセキュリティ.md) |
| ストーリーシーン・章別レジストリ・トリガー・チュートリアル5フェーズ | [11_ストーリーとチュートリアル.md](11_ストーリーとチュートリアル.md) |
| 管理画面(/admin)・AIエージェントA〜E・決定論的検証ゲート | [12_管理画面とAIエージェント.md](12_管理画面とAIエージェント.md) |
| テスト3層（Jest/DB統合/E2E）・実行コマンド・CIゲート | [13_テストとCI.md](13_テストとCI.md) |
| 旧ドキュメント136本＋αの位置付け（現行30/置換済み15/歴史的記録106/要注意31） | [99_旧ドキュメント棚卸し.md](99_旧ドキュメント棚卸し.md) |

## コア定数（全て検証済み・根拠は各仕様書）

| 定数 | 値 | 主要ソース |
|---|---|---|
| ステータス | 8種: hp / atk / def / spd / critRate / critDmg / effectHit / effectRes | `src/types/game.ts` |
| パーティ | アルド + モンスター3枠固定（人間の仲間なし） | `src/types/game.ts` |
| タブ | 8値: HOME / BATTLE / MAP / EQUIP / LAB / YOMI / LOGS / JOB | `src/store/useGameStore.ts` |
| 属性 | 9値: FIRE / WATER / THUNDER / EARTH / WIND / ICE / LIGHT / DARK / NONE | `src/types/game.ts` |
| 種族 | 6種: UNDEAD / DEMON / BEAST / HUMANOID / DRAGON / ORC | `src/types/game.ts` |
| マスターデータ | 10ファイル: jobs 12 / skills 41 / enemies 14 / monsters 9 / items 10 / materials 7 / stages 33 / areas 3 / demonForms 12 / necroConfig | `src/data/master/` |
| 第1章 | 12ノード（SAFE 1 + 戦闘11、area1_safe〜area1_node3） | `stages.json` |
| 黄泉の階層 | B1〜B20 実装済み・解放は第1章クリア（`CH1_FINAL_NODE_ID='area1_node3'`） | `src/logic/YomiUnlockSystem.ts` |
| 死霊術 | Lv最大500・Rank1〜10は50Lv毎の導出値・maxCost = 6 + floor(Lv/10) + (Rank-1)×2 | `src/logic/NecroGrowthSystem.ts` |
| 捕獲率 | MINION 0.12 / ELITE 0.04 / BOSS 0.001（Rank乗算・上限0.75） | `src/logic/NecromanceCaptureSystem.ts` |
| 深淵の残滓 | 5部位・Lv1〜20・レアリティ4値（COMMON/RARE/EPIC/LEGENDARY） | `src/types/game.ts` |
| 魔神化 | ゲージ0〜100・フォーム12職業分定義済み | `src/logic/DemonizationSystem.ts` |
| Energy | currentEnergy / maxEnergy（スキルコストは互換名 `mpCost`）・バトル開始時は常に100% | `src/logic/EnergySystem.ts` |
| DB | Prisma 11モデル + `Character.playerState` JSONブロブ（スキーマv3） | `prisma/schema.prisma` |
| インフラ | Neon serverless + Cloudflare Workers (OpenNext) + Upstash Redis + Pusher | `package.json` ほか |
| チュートリアル | 5フェーズ: BATTLE_BASICS → PARTY_FORMATION → WEAPON_EQUIP → DEMONIZATION → ABYSSAL_RESIDUE | `src/data/tutorial/phases.ts` |

## 運用ルール

1. **コードが正**: 仕様の疑義はまずコードで確認し、仕様書が古ければ仕様書を直す。
2. **実装変更時は該当仕様書を同時更新**（冒頭の「最終更新」日付も更新）。
3. **未実装・先送りは本文に混ぜない**: 各仕様書末尾の「先送り・未実装」節へ（全体は `docs/progress/DEFERRED.md`）。
4. **旧設計書は更新しない**: 歴史的資料として凍結。新規の設計検討は新番号でこのディレクトリか docs/progress/ へ。
