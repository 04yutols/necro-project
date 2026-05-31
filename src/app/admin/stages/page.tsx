import { getMasterFile } from '../actions';
import StagesList from '@/components/admin/StagesList';

export default async function StagesPage() {
  const data = await getMasterFile('stages');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          ステージデータ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          stages.json — {count} エントリ
        </p>
      </div>
      <StagesList data={data} />
    </div>
  );
}
