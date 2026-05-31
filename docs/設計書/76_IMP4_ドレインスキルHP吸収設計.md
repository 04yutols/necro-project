# 76 — IMP-4 ドレインスキルHP吸収設計

> 対象: `src/data/master/skills.json` / `src/types/game.ts` / `src/logic/BattleEngine.ts` / `src/components/battle/BattleCanvas.tsx`  
> 対応日: 2026-05-30  
> 関連: `docs/progress/IMPROVEMENTS.md` の `IMP-4`

---

## 1. 背景

暗黒司祭の初期スキル `skill_darkpriest_1`（ドレイン）は、説明文で「敵単体に魔法ダメージを与え、自身のHPを回復」と定義されている。

しかし旧実装では `SkillData` に自己回復率を表すフィールドがなく、`BattleEngine.processPlayerAction()` もダメージ後のHP吸収を処理していなかった。そのため、ドレインは実際には闇属性の単体魔法攻撃としてしか機能していなかった。

---

## 2. 問題

| 観点 | 問題 |
|---|---|
| マスターデータ | ドレイン固有の回復率がデータ化されていない |
| BattleEngine | ダメージ後にプレイヤーHPを回復する処理がない |
| BattleCanvas | UIバトルで回復floatとHP更新が出ない |
| テスト | 「攻撃 + 自己回復」の回帰テストがない |

暗黒司祭は継戦能力が個性の職業なので、ドレインが攻撃だけになると職業差が薄くなる。

---

## 3. 採用仕様

### 3.1 データ仕様

`SkillData` に任意フィールド `healSelfPct?: number` を追加する。

```typescript
interface SkillData {
  healSelfPct?: number;
}
```

ドレインには `healSelfPct: 30` を設定し、説明文も「与えたダメージの30%」に揃える。

### 3.2 回復原資

回復量は「最終ダメージ値」ではなく、敵のランタイムHPを実際に削った量から算出する。

```typescript
const actualHpDamage = hpChange.prevHp - hpChange.nextHp;
const healAmount = Math.floor(actualHpDamage * skillData.healSelfPct / 100);
```

この仕様により、以下の過剰回復を避ける。

- 残りHPが少ない敵へのオーバーキル分
- 霊的防壁で軽減・遮断された分
- HP0後のREVIVE演出で復活する前の余剰ダメージ分

### 3.3 HP上限

回復先は `CharacterData.stats.hp` とし、上限は BattleEngine constructor で保持している `playerInitialMaxHp` にする。

```typescript
playerStats.hp = Math.min(this.playerInitialMaxHp, playerStats.hp + healAmount);
```

### 3.4 ログ仕様

回復が1以上発生した場合、攻撃ログとは別に `HEAL` ログを出す。

```text
ドレイン：HP +{healAmount} 回復。
```

`BattleLog.damage` には既存互換のため回復量を入れる。ログ時点の `playerHP` には回復後HPが入る。

---

## 4. 実装詳細

### 4.1 BattleEngine

`processPlayerAction()` の対象ごとのダメージ処理内で、`applyDamageToEnemy()` の戻り値から実HPダメージを計算する。

処理順:

1. ダメージ計算
2. 霊的防壁適用
3. 敵HPランタイム更新
4. 攻撃ログ生成
5. ドレイン自己回復ログ生成
6. 状態異常付与
7. 武器パッシブ評価

AoEスキルに `healSelfPct` が付く将来拡張では、対象ごとに実HPダメージを計算し、対象ごとに回復する。現時点で対象はドレイン単体のみ。

### 4.2 BattleCanvas

`BattleSkill` に `healSelfPct?: number` を追加し、`toBattleSkill()` で `SkillData.healSelfPct` を引き継ぐ。

`handleSkill()` のダメージ確定後に、対象ごとの `totalDamage` を回復原資としてHPを更新し、緑の回復floatを表示する。

BattleCanvas は敵HP更新を `damageEnemy()` 内で行っており、戻り値が実際に適用されたダメージなので、この値をそのまま回復原資にできる。

---

## 5. テスト設計

`BattleEngine.test.ts` に以下を追加する。

| ケース | 期待 |
|---|---|
| ドレインで実HPダメージが発生 | `HEAL` ログが出て、プレイヤーHPが実HPダメージの30%回復する |
| プレイヤーHPが上限付近 | 回復後HPが `playerInitialMaxHp` を超えない |
| 敵残HPが少ない | オーバーキル分ではなく、実際に削ったHPだけを回復原資にする |

乱数による会心ブレを避けるため、テストでは `critRate: 0` のプレイヤーを使う。

---

## 6. 非対応範囲

- 回復専用スキル `type: "HEAL"` の実装。
- 味方対象回復、全体回復、持続回復。
- 吸収率を装備やパッシブで増幅する仕組み。

---

## 7. 完了条件

- `skill_darkpriest_1` に `healSelfPct: 30` が設定されている。
- BattleEngine でドレイン使用時に自己HPが回復する。
- BattleCanvas でドレイン使用時にHP更新と回復floatが出る。
- `BattleEngine.test.ts` に回帰テストがある。
- `npm test -- --runInBand src/logic/BattleEngine.test.ts` / `npx tsc --noEmit` が通る。
