# 94 — ストーリー章別JSONレジストリ設計

> 作成日: 2026-06-03  
> 対象: ストーリーJSONの2章以降スケーラビリティ  
> ステータス: 実装対象

---

## 1. 背景

現行のストーリー進行は `src/data/story/ch1_scenes.json` だけを
`src/data/story/index.ts` が直接 import している。
管理画面の `/admin/story` も同じファイル名を直指定しているため、2章以降のJSONを追加すると以下の問題が出る。

- ランタイムへ新しい章ファイルを読み込ませる入口がない。
- 管理画面の保存先が常に `ch1_scenes.json` になり、2章シーンを作成しても第1章ファイルへ混入する。
- `area1_node3` クリア時の `AREA_UNLOCK area2` がコードの個別条件に埋まっており、章/エリア追加ごとに分岐が増える。
- 旧プロローグ/旧章ファイルが残っているが、重複IDを持つため無条件集約できない。

---

## 2. 方針

### 2.1 JSON本文と進行度の責務分離

ストーリー本文は引き続きリポジトリ内のJSONマスターとして扱う。
ユーザーごとの既読状態、フラグ、キューは既存の `useStoryStore` が担当する。

| 領域 | 保存先 | 今回の変更 |
|---|---|---|
| シーン本文 | `src/data/story/*.json` | 章別パック登録方式へ変更 |
| キャラ定義 | `src/data/story/characters.json` | 既存維持 |
| 既読シーン | Zustand persist `necro-story-store-v2` | 既存維持 |
| ストーリーフラグ | Zustand persist `necro-story-store-v2` | 既存維持 |
| サーバーDB永続化 | なし | 今回は追加しない |

現時点では永続化を増やさない。
ローカル/開発用の進行度は `localStorage` で十分であり、オンラインアカウント連携時にだけ
`viewedScenes` と `storyFlags` をDBへ逃がす設計へ拡張する。

### 2.2 StoryPackレジストリ

章ファイルを直接 import する代わりに `StoryPack` を定義する。
ランタイム、テスト、管理画面は同じパック定義を参照する。

```typescript
export interface StoryPack {
  id: string;
  fileName: string;
  label: string;
  archiveChapterRange: readonly [number, number];
  scenes: StoryScene[];
}
```

第1段階では重複IDを避けるため、正式な稼働対象は `ch1_scenes.json` と
仮配置の `ch2_scenes.json` のみとする。
`act1_prologue.json`、`act1_ch1_royal_capital.json`、`prologue_scenes.json` は旧データ扱いで登録しない。

新章を追加するときは以下のように1パック足す。

```typescript
import ch3ScenesData from './ch3_scenes.json';

export const STORY_PACKS = [
  // 既存パック...
  {
    id: 'act1_ch3',
    fileName: 'ch3_scenes.json',
    label: '第3章',
    archiveChapterRange: [3, 3],
    scenes: (ch3ScenesData as { scenes: StoryScene[] }).scenes,
  },
];
```

### 2.3 シーンIDと表示順

- `id` は全パックで一意。
- `sequence` は表示順の主キーとして使うが、同値の場合は `id` で安定ソートする。
- `archiveChapter` はアーカイブ分類と管理画面の保存先判定に使う。
- プロローグは `archiveChapter = 0` として第1章パックへ含める。

### 2.4 AREA_UNLOCKの汎用化

ステージマスターの `unlockRequires` から、あるステージをクリアしたときに新たに開く別エリアを導出する。

```text
クリア済み stageId
  -> stages.json で unlockRequires に stageId を含むステージを検索
  -> クリア元と chapter/area が異なる場合だけ areaId を作る
  -> AREA_UNLOCK のシーンを検索してキューへ積む
```

現行データでは `area1_node3` クリア後に `area2_gate` が解放されるため、
`AREA_UNLOCK area2` の `CH1_AREA2_UNLOCK` が従来通り再生される。
今後 `area2_boss` クリアで `area3_gate` が開く場合も、コード分岐なしで同じ規則に乗る。

---

## 3. 管理画面仕様

### 3.1 一覧

`/admin/story` は登録済みパックすべてのシーンを表示する。
ヘッダーは固定ファイル名ではなく、登録済み章別JSONの合計として表示する。

表示項目:

- 総シーン数
- 登録パック数
- 各パックの `label` / `fileName` / シーン数

### 3.2 保存先

`saveStoryScene(scene)` は以下の順で保存先を決める。

1. 同じ `scene.id` が既存パックにある場合は、そのパックを更新する。
2. `archiveChapter` が別パックの範囲に移った場合は、旧パックから削除して新パックへ移動する。
3. 新規シーンの場合は `archiveChapter` に対応するパックへ追加する。
4. 対応パックがない章番号ならエラーにする。

この方針により、2章JSONが未登録のまま2章シーンを作る事故を防ぐ。

### 3.3 削除

`deleteStoryScene(id)` は登録済みパックを走査し、該当IDがあるファイルからだけ削除する。
見つからない場合は成功扱いにせず、エラーを返す。

---

## 4. 実装対象

| ファイル | 変更内容 |
|---|---|
| `src/data/story/packs.ts` | StoryPack定義、パック一覧、章番号から保存先を解決する関数 |
| `src/data/story/index.ts` | `STORY_PACKS` を集約して検索レジストリを構築 |
| `src/data/story/StoryRegistry.test.ts` | パック登録、ID一意性、AREA_UNLOCK導出の回帰テスト |
| `src/data/story/packs.test.ts` | 章番号からパックを解決する単体テスト |
| `src/app/admin/actions.ts` | Story CRUDを章別パック対応へ変更 |
| `src/app/admin/story/page.tsx` | 固定ファイル名表示をパックサマリーへ変更 |
| `src/app/admin/page.tsx` | ダッシュボード表示を章別JSONへ変更 |

---

## 5. 受け入れ条件

- 第1章の現行17シーンと第2章の仮4シーンが読み込まれる。
- 既存の `getPrologueSceneIds()`、`getStageEnterSceneIds()`、`getStageClearSceneIds()` の戻り値が壊れない。
- `area1_node3` クリア時の `CH1_AREA2_UNLOCK` は、個別の `stageId === 'area1_node3'` なしで再生対象になる。
- 登録済みシーンIDは全パックで重複しない。
- 管理画面は `ch1_scenes.json` 固定表示/固定保存をやめ、パック定義に従う。
- 対応パックがない `archiveChapter` への新規保存はエラーになる。

---

## 6. テスト計画

1. `npm test -- --runTestsByPath src/data/story/StoryRegistry.test.ts src/data/story/packs.test.ts`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`

管理画面のCRUDはServer Action経由でファイルを書き換えるため、今回の自動テストでは保存先解決を純粋関数として検証する。
実ファイル更新は開発画面での操作対象とし、保存前に対応パックがない章番号をエラーにすることで誤書き込みを防ぐ。
