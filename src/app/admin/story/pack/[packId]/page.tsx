import { getStoryScenesForPack, getStoryPackSummaries } from '../../../actions';
import StoryScenesList from '@/components/admin/StoryScenesList';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function StoryPackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const [scenes, summaries] = await Promise.all([
    getStoryScenesForPack(packId),
    getStoryPackSummaries(),
  ]);

  if (!scenes) notFound();

  const pack = summaries.find((p) => p.id === packId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/admin/story"
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8080a0', fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ← 章一覧
          </Link>
          <div>
            <h1
              className="font-cinzel text-xl font-bold tracking-widest uppercase"
              style={{ color: '#e0d0ff', textShadow: '0 0 16px rgba(139,0,255,0.4)' }}
            >
              {pack?.label ?? packId}
            </h1>
            <p className="text-xs font-space mt-0.5" style={{ color: '#7878a8' }}>
              {scenes.length} シーン · {pack?.fileName}
            </p>
          </div>
        </div>
        <Link
          href={`/admin/story/new?packId=${packId}`}
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
      <StoryScenesList scenes={scenes} />
    </div>
  );
}
