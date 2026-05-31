# 50_BUG1_BattleEngine敗北判定設計

## 目的

`docs/progress/BUGS_AND_SECURITY.md` の `BUG-1: プレイヤーが絶対に死なない` を解消する。

既に `BattleCanvas` 側には敗北画面へ遷移する処理があるが、純粋ロジックである `BattleEngine` には HP を 1 で止める処理が残っていた。これにより、将来 `BattleCanvas` を `BattleEngine` の結果で完全駆動した場合、ゲームオーバーが発生しない。

## 対象範囲

対象は `src/logic/BattleEngine.ts` のプレイヤーHP変動のみ。

| 発生源 | 旧挙動 | 新挙動 |
|---|---|---|
| モンスター全滅後の敵直接攻撃 | `Math.max(1, hp - damage)` | `applyPlayerDamage()` で 0 まで減る |
| 魔神化 SELF_DAMAGE | `Math.max(1, hp - damage)` | `applyPlayerDamage()` で 0 まで減る |
| プレイヤー状態異常ダメージ | `Math.max(1, hp - damage)` | `applyPlayerDamage()` で 0 まで減る |
| エリアスリップダメージ | 0 まで減るが敗北ログなし | 0 到達時に敗北ログ |

## 責務分担

| 責務 | 場所 |
|---|---|
| HP 減算の下限処理 | `src/logic/PlayerDefeat.ts` `applyPlayerDamage()` |
| 死亡判定 | `src/logic/PlayerDefeat.ts` `isPlayerDead()` |
| 戦闘ログへの敗北通知 | `BattleEngine.recordPlayerDefeat()` |
| UI の敗北演出 | `BattleCanvas.triggerPlayerDefeat()` / `ResultScreen` |

`BattleEngine` は UI 遷移を直接呼ばない。代わりに `BattleLog.action = "PLAYER_DEFEATED"` を返し、上位レイヤーがそのログまたは `playerHP === 0` を見て敗北演出へ進める。

## 状態モデル

`BattleEngine` 内に `playerDefeatLogged` を持つ。

```text
player HP > 0
  -> ダメージ適用
  -> HP 0
  -> PLAYER_DEFEATED を1回だけログ出力
  -> その simulateAction 内の後続フェーズを停止
```

同一ターンで状態異常、反動、敵攻撃が連続しても敗北ログは1回だけ出す。

## 実装方針

### 1. 共通ヘルパー

```typescript
private applyDamageToPlayer(damage: number): number
private isPlayerDefeated(): boolean
private recordPlayerDefeat(actorName: string, description: string): void
```

`applyDamageToPlayer()` は必ず `PlayerDefeat.applyPlayerDamage()` を呼び、HPを負値にしない。

### 2. フェーズ停止

`simulateAction()` は以下の各地点で `isPlayerDefeated()` を確認する。

1. 開始直後
2. エリアギミック後
3. 状態異常処理後
4. プレイヤー行動後
5. 敵反撃後

HP 0 の場合は `updateState()` を呼ばず、そのターンを敗北で終了する。

### 3. ログ契約

敗北ログは以下の形にする。

```typescript
{
  action: 'PLAYER_DEFEATED',
  actorName: source,
  targetName: player.name,
  playerHP: 0,
  description: '...倒れた。'
}
```

直前のダメージログも `playerHP: 0` を持つため、UI はダメージ表示と敗北演出の両方を組み立てられる。

## テスト方針

`src/logic/BattleEngine.test.ts` に以下を追加する。

| ケース | 期待 |
|---|---|
| 味方モンスターなしで敵の直接攻撃が致死 | `player.stats.hp === 0`、`PLAYER_DEFEATED` ログあり |
| 出血ティックが致死 | プレイヤー行動ログなし、`PLAYER_DEFEATED` ログあり |

既存の `src/logic/PlayerDefeat.test.ts` は HP 減算と死亡判定の単体保証として継続利用する。

## 今回の非対象

`BUG-2: ステータス異常ダメージが現在HPをmaxHpとして計算する` は別項目として残す。今回の修正では「致死時に0へ到達し、敗北ログが出る」ことに限定する。
