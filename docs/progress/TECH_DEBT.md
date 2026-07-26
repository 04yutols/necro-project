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

### ✅ M-1. `spd`ステータスがターン順に反映されていない（2026-05-24 完了）

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

**完了内容：**
- `docs/設計書/40_AVターン順システム設計.md` に AV ターン順の式・初期化・敵フェーズ仕様・テスト方針を追加。
- `src/logic/TurnOrderSystem.ts` を追加し、`actionDelay = 10000 / spd`、AV順ソート、敵フェーズスケジュール、状態異常AV遅延を共通化。
- `BattleCanvas` の WAVE開始・プレイヤー行動後・敵フェーズに AV を接続し、SPD が手番頻度と敵の行動順に反映されるよう修正。
- `src/logic/TurnOrderSystem.test.ts` を追加。

---

### M-2. ネクロレベル／ランクのステータスへの反映が未接続 ✅完了

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

**完了内容：**
- `docs/設計書/43_ネクロランクステータス反映設計.md` に計算式・データフロー・テスト方針を追加。
- `CharacterData.necroBaseStatsBonus` を追加し、DB の `Character.necroBaseStatsBonus` を `toServerGameData()` / `GameManager` から流すよう修正。
- `calculateCharacterStatProfile()` に `necro` 内訳を追加し、HP/ATK/DEF/SPD にネクロランク倍率を反映。
- 装備・残滓の `%` オプションがネクロ補正後の基礎値を参照するよう修正。
- `BattleEngine` の主人公直接被弾時も最終 DEF を参照するよう修正。
- Zustand の `loadFromServer()` / `setNecroStatus()` で `player.necroBaseStatsBonus` を同期。
- `src/logic/StatSystem.test.ts` / `src/logic/BattleEngine.test.ts` に倍率反映テストを追加。

---

### M-3. 職業別ステータス成長率がない（全職業一律） ✅完了

**問題：**  
`STAT_GROWTH_PER_LEVEL = { hp: 40, atk: 6, def: 4 }` が全職業共通。  
戦士も魔法使いも同じ量で成長し、職業の個性が薄れる。

**対応方針：**  
`jobs.json` に `growthModifiers: { hp: 1.0, atk: 1.2, def: 1.0 }` のようなフィールドを追加し、  
`processStageResultAction` のレベルアップ処理で現在の職業の成長率を掛けて適用する。

**関連ファイル：**
- `src/app/actions.ts` — `STAT_GROWTH_PER_LEVEL`（line ~79）、レベルアップ処理（line ~547）
- `src/data/master/jobs.json` — 全職業に `growthModifiers` を追加

**完了内容：**
- `docs/設計書/44_職業別ステータス成長率設計.md` に成長式・役割分担・職業別倍率・テスト方針を追加。
- `src/logic/JobGrowthSystem.ts` を追加し、基礎成長量と職業別倍率計算を共通化。
- `src/data/master/jobs.json` の全12職に `growthModifiers` を追加。
- `processStageResultForUser()` と旧 `GameManager.processStageResult()` で職業別成長を適用。
- `src/logic/JobGrowthSystem.test.ts` と新規アカウント統合テストで成長反映を検証。

---

## 🟢 Low — 動作はするが将来の不整合リスク

### L-1. スタブ実装のServer Action（2026-05-24 完了）

`processGrowthAction` / `soulStoneAction` / `equipShardAction` は SEC-1 対応で認証・所有者確認・DB更新を実装済み。
`fetchPlayerAction` も SEC-2 対応で認証・所有者確認・DB実データ取得を実装済み。

| アクション | 場所 | 現状 |
|---|---|---|
| `fetchPlayerAction` | `actions.ts` | `auth()` と `Character.userId` で所有者確認し、`CharacterData` を返す |

**対応:** `docs/設計書/52_SEC2_fetchPlayerAction_IDOR設計.md` に設計を残し、`src/tests/sec2-fetch-player-action.integration.test.ts` で検証済み。

---

### ✅ L-2. BattleEngineのWAVE進行が「10ターン経過」トリガー（2026-06-11 完了）

**問題：**  
`BattleEngine.updateState()` は「`turn > 10` でWAVE+1」というロジック。  
実際のBattleCanvasは敵全滅を検知して次WAVEに進む独自ロジックを持っているため、  
BattleEngineを将来接続したときに挙動が衝突する可能性がある。

**完了内容：**
- `updateState()` を「現 WAVE の敵が全員 HP=0 になったときのみ WAVE+1（turn リセット）」へ変更。10 ターントリガーは削除。
- `BattleEngine.test.ts` に「敵全滅で WAVE 進行」「敵残存ならターン経過でも進行しない」を追加。全テスト PASS。

---

### L-3. BattleEngine の `statScale` が per-wave モデルと不整合（2026-06-28 申し送り）

`statScale` は `StageWaveData` / `BattleCanvas` / `stageBalance` では per-wave だが、現状の `BattleEngine` はステージWAVEを受け取らず、エンジン単位の `enemyStatScale` を召喚敵にのみ適用する。production の live battle は `BattleCanvas` 駆動で、stage result metric cap も per-wave のため現時点の実害はない。将来 `BattleEngine` を authoritative battle に接続する場合は、主WAVE敵と召喚敵の両方を `state.wave` に対応する `wave.statScale` で materialize すること。

---

---

## 🔴 Critical（追加） — ゲームが壊れる

### ✅ NC-1. プレイヤー死亡判定が存在しない（2026-05-24 完了）

**問題：**  
BattleCanvas は敵ターンで HP を減らすが、`playerHp <= 0` になっても何も起きない。  
ゲームオーバー画面への遷移もなく、**バトルが永遠に続く**。

**完了内容：**
- `docs/設計書/41_プレイヤー死亡判定設計.md` に設計書作成。
- `src/logic/PlayerDefeat.ts` に `applyPlayerDamage` / `isPlayerDead` 追加（純粋関数）。
- `BattleCanvas.tsx` に `playerHp` state + `playerHpRef` を追加し、バトル中の HP を正確に追跡。
- `runEnemyTurn()` の各敵攻撃後に HP 減算 + 死亡判定 → `triggerPlayerDefeat()` 実装。
- `resolvePlayerStatusBeforeAction()` の状態異常ダメージにも同一の死亡チェックを追加。
- `triggerPlayerDefeat()` が `enemyTurnSerialRef` をインクリメントして進行中アニメーションをキャンセル後、800ms 後に ResultScreen（DEFEAT）を表示。
- `ResultScreen.tsx` の敗北表示を修正（赤骸骨バッジ、報酬なし、「マップへ撤退」ボタン）。
- `src/logic/PlayerDefeat.test.ts` で 10 ケースを追加。全 112 テスト通過。

---

### ✅ NC-2. ボスギミック REVIVE / SUMMON_MINIONS が未実装（2026-05-24 完了）

**問題：**  
`enemies.json` にボスの REVIVE（第2形態移行）と SUMMON_MINIONS が定義されているが、  
BattleCanvas には対応処理がない。ボスが HP 0 になっても何も起きずバトルがクリアしてしまう。

BattleEngine にはロジックがあるが BattleCanvas には接続されていない。

**対応方針：**
- REVIVE: HP が 0 になったとき `reviveGimmick` チェックし、HP 50% 回復 + シールド再生 + ログ表示
- SUMMON_MINIONS: シールド破壊時に敵リストに雑魚を追加（または「増援が現れた」ログのみ）

**関連ファイル：**
- `src/data/master/enemies.json` — REVIVE/SUMMON_MINIONS 定義
- `src/components/battle/BattleCanvas.tsx` — `damageEnemy()` の HP 0 分岐
- `src/logic/BattleEngine.ts` — `applyBossGimmickEffect()` に参考実装あり

**完了内容：**
- `docs/設計書/42_ボスギミックREVIVE_SUMMON設計.md` に REVIVE / SUMMON_MINIONS の詳細仕様、Canvas適用順、増援プール、テスト方針を追加。
- `src/logic/BossGimmickSystem.ts` を追加し、発火済みキー、REVIVE HP、SUMMON 増援ID解決を共通化。
- `BattleEngine` の REVIVE を HP0限定へ修正し、HP50%跨ぎで復活しないようにした。
- `BattleCanvas` の `damageEnemy()` に、WAVE CLEAR 判定前の REVIVE / SUMMON_MINIONS 解決を接続。
- `src/logic/BossGimmickSystem.test.ts` と `BattleEngine.test.ts` にギミック検証を追加。

---

## 🟡 Medium（追加） — プレイはできるが設計上の欠陥

### NM-1. エリアギミック（スリップダメージ / 状態異常）が BattleCanvas に接続されていない ✅完了

**問題：**  
`StageData` に `areaGimmick: 'SLIP_DAMAGE' | 'STATUS_AILMENT' | 'NONE'` があり、  
BattleEngine には処理（`processAreaGimmick()`）があるが、BattleCanvas はギミックを無視している。  
「毒沼ステージ」などがあっても何も起きない。

**対応方針：**  
`buildBattleWaves()` でステージの `areaGimmick` を取得し、  
`endPlayerTurn()` または `runEnemyTurn()` の先頭で毎ターン判定・適用する。

**関連ファイル：**
- `src/data/master/stages.json` — `areaGimmick` フィールド
- `src/components/battle/BattleCanvas.tsx` — `endPlayerTurn()` / `runEnemyTurn()`
- `src/logic/BattleEngine.ts` — `processAreaGimmick()`（line ~678）参考実装あり

**完了内容：**
- `docs/設計書/45_エリアギミックBattleCanvas接続設計.md` に適用タイミング・式・データフロー・UI方針を追加。
- `src/types/game.ts` に `AreaGimmickType` と `StageData.areaGimmick` を追加。
- `src/logic/AreaGimmickSystem.ts` を追加し、スリップダメージ / 毒沼 / 魔神化免疫を共通化。
- `BattleCanvas` のプレイヤー行動前処理へエリアギミックを接続し、ログ・HUDバッジ・ダメージ表示を追加。
- `BattleEngine.processAreaGimmick()` も同じ共通ロジックへ接続。
- `src/data/master/stages.json` に既存ステージの `areaGimmick` を設定。
- `src/logic/AreaGimmickSystem.test.ts` を追加。

---

### NM-2. ボスギミック AV_DELAY が BattleCanvas に未実装 ✅完了

**問題：**  
`BossGimmick.effect: 'AV_DELAY'` がゲーム型と BattleEngine に定義されているが、  
BattleCanvas の `runEnemyTurn()` は `ENRAGE` しかチェックしていない。  
「TURN_3 で敵がプレイヤーの行動を遅延させる」ギミックが発火しない。

**対応方針：**  
`runEnemyTurn()` で `AV_DELAY` ギミックをチェックし、プレイヤーの次ターン開始を  
指定ターン数だけ遅らせる（または PARALYSIS 付与で代用）。

**関連ファイル：**
- `src/components/battle/BattleCanvas.tsx` — `runEnemyTurn()`
- `src/logic/BattleEngine.ts` — `applyBossGimmickEffect()` case `'AV_DELAY'` 参考あり

**完了内容：**
- `docs/設計書/46_ボスギミックAV_DELAY_BattleCanvas設計.md` に AV_DELAY の式・発火タイミング・UI方針を追加。
- `src/logic/BossGimmickSystem.ts` に `DEFAULT_BOSS_AV_DELAY` / `getBossAvDelayBase()` / `calculateBossAvDelay()` を追加。
- `BattleCanvas.runEnemyTurn()` の敵行動スケジュール前に `TURN_3 / AV_DELAY` 判定を接続し、`battleAvRef.current.player` へ実遅延 AV を加算。
- 発火ログ、紫フラッシュ、画面揺れを追加。
- `src/data/master/enemies.json` の `ossuary_wyrm_lord` AV_DELAY を `value: 40` に修正。
- `src/logic/BossGimmickSystem.test.ts` に AV_DELAY の発火条件・effectRes 軽減テストを追加。

---

### ✅ NM-3. 魔神化「INTERRUPT」は実際にはプレイヤーターン中しか機能しない

**問題：**  
ソウルゲージが 100% のとき魔神化ボタンに「INTERRUPT」ラベルが表示されるが、  
実際には `phase === 'playerTurn'` 中にしか押せない。敵ターン中の割り込みはできない。  
ラベルと挙動が矛盾している。

**対応済み：**
敵ターン中（`phase === 'enemyTurn'`）でも魔神化を可能にし、
敵ターン中の発動時のみ `enemyTurnSerialRef` をインクリメントして予約済み敵アクションをキャンセルする。
通常のプレイヤーターン発動は `READY`、敵ターン発動は `INTERRUPT` と表示を分けた。

**関連ファイル：**
- `src/components/battle/BattleCanvas.tsx` — `handleDemonize()`、`demonizeButton` の `enabled` 条件
- `src/logic/DemonizationSystem.ts` — `resolveDemonActivation()`、`canActivateDemonModeInPhase()`、`shouldInterruptEnemyTurnOnDemonize()`
- `src/logic/DemonizationSystem.test.ts` — フェーズ別発動可否と割り込み判定のテスト
- `docs/設計書/47_魔神化INTERRUPT接続設計.md` — 詳細設計

---

### ✅ NM-4. 霊核（SpiritCore）の `atkMultiplier` がパーティモンスターの攻撃力に反映されていない

**問題：**  
`MonsterData.spiritCore` の `atkMultiplier` は DB から読み込まれているが、  
BattleCanvas / BattleDamage でパーティモンスターのダメージ計算に使われていない。  
霊核を装着しても攻撃力が変わらない。

**対応済み：**
`MonsterAttackSystem` にモンスター追撃用の攻撃プロファイルを追加し、
`spiritCore.atkMultiplier` と霊核属性を BattleEngine / BattleCanvas の追撃へ接続した。
DB起点のBattleEngineでも欠落しないよう、`GameManager.startStage()` で `spiritCore` relation をincludeする。

**関連ファイル：**
- `src/components/battle/BattleCanvas.tsx` — モンスター追撃処理
- `src/logic/BattleEngine.ts` — 純粋戦闘シミュレーションの軍団追撃
- `src/logic/MonsterAttackSystem.ts` — 霊核倍率・属性を含む追撃プロファイル
- `src/logic/MonsterAttackSystem.test.ts` — 霊核倍率の単体テスト
- `src/logic/BattleEngine.test.ts` — 追撃ダメージへの反映テスト
- `src/logic/GameManager.ts` — DBから `spiritCore` relation を読み込み
- `src/types/game.ts` — `SpiritCoreData.atkMultiplier`
- `docs/設計書/48_霊核ATK倍率追撃反映設計.md` — 詳細設計

---

### ✅ NM-5. 種族シナジー `defenseReducePct` が敵DEFの軽減に反映されていない（2026-05-24 完了）

**問題：**  
ORC シナジーなどで `defenseReducePct` が加算されるが、  
`calculateBattleDamage()` でこの値を使った敵 DEF 軽減処理がない。

**完了内容：**
- `docs/設計書/45_防御削減シナジー設計.md` に式・数値例・テスト仕様を追加。
- `BattleDamage.ts` の DEF 計算を `effectiveDef = rawDef × (1 - clamp(reducePct,0,100)/100)` に修正（2行追加）。
- `BattleDamage.test.ts` に defenseReducePct ブロック（7ケース）を追加。全 149 テスト通過。

---

## 🟢 Low（追加） — 動作はするが将来の不整合リスク

### ✅ NL-1. 種族シナジー `atkBonus` / `defBonus` / `avBonus` が未使用（2026-06-11 完了）

**問題：**  
`SynergyBonus` に `atkBonus`、`defBonus`、`avBonus` フィールドがあるが、  
`BattleDamage.ts` でも BattleCanvas でも参照されていない。

**完了内容：**
- 全使用箇所 grep で「定義と代入のみ・読み取りゼロ」を確認し、3 フィールドを型と代入箇所から削除。
- `actions.ts` / `NecroService.ts` の `atkBonus` は `SoulShardData.effect.atkBonus`（別型）で混同なし。
- BEAST+DRAGON クロス共鳴の `elementDmgBonus+10` は維持。テスト更新済み・全 PASS。

---

### NL-2. `isAwakened` フラグが常に `false` で BattleCanvas に接続なし

**問題：**  
`CharacterData.isAwakened` が `true` のとき BattleEngine はモンスター ATK を 1.5 倍にするが、  
BattleCanvas は `isAwakened` を参照していない。現在は常に `false` なので影響なし。

**対応方針：** 「覚醒」システムを実装する際に BattleCanvas への接続を追加する。現時点では低優先度。

**関連ファイル：**
- `src/logic/BattleEngine.ts` — `processMonsterActions()`
- `src/components/battle/BattleCanvas.tsx`（未参照）

---

## 🟢 Low（ストーリー発火 / 永続化スコープ）— 2026-06-21 追加

> 「新規登録時にプロローグ未発火」バグ修正（`docs/progress/BUGFIX_プロローグ未発火_2026-06-21.md`）の
> レビューで洗い出した非ブロッカーのエッジケース。実害は小さく現状スコープでは対応不要だが、
> 将来 reload 経路やマルチアカウント運用を増やす際に再検討する。

### ST-1. `reload` 毎に再生中ストーリーが中断され得る

**問題：**
`useAuthFlow.boot()` は `necro-auth-changed` / セッション復帰 / キャラ作成のたびに走り、その中で
`switchStoryPersistenceScope()` が毎回 `activeScene` / `sceneQueue` をクリアする。
ストーリーシーン再生中に何らかの理由で reload が走ると、再生が途中で打ち切られる。

**現状の影響：** 低。reload は認証遷移時に集中し、ストーリー再生中と重なる可能性は低い。

**対応方針：** 再生中（`activeScene != null`）はスコープが同一なら `activeScene`/`sceneQueue` のクリアをスキップする、
あるいはスコープ変更が実際に発生したときのみクリアする。

**関連ファイル：**
- `src/store/useStoryStore.ts` — `switchStoryPersistenceScope()`
- `src/hooks/useAuthFlow.ts` — `boot()`

---

### ST-2. 並行 boot 時の永続化スコープ競合

**問題：**
`switchStoryPersistenceScope()` は `cancelled` に関係なくストア / `localStorage` を変更する
（認証確定パスのみ await 後に `cancelled` チェックあり）。短時間に reload が二重発火すると、
`useStoryStore.persist.rehydrate()` が交錯し得る。

**現状の影響：** 低。プロローグ発火は `hasPlayer`（player ロード後）でゲートされるため、ユーザーに見える破綻は起きにくい。

**対応方針：** `switchStoryPersistenceScope()` 呼び出し側で世代トークン（version / cancelled）を渡し、
古い boot からの rehydrate 反映を破棄する。

**関連ファイル：**
- `src/hooks/useAuthFlow.ts` — guest / no-user / 失敗パスの `await switchStoryPersistenceScope(null)`
- `src/store/useStoryStore.ts` — `switchStoryPersistenceScope()`

---

### ST-3. 初回オートハイドレートが「前回スコープ」のデータを一瞬読む

**問題：**
フルリロード時、persist のオートハイドレートは永続スコープマーカー（`necro-story-store-scope-v1`）を見て
前回アクティブだったユーザーの `viewedScenes` / `storyFlags` を先に読み込み、その後 `boot()` の
`switchStoryPersistenceScope()` で実セッションのユーザーに再確定する。別タブでアカウント切替した直後などに
一瞬だけ前ユーザーの flags がメモリに載る。

**現状の影響：** 低。画面表示・プロローグ判定は `hasPlayer` ゲート後にしか走らないため、視覚的なリークは無い。

**対応方針：** 必要なら `skipHydration: true` にして、`boot()` でユーザー確定後にのみ初回ハイドレートする。

**関連ファイル：**
- `src/store/useStoryStore.ts` — persist 設定（`storage` / `onRehydrateStorage`）

---

## 🔴 バランス基盤（追加）— 2026-07-04 無限ダンジョン設計調査（doc122）で発見

### BAL-1. 残滓オプション実数が JRPG スケール改訂（doc46）に未追随

**問題：**
`RewardService.ts` の `MAIN_STAT_POOLS` / `SUB_OPTION_POOL` が旧スケールのまま。腕スロット メイン `ATK_FLAT: [80, 140]`（`RewardService.ts:41`）、サブ `ATK_FLAT: [10, 40]`（`:69`）に対し、現行のプレイヤー基礎ATKは4（`BalanceConfig.ts:9`）、最大武器ATKは185（`WeaponSystem.ts:15-19`）。残滓5枠+サブを積むとATKが数百〜千に達し、doc19のpower帯・doc46のダメージシミュレーション前提を破壊する。

**影響：** 残滓が本格解放されるCh2以降（および無限ダンジョンの報酬設計）の経済・難易度設計全体のブロッカー。

**対応方針：** 残滓メイン/サブの絶対値をJRPGスケールに再設計する（doc46の手法でプレイヤーピークATK目標から逆算）。暫定回避策は「%系オプションのみ評価対象にする」ルールの明文化。
**数値案あり（2026-07-04）：** `docs/設計書/123_残滓スケール再設計とCh1敵EHP是正.md` §A — 壊れはFLAT系3種・コード5箇所のみ。新レンジ表・既存データ移行方針・受入検証まで確定済み。実装待ち。

**関連ファイル：**
- `src/services/RewardService.ts:41,69`
- `docs/設計書/46_バランス調整設計.md` / `122_無限ダンジョン設計.md §6.0 BLK-1`

### BAL-2. Ch1 敵HPの逆転（真ボス < 中ボス < 精鋭表記）

**問題：**
`ossuary_wyrm_lord`（真ボス）HP90 < `gravewarden_colossus`（中ボス）HP95 < `blood_mire_queen`（role=ELITE表記）HP150（`enemies.json` 検証済み）。doc71 の「ボスは直前精鋭のEHP1.2倍以上」に違反の疑い。

**影響：** Ch1難易度導線の歪み + 無限ダンジョン（doc122）のboss floor基準テンプレ選定の土台がぶれる。

**対応方針：** RELEASE_CH1_設計 §1-C の Phase 2 新規敵作業と合流して是正。`enemyBalance`/`stageBalance` バリデータと simulator で確認。
**数値案あり（2026-07-04）：** `docs/設計書/123_残滓スケール再設計とCh1敵EHP是正.md` §B — 最小是正は ossuary_wyrm_lord 単体（hp90→180 / def10→24 / shield34→50、新EHP320=直前比1.37x）。他2体は不変。実装待ち。

**関連ファイル：**
- `src/data/master/enemies.json`（ossuary_wyrm_lord / gravewarden_colossus / blood_mire_queen）
- `docs/設計書/71_IMP3_敵ボスバランス手動調整手順.md` / `122_無限ダンジョン設計.md §6.0 BLK-2`

---

## 🟡 テスト基盤（追加）— 2026-07-13 テストデータ基盤刷新（`docs/仕様書/13_テストとCI.md`）で発見

### TI-1. `MasterDataService` にテスト用オーバーライドの差し込み口がない（L規模）

**問題：**
`MasterDataService` は `getInstance()` シングルトンで内部に `src/data/master/*.json` を直接ロードし、DIやオーバーライドの経路がない。実マスターデータに直接 import で結合しているテストは `src/logic/`・`src/lib/agent/`・`src/store/` にまたがり17ファイル（`data/master/` 直接import 14 + `MasterDataService` 経由3、`grep -rl "data/master/\|MasterDataService" src --include="*.test.ts"` で実測）。バランス調整（`enemies.json`/`stages.json` の数値変更）のたびにこれらのテストが「意図しない結合」で壊れうる。`src/testing/factories.ts`（実マスターデータ非依存）はこの問題を回避する形で新設されたが、既存17ファイルの結合自体は未解消。

**対応方針：** `MasterDataService.getInstance()` にテスト専用の `resetForTest()` / オーバーライド注入口（例: `setInstanceForTest(data)`）を追加するか、各システムを「マスターデータを引数で受け取る」形へ段階的にリファクタリングする。影響範囲が広いため第2章以降で着手。

**関連ファイル：**
- `src/services/MasterDataService.ts`
- `src/testing/factories.ts`（実マスターデータ非依存の代替パターンとして参考）

---

### TI-2. `account-progression.integration.test.ts` が574行の単一 `test()`（M規模）

**問題：**
`src/tests/account-progression.integration.test.ts` は「新規アカウント作成→スターター職業→ステージ1-1クリア→ドロップ・装備・成長」までを単一 `test()` 内の一連の assertion で検証している（574行）。途中の assertion が失敗すると、それ以降のシナリオが実行されずに失敗し、どのフェーズで壊れたのか特定するのに毎回ログを読み解く必要がある。

**対応方針：** シナリオを3ブロック（例: ①アカウント作成〜スターター職業付与 ②ステージクリア〜ドロップ計算 ③装備・成長反映）に分割し、`describe`/`test` を分けて失敗箇所を即座に特定できるようにする。DBセットアップの重複を避けるため `beforeAll` でシナリオの前段状態を共有する構成を検討。

**関連ファイル：**
- `src/tests/account-progression.integration.test.ts`

---

### TI-3. DB統合テスト（`src/tests/`）のCIジョブ化が未着手

**問題：**
`.github/workflows/ci.yml` のコメントに「DB シークレットを設定したら別ジョブ（`needs: test`）で `npx jest --ci src/tests` を追加する」と構想が明記されているが、`DATABASE_URL` シークレットが未設定で実施されていない。2026-07-13 のレイヤ分離解消（`docs/仕様書/13_テストとCI.md` §3）で `src/tests/` にDB依存テストが7ファイルに集約されたため、着手条件は整った。

**対応方針：** リポジトリ/Organization シークレットに Neon の `DATABASE_URL`（テスト専用ブランチ推奨）を追加し、`ci.yml` に `needs: test` の別ジョブとして `npx jest --ci src/tests` を追加する。

**関連ファイル：**
- `.github/workflows/ci.yml`
- `src/tests/*.integration.test.ts`

---

### TI-4. E2Eナビゲーション重複と脆いE2Eアサーションの棚卸し（S規模）

**問題：**
`tests/new-player-onboarding.spec.ts` の T-04〜T-10 は各 `test()` 内で個別に `page.addInitScript()` によるストーリー/チュートリアルのスキップ投入と `page.goto('/')` を書いており、`tests/helpers/e2e.ts` の `prepareE2EPage()` と実質同じ処理を重複実装している。また `tests/necro-lab.spec.ts:14` の `expect(page.locator('#tut-cost-display')).toContainText('8/6')` のような厳密値アサーションは、マスターデータのコスト調整で無関係に壊れる。

**対応方針：**
- T-04〜T-10 の個別 `addInitScript`/`goto` を `prepareE2EPage()` 呼び出しへ統一する（必要な `clearedStages` は `options.clearedStages` で渡す）。
- `necro-lab.spec.ts:14` 等の厳密値アサーションを棚卸しし、`toContainText('COST')` のような構造的な検証か、`src/testing/presets.ts` のプリセット値を参照する検証へ置き換える。

**関連ファイル：**
- `tests/new-player-onboarding.spec.ts`（T-04〜T-10、L133〜)
- `tests/helpers/e2e.ts`（`prepareE2EPage`）
- `tests/necro-lab.spec.ts:14`

---

### TI-5. dev限定「サーバーバックアカウントの即時プログレス生成」Server Actionがない（M規模）

**問題：**
`src/hooks/useDevPreset.ts` の `?devPreset=<name>` はゲストモード専用（`localStorage` 注入のみ）で、ログイン中のサーバーバックアカウントには適用されない（`authStatus !== 'guest'` は警告して無視）。DB同期を伴うサーバーバックの進行検証（クラウドセーブ・ランキング反映等）を素早く再現する手段がなく、`src/tests/account-progression.integration.test.ts` のような統合テストか手動プレイでしか確認できない。

**対応方針：** dev限定（`NODE_ENV !== 'production'`）の Server Action を追加し、`emptyPlayerSave()` ベースに実プリセット相当のレコード（`Character`/`Monster`/`AbyssalResidue` 等）を生成、`cleanPlayerSaveReferences()` で参照整合を取ってからログイン中アカウントへ適用する。既存の `src/services/PlayerSaveService.ts` の `emptyPlayerSave` / `cleanPlayerSaveReferencesWithIds` を流用できる。

**関連ファイル：**
- `src/hooks/useDevPreset.ts`
- `src/services/PlayerSaveService.ts`（`emptyPlayerSave`, `cleanPlayerSaveReferences`）
- `src/app/actions.ts`

---

## 監査スコープ外（確認済み・問題なし）

- スキルテーブル (`skills.json`) — 全スターター職 + 2次職スキル全件存在、power/mpCost/elementのバランス適切 ✅
- スキル解放システム — `getUnlockedSkillIds()` がレベル判定して正常動作 ✅
- `levelBonuses`（Lv10/20/30/40パッシブ）— `JobService.onLevelUp()` で正常適用 ✅
- 職業補正 (`statModifiers`) — `calculateJobAdjustedStats()` で正常適用 ✅
- ステージクリア報酬のDB保存 ✅
- 装備変更・パーティ変更のDB保存 ✅
