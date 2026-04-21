import { create } from 'zustand';
import { CharacterData, NecroStatus, MonsterData, SoulShardData, ItemData, EquipmentSlots } from '../types/game';

interface GameState {
  player: CharacterData | null;
  necroStatus: NecroStatus | null;
  party: (MonsterData | null)[];
  inventoryMonsters: MonsterData[];
  soulShards: SoulShardData[];
  inventoryItems: ItemData[];

  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  setInventoryMonsters: (monsters: MonsterData[]) => void;
  setSoulShards: (shards: SoulShardData[]) => void;
  setInventoryItems: (items: ItemData[]) => void;

  updateHP: (hp: number) => void;
  updateMP: (mp: number) => void;
  addExp: (amount: number) => void;
  addGold: (amount: number) => void;
  addClearedStage: (stageId: string) => void;

  // パーティ編成の更新
  updatePartySlot: (index: number, monster: MonsterData | null) => void;

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

  // 画面遷移管理（モバイル用）
  currentTab: 'BATTLE' | 'ARMY' | 'GRIMOIRE' | 'LOGS';
  setCurrentTab: (tab: 'BATTLE' | 'ARMY' | 'GRIMOIRE' | 'LOGS') => void;

  // 初期化用
  initialize: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  necroStatus: null,
  party: [null, null, null],
  inventoryMonsters: [],
  soulShards: [],
  inventoryItems: [],
  equippingMonsterId: null,
  battleLogs: ['SYSTEM STANDBY...'],
  actionTrigger: null,
  currentTab: 'BATTLE',

  setPlayer: (player) => set({ player }),
  setNecroStatus: (status) => set({ necroStatus: status }),
  setParty: (party) => set({ party }),
  setInventoryMonsters: (monsters) => set({ inventoryMonsters: monsters }),
  setSoulShards: (shards) => set({ soulShards: shards }),
  setInventoryItems: (items) => set({ inventoryItems: items }),
  setEquippingMonsterId: (id) => set({ equippingMonsterId: id }),
  addBattleLog: (log) => set((state) => ({ battleLogs: [...state.battleLogs, log].slice(-50) })),
  clearBattleLogs: () => set({ battleLogs: ['SYSTEM STANDBY...'] }),
  setActionTrigger: (trigger) => set({ actionTrigger: trigger }),
  setCurrentTab: (tab) => set({ currentTab: tab }),

  updateHP: (hp) => set((state) => ({
    player: state.player ? { ...state.player, stats: { ...state.player.stats, hp } } : null
  })),
  updateMP: (mp) => set((state) => ({
    player: state.player ? { ...state.player, stats: { ...state.player.stats, mp } } : null
  })),
  addExp: (amount) => set((state) => {
    if (!state.player) return { player: null };
    const newJobs = state.player.jobs.map(j => {
      if (j.jobId === state.player?.currentJobId) {
        const newExp = j.exp + amount;
        const newLevel = Math.floor(newExp / 100) + 1; // 簡易レベルアップロジック
        return { ...j, exp: newExp, level: newLevel };
      }
      return j;
    });
    return { player: { ...state.player, jobs: newJobs } };
  }),
  addGold: (amount) => set((state) => ({
    // 本来はGoldフィールドが必要
  })),
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
  
  updatePartySlot: (index, monster) => set((state) => {
    const newParty = [...state.party];
    newParty[index] = monster;
    return { party: newParty as [MonsterData | null, MonsterData | null, MonsterData | null] };
  }),
  
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
    return {
      player: {
        ...state.player,
        equipment: {
          ...state.player.equipment,
          [slot]: item
        }
      }
    };
  }),

  unequipItem: (slot) => set((state) => {
    if (!state.player) return state;
    return {
      player: {
        ...state.player,
        equipment: {
          ...state.player.equipment,
          [slot]: null
        }
      }
    };
  }),

  initialize: () => set({
    player: {
      id: '1',
      name: 'アルド',
      currentJobId: 'warrior',
      category: 'PHYSICAL',
      stats: { hp: 100, mp: 20, atk: 50, def: 30, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 20 },
      baseResistances: {},
      passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveMatkBonus: 0, passiveMdefBonus: 0 },
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
      isAwakened: false,
      clearedStages: [],
    },
    necroStatus: {
      level: 1,
      rank: 1,
      maxCost: 10,
      baseStatsBonus: 1.0,
    },
    inventoryMonsters: [
      { id: 'm1', name: 'ゴブリン', tribe: 'HUMANOID', cost: 3, stats: { hp: 50, mp: 0, atk: 10, def: 5, matk: 0, mdef: 2, agi: 5, luck: 5, tec: 5 }, resistances: { FIRE: -20 } },
      { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD', cost: 4, stats: { hp: 40, mp: 0, atk: 12, def: 8, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 8 }, resistances: { LIGHT: -50, DARK: 50 } },
      { id: 'm3', name: 'ゾンビ', tribe: 'UNDEAD', cost: 4, stats: { hp: 80, mp: 0, atk: 8, def: 4, matk: 0, mdef: 0, agi: 2, luck: 2, tec: 2 }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 } },
    ],
    inventoryItems: [
      { id: 'i1', name: 'Iron Sword', type: 'WEAPON', rarity: 'COMMON', stats: { atk: 10 } },
      { id: 'i2', name: 'Leather Armor', type: 'BODY', rarity: 'COMMON', stats: { def: 5, mdef: 2 } },
      { id: 'i3', name: 'Hero Soul Blade', type: 'WEAPON', rarity: 'UNIQUE', stats: { atk: 50, matk: 50, def: 10, mdef: 10 }, specialEffect: 'SOUL_RESONANCE' },
    ],
    soulShards: [
      {
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, matkBonus: 0 }
      }
    ],
    currentTab: 'BATTLE',
  })
}));
