# Agent Skills & Slash Commands 推薦

> 作成日: 2026-05-29  
> Claude Code の Sub-agent 機能と MCP サーバーを対象にした調査・提案。

---

## 1. 現状棚卸し

### プロジェクト内エージェント (`.claude/agents/`)

| エージェント | 役割 | カバーしていないこと |
|---|---|---|
| `battle-engine-dev` | ゲームロジック・BattleEngine・Services | セキュリティ監査、バランス検証 |
| `code-reviewer` | コードレビュー（読み取り専用） | IDOR/認証パターンの深いチェック |
| `ios-debugger` | iOS Safari レイアウト修正 | — |
| `necro-ui-builder` | Gothic-Morphism UI構築 | — |
| `test-runner` | テスト実行・報告（読み取り専用） | — |

### グローバルエージェント (`~/.claude/agents/`)

| エージェント | 役割 |
|---|---|
| `demonization-designer` | 魔神化フォームデザイン（設計書16準拠） |
| `ios-layout-debugger` | iOS Safari レイアウトデバッグ |
| `mobile-game-ui-builder` | モバイルゲームUI構築 |

### スラッシュコマンド (`.claude/commands/`)

| コマンド | 用途 |
|---|---|
| `/ios-audit` | iOS Safari レイアウトバグスキャン |
| `/new-screen` | 新規スクリーン雛形作成 |
| `/test` | Jest テスト実行 |
| `/ts` | TypeScript 型チェック |

---

## 2. ギャップ分析

```
[ゲームロジック]   battle-engine-dev ... ✅ カバー済み
[UIビルド]        necro-ui-builder .... ✅ カバー済み
[コードレビュー]  code-reviewer ....... ✅ カバー済み（浅め）
[テスト実行]      test-runner ......... ✅ カバー済み
[iOS修正]         ios-debugger ........ ✅ カバー済み

[セキュリティ監査] ................... ❌ 専門エージェント不在
[マスターデータ検証] ................. ❌ 専門エージェント不在
[バランス設計検証] ................... ❌ 専門エージェント不在
[DB/Prisma専門]   .................... ❌ battle-engine-devに混在

[/commit ワークフロー] ............... ❌ コマンド不在
[/sec-audit] ......................... ❌ コマンド不在
[/validate-master] ................... ❌ コマンド不在
[/bug-fix] ........................... ❌ コマンド不在
```

---

## 3. 新規エージェント推奨

### 3-1. `sec-auditor` — セキュリティ監査エージェント

**用途:** Server Actions / API ルートを SEC-1〜SEC-8 の設計書に照らしてレビュー。  
**読み取り専用**（コード変更なし）。

```yaml
# .claude/agents/sec-auditor.md のフロントマター
name: sec-auditor
description: >
  Use this agent to audit Server Actions and API routes for security issues.
  Checks for: missing auth, IDOR vulnerabilities, missing ownership validation,
  unvalidated stageId, token replay attacks, JWT revocation, and drop rate
  manipulation. Follows the SEC-1 through SEC-8 design documents.
  READ-ONLY — reports issues but does not modify code.
tools: Bash, Read, Grep, Glob
model: sonnet
```

**チェック項目（エージェント本文に記述）:**
- `auth()` 呼び出しの有無
- `userId` による所有者確認（IDOR対策）
- `stageToken` の検証（SEC-8）
- `critRate` とドロップ率ボーナスの混在（SEC-5）
- `bcrypt` コストが 10 以上か（SEC-7）
- Server Actions に `'use server'` ディレクティブがあるか

---

### 3-2. `master-data-validator` — マスターデータ検証エージェント

**用途:** 5つのマスターデータJSON（enemies/skills/stages/items/demonForms）を  
クロスリファレンスチェック・型整合・バランス異常の観点で検証。

```yaml
name: master-data-validator
description: >
  Use this agent to validate the 5 master data JSON files in src/data/master/.
  Checks: TypeScript type compatibility, cross-references (skillId in skills.json,
  stageId in stages.json, monsterIds in enemies.json), stat balance anomalies
  (boss weaker than normal enemies, zero-value critical stats), and drop rate
  sum validation. READ-ONLY — reports issues only.
tools: Bash, Read, Grep, Glob
model: haiku
```

**検証内容:**
- ボスのステータスが通常エネミーより弱くなっていないか（既知バグ: `ossuary_wyrm_lord` が `bone_colossus` より弱い）
- `skills.json` の `mpCost` が全スキルに存在するか
- `stages.json` の `unlockRequires` が存在するステージIDを指しているか
- ドロップテーブルの確率合計が 0〜1 の範囲内か
- `demonForms.json` の参照先 `jobId` が `jobs.json` に存在するか

---

### 3-3. `balance-designer` — バランス設計検証エージェント

**用途:** 設計書19（スキルバランス設計書）の power 倍率ガイドラインと  
実際のマスターデータを照合。新スキル・新エネミー追加時に必ず使う。

```yaml
name: balance-designer
description: >
  Use this agent to verify skill and enemy balance against the design guidelines
  in docs/設計書/19_スキルバランス設計書.md. Checks skill power multipliers,
  enemy HP/ATK curves per chapter, status ailment rates, and ultimate skill
  balance. Use when: adding new skills, new enemies, or adjusting existing values.
  READ-ONLY — proposes balanced values but does not modify files.
tools: Read, Bash, Grep
model: sonnet
```

**活用例:**
- `battle-engine-dev` がスキルを実装 → `balance-designer` が数値の妥当性を確認
- 新ボスの HP/ATK を `balance-designer` に投げると適正値の提案が返ってくる

---

### 3-4. `db-expert` — Prisma/DB 専門エージェント

**用途:** `prisma/schema.prisma` の変更、マイグレーション、クエリ最適化。  
現在 `battle-engine-dev` が兼務しているが、DB操作に専念するエージェントを分離する。

```yaml
name: db-expert
description: >
  Use this agent for Prisma schema changes, migrations, and database operations.
  Knows the Necromance Brave data model (Character, Monster, SoulShard, Item,
  AbyssalResidue), NextAuth v5 schema requirements, and Neon PostgreSQL constraints.
  Use when: adding new DB fields, creating migrations, debugging DB queries,
  or analyzing query performance.
tools: Bash, Read, Edit, Write
model: sonnet
```

---

## 4. 新規スラッシュコマンド推奨

### `/commit` — 型チェック→テスト→コミット自動化

```markdown
# .claude/commands/commit.md

コミットを作成します: $ARGUMENTS

## 手順

1. TypeScript 型チェック
   \`\`\`bash
   npx tsc --noEmit
   \`\`\`
   エラーがあれば中止してユーザーに報告。

2. Jest テスト実行
   \`\`\`bash
   npm test -- --passWithNoTests
   \`\`\`
   失敗があれば中止してユーザーに報告。

3. git status で変更ファイルを確認

4. git diff --staged でステージ済み内容を確認
   （ステージされていない場合は変更ファイルを一覧表示してユーザーに確認）

5. コミットメッセージを生成
   - 形式: `<type>(<scope>): <subject>`
   - type: feat / fix / refactor / test / docs / style / chore
   - scope: battle / ui / db / auth / master / sec / bug
   - 例: `fix(battle): BUG-10 全モンスター追撃の複数ターゲット分散`

6. コミット実行
   - ステージされていないファイルは含めない
   - $ARGUMENTS があればコミットメッセージのヒントとして使用
```

---

### `/sec-audit` — Server Actions セキュリティ監査

```markdown
# .claude/commands/sec-audit.md

Server Actions / API ルートのセキュリティ監査を実行します: $ARGUMENTS

## 対象ファイル

$ARGUMENTS がある場合: そのファイルを監査  
$ARGUMENTS がない場合: `src/app/actions.ts` と `src/app/api/**/*.ts` を監査

## チェックリスト

各 export async function に対して:
- [ ] `auth()` で認証確認しているか
- [ ] `session.user.id` を使って所有者確認しているか（IDOR対策）
- [ ] ユーザー入力（stageId等）をサーバー側で検証しているか
- [ ] stageToken の検証（SEC-8）が実装されているか（processStageResultAction のみ）
- [ ] try/catch でエラーを適切に処理しているか
- [ ] 機密情報をエラーメッセージに含めていないか

## レポート形式

```
### SEC-AUDIT: <ファイル名>

| 関数 | 認証 | 所有者確認 | 入力検証 | 問題 |
|------|------|-----------|---------|------|
| startStageAction | ✅ | ✅ | ✅ | — |
| processStageResultAction | ✅ | ✅ | ⚠️ tokenId optional | SEC-8 未実装 |
```
```

---

### `/validate-master` — マスターデータ一括検証

```markdown
# .claude/commands/validate-master.md

マスターデータ JSON を検証します。

## 対象ファイル

- `src/data/master/enemies.json`
- `src/data/master/skills.json`
- `src/data/master/stages.json`
- `src/data/master/items.json`
- `src/data/master/demonForms.json`
- `src/data/master/jobs.json`

## チェック項目

1. **クロスリファレンス**
   - stages.json の unlockRequires → 存在するステージIDか
   - demonForms.json の jobId → jobs.json に存在するか
   - enemies.json の skillIds → skills.json に存在するか

2. **バランス異常**
   - ボスが同エリアの通常エネミーより hp/atk が低くないか
   - 全スキルに mpCost フィールドがあるか

3. **型チェック**
   ```bash
   npx tsc --noEmit
   ```
   MasterDataService の getter 経由で型エラーを検出

## 出力例

```
✅ skills.json — 32件、全フィールド OK
⚠️ enemies.json — ossuary_wyrm_lord (boss): hp=180 < bone_colossus (elite): hp=720 → バランス異常
✅ stages.json — 5件、クロスリファレンス OK
✅ items.json — 12件、全フィールド OK
✅ demonForms.json — 8件、全 jobId 存在確認 OK
```
```

---

### `/bug-fix` — バグ修正標準ワークフロー

```markdown
# .claude/commands/bug-fix.md

BUGS_AND_SECURITY.md に記載のバグを修正します: $ARGUMENTS

## 手順

1. `docs/progress/BUGS_AND_SECURITY.md` を読み、$ARGUMENTS のバグIDに対応する設計書を確認
   - 例: BUG-10 → `docs/設計書/62_BUG10_軍団追撃ターゲット分散設計.md` を読む

2. 設計書の「変更ファイル一覧」に従って対象ファイルを特定

3. 実装（設計書の仕様に従う）

4. 関連テストを実行
   ```bash
   npm test -- --testPathPattern="<関連ファイル>"
   ```

5. 型チェック
   ```bash
   npx tsc --noEmit
   ```

6. `docs/progress/BUGS_AND_SECURITY.md` のステータスを「✅ 完了」に更新
   - 完了日付、変更ファイルを記録

7. コミットメッセージは `fix(<scope>): <BUG-ID> <バグの内容>` 形式で
```

---

### `/skill-design` — 新スキル追加ワークフロー

```markdown
# .claude/commands/skill-design.md

新しいスキルをマスターデータに追加します: $ARGUMENTS

## 引数フォーマット

`/skill-design <jobId> <スキル名> <属性> <power倍率>`

例: `/skill-design dark_knight 冥府斬 DARK 1.8`

## 手順

1. `docs/設計書/19_スキルバランス設計書.md` を読んで power 倍率のガイドラインを確認

2. `src/data/master/skills.json` に新スキルエントリを追加
   ```json
   {
     "id": "<jobId>_<snake_case_name>",
     "name": "<スキル名>",
     "element": "<属性>",
     "power": <倍率>,
     "mpCost": <コスト>,
     "targetType": "SINGLE | ALL | SELF",
     "attackType": "SLASH | STRIKE | MAGIC | ...",
     "description": "<説明文>"
   }
   ```

3. `src/data/master/jobs.json` の該当 jobId の `skills` 配列に新スキルIDを追加

4. `npx tsc --noEmit` で型チェック

5. BattleEngine テストで新スキルが正しく処理されることを確認
```

---

## 5. MCP サーバー推奨

Model Context Protocol (MCP) サーバーをインストールすることで、  
Claude Code が外部サービスに直接アクセスできるようになる。

### 5-1. `@modelcontextprotocol/server-postgres`

```bash
npm install -g @modelcontextprotocol/server-postgres
```

**用途:** Prisma を介さずに Neon PostgreSQL に直接クエリ。  
**活用例:**
```
# Claude Code のプロンプトで
"SELECT * FROM Character WHERE userId = '...' LIMIT 5"
```
- `db-expert` エージェントと組み合わせるとスキーマ確認・クエリ実行が直接できる
- `prisma studio` の代わりに CLI から確認可能

**設定 (`~/.claude/claude.json`):**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    }
  }
}
```

---

### 5-2. `@modelcontextprotocol/server-github`

```bash
# GH_TOKEN 環境変数が必要
```

**用途:** GitHub Issues / PR を Claude Code から直接操作。  
**活用例:**
- `BUGS_AND_SECURITY.md` のバグをGitHub Issueとして自動起票
- PRレビューコメントをClaude Codeで処理
- `feat/20260524` ブランチの変更サマリーからPRドラフトを生成

---

### 5-3. `@upstash/mcp-server` ※ 要確認

**用途:** Upstash Redis に直接アクセス。SEC-8 のステージトークンをデバッグ時に確認。  
**活用例:**
```
# Claude Code のプロンプトで
"stage:token:* のキーを一覧表示して"
"このtokenIdが有効かチェックして"
```
- SEC-8 実装後のデバッグで `consumeStageToken()` の動作を直接確認できる

**注意:** 公式 `@upstash/mcp` は2025年時点でベータ。代替として `ioredis` CLI で同等操作可能。

---

### 5-4. Playwright MCP (`@playwright/mcp`)

```bash
npx @playwright/mcp
```

**用途:** ブラウザ上のゲーム画面をClaude Codeが直接操作・確認。  
**活用例:**
- 「バトル画面を開いてスキルを使用してスクリーンショットを撮って」
- iOS Safari レイアウトバグをブラウザで再現確認
- E2Eテストのシナリオ録画

---

## 6. 採用優先度まとめ

### 新規エージェント

| エージェント | 優先度 | 理由 |
|---|---|---|
| `sec-auditor` | ★★★ 高 | SEC-6〜SEC-8 が残っており、実装前後のレビューが必要 |
| `master-data-validator` | ★★☆ 中 | ossuary_wyrm_lord バランス異常が既に発見済み。JSONが増えるほど重要 |
| `balance-designer` | ★★☆ 中 | 第1章5ステージのバランステストに必要 |
| `db-expert` | ★☆☆ 低 | `battle-engine-dev` が現状カバーしている。DB作業が増えたら分離 |

### 新規スラッシュコマンド

| コマンド | 優先度 | 理由 |
|---|---|---|
| `/commit` | ★★★ 高 | tsc+test+commit の手動3ステップを毎回やっている |
| `/bug-fix` | ★★★ 高 | BUGS_AND_SECURITY.md に9件以上の未対応バグがある |
| `/validate-master` | ★★☆ 中 | JSON更新のたびに手動クロスチェックしている |
| `/sec-audit` | ★★☆ 中 | SEC-8 実装後の確認に使う |
| `/skill-design` | ★☆☆ 低 | 第1章完成後に新スキルを追加するとき |

### MCP サーバー

| サーバー | 優先度 | 理由 |
|---|---|---|
| `@modelcontextprotocol/server-postgres` | ★★☆ 中 | DBデバッグを prisma studio なしで行える |
| `@playwright/mcp` | ★★☆ 中 | UI確認を自動化できる。ios-debugger と相性良い |
| `@modelcontextprotocol/server-github` | ★☆☆ 低 | Issue管理を自動化したいなら |
| `@upstash/mcp` | ★☆☆ 低 | SEC-8実装後のRedisデバッグ用 |

---

## 7. 実装する場合のファイルパス

```
# 新規エージェント（プロジェクト固有）
.claude/agents/sec-auditor.md
.claude/agents/master-data-validator.md
.claude/agents/balance-designer.md

# 新規スラッシュコマンド
.claude/commands/commit.md
.claude/commands/bug-fix.md
.claude/commands/validate-master.md
.claude/commands/sec-audit.md
.claude/commands/skill-design.md

# MCP設定（グローバル）
~/.claude/claude.json  ← mcpServers セクションに追記
```
