import { CharacterData, UserJobState } from '../types/game';

/**
 * 職業に関するビジネスロジックを担当するサービス (GDD-004)
 */
export class JobService {
  /**
   * 転職処理。
   * @param character キャラクターデータ
   * @param nextJobId 転職先の職業ID
   * @returns 更新されたキャラクターデータ
   */
  public async changeJob(character: CharacterData, nextJobId: string): Promise<CharacterData> {
    // 既存の職業リストから検索
    let userJob = character.jobs.find(j => j.jobId === nextJobId);

    // 初めての職業の場合はLv1で新規作成 (GDD-004: 転職するとLv1に戻る)
    if (!userJob) {
      userJob = {
        jobId: nextJobId,
        level: 1,
        exp: 0
      };
      character.jobs.push(userJob);
    }

    // 現在の職業を更新
    character.currentJobId = nextJobId;

    return character;
  }

  /**
   * 職業レベルアップ時の処理とパッシブ蓄積。
   * @param character キャラクターデータ
   * @param jobId レベルアップした職業ID
   * @param newLevel 到達レベル
   * @returns 更新されたキャラクターデータ
   */
  public async onLevelUp(character: CharacterData, jobId: string, newLevel: number): Promise<CharacterData> {
    const userJob = character.jobs.find(j => j.jobId === jobId);
    if (!userJob) return character;

    userJob.level = newLevel;

    // 特定レベル到達時の永続パッシブ加算処理 (GDD-004)
    // 例: Lv10ごとに対応するステータスにボーナス
    if (newLevel % 10 === 0) {
      this.applyPassiveBonus(character, jobId, newLevel);
    }

    return character;
  }

  /**
   * 職業とレベルに応じたパッシブボーナスの適用
   */
  private applyPassiveBonus(character: CharacterData, jobId: string, level: number): void {
    // 職業ごとの特性に応じたボーナス (本来はJobマスターデータから取得すべきだが、ここでは簡易的に実装)
    switch (jobId) {
      case 'warrior':
        character.passives.passiveAtkBonus += 5;
        break;
      case 'mage':
        character.passives.passiveMatkBonus += 5;
        break;
      case 'dark_priest':
        character.passives.passiveMatkBonus += 3;
        character.passives.passiveMdefBonus += 2;
        break;
      case 'rogue':
        character.passives.passiveAtkBonus += 2;
        // AGIボーナスなども将来的に追加
        break;
    }
  }
}
