'use client';

import AccordionEntry from './AccordionEntry';
import { RarityBadge } from './Badges';

type Item = {
  id?: string;
  name?: string;
  rarity?: string;
  archetype?: string;
  passiveA?: { nameJa?: string };
  passiveB?: { nameJa?: string };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function ItemsList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Item;
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.rarity && <RarityBadge rarity={entry.rarity} />}
                {entry.archetype && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}
                  >
                    {entry.archetype}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.name ?? key}
                </span>
                <span className="ml-auto flex flex-col items-end text-[10px] font-mono shrink-0 gap-0.5">
                  {entry.passiveA?.nameJa && (
                    <span style={{ color: '#fde68a' }}>{entry.passiveA.nameJa}</span>
                  )}
                  {entry.passiveB?.nameJa && (
                    <span style={{ color: '#7878a8' }}>{entry.passiveB.nameJa}</span>
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
