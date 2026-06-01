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

const chipStyle = (active: boolean, color?: string): React.CSSProperties => ({
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'Space Grotesk, sans-serif',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.12s ease',
  fontWeight: active ? 600 : 400,
  background: active
    ? color ? `${color}22` : 'rgba(139,0,255,0.18)'
    : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active
    ? color ?? 'rgba(139,0,255,0.5)'
    : 'rgba(255,255,255,0.1)'}`,
  color: active ? (color ?? '#d8b4fe') : '#8080a0',
});

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
        gap: 10,
        marginBottom: 20,
        padding: '14px 16px',
        background: '#111118',
        border: '1px solid rgba(139,0,255,0.15)',
        borderRadius: 10,
      }}
    >
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
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
              height: 42,
              background: '#0d0d14',
              border: '1px solid rgba(139,0,255,0.22)',
              borderRadius: 8,
              padding: '0 14px 0 38px',
              color: '#e0d0ff',
              fontSize: 14,
              width: '100%',
              outline: 'none',
              fontFamily: 'Space Grotesk, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          {searchText && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#7878a8',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
        <span
          style={{
            fontSize: 13,
            color: count < total ? '#c084fc' : '#7878a8',
            fontFamily: 'Space Mono, monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontWeight: count < total ? 600 : 400,
          }}
        >
          {count === total ? `${total} 件` : `${count} / ${total}`}
        </span>
      </div>

      {/* Filter chips + sort */}
      {hasFiltersOrSort && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {filterGroups?.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {group.chips.map((chip) => (
                <button
                  key={chip.value}
                  onClick={chip.onClick}
                  style={chipStyle(chip.active, chip.color)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ))}

          {sortKeys && sortKeys.length > 0 && (
            <>
              <div
                style={{
                  width: 1, height: 20,
                  background: 'rgba(255,255,255,0.12)',
                  margin: '0 4px',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#7878a8', fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0 }}>
                ソート:
              </span>
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
                        onSortChange?.(sk.key, 'desc');
                      }
                    }}
                    style={chipStyle(isActive)}
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
