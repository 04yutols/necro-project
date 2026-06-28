# Ch1 Phase 4 — 物語 設計＆実装計画

策定: 2026-06-28 / ブランチ: `feature/2026062102`
親: [`RELEASE_CH1_設計.md`](./RELEASE_CH1_設計.md) §1-C / [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) 後続 Phase 4
位置づけ: 12ノードの新フローに物語を載せる。C1決定（STORY型なし・`STAGE_ENTER`/`STAGE_CLEAR` トリガー）に従う。

---

## 0. スコープ（Ch1 鉄則・データのみ）
`src/data/story/ch1_scenes.json` への**シーン追加と検証のみ**。エンジン改修なし。

---

## 1. 重要な前提（調査で判明）

### 1-A. 現役レジストリ
`packs.ts` が読むのは **`ch1_scenes.json`（17シーン）と `ch2_scenes.json` だけ**。
`act1_ch1_royal_capital.json` / `act1_prologue.json` / `prologue_scenes.json` は **未ロードの孤児ファイル**（旧版）。→ 編集対象は **`ch1_scenes.json` のみ**。孤児3ファイルは将来削除候補（Phase 4対象外）。

### 1-B. 既存バインドは「ほぼ崩れていない」（再配分はほぼ不要）
既存17シーンは旧IDに紐づくが、**アンカーが narrative 役割を保って再配置された**ため自然に機能する:

| 既存シーン | トリガー | 新フロー位置 | 妥当性 |
|---|---|---|---|
| CH1_OPEN / CH1_NODE1_AFTER | STAGE_ENTER/CLEAR `area1_node1` | 1-1 | ✅ 開幕 |
| CH1_NODE2_ENTER / _AFTER | STAGE_ENTER/CLEAR `area1_node2` | **1-5**（王城ゾーン入口） | ✅ 「煤けた王城地下」と合致 |
| CH1_BOSS_ENTER / _AFTER | STAGE_ENTER/BOSS_CLEAR `area1_boss` | **1-12** | ✅ 章クライマックス |
| CH1_NODE3_* / CH1_CLEAR | STAGE_*/CLEAR `area1_node3` | 残滓ノード（ボス後） | ✅ 章エンディング |
| CH1_TITLE / CH1_SAFE_INTRO | FLAG_SET | 章導入 | ✅ |
| CH1_DEMONIZE_FIRST | DEMONIZE_FIRST（イベント） | 初回魔神化時 | ✅ stage非依存 |

→ **既存シーンの再バインドは原則不要**。空白は**中盤の2箇所**だけ（Zone A 末・Zone B 末）。

---

## 2. 追加する2シーン（`ch1_scenes.json`）

### 2-A. 1-3「死都への入城」 — `CH1_DEADCITY_ENTRY`
- **trigger**: `STAGE_CLEAR` / `area1_a2`（1-2クリア後 → 1-4ミニボスへ向かう導入）
- **type**: DIALOGUE（or MONOLOGUE）、background: 環境系、isSkippable: true、archiveChapter: 1
- **sequence**: CH1_NODE1_AFTER と CH1_NODE2_ENTER の間に収まる値
- **狙い**: 墓道を抜け、亡国の王都の威容（廃墟）を前にする。スケール感と不穏さ。
- **下書き（要推敲）**:
  - narrator: 「墓道を抜けた先に、崩れた尖塔の群れが沈黙して並んでいた。亡国の王都――かつて世界の中心だった場所。」
  - aldo（determined）: 「……ここが、お前の生まれた国か。ライン。」
  - line（sad）: 「『懐かしいって、言えたらよかったのにね』」

### 2-B. 1-8「亡国の真実」 — `CH1_FALLEN_TRUTH`
- **trigger**: `STAGE_CLEAR` / `area1_b3`（1-7クリア後 → 竜骨祭壇ゾーンへ向かう山場）
- **type**: DIALOGUE、background: BLUR_MAP 等、isSkippable: true、archiveChapter: 1
- **sequence**: CH1_NODE2_AFTER と CH1_BOSS_ENTER の間
- **狙い**: 王城を制圧する中で、王都が滅んだ理由＝核心に触れる転換点。竜骨祭壇（ボス）への動機づけ。
- **下書き（要推敲）**:
  - line（dying or sad）: 「『この国を壊したのは……魔族じゃない。私たちが、選んだの』」
  - aldo（shocked → determined）: 「……どういう意味だ。最後まで聞かせろ、ライン。」
  - narrator: 「祭壇の方角で、竜骨が低く鳴いた。」

> 話者/表情は characters.json 準拠（aldo: determined/sad/angry/shocked/smile、line: default/smile/sad/dying、demon_king: contempt/rage、narrator）。

---

## 3. スキーマ（既存シーン準拠・必須フィールド）
各シーン: `id` / `type`(DIALOGUE等) / `sequence` / `trigger`{type, stageId} / `background` / `isSkippable` / `archiveTitle` / `archiveChapter` / `lines[]`{speaker, speakerJa, text, textEn, portraits[{characterId, position(LEFT/CENTER/RIGHT), expression}]}。

---

## 4. テスト / 関所
- **storyValidator**: 2新シーンが PASS（trigger.stageId が stages.json 実在＝`area1_a2`/`area1_b3` OK、speaker/expression が characters.json 実在、type別必須=lines あり、id 一意）。
- `npm run validate-master` 相当 / `/admin/audit` FAIL=0。
- `npx tsc --noEmit` / jest 非破壊（StoryRegistry.test 等）／**テストが master を mutate しない**。
- 実機: 1-2クリアで死都入城、1-7クリアで真実、章を通して物語が新フロー順（1-1開幕→…→1-12ボス→残滓エンディング）で破綻なく流れる。

---

## 5. 留意点
- **再配分は最小**（§1-B）。既存シーンの text を新フロー前提で読み直し、明らかな齟齬（例: NODE2 のセリフが旧「2番目の戦い」前提なら微修正）だけ直す。大規模な再バインドはしない。
- **新フローのストーリー間隔**: 物語ビートは 1-1 / (1-3) / 1-5 / (1-8) / 1-12 / 残滓。2〜3ノードに1回で stage-clear ソシャゲのテンポに合う。
- 孤児 story ファイル3本は本フェーズでは触らない（混乱回避のため将来別途削除）。
- DEMONIZE_FIRST は 1-4 で魔神化解放後の初回発火＝チュート前倒し（Phase 3）と自然に整合。
