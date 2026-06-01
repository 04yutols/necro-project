'use client';

import { useState } from 'react';

type Props = {
  data: unknown;
};

export default function JsonSidebar({ data }: Props) {
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2);

  async function handleCopy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 56,
        maxHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>
          JSON プレビュー
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? '#86efac' : '#a1a1aa',
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'Space Grotesk, sans-serif',
            transition: 'all 0.2s ease',
          }}
        >
          {copied ? 'コピー済' : 'コピー'}
        </button>
      </div>

      <pre
        style={{
          background: '#0d0d16',
          border: '1px solid rgba(139,0,255,0.15)',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 11,
          lineHeight: 1.6,
          color: '#c8c8d8',
          fontFamily: 'monospace',
          overflowX: 'auto',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {json}
      </pre>
    </div>
  );
}
