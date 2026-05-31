import { getMasterFile } from '../actions';
import DemonFormsList from '@/components/admin/DemonFormsList';

export default async function DemonFormsPage() {
  const data = await getMasterFile('demonForms');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          魔神化フォームデータ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          demonForms.json — {count} エントリ
        </p>
      </div>
      <DemonFormsList data={data} />
    </div>
  );
}
