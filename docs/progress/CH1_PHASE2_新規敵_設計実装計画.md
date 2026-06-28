# Ch1 Phase 2 — 新規敵 設計＆実装計画

策定: 2026-06-28 / ブランチ: `feature/2026062102`
親: [`RELEASE_CH1_設計.md`](./RELEASE_CH1_設計.md) §1-C / [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) 後続 Phase 2
位置づけ: B で既存敵＋`statScale` の placeholder で組んだ戦闘ノードに、**新規敵をデータのみで差し込む**。

---

## 0. スコープ（Ch1 鉄則）

**enemies.json のデータ作業のみ。エンジン改修・新スキル・新プリミティブは作らない。**
- 役割は**データで成立する範囲**＝ステ形状 / シールド / 耐性・弱点プロファイル / 種族 / tier / 既存ギミック再利用のみ。
- ❌ デバッファー/バッファー/ヒーラーの behavioral 役は **Ch2**（[`RELEASE_CH2_PLUS_設計.md`](./RELEASE_CH2_PLUS_設計.md)）。
- ✅ **スキルは既存を再利用**（新敵に新スキルを作らない）→ skills.json 不変。

### 設計ガードレール（`enemyBalance` 由来）
- **tier帯**（既存敵から学習・逸脱でWARN/FAIL）: MINION `hp10-46/atk2-8/def2-5/spd45-108` ・ ELITE `hp30-50/atk4-7/def5-9/spd65-75` ・ BOSS `hp90-150/atk14/def10-13/spd55-96`
- **necromance tier規約（固定値）**: MINION `捕獲0.12 / cost1 / skill1-2` ・ ELITE `0.04 / cost2 / 1-3` ・ BOSS `0.001 / cost4 / 2-4`
- **gimmick は4種のみ**（ENRAGE / AV_DELAY / REVIVE / SUMMON_MINIONS、trigger は HP_BELOW_50 / TURN_3 / ON_SHIELD_BREAK / ON_REVIVE）。**実戦でギミックが動くのは BOSS tier**（BattleCanvas）。
- 新敵の **base stats は tier帯内**に収める。後半ノードの難易度は wave の `statScale`（B済み）が担う。

---

## 1. 新規ロスター（4体）

> ステは「案（enemyBalance＋simulator で最終調整）」。スキルは既存再利用。

### ① `gravewarden_colossus`（墓守の巨像）— ミニボス @ 1-4
- **役割**: タンク壁＋ギミック。魔神化解放ノード（1-4）の記憶に残す山場。
- **tier**: **BOSS（確定 2026-06-28）**（ギミックを実戦で動かすため。捕獲ほぼ不可0.001・cost4 を許容）
- **ステ案**（BOSS下限帯）: hp95 / atk14 / def13 / spd55、shieldHp 30
- **tribe**: UNDEAD / **weakness**: LIGHT / **resist**: EARTH 少
- **gimmick**: `SUMMON_MINIONS`（ON_SHIELD_BREAK で grave_soldier を呼ぶ＝消耗）or `ENRAGE`（HP_BELOW_50）
- **necromance**: BOSS規約（0.001 / cost4 / skill2）→ 再利用 `skill_berserker_earth_breaker` + `skill_necromancer_grave_command`

### ② `wandering_guard_wraith`（彷徨う近衛霊）— 王城ザコ @ 1-7 / 1-9
- **役割**: バランス型ハラサー（既存の grave_soldier より攻撃寄り、leech より遅い＝差別化）
- **tier**: MINION / **ステ案**: hp35 / atk6 / def4 / spd85
- **tribe**: UNDEAD / **weakness**: LIGHT, FIRE
- **necromance**: MINION規約（0.12 / cost1 / skill1）→ `skill_darkknight_shadow_edge`

### ③ `cursed_head_maid`（呪詛の女官長）— エリート術師 @ 1-10
- **役割**: 魔法ナイア（高atk・低def のグラスキャノン術師。WAVE3スパイク）。hollow_handmaid(MINION) の上位 ELITE。
- **tier**: ELITE / **ステ案**: hp44 / atk7 / def5 / spd72、shieldHp 12
- **tribe**: HUMANOID / **weakness**: THUNDER, WIND
- **necromance**: ELITE規約（0.04 / cost2 / skill1-3）→ `skill_warlock_abyss_hex` + `skill_darkpriest_1`
- 補足: `abyss_hex` の呪い(状態異常)フレーバーは Ch1 では非ボスゲートで不発でも、**Ch2 S1（非ボス状態異常開放）で本領発揮**＝自然な伏線。

### ④ `dragonbone_spawn`（竜骨の眷属）— 祭壇ザコ @ 1-9 / 1-11
- **役割**: 竜骨祭壇ゾーンのメレー。**DRAGON種族＝ch1唯一の捕獲DRAGON**（編成シナジー／コレクション価値）。
- **tier**: MINION / **ステ案**: hp32 / atk6 / def5 / spd68
- **tribe**: **DRAGON** / **weakness**: ICE / **resist**: FIRE 少（竜骨）
- **necromance**: MINION規約（0.12 / cost1 / skill1）→ `skill_berserker_earth_breaker`

---

## 2. placeholder 差し替えマッピング（B ノードの実構成へ）

| ノード | wave | 現placeholder | → 差し替え後 |
|---|---|---|---|
| `area1_a_mini`(1-4) | W3[ELITE] | bone_colossus, grave_knight | **gravewarden_colossus**（＋add 1体）。ミニボス化 |
| `area1_b3`(1-7) | W3[ELITE] | grave_knight, bone_colossus | grave_knight → **wandering_guard_wraith** に1枠差し替え |
| `area1_c1`(1-9) | W1/W3 | earthbound_grudge / bloodmire_leech 等 | **wandering_guard_wraith** + **dragonbone_spawn** を祭壇導入として配置 |
| `area1_c2`(1-10) | W3[ELITE] | hollow_handmaid, abyss_warden, bone_colossus | hollow_handmaid → **cursed_head_maid** に差し替え（上位術師） |
| `area1_c3`(1-11) | W1/W2 | bloodmire_leech 等 | **dragonbone_spawn** を前wに配置（W3の blood_mire_queen は維持） |

> 各 wave の `statScale`（B済み）はそのまま。新敵の base はtier帯内なので、後半の手応えは既存scaleが担う。差し替え後は **`validateStageDraft`（enemyId参照）を再通過**させる。

---

## 3. 制作パイプライン（管理画面）

1. **草稿**: `/admin/enemies/new`（手動）または `enemyAgent`（Gemini草稿）で4体を起こす。
2. **ゲート**: `enemyBalance` で tier帯・necromance規約・参照整合・gimmick列挙を通す（FAIL=0）。
3. **差し込み**: §2 のマッピングで該当 wave の `enemyIds` を差し替え（`/admin/stages` or stages.json）。
4. **再検証**: `validateStageDraft`（敵参照）→ `/admin/audit` FAIL=0。
5. **バランス**: `balance-designer` / simulator で各ノードの難易度カーブ（docs/46）を確認。ミニボス1-4の手応えを重点確認。

---

## 4. 関所 / 完了条件
- 4体が `enemyBalance` PASS（tier帯内・necromance規約一致・既存スキル参照OK）
- 差し替え後の全ステージ `validateStageDraft` PASS、`/admin/audit` **FAIL=0**（G1/G2含む）
- simulator で 1-4 / 1-10 / 1-11 等の手応えが想定内
- `npx tsc --noEmit` / jest 非破壊（**テストが master を mutate しない** ＝ CI `git diff --exit-code src/data/master`）
- 実機で新敵が出る各ノードを通しプレイ

---

## 5. 決定事項（解決済み）
**① gravewarden_colossus の tier → (a) BOSS tier ＋ ギミック で確定（2026-06-28）。**
実戦でギミック（SUMMON_MINIONS / ENRAGE）が動く記憶に残るミニボス。代償（捕獲ほぼ不可0.001・cost4）は許容。
→ ステ案: hp95 / atk14 / def13 / spd55 / shieldHp30、necromance は BOSS規約（skill 2）。

**全4体の仕様が確定。着手可能。**
