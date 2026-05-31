'use client';

import { useState } from 'react';

type Props = {
  data: unknown;
  label?: string;
};

export default function JsonPreview({ data, label }: Props) {
  const [copied, setCopied] = useState(false);
  const formatted = JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        background: '#060610',
        border: '1px solid rgba(139,0,255,0.15)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid rgba(139,0,255,0.12)', background: '#0a0a18' }}
      >
        <span className="text-xs font-space" style={{ color: '#7878a8' }}>
          {label ?? 'JSON'}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-0.5 rounded transition-all"
          style={{
            background: copied ? 'rgba(139,0,255,0.22)' : 'rgba(139,0,255,0.1)',
            border: '1px solid rgba(139,0,255,0.3)',
            color: copied ? '#d8b4fe' : '#9878c8',
            cursor: 'pointer',
          }}
        >
          {copied ? 'コピー済み' : 'コピー'}
        </button>
      </div>

      {/* Code block */}
      <pre
        className="text-xs font-mono overflow-auto"
        style={{
          padding: '12px 14px',
          color: '#b8c8e8',
          maxHeight: 400,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {formatted}
      </pre>
    </div>
  );
}
