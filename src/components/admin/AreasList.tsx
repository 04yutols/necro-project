'use client';

import { useMemo, useState } from 'react';
import AccordionEntry from './AccordionEntry';
import ListFilterBar from './forms/shared/ListFilterBar';

type Area = {
  id?: string;
  chapter?: number;
  area?: number;
  nameJa?: string;
  nameEn?: string;
  description?: string;
  color?: string;
  position?: { x?: number; y?: number };
  sortOrder?: number;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const SORT_KEYS = [
  { key: 'sortOrder', label: 'sortOrder' },
  { key: 'chapter', label: 'chapter' },
];

export default function AreasList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('sortOrder');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Area }));
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(({ key, raw }) =>
        key.toLowerCase().includes(q) ||
        (raw.nameJa ?? '').toLowerCase().includes(q) ||
        (raw.nameEn ?? '').toLowerCase().includes(q)
      );
    }
    list = list.sort((a, b) => {
      const av = sortKey === 'chapter'
        ? (a.raw.chapter ?? 0) * 100 + (a.raw.area ?? 0)
        : a.raw.sortOrder ?? (a.raw.chapter ?? 0) * 100 + (a.raw.area ?? 0);
      const bv = sortKey === 'chapter'
        ? (b.raw.chapter ?? 0) * 100 + (b.raw.area ?? 0)
        : b.raw.sortOrder ?? (b.raw.chapter ?? 0) * 100 + (b.raw.area ?? 0);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [data, search, sortDir, sortKey]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        sortKeys={SORT_KEYS}
        activeSort={sortKey}
        sortDir={sortDir}
        onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); }}
        count={entries.length}
        total={total}
      />
      <div className="flex flex-col gap-2">
        {entries.map(({ key, raw }) => (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={data[key]}
            editHref={`/admin/areas/${key}`}
            summary={
              <>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'rgba(255,255,255,0.06)', color: raw.color ?? '#7878a8' }}
                >
                  CH{raw.chapter ?? '?'}-AREA{raw.area ?? '?'}
                </span>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: raw.color ?? '#8A2BE2',
                    boxShadow: `0 0 12px ${raw.color ?? '#8A2BE2'}55`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, color: '#e0d0ff' }}>
                  {raw.nameJa ?? key}
                </span>
                <span className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
                  {raw.nameEn ?? ''}
                </span>
                <span className="ml-auto text-[10px] font-mono" style={{ color: '#7878a8' }}>
                  ({raw.position?.x ?? '?'}, {raw.position?.y ?? '?'})
                </span>
              </>
            }
          />
        ))}
        {entries.length === 0 && (
          <p style={{ color: '#7878a8', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>該当するエントリがありません</p>
        )}
      </div>
    </div>
  );
}
