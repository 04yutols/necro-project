型チェック → テスト → コミットを順番に実行します。$ARGUMENTS

## 手順

### Step 1: TypeScript 型チェック

```bash
npx tsc --noEmit
```

型エラーがある場合は **中止してエラー内容を報告**する。修正が必要。

### Step 2: Jest テスト

```bash
npm test -- --passWithNoTests 2>&1 | tail -20
```

テストが失敗した場合は **中止して失敗テストを報告**する。修正が必要。

### Step 3: ステージ確認

```bash
git status
git diff --staged --stat
```

ステージされている変更がなければ、未ステージの変更ファイルを一覧表示してユーザーに確認を求める。

### Step 4: コミットメッセージ生成

以下の Conventional Commits 形式でメッセージを生成する:

```
<type>(<scope>): <subject>
```

**type の選択基準:**
| type | 使う場面 |
|------|---------|
| `feat` | 新機能の追加 |
| `fix` | バグ修正（BUG-Xに対応） |
| `refactor` | 動作を変えないコード改善 |
| `test` | テストの追加・修正 |
| `docs` | ドキュメントのみの変更 |
| `style` | フォーマット・CSS のみの変更 |
| `chore` | ビルド設定・依存関係の更新 |
| `sec` | セキュリティ修正（SEC-Xに対応） |

**scope の選択基準:**
| scope | 対象 |
|-------|------|
| `battle` | BattleEngine, ゲームロジック |
| `ui` | コンポーネント、画面 |
| `db` | Prisma スキーマ、マイグレーション |
| `auth` | 認証、AuthService |
| `master` | マスターデータ JSON |
| `sec` | セキュリティ修正 |
| `test` | テストファイル |
| `docs` | 設計書、進捗ドキュメント |

**subject の書き方:**
- 日本語で変更の内容を端的に（40文字以内）
- バグ修正の場合は BUG-X/SEC-X の番号を含める
- 例: `fix(battle): BUG-10 全モンスター追撃の複数ターゲット分散`
- 例: `sec(auth): SEC-7 パスワードポリシー強化（12文字 or 英数混合8文字）`
- 例: `feat(master): enemies.jsonのボスステータス修正`

$ARGUMENTS がある場合はコミットメッセージのヒントとして使用する。

### Step 5: コミット実行

```bash
git commit -m "$(cat <<'EOF'
<生成したメッセージ>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 6: 結果確認

```bash
git log --oneline -3
```

最後の3コミットを表示して完了を報告する。
