BUGS_AND_SECURITY.md に記載のバグを修正します: $ARGUMENTS

## 引数の解釈

| 引数 | 動作 |
|------|------|
| `BUG-X` または `SEC-X` | そのIDのバグを修正 |
| (なし) | BUGS_AND_SECURITY.md を読んで未対応の最優先バグを提案 |

## 手順

### Step 1: バグ情報の確認

```bash
cat docs/progress/BUGS_AND_SECURITY.md | grep -A 5 "$ARGUMENTS"
```

1. `docs/progress/BUGS_AND_SECURITY.md` を読む
2. 対応する設計書を特定する（BUGS_AND_SECURITY.md の「設計書」列を参照）

設計書のパスパターン:
```
BUG-2  → docs/設計書/66_BUG2_状態異常DoT最大HP参照設計.md
BUG-4  → docs/設計書/56_BUG4_残滓強化素材スタック消費設計.md
BUG-5  → docs/設計書/57_BUG5_BURN免疫チェック設計.md
BUG-6  → docs/設計書/58_BUG6_敵HPランタイム分離設計.md
BUG-7  → docs/設計書/59_BUG7_getMutableStats型安全化設計.md
BUG-8  → docs/設計書/60_BUG8_状態異常行動スキップターン進行設計.md
BUG-9  → docs/設計書/61_BUG9_NecroStatus_expテストモック整合設計.md
BUG-10 → docs/設計書/62_BUG10_軍団追撃ターゲット分散設計.md
PERF-1 → docs/設計書/63_PERF1_残滓シャッフルFisherYates設計.md
SEC-2  → docs/設計書/52_SEC2_fetchPlayerAction_IDOR設計.md
SEC-3  → docs/設計書/53_SEC3_GameManager_updateParty永続化設計.md
SEC-4  → docs/設計書/54_SEC4_暗号論的ID生成設計.md
SEC-5  → docs/設計書/55_SEC5_ドロップ率ボーナスcritRate分離設計.md
SEC-6  → docs/設計書/67_SEC6_JWTセッション失効設計.md
SEC-8  → docs/設計書/68_SEC8_ステージ開始トークン設計.md
```

### Step 2: 設計書を読む

特定した設計書を Read して以下を把握する:
- 問題の根本原因
- 変更が必要なファイル一覧
- 具体的な修正内容（コードスニペットがある場合は参照）
- テスト方針

### Step 3: 実装

設計書の仕様に従って実装する。
設計書にコードスニペットがある場合はそれを参考に、なければ設計書の意図を解釈して実装する。

**実装時の原則:**
- 設計書の変更範囲を超えないこと（スコープクリープ禁止）
- `npx tsc --noEmit` が通ること
- 既存テストを壊さないこと

### Step 4: テスト実行

```bash
npm test -- --passWithNoTests 2>&1 | tail -30
```

設計書の「テスト方針」セクションに記載のテストケースがある場合は、それに対応するテストを追加する。

### Step 5: 型チェック

```bash
npx tsc --noEmit
```

### Step 6: BUGS_AND_SECURITY.md の更新

`docs/progress/BUGS_AND_SECURITY.md` の該当エントリを更新する:
- ステータスを「✅ 完了」に変更
- 完了日（今日の日付）を記入
- 変更ファイルを記録

### Step 7: 完了報告

以下の形式で報告する:
```
## <BUG-X/SEC-X> 修正完了

### 変更ファイル
- <ファイルパス:行番号> — <変更内容>

### テスト結果
<PASS/FAIL と件数>

### 残存リスク
<あれば記述、なければ「なし」>
```
