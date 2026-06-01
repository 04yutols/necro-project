'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { ElementBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';

type Skill = {
  id?: string;
  name?: string;
  element?: string;
  targetType?: string;
  type?: string;
  power?: number;
  mpCost?: number;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
const TARGET_TYPES = ['SINGLE', 'ALL_ENEMIES', 'ALL_ALLIES', 'SELF', 'PARTY'];
const SKILL_TYPES = ['PHYSICAL', 'MAGICAL', 'SUPPORT'];
const SORT_KEYS = [
  { key: 'power', label: 'power' },
  { key: 'mpCost', label: 'MP' },
];

export default function SkillsList({ data }: Props) {
  const [search, setSearch] = useState('');
  const [element, setElement] = useState('');
  const [targetType, setTargetType] = useState('');
  const [skillType, setSkillType] = useState('');
  const [sortKey, setSortKey] = useState('power');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Skill }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) || (raw.name ?? '').toLowerCase().includes(q)
    );
    if (element) list = list.filter(({ raw }) => raw.element === element);
    if (targetType) list = list.filter(({ raw }) => raw.targetType === targetType);
    if (skillType) list = list.filter(({ raw }) => raw.type === skillType);
    if (sortKey) {
      list = list.sort((a, b) => {
        const av = (a.raw as Record<string, unknown>)[sortKey] as number ?? 0;
        const bv = (b.raw as Record<string, unknown>)[sortKey] as number ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, element, targetType, skillType, sortKey, sortDir]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            chips: [
              { label: 'ALL', value: '', active: element === '', onClick: () => setElement('') },
              ...ELEMENTS.map((e) => ({ label: e, value: e, active: element === e, onClick: () => setElement(e) })),
            ],
          },
          {
            chips: [
              { label: 'ALL', value: '', active: targetType === '', onClick: () => setTargetType('') },
              ...TARGET_TYPES.map((t) => ({ label: t, value: t, active: targetType === t, onClick: () => setTargetType(t) })),
            ],
          },
          {
            chips: [
              { label: 'ALL', value: '', active: skillType === '', onClick: () => setSkillType('') },
              ...SKILL_TYPES.map((t) => ({ label: t, value: t, active: skillType === t, onClick: () => setSkillType(t) })),
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
            editHref={`/admin/skills/${key}`}
            summary={
              <>
                {raw.element && <ElementBadge element={raw.element} />}
                {raw.targetType && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}>
                    {raw.targetType}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>{raw.name ?? key}</span>
                <span className="ml-auto flex items-center gap-3 text-[10px] font-mono shrink-0">
                  {raw.power != null && <span style={{ color: '#f87171' }}>P:{raw.power}</span>}
                  {raw.mpCost != null && <span style={{ color: '#93c5fd' }}>MP:{raw.mpCost}</span>}
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
