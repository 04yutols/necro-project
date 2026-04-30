import { create } from 'zustand';
import { CharacterData, NecroStatus, MonsterData, SoulShardData, ItemData, EquipmentSlots, AbyssalResidueData, ResidueMatData } from '../types/game';

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

  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  setInventoryMonsters: (monsters: MonsterData[]) => void;
  setSoulShards: (shards: SoulShardData[]) => void;
  setInventoryItems: (items: ItemData[]) => void;
  setAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  equipResidueToSlot: (slotIndex: number, residue: AbyssalResidueData | null) => void;
  upgradeResidue: (residueId: string, matIds: string[]) => void;

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

  // 魔神化システム
  demonGauge: number;
  isDemonMode: boolean;
  fillDemonGauge: (amount: number) => void;
  toggleDemonMode: () => void;

  // 画面遷移管理
  currentTab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS';
  setCurrentTab: (tab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS') => void;

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
  abyssalResidues: [],
  equippedResidueSlots: [null, null, null],
  residueMaterials: [],
  equippingMonsterId: null,
  battleLogs: ['SYSTEM STANDBY...'],
  actionTrigger: null,
  demonGauge: 100,
  isDemonMode: false,
  fillDemonGauge: (amount) => set((state) => ({ demonGauge: Math.min(100, Math.max(0, state.demonGauge + amount)) })),
  toggleDemonMode: () => set((state) => {
    if (!state.isDemonMode && state.demonGauge < 100) return state;
    return { isDemonMode: !state.isDemonMode, demonGauge: state.isDemonMode ? 50 : state.demonGauge };
  }),
  currentTab: 'HOME',

  setPlayer: (player) => set({ player }),
  setNecroStatus: (status) => set({ necroStatus: status }),
  setParty: (party) => set({ party }),
  setInventoryMonsters: (monsters) => set({ inventoryMonsters: monsters }),
  setSoulShards: (shards) => set({ soulShards: shards }),
  setInventoryItems: (items) => set({ inventoryItems: items }),
  setAbyssalResidues: (residues) => set({ abyssalResidues: residues }),
  equipResidueToSlot: (slotIndex, residue) => set((state) => {
    const slots = [...state.equippedResidueSlots] as (AbyssalResidueData | null)[];
    slots[slotIndex] = residue;
    return { equippedResidueSlots: slots };
  }),
  upgradeResidue: (residueId, matIds) => set((state) => {
    const residue = state.abyssalResidues.find(r => r.id === residueId);
    if (!residue) return state;
    const expGain = matIds.reduce((acc, id) => {
      const mat = state.residueMaterials.find(m => m.id === id);
      return acc + (mat ? mat.expValue * mat.quantity : 0);
    }, 0);
    let newExp = residue.exp + expGain;
    let newLevel = residue.level;
    let newMaxExp = residue.maxExp;
    while (newExp >= newMaxExp && newLevel < 20) {
      newExp -= newMaxExp;
      newLevel++;
      newMaxExp = Math.floor(newMaxExp * 1.5);
    }
    if (newLevel >= 20) newExp = Math.min(newExp, newMaxExp);
    const updatedResidues = state.abyssalResidues.map(r =>
      r.id === residueId ? { ...r, level: newLevel, exp: newExp, maxExp: newMaxExp } : r
    );
    const updatedEquippedSlots = state.equippedResidueSlots.map(s =>
      s?.id === residueId ? { ...s, level: newLevel, exp: newExp, maxExp: newMaxExp } : s
    ) as (AbyssalResidueData | null)[];
    const remainingMaterials = state.residueMaterials.filter(m => !matIds.includes(m.id));
    return { abyssalResidues: updatedResidues, equippedResidueSlots: updatedEquippedSlots, residueMaterials: remainingMaterials };
  }),
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
      { id: 'i1', name: 'Iron Sword', type: 'WEAPON', rarity: 'COMMON', stats: { atk: 10 }, isUnique: false },
      { id: 'i2', name: 'Leather Armor', type: 'BODY', rarity: 'COMMON', stats: { def: 5, mdef: 2 }, isUnique: false },
      { id: 'i3', name: 'Hero Soul Blade', type: 'WEAPON', rarity: 'UNIQUE', stats: { atk: 50, matk: 50, def: 10, mdef: 10 }, specialEffect: 'SOUL_RESONANCE', isUnique: true },
    ],
    soulShards: [
      {
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, matkBonus: 0 }
      }
    ],
    abyssalResidues: [
      { id: 'r1', name: '深淵の指輪', itemId: 'abyss-ring', rarity: 'EPIC', mainStat: { type: 'ATK%', value: 35.2 }, subOptions: [{ type: 'CRIT_RATE', value: 7.8 }, { type: 'HP%', value: 6.2 }, { type: 'DEF_FLAT', value: 32 }, { type: 'MATK%', value: 4.1 }], level: 12, exp: 2400, maxExp: 4000 },
      { id: 'r2', name: '虚無の骸骨', itemId: 'void-skull', rarity: 'RARE', mainStat: { type: 'HP%', value: 22.8 }, subOptions: [{ type: 'DEF%', value: 5.4 }, { type: 'ATK_FLAT', value: 18 }, { type: 'AGI%', value: 3.2 }], level: 8, exp: 1200, maxExp: 3000 },
      { id: 'r3', name: '奈落の紋章', itemId: 'abyss-emblem', rarity: 'EPIC', mainStat: { type: 'CRIT_DMG', value: 51.6 }, subOptions: [{ type: 'ATK%', value: 9.1 }, { type: 'CRIT_RATE', value: 5.2 }, { type: 'TEC%', value: 4.8 }, { type: 'HP_FLAT', value: 120 }], level: 15, exp: 100, maxExp: 5000 },
      { id: 'r4', name: '冥界の欠片', itemId: 'underworld-shard', rarity: 'COMMON', mainStat: { type: 'DEF%', value: 12.0 }, subOptions: [{ type: 'HP_FLAT', value: 85 }, { type: 'MDEF%', value: 3.1 }], level: 3, exp: 600, maxExp: 1500 },
      { id: 'r5', name: '漆黒の霊核', itemId: 'black-spirit-core', rarity: 'RARE', mainStat: { type: 'MATK%', value: 28.4 }, subOptions: [{ type: 'CRIT_RATE', value: 6.0 }, { type: 'TEC%', value: 5.1 }, { type: 'HP%', value: 4.3 }, { type: 'MP%', value: 3.2 }], level: 10, exp: 800, maxExp: 3500 },
      { id: 'r6', name: '魂の骨牌', itemId: 'soul-domino', rarity: 'RARE', mainStat: { type: 'AGI%', value: 18.6 }, subOptions: [{ type: 'LUCK%', value: 4.9 }, { type: 'ATK%', value: 5.8 }, { type: 'HP_FLAT', value: 96 }], level: 6, exp: 1800, maxExp: 2500 },
      { id: 'r7', name: '死霊の印璽', itemId: 'necro-seal', rarity: 'COMMON', mainStat: { type: 'HP_FLAT', value: 380 }, subOptions: [{ type: 'DEF_FLAT', value: 25 }, { type: 'ATK_FLAT', value: 12 }], level: 1, exp: 0, maxExp: 800 },
      { id: 'r8', name: '虚空の瞳', itemId: 'void-eye', rarity: 'EPIC', mainStat: { type: 'CRIT_RATE', value: 15.5 }, subOptions: [{ type: 'ATK%', value: 8.3 }, { type: 'CRIT_DMG', value: 12.4 }, { type: 'TEC%', value: 6.0 }, { type: 'MP%', value: 5.5 }], level: 20, exp: 3500, maxExp: 8000 },
    ],
    equippedResidueSlots: [null, null, null],
    residueMaterials: [
      { id: 'mat-1', name: '深淵の砂', quantity: 8, expValue: 200, rarity: 'COMMON' },
      { id: 'mat-2', name: '虚無の結晶', quantity: 3, expValue: 800, rarity: 'RARE' },
      { id: 'mat-3', name: '冥界の核', quantity: 1, expValue: 2500, rarity: 'EPIC' },
      { id: 'mat-4', name: '骨の欠片', quantity: 12, expValue: 100, rarity: 'COMMON' },
      { id: 'mat-5', name: '闇の精髄', quantity: 5, expValue: 400, rarity: 'RARE' },
      { id: 'mat-6', name: '深淵の塵', quantity: 20, expValue: 50, rarity: 'COMMON' },
      { id: 'mat-7', name: '亡者の宝玉', quantity: 2, expValue: 1200, rarity: 'EPIC' },
      { id: 'mat-8', name: '漆黒の霊石', quantity: 6, expValue: 300, rarity: 'RARE' },
    ],
    currentTab: 'HOME',
    demonGauge: 100,
    isDemonMode: false,
  })
}));
