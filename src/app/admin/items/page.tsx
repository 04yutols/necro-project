import { getMasterFile } from '../actions';
import ItemsList from '@/components/admin/ItemsList';

export default async function ItemsPage() {
  const data = await getMasterFile('items');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          武器・アイテムデータ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          items.json — {count} エントリ
        </p>
      </div>
      <ItemsList data={data} />
    </div>
  );
}
