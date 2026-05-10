import type { MonsterData, Tribe } from '../types/game';

export interface SynergyBonus {
  hpRegenPct?: number;
  darkDmgBonus?: number;
  elementDmgBonus?: number;
  fireDarkDmgBonus?: number;
  spdBonus?: number;
  critRateBonus?: number;
  critDmgBonus?: number;
  defenseReducePct?: number;
  effectHitBonus?: number;
  energyPerTurn?: number;
  demonGaugePerTurn?: number;
  avBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  absorbDmgPct?: number;
  ailmentImmune?: ('POISON' | 'BLEED')[];
  ailmentDurationBonus?: number;
}

export interface ActiveSynergy {
  key: string;
  name: string;
  nameEn: string;
  layer: 1 | 2 | 3;
  tribe?: Tribe;
  tribes?: [Tribe, Tribe];
  effectDesc: string;
  color: string;
  accentColor: string;
}

const TRIBE_COLOR: Record<Tribe, { color: string; accent: string }> = {
  UNDEAD:   { color: '#B09FF8', accent: '#c4baff' },
  DEMON:    { color: '#FF7878', accent: '#ffa0a0' },
  BEAST:    { color: '#FBBB30', accent: '#fcd060' },
  HUMANOID: { color: '#78C97C', accent: '#9adaa0' },
  DRAGON:   { color: '#00C896', accent: '#33e0b8' },
  ORC:      { color: '#5C9E6A', accent: '#7dbe8c' },
};

function countTribes(monsters: MonsterData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of monsters) {
    counts[m.tribe] = (counts[m.tribe] ?? 0) + 1;
  }
  return counts;
}

function addBonus<K extends keyof SynergyBonus>(
  bonus: SynergyBonus,
  key: K,
  value: NonNullable<SynergyBonus[K]>,
): void {
  if (key === 'ailmentImmune') {
    const existing = (bonus.ailmentImmune ?? []) as ('POISON' | 'BLEED')[];
    const incoming = value as ('POISON' | 'BLEED')[];
    bonus.ailmentImmune = [...new Set([...existing, ...incoming])];
  } else {
    (bonus[key] as number) = ((bonus[key] as number | undefined) ?? 0) + (value as number);
  }
}

function applyPartialSynergy(tribe: Tribe, bonus: SynergyBonus): void {
  switch (tribe) {
    case 'UNDEAD':   addBonus(bonus, 'hpRegenPct', 2); break;
    case 'DEMON':    addBonus(bonus, 'darkDmgBonus', 10); break;
    case 'BEAST':    addBonus(bonus, 'spdBonus', 15); break;
    case 'HUMANOID': addBonus(bonus, 'critRateBonus', 5); break;
    case 'DRAGON':   addBonus(bonus, 'elementDmgBonus', 12); break;
    case 'ORC':      addBonus(bonus, 'defenseReducePct', 15); break;
  }
}

function applyFullSynergy(tribe: Tribe, bonus: SynergyBonus): void {
  switch (tribe) {
    case 'UNDEAD':
      addBonus(bonus, 'hpRegenPct', 5);
      addBonus(bonus, 'ailmentImmune', ['POISON', 'BLEED'] as ('POISON' | 'BLEED')[]);
      break;
    case 'DEMON':
      addBonus(bonus, 'darkDmgBonus', 20);
      addBonus(bonus, 'effectHitBonus', 25);
      break;
    case 'BEAST':
      addBonus(bonus, 'spdBonus', 30);
      addBonus(bonus, 'energyPerTurn', 15);
      break;
    case 'HUMANOID':
      addBonus(bonus, 'critRateBonus', 10);
      addBonus(bonus, 'critDmgBonus', 30);
      break;
    case 'DRAGON':
      addBonus(bonus, 'elementDmgBonus', 25);
      addBonus(bonus, 'demonGaugePerTurn', 5);
      break;
    case 'ORC':
      addBonus(bonus, 'defenseReducePct', 25);
      addBonus(bonus, 'absorbDmgPct', 10);
      break;
  }
}

function applyCrossResonance(tribes: Set<string>, bonus: SynergyBonus): void {
  if (tribes.has('UNDEAD') && tribes.has('DEMON')) {
    addBonus(bonus, 'ailmentDurationBonus', 1);
    addBonus(bonus, 'effectHitBonus', 10);
  }
  if (tribes.has('BEAST') && tribes.has('DRAGON')) {
    addBonus(bonus, 'avBonus', -20);
    addBonus(bonus, 'elementDmgBonus', 10);
  }
  if (tribes.has('ORC') && tribes.has('HUMANOID')) {
    addBonus(bonus, 'defBonus', 20);
    addBonus(bonus, 'atkBonus', 8);
  }
  if (tribes.has('UNDEAD') && tribes.has('ORC')) {
    addBonus(bonus, 'defenseReducePct', 10);
    addBonus(bonus, 'hpRegenPct', 2);
  }
  if (tribes.has('DEMON') && tribes.has('DRAGON')) {
    addBonus(bonus, 'fireDarkDmgBonus', 20);
  }
  if (tribes.has('BEAST') && tribes.has('HUMANOID')) {
    addBonus(bonus, 'spdBonus', 10);
    addBonus(bonus, 'critRateBonus', 5);
  }
}

export function calculatePartyTribeSynergy(monsters: MonsterData[]): SynergyBonus {
  if (monsters.length === 0) return {};
  const counts = countTribes(monsters);
  const bonus: SynergyBonus = {};

  for (const [tribe, count] of Object.entries(counts)) {
    if (count >= 3) applyFullSynergy(tribe as Tribe, bonus);
    else if (count >= 2) applyPartialSynergy(tribe as Tribe, bonus);
  }

  const activeTribes = new Set(Object.keys(counts));
  applyCrossResonance(activeTribes, bonus);

  return bonus;
}

// ── UI用: アクティブシナジー一覧 ──────────────────────────────

const LAYER1_META: Record<Tribe, { name: string; nameEn: string; effectDesc: string }> = {
  UNDEAD:   { name: '死者の絆',   nameEn: 'BOND OF THE DEAD',    effectDesc: 'HP +2%/ターン' },
  DEMON:    { name: '闇の盟約',   nameEn: 'DARK COVENANT',       effectDesc: '闇DMG +10%' },
  BEAST:    { name: '野生の俊足', nameEn: 'FERAL SWIFTNESS',     effectDesc: 'SPD +15' },
  HUMANOID: { name: '人の意地',   nameEn: 'HUMAN TENACITY',      effectDesc: '会心率 +5%' },
  DRAGON:   { name: '竜鱗の共鳴', nameEn: 'DRACONIC RESONANCE',  effectDesc: '全属性DMG +12%' },
  ORC:      { name: '鬼の厚皮',   nameEn: 'IRON HIDE',           effectDesc: '被ダメ -15%' },
};

const LAYER2_META: Record<Tribe, { name: string; nameEn: string; effectDesc: string }> = {
  UNDEAD:   { name: '骸軍の不滅陣', nameEn: 'UNDYING VANGUARD',   effectDesc: 'HP +5%/T · 毒/出血 無効' },
  DEMON:    { name: '魔族の悪意',   nameEn: 'DEMONIC MALICE',     effectDesc: '闇DMG +20% · effectHit +25%' },
  BEAST:    { name: '野獣の本能',   nameEn: 'PRIMAL INSTINCT',    effectDesc: 'SPD +30 · エネルギー +15/T' },
  HUMANOID: { name: '英雄の末裔',   nameEn: 'HERO\'S LINEAGE',    effectDesc: '会心率 +10% · 会心DMG +30%' },
  DRAGON:   { name: '天上の覇竜陣', nameEn: 'CELESTIAL DRAGON',   effectDesc: '全属性DMG +25% · 魔神化G +5/T' },
  ORC:      { name: '鉄城の守護陣', nameEn: 'IRON FORTRESS',      effectDesc: '被ダメ -25% · 吸収 10%' },
};

interface CrossMeta {
  key: string;
  tribes: [Tribe, Tribe];
  name: string;
  nameEn: string;
  effectDesc: string;
}

const CROSS_META: CrossMeta[] = [
  { key: 'UNDEAD_DEMON',    tribes: ['UNDEAD',   'DEMON'],    name: '怨念の共鳴', nameEn: 'GRUDGE RESONANCE', effectDesc: '状態異常持続 +1T · effectHit +10%' },
  { key: 'BEAST_DRAGON',    tribes: ['BEAST',    'DRAGON'],   name: '天地の覇者', nameEn: 'HEAVEN & EARTH',   effectDesc: '先制AV -20 · 全属性DMG +10%' },
  { key: 'ORC_HUMANOID',    tribes: ['ORC',      'HUMANOID'], name: '鉄の盟約',   nameEn: 'IRON PACT',        effectDesc: 'DEF +20% · ATK +8%' },
  { key: 'UNDEAD_ORC',      tribes: ['UNDEAD',   'ORC'],      name: '不滅の鎧兵', nameEn: 'IMMORTAL ARMOR',   effectDesc: '被ダメ -10% · HP +2%/T' },
  { key: 'DEMON_DRAGON',    tribes: ['DEMON',    'DRAGON'],   name: '深淵の竜炎', nameEn: 'ABYSSAL DRAGONFIRE',effectDesc: '炎/闇DMG +20%' },
  { key: 'BEAST_HUMANOID',  tribes: ['BEAST',    'HUMANOID'], name: '俊足剣士団', nameEn: 'SWIFT VANGUARD',   effectDesc: 'SPD +10 · 会心率 +5%' },
];

export function getActiveSynergies(monsters: MonsterData[]): ActiveSynergy[] {
  if (monsters.length === 0) return [];
  const counts = countTribes(monsters);
  const result: ActiveSynergy[] = [];

  for (const [tribe, count] of Object.entries(counts) as [Tribe, number][]) {
    const tc = TRIBE_COLOR[tribe] ?? TRIBE_COLOR.HUMANOID;
    if (count >= 3) {
      const meta = LAYER2_META[tribe];
      result.push({ key: `${tribe}_FULL`, name: meta.name, nameEn: meta.nameEn,
        layer: 2, tribe, effectDesc: meta.effectDesc,
        color: tc.color, accentColor: tc.accent });
    } else if (count >= 2) {
      const meta = LAYER1_META[tribe];
      result.push({ key: `${tribe}_PART`, name: meta.name, nameEn: meta.nameEn,
        layer: 1, tribe, effectDesc: meta.effectDesc,
        color: tc.color, accentColor: tc.accent });
    }
  }

  const activeTribes = new Set(Object.keys(counts));
  for (const cm of CROSS_META) {
    if (activeTribes.has(cm.tribes[0]) && activeTribes.has(cm.tribes[1])) {
      const tc0 = TRIBE_COLOR[cm.tribes[0]];
      result.push({ key: `CROSS_${cm.key}`, name: cm.name, nameEn: cm.nameEn,
        layer: 3, tribes: cm.tribes, effectDesc: cm.effectDesc,
        color: tc0.color, accentColor: TRIBE_COLOR[cm.tribes[1]].color });
    }
  }

  return result;
}
