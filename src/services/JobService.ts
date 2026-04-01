import { PrismaClient } from '@prisma/client';
import { CharacterData, UserJobState } from '../types/game';

/**
 * 職業に関するビジネスロジックを担当するサービス (GDD-004)
 * Prisma を用いた永続化に対応。
 */
export class JobService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 転職処理。
   * トランザクションを用いて UserJob の生成・更新を行う。
   */
  public async changeJob(characterId: string, nextJobId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
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
    await this.prisma.$transaction(async (tx) => {
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
      if (newLevel % 10 === 0) {
        await this.applyPassiveBonus(tx, characterId, jobId, newLevel);
      }
    });
  }

  /**
   * 職業とレベルに応じたパッシブボーナスの適用を DB に反映
   */
  private async applyPassiveBonus(tx: any, characterId: string, jobId: string, level: number): Promise<void> {
    let bonus = {
      passiveAtkBonus: 0,
      passiveDefBonus: 0,
      passiveMatkBonus: 0,
      passiveMdefBonus: 0,
    };

    switch (jobId) {
      case 'warrior':
        bonus.passiveAtkBonus = 5;
        break;
      case 'mage':
        bonus.passiveMatkBonus = 5;
        break;
      case 'dark_priest':
        bonus.passiveMatkBonus = 3;
        bonus.passiveMdefBonus = 2;
        break;
      case 'rogue':
        bonus.passiveAtkBonus = 2;
        break;
    }

    await tx.character.update({
      where: { id: characterId },
      data: {
        passiveAtkBonus: { increment: bonus.passiveAtkBonus },
        passiveDefBonus: { increment: bonus.passiveDefBonus },
        passiveMatkBonus: { increment: bonus.passiveMatkBonus },
        passiveMdefBonus: { increment: bonus.passiveMdefBonus },
      },
    });
  }
}
