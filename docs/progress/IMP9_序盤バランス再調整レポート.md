# IMP-9 序盤バランス再調整レポート

> 実施日: 2026-05-31  
> 設計: `docs/設計書/81_IMP9_序盤バランスと戦闘後MP全回復再設計.md`

## 1. 実施概要

Lv1基礎ステータス、職業EXP、レベルアップ時の基礎成長、Chapter 1敵データ、ステージEXPを同じ序盤スケールで再調整した。

あわせて、戦闘終了時にMPを最大値へ戻す処理、ローカル勝利時のEXP二重加算、逃走や敗北でもステージクリア扱いになる共通終了処理を修正した。

Viteローカルモックは強化済み残滓を所持したまま、5枠すべて未装備で開始するようにした。これにより、初回戦闘は残滓の大幅な固定値加算を受けず、設計した小さい数値帯で進行する。ホームの `JOB-EXP` も共通EXP進捗関数へ接続した。

## 2. プレイヤー初期値

| stat | 調整前 | 調整後 |
|---|---:|---:|
| HP | 60 | 30 |
| ATK | 8 | 4 |
| DEF | 10 | 4 |

剣士補正と初期武器を含む実戦値:

| stat | 調整前 | 調整後 |
|---|---:|---:|
| HP | 68 | 34 |
| ATK | 11 | 6 |
| DEF | 12 | 5 |
| `grave_soldier` への通常攻撃 | 10 damage | 5 damage |

調整後の値は、初期武器 `bone_cleaver` を装備し、強化済み残滓を未装備とした初回プレイ時の実戦プロファイルである。残滓データ自体は装備、強化画面の確認用にインベントリへ残している。

## 3. EXPと成長

累積職業EXP式を次へ変更した。

```text
expForLevel(level) = (level - 1) * (level + 8)
```

| Level | 調整前累積EXP | 調整後累積EXP |
|---:|---:|---:|
| 2 | 500 | 10 |
| 3 | 1100 | 22 |
| 4 | 1800 | 36 |
| 5 | 2600 | 52 |

レベルアップ時の基礎成長は、`HP 40 / ATK 6 / DEF 4` から `HP 3 / ATK 0.5 / DEF 0.4` を基準とする累積差分方式へ変更した。

累積差分方式により、分割レベルアップと一括レベルアップで永続基礎値が一致する。

ホームの `JOB-EXP` は固定値計算を廃止し、`getJobLevelProgress()` の値を表示するようにした。Lv1開始時は `あと 10` と表示される。

## 4. 敵とステージ導線

### 4.1 ステージ実効HP

| stage | 調整前EHP | 調整後EHP | 前ステージ比 |
|---|---:|---:|---:|
| `area1_node1` | 137 | 142 | - |
| `area1_node2` | 1570 | 322 | 2.27x |
| `area1_boss` | 1353 | 357 | 1.11x |
| `area1_node3` | 2692 | 404 | 1.13x |
| `area2_gate` | 3002 | 369 | 0.91x |

調整前は `area1_node1 → area1_node2` がEHP `11.46x`、最大WAVE脅威度 `13.30x` だった。調整後はEHP `2.27x`、最大WAVE脅威度 `1.00x` となった。

### 4.2 ステージEXP

| stage | 調整前 | 調整後 |
|---|---:|---:|
| `area1_node1` | 620 | 12 |
| `area1_node2` | 780 | 16 |
| `area1_boss` | 1320 | 24 |
| `area1_node3` | 1560 | 30 |
| `area2_gate` | 1880 | 38 |

Goldは武器強化、残滓強化、初期所持金を含む経済設計全体と一緒に扱う必要があるため、今回のスコープでは変更していない。

## 5. MPと終了処理

`useGameStore.restoreEnergy()` を追加し、次の終了経路から呼び出すようにした。

| 終了経路 | MP |
|---|---|
| 勝利 | 最大値へ回復 |
| 勝利報酬フォールバック | 最大値へ回復 |
| 敗北 | 最大値へ回復 |
| 逃走 | 最大値へ回復 |

`ResultScreen` のマウント時EXP加算を削除し、勝利報酬のストア反映を `BattleCanvas` に一本化した。

`src/app/page.tsx` の共通 `onEnd` から無条件の `addClearedStage()` を削除し、勝利時だけクリアフラグが追加されるようにした。

## 6. 検証結果

| command | result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test -- --runInBand` | PASS: 37 suites / 238 tests |
| `npm run balance:progression -- --all --strict` | PASS: progression cliff warning 0 |
| `npm run balance:report -- --all --strict` | PASS: FAIL 0 / WARN 1 |
| `npm run data:audit` | PASS: FAIL 0 / WARN 1 |
| `npm run build` | PASS |
| `npx vite build` | PASS |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4173 npx playwright test tests/active-skills.spec.ts` | PASS: 5 tests |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4173 npx playwright test tests/result-screen.spec.ts` | PASS: 1 test |

追加したE2Eでは、スキル使用で `MP 100 → 95`、逃走、WORLD MAP復帰、再侵攻、`MP 100` 開始までを確認した。

同じモバイルE2Eで、初回通常攻撃後の追撃ログから、非会心時は `grave_soldier` のHPが `15 → 10`、会心時は `15 → 7` になることも確認した。ホーム画面はPlaywrightスクリーンショットで `HP 34 / 34`, `MP 100 / 100`, `JOB-EXP あと 10` を目視確認した。

## 7. 残存警告

| source | warning | 判断 |
|---|---|---|
| `balance:report` | `area1_boss` の単体ボスWAVE脅威度が直前の精鋭2体WAVE比 `0.83x` | ボスは防壁、HP50%怒り、復活、AV遅延を持つため許容。単純ATKの過剰上昇を避ける |
| `data:audit` | `grave_knight` は `ELITE` だが `shieldHp` を持たない | 防壁チュートリアル後に置く防壁なし騎士長として意図どおり |

Vite配布ビルドでは既存の `node:crypto` ブラウザ外部化、Prismaブラウザ依存の外部化、500kB超chunk警告が残る。今回のバランス変更に起因するビルド失敗はない。

## 8. 次回候補

Gold、初期所持金、武器強化費用、残滓強化費用は現状の大きな数値帯を維持している。序盤戦闘スケールに合わせた経済再設計は、別タスクとしてまとめて行う。
