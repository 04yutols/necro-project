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

  setPlayer: (player) => set({ player }),
  setNecroStatus: (status) => set({ necroStatus: status }),
  setParty: (party) => set({ party }),
  setInventoryMonsters: (monsters) => set({ inventoryMonsters: monsters }),
  setSoulShards: (shards) => set({ soulShards: shards }),
  setInventoryItems: (items) => set({ inventoryItems: items }),
  setEquippingMonsterId: (id) => set({ equippingMonsterId: id }),
  addBattleLog: (log) => set((state) => ({ battleLogs: [...state.battleLogs, log].slice(-50) })),
  clearBattleLogs: () => set({ battleLogs: ['SYSTEM STANDBY...'] }),  updateHP: (hp) => set((state) => ({
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
  })
}));
