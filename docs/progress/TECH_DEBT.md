# 技術的負債・積み残しTODO

> 2026-05-23 監査により発見。実装方針は変えず、接続・修正が必要な箇所。
> 優先度順。完了したら `DONE.md` へ移動し、このファイルからチェックを入れる。

---

## 🔴 Critical — これが残るとコアゲームプレイが壊れる

### ✅ C-1. BattleCanvasをBattleEngineのダメージ計算式に繋ぎ直す（2026-05-24 完了）

**問題：**  
`BattleCanvas.tsx` は `BattleEngine` を一切使っていない。独自のインライン計算（`Math.round(1500 * demonMult ...)`）で画面ダメージを出している。

- 装備・パッシブ・種族シナジー・残滓ボーナスが **表示ダメージに反映されない**
- `calculateCharacterStatProfile()` の結果が画面に届いていない
- `BattleEngine` はテスト専用になっている状態

**対応方針：**  
`handleAttack` / `handleSkill` 内で `calculateCharacterStatProfile(player)` を呼び、実ATK/DEFを使って `BattleEngine` と同じ計算式でダメージを算出する。  
または `BattleEngine.simulateAction()` の戻り値のログを使って表示ダメージを反映する。

**関連ファイル：**
- `src/components/battle/BattleCanvas.tsx` — `handleAttack`（line ~2221）、`handleSkill`（line ~2284）、`damageEnemy()`
- `src/logic/BattleEngine.ts` — `calculateDamage()`（line 200-246）
- `src/logic/StatSystem.ts` — `calculateCharacterStatProfile()`

**完了内容：**
- `src/logic/BattleDamage.ts` に BattleEngine / BattleCanvas 共通のダメージ計算式を追加。
- BattleCanvas の通常攻撃・術・魔神技を、実ステータス・敵DEF/耐性・属性ダメージ加成・種族シナジー・会心判定を使う経路へ接続。
- `npm test -- --runInBand`、`npx tsc --noEmit`、`npm run build` 通過。

---

### ✅ C-2. 職業変更のDB保存が未接続（2026-05-24 完了）

**問題：**  
`JobChangeScreen.tsx` が `useGameStore.changeJob()` を呼ぶがZustandのみの更新で終わっている。  
**ページをリロードすると職業変更が消える。**

**対応方針：**  
`actions.ts` に `changeJobForUser(jobId)` Server Action を追加し、`Character.currentJobId` と `UserJob` 行の更新をDBに保存する。  
`JobChangeScreen` から `changeJobForUser` を呼んでからZustandを更新する。

**関連ファイル：**
- `src/app/actions.ts` — `changeJobForUser` を追加する
- `src/components/necro/JobChangeScreen.tsx`（または同名） — Server Action の呼び出しを追加
- `src/store/useGameStore.ts` — `changeJob()`（line ~524）

**完了内容：**
- `docs/設計書/39_転職DB保存設計.md` に保存フロー・DB更新仕様・UI仕様・テスト方針を追加。
- `changeJobAction()` / `changeJobForUser()` を追加し、認証・所有者確認後に DB へ保存。
- `JobService.changeJob()` の永続化経路で `Job` upsert、`UserJob` Lv1作成、`Character.currentJobId` 更新、解放条件チェックを実施。
- `JobChangeScreen` は Server Action 成功後に `loadFromServer()` で正規状態を反映。
- 新規アカウント進行統合テストに転職保存確認を追加。

---

## 🟡 Medium — プレイはできるが設計上の欠陥

### M-1. `spd`ステータスがターン順に反映されていない

**問題：**  
`calcAVDelay()` が `StatusAilmentSystem.ts` に定義されているが、どこからも呼ばれていない。  
`spd` を上げても行動順が変わらず、ステータスとして「死に値」になっている。

**対応方針：**  
BattleCanvas の行動フローに AV（アクションバリュー）計算を導入する。  
`行動値 = 10000 / spd` として、プレイヤーと敵の行動順を毎ターン算出する。

**関連ファイル：**
- `src/logic/StatusAilmentSystem.ts` — `calcAVDelay()`
- `src/components/battle/BattleCanvas.tsx` — `runEnemyTurn()`、`endPlayerTurn()`
- `src/logic/BattleEngine.ts` — AV制御を追加する場合

---

### M-2. ネクロレベル／ランクのステータスへの反映が未接続

**問題：**  
`NecroStatus.baseStatsBonus` フィールドがあるが、ダメージ計算・キャラクターステータス表示のどこにも使われていない。  
ネクロレベルを上げても強くならない。

**対応方針：**  
`calculateCharacterStatProfile()` 内で `necroStatus.baseStatsBonus` を掛け算または加算するステップを追加する。  
または `StatSystem.ts` に `applyNecroBonus()` を追加する。

**関連ファイル：**
- `src/logic/StatSystem.ts` — `calculateCharacterStatProfile()`
- `src/types/game.ts` — `NecroStatus.baseStatsBonus`（line ~390）
- `src/app/actions.ts` — `toServerGameData()` で necroStatus を player に渡している部分

---

### M-3. 職業別ステータス成長率がない（全職業一律）

**問題：**  
`STAT_GROWTH_PER_LEVEL = { hp: 40, atk: 6, def: 4 }` が全職業共通。  
戦士も魔法使いも同じ量で成長し、職業の個性が薄れる。

**対応方針：**  
`jobs.json` に `growthModifiers: { hp: 1.0, atk: 1.2, def: 1.0 }` のようなフィールドを追加し、  
`processStageResultAction` のレベルアップ処理で現在の職業の成長率を掛けて適用する。

**関連ファイル：**
- `src/app/actions.ts` — `STAT_GROWTH_PER_LEVEL`（line ~79）、レベルアップ処理（line ~547）
- `src/data/master/jobs.json` — 全職業に `growthModifiers` を追加

---

## 🟢 Low — 動作はするが将来の不整合リスク

### L-1. スタブ実装のServer Action（4件）

現在未使用のためゲームに影響なし。ただし将来使う際に気づかず呼ぶと壊れる。

| アクション | 場所 | 現状 |
|---|---|---|
| `fetchPlayerAction` | `actions.ts:851` | ハードコードのモックデータを返す |
| `processGrowthAction` | `actions.ts:862` | 空の`{success:true}` |
| `soulStoneAction` | `actions.ts:866` | ランダムIDのモックを返す |
| `equipShardAction` | `actions.ts:874` | 空の`{success:true}` |

**対応方針：** 使わないなら削除。使う前に本実装に差し替える。

---

### L-2. BattleEngineのWAVE進行が「10ターン経過」トリガー

**問題：**  
`BattleEngine.updateState()` は「`turn > 10` でWAVE+1」というロジック。  
実際のBattleCanvasは敵全滅を検知して次WAVEに進む独自ロジックを持っているため、  
BattleEngineを将来接続したときに挙動が衝突する可能性がある。

**対応方針：** BattleEngineのWAVE進行を「敵全滅トリガー」に変更しておく（接続時に一本化）。

**関連ファイル：**
- `src/logic/BattleEngine.ts` — `updateState()`（line ~757）

---

## 監査スコープ外（確認済み・問題なし）

- スキルテーブル (`skills.json`) — 全スターター職 + 2次職スキル全件存在、power/mpCost/elementのバランス適切 ✅
- スキル解放システム — `getUnlockedSkillIds()` がレベル判定して正常動作 ✅
- `levelBonuses`（Lv10/20/30/40パッシブ）— `JobService.onLevelUp()` で正常適用 ✅
- 職業補正 (`statModifiers`) — `calculateJobAdjustedStats()` で正常適用 ✅
- ステージクリア報酬のDB保存 ✅
- 装備変更・パーティ変更のDB保存 ✅
