import Link from 'next/link';
import { getMasterFile } from '../actions';
import ItemsList from '@/components/admin/ItemsList';

export default async function ItemsPage() {
  const data = await getMasterFile('items');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
            武器・アイテムデータ
          </h2>
          <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
            items.json — {count} エントリ
          </p>
        </div>
        <Link href="/admin/items/new" style={{ background: 'rgba(139,0,255,0.18)', border: '1px solid rgba(139,0,255,0.4)', color: '#d8b4fe', padding: '7px 16px', borderRadius: 6, fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          + 新規作成
        </Link>
      </div>
      <ItemsList data={data} />
    </div>
  );
}
