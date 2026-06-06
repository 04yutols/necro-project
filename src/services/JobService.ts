import { PrismaClient } from '@prisma/client';
import { CharacterData, JobData, UserJobState } from '../types/game';
import { MasterDataService } from './MasterDataService';
import { getJobUnlockStatus } from '../logic/JobSystem';
import { calculateEnergyState } from '../logic/EnergySystem';
import { getJobBaseStatsAtLevel } from '../logic/JobGrowthSystem';

/**
 * 職業に関するビジネスロジックを担当するサービス (GDD-004)
 * Prisma を用いた永続化に対応。
 */
export class JobService {
  private masterData: MasterDataService;

  constructor(private prisma?: PrismaClient) {
    this.masterData = MasterDataService.getInstance();
  }

  /**
   * 転職処理。
   * トランザクションを用いて UserJob の生成・更新を行う。
   */
  public async changeJob(character: CharacterData, nextJobId: string): Promise<CharacterData>;
  public async changeJob(characterId: string, nextJobId: string): Promise<void>;
  public async changeJob(characterOrId: string | CharacterData, nextJobId: string): Promise<CharacterData | void> {
    const jobData = this.masterData.getJob(nextJobId);
    if (!jobData) throw new Error(`Job ${nextJobId} not found in master data`);

    if (typeof characterOrId !== 'string') {
      const character = characterOrId;
      const unlock = getJobUnlockStatus(character, jobData);
      if (!unlock.unlocked) throw new Error(`Job ${nextJobId} is locked`);

      return this.buildChangedCharacter(character, nextJobId, jobData);
    }

    if (!this.prisma) throw new Error('PrismaClient is required for persistent job changes.');
    const characterId = characterOrId;
    await this.prisma.$transaction(async (tx: any) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: { jobs: true },
      });
      if (!character) throw new Error(`Character ${characterId} not found`);

      const unlock = getJobUnlockStatus(this.toCharacterDataForUnlock(character), jobData);
      if (!unlock.unlocked) throw new Error(`Job ${nextJobId} is locked`);

      await tx.job.upsert({
        where: { id: nextJobId },
        update: {
          name: jobData.displayName ?? jobData.name,
          tier: jobData.tier,
          category: jobData.category,
        },
        create: {
          id: nextJobId,
          name: jobData.displayName ?? jobData.name,
          tier: jobData.tier,
          category: jobData.category,
        },
      });

      // 既存の UserJob を確認
      const userJob = await tx.userJob.findUnique({
        where: {
          characterId_jobId: {
            characterId: characterId,
            jobId: nextJobId,
          },
        },
      });

      // 初めての職業の場合は Lv1 で新規作成 (GDD-004)
      if (!userJob) {
        await tx.userJob.create({
          data: {
            characterId: characterId,
            jobId: nextJobId,
            level: 1,
            exp: 0,
          },
        });
      }

      // 現在の職業を更新
      await tx.character.update({
        where: { id: characterId },
        data: { currentJobId: nextJobId },
      });
    });
  }

  private buildChangedCharacter(character: CharacterData, nextJobId: string, jobData: JobData): CharacterData {
    const nextJobs: UserJobState[] = character.jobs.map(job => ({ ...job }));
    if (!nextJobs.some(job => job.jobId === nextJobId)) {
      nextJobs.push({ jobId: nextJobId, level: 1, exp: 0 });
    }

    const nextLevel = Math.max(1, nextJobs.find(job => job.jobId === nextJobId)?.level ?? 1);
    const baseStats = getJobBaseStatsAtLevel(jobData, nextLevel, character.baseStats ?? character.stats);
    const energyState = calculateEnergyState(jobData, nextLevel);

    return {
      ...character,
      currentJobId: nextJobId,
      category: jobData.category,
      baseStats,
      stats: baseStats,
      passives: { ...character.passives },
      equipment: { ...character.equipment },
      baseResistances: { ...character.baseResistances },
      jobs: nextJobs,
      clearedStages: [...character.clearedStages],
      statusEffects: character.statusEffects?.map(effect => ({
        ...effect,
        stacks: effect.stacks?.map(stack => ({ ...stack })),
      })),
      currentEnergy: Math.min(character.currentEnergy, energyState.maxEnergy),
      maxEnergy: energyState.maxEnergy,
      elementDmgBoosts: { ...character.elementDmgBoosts },
    };
  }

  private toCharacterDataForUnlock(character: any): CharacterData {
    const currentJobId = character.currentJobId ?? 'warrior';
    const currentJob = this.masterData.getJob(currentJobId) ?? this.masterData.getJob('warrior')!;
    const jobs = (character.jobs ?? []).map((job: UserJobState) => ({ jobId: job.jobId, level: job.level, exp: job.exp }));
    const currentJobLevel = Math.max(1, jobs.find((job: { jobId: string; level: number; exp: number }) => job.jobId === currentJobId)?.level ?? 1);
    const energyState = calculateEnergyState(currentJob, currentJobLevel);
    const persistedBaseStats = {
      hp: character.hp,
      atk: character.atk,
      def: character.def,
      spd: character.spd,
      critRate: character.critRate,
      critDmg: character.critDmg,
      effectHit: character.effectHit,
      effectRes: character.effectRes,
    };
    const baseStats = getJobBaseStatsAtLevel(currentJob, currentJobLevel, persistedBaseStats);

    return {
      id: character.id,
      name: character.name,
      currentJobId,
      category: currentJob.category,
      baseStats,
      necroLevel: character.necroLevel ?? 1,
      necroBaseStatsBonus: character.necroBaseStatsBonus ?? 1,
      stats: baseStats,
      passives: {
        passiveAtkBonus: character.passiveAtkBonus ?? 0,
        passiveDefBonus: character.passiveDefBonus ?? 0,
        passiveSpdBonus: character.passiveSpdBonus ?? 0,
        passiveCritRateBonus: character.passiveCritRateBonus ?? 0,
        passiveCritDmgBonus: character.passiveCritDmgBonus ?? 0,
        passiveHpBonus: character.passiveHpBonus ?? 0,
      },
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      baseResistances: {},
      jobs,
      isAwakened: false,
      clearedStages: character.clearedStages ?? [],
      gold: character.gold ?? 0,
      currentEnergy: energyState.currentEnergy,
      maxEnergy: energyState.maxEnergy,
      elementDmgBoosts: {},
    };
  }

  /**
   * 職業レベルアップ時の処理とパッシブ蓄積。
   * Character モデルの passiveXxxBonus を確実に更新。
   */
  public async onLevelUp(characterOrId: string | CharacterData, jobId: string, newLevel: number): Promise<void> {
    if (typeof characterOrId !== 'string') {
      const character = characterOrId;
      const job = character.jobs.find(j => j.jobId === jobId);
      const oldLevel = job?.level ?? 0;
      if (job) job.level = newLevel;
      else character.jobs.push({ jobId, level: newLevel, exp: 0 });

      const jobData = this.masterData.getJob(jobId);
      const bonus = this.sumLevelBonuses(jobData, oldLevel, newLevel);
      if (this.hasPassiveBonus(bonus)) {
        character.passives.passiveAtkBonus += bonus.passiveAtkBonus || 0;
        character.passives.passiveDefBonus += bonus.passiveDefBonus || 0;
        character.passives.passiveCritRateBonus += bonus.passiveCritRateBonus || 0;
        character.passives.passiveCritDmgBonus  += bonus.passiveCritDmgBonus  || 0;
        character.passives.passiveSpdBonus      += bonus.passiveSpdBonus      || 0;
        character.passives.passiveHpBonus       += bonus.passiveHpBonus       || 0;
      }
      return;
    }

    if (!this.prisma) throw new Error('PrismaClient is required for persistent job level updates.');
    const characterId = characterOrId;
    await this.prisma.$transaction(async (tx: any) => {
      const current = await tx.userJob.findUnique({
        where: {
          characterId_jobId: {
            characterId,
            jobId,
          },
        },
        select: { level: true },
      });

      // UserJob のレベルを更新
      await tx.userJob.update({
        where: {
          characterId_jobId: {
            characterId,
            jobId,
          },
        },
        data: { level: newLevel },
      });

      // 特定レベル到達時の永続パッシブ加算処理 (GDD-004)
      const jobData = this.masterData.getJob(jobId);
      const bonus = this.sumLevelBonuses(jobData, current?.level ?? 0, newLevel);
      if (this.hasPassiveBonus(bonus)) {
        await this.applyPassiveBonus(tx, characterId, bonus);
      }
    });
  }

  private sumLevelBonuses(jobData: JobData | undefined, fromExclusive: number, toInclusive: number) {
    const totals: Record<string, number> = {};
    if (!jobData?.levelBonuses || toInclusive <= fromExclusive) return totals;
    for (let level = fromExclusive + 1; level <= toInclusive; level += 1) {
      const bonus = jobData.levelBonuses[level.toString()];
      if (!bonus) continue;
      Object.entries(bonus).forEach(([key, value]) => {
        totals[key] = (totals[key] ?? 0) + (value ?? 0);
      });
    }
    return totals;
  }

  private hasPassiveBonus(bonus: Record<string, number>): boolean {
    return Object.values(bonus).some(value => value !== 0);
  }

  /**
   * 職業とレベルに応じたパッシブボーナスの適用を DB に反映
   */
  private async applyPassiveBonus(tx: any, characterId: string, bonus: any): Promise<void> {
    await tx.character.update({
      where: { id: characterId },
      data: {
        passiveAtkBonus:      { increment: bonus.passiveAtkBonus      || 0 },
        passiveDefBonus:      { increment: bonus.passiveDefBonus      || 0 },
        passiveSpdBonus:      { increment: bonus.passiveSpdBonus      || 0 },
        passiveCritRateBonus: { increment: bonus.passiveCritRateBonus || 0 },
        passiveCritDmgBonus:  { increment: bonus.passiveCritDmgBonus  || 0 },
        passiveHpBonus:       { increment: bonus.passiveHpBonus       || 0 },
      },
    });
  }
}
