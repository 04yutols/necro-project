# 積み残し網羅チェックリスト

> 作成日: 2026-05-24
> セッション横断の全積み残しを一元化。実装完了したら `DONE.md` へ移動し、ここからチェックを入れる。

---

## 🔴 Critical — これが残るとゲームが起動しない / バトルが崩壊する

### R-1. `monsters.json` に第1章エネミーが10体未登録

**状況:**
`stages.json` が参照しているモンスター ID がすべて `monsters.json` に存在しない。
バトル開始時にエネミーデータが `undefined` になりゲームが壊れる。

**未登録の10体:**

| ID | 登場ステージ / 用途 | 設計書 |
|---|---|---|
| `grave_soldier` | area1_node1 WAVE1・3, デフォルト召喚 | `46_バランス調整設計.md §3-4` に stats あり |
| `rot_hound` | area1_node1 WAVE1, blood_mire_queen 召喚 | `46_バランス調整設計.md §3-4` に stats あり |
| `abyss_warden` | area1_node1 WAVE2（シールド） | `46_バランス調整設計.md §3-4` に stats あり |
| `grave_knight` | area1_node1 WAVE3（強めの雑魚） | `46_バランス調整設計.md §3-4` に stats あり |
| `ossuary_wyrm_lord` | area1_node3 以降ボス | `46_バランス調整設計.md §3-4` に stats あり |
| `earthbound_grudge` | ossuary_wyrm_lord 召喚ミニオン | `46_バランス調整設計.md §3-4` に stats あり |
| `bone_colossus` | 第1章中盤ステージ | stats 未設計 |
| `blood_mire_queen` | 第1章後半ステージ（ボス） | stats 未設計 |
| `bloodmire_leech` | blood_mire_queen 召喚ミニオン | stats 未設計 |
| `hollow_handmaid` | デフォルト召喚プール（BossGimmickSystem） | stats 未設計 |

**変更ファイル:** `src/data/master/monsters.json`

**対応方針:**
- 設計書 `46_バランス調整設計.md` に stats があるの6体はそのまま追加（`grave_soldier`, `rot_hound`, `abyss_warden`, `grave_knight`, `ossuary_wyrm_lord`, `earthbound_grudge`）
- 残り4体（`bone_colossus`, `blood_mire_queen`, `bloodmire_leech`, `hollow_handmaid`）は第1章の登場ステージが確定次第、JRPG スケールで設計して追加

**暫定対応（ゲームを壊さないため）:**
残り4体はとりあえず最低限の placeholder stats で追加し、後からチューニングする。

---

## 🟡 Medium — プレイはできるが設計上の欠陥 / 将来崩れるリスク

### M-A. TECH_DEBT L-1: スタブ Server Action 残り1件が未本実装

**問題:** `processGrowthAction` / `soulStoneAction` / `equipShardAction` は SEC-1 対応で認証・所有者確認・DB更新を実装済み。残りは `fetchPlayerAction` のモックのみ。

| アクション | 場所 | 現状 |
|---|---|---|
| `fetchPlayerAction` | `actions.ts:919` | ハードコードのモックデータを返す |

**対応方針:** `SEC-2` として、使わないなら削除。使う場合は `session.user.id` でオーナーシップを検証してDB参照へ差し替え。第1章リリース前に要判断。

---

### M-B. TECH_DEBT L-2: BattleEngine の WAVE 進行が「10ターン経過」トリガー

**問題:**
```typescript
// src/logic/BattleEngine.ts:761
if (this.state.turn > 10) { // ← 10ターン経過でWAVE+1
```

BattleCanvas は「敵全滅」でWAVE進行するため、将来 BattleEngine を接続した際に挙動が衝突する。

**対応方針:** `updateState()` の WAVE 進行を「全敵 HP ≤ 0」トリガーに変更。
**関連ファイル:** `src/logic/BattleEngine.ts:761`

---

### M-C. TECH_DEBT NL-1: SynergyBonus 未使用フィールド 3件

**問題:** `SynergyBonus` に `atkBonus`, `defBonus`, `avBonus` があるが `BattleDamage.ts` や BattleCanvas で参照されていない。

**対応方針:** 仕様として使わないなら型から削除。使うなら ATK/DEF/AV 計算に加算する。
**関連ファイル:** `src/logic/TribeSynergySystem.ts`, `src/logic/BattleDamage.ts`

---

### M-D. TECH_DEBT NL-2: `isAwakened` フラグが BattleCanvas に未接続

**問題:** `CharacterData.isAwakened` が `true` のとき BattleEngine はモンスター ATK を 1.5 倍にするが、BattleCanvas は参照していない。現在は常に `false` なので実害なし。

**対応方針:** 覚醒システム実装時に接続。現時点では低優先度。
**関連ファイル:** `src/logic/BattleEngine.ts`, `src/components/battle/BattleCanvas.tsx`

---

## 🟢 Low — 動作に影響しないが整備が必要

### L-1. 未コミットのファイルがある（`EnergySystem.ts` / `EnergySystem.test.ts`）

**状況:** `src/logic/EnergySystem.ts` と `src/logic/EnergySystem.test.ts` が untracked 状態。
機能は接続済みだがコミットされていない。

**対応:** `git add` してコミット。

---

### L-2. 設計書番号の重複（45 / 46 / 47 番）

**状況:**

| 番号 | ファイル① | ファイル② |
|---|---|---|
| 45 | `45_エリアギミックBattleCanvas接続設計.md` | `45_防御削減シナジー設計.md` |
| 46 | `46_ボスギミックAV_DELAY_BattleCanvas設計.md` | `46_バランス調整設計.md` |
| 47 | `47_魔神化INTERRUPT接続設計.md` | `47_SP成長設計.md` |

**対応:** 後から追加したドキュメントを 49〜51 にリネームする。

---

### L-3. `00_INDEX.md` に新規設計書が未登録

**状況:** 設計書 39〜48（このセッションで追加されたもの含む）が `00_INDEX.md` に掲載されていない可能性がある。

**対応:** `00_INDEX.md` を最新の設計書一覧に更新する。

---

### L-4. `types/game.ts` の `EnergyCurve` に追加フィールドのコメントなし

**状況:** `initialSpPct` と `spGrowthPerLevel` は追加済みだが説明コメントがなく他の開発者が用途を誤解する可能性。

**対応:** 設計書 `47_SP成長設計.md` に準拠したコメントを 1 行添える。

---

## 🔵 環境依存（要実機・実DB）

### E-1. NextAuth.js 実ログイン → クラウドセーブ E2E 未確認

**状況:** 実装は完了。Neon DB接続環境での動作確認が未実施。

**対応:** Neon DB 接続可能環境で以下を確認:
1. Google/Discord OAuth ログイン
2. ステージクリア後の `processStageResultAction` でクラウド保存
3. ランキング API の登録・取得
4. Pusher 世界ログの配信

**参照:** `CH1_TODO.md` の最終チェック欄

---

### E-2. iOS Safari 実機レイアウト確認未実施

**状況:** `h-[100dvh]` / `min-h-0` / overflow 分離の実装は確認済み。実機 iOS Safari では未確認。

**対応:** iPhone 実機またはシミュレータで以下を確認:
1. ホーム画面のレイアウト崩れなし
2. BattleCanvas の画面内収まり
3. モーダルの位置ずれなし

**参照:** `CLAUDE.md` iOS Safari Layout Rule

---

## 今セッションで完了したこと（参照用）

### 設計書（今セッション新規作成）
- `46_バランス調整設計.md` — JRPG スケール全面再設計（実装済み）
- `47_SP成長設計.md` — SP 初期値・レベル成長設計（実装済み）

### 実装済み（今セッション）

| 変更内容 | 状態 |
|---|---|
| `DEFAULT_BASE_STATS`: hp 800→60, atk 120→8, def 80→10 | ✅ 実装済み |
| `WeaponSystem` lv90 ベース ATK テーブル全面改訂（R:401→60 等） | ✅ 実装済み |
| `ilvScale = ilv / WEAPON_MAX_ILV`（ゼロ起点線形） | ✅ 実装済み |
| 初期装備 4 本 `ilv`: 40 → 1 | ✅ 実装済み |
| `area1_node1` WAVE 3: BOSS → ELITE（grave_soldier + grave_knight） | ✅ 実装済み |
| `jobs.json` 全職業に `initialSpPct` / `spGrowthPerLevel` 追加 | ✅ 実装済み |
| `src/logic/EnergySystem.ts` 新規作成（未コミット） | ✅ 実装済み / ⚠️ 未コミット |
| `actions.ts`: `calculateEnergyState` で currentEnergy/maxEnergy を接続 | ✅ 実装済み |
| `BattleEngine.ts`: `getEnergyRegen` で energyGain を職業別に変更 | ✅ 実装済み |
| `BattleCanvas.tsx`: バトル開始時に `calculateInitialEnergy` で SP 初期化 | ✅ 実装済み |
| `NM-5` defenseReducePct: BattleDamage.ts の DEF 計算に適用 | ✅ 実装済み |
| `NC-1` プレイヤー死亡判定: triggerPlayerDefeat 実装、ResultScreen 敗北画面 | ✅ 実装済み（前セッション） |

---

## 第1章リリース前の最終確認リスト

- [ ] R-1: monsters.json に第1章エネミー10体を追加
- [ ] M-A: 残りスタブ `fetchPlayerAction` の削除または本実装判断
- [ ] M-B: BattleEngine WAVE進行を「敵全滅トリガー」に変更
- [ ] L-1: EnergySystem.ts / EnergySystem.test.ts をコミット
- [ ] L-2: 設計書番号の重複解消（45/46/47 各2冊）
- [ ] L-3: `00_INDEX.md` を最新設計書一覧に更新
- [ ] E-1: Neon DB 接続環境でのログイン→クラウドセーブ確認
- [ ] E-2: iOS Safari 実機レイアウト確認
