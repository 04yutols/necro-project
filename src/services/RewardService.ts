import { getStageDropTableForResidueUnlock } from '../logic/AbyssalResidueUnlockSystem';
import { normalizeDropRate } from '../logic/DropPolicySystem';
import { createNecromancedMonster, rollStageNecromance } from '../logic/NecromanceCaptureSystem';
import { CharacterData, ItemData, AbyssalResidueData, ResidueMatData, MonsterData, DropEntry, StageData, WeaponMaterialData, WeaponMaterialType } from '../types/game';
import { MasterDataService } from './MasterDataService';

export interface StageDropResult {
  weapons:   ItemData[];
  consumables: ItemData[];
  residues:  AbyssalResidueData[];
  materials: ResidueMatData[];
  weaponMaterials: WeaponMaterialData[];
  monsters:  MonsterData[];
}

const RESIDUE_SLOTS = ['head', 'arms', 'chest', 'waist', 'legs'] as const;
type ResidueSlot = typeof RESIDUE_SLOTS[number];

const WEAPON_MATERIAL_NAMES: Record<WeaponMaterialType, string> = {
  IDEA_COMMON: '凡骨のイデア',
  IDEA_SR: '業物のイデア',
  IDEA_SSR: '英雄のイデア',
  ABYSSAL_OBSIDIAN: '深淵の黒鋼',
};

const WEAPON_MATERIAL_TYPES = new Set<WeaponMaterialType>([
  'IDEA_COMMON',
  'IDEA_SR',
  'IDEA_SSR',
  'ABYSSAL_OBSIDIAN',
]);

interface StatRange { type: string; range: [number, number] }

const MAIN_STAT_POOLS: Record<ResidueSlot, StatRange[]> = {
  head:  [
    { type: 'HP_FLAT', range: [320, 560] },
    { type: 'HP%',     range: [8,   14]  },
  ],
  arms:  [
    { type: 'ATK_FLAT', range: [80, 140] },
    { type: 'ATK%',     range: [8,  14]  },
  ],
  chest: [
    { type: 'ATK%',    range: [8,  16] },
    { type: 'HP%',     range: [8,  16] },
    { type: 'DEF%',    range: [8,  16] },
    { type: 'CRIT_RATE', range: [5, 12] },
    { type: 'CRIT_DMG',  range: [10, 24] },
  ],
  waist: [
    { type: 'ATK%',           range: [8,  16] },
    { type: 'HP%',            range: [8,  16] },
    { type: 'DARK_DMG_BOOST', range: [10, 22] },
    { type: 'FIRE_DMG_BOOST', range: [10, 22] },
    { type: 'WATER_DMG_BOOST', range: [10, 22] },
  ],
  legs:  [
    { type: 'CRIT_RATE', range: [5,  16] },
    { type: 'CRIT_DMG',  range: [10, 32] },
    { type: 'SPD%',      range: [5,  12] },
  ],
};

const SUB_OPTION_POOL: StatRange[] = [
  { type: 'ATK%',       range: [2,  8]   },
  { type: 'HP%',        range: [2,  8]   },
  { type: 'DEF%',       range: [2,  8]   },
  { type: 'ATK_FLAT',   range: [10, 40]  },
  { type: 'HP_FLAT',    range: [50, 150] },
  { type: 'DEF_FLAT',   range: [10, 40]  },
  { type: 'CRIT_RATE',  range: [1,  7]   },
  { type: 'CRIT_DMG',   range: [2,  14]  },
  { type: 'EFFECT_HIT', range: [1,  6]   },
  { type: 'EFFECT_RES', range: [1,  6]   },
];

const RESIDUE_NAMES: Record<AbyssalResidueData['rarity'], string[]> = {
  COMMON:    ['骸の指輪', '虚ろの護符', '亡者の欠片', '幽霊の痕跡'],
  RARE:      ['深淵の残滓', '魔骨の砕片', '怨霊の結晶', '冥界の遺物'],
  EPIC:      ['奈落の紋章', '魂喰いの印', '深淵王の礎', '竜骨の至宝'],
  LEGENDARY: ['神骸の結晶', '深淵神の欠片'],
};

// [min, max] sub option counts per rarity
const SUB_COUNT_RANGE: Record<AbyssalResidueData['rarity'], [number, number]> = {
  COMMON:    [1, 2],
  RARE:      [2, 3],
  EPIC:      [3, 4],
  LEGENDARY: [4, 4],
};

const MAX_EXP: Record<AbyssalResidueData['rarity'], number> = {
  COMMON:    800,
  RARE:      2500,
  EPIC:      5000,
  LEGENDARY: 8000,
};

function rollValue(range: [number, number], rng: () => number): number {
  return parseFloat((range[0] + rng() * (range[1] - range[0])).toFixed(1));
}

function secureUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (!getRandomValues) {
    throw new Error('Secure random ID generation requires Web Crypto API.');
  }

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generateInstanceId(prefix: string): string {
  return `${prefix}_${secureUuid()}`;
}

function emptyStageDropResult(): StageDropResult {
  return { weapons: [], consumables: [], residues: [], materials: [], weaponMaterials: [], monsters: [] };
}

function mergeDropResult(target: StageDropResult, source: StageDropResult): StageDropResult {
  target.weapons.push(...source.weapons);
  target.consumables.push(...source.consumables);
  target.residues.push(...source.residues);
  target.materials.push(...source.materials);
  target.weaponMaterials.push(...source.weaponMaterials);
  target.monsters.push(...source.monsters);
  return target;
}

function resolveWeaponMaterialType(entry: DropEntry): WeaponMaterialType | null {
  const type = entry.weaponMaterialType ?? entry.itemId;
  return WEAPON_MATERIAL_TYPES.has(type as WeaponMaterialType) ? type as WeaponMaterialType : null;
}

export function shuffleFisherYates<T>(items: readonly T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class RewardService {
  private static generateResidueId(): string {
    return generateInstanceId('res');
  }

  private static generateResidue(
    rarity: AbyssalResidueData['rarity'],
    rng: () => number,
  ): AbyssalResidueData {
    const slot = RESIDUE_SLOTS[Math.floor(rng() * RESIDUE_SLOTS.length)];
    const mainPool = MAIN_STAT_POOLS[slot];
    const mainDef  = mainPool[Math.floor(rng() * mainPool.length)];
    const mainValue = rollValue(mainDef.range, rng);

    const [subMin, subMax] = SUB_COUNT_RANGE[rarity];
    const subCount = subMin + Math.floor(rng() * (subMax - subMin + 1));

    // シャッフルしてメイン型と重複しない候補から取得
    const available = SUB_OPTION_POOL.filter(s => s.type !== mainDef.type);
    const shuffled  = shuffleFisherYates(available, rng);
    const subOptions = shuffled.slice(0, subCount).map(s => ({
      type:  s.type,
      value: rollValue(s.range, rng),
    }));

    const namePool = RESIDUE_NAMES[rarity];
    const name = namePool[Math.floor(rng() * namePool.length)];

    return {
      id:        RewardService.generateResidueId(),
      name,
      itemId:    slot,
      rarity,
      mainStat:  { type: mainDef.type, value: mainValue },
      subOptions,
      level:     1,
      exp:       0,
      maxExp:    MAX_EXP[rarity],
    };
  }

  private resolveDropEntry(
    entry: DropEntry,
    result: StageDropResult,
    mds: MasterDataService,
    rng: () => number,
    ownedMonsterMasterIds: Set<string>,
  ) {
    switch (entry.type) {
      case 'WEAPON': {
        if (!entry.itemId) break;
        const master = mds.getItem(entry.itemId);
        if (!master) break;
        result.weapons.push({
          ...master,
          id:   generateInstanceId(master.id),
          rank: 0,
        });
        break;
      }
      case 'CONSUMABLE': {
        if (!entry.itemId) break;
        const master = mds.getItem(entry.itemId);
        if (!master || master.type !== 'CONSUMABLE') break;
        result.consumables.push({
          ...master,
          quantity: Math.max(1, entry.quantity ?? master.quantity ?? 1),
        });
        break;
      }
      case 'RESIDUE': {
        const rarity = (entry.rarity ?? 'COMMON') as AbyssalResidueData['rarity'];
        const quantity = Math.max(1, entry.quantity ?? 1);
        for (let i = 0; i < quantity; i += 1) {
          result.residues.push(RewardService.generateResidue(rarity, rng));
        }
        break;
      }
      case 'MATERIAL': {
        if (!entry.itemId) break;
        const mat = mds.getMaterial(entry.itemId);
        if (mat) {
          result.materials.push({
            ...mat,
            id: generateInstanceId(mat.id),
            quantity: Math.max(1, entry.quantity ?? mat.quantity ?? 1),
          });
        }
        break;
      }
      case 'WEAPON_MATERIAL': {
        const type = resolveWeaponMaterialType(entry);
        if (!type) break;
        result.weaponMaterials.push({
          type,
          name: WEAPON_MATERIAL_NAMES[type],
          quantity: Math.max(1, entry.quantity ?? 1),
        });
        break;
      }
      case 'MONSTER': {
        if (!entry.monsterId) break;
        if (ownedMonsterMasterIds.has(entry.monsterId)) break;
        const enemy = mds.getEnemy(entry.monsterId);
        if (!enemy) break;
        const quantity = Math.max(1, entry.quantity ?? 1);
        for (let i = 0; i < quantity; i += 1) {
          if (ownedMonsterMasterIds.has(entry.monsterId)) break;
          result.monsters.push(createNecromancedMonster(enemy));
          ownedMonsterMasterIds.add(entry.monsterId);
        }
        break;
      }
    }
  }

  private processGuaranteedDropTable(
    dropTable: DropEntry[],
    ownedMonsterMasterIds: Set<string>,
    rng: () => number,
  ): StageDropResult {
    const result = emptyStageDropResult();
    const mds = MasterDataService.getInstance();

    for (const entry of dropTable) {
      this.resolveDropEntry(entry, result, mds, rng, ownedMonsterMasterIds);
    }

    return result;
  }

  public processDropTable(
    dropTable: DropEntry[],
    discoveryBonusRate: number = 0,
    rng: () => number = Math.random,
    ownedMonsterMasterIds: readonly (string | null | undefined)[] = [],
  ): StageDropResult {
    const result = emptyStageDropResult();
    const mds = MasterDataService.getInstance();
    const multiplier = 1 + discoveryBonusRate / 100;
    const owned = new Set(ownedMonsterMasterIds.filter((id): id is string => Boolean(id)));

    for (const entry of dropTable) {
      const roll = rng();
      const adjustedRate = normalizeDropRate(entry.rate * multiplier);
      if (roll >= adjustedRate) continue;

      this.resolveDropEntry(entry, result, mds, rng, owned);
    }

    return result;
  }

  public processStageDropTable(
    stage: Pick<StageData, 'chapter' | 'rewards'> & { id?: string },
    clearedStages: readonly string[] = [],
    discoveryBonusRate: number = 0,
    rng: () => number = Math.random,
    ownedMonsterMasterIds: readonly (string | null | undefined)[] = [],
  ): StageDropResult {
    const owned = new Set(ownedMonsterMasterIds.filter((id): id is string => Boolean(id)));
    const result = emptyStageDropResult();
    const firstClearGuaranteed = stage.id && !clearedStages.includes(stage.id)
      ? stage.rewards.firstClearGuaranteed ?? []
      : [];
    if (firstClearGuaranteed.length > 0) {
      mergeDropResult(
        result,
        this.processGuaranteedDropTable(
          firstClearGuaranteed.map(entry => ({ ...entry, rate: 1 })),
          owned,
          rng,
        ),
      );
    }

    const dropTable = getStageDropTableForResidueUnlock(stage, clearedStages);
    mergeDropResult(result, this.processDropTable(dropTable, discoveryBonusRate, rng, [...owned]));
    return result;
  }

  public processStageNecromance(
    stage: Pick<StageData, 'waves'>,
    ownedMonsterMasterIds: readonly (string | null | undefined)[] = [],
    rng: () => number = Math.random,
  ): MonsterData[] {
    const mds = MasterDataService.getInstance();
    return rollStageNecromance({
      stage,
      enemies: mds.getAllEnemies(),
      ownedMonsterMasterIds,
      rng,
    }).map((result) => result.monster);
  }

  public calculateExp(baseExp: number, player: CharacterData): number {
    const currentJob = player.jobs.find(j => j.jobId === player.currentJobId);
    const levelFactor = currentJob ? (1 + currentJob.level / 100) : 1;
    const categoryMultiplier = player.category === 'MAGICAL' ? 1.1 : 1.0;
    return Math.floor(baseExp * levelFactor * categoryMultiplier);
  }
}
