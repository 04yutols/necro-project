'use client';

import AccordionEntry from './AccordionEntry';
import { ElementBadge } from './Badges';

type Skill = {
  id?: string;
  name?: string;
  element?: string;
  targetType?: string;
  power?: number;
  mpCost?: number;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function SkillsList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Skill;
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.element && <ElementBadge element={entry.element} />}
                {entry.targetType && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}
                  >
                    {entry.targetType}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.name ?? key}
                </span>
                <span className="ml-auto flex items-center gap-3 text-[10px] font-mono shrink-0">
                  {entry.power != null && (
                    <span style={{ color: '#f87171' }}>P:{entry.power}</span>
                  )}
                  {entry.mpCost != null && (
                    <span style={{ color: '#93c5fd' }}>MP:{entry.mpCost}</span>
                  )}
                </span>
              </>
            }
          />
        );
      })}
    </div>
  );
}
