'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/enemies', label: '敵' },
  { href: '/admin/stages', label: 'ステージ' },
  { href: '/admin/jobs', label: '職業' },
  { href: '/admin/skills', label: 'スキル' },
  { href: '/admin/items', label: '武器' },
  { href: '/admin/materials', label: '素材' },
  { href: '/admin/monsters', label: '魔物' },
  { href: '/admin/demon-forms', label: '魔神化' },
  { href: '/admin/audit', label: '監査' },
  { href: '/admin/simulator', label: 'シミュ' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 flex items-center gap-1 px-4 overflow-x-auto"
      style={{
        height: 48,
        background: '#0d0d14',
        borderBottom: '1px solid rgba(139,0,255,0.3)',
        scrollbarWidth: 'none',
      }}
    >
      {/* Logo */}
      <span
        className="shrink-0 mr-3 text-xs font-cinzel font-bold tracking-widest"
        style={{ color: '#8B00FF', textShadow: '0 0 8px rgba(139,0,255,0.6)' }}
      >
        NECRO
        <span style={{ color: '#7878a8' }}> ADMIN</span>
      </span>

      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 px-3 py-1 rounded text-xs font-space transition-all"
            style={{
              color: isActive ? '#e0d0ff' : '#7878a8',
              background: isActive ? 'rgba(139,0,255,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(139,0,255,0.35)' : '1px solid transparent',
              fontWeight: isActive ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
