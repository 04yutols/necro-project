import { PrismaClient } from '@prisma/client';
import { CharacterData, UserJobState } from '../types/game';
import { MasterDataService } from './MasterDataService';

/**
 * 職業に関するビジネスロジックを担当するサービス (GDD-004)
 * Prisma を用いた永続化に対応。
 */
export class JobService {
  private masterData: MasterDataService;

  constructor(private prisma: PrismaClient) {
    this.masterData = MasterDataService.getInstance();
  }

  /**
   * 転職処理。
   * トランザクションを用いて UserJob の生成・更新を行う。
   */
  public async changeJob(characterId: string, nextJobId: string): Promise<void> {
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
  public async onLevelUp(characterId: string, jobId: string, newLevel: number): Promise<void> {
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
        passiveAtkBonus: { increment: bonus.passiveAtkBonus || 0 },
        passiveDefBonus: { increment: bonus.passiveDefBonus || 0 },
        passiveMatkBonus: { increment: bonus.passiveMatkBonus || 0 },
        passiveMdefBonus: { increment: bonus.passiveMdefBonus || 0 },
      },
    });
  }
}
