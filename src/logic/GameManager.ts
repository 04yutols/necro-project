import { PrismaClient } from '@prisma/client';
import { JobService } from '../services/JobService';
import { NecroService } from '../services/NecroService';
import { BattleEngine } from './BattleEngine';
import { CharacterData, MonsterData } from '../types/game';

/**
 * ゲーム全体の進行とループを管理するクラス (GDD-002)
 */
export class GameManager {
  private prisma: PrismaClient;
  private jobService: JobService;
  private necroService: NecroService;

  constructor() {
    this.prisma = new PrismaClient();
    this.jobService = new JobService(this.prisma);
    this.necroService = new NecroService(this.prisma);
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
   */
  public async startStage(characterId: string, monsters: string[]): Promise<BattleEngine> {
    // DB から最新のキャラクターとモンスターを取得
    const char = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { jobs: true },
    });

    if (!char) throw new Error("Character not found");

    const monsterData = await this.prisma.monster.findMany({
      where: { id: { in: monsters } },
    });

    // CharacterData 型への変換 (簡易版)
    const player: CharacterData = {
      id: char.id,
      name: char.name,
      currentJobId: char.currentJobId || 'warrior',
      category: 'PHYSICAL', // 本来は Job モデルから取得
      stats: {
        hp: char.hp, mp: char.mp, atk: char.atk, def: char.def,
        matk: char.matk, mdef: char.mdef, agi: char.agi, luck: char.luck, tec: char.tec
      },
      passives: {
        passiveAtkBonus: char.passiveAtkBonus,
        passiveDefBonus: char.passiveDefBonus,
        passiveMatkBonus: char.passiveMatkBonus,
        passiveMdefBonus: char.passiveMdefBonus
      },
      jobs: char.jobs.map(j => ({ jobId: j.jobId, level: j.level, exp: j.exp })),
      isAwakened: false
    };

    const monsterList = monsterData.map(m => ({
      id: m.id,
      name: m.name,
      tribe: m.tribe as any,
      cost: m.cost,
      stats: {
        hp: m.hp, mp: m.mp, atk: m.atk, def: m.def,
        matk: m.matk, mdef: m.mdef, agi: m.agi, luck: m.luck, tec: m.tec
      }
    }));

    return new BattleEngine(player, monsterList);
  }

  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
