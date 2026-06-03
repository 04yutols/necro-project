# 93 — 深淵の残滓 Chapter 2 開放再設計

作成日: 2026-06-03  
対象: 深淵の残滓の開放タイミング、報酬経済、UIロック、チュートリアル、サーバー永続化

## 1. 背景

深淵の残滓はステータス上昇幅が大きく、序盤の「4〜5ダメージ程度の競り合い」を壊しやすい。現状は第1章ステージや第1章敵のドロップテーブルに残滓が含まれ、ローカル初期プロフィールにも強化済み残滓が所持品として存在するため、プレイヤーが第1章の基礎戦闘・編成・転職を学ぶ前に強いビルド要素へ触れてしまう。

今回の再設計では、深淵の残滓を「第2章以降のビルド拡張」として扱い、第1章は基礎戦闘、軍団編成、職業変更に集中させる。

## 2. 決定事項

| 項目 | 仕様 |
|---|---|
| 開放条件 | `area1_node3` クリア済み |
| 報酬解禁 | ステージ `chapter >= 2` かつ `area1_node3` クリア済み |
| 初回導線 | 第2章到達後、`ABYSSAL_RESIDUE` チュートリアルを起動 |
| 第1章報酬 | 第1章ステージ・第1章敵から `RESIDUE` を削除 |
| 初回供給 | `area2_gate` に `EPIC` 残滓と強化素材を配置 |
| 既存セーブ | 既存DBに残滓があっても未開放なら装備スロット・派生ステータスへ反映しない |
| サーバー防御 | 未開放キャラクターの残滓装備APIは拒否 |

## 3. 共通判定

`src/logic/AbyssalResidueUnlockSystem.ts` を追加し、UI・ストア・サーバー・旧GameManagerが同じ条件を見る。

```ts
isAbyssalResidueUnlocked(clearedStages)
// true: clearedStages に area1_node3 が含まれる

canStageDropAbyssalResidues(stage, clearedStages)
// true: chapter >= 2 かつ isAbyssalResidueUnlocked

getStageDropTableForResidueUnlock(stage, clearedStages)
// 未解放時は RESIDUE / MATERIAL エントリを除外
```

`RewardService.processDropTable()` は従来どおり任意テーブルの抽選に残し、ステージ報酬では `processStageDropTable()` を使う。これにより単体の残滓生成テストや将来の管理ツール用途を壊さず、実プレイ報酬だけを進行で制御する。

## 4. UI設計

### ホーム

未開放時は `LAB` 導線をロック表示にする。

- 表示名: `深淵の残滓`
- サブ表示: `CHAPTER 2で解放`
- クリック時: `LAB` へ遷移しない

開放後は従来どおり `ネクロラボ` として遷移できる。

### LAB直アクセス

古い状態復元や下部ナビから `LAB` へ直接入っても、未開放ならロック画面を表示する。ロック画面には拠点へ戻るボタンと出撃へ進むボタンを置く。

### 装備ハブ

`LegionHub` の右列残滓スロットも同じ判定で制御する。

- 未開放: 5スロットはロック表示、ギア画面を開かない
- 未開放: 既存装備残滓がDBにあっても空スロットとして表示
- 未開放: `calculateCharacterStatProfile()` へ残滓を渡さない
- 開放後: 所持残滓・強化素材・錬成導線を表示

## 5. チュートリアル設計

早期の `NECRO_LAB` フェーズは必須フェーズから外す。第1章のオンボーディングは以下に整理する。

1. `BATTLE_BASICS`
2. `PARTY_FORMATION`
3. `JOB_CHANGE`
4. `ABYSSAL_RESIDUE`（`area1_node3` クリア後）
5. `DEMONIZATION`

`ABYSSAL_RESIDUE` は `requiredTab: LAB` のため、バナーで開放を知らせ、プレイヤーがネクロラボへ入ったタイミングでスポットライトを表示する。

## 6. 報酬設計

第1章は残滓による大幅強化を発生させない。第2章ゲートで初回のビルド拡張として残滓を渡す。

| ステージ | 変更 |
|---|---|
| `area1_node1` | `RESIDUE RARE` を削除 |
| `area1_node2` | `RESIDUE RARE` を削除 |
| `area1_boss` | `RESIDUE EPIC` を削除 |
| `area1_node3` | `RESIDUE EPIC` を削除 |
| `area2_gate` | `RESIDUE EPIC rate 0.6` を維持、`ossuary_memory quantity 2 rate 0.75` を追加 |

第1章敵の `RESIDUE` ドロップも削除する。素材ドロップは将来の敵ドロップ処理拡張に備えて残すが、ステージ報酬処理では未開放時に `MATERIAL` も除外されるため、第2章ゲートから強化素材が初めて入る。

## 7. サーバー・互換性

`loadCharacterForUser()` はDB上の所持残滓を削除しない。ただし、未開放時は `equippedResidueSlots` を5枠 `null` として返し、派生ステータスに残滓を反映させない。

`equipResidueForUser()` は未開放時に以下を返す。

```ts
{ success: false, error: '深淵の残滓は第2章到達後に解放されます' }
```

これにより、既存アカウントのデータを破壊せず、第2章到達までは戦力反映だけを止める。

## 8. テスト計画

| 観点 | テスト |
|---|---|
| 共通判定 | `AbyssalResidueUnlockSystem.test.ts` |
| 報酬フィルタ | `RewardService.processStageDropTable` |
| ローカルストア | 初期残滓なし、未開放装備拒否、開放後強化 |
| サーバー統合 | 1-1では残滓ゼロ、未開放装備拒否、Chapter 2ゲートで残滓入手・装備成功 |
| E2E | 未開放ホームロック、開放後ネクロラボUI表示 |
| 監査 | `npm run data:audit`, `npm run balance:drops` |

## 9. 残課題

残滓強化のサーバー永続化は現状クライアント完結のままである。今回のスコープは開放タイミングと報酬供給の再設計であり、強化結果のDB保存は次のオンライン強化タスクで扱う。
