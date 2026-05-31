'use client';

import AccordionEntry from './AccordionEntry';
import { TribeBadge } from './Badges';

type Monster = {
  name?: string;
  tribe?: string;
  cost?: number;
  stats?: { hp?: number; atk?: number };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function MonstersList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Monster;
        const stats = entry.stats ?? {};
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.tribe && <TribeBadge tribe={entry.tribe} />}
                {entry.cost != null && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(88,28,135,0.4)', color: '#d8b4fe' }}
                  >
                    Cost {entry.cost}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.name ?? key}
                </span>
                <span className="ml-auto flex items-center gap-3 text-[10px] font-mono shrink-0">
                  {stats.hp != null && (
                    <span style={{ color: '#6ee7b7' }}>HP:{stats.hp}</span>
                  )}
                  {stats.atk != null && (
                    <span style={{ color: '#f87171' }}>ATK:{stats.atk}</span>
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
