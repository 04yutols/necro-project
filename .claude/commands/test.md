テストを実行して結果を報告してください: $ARGUMENTS

## 引数の解釈

| 引数 | 実行コマンド |
|------|-------------|
| (なし) | `npm test` (全 Jest) |
| `BattleEngine` | `npm test -- --testPathPattern="BattleEngine"` |
| `NecroService` | `npm test -- --testPathPattern="NecroService"` |
| `JobService` | `npm test -- --testPathPattern="JobService"` |
| `integration` | `npm test -- --testPathPattern="integration"` |
| `e2e` | `npx playwright test` |
| `e2e <spec>` | `npx playwright test tests/<spec>.spec.ts` |
| `type` または `ts` | `npx tsc --noEmit` |

## 報告フォーマット

```
Jest: X passed, Y failed
失敗:
  - <テスト名>: <エラー概要>
修正提案: <原因と対処方針>
```

Playwright は dev server が必要 (npm run dev が起動中であること)。
失敗した場合は根本原因を分析して修正方針を提示すること。
