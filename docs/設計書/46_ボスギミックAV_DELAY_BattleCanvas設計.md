# 46. ボスギミック AV_DELAY BattleCanvas 接続設計

## 目的

`BossGimmick.effect: "AV_DELAY"` を、実際に画面で動作する `BattleCanvas` の AV ターン順へ接続する。

これにより、`TURN_3` などで定義されたボスの「タイムライン強制遅延」が、ログ上の演出だけでなくプレイヤーの次手番を実際に後ろへ押し下げる。

## 現状の問題

- `BossGimmick` 型には `AV_DELAY` が存在する。
- `enemies.json` の死骨竜王オッサリウスにも `TURN_3 / AV_DELAY` が設定されている。
- `BattleCanvas` の `runEnemyTurn()` は `ENRAGE` しか参照していなかった。
- そのため、3ターン目の AV 遅延ギミックが発火せず、ボス固有のタイムライン圧が存在しなかった。

## 数値仕様

`AV_DELAY.value` は「遅延ターン数」ではなく「基礎 AV 加算量」として扱う。

```text
baseAVDelay = gimmick.value ?? 40
actualDelay = floor(baseAVDelay * (1 - player.effectRes / 100))
player.currentAv += actualDelay
```

`effectRes` は 0〜100% の軽減として扱う。

| effectRes | value=40 の実遅延 | 体感 |
|---:|---:|---|
| 0 | 40 | 大きく後ろへ押される |
| 5 | 38 | 初期値ではほぼ直撃 |
| 50 | 20 | 耐性ビルドで半減 |
| 100 | 0 | 完全抵抗 |

## 適用タイミング

`BattleCanvas.runEnemyTurn()` の敵行動スケジュール作成前に処理する。

```text
プレイヤー行動終了
  -> player.currentAv += actionDelay
  -> runEnemyTurn()
      -> 敵状態異常フェーズ
      -> AV_DELAY ギミック判定
      -> player.currentAv += actualDelay
      -> scheduleEnemiesUntilPlayer()
      -> 敵行動 / プレイヤー手番復帰
```

スケジュール前に加算することで、遅延後の AV に応じて追加の敵行動が自然に割り込む。

## 発火条件

既存の `shouldTriggerBossGimmick()` を使う。

- `trigger: "TURN_3"` の場合、`actionCountRef.current === 3` で発火。
- `bossGimmickFiredRef` に `bossId:trigger:effect` を保存し、同じボス・同じギミックは1回だけ発火。
- ボスが倒れている場合は `runEnemyTurn()` の alive 対象に入らないため発火しない。

## BattleCanvas 表示

- 発火時にログへ `【AV遅延】... 行動値 +n` を表示。
- 画面を紫系でフラッシュし、短い揺れを入れる。
- `actualDelay === 0` の場合は「効果抵抗で完全に弾いた」ログを表示する。

## データ修正

`ossuary_wyrm_lord` の AV_DELAY は、旧実装メモ由来で `value: 1` になっていた。  
設計書 17 の数値仕様に合わせて `value: 40` へ修正する。

```json
{ "trigger": "TURN_3", "effect": "AV_DELAY", "value": 40 }
```

## 実装ファイル

- `src/logic/BossGimmickSystem.ts`
  - `DEFAULT_BOSS_AV_DELAY`
  - `getBossAvDelayBase()`
  - `calculateBossAvDelay()`
- `src/components/battle/BattleCanvas.tsx`
  - `runEnemyTurn()` 内で AV_DELAY を敵行動スケジュール前に適用。
- `src/data/master/enemies.json`
  - `ossuary_wyrm_lord` の `AV_DELAY.value` を `40` に修正。

## テスト方針

- `TURN_3` でのみ `AV_DELAY` が発火すること。
- `effectRes` により実遅延が軽減されること。
- `value` 未指定時は `40` を既定値にすること。
- 既存の AV スケジューリングテストで、遅延加算後に敵行動が先行することを確認する。
