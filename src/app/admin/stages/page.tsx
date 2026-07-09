import Link from 'next/link';
import { getMasterFile } from '../actions';
import StagesList from '@/components/admin/StagesList';

export default async function StagesPage() {
  const [data, areas] = await Promise.all([
    getMasterFile('stages'),
    getMasterFile('areas'),
  ]);
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
            ステージデータ
          </h2>
          <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
            stages.json — {count} エントリ / エリア別に作成・編集
          </p>
        </div>
        <Link
          href="/admin/stages/new"
          style={{ background: 'rgba(139,0,255,0.18)', border: '1px solid rgba(139,0,255,0.4)', color: '#d8b4fe', padding: '7px 16px', borderRadius: 6, fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          + エリア未指定で作成
        </Link>
      </div>
      <StagesList data={data} areas={areas} />
    </div>
  );
}
