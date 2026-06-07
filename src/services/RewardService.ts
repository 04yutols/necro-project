import { getStageDropTableForResidueUnlock } from '../logic/AbyssalResidueUnlockSystem';
import { rollStageNecromance } from '../logic/NecromanceCaptureSystem';
import { CharacterData, ItemData, AbyssalResidueData, ResidueMatData, MonsterData, DropEntry, StageData } from '../types/game';
import { MasterDataService } from './MasterDataService';

export interface StageDropResult {
  weapons:   ItemData[];
  consumables: ItemData[];
  residues:  AbyssalResidueData[];
  materials: ResidueMatData[];
  monsters:  MonsterData[];
}

const RESIDUE_SLOTS = ['head', 'arms', 'chest', 'waist', 'legs'] as const;
type ResidueSlot = typeof RESIDUE_SLOTS[number];

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

function clampDropRate(rate: number): number {
  return Math.max(0, Math.min(1, rate));
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

  public processDropTable(
    dropTable: DropEntry[],
    discoveryBonusRate: number = 0,
    rng: () => number = Math.random,
  ): StageDropResult {
    const result: StageDropResult = { weapons: [], consumables: [], residues: [], materials: [], monsters: [] };
    const mds = MasterDataService.getInstance();
    const multiplier = 1 + discoveryBonusRate / 100;

    for (const entry of dropTable) {
      const roll = rng();
      const adjustedRate = clampDropRate(entry.rate * multiplier);
      if (roll >= adjustedRate) continue;

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
          result.residues.push(RewardService.generateResidue(rarity, rng));
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
        case 'MONSTER':
          // 第1章ドロップテーブルには MONSTER エントリなし — 将来拡張用
          break;
      }
    }

    return result;
  }

  public processStageDropTable(
    stage: Pick<StageData, 'chapter' | 'rewards'>,
    clearedStages: readonly string[] = [],
    discoveryBonusRate: number = 0,
    rng: () => number = Math.random,
  ): StageDropResult {
    const dropTable = getStageDropTableForResidueUnlock(stage, clearedStages);
    return this.processDropTable(dropTable, discoveryBonusRate, rng);
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
