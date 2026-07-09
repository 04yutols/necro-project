'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { RarityBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';

type SubOption = { type: string; value: number };
type Item = {
  id?: string;
  name?: string;
  rarity?: string;
  archetype?: string;
  rank?: number;
  ilv?: number;
  subOptions?: SubOption[];
  passiveA?: { nameJa?: string };
  passiveB?: { nameJa?: string };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const RARITIES = ['R', 'SR', 'SSR', 'UR'];
const ARCHETYPES = ['LOW', 'MID', 'HIGH', 'MYTHIC'];
const RARITY_ORDER: Record<string, number> = { R: 0, SR: 1, SSR: 2, UR: 3 };
const SORT_KEYS = [{ key: 'rarity', label: 'rarity' }, { key: 'rank', label: 'rank' }];

export default function ItemsList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [archetype, setArchetype] = useState('');
  const [sortKey, setSortKey] = useState('rarity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Item }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) || (raw.name ?? '').toLowerCase().includes(q)
    );
    if (rarity) list = list.filter(({ raw }) => raw.rarity === rarity);
    if (archetype) list = list.filter(({ raw }) => raw.archetype === archetype);
    if (sortKey === 'rarity') {
      list = list.sort((a, b) => {
        const av = RARITY_ORDER[a.raw.rarity ?? ''] ?? 0;
        const bv = RARITY_ORDER[b.raw.rarity ?? ''] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    } else if (sortKey === 'rank') {
      list = list.sort((a, b) => {
        const av = a.raw.rank ?? 0;
        const bv = b.raw.rank ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, rarity, archetype, sortKey, sortDir]);

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
          {
            chips: [
              { label: 'ALL', value: '', active: archetype === '', onClick: () => setArchetype('') },
              ...ARCHETYPES.map((a) => ({ label: a, value: a, active: archetype === a, onClick: () => setArchetype(a) })),
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
            editHref={`/admin/items/${key}`}
            summary={
              <>
                {raw.rarity && <RarityBadge rarity={raw.rarity} />}
                {raw.archetype && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}>
                    {raw.archetype}
                  </span>
                )}
                <span style={{ fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, color: '#e0d0ff' }}>{raw.name ?? key}</span>
                {/* SubOption types */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                  {(raw.subOptions ?? []).map((opt, i) => (
                    <span key={i} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: /DMG_BOOST$/.test(opt.type ?? '') ? 'rgba(251,191,36,0.12)' : 'rgba(139,0,255,0.1)',
                      color: /DMG_BOOST$/.test(opt.type ?? '') ? '#fbbf24' : '#a78bfa',
                      fontFamily: 'Space Mono, monospace', border: '1px solid rgba(139,0,255,0.18)',
                    }}>
                      {opt.type}
                    </span>
                  ))}
                </div>
                <span className="ml-auto flex flex-col items-end text-[10px] font-mono shrink-0 gap-0.5">
                  {raw.ilv != null && (
                    <span style={{ color: '#8080a0' }}>ILv.{raw.ilv}</span>
                  )}
                  {raw.passiveA?.nameJa && <span style={{ color: '#fde68a' }}>{raw.passiveA.nameJa}</span>}
                  {raw.passiveB?.nameJa && <span style={{ color: '#7878a8' }}>{raw.passiveB.nameJa}</span>}
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
