import { getStoryScenes } from '../actions';
import StoryScenesList from '@/components/admin/StoryScenesList';
import Link from 'next/link';

export default async function StoryPage() {
  const scenes = await getStoryScenes();
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1
            className="font-cinzel text-xl font-bold tracking-widest uppercase"
            style={{ color: '#e0d0ff', textShadow: '0 0 16px rgba(139,0,255,0.4)' }}
          >
            STORY EDITOR
          </h1>
          <p className="text-xs font-space mt-1" style={{ color: '#7878a8' }}>
            ch1_scenes.json — {scenes.length} シーン
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
          <Link
            href="/admin/story/new"
            style={{
              height: 40, padding: '0 20px', borderRadius: 8,
              background: 'rgba(139,0,255,0.2)',
              border: '1px solid rgba(139,0,255,0.5)',
              color: '#d8b4fe', fontSize: 13, fontWeight: 600,
              fontFamily: 'Space Grotesk, sans-serif',
              textDecoration: 'none', display: 'flex', alignItems: 'center',
            }}
          >
            + 新規シーン
          </Link>
        </div>
      </div>
      <StoryScenesList scenes={scenes} />
    </div>
  );
}
