import { getMasterFile } from '../actions';
import EnemiesList from '@/components/admin/EnemiesList';

export default async function EnemiesPage() {
  const data = await getMasterFile('enemies');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          敵データ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          enemies.json — {count} エントリ
        </p>
      </div>
      <EnemiesList data={data} />
    </div>
  );
}
