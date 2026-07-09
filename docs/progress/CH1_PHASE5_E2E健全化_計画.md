# Ch1 リリース前 — E2E（Playwright）健全化 計画

策定: 2026-06-28 / ブランチ: `feature/2026062102`
親: [`CH1_PHASE5_最終監査_チェックリスト.md`](./CH1_PHASE5_最終監査_チェックリスト.md) §6
位置づけ: Phase 5 で残った **Playwright 7失敗（21 passed / 7 failed）を green 化**し、リリースゲートの E2E を信頼できる状態にする。

---

## 0. 前提
- **Playwright は CI 非対象**（`.github/workflows/ci.yml`「Playwright E2E は意図的に含めない」）。CI は tsc + jest のみ。→ 本件は **CI ブロックではなく、リリース前 E2E 健全化**。
- 7失敗はいずれも **Ch1拡張（A/B/C/Phase2-4）のコード起因ではない**（Phase 5 証跡で確認済み）。**既存のテスト腐り＋dev環境のクリック遮蔽**。
- **これは test-only 修正**。製品コード（stages/enemies/story/tutorial）は変えない。**正しい現行挙動に期待値を更新する**のであって、assertion を緩めて通すのは禁止。

---

## 1. 修正グループ

### グループ A — `active-skills.spec.ts`（3失敗）: 旧期待値の更新
旧スケール/旧命名のまま放置された期待値を、現行に合わせる。
- [x] **MP 表示**（`:28` `100` / `:33` `95` / `:74` `95` / `:84` `100`）→ **現行エネルギースケールに更新**。docs/46 リバランスで MP=100 系は廃止。dev server で実際に `player-mp` testId の表示（開始値・スキル消費後値・再入場後値）を採取して置換。
- [x] **敵ログ**（`:53` の `/スケルトンの追撃！ 霊体騎士に …/`）→ **現行ログ文字列に更新**。`:51/:65` は既に現行「骸骨騎士の攻撃」を期待しており、`:53` の旧「スケルトンの追撃」だけが stale。`startFirstDungeonBattle` の現行 battle-log を採取し、攻撃者名・対象名・書式を現行へ。
- 採取方法: `npm run dev`（or test server :3080）で当該バトルを実行し、`player-mp` と `battle-log` の実値を確認 → spec に反映。

### グループ B — dev overlay 遮蔽（2失敗）: `result-screen.spec.ts` / `new-player-onboarding.spec.ts` T-07
Next.js dev の `<nextjs-portal>`（エラー/インジケータ overlay）が `AUTO OFF` ボタンのクリックを遮蔽。
- [x] `result-screen.spec.ts:15` の `…AUTO OFF…).click()` を **`.click({ force: true })`**（or `dispatchEvent`）へ。**同 suite 内で既に確立した回避パターン**（active-skills `:60` dispatchEvent / `:78-82` force:true）に合わせる。
- [x] onboarding T-07 の同種 AUTO OFF クリックも同様に force 化。
- [x] （任意・恒久対処）`next.config` に `devIndicators` 無効化、または `helpers/e2e.ts` に「overlay を消す/無視する」共通ヘルパを追加し、AUTO 系クリック前に呼ぶ。per-click force でも十分だが、再発防止には共通化が堅い。

### グループ C — `auth-debug.spec.ts`（2失敗）: デバッグ spec の除外
中身は `console.log` で状態を出力するだけの**探索用デバッグ spec（実 assertion なし）**。タイムアウトしても製品品質を示さない。
- [x] **リリースE2Eゲートから除外**（`test.skip` 化 / `playwright.config` の testIgnore に追加 / もしくは削除）。
- 判断: デバッグ専用なので**削除 or skip 推奨**（残すなら gate 集計から外す）。

---

## 2. 触るファイル（test/設定のみ・製品コード不変）
| ファイル | 変更 |
|---|---|
| `tests/active-skills.spec.ts` | MP 期待値・敵ログ regex を現行へ |
| `tests/result-screen.spec.ts` | AUTO OFF クリックを force 化 |
| `tests/new-player-onboarding.spec.ts` | T-07 の AUTO OFF クリックを force 化 |
| `tests/auth-debug.spec.ts` | skip/削除（or config で除外） |
| （任意）`next.config.*` / `tests/helpers/e2e.ts` | devIndicators 無効化 or overlay 回避ヘルパ |

---

## 3. 関所 / 完了条件
- [x] `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test` → **全 green**（auth-debug を除外した上で）
- [x] `git diff --exit-code src/data/master` 差分なし（製品データ不変）
- [x] 製品コード（`src/` の非テスト）に差分が無いこと（test/設定のみの変更）
- [x] 更新した期待値が「現行の正しい挙動」であることを実バトルで確認（緩めて通していない）

---

## 5. 実行証跡（2026-06-28）

- 実バトル採取値: `player-mp` 開始 `MP10`、スキル後 `MP5`、再入場後 `MP10`。
- 実バトル採取ログ: `骸骨騎士の攻撃！ 霊体騎士を狙う！` → `霊体騎士に 合計10ダメージ！`。
- AUTO クリック遮蔽対策: `tests/helpers/e2e.ts` に `clickBattleAutoOn` / `setBattleSpeed` を追加し、クリック後に `AUTO ON` 表示まで確認。
- Result 鑑定分岐: 報酬内容により `次の戦利品` / `獲得して戻る` / `ネクロマンスへ` のいずれも正当な次アクションとして確認。
- `auth-debug.spec.ts`: 探索用 spec として `test.skip` 化し、リリースE2Eゲートから除外。
- `npx tsc --noEmit`: PASS。
- `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/result-screen.spec.ts`: 1 passed。
- `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test`: 25 passed / 3 skipped。
- `git diff --exit-code src/data/master`: PASS。
- `git diff --name-only`: `tests/active-skills.spec.ts` / `tests/auth-debug.spec.ts` / `tests/helpers/e2e.ts` / `tests/new-player-onboarding.spec.ts` / `tests/result-screen.spec.ts` のみ。

---

## 4. 留意点
- グループ A は **実値採取が必須**（憶測で数値を入れない）。MP・ログは dev server で観測した実値に合わせる。
- グループ B の `force:true` は overlay 回避であって、ボタンが本当に機能することは別途（クリック後の状態変化＝AUTO 表示/ログ進行）で担保する。
- 本件は **Ch1 章コンテンツとは独立**。先に済ませると Phase 5 §6 の Playwright 項目が閉じ、残りは実機 iOS 通しのみになる。
- これらの stale 化は「MP リバランス時に E2E を追随し損ねた」既存負債。今後は製品変更時に E2E 追随を忘れない運用に（TECH_DEBT 追記も可）。
