'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import JsonPreview from './JsonPreview';

type Props = {
  entryKey: string;
  summary: React.ReactNode;
  data: unknown;
  editHref?: string;
};

export default function AccordionEntry({ entryKey, summary, data, editHref }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: '#111118',
        border: `1px solid ${open ? 'rgba(139,0,255,0.4)' : 'rgba(139,0,255,0.15)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          minHeight: 56,
        }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: open ? 'rgba(139,0,255,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${open ? 'rgba(139,0,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            color: open ? '#a78bfa' : '#7878a8',
            fontSize: 11,
          }}
          aria-label="詳細を開く"
        >
          <span
            style={{
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
              transition: 'transform 0.2s ease',
            }}
          >
            ▶
          </span>
        </button>

        {/* Key label */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'Space Mono, monospace',
            fontSize: 12,
            color: '#8B00FF',
            minWidth: 100,
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entryKey}
        </span>

        {/* Summary content */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {summary}
        </div>

        {/* Edit button */}
        {editHref && (
          <Link
            href={editHref}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 38,
              padding: '0 20px',
              borderRadius: 8,
              background: 'rgba(139,0,255,0.15)',
              border: '1px solid rgba(139,0,255,0.4)',
              color: '#d8b4fe',
              textDecoration: 'none',
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              letterSpacing: '0.03em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,0,255,0.28)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(139,0,255,0.65)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(139,0,255,0.15)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(139,0,255,0.4)';
            }}
          >
            編集 →
          </Link>
        )}
      </div>

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
            <div
              style={{
                borderTop: '1px solid rgba(139,0,255,0.12)',
                margin: '0 14px',
                padding: '14px 0',
              }}
            >
              <JsonPreview data={data} label={entryKey} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
