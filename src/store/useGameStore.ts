import { create } from 'zustand';
import jobsData from '../data/master/jobs.json';
import demonFormsData from '../data/master/demonForms.json';
import { calculateJobAdjustedStats, getJobUnlockStatus } from '../logic/JobSystem';
import { DEMON_ACTION_LIMIT, clampDemonGauge } from '../logic/DemonizationSystem';
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
import { CharacterData, NecroStatus, MonsterData, SoulShardData, ItemData, EquipmentSlots, AbyssalResidueData, ResidueMatData, BaseStats, JobData, WeaponMaterialData, WeaponMaterialType, DemonFormData, DemonRiskType } from '../types/game';

const JOBS = jobsData as Record<string, JobData>;
const DEMON_FORMS = demonFormsData as Record<string, DemonFormData>;

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

const MOCK_WEAPONS: ItemData[] = [
  {
    id: 'w-bone-cleaver',
    name: '骨砕きの短剣',
    type: 'WEAPON',
    rarity: 'R',
    weaponRarity: 'R',
    archetype: 'MID',
    rank: 2,
    ilv: 46,
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
    subOptions: [{ type: 'DARK_DMG_BOOST', value: 13 }, { type: 'CRIT_DMG', value: 16 }],
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
    subOptions: [{ type: 'ATK%', value: 19.5 }, { type: 'CRIT_RATE', value: 12 }],
    passiveA: { nameJa: '怨念の特異点', descTemplate: '無条件で全ダメージ+{value}%。', values: [30, 38, 45, 53, 60], systemTag: 'DEMON_MODE' },
    passiveB: { nameJa: '霊的防壁破断', descTemplate: '攻撃が霊的防壁を貫通し、防御干渉を{value}%無視する。', values: [25, 32, 38, 44, 50], systemTag: 'SHIELD_PIERCE' },
    isUnique: true,
    isUR: true,
    discovererName: 'アルド',
    serialNo: 1,
    flavor: '周回で屠られた魔物たちの怨念が刃の内側で折り重なり、握る者の魂へ黒い刃紋を伸ばす。',
  },
];

function withDerivedElementBoosts(player: CharacterData, residues: (AbyssalResidueData | null)[]): CharacterData {
  return {
    ...player,
    elementDmgBoosts: calculateCharacterStatProfile(player, residues).elementDmgBoosts,
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

  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  setInventoryMonsters: (monsters: MonsterData[]) => void;
  setSoulShards: (shards: SoulShardData[]) => void;
  setInventoryItems: (items: ItemData[]) => void;
  setAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  addInventoryItems: (items: ItemData[]) => void;
  addAbyssalResidues: (residues: AbyssalResidueData[]) => void;
  addResidueMaterials: (mats: ResidueMatData[]) => void;
  equipResidueToSlot: (slotIndex: number, residue: AbyssalResidueData | null) => void;
  upgradeResidue: (residueId: string, matIds: string[]) => void;
  rankUpWeapon: (weaponId: string) => void;
  reforgeWeapon: (weaponId: string) => void;
  dismantleWeapon: (weaponId: string) => void;
  setTransmutationPoints: (points: number) => void;

  updateHP: (hp: number) => void;
  updateEnergy: (energy: number) => void;
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
}

export const useGameStore = create<GameState>((set) => ({
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
  equippingMonsterId: null,
  battleLogs: ['SYSTEM STANDBY...'],
  actionTrigger: null,
  demonGauge: 100,
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

  setPlayer: (player) => set({ player }),
  setNecroStatus: (status) => set({ necroStatus: status }),
  setParty: (party) => set({ party }),
  setInventoryMonsters: (monsters) => set({ inventoryMonsters: monsters }),
  setSoulShards: (shards) => set({ soulShards: shards }),
  setInventoryItems: (items) => set({ inventoryItems: items }),
  setAbyssalResidues: (residues) => set({ abyssalResidues: residues }),
  addInventoryItems: (items) => set((state) => ({
    inventoryItems: [...state.inventoryItems, ...items],
  })),
  addAbyssalResidues: (residues) => set((state) => ({
    abyssalResidues: [...state.abyssalResidues, ...residues],
  })),
  addResidueMaterials: (mats) => set((state) => ({
    residueMaterials: [...state.residueMaterials, ...mats],
  })),
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
        weapon: MOCK_WEAPONS[2],
        sub: null, head: null,
        body: null,
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
      gold: 50000,
      statusEffects: [],
      currentEnergy: 0,
      maxEnergy: 100,
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
      { id: 'm1', name: 'ゴブリン',   tribe: 'HUMANOID', cost: 3, stats: { hp: 50, atk: 10, def: 5,  spd: 80,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -20 } },
      { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD',   cost: 4, stats: { hp: 40, atk: 12, def: 8,  spd: 50,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 20 }, resistances: { LIGHT: -50, DARK: 50 } },
      { id: 'm3', name: 'ゾンビ',     tribe: 'UNDEAD',   cost: 4, stats: { hp: 80, atk: 8,  def: 4,  spd: 20,  critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 } },
    ],
    inventoryItems: MOCK_WEAPONS,
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
    weaponMaterials: [
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 38 },
      { type: 'IDEA_SR', name: '業物のイデア', quantity: 14 },
      { type: 'IDEA_SSR', name: '英雄のイデア', quantity: 6 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 88 },
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
    demonActionsRemaining: 0,
    demonUltimateUsed: false,
    demonFormJobId: null,
    demonEffectBFlag: null,
    demonRiskType: null,
    demonRiskValue: 0,
  })
}));
