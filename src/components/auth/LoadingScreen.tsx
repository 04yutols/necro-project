'use client';

import { motion } from 'framer-motion';
import { Cloud, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  label?: string;
  detail?: string;
}

export function LoadingScreen({
  label = 'Cloud Save Sync',
  detail = '魂の記録を照合しています',
}: LoadingScreenProps) {
  return (
    <div
      className="h-[100dvh] w-full overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 12%, rgba(139,0,255,0.2), transparent 46%), #050505',
        color: '#F0EAFF',
      }}
    >
      <div
        className="h-full min-h-0"
        style={{
          display: 'grid',
          placeItems: 'center',
          padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 18px calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          style={{
            width: 'min(380px, 100%)',
            borderRadius: 20,
            border: '1px solid rgba(139,0,255,0.32)',
            background: 'linear-gradient(180deg, rgba(12,6,28,0.92), rgba(4,2,12,0.98))',
            boxShadow: '0 28px 80px rgba(0,0,0,0.72), 0 0 30px rgba(139,0,255,0.18)',
            padding: 22,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              margin: '0 auto 15px',
              borderRadius: 18,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(212,175,55,0.34)',
              background: 'rgba(212,175,55,0.08)',
              color: '#D4AF37',
            }}
          >
            <Cloud size={25} />
          </div>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>
            {label}
          </div>
          <div style={{ marginTop: 8, color: 'rgba(220,210,240,0.66)', fontSize: 12, lineHeight: 1.7 }}>
            {detail}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18, color: '#8A2BE2' }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
