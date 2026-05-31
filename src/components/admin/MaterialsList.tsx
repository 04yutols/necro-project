'use client';

import AccordionEntry from './AccordionEntry';
import { RarityBadge } from './Badges';

type Material = {
  id?: string;
  name?: string;
  rarity?: string;
  expValue?: number;
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function MaterialsList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Material;
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.rarity && <RarityBadge rarity={entry.rarity} />}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.name ?? key}
                </span>
                {entry.expValue != null && (
                  <span className="ml-auto text-[10px] font-mono shrink-0" style={{ color: '#fde68a' }}>
                    EXP +{entry.expValue}
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
