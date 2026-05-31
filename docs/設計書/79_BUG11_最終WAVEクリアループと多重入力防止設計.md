# 79 — BUG-11 最終WAVEクリアループと多重入力防止設計

> 対象: `src/components/battle/BattleCanvas.tsx` / `src/logic/BattleFlowSystem.ts`
> 対応日: 2026-05-31
> 関連: `docs/progress/IMPROVEMENTS.md` の `BUG-11`

---

## 1. 背景

BattleCanvasは3 WAVEの敵全滅を検知し、`resolveWaveClear()` で次WAVEまたはリザルト画面へ進む。プレイヤーコマンドは `phase` stateで入力可否を切り替える。

```typescript
if (phase !== 'playerTurn') return;
setPhase('animating');
```

この方式は通常操作では成立するが、報酬適用によるプレイヤー状態更新と、React state反映前の短時間連打に弱い。

---

## 2. 再現事象

### 2.1 最終WAVEクリアループ

1. `area1_node1` のWAVE 3を全滅させる。
2. `resolveWaveClear()` が報酬処理を実行する。
3. `addExp()` が現在職業の経験値とレベルを更新する。
4. バトル初期化effectが `currentJobLevel` の変更を検知する。
5. 同じBattleCanvasがWAVE 1へ初期化され、リザルトへ安定して遷移しない。

### 2.2 攻撃ボタン連打

1. `playerTurn` 中に攻撃ボタンを短時間で複数回押す。
2. 最初の `handleAttack()` が `setPhase('animating')` を呼ぶ。
3. Reactが再描画する前は、後続イベントも古い `phase === 'playerTurn'` を参照する。
4. 複数の攻撃タイマーが予約され、敵ターン中でも連続攻撃が発生する。

---

## 3. 原因

### 3.1 バトル初期化の責務が広すぎる

初期化effectは開始時の職業、最大HP、Energy、WAVEを設定するために複数の依存値を持つ。しかし、これらの一部はバトル中や報酬適用時にも変化する。

BattleCanvasのマウント中に同じステージを再初期化してよいのは、ステージキーが変化した場合だけである。

### 3.2 React stateだけでは同期ロックにならない

`setPhase()` は再描画を要求するが、現在実行中のイベント列から見える `phase` を即時変更しない。入力制御には同期的に更新されるrefが必要である。

---

## 4. 採用仕様

### 4.1 BattleFlowSystem

判定規則を純粋関数へ集約する。

```typescript
export function shouldInitializeBattle(
  initializedBattleKey: string | null,
  nextBattleKey: string,
): boolean;

export function canStartPlayerAction(input: {
  phase: BattlePhase;
  requiredPhase: BattlePhase;
  actionLocked: boolean;
  waveResolving: boolean;
}): boolean;
```

`shouldInitializeBattle()` はキーが異なる場合だけ `true` を返す。
`canStartPlayerAction()` はphase一致、ロック未取得、WAVE解決中ではない場合だけ `true` を返す。

### 4.2 初期化キー

BattleCanvasに `initializedBattleKeyRef` を追加する。

```typescript
const initializedBattleKeyRef = useRef<string | null>(null);
const battleKey = stageId ?? '__fallback__';
```

effect自体は依存値の変化で再実行されてもよいが、同一キーでは初期化処理を行わない。これにより報酬適用後のレベル更新でWAVEが巻き戻らない。

### 4.3 phase同期参照

React stateに加えて `phaseRef` を保持し、遷移を `setBattlePhase()` に集約する。

```typescript
const phaseRef = useRef<BattlePhase>('playerTurn');

function setBattlePhase(nextPhase: BattlePhase) {
  phaseRef.current = nextPhase;
  setPhaseState(nextPhase);
}
```

イベントハンドラの入力判定は `phaseRef.current` を使う。表示は従来通りstateを使う。

### 4.4 プレイヤー行動ロック

`playerActionLockRef` を追加する。

```typescript
const playerActionLockRef = useRef(false);
```

消費アクション開始時に `tryLockPlayerAction()` で同期的にロックする。後続クリックはReact再描画前でも拒否される。

対象:

| アクション | 必須phase |
|---|---|
| 通常攻撃 | `playerTurn` |
| スキル | `skillMenu` |
| 道具 | `itemMenu` |
| 魔神技 | `playerTurn` |

魔神化は敵行動への割り込み仕様を持つため、通常の消費アクションロック対象にはしない。発動時は新しい自ターンを開始するためロックを解除する。

### 4.5 ロック解除点

| 契機 | 理由 |
|---|---|
| バトル初期化 | 最初の自ターンを開始する |
| 新WAVE開始 | 次WAVEの最初の自ターンを開始する |
| 敵行動完了 | 通常の次自ターンを開始する |
| 魔神化発動 | 割り込み後の自ターンを開始する |
| MP不足、道具消費失敗 | 行動が成立していない |

WAVE解決開始と敗北時はロック状態を維持し、遷移中の追加入力を拒否する。

---

## 5. 実装詳細

### 5.1 BattleCanvas初期化

既存effectの先頭で初期化キーを判定する。

```typescript
const battleKey = stageId ?? '__fallback__';
if (!shouldInitializeBattle(initializedBattleKeyRef.current, battleKey)) return;
initializedBattleKeyRef.current = battleKey;
```

依存配列は維持する。最新値を閉包へ取り込みつつ、同一ステージの再初期化だけを止める。

### 5.2 コマンド処理

各消費アクションは副作用より前にロックを取得する。

```typescript
if (!tryLockPlayerAction('playerTurn')) return;
```

術と道具はメニュー選択時のphaseをそのまま使う。選択直前に `playerTurn` へ戻す既存処理は削除する。

---

## 6. テスト設計

### 6.1 BattleFlowSystem unit test

| ケース | 期待 |
|---|---|
| 未初期化キー | 初期化する |
| 同一ステージキー | 再初期化しない |
| 別ステージキー | 初期化する |
| 正しいphase、未ロック | 行動開始できる |
| ロック取得済み | 行動開始できない |
| WAVE解決中 | 行動開始できない |
| phase不一致 | 行動開始できない |

### 6.2 Playwright E2E

| ケース | 期待 |
|---|---|
| 攻撃ボタンへ同期的に複数clickを送る | 攻撃開始ログは1件だけ |
| AUTO x3でnode1-1を最後まで進める | `result-summary` が表示され続ける |

---

## 7. 非対応範囲

- バトルアニメーション時間の再調整。
- 報酬内容、経験値量、敵HPの変更。
- AUTO戦闘AIの行動選択改善。
- BattleEngine側の10ターンWAVE進行仕様統合。

---

## 8. 完了条件

- node1-1のWAVE 3全滅後にリザルト画面へ遷移する。
- 報酬適用後にWAVE 1へ戻らない。
- 攻撃ボタン連打で複数攻撃が予約されない。
- スキル、道具、魔神技も同じ同期ロックを使う。
- unit test、関連E2E、`npx tsc --noEmit`、全体Jest、build、差分検査が通る。
