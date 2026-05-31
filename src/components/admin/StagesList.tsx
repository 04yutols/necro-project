'use client';

import AccordionEntry from './AccordionEntry';
import { NodeTypeBadge } from './Badges';

type Stage = {
  nameJa?: string;
  name?: string;
  nodeType?: string;
  chapter?: number;
  area?: number;
  waveCount?: number;
  unlockRequires?: string[];
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

export default function StagesList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Stage;
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.nodeType && <NodeTypeBadge nodeType={entry.nodeType} />}
                {entry.chapter != null && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#7878a8' }}
                  >
                    CH{entry.chapter}-{entry.area}
                  </span>
                )}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.nameJa ?? entry.name ?? key}
                </span>
                <span className="ml-auto text-[10px] font-mono" style={{ color: '#7878a8' }}>
                  {entry.waveCount != null && `WAVE×${entry.waveCount}`}
                  {entry.unlockRequires && entry.unlockRequires.length > 0 && (
                    <span className="ml-2" style={{ color: '#f59e0b' }}>
                      🔒{entry.unlockRequires.length}
                    </span>
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
