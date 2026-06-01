'use client';

export type FilterChip = {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  color?: string;
};

export type SortKey = {
  key: string;
  label: string;
};

type Props = {
  searchText: string;
  onSearchChange: (text: string) => void;
  filterGroups?: Array<{ chips: FilterChip[] }>;
  sortKeys?: SortKey[];
  activeSort?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  count: number;
  total: number;
};

const chipBase: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 100,
  fontSize: 11,
  fontFamily: 'Space Grotesk, sans-serif',
  cursor: 'pointer',
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
  transition: 'all 0.12s ease',
};

export default function ListFilterBar({
  searchText,
  onSearchChange,
  filterGroups,
  sortKeys,
  activeSort,
  sortDir,
  onSortChange,
  count,
  total,
}: Props) {
  const hasFiltersOrSort = (filterGroups && filterGroups.length > 0) || (sortKeys && sortKeys.length > 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 16,
        padding: '10px 12px',
        background: '#111118',
        border: '1px solid rgba(139,0,255,0.12)',
        borderRadius: 8,
      }}
    >
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span
            style={{
              position: 'absolute',
              left: 9,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: '#7878a8',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="検索（ID・名前）"
            style={{
              background: '#1a1a24',
              border: '1px solid rgba(139,0,255,0.18)',
              borderRadius: 6,
              padding: '6px 10px 6px 28px',
              color: '#e0d0ff',
              fontSize: 12,
              width: '100%',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            color: '#7878a8',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {count === total ? `${total} 件` : `${count} / ${total} 件`}
        </span>
      </div>

      {/* Filter chips + sort */}
      {hasFiltersOrSort && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {filterGroups?.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {group.chips.map((chip) => (
                <button
                  key={chip.value}
                  onClick={chip.onClick}
                  style={{
                    ...chipBase,
                    background: chip.active
                      ? chip.color
                        ? `${chip.color}22`
                        : 'rgba(139,0,255,0.18)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${chip.active
                        ? chip.color ?? 'rgba(139,0,255,0.5)'
                        : 'rgba(255,255,255,0.08)'
                      }`,
                    color: chip.active
                      ? chip.color ?? '#d8b4fe'
                      : '#7878a8',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ))}

          {sortKeys && sortKeys.length > 0 && (
            <>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#7878a8', fontFamily: 'Space Grotesk, sans-serif' }}>ソート:</span>
              {sortKeys.map((sk) => {
                const isActive = activeSort === sk.key;
                const dir = isActive ? sortDir ?? 'asc' : 'asc';
                return (
                  <button
                    key={sk.key}
                    onClick={() => {
                      if (isActive) {
                        onSortChange?.(sk.key, dir === 'asc' ? 'desc' : 'asc');
                      } else {
                        onSortChange?.(sk.key, 'asc');
                      }
                    }}
                    style={{
                      ...chipBase,
                      background: isActive ? 'rgba(139,0,255,0.14)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? 'rgba(139,0,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: isActive ? '#d8b4fe' : '#7878a8',
                    }}
                  >
                    {sk.label} {isActive ? (dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
