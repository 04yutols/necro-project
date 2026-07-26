import type {
  BaseStats,
  CharacterData,
  EquipmentSlots,
  MonsterData,
  PassiveBonuses,
} from '../types/game';

// 純粋・決定的な共有テストファクトリ。
// 実マスターデータ（src/data/master/*.json）は import しない。
// 既定値は BattleEngine.test.ts の従来フルシェルと一致させ、移行で挙動が変わらないようにする。

/** 装備8スロット全 null（フルシェルの定番）。 */
function emptyEquipment(): EquipmentSlots {
  return { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null };
}

/** パッシブ6項目全 0。 */
function zeroPassives(): PassiveBonuses {
  return {
    passiveAtkBonus: 0,
    passiveDefBonus: 0,
    passiveSpdBonus: 0,
    passiveCritRateBonus: 0,
    passiveCritDmgBonus: 0,
    passiveHpBonus: 0,
  };
}

/**
 * BaseStats を生成する。critRate は既定 0（ダメージ乱数を決定化する定番プリセット）。
 * hp/atk/def/spd は控えめな既定値。
 */
export function makeBaseStats(overrides: Partial<BaseStats> = {}): BaseStats {
  return {
    hp: 100,
    atk: 50,
    def: 30,
    spd: 100,
    critRate: 0,
    critDmg: 150,
    effectHit: 0,
    effectRes: 0,
    ...overrides,
  };
}

/** def:0（純粋攻撃計測用）の共有 BaseStats 定数。使用時は展開してミュータブルなコピーを取る。 */
export const DEFENSELESS_STATS: BaseStats = Object.freeze(makeBaseStats({ def: 0 }));

/** def:999（防御遮断用）の共有 BaseStats 定数。使用時は展開してミュータブルなコピーを取る。 */
export const UNBREAKABLE_STATS: BaseStats = Object.freeze(makeBaseStats({ def: 999 }));

let characterSeq = 0;

/**
 * CharacterData のフルシェルを生成する。既定は warrior/PHYSICAL/装備8スロット null/
 * passives 全0/jobs 空/isAwakened false/clearedStages 空。overrides を spread して上書きする。
 */
export function makeCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  const { stats, ...rest } = overrides;
  return {
    id: `char-${characterSeq++}`,
    name: 'Hero',
    currentJobId: 'warrior',
    category: 'PHYSICAL',
    stats: makeBaseStats(stats),
    passives: zeroPassives(),
    equipment: emptyEquipment(),
    baseResistances: {},
    jobs: [],
    isAwakened: false,
    clearedStages: [],
    gold: 0,
    currentEnergy: 0,
    maxEnergy: 100,
    elementDmgBoosts: {},
    ...rest,
  };
}

let monsterSeq = 0;

/**
 * MonsterData を生成する。id は省略時に自動採番。既定は HUMANOID/cost 1/耐性なし/MP 30。
 */
export function makeMonster(overrides: Partial<MonsterData> = {}): MonsterData {
  const { stats, ...rest } = overrides;
  return {
    id: `monster-${monsterSeq++}`,
    name: 'Dummy',
    tribe: 'HUMANOID',
    cost: 1,
    stats: makeBaseStats(stats),
    resistances: {},
    currentEnergy: 30,
    maxEnergy: 30,
    ...rest,
  };
}
