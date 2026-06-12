# 111 — Phase 2 品質向上改善設計

> 作成日: 2026-06-12  
> 対象: `docs/progress/COMPREHENSIVE_REVIEW_2026-06-11.md` の Phase 2 — 品質向上（〜2週間）  
> 実装範囲: UI/UX・デザイントークン、ドロップ方式、認証、管理画面、AIエージェント、関連ドキュメント

## 1. 目的

Phase 0/1 でリリースブロッカーと本番投入前必須の土台は解消済み。Phase 2 では「壊れてはいないが、本番品質・運用品質を落とす」項目を、既存実装を尊重しながら改善する。

主な完了条件:

- Gothic-Morphism トークンから外れた UI と低コントラスト文字を是正する。
- 装備・戦闘中断のユーザー操作に成功/失敗/確認のフィードバックを付ける。
- ドロップ方式を実装と UI/監査で同じ意味に揃える。
- パスワード変更時にセッション一括失効を確実に発火する。
- 管理画面の JSON 書き込み・story character・Agent B 適用を安全にする。
- LangGraph agent の module-load compile と orphaned LLM request を抑制する。

## 2. 対象項目と既存実装の差分

| Review ID | 既存実装 | 改善方針 |
|---|---|---|
| NEW-AAA-1 | `ShardEquipModal` が `bg-dark/border-necro/font-mono` 中心の初期UI | Gothic panel、明るい本文色、金アクセント、aria-modal、装備プレビューへ刷新 |
| NEW-DS-1/3, NEW-A11Y-1/2 | `#00FFFF`, `#8A2BE2`, `#6b5f7a`, `#4a3a5a` が主要画面に混在 | `#8B00FF` は線・グロー中心に限定し、読ませる文字は `#F0EAFF` / `#D4AF37` / `#A5A9B4` へ寄せる |
| NEW-UX-2 | 装備 server action 失敗が `console.error` に捨てられる | NecroLab / LegionHub に画面内 toast を追加 |
| NEW-UX-4 | BattleCanvas には `逃走` があるが即時実行 | `撤退` に改名し、報酬なしを確認する dialog を追加 |
| NEW-DATA-2 | RewardService は各 drop entry を独立抽選。UI は合計率の意味を表示しない | `DropPolicySystem` を追加し、MULTI_ROLL・期待値・表示分期待値を UI/テストで正本化 |
| NEW-SEC-5 | `sessionVersion` はあるがパスワード変更入口がない | `changePasswordForUser` と `changePasswordAction`、AuthPanel の変更導線を追加。hash 更新と version increment は同一 transaction |
| NEW-ADMIN-2 | `fs.writeFileSync` 直書き | temp file → `fs.renameSync` の atomic write に統一 |
| NEW-ADMIN-3 | `monsters.json` が ID 整合監査対象外 | `auditMasterData` の対象に追加。既存 key-only データは WARN、今後の MonsterForm 保存は `id` を含める |
| NEW-ADMIN-4 | `saveStoryCharacter` に ID 検証なし、削除 action なし | snake_case 検証、予約語拒否、`deleteStoryCharacter` と UI 削除導線を追加 |
| NEW-ADMIN-6 | BulkSpec の `filter: []` が無警告 | ok は維持しつつ WARN を追加 |
| NEW-AGENT-1 | agent graph が module load 時 compile、Gemini signal なし | `createGraph/getGraph` lazy compile、Gemini 既定 `AbortSignal.timeout(60000)` |
| NEW-AGENT-2 | Agent B 適用が snapshot なしで `saveEntry` | `applyAuditFixAction` で snapshot 作成後に保存 |
| NEW-DOC-3〜6 | story/tutorial 実装状況、INDEX、skill表、CH1_TODO が古い | CLAUDE / INDEX / docs03 / CH1_TODO を更新 |

## 3. UI/UX 設計

### 3.1 ShardEquipModal

既存の Zustand action `equipShard(monsterId, shardId)` は維持し、UI だけを更新する。

- dialog: `role="dialog"` / `aria-modal="true"` / `aria-labelledby`
- 対象魔物: 現在装備中の欠片と ATK を表示
- 候補リスト: ATK bonus 降順、現在装備中バッジ
- プレビュー: 現在 ATK → 装備後 ATK、差分を表示
- 空状態: 魂石化で生成される旨を短文表示
- アクション: `閉じる` / `装備`。既に装備中の欠片は disabled

### 3.2 装備アクション toast

NecroLab / LegionHub はローカル store への楽観更新を維持する。サーバー保存がある場合は以下の順で通知する。

1. ローカル反映成功: `残滓を装備しました` / `武器を装備しました`
2. server action 成功: `装備を保存しました`
3. server action 失敗: action の `error` を表示。なければ用途別の汎用文

Rollback は Phase 2 では行わない。理由は、既存の UX が即時反映前提であり、保存失敗時に `loadFromServer` できない環境もあるため。ユーザーに保存失敗を明示することで、次の同期/再読込で解消できる状態に留める。

### 3.3 戦闘撤退

既存の `SystemBar` は残し、`逃走` を `撤退` に変更する。押下時は即 `onEnd()` せず confirm dialog を表示する。

- `続行`: dialog を閉じる
- `撤退`: auto を止め、ログへ `撤退した。報酬は獲得できません。` を追加し、Energy を回復してマップへ戻る
- ResultScreen は出さない。報酬なし中断であるため、既存結果処理とは分離する

## 4. ドロップ方式設計

### 4.1 正本

現行 `RewardService.processDropTable` は drop entry ごとに `rng() < rate` を判定している。したがって方式は **MULTI_ROLL（複数独立抽選）** とする。

この場合、dropTable 合計が 100% を超えることは不正ではない。合計値は「少なくとも1つ落ちる確率」ではなく、**期待ドロップ行数**として扱う。

### 4.2 実装

`src/logic/DropPolicySystem.ts` を追加する。

| API | 役割 |
|---|---|
| `DROP_ROLL_MODE` | `MULTI_ROLL` の正本定数 |
| `normalizeDropRate(rate)` | 0〜1 に clamp。非有限値は 0 |
| `normalizeDropEntry(entry)` | entry の rate のみ正規化 |
| `summarizeDropTable(dropTable)` | expectedDrops / visibleExpectedDrops / hiddenCount / clampedCount を算出 |
| `formatDropRate(rate)` | UI 表示用の `%` 文字列 |

`RewardService` の clamp は `normalizeDropRate` に統合し、管理画面 `DropTableEditor` は同じ summary を表示する。

## 5. 認証設計

`changePasswordForUser` は以下の順に処理する。

1. 入力必須チェック
2. 新パスワードを `validatePassword` で検証
3. user と `passwordHash` を取得
4. 現在パスワードを bcrypt compare
5. 新パスワードが現在と同じなら拒否
6. 新 hash を作成
7. `prisma.$transaction` 内で `passwordHash` 更新と `sessionVersion.increment(1)` を同時実行

AuthPanel ではログイン済みの CLOUD パネル押下で変更 dialog を開く。成功後は `signOut({ redirect: false })` でローカルセッションを閉じ、再ログインを促す。

## 6. 管理画面・Agent 設計

### 6.1 Atomic write

`writeJsonAtomic(filePath, data)` を admin actions に追加し、次を置換する。

- `saveEntry`
- `deleteEntry`
- `writeStoryScenesFile`
- `saveStoryCharacter`
- `deleteStoryCharacter`

書き込み順:

1. 同一ディレクトリに `.{basename}.{pid}.{timestamp}.tmp` を write
2. `fs.renameSync(tmp, filePath)` で置換

### 6.2 story character

ID は `^[a-z][a-z0-9_]*$` に限定し、`constructor` などの予約語を拒否する。`narrator` はシステムキャラとして削除不可。

### 6.3 Agent B snapshot

`AuditFixModal` は直接 `saveEntry` しない。`applyAuditFixAction(scope, entityId, patched)` を呼ぶ。

`applyAuditFixAction` は対象 master collection 全体を `.snapshots` に退避し、snapshot 成功時だけ `saveEntry` する。BulkAgent と同じ `writeSnapshot` / `pruneSnapshots` を使用する。

### 6.4 Agent lazy init / timeout

全 `*Agent.ts` の LangGraph を以下へ変更する。

```ts
function createGraph() {
  return new StateGraph(StateAnnotation)
    // nodes / edges
    .compile();
}

let graph: ReturnType<typeof createGraph> | null = null;
function getGraph() {
  graph ??= createGraph();
  return graph;
}
```

Gemini client は `opts.signal` がない場合のみ `AbortSignal.timeout(60000)` を設定する。呼び出し側が signal を渡した場合はそれを優先する。

## 7. 検証結果

| 種別 | コマンド | 結果 |
|---|---|---|
| 型 | `npx tsc --noEmit` | PASS |
| 単体 | `npm test -- --runTestsByPath src/logic/DropPolicySystem.test.ts src/lib/agent/bulk/bulkSpec.test.ts src/services/AuthService.test.ts` | PASS: 3 suites / 36 tests |
| 全体単体 | `npm test` | PASS: 72 suites / 645 tests。Jest の open handle 注意は残るが失敗なし |
| データ監査 | `npm run data:audit` | PASS: 0 fail / 1 warn。既存 `enemies/grave_knight: ELITE has no shieldHp` |
| ドロップ経済 | `npm run balance:drops` | PASS(exit 0): 既存 R_WEAPON 期待値 low 警告 3件 |
| ビルド | `npm run build` | PASS: Next.js production build |
| E2E | `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/item-equip.spec.ts tests/necro-lab.spec.ts tests/necro-shard.spec.ts --workers=1` | PASS: 7 tests。`next start` 上で確認 |
| ブラウザ確認 | Browser / `http://localhost:3080` | 未ログイン AuthGate 表示、console error 0 |

## 8. リスクと残存課題

- 既存 `monsters.json` は key-only 許容の監査に留める。Phase 2 では既存データの一括 `id` 追記は行わず、新規保存分から `id` を含める。
- 装備 server action 失敗時の rollback は未実装。Phase 2 は「失敗を表示する」までを範囲とし、同期戦略は別タスク化する。
- Focus trap は `ShardEquipModal` / retreat dialog に未実装。aria-modal は追加済みだが、A11Y-3/4 の完全対応は次フェーズ対象。
- `#8B00FF` は線・グロー・ゲージには残す。テキスト直使用は主要 HUD/見出しから削減したが、全コードベースの完全撲滅はデザイントークン全面移行時に行う。
