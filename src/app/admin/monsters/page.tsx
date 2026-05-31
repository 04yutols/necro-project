import { getMasterFile } from '../actions';
import MonstersList from '@/components/admin/MonstersList';

export default async function MonstersPage() {
  const data = await getMasterFile('monsters');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          編成モンスターデータ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          monsters.json — {count} エントリ
        </p>
      </div>
      <MonstersList data={data} />
    </div>
  );
}
