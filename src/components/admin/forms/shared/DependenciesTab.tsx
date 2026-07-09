'use client';

import Link from 'next/link';
import type { DependencyRef } from '@/app/admin/actions';

const SCOPE_LABELS: Record<string, string> = {
  areas: 'エリア',
  stages: 'ステージ',
  jobs: '職業',
  enemies: '敵',
  demonForms: '魔神化',
  items: 'アイテム',
  materials: '素材',
  monsters: '魔物',
  skills: 'スキル',
};

const SCOPE_COLORS: Record<string, string> = {
  areas: '#8A2BE2',
  stages: '#60a5fa',
  jobs: '#a78bfa',
  enemies: '#f87171',
  demonForms: '#c084fc',
  items: '#34d399',
  materials: '#fbbf24',
  monsters: '#fb923c',
  skills: '#38bdf8',
};

type Props = {
  refs: DependencyRef[];
};

export default function DependenciesTab({ refs }: Props) {
  if (refs.length === 0) {
    return (
      <div
        style={{
          padding: '32px 20px',
          textAlign: 'center',
          color: '#7878a8',
          fontSize: 13,
          fontFamily: 'Space Grotesk, sans-serif',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          border: '1px dashed rgba(139,0,255,0.15)',
        }}
      >
        このエントリを参照しているデータはありません
      </div>
    );
  }

  const grouped = refs.reduce<Record<string, DependencyRef[]>>((acc, ref) => {
    if (!acc[ref.scope]) acc[ref.scope] = [];
    acc[ref.scope].push(ref);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.entries(grouped).map(([scope, items]) => (
        <div key={scope}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SCOPE_COLORS[scope] ?? '#7878a8',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: SCOPE_COLORS[scope] ?? '#7878a8',
                fontSize: 11,
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {SCOPE_LABELS[scope] ?? scope}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#7878a8',
                fontFamily: 'monospace',
              }}
            >
              {items.length} 件
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((ref, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: '#111118',
                  border: '1px solid rgba(139,0,255,0.12)',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#8B00FF',
                    flexShrink: 0,
                  }}
                >
                  {ref.id}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: '#e0d0ff',
                    fontFamily: 'Space Grotesk, sans-serif',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {ref.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#7878a8',
                    fontFamily: 'Space Grotesk, sans-serif',
                    flexShrink: 0,
                  }}
                >
                  {ref.context}
                </span>
                <Link
                  href={ref.href}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(139,0,255,0.10)',
                    border: '1px solid rgba(139,0,255,0.25)',
                    color: '#a78bfa',
                    textDecoration: 'none',
                    flexShrink: 0,
                    fontFamily: 'Space Grotesk, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  開く →
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
