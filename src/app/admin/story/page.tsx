import { getStoryPackSummaries } from '../actions';
import Link from 'next/link';

export default async function StoryPage() {
  const storyPacks = await getStoryPackSummaries();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1
            className="font-cinzel text-xl font-bold tracking-widest uppercase"
            style={{ color: '#e0d0ff', textShadow: '0 0 16px rgba(139,0,255,0.4)' }}
          >
            STORY EDITOR
          </h1>
          <p className="text-xs font-space mt-1" style={{ color: '#7878a8' }}>
            章を選んでシーンを編集してください — {storyPacks.length} パック
          </p>
        </div>
        <Link
          href="/admin/story/characters"
          style={{
            height: 40, padding: '0 18px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#9090b0', fontSize: 13,
            fontFamily: 'Space Grotesk, sans-serif',
            textDecoration: 'none', display: 'flex', alignItems: 'center',
          }}
        >
          キャラクター管理
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {storyPacks.map((pack) => (
          <Link
            key={pack.id}
            href={`/admin/story/pack/${pack.id}`}
            style={{
              display: 'block', borderRadius: 12, padding: 24,
              background: '#111118',
              border: '1px solid rgba(139,0,255,0.2)',
              textDecoration: 'none',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 24, color: '#8B00FF' }}>◎</span>
              <span style={{
                fontSize: 28, fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#c8b4f8',
              }}>
                {pack.sceneCount}
              </span>
            </div>
            <div style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, color: '#e0d0ff', marginBottom: 6 }}>
              {pack.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: '#7878a8' }}>
                {pack.fileName}
              </span>
              <span style={{ fontSize: 12, color: '#8B00FF', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
                編集 →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
