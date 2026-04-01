import { 
  MonsterData, 
  SoulShardData, 
  NecroStatus, 
  Tribe 
} from '../types/game';

/**
 * 死霊術システム (GDD-005) に関するビジネスロジックを担当するサービス
 */
export class NecroService {
  /**
   * 魂石化 (Soul Stoning): モンスターを魂の欠片に変換する
   * @param monster 変換元のモンスター
   * @returns 生成された魂の欠片データ
   */
  public createSoulShard(monster: MonsterData): SoulShardData {
    // 元のステータスの 10% を補正値として継承する (バランス調整の一環)
    const atkBonus = Math.floor(monster.stats.atk * 0.1);
    const matkBonus = Math.floor(monster.stats.matk * 0.1);

    return {
      id: `shard-${Date.now()}-${monster.id}`,
      originMonsterName: monster.name,
      effect: {
        atkBonus,
        matkBonus,
        specialAbility: this.deriveSpecialAbility(monster.tribe)
      }
    };
  }

  /**
   * パーティ編成バリデーション (3枠コスト制)
   * @param status 現在の死霊術ステータス
   * @param slots 編成スロット
   * @throws コスト超過時にエラー
   */
  public validatePartyFormation(status: NecroStatus, slots: (MonsterData | null)[]): boolean {
    if (slots.length !== 3) {
      throw new Error("パーティ編成は3枠固定です。");
    }

    const totalCost = slots.reduce((acc, monster) => acc + (monster?.cost || 0), 0);

    if (totalCost > status.maxCost) {
      throw new Error(`コスト超過です (Total: ${totalCost}, Max: ${status.maxCost})`);
    }

    // シナジー判定の実行 (将来的な拡張)
    this.checkTribeSynergy(slots);

    return true;
  }

  /**
   * ランクアップ (Reincarnation): Lv.99到達後の転生
   * @param status 現在の死霊術ステータス
   * @param isTrialCompleted 試練クリアフラグ
   * @returns 更新された死霊術ステータス
   */
  public performRankUp(status: NecroStatus, isTrialCompleted: boolean): NecroStatus {
    if (status.level < 99) {
      throw new Error("ランクアップにはLv.99到達が必要です。");
    }
    if (!isTrialCompleted) {
      throw new Error("ランクアップには試練のクリアが必要です。");
    }

    // 次のランクへ (最大 Rank 10)
    const nextRank = Math.min(10, status.rank + 1);
    
    // 倍率処理: MaxCost と基礎ステータスボーナスを爆発的に上昇させる (GDD-005)
    // ランクごとに MaxCost +5, ステータス倍率 +50% 蓄積
    return {
      level: 1, // Lv 1 にリセット
      rank: nextRank,
      maxCost: status.maxCost + 5,
      baseStatsBonus: status.baseStatsBonus + 0.5
    };
  }

  /**
   * 種族シナジー判定 (GDD-005 プレースホルダー)
   */
  private checkTribeSynergy(slots: (MonsterData | null)[]): void {
    const tribes = slots.filter(m => m !== null).map(m => m!.tribe);
    const uniqueTribes = new Set(tribes);

    // 同一種類3体などの判定ロジックをここに実装予定
    if (tribes.length === 3 && uniqueTribes.size === 1) {
      // console.log(`Synergy Active: ${tribes[0]} x3!`);
    }
  }

  private deriveSpecialAbility(tribe: Tribe): string | undefined {
    switch (tribe) {
      case 'UNDEAD': return "REGENERATE_SOUL";
      case 'DEMON': return "BANE_OF_LIGHT";
      default: return undefined;
    }
  }
}
