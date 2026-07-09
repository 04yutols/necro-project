# IMP-13 ストーリー章別JSONレジストリ実装レポート

> 実施日: 2026-06-03  
> 対象設計: `docs/設計書/94_ストーリー章別JSONレジストリ設計.md`

---

## 1. 目的

2章以降のストーリーJSON追加に備えて、ストーリー本文の読み込みと管理画面の保存先を
`ch1_scenes.json` 固定から章別パック方式へ変更した。

進行度の永続化は既存の `useStoryStore` のまま維持し、今回の対象は本文JSONのスケール設計に限定した。

---

## 2. 実装内容

### 2.1 StoryPackレジストリ

- `src/data/story/packs.ts` を追加した。
- `StoryPack` と `StoryPackSummary` を定義した。
- 現時点の正式稼働パックとして `ch1_scenes.json` と仮配置の `ch2_scenes.json` を登録した。
- `archiveChapter` から保存先パックを解決する関数を追加した。
- 旧分割JSONは重複IDを持つため、今回の正式レジストリには含めていない。

### 2.2 ランタイムレジストリ

- `src/data/story/index.ts` が `STORY_PACKS` を集約して `STORY_SCENES` を構築するように変更した。
- シーンID重複を検出した場合はレジストリ構築時にエラーを出す。
- プロローグIDは `GAME_START` トリガーから取得するようにした。
- `area1_node3` 固定分岐を削除し、`stages.json` の `unlockRequires` から `AREA_UNLOCK` を導出するようにした。

### 2.3 管理画面

- `getStoryScenes()` は登録済みパック全体を読み込むように変更した。
- `saveStoryScene()` は既存IDの所在と `archiveChapter` の対応パックから保存先を決めるようにした。
- `archiveChapter` が別パックへ移った場合は旧ファイルから削除して新ファイルへ移動する。
- 対応パックがない章番号はエラーにし、誤って第1章JSONへ混入しないようにした。
- `/admin/story` と `/admin` の表示を固定ファイル名から章別JSONパック表示へ変更した。

---

## 3. 検証結果

| コマンド | 結果 |
|---|---|
| `npm test -- --runTestsByPath src/data/story/StoryRegistry.test.ts src/data/story/packs.test.ts` | PASS: 2 suites / 10 tests |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS: 39 suites / 257 tests |
| `npm run build` | PASS |

---

## 4. 残る運用ルール

- 第3章以降のJSONを追加するときは `src/data/story/packs.ts` に新しい `StoryPack` を登録する。
- 新章ファイルを登録する前に、その章のシーンを管理画面から保存しようとするとエラーになる。
- `id` は全章で一意にする。
- 旧分割JSONを再利用する場合は、重複IDを解消してから正式パックへ登録する。
