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
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(139,0,255,0.15)',
        flexWrap: 'wrap',
      }}
    >
      <Link
        href={backHref}
        style={{
          color: '#7878a8',
          fontSize: 12,
          fontFamily: 'Space Grotesk, sans-serif',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
        }}
      >
        ← 一覧へ
      </Link>

      <h2
        style={{
          color: '#e0d0ff',
          fontSize: 14,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
        }}
      >
        {title}
        {isNew && (
          <span style={{ color: '#7878a8', fontSize: 11, marginLeft: 8 }}>(新規作成)</span>
        )}
      </h2>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onCopy}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#a1a1aa',
            padding: '7px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          JSONコピー
        </button>

        {!isNew && onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: 'rgba(127,29,29,0.22)',
              border: '1px solid rgba(220,38,38,0.4)',
              color: '#fca5a5',
              padding: '7px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            削除
          </button>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: saving ? 'rgba(139,0,255,0.10)' : 'rgba(139,0,255,0.22)',
            border: '1px solid rgba(139,0,255,0.5)',
            color: saving ? '#7878a8' : '#d8b4fe',
            padding: '7px 20px',
            borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
