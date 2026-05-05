---
name: gothic-morphism
description: Necromance Brave の Gothic-Morphism デザインシステム — カラートークン、タイポグラフィ、コンポーネントパターンの完全リファレンス
---

# Gothic-Morphism デザインシステム

## カラートークン

```
Void Purple (アクセント)
  #8B00FF           — primary
  #BC00FB           — bright (hover/active)
  #4A007A           — dim (disabled)
  rgba(139,0,255,0.35) — glow
  rgba(188,0,251,0.8)  — neon

背景
  #050505 / #050508  — background (最暗)
  #0A0612           — surface
  #0D0D0D           — navbar/header
  #1A1A1A           — elevated surface

テキスト
  #F0EAFF           — heading
  #A5A9B4           — body
  #6b5f7a           — muted
  #4a3a5a           — very muted

Secondary (Cursed Gold)
  #D4AF37           — cursedGold / secondary
  #8A6D1F           — dim

Demon Mode
  #8B0000           — tertiary / error / demon

Border
  #2C2C2C           — iron (default border)
  rgba(139,0,255,0.3)  — Void Purple border
```

## タイポグラフィ

```tsx
// 見出し — Cinzel Decorative (serif, uppercase, tracking-widest)
<span style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: '#F0EAFF' }}>

// ラベル — Cinzel (serif, uppercase)
<span style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 600, letterSpacing: '0.12em' }}>

// データ / モノスペース
<span style={{ fontFamily: 'monospace', fontSize: 9 }}>
<span className="font-mono text-[9px]">

// 日本語
<span style={{ fontFamily: "'Noto Sans JP'", fontSize: 10 }}>

// Void Glow テキスト
<span style={{ color: '#8B00FF', textShadow: '0 0 10px rgba(139,0,255,0.8), 0 0 30px rgba(139,0,255,0.4)' }}>
```

## ガラスパネル

```tsx
// 標準ガラスパネル
<div style={{
  background: 'rgba(10,5,26,0.88)',
  border: '1px solid rgba(139,0,255,0.3)',
  borderRadius: 14,
  backdropFilter: 'blur(10px)',
  boxShadow: '0 0 18px rgba(139,0,255,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
}}>

// Tailwind className equivalent
className="gothic-panel"

// 薄いパネル (カード内)
style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,0,255,0.18)', borderRadius: 10 }}

// Demon Mode パネル
style={{ background: 'rgba(26,5,5,0.88)', border: '1px solid rgba(139,0,0,0.4)', borderRadius: 14 }}
```

## ボタン

```tsx
// プライマリボタン (Void Purple)
<motion.button
  whileTap={{ scale: 0.96 }}
  style={{
    background: 'linear-gradient(135deg, rgba(139,0,255,0.28), rgba(139,0,255,0.14))',
    border: '1px solid rgba(139,0,255,0.55)',
    borderRadius: 10,
    padding: '7px 14px',
    color: '#8B00FF',
    fontFamily: "'Cinzel', serif",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.08em',
    boxShadow: '0 0 10px rgba(139,0,255,0.28)',
    cursor: 'pointer',
  }}
>

// セカンダリボタン (ゴールド)
style={{ border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37' }}

// アイコンボタン (ナビゲーション)
className="text-gray-600 hover:text-secondary transition-colors"
```

## スロット/カード (装備スロット等)

```tsx
<motion.div
  whileTap={{ scale: 0.96 }}
  style={{
    background: filled
      ? `linear-gradient(135deg, ${color}20, ${color}0C)`
      : 'rgba(255,255,255,0.03)',
    border: `1px solid ${filled ? color + '55' : color + '18'}`,
    borderRadius: 10,
    padding: '7px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }}
>
```

## アニメーション規約 (Framer Motion)

```tsx
// スクリーン スライドイン (⚠️ overflow:hidden は分離すること — iOS Safari バグ)
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', stiffness: 295, damping: 33 }}
  style={{ position: 'absolute', inset: 0 }}  // ← transformのみ、overflowなし
>
  <div className="absolute inset-0 flex flex-col overflow-hidden">  // ← overflowはここ

// フェードイン
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.22, ease: 'easeOut' }}

// キャラクター浮遊
animate={{ y: [-6, 6, -6] }}
transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}

// ホバー
whileTap={{ scale: 0.96 }}
whileHover={{ scale: 1.02 }}
```

## レイアウト制約

```
全画面: h-[100dvh] (100vh はNG — iOS Safari でアドレスバー含む)
Header: shrink-0, height: 44px (h-11)
BottomNav: shrink-0, height: 56px (h-14)
Content: flex-1 min-h-0

iPhone 13 Pro 安全ゾーン: 393 × 852px
コンテンツ幅: ~377px (padding 8px × 2)
```
