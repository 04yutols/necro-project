import { PrismaClient } from '@prisma/client';
import { CharacterData, UserJobState } from '../types/game';
import { MasterDataService } from './MasterDataService';
import { calculateJobAdjustedStats, getJobUnlockStatus } from '../logic/JobSystem';

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
  public async changeJob(characterOrId: string | CharacterData, nextJobId: string): Promise<void> {
    if (typeof characterOrId !== 'string') {
      const character = characterOrId;
      const jobData = this.masterData.getJob(nextJobId);
      if (!jobData) throw new Error(`Job ${nextJobId} not found in master data`);
      const unlock = getJobUnlockStatus(character, jobData);
      if (!unlock.unlocked) throw new Error(`Job ${nextJobId} is locked`);

      const existing = character.jobs.find(job => job.jobId === nextJobId);
      if (!existing) {
        character.jobs.push({ jobId: nextJobId, level: 1, exp: 0 });
      }
      character.currentJobId = nextJobId;
      character.category = jobData.category;
      const baseStats = character.baseStats ?? character.stats;
      character.baseStats = baseStats;
      character.stats = calculateJobAdjustedStats(baseStats, jobData);
      return;
    }

    if (!this.prisma) throw new Error('PrismaClient is required for persistent job changes.');
    const characterId = characterOrId;
    await this.prisma.$transaction(async (tx: any) => {
      // マスターデータの存在確認
      const jobData = this.masterData.getJob(nextJobId);
      if (!jobData) throw new Error(`Job ${nextJobId} not found in master data`);

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

  /**
   * 職業レベルアップ時の処理とパッシブ蓄積。
   * Character モデルの passiveXxxBonus を確実に更新。
   */
  public async onLevelUp(characterOrId: string | CharacterData, jobId: string, newLevel: number): Promise<void> {
    if (typeof characterOrId !== 'string') {
      const character = characterOrId;
      const job = character.jobs.find(j => j.jobId === jobId);
      if (job) job.level = newLevel;
      else character.jobs.push({ jobId, level: newLevel, exp: 0 });

      const jobData = this.masterData.getJob(jobId);
      const bonus = jobData?.levelBonuses?.[newLevel.toString()];
      if (bonus) {
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
      if (jobData && jobData.levelBonuses && jobData.levelBonuses[newLevel.toString()]) {
        await this.applyPassiveBonus(tx, characterId, jobData.levelBonuses[newLevel.toString()]);
      }
    });
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
