'use client';

import AccordionEntry from './AccordionEntry';

type SkillRef = { level?: number; skillId?: string };
type Job = {
  displayName?: string;
  nameEn?: string;
  title?: string;
  tier?: number;
  category?: string;
  skills?: SkillRef[];
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function JobsList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Job;
        const skillCount = entry.skills?.length ?? 0;
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.tier != null && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{
                      background: entry.tier === 1 ? 'rgba(30,58,138,0.5)' : 'rgba(88,28,135,0.5)',
                      color: entry.tier === 1 ? '#93c5fd' : '#d8b4fe',
                    }}
                  >
                    Tier {entry.tier}
                  </span>
                )}
                {entry.category && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}
                  >
                    {entry.category}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.displayName ?? key}
                </span>
                <span className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
                  {entry.title}
                </span>
                <span className="ml-auto text-[10px] font-mono shrink-0" style={{ color: '#7878a8' }}>
                  スキル×{skillCount}
                </span>
              </>
            }
          />
        );
      })}
    </div>
  );
}
