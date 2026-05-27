import { JobService } from '../services/JobService';
import { NecroService } from '../services/NecroService';
import { RewardService } from '../services/RewardService';
import { MasterDataService } from '../services/MasterDataService';
import { BattleEngine } from './BattleEngine';
import { calculateJobGrowthIncrements } from './JobGrowthSystem';
import { calculateEnergyState } from './EnergySystem';
import { levelFromTotalExp } from './ExperienceSystem';
import { prisma } from '../lib/prisma';
import { CharacterData, MonsterData } from '../types/game';

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
  public async processGrowth(characterId: string, action: { type: 'CHANGE_JOB' | 'RANK_UP', targetId?: string }): Promise<void> {
    if (action.type === 'CHANGE_JOB' && action.targetId) {
      await this.jobService.changeJob(characterId, action.targetId);
    } else if (action.type === 'RANK_UP') {
      // 試練クリアフラグは本来外部から取得する
      await this.necroService.performRankUp(characterId, true);
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
      include: { jobs: true },
    });

    if (!char) throw new Error("Character not found");

    const monsterData = await prisma.monster.findMany({
      where: { id: { in: partyMonsterIds } },
      include: { spiritCore: true },
    });

    const stageData = this.masterData.getStage(stageId);
    if (!stageData) throw new Error("Stage not found");

    // CharacterData 型への変換
    const currentJobId = char.currentJobId || 'warrior';
    const currentJob = this.masterData.getJob(currentJobId) ?? this.masterData.getJob('warrior');
    const jobs = char.jobs.map((j: any) => ({ jobId: j.jobId, level: j.level, exp: j.exp }));
    const currentJobLevel = Math.max(1, jobs.find((job: any) => job.jobId === currentJobId)?.level ?? 1);
    const energyState = calculateEnergyState(currentJob, currentJobLevel);
    const player: CharacterData = {
      id: char.id,
      name: char.name,
      currentJobId,
      category: currentJob?.category ?? 'PHYSICAL',
      necroBaseStatsBonus: char.necroBaseStatsBonus ?? 1,
      stats: {
        hp: char.hp, atk: char.atk, def: char.def, spd: char.spd,
        critRate: char.critRate, critDmg: char.critDmg,
        effectHit: char.effectHit, effectRes: char.effectRes,
      },
      passives: {
        passiveAtkBonus:      char.passiveAtkBonus,
        passiveDefBonus:      char.passiveDefBonus,
        passiveSpdBonus:      char.passiveSpdBonus ?? 0,
        passiveCritRateBonus: char.passiveCritRateBonus ?? 0,
        passiveCritDmgBonus:  char.passiveCritDmgBonus ?? 0,
        passiveHpBonus:       char.passiveHpBonus ?? 0,
      },
      baseResistances: {},
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      jobs,
      isAwakened: false,
      clearedStages: char.clearedStages,
      gold: (char as any).gold ?? 0,
      currentEnergy: energyState.currentEnergy,
      maxEnergy: energyState.maxEnergy,
      elementDmgBoosts: {},
    };

    const monsterList = monsterData.map((m: any) => {
      const mMaster = this.masterData.getMonster(m.id);
      return {
        id: m.id,
        name: m.name,
        tribe: m.tribe as any,
        cost: m.cost,
        stats: {
          hp: m.hp, atk: m.atk, def: m.def, spd: m.spd ?? 80,
          critRate: m.critRate ?? 0, critDmg: m.critDmg ?? 150,
          effectHit: m.effectHit ?? 0, effectRes: m.effectRes ?? 0,
        },
        resistances: mMaster ? mMaster.resistances || {} : {},
        spiritCore: m.spiritCore ? {
          id: m.spiritCore.id,
          name: m.spiritCore.name,
          element: m.spiritCore.element ?? undefined,
          skillChangeId: m.spiritCore.skillChangeId ?? undefined,
          atkMultiplier: m.spiritCore.atkMultiplier ?? 1,
        } : undefined,
      };
    });

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
      include: { jobs: true }
    });
    if (!char) throw new Error("Character not found");

    // 1. 経験値と報酬の計算
    const playerConverted = this.convertToCharacterData(char);
    const expGain = this.rewardService.calculateExp(stage.rewards.baseExp, playerConverted);
    const rewards = this.rewardService.processDropTable(stage.rewards.dropTable);

    // 2. DBへの反映 (トランザクション)
    await prisma.$transaction(async (tx: any) => {
      // 経験値加算
      const currentJob = char.jobs.find((j: any) => j.jobId === char.currentJobId);
      if (currentJob) {
        const newExp = currentJob.exp + expGain;
        const newLevel = levelFromTotalExp(newExp);
        
        await tx.userJob.update({
          where: { characterId_jobId: { characterId, jobId: char.currentJobId! } },
          data: { exp: newExp, level: newLevel }
        });

        if (newLevel > currentJob.level) {
          const growth = calculateJobGrowthIncrements(
            this.masterData.getJob(char.currentJobId || 'warrior'),
            newLevel - currentJob.level,
          );
          await tx.character.update({
            where: { id: characterId },
            data: {
              hp: { increment: growth.hp },
              atk: { increment: growth.atk },
              def: { increment: growth.def },
            },
          });
        }

        // パッシブ加算チェック (JobServiceのロジックを流用)
        // 本来は JobService を tx 内で呼ぶべき
      }

      // ドロップモンスターの追加（第1章では発生しない — 将来拡張用）
      for (const m of rewards.monsters) {
        await tx.monster.create({
          data: {
            name: m.name,
            tribe: m.tribe,
            cost: m.cost,
            ...m.stats,
          }
        });
      }

      // クリアフラグの追加
      if (!char.clearedStages.includes(stageId)) {
        await tx.character.update({
          where: { id: characterId },
          data: { clearedStages: { push: stageId } }
        });
      }
    });

    return { expGain, rewards };
  }

  private convertToCharacterData(char: any): CharacterData {
    const currentJobId = char.currentJobId || 'warrior';
    const currentJob = this.masterData.getJob(currentJobId) ?? this.masterData.getJob('warrior');
    const jobs = char.jobs.map((j: any) => ({ jobId: j.jobId, level: j.level, exp: j.exp }));
    const currentJobLevel = Math.max(1, jobs.find((job: any) => job.jobId === currentJobId)?.level ?? 1);
    const energyState = calculateEnergyState(currentJob, currentJobLevel);
    return {
      id: char.id,
      name: char.name,
      currentJobId,
      category: currentJob?.category ?? 'PHYSICAL',
      necroBaseStatsBonus: char.necroBaseStatsBonus ?? 1,
      stats: {
        hp: char.hp, atk: char.atk, def: char.def, spd: char.spd,
        critRate: char.critRate, critDmg: char.critDmg,
        effectHit: char.effectHit, effectRes: char.effectRes,
      },
      passives: {
        passiveAtkBonus:      char.passiveAtkBonus,
        passiveDefBonus:      char.passiveDefBonus,
        passiveSpdBonus:      char.passiveSpdBonus ?? 0,
        passiveCritRateBonus: char.passiveCritRateBonus ?? 0,
        passiveCritDmgBonus:  char.passiveCritDmgBonus ?? 0,
        passiveHpBonus:       char.passiveHpBonus ?? 0,
      },
      baseResistances: {},
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      jobs,
      isAwakened: false,
      clearedStages: char.clearedStages || [],
      gold: (char as any).gold ?? 0,
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
        select: { id: true, necroMaxCost: true },
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
      if (totalCost > char.necroMaxCost) {
        throw new Error(`Cost limit exceeded: ${totalCost} / ${char.necroMaxCost}`);
      }

      await tx.character.update({
        where: { id: char.id },
        data: {
          partySlot0Id: slotIds[0],
          partySlot1Id: slotIds[1],
          partySlot2Id: slotIds[2],
        },
      });
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
    const fieldMap: Record<string, string> = {
      'weapon': 'equipWeaponId',
      'sub': 'equipSubId',
      'head': 'equipHeadId',
      'body': 'equipBodyId',
      'arms': 'equipArmsId',
      'legs': 'equipLegsId',
      'acc1': 'equipAcc1Id',
      'acc2': 'equipAcc2Id',
    };
    
    const dbField = fieldMap[slot];
    if (!dbField) throw new Error("Invalid equipment slot");

    await prisma.character.update({
      where: { id: characterId },
      data: { [dbField]: itemId }
    });
  }

  /**
   * アイテムの装備解除 (GDD-007)
   */
  public async unequipItem(characterId: string, slot: string): Promise<void> {
    const fieldMap: Record<string, string> = {
      'weapon': 'equipWeaponId',
      'sub': 'equipSubId',
      'head': 'equipHeadId',
      'body': 'equipBodyId',
      'arms': 'equipArmsId',
      'legs': 'equipLegsId',
      'acc1': 'equipAcc1Id',
      'acc2': 'equipAcc2Id',
    };
    
    const dbField = fieldMap[slot];
    if (!dbField) throw new Error("Invalid equipment slot");

    await prisma.character.update({
      where: { id: characterId },
      data: { [dbField]: null }
    });
  }

  public async close(): Promise<void> {
    // singleton のため disconnect しない（開発時のホットリロードで接続維持）
  }
}
