# 70 — IMP-2 BattleEngine SUMMON_MINIONS実体化設計

> 対象: `src/logic/BattleEngine.ts` / `src/logic/BossGimmickSystem.ts` / `src/types/game.ts`  
> 対応日: 2026-05-30  
> 関連: `docs/progress/IMPROVEMENTS.md` の `IMP-2`

---

## 1. 背景

`blood_mire_queen` は `ON_SHIELD_BREAK -> SUMMON_MINIONS` を持つ。BattleCanvas では `resolveSummonMinionIds()` を使って実際に画面上の敵配列へ増援を追加しているが、BattleEngine では `BOSS_SUMMON` ログを出すだけだった。

BattleEngine はサーバー計算・自動戦闘・回帰テストの正本なので、ここで敵が増えないと UI とロジックが分岐する。

---

## 2. 問題

旧実装:

```typescript
case 'SUMMON_MINIONS':
  this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
    `【召喚】${boss.name}が手下を呼んだ！`);
  break;
```

問題点:

| 観点 | 問題 |
|---|---|
| 戦闘状態 | 増援の `MonsterData` が作られない |
| HP管理 | `enemyCurrentHp` / `enemyMaxHp` に増援が登録されない |
| 後続ターン | 次ターンの AoE / 軍団追撃対象に増援が入らない |
| UI連携 | 呼び出し元が「何が召喚されたか」を読めない |

---

## 3. 採用仕様

### 3.1 BattleState に追加

```typescript
pendingSummons: string[];
summonedEnemies: MonsterData[];
```

| フィールド | 用途 |
|---|---|
| `pendingSummons` | 今回召喚されたランタイム敵ID。UI / 同期層が差分として読める |
| `summonedEnemies` | BattleEngine 内で実体化された増援敵 |

### 3.2 召喚数と空き枠

BattleCanvas と同じく、戦場の同時生存敵は最大3体とする。召喚時点の生存敵数から空き枠を計算する。

```typescript
availableSlots = max(0, 3 - aliveEnemyCount)
resolveSummonMinionIds(boss.id, gimmick.value, availableSlots)
```

### 3.3 増援の実体化

`MasterDataService.getEnemy(enemyId)` で enemy master を取得し、BattleEngine 用の `MonsterData` に変換する。

ランタイムIDは以下の形式にする。

```text
{boss.id}:summon:{sourceEnemyId}:{sequence}
```

これにより同じ enemy master から複数体を出しても HP 管理キーが衝突しない。

### 3.4 後続ターンへの接続

`resolveEnemyCandidates()` は、呼び出し元から渡された敵候補に `summonedEnemies` をマージする。これにより次回以降の `simulateAction()` では、呼び出し元が明示的に増援を渡さなくても AoE / 軍団追撃の対象候補に入る。

---

## 4. 実装詳細

追加メソッド:

- `applySummonMinions(boss, gimmick)`
- `createSummonedEnemy(sourceId, boss)`
- `enemyDataToMonster(enemy, runtimeId)`
- `getPendingSummons()`
- `consumePendingSummons()`
- `getSummonedEnemies()`

処理順:

1. `ON_SHIELD_BREAK` で `SUMMON_MINIONS` が発火する。
2. `resolveSummonMinionIds()` で召喚元 enemyId を決める。
3. enemy master を `MonsterData` に変換する。
4. `summonedEnemies` / `pendingSummons` / `enemyCurrentHp` / `enemyMaxHp` へ登録する。
5. `BOSS_SUMMON` ログに召喚された敵名を出す。
6. 次回以降の `resolveEnemyCandidates()` が増援を候補へ混ぜる。

---

## 5. テスト設計

`BattleEngine.test.ts`:

| ケース | 期待 |
|---|---|
| 防壁破壊で `SUMMON_MINIONS` | `getSummonedEnemies()` に2体入る |
| 血沼の女王の召喚プール | `血沼の蛭` / `腐敗猟犬` が実体化する |
| pending summons | ランタイムIDを取得でき、`consumePendingSummons()` で消費できる |
| 後続ターンAoE | 呼び出し元が増援を渡さなくても、ボス + 増援2体へ命中する |
| 軍団追撃 | 増援が後続ターンの追撃候補へ入る |

---

## 6. 非対応範囲

- BattleCanvas の召喚演出変更。
- 敵フェーズで全敵が個別行動する BattleEngine 拡張。
- 4体以上同時出現する大型戦場。

---

## 7. 完了条件

- BattleEngine の `SUMMON_MINIONS` がログだけでなく敵実体を増やす。
- 増援HPがランタイムHP管理に登録される。
- 後続ターンの AoE / 軍団追撃候補に増援が入る。
- `npm test -- --runInBand src/logic/BattleEngine.test.ts src/logic/BossGimmickSystem.test.ts` / `npx tsc --noEmit` / 全体Jest / build が通る。
