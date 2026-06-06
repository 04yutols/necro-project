'use client';

import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { NodeTypeBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';
import { buildStageAreaOptions, getStageAreaMasterId, resolveStageArea } from '@/logic/StageAreaLinkSystem';

type Stage = {
  nameJa?: string;
  name?: string;
  nodeType?: string;
  chapter?: number;
  area?: number;
  difficulty?: number;
  waveCount?: number;
  unlockRequires?: string[];
};

type Props = {
  data: Record<string, Record<string, unknown>>;
  areas?: Record<string, Record<string, unknown>>;
};

const NODE_TYPES = ['SAFE', 'DUNGEON', 'BOSS'];
const SORT_KEYS = [
  { key: 'difficulty', label: 'difficulty' },
  { key: 'chapter', label: 'chapter' },
];

export default function StagesList({ data, areas = {} }: Props) {
  const [search, setSearch] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [sortKey, setSortKey] = useState('chapter');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const areaOptions = useMemo(() => buildStageAreaOptions(areas), [areas]);

  const entries = useMemo(() => {
    let list = Object.entries(data).map(([key, raw]) => ({ key, raw: raw as Stage }));
    const q = search.toLowerCase();
    if (q) list = list.filter(({ key, raw }) =>
      key.toLowerCase().includes(q) || (raw.nameJa ?? '').toLowerCase().includes(q) || (raw.name ?? '').toLowerCase().includes(q)
    );
    if (nodeType) list = list.filter(({ raw }) => raw.nodeType === nodeType);
    if (sortKey === 'difficulty') {
      list = list.sort((a, b) => {
        const av = a.raw.difficulty ?? 0;
        const bv = b.raw.difficulty ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    } else if (sortKey === 'chapter') {
      list = list.sort((a, b) => {
        const av = (a.raw.chapter ?? 0) * 100 + (a.raw.area ?? 0);
        const bv = (b.raw.chapter ?? 0) * 100 + (b.raw.area ?? 0);
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, search, nodeType, sortKey, sortDir]);

  const total = Object.keys(data).length;

  return (
    <div>
      <ListFilterBar
        searchText={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            chips: [
              { label: 'ALL', value: '', active: nodeType === '', onClick: () => setNodeType('') },
              ...NODE_TYPES.map((t) => ({ label: t, value: t, active: nodeType === t, onClick: () => setNodeType(t) })),
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
          const linkedArea = resolveStageArea(raw, areaOptions);
          const areaMasterId = getStageAreaMasterId(raw);
          const areaLabel = linkedArea
            ? `CH${linkedArea.chapter}-AREA${linkedArea.area} · ${linkedArea.nameJa}`
            : `未登録 · ${areaMasterId}`;

          return (
            <AccordionEntry
              key={key}
              entryKey={key}
              data={data[key]}
              editHref={`/admin/stages/${key}`}
              summary={
                <>
                  {raw.nodeType && <NodeTypeBadge nodeType={raw.nodeType} />}
                  {raw.chapter != null && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      title={linkedArea ? linkedArea.id : `${areaMasterId} is not registered in areas.json`}
                      style={{
                        background: linkedArea ? `${linkedArea.color}1f` : 'rgba(127,29,29,0.24)',
                        color: linkedArea?.color ?? '#fca5a5',
                        border: `1px solid ${linkedArea ? `${linkedArea.color}55` : 'rgba(220,38,38,0.32)'}`,
                      }}
                    >
                      {areaLabel}
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, color: '#e0d0ff' }}>{raw.nameJa ?? raw.name ?? key}</span>
                  <span className="ml-auto text-[10px] font-mono" style={{ color: '#7878a8' }}>
                    {raw.waveCount != null && `WAVE×${raw.waveCount}`}
                    {raw.unlockRequires && raw.unlockRequires.length > 0 && (
                      <span className="ml-2" style={{ color: '#f59e0b' }}>LOCK×{raw.unlockRequires.length}</span>
                    )}
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
