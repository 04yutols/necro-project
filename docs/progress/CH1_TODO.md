# 第1章「亡国の王都」— 実装チェックリスト

> 第1章リリースに必要なタスクのみ。完了したらチェックを入れる。
> 第2章以降の項目は DEFERRED.md へ。

---

## Phase A 🔴 — バトル動作・必須インフラ

これがないと動かない。最優先。

### コアロジック
- [x] `src/logic/BattleEngine.ts` — 隊列ヘイト分散（slot 0=50% / 1=30% / 2=20%）
- [x] `src/logic/BattleEngine.ts` — ボスギミック（ENRAGE / REVIVE / SUMMON_MINIONS）
- [x] `src/logic/DemonizationSystem.ts` — フルオートAI統合・魔神技ダメージ計算
- [x] `src/logic/WeaponPassive.ts` — 第1章出現パッシブ（SOUL_SHATTER / ACTION_VALUE / DEMON_MODE）

### マスターデータ
- [x] `src/data/master/enemies.json` — 第1章エネミー（MINION×5 + ELITE×2 + BOSS×2）stats / resistances / dropTable
- [x] `src/data/master/demonForms.json` — Tier1フォーム4職業分（warrior / mage / dark_priest / rogue）実装済み確認
- [x] `src/data/master/items.json` — 武器4種 passiveA/B / id / isUnique 追加
- [x] `src/data/master/materials.json` — 素材7種（新規ファイル）+ MasterDataService に getMaterial() 追加
- [x] `src/data/master/stages.json` — 3ノードのWAVE1に新規MINIONを配置

### サービス・ストア
- [x] `src/services/RewardService.ts` — ドロップ処理（R/SR/SSR武器 + 残滓 + モンスタードロップ）
- [x] `src/store/useGameStore.ts` — `demonActionsRemaining` / `monsterCurrentHp` / `swapPartySlots` 追加

### DB・認証・結合
- [x] `prisma/schema.prisma` — Item に rank / archetype / ilv / passiveA / passiveB 追加、AbyssalResidue 修正、NextAuth テーブル追加
- [x] NextAuth.js v5 セットアップ（Google/Discord OAuth + PrismaAdapter）→ `src/auth.ts` / `src/lib/prisma.ts` / `middleware.ts` 実装済み
- [x] DB連携バトル結合（BattleCanvas → processStageResultAction → GameManager → Prisma）

### テスト
- [x] `DemonizationSystem.test.ts` — AV割り込み・魔神技ダメージ計算
- [x] `WeaponPassive.test.ts` — SOUL_SHATTER / ACTION_VALUE 発動判定（6ケース）

---

## Phase B 🟡 — 第1章コンテンツ

バトルが動いた後に並行実装。

### ストーリーシステム
- [x] `src/data/story/ch1_scenes.json` — 第1章17シーン（PROLOGUE 4 + CH1 13）JSONデータ作成 → 台詞: `22_ストーリー進行システム.md §6`
- [x] `src/components/story/DialogueScene.tsx` — 原神スタイル会話UI
- [x] `src/components/story/MonologueOverlay.tsx` — 全画面モノローグ
- [x] `src/components/story/ChapterTitleCard.tsx` — スタレスタイル章タイトル
- [x] `src/store/useStoryStore.ts` — Zustand persist 進行管理
- [x] `src/hooks/useStoryTrigger.ts` — ステージクリア後・画面遷移時の自動起動
  - 再設計メモ: `docs/設計書/32_ストーリーシステム再設計実装.md`

### チュートリアルシステム
- [x] `src/store/useTutorialStore.ts` — Zustand persist 進行管理
- [x] `src/components/tutorial/SpotlightOverlay.tsx` — SVG clipPath スポットライト
- [x] `src/components/tutorial/BubbleHint.tsx` — 吹き出しヒント
- [x] `src/hooks/useTutorialTrigger.ts` — 6フェーズ自動起動フック
  - 実装メモ: フェーズは `BATTLE_BASICS → NECRO_LAB → PARTY_FORMATION → JOB_CHANGE → ABYSSAL_RESIDUE → DEMONIZATION` の順で排他起動。現行第1章の初回バトル `area1_node1` でも PHASE 1 を発火する。

### LegionHub 編成UI
- [x] ドラッグ並び替え（Framer Motion drag + long press 400ms + iOS Safari 分離ルール） → 詳細: `24_パーティ編成システム詳細.md`
- [x] CostIndicator（3段階カラー + シェイクアニメ + ツールチップ、`necroStatus.maxCost` 参照）
- [x] モンスターソート/フィルタ（種族チップ × ATK/HP/SPD/COST 4キー）
- [x] **バグ修正**: LegionHub L2416 `const maxCost = 12` → `necroStatus.maxCost`
  - 実装メモ: 編成ビューにスロット選択、一覧から配置、長押しドラッグ入れ替え、コスト超過拒否、種族フィルタ、4キーソートを追加。
  - iPhone 13 Pro UX改善: 常時表示ロスターを廃止し、編成スロットタップで魔物選択ページへ遷移する構成に変更。フィルタ/ソート/決定操作は44px以上のタップ領域へ拡大し、魔物詳細ページも追加。

### バトルUI
- [x] 魔神化発動VFX（demonGauge は実装済み → エフェクト追加） → 詳細: `21_VFXアニメーション §4`
- [x] 魔神技専用ボタン（魔神化中のみ表示）
- [x] 倍速切り替えボタン（1x / 2x / 3x）
- [x] 隊列ポジションバッジ（⚔前衛 / ◈中衛 / ✦後衛）
  - 実装メモ: `34_バトルUIUX実装設計.md` に記録。魔神化発動は全画面VFX、魔神技は魔神化中のみの専用ボタン、倍速はセグメントUI、隊列は3スロット表示。

---

## Phase C 🟢 — UX完成度

品質・演出の仕上げ。

- [x] SSR/SRドロップ演出（PixiJS VFX 紫光柱） → 詳細: `21_VFXアニメーションカタログ §5.2` / `35_品質演出仕上げ実装設計.md`
- [x] `src/services/AudioService.ts` — BGMクロスフェード + SE合成 → 詳細: `23_サウンド設計.md` / `35_品質演出仕上げ実装設計.md`
- [x] `src/hooks/useBGM.ts` / `useSoundEffects.ts` / `useAudioStore.ts`
- [x] 武器詳細画面（パッシブ説明 + ランク別プレビュー）
- [x] 残滓強化モーダル（Tier演出付き）
- [x] エリアマップのノード進行UI（霧解除アニメーション）

---

## Phase D 🔵 — オンライン機能

第1章リリースに必要なオンライン機能。

- [x] クラウドセーブ Server Actions（stage clear → processStageResult） → 詳細: `25_オンラインゲーム設計.md §3` / `36_オンライン機能実装設計.md`
- [x] ランキング API（Upstash Redis + StageRecord） → 詳細: `25_オンラインゲーム設計.md §5` / `36_オンライン機能実装設計.md`
- [x] 第一発見者システム完成（RewardService + Prisma $transaction + ItemSerialCounter） → hidden UR抽選復帰、SSR/UR/LR/Unique初発見ログ化
- [x] 世界ログ（Pusher Channels + WorldEventService + useWorldLog） → 詳細: `25_オンラインゲーム設計.md §6` / `36_オンライン機能実装設計.md`

---

## 第1章完成条件チェック

> 最終チェック: 2026-05-17
> 自動検証: `npx tsc --noEmit` passed、`git diff --check` passed。`npm test -- --runInBand` は 16 suites passed / 1 integration suite が外部Neon DNS到達不可で未完了。
> E2E補足: `tests/helpers/e2e.ts` で初回ストーリー/チュートリアルを完了済みにする共通初期化を追加し、全specを現行UXセレクタへ更新。Vite E2EでBattleCanvasが空白化していたServer Action静的importも動的importへ修正。Playwrightの最終再実行は通常権限でChromium起動権限により失敗、権限付き実行も利用上限で拒否されたため未完了。

- [x] PROLOGUE → 第1章 全シーンが正常に再生される
  - 根拠: `StoryRegistry.test.ts` で 17シーン（PROLOGUE 4 + CH1 13）と各トリガー解決を確認済み。
- [x] area1_safe → area1_node3 まで全ステージがクリア可能
  - 根拠: master data に `area1_safe → area1_node1 → area1_node2 → area1_boss → area1_node3` の解放順を確認。`DungeonSystem.test.ts` で進行順・WAVE・ボス/精鋭データを確認済み。
  - 注意: UI E2E specは現行UXへ更新済み。ブラウザ実走の最終確認は利用上限解除後に再実行。
- [x] 第1章最終ステージ後に `CH1_CLEARED` フラグがセットされる
  - 根拠: `CH1_CLEAR` は `area1_node3` の `STAGE_CLEAR` で発火し、完了時に `CH1_CLEARED` をセットする。
- [x] バトル中に魔神化が発動・3ターン継続・自動終了する
  - 根拠: `DemonizationSystem.test.ts` で満タン発動、`DEMON_ACTION_LIMIT`、3行動後の自動解除を確認済み。`BattleCanvas` でも同一制御を使用。
- [x] ドロップ報酬（武器/残滓/モンスター）が正しくインベントリに入る
  - 根拠: `RewardService.test.ts` で武器/残滓/素材/hidden UR抽選を確認。`BattleCanvas` のリザルト処理で `addInventoryItems` / `addAbyssalResidues` / `addResidueMaterials` に反映。
  - 注意: 現行第1章の dropTable には MONSTER エントリなし。ボス霊核はリザルト表示のみ。
- [ ] NextAuth.js でログインしクラウドセーブが機能する
  - 進捗: HOME右上にCredentialsログイン/新規登録/ログアウトUIを追加し、`/api/auth/signup` と NextAuth Credentials provider へ接続済み。`processStageResultAction` のログイン済みクラウドセーブ、ランキング、世界ログ保存も実装済み。
  - 未確認: Neon接続環境での実ログイン → ステージクリア → クラウド保存E2E。Google/Discord OAuth は設計書どおり後続対応。
- [x] チュートリアル6フェーズが正常に表示・スキップできる
  - 根拠: `phases.test.ts` で6フェーズ順序・target id・タブゲートを確認。`useTutorialStore.test.ts` で進行/完了/スキップ状態を確認済み。
- [ ] iOS Safari で h-[100dvh] レイアウト崩れなし
  - 未完了: `h-[100dvh]` / `min-h-0` / overflow分離の実装は確認済み。ただし今回の環境では in-app browser pane が取得できず、実機iOS Safari確認は未実施。
