'use client';

import AccordionEntry from './AccordionEntry';

type DemonForm = {
  jobId?: string;
  formName?: string;
  tier?: number;
  concept?: string;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function DemonFormsList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as DemonForm;
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
                {entry.jobId && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(139,0,255,0.15)', color: '#8B00FF' }}
                  >
                    {entry.jobId}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.formName ?? key}
                </span>
                {entry.concept && (
                  <span
                    className="ml-2 text-[10px] font-noto truncate hidden sm:block"
                    style={{ color: '#7878a8', maxWidth: 240 }}
                  >
                    {entry.concept}
                  </span>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}
