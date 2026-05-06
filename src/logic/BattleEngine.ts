import {
  CharacterData,
  MonsterData,
  BattleState,
  BattleLog,
  BaseStats,
  Resistances,
  ElementType,
  SkillAttackType
} from '../types/game';
import { MasterDataService } from '../services/MasterDataService';
import { calculateCharacterStatProfile, hasElementDmgBoosts } from './StatSystem';

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
  public simulateAction(actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', target: MonsterData, skillId?: string): BattleLog[] {
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
   * ダメージ計算ロジック（HSR互換式）
   * baseDmg = ATK × power
   * defMult  = 1 - DEF / (DEF + 200)
   * finalDmg = baseDmg × defMult × (1 + elementBoost) × resMult
   * 会心時:   × critDmg / 100
   */
  private calculateDamage(
    attackerStats: BaseStats,
    attackerElementBoosts: Partial<Record<ElementType, number>>,
    defenderStats: BaseStats,
    defenderResistances: Resistances,
    powerMultiplier: number = 1.0,
    element: ElementType = 'NONE'
  ): { damage: number; isCritical: boolean; isWeakness: boolean; isResisted: boolean } {

    // 1. 基礎ダメージ
    let damage = attackerStats.atk * powerMultiplier;

    // 2. 防御軽減（HSR簡易版）
    const defenderDef = Math.max(0, defenderStats.def);
    const defMult = 1 - defenderDef / (defenderDef + 200);
    damage *= defMult;

    // 3. 属性ダメージ加成（装備・残滓から）
    const elementBoost = (attackerElementBoosts[element] ?? 0) / 100;
    damage *= (1 + elementBoost);

    // 4. 属性耐性
    let isWeakness = false;
    let isResisted = false;
    const resistance = defenderResistances[element] ?? 0;
    if (resistance < 0) isWeakness = true;
    if (resistance > 0) isResisted = true;
    damage *= (1 - resistance / 100);

    // 5. 会心判定
    const isCritical = Math.random() * 100 < attackerStats.critRate;
    if (isCritical) {
      damage *= attackerStats.critDmg / 100;
    }

    return {
      damage: Math.max(1, Math.floor(damage)),
      isCritical,
      isWeakness,
      isResisted
    };
  }

  private processPlayerAction(actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', target: MonsterData, skillId?: string): void {
    const { player } = this.state;
    const profile = calculateCharacterStatProfile(player);
    const stats = profile.total;
    const elementBoosts = hasElementDmgBoosts(player.elementDmgBoosts)
      ? player.elementDmgBoosts
      : profile.elementDmgBoosts;

    let energyCost = 0;
    let power = 1.0;
    let actionName = '攻撃';
    let element: ElementType = 'NONE';
    let attackType: SkillAttackType = 'SLASH';
    let energyGain = 20; // 通常攻撃: +20

    if (actionType === 'PHYSICAL_ATTACK') {
      energyCost = 0;
      attackType = 'SLASH';
    } else if (actionType === 'MAGIC_SKILL' && skillId) {
      const skillData = this.masterData.getSkill(skillId);
      if (skillData) {
        energyCost = skillData.mpCost;
        power = skillData.power;
        actionName = skillData.name;
        if (skillData.element) element = skillData.element;
        attackType = skillData.attackType ?? (skillData.type === 'MAGICAL' ? 'MAGIC' : 'SLASH');
        energyGain = skillData.isUltimate ? 0 : 15; // 奥義ではエネルギー獲得なし
      }
    } else {
      // フォールバック
      energyCost = 0;
      attackType = 'SLASH';
    }

    // エネルギーコスト判定
    if (player.currentEnergy < energyCost) {
      this.addLog('NO_ENERGY', player.name, target.name, `エネルギーが不足しています！（必要: ${energyCost}）`);
      return;
    }

    // エネルギー消費・獲得
    player.currentEnergy = Math.min(player.maxEnergy, Math.max(0, player.currentEnergy - energyCost + energyGain));

    const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(stats, elementBoosts, target.stats, target.resistances ?? {}, power, element);

    let desc = `${player.name}の${actionName}！`;
    if (isWeakness) desc += ` 弱点を突いた！`;
    else if (isResisted) desc += ` 効果はいまひとつのようだ。`;

    this.addLog(actionType, player.name, target.name, desc, damage, isCritical, isWeakness, isResisted, element, attackType);
  }

  private processMonsterActions(target: MonsterData): void {
    const { player, monsters } = this.state;

    monsters.forEach(monster => {
      if (!monster) return;

      // プレイヤー覚醒時のパッシブバフ (GDD-005) — ATKを1.5倍
      const monsterStats = { ...monster.stats };
      if (player.isAwakened) {
        monsterStats.atk = Math.floor(monsterStats.atk * 1.5);
      }

      const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(monsterStats, {}, target.stats, target.resistances, 1.0, 'NONE');
      this.addLog('MONSTER_ATTACK', monster.name, target.name, `${monster.name}の追撃！`, damage, isCritical, isWeakness, isResisted, 'NONE', 'STRIKE');
    });
  }

  private processAreaGimmick(): void {
    const { areaGimmick, player } = this.state;
    if (areaGimmick === 'SLIP_DAMAGE') {
      const playerStats = this.getMutableStats(player);
      const damage = Math.floor(playerStats.hp * 0.05);
      playerStats.hp -= damage;
      this.addLog('GIMMICK', 'Area', player.name, `エリアギミック：スリップダメージにより${damage}ダメージ。`);
    }
  }

  private getTotalStats(player: CharacterData): BaseStats {
    return calculateCharacterStatProfile(player).total;
  }

  private getMutableStats(player: CharacterData): BaseStats {
    return ((player as any).stats ?? (player as any).baseStats) as BaseStats;
  }

  private updateState(): void {
    this.state.turn++;
    // 仮のWAVE進行ロジック
    if (this.state.turn > 10) {
      this.state.wave = Math.min(3, this.state.wave + 1);
      this.state.turn = 1;
    }
  }

  private addLog(
    action: string,
    actorName: string,
    targetName: string,
    description: string,
    damage?: number,
    isCritical?: boolean,
    isWeakness?: boolean,
    isResisted?: boolean,
    element: ElementType = 'NONE',
    attackType: SkillAttackType = 'SLASH'
  ): void {
    this.logs.push({
      turn: this.state.turn,
      wave: this.state.wave,
      action,
      actorName,
      targetName,
      damage,
      isCritical,
      isWeakness,
      isResisted,
      element,
      attackType,
      playerEnergy: this.state.player.currentEnergy,
      playerMP: this.state.player.currentEnergy,
      playerHP: this.getMutableStats(this.state.player).hp,
      description
    });
  }
}
