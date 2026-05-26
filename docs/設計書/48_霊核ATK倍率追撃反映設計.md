# 48_霊核ATK倍率追撃反映設計

## 目的

`docs/progress/TECH_DEBT.md` の `NM-4. 霊核（SpiritCore）の atkMultiplier がパーティモンスターの攻撃力に反映されていない` を解消する。

霊核はモンスター固有の強化スロットであり、装着時に追撃性能を変化させる。既存の型定義とDBスキーマには `SpiritCore.atkMultiplier` が存在していたが、軍団追撃のダメージ計算で参照されていなかった。これにより、霊核を装着してもパーティモンスターの攻撃力が変化しない状態になっていた。

## 対象範囲

今回の実装対象は、モンスターがバトル中に行う追撃の攻撃プロファイルである。

| 対象 | 対応 |
| --- | --- |
| `atkMultiplier` | 追撃ATKに乗算する |
| `element` | 霊核が属性を持つ場合、追撃属性として使用する |
| `skillChangeId` | 今回は未接続。将来、モンスター専用スキル実装時に扱う |
| BattleEngine | 純粋戦闘シミュレーションの軍団追撃に接続 |
| BattleCanvas | UIバトルの軍団追撃に同じ計算を接続 |
| GameManager | DBから `spiritCore` relation を読み込み、BattleEngineへ渡す |

## 攻撃プロファイル

霊核の効果は `src/logic/MonsterAttackSystem.ts` に集約する。

```ts
calculateMonsterAttackProfile(monster, { awakened })
```

戻り値は以下。

| フィールド | 内容 |
| --- | --- |
| `stats` | 追撃に使う最終ステータス |
| `element` | 追撃属性。霊核属性がなければ `NONE` |
| `spiritCoreName` | ログ表示用の霊核名 |
| `spiritCoreAtkMultiplier` | 実際に採用したATK倍率 |

## ATK計算式

```text
effectiveMonsterAtk = floor(baseMonsterAtk * spiritCoreAtkMultiplier * awakenedMultiplier)
```

| 要素 | 値 |
| --- | --- |
| `baseMonsterAtk` | `monster.stats.atk` |
| `spiritCoreAtkMultiplier` | `monster.spiritCore.atkMultiplier`。未装備または不正値は `1` |
| `awakenedMultiplier` | アルド覚醒中のみ `1.5`、通常は `1` |

倍率の適用順は乗算のため交換可能だが、丸めは最後に1回だけ行う。これにより `100 * 1.25 * 1.5 = 187.5` は `187` になる。

## 不正値の扱い

DBや移行データで `atkMultiplier` が `0`、負数、非数になった場合は `1` として扱う。

理由:

- 霊核の未装備状態と同等にすることで、壊れたデータが追撃ダメージを0化しない
- バトル中の攻撃力がNaNになり、HP計算・ログ・リザルトを壊す事故を防ぐ

## BattleEngine接続

`BattleEngine.processMonsterActions()` では、従来は `monster.stats` をコピーして覚醒倍率だけを手書きで掛けていた。

変更後は `calculateMonsterAttackProfile()` を呼び出し、以下を `calculateDamage()` に渡す。

| 引数 | 値 |
| --- | --- |
| `attackerStats` | `attackProfile.stats` |
| `element` | `attackProfile.element` |
| `attackerElementBoosts` | 現時点では `{}` |
| `attackType` | ログ上は `STRIKE` |

霊核名がある場合、追撃ログに `霊核「xxx」が共鳴。` を追加する。

## BattleCanvas接続

現在のUIバトルはBattleEngineを直接再生せず、`BattleCanvas.tsx` 内で演出とダメージを進めている。そのため、UI側にも同じ `calculateMonsterAttackProfile()` を接続する。

プレイヤーの通常攻撃または術のダメージ解決後、編成中の最大3体が生存中の敵へ追撃する。

```text
プレイヤー攻撃 / 術
  → 対象へダメージ
  → 状態異常付与
  → パーティモンスター追撃
  → 敵ターン判定
```

追撃対象は次の順で選ぶ。

1. 生存敵を「プレイヤーが攻撃した対象 → その他の生存敵」の順で並べる
2. 追撃回数 `followUpIndex` でローテーションする（例: A/B/C が生存なら 1体目=A、2体目=B、3体目=C）
3. プレイヤーが攻撃した対象が倒れていれば、その対象は候補から外し、残りの生存敵でローテーションする
4. 生存敵がいなければ追撃なし

## DB接続

`GameManager.startStage()` の `prisma.monster.findMany()` で `spiritCore` relation をincludeする。

```ts
include: { spiritCore: true }
```

これにより、サーバー側のBattleEngine開始時にも `spiritCore.atkMultiplier` が欠落しない。

## テスト方針

### Unit: MonsterAttackSystem

| テスト | 期待値 |
| --- | --- |
| 霊核なし | ATK倍率1、属性 `NONE` |
| 霊核あり | `atkMultiplier` をATKへ乗算し、属性を反映 |
| 覚醒あり | 霊核倍率と覚醒倍率が同時に乗る |
| 不正倍率 | `1` にフォールバック |

### Unit: BattleEngine

同じATKのモンスターで、霊核なしと `atkMultiplier: 2` の霊核ありを比較する。

防御0、会心0のターゲットに対して:

```text
霊核なし: 40ダメージ
霊核あり: 80ダメージ
```

追撃ログに霊核名が入ることも確認する。

## 今後の拡張

`skillChangeId` は今回未接続。将来的には `MonsterAttackSystem` にモンスター用スキル解決を追加し、追撃を通常攻撃だけでなく「霊核スキル」に差し替える。
