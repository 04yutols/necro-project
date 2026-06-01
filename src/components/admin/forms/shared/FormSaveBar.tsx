'use client';

import Link from 'next/link';

type Props = {
  backHref: string;
  title: string;
  onSave: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  saving: boolean;
  isNew: boolean;
  entryKey: string;
};

export default function FormSaveBar({ backHref, title, onSave, onCopy, onDelete, saving, isNew }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 28,
        paddingBottom: 20,
        borderBottom: '1px solid rgba(139,0,255,0.18)',
        flexWrap: 'wrap',
      }}
    >
      <Link
        href={backHref}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 38,
          padding: '0 14px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#9090b0',
          fontSize: 13,
          fontFamily: 'Space Grotesk, sans-serif',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = '#e0d0ff';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = '#9090b0';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        ← 一覧へ
      </Link>

      <h2
        style={{
          color: '#e0d0ff',
          fontSize: 16,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          margin: 0,
        }}
      >
        {title}
        {isNew && (
          <span
            style={{
              color: '#7878a8',
              fontSize: 12,
              marginLeft: 10,
              fontWeight: 400,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            新規作成
          </span>
        )}
      </h2>

      <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          onClick={onCopy}
          style={{
            height: 40,
            padding: '0 18px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#9090b0',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'Space Grotesk, sans-serif',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
            (e.currentTarget as HTMLButtonElement).style.color = '#e0d0ff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = '#9090b0';
          }}
        >
          JSONコピー
        </button>

        {!isNew && onDelete && (
          <button
            onClick={onDelete}
            style={{
              height: 40,
              padding: '0 18px',
              background: 'rgba(127,29,29,0.18)',
              border: '1px solid rgba(220,38,38,0.35)',
              color: '#fca5a5',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(127,29,29,0.32)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(220,38,38,0.6)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(127,29,29,0.18)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(220,38,38,0.35)';
            }}
          >
            削除
          </button>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          style={{
            height: 44,
            padding: '0 32px',
            background: saving ? 'rgba(139,0,255,0.08)' : 'rgba(139,0,255,0.25)',
            border: `1px solid ${saving ? 'rgba(139,0,255,0.2)' : 'rgba(139,0,255,0.6)'}`,
            color: saving ? '#7878a8' : '#e0d0ff',
            borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 15,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
            boxShadow: saving ? 'none' : '0 0 16px rgba(139,0,255,0.2)',
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,255,0.4)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(139,0,255,0.35)';
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,255,0.25)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(139,0,255,0.2)';
            }
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
