# コードレビュー: チュートリアル永続化スコープ修正

レビュー日: 2026-06-27 / ブランチ: `feature/2026062102`
対象: 別ユーザーでチュートリアルが発火しないバグの修正（`docs/progress/BUGFIX_チュートリアル未発火_2026-06-21.md` の実装）
判定: **✅ Approve（承認・マージ可）** — 指摘は中1件（要確認）＋低4件、いずれもブロッカーではない

---

## 0. 検証結果（このレビューで実行）

| チェック | 結果 |
|---|---|
| `npx tsc --noEmit` | ✅ パス（エラー 0） |
| `npx jest`（全体） | ✅ **84 suites / 761 tests 全パス**（新規スコープテスト 3 件含む） |
| `src/store/useTutorialStore.test.ts` | ✅ パス |
| Playwright E2E | ⚠️ **未実行**（dev server `localhost:3080` 必要）→ §3-M1 |

---

## 1. 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/store/useTutorialStore.ts` | 本体 | スコープ化ストレージ + `switchTutorialPersistenceScope` 追加（+86行） |
| `src/hooks/useAuthFlow.ts` | 配線 | `switchPersistenceScopes` ヘルパで story/tutorial を同時切替（4分岐） |
| `src/store/useTutorialStore.test.ts` | テスト | スコープ分離テスト 3 件追加（+69行） |
| `tests/helpers/e2e.ts` | テスト追随 | シードキー `necro-tutorial-store-v1`→`v2` 修正 |
| `tests/necro-lab.spec.ts` | テスト追随 | ラベル/コスト上限の追随（本修正と無関係）→ §3-L4 |
| `tests/new-player-onboarding.spec.ts` | テスト追随 | 同上 + シードキー `v1`→`v2` |

---

## 2. 良い点

### 2-1. 計画への忠実な実装
`BUGFIX_チュートリアル未発火` §5 の修正計画どおり、`useStoryStore` の実装パターンを
忠実に横展開している。`getBaseTutorialStorage` / `getSyncTutorialStorageItem` /
`getTutorialPersistenceScope` / `getTutorialStorageKeyForScope` / `scopedTutorialStorage` /
`switchTutorialPersistenceScope` の構造・命名がストーリー側と 1:1 で対応し、保守性が高い。

### 2-2. ロックステップ切替（`useAuthFlow.ts:49-54`）
```ts
async function switchPersistenceScopes(userId: string | null | undefined) {
  await Promise.all([
    switchStoryPersistenceScope(userId),
    switchTutorialPersistenceScope(userId),
  ]);
}
```
story / tutorial を**必ず同じ引数・同じタイミング**で切り替えるヘルパに集約。
認証 4 分岐（guest / authRequired / 認証確定 / キャラロード失敗）すべてで置換済み。
「ストーリーは出るのにチュートリアルは出ない」不整合の再発を構造的に防いでいる。
両ストアは別キー・別ストアを触るため `Promise.all` の並行実行で競合しない。

### 2-3. スコープ切替時の一時状態クリアが適切（`useTutorialStore.ts:223-229`）
rehydrate 後に `activePhase: null` / `activeStepIndex: 0` / `bannerQueue: []` のみクリアし、
永続データ（`completedPhases` / `tutorialCompleted` / `viewedHints` / `visitedTabs`）は保持。
再生途中の UI 状態をユーザー跨ぎで持ち越さない設計で、ストーリー側と一貫。

### 2-4. テストの網羅性
ストーリー側テストと同等の 3 観点を担保：
- キー生成（`encodeURIComponent` / trim / null スコープ）
- **ゲスト進行が認証ユーザーへ非継承**（本バグの核心ケース）
- **ユーザー間の相互分離 + 復元**（A 完了 → B 空 → A に戻すと復元）

`completedPhases` だけでなく `viewedHints` / `visitedTabs` / `tutorialCompleted` の分離も検証しており、`partialize` 対象を漏れなくカバーしている。

### 2-5. guest（E2E）経路の整合
E2E は `/api/auth/session` を空レスポンスで fulfill → `available:false` → **guest モード** →
`switchPersistenceScopes(null)` で scope=null → スコープ無しキー `necro-tutorial-store-v2` を読む。
E2E ヘルパのシード先（`necro-tutorial-store-v2`）と一致するため、スコープ化後もシードが効く。

---

## 3. 指摘事項

### 🟡 M1（中・要確認）: Playwright E2E が未実行

本変更は E2E ヘルパ（`tests/helpers/e2e.ts`）とスペック 2 本を含むが、当レビュー環境では
dev server 不在のため E2E を実行できていない。とくに以下は実機確認が望ましい：

- `tests/helpers/e2e.ts` のシードキー修正（`v1`→`v2`、§3-L3）により、**初めてチュートリアル
  シードが実際に効く**ようになる。`clearedStages` を渡すケースで挙動が変わらないか要確認。
- 認証ユーザー（guest 以外）の E2E は現状無い。スコープ化の本命経路（`user:` スコープ）は
  ユニットテストでのみ担保されている。

**対応**: `npx playwright test`（dev server 起動の上）でグリーンを確認してからマージ推奨。

---

### 🟢 L1（低・既知 TT-1）: reload 中のチュートリアル中断
`switchTutorialPersistenceScope` は `reload`（`necro-auth-changed` / セッション復帰 / キャラ作成）
のたびに `activePhase` / `bannerQueue` をクリアする。チュートリアル表示中に reload が走ると中断され得る。
ストーリー ST-1 と同型。実害は低（reload は認証遷移に集中）。→ TECH_DEBT 追記推奨。

### 🟢 L2（低・既知 TT-2/TT-3）: 並行 boot 競合 / 初回ハイドレートのスコープ跨ぎ
`Promise.all` での同時切替時、短時間の二重 reload で rehydrate が交錯し得る（TT-2）。
フルリロード時、オートハイドレートがスコープマーカー越しに前回ユーザーのデータを一瞬読む（TT-3）。
いずれもトリガーが `player` 確定後マウントのため視覚的破綻は起きない。ストーリー ST-2/ST-3 と同型。

### 🟢 L3（低）: E2E シードキー typo の修正は「別バグ修正」
`tests/helpers/e2e.ts` / `new-player-onboarding.spec.ts` の `necro-tutorial-store-v1`→`v2` は、
ストア `name` が元から `v2` だったのに E2E が `v1` をシードしていた**既存 typo の修正**。
本修正の文脈で発見されたもので妥当だが、「これまで E2E のチュートリアルシードは no-op だった」
ことを意味する。修正自体は正しい改善。

### 🟢 L4（低）: 本修正と無関係なテスト追随が同梱
`necro-lab.spec.ts` / `new-player-onboarding.spec.ts` の以下はチュートリアルスコープと無関係：
- `軍団編成` → `装備・編成` / `転職・職業`（`HomeHero.tsx:127,139` で過去コミット `698090eb` 等により
  既にラベル変更済み。E2E が追随できていなかったズレの解消）
- `8/10` → `8/6` + `OVER`（コスト上限のマスターデータ変更への追随）

いずれも E2E を通すための正当な bit-rot 修正だが、**チュートリアル修正とはコミットを分けると履歴が読みやすい**。混入の意図確認のみ（修正不要）。

---

## 4. 機能的レビュー（ロジック確認）

| 観点 | 評価 |
|---|---|
| `scopedTutorialStorage.getItem(name)` が persist の `name`（`necro-tutorial-store-v2`）を baseName として scope 連結 | ✅ scope=null で素のキー、scope ありで `:user:xxx` 付与。正しい |
| `hasPersistedState=false` パスで全状態リセット + `hasHydrated:true` | ✅ 新規ユーザーは確実に空状態から開始 |
| `hasPersistedState=true` パスで `rehydrate()` + 一時状態のみクリア | ✅ 既存ユーザーの進捗を復元 |
| `useTutorialTrigger` の `tutorialHydrated && storyHydrated` ゲート | ✅ switch が `hasHydrated:true` を保証、誤発火なし |
| トリガーの冪等性（`startPhase`/`completeTutorial` が完了済みを弾く） | ✅ 二重発火しない |
| `bannerQueue` は `partialize` 非対象 → switch で `[]` クリアも整合 | ✅ 永続化されないため rehydrate 後も汚染なし |

---

## 5. 総評

`docs/progress/BUGFIX_チュートリアル未発火_2026-06-21.md` の修正方針を、ストーリー側の実績ある
パターンで忠実に実装できている。型・ユニットテストともにグリーンで、本バグ（別ユーザーで
チュートリアルが発火しない）の核心ケースもテストで担保。**マージ可**。

残課題は **M1（E2E 実機確認）** のみブロッカー候補で、それ以外（L1〜L4）は既知エッジケースか
履歴整理レベル。**マージ前に `npx playwright test` のグリーンを確認**し、TT-1〜3 を
`docs/progress/TECH_DEBT.md` のストーリー ST-1〜3 の隣に追記しておくことを推奨する。
