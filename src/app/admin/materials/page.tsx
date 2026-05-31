import { getMasterFile } from '../actions';
import MaterialsList from '@/components/admin/MaterialsList';

export default async function MaterialsPage() {
  const data = await getMasterFile('materials');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          素材データ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          materials.json — {count} エントリ
        </p>
      </div>
      <MaterialsList data={data} />
    </div>
  );
}
