---
name: tech-debt-l2-nl1
description: BattleEngine WAVE進行を敵全滅トリガーへ変更(L-2)とSynergyBonus死にフィールド削除(NL-1)の対応内容
metadata:
  type: project
---

## L-2: BattleEngine WAVE進行ロジック変更

`updateState()` の「`turn > 10` で WAVE+1」を削除し、`activeEnemyCandidates` が全員 HP=0 のときのみ `state.wave` をインクリメントするように変更。

**Why:** BattleCanvas は敵全滅検知で WAVE 進行する独自ロジックを持っており、将来の接続時に衝突するため。

**How to apply:** WAVE 進行テストは `BattleLog.wave` フィールドで確認する（state を直接参照するパブリックゲッターはない）。

変更箇所: `src/logic/BattleEngine.ts` の `updateState()` メソッド (line ~1048)

## NL-1: SynergyBonus 未使用フィールド削除

`SynergyBonus` から `atkBonus`, `defBonus`, `avBonus` を削除。

**調査結果:** `grep -rn "synergyBonus\.atkBonus\|synergyBonus\.defBonus\|synergyBonus\.avBonus"` の結果が 0 件。定義と代入のみで読み取りなし。`actions.ts` などの `atkBonus` は `SoulShardData.effect.atkBonus` (別型) であり混同しないこと。

**削除した代入箇所:**
- `applyCrossResonance` 内: BEAST+DRAGON の `avBonus: -20` → 削除し `elementDmgBonus+10` のみ残す
- ORC+HUMANOID の `defBonus: 20`, `atkBonus: 8` → ブロックごと削除

**Why:** 未接続フィールドが型に残ると将来の接続時に「設定したはずが効かない」バグの温床になる。

変更箇所: `src/logic/TribeSynergySystem.ts` (SynergyBonus 型定義 + applyCrossResonance)
テスト更新: `src/logic/TribeSynergySystem.test.ts` の BEAST+DRAGON クロス共鳴テスト
