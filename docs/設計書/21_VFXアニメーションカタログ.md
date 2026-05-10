# 21 — VFX アニメーションカタログ

> 最終更新: 2026-05-10  
> 関連設計書:
> - [07_デザインシステム.md](07_デザインシステム.md) §7（既存14種アニメ概要）
> - [16_魔神化システム.md](16_魔神化システム.md) §2（魔神化ゲージ・発動条件）
> - [03_バトルシステム.md](03_バトルシステム.md) §4（ドロップ確率・レアリティ）
> - [19_スキルバランス設計書.md](19_スキルバランス設計書.md) §3（スキル power 基準）  
> 実装ファイル: `src/components/battle/BattleCanvas.tsx`, `ResultScreen.tsx`, `src/app/globals.css`

---

## 1. 設計哲学 — 原神レベルの VFX 基準

Necromance Brave の VFX は **「演出が没入感の主役」** として設計する。  
原神 / HSR (Honkai: Star Rail) の品質基準を以下の4軸で定義する:

### 1.1 4つの品質公理

| 公理 | 原神の実現例 | 本作への適用 |
|---|---|---|
| **重量感** (Weight) | スキル発動直前の0.1秒フリーズ、命中時のカメラシェイク | スキル hit に `hitFreeze (2f)` → シェイク → 数字浮上 |
| **文脈演出** (Contextual) | 5★キャラの専用バースト演出（色・形状・SE すべて固有） | 職業別魔神化VFX・属性別スキル演出 |
| **視覚ヒエラルキー** (Hierarchy) | UR 演出は SSR より必ず 2 段階上の激しさ | COMMON < RARE < EPIC < SSR < UR の演出強度スケール |
| **後引き余韻** (Afterimage) | バースト後の残光・エフェクトが 0.5-1s 続く | ドロップ演出のパーティクル散乱を 1.5s 持続 |

### 1.2 フレームレート目標

| 対象 | 目標 fps | 手段 |
|---|---|---|
| PixiJS Canvas (BattleCanvas, MapCanvas) | **60 fps** | Ticker ループ内で JS 計算を最小化、GPU composite のみ |
| CSS Keyframe VFX | **60 fps** | `transform` / `opacity` / `filter` のみ使用（`left`/`top` 禁止） |
| Framer Motion | **60 fps** | `layout` アニメは `layoutId` でスコープを限定 |

### 1.3 演出時間の基準帯

```
軽量フィードバック:  80-200ms  (タップ、スワイプ、ボタン)
スキルVFX:          500-900ms  (属性スキル効果)
奥義・魔神技:      1000-2000ms  (キャラクター固有演出)
SSRドロップ:       2500-4000ms  (ガチャ相当の高揚感)
UR発現:            4000-6000ms  (最高レアリティ、衝撃体験)
```

---

## 2. VFX カテゴリ分類

```
VFX
├── A. 戦闘VFX
│   ├── A-1. スキル演出（属性別 9 種）
│   ├── A-2. ダメージ表示
│   ├── A-3. 状態異常 VFX（6 種）
│   ├── A-4. 霊的防壁 / 霊魂砕き
│   └── A-5. 魔神化発動 / 魔神技（★ 未実装・詳細仕様あり）
│
├── B. ドロップ / リザルト VFX
│   ├── B-1. COMMON / RARE ドロップ
│   ├── B-2. SSR ドロップ演出（★ 詳細仕様あり）
│   ├── B-3. UR 発現演出（★ 詳細仕様あり）
│   └── B-4. 紫光柱（Purple Pillar / HIDDEN_UNIQUE）
│
├── C. UI 遷移アニメーション
│   ├── C-1. スクリーン遷移
│   ├── C-2. ボタン / タップフィードバック
│   ├── C-3. データ可視化アニメ（ゲージ・グラフ）
│   └── C-4. 種族シナジーバナー（実装済み）
│
├── D. 環境 / 背景 VFX
│   ├── D-1. MapCanvas（PixiJS ノード）
│   ├── D-2. LegionHub パーティクル背景
│   └── D-3. NecroLab 魔法陣 + バブル
│
└── E. PixiJS 管理方針
    ├── E-1. Ticker ループ設計
    └── E-2. リソース管理
```

---

## 3. 既存 VFX 完全カタログ

### 3.1 CSS Keyframe 一覧（globals.css 定義済み）

#### 戦闘系

| keyframe 名 | duration | easing | 説明 | 実装ファイル |
|---|---|---|---|---|
| `floatDmg` | 1.1s | ease-out | ダメージ数字の浮上+フェード | BattleCanvas |
| `shake` | 0.4s | ease-out | 被ダメ時スクリーンシェイク (±6px) | BattleCanvas |
| `enemyHit` | 0.5s | ease-out | 敵スプライト輝度フラッシュ (1→3→1.5) | BattleCanvas |
| `screenFlash` | 0.5s | ease-out | 全画面白フラッシュ (opacity 0→0.55→0) | BattleCanvas |
| `skillScreenBloom` | 0.82s | ease-out | スキル発動時画面ブルーム | BattleCanvas |
| `skillMagicCircle` | 0.88s | ease-in-out | 魔法陣ズーム+回転 | BattleCanvas |
| `skillRuneSpin` | 1.1s | ease-out | ルーンリング展開 | BattleCanvas |
| `skillElementSlash` | 0.64-0.84s | cubic-bezier | 斬撃ライン | BattleCanvas |
| `thunderVfxFlicker` | 0.78s | steps(3,end) | 雷 VFX steps 点滅 | BattleCanvas |
| `fireVfxRise` | 0.75-0.95s | ease-out | 炎パーティクル上昇 | BattleCanvas |
| `waterVfxRing` | 0.86s | ease-out | 水リング拡張 | BattleCanvas |
| `earthVfxSpike` | 0.68-0.85s | cubic-bezier | 土スパイク跳ね上がり | BattleCanvas |
| `windVfxArc` | 0.72-1.05s | ease-out | 風弧状スイープ | BattleCanvas |
| `strikeShockwave` | 0.72s | ease-out | 打撃衝撃波 (scale 0.28→1.55) | BattleCanvas |
| `skillVfxParticle` | 0.72-0.97s | ease-out | 属性パーティクル散乱 (14-24個) | BattleCanvas |
| `skillNameFlash` | 0.86s | ease-out | スキル名テキストフラッシュ | BattleCanvas |
| `crit-flash` | 0.3s | ease | 会心ヒットフラッシュ | BattleCanvas |
| `demonPulse` | 0.8-1.5s | ease-in-out | 魔神化ゲージ赤グロー | BattleCanvas |
| `soulFill` | 1.5s | linear | ソウルゲージ充填ストライプ | BattleCanvas |
| `commandReveal` | 0.3s | ease-out | コマンドボタン下スライドイン | BattleCanvas |
| `shimmer` | 1.8s | linear | ボタンシマー | BattleCanvas |
| `logFade` | 0.3s | ease-out | ログエントリ左スライドイン | BattleCanvas |
| `skillReveal` | 0.25s | ease-out | スキルボタン出現 | BattleCanvas |
| `turnChipIn` | 0.3s | ease-out | ターンチップスケールイン | BattleCanvas |

#### リザルト / ドロップ系

| keyframe 名 | duration | 説明 |
|---|---|---|
| `resultSlideIn` | 0.45s | リザルト項目スライドアップ |
| `rankPop` | 0.7s | ランクバッジ弾性スケール (0.62→1.12→1) |
| `lootOrbPulse` | 2.2s | 通常ドロップオーブ呼吸 |
| `dropOrbEnter` | 0.46s | 通常ドロップ入場 |
| `cardReveal` | 0.58s | カード出現 (cubic-bezier 弾性) |
| `premiumOrbEnter` | 0.62s | SSR オーブ入場 |
| `premiumOrbPulse` | 1.55s | SSR オーブグロー呼吸 |
| `premiumDropBurst` | 0.82s | SSR ドロップ爆発開示 |
| `premiumRingPulse` | 2.8s | SSR リングスケール呼吸 |
| `rareRuneSpin` | 9s | ルーン回転リング (360°/9s) |
| `premiumSparkFall` | 2.2-3.3s | SSR スパーク降下 (18粒子) |
| `premiumLightSweep` | 1.35s | カード上光沢スイープ |
| `premiumIconFlare` | 1.6s | アイコン輝きフレア |
| `cursedOrbEnter` | 0.72s | UR オーブ入場 (グリッチ) |
| `cursedOrbPulse` | 1.15s | UR オーブ微振動+グロー |
| `cursedPillarBreath` | 1.7s | 紫光柱呼吸 (scaleX 0.78→1.12) |
| `cursedDropShatter` | 1.15s | UR カード出現粉砕 |
| `cursedCardReveal` | 0.78s | UR カード 3D 反転+グリッチ |
| `cursedMiasma` | 2.2s | 背景色相回転 |
| `cursedSigilSpin` | 7-11s | 呪印リング反転回転 |
| `curseStatic` | 0.72s | VHS スタティックノイズ |
| `curseWordFloat` | 3.4-4.2s | 呪詛文字上昇 (6文字) |
| `vengeanceWisp` | 2.2-3.8s | 怨念ウィスプ上昇 (16粒子) |
| `cursedNameGlitch` | 1.9s | 名前テキストグリッチ |
| `purplePillar` | — | 紫光柱出現 (scale 0.1→1.08) |
| `pillarHalo` | — | 光柱ハロー呼吸 |

#### 環境 / UI 系

| keyframe 名 | duration | 説明 |
|---|---|---|
| `breathe` | 3-4s | キャラクター浮遊アイドル (±6px) |
| `glow-pulse` | 2s | ボーダー呼吸グロー |
| `void-pulse` | 2s | Void Purple パルス |
| `hologram-scan` | 4s | ホログラム走査線 |
| `magic-spin` | 8s | 魔法陣回転 |
| `demon-surge` | 0.6s | 魔神化波紋 |
| `particleRise` | 3.2-4.7s | 背景パーティクル上昇 |
| `jobSigilSpin` | ∞ | ジョブ選択シジル回転 |
| `sin-wave` | 2-2.5s | HP/MP バーグラジエントシマー |
| `page-flip-in` | — | ログページフリップイン |
| `page-flip-out` | — | ログページフリップアウト |
| `skipScanPulse` | 0.72s | 高速鑑定スキャン |

---

### 3.2 PixiJS 実装済み VFX

#### MapCanvas.tsx — ステージノード

| 効果 | 実装 | 色 | ループ |
|---|---|---|---|
| アクティブノード光輪 | `Graphics` sine wave aura pulse | `0xBC00FB` (明紫) | ✅ |
| 3軌道パーティクル | Ticker 回転軌道 r=35-45px | `0xBC00FB` | ✅ |
| 選択ノードカラー | circle/diamond/square | cyan/magenta/purple | 状態依存 |
| クリア済みノード | cyan circle `0x00FFAB` | — | static |

#### useNecroLabPixi.ts — ネクロラボ

| 効果 | 実装 | 色 | 特記 |
|---|---|---|---|
| 魔法陣 (外輪) | `Graphics` circle r=170px | `0x5500CC` alpha 0.35 | 0.002rad/tick 回転 |
| 魔法陣 (内輪) | `Graphics` circle r=125px | `0x8B00FF` alpha 0.25 | 同上 |
| 六芒星 | 2三角形 stroke | `0x8B00FF` alpha 0.2 | static |
| ルーン点 (12個) | `Graphics` circle r=2 | `0xBC00FB` alpha 0.5 | 回転に追従 |
| バブル (22個) | 浮遊+横揺れ | `0x8B00FF` fill | 永続ループ |
| **dissolve** | 28粒子放射 life=20-45f | 4色ランダム | on demand |
| **reform** | 24粒子収束 life=15-33f | 3色ランダム | on demand |
| **soulChain** | グロー線 + 先端オーブ | `0xBC00FB` + white | on demand |

#### useResidueEnhancePixi.ts — 残滓強化ゲージ

| 効果 | 実装 | 特記 |
|---|---|---|
| ガラス外枠 | neon ring stroke 1.5px | `0x8B00FF` alpha 0.65 |
| Fill アニメ | lerp 0.07/tick | smooth fill |
| 波形エッジ | sine wave amplitude ×4 | wavePhase+=0.045/tick |
| バブル (20個) | fill 範囲内で visible | alpha ramp 0.03/tick |
| 強化バースト | 28粒子 v=1-4px/f grav+0.05 | `triggerInfusion()` |

---

## 4. SSR ドロップ演出 — 完全仕様（★ 未実装）

> 発動条件: `ItemData.rarity === 'SSR'` のドロップ確定時  
> 対応既存 keyframe: `premiumOrb*`, `rareRuneSpin`, `premiumSparkFall`, `premiumDropBurst`

### 4.1 フェーズシーケンス

```
Phase 1  [0 - 400ms]    "集結"
  ゴールドパーティクル (36粒子) が画面四隅から中央へ収束
  keyframe: particleConverge（新規）
  画面輝度: brightness(1) → brightness(1.6) over 400ms
  BGM: SSR専用 SE 開始（docs/23_サウンド.md 参照）

Phase 2  [400 - 700ms]  "フラッシュ暗転"
  全画面白フラッシュ (opacity 0.9, 80ms)
  → 完全暗転 (background #000, 220ms)
  中央にゴールドの縦光柱が出現
  keyframe: ssrGoldPillar（新規）
  light-sweep: 幅 8vw, 上から下へ 300ms

Phase 3  [700 - 1200ms] "オーブ出現"
  `premiumOrbEnter (0.62s)` でオーブ登場
  オーブ仕様: 直径 80px, ゴールドグラジエント
  background: radial-gradient(circle, #FFD700, #B8860B, #000)
  boxShadow: 0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,165,0,0.4)
  `premiumOrbPulse (1.55s, infinite)` に移行

Phase 4  [1200ms+]      "タップ待ち"
  テキスト: 「タップして確認」点滅 (opacity 0.4↔1, 0.9s)
  ルーン回転リング: `rareRuneSpin (9s, infinite)`
  スパーク降下: `premiumSparkFall × 18`

Phase 5  [tap → +300ms] "爆発開示"
  `premiumDropBurst (0.82s)`: オーブが爆発
  ゴールドパーティクル放射 (54粒子, 全方向)
  カードが回転しながら登場: `cardReveal (0.58s cubic-bezier(0.34,1.3,0.64,1))`

Phase 6  [+300 → +1800ms] "余韻"
  カード上を光沢が走る: `premiumLightSweep (1.35s)`
  ゴールドパーティクルが重力落下して消える (life 1.5s)
  背景: 深金色グラジエントが徐々にフェードアウト
```

### 4.2 カラートークン（SSR）

```typescript
const SSR_VFX = {
  primary:    '#FFD700',                    // 純金
  secondary:  '#FFC200',                    // アンバーゴールド
  glow:       'rgba(255,215,0,0.8)',
  softGlow:   'rgba(255,165,0,0.35)',
  pillar:     'linear-gradient(180deg, transparent, #FFD70088, #FFD700, #FFD70088, transparent)',
  sparkA:     '#FFE566',
  sparkB:     '#F0EAFF',                    // ラベンダー白（対比色）
} as const;
```

### 4.3 CSS 追加定義（globals.css に追記）

```css
@keyframes ssrGoldPillar {
  0%   { scaleX: 0; opacity: 0; }
  20%  { scaleX: 1; opacity: 0.92; }
  70%  { scaleX: 0.85; opacity: 0.88; }
  100% { scaleX: 0.78; opacity: 0.72; }
}

@keyframes particleConverge {
  0%   { transform: translate(var(--cx), var(--cy)) scale(1); opacity: 0.9; }
  80%  { transform: translate(0, 0) scale(0.6); opacity: 0.8; }
  100% { transform: translate(0, 0) scale(0); opacity: 0; }
}

@keyframes ssrCardEnterGold {
  0%   { transform: rotateY(-90deg) scale(0.7); filter: brightness(2); opacity: 0; }
  50%  { transform: rotateY(-8deg) scale(1.05); filter: brightness(1.5); opacity: 1; }
  75%  { transform: rotateY(4deg) scale(0.98); filter: brightness(1.15); }
  100% { transform: rotateY(0) scale(1); filter: brightness(1); }
}
```

---

## 5. UR 発現演出 — 完全仕様（★ 未実装）

> 発動条件: `ItemData.rarity === 'UR'` または `HIDDEN_UNIQUE`  
> 既存活用: `curseStatic`, `cursedPillarBreath`, `cursedSigilSpin`, `vengeanceWisp`, `curseWordFloat`

### 5.1 フェーズシーケンス

```
Phase 1  [0 - 200ms]     "静寂と予兆"
  画面輝度がゆっくり下がる (brightness 1 → 0.7)
  白ノイズ粒子が端から滲み始める (opacity 0→0.3)
  BGM が突然停止 → 0.1s の完全無音

Phase 2  [200 - 600ms]   "グリッチ崩壊"
  `curseStatic (0.72s, steps)` を 2 ループ
  画面全体に色相反転フィルタ (hue-rotate 180deg, 80ms) × 3 回フラッシュ
  赤いひび割れエフェクト(血飛沫): SVG フィルタ `feTurbulence` ベース
  画面端から crimson (#8B0000) が侵食: 4方向から中央へ

Phase 3  [600 - 1200ms]  "怨念の収束"
  怨念パーティクル竜巻: 64粒子が画面端から中央に螺旋収束
  色: rgba(188,0,251,0.8) (Void Purple) + rgba(139,0,0,0.6) (Crimson)
  回転半径: 160px → 0px over 600ms
  `cursedSigilSpin (11s)` + 内側リング逆回転 (7s) 出現

Phase 4  [1200 - 1600ms] "紫光柱出現"
  `purplePillar` keyframe 発動: 幅 30vw, 高さ 100vh
  gradient: transparent → #8B00FF → #BC00FB → #8B00FF → transparent
  `cursedPillarBreath (1.7s, infinite)` で呼吸開始

Phase 5  [1600 - 2200ms] "呪詛の顕現"
  呪詛文字 6体が順次出現: 怨, 呪, 哭, 喰, 縛, 滅
  `curseWordFloat × 6` (delay: 0, 120, 240, 360, 480, 600ms)
  フォント: 24-42px, color: rgba(188,0,251,0.65)
  同時に `vengeanceWisp × 16` が下から上昇

Phase 6  [2200ms+]        "タップ待ち"
  URオーブ出現: `cursedOrbEnter (0.72s)`
  `cursedOrbPulse (1.15s, infinite)` — 微振動+グロー
  テキスト「─ 怨念解放 ─」(点滅)
  背景: `cursedMiasma (2.2s, infinite)` 色相回転継続

Phase 7  [tap → +400ms]  "呪詛解放"
  `cursedDropShatter (1.15s)`: オーブが粉砕
  血飛沫パーティクル 48粒子が放射 → 重力落下
  `cursedCardReveal (0.78s)`: カード 3D フリップ + グリッチ
  カード出現後: `cursedFrameTwitch (1.45s)` でフレームが細かく震える

Phase 8  [+400 → +3000ms] "呪われた余韻"
  背景の色相回転が徐々に戻る (3s かけて normal に)
  怨念ウィスプが散りながら消える (life 2.5s)
  BGM が「不穏」SE に切り替わる
```

### 5.2 カラートークン（UR）

```typescript
const UR_VFX = {
  primary:    '#BC00FB',                    // Void Purple
  secondary:  '#8B0000',                    // Demon Crimson
  accent:     '#FF0044',                    // 血赤アクセント
  glow:       'rgba(188,0,251,0.82)',
  crimsonSoft:'rgba(139,0,0,0.55)',
  pillar:     'linear-gradient(180deg, transparent, rgba(139,0,255,0.6), #BC00FB, rgba(139,0,255,0.6), transparent)',
  wisp:       'rgba(188,0,251,0.58)',
  wispAlt:    'rgba(127,29,29,0.58)',
} as const;
```

---

## 6. 魔神化発動 VFX — 職業別カラーテーマ（★ 未実装）

> 発動条件: `demonGauge >= 100` → プレイヤー操作で発動  
> 参照: [16_魔神化システム.md §2](16_魔神化システム.md)

### 6.1 職業別カラーテーマ

| 職業ID | 和名 | PRIMARY | SECONDARY | 演出コンセプト |
|---|---|---|---|---|
| `warrior` | ベルセルク | `#CC1A1A` (血赤) | `#FF4444` | 血の霧、破壊の波紋 |
| `knight` | 聖堂騎士 | `#C8A840` (黄金) | `#FFF0AA` | 聖光の爆発、翼の展開 |
| `thief` | シャドウブレイド | `#444466` (闇銀) | `#AAAACC` | 残像分裂、煙消散 |
| `archer` | グレイヴアーチャー | `#228844` (深緑) | `#66FF88` | 嵐の矢、竜巻 |
| `mage` | アークメイジ | `#5500CC` (虚無紫) | `#AA44FF` | 魔法陣展開、星の爆発 |
| `dark_mage` | ダークメイジ | `#880022` (深紅×黒) | `#CC0044` | 闇の渦、血の雨 |
| `summoner` | ソウルサモナー | `#446688` (霊水) | `#88CCFF` | 霊体召喚、蒼い炎 |
| `priest` | ヴォイドプリースト | `#884488` (禁忌紫) | `#FF88FF` | 禁忌の輝き、十字光 |
| `samurai` | 侍 | `#AA6622` (錆朱) | `#FF9944` | 桜吹雪、斬撃残光 |
| `rune_knight` | ルーンナイト | `#1155AA` (鋼青) | `#44AAFF` | 電撃ルーン展開 |
| `necromancer` | ネクロマンサー | `#443366` (骸骨紫) | `#9966CC` | 骸骨群召喚、魂の炎 |
| `trickster` | ミスルーン | `#886622` (トリック金) | `#FFCC66` | カード飛散、幻影 |

### 6.2 共通発動シーケンス (ms)

```
[0 - 60ms]    "ヒットフリーズ" — 画面を2フレーム静止させる重量感演出
              (JS で Ticker を一時停止 or 全 CSS animation を pause)

[60 - 200ms]  "収束" — プレイヤースプライト中心から職業 PRIMARY 色のリングが収縮
              ring: 直径 300px → 0px, duration 140ms
              SE: 「ガゥン」系の低音

[200 - 500ms] "爆発" — PRIMARY 色のフラッシュ + パーティクル全方向放射
              `demonizationBurst` keyframe（新規）:
                0%:   scale(0.1) opacity(0)   filter:brightness(3)
                35%:  scale(1.2) opacity(0.9)  filter:brightness(2.5)
                100%: scale(1.8) opacity(0)    filter:brightness(1)
              パーティクル: 32粒子, v=3-7px/f, life=20-35f

[500 - 900ms] "魔神形態出現" — キャラクタースプライトが職業別モーフィング
              職業固有演出（後述）を再生

[900 - 1400ms] "タイトル表示" — 魔神名テキスト
              フォント: 'Cinzel Decorative', 18-22px
              色: 職業 PRIMARY
              keyframe: `demonTitleReveal`（新規）
                translateY(20px)→(0) + letter-spacing(0.8em)→(0.1em) + opacity(0)→(1)

[1400ms+]     "魔神化バトル状態" — ゲージが赤く脈動 (既存 demonPulse 流用)
              背景色が職業 PRIMARY の 5% 色調シフト
```

### 6.3 職業固有演出仕様（[500-900ms] 差し込み）

#### warrior — 血の爆砕

```
血飛沫 SVG フィルタ (feTurbulence + feDisplacementMap) を画面に適用 200ms
赤い放射状亀裂 SVG: 8方向, アニメ duration 400ms
scaleX(0.1)→scaleX(1.8) 各亀裂が伸展
```

#### mage — 魔法陣大展開

```
`skillMagicCircle` を 3 倍スケールで実行
六芒星 + 12 ルーン点が ORDER で出現 (stagger 30ms/点)
最後に scale(1.2)→scale(1) の引き戻しで重量感
```

#### necromancer — 骸骨群召喚

```
背景に 6-9 の骸骨スプライト（💀）が下から上昇
各骸骨: translateY(40px)→(-20px) opacity(0→0.85→0), duration 600-900ms
stagger: 80ms ずつ
```

### 6.4 魔神化解除 VFX

```
[0-300ms]  PRIMARY 色フラッシュ → フェードアウト
[300-600ms] キャラクタースプライトが通常状態に戻る (opacity pulse 0.8→1→0.8→1)
[600ms+]   ゲージバー: 赤→黒 transition 0.5s ease-out
```

---

## 7. 魔神技演出 — フレームスペック（★ 未実装）

> 魔神技 = 魔神化中に maxEnergy を全消費して発動する Ultimate スキル  
> 参照: [19_スキルバランス設計書 §6](19_スキルバランス設計書.md)

### 7.1 フレームシーケンス (60fps 基準)

```
f0  - f6   (0-100ms)   "暗転"
  全画面 fade-to-black: opacity 0→0.92, ease-in 100ms
  SE: 重低音のズン、直後に完全無音 20ms

f6  - f18  (100-300ms) "シルエット爆発"
  キャラクタースプライト: filter:brightness(10) で白シルエット化
  職業 PRIMARY 色の放射リング: r=0 → r=50vw, opacity 0.85→0, 200ms
  SE: 職業別スタート音（warrior=咆哮、mage=詠唱音）

f18 - f30  (300-500ms) "技名出現"
  キャラ背後に職業シジル (magic-spin 8s) が巨大化 (scale 0.2→1.4)
  技名テキスト: 'Cinzel Decorative' 22-28px, PRIMARY 色
  `demonTitleReveal` keyframe
  letter-spacing: 2em → 0.05em over 200ms (収束エフェクト)

f30 - f42  (500-700ms) "チャージ"
  敵スプライトに「狙われてる」演出: 赤ターゲットリング点滅 (3回, 80ms/回)
  プレイヤー側: 縮小 (scale 1 → 0.88) のタメ演出

f42 - f72  (700-1200ms) "技発動"
  スキル属性 VFX 再生 (既存 element VFX を 1.5× スケールで)
  追加: 画面全体に attribute color のブルーム (skillScreenBloom 1.5×)
  会心確定時: `crit-flash` 連続 3 回 (40ms 間隔)
  ダメージ数字: フォントサイズ 1.8× (通常の約2倍大)

f72 - f90  (1200-1500ms) "爆砕エフェクト"
  敵スプライト: hitEffect 連続 → 消滅演出 (opacity 1→0 + scale 1→0.4, 300ms)
  ダメージ数字後 200ms に「CRITICAL」または技名テキストが消える
  パーティクル後退波: 中央から外側へ PRIMARY 色放射

f90+       (1500ms+)    "復帰"
  暗転を fade-out (opacity 0.92→0, 300ms)
  通常バトル画面に戻る
  魔神化ゲージ: 0 にリセット + ゲージが灰色から通常に transition 0.6s
```

### 7.2 ダメージ数字のスタイル（魔神技専用）

```typescript
// 通常攻撃
{ fontSize: 24, color: '#F0EAFF', textShadow: '0 0 8px rgba(240,234,255,0.6)' }

// スキル
{ fontSize: 28, color: element.color, textShadow: `0 0 12px ${element.glow}` }

// 魔神技（通常）
{ fontSize: 40, color: job.PRIMARY, textShadow: `0 0 20px ${job.PRIMARY}88, 0 2px 0 rgba(0,0,0,0.8)` }

// 魔神技（会心）
{ fontSize: 52, color: '#FFD700', animation: 'critGoldBurst 0.6s ease-out both',
  textShadow: '0 0 30px rgba(255,215,0,0.9), 0 0 60px rgba(255,165,0,0.5)' }
```

### 7.3 新規追加 keyframe（globals.css）

```css
@keyframes demonizationBurst {
  0%   { transform: scale(0.1); opacity: 0; filter: brightness(3); }
  35%  { transform: scale(1.2); opacity: 0.9; filter: brightness(2.5); }
  100% { transform: scale(1.8); opacity: 0; filter: brightness(1); }
}

@keyframes demonTitleReveal {
  0%   { transform: translateY(20px); letter-spacing: 0.8em; opacity: 0; }
  60%  { transform: translateY(-2px); letter-spacing: 0.12em; opacity: 1; }
  100% { transform: translateY(0); letter-spacing: 0.05em; opacity: 1; }
}

@keyframes critGoldBurst {
  0%   { transform: scale(0.5) translateY(10px); opacity: 0; filter: brightness(3); }
  30%  { transform: scale(1.3) translateY(-8px); opacity: 1; filter: brightness(2); }
  70%  { transform: scale(1.0) translateY(-18px); opacity: 0.9; filter: brightness(1.3); }
  100% { transform: scale(0.9) translateY(-30px); opacity: 0; filter: brightness(1); }
}

@keyframes demonRingConverge {
  0%   { transform: scale(3); opacity: 0.85; }
  100% { transform: scale(0); opacity: 0; }
}
```

---

## 8. スキル VFX カタログ — 属性別詳細

### 8.1 既存属性 VFX 色定数（BattleCanvas.tsx Line 139-149）

```typescript
export const ELEMENT_VFX: Record<ElementType, { color: string; glow: string; soft: string }> = {
  FIRE:    { color: '#ff5a1f', glow: 'rgba(255,90,31,0.72)',   soft: 'rgba(255,90,31,0.18)' },
  WATER:   { color: '#38bdf8', glow: 'rgba(56,189,248,0.72)',  soft: 'rgba(56,189,248,0.18)' },
  THUNDER: { color: '#fde047', glow: 'rgba(253,224,71,0.78)',  soft: 'rgba(253,224,71,0.18)' },
  EARTH:   { color: '#a16207', glow: 'rgba(161,98,7,0.70)',    soft: 'rgba(161,98,7,0.20)'  },
  WIND:    { color: '#7dd3fc', glow: 'rgba(125,211,252,0.70)', soft: 'rgba(125,211,252,0.16)'},
  ICE:     { color: '#93c5fd', glow: 'rgba(147,197,253,0.72)', soft: 'rgba(147,197,253,0.18)'},
  LIGHT:   { color: '#fef3c7', glow: 'rgba(254,243,199,0.72)', soft: 'rgba(254,243,199,0.16)'},
  DARK:    { color: '#a855f7', glow: 'rgba(168,85,247,0.72)',  soft: 'rgba(168,85,247,0.20)' },
  NONE:    { color: '#f0ebff', glow: 'rgba(240,235,255,0.54)', soft: 'rgba(240,235,255,0.10)'},
};
```

### 8.2 属性別コンポジション

| 属性 | 主VFX | 粒子数 | 追加エフェクト | duration |
|---|---|---|---|---|
| FIRE | `fireVfxRise` (炎上昇) | 10粒子 | 画面オレンジブルーム | 0.75-0.95s |
| WATER | `waterVfxRing` (リング拡張) | 3リング | 水滴スプラッシュ追加予定 | 0.86s |
| THUNDER | `thunderVfxFlicker` (3ステップ) | SVG稲妻 | 画面黄色フラッシュ | 0.78s |
| EARTH | `earthVfxSpike` (スパイク) | 7-12粒子 | 地面ひび割れ追加予定 | 0.68-0.85s |
| WIND | `windVfxArc` (弧状スイープ) | 3-5弧 | 葉っぱ飛散追加予定 | 0.72-1.05s |
| ICE | `waterVfxRing` 流用 (水色) | 3リング | 氷結エフェクト追加予定 | 0.86s |
| LIGHT | 白フラッシュ + 放射線 | 8線 | 神聖エフェクト追加予定 | 0.6-0.9s |
| DARK | 紫渦 + 斬撃 | 6渦粒子 | 闇の腐食エフェクト追加予定 | 0.8-1.0s |
| NONE | `skillElementSlash` (斬撃) | 3-5線 | — | 0.64-0.84s |

### 8.3 AttackType 別追加レイヤー

```
SLASH:     3-5 本の斬撃ライン + 金属光沢スパーク
STRIKE:    `strikeShockwave` 同心円 + 地面揺れ (shake 0.3s)
PROJECTILE: 弾体トレイルライン → 命中爆発
MAGIC:     `skillMagicCircle` + `skillRuneSpin` 魔法陣
SUMMON:    PixiJS `soulChain` 呼び出し演出 + 召喚体出現フラッシュ
HEAL:      緑パーティクル上昇 + ハート型浮遊 (予定)
```

---

## 9. 状態異常 VFX カタログ

### 9.1 付与演出（対象キャラクターに表示）

| 状態異常 | 色 | 付与VFX | ティックVFX | アイコン |
|---|---|---|---|---|
| BLEED | `#FF2244` | 赤い飛沫 3-5 粒子 | 滴が落下 (1個/ターン) | 滴 |
| POISON | `#9900FF` | 紫バブル 4 個が広がる | 泡が浮上 (2個/ターン) | 毒 |
| BURN | `#FF6600` | 炎 `fireVfxRise` 縮小版 | 火花チラチラ | 炎 |
| FREEZE | `#00CCFF` | 氷結エフェクト（scaleX圧縮） | 氷の亀裂テクスチャ固定 | 凍 |
| PARALYSIS | `#FFEE00` | 雷 `thunderVfxFlicker` | 電撃2-3本/ターン | 雷 |
| WEAKEN | `#888888` | グレーダウン + 下矢印 | — | 弱 |

### 9.2 状態異常バッジ（バトルUI）

```typescript
// 実装済み: BattleCanvas の STATUS バッジ
// 各バッジは AILMENT_UI から色を参照（StatusAilmentSystem.ts Line 21-28）
// 付与時に demonPulse 0.8s でフラッシュ（既存実装）
```

### 9.3 UNDEAD×3 免疫演出（種族シナジー）

POISON / BLEED が免疫の場合、ティックダメージが 0 になった際:
```
「免疫」テキストが白で浮上 (floatDmg keyframe 流用, color: #AAAAFF)
バッジが一瞬グレーアウト → 消える演出 (opacity 1→0.3→0, 400ms)
```

---

## 10. UI 遷移アニメーション カタログ

### 10.1 スクリーン遷移（Framer Motion）

```typescript
// ★ 鉄則: overflow:hidden と transform を同一要素に設定しない (iOS Safari バグ)

// 標準: スライドアップ（下画面→上から来る）
transition: { type: 'spring', stiffness: 295, damping: 33 }
initial: { y: '100%' }  animate: { y: 0 }  exit: { y: '100%' }

// MAP → BATTLE (フルスクリーン展開)
initial: { opacity: 0, scale: 0.95 }  animate: { opacity: 1, scale: 1 }
transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

// BATTLE → RESULT (下からスライド)
initial: { y: '100%' }  animate: { y: 0 }
transition: { type: 'spring', stiffness: 240, damping: 28 }

// タブ切り替え (HOME / EQUIP / LAB / LOGS)
initial: { opacity: 0, y: 8 }  animate: { opacity: 1, y: 0 }
transition: { duration: 0.22, ease: 'easeOut' }
```

### 10.2 リスト表示（スタガー）

```typescript
// アイテムリスト等の段階出現
items.map((item, i) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay: i * 0.04, ease: 'easeOut' }}
  />
))

// 最大 delay: 8 アイテムで 0.32s (それ以上は delay を cap する)
const delay = Math.min(i * 0.04, 0.24);
```

### 10.3 ボタン / インタラクション

```typescript
// 標準タップ
whileTap={{ scale: 0.94 }}
transition={{ duration: 0.1 }}

// プレミアムボタン（SSR確定ボタン等）
whileTap={{ scale: 0.92 }}
animate={{ boxShadow: ['0 0 8px color 40%', '0 0 16px color 80%', '0 0 8px color 40%'] }}
transition={{ duration: 1.8, repeat: Infinity }}

// 破壊系ボタン（魔神化発動等）
whileTap={{ scale: 0.9 }}
// + haptic([15, 10, 30])
```

### 10.4 データ可視化アニメーション

```typescript
// HP / MP / ゲージバー
<motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />

// EXP バー (リザルト)
animation: 'expGrow 1.2s ease-out 0.3s both'

// 残滓ゲージ (PixiJS)
// lerp 係数: 0.07/tick (useResidueEnhancePixi)
```

---

## 11. PixiJS Ticker / リソース管理方針

### 11.1 Ticker ループ設計

```typescript
// 推奨パターン: 1コンポーネント = 1 Ticker
const app = new Application({ width, height, backgroundAlpha: 0 });
const ticker = app.ticker;
ticker.add((delta) => {
  // ★ delta を必ず受け取ってフレームレート非依存にする
  // ★ 重い計算（Math.sqrt, 配列sort等）はここに書かない
  // ★ テクスチャ生成・addChild はループ外で行う
  updateParticles(delta);
  updateAura(delta);
});

// クリーンアップ（useEffect return）
return () => {
  ticker.destroy();
  app.destroy(true, { children: true, texture: true });
};
```

### 11.2 パーティクルシステム共通パターン

```typescript
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  r: number; color: number; alpha: number;
}

// ★ オブジェクトプーリング: 毎フレーム new しない
const POOL_SIZE = 64;
const pool: Particle[] = Array.from({ length: POOL_SIZE }, createParticle);
let poolIdx = 0;

function spawnParticle(): Particle {
  const p = pool[poolIdx % POOL_SIZE];
  poolIdx++;
  return resetParticle(p);
}
```

### 11.3 レンダリング優先度

```
優先度 1 (常時): 背景 / 環境パーティクル（useCanvasBg）
優先度 2 (常時): ステージノード / 魔法陣アニメ
優先度 3 (イベント): スキルVFX / ドロップ演出
優先度 4 (イベント): 魔神化 / 魔神技（最高負荷）
```

### 11.4 メモリ管理ルール

1. スキルVFX は **300ms 後に自動クリーンアップ** (`setTimeout(() => vfxContainer.removeChildren(), 300)`)
2. パーティクル寿命 (life) が 0 になった時点で `Graphics` を `pool` に戻す
3. `PIXI.Graphics` は再利用、`PIXI.Texture` は`Assets.load()` でキャッシュ
4. PixiJS `autoStart: false` + 手動 `app.ticker.add()` で描画タイミングを制御

---

## 12. パフォーマンス基準

### 12.1 VFX 負荷計測目標

| シーン | 目標 FPS | 許容 CPU | 許容 GPU |
|---|---|---|---|
| 通常バトル（スキルなし） | 60 | < 8% | < 15% |
| スキルVFX 再生中 | 55+ | < 18% | < 30% |
| 魔神技演出 | 45+ | < 28% | < 45% |
| SSR ドロップ演出 | 55+ | < 20% | < 35% |
| UR 発現演出 | 50+ | < 25% | < 40% |

### 12.2 削減ガイドライン

```
❌ 禁止: CSS animation の left/top プロパティ変化（リフロー発生）
❌ 禁止: Ticker ループ内での DOM 操作
❌ 禁止: 毎フレームでの new PIXI.Graphics()
❌ 禁止: filter: blur() の多重ネスト（> 3層）
✅ 推奨: transform / opacity / filter のみで構成
✅ 推奨: will-change: transform を VFX 要素に付与（ただし多用しない）
✅ 推奨: CSS animation より PixiJS Ticker の方が高頻度更新に向く
```

### 12.3 Low Power Mode 対応

```typescript
const isLowPower = navigator.getBattery?.().then(b => b.charging === false && b.level < 0.2);
// Low Power 時: パーティクル数を 50% 削減, ループ演出を停止
const particleCount = isLowPower ? Math.floor(base / 2) : base;
```

---

## 13. 新規追加が必要な globals.css Keyframe 一覧

| keyframe 名 | カテゴリ | 優先度 |
|---|---|---|
| `ssrGoldPillar` | SSR演出 | HIGH |
| `particleConverge` | SSR演出 | HIGH |
| `ssrCardEnterGold` | SSR演出 | HIGH |
| `demonizationBurst` | 魔神化 | HIGH |
| `demonTitleReveal` | 魔神化 | HIGH |
| `demonRingConverge` | 魔神化 | HIGH |
| `critGoldBurst` | 魔神技ダメージ | HIGH |
| `urGlitchInvade` | UR演出 | MEDIUM |
| `urCrimsonInfect` | UR演出 | MEDIUM |
| `urParticleTornado` | UR演出 | MEDIUM |
| `urCardGlitchReveal` | UR演出 | MEDIUM |
| `iceVfxCrystal` | 氷属性スキル | MEDIUM |
| `lightVfxRadiate` | 光属性スキル | MEDIUM |
| `darkVfxVortex` | 闇属性スキル | MEDIUM |
| `healVfxRise` | 回復スキル | LOW |
| `projectileTrail` | 飛道具 | LOW |
| `summonFlash` | 召喚 | LOW |

---

## 14. 実装チェックリスト

### SSRドロップ演出
- [ ] `ssrGoldPillar` / `particleConverge` / `ssrCardEnterGold` を globals.css に追加
- [ ] `ResultScreen.tsx` にフェーズ制御ステートマシン実装（Phase 1〜8）
- [ ] SSR専用パーティクル (36粒子 → 54粒子) を CSS or PixiJS で実装
- [ ] `SSR_VFX` カラートークンを ResultScreen.tsx に定義

### UR発現演出
- [ ] `urGlitchInvade` / `urCrimsonInfect` / `urParticleTornado` を globals.css に追加
- [ ] 血飛沫 SVG フィルタ (`feTurbulence` ベース) の設計
- [ ] UR フェーズ制御をサブコンポーネント `URAppraisalScene.tsx` として切り出し
- [ ] Phase 2 のグリッチ崩壊: 色相反転フラッシュ × 3 実装

### 魔神化発動VFX
- [ ] `demonizationBurst` / `demonTitleReveal` / `demonRingConverge` を globals.css に追加
- [ ] `DEMONIZATION_COLORS` テーブル (12職業) を `BattleCanvas.tsx` に定義
- [ ] 発動シーケンスを `useDemonizationVFX()` フックとして実装
- [ ] 職業別固有演出 (warrior: 血飛沫 / mage: 魔法陣) の実装
- [ ] 2フレームフリーズ実装: Ticker.stop() → setTimeout 33ms → Ticker.start()

### 魔神技演出
- [ ] `critGoldBurst` keyframe を globals.css に追加
- [ ] `DemonUltimateVFX` コンポーネントをフレームスペック通りに実装
- [ ] 魔神技ダメージ数字のサイズ差別化 (通常の 1.8×)
- [ ] 会心魔神技: `critGoldBurst` + 金色テキスト適用

### PixiJS 管理
- [ ] パーティクルプール (POOL_SIZE=64) を共通 `ParticlePool.ts` に実装
- [ ] `Ticker.delta` を全ループで使用するようリファクタ
- [ ] VFX コンテナのクリーンアップ: 300ms タイムアウト標準化
- [ ] Low Power Mode 検知と粒子数削減ロジック追加
