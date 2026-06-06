# IMP-14 エリアマップ管理とステージ反映レポート

> 実施日: 2026-06-05  
> 対象設計: `docs/設計書/95_エリアマップ管理とステージ反映設計.md`

---

## 1. 調査結果

ステージは `/admin/stages` から追加・編集でき、`stages.json` に保存される。
プレイ画面も `stages.json` を読んでいるため、ステージ追加自体は表示経路に乗っていた。

一方で、エリアは独立した管理対象ではなかった。
エリア名、説明、色、ワールド上の座標は `AreaMap.tsx` に固定され、エリア識別も `area` 数値だけだったため、
第1章Area1と第2章Area1が混ざるリスクがあった。

---

## 2. 実装内容

### 2.1 エリアマスター

- `src/data/master/areas.json` を追加した。
- `AreaData` 型を追加した。
- 既存の第1章「亡国の王都」と第2章「幽霊都市」をエリアマスターへ移した。

### 2.2 プレイ画面

- `src/logic/WorldMapSystem.ts` を追加した。
- `chapter + area` の複合キーでワールドエリアを構築するようにした。
- `AreaMap.tsx` は `areas.json + stages.json` からワールドマップとエリアマップを構築するようにした。
- `area` 数値だけで選択状態を持つ実装をやめ、エリアIDで状態管理するようにした。

### 2.3 管理画面

- `/admin/areas` を追加した。
- `/admin/areas/new` と `/admin/areas/[id]` を追加した。
- エリアの章番号、エリア番号、名称、説明、色、ワールド座標、表示順を編集できるようにした。
- ダッシュボード、ナビ、監査リンク、依存関係表示に `areas` を追加した。
- `StageForm` の `areaGimmick` 選択肢を現行仕様へ修正した。

### 2.4 監査

- 管理画面監査に `areas.json` の形式チェックを追加した。
- ステージの `chapter + area` に対応するエリアが存在するかをチェックするようにした。
- CLI監査 `npm run data:audit` にも `areas` を追加した。

---

## 3. 検証結果

| コマンド | 結果 |
|---|---|
| `npm test -- --runTestsByPath src/logic/WorldMapSystem.test.ts src/logic/DungeonSystem.test.ts src/services/MasterDataService.test.ts` | PASS: 3 suites / 12 tests |
| `npx tsc --noEmit` | PASS |
| `npm run data:audit` | PASS: 0 fail / 1 existing warn |
| `npm test` | PASS: 40 suites / 263 tests |
| `npm run build` | PASS |

`npm run data:audit` の警告は既存の `enemies/grave_knight: ELITE has no shieldHp` のみ。
今回追加した `areas.json` とステージ参照にはFAILなし。

---

## 4. 運用ルール

- エリアを追加する場合は `/admin/areas/new` で `areas.json` に追加する。
- ステージを追加する場合は `/admin/stages/new` で同じ `chapter` / `area` を指定する。
- プレイ画面は `areas.json` と `stages.json` を読み、章+エリア単位でワールドノードを構築する。
- エリアだけ追加した場合もワールド上には表示されるが、ステージが0件なら未解放扱いになる。
