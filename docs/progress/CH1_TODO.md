# 第1章「亡国の王都」— 実装チェックリスト

> 第1章リリースに必要なタスクのみ。完了したらチェックを入れる。
> 第2章以降の項目は DEFERRED.md へ。

---

## Phase A 🔴 — バトル動作・必須インフラ

これがないと動かない。最優先。

### コアロジック
- [ ] `src/logic/BattleEngine.ts` — 隊列ヘイト分散（slot 0=50% / 1=30% / 2=20%）
- [ ] `src/logic/BattleEngine.ts` — ボスギミック（ENRAGE / REVIVE / SUMMON_MINIONS）
- [ ] `src/logic/DemonizationSystem.ts` — フルオートAI統合・魔神技ダメージ計算
- [ ] `src/logic/WeaponPassive.ts` — 第1章出現パッシブ（SOUL_SHATTER / ACTION_VALUE / DEMON_MODE）

### マスターデータ
- [ ] `src/data/master/enemies.json` — 第1章エネミー（MINION×5 + ELITE×2 + BOSS×1）stats / resistances / dropTable
- [ ] `src/data/master/demonForms.json` — Tier1フォーム4職業分（warrior / mage / dark_priest / rogue）

### サービス・ストア
- [ ] `src/services/RewardService.ts` — ドロップ処理（R/SR/SSR武器 + 残滓 + モンスタードロップ）
- [ ] `src/store/useGameStore.ts` — `demonActionsRemaining` / `monsterCurrentHp` / `swapPartySlots` 追加

### DB・認証・結合
- [ ] `prisma/schema.prisma` — Item に rank / archetype / ilv / passiveA / passiveB 追加
- [ ] NextAuth.js v5 セットアップ（Google/Discord OAuth + PrismaAdapter）→ 詳細: `25_オンラインゲーム設計.md §2`
- [ ] DB連携バトル結合（GameManager.startStage → BattleCanvas → processStageResult）

### テスト
- [ ] `DemonizationSystem.test.ts` — AV割り込み・魔神技ダメージ計算
- [ ] `WeaponPassive.test.ts` — SOUL_SHATTER / ACTION_VALUE 発動判定

---

## Phase B 🟡 — 第1章コンテンツ

バトルが動いた後に並行実装。

### ストーリーシステム
- [ ] `src/data/story/ch1_scenes.json` — 第1章17シーン（PROLOGUE 4 + CH1 13）JSONデータ作成 → 台詞: `22_ストーリー進行システム.md §6`
- [ ] `src/components/story/DialogueScene.tsx` — 原神スタイル会話UI
- [ ] `src/components/story/MonologueOverlay.tsx` — 全画面モノローグ
- [ ] `src/components/story/ChapterTitleCard.tsx` — スタレスタイル章タイトル
- [ ] `src/store/useStoryStore.ts` — Zustand persist 進行管理
- [ ] `src/hooks/useStoryTrigger.ts` — ステージクリア後・画面遷移時の自動起動

### チュートリアルシステム
- [ ] `src/store/useTutorialStore.ts` — Zustand persist 進行管理
- [ ] `src/components/tutorial/SpotlightOverlay.tsx` — SVG clipPath スポットライト
- [ ] `src/components/tutorial/BubbleHint.tsx` — 吹き出しヒント
- [ ] `src/hooks/useTutorialTrigger.ts` — 6フェーズ自動起動フック

### LegionHub 編成UI
- [ ] ドラッグ並び替え（Framer Motion drag + long press 400ms + iOS Safari 分離ルール） → 詳細: `24_パーティ編成システム詳細.md`
- [ ] CostIndicator（3段階カラー + シェイクアニメ + ツールチップ、`necroStatus.maxCost` 参照）
- [ ] モンスターソート/フィルタ（種族チップ × ATK/HP/SPD/COST 4キー）
- [ ] **バグ修正**: LegionHub L2416 `const maxCost = 12` → `necroStatus.maxCost`

### バトルUI
- [ ] 魔神化発動VFX（demonGauge は実装済み → エフェクト追加） → 詳細: `21_VFXアニメーション §4`
- [ ] 魔神技専用ボタン（魔神化中のみ表示）
- [ ] 倍速切り替えボタン（1x / 2x / 3x）
- [ ] 隊列ポジションバッジ（⚔前衛 / ◈中衛 / ✦後衛）

---

## Phase C 🟢 — UX完成度

品質・演出の仕上げ。

- [ ] SSR/SRドロップ演出（PixiJS VFX 紫光柱） → 詳細: `21_VFXアニメーションカタログ §5.2`
- [ ] `src/services/AudioService.ts` — BGMクロスフェード + SE合成 → 詳細: `23_サウンド設計.md`
- [ ] `src/hooks/useBGM.ts` / `useSoundEffects.ts` / `useAudioStore.ts`
- [ ] 武器詳細画面（パッシブ説明 + ランク別プレビュー）
- [ ] 残滓強化モーダル（Tier演出付き）
- [ ] エリアマップのノード進行UI（霧解除アニメーション）

---

## Phase D 🔵 — オンライン機能

第1章リリースに必要なオンライン機能。

- [ ] クラウドセーブ Server Actions（stage clear → processStageResult） → 詳細: `25_オンラインゲーム設計.md §3`
- [ ] ランキング API（Upstash Redis + StageRecord） → 詳細: `25_オンラインゲーム設計.md §5`
- [ ] 第一発見者システム完成（RewardService + Prisma $transaction + ItemSerialCounter）
- [ ] 世界ログ（Pusher Channels + WorldEventService + useWorldLog） → 詳細: `25_オンラインゲーム設計.md §6`

---

## 第1章完成条件チェック

```
[ ] PROLOGUE → 第1章 全シーンが正常に再生される
[ ] area1_safe → area1_node3 まで全ステージがクリア可能
[ ] 第1章ボス討伐後に CH1_CLEARED フラグがセットされる
[ ] バトル中に魔神化が発動・3ターン継続・自動終了する
[ ] ドロップ報酬（武器/残滓/モンスター）が正しくインベントリに入る
[ ] NextAuth.js でログインしクラウドセーブが機能する
[ ] チュートリアル6フェーズが正常に表示・スキップできる
[ ] iOS Safari で h-[100dvh] レイアウト崩れなし
```
