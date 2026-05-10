import {
  CharacterData,
  MonsterData,
  BattleState,
  BattleLog,
  BaseStats,
  Resistances,
  ElementType,
  SkillAttackType,
  AilmentType,
  StatusEffect
} from '../types/game';
import { MasterDataService } from '../services/MasterDataService';
import { calculateCharacterStatProfile, hasElementDmgBoosts } from './StatSystem';
import {
  applyStatusEffect,
  calcAVDelay,
  getAilmentAttackMultiplier,
  getSkillAilment,
  processStatusEffects,
  tryApplyAilment,
} from './StatusAilmentSystem';
import { calculatePartyTribeSynergy, type SynergyBonus } from './TribeSynergySystem';

/**
 * Necromance Brave Battle Engine
 * ターン制RPGの戦闘ロジック、ダメージ計算、リソース管理、WAVE進行を担当。
 */
export class BattleEngine {
  private state: BattleState;
  private logs: BattleLog[] = [];
  private masterData: MasterDataService;
  private synergyBonus: SynergyBonus;
  private playerInitialMaxHp: number;

  constructor(player: CharacterData, monsters: (MonsterData | null)[], areaGimmick: BattleState['areaGimmick'] = 'NONE') {
    this.state = {
      player,
      monsters,
      wave: 1,
      turn: 1,
      areaGimmick
    };
    this.masterData = MasterDataService.getInstance();
    this.synergyBonus = calculatePartyTribeSynergy(
      monsters.filter(Boolean) as MonsterData[]
    );
    this.playerInitialMaxHp = player.stats.hp;
  }

  /**
   * 戦闘シミュレーションを実行し、ログを返す。
   * フロントエンドでのアニメーション駆動に使用される。
   */
  public simulateAction(actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', target: MonsterData, skillId?: string): BattleLog[] {
    this.logs = [];
    const { player } = this.state;

    // 1. ターン開始時のエリアギミック判定 (GDD-006)
    this.processAreaGimmick();

    // 1.5. 種族シナジー: ターン開始時効果 (docs/設計書/18)
    this.applyTurnStartSynergy();

    // 2. 状態異常のターン開始処理 (docs/設計書/17)
    const playerStatus = this.processRuntimeStatus(player.name, player.stats, player.statusEffects);
    player.statusEffects = playerStatus.effects;
    if (playerStatus.skipAction) {
      this.addLog('STATUS_SKIP', player.name, player.name, `${player.name}は状態異常で行動できない。`);
      this.updateState();
      return this.logs;
    }

    // 3. プレイヤー行動 (GDD-003)
    this.processPlayerAction(actionType, target, skillId);

    // 4. 軍団の追撃・シナジー (GDD-005)
    this.processMonsterActions(target);

    // 5. ターン・WAVE更新 (GDD-002)
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

    // 3. 属性ダメージ加成（装備・残滓 + 種族シナジー）
    const equipElementBoost = (attackerElementBoosts[element] ?? 0) / 100;
    const sb = this.synergyBonus;
    let synergyElementPct = sb.elementDmgBonus ?? 0;
    if (element === 'DARK') synergyElementPct += sb.darkDmgBonus ?? 0;
    if (element === 'FIRE' || element === 'DARK') synergyElementPct += sb.fireDarkDmgBonus ?? 0;
    damage *= (1 + equipElementBoost + synergyElementPct / 100);

    // 4. 属性耐性
    let isWeakness = false;
    let isResisted = false;
    const resistance = defenderResistances[element] ?? 0;
    if (resistance < 0) isWeakness = true;
    if (resistance > 0) isResisted = true;
    damage *= (1 - resistance / 100);

    // 5. 会心判定（種族シナジーの critRate/critDmg ボーナスを加算）
    const effectiveCritRate = attackerStats.critRate + (sb.critRateBonus ?? 0);
    const isCritical = Math.random() * 100 < effectiveCritRate;
    if (isCritical) {
      damage *= (attackerStats.critDmg + (sb.critDmgBonus ?? 0)) / 100;
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
    const stats = {
      ...profile.total,
      atk: Math.floor(profile.total.atk * getAilmentAttackMultiplier(player.statusEffects, Boolean((player as any).isDemonMode))),
    };
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
    const shieldResult = this.applySpiritualShield(target, damage, element);
    if (shieldResult.didBreak) {
      player.currentEnergy = Math.min(player.maxEnergy, player.currentEnergy + 30);
    }

    let desc = `${player.name}の${actionName}！`;
    if (isWeakness) desc += ` 弱点を突いた！`;
    else if (isResisted) desc += ` 効果はいまひとつのようだ。`;
    if (shieldResult.wasShielded) {
      desc += shieldResult.didBreak
        ? ` 霊魂砕きが発生し、防壁が崩壊した！`
        : shieldResult.wasWeakShieldHit
          ? ` 霊的防壁を削った。`
          : ` 霊的防壁に阻まれた。`;
    }

    this.addLog(actionType, player.name, target.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, element, attackType);
    this.tryApplyActionAilment(player, target, skillId, element, attackType);
  }

  private tryApplyActionAilment(
    player: CharacterData,
    target: MonsterData,
    skillId: string | undefined,
    element: ElementType,
    attackType: SkillAttackType,
  ): void {
    const skillData = skillId ? this.masterData.getSkill(skillId) : null;
    const ailmentType = skillData
      ? getSkillAilment(skillData)
      : getSkillAilment({ type: 'PHYSICAL', element, attackType });
    if (!ailmentType) return;

    const profile = calculateCharacterStatProfile(player);
    const result = tryApplyAilment(
      ailmentType,
      {
        atk: profile.total.atk,
        effectHit: profile.total.effectHit + (this.synergyBonus.effectHitBonus ?? 0),
      },
      { effectRes: target.stats.effectRes },
      target.statusEffects,
      {
        baseRate: skillData?.ailmentBaseRate,
        immune: false,
        durationBonus: this.synergyBonus.ailmentDurationBonus,
      },
    );
    target.statusEffects = result.effects;

    if (result.applied) {
      this.addLog(
        'AILMENT_APPLY',
        player.name,
        target.name,
        `${target.name}に${this.getAilmentLabel(ailmentType)}を付与した。`,
        undefined,
        false,
        false,
        false,
        element,
        attackType,
        { ailmentApplied: ailmentType },
      );
    } else if (result.resisted) {
      this.addLog('AILMENT_RESIST', target.name, target.name, `${target.name}は${this.getAilmentLabel(ailmentType)}を抵抗した。`, undefined, false, false, true, element, attackType);
    }
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
      const shieldResult = this.applySpiritualShield(target, damage, 'NONE');
      const desc = shieldResult.wasShielded
        ? `${monster.name}の追撃！ 霊的防壁に阻まれた。`
        : `${monster.name}の追撃！`;
      this.addLog('MONSTER_ATTACK', monster.name, target.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, 'NONE', 'STRIKE');
    });
  }

  private applySpiritualShield(
    target: MonsterData,
    damage: number,
    element: ElementType
  ): { damage: number; wasShielded: boolean; wasWeakShieldHit: boolean; didBreak: boolean; remainingShield: number } {
    const currentShield = target.shieldHp ?? 0;
    const maxShield = target.maxShieldHp ?? target.shieldHp ?? 0;
    if (maxShield <= 0 || currentShield <= 0 || target.shieldBroken) {
      return { damage, wasShielded: false, wasWeakShieldHit: false, didBreak: false, remainingShield: 0 };
    }

    const wasWeakShieldHit = element !== 'NONE' && Boolean(target.weaknesses?.includes(element));
    if (!wasWeakShieldHit) {
      return {
        damage: Math.max(1, Math.floor(damage * 0.22)),
        wasShielded: true,
        wasWeakShieldHit: false,
        didBreak: false,
        remainingShield: currentShield,
      };
    }

    const shieldDamage = Math.max(1, Math.floor(damage * 0.75));
    const remainingShield = Math.max(0, currentShield - shieldDamage);
    target.shieldHp = remainingShield;
    target.maxShieldHp = maxShield;

    if (remainingShield <= 0) {
      target.shieldBroken = true;
      return {
        damage: Math.max(1, Math.floor(damage * 1.45)),
        wasShielded: true,
        wasWeakShieldHit: true,
        didBreak: true,
        remainingShield,
      };
    }

    return {
      damage: Math.max(1, Math.floor(damage * 0.72)),
      wasShielded: true,
      wasWeakShieldHit: true,
      didBreak: false,
      remainingShield,
    };
  }

  private processAreaGimmick(): void {
    const { areaGimmick, player } = this.state;
    if (areaGimmick === 'SLIP_DAMAGE') {
      const playerStats = this.getMutableStats(player);
      const rawDamage = Math.floor(playerStats.hp * 0.05);
      const damage = Math.floor(rawDamage * (1 - (this.synergyBonus.defenseReducePct ?? 0) / 100));
      playerStats.hp -= damage;
      this.addLog('GIMMICK', 'Area', player.name, `エリアギミック：スリップダメージにより${damage}ダメージ。`);
    }
    if (areaGimmick === 'STATUS_AILMENT') {
      if (Boolean((player as any).isDemonMode)) {
        this.addLog('GIMMICK', 'Area', player.name, '瘴気が襲うが、魔神化により状態異常を無効化した。');
        return;
      }
      player.statusEffects = applyStatusEffect(player.statusEffects, 'POISON', 0);
      this.addLog('GIMMICK', 'Area', player.name, '瘴気の沼が毒を刻んだ。', undefined, false, false, false, 'DARK', 'MAGIC', { ailmentApplied: 'POISON' });
    }
  }

  private applyTurnStartSynergy(): void {
    const { player } = this.state;
    const sb = this.synergyBonus;
    if (sb.hpRegenPct) {
      const regen = Math.floor(this.playerInitialMaxHp * sb.hpRegenPct / 100);
      const ms = this.getMutableStats(player);
      ms.hp = Math.min(this.playerInitialMaxHp, ms.hp + regen);
      this.addLog('SYNERGY_REGEN', 'SYNERGY', player.name,
        `種族シナジー：HP +${regen} 回復。`);
    }
    if (sb.energyPerTurn) {
      player.currentEnergy = Math.min(player.maxEnergy,
        player.currentEnergy + sb.energyPerTurn);
    }
    if (sb.demonGaugePerTurn) {
      this.addLog('SYNERGY_GAUGE', 'SYNERGY', player.name,
        `DRAGONシナジー：魔神化ゲージ +${sb.demonGaugePerTurn}。`);
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

  private processRuntimeStatus(
    targetName: string,
    targetStats: BaseStats,
    effects: StatusEffect[] | undefined,
  ): { effects: StatusEffect[]; skipAction: boolean } {
    const isPlayer = targetName === this.state.player.name;
    const result = processStatusEffects(
      effects,
      { maxHp: targetStats.hp },
      Math.random,
      isPlayer ? { immuneTypes: this.synergyBonus.ailmentImmune as AilmentType[] } : undefined,
    );
    if (result.totalDamage > 0) {
      targetStats.hp = Math.max(1, targetStats.hp - result.totalDamage);
    }
    result.ticks.forEach(tick => {
      if (tick.damage) {
        this.addLog(
          'AILMENT_TICK',
          targetName,
          targetName,
          `${targetName}は${this.getAilmentLabel(tick.type)}で${tick.damage}ダメージ。`,
          tick.damage,
          false,
          false,
          false,
          'NONE',
          'MAGIC',
          { ailmentTick: tick.type },
        );
      }
      if (tick.skipped) {
        this.addLog('AILMENT_SKIP', targetName, targetName, `${targetName}は${this.getAilmentLabel(tick.type)}で行動を阻害された。`, undefined, false, false, false, 'NONE', 'MAGIC', { ailmentTick: tick.type });
      }
      if (tick.expired) {
        this.addLog('AILMENT_CLEAR', targetName, targetName, `${targetName}の${this.getAilmentLabel(tick.type)}が解除された。`, undefined, false, false, false, 'NONE', 'MAGIC', { ailmentClearedBy: 'TURN_END' });
      }
    });
    return { effects: result.effects, skipAction: result.skipAction };
  }

  public calculateAVDelay(baseAVDelay: number, targetEffectRes: number): number {
    return calcAVDelay(baseAVDelay, targetEffectRes);
  }

  private getAilmentLabel(type: AilmentType): string {
    const labels: Record<AilmentType, string> = {
      BLEED: '出血',
      POISON: '毒',
      BURN: '燃焼',
      FREEZE: '凍結',
      PARALYSIS: '麻痺',
      WEAKEN: '衰弱',
    };
    return labels[type];
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
    attackType: SkillAttackType = 'SLASH',
    ailment?: Pick<BattleLog, 'ailmentApplied' | 'ailmentTick' | 'ailmentClearedBy'>
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
      ...ailment,
      playerEnergy: this.state.player.currentEnergy,
      playerMP: this.state.player.currentEnergy,
      playerHP: this.getMutableStats(this.state.player).hp,
      description
    });
  }
}
