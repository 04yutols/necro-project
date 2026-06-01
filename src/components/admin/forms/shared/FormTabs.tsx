'use client';

type Props = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export default function FormTabs({ tabs, activeTab, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid rgba(139,0,255,0.18)',
        marginBottom: 24,
        flexWrap: 'wrap',
        paddingBottom: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              height: 42,
              padding: '0 20px',
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'rgba(139,0,255,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(139,0,255,0.4)' : '1px solid transparent',
              borderBottom: isActive ? '1px solid transparent' : 'none',
              borderRadius: '8px 8px 0 0',
              color: isActive ? '#d8b4fe' : '#8080a0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = '#c0c0e0';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,255,0.06)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = '#8080a0';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
