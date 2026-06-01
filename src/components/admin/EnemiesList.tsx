'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { TierBadge, TribeBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';

type Enemy = {
  id?: string;
  name?: string;
  nameJa?: string;
  tier?: string;
  tribe?: string;
  stats?: { hp?: number; atk?: number; def?: number; spd?: number };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const TIERS = ['MINION', 'ELITE', 'BOSS'];
const TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'];
const SORT_KEYS = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'spd', label: 'SPD' },
];

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: '#7878a8', width: 28, flexShrink: 0 }}>{label}</span>
      <div style={{ width: 52, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(139,0,255,0.75)', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', color: '#c8c8d8', minWidth: 22 }}>{value}</span>
    </div>
  );
}

export default function EnemiesList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [tribe, setTribe] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Enemy }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) ||
      (raw.nameJa ?? '').toLowerCase().includes(q) ||
      (raw.name ?? '').toLowerCase().includes(q)
    );
    if (tier) list = list.filter(({ raw }) => raw.tier === tier);
    if (tribe) list = list.filter(({ raw }) => raw.tribe === tribe);
    if (sortKey) {
      list = list.sort((a, b) => {
        const av = (a.raw.stats as Record<string, number> | undefined)?.[sortKey] ?? 0;
        const bv = (b.raw.stats as Record<string, number> | undefined)?.[sortKey] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, tier, tribe, sortKey, sortDir]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            chips: [
              { label: 'ALL', value: '', active: tier === '', onClick: () => setTier('') },
              ...TIERS.map((t) => ({ label: t, value: t, active: tier === t, onClick: () => setTier(t) })),
            ],
          },
          {
            chips: [
              { label: 'ALL', value: '', active: tribe === '', onClick: () => setTribe('') },
              ...TRIBES.map((t) => ({ label: t, value: t, active: tribe === t, onClick: () => setTribe(t) })),
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
          const entry = raw;
          const stats = entry.stats ?? {};
          return (
            <AccordionEntry
              key={key}
              entryKey={key}
              data={data[key]}
              editHref={`/admin/enemies/${key}`}
              summary={
                <>
                  {entry.tier && <TierBadge tier={entry.tier} />}
                  {entry.tribe && <TribeBadge tribe={entry.tribe} />}
                  <span style={{ fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, color: '#e0d0ff' }}>
                    {entry.nameJa ?? entry.name ?? key}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: '#7878a8' }}>{entry.name}</span>
                  <div className="flex gap-2 flex-wrap ml-auto">
                    {stats.hp != null && <StatBar label="HP" value={stats.hp} max={200} />}
                    {stats.atk != null && <StatBar label="ATK" value={stats.atk} max={80} />}
                    {stats.def != null && <StatBar label="DEF" value={stats.def} max={60} />}
                    {stats.spd != null && <StatBar label="SPD" value={stats.spd} max={200} />}
                  </div>
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
