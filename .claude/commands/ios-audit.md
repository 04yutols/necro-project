以下のファイルを iOS Safari レイアウトバグの観点でスキャンしてください: $ARGUMENTS

引数がない場合は、最近変更されたコンポーネントファイルを `git diff --name-only` で特定してから対象ファイルを判断してください。

## チェック項目

1. **overflow:hidden + transform 同一要素** (最重要)
   - `motion.div` などに animation と `overflow-hidden` / `overflow: 'hidden'` が同居 → iOS Safari でクリッピング不全
   - grep: `grep -n "overflow" <file>` + `grep -n "initial=\|animate=" <file>`

2. **viewport zoom 設定** (`src/app/layout.tsx`)
   - `maximumScale: 1, userScalable: false` がなければ → ピンチズームで右端クリップ

3. **flex item の min-width** (`ResponsiveFrame.tsx` など)
   - `<main>` や `flex-1` 要素に `min-width: 0` がなければ → コンテンツが container 外に膨張

4. **100vh の使用**
   - `h-screen` や `100vh` → `100dvh` に変更が必要

5. **html overflow-x** (`globals.css`)
   - `html { overflow-x: hidden; max-width: 100vw; }` がなければ追加

## 報告形式
`ファイル:行 — 問題 — 修正方法` で列挙。問題なければ `iOS Safari: 異常なし ✓`
