import { PrismaClient } from '@prisma/client';
import {
  MonsterData,
  SoulShardData,
  NecroStatus,
  Tribe
} from '../types/game';
import { MasterDataService } from './MasterDataService';

export class NecroService {
  private masterData: MasterDataService;

  constructor(private prisma?: PrismaClient) {
    this.masterData = MasterDataService.getInstance();
  }

  // ── インメモリ版: MonsterData から直接生成 ─────────────────────────────────

  public createSoulShard(monster: MonsterData): SoulShardData;
  public createSoulShard(monsterId: string): Promise<SoulShardData>;
  public createSoulShard(arg: MonsterData | string): SoulShardData | Promise<SoulShardData> {
    if (typeof arg !== 'string') {
      const monster = arg;
      return {
        id: `shard-${monster.id}`,
        originMonsterName: monster.name,
        effect: {
          atkBonus: Math.floor(monster.stats.atk * 0.1),
          elementDmgBoost: Math.floor((monster.stats.effectHit ?? 0) * 0.1),
          specialAbility: this.deriveSpecialAbility(monster.tribe),
        },
      };
    }

    // DB版
    if (!this.prisma) throw new Error('PrismaClient is required for DB createSoulShard.');
    const monsterId = arg;
    return this.prisma.$transaction(async (tx: any) => {
      const monster = await tx.monster.findUnique({ where: { id: monsterId } });
      if (!monster) throw new Error('Monster not found');

      const atkBonus = Math.floor(monster.atk * 0.1);
      const elementDmgBoost = Math.floor((monster.effectHit ?? 0) * 0.1);

      const soulShard = await tx.soulShard.create({
        data: {
          originMonster: monster.name,
          atkBonus,
          elementDmgBoost,
          specialAbility: this.deriveSpecialAbility(monster.tribe as Tribe),
        },
      });

      await tx.monster.delete({ where: { id: monsterId } });

      return {
        id: soulShard.id,
        originMonsterName: soulShard.originMonster,
        effect: {
          atkBonus: soulShard.atkBonus,
          elementDmgBoost: soulShard.elementDmgBoost,
          specialAbility: soulShard.specialAbility || undefined,
        },
      };
    });
  }

  // ── パーティ編成バリデーション（インメモリのみ）────────────────────────────

  public validatePartyFormation(necroStatus: NecroStatus, slots: (MonsterData | null)[]): true {
    if (slots.length !== 3) throw new Error('パーティ編成は3枠固定です。');
    const totalCost = slots.reduce((sum, m) => sum + (m?.cost ?? 0), 0);
    if (totalCost > necroStatus.maxCost) throw new Error('コスト超過です');
    return true;
  }

  // ── ランクアップ ──────────────────────────────────────────────────────────

  public performRankUp(status: NecroStatus, isTrialCompleted: boolean): NecroStatus;
  public performRankUp(characterId: string, isTrialCompleted: boolean): Promise<void>;
  public performRankUp(
    arg: NecroStatus | string,
    isTrialCompleted: boolean,
  ): NecroStatus | Promise<void> {
    if (typeof arg !== 'string') {
      const status = arg;
      if (status.level < 99) throw new Error('Lv.99到達が必要です。');
      if (!isTrialCompleted) throw new Error('試練のクリアが必要です。');
      return {
        level: 1,
        rank: Math.min(10, status.rank + 1),
        maxCost: status.maxCost + 5,
        baseStatsBonus: status.baseStatsBonus + 0.5,
        exp: 0,
      };
    }

    // DB版
    if (!this.prisma) throw new Error('PrismaClient is required for DB performRankUp.');
    const characterId = arg;
    return this.prisma.$transaction(async (tx: any) => {
      const character = await tx.character.findUnique({ where: { id: characterId } });
      if (!character) throw new Error('Character not found');
      if (character.necroLevel < 99) throw new Error('ランクアップにはLv.99到達が必要です。');
      if (!isTrialCompleted) throw new Error('ランクアップには試練のクリアが必要です。');

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

  // ── ソウルシャード装備（DB のみ）─────────────────────────────────────────

  public async equipSoulShard(monsterId: string, shardId: string): Promise<void> {
    if (!this.prisma) throw new Error('PrismaClient is required for equipSoulShard.');
    await this.prisma.$transaction(async (tx: any) => {
      const monster = await tx.monster.findUnique({ where: { id: monsterId } });
      const shard = await tx.soulShard.findUnique({ where: { id: shardId } });
      if (!monster) throw new Error('Monster not found');
      if (!shard) throw new Error('SoulShard not found');
      await tx.monster.update({ where: { id: monsterId }, data: { soulShardId: shardId } });
    });
  }

  private deriveSpecialAbility(tribe: Tribe): string | undefined {
    switch (tribe) {
      case 'UNDEAD':   return 'REGENERATE_SOUL';
      case 'DEMON':    return 'BANE_OF_LIGHT';
      case 'DRAGON':   return 'ELEMENTAL_SURGE';
      case 'ORC':      return 'IRON_HIDE';
      default:         return undefined;
    }
  }
}
