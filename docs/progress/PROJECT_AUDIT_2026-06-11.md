# プロジェクト全体査定レポート（2026-06-11）

> 対象: Necromance Brave リポジトリ全体（コード / マスターデータ / テスト / ビルド / ドキュメント / セキュリティ）
> 実施契機: AIエージェント残課題 R-4〜R-7 完了（[107](../設計書/107_AIエージェント残課題R4-R7対応設計.md) / [106 §9](../設計書/106_AIエージェント精査結果と残課題.md)）後の総点検
> 深刻度凡例: 🔴 High / 🟡 Medium / 🟢 Low

---

## 0. 総合評価

**健全。** 型チェック PASS / Jest **68 suites・624 tests 全 PASS** / `next build` 成功 /
`git diff src/data/master` 空（非破壊運用が機能）。過去監査（BUGS_AND_SECURITY.md の SEC-1〜、
TECH_DEBT.md の C/M/NC/NM 系）はほぼ全て解消済みで、追跡文化が機能している。

設計の強み:
- **決定論ゲート + LLM 上流分離**（Agent A〜E）が全経路で一貫。undo（スナップショット）も整備済み。
- ロジック（`src/logic/`）が React 非依存の純クラス/純関数で、テストが速く安定。
- 設計書 → 実装 → テスト → 完了記録のトレーサビリティが高い。

一方で、**本番境界（API ルート / 環境ゲート）と開発インフラ（CI / dev スクリプト）に
未整備が残る**。以下、深刻度順に問題点と修正案を列挙する。

---

## 1. 🔴 High — 本番リリース前に対応すべき

### A-1. `/api/debug` が無認証・無ゲートで本番ビルドに含まれる

- **事実**: `src/app/api/debug/route.ts` は `NODE_ENV` ゲートも認証ゲートもなく、
  `next build` の出力に含まれている（ビルドログで確認）。
- **影響**: 呼び出し元自身のセッション内容に加え、`AUTH_URL` と `AUTH_SECRET` の設定有無、
  Cookie 名構成という**環境情報を外部に暴露**する。攻撃の事前調査（recon）に有用な情報。
- **修正案（いずれか。推奨は削除）**:
  1. ルートごと削除（デバッグ用途は終わっている）。
  2. 残すなら先頭に `if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });`
     を追加し、admin と同じ「dev でしか存在しない」扱いに統一する。

### A-2. CI が存在しない（`.github/workflows` なし）

- **事実**: 型チェック・Jest・マスターデータ非破壊チェックがすべて手動運用。
- **影響**: 「テストを回し忘れたコミット」がそのまま main に入る。doc106 §4 で
  設計済みの「CI で `git diff --stat src/data/master` が空であることを確認」も未実装。
- **修正案**: 最小の GitHub Actions を 1 本追加する:

```yaml
# .github/workflows/ci.yml（案）
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx jest --ci
      - run: git diff --exit-code --stat src/data/master   # テストの非破壊性を機械的に担保
```

  ライブ verify（Gemini 必須）と Playwright は別ジョブ（手動 or 秘密鍵設定後）に分離する。

---

## 2. 🟡 Medium — 品質・保守性の改善

### B-1. `npm run dev` が Vite で、CLAUDE.md の記述・実体と乖離

- **事実**: `package.json` の `"dev": "vite"`（next/dynamic を shim 差し替え）。
  CLAUDE.md は「`npm run dev` = Next.js dev server on 0.0.0.0:3000」と記載。
- **影響**: Vite dev では **Server Actions / admin 画面 / NextAuth が動かない**。
  新規参加者（または AI エージェント）が CLAUDE.md を信じて混乱する。
- **修正案**: スクリプトを意図が分かる名前に再編し、CLAUDE.md を更新する:
  - `"dev": "next dev -H 0.0.0.0"`（フル機能）
  - `"dev:ui": "vite"`（UI 高速イテレーション用と明記）

### B-2. Prisma 本体とドライバアダプタのメジャー不整合

- **事実**: `@prisma/client@^6.0.0` / `prisma@^6.0.0` に対し `@prisma/adapter-neon@^7.8.0`。
- **影響**: アダプタはエンジンのメジャーに追従するため、ランタイム互換性が保証されない
  （現状動いていても breaking change を踏むリスク）。
- **修正案**: `@prisma/adapter-neon` を 6.x 系へ揃えるか、Prisma 全体を 7 系へ揃えて
  `npx prisma generate` + 統合テストで確認。バージョンは `^` ではなくマイナー固定を推奨。

### B-3. `next-auth@5.0.0-beta.31` への依存

- **影響**: beta は API 変更があり得る。認証はゲームのセーブデータ境界そのもの。
- **修正案**: v5 正式リリースの確認とアップグレード計画を DEFERRED ではなくリリース前タスクに置く。
  当面は lockfile 固定で意図しない beta 更新を防ぐ。

### B-4. 巨大コンポーネント（LegionHub 4,205 行 / BattleCanvas 3,478 行）

- **事実**: 上位 2 ファイルで全 src の約 15% を占める。ResultScreen 1,430 行 / AreaMap 1,467 行も大きい。
- **影響**: 変更影響範囲の把握が困難。BattleCanvas は過去の接続バグ（TECH_DEBT C-1, NC-1〜2, NM-1〜5）
  の温床だった経緯があり、行数がレビュー精度を下げている。
- **修正案**（リファクタは挙動不変・段階的に）:
  - BattleCanvas: 「フェーズ進行（AV/ターン）」「ギミック解決」「演出（PixiJS）」「HUD」を
    カスタムフック + サブコンポーネントへ分離。ロジックは既に `src/logic/` にあるため、主に配線の整理。
  - LegionHub: タブ単位（編成 / 装備 / 残滓 / 霊核）で子コンポーネント化。
  - 分離時は iOS Safari ルール（overflow+transform 分離）を `/ios-audit` で再検証する。

### B-5. E2E（Playwright）が手動前提で CI 未接続

- **事実**: `playwright.config.ts` は `localhost:3080` の起動済みサーバを期待。`webServer` 設定なし。
- **修正案**: config に `webServer: { command: 'next dev -p 3080', url: 'http://localhost:3080' }` を追加し、
  ローカルでもワンコマンド化 → 将来 CI ジョブに昇格。

### B-6. TECH_DEBT の未解決 3 件（既知・低リスクだが放置中）

| # | 内容 | 修正案 |
|---|---|---|
| L-2 | BattleEngine の WAVE 進行が「10 ターン経過」トリガーのまま | 敵全滅トリガーへ変更（BattleCanvas と一本化）。シミュレータ経路（Agent E）が BattleEngine を使う範囲が広がる前に対応 |
| NL-1 | `SynergyBonus.atkBonus/defBonus/avBonus` が未使用 | 仕様として使わないなら**型から削除**（死にフィールドはマスターデータ幻覚の温床）。使うなら BattleDamage へ接続 |
| NL-2 | `isAwakened` が BattleCanvas 未接続 | 覚醒システム実装時に対応（DEFERRED のままで可。DEFERRED.md へ移動して所在を明確化） |

### B-7. EnemyForm の gimmick trigger / effect が自由テキスト入力

- **事実**: `BossGimmick.trigger/effect` は型上 enum（4種/4種）だが、入力欄は text。
  R-6 で value の number 正規化は完了したが、trigger/effect の typo は依然保存できる。
- **修正案**: `<select>` 化（選択肢は game.ts の union から導出）。knownFields/バリデータが
  WARN する前にフォームで予防するのが安い。

---

## 3. 🟢 Low — 整理・衛生

### C-1. ドキュメントの陳腐化（REMAINING.md）

- **事実**: REMAINING.md R-1 は「第1章エネミー 10 体が未登録でゲームが壊れる」とあるが、
  実データ確認の結果 **10 体すべて `enemies.json` に登録済み**（解決済みの記載が残っている）。
- **修正案**: 解決済み項目を DONE.md へ移動。docs/progress の「現役ファイル」を
  CH1_TODO / TECH_DEBT / DEFERRED の 3 本に絞り、REMAINING.md は廃止（DONE へ統合）を推奨。

### C-2. 型安全性の境界（`as never` 等 43 箇所 / `: any` 23 箇所）

- **事実**: 大半はマスターデータ（untyped JSON）と Prisma 境界。エージェント系は設計上
  `Record<string, unknown>` を流すため一定数は不可避。
- **修正案**: 一括除去は不要。`MasterDataService` / `getMasterFile` の戻り値にジェネリクスか
  zod スキーマを導入し、「JSON → 型」の変換を境界 1 箇所に集約すると、下流の cast が自然に減る。

### C-3. `console.log` が非テストコードに 24 箇所

- **修正案**: `src/lib/log.ts` の薄いラッパ（dev のみ出力）へ置換。PixiJS レンダーループ内に
  ログがないことだけは優先確認（60fps 制約）。

### C-4. リリースゲート未消化（CH1_TODO 残 2 件）

- `[ ] NextAuth.js でログインしクラウドセーブが機能する`（実機確認）
- `[ ] iOS Safari で h-[100dvh] レイアウト崩れなし`（実機確認）
- **修正案**: どちらも「コードではなく検証」のタスク。リリース判定チェックリストとして
  最後に実施し、確認手順（端末・ブラウザ・操作列）を DONE.md に記録する。

---

## 4. 今回のターンで発見・修正済みの問題（参考）

| 問題 | 対応 |
|---|---|
| `bulk/snapshot.ts`: 同一ミリ秒内の連続スナップショットで id が衝突し、**undo 履歴が黙って上書き消失**する | id に連番を付与 + 一覧ソートの同時刻 tie-break を決定論化（テストで再現 → 修正済み） |
| `actions.ts` 内の `failKeyOf` 重複実装 2 箇所 / sim 構築コード重複 2 箇所 | R-4 の抽出（`actionSupport.ts`）で統一 |
| sim が AoE を単体同等に評価し AoE スキルが常に「効率が悪い」と誤評定されるバイアス | R-5 の合算サマリで解消 |
| gimmick.value がフォーム編集で string 化（型は number） | R-6 の境界正規化で解消 |

---

## 5. 推奨アクション（優先順）と対応状況 ★2026-06-11 改修実施

| 優先 | 項目 | 状況 |
|---|---|---|
| 1 | **A-1**: `/api/debug` の削除 | ✅ **完了** — 参照ゼロを確認しルートごと削除。ビルド出力からも消滅 |
| 2 | **A-2**: CI ワークフロー追加 | ✅ **完了** — `.github/workflows/ci.yml`（tsc + jest + `git diff --exit-code src/data/master`）。DB 統合テスト（`src/tests/`）は実 Neon 必須のため CI では除外（コメントで明記）。CI コマンドはローカル検証済み（619 PASS） |
| 3 | **B-1**: `dev` スクリプト再編 + CLAUDE.md 修正 | ✅ **完了** — `dev`=next dev（フル機能）/ `dev:ui`=vite。CLAUDE.md の Commands と「BattleCanvas (PixiJS)」誤記（実体は SVG+Framer Motion）も修正 |
| 4 | **B-2**: Prisma / adapter-neon バージョン整合 | ✅ **完了** — prisma / @prisma/client / @prisma/adapter-neon を **6.19.3 に統一**（~6.19.2 でマイナー固定）。`prisma generate` + 実 DB 統合テスト 4 suites PASS で動作確認 |
| 5 | **C-4**: リリースゲート 2 件の実機確認 | ⏳ **要ユーザー実機** — NextAuth クラウドセーブ / iOS Safari 100dvh はコードでなく実機検証。REMAINING.md E-1/E-2 に手順記載済み |
| 6 | **B-6 L-2**: BattleEngine WAVE 進行 | ✅ **完了** — 敵全滅トリガーへ変更 + テスト 2 件追加（battle-engine-dev へ委任） |
| 6 | **NL-1**: SynergyBonus 未使用フィールド | ✅ **完了** — 読み取りゼロを確認し型から削除（同上委任） |
| 6 | **B-7**: gimmick trigger/effect の select 化 | ✅ **完了** — enum select 化・未知値は「未知:」option で保全 |
| 6 | **C-1**: REMAINING.md 整理 | ✅ **完了** — R-1（実は解決済み）/ M-B / M-C / L-1 を解決済みへ更新。TECH_DEBT.md も同期 |
| 7 | **B-4**: 巨大コンポーネント分割 | ✅ **計画完了** — `docs/設計書/108_巨大コンポーネント分割計画.md`（LegionHub 8 Phase / BattleCanvas 7 Phase の挙動不変計画。実装は別途） |

**改修後の最終検証**: `npx tsc --noEmit` PASS / Jest **68 suites・626 tests 全 PASS** / `next build` 成功 /
`git diff src/data/master` 空。

**残課題（本レポート起票分で未対応）**: B-3（next-auth beta → 正式版追従計画）/ B-5（Playwright webServer 化）/
C-2（マスターデータ境界の型付け）/ C-3（console.log のロガー化）/ B-4 の実装フェーズ。

---

## 6. 査定方法（再現手順）

- `npx tsc --noEmit` / `npx jest`（68 suites / 624 tests）/ `npm run build` — すべて PASS を確認
- `git diff --stat src/data/master` — 空（テスト非破壊性）
- grep 監査: TODO/FIXME 0 件、`as never|as unknown` 43、`: any` 23、`console.log` 24
- 実データ照合: REMAINING.md R-1 の 10 エネミー ID を enemies.json / monsters.json と突合
- ルート監査: `middleware.ts`（/api/game のみ保護）、`admin/layout.tsx`（NODE_ENV ゲート）、
  `api/debug`（ゲートなし ← A-1）
- 依存監査: package.json の prisma 6 系 vs adapter-neon 7 系、next-auth beta、dev=vite
