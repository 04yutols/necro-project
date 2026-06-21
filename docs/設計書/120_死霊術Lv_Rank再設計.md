# 120. 死霊術(ネクロマンス)Lv／Rank 再設計

> 最終更新: 2026-06-21
> ステータス: 実装済み（F1〜F7 / 2026-06-21）
> 関連: [05_死霊術システム.md](05_死霊術システム.md)（一部置換）・[43_ネクロランクステータス反映設計.md](43_ネクロランクステータス反映設計.md)（**反転＝廃止**）・[97_モンスターネクロマンス獲得機能設計.md](97_モンスターネクロマンス獲得機能設計.md)・[98_敵マスターネクロマンス設定管理設計.md](98_敵マスターネクロマンス設定管理設計.md)

## 0. このドキュメントの位置づけ

死霊術（ネクロマンス）の育成軸を再定義する。**ネクロLvの成長は主人公キャラを一切強化せず、(a) 味方モンスターのステータス加算 と (b) 軍団コスト上限(maxCost)アップ にのみ寄与する。** 職業Lvとは完全に独立。転職に相当する RANK は 50Lvごとに自動昇格し、Rank が上がるとネクロマンス（捕獲）成功率に乗算ボーナスが乗る。

本設計は以下を**置換・廃止**する:
- doc 43「ネクロランクをキャラの基礎ステへ反映」→ **全面廃止**（キャラに乗せない）
- doc 05 §3「Lv.99 → RankUp 転生システム」→ **廃止**（転生リセットなし、連続Lv＋導出Rank）

---

## 1. 確定要件（ユーザー承認済み・変更不可）

| # | 決定 |
|---|---|
| D1 | ネクロLvの成長は **主人公のステータスを一切強化しない**。味方モンスターのステ加算と maxCost アップに寄与。職業Lvと完全独立。 |
| D2 | RANK は 50Lv ごとに **自動昇格**。`rank = clamp(floor((level-1)/50)+1, 1, 10)`。最大 Lv500 / Rank10。**転生リセット廃止**。 |
| D3 | 現状 `calculateNecromanceLevelBonus()` が necroLv を主人公の会心ダメージ＋全属性ダメージ加成へ変換している経路を **完全撤去**。 |
| D4 | necroLv/Rank は味方モンスターの **HP/ATK/DEF/SPD のみ** を %乗算で強化（critRate/critDmg/effectHit/effectRes は対象外＝装備で個性化）。 |
| D5 | Rank 昇格ごとにネクロマンス成功率が乗算上昇: `effectiveRate = clamp(baseRate * 1.10^(rank-1), 0, 0.75)`。 |

---

## 2. 数式仕様（係数は `necroConfig.json` で調整、§6）

### 2.1 Rank 導出（純ロジック・係数50は固定）
```
clampNecroLevel(level) = clamp(floor(level), 1, 500)
deriveNecroRank(level) = clamp(floor((clampNecroLevel(level)-1)/50)+1, 1, 10)
```
| Lv | 1 | 50 | 51 | 100 | 101 | 450 | 451 | 500 | 501+ |
|---|---|---|---|---|---|---|---|---|---|
| rank | 1 | 1 | 2 | 2 | 3 | 9 | 10 | 10 | 10 |

### 2.2 モンスターステ倍率（D4）— 区分線形（balance確定）
序盤（Ch1到達Lv帯）で「育てた実感」を出すため Lv≤50 を急峻、Lv>50 を緩やかにする区分式を採用。
```
mult = 1 + min(L,50)*kA + max(0,L-50)*kB + (rank-1)*k2   // kA=0.006, kB=0.0024, k2=0.05
applyNecroToMonster: stats.{hp,atk,def,spd} *= mult（Math.round）
                     critRate/critDmg/effectHit/effectRes は据え置き
```
| Lv/Rank | 1/R1 | 10/R1 | 30/R1 | 50/R1 | 100/R2 | 500/R10 |
|---|---|---|---|---|---|---|
| mult | 1.006 | 1.060 | 1.180 | 1.300 | 1.470 | 2.830 |
| 例 HP100→ | 101 | 106 | 118 | 130 | 147 | 283 |
| 例 ATK50→ | 50 | 53 | 59 | 65 | 74 | 142 |

> 区分式を避けたい場合の次善案は単純線形 `k1=0.0035`（Lv30→1.105, Lv500→3.20）。Ch1体感を優先し区分式を推奨。

### 2.3 maxCost（D1）— 初期値引き下げ（balance確定）
3枠固定＋コスト(MINION1/ELITE2/BOSS4)では、初期 maxCost=10 だと序盤から最強級が通り制約が効かない。**初期の床を下げて序盤に「BOSS1体まで」制約を効かせる**。
```
maxCost = base + floor(level/D1) + (rank-1)*C2    // base=6, D1=10, C2=2
```
| necroLv/Rank | maxCost | deny される編成 | 許可される最強編成 |
|---|---|---|---|
| 1〜9 / R1 | 6 | BOSS2(8)・ELITE×3(8) | MINION×3(3)〜BOSS1+M2(6) |
| 10〜19 / R1 | 7 | BOSS1+ELITE2(8) | BOSS1+ELITE1+M1(7) |
| 20〜29 / R1 | 8 | BOSS2(8超の組合せ) | ELITE×3(8)・BOSS1+ELITE2(8) |
| 30〜39 / R1 | 9 | BOSS3(12) | BOSS2+M1(9) |
| 40〜50 / R1 | 10〜11 | BOSS3(12) | BOSS2+ELITE1(10) |
| 51〜 / R2 | 13+ | — | **(4,4,4)=12 解禁（rank2マイルストーン）** |

> Ch1完走帯（Lv8〜12）では maxCost 6〜7 で「BOSS1体・ELITE混成まで」が実際に効く。最強の BOSS×3(12) は Lv51/rank2（約25周）で解禁され、長期目標として機能する。
> ※ balance草案の「(4,4,4)はLv90 gate」はc2適用の取り違え。正しくは Lv51 で maxCost=6+5+2=13 となり解禁（PM訂正）。

### 2.4 捕獲成功率（D5）
```
effectiveRate = clamp(baseRate * RANK_MULT^(rank-1), 0, CAP)   // RANK_MULT=1.10, CAP=0.75
```
| tier(base) | R1 | R5 | R10 |
|---|---|---|---|
| MINION (0.12) | 0.1200 | 0.1757 | 0.2830 |
| ELITE (0.04) | 0.0400 | 0.0586 | 0.0943 |
| BOSS (0.001) | 0.0010 | 0.0015 | 0.0024 |
| custom 0.4 | 0.4000 | 0.5848 | **0.7500**(clamp) |

クランプ発動閾値: R1 base≥0.75 / R5 base≥0.5123 / R10 base≥0.3181。

### 2.5 EXP 取得源と曲線（balance確定）
- **取得源**: 職業EXPと同一フィードを共有（`GameManager` がクリア時 `expGain` を job/necro 両方へ付与）。ただし necro 側に **`necroExpRate=1.5`** を掛けて「職業より先に育つ独立軸」の体感を作る。新規付与ロジックは追加しない（低リスク）。
- **専用関数**: 職業の `expForLevel`/`levelFromTotalExp` は `MAX_JOB_LEVEL=99` ハードコードで共有のため流用禁止。専用 `necroLevelFromExp`（max500）/`reqNecroExp` を新設。
- **曲線**: `necroExpForLevel(lv) = (lv-1)*(lv + coefficient)`（`coefficient=9`）。二次式で「序盤薄・テール厚」。

| Lv | 50 | 100 | 200 | 500 |
|---|---|---|---|---|
| 累積必要EXP | 2,891 | 10,791 | 41,591 | **253,991** |

- **Ch1ペーシング**（1周=node1+node2+boss+node3、baseExp合計82、×necroExpRate1.5）: ストーリー完走 ≈ **necroLv 8〜12 / R1**。やり込み（ボス周回）で **Rank2(Lv51) ≈ 25周**、Lv500 は約2000周の長期テール。

---

## 3. アーキテクチャ原則（最重要）

### 3.1 数式の単一真実源 — `src/logic/NecroGrowthSystem.ts`（新規）
necro の純数式（config 駆動・React/Prisma非依存）を**一箇所に集約**する。`BattleDamage.ts` と同じ「式はここだけ」方針。
```ts
export const MAX_NECRO_LEVEL = 500;
export function clampNecroLevel(level: number): number;
export function deriveNecroRank(level: number): number;
export function necroMonsterMultiplier(level: number, cfg?): number;
export function applyNecroToMonster(monster: MonsterData, level: number, cfg?): MonsterData; // 不変・新オブジェクト
export function calcNecroMaxCost(level: number, cfg?): number;
export function applyNecroRankToCaptureRate(baseRate: number, rank: number, cfg?): number;
export function reqNecroExp(level: number, cfg?): number;
export function necroLevelFromExp(totalExp: number, cfg?): number;
```
捕獲オーケストレーション（`NecromanceCaptureSystem.ts`）は `applyNecroRankToCaptureRate` を import して使う（数式は二重に持たない）。

### 3.2 モンスター倍率の単一注入点
**倍率を BattleEngine 内部の多数の `monster.stats.*` 参照に散らさない。** BattleEngine へ渡す直前に `applyNecroToMonster()` を**一度だけ**通し、effective stats を持つ新 `MonsterData` を生成する。これで HP初期化・atkProfile・被ダメ防御側・effectRes・spd(行動順) すべてに自動で乗る。
```
[raw monster.stats]  ← necro倍率は保存値に焼き込まない（Lv変動での二重適用回避）
   ├─ サーバー戦闘: GameManager.prepareBattle で monsterList = monsterList.map(m => applyNecroToMonster(m, necroLevel))  ← 唯一の注入点(server)
   └─ クライアント戦闘: store セレクタ getBattleParty() = party.map(m => applyNecroToMonster(m, necroLevel))            ← 唯一の注入点(client)
        ↓ 共通で effective stats を消費
        BattleEngine.monsterCurrentHp[id]=stats.hp / calculateMonsterAttackProfile(atk×mult を spiritCore×awakened1.5) / 被反撃 defenderStats / TurnOrder 10000/spd
```
適用順序: `baseAtk × necroMult × spiritCore × awakened1.5`（全乗算・可換）。

> ⚠️ クライアント `BattleCanvas.tsx` は `party` を多数箇所（spd:2091 / battleParty:1995 / attackProfile:2603,3208,3260）で直接参照する。**`getBattleParty()` セレクタ1本に集約しないと一部 raw のままサーバー結果と乖離する。導入時は party 参照箇所の総点検が必須。**

### 3.3 raw を保存し動的適用する原則
捕獲モンスター生成（`createNecromancedMonster`）や DB 保存時に necro 倍率を `stats` へ焼かない。**raw stats を保存し、戦闘投入直前に動的適用**。これにより後で necroLv が上がっても二重適用／据え置きの不整合が起きない。

---

## 4. 修正箇所一覧（ロジック／サービス／ストア／UI）

| ファイル | 関数/箇所 | 現状 → 変更 |
|---|---|---|
| **`src/logic/NecroGrowthSystem.ts`** | 新規 | §3.1 の純数式を新設（単一真実源） |
| `src/logic/StatSystem.ts` | `calculateNecromanceLevelBonus()` | **削除**（キャラ補正撤去, D3） |
| 〃 | `calculateCharacterStatProfile()` | `necroBonus` 加算・elementBoost マージ行を削除。`StatBreakdown.necro` は ZERO 固定 or 廃止 |
| 〃 | `calculateNecroBaseStatsContribution()`/`normalizeNecromanceLevel()`/`normalizeNecroBaseStatsBonus()`/`NecromanceLevelBonus` | **削除**（未使用化） |
| `src/logic/NecromanceCaptureSystem.ts` | `getNecromanceRateForEnemy(enemy, necroRank?)` | Rank 引数追加・`applyNecroRankToCaptureRate` 適用（D5） |
| 〃 | `rollStageNecromance(input)` / `RollStageNecromanceInput` | `necroRank?: number` を追加し伝播 |
| 〃 | `createNecromancedMonster()` | 変更なし（raw stats のまま保存, §3.3） |
| `src/services/RewardService.ts` | `processStageNecromance()` | `rollStageNecromance` へ necroRank 伝播（呼び出し元シグネチャ要確認） |
| `src/logic/GameManager.ts` | `prepareBattle`(:107-127) | monsterList を `applyNecroToMonster` で変換してから `new BattleEngine`（server 注入点） |
| 〃 | `processStageResult`(:182) | necroRank を導出して `processStageNecromance` へ。necroEXP 付与を新曲線版へ |
| 〃 | `startStage`(:92-93) / `convertToCharacterData`(:211-212) | `necroBaseStatsBonus:` 代入を削除（necroLevel はモンスター計算用に保持） |
| `src/services/NecroService.ts` | `performRankUp()`(:84-110) | **削除**（転生廃止）。インメモリ版/DB版とも |
| 〃 | `validatePartyFormation()`(:75) | 変更なし（maxCost は導出済み保存値を参照） |
| `src/services/PlayerSaveService.ts` | `applyNecroExpGainToSave()`(:500) | 入口で `necroExp = floor(expGain * necroExpRate)`（rate=1.5）を適用。`levelFromExp`→`necroLevelFromExp`(max500) に差替え。:506 の `Math.min(99,…)` を 500 へ。Lv 確定後 `rank=deriveNecroRank` / `maxCost=calcNecroMaxCost` を再計算して書込み |
| 〃 | `rankUpNecroInSave()`(:545) | **削除**（転生廃止） |
| 〃 | `normalizeNecroStatus()`(:137) | 戻り型から rank/baseStatsBonus を外し、`rank`/`maxCost` を level から導出（§5 の v3 移行後の通常動作） |
| 〃 | `emptyPlayerSave()` / `playerSaveToJson()` / `toCharacterDataForSave()` | necroStatus 初期値・serialize・代入から rank/baseStatsBonus/necroBaseStatsBonus を除去 |
| `src/store/useGameStore.ts` | `withNecroProgression()`(:176) / `initialize()`(:941) / `setNecroStatus` | 主人公への necroLv 注入・`necroBaseStatsBonus`/`rank` 初期値を除去。`necroLevel` は表示用に保持 |
| 〃 | `getBattleParty()` | **新規セレクタ**（client 注入点, §3.2） |
| `src/components/battle/BattleCanvas.tsx` | battleParty(:1995) ほか party 参照 | 入力 party を `getBattleParty()`（necro適用済）に置換。`calculateMonsterAttackProfile` 自体は不変 |
| `src/app/actions.ts` | `toServerGameData`(:340-377) | `necroLevel`/`necroBaseStatsBonus` 代入削除、`necroStatus` は `{level,maxCost,exp}` のみ |
| 〃 | `processGrowthForUser`(:1192) | `RANK_UP` 分岐削除（§4.1） |
| `src/types/game.ts` | `NecroStatus` / `CharacterData` | `rank`・`baseStatsBonus`・`necroBaseStatsBonus` を削除（**2段階, §9**）。`necroLevel` コメントを max500 へ |
| `src/types/playerSave.ts` | `PlayerSaveData.necroStatus` / `PLAYER_SAVE_SCHEMA_VERSION` | 型変更＋ `=3` へ |
| `src/components/home/HomeHero.tsx`(:248) / `necro/NecroLab.tsx`(:942) / `MobileHeader`/`DashboardFrame` | `necroStatus.rank` 参照 | `deriveNecroRank(level)` 呼び出しに変更 |

### 4.1 `RANK_UP` グロースアクションの廃止（横断クリーンアップ）
転生廃止により以下が死にコード化するため**併せて除去**:
- `GrowthActionType = 'RANK_UP' | 'CHANGE_JOB'` から `RANK_UP` を削除
- `GameManager.processGrowth()` の `RANK_UP` ハンドラ / `actions.ts:1192` の分岐 / NecroLab の「転生・ランクアップ」UI
- ランクアップは導出値となるため、UI 上の「ランクアップボタン」「試練(isTrialCompleted)」フローは消滅

---

## 5. 永続化・マイグレーション設計

### 5.1 保存方針: PlayerSave JSON スナップショット継続（Prisma 専用カラム新設なし）
- necro 状態は専用 Prisma カラムを持たず `Character.playerState`(Json) 内に保存（現状踏襲）。
- `necroLevel`(1-500) / `necroExp` / `necroMaxCost` を保持。**`rank` は JSON から除去し都度導出**。`baseStatsBonus` は除去。
- Prisma カラム化は「Lv帯のSQL集計」「Lvでランキング」等が必要になった時のみ（第2章以降, DEFERRED）。今は二重管理リスクの方が大きく不採用。

### 5.2 schema v2 → v3 マイグレーション（明示）
`PLAYER_SAVE_MIGRATIONS` に v3 を追加。`PLAYER_SAVE_SCHEMA_VERSION=3`、`MIN_SUPPORTED=1` 維持。

**旧→新 変換式（転生で稼いだ rank を連続Lvへ繰り越し、不利益を回避）:**
```
新 necroLevel = clamp((旧rank - 1) * 50 + 旧level, 1, 500)
新 maxCost    = max(calcNecroMaxCost(新level), 旧maxCost)   // 旧値以上を保証
rank          : 保存しない（導出）
baseStatsBonus: 除去（読み捨て）
```
例: 旧 rank3/level15 → 新 level115（≒進行度相応）/ rank3 / maxCost=max(18,20)=20。

> ⚠️ **本番デプロイ時、v2 セーブを持つユーザーがゲームを開いた瞬間に lazy migration が走り即上書きされる。変換バグは全ユーザーのセーブを破壊するため、デプロイ前に v3 マイグレーションの単体テスト必須**（§8）。

### 5.3 影響関数
`PlayerSaveService`（`PLAYER_SAVE_MIGRATIONS`/`emptyPlayerSave`/`normalizeNecroStatus`/`applyNecroExpGainToSave`/`playerSaveToJson`/`toCharacterDataForSave`、`rankUpNecroInSave`削除）、`actions.ts`(`toServerGameData`)、`GameManager`(startStage/convertToCharacterData)、`useGameStore`(initialize/setNecroStatus/withNecroProgression)。

---

## 6. 管理画面(/admin) 組み込み設計

### 6.1 調整値の置き場: `src/data/master/necroConfig.json`（新規マスターデータ）
バランス係数群を再ビルドなしで admin から調整できるよう JSON 化。`git diff --exit-code src/data/master` の CI チェックも効く。Rank 算出 `floor((level-1)/50)+1` と `MAX_LEVEL=500` は純ロジック側（`NecroGrowthSystem.ts`）に固定。

```json
{
  "monsterStatMultiplier": { "kA": 0.006, "kB": 0.0024, "k2": 0.05 },
  "maxCost":               { "base": 6, "d1": 10, "c2": 2 },
  "captureRate":           { "rankMultiplier": 1.10, "cap": 0.75 },
  "expCurve":              { "coefficient": 9, "necroExpRate": 1.5 }
}
```
`monsterStatMultiplier` は区分線形 `1 + min(L,50)*kA + max(0,L-50)*kB + (rank-1)*k2`（§2.2）。
型 `NecroConfigData`（`game.ts`）／`MasterDataService.getNecroConfig()`（static import）／専用 Server Action `getNecroConfig()`・`saveNecroConfig()`（`assertDev()` + `writeJsonAtomic`）。
バリデーション制約（`auditMasterData` 新ブロック）: `kA∈[0,0.1]` `kB∈[0,0.05]` `k2∈[0,1]` `base∈[1,100]` `d1∈[1,100]` `c2∈[0,20]` `rankMultiplier∈[1,2]` `cap∈(0,1]` `coefficient∈[1,50]` `necroExpRate∈[1,3]`。

### 6.2 編集UI
- 新ページ `/admin/necro-config`（`page.tsx` RSC）＋ `NecroConfigForm.tsx`（'use client'）。右カラムに **Lv×Rank 成長試算パネル**（mult / maxCost / 捕獲率 / Lv100・Lv500 必要総EXP をリアクティブ表示）。
- `EnemyForm.tsx` ネクロマンスタブに **`CaptureRatePreview`**（R1〜R10 の実効捕獲率テーブル、上限到達は `*` 表示）。`rankMultiplier`/`cap` は `enemies/[id]/page.tsx` で `getNecroConfig()` し props 注入。

### 6.3 allyStats 二重適用ガード（重要）
`allyStats` は **Lv1/R1 時の基底値**として定義し、ランタイムで `applyNecroToMonster` が倍率を乗算する。admin フォームに「味方化後ステータスは Lv1/R1 基底値。Necro Lv/Rank 倍率は実行時に自動適用」と注記。`enemyBalance.ts` の allyStats tier 帯チェックも「Lv1/R1 基底として照合」とコメント更新。

### 6.4 エージェント／決定論ゲート
- `enemyBalance.ts`: `EnemyBalanceContext` に `necroCapRate?`/`necroRankMultiplier?`（省略時デフォルトで既存テスト互換）を追加。`captureRate > cap` で FAIL、`captureRate * rankMultiplier^9 > cap` で WARN。
- `enemyAgent.ts`: プロンプトの captureRate 説明を「R1 基底捕獲率。R10 で `^9` 倍、上限0.75 超え注意」に更新。
- `auditMasterData`: 実効率の理論検証は監査範囲外（哲学維持）。necroConfig 自体の構造バリデーションのみ追加。
- `simEvalAgent`(Agent E): MonsterData.stats 経由で自動反映。変更不要（将来「想定Rank」パラメータ追加は任意）。

### 6.5 デバッグ用 necro 付与（優先度低・DEFERRED 候補）
`/admin/debug` に `setDebugNecroStatus(characterId, level)`（dev限定）。第1章リリースでは任意。

---

## 7. テスト計画（要点）

### 7.1 新規ユニット（`src/logic/NecroGrowthSystem.test.ts` ほか）
- **Rank導出境界**: Lv 1/50/51/100/101/450/451/500/501 → rank 1/1/2/2/3/9/10/10/10。
- **モンスター倍率**: 代表 Lv/Rank で hp/atk/def/spd が `round(base*mult)`、crit/effect系が `toEqual` 不変（基準 `{hp100,atk50,def20,spd80,crit...}` → §2.2 期待値）。
- **maxCost**: Lv 1/25/50/75/100/200/500 → 10/11/12/15/16/24/48。`validatePartyFormation` の境界（=maxCostちょうどで true、+1で `'コスト超過です'`、null=cost0、2枠で `'パーティ編成は3枠固定です。'`）。
- **捕獲率**: tier×rank の effectiveRate（§2.4）、高base×高rank の 0.75 クランプ、`rollStageNecromance` を `rng` 注入＋ `necroRank` で捕獲/非捕獲境界（roll<rate 捕獲 / roll≥rate 非捕獲）。
- **necroExp→Lv→Rank→maxCost**: EXP 境界で level/rank/maxCost が連動更新（閾値は採用EXP曲線から算出）。

### 7.2 回帰（キャラ補正撤去, `StatSystem.test.ts`/`BattleEngine.test.ts`）
- `calculateCharacterStatProfile`: necroLevel を 1/50/100/500 と変えても `total.{hp,atk,def,spd,critDmg}` と `elementDmgBoosts` が**不変**（装備由来のみ）。
- `BattleEngine`: necroLevel 違いで主人公の物理/属性ダメージが**同値**。

### 7.3 マイグレーション（`PlayerSaveService.test.ts`）
- v2→v3: 旧 `{level:99,rank:2,maxCost:15,baseStatsBonus:1.5,exp:..}` → 新 `level=149, maxCost=max(導出,15), rank除去, baseStatsBonus除去`。
- `necroBaseStatsBonus` 欠落セーブでクラッシュしないこと。`undefined` necroStatus → emptyPlayerSave 既定。

### 7.4 壊れる既存テスト（要修正）
| テスト | 対応 |
|---|---|
| `StatSystem.test.ts`「necromance level bonus to crit/elemental」 | 反転（necroLv で不変を検証）or 削除 |
| `BattleEngine.test.ts` 2本（necroLv でダメージ増） | 削除 or 「不変」テストへ反転 |
| `NecroService.test.ts`「performRankUp …」 | `performRankUp` 廃止に伴い削除 |
| `PlayerSaveService.test.ts`「applies necro exp …」 | 新仕様（Lv連動 rank/maxCost 再計算、上限500）へ期待値更新 |
| `account-progression.integration.test.ts`（`necroBaseStatsBonus` アサーション） | フィールド削除に伴い当該行削除 |

### 7.5 統合/E2E
- account-progression: クリア後 `necroStatus.level/rank/maxCost` が `necroLevelFromExp`/`deriveNecroRank`/`calcNecroMaxCost` と一致。主人公ステが necroLv 非依存。
- Playwright: NecroLab の RANK/maxCost が新式表示、転生/ランクアップ UI が**存在しない**、コスト超過エラー表示。

---

## 8. 実装シーケンス（推奨フェーズ）

1. ✅ **F1 数式基盤（完了 2026-06-21）**: `NecroGrowthSystem.ts` 新設＋`game.ts` に `NecroConfigData` 追加＋`NecroGrowthSystem.test.ts`（39ケース）。tsc 0 / 全757テストgreen。未importのため挙動影響ゼロ。
2. ✅ **F2 キャラ補正撤去（完了 2026-06-21）**: `StatSystem` の necroBonus 経路削除＋回帰テスト。`necroBaseStatsBonus`/`baseStatsBonus` は適用経路から撤去。
3. ✅ **F3 モンスター注入（完了 2026-06-21）**: `applyNecroToMonster` を server(`GameManager`)・client(`getBattleParty`)の単一注入点へ。BattleCanvas の party 参照総点検。
4. ✅ **F4 捕獲率 Rank（完了 2026-06-21）**: `NecromanceCaptureSystem` に necroRank 伝播。RewardService/GameManager/BattleCanvas 接続。
5. ✅ **F5 永続化・転生廃止（完了 2026-06-21）**: schema v3 マイグレーション、`applyNecroExpGainToSave` 新曲線、`rankUpNecroInSave`/`performRankUp`/`RANK_UP` アクション削除。
6. ✅ **F6 管理画面（完了 2026-06-21）**: `necroConfig.json`＋`/admin/necro-config`＋EnemyForm プレビュー＋balance ゲート。
7. ✅ **F7 型整理（完了 2026-06-21）**: `NecroStatus.rank`/`baseStatsBonus`/`CharacterData.necroBaseStatsBonus` を型から削除し、連鎖する型エラーを解消。
8. ✅ 検証: `npx tsc --noEmit` + `npm test -- --runInBand`。

---

## 9. 2段階フィールド削除（ビルド連鎖崩壊の回避）
`baseStatsBonus` / `necroBaseStatsBonus` / `rank` を型から即削除すると、初期化・normalize・serialize・store 既定値（複数箇所）で型エラーが連鎖する。
- **段階1（F2〜F6）**: 値の**参照・適用を除去**（読み捨て・0/undefined 固定）。型は残す。機能はこの時点で要件を満たす。
- **段階2（F7）**: 型からフィールドを削除し、残った参照を一掃。

---

## 10. オープンなバランス項目／リスク

| id | 内容 |
|---|---|
| OB-1 | ✅ **解決**（§2.5）。同フィード共有＋`necroExpRate=1.5`、曲線 `(L-1)*(L+9)`。Ch1完走≈Lv8-12、Lv500=25.4万EXP(長期テール)。 |
| OB-2 | ✅ **解決**（§2.3）。`base=6/d1=10/c2=2`。序盤BOSS1体制約が機能、(4,4,4)はLv51/rank2解禁。 |
| OB-3 | **spd 倍率で行動順が変化**。区分式採用で Lv500 spd ×2.83（旧×2.45より微増）。ボス AV_DELAY ギミックとの相互作用を実装後に確認。 |
| R-1 | **旧セーブ移行**。転生で稼いだ rank を §5.2 の式で連続Lvへ繰り越すが、exp は復元不能なため「level/maxCost ベースの救済」で対応。デプロイ前テスト必須。 |
| R-2 | **EXP関数の取り違え**。職業 `levelFromTotalExp`(max99) と混在させると職業側 Lv 上限が壊れる。必ず necro 専用関数を新設。 |
| R-3 | **倍率の二重適用**。raw を保存し戦闘投入直前に1回だけ適用（§3.3）を徹底。BattleCanvas のステ表示が effective か raw かの方針統一も必要。 |
| R-4 | **client 注入漏れ**。`getBattleParty()` 一本化を怠ると一部 raw が残りサーバー結果と乖離。 |
