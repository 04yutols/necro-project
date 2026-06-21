import { JobService } from '../services/JobService';
import { NecroService } from '../services/NecroService';
import { RewardService } from '../services/RewardService';
import { MasterDataService } from '../services/MasterDataService';
import { BattleEngine } from './BattleEngine';
import { getJobBaseStatsAtLevel } from './JobGrowthSystem';
import { calculateEnergyState } from './EnergySystem';
import { hydrateMonsterEnergy } from './MonsterEnergySystem';
import { applyNecroToMonster, deriveNecroRank } from './NecroGrowthSystem';
import { prisma } from '../lib/prisma';
import { CharacterData, MonsterData } from '../types/game';
import {
  applyJobExpGainToSave,
  applyNecroExpGainToSave,
  readPlayerSave,
  updatePlayerSaveSnapshot,
} from '../services/PlayerSaveService';
import type { PlayerSaveV1 } from '../types/playerSave';

const EQUIPMENT_SLOTS = new Set<keyof PlayerSaveV1['player']['equipmentIds']>([
  'weapon',
  'sub',
  'head',
  'body',
  'arms',
  'legs',
  'acc1',
  'acc2',
]);

/**
 * ゲーム全体の進行とループを管理するクラス (GDD-002)
 */
export class GameManager {
  private jobService: JobService;
  private necroService: NecroService;
  private rewardService: RewardService;
  private masterData: MasterDataService;

  constructor() {
    this.jobService = new JobService(prisma);
    this.necroService = new NecroService(prisma);
    this.rewardService = new RewardService();
    this.masterData = MasterDataService.getInstance();
  }

  /**
   * 拠点での成長フェーズ (GDD-002)
   */
  public async processGrowth(characterId: string, action: { type: 'CHANGE_JOB', targetId?: string }): Promise<void> {
    if (action.type === 'CHANGE_JOB' && action.targetId) {
      await this.jobService.changeJob(characterId, action.targetId);
    }
  }

  /**
   * 戦闘フェーズの開始 (GDD-002)
   * ステージIDを引数に取り、敵編成を取得して返す
   */
  public async startStage(characterId: string, partyMonsterIds: string[], stageId: string): Promise<{ engine: BattleEngine, stageData: any }> {
    // DB から最新のキャラクターとモンスターを取得
    const char = await prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!char) throw new Error("Character not found");

    const monsterData = await prisma.monster.findMany({
      where: { id: { in: partyMonsterIds } },
    });

    const stageData = this.masterData.getStage(stageId);
    if (!stageData) throw new Error("Stage not found");

    const playerSave = readPlayerSave(char.playerState);

    // CharacterData 型への変換
    const currentJobId = playerSave.player.currentJobId || 'warrior';
    const currentJob = this.masterData.getJob(currentJobId) ?? this.masterData.getJob('warrior');
    const jobs = playerSave.player.jobs;
    const currentJobLevel = Math.max(1, jobs.find((job: any) => job.jobId === currentJobId)?.level ?? 1);
    const energyState = calculateEnergyState(currentJob, currentJobLevel);
    const baseStats = getJobBaseStatsAtLevel(currentJob, currentJobLevel);
    const player: CharacterData = {
      id: char.id,
      name: playerSave.player.name,
      currentJobId,
      category: currentJob?.category ?? 'PHYSICAL',
      baseStats,
      necroLevel: playerSave.player.necroStatus.level,
      stats: baseStats,
      passives: playerSave.player.passives,
      baseResistances: {},
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      jobs,
      isAwakened: false,
      clearedStages: playerSave.player.clearedStages,
      gold: playerSave.player.gold,
      currentEnergy: energyState.currentEnergy,
      maxEnergy: energyState.maxEnergy,
      elementDmgBoosts: {},
    };

    const rawMonsterList = monsterData.map((m: any) => {
      const mMaster = this.masterData.getMonster(m.id);
      return hydrateMonsterEnergy({
        id: m.id,
        masterId: m.masterId ?? undefined,
        name: m.name,
        tribe: m.tribe as any,
        cost: m.cost,
        stats: {
          hp: m.hp, atk: m.atk, def: m.def, spd: m.spd ?? 80,
          critRate: m.critRate ?? 0, critDmg: m.critDmg ?? 150,
          effectHit: m.effectHit ?? 0, effectRes: m.effectRes ?? 0,
        },
        resistances: m.resistances ?? mMaster?.resistances ?? {},
        skillIds: Array.isArray(m.skillIds) ? m.skillIds.filter((id: unknown): id is string => typeof id === 'string') : [],
        currentEnergy: m.currentEnergy ?? undefined,
        maxEnergy: m.maxEnergy ?? undefined,
      });
    });
    const monsterList = rawMonsterList.map((monster: MonsterData) =>
      applyNecroToMonster(monster, playerSave.player.necroStatus.level, this.masterData.getNecroConfig()),
    );

    const engine = new BattleEngine(player, monsterList);
    return { engine, stageData };
  }

  /**
   * ステージクリア後のリザルト処理 (GDD-002)
   */
  public async processStageResult(characterId: string, stageId: string): Promise<any> {
    const stage = this.masterData.getStage(stageId);
    if (!stage) throw new Error("Stage not found");

    const char = await prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!char) throw new Error("Character not found");
    const playerSave = readPlayerSave(char.playerState);

    const ownedMonsterMasterIds = (await prisma.monster.findMany({
      where: { characterId },
      select: { masterId: true, id: true },
    })).map((monster: { masterId: string | null; id: string }) => monster.masterId ?? monster.id);

    // 1. 経験値と報酬の計算
    const playerConverted = this.convertToCharacterData(char, playerSave);
    const expGain = this.rewardService.calculateExp(stage.rewards.baseExp, playerConverted);
    const rewards = this.rewardService.processStageDropTable(stage, playerSave.player.clearedStages, 0, Math.random, ownedMonsterMasterIds);
    rewards.monsters.push(...this.rewardService.processStageNecromance(
      stage,
      [...ownedMonsterMasterIds, ...rewards.monsters.map(monster => monster.masterId ?? monster.id)],
      deriveNecroRank(playerSave.player.necroStatus.level),
    ));

    // 2. DBへの反映 (トランザクション)
    await prisma.$transaction(async (tx: any) => {
      // ネクロマンス成功モンスターの追加
      for (const m of rewards.monsters) {
        await tx.monster.create({
          data: {
            id: m.id,
            masterId: m.masterId ?? m.id,
            characterId,
            name: m.name,
            tribe: m.tribe,
            cost: m.cost,
            ...m.stats,
            currentEnergy: m.currentEnergy,
            maxEnergy: m.maxEnergy,
            resistances: m.resistances ?? {},
            skillIds: m.skillIds ?? [],
          }
        });
      }

      // クリアフラグの追加
      await updatePlayerSaveSnapshot(tx, characterId, (save) => {
        const leveledSave = applyJobExpGainToSave(save, expGain, (jobId) => this.masterData.getJob(jobId));
        const nextSave = applyNecroExpGainToSave(leveledSave, expGain);
        return {
          ...nextSave,
          player: {
            ...nextSave.player,
            clearedStages: nextSave.player.clearedStages.includes(stageId)
              ? nextSave.player.clearedStages
              : [...nextSave.player.clearedStages, stageId],
          },
        };
      });
    });

    return { expGain, rewards };
  }

  private convertToCharacterData(char: any, playerSave: PlayerSaveV1 = readPlayerSave(char.playerState)): CharacterData {
    const currentJobId = playerSave.player.currentJobId || 'warrior';
    const currentJob = this.masterData.getJob(currentJobId) ?? this.masterData.getJob('warrior');
    const jobs = playerSave.player.jobs;
    const currentJobLevel = Math.max(1, jobs.find((job: any) => job.jobId === currentJobId)?.level ?? 1);
    const energyState = calculateEnergyState(currentJob, currentJobLevel);
    const baseStats = getJobBaseStatsAtLevel(currentJob, currentJobLevel);
    return {
      id: char.id,
      name: playerSave.player.name,
      currentJobId,
      category: currentJob?.category ?? 'PHYSICAL',
      baseStats,
      necroLevel: playerSave.player.necroStatus.level,
      stats: baseStats,
      passives: playerSave.player.passives,
      baseResistances: {},
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      jobs,
      isAwakened: false,
      clearedStages: playerSave.player.clearedStages,
      gold: playerSave.player.gold,
      currentEnergy: energyState.currentEnergy,
      maxEnergy: energyState.maxEnergy,
      elementDmgBoosts: {},
    };
  }

  /**
   * パーティ編成の更新 (GDD-005)
   */
  public async updateParty(characterId: string, monsterIds: (string | null)[]): Promise<void> {
    if (monsterIds.length !== 3) throw new Error("Party must have 3 slots.");

    const slotIds = [monsterIds[0] ?? null, monsterIds[1] ?? null, monsterIds[2] ?? null];
    const selectedIds = slotIds.filter((id): id is string => Boolean(id));
    if (new Set(selectedIds).size !== selectedIds.length) {
      throw new Error("Duplicate monsters cannot be assigned to multiple party slots.");
    }

    await prisma.$transaction(async (tx: any) => {
      const char = await tx.character.findUnique({
        where: { id: characterId },
      });
      if (!char) throw new Error("Character not found.");

      const monsters = selectedIds.length > 0
        ? await tx.monster.findMany({
            where: { id: { in: selectedIds }, characterId: char.id },
            select: { id: true, cost: true },
          })
        : [];
      if (monsters.length !== selectedIds.length) {
        throw new Error("Party contains monsters not owned by character.");
      }

      const totalCost = monsters.reduce((acc: number, monster: { cost: number }) => acc + monster.cost, 0);
      const maxCost = readPlayerSave(char.playerState).player.necroStatus.maxCost;
      if (totalCost > maxCost) {
        throw new Error(`Cost limit exceeded: ${totalCost} / ${maxCost}`);
      }

      await updatePlayerSaveSnapshot(tx, char.id, (save) => {
        save.player.partyMonsterIds = slotIds as PlayerSaveV1['player']['partyMonsterIds'];
      }, { cleanReferenceScopes: ['party'] });
    });
  }

  /**
   * 魂石化の実行 (GDD-005)
   */
  public async soulStone(monsterId: string): Promise<any> {
    return await this.necroService.createSoulShard(monsterId);
  }

  /**
   * 魂の欠片装備の実行 (GDD-005)
   */
  public async equipShard(monsterId: string, shardId: string): Promise<void> {
    return await this.necroService.equipSoulShard(monsterId, shardId);
  }

  /**
   * アイテムの装備 (GDD-007)
   */
  public async equipItem(characterId: string, slot: string, itemId: string): Promise<void> {
    if (!EQUIPMENT_SLOTS.has(slot as keyof PlayerSaveV1['player']['equipmentIds'])) {
      throw new Error("Invalid equipment slot");
    }

    await prisma.$transaction(async (tx: any) => {
      await updatePlayerSaveSnapshot(tx, characterId, (save) => {
        save.player.equipmentIds[slot as keyof PlayerSaveV1['player']['equipmentIds']] = itemId;
      }, { cleanReferenceScopes: ['equipment'] });
    });
  }

  /**
   * アイテムの装備解除 (GDD-007)
   */
  public async unequipItem(characterId: string, slot: string): Promise<void> {
    if (!EQUIPMENT_SLOTS.has(slot as keyof PlayerSaveV1['player']['equipmentIds'])) {
      throw new Error("Invalid equipment slot");
    }

    await prisma.$transaction(async (tx: any) => {
      await updatePlayerSaveSnapshot(tx, characterId, (save) => {
        save.player.equipmentIds[slot as keyof PlayerSaveV1['player']['equipmentIds']] = null;
      }, { cleanReferenceScopes: ['equipment'] });
    });
  }

  public async close(): Promise<void> {
    // singleton のため disconnect しない（開発時のホットリロードで接続維持）
  }
}
