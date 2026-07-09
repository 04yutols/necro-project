# IMP-12 深淵の残滓 Chapter 2 開放レポート

作成日: 2026-06-03

## 対応概要

深淵の残滓を第1章の基礎戦闘から切り離し、第2章到達後にチュートリアル付きで開放するよう再設計した。第1章では残滓本体が報酬に出ず、既存セーブに残滓があっても未開放中は装備・ステータス反映されない。

## 主な変更

| 領域 | 内容 |
|---|---|
| 共通判定 | `AbyssalResidueUnlockSystem` を追加し、`area1_node3` クリア + Chapter 2以上を報酬解禁条件にした |
| 報酬 | Chapter 1のステージ/敵から `RESIDUE` を削除し、`area2_gate` を初回供給地点にした |
| サーバー | `processStageResultForUser` / `GameManager` がステージ文脈付き報酬抽選を使うよう変更 |
| 既存セーブ互換 | 未開放時はDB上の装備残滓をロードしても空スロットとして返す |
| 装備API | 未開放時の `equipResidueForUser` を拒否 |
| UI | ホーム、LAB直アクセス、下部ナビ、装備ハブの残滓導線をロック |
| チュートリアル | 早期 `NECRO_LAB` を必須フェーズから外し、`ABYSSAL_RESIDUE` を第2章導入後に発火 |
| テスト | 共通判定、RewardService、ストア、サーバー統合、E2Eを更新 |

## バランス意図

第1章はHP/ATK/DEFの小さい数値帯で、通常攻撃・スキル・編成・転職の理解を優先する。残滓はステータスに直接加算されるため、第1章で配ると序盤の競り合いを壊しやすい。第2章ゲートで初めてEPIC残滓と強化素材を渡すことで、戦闘基礎の習得後に「ビルド厳選」へ移行する階段を作った。

## 検証結果

| コマンド | 結果 |
|---|---|
| `node -e "JSON.parse(...stages); JSON.parse(...enemies)"` | PASS |
| `npm test -- --runTestsByPath src/logic/AbyssalResidueUnlockSystem.test.ts src/services/RewardService.test.ts src/store/useGameStore.party.test.ts src/data/tutorial/phases.test.ts src/store/useTutorialStore.test.ts` | PASS |
| `npm run data:audit` | PASS（既存警告: `enemies/grave_knight: ELITE has no shieldHp`） |
| `npm run balance:drops` | PASS相当（FAILなし、R武器期待値低め警告3件） |
| `npx tsc --noEmit` | PASS |
| `npm test -- --runTestsByPath src/tests/account-progression.integration.test.ts` | PASS |
| `npm test` | PASS（38 suites / 250 tests） |
| `npm run build` | PASS |
| `npx playwright test tests/necro-shard.spec.ts` | PASS（2 tests） |
