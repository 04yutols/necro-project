# 78 — IMP-6 ターン順序プレビューUI設計

> 対象: `src/logic/TurnOrderSystem.ts` / `src/components/battle/BattleCanvas.tsx`
> 対応日: 2026-05-30
> 関連: `docs/progress/IMPROVEMENTS.md` の `IMP-6`

---

## 1. 背景

バトルはSPDから行動値（AV）を計算し、AVが小さいアクターから順に手番を処理する。

```typescript
actionDelay = 10000 / spd;
```

`TurnOrderSystem.scheduleEnemiesUntilPlayer()` は敵行動を解決する際に `orderPreview` を返し、BattleCanvasもログへ行動順を出力していた。一方、画面上部の `TurnOrderStrip` は固定値の仮表示であり、実AV、敵編成、ウェーブ遷移と接続されていなかった。

---

## 2. 問題

ログだけでは、プレイヤーがコマンド選択中に次の判断を行いにくい。

| 判断 | 必要な情報 |
|---|---|
| 通常攻撃とスキルの選択 | 次に敵が割り込むか |
| AV遅延ギミックへの対応 | 自分の手番がどこまで後退したか |
| 魔神化の割り込み判断 | 行動値0への固定で順序がどう変化したか |
| 召喚ボスへの対応 | 新しい増援が何番目に動くか |

固定表示は実戦闘と一致しないため、誤った戦略判断を誘発する。

---

## 3. 採用仕様

### 3.1 表示位置

既存の上部HUD内にある `TurnOrderStrip` を利用する。新しい縦領域を増やさず、モバイルの `100dvh` 制約を維持する。

### 3.2 表示内容

最大5件を横一列に表示する。

| 項目 | プレイヤー | 敵 |
|---|---|---|
| 主色 | Void Purple `#BC00FB` | Red `#ef4444` |
| ラベル | `勇` | 敵名の先頭1文字 |
| 補助情報 | 丸めた現在AV | 丸めた現在AV |
| 先頭手番 | 発光枠、`▶` | 発光枠、`▶` |

バッジは `34x40px`、先頭のみ `40x40px` とする。可変長の敵名を直接描画せず、詳細名は `title` と `aria-label` に保持する。

### 3.3 並び順

既存の `buildTurnOrder()` と同じ規則を使う。

1. `currentAv` の昇順。
2. AVが同じ場合は `spd` の降順。
3. SPDも同じ場合は `tieBreaker` の昇順。

UI専用に別のソート規則を持たない。

---

## 4. 状態設計

### 4.1 正本と投影

`battleAvRef` を戦闘ロジックの正本として維持し、React stateには表示専用の `turnOrderPreview` だけを保持する。

```typescript
const battleAvRef = useRef<BattleAvState>({ player: 0, enemies: {} });
const [turnOrderPreview, setTurnOrderPreview] = useState<TurnOrderEntry[]>([]);
```

`battleAvRef` 自体をstate化しない理由は、敵行動のタイマー処理が最新値を同期的に参照する既存構造を保つためである。

### 4.2 共通プレビュー関数

純粋ロジック層に最大件数の制御を集約する。

```typescript
export function buildTurnOrderPreview(
  actors: TurnOrderActor[],
  maxEntries = 5,
): TurnOrderEntry[] {
  return buildTurnOrder(actors).slice(0, Math.max(0, Math.floor(maxEntries)));
}
```

BattleCanvasはプレイヤーと生存敵を `TurnOrderActor[]` に変換し、この関数へ渡す。

### 4.3 更新契機

| 契機 | 更新方法 |
|---|---|
| バトル開始 | 初期AVを確定し、プレビューを作る |
| ウェーブ遷移 | 新ウェーブの敵でAVを初期化し直す |
| 通常ターン終了 | プレイヤーAVへ行動遅延を加算して更新する |
| 敵行動開始 | `scheduleEnemiesUntilPlayer()` の `orderPreview` を表示する |
| 敵行動完了 | 永続化済みAVから次のプレビューを再計算する |
| ボスAV遅延 | 加算後のプレイヤーAVで即時更新する |
| 魔神化 | プレイヤーAVを0へ固定して即時更新する |
| 敵の撃破・召喚・蘇生 | `enemies` 更新時に生存敵一覧から再計算する |

---

## 5. 実装詳細

### 5.1 TurnOrderSystem

`buildTurnOrderPreview()` を追加し、`scheduleEnemiesUntilPlayer()` もこの関数を利用する。これによりロジックテストとUIが同じ切り詰め規則を共有する。

### 5.2 BattleCanvas

以下の役割を持つ補助関数を追加する。

| 関数 | 責務 |
|---|---|
| `buildCanvasTurnOrderPreview()` | 現在AVと生存敵から表示用配列を作る |
| `commitBattleAvState()` | AV正本の更新とUI投影を同時に行う |
| `refreshTurnOrderPreview()` | 敵増減後に現在AVからUI投影だけを更新する |

`TurnOrderStrip` は `order: TurnOrderEntry[]` を受け取り、最大5件を描画する。固定アクター、固定AVは持たない。

---

## 6. テスト設計

### 6.1 TurnOrderSystem

`TurnOrderSystem.test.ts` に以下を追加する。

| ケース | 期待 |
|---|---|
| 6アクターを渡す | AV順で先頭5件だけ返る |
| `maxEntries = 0` | 空配列を返す |
| 返却された各要素 | `actionDelay` を保持する |

既存テストでAV同値時のSPD優先、敵のスケジューリング、状態異常によるAV遅延も回帰確認する。

### 6.2 画面確認

ローカルバトル画面で以下を確認する。

- 上部HUDに最大5件のバッジが収まる。
- プレイヤーは紫、敵は赤で表示される。
- 先頭手番だけが強調される。
- 各バッジにAV値が表示される。
- モバイル幅でバトルアリーナやコマンド領域と重ならない。

---

## 7. 非対応範囲

- 使役魔を独立した行動順アクターとして扱う変更。
- AV減少スキル、行動順引き上げスキルの新規追加。
- 敵画像サムネイルの生成。
- バッジクリックによる敵ターゲット変更。

---

## 8. 完了条件

- `buildTurnOrderPreview()` が最大5件のAV順プレビューを返す。
- BattleCanvasの固定バッジ列が実AV連動表示へ置き換わる。
- 初期化、ウェーブ遷移、AV遅延、魔神化、敵増減で表示が更新される。
- `TurnOrderSystem.test.ts` / `npx tsc --noEmit` / 全体Jest / build が通る。
- ローカル画面でモバイル表示の重なりがない。
