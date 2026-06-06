'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import AccordionEntry from './AccordionEntry';
import { NodeTypeBadge } from './Badges';
import ListFilterBar from './forms/shared/ListFilterBar';
import {
  buildStageAreaOptions,
  buildStageAreaStageGroups,
  getStageAreaMasterId,
  resolveStageArea,
} from '@/logic/StageAreaLinkSystem';

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
  { key: 'id', label: 'id' },
];

export default function StagesList({ data, areas = {} }: Props) {
  const [search, setSearch] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sortKey, setSortKey] = useState('difficulty');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const areaOptions = useMemo(() => buildStageAreaOptions(areas), [areas]);
  const areaGroups = useMemo(() => buildStageAreaStageGroups(data, areas), [data, areas]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    return areaGroups
      .filter(group => !areaFilter || group.areaId === areaFilter)
      .map(group => {
        let stages = group.stages.filter(stage => {
          const raw = data[stage.id] as Stage | undefined;
          if (!raw) return false;
          if (nodeType && raw.nodeType !== nodeType) return false;
          if (!q) return true;
          return stage.id.toLowerCase().includes(q)
            || (raw.nameJa ?? '').toLowerCase().includes(q)
            || (raw.name ?? '').toLowerCase().includes(q)
            || stage.nameJa.toLowerCase().includes(q);
        });
        stages = [...stages].sort((a, b) => {
          const result = sortKey === 'id'
            ? a.id.localeCompare(b.id)
            : a.difficulty - b.difficulty || a.id.localeCompare(b.id);
          return sortDir === 'asc' ? result : -result;
        });
        return { ...group, stages };
      })
      .filter(group => group.stages.length > 0 || (!q && !nodeType));
  }, [areaFilter, areaGroups, data, nodeType, search, sortDir, sortKey]);

  const total = Object.keys(data).length;
  const count = filteredGroups.reduce((sum, group) => sum + group.stages.length, 0);

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
          {
            chips: [
              { label: '全エリア', value: '', active: areaFilter === '', onClick: () => setAreaFilter('') },
              ...areaOptions.map((area) => ({
                label: `CH${area.chapter}-AREA${area.area}`,
                value: area.id,
                active: areaFilter === area.id,
                color: area.color,
                onClick: () => setAreaFilter(area.id),
              })),
            ],
          },
        ]}
        sortKeys={SORT_KEYS}
        activeSort={sortKey}
        sortDir={sortDir}
        onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
        count={count}
        total={total}
      />
      <div className="flex flex-col gap-5">
        {filteredGroups.map((group) => {
          const area = group.area;
          return (
            <section
              key={group.areaId}
              style={{
                border: '1px solid rgba(139,0,255,0.14)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: area?.color ?? '#ef4444',
                    boxShadow: `0 0 12px ${area?.color ?? '#ef4444'}66`,
                  }}
                />
                <span style={{ color: area?.color ?? '#fca5a5', fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>
                  {area ? `CH${area.chapter}-AREA${area.area}` : group.areaId}
                </span>
                <span style={{ color: '#e0d0ff', fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                  {area?.nameJa ?? '未登録エリア'}
                </span>
                <span style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Mono, monospace' }}>
                  {group.stages.length} STAGE
                </span>
                <Link
                  href={`/admin/stages/new?areaId=${encodeURIComponent(group.areaId)}`}
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(139,0,255,0.14)',
                    border: '1px solid rgba(139,0,255,0.34)',
                    color: '#d8b4fe',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'Space Grotesk, sans-serif',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  このエリアに作成
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                {group.stages.length === 0 && (
                  <p style={{ color: '#7878a8', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>このエリアにはまだステージがありません</p>
                )}
                {group.stages.map((stage) => {
                  const key = stage.id;
                  const raw = data[key] as Stage;
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
              </div>
            </section>
          );
        })}
        {filteredGroups.length === 0 && (
          <p style={{ color: '#7878a8', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>該当するエントリがありません</p>
        )}
      </div>
    </div>
  );
}
