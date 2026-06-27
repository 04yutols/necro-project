# 第1章 ステージ拡張リデザイン仕様

策定日: 2026-06-27 / ブランチ: `feature/2026062102`
ステータス: **設計確定・未着手**（実装はフェーズ制で別途）

---

## 0. 決定事項（スコープ変更）

第1章「亡国の王都」を **5ステージ（実質: 戦闘3＋ボス1＋野営1）** から
**標準ソシャゲ章（1-1〜1-12形式 ~12ノード）** へ拡張する。

- **動機1**: 章としてのボリュームが薄い。stage-clear 型ソシャゲ（短い戦闘ノードを多めに並べ、合間に物語と機能解放を挟む構造）を手本にする。
- **動機2**: チュートリアルの詰まり解消。現状 `編成/装備/転職/強化/魔神化/残滓` の **6システムが 4クリアイベント** に押し込まれ、node2クリアで2連発・bossクリアで2連発になっている。ノードを増やせば 1ノード1チュート に分散でき、さらに魔神化を中盤に前倒しできる。
- **許容するコスト**: 単章リリースの後ろ倒し。バランス・マップ・ストーリーの面積増。
- **据え置き（拡張対象外）**: area2〜・UR・Tier2魔神化・打ち直し・錬成ポイント。拡張は **area1 内のノード増のみ**。

> メモリ `project_chapter1_scope.md` を本決定で更新済み（当初の「5ステージ＝MVP」を上書き）。

---

## 1. 章ブループリント（表示 1-1〜1-12）

全ノード `chapter:1 / area:1`（参照先エリア `ch1_area1` は既存）。
**既存4ノード（area1_node1 / area1_node2 / area1_boss / area1_node3）は stage ID を維持**し、新フローに再配置する（セーブ・チュートリアルトリガー・残滓解放システムへの破壊を最小化）。

| 表示 | 内部ID(案) | ゾーン / 名前 | nodeType | 敵構成 | 既存/新 |
|---|---|---|---|---|---|
| 1-1 | `area1_node1` | A 城下の墓道 | DUNGEON | grave_soldier, rot_hound | 既存 |
| 1-2 | `area1_a2` | A | DUNGEON | +hollow_handmaid（スケール再構成） | 新(再戦闘) |
| 1-3 | （物語）| A 死都への入城 | ※§6-G3要決定 | — | 新(物語) |
| 1-4 | `area1_a_mini` | A | DUNGEON(ELITE wave) | 墓守の巨像（新ミニボス） | 新 |
| 1-5 | `area1_node2` | B 煤けた王城 | DUNGEON | hollow_handmaid, earthbound_grudge, bone_colossus | 既存 |
| 1-6 | `area1_b2` | B | DUNGEON | abyss_warden（スケール再構成） | 新(再戦闘) |
| 1-7 | `area1_b3` | B | DUNGEON | +彷徨う近衛霊（新ザコ） | 新 |
| 1-8 | （物語）| B 亡国の真実（山場） | ※§6-G3要決定 | — | 新(物語) |
| 1-9 | `area1_c1` | C 竜骨の祭壇 | DUNGEON | bone_colossus, 竜骨の眷属（新） | 新 |
| 1-10 | `area1_c2` | C | DUNGEON(ELITE wave) | 呪詛の女官長（新エリート） | 新 |
| 1-11 | `area1_c3`（新ID） | C | DUNGEON(ELITE wave) | blood_mire_queen（既存・配置） | 新 |
| 1-12 | `area1_boss` | C | BOSS | ossuary_wyrm_lord（既存ボス） | 既存 |
| 残滓 | `area1_node3`（据え置き） | 血泥の渡し | DUNGEON | bloodmire_leech | 既存 |

> **【実装計画 C2 で確定】** `area1_node3` は **ボス直後の残滓ノードのまま据え置く**（`unlockRequires=[area1_boss]` は既存のまま）。
> これにより `AbyssalResidueUnlockSystem.ts`（`area1_node3` 参照）に触れずに済む。1-11 エリートには新ID `area1_c3` を割り当てる。
> 当初の「node3 を 1-11 へ再配置」案は撤回。→ 詳細・結線表は [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) B2。

### サブゾーン
- **Zone A 城下の墓道**: 1-1 〜 1-4（ミニボスで締め）
- **Zone B 煤けた王城**: 1-5 〜 1-8（物語山場で締め）
- **Zone C 竜骨の祭壇**: 1-9 〜 1-12（章ボス）

---

## 2. 新規制作アセット

### 新規敵（4体＋ミニボス＝5体）
| ID(案) | 名前 | 役割 | 配置 | 制作元 |
|---|---|---|---|---|
| `gravewarden_colossus` | 墓守の巨像 | ミニボス | 1-4 | 新規 or bone_colossus強化派生 |
| `wandering_guard_wraith` | 彷徨う近衛霊 | ザコ（王城） | 1-7, 1-9 | 新規 |
| `cursed_head_maid` | 呪詛の女官長 | エリート（術師） | 1-10 | hollow_handmaid 上位 |
| `dragonbone_spawn` | 竜骨の眷属 | ザコ（祭壇） | 1-9, 1-11 | 新規 |

> 既存10体（grave_soldier / rot_hound / hollow_handmaid / abyss_warden / earthbound_grudge /
> bone_colossus / ossuary_wyrm_lord / bloodmire_leech / blood_mire_queen / +1）は
> **WAVE再構成＋ステータススケール（docs/設計書46 曲線）** で再戦闘ノードの背骨にする。

### 物語ノード（2＋導入/締め）
- 1-3「死都への入城」/ 1-8「亡国の真実」
- 既存 PROLOGUE 4シーン + CH1 13シーンを各ノードに再配分
- ※物語ノードを stage 化するか否かは §6-G3 で決定

### マップ
- `AreaMap` / `MapCanvas`（PixiJS）を 3ゾーン・12ノードに改修。各ノード `position.x/y` 設計が必要。

---

## 3. チュートリアル再配置（拡張の副産物）

スタッキング完全解消＋**魔神化を中盤に前倒し**（最終ボス後だと使い所が無い問題を解決）。

| 発火 | フェーズ | 形態 |
|---|---|---|
| 1-1 戦闘開始 | `BATTLE_BASICS` | 強制スポットライト |
| 1-1 クリア | `PARTY_FORMATION`（編成） | 強制スポットライト |
| 1-2 クリア | `WEAPON_EQUIP`（武器＝装備統合） | 強制スポットライト |
| **1-4 ミニボスクリア** | `DEMONIZATION`（魔神化）★前倒し | バナー＋次戦闘でスポットライト |
| JOBタブ初訪問 | `JOB_CHANGE`（転職） | **BubbleHint 格下げ** |
| EQUIP強化タブ初訪問 | `WEAPON_ENHANCE`（強化） | **BubbleHint 格下げ** |
| 残滓ノードクリア | `ABYSSAL_RESIDUE`（残滓） | 強制スポットライト |

- `WEAPON_EQUIP` と `WEAPON_ENHANCE` は同一画面（LegionHub EQUIP）。装備を強制1本に統合し、強化は吹き出し。
- 実装は `src/data/tutorial/triggers.ts` / `phases.ts` / `BubbleHint` 配線（コード側＝管理画面外）。

---

## 4. 管理画面パイプライン活用（本章拡張の進め方）

この章拡張は **生JSONの手編集ではなく、管理画面の検証付きパイプラインを通して** 行う。
理由: 各ドメインの決定論ゲート（`*Balance.ts`）が参照整合・列挙・報酬レンジを保存時に機械チェックするため、
broken ref を作り込む前に弾ける。

| 管理画面機能 | 実体 | 本章での使い所 |
|---|---|---|
| ステージ CRUD ＋ `validateStageDraft` | `src/lib/agent/stageBalance.ts` | 12ノード作成時、`enemyIds→enemies` `unlockRequires→stages` `dropTable.itemId→items/materials` `area→areas` の参照整合とWAVE role/報酬レンジを保存時チェック |
| 敵 CRUD ＋ `enemyBalance` | `src/lib/agent/enemyBalance.ts` | 新規敵5体のステータス/耐性/スキル参照を検証 |
| `enemyAgent` / `stageAgent`（Gemini草稿） | `src/lib/agent/*Agent.ts` | 新規敵・WAVE構成の叩き台生成 → 決定論ゲートで検証 |
| **`getDependencies`（逆参照）** | `actions.ts:669` | 既存ノード再配置の事故防止。例: blood_mire_queen を node3→1-11 へ動かす前に「node3 / blood_mire_queen を誰が参照しているか」を確認 |
| **`/admin/audit`（横断監査）** | `runMasterDataAudit` | 各フェーズ完了時の最終ゲート。**FAIL=0** を満たすまでマージしない |
| simulator | `src/app/admin/simulator` + `sim/` | 各戦闘ノードの難易度カーブ評価（過殺し/手応え不足の検出） |

---

## 5. 正しさチェック / 検証ゲート

### 既存ゲートで担保されること（そのまま使う）
- ステージの参照整合（敵・解放条件・ドロップ・エリア）→ `stageBalance` + `/admin/audit`
- 敵・武器・スキル等の構造/列挙/バランス → 各 `*Balance.ts`
- 報酬レンジの既存からの逸脱 WARN → `deriveRewardBands`

### 本章拡張で **不足しており、追加を検討すべき** チェック（管理画面拡張案）
- **G1: 解放チェーンの到達可能性／循環検査** — 12ノードの `unlockRequires` グラフで「スタートから全ノードが到達可能か」「循環が無いか」「孤立ノードが無いか」を検査。現状の audit は参照存在チェックのみで、グラフ健全性は見ていない。**多ノード章の肝**。
- **G2: コード↔マスターの stage ID 相互参照チェック** — `triggers.ts`（チュートリアル発火）と `AbyssalResidueUnlockSystem.ts`（残滓解放 = `area1_node3`）がコード内で stage ID を直接参照している。これらが stages.json に存在するかを検査するゲートが無い。**再スロット時の破壊を防ぐため必須級**。
- **G3: 物語ノードの扱い** — `VALID_NODE_TYPES` は `SAFE / DUNGEON / BOSS` のみで **STORY ノード型が無い**。1-3 / 1-8 を (a) stage 化するなら `STORY` nodeType を validator/エンジンに追加、(b) stage 化しないならステージ間の story 発火（story registry）で処理。**要設計判断**。
- **G4: 章コックピット view（任意）** — 章全体を順序付きで一覧し、各ノードの WAVE/報酬/チュート/物語と赤フラグを1画面で見る管理ビュー。`getDependencies` を順方向にも使えば半分実現できる。あると12ノードの全体把握が劇的に楽になる。

---

## 6. 段階的ビルド順（常に通しプレイ可能を維持）

各フェーズは独立してマージ可能。途中状態でも章が最後まで遊べることを保証する。

- **Phase 1 ── 背骨（低コスト・ほぼJSON）**
  - `/admin/stages/new` で新ノード（1-2/1-4/1-6/1-7/1-9/1-10）を作成。既存敵の WAVE 再構成＋スケール。
  - `unlockRequires` を 1-1→…→1-12 のリニアチェーンで結線。既存4ノードはID維持で再配置。
  - 関所: `validateStageDraft` 各ノード PASS → `/admin/audit` **FAIL=0**（特に G1 のチェーン整合を手検証）。
- **Phase 2 ── 新規敵**
  - `/admin/enemies/new`（または `enemyAgent` 草稿）で5体定義 → `enemyBalance` 通過 → 該当 WAVE に差し込み → `stageBalance` 再チェック。
  - 関所: `balance-designer` / simulator で docs/46 曲線に乗っているか確認。
- **Phase 3 ── チュート再配線（コード側）**
  - `triggers.ts` / `phases.ts` を新ノードID対応・`DEMONIZATION` を 1-4 に前倒し・`JOB_CHANGE`/`WEAPON_ENHANCE` を BubbleHint 化・`WEAPON_EQUIP` に統合。
  - 関所: `useTutorialTrigger.test.ts` / `useTutorialStore.test.ts` 更新＋ G2 チェック。
- **Phase 4 ── 物語**
  - §6-G3 の判断に従い 1-3 / 1-8 ＋章導入・締めを `/admin/story` で作成 → `storyValidator`。
- **Phase 5 ── 最終監査**
  - `/admin/audit` FAIL=0、simulator 全ノード、`npx tsc --noEmit`、`npm test`、Playwright。

---

## 7. 未解決の設計判断

> 実装は [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) の **マイルストーン C** で確定する。
> C1（物語ノード）/ C2（残滓ノード据え置き）/ C3（ノード数）/ C4（難易度スケール方式）に推奨案あり。要ユーザー承認。

1. **G3: 物語ノードを stage にするか**（→ 計画 C1） — `STORY` nodeType 追加 vs story registry でのステージ間発火。**推奨: 後者（STORY型を足さない）**。
2. **残滓ノード**（→ 計画 C2） — `area1_node3` を据え置き、`AbyssalResidueUnlockSystem` は不変。**確定済み方針**。
3. **ノード数の最終確定**（→ 計画 C3） — 戦闘10＋物語2。重ければ戦闘8へ縮小可。
4. **難易度スケール方式**（→ 計画 C4・A着手調査で判明） — 敵ステータス固定でスケール機構が無い。**推奨: per-wave `enemyStatScale` 追加**。
5. **新規敵コンセプト** — §2 の名前・役割は仮。確定後に `enemyAgent` 草稿へ（後続 Phase 2）。
6. **ch2 解放条件への波及** — `ch2_area2` は「前章全ノード制圧後」に解放。ノード追加で「全クリア」集合が変わるため、章完了判定がノード一覧から動的に計算されているかを確認（ハードコードなら更新）。
