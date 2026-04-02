import { 
  CharacterData, 
  MonsterData, 
  BattleState, 
  BattleLog, 
  BaseStats, 
  PassiveBonuses,
  ClassCategory 
} from '../types/game';
import { MasterDataService } from '../services/MasterDataService';

/**
 * Necromance Brave Battle Engine
 * ターン制RPGの戦闘ロジック、ダメージ計算、リソース管理、WAVE進行を担当。
 */
export class BattleEngine {
  private state: BattleState;
  private logs: BattleLog[] = [];
  private masterData: MasterDataService;

  constructor(player: CharacterData, monsters: (MonsterData | null)[], areaGimmick: BattleState['areaGimmick'] = 'NONE') {
    this.state = {
      player,
      monsters,
      wave: 1,
      turn: 1,
      areaGimmick
    };
    this.masterData = MasterDataService.getInstance();
  }

  /**
   * 戦闘シミュレーションを実行し、ログを返す。
   * フロントエンドでのアニメーション駆動に使用される。
   */
  public simulateAction(actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', target: { name: string; stats: BaseStats }, skillId?: string): BattleLog[] {
    this.logs = [];

    // 1. ターン開始時のエリアギミック判定 (GDD-006)
    this.processAreaGimmick();

    // 2. プレイヤー行動 (GDD-003)
    this.processPlayerAction(actionType, target, skillId);

    // 3. 軍団の追撃・シナジー (GDD-005)
    this.processMonsterActions(target);

    // 4. ターン・WAVE更新 (GDD-002)
    this.updateState();

    return this.logs;
  }

  /**
   * ダメージ計算ロジック (GDD-003, GDD-006)
   * TECがダメージ安定性に寄与するように設計。
   */
  private calculateDamage(
    attackerStats: BaseStats, 
    defenderStats: BaseStats, 
    type: 'PHYSICAL' | 'MAGICAL',
    powerMultiplier: number = 1.0
  ): { damage: number; isCritical: boolean } {
    
    // 会心判定 (LUCK)
    const isCritical = Math.random() * 100 < attackerStats.luck;
    
    // 基礎計算: (Stat^2 / (Stat + CounterStat)) (GDD-006)
    let damage: number;
    if (type === 'PHYSICAL') {
      damage = (Math.pow(attackerStats.atk, 2)) / (attackerStats.atk + defenderStats.def);
    } else {
      damage = (Math.pow(attackerStats.matk, 2)) / (attackerStats.matk + defenderStats.mdef);
    }

    // スキル威力倍率
    damage *= powerMultiplier;

    // TECの安定性と倍率寄与 (GDD-003)
    // ダメージ = 基礎 * (1 + TEC / 100)
    // TECはダメージの底上げ（安定性）と最大威力の両方に寄与する。
    damage *= (1 + attackerStats.tec / 100);

    // 会心時はTECを威力倍率にさらに反映 (GDD-003)
    if (isCritical) {
      damage *= (1.5 + attackerStats.tec / 200); // 会心倍率 1.5x + TEC補正
    }

    return { 
      damage: Math.floor(damage), 
      isCritical 
    };
  }

  private processPlayerAction(actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', target: { name: string; stats: BaseStats }, skillId?: string): void {
    const { player } = this.state;
    const stats = this.getTotalStats(player);
    
    let cost = 0;
    let power = 1.0;
    let type: 'PHYSICAL' | 'MAGICAL' = 'PHYSICAL';
    let actionName = '攻撃';

    if (actionType === 'PHYSICAL_ATTACK') {
      cost = 0;
      type = 'PHYSICAL';
    } else if (actionType === 'MAGIC_SKILL' && skillId) {
      const skillData = this.masterData.getSkill(skillId);
      if (skillData) {
        cost = skillData.mpCost;
        power = skillData.power;
        type = skillData.type === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL'; // HEAL等は簡略化のため省略
        actionName = skillData.name;
      }
    } else {
      // フォールバック (旧ロジック互換)
      cost = this.getMPCost(player.category, actionType);
      type = player.category === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';
    }

    // MPコスト判定 (GDD-003)
    if (player.stats.mp < cost) {
      this.addLog('NO_MP', player.name, target.name, `MPが不足しています！（必要MP: ${cost}）`);
      return;
    }

    // MP消費
    player.stats.mp -= cost;

    const { damage, isCritical } = this.calculateDamage(stats, target.stats, type, power);

    this.addLog(actionType, player.name, target.name, `${player.name}の${actionName}！`, damage, isCritical);
  }

  private processMonsterActions(target: { name: string; stats: BaseStats }): void {
    const { player, monsters } = this.state;

    monsters.forEach(monster => {
      if (!monster) return;

      // プレイヤー覚醒時のパッシブバフ (GDD-005)
      const monsterStats = { ...monster.stats };
      if (player.isAwakened) {
        monsterStats.atk = Math.floor(monsterStats.atk * 1.5);
        monsterStats.matk = Math.floor(monsterStats.matk * 1.5);
      }

      const { damage, isCritical } = this.calculateDamage(monsterStats, target.stats, 'PHYSICAL');
      this.addLog('MONSTER_ATTACK', monster.name, target.name, `${monster.name}の追撃！`, damage, isCritical);
    });
  }

  private processAreaGimmick(): void {
    const { areaGimmick, player } = this.state;
    if (areaGimmick === 'SLIP_DAMAGE') {
      const damage = Math.floor(player.stats.hp * 0.05);
      player.stats.hp -= damage;
      this.addLog('GIMMICK', 'Area', player.name, `エリアギミック：スリップダメージにより${damage}ダメージ。`);
    }
  }

  private getMPCost(category: ClassCategory, action: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL'): number {
    // 物理職: 低コスト (GDD-003)
    if (category === 'PHYSICAL') {
      return action === 'PHYSICAL_ATTACK' ? 0 : 3;
    } 
    // 魔法職: 高コスト (GDD-003)
    else {
      return action === 'PHYSICAL_ATTACK' ? 0 : 15;
    }
  }

  private getTotalStats(player: CharacterData): BaseStats {
    const total = { ...player.stats };
    // パッシブ蓄積を反映 (GDD-004)
    total.atk += player.passives.passiveAtkBonus;
    total.def += player.passives.passiveDefBonus;
    total.matk += player.passives.passiveMatkBonus;
    total.mdef += player.passives.passiveMdefBonus;
    
    return total;
  }

  private updateState(): void {
    this.state.turn++;
    // 仮のWAVE進行ロジック
    if (this.state.turn > 10) {
      this.state.wave = Math.min(3, this.state.wave + 1);
      this.state.turn = 1;
    }
  }

  private addLog(action: string, actorName: string, targetName: string, description: string, damage?: number, isCritical?: boolean): void {
    this.logs.push({
      turn: this.state.turn,
      wave: this.state.wave,
      action,
      actorName,
      targetName,
      damage,
      isCritical,
      playerMP: this.state.player.stats.mp,
      playerHP: this.state.player.stats.hp,
      description
    });
  }
}
