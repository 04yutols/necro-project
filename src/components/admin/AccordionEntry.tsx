'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import JsonPreview from './JsonPreview';

type Props = {
  entryKey: string;
  summary: React.ReactNode;
  data: unknown;
};

export default function AccordionEntry({ entryKey, summary, data }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: '#111118',
        border: `1px solid ${open ? 'rgba(139,0,255,0.35)' : 'rgba(139,0,255,0.15)'}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Summary row — trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        style={{ cursor: 'pointer', background: 'transparent' }}
      >
        {/* Chevron */}
        <span
          className="shrink-0 text-[10px] transition-transform"
          style={{
            color: '#7878a8',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▶
        </span>

        {/* Key label */}
        <span className="shrink-0 font-mono text-[11px]" style={{ color: '#8B00FF' }}>
          {entryKey}
        </span>

        {/* Summary content */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">{summary}</div>
      </button>

      {/* JSON preview (animated) */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="json"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3">
              <JsonPreview data={data} label={entryKey} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
