'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { TribeBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';

type Monster = {
  name?: string;
  tribe?: string;
  cost?: number;
  stats?: { hp?: number; atk?: number };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'];
const COSTS = ['1', '2', '3', '4', '5'];
const SORT_KEYS = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'cost', label: 'COST' },
];

export default function MonstersList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [tribe, setTribe] = useState('');
  const [cost, setCost] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Monster }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) || (raw.name ?? '').toLowerCase().includes(q)
    );
    if (tribe) list = list.filter(({ raw }) => raw.tribe === tribe);
    if (cost) list = list.filter(({ raw }) => String(raw.cost) === cost);
    if (sortKey) {
      list = list.sort((a, b) => {
        let av = 0; let bv = 0;
        if (sortKey === 'hp' || sortKey === 'atk') {
          av = (a.raw.stats as Record<string, number> | undefined)?.[sortKey] ?? 0;
          bv = (b.raw.stats as Record<string, number> | undefined)?.[sortKey] ?? 0;
        } else if (sortKey === 'cost') {
          av = a.raw.cost ?? 0;
          bv = b.raw.cost ?? 0;
        }
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, tribe, cost, sortKey, sortDir]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            chips: [
              { label: 'ALL', value: '', active: tribe === '', onClick: () => setTribe('') },
              ...TRIBES.map((t) => ({ label: t, value: t, active: tribe === t, onClick: () => setTribe(t) })),
            ],
          },
          {
            chips: [
              { label: 'ALL', value: '', active: cost === '', onClick: () => setCost('') },
              ...COSTS.map((c) => ({ label: `Cost ${c}`, value: c, active: cost === c, onClick: () => setCost(c) })),
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
        {entries.map(({ key, raw }) => {
          const stats = raw.stats ?? {};
          return (
            <AccordionEntry
              key={key}
              entryKey={key}
              data={data[key]}
              editHref={`/admin/monsters/${key}`}
              summary={
                <>
                  {raw.tribe && <TribeBadge tribe={raw.tribe} />}
                  {raw.cost != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: 'rgba(88,28,135,0.4)', color: '#d8b4fe' }}>
                      Cost {raw.cost}
                    </span>
                  )}
                  <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>{raw.name ?? key}</span>
                  <span className="ml-auto flex items-center gap-3 text-[10px] font-mono shrink-0">
                    {stats.hp != null && <span style={{ color: '#6ee7b7' }}>HP:{stats.hp}</span>}
                    {stats.atk != null && <span style={{ color: '#f87171' }}>ATK:{stats.atk}</span>}
                  </span>
                </>
              }
            />
          );
        })}
        {entries.length === 0 && (
          <p style={{ color: '#7878a8', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>該当するエントリがありません</p>
        )}
      </div>
    </div>
  );
}
