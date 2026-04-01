import { PrismaClient } from '@prisma/client';
import { 
  MonsterData, 
  SoulShardData, 
  NecroStatus, 
  Tribe 
} from '../types/game';
import { MasterDataService } from './MasterDataService';

/**
 * 死霊術システム (GDD-005) に関するビジネスロジックを担当するサービス
 * Prisma を用いた永続化に対応。
 */
export class NecroService {
  private masterData: MasterDataService;

  constructor(private prisma: PrismaClient) {
    this.masterData = MasterDataService.getInstance();
  }

  /**
   * 魂石化 (Soul Stoning): モンスターを魂の欠片に変換し DB に保存する
   */
  public async createSoulShard(monsterId: string): Promise<SoulShardData> {
    return await this.prisma.$transaction(async (tx) => {
      const monster = await tx.monster.findUnique({
        where: { id: monsterId },
      });

      if (!monster) throw new Error("Monster not found");

      // 本来は MonsterMaster から成長限界などを加味すべきだが、
      // ここでは簡略化して現在のステータスから生成
      const atkBonus = Math.floor(monster.atk * 0.1);
      const matkBonus = Math.floor(monster.matk * 0.1);

      const soulShard = await tx.soulShard.create({
        data: {
          originMonster: monster.name,
          atkBonus,
          matkBonus,
          specialAbility: this.deriveSpecialAbility(monster.tribe as Tribe),
        },
      });

      // 魂石化したモンスターを削除 (GDD-005)
      await tx.monster.delete({
        where: { id: monsterId },
      });

      return {
        id: soulShard.id,
        originMonsterName: soulShard.originMonster,
        effect: {
          atkBonus: soulShard.atkBonus,
          matkBonus: soulShard.matkBonus,
          specialAbility: soulShard.specialAbility || undefined,
        },
      };
    });
  }

  /**
   * ランクアップ (Reincarnation): Lv.99到達後の転生
   * Character モデルの necroXxx フィールドを更新する。
   */
  public async performRankUp(characterId: string, isTrialCompleted: boolean): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });

      if (!character) throw new Error("Character not found");
      if (character.necroLevel < 99) throw new Error("ランクアップにはLv.99到達が必要です。");
      if (!isTrialCompleted) throw new Error("ランクアップには試練のクリアが必要です。");

      const nextRank = Math.min(10, character.necroRank + 1);

      await tx.character.update({
        where: { id: characterId },
        data: {
          necroLevel: 1,
          necroRank: nextRank,
          necroMaxCost: character.necroMaxCost + 5,
          necroBaseStatsBonus: character.necroBaseStatsBonus + 0.5,
        },
      });
    });
  }

  private deriveSpecialAbility(tribe: Tribe): string | undefined {
    switch (tribe) {
      case 'UNDEAD': return "REGENERATE_SOUL";
      case 'DEMON': return "BANE_OF_LIGHT";
      default: return undefined;
    }
  }
}
