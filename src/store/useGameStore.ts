import { create } from 'zustand';
import jobsData from '../data/master/jobs.json';
import { calculateJobAdjustedStats, getJobUnlockStatus } from '../logic/JobSystem';
import { isResidueSlotCompatible } from '../logic/ResidueScore';
import { calculateCharacterStatProfile } from '../logic/StatSystem';
import { CharacterData, NecroStatus, MonsterData, SoulShardData, ItemData, EquipmentSlots, AbyssalResidueData, ResidueMatData, BaseStats, JobData } from '../types/game';

const JOBS = jobsData as Record<string, JobData>;

const INITIAL_PLAYER_BASE_STATS: BaseStats = {
  hp:        7200,
  atk:       1250,
  def:        720,
  spd:        110,
  critRate:     8,   // 8%
  critDmg:    165,   // 165% (1.65×)
  effectHit:    0,
  effectRes:    5,
};

function withDerivedElementBoosts(player: CharacterData, residues: (AbyssalResidueData | null)[]): CharacterData {
  return {
    ...player,
    elementDmgBoosts: calculateCharacterStatProfile(player, residues).elementDmgBoosts,
  };
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
  transmutationPoints: number;

  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  setInventoryMonsters: (monsters: MonsterData[]) => void;
  setSoulShards: (shards: SoulShardData[]) => void;
  setInventoryItems: (items: ItemData[]) => void;
  setAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  equipResidueToSlot: (slotIndex: number, residue: AbyssalResidueData | null) => void;
  upgradeResidue: (residueId: string, matIds: string[]) => void;
  setTransmutationPoints: (points: number) => void;

  updateHP: (hp: number) => void;
  updateEnergy: (energy: number) => void;
  addExp: (amount: number) => void;
  addGold: (amount: number) => void;
  addClearedStage: (stageId: string) => void;
  changeJob: (jobId: string) => void;

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
  currentTab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS' | 'JOB';
  setCurrentTab: (tab: 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS' | 'JOB') => void;

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
  equippedResidueSlots: [null, null, null, null, null],
  residueMaterials: [],
  transmutationPoints: 0,
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
    if (residue && !isResidueSlotCompatible(residue, slotIndex)) return state;
    const slots = [...state.equippedResidueSlots] as (AbyssalResidueData | null)[];
    slots[slotIndex] = residue;
    return {
      equippedResidueSlots: slots,
      player: state.player ? withDerivedElementBoosts(state.player, slots) : state.player,
    };
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
  changeJob: (jobId) => set((state) => {
    if (!state.player) return state;
    const nextJob = JOBS[jobId];
    if (!nextJob) return state;
    const unlock = getJobUnlockStatus(state.player, nextJob);
    if (!unlock.unlocked) return state;

    const baseStats = state.player.baseStats ?? state.player.stats;
    const hasJob = state.player.jobs.some(job => job.jobId === jobId);
    const nextJobs = hasJob
      ? state.player.jobs
      : [...state.player.jobs, { jobId, level: 1, exp: 0 }];

    const nextMaxEnergy = nextJob.energyCurve?.baseMaxEnergy ?? state.player.maxEnergy;
    const nextPlayer = withDerivedElementBoosts({
        ...state.player,
        currentJobId: jobId,
        category: nextJob.category,
        baseStats,
        stats: calculateJobAdjustedStats(baseStats, nextJob),
        jobs: nextJobs,
        maxEnergy: nextMaxEnergy,
        currentEnergy: Math.min(state.player.currentEnergy, nextMaxEnergy),
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

  initialize: () => set({
    player: {
      id: '1',
      name: 'アルド',
      currentJobId: 'warrior',
      category: 'PHYSICAL',
      baseStats: INITIAL_PLAYER_BASE_STATS,
      stats: calculateJobAdjustedStats(INITIAL_PLAYER_BASE_STATS, JOBS.warrior),
      baseResistances: {},
      passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveSpdBonus: 0, passiveCritRateBonus: 0, passiveCritDmgBonus: 0, passiveHpBonus: 0 },
      equipment: {
        weapon: { id: 'i1', name: 'Iron Sword', type: 'WEAPON', rarity: 'COMMON', stats: { atk: 10 }, isUnique: false },
        sub: null, head: null,
        body: { id: 'i2', name: 'Leather Armor', type: 'BODY', rarity: 'COMMON', stats: { def: 5 }, isUnique: false },
        arms: null, legs: null, acc1: null, acc2: null,
      },
      jobs: [
        { jobId: 'warrior', level: 72, exp: 0 },
        { jobId: 'mage', level: 22, exp: 1300 },
        { jobId: 'dark_priest', level: 21, exp: 900 },
        { jobId: 'rogue', level: 9, exp: 700 },
        { jobId: 'necromancer', level: 1, exp: 0 }
      ],
      isAwakened: false,
      clearedStages: [],
      currentEnergy: 0,
      maxEnergy: 100,
      elementDmgBoosts: {},
    },
    necroStatus: {
      level: 1,
      rank: 1,
      maxCost: 10,
      baseStatsBonus: 1.0,
    },
    inventoryMonsters: [
      { id: 'm1', name: 'ゴブリン',   tribe: 'HUMANOID', cost: 3, stats: { hp: 50, atk: 10, def: 5,  spd: 80,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -20 } },
      { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD',   cost: 4, stats: { hp: 40, atk: 12, def: 8,  spd: 50,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 20 }, resistances: { LIGHT: -50, DARK: 50 } },
      { id: 'm3', name: 'ゾンビ',     tribe: 'UNDEAD',   cost: 4, stats: { hp: 80, atk: 8,  def: 4,  spd: 20,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 } },
    ],
    inventoryItems: [
      { id: 'i1', name: 'Iron Sword',    type: 'WEAPON', rarity: 'COMMON', stats: { atk: 10 }, isUnique: false },
      { id: 'i2', name: 'Leather Armor', type: 'BODY',   rarity: 'COMMON', stats: { def: 5 }, isUnique: false },
      {
        id: 'i3',
        name: 'Hero Soul Blade',
        type: 'WEAPON',
        rarity: 'UNIQUE',
        stats: { atk: 80, critDmg: 20 },
        subOptions: [{ type: 'DARK_DMG_BOOST', value: 12 }],
        specialEffect: 'SOUL_RESONANCE',
        isUnique: true,
      },
    ],
    soulShards: [
      {
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, elementDmgBoost: 0 }
      }
    ],
    abyssalResidues: [
      { id: 'r1', name: '深淵の指輪', itemId: 'chest', rarity: 'EPIC', mainStat: { type: 'ATK%', value: 35.2 }, subOptions: [{ type: 'CRIT_RATE', value: 7.8 }, { type: 'HP%', value: 6.2 }, { type: 'DEF_FLAT', value: 32 }, { type: 'FIRE_DMG_BOOST', value: 4.1 }], level: 12, exp: 2400, maxExp: 4000, tierHistory: [2, 3, 1] },
      { id: 'r2', name: '虚無の骸骨', itemId: 'chest', rarity: 'RARE', mainStat: { type: 'HP%', value: 22.8 }, subOptions: [{ type: 'DEF%', value: 5.4 }, { type: 'ATK_FLAT', value: 18 }, { type: 'SPD%', value: 3.2 }], level: 8, exp: 1200, maxExp: 3000, tierHistory: [1, 2] },
      { id: 'r3', name: '奈落の紋章', itemId: 'legs', rarity: 'EPIC', mainStat: { type: 'CRIT_DMG', value: 51.6 }, subOptions: [{ type: 'ATK%', value: 9.1 }, { type: 'CRIT_RATE', value: 5.2 }, { type: 'DARK_DMG_BOOST', value: 4.8 }, { type: 'HP_FLAT', value: 120 }], level: 15, exp: 100, maxExp: 5000, tierHistory: [4, 3, 2] },
      { id: 'r4', name: '冥界の欠片', itemId: 'chest', rarity: 'COMMON', mainStat: { type: 'DEF%', value: 12.0 }, subOptions: [{ type: 'HP_FLAT', value: 85 }, { type: 'EFFECT_RES', value: 3.1 }], level: 3, exp: 600, maxExp: 1500 },
      { id: 'r5', name: '漆黒の霊核', itemId: 'waist', rarity: 'RARE', mainStat: { type: 'WATER_DMG_BOOST', value: 28.4 }, subOptions: [{ type: 'CRIT_RATE', value: 6.0 }, { type: 'CRIT_DMG', value: 5.1 }, { type: 'HP%', value: 4.3 }, { type: 'EFFECT_HIT', value: 3.2 }], level: 10, exp: 800, maxExp: 3500, tierHistory: [2, 2] },
      { id: 'r6', name: '魂の骨牌', itemId: 'arms', rarity: 'RARE', mainStat: { type: 'ATK_FLAT', value: 120 }, subOptions: [{ type: 'CRIT_RATE', value: 4.9 }, { type: 'ATK%', value: 5.8 }, { type: 'HP_FLAT', value: 96 }], level: 6, exp: 1800, maxExp: 2500, tierHistory: [3] },
      { id: 'r7', name: '死霊の印璽', itemId: 'head', rarity: 'COMMON', mainStat: { type: 'HP_FLAT', value: 380 }, subOptions: [{ type: 'DEF_FLAT', value: 25 }, { type: 'ATK_FLAT', value: 12 }], level: 1, exp: 0, maxExp: 800 },
      { id: 'r8', name: '虚空の瞳', itemId: 'legs', rarity: 'EPIC', mainStat: { type: 'CRIT_RATE', value: 15.5 }, subOptions: [{ type: 'ATK%', value: 8.3 }, { type: 'CRIT_DMG', value: 12.4 }, { type: 'THUNDER_DMG_BOOST', value: 6.0 }, { type: 'EFFECT_HIT', value: 5.5 }], level: 20, exp: 3500, maxExp: 8000, tierHistory: [4, 4, 3, 2, 4] },
      { id: 'r9', name: '深淵王の帯', itemId: 'waist', rarity: 'LEGENDARY', mainStat: { type: 'DARK_DMG_BOOST', value: 38.8 }, subOptions: [{ type: 'CRIT_RATE', value: 8.8 }, { type: 'CRIT_DMG', value: 16.2 }, { type: 'ATK%', value: 7.4 }, { type: 'EFFECT_HIT', value: 4.4 }], level: 18, exp: 2600, maxExp: 7000, tierHistory: [4, 3, 4, 4] },
      { id: 'r10', name: '忘却の兜', itemId: 'head', rarity: 'RARE', mainStat: { type: 'HP_FLAT', value: 620 }, subOptions: [{ type: 'CRIT_DMG', value: 6.4 }, { type: 'DEF%', value: 4.6 }, { type: 'EFFECT_RES', value: 3.4 }], level: 5, exp: 500, maxExp: 2200, tierHistory: [2] },
    ],
    equippedResidueSlots: [
      { id: 'r7', name: '死霊の印璽', itemId: 'head', rarity: 'COMMON', mainStat: { type: 'HP_FLAT', value: 380 }, subOptions: [{ type: 'DEF_FLAT', value: 25 }, { type: 'ATK_FLAT', value: 12 }], level: 1, exp: 0, maxExp: 800 },
      { id: 'r6', name: '魂の骨牌', itemId: 'arms', rarity: 'RARE', mainStat: { type: 'ATK_FLAT', value: 120 }, subOptions: [{ type: 'CRIT_RATE', value: 4.9 }, { type: 'ATK%', value: 5.8 }, { type: 'HP_FLAT', value: 96 }], level: 6, exp: 1800, maxExp: 2500, tierHistory: [3] },
      { id: 'r1', name: '深淵の指輪', itemId: 'chest', rarity: 'EPIC', mainStat: { type: 'ATK%', value: 35.2 }, subOptions: [{ type: 'CRIT_RATE', value: 7.8 }, { type: 'HP%', value: 6.2 }, { type: 'DEF_FLAT', value: 32 }, { type: 'FIRE_DMG_BOOST', value: 4.1 }], level: 12, exp: 2400, maxExp: 4000, tierHistory: [2, 3, 1] },
      { id: 'r5', name: '漆黒の霊核', itemId: 'waist', rarity: 'RARE', mainStat: { type: 'WATER_DMG_BOOST', value: 28.4 }, subOptions: [{ type: 'CRIT_RATE', value: 6.0 }, { type: 'CRIT_DMG', value: 5.1 }, { type: 'HP%', value: 4.3 }, { type: 'EFFECT_HIT', value: 3.2 }], level: 10, exp: 800, maxExp: 3500, tierHistory: [2, 2] },
      { id: 'r8', name: '虚空の瞳', itemId: 'legs', rarity: 'EPIC', mainStat: { type: 'CRIT_RATE', value: 15.5 }, subOptions: [{ type: 'ATK%', value: 8.3 }, { type: 'CRIT_DMG', value: 12.4 }, { type: 'THUNDER_DMG_BOOST', value: 6.0 }, { type: 'EFFECT_HIT', value: 5.5 }], level: 20, exp: 3500, maxExp: 8000, tierHistory: [4, 4, 3, 2, 4] },
    ],
    transmutationPoints: 1320,
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
    party: [
      { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD', cost: 4, stats: { hp: 40, atk: 12, def: 8, spd: 50, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 20 }, resistances: { LIGHT: -50, DARK: 50 } },
      { id: 'm3', name: 'ゾンビ',     tribe: 'UNDEAD', cost: 4, stats: { hp: 80, atk: 8,  def: 4, spd: 20, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0  }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 } },
      null,
    ],
    currentTab: 'HOME',
    demonGauge: 100,
    isDemonMode: false,
  })
}));
