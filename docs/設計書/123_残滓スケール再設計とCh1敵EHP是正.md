# 123 残滓スケール再設計（BAL-1）と Ch1 敵 EHP 是正（BAL-2）

> ステータス: **数値提案（未実装）** — TECH_DEBT BAL-1 / BAL-2 の是正数値案。適用は「黄泉の階層」実装計画 M0（[`YOMI_実装計画.md`](../progress/YOMI_実装計画.md)）。
> 作成: 2026-07-04 / balance-designer 提案・PM整理
> 関連: [46_バランス調整設計](46_バランス調整設計.md) / [11_深淵の残滓システム](11_深淵の残滓システム.md) / [71_IMP3](71_IMP3_敵ボスバランス手動調整手順.md) / [122_無限ダンジョン設計](122_無限ダンジョン設計.md)

---

## A. BAL-1 残滓オプション実数の再設計

### A-1. 診断: 壊れているのは FLAT 系3種のみ

`RewardService.ts:35-76` の全棚卸しの結果、%系・pp系（ATK%/HP%/DEF%/CRIT_RATE/CRIT_DMG/EFFECT_HIT/EFFECT_RES/SPD%/ELEMENT_DMG_BOOST）は**基礎値比率または無次元加算のためスケール非依存で無傷**。旧スケールの実数が残存しているのは:

- MAIN `head.HP_FLAT` [320,560] / MAIN `arms.ATK_FLAT` [80,140]
- SUB `ATK_FLAT` [10,40] / `HP_FLAT` [50,150] / `DEF_FLAT` [10,40]

**改修対象はコード上わずか5箇所**。

### A-2. 付随する重要発見

1. **残滓Lv強化（Lv1-20）は戦闘力に未接続の幽霊仕様**: `ResidueEnhancement.ts` は exp/level カウンタのみ、`StatSystem.calculateResidueContribution`（:249-262）は `level` を参照しない。doc11 §3 の「Lv+4毎サブ成長・4層RNG」は未実装（doc11 §7 チェックリストでも未チェック）。→ 本再設計は「ドロップ時1回ロール・以後不変」の現行実装を前提とする。**将来Lv成長を実装する際は doc11 §4 の旧テーブルを流用せず本書レンジを基準に再設計すること**（別チケット推奨）
2. **ResidueScore への影響なし**: `scoreOption()` は CRIT_RATE/CRIT_DMG/ATK%/HP% のみ加点（FLAT系はスコア0）のため、グレード表（C/B/A/S/SS）は無改修で妥当性を維持
3. **%系の分母は武器を含まない**: `calculateResidueContribution` の % は素の職業基礎値（Lv50戦士 ATK111）にのみ乗算される（`StatSystem.ts:295-310`）
4. SoulShard 表示経路（`LegionHub.tsx:198`）は動的算出のため改修不要

### A-3. 設計原則

> エンドゲーム（Lv50・SSR ilv90 武器・LEGENDARY 残滓5枠の良ロール）で、残滓5枠合計の ATK 寄与を **武器+基礎 ATK 合計 296（=111+185）の 25〜40%（≈74〜118、中心30%≈89）** とする。

根拠: 武器は doc46 で主力強化ソース（総ATKの62.5%）として確定済み。残滓が武器を喰わず、かつ厳選が武器と並ぶサブシステムとして機能する帯。

### A-4. 新レンジ表（パリティ設計: 同プール内の%型と実数量を一致させる）

| プール | 候補 | 旧 | **新** | 根拠（Lv50戦士: ATK111/HP159/DEF119） |
|---|---|---|---|---|
| MAIN head | HP_FLAT | [320, 560] | **[13, 22]** | HP% [8,14]% × 159 = 12.7〜22.3 |
| MAIN arms | ATK_FLAT | [80, 140] | **[9, 16]** | ATK% [8,14]% × 111 = 8.9〜15.5 |
| SUB | ATK_FLAT | [10, 40] | **[2, 9]** | ATK% [2,8]% × 111 = 2.2〜8.9 |
| SUB | HP_FLAT | [50, 150] | **[3, 13]** | HP% [2,8]% × 159 = 3.2〜12.7 |
| SUB | DEF_FLAT | [10, 40] | **[2, 10]** | DEF% [2,8]% × 119 = 2.4〜9.5 |
| （他の全候補） | %系/pp系 | — | **不変** | スケール非依存 |

検証: ATK特化・良ロールLEGENDARY5枠で ATK寄与 ≈87.3（29.5%）✅ 目標帯中心。理論上限の神引き ≈141（47.7%）は意図的に許容。クリット/属性寄りビルドは8〜15%となりビルド選択に意味が残る。

注記: %系はジョブ自身の基礎値が分母のため低ATK職（mage Lv50 atk=10）ほどFLATの相対恩恵が大きいが、これは武器ATKが既に持つ既存性質と同根で許容。

### A-5. 既存データ移行方針

残滓ドロップは doc93 により chapter>=2 限定 → **Ch1のみ運用中の現在、本番の正規保有者はほぼゼロの見込み**。

1. まず本番 `SELECT count(*) FROM "AbyssalResidue"` で実件数確認
2. 実質ゼロ（QA分のみ）→ **B: 全ワイプ**（追加補償不要。Ch2解放時の初回供給演出 doc93 §6 が自然な代替）
3. 有意な保有者あり → **A: percentile remap**（旧レンジ内相対位置→新レンジ同位置の決定論変換。`AbyssalResidue` は playerState ブロブ外の正規化テーブルのため専用スクリプトが必要）
4. **C: 放置は不採用**（旧スケール保有者だけ永続的に強い経済分裂が固定化）

### A-6. 受入検証

- `RewardService.test.ts` に「ロール値が新レンジ内」の回帰テストを**新規追加**（現状レンジ検証テストは存在しない）
- `ResidueScore` / `StatSystem` / `WeaponSystem` / `ResidueEnhancement` テストが無改修で green であること
- 残滓専用の決定論バリデータ（`residueBalance.ts` 相当）が存在しないギャップあり → 将来新設を推奨（別スコープ）
- 最終値はシミュレータ実測（doc122 §6.5-3）を経て確定

---

## B. BAL-2 Ch1 敵 EHP 逆転の是正

### B-1. 実測: 真の進行順での EHP カーブ

`unlockRequires` 鎖ベースの手動集計（`balance-report.mjs` / `progression-report.mjs` は `(chapter,area,difficulty)` ソートのため**この逆転を構造的に検知できない** — ツールギャップ）:

- 9番目 `area1_c3`: blood_mire_queen EHP 256（実戦234）
- **10番目 `area1_boss`（真ボス）: ossuary_wyrm_lord EHP 169** ← 直前の 0.66〜0.72倍で doc71 違反確定
- 原因推定: Zone C（c1〜c3）挿入時に `unlockRequires` は差し込まれたが、ボスの再アンカーと `difficulty` 更新が漏れた（doc46 ドラフトでは hp180/def25 だった形跡）

### B-2. 是正案（最小変更: ossuary_wyrm_lord 単体の底上げのみ）

`blood_mire_queen` は area2_gate 本ボスとの共有データのため触らない（c3 のエリート差し替えは Ch1 Phase 2 の既計画）。`gravewarden_colossus` も不変。

| フィールド | 現状 | **推奨** | 根拠 |
|---|---|---|---|
| `hp` | 90 | **180** | doc46 ドラフト値へ復元（REVIVE = hp×0.5 も連動改善） |
| `def` | 10 | **24** | doc46 相当。DEF軽減 0.952→0.893 |
| `shieldHp`/`maxShieldHp` | 34 | **50** | HP比例・章ボスの防壁の存在感維持 |

検証: 新EHP = 180+50+90(REVIVE) = **320** → vs blood_mire_queen 実戦234 = **1.37x** ✅（doc71 基準1.2x）/ HP序列 180>150>95 ✅ / ステージ総EHP c3(426)→boss(478) = 1.12x（崖なし）/ ATK 比 1.08x は既存で充足・変更不要。

任意フォローアップ: `necromance.allyStats` の hp/def 追随（captureRate 0.001 のため低優先）/ `area1_boss.difficulty 3→5`・`node3 4→6` の補正 or レポートスクリプトのトポロジカル順ソート化（ツールギャップの恒久対応・battle-engine-dev へ申し送り）。

### B-3. 黄泉の階層アンカーへの波及（doc122 §6.1 の更新値）

是正後テンプレ（hp180/atk14/def24）で再計算:

| 階層 | 旧アンカー | **新アンカー** |
|---|---|---|
| B10 | HP195 / ATK26 / DEF15 | **HP391 / ATK26 / DEF36** |
| B20 | HP463 / ATK51 / DEF23 | **HP925 / ATK51 / DEF55** |

> 注: 上表は丸めた係数同士の掛け算による概算。ランタイム（`EnemyScaling.ts` の `Math.floor(base×factor)` キー毎独立切り捨て）準拠の厳密値は **B10 = HP390/ATK25/DEF35、B20 = HP925/ATK50/DEF55**（±1のズレ）。実装・検証は doc125 §1.3 の厳密テーブルを正とする。

ATK不変・HP/DEF増は「長く殴り合うが一撃で溶けない」の設計意図をむしろ強化する方向。

**併せて doc122 §6.1 の「B20 プレイヤー想定 ATK≈200」は BAL-1 是正後に陳腐化**（旧記述は武器のみの想定と推測される）。BAL-1 新レンジでの試算: Lv13 総ATK≈262 / Lv50 フル厳選≈379。→ **B20 想定は「260〜320（Ch2序盤・残滓部分投資）」へ更新し、フル厳選理論値（〜380+）は B30+ 向け上限として扱う**ことを推奨。最終確定はシミュレータ実測で。

### B-4. 検証手順

```bash
npm run balance:report -- --all          # 新規FAILなし（既存WARN除く）
npm run balance:progression -- --all
npm test -- --testPathPattern="enemyBalance|stageBalance"
npm test -- --runInBand src/logic/BalanceTuning.test.ts src/logic/DungeonSystem.test.ts
npx tsc --noEmit
```

⚠️ 両レポートスクリプトは unlockRequires 順を見ないため、`c3 → boss` の隣接比較は手動集計（B-1 方式）で再確認すること。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-04 | 初版（balance-designer 数値提案。未実装・適用は YOMI 実装計画 M0） |
