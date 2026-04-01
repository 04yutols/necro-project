import { CharacterData, BaseStats } from '../types/game';

interface DropResult {
  items: string[];
  monsters: string[];
}

/**
 * 戦闘終了後の報酬計算を担当するサービス (GDD-002, GDD-003)
 */
export class RewardService {
  /**
   * 経験値の計算ロジック
   * @param baseExp ステージの基礎経験値
   * @param player プレイヤーデータ（現在の職業レベル等）
   * @returns 計算後の獲得経験値
   */
  public calculateExp(baseExp: number, player: CharacterData): number {
    const currentJob = player.jobs.find(j => j.jobId === player.currentJobId);
    const levelFactor = currentJob ? (1 + currentJob.level / 100) : 1;
    
    // 物理系・魔法系による微調整（将来的な拡張用）
    const categoryMultiplier = player.category === 'MAGICAL' ? 1.1 : 1.0;

    return Math.floor(baseExp * levelFactor * categoryMultiplier);
  }

  /**
   * ドロップ判定ロジック (GDD-003 LUCKの役割)
   * @param dropTable ステージのドロップテーブル
   * @param luck プレイヤーのLUCKステータス
   * @returns 獲得したアイテムとモンスターのリスト
   */
  public calculateDrops(dropTable: any[], luck: number): DropResult {
    const result: DropResult = { items: [], monsters: [] };

    // LUCKによるドロップ率上昇: BaseRate * (1 + LUCK / 100)
    const luckMultiplier = 1 + luck / 100;

    dropTable.forEach(entry => {
      const adjustedRate = entry.rate * luckMultiplier;
      if (Math.random() < adjustedRate) {
        if (entry.itemId) result.items.push(entry.itemId);
        if (entry.monsterId) result.monsters.push(entry.monsterId);
      }
    });

    return result;
  }
}
