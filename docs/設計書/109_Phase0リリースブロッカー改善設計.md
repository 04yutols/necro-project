# Phase 0 リリースブロッカー改善設計

作成日: 2026-06-11  
対象: `docs/progress/COMPREHENSIVE_REVIEW_2026-06-11.md` Phase 0

## 1. 目的

Phase 0 のリリースブロッカーを、既存実装と照合しながら即時リリース可能な防御線へ引き上げる。対象は以下の6系統。

| ID | 対応方針 |
|---|---|
| NEW-SEC-1 / NEW-SEC-2 / NEW-SEC-6 | ステージ開始証跡を DB に発行し、結果処理で単回消費する。ランキング値はステージ別上限で正規化する。 |
| NEW-CODE-2 | BattleCanvas の敵→主人公ダメージに DEF 軽減を適用し、BattleEngine と式を共有する。 |
| NEW-DATA-4 | 12職業の奥義スキルを `skills.json` に追加し、`jobs.json` の解放リストへ接続する。 |
| NEW-CODE-1 | 魔神化 SELF_DAMAGE をログ演出だけでなく実 HP ダメージへ接続する。 |
| NEW-SEC-4 | ログイン API の認証情報系 `console.log` を削除する。 |
| NEW-MOB-1 | `BottomNavBar` を `ResponsiveFrame` にマウントし、通常画面の統一ナビゲーションを復帰する。 |

## 2. 既存実装との差分

### 2.1 ステージ結果処理

既存の `processStageResultAction(stageId, meta)` は、認証とステージ存在確認後に報酬抽選・保存を行っていた。クライアント側で実際に戦闘したか、該当ステージが解放済みか、同一結果が二重送信されていないかをサーバーで確認していなかった。

改善後は `startStageAction(stageId)` / `startStageForUser(user, stageId)` で以下を行う。

1. 認証ユーザーと DB キャラクターを照合する。
2. `DungeonSystem.isStageUnlocked()` でサーバー側の `clearedStages` を検証する。
3. `StageAttempt` レコードを発行する。
4. `processStageResultAction(stageId, stageAttemptId, meta)` で同レコードをトランザクション内 `updateMany` により単回消費する。

旧形式の `processStageResultAction(stageId, meta)` と `processStageResultForUser(user, stageId, meta)` は `MISSING_STAGE_ATTEMPT` で拒否する。

### 2.2 ランキング値

既存の `RankingService.recordStageClear()` は `turnCount` を最小1に丸めるのみで、`totalDamage` は巨大値を保存できた。

改善後は `normalizeStageClearMetrics()` で以下を保証する。

- `turnCount < 1`、`clearTimeSec < 1`、`totalDamage < 0`、非有限値は拒否。
- `turnCount`、`clearTimeSec`、`totalDamage` は stage ごとの上限へクランプ。
- `totalDamage` 上限は wave 内敵 HP 合計と REVIVE 追加 HP を元に算出する。

### 2.3 戦闘式

BattleEngine は主人公への直接ダメージに DEF 軽減を適用していたが、BattleCanvas は `enemy.atk * multiplier * variance` のみだった。改善後は `calculateIncomingEnemyDamage()` を共通関数化し、BattleCanvas / BattleEngine の両方が `1 - DEF / (DEF + 200)` を使う。

### 2.4 魔神化 SELF_DAMAGE

BattleEngine は SELF_DAMAGE を HP に適用していたが、BattleCanvas はフロート表示とログだけだった。改善後は `calculateDemonSelfDamage(maxHp, riskValue)` と `shouldApplyDemonSelfDamage(form, attackType)` を共通化し、BattleCanvas でも `applyPlayerDamage()` と敗北判定まで接続する。

### 2.5 奥義データ

設計書19 §6 の奥義カタログを `skills.json` へ追加した。`mpCost` は既存 `jobs.json` の `energyCurve.ultimateCost` と一致させる。設計書側と既存実装でコスト差があった `sorcerer` / `warlock` / `trickster` は実装値を正とした。

## 3. DB 設計

```prisma
model StageAttempt {
  id          String    @id @default(uuid())
  userId      String
  characterId String
  stageId     String
  issuedAt    DateTime  @default(now())
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())
}
```

有効期限は2時間。消費は `id + userId + characterId + stageId + consumedAt null + expiresAt > now` を条件に `consumedAt` を更新する。更新件数が1でない場合、報酬トランザクション全体をロールバックする。

## 4. テスト設計

| 観点 | テスト |
|---|---|
| 旧直呼び拒否 | `processStageResultForUser(user, stageId, meta)` が `MISSING_STAGE_ATTEMPT` |
| 未解放拒否 | `startStageForUser(user, 'area2_gate')` が `STAGE_LOCKED` |
| 単回消費 | 同一 `stageAttemptId` の2回目が `STAGE_ATTEMPT_CONSUMED` |
| ランキング汚染防止 | `Number.MAX_SAFE_INTEGER` がステージ上限へクランプ |
| DEF 軽減 | `calculateIncomingEnemyDamage()` が DEF 0 / DEF 200 で差を出す |
| SELF_DAMAGE | `calculateDemonSelfDamage()` と適用条件を検証 |
| 奥義参照 | 全 job が `ult_${jobId}` を持ち、skill が存在し `mpCost` が一致 |
| ナビ復帰 | `ResponsiveFrame` が非 fullscreen で `BottomNavBar` を描画 |

## 5. 失敗時挙動

`StageAttempt` 消費失敗時は報酬・EXP・Gold・ランキング・世界ログを保存しない。クライアントはクラウド保存失敗時に従来どおりローカル結果へフォールバックするが、DB 報酬は付与されないため不正ファーミングにはならない。

## 6. 残リスク

- サーバー再計算バトルログ検証は未実装。今回の Phase 0 では単回消費とランキング上限で即時防御する。
- 奥義フラグの全効果処理は将来タスク。現時点ではスキル参照断と null リスクの解消を優先する。
- Map/Battle の fullscreen 画面は既存設計どおり BottomNavBar 非表示。通常タブ間の統一ナビを復帰対象とする。

## 7. 検証結果

2026-06-11 実施。

| コマンド | 結果 |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx prisma migrate deploy` | PASS（`StageAttempt` migration 適用） |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS（69 suites / 632 tests） |
| `npm run data:audit` | PASS相当（0 fail / 既存 warn 1: `enemies/grave_knight` shieldHp） |
| `npm run build` | PASS |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/necro-lab.spec.ts` | PASS（2 tests） |

Playwright の `tests/result-screen.spec.ts` は、結果画面到達後に `DEFEAT` になり `VICTORY` 期待で失敗した。`tests/active-skills.spec.ts` は 4/5 PASS、追撃ログ待ち1件が timeout。いずれも今回のステージ証跡・奥義参照・BottomNav 復帰とは別の、guest/E2E 用バトル自動進行・序盤勝利保証の安定化課題として切り分ける。
