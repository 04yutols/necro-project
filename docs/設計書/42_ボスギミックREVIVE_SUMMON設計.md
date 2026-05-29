# 42_ボスギミックREVIVE_SUMMON設計

## 目的

第1章ボスに定義されている `REVIVE` と `SUMMON_MINIONS` を、BattleEngine と BattleCanvas の両方で一貫して動作させる。  
特に BattleCanvas では、ボス撃破時に即クリアしてしまう問題を防ぎ、復活・増援を画面上の敵状態へ反映する。

## 対象ギミック

| effect | trigger | 代表ボス | 動作 |
|---|---|---|---|
| `REVIVE` | `HP_BELOW_50` 互換定義 | 死骨竜王オッサリウス | HP0時に1回だけ第2形態へ移行 |
| `SUMMON_MINIONS` | `ON_SHIELD_BREAK` | 血沼の女王クリムゾン | 霊的防壁破壊時に雑魚を最大2体召喚 |

`REVIVE` の trigger は既存マスターデータとの互換のため `HP_BELOW_50` を許容するが、実発火条件は HP0 のみとする。HP50%を跨いだだけでは発火しない。

## 共通ロジック

`src/logic/BossGimmickSystem.ts` を正本にする。

- `bossGimmickKey(bossId, gimmick)`
  - `bossId:trigger:effect` の発火済みキーを作る。
- `shouldTriggerBossGimmick(gimmick, context)`
  - `ENRAGE` / `SUMMON_MINIONS` など通常トリガーの判定。
  - `REVIVE` はここでは発火させない。
- `findReviveGimmick(gimmicks, bossId, firedSet)`
  - HP0後に未発火の `REVIVE` を探す。
- `getReviveHp(maxHp, gimmick)`
  - `0 < value < 1` の場合は割合として扱う。
  - 既存 `value: 1` は「1回復活」の旧表現として扱い、HP50%復活にフォールバックする。
- `resolveSummonMinionIds(bossSourceId, count, availableSlots)`
  - ボスごとの増援候補から、空き枠に収まる数だけ enemyId を返す。

## REVIVE 詳細仕様

発火条件:

1. ダメージ適用後にボスHPが `0` 以下。
2. ボスの `gimmicks` に `effect: "REVIVE"` がある。
3. `bossGimmickKey()` が未発火。

発火時:

- 発火済みキーを登録する。
- HPを最大HPの50%へ戻す。
- `shieldHp` を `maxShieldHp` へ戻す。
- `shieldBroken` を解除する。
- BattleCanvas では WAVE CLEAR 判定前に復活を適用する。
- ログに `【REVIVE】...第2形態...` を表示し、赤系フラッシュを出す。

## SUMMON_MINIONS 詳細仕様

発火条件:

1. 霊的防壁が今回の攻撃で破壊された。
2. ボスの `gimmicks` に `trigger: "ON_SHIELD_BREAK"` かつ `effect: "SUMMON_MINIONS"` がある。
3. `bossGimmickKey()` が未発火。

発火時:

- 発火済みキーを登録する。
- BattleEngine は `BOSS_SUMMON` ログを出し、`summonedEnemies` として増援を実体化する。
- BattleCanvas は実際に敵リストへ増援を追加する。
- 画面上の敵は最大3体までとし、既に枠が埋まっている場合はログのみ表示する。
- BattleCanvas で召喚された敵は `TurnOrderSystem` の初期AVを持ち、SPDに応じて次の敵フェーズから行動できる。
- BattleEngine で召喚された敵は、次回以降の `simulateAction()` で AoE / 軍団追撃対象候補に入る。

## 増援プール

| bossSourceId | summon pool |
|---|---|
| `blood_mire_queen` | `bloodmire_leech`, `rot_hound` |
| `ossuary_wyrm_lord` | `grave_soldier`, `earthbound_grudge` |
| default | `grave_soldier`, `rot_hound`, `hollow_handmaid` |

## BattleCanvas 更新仕様

`damageEnemy()` の HP 更新直後、WAVE CLEAR 判定より前に `resolveBossGimmicksAfterDamage()` を呼ぶ。

処理順:

1. シールド破壊判定。
2. ダメージを反映した enemy 配列を作成。
3. `SUMMON_MINIONS` を判定し、必要なら増援を追加。
4. HP0なら `REVIVE` を判定し、必要なら復活。
5. 最終的な enemy 配列が全滅している時だけ WAVE CLEAR。

この順にすることで、ボスが復活する場合や増援が残る場合に誤ってリザルトへ進まない。

## テスト方針

- `REVIVE` は HP50%跨ぎでは発火しない。
- `REVIVE` は HP0で発火し、HP50%へ復活する。
- legacy `value: 1` でも HP50%復活として扱う。
- `SUMMON_MINIONS` はシールド破壊時に発火する。
- ボスごとの増援プールと空き枠制限を検証する。
- BattleEngine のログでも `BOSS_REVIVE` / `BOSS_SUMMON` が確認でき、`getSummonedEnemies()` で実体化した増援を確認できる。
