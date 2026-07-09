# 34. バトルUI/UX実装設計

最終更新: 2026-05-16

## 1. 目的

第1章チェックリストのバトルUI項目を、iOS Safari でも触りやすい `100dvh` 前提の戦闘画面として完成させる。
既存の `BattleCanvas.tsx` はバトル進行・魔神化・状態異常・属性VFXを持っているため、本設計では演出品質と操作導線を補強する。

## 2. 実装対象

| 項目 | 実装方針 |
|---|---|
| 魔神化発動VFX | `DemonizeBurstOverlay` を追加し、職業別カラーの収束リング、魔法陣、縦柱、亀裂、粒子、魔神名表示を1.6秒で再生する |
| 魔神技専用ボタン | 魔神化中だけ `DemonStatusRibbon` 右側に専用ボタンとして表示する。使用後は `USED` 表示で無効化する |
| 倍速切り替え | `SystemBar` を 1x / 2x / 3x のセグメントに変更し、タップ領域を拡大する。主要なターン待機・ヒット間隔・VFX保持時間に倍率を反映する |
| 隊列ポジションバッジ | 使役魔3スロットに `⚔ 前衛` / `◈ 中衛` / `✦ 後衛` を表示する。空スロットでも隊列役割は確認できる |

## 3. UI構造

```
Top HUD
BattleArena
  ├─ SkillEffectOverlay
  └─ DemonizeBurstOverlay
BattleLog
PartyStatusBar
  ├─ Player
  ├─ Slot 1: 前衛
  ├─ Slot 2: 中衛
  └─ Slot 3: 後衛
SoulGauge
CommandPanel
  ├─ DemonStatusRibbon（魔神化中のみ、魔神技ボタン内包）
  └─ 攻撃 / 術 / 道具 / 魔神化（通常時のみ）
SystemBar
  └─ AUTO / 1x 2x 3x / 逃走
```

## 4. レスポンシブ方針

- 戦闘画面は親コンテナの高さ `100%` を使い、内部は `flex` で縦方向に収める。
- `BattleArena` は `flex: 1` とし、HUD/ログ/コマンドが増減しても敵スプライトを縮退できる。
- iOS Safari では下部バーに `env(safe-area-inset-bottom)` を反映する。
- 操作系は小型端末でも概ね 38px 以上の高さを確保し、倍速切替はセグメント化して誤タップを減らす。

## 5. 実装ファイル

- `src/components/battle/BattleCanvas.tsx`
- `src/app/globals.css`

