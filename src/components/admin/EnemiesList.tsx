'use client';

import AccordionEntry from './AccordionEntry';
import { TierBadge, TribeBadge } from './Badges';

type Enemy = {
  id?: string;
  name?: string;
  nameJa?: string;
  tier?: string;
  tribe?: string;
  stats?: { hp?: number; atk?: number; def?: number; spd?: number };
};

type Props = {
  data: Record<string, Record<string, unknown>>;
};

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono w-6" style={{ color: '#7878a8' }}>
        {label}
      </span>
      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: 'rgba(139,0,255,0.7)' }}
        />
      </div>
      <span className="text-[10px] font-mono" style={{ color: '#c8c8d8' }}>
        {value}
      </span>
    </div>
  );
}

export default function EnemiesList({ data }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, raw]) => {
        const entry = raw as Enemy;
        const stats = entry.stats ?? {};
        return (
          <AccordionEntry
            key={key}
            entryKey={key}
            data={raw}
            summary={
              <>
                {entry.tier && <TierBadge tier={entry.tier} />}
                {entry.tribe && <TribeBadge tribe={entry.tribe} />}
                <span className="text-xs font-space" style={{ color: '#e0d0ff' }}>
                  {entry.nameJa ?? entry.name ?? key}
                </span>
                <span className="text-[10px] font-mono" style={{ color: '#7878a8' }}>
                  {entry.name}
                </span>
                {/* Mini stat bars */}
                <div className="flex gap-2 flex-wrap ml-auto">
                  {stats.hp != null && <StatBar label="HP" value={stats.hp} max={200} />}
                  {stats.atk != null && <StatBar label="ATK" value={stats.atk} max={80} />}
                  {stats.def != null && <StatBar label="DEF" value={stats.def} max={60} />}
                  {stats.spd != null && <StatBar label="SPD" value={stats.spd} max={200} />}
                </div>
              </>
            }
          />
        );
      })}
    </div>
  );
}
