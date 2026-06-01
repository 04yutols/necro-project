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
        borderBottom: '1px solid rgba(139,0,255,0.15)',
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontFamily: 'Space Grotesk, sans-serif',
              background: isActive ? 'rgba(139,0,255,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(139,0,255,0.4)' : '1px solid transparent',
              borderBottom: 'none',
              borderRadius: '6px 6px 0 0',
              color: isActive ? '#d8b4fe' : '#7878a8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
