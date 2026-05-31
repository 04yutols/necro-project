# IMP-9: 序盤バランスと戦闘後MP全回復 再設計

> 作成日: 2026-05-31  
> 対象: Lv1基礎ステータス、職業EXP、職業レベル成長、Chapter 1敵、ステージEXP、戦闘終了時MP、ローカル勝利EXP  
> 関連: `46_バランス調整設計.md`, `51_BUG3_EXPレベル計算統一設計.md`, `72_IMP7_ステージ難易度導線手動調整手順.md`, `80_IMP8_スキルMPリソース再設計.md`

---

## 1. 背景

序盤の戦闘と育成に、次の問題が残っている。

1. Lv1プレイヤーの基礎ステータスが高く、通常攻撃が約10ダメージになる。
2. `area1_node1` から `area1_node2` で敵の総EHPが `11.46倍`、最大WAVE脅威度が `13.30倍` に跳ねる。
3. Lv1からLv2に必要な累積EXPが `500` で、序盤の成長実感が遅い。
4. レベルアップ時の基礎成長が `HP +40 / ATK +6 / DEF +4` を基準としており、初期値に対して急すぎる。
5. ローカル勝利時は `BattleCanvas` と `ResultScreen` の両方で `addExp()` が呼ばれ、EXPが二重加算される。
6. MPはステージ開始時に全回復するが、勝利、敗北、逃走の終了時点では全回復が保証されない。
7. Viteローカルモックは強化済み残滓5枠を初期装備しており、基礎値を下げても実戦値へ `HP_FLAT +380`, `ATK_FLAT +120` などが加算される。
8. ホームの `JOB-EXP` は必要経験値を `currentJob.level * 1000` で表示しており、共通EXP式と一致しない。

## 2. 再設計目標

| 項目 | 目標 |
|---|---|
| Lv1通常攻撃 | 初期武器込みで `4〜5` ダメージを中心にする |
| 敵通常攻撃 | 最初の敵は `3〜6` ダメージ帯を中心にする |
| Lv2到達 | 累積EXP `10` |
| EXP曲線 | レベルごとの必要EXPが `+2` ずつ緩やかに増える |
| 基礎成長 | HPは毎レベル少量、ATK/DEFは数レベル単位で少量増える |
| 敵導線 | 隣接ステージの総EHP上昇を原則 `2.5倍未満` にする |
| MP | 戦闘終了時に勝敗・逃走を問わず最大値へ戻す |
| EXP責務 | 勝利報酬の反映は `BattleCanvas` の1箇所に限定する |
| ローカル初回装備 | 強化済み残滓は所持品に残し、装備枠は空で開始する |
| JOB-EXP表示 | `getJobLevelProgress()` を使い、育成ロジックと一致させる |

## 3. Lv1基礎ステータス

職業補正前の共通Lv1基礎値を次へ変更する。

| stat | 変更前 | 変更後 |
|---|---:|---:|
| HP | 60 | 30 |
| ATK | 8 | 4 |
| DEF | 10 | 4 |
| SPD | 100 | 100 |
| CRIT RATE | 5 | 5 |
| CRIT DMG | 150 | 150 |
| EFFECT HIT | 0 | 0 |
| EFFECT RES | 0 | 0 |

剣士は職業補正後に `HP 34 / ATK 5 / DEF 5` となる。初期武器 `bone_cleaver` のLv1基礎ATK `+1` を加えると実戦ATKは `6` になる。DEF `3` の `grave_soldier` に対する非会心通常攻撃は次のとおり。

```text
floor(6 * (1 - 3 / (3 + 200))) = 5
```

サーバー作成キャラクター、Viteローカルモック、バランステストが異なる値を持たないよう、`src/logic/BalanceConfig.ts` に定数を集約する。

### 3.1 ローカル初期残滓

Viteローカルモックには、装備画面と強化画面を確認するための強化済み残滓を残す。ただし、初回戦闘の基準値を破壊しないよう `equippedResidueSlots` は5枠すべて `null` で開始する。

```text
abyssalResidues: 強化済み確認用データを保持
equippedResidueSlots: [null, null, null, null, null]
```

プレイヤーが残滓を装備した後に戦力が大きく増えること自体は、装備システムの挙動として維持する。

## 4. 職業EXP曲線

共通関数 `expForLevel(level)` は次の累積EXP式へ変更する。

```text
expForLevel(level) = (level - 1) * (level + 8)
```

| Level | 累積EXP | 前レベルから必要なEXP |
|---:|---:|---:|
| 1 | 0 | - |
| 2 | 10 | 10 |
| 3 | 22 | 12 |
| 4 | 36 | 14 |
| 5 | 52 | 16 |
| 6 | 70 | 18 |
| 7 | 90 | 20 |
| 8 | 112 | 22 |
| 9 | 136 | 24 |
| 10 | 162 | 26 |

既存の `levelFromTotalExp()` と `getJobLevelProgress()` は正典として維持し、式だけを差し替える。

ホームの `JOB-EXP` バーも `getJobLevelProgress()` の `progressRatio` と `expToNextLevel` を表示する。Lv1未取得時の表示は `あと 10` となる。

## 5. 職業レベル成長

### 5.1 基礎成長係数

| stat | 変更前 | 変更後 |
|---|---:|---:|
| HP | 40 | 3 |
| ATK | 6 | 0.5 |
| DEF | 4 | 0.4 |

### 5.2 累積差分方式

小数係数を安全に扱うため、「今回上がったレベル数」へ丸め済み成長量を掛けない。職業Lv1を起点とする累積成長量を算出し、到達前後の差分だけを永続化する。

```text
cumulative(stat, level)
  = round(baseGrowth[stat] * jobModifier[stat] * (level - 1))

increment(stat, fromLevel, toLevel)
  = cumulative(stat, toLevel) - cumulative(stat, fromLevel)
```

これにより、Lv1からLv4へ一気に上がった場合と、Lv2、Lv3、Lv4へ順番に上がった場合の永続成長が一致する。

剣士の例:

| 到達Lv | 累積HP | 累積ATK | 累積DEF |
|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 |
| 2 | 4 | 1 | 0 |
| 3 | 7 | 1 | 1 |
| 4 | 11 | 2 | 1 |
| 10 | 32 | 5 | 4 |

## 6. Chapter 1 敵データ

序盤の競り合いを維持しつつ、役割差とボスギミックを残す。

| enemy | HP | ATK | DEF | shieldHp |
|---|---:|---:|---:|---:|
| `grave_soldier` | 15 | 4 | 3 | 0 |
| `rot_hound` | 14 | 5 | 2 | 0 |
| `earthbound_grudge` | 12 | 3 | 2 | 0 |
| `hollow_handmaid` | 42 | 7 | 5 | 0 |
| `bloodmire_leech` | 46 | 8 | 5 | 0 |
| `abyss_warden` | 36 | 5 | 5 | 18 |
| `grave_knight` | 44 | 6 | 7 | 0 |
| `bone_colossus` | 72 | 9 | 9 | 24 |
| `ossuary_wyrm_lord` | 90 | 14 | 10 | 34 |
| `blood_mire_queen` | 150 | 14 | 13 | 48 |

`ossuary_wyrm_lord` はHP50%以下でENRAGEし、HP0で一度復活する。単純なATKだけを極端に上げず、実効HPとギミックでボス感を作る。

### 6.1 ステージEHP目標

| stage | 変更前EHP | 変更後EHP目標 |
|---|---:|---:|
| `area1_node1` | 137 | 142 |
| `area1_node2` | 1570 | 322 |
| `area1_boss` | 1353 | 357 |
| `area1_node3` | 2692 | 404 |
| `area2_gate` | 3002 | 369 |

`area2_gate` は現状ロック表示用の仮データであるため、Chapter 2本実装時に専用敵へ置き換える。

## 7. ステージEXP

職業EXP曲線に合わせ、Chapter 1報酬を小さな整数へ変更する。Gold経済は武器強化、残滓強化、初期所持金を含む別の経済設計が必要なため、今回は変更しない。

| stage | 変更前EXP | 変更後EXP | 累積クリアEXP |
|---|---:|---:|---:|
| `area1_node1` | 620 | 12 | 12 |
| `area1_node2` | 780 | 16 | 28 |
| `area1_boss` | 1320 | 24 | 52 |
| `area1_node3` | 1560 | 30 | 82 |
| `area2_gate` | 1880 | 38 | 120 |

初回攻略を順番に進めた場合、剣士は概ね `Lv1 → Lv2 → Lv3 → Lv5 → Lv6 → Lv8` と成長する。

## 8. 戦闘終了時MP

### 8.1 ストアAPI

`useGameStore` に `restoreEnergy()` を追加する。

```text
restoreEnergy()
  player.currentEnergy = player.maxEnergy
```

内部フィールド名はIMP-8の互換方針に従い `currentEnergy`, `maxEnergy` を維持する。UI上の名称はMPのままとする。

### 8.2 呼び出しタイミング

| 終了経路 | 呼び出し位置 |
|---|---|
| 勝利・ローカル報酬成功 | `setBattleResult()` の前 |
| 勝利・報酬フォールバック | `setBattleResult()` の前 |
| 敗北 | `triggerPlayerDefeat()` 内 |
| 逃走 | `SystemBar.onEscape` 内 |

サーバー側ではMPをDBへ永続化せず、ロード時に `calculateEnergyState()` で満タン値を返している。今回のストアAPIは、ResultScreen表示中とSPA遷移後にも同じ保証を与える。

`src/app/page.tsx` の共通 `BattleCanvas.onEnd` は画面をMAPへ戻すだけにする。クリアフラグは勝利報酬処理だけが追加し、敗北や逃走でクリア扱いにしない。

## 9. EXP二重加算の解消

勝利報酬反映の責務を `BattleCanvas.resolveWaveClear()` に限定する。`ResultScreen` は鑑定演出と表示のみを担当し、マウント時に `addExp()` を呼ばない。

```mermaid
flowchart LR
  A["最終WAVE撃破"] --> B["processStageResultLocal"]
  B --> C["BattleCanvas: addExp / addGold / drop反映"]
  C --> D["restoreEnergy"]
  D --> E["ResultScreen: 表示のみ"]
```

## 10. 実装対象

| file | 変更内容 |
|---|---|
| `src/logic/BalanceConfig.ts` | Lv1基礎値を正典化 |
| `src/logic/ExperienceSystem.ts` | 累積EXP式を変更 |
| `src/logic/JobGrowthSystem.ts` | 小数係数と累積差分方式を導入 |
| `src/app/actions.ts` | 共通Lv1基礎値、累積成長差分を使用 |
| `src/app/page.tsx` | 共通終了処理から無条件クリア付与を削除 |
| `src/logic/GameManager.ts` | 累積成長差分を使用 |
| `src/store/useGameStore.ts` | 共通Lv1基礎値、`restoreEnergy()` を使用 |
| `src/components/home/HomeHero.tsx` | 共通EXP進捗でJOB-EXPバーと残りEXPを表示 |
| `src/components/battle/BattleCanvas.tsx` | 勝利、敗北、逃走でMP全回復 |
| `src/components/battle/ResultScreen.tsx` | EXP二重加算を削除 |
| `src/data/master/enemies.json` | Chapter 1敵データを再調整 |
| `src/data/master/stages.json` | ステージEXPを再調整 |
| `docs/DATA_AUTHORING_GUIDE.md` | 敵tier基準を序盤スケールへ更新 |
| `.agents/skills/data-author/references/schemas.md` | データ制作時の序盤帯基準を追加 |

## 11. テスト計画

| 分類 | 確認内容 |
|---|---|
| Unit | Lv2 `10`, Lv3 `22`, Lv4 `36` のEXP閾値 |
| Unit | 累積成長差分が分割レベルアップと一括レベルアップで一致 |
| Unit | 初期武器込み通常攻撃が `grave_soldier` へ `5` ダメージ |
| Unit | ローカル初期残滓が5枠とも未装備で、実戦プロファイルが `HP 34 / ATK 6 / DEF 5` |
| Unit | `restoreEnergy()` が現在MPを最大MPへ戻す |
| E2E | 初回通常攻撃後の追撃ログから、非会心 `5` または会心 `8` ダメージで敵HPが減ったことを確認 |
| E2E | スキルでMPを消費して逃走し、再出撃すると最大MPで開始する |
| Integration | `area1_node1` クリア後のDBレベル、基礎成長、ドロップ保存 |
| Audit | `npm run data:audit` |
| Balance | `npm run balance:progression -- --all --strict` |
| Balance | `npm run balance:report -- --all --strict` |
| Type | `npx tsc --noEmit` |
| Regression | `npm test -- --runInBand` |
| Build | `npm run build` と Vite配布物更新 |
| UI | in-app browser またはPlaywrightでホームMP表記とバトル遷移を確認 |

## 12. 完了条件

1. Lv1剣士の初期武器込み通常攻撃が `grave_soldier` へ `5` ダメージになる。
2. Lv2必要EXPが `10` になる。
3. 隣接ステージの急激なEHP上昇FAILが解消する。
4. ボスの実効HP逆転FAILが解消する。
5. 勝利、敗北、逃走後にMPが最大値へ戻る。
6. ResultScreen表示でEXPが追加加算されない。
7. 逃走や敗北でステージクリア扱いにならない。
8. ローカル初回開始時の残滓装備枠が空で、ホームのJOB-EXP残量が `10` と表示される。
9. Unit、結合、監査、バランス、型検査、ビルドが完了する。
