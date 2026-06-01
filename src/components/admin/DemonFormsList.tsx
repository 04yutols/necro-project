'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import ListFilterBar from './forms/shared/ListFilterBar';

type DemonForm = {
  jobId?: string;
  formName?: string;
  tier?: number;
  concept?: string;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const SORT_KEYS = [{ key: 'tier', label: 'Tier' }];

export default function DemonFormsList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [sortKey, setSortKey] = useState('tier');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as DemonForm }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) ||
      (raw.formName ?? '').toLowerCase().includes(q) ||
      (raw.jobId ?? '').toLowerCase().includes(q)
    );
    if (tier) list = list.filter(({ raw }) => String(raw.tier) === tier);
    if (sortKey === 'tier') {
      list = list.sort((a, b) => {
        const av = a.raw.tier ?? 99;
        const bv = b.raw.tier ?? 99;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, tier, sortKey, sortDir]);

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
              { label: 'Tier1', value: '1', active: tier === '1', onClick: () => setTier('1') },
              { label: 'Tier2', value: '2', active: tier === '2', onClick: () => setTier('2') },
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
            editHref={`/admin/demon-forms/${key}`}
            summary={
              <>
                {raw.tier != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{
                    background: raw.tier === 1 ? 'rgba(30,58,138,0.5)' : 'rgba(88,28,135,0.5)',
                    color: raw.tier === 1 ? '#93c5fd' : '#d8b4fe',
                  }}>
                    Tier {raw.tier}
                  </span>
                )}
                {raw.jobId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: 'rgba(139,0,255,0.15)', color: '#8B00FF' }}>
                    {raw.jobId}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>{raw.formName ?? key}</span>
                {raw.concept && (
                  <span className="ml-2 text-[10px] font-noto truncate hidden sm:block" style={{ color: '#7878a8', maxWidth: 240 }}>
                    {raw.concept}
                  </span>
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
