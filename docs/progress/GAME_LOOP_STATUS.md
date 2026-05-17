# ゲームループ 動作確認レポート

> 確認日: 2026-05-17  
> `npx tsc --noEmit` → OK ✓  
> `npm run build` → OK ✓
> `npm test -- --runInBand src/services/RewardService.test.ts src/store/useGameStore.party.test.ts` → 2 suites / 14 tests / all passed ✓
> `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3080 npx playwright test tests/result-screen.spec.ts --reporter=line` → 1 passed ✓

---

## 結論: **一通り遊べる状態**

コアループ（HOME → MAP → BATTLE → リザルト → MAP）は動作する。
ただし以下の未接続・モック箇所があり、完成品としての品質に達していない。

---

## ✅ 動作確認済み項目

| システム | 状態 | 備考 |
|---|---|---|
| プロローグ〜第1章全ストーリー再生 | ✅ | 17シーン、StoryRegistry.test で確認済み |
| HOMEタブ表示 | ✅ | ステータス・ナビボタン表示 |
| MAPタブ → ステージ選択 | ✅ | 解放判定・ノード描画・onStartStage 接続済み |
| バトル（3WAVE）| ✅ | BattleEngine 連携、ターン制、属性・弱点・シールド |
| ボスギミック（ENRAGE / REVIVE / SUMMON_MINIONS）| ✅ | DemonizationSystem.test で確認済み |
| 魔神化（発動 / 3ターン継続 / 自動解除）| ✅ | DemonizationSystem.test で確認済み |
| スキル（職業マスターデータから取得）| ✅ | warrior Lv.72 → 全スキル解放済み |
| ドロップ報酬（武器 / 残滓 / 素材 / 消費アイテム）| ✅ | RewardService.test で確認済み |
| リザルト画面 | ✅ | Vite実行時はローカル報酬処理に即時fallback。鑑定画面はCanvas破棄例外を避けるCSS VFXへ変更済み |
| バトル内アイテム | ✅ | `inventoryItems` 由来の消費アイテムを表示・消費。ドロップ補充もスタック反映 |
| ログイン UI / クラウド認証 | ✅ | HOME 右上にログイン/登録/ログアウト導線を追加。Credentials 認証と `/api/auth/signup` を接続 |
| HOME ゴールド・EXP表示 | ✅ | `player.gold` / 職業EXP / 死霊術EXP を実データ参照に変更済み |
| 軍団編成（LegionHub）| ✅ | 3スロット・コスト判定・シナジーバナー |
| ネクロラボ（残滓 EQUIP / ENHANCE）| ✅ | 装備スロット・仮想スクロールグリッド |
| 職業転職（JobChangeScreen）| ✅ | ステータスプレビュー・転職ボタン |
| チュートリアル（6フェーズ）| ✅ | phases.test / useTutorialStore.test で確認済み |
| DB連携（processStageResultAction）| ✅ | Next runtimeではServer Action、Vite runtimeではローカル報酬処理 |

---

## 🔴 未実装・モック（修正必要）

### 1. JOB タブが BottomNavBar にない
**ファイル**: `src/components/layout/BottomNavBar.tsx` L7-13  
**問題**: BottomNavBar は `HOME / MAP / BATTLE / LEGION / LAB / LOGS` の6タブのみ。  
JOB タブ（JobChangeScreen）は HomeHero の「転職」ボタン経由でしか到達できない。

ナビバーが6タブで視覚的に詰まっているため、HomeHero 経由のままでもよいが、  
JobChangeScreen に「戻る」ボタン（setCurrentTab('HOME')）が実装済みなので動線自体は機能している。

---

## 🟡 軽微な問題（UX影響あり）

### 2. アバター画像が warrior のみ存在
**ファイル**: `public/images/`  
存在するのは `avatar_warrior.png` のみ。他の職業に転職すると  
HomeHero の画像が dicebear API（外部 URL）フォールバックになる。  
→ 他職業分の画像（`avatar_mage.png` 等）が必要。

### 3. ストーリー立ち絵画像が未実装
**ファイル**: `src/data/story/characters.json`  
`portraitBase: "/images/story/aldo"` 等が指すファイルが存在しない（`public/images/story/` ディレクトリなし）。  
DialogueScene が SVG プレースホルダーでフォールバックしているため表示は崩れないが、  
キャラクターが立ち絵なしの状態になっている。

---

## ⬜ 確認待ち（環境依存）

| 項目 | 状態 |
|---|---|
| iOS Safari 実機レイアウト確認 | 未実施（実機なし） |
| Playwright E2E テスト全件 | 未実施（Chromium 起動権限なし） |
| Credentials 実ログイン / NeonクラウドセーブE2E | 未実施（接続環境依存） |
| Google / Discord OAuth 接続 | 未実装（Credentials のみ） |
| Upstash Redis / Pusher 本番接続 | 環境変数設定次第 |

---

## 修正優先度まとめ

| 優先 | タスク | ファイル |
|---|---|---|
| 低 | 職業別アバター画像を追加 | `public/images/` |
| 低 | ストーリー立ち絵画像を追加 | `public/images/story/` |
