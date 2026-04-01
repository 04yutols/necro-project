import { PrismaClient } from '@prisma/client';
import { JobService } from '../services/JobService';
import { NecroService } from '../services/NecroService';
import { RewardService } from '../services/RewardService';
import { MasterDataService } from '../services/MasterDataService';
import { BattleEngine } from './BattleEngine';
import { CharacterData, MonsterData } from '../types/game';

/**
 * ゲーム全体の進行とループを管理するクラス (GDD-002)
 */
export class GameManager {
  private prisma: PrismaClient;
  private jobService: JobService;
  private necroService: NecroService;
  private rewardService: RewardService;
  private masterData: MasterDataService;

  constructor() {
    this.prisma = new PrismaClient();
    this.jobService = new JobService(this.prisma);
    this.necroService = new NecroService(this.prisma);
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

    // CharacterData 型への変換
    const player: CharacterData = {
      id: char.id,
      name: char.name,
      currentJobId: char.currentJobId || 'warrior',
      category: (this.masterData.getJob(char.currentJobId || 'warrior')?.category as any) || 'PHYSICAL',
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

  /**
   * ステージクリア後のリザルト処理 (GDD-002)
   */
  public async processStageResult(characterId: string, stageId: string): Promise<any> {
    const stage = this.masterData.getStage(stageId);
    if (!stage) throw new Error("Stage not found");

    const char = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { jobs: true }
    });
    if (!char) throw new Error("Character not found");

    // 1. 経験値と報酬の計算
    const playerConverted = this.convertToCharacterData(char);
    const expGain = this.rewardService.calculateExp(stage.rewards.baseExp, playerConverted);
    const rewards = this.rewardService.calculateDrops(stage.rewards.dropTable, char.luck);

    // 2. DBへの反映 (トランザクション)
    await this.prisma.$transaction(async (tx) => {
      // 経験値加算
      const currentJob = char.jobs.find(j => j.jobId === char.currentJobId);
      if (currentJob) {
        const newExp = currentJob.exp + expGain;
        const newLevel = Math.floor(newExp / 100) + 1; // 簡易的なレベルアップ式
        
        await tx.userJob.update({
          where: { characterId_jobId: { characterId, jobId: char.currentJobId! } },
          data: { exp: newExp, level: newLevel }
        });

        // パッシブ加算チェック (JobServiceのロジックを流用)
        // 本来は JobService を tx 内で呼ぶべき
      }

      // ドロップモンスターの追加
      for (const mId of rewards.monsters) {
        const mMaster = this.masterData.getMonster(mId);
        await tx.monster.create({
          data: {
            name: mMaster.name,
            tribe: mMaster.tribe,
            cost: mMaster.cost,
            ...mMaster.stats
          }
        });
      }
    });

    return { expGain, rewards };
  }

  private convertToCharacterData(char: any): CharacterData {
    return {
      id: char.id,
      name: char.name,
      currentJobId: char.currentJobId || 'warrior',
      category: (this.masterData.getJob(char.currentJobId || 'warrior')?.category as any) || 'PHYSICAL',
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
      jobs: char.jobs.map((j: any) => ({ jobId: j.jobId, level: j.level, exp: j.exp })),
      isAwakened: false
    };
  }

  /**
   * パーティ編成の更新 (GDD-005)
   */
  public async updateParty(characterId: string, monsterIds: (string | null)[]): Promise<void> {
    // 3枠固定のバリデーション
    if (monsterIds.length !== 3) throw new Error("Party must have 3 slots.");

    const char = await this.prisma.character.findUnique({
      where: { id: characterId }
    });
    if (!char) throw new Error("Character not found.");

    // コスト計算
    const monsters = await this.prisma.monster.findMany({
      where: { id: { in: monsterIds.filter(id => id !== null) as string[] } }
    });
    const totalCost = monsters.reduce((acc, m) => acc + m.cost, 0);

    if (totalCost > char.necroMaxCost) {
      throw new Error(`Cost limit exceeded: ${totalCost} / ${char.necroMaxCost}`);
    }

    // 本来はパーティ編成をDBに保存するテーブルが必要だが、
    // ここでは簡易的にログ出力のみ、またはCharacterモデルにID配列を持たせる等の対応
    console.log(`Party updated for ${characterId}: ${monsterIds.join(', ')}`);
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

  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
