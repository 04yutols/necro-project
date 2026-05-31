Server Actions のセキュリティ監査を実行します: $ARGUMENTS

$ARGUMENTS がある場合: そのファイルを監査する
$ARGUMENTS がない場合: `src/app/actions.ts` と `src/app/api/` 以下を監査する

## Step 1: 対象ファイルの特定

```bash
# $ARGUMENTS がない場合
find src/app -name "*.ts" -not -name "*.test.ts" | head -20
```

## Step 2: 認証チェック

対象ファイルの全 `export async function` を列挙し、各関数に `auth()` があるか確認する。

```bash
grep -n "export async function\|auth()\|session\." src/app/actions.ts | head -40
```

チェック:
- [ ] 各 Server Action の冒頭に `const session = await auth()` があるか
- [ ] `!session?.user?.id` のガード節があるか
- [ ] 認証なしに DB 操作が実行できる経路がないか

## Step 3: IDOR チェック

```bash
grep -n "findFirst\|findUnique\|findMany\|update\|delete" src/app/actions.ts | head -30
```

チェック:
- [ ] DB 取得時に `{ where: { id: xxx, userId: session.user.id } }` になっているか
- [ ] `{ where: { id: xxx } }` のみ（所有者確認なし）の場合は IDOR として報告

## Step 4: ステージトークン（SEC-8）チェック

```bash
grep -n "processStageResultAction\|tokenId\|consumeStageToken\|stageToken" src/app/actions.ts
```

チェック:
- [ ] `processStageResultAction` が `tokenId` パラメータを受け取っているか
- [ ] `consumeStageToken()` による検証があるか
- [ ] tokenId なしで報酬が取得できる経路がないか（Phase 2 以降）

## Step 5: ドロップ率操作チェック（SEC-5）

```bash
grep -n "critRate\|dropRate\|dropBonus" src/services/RewardService.ts
```

チェック:
- [ ] `critRate` がドロップ率計算に混入していないか
- [ ] ドロップ率ボーナスは独立したフィールドを使っているか

## Step 6: パスワード・認証チェック（SEC-7）

```bash
grep -n "validatePassword\|bcrypt\|password" src/services/AuthService.ts | head -20
```

チェック:
- [x] `validatePassword()` が 12 文字以上 OR 英数混合 8 文字以上を要求している（✅ 対応済み）
- [ ] bcrypt のコストが 10 以上か

## レポート出力形式

```
## セキュリティ監査: <ファイル名>
実施日: <日付>

### 🔴 Critical（即修正が必要）
| 関数名 | 問題 | SEC-X | 修正方針 |
|--------|------|-------|---------|
| xxx | IDOR: userId確認なし | SEC-2 | where句にuserIdを追加 |

### 🟡 Medium（次スプリントで対応）
| 関数名 | 問題 | SEC-X | 修正方針 |
|--------|------|-------|---------|
| processStageResultAction | tokenId未検証 | SEC-8 | consumeStageToken追加 |

### 🟢 対応済み
- SEC-7: validatePassword ✅

### 関数別チェック結果
| 関数名 | 認証 | IDOR対策 | 入力検証 | トークン |
|--------|------|---------|---------|---------|
| startStageAction | ✅ | ✅ | ✅ | N/A |
| processStageResultAction | ✅ | ✅ | ⚠️ tokenId optional | 🔴 未実装 |

### 総評
<リスクレベルと優先対応事項>
```
