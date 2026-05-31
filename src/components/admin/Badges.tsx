import React from 'react';

// ---------------------------------------------------------------------------
// Shared badge base
// ---------------------------------------------------------------------------
function Badge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-space font-semibold tracking-wide uppercase shrink-0"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TierBadge — MINION / ELITE / BOSS
// ---------------------------------------------------------------------------
const TIER_STYLES: Record<string, { bg: string; color: string }> = {
  MINION: { bg: 'rgba(63,63,70,0.7)', color: '#d4d4d8' },
  ELITE: { bg: 'rgba(124,45,18,0.6)', color: '#fdba74' },
  BOSS: { bg: 'rgba(127,29,29,0.6)', color: '#fca5a5' },
};

export function TierBadge({ tier }: { tier: string }) {
  const s = TIER_STYLES[tier] ?? { bg: 'rgba(63,63,70,0.5)', color: '#a1a1aa' };
  return <Badge label={tier} bg={s.bg} color={s.color} />;
}

// ---------------------------------------------------------------------------
// TribeBadge — UNDEAD / DEMON / BEAST / HUMANOID / DRAGON / ORC
// ---------------------------------------------------------------------------
const TRIBE_STYLES: Record<string, { bg: string; color: string }> = {
  UNDEAD: { bg: 'rgba(88,28,135,0.6)', color: '#d8b4fe' },
  DEMON: { bg: 'rgba(127,29,29,0.6)', color: '#fca5a5' },
  BEAST: { bg: 'rgba(6,78,59,0.6)', color: '#6ee7b7' },
  HUMANOID: { bg: 'rgba(30,58,138,0.6)', color: '#93c5fd' },
  DRAGON: { bg: 'rgba(113,63,18,0.6)', color: '#fde68a' },
  ORC: { bg: 'rgba(120,53,15,0.6)', color: '#fcd34d' },
};

export function TribeBadge({ tribe }: { tribe: string }) {
  const s = TRIBE_STYLES[tribe] ?? { bg: 'rgba(63,63,70,0.5)', color: '#a1a1aa' };
  return <Badge label={tribe} bg={s.bg} color={s.color} />;
}

// ---------------------------------------------------------------------------
// RarityBadge — R / SR / SSR / UR
// ---------------------------------------------------------------------------
const RARITY_STYLES: Record<string, { bg: string; color: string }> = {
  R: { bg: 'rgba(63,63,70,0.7)', color: '#d4d4d8' },
  SR: { bg: 'rgba(30,58,138,0.6)', color: '#93c5fd' },
  SSR: { bg: 'rgba(113,63,18,0.6)', color: '#fde68a' },
  UR: { bg: 'rgba(88,28,135,0.6)', color: '#e9d5ff' },
  COMMON: { bg: 'rgba(63,63,70,0.7)', color: '#d4d4d8' },
  RARE: { bg: 'rgba(30,58,138,0.6)', color: '#93c5fd' },
};

export function RarityBadge({ rarity }: { rarity: string }) {
  const s = RARITY_STYLES[rarity] ?? { bg: 'rgba(63,63,70,0.5)', color: '#a1a1aa' };
  return <Badge label={rarity} bg={s.bg} color={s.color} />;
}

// ---------------------------------------------------------------------------
// NodeTypeBadge — SAFE / DUNGEON / BOSS
// ---------------------------------------------------------------------------
const NODE_STYLES: Record<string, { bg: string; color: string }> = {
  SAFE: { bg: 'rgba(6,78,59,0.6)', color: '#6ee7b7' },
  DUNGEON: { bg: 'rgba(30,58,138,0.6)', color: '#93c5fd' },
  BOSS: { bg: 'rgba(127,29,29,0.6)', color: '#fca5a5' },
};

export function NodeTypeBadge({ nodeType }: { nodeType: string }) {
  const s = NODE_STYLES[nodeType] ?? { bg: 'rgba(63,63,70,0.5)', color: '#a1a1aa' };
  return <Badge label={nodeType} bg={s.bg} color={s.color} />;
}

// ---------------------------------------------------------------------------
// ElementBadge — FIRE / WATER / THUNDER / EARTH / WIND / ICE / LIGHT / DARK / NONE
// ---------------------------------------------------------------------------
const ELEMENT_STYLES: Record<string, { bg: string; color: string }> = {
  FIRE: { bg: 'rgba(127,29,29,0.6)', color: '#fca5a5' },
  WATER: { bg: 'rgba(30,58,138,0.6)', color: '#93c5fd' },
  THUNDER: { bg: 'rgba(113,63,18,0.6)', color: '#fde68a' },
  EARTH: { bg: 'rgba(54,46,12,0.7)', color: '#ca8a04' },
  WIND: { bg: 'rgba(6,78,59,0.6)', color: '#6ee7b7' },
  ICE: { bg: 'rgba(8,47,73,0.7)', color: '#7dd3fc' },
  LIGHT: { bg: 'rgba(100,80,10,0.6)', color: '#fef08a' },
  DARK: { bg: 'rgba(88,28,135,0.6)', color: '#d8b4fe' },
  NONE: { bg: 'rgba(63,63,70,0.5)', color: '#a1a1aa' },
};

export function ElementBadge({ element }: { element: string }) {
  const s = ELEMENT_STYLES[element] ?? ELEMENT_STYLES['NONE'];
  return <Badge label={element} bg={s.bg} color={s.color} />;
}
