以下の仕様で新しいゲームスクリーンを作成してください: $ARGUMENTS

## 手順

1. `src/components/<feature>/<ScreenName>.tsx` を作成 (以下のテンプレートに従う)
2. `src/app/page.tsx` に表示条件を追加
3. 必要なら `src/store/useGameStore.ts` に Tab ID を追加
4. 必要なら `src/components/layout/BottomNavBar.tsx` にタブを追加
5. `npx tsc --noEmit` で型チェック

## テンプレート

```tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

export function ScreenName() {
  const { player } = useGameStore();

  return (
    // ⚠️ motion.div と overflow:hidden は必ず分離 (iOS Safari バグ回避)
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{ background: '#050505', fontFamily: "'Inter', sans-serif" }}
      >
        {/* Navbar: shrink-0 必須 */}
        <div
          className="shrink-0 flex items-center px-3"
          style={{ height: 44, borderBottom: '1px solid rgba(139,0,255,0.16)' }}
        >
          <span
            className="text-[11px] font-black tracking-[0.16em]"
            style={{ color: '#F0EAFF', fontFamily: "'Cinzel Decorative', serif" }}
          >
            SCREEN TITLE
          </span>
        </div>

        {/* Content: flex-1 min-h-0 必須 */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {/* コンテンツ */}
        </div>

        {/* Bottom (任意): shrink-0 必須 */}
        <div
          className="shrink-0 px-3 py-3"
          style={{ background: 'linear-gradient(0deg, rgba(5,2,15,0.98), transparent)' }}
        >
        </div>
      </div>
    </motion.div>
  );
}
```

## デザイン原則
- Void Purple `#8B00FF` をアクセントに
- ガラスパネル: `background: rgba(10,5,26,0.88)`, `border: 1px solid rgba(139,0,255,0.3)`, `borderRadius: 14`, `backdropFilter: blur(10px)`
- 全コンテンツを `h-[100dvh]` 内に収める
