import monstersData from '../data/master/monsters.json';
import itemsData from '../data/master/items.json';
import { calcNecroMaxCost, reqNecroExp } from '../logic/NecroGrowthSystem';
import { RESIDUE_SLOT_ORDER } from '../logic/ResidueScore';
import type {
  AbyssalResidueData,
  BaseStats,
  CharacterData,
  EquipmentSlots,
  ItemData,
  MonsterData,
  NecroStatus,
  Resistances,
  ResidueMatData,
  SoulShardData,
  Tribe,
  WeaponMaterialData,
} from '../types/game';
import { makeCharacter } from './factories';

// useGameStore の persist スナップショット（ゲストセーブ）を生成する進行プリセット。
// 実マスターデータ（monsters.json / items.json）から実在 ID を引いて構築し、
// mergePersistedGameState（src/store/useGameStore.ts:434-479）が受け入れる形状に合わせる。

// GAME_STORE_VERSION（src/store/useGameStore.ts:33）と一致させること。
const PRESET_VERSION = 2;

const MONSTERS = monstersData as Record<string, {
  name: string;
  tribe: Tribe;
  cost: number;
  stats: BaseStats;
  resistances: Resistances;
}>;
const ITEMS = itemsData as Record<string, ItemData>;

/** partialize 対象（PersistedGameSnapshot, useGameStore.ts:350-363）と過不足なく一致するキー集合。 */
export interface PersistedGamePreset {
  player: CharacterData | null;
  necroStatus: NecroStatus | null;
  party: (MonsterData | null)[];
  inventoryMonsters: MonsterData[];
  soulShards: SoulShardData[];
  inventoryItems: ItemData[];
  abyssalResidues: AbyssalResidueData[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  residueMaterials: ResidueMatData[];
  weaponMaterials: WeaponMaterialData[];
  transmutationPoints: number;
}

export interface PresetSnapshot {
  state: PersistedGamePreset;
  version: number;
}

export type PresetName = 'fresh' | 'ch1_mid' | 'ch1_cleared' | 'yomi_b5' | 'endgame';

export const PRESET_NAMES: readonly PresetName[] = ['fresh', 'ch1_mid', 'ch1_cleared', 'yomi_b5', 'endgame'];

export function isPresetName(value: string): value is PresetName {
  return (PRESET_NAMES as readonly string[]).includes(value);
}

// ── 実ステージ ID（src/data/master/stages.json より）───────────────────────
const CH1_MID_STAGES = ['area1_safe', 'area1_node1', 'area1_a2', 'area1_a_mini', 'area1_node2'];
const CH1_CLEARED_STAGES = [
  ...CH1_MID_STAGES,
  'area1_b2',
  'area1_b3',
  'area1_c1',
  'area1_c2',
  'area1_c3',
  'area1_boss',
  'area1_node3', // area1_node3 到達で LAB / 黄泉タブが解放される
];

/** 黄泉ステージ ID を B1..upTo で列挙する（stages.json の yomi_bNN ゼロ埋め2桁形式）。 */
function yomiStages(upTo: number): string[] {
  return Array.from({ length: upTo }, (_, i) => `yomi_b${String(i + 1).padStart(2, '0')}`);
}

// ── 構築ヘルパー ────────────────────────────────────────────────────────────
function presetNecroStatus(level: number): NecroStatus {
  return { level, maxCost: calcNecroMaxCost(level), exp: reqNecroExp(level) };
}

function presetMonster(masterKey: string, maxEnergy: number): MonsterData {
  const base = MONSTERS[masterKey];
  return {
    id: masterKey,
    masterId: masterKey,
    name: base.name,
    tribe: base.tribe,
    cost: base.cost,
    stats: { ...base.stats },
    resistances: { ...base.resistances },
    currentEnergy: maxEnergy,
    maxEnergy,
  };
}

function initialParty(): (MonsterData | null)[] {
  return [presetMonster('skeleton', 36), presetMonster('zombie', 30), null];
}

function initialInventoryMonsters(): MonsterData[] {
  return [presetMonster('goblin', 18), presetMonster('skeleton', 36), presetMonster('zombie', 30)];
}

function initialShards(): SoulShardData[] {
  return [{ id: 'initial-shard-1', originMonsterName: 'ゴブリン', effect: { atkBonus: 2, elementDmgBoost: 0 } }];
}

function emptyResidueSlots(): (AbyssalResidueData | null)[] {
  return [null, null, null, null, null];
}

function presetWeaponMaterials(): WeaponMaterialData[] {
  return [
    { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 10 },
    { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 20 },
  ];
}

function buildPlayer(opts: { clearedStages: string[]; gold: number; equipment?: EquipmentSlots }): CharacterData {
  return makeCharacter({
    id: '1',
    name: 'アルド',
    jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
    clearedStages: opts.clearedStages,
    gold: opts.gold,
    ...(opts.equipment ? { equipment: opts.equipment } : {}),
  });
}

/** 残滓5枠を itemId=スロット順（head/arms/chest/waist/legs）で構築し、スロット互換を満たす。 */
function endgameResidueSlots(): AbyssalResidueData[] {
  return RESIDUE_SLOT_ORDER.map((slot) => ({
    id: `preset-residue-${slot}`,
    name: `深淵の残滓・${slot}`,
    itemId: slot,
    rarity: 'LEGENDARY' as const,
    mainStat: { type: 'ATK%', value: 20 },
    subOptions: [{ type: 'CRIT_RATE', value: 6 }, { type: 'CRIT_DMG', value: 12 }],
    level: 20,
    exp: 0,
    maxExp: 20000,
  }));
}

function endgameEquipment(): EquipmentSlots {
  return {
    weapon: { ...ITEMS.grudge_manifest },
    sub: null,
    head: null,
    body: null,
    arms: null,
    legs: null,
    acc1: null,
    acc2: null,
  };
}

function snapshot(over: Partial<PersistedGamePreset>): PresetSnapshot {
  return {
    state: {
      player: over.player ?? null,
      necroStatus: over.necroStatus ?? presetNecroStatus(1),
      party: over.party ?? initialParty(),
      inventoryMonsters: over.inventoryMonsters ?? initialInventoryMonsters(),
      soulShards: over.soulShards ?? initialShards(),
      inventoryItems: over.inventoryItems ?? [{ ...ITEMS.bone_cleaver }],
      abyssalResidues: over.abyssalResidues ?? [],
      equippedResidueSlots: over.equippedResidueSlots ?? emptyResidueSlots(),
      residueMaterials: over.residueMaterials ?? [],
      weaponMaterials: over.weaponMaterials ?? presetWeaponMaterials(),
      transmutationPoints: over.transmutationPoints ?? 0,
    },
    version: PRESET_VERSION,
  };
}

/**
 * 進行プリセットの persist スナップショットを生成する。
 * 'fresh' は null を返し、注入なし＝ useGameStore.initialize() の新規状態に委ねる。
 */
export function buildPresetSnapshot(name: PresetName): PresetSnapshot | null {
  switch (name) {
    case 'fresh':
      // 新規プレイヤー。スナップショットを注入せず initialize() に任せる。
      return null;
    case 'ch1_mid':
      // 第1章前半クリア想定。LAB/黄泉は未解放、ゴールド1万の中盤セーブ。
      return snapshot({
        player: buildPlayer({ clearedStages: [...CH1_MID_STAGES], gold: 10000 }),
        necroStatus: presetNecroStatus(8),
      });
    case 'ch1_cleared':
      // 第1章12ノード全クリア。area1_node3 到達で LAB/黄泉解放、ゴールド5万・ネクロLv30相当。
      return snapshot({
        player: buildPlayer({ clearedStages: [...CH1_CLEARED_STAGES], gold: 50000 }),
        necroStatus: presetNecroStatus(30),
      });
    case 'yomi_b5':
      // ch1_cleared に黄泉 B1〜B5 到達を加えた進行。
      return snapshot({
        player: buildPlayer({ clearedStages: [...CH1_CLEARED_STAGES, ...yomiStages(5)], gold: 50000 }),
        necroStatus: presetNecroStatus(35),
      });
    case 'endgame': {
      // 黄泉 B20 到達・UR武器装備・残滓5枠フル装備のエンドゲームセーブ。
      const residues = endgameResidueSlots();
      return snapshot({
        player: buildPlayer({
          clearedStages: [...CH1_CLEARED_STAGES, ...yomiStages(20)],
          gold: 500000,
          equipment: endgameEquipment(),
        }),
        necroStatus: presetNecroStatus(200),
        inventoryItems: [{ ...ITEMS.bone_cleaver }, { ...ITEMS.grudge_manifest }],
        abyssalResidues: [...residues],
        equippedResidueSlots: [...residues],
      });
    }
  }
}
