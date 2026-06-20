import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import jobsData from '../data/master/jobs.json';
import itemsData from '../data/master/items.json';
import demonFormsData from '../data/master/demonForms.json';
import { getJobUnlockStatus } from '../logic/JobSystem';
import { calculateEnergyState } from '../logic/EnergySystem';
import { hydrateMonsterEnergy } from '../logic/MonsterEnergySystem';
import { getJobBaseStatsAtLevel } from '../logic/JobGrowthSystem';
import { levelFromTotalExp } from '../logic/ExperienceSystem';
import { DEMON_ACTION_LIMIT, clampDemonGauge } from '../logic/DemonizationSystem';
import { isAbyssalResidueUnlocked } from '../logic/AbyssalResidueUnlockSystem';
import { applyResidueEnhancement, spendResidueMaterials } from '../logic/ResidueEnhancement';
import { isResidueSlotCompatible } from '../logic/ResidueScore';
import { calculateCharacterStatProfile } from '../logic/StatSystem';
import {
  calculateDismantleRewards,
  calculateReforgedWeapon,
  getNextReforgeTargetIlv,
  getRankUpCost,
  getReforgeCost,
  hasEnoughWeaponMaterials,
} from '../logic/WeaponSystem';
import { CharacterData, NecroStatus, MonsterData, SoulShardData, ItemData, EquipmentSlots, AbyssalResidueData, ResidueMatData, JobData, WeaponMaterialData, WeaponMaterialType, DemonFormData, DemonRiskType } from '../types/game';
import type { ServerGameData } from '../types/serverGame';

const JOBS = jobsData as Record<string, JobData>;
const ITEMS = itemsData as Record<string, ItemData>;
const DEMON_FORMS = demonFormsData as Record<string, DemonFormData>;
export const GAME_STORE_STORAGE_KEY = 'necro-game-store-v1';
const GAME_STORE_VERSION = 2;
const CACHE_KIND_GUEST_SAVE = 'guest-save';
const CACHE_KIND_SERVER_SNAPSHOT = 'server-snapshot';

const memoryStorage: StateStorage = (() => {
  const storage = new Map<string, string>();
  return {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => {
      storage.set(name, value);
    },
    removeItem: (name) => {
      storage.delete(name);
    },
  };
})();

const getGameStorage = (): StateStorage => {
  if (typeof window === 'undefined') return memoryStorage;
  try {
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
};

function emptyResidueSlots(): (AbyssalResidueData | null)[] {
  return [null, null, null, null, null];
}

function getE2EInitialClearedStages(): string[] {
  if (typeof window === 'undefined') return [];
  const isLocalE2EHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (process.env.NODE_ENV === 'production' && !isLocalE2EHost) return [];
  try {
    const raw = window.sessionStorage.getItem('necro-e2e-cleared-stages');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function shouldUseE2EBattleBoost(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalE2EHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (process.env.NODE_ENV === 'production' && !isLocalE2EHost) return false;
  return window.sessionStorage.getItem('necro-e2e-battle-boost') === '1';
}

const MOCK_WEAPONS: ItemData[] = [
  {
    id: 'w-bone-cleaver',
    name: '骨砕きの短剣',
    type: 'WEAPON',
    rarity: 'R',
    weaponRarity: 'R',
    archetype: 'MID',
    rank: 1,
    ilv: 1,
    icon: '⚔',
    stats: {},
    subOptions: [{ type: 'ATK%', value: 6.2 }],
    passiveA: { nameJa: '粗削りの刃', descTemplate: '敵を倒した時、自身のHPを{value}%回復する。', values: [4, 5, 6, 7, 8] },
    passiveB: { nameJa: '戦場勘', descTemplate: '通常攻撃の与ダメージが{value}%上昇する。', values: [3, 4, 5, 6, 7] },
    isUnique: false,
  },
  {
    id: 'w-bleed-reaver',
    name: '血啜りの処刑剣',
    type: 'WEAPON',
    rarity: 'SR',
    weaponRarity: 'SR',
    archetype: 'HIGH',
    rank: 5,
    ilv: 78,
    icon: '⚔',
    stats: {},
    subOptions: [{ type: 'CRIT_RATE', value: 6.4 }],
    passiveA: { nameJa: '出血追討', descTemplate: '出血状態の敵に対する会心率が{value}%上昇する。', values: [15, 19, 22, 26, 30], condition: 'BLEED', systemTag: 'GIANT_KILLING' },
    passiveB: { nameJa: '早駆けの殺意', descTemplate: '条件成立時、行動値が{value}%早まる。', values: [10, 13, 15, 18, 20], condition: 'BLEED', systemTag: 'ACTION_VALUE' },
    isUnique: false,
  },
  {
    id: 'w-spirit-silver-saber',
    name: '霊銀の斬骨刀',
    type: 'WEAPON',
    rarity: 'SSR',
    weaponRarity: 'SSR',
    archetype: 'MID',
    rank: 2,
    ilv: 72,
    icon: '☽',
    stats: {},
    subOptions: [{ type: 'CRIT_DMG', value: 16 }, { type: 'DARK_DMG_BOOST', value: 13 }],
    passiveA: { nameJa: '残響蓄積', descTemplate: 'スキル使用ごとに残響を獲得し、3層消費時に闇属性追加ダメージ+{value}%を与える。', values: [18, 23, 27, 32, 36], systemTag: 'SOUL_SHATTER' },
    passiveB: { nameJa: '魔神呼応', descTemplate: '残響消費時、魔神化ゲージを{value}%回復する。', values: [10, 13, 15, 18, 20], systemTag: 'DEMON_MODE' },
    isUnique: false,
    flavor: '死霊の冷気を帯びた刀。刃紋に骸の白光が走る。',
  },
  {
    id: 'w-ur-grudge',
    name: '怨嗟顕現・喰魂',
    type: 'WEAPON',
    rarity: 'UR',
    weaponRarity: 'UR',
    archetype: 'MYTHIC',
    rank: 5,
    ilv: 90,
    icon: '☠',
    stats: {},
    subOptions: [{ type: 'ATK%', value: 12 }, { type: 'DARK_DMG_BOOST', value: 7.5 }],
    passiveA: { nameJa: '怨念の特異点', descTemplate: '無条件で全ダメージ+{value}%。', values: [30, 38, 45, 53, 60], systemTag: 'DEMON_MODE' },
    passiveB: { nameJa: '霊的防壁破断', descTemplate: '攻撃が霊的防壁を貫通し、防御干渉を{value}%無視する。', values: [25, 32, 38, 44, 50], systemTag: 'SHIELD_PIERCE' },
    isUnique: true,
    isUR: true,
    discovererName: 'アルド',
    serialNo: 1,
    flavor: '周回で屠られた魔物たちの怨念が刃の内側で折り重なり、握る者の魂へ黒い刃紋を伸ばす。',
  },
];

const INITIAL_CONSUMABLES: ItemData[] = [
  { ...ITEMS.underworld_potion, quantity: 3 },
  { ...ITEMS.ether_shard, quantity: 2 },
  { ...ITEMS.soul_incense, quantity: 1 },
];

function isConsumable(item: ItemData): boolean {
  return item.type === 'CONSUMABLE';
}

function mergeInventoryItems(current: ItemData[], incoming: ItemData[]): ItemData[] {
  return incoming.reduce<ItemData[]>((items, item) => {
    if (!isConsumable(item)) return [...items, item];
    const quantity = Math.max(1, item.quantity ?? 1);
    const existingIndex = items.findIndex(existing => isConsumable(existing) && existing.id === item.id);
    if (existingIndex === -1) return [...items, { ...item, quantity }];
    return items.map((existing, index) => index === existingIndex
      ? { ...existing, quantity: (existing.quantity ?? 0) + quantity }
      : existing);
  }, current);
}

function withNecroProgression(player: CharacterData, necroStatus?: NecroStatus | null): CharacterData {
  return {
    ...player,
    necroLevel: necroStatus?.level ?? player.necroLevel ?? 1,
    necroBaseStatsBonus: necroStatus?.baseStatsBonus ?? player.necroBaseStatsBonus ?? 1,
  };
}

function withDerivedElementBoosts(
  player: CharacterData,
  residues: (AbyssalResidueData | null)[],
  necroStatus?: NecroStatus | null,
): CharacterData {
  const playerWithNecro = withNecroProgression(player, necroStatus);
  return {
    ...playerWithNecro,
    elementDmgBoosts: calculateCharacterStatProfile(playerWithNecro, residues).elementDmgBoosts,
  };
}

function updateWeaponCollection(items: ItemData[], weaponId: string, updater: (weapon: ItemData) => ItemData): ItemData[] {
  return items.map((item) => item.id === weaponId ? updater(item) : item);
}

function updateEquippedWeapon(player: CharacterData | null, weaponId: string, updater: (weapon: ItemData) => ItemData): CharacterData | null {
  if (!player || player.equipment.weapon?.id !== weaponId) return player;
  return {
    ...player,
    equipment: {
      ...player.equipment,
      weapon: updater(player.equipment.weapon),
    },
  };
}

function spendWeaponMaterials(materials: WeaponMaterialData[], costs: { type: WeaponMaterialType; quantity: number }[]): WeaponMaterialData[] {
  return materials.map((material) => {
    const cost = costs.find((candidate) => candidate.type === material.type);
    return cost ? { ...material, quantity: Math.max(0, material.quantity - cost.quantity) } : material;
  });
}

function addWeaponMaterials(materials: WeaponMaterialData[], rewards: { type: WeaponMaterialType; name: string; quantity: number }[]): WeaponMaterialData[] {
  return rewards.reduce((current, reward) => {
    if (current.some((material) => material.type === reward.type)) {
      return current.map((material) => material.type === reward.type
        ? { ...material, quantity: material.quantity + reward.quantity }
        : material);
    }
    return [...current, { type: reward.type, name: reward.name, quantity: reward.quantity }];
  }, materials);
}

interface GameState {
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
  isServerBacked: boolean;

  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  setInventoryMonsters: (monsters: MonsterData[]) => void;
  setSoulShards: (shards: SoulShardData[]) => void;
  setInventoryItems: (items: ItemData[]) => void;
  setAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  addInventoryItems: (items: ItemData[]) => void;
  consumeInventoryItem: (itemId: string) => boolean;
  addAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  addResidueMaterials: (mats: ResidueMatData[]) => void;
  addWeaponMaterials: (mats: WeaponMaterialData[]) => void;
  equipResidueToSlot: (slotIndex: number, residue: AbyssalResidueData | null) => void;
  upgradeResidue: (residueId: string, matIds: string[]) => void;
  rankUpWeapon: (weaponId: string) => void;
  reforgeWeapon: (weaponId: string) => void;
  dismantleWeapon: (weaponId: string) => void;
  setTransmutationPoints: (points: number) => void;

  updateHP: (hp: number) => void;
  updateEnergy: (energy: number) => void;
  updateEnergyBy: (delta: number) => void;
  restoreEnergy: () => void;
  addExp: (amount: number) => void;
  addGold: (amount: number) => void;
  addClearedStage: (stageId: string) => void;
  changeJob: (jobId: string) => void;

  // パーティ編成の更新
  updatePartySlot: (index: number, monster: MonsterData | null) => void;

  // パーティスロットの入れ替え
  swapPartySlots: (i: number, j: number) => void;

  // モンスターの現在HP（バトルランタイム用）
  monsterCurrentHp: Record<string, number>;
  damageMonster: (monsterId: string, dmg: number) => void;
  resetMonsterHp: () => void;

  // モンスターの削除（魂石化後など）
  removeMonster: (monsterId: string) => void;

  // 魂の欠片の追加
  addSoulShard: (shard: SoulShardData) => void;

  // 魂の欠片の装備
  equipShard: (monsterId: string, shardId: string) => void;

  // アイテムの装備/解除
  equipItem: (slot: keyof EquipmentSlots, item: ItemData) => void;
  unequipItem: (slot: keyof EquipmentSlots) => void;

  // モーダル制御状態
  equippingMonsterId: string | null;
  setEquippingMonsterId: (id: string | null) => void;

  // バトルログ
  battleLogs: string[];
  addBattleLog: (log: string) => void;
  clearBattleLogs: () => void;

  // グローバルアクション用トリガー
  actionTrigger: { type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId?: string } | null;
  setActionTrigger: (trigger: { type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId?: string } | null) => void;

  // 魔神化システム
  demonGauge: number;
  isDemonMode: boolean;
  demonActionsRemaining: number;
  demonUltimateUsed: boolean;
  demonFormJobId: string | null;
  demonEffectBFlag: string | null;
  demonRiskType: DemonRiskType;
  demonRiskValue: number;
  fillDemonGauge: (amount: number) => void;
  startDemonMode: (jobId?: string) => void;
  consumeDemonAction: () => void;
  endDemonMode: () => void;
  markDemonUltimateUsed: () => void;
  toggleDemonMode: () => void;

  // 画面遷移管理
  currentTab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS' | 'JOB';
  setCurrentTab: (tab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS' | 'JOB') => void;

  // 初期化用
  initialize: () => void;
  loadFromServer: (data: ServerGameData) => void;
  clearServerData: () => void;
}

type PersistedGameSnapshot = Pick<
  GameState,
  | 'player'
  | 'necroStatus'
  | 'party'
  | 'inventoryMonsters'
  | 'soulShards'
  | 'inventoryItems'
  | 'abyssalResidues'
  | 'equippedResidueSlots'
  | 'residueMaterials'
  | 'weaponMaterials'
  | 'transmutationPoints'
>;

type PersistedGameCacheKind = typeof CACHE_KIND_GUEST_SAVE | typeof CACHE_KIND_SERVER_SNAPSHOT;
type PersistedOfflineMutation = never;

type PersistedGameState = PersistedGameSnapshot & {
  cacheKind: PersistedGameCacheKind;
  cachedAt: string;
  offlineQueue: PersistedOfflineMutation[];
};

function normalizePersistedParty(party?: (MonsterData | null)[]): (MonsterData | null)[] {
  return [
    party?.[0] ? hydrateMonsterEnergy(party[0]) : null,
    party?.[1] ? hydrateMonsterEnergy(party[1]) : null,
    party?.[2] ? hydrateMonsterEnergy(party[2]) : null,
  ];
}

function normalizeResidueSlots(slots?: (AbyssalResidueData | null)[]): (AbyssalResidueData | null)[] {
  return [
    slots?.[0] ?? null,
    slots?.[1] ?? null,
    slots?.[2] ?? null,
    slots?.[3] ?? null,
    slots?.[4] ?? null,
  ];
}

function snapshotGameState(state: GameState): PersistedGameSnapshot {
  return {
    player: state.player,
    necroStatus: state.necroStatus,
    party: normalizePersistedParty(state.party),
    inventoryMonsters: state.inventoryMonsters.map(monster => hydrateMonsterEnergy(monster)),
    soulShards: state.soulShards,
    inventoryItems: state.inventoryItems,
    abyssalResidues: state.abyssalResidues,
    equippedResidueSlots: normalizeResidueSlots(state.equippedResidueSlots),
    residueMaterials: state.residueMaterials,
    weaponMaterials: state.weaponMaterials,
    transmutationPoints: state.transmutationPoints,
  };
}

function normalizeCacheKind(value: unknown): PersistedGameCacheKind {
  return value === CACHE_KIND_SERVER_SNAPSHOT ? CACHE_KIND_SERVER_SNAPSHOT : CACHE_KIND_GUEST_SAVE;
}

function withPersistedCacheMeta(state: Partial<PersistedGameState>): PersistedGameState {
  return {
    ...(state as PersistedGameSnapshot),
    cacheKind: normalizeCacheKind(state.cacheKind),
    cachedAt: typeof state.cachedAt === 'string' ? state.cachedAt : new Date(0).toISOString(),
    offlineQueue: [],
  };
}

function partializeGameState(state: GameState): PersistedGameState {
  return {
    ...snapshotGameState(state),
    cacheKind: state.isServerBacked ? CACHE_KIND_SERVER_SNAPSHOT : CACHE_KIND_GUEST_SAVE,
    cachedAt: new Date().toISOString(),
    offlineQueue: [],
  };
}

function migratePersistedGameState(persistedState: unknown): PersistedGameState {
  return withPersistedCacheMeta((persistedState ?? {}) as Partial<PersistedGameState>);
}

function mergePersistedGameState(persistedState: unknown, currentState: GameState): GameState {
  const persisted = withPersistedCacheMeta((persistedState ?? {}) as Partial<PersistedGameState>);
  if (!persisted.player) {
    return {
      ...currentState,
      isServerBacked: false,
    };
  }

  const equippedResidueSlots = isAbyssalResidueUnlocked(persisted.player.clearedStages)
    ? normalizeResidueSlots(persisted.equippedResidueSlots)
    : emptyResidueSlots();

  return {
    ...currentState,
    player: withDerivedElementBoosts(persisted.player, equippedResidueSlots, persisted.necroStatus ?? null),
    necroStatus: persisted.necroStatus ?? currentState.necroStatus,
    party: normalizePersistedParty(persisted.party),
    inventoryMonsters: (persisted.inventoryMonsters ?? []).map(monster => hydrateMonsterEnergy(monster)),
    soulShards: persisted.soulShards ?? [],
    inventoryItems: persisted.inventoryItems ?? [],
    abyssalResidues: persisted.abyssalResidues ?? [],
    equippedResidueSlots,
    residueMaterials: persisted.residueMaterials ?? [],
    weaponMaterials: persisted.weaponMaterials ?? [],
    transmutationPoints: persisted.transmutationPoints ?? 0,
    isServerBacked: false,
    monsterCurrentHp: {},
    equippingMonsterId: null,
    battleLogs: [
      persisted.cacheKind === CACHE_KIND_SERVER_SNAPSHOT
        ? 'CACHED CLOUD SNAPSHOT LOADED...'
        : 'LOCAL SAVE LOADED...',
    ],
    actionTrigger: null,
    currentTab: 'HOME',
    demonGauge: 0,
    isDemonMode: false,
    demonActionsRemaining: 0,
    demonUltimateUsed: false,
    demonFormJobId: null,
    demonEffectBFlag: null,
    demonRiskType: null,
    demonRiskValue: 0,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
  player: null,
  necroStatus: null,
  party: [null, null, null],
  monsterCurrentHp: {},
  inventoryMonsters: [],
  soulShards: [],
  inventoryItems: [],
  abyssalResidues: [],
  equippedResidueSlots: [null, null, null, null, null],
  residueMaterials: [],
  weaponMaterials: [],
  transmutationPoints: 0,
  isServerBacked: false,
  equippingMonsterId: null,
  battleLogs: ['SYSTEM STANDBY...'],
  actionTrigger: null,
  demonGauge: 0,
  isDemonMode: false,
  demonActionsRemaining: 0,
  demonUltimateUsed: false,
  demonFormJobId: null,
  demonEffectBFlag: null,
  demonRiskType: null,
  demonRiskValue: 0,
  fillDemonGauge: (amount) => set((state) => ({ demonGauge: clampDemonGauge(state.demonGauge + amount) })),
  startDemonMode: (jobId) => set((state) => {
    if (state.isDemonMode || state.demonGauge < 100) return state;
    const formJobId = jobId ?? state.player?.currentJobId ?? 'warrior';
    const form = DEMON_FORMS[formJobId] ?? DEMON_FORMS.warrior;
    return {
      demonGauge: 0,
      isDemonMode: true,
      demonActionsRemaining: DEMON_ACTION_LIMIT,
      demonUltimateUsed: false,
      demonFormJobId: form.jobId,
      demonEffectBFlag: form.effectB.onAttackEffect ?? null,
      demonRiskType: form.effectB.riskType,
      demonRiskValue: form.effectB.riskValue ?? 0,
    };
  }),
  consumeDemonAction: () => set((state) => {
    if (!state.isDemonMode) return state;
    const nextActions = Math.max(0, state.demonActionsRemaining - 1);
    if (nextActions > 0) return { demonActionsRemaining: nextActions };
    return {
      isDemonMode: false,
      demonActionsRemaining: 0,
      demonUltimateUsed: false,
      demonFormJobId: null,
      demonEffectBFlag: null,
      demonRiskType: null,
      demonRiskValue: 0,
    };
  }),
  endDemonMode: () => set({
    isDemonMode: false,
    demonActionsRemaining: 0,
    demonUltimateUsed: false,
    demonFormJobId: null,
    demonEffectBFlag: null,
    demonRiskType: null,
    demonRiskValue: 0,
  }),
  markDemonUltimateUsed: () => set((state) => state.isDemonMode ? { demonUltimateUsed: true } : state),
  toggleDemonMode: () => set((state) => {
    if (state.isDemonMode) {
      return {
        isDemonMode: false,
        demonActionsRemaining: 0,
        demonUltimateUsed: false,
        demonFormJobId: null,
        demonEffectBFlag: null,
        demonRiskType: null,
        demonRiskValue: 0,
      };
    }
    if (state.demonGauge < 100) return state;
    const formJobId = state.player?.currentJobId ?? 'warrior';
    const form = DEMON_FORMS[formJobId] ?? DEMON_FORMS.warrior;
    return {
      demonGauge: 0,
      isDemonMode: true,
      demonActionsRemaining: DEMON_ACTION_LIMIT,
      demonUltimateUsed: false,
      demonFormJobId: form.jobId,
      demonEffectBFlag: form.effectB.onAttackEffect ?? null,
      demonRiskType: form.effectB.riskType,
      demonRiskValue: form.effectB.riskValue ?? 0,
    };
  }),
  currentTab: 'HOME',

  setPlayer: (player) => set((state) => ({
    player: withDerivedElementBoosts(player, state.equippedResidueSlots, state.necroStatus),
  })),
  setNecroStatus: (status) => set((state) => ({
    necroStatus: status,
    player: state.player
      ? withDerivedElementBoosts(state.player, state.equippedResidueSlots, status)
      : state.player,
  })),
  setParty: (party) => set({ party }),
  setInventoryMonsters: (monsters) => set({ inventoryMonsters: monsters }),
  setSoulShards: (shards) => set({ soulShards: shards }),
  setInventoryItems: (items) => set({ inventoryItems: items }),
  setAbyssalResidues: (residues) => set({ abyssalResidues: residues }),
  addInventoryItems: (items) => set((state) => ({
    inventoryItems: mergeInventoryItems(state.inventoryItems, items),
  })),
  consumeInventoryItem: (itemId) => {
    let consumed = false;
    set((state) => {
      const item = state.inventoryItems.find(current => current.id === itemId && current.type === 'CONSUMABLE');
      if (!item || (item.quantity ?? 0) <= 0) return state;
      consumed = true;
      const nextItems = (item.quantity ?? 1) <= 1
        ? state.inventoryItems.filter(current => current.id !== itemId)
        : state.inventoryItems.map(current => current.id === itemId
          ? { ...current, quantity: (current.quantity ?? 1) - 1 }
          : current);
      return { inventoryItems: nextItems };
    });
    return consumed;
  },
  addAbyssalResidues: (residues) => set((state) => {
    if (!isAbyssalResidueUnlocked(state.player?.clearedStages)) return state;
    return { abyssalResidues: [...state.abyssalResidues, ...residues] };
  }),
  addResidueMaterials: (mats) => set((state) => {
    if (!isAbyssalResidueUnlocked(state.player?.clearedStages)) return state;
    return { residueMaterials: [...state.residueMaterials, ...mats] };
  }),
  addWeaponMaterials: (mats) => set((state) => ({
    weaponMaterials: addWeaponMaterials(state.weaponMaterials, mats),
  })),
  equipResidueToSlot: (slotIndex, residue) => set((state) => {
    if (residue && !isAbyssalResidueUnlocked(state.player?.clearedStages)) return state;
    if (residue && !isResidueSlotCompatible(residue, slotIndex)) return state;
    const slots = [...state.equippedResidueSlots] as (AbyssalResidueData | null)[];
    slots[slotIndex] = residue;
    return {
      equippedResidueSlots: slots,
      player: state.player ? withDerivedElementBoosts(state.player, slots) : state.player,
    };
  }),
  upgradeResidue: (residueId, matIds) => set((state) => {
    if (!isAbyssalResidueUnlocked(state.player?.clearedStages)) return state;
    const residue = state.abyssalResidues.find(r => r.id === residueId);
    if (!residue) return state;
    const spent = spendResidueMaterials(state.residueMaterials, matIds);
    if (spent.expGain <= 0) return state;

    const enhanced = applyResidueEnhancement(residue, spent.expGain);
    const updatedResidues = state.abyssalResidues.map(r =>
      r.id === residueId ? enhanced : r
    );
    const updatedEquippedSlots = state.equippedResidueSlots.map(s =>
      s?.id === residueId ? { ...s, level: enhanced.level, exp: enhanced.exp, maxExp: enhanced.maxExp } : s
    ) as (AbyssalResidueData | null)[];
    const remainingMaterials = spent.materials;
    return { abyssalResidues: updatedResidues, equippedResidueSlots: updatedEquippedSlots, residueMaterials: remainingMaterials };
  }),
  rankUpWeapon: (weaponId) => set((state) => {
    const weapon = state.inventoryItems.find((item) => item.id === weaponId)
      ?? (state.player?.equipment.weapon?.id === weaponId ? state.player.equipment.weapon : null);
    if (!weapon || weapon.type !== 'WEAPON') return state;
    const cost = getRankUpCost(weapon);
    if (!cost || !hasEnoughWeaponMaterials(state.weaponMaterials, [cost])) return state;

    const updater = (item: ItemData): ItemData => ({
      ...item,
      rank: Math.min(5, (item.rank ?? 0) + 1),
    });
    const nextPlayer = updateEquippedWeapon(state.player, weaponId, updater);

    return {
      inventoryItems: updateWeaponCollection(state.inventoryItems, weaponId, updater),
      weaponMaterials: spendWeaponMaterials(state.weaponMaterials, [cost]),
      player: nextPlayer ? withDerivedElementBoosts(nextPlayer, state.equippedResidueSlots) : nextPlayer,
      battleLogs: [...state.battleLogs, `WEAPON RESONANCE: ${weapon.name} 共鳴ランク上昇`].slice(-50),
    };
  }),
  reforgeWeapon: (weaponId) => set((state) => {
    const weapon = state.inventoryItems.find((item) => item.id === weaponId)
      ?? (state.player?.equipment.weapon?.id === weaponId ? state.player.equipment.weapon : null);
    if (!weapon || weapon.type !== 'WEAPON') return state;
    const targetIlv = getNextReforgeTargetIlv(weapon);
    if (!targetIlv) return state;
    const costs = getReforgeCost(weapon);
    if (!hasEnoughWeaponMaterials(state.weaponMaterials, costs)) return state;

    const updater = (item: ItemData): ItemData => calculateReforgedWeapon(item, targetIlv);
    const nextPlayer = updateEquippedWeapon(state.player, weaponId, updater);

    return {
      inventoryItems: updateWeaponCollection(state.inventoryItems, weaponId, updater),
      weaponMaterials: spendWeaponMaterials(state.weaponMaterials, costs),
      player: nextPlayer ? withDerivedElementBoosts(nextPlayer, state.equippedResidueSlots) : nextPlayer,
      battleLogs: [...state.battleLogs, `WEAPON REFORGE: ${weapon.name} ILv.${targetIlv}`].slice(-50),
    };
  }),
  dismantleWeapon: (weaponId) => set((state) => {
    if (state.player?.equipment.weapon?.id === weaponId) return state;
    const weapon = state.inventoryItems.find((item) => item.id === weaponId);
    if (!weapon || weapon.type !== 'WEAPON') return state;
    const rewards = calculateDismantleRewards(weapon);
    if (rewards.length === 0) return state;

    return {
      inventoryItems: state.inventoryItems.filter((item) => item.id !== weaponId),
      weaponMaterials: addWeaponMaterials(state.weaponMaterials, rewards),
      battleLogs: [...state.battleLogs, `WEAPON DISMANTLE: ${weapon.name} → ${rewards.map((reward) => `${reward.name}×${reward.quantity}`).join(' / ')}`].slice(-50),
    };
  }),
  setTransmutationPoints: (points) => set({ transmutationPoints: Math.max(0, points) }),
  setEquippingMonsterId: (id) => set({ equippingMonsterId: id }),
  addBattleLog: (log) => set((state) => ({ battleLogs: [...state.battleLogs, log].slice(-50) })),
  clearBattleLogs: () => set({ battleLogs: ['SYSTEM STANDBY...'] }),
  setActionTrigger: (trigger) => set({ actionTrigger: trigger }),
  setCurrentTab: (tab) => set({ currentTab: tab }),

  updateHP: (hp) => set((state) => ({
    player: state.player ? { ...state.player, stats: { ...state.player.stats, hp } } : null
  })),
  updateEnergy: (energy) => set((state) => ({
    player: state.player ? { ...state.player, currentEnergy: Math.max(0, Math.min(energy, state.player.maxEnergy)) } : null
  })),
  updateEnergyBy: (delta) => set((state) => {
    if (!state.player) return {};
    const next = Math.max(0, Math.min(state.player.currentEnergy + delta, state.player.maxEnergy));
    return { player: { ...state.player, currentEnergy: next } };
  }),
  restoreEnergy: () => set((state) => ({
    player: state.player ? { ...state.player, currentEnergy: state.player.maxEnergy } : null,
  })),
  addExp: (amount) => set((state) => {
    if (!state.player) return { player: null };
    let activeJobLevel = 1;
    const newJobs = state.player.jobs.map(j => {
      if (j.jobId === state.player?.currentJobId) {
        const newExp = j.exp + amount;
        const newLevel = levelFromTotalExp(newExp);
        activeJobLevel = newLevel;
        return { ...j, exp: newExp, level: newLevel };
      }
      return j;
    });
    const activeJob = JOBS[state.player.currentJobId];
    const energyState = calculateEnergyState(activeJob, activeJobLevel);
    const baseStats = getJobBaseStatsAtLevel(activeJob, activeJobLevel, state.player.baseStats ?? state.player.stats);
    const nextPlayer = {
      ...state.player,
      baseStats,
      stats: baseStats,
      jobs: newJobs,
      maxEnergy: energyState.maxEnergy,
      currentEnergy: Math.min(state.player.currentEnergy, energyState.maxEnergy),
    };
    return {
      player: withDerivedElementBoosts(nextPlayer, state.equippedResidueSlots, state.necroStatus),
    };
  }),
  addGold: (amount) => set((state) => {
    if (!state.player) return { player: null };
    return { player: { ...state.player, gold: state.player.gold + amount } };
  }),
  addClearedStage: (stageId) => set((state) => {
    if (!state.player) return { player: null };
    if (state.player.clearedStages.includes(stageId)) return state;
    return {
      player: {
        ...state.player,
        clearedStages: [...state.player.clearedStages, stageId]
      }
    };
  }),
  changeJob: (jobId) => set((state) => {
    if (!state.player) return state;
    const nextJob = JOBS[jobId];
    if (!nextJob) return state;
    const unlock = getJobUnlockStatus(state.player, nextJob);
    if (!unlock.unlocked) return state;

    const hasJob = state.player.jobs.some(job => job.jobId === jobId);
    const nextJobs = hasJob
      ? state.player.jobs
      : [...state.player.jobs, { jobId, level: 1, exp: 0 }];

    const nextJobLevel = Math.max(1, nextJobs.find(job => job.jobId === jobId)?.level ?? 1);
    const energyState = calculateEnergyState(nextJob, nextJobLevel);
    const baseStats = getJobBaseStatsAtLevel(nextJob, nextJobLevel, state.player.baseStats ?? state.player.stats);
    const nextPlayer = withDerivedElementBoosts({
        ...state.player,
        currentJobId: jobId,
        category: nextJob.category,
        baseStats,
        stats: baseStats,
        jobs: nextJobs,
        maxEnergy: energyState.maxEnergy,
        currentEnergy: Math.min(state.player.currentEnergy, energyState.maxEnergy),
      }, state.equippedResidueSlots);

    return {
      player: nextPlayer,
      battleLogs: [
        ...state.battleLogs,
        `JOB CHANGE: ${nextJob.displayName ?? nextJob.name} に転職`,
      ].slice(-50),
    };
  }),
  
  updatePartySlot: (index, monster) => set((state) => {
    const newParty = [...state.party];
    newParty[index] = monster;
    return { party: newParty as [MonsterData | null, MonsterData | null, MonsterData | null] };
  }),

  swapPartySlots: (i, j) => set((state) => {
    const p = [...state.party] as (MonsterData | null)[];
    [p[i], p[j]] = [p[j], p[i]];
    return { party: p as [MonsterData | null, MonsterData | null, MonsterData | null] };
  }),

  damageMonster: (monsterId, dmg) => set((state) => ({
    monsterCurrentHp: {
      ...state.monsterCurrentHp,
      [monsterId]: Math.max(0, (state.monsterCurrentHp[monsterId] ?? 0) - dmg),
    },
  })),

  resetMonsterHp: () => set((state) => ({
    monsterCurrentHp: Object.fromEntries(
      state.party.filter(Boolean).map((m) => [m!.id, m!.stats.hp])
    ),
  })),

  removeMonster: (monsterId) => set((state) => ({
    inventoryMonsters: state.inventoryMonsters.filter(m => m.id !== monsterId),
    party: state.party.map(m => m?.id === monsterId ? null : m) as [MonsterData | null, MonsterData | null, MonsterData | null]
  })),
  
  addSoulShard: (shard) => set((state) => ({
    soulShards: [...state.soulShards, shard]
  })),

  equipShard: (monsterId, shardId) => set((state) => ({
    inventoryMonsters: state.inventoryMonsters.map(m => 
      m.id === monsterId ? { ...m, equippedShardId: shardId } : m
    ),
    party: state.party.map(m => 
      m?.id === monsterId ? { ...m, equippedShardId: shardId } : m
    ) as [MonsterData | null, MonsterData | null, MonsterData | null]
  })),

  equipItem: (slot, item) => set((state) => {
    if (!state.player) return state;
    const nextPlayer = {
      ...state.player,
      equipment: {
        ...state.player.equipment,
        [slot]: item
      }
    };
    return {
      player: withDerivedElementBoosts(nextPlayer, state.equippedResidueSlots)
    };
  }),

  unequipItem: (slot) => set((state) => {
    if (!state.player) return state;
    const nextPlayer = {
      ...state.player,
      equipment: {
        ...state.player.equipment,
        [slot]: null
      }
    };
    return {
      player: withDerivedElementBoosts(nextPlayer, state.equippedResidueSlots)
    };
  }),

  loadFromServer: (data) => set(() => {
    const serverEquippedResidueSlots = [
      data.equippedResidueSlots[0] ?? null,
      data.equippedResidueSlots[1] ?? null,
      data.equippedResidueSlots[2] ?? null,
      data.equippedResidueSlots[3] ?? null,
      data.equippedResidueSlots[4] ?? null,
    ] as (AbyssalResidueData | null)[];
    const equippedResidueSlots = isAbyssalResidueUnlocked(data.player.clearedStages)
      ? serverEquippedResidueSlots
      : emptyResidueSlots();
    return {
      player: withDerivedElementBoosts(data.player, equippedResidueSlots, data.necroStatus),
      necroStatus: data.necroStatus,
      party: [
        data.party[0] ? hydrateMonsterEnergy(data.party[0]) : null,
        data.party[1] ? hydrateMonsterEnergy(data.party[1]) : null,
        data.party[2] ? hydrateMonsterEnergy(data.party[2]) : null,
      ],
      inventoryMonsters: data.inventoryMonsters.map(monster => hydrateMonsterEnergy(monster)),
      soulShards: data.soulShards,
      inventoryItems: data.inventoryItems,
      abyssalResidues: data.abyssalResidues,
      equippedResidueSlots,
      residueMaterials: data.residueMaterials,
      weaponMaterials: data.weaponMaterials,
      transmutationPoints: data.transmutationPoints,
      isServerBacked: true,
      monsterCurrentHp: {},
      equippingMonsterId: null,
      battleLogs: ['CLOUD SAVE LOADED...'],
      actionTrigger: null,
      currentTab: 'HOME',
      demonGauge: 0,
      isDemonMode: false,
      demonActionsRemaining: 0,
      demonUltimateUsed: false,
      demonFormJobId: null,
      demonEffectBFlag: null,
      demonRiskType: null,
      demonRiskValue: 0,
    };
  }),

  clearServerData: () => set({
    player: null,
    necroStatus: null,
    party: [null, null, null],
    inventoryMonsters: [],
    soulShards: [],
    inventoryItems: [],
    abyssalResidues: [],
    equippedResidueSlots: [null, null, null, null, null],
    residueMaterials: [],
    weaponMaterials: [],
    transmutationPoints: 0,
    isServerBacked: false,
    monsterCurrentHp: {},
    equippingMonsterId: null,
    battleLogs: ['SYSTEM STANDBY...'],
    actionTrigger: null,
    currentTab: 'HOME',
    demonGauge: 0,
    isDemonMode: false,
    demonActionsRemaining: 0,
    demonUltimateUsed: false,
    demonFormJobId: null,
    demonEffectBFlag: null,
    demonRiskType: null,
    demonRiskValue: 0,
  }),

  initialize: () => {
    const initialClearedStages = getE2EInitialClearedStages();
    const baseWarriorStats = getJobBaseStatsAtLevel(JOBS.warrior, 1);
    const warriorBaseStats = shouldUseE2EBattleBoost()
      ? {
          ...baseWarriorStats,
          hp: Math.max(baseWarriorStats.hp, 900),
          atk: Math.max(baseWarriorStats.atk, 180),
          def: Math.max(baseWarriorStats.def, 90),
          spd: Math.max(baseWarriorStats.spd, 160),
        }
      : baseWarriorStats;
    set({
    player: {
      id: '1',
      name: 'アルド',
      currentJobId: 'warrior',
      category: 'PHYSICAL',
      baseStats: warriorBaseStats,
      necroLevel: 1,
      necroBaseStatsBonus: 1.0,
      stats: warriorBaseStats,
      baseResistances: {},
      passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveSpdBonus: 0, passiveCritRateBonus: 0, passiveCritDmgBonus: 0, passiveHpBonus: 0 },
      equipment: {
        weapon: MOCK_WEAPONS[0],
        sub: null, head: null,
        body: null,
        arms: null, legs: null, acc1: null, acc2: null,
      },
      jobs: [
        { jobId: 'warrior', level: 1, exp: 0 },
        { jobId: 'mage', level: 1, exp: 0 },
        { jobId: 'dark_priest', level: 1, exp: 0 },
        { jobId: 'rogue', level: 1, exp: 0 },
        { jobId: 'necromancer', level: 1, exp: 0 }
      ],
      isAwakened: false,
      clearedStages: initialClearedStages,
      gold: 50000,
      statusEffects: [],
      currentEnergy: calculateEnergyState(JOBS.warrior, 1).currentEnergy,
      maxEnergy: calculateEnergyState(JOBS.warrior, 1).maxEnergy,
      elementDmgBoosts: {},
    },
    necroStatus: {
      level: 1,
      rank: 1,
      maxCost: 10,
      baseStatsBonus: 1.0,
      exp: 0,
    },
    inventoryMonsters: [
      hydrateMonsterEnergy({ id: 'm1', name: 'ゴブリン',   tribe: 'HUMANOID' as const, cost: 3, stats: { hp: 50, atk: 10, def: 5,  spd: 80,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -20 }, skillIds: ['skill_rogue_1'], maxEnergy: 18 }),
      hydrateMonsterEnergy({ id: 'm2', name: 'スケルトン', tribe: 'UNDEAD' as const,   cost: 4, stats: { hp: 40, atk: 12, def: 8,  spd: 50,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 20 }, resistances: { LIGHT: -50, DARK: 50 }, skillIds: ['skill_necromancer_1'], maxEnergy: 36 }),
      hydrateMonsterEnergy({ id: 'm3', name: 'ゾンビ',     tribe: 'UNDEAD' as const,   cost: 4, stats: { hp: 80, atk: 8,  def: 4,  spd: 20,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 }, skillIds: ['skill_darkpriest_1'], maxEnergy: 30 }),
    ],
    inventoryItems: [...MOCK_WEAPONS, ...INITIAL_CONSUMABLES],
    soulShards: [
      {
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, elementDmgBoost: 0 }
      }
    ],
    abyssalResidues: [],
    equippedResidueSlots: [null, null, null, null, null],
    weaponMaterials: [
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 38 },
      { type: 'IDEA_SR', name: '業物のイデア', quantity: 14 },
      { type: 'IDEA_SSR', name: '英雄のイデア', quantity: 6 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 88 },
    ],
    transmutationPoints: 0,
    isServerBacked: false,
    residueMaterials: [],
    party: [
      hydrateMonsterEnergy({ id: 'm2', name: 'スケルトン', tribe: 'UNDEAD' as const, cost: 4, stats: { hp: 40, atk: 12, def: 8, spd: 50, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 20 }, resistances: { LIGHT: -50, DARK: 50 }, skillIds: ['skill_necromancer_1'], maxEnergy: 36 }),
      hydrateMonsterEnergy({ id: 'm3', name: 'ゾンビ',     tribe: 'UNDEAD' as const, cost: 4, stats: { hp: 80, atk: 8,  def: 4, spd: 20, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0  }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 }, skillIds: ['skill_darkpriest_1'], maxEnergy: 30 }),
      null,
    ],
    currentTab: 'HOME',
    demonGauge: 0,
    isDemonMode: false,
    demonActionsRemaining: 0,
    demonUltimateUsed: false,
    demonFormJobId: null,
    demonEffectBFlag: null,
    demonRiskType: null,
    demonRiskValue: 0,
    });
  }
    }),
    {
      name: GAME_STORE_STORAGE_KEY,
      version: GAME_STORE_VERSION,
      storage: createJSONStorage<PersistedGameState>(getGameStorage),
      partialize: partializeGameState,
      migrate: migratePersistedGameState,
      merge: mergePersistedGameState,
    },
  ),
);
