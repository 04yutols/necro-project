# 69 — IMP-1 BattleEngine AoEスキル対象解決設計

> 対象: `src/logic/BattleEngine.ts` / `src/logic/BattleEngine.test.ts`  
> 対応日: 2026-05-30  
> 関連: `docs/progress/IMPROVEMENTS.md` の `IMP-1`

---

## 1. 背景

`skills.json` では `targetType: "ALL_ENEMIES"` の範囲スキルが定義されている。BattleCanvas 側は UI / VFX のために `skill.aoe` を見て全敵を対象にしていたが、BattleEngine 側は `simulateAction(actionType, target, skillId, enemyCandidates)` の `enemyCandidates` をプレイヤー攻撃には使っていなかった。

そのため、BattleEngine を正とする自動戦闘・テスト・将来のサーバー計算では、鎌鼬やロックブレイクなどの AoE スキルが単体攻撃として処理されていた。

---

## 2. 問題

旧実装の `processPlayerAction()` は、スキルの `targetType` を確認せず、常に `target` 1体だけへ以下を適用していた。

- ダメージ計算
- 霊的防壁
- ボスギミック判定
- 状態異常付与
- 武器パッシブ
- BattleLog 生成

一方で、SP消費・魔神化行動消費・SELF_DAMAGE などの「行動そのものに対する処理」は、AoEでも1回だけであるべき。

---

## 3. 対象仕様

### 3.1 対象解決

`SkillData.targetType === "ALL_ENEMIES"` の場合、`simulateAction()` に渡された `enemyCandidates` から生存敵を抽出する。

```typescript
const uniqueTargets = resolveEnemyCandidates(primaryTarget, enemyCandidates);
const aliveTargets = uniqueTargets.filter(enemy => getEnemyRuntimeHp(enemy) > 0);
```

`enemyCandidates` がない旧呼び出しでは、`primaryTarget` のみを対象にする。これにより既存の単体テスト・旧呼び出しとの互換性を維持する。

### 3.2 行動単位で1回だけ行う処理

- SP消費
- 通常攻撃 / スキルのSP回復
- 魔神化ゲージの基本増加
- ENERGY_DRAIN によるコスト増加
- SELF_DAMAGE の反動
- 魔神化行動回数の消費

### 3.3 対象ごとに行う処理

- ダメージ計算
- 会心・弱点・耐性判定
- 霊的防壁処理
- 霊魂砕き報酬
- 敵HPランタイム更新
- ボスギミック判定
- 状態異常付与
- 武器パッシブ評価
- BattleLog 生成

---

## 4. 実装方針

`processPlayerAction()` に `enemyCandidates` を渡し、内部で `resolvePlayerActionTargets()` を使って対象リストを決定する。

```typescript
private resolvePlayerActionTargets(
  primaryTarget: MonsterData,
  skillData: SkillData | undefined,
  enemyCandidates: MonsterData[],
): MonsterData[] {
  if (skillData?.targetType !== 'ALL_ENEMIES') return [primaryTarget];

  const uniqueTargets = this.resolveEnemyCandidates(primaryTarget, enemyCandidates);
  const aliveTargets = uniqueTargets.filter(enemy => this.getEnemyRuntimeHp(enemy) > 0);
  return aliveTargets.length > 0 ? aliveTargets : [primaryTarget];
}
```

その上で、ダメージ・防壁・ログ・状態異常・パッシブを対象ごとにループする。SP消費や魔神化行動消費はループ外に置く。

---

## 5. テスト設計

`BattleEngine.test.ts` に以下を追加する。

| ケース | 期待 |
|---|---|
| `ALL_ENEMIES` スキル + 敵3体候補 | 3体すべてへ `MAGIC_SKILL` ログが出る |
| AoEスキルのSP | 敵数に関係なくコストと回復は1回だけ |
| 単体スキル + 敵3体候補 | 選択対象1体だけへログとHP変化が発生 |

---

## 6. 完了条件

- `targetType: "ALL_ENEMIES"` が BattleEngine でも全生存敵へ適用される。
- 単体スキルは `enemyCandidates` が渡されても単体のまま。
- SP消費・魔神化消費などの行動単位処理が敵数分だけ重複しない。
- `npm test -- --runInBand src/logic/BattleEngine.test.ts` / `npx tsc --noEmit` / 全体Jest / build が通る。
