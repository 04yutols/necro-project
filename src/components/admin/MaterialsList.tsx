'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { RarityBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';

type Material = {
  id?: string;
  name?: string;
  rarity?: string;
  expValue?: number;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const SORT_KEYS = [{ key: 'expValue', label: 'EXP' }];

export default function MaterialsList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Material }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) || (raw.name ?? '').toLowerCase().includes(q)
    );
    if (rarity) list = list.filter(({ raw }) => raw.rarity === rarity);
    if (sortKey === 'expValue') {
      list = list.sort((a, b) => {
        const av = a.raw.expValue ?? 0;
        const bv = b.raw.expValue ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, rarity, sortKey, sortDir]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            chips: [
              { label: 'ALL', value: '', active: rarity === '', onClick: () => setRarity('') },
              ...RARITIES.map((r) => ({ label: r, value: r, active: rarity === r, onClick: () => setRarity(r) })),
            ],
          },
        ]}
        sortKeys={SORT_KEYS}
        activeSort={sortKey}
        sortDir={sortDir}
        onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
        count={entries.length}
        total={total}
      />
      <div className="flex flex-col gap-2">
        {entries.map(({ key, raw }) => (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={data[key]}
            editHref={`/admin/materials/${key}`}
            summary={
              <>
                {raw.rarity && <RarityBadge rarity={raw.rarity} />}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>{raw.name ?? key}</span>
                {raw.expValue != null && (
                  <span className="ml-auto text-[10px] font-mono shrink-0" style={{ color: '#fde68a' }}>EXP +{raw.expValue}</span>
                )}
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
