# 47_魔神化INTERRUPT接続設計

## 目的

魔神化ボタンの `INTERRUPT` 表示と実際の挙動を一致させる。ソウルゲージが100%の状態では、プレイヤーターン中の通常発動だけでなく、敵ターン中にも魔神化を発動できるようにし、進行中または予約済みの敵行動をキャンセルして即座にプレイヤー操作へ戻す。

対象課題は `docs/progress/TECH_DEBT.md` の `NM-3. 魔神化「INTERRUPT」は実際にはプレイヤーターン中しか機能しない`。

## 現状の問題

従来のUIではソウルゲージ100%時に魔神化ボタンへ `INTERRUPT` と表示していたが、発動条件が実装上曖昧だった。敵ターン中の割り込みが保証されていない場合、ユーザー体験として「割り込み可能に見えるのに押せない、または押しても敵行動が止まらない」状態になる。

魔神化は `docs/設計書/16_魔神化システム.md` で「敵行動を中断し、3回限定で高火力行動を行う切り札」と定義しているため、BattleCanvas上でも敵ターン中の実割り込みを成立させる。

## 採用方針

### 発動可能フェーズ

魔神化の発動を許可するフェーズは次の2つに限定する。

| phase | 挙動 |
| --- | --- |
| `playerTurn` | 通常の魔神化。行動値を0に固定し、プレイヤーターンを継続する |
| `enemyTurn` | `INTERRUPT`。予約済み敵行動をキャンセルし、プレイヤーターンへ戻す |

以下のフェーズでは発動不可とする。

| phase | 理由 |
| --- | --- |
| `skillMenu` | コマンド選択中の二重入力を避ける |
| `itemMenu` | コマンド選択中の二重入力を避ける |
| `animating` | 攻撃・術・魔神技の演出途中に状態が競合する |
| `waveTransition` | WAVE遷移、勝敗遷移、リザルト遷移を保護する |

### ロジック分離

発動可否はUIコンポーネントに直書きせず、`src/logic/DemonizationSystem.ts` の純粋関数で解決する。

| 関数 | 役割 |
| --- | --- |
| `resolveDemonActivation()` | ゲージ、魔神化中フラグ、phaseから発動可否と次フェーズを返す |
| `canActivateDemonModeInPhase()` | UIボタンのenabled判定用 |
| `shouldInterruptEnemyTurnOnDemonize()` | 敵ターン割り込み時だけ敵行動キャンセルを走らせる |

`resolveDemonActivation()` は不許可理由も返す。理由は `GAUGE_NOT_READY`、`ALREADY_ACTIVE`、`INVALID_PHASE` の3種とする。

## 敵ターン割り込みの仕組み

BattleCanvasの敵行動は `runEnemyTurn()` 内で `setTimeout` により複数予約される。各予約コールバックは、開始時に採番した `turnToken` と `enemyTurnSerialRef.current` を比較し、不一致なら早期returnする。

敵ターン中に魔神化した場合は、`handleDemonize()` で `enemyTurnSerialRef.current += 1` を実行する。これにより、その敵ターンで予約済みだった後続コールバックはすべて無効化される。

```ts
if (interruptsEnemyTurn) {
  enemyTurnSerialRef.current += 1;
}
```

その後、以下を同時に行う。

| 処理 | 目的 |
| --- | --- |
| `setAuto(false)` | 自動戦闘が割り込み後に勝手に行動しないようにする |
| `setDemonized(true)` | 魔神化状態へ移行する |
| `setDemonActionsRemaining(3)` | 3行動限定を開始する |
| `setSoul(0)` | ソウルゲージを消費する |
| `battleAvRef.current.player = 0` | 行動値をプレイヤー最優先に固定する |
| `setPhase('playerTurn')` | 即座にプレイヤー操作へ戻す |

## UI表示

魔神化ボタンのサブラベルはフェーズによって意味を分ける。

| 条件 | サブラベル |
| --- | --- |
| ソウルゲージ未満 | `SOUL xx%` |
| ソウルゲージ100%、プレイヤーターン | `READY` |
| ソウルゲージ100%、敵ターン | `INTERRUPT` |

これにより、`INTERRUPT` は実際に敵行動へ割り込めるタイミングだけに表示される。

## ログ設計

敵ターン中の発動では以下を表示する。

```text
絶対割り込み: 敵の行動をキャンセルし、行動値を0に固定。状態異常とデバフを完全無効化。
```

プレイヤーターン中の通常発動では以下を表示する。

```text
魔神化: 行動値を0に固定。状態異常とデバフを完全無効化。
```

同じ魔神化でも「敵行動を止めたかどうか」がログから判別できるようにする。

## テスト設計

`src/logic/DemonizationSystem.test.ts` に以下を追加する。

| テスト | 期待値 |
| --- | --- |
| `playerTurn` でゲージ100%、未魔神化 | 発動可能、割り込みなし、次フェーズは `playerTurn` |
| `enemyTurn` でゲージ100%、未魔神化 | 発動可能、割り込みあり、次フェーズは `playerTurn` |
| ゲージ不足 | `GAUGE_NOT_READY` |
| すでに魔神化中 | `ALREADY_ACTIVE` |
| `skillMenu` / `itemMenu` / `animating` / `waveTransition` | `INVALID_PHASE` |

UIのsetTimeoutキャンセルそのものはReactコンポーネント内の副作用だが、発動可否と割り込み判定を純粋関数化することで、敵ターン中のみ `enemyTurnSerialRef` を進める契約をテスト可能にする。
