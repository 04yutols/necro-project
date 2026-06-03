import Link from 'next/link';
import { getAllMasterData, getStoryPackSummaries, getStoryScenes } from './actions';

const SECTION_META = [
  { key: 'enemies', label: '敵', href: '/admin/enemies', icon: '☠', desc: 'enemies.json' },
  { key: 'stages', label: 'ステージ', href: '/admin/stages', icon: '⚑', desc: 'stages.json' },
  { key: 'jobs', label: '職業', href: '/admin/jobs', icon: '⚔', desc: 'jobs.json' },
  { key: 'skills', label: 'スキル', href: '/admin/skills', icon: '✦', desc: 'skills.json' },
  { key: 'items', label: '武器', href: '/admin/items', icon: '◈', desc: 'items.json' },
  { key: 'materials', label: '素材', href: '/admin/materials', icon: '◇', desc: 'materials.json' },
  { key: 'monsters', label: '魔物', href: '/admin/monsters', icon: '♟', desc: 'monsters.json' },
  { key: 'demonForms', label: '魔神化', href: '/admin/demon-forms', icon: '☾', desc: 'demonForms.json' },
] as const;

export default async function AdminDashboard() {
  const [data, storyScenes, storyPacks] = await Promise.all([
    getAllMasterData(),
    getStoryScenes(),
    getStoryPackSummaries(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1
          className="font-cinzel text-xl font-bold tracking-widest uppercase mb-1"
          style={{ color: '#e0d0ff', textShadow: '0 0 16px rgba(139,0,255,0.4)' }}
        >
          NECRO ADMIN
        </h1>
        <p className="text-xs font-space" style={{ color: '#7878a8' }}>
          Master Data Studio — 章別ストーリーJSON対応
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {SECTION_META.map((sec) => {
          const count = Object.keys(data[sec.key]).length;
          return (
            <Link
              key={sec.key}
              href={sec.href}
              className="block rounded-lg p-4"
              style={{
                background: '#111118',
                border: '1px solid rgba(139,0,255,0.18)',
                textDecoration: 'none',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-lg" style={{ color: '#8B00FF' }}>
                  {sec.icon}
                </span>
                <span className="text-2xl font-cinzel font-bold" style={{ color: '#c8b4f8' }}>
                  {count}
                </span>
              </div>
              <div className="text-sm font-space font-semibold mb-1" style={{ color: '#e0d0ff' }}>
                {sec.label}
              </div>
              <div className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
                {sec.desc}
              </div>
            </Link>
          );
        })}
        {/* Story card */}
        <Link
          href="/admin/story"
          className="block rounded-lg p-4"
          style={{
            background: '#111118',
            border: '1px solid rgba(139,0,255,0.28)',
            textDecoration: 'none',
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-lg" style={{ color: '#8B00FF' }}>◎</span>
            <span className="text-2xl font-cinzel font-bold" style={{ color: '#c8b4f8' }}>
              {storyScenes.length}
            </span>
          </div>
          <div className="text-sm font-space font-semibold mb-1" style={{ color: '#e0d0ff' }}>
            ストーリー
          </div>
          <div className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
            章別JSON · {storyPacks.length} packs
          </div>
        </Link>
      </div>

      <div className="mt-8 flex gap-3 flex-wrap">
        <Link
          href="/admin/audit"
          className="px-4 py-2 rounded text-xs font-space font-semibold tracking-wide"
          style={{
            background: 'rgba(139,0,255,0.12)',
            border: '1px solid rgba(139,0,255,0.3)',
            color: '#c084fc',
            textDecoration: 'none',
          }}
        >
          データ監査を実行 →
        </Link>
        <Link
          href="/admin/simulator"
          className="px-4 py-2 rounded text-xs font-space font-semibold tracking-wide"
          style={{
            background: 'rgba(139,0,255,0.12)',
            border: '1px solid rgba(139,0,255,0.3)',
            color: '#c084fc',
            textDecoration: 'none',
          }}
        >
          ダメージシミュレータ →
        </Link>
      </div>
    </div>
  );
}
