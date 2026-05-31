'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AuditFinding, AuditLevel } from '@/app/admin/actions';

const LEVEL_STYLES: Record<AuditLevel, { bg: string; color: string; border: string; label: string }> = {
  PASS: {
    bg: 'rgba(6,78,59,0.12)',
    color: '#6ee7b7',
    border: 'rgba(6,78,59,0.4)',
    label: 'PASS',
  },
  WARN: {
    bg: 'rgba(113,63,18,0.18)',
    color: '#fde68a',
    border: 'rgba(113,63,18,0.5)',
    label: 'WARN',
  },
  FAIL: {
    bg: 'rgba(127,29,29,0.18)',
    color: '#fca5a5',
    border: 'rgba(127,29,29,0.5)',
    label: 'FAIL',
  },
};

const SCOPE_HREF: Record<string, string> = {
  enemies: '/admin/enemies',
  stages: '/admin/stages',
  jobs: '/admin/jobs',
  skills: '/admin/skills',
  items: '/admin/items',
  materials: '/admin/materials',
  monsters: '/admin/monsters',
  demonForms: '/admin/demon-forms',
};

type Props = {
  findings: AuditFinding[];
};

const TABS: AuditLevel[] = ['FAIL', 'WARN', 'PASS'];

export default function AuditPanel({ findings }: Props) {
  const [activeTab, setActiveTab] = useState<AuditLevel>('FAIL');
  const [showAll, setShowAll] = useState(false);

  const counts = {
    FAIL: findings.filter((f) => f.level === 'FAIL').length,
    WARN: findings.filter((f) => f.level === 'WARN').length,
    PASS: findings.filter((f) => f.level === 'PASS').length,
  };

  const filtered = findings.filter((f) => f.level === activeTab);
  const visible = showAll ? filtered : filtered.slice(0, 50);

  return (
    <div>
      {/* Summary bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5"
        style={{ background: '#111118', border: '1px solid rgba(139,0,255,0.18)' }}
      >
        <span className="text-xs font-space" style={{ color: '#7878a8' }}>
          検出結果:
        </span>
        {TABS.map((level) => {
          const s = LEVEL_STYLES[level];
          return (
            <span
              key={level}
              className="text-xs font-space font-semibold px-2 py-0.5 rounded"
              style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
            >
              {counts[level]} {s.label}
            </span>
          );
        })}
        <span className="ml-auto text-xs font-mono" style={{ color: '#7878a8' }}>
          合計 {findings.length} 件
        </span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-4">
        {TABS.map((level) => {
          const s = LEVEL_STYLES[level];
          const isActive = activeTab === level;
          return (
            <button
              key={level}
              onClick={() => { setActiveTab(level); setShowAll(false); }}
              className="px-3 py-1.5 rounded text-xs font-space font-semibold transition-all"
              style={{
                background: isActive ? s.bg : 'rgba(255,255,255,0.03)',
                color: isActive ? s.color : '#7878a8',
                border: `1px solid ${isActive ? s.border : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}
            >
              {s.label} ({counts[level]})
            </button>
          );
        })}
      </div>

      {/* Findings list */}
      <div className="flex flex-col gap-1.5">
        {visible.length === 0 && (
          <div
            className="px-4 py-8 text-center rounded-lg text-xs font-space"
            style={{ color: '#7878a8', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            {activeTab} の結果はありません
          </div>
        )}
        {visible.map((finding, i) => {
          const s = LEVEL_STYLES[finding.level];
          const href = SCOPE_HREF[finding.scope];
          return (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2 rounded"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
              }}
            >
              {/* Level badge */}
              <span
                className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5"
                style={{ background: 'rgba(0,0,0,0.3)', color: s.color }}
              >
                {finding.level}
              </span>
              {/* Scope + ID */}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {href ? (
                    <Link
                      href={href}
                      className="text-[10px] font-mono underline"
                      style={{ color: '#8B00FF' }}
                    >
                      {finding.scope}
                    </Link>
                  ) : (
                    <span className="text-[10px] font-mono" style={{ color: '#8B00FF' }}>
                      {finding.scope}
                    </span>
                  )}
                  <span className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
                    {finding.id}
                  </span>
                </div>
                <p className="text-xs font-noto" style={{ color: '#c8c8d8' }}>
                  {finding.message}
                </p>
              </div>
            </div>
          );
        })}

        {/* Show more */}
        {!showAll && filtered.length > 50 && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-2 text-xs font-space py-2 rounded transition-all"
            style={{
              background: 'rgba(139,0,255,0.1)',
              border: '1px solid rgba(139,0,255,0.25)',
              color: '#d8b4fe',
              cursor: 'pointer',
            }}
          >
            残り {filtered.length - 50} 件を表示
          </button>
        )}
      </div>
    </div>
  );
}
