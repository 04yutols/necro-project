import {
  CharacterData,
  MonsterData,
  BattleState,
  BattleLog,
  BaseStats,
  EnemyData,
  Resistances,
  ElementType,
  SkillAttackType,
  SkillData,
  AilmentType,
  StatusEffect,
  BossGimmick,
} from '../types/game';
import { MasterDataService } from '../services/MasterDataService';
import { calculateCharacterStatProfile, hasElementDmgBoosts } from './StatSystem';
import {
  calcAVDelay,
  getAilmentAttackMultiplier,
  getSkillAilment,
  processStatusEffects,
  tryApplyAilment,
} from './StatusAilmentSystem';
import { calculatePartyTribeSynergy, type SynergyBonus } from './TribeSynergySystem';
import { applyAreaGimmickToPlayer } from './AreaGimmickSystem';
import {
  type DemonRuntimeState,
  getDemonDamageMultiplier,
  getDemonActionHitCount,
  getDemonIncomingDamageMultiplier,
  isDemonStatusImmune,
  shouldBypassDefense,
  shouldIgnoreResistance,
  markDemonUltimateUsed,
  consumeDemonAction,
} from './DemonizationSystem';
import {
  evaluateWeaponPassive,
  type WeaponPassiveContext,
  type WeaponPassiveResult,
} from './WeaponPassive';
import { calculateBattleDamage, type BattleDamageResult } from './BattleDamage';
import {
  bossGimmickKey,
  findReviveGimmick,
  getReviveHp,
  resolveSummonMinionIds,
  shouldTriggerBossGimmick,
} from './BossGimmickSystem';
import { calculateMonsterAttackProfile } from './MonsterAttackSystem';
import { applyPlayerDamage as reducePlayerHp, isPlayerDead } from './PlayerDefeat';
import { getBaseAttackType } from './JobSystem';

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
  private monsterCurrentHp: Record<string, number> = {};
  private enemyCurrentHp: Record<string, number> = {};
  private firedGimmicks: Set<string> = new Set();
  private enemyMaxHp: Record<string, number> = {};
  private pendingSummons: string[] = [];
  private summonedEnemies: MonsterData[] = [];
  private activeEnemyCandidates: MonsterData[] = [];
  private summonSequence = 0;
  private demonState: DemonRuntimeState | null = null;
  private playerDefeatLogged = false;

  constructor(
    player: CharacterData,
    monsters: (MonsterData | null)[],
    areaGimmick: BattleState['areaGimmick'] = 'NONE',
    demonState?: DemonRuntimeState,
  ) {
    this.state = {
      player,
      monsters,
      wave: 1,
      turn: 1,
      areaGimmick,
      monsterCurrentHp: {},
      enemyCurrentHp: {},
      enemyMaxHp: {},
      pendingSummons: [],
      summonedEnemies: [],
    };
    this.masterData = MasterDataService.getInstance();
    this.synergyBonus = calculatePartyTribeSynergy(
      monsters.filter(Boolean) as MonsterData[]
    );
    this.playerInitialMaxHp = player.stats.hp;
    this.demonState = demonState ?? null;

    for (const m of monsters) {
      if (m) this.monsterCurrentHp[m.id] = m.stats.hp;
    }
    this.state.monsterCurrentHp = this.monsterCurrentHp;
    this.state.enemyCurrentHp = this.enemyCurrentHp;
    this.state.enemyMaxHp = this.enemyMaxHp;
    this.state.pendingSummons = this.pendingSummons;
    this.state.summonedEnemies = this.summonedEnemies;
  }

  /**
   * 戦闘シミュレーションを実行し、ログを返す。
   * フロントエンドでのアニメーション駆動に使用される。
   */
  public simulateAction(
    actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL',
    target: MonsterData,
    skillId?: string,
    enemyCandidates?: MonsterData[],
  ): BattleLog[] {
    this.logs = [];
    const { player } = this.state;
    const turnEnemies = this.resolveEnemyCandidates(target, enemyCandidates);
    this.activeEnemyCandidates = turnEnemies;

    // 1. ターン開始時のエリアギミック判定 (GDD-006)
    if (this.isPlayerDefeated()) {
      this.recordPlayerDefeat('SYSTEM', `${player.name}はすでに戦闘不能。`);
      return this.logs;
    }

    this.processAreaGimmick();
    if (this.isPlayerDefeated()) return this.logs;

    // 1.5. 種族シナジー: ターン開始時効果 (docs/設計書/18)
    this.applyTurnStartSynergy();

    // 2. 状態異常のターン開始処理 (docs/設計書/17)
    const isDemonActive = this.demonState?.isDemonMode ?? false;
    let playerActionSkipped = false;
    if (isDemonActive && isDemonStatusImmune(this.demonState!)) {
      // 魔神化中は状態異常をスキップ
    } else {
      const playerStatus = this.processRuntimeStatus(
        player.name,
        player.stats,
        player.statusEffects,
        this.playerInitialMaxHp,
      );
      player.statusEffects = playerStatus.effects;
      if (this.isPlayerDefeated()) return this.logs;
      if (playerStatus.skipAction) {
        playerActionSkipped = true;
        this.addLog('STATUS_SKIP', player.name, player.name, `${player.name}は状態異常で行動できない。`);
      }
    }

    // 3. プレイヤー行動 (GDD-003)
    if (!playerActionSkipped) {
      this.processPlayerAction(actionType, target, skillId, turnEnemies);
      if (this.isPlayerDefeated()) return this.logs;

      // 4. 軍団の追撃・シナジー (GDD-005)
      this.processMonsterActions(target, turnEnemies);
    }

    // 5. 敵の反撃 (docs/設計書/26)
    this.processEnemyCounterAttack(target);
    if (this.isPlayerDefeated()) return this.logs;

    // 6. ターン・WAVE更新 (GDD-002)
    this.updateState();

    return this.logs;
  }

  /**
   * 魔神技実行。通常アクションとは分離した専用フロー。
   */
  public simulateUltimateSkill(target: MonsterData): BattleLog[] {
    this.logs = [];
    const demon = this.demonState;
    if (!demon?.isDemonMode || !demon.form || demon.ultimateUsed) return this.logs;

    const { player } = this.state;
    if (this.isPlayerDefeated()) {
      this.recordPlayerDefeat('SYSTEM', `${player.name}はすでに戦闘不能。`);
      return this.logs;
    }

    const ult = demon.form.ultimateSkill;
    const profile = calculateCharacterStatProfile(player);
    const stats = profile.total;
    const elementBoosts = hasElementDmgBoosts(player.elementDmgBoosts)
      ? player.elementDmgBoosts
      : profile.elementDmgBoosts;

    const ignoreDef = shouldBypassDefense(demon.form);

    const isAoe = ult.damage.targetType === 'ALL';
    const targets: MonsterData[] = isAoe
      ? (this.state.monsters.filter(Boolean) as MonsterData[])
      : [target];

    for (const t of targets) {
      const defStats = ignoreDef ? { ...t.stats, def: 0 } : t.stats;
      const resistances = ult.damage.flags?.includes('IGNORE_RESISTANCE') ? {} : (t.resistances ?? {});
      const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(
        stats,
        elementBoosts,
        defStats,
        resistances,
        ult.damage.power,
        ult.damage.element,
      );
      const shieldResult = this.applySpiritualShield(t, damage, ult.damage.element);

      this.applyDamageToEnemy(t, shieldResult.damage);

      this.addLog(
        'DEMON_ULTIMATE',
        player.name,
        t.name,
        `【魔神技】${demon.form.formName}の奥義「${ult.nameJa}」！`,
        shieldResult.damage,
        isCritical,
        isWeakness,
        isResisted,
        ult.damage.element,
        'MAGIC',
      );
    }

    this.addLog(
      'DEMON_LINGERING',
      player.name,
      'FIELD',
      `【残留】${ult.lingering.descJa}（${ult.lingering.duration === -1 ? 'バトル終了まで' : `${ult.lingering.duration}ターン`}）`,
    );

    this.demonState = markDemonUltimateUsed(demon);
    this.processEnemyCounterAttack(target);
    if (this.isPlayerDefeated()) return this.logs;
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
  ): BattleDamageResult {
    return calculateBattleDamage({
      attackerStats,
      attackerElementBoosts,
      defenderStats,
      defenderResistances,
      powerMultiplier,
      element,
      synergyBonus: this.synergyBonus,
    });
  }

  private processPlayerAction(
    actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL',
    target: MonsterData,
    skillId?: string,
    enemyCandidates: MonsterData[] = [target],
  ): void {
    const { player } = this.state;
    const profile = calculateCharacterStatProfile(player);
    const isDemonActive = this.demonState?.isDemonMode ?? false;
    const stats = {
      ...profile.total,
      atk: Math.floor(profile.total.atk * getAilmentAttackMultiplier(player.statusEffects, isDemonActive)),
    };
    const elementBoosts = hasElementDmgBoosts(player.elementDmgBoosts)
      ? player.elementDmgBoosts
      : profile.elementDmgBoosts;

    let energyCost = 0;
    let power = 1.0;
    let actionName = '攻撃';
    let element: ElementType = 'NONE';
    let attackType: SkillAttackType = 'SLASH';
    const currentJob = this.masterData.getJob(player.currentJobId);
    const baseAttackType = getBaseAttackType(currentJob);
    let skillData: SkillData | undefined;

    if (actionType === 'PHYSICAL_ATTACK') {
      energyCost = 0;
      attackType = baseAttackType;
    } else if (actionType === 'MAGIC_SKILL' && skillId) {
      skillData = this.masterData.getSkill(skillId);
      if (skillData) {
        energyCost = skillData.mpCost;
        power = skillData.power;
        actionName = skillData.name;
        if (skillData.element) element = skillData.element;
        attackType = skillData.attackType ?? (skillData.type === 'MAGICAL' ? 'MAGIC' : 'SLASH');
      }
    } else {
      energyCost = 0;
      attackType = baseAttackType;
    }

    // ── 魔神化バフ ──────────────────────────────────
    const demon = this.demonState;
    const demonDmgMult = getDemonDamageMultiplier(demon?.form ?? null, attackType);
    const hitCount = getDemonActionHitCount(demon?.form ?? null, attackType);
    const ignoreRes = shouldIgnoreResistance(demon?.form ?? null);
    const ignoreDef = shouldBypassDefense(demon?.form ?? null);

    // ENERGY_DRAIN: スキルコスト2倍
    let totalEnergyCost = energyCost;
    if (isDemonActive && demon!.form?.effectB.riskType === 'ENERGY_DRAIN' && energyCost > 0) {
      const drainCost = energyCost * 2;
      totalEnergyCost = player.currentEnergy >= drainCost ? drainCost : energyCost;
    }

    if (player.currentEnergy < totalEnergyCost) {
      this.addLog('NO_ENERGY', player.name, target.name, `MPが不足しています！（必要: ${totalEnergyCost}）`);
      return;
    }

    // MP消費。通常攻撃やスキル使用による暗黙回復は行わない。
    player.currentEnergy = Math.max(0, player.currentEnergy - totalEnergyCost);

    // 魔神化ゲージ充填（MPとは別リソース）
    const gaugeGain = actionType === 'PHYSICAL_ATTACK' ? 10 : 5;
    this.addDemonGauge(gaugeGain);

    const actionTargets = this.resolvePlayerActionTargets(target, skillData, enemyCandidates);

    for (const currentTarget of actionTargets) {
      // ── ダメージ計算（hitCount 回ループ）────────────
      let totalDamage = 0;
      let isCritical = false;
      let isWeakness = false;
      let isResisted = false;

      for (let hit = 0; hit < hitCount; hit++) {
        const resistances = ignoreRes ? {} : (currentTarget.resistances ?? {});
        const defStats = ignoreDef ? { ...currentTarget.stats, def: 0 } : currentTarget.stats;
        const result = this.calculateDamage(
          { ...stats, atk: Math.floor(stats.atk * demonDmgMult) },
          elementBoosts,
          defStats,
          resistances,
          power,
          element,
        );
        totalDamage += result.damage;
        if (result.isCritical) this.addDemonGauge(5); // 会心時ボーナス
        isCritical = isCritical || result.isCritical;
        isWeakness = isWeakness || result.isWeakness;
        isResisted = isResisted || result.isResisted;
      }

      const shieldResult = this.applySpiritualShield(currentTarget, totalDamage, element);
      if (shieldResult.didBreak) {
        this.addDemonGauge(20); // 霊魂砕きボーナス
      }

      // HP 変化 + ボスギミックチェック
      const hpChange = this.applyDamageToEnemy(currentTarget, shieldResult.damage);
      this.checkBossGimmicks(currentTarget, hpChange.prevHpPct, hpChange.newHpPct);
      const actualHpDamage = Math.max(0, hpChange.prevHp - hpChange.nextHp);

      if (hpChange.nextHp <= 0) {
        const reviveGimmick = findReviveGimmick(currentTarget.gimmicks, currentTarget.id, this.firedGimmicks);
        if (reviveGimmick) {
          this.firedGimmicks.add(bossGimmickKey(currentTarget.id, reviveGimmick));
          this.applyBossGimmickEffect(currentTarget, reviveGimmick);
        }
      }

      let desc = `${player.name}の${actionName}！`;
      if (skillData?.targetType === 'ALL_ENEMIES') desc += ` 敵全体を巻き込んだ。`;
      if (hitCount > 1) desc += ` ${hitCount}ヒット！`;
      if (isWeakness) desc += ` 弱点を突いた！`;
      else if (isResisted) desc += ` 効果はいまひとつのようだ。`;
      if (shieldResult.wasShielded) {
        desc += shieldResult.didBreak
          ? ` 霊魂砕きが発生し、防壁が崩壊した！`
          : shieldResult.wasWeakShieldHit
            ? ` 霊的防壁を削った。`
            : ` 霊的防壁に阻まれた。`;
      }

      this.addLog(actionType, player.name, currentTarget.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, element, attackType);
      this.applySkillSelfHeal(skillData, actualHpDamage);
      this.tryApplyActionAilment(player, currentTarget, skillId, element, attackType);

      // 武器パッシブ
      const weapon = player.equipment?.weapon;
      if (weapon) {
        for (const passive of [weapon.passiveA, weapon.passiveB]) {
          if (!passive) continue;
          const attackCtx: WeaponPassiveContext = {
            trigger: 'ON_ATTACK',
            actor: player,
            target: currentTarget,
            isCritical,
            didBreakShield: shieldResult.didBreak,
            isDemonMode: this.demonState?.isDemonMode ?? false,
          };
          const passiveResult = evaluateWeaponPassive(passive, attackCtx);
          if (passiveResult) this.applyPassiveResult(passiveResult, player, currentTarget);

          if (shieldResult.didBreak) {
            const shieldCtx: WeaponPassiveContext = { ...attackCtx, trigger: 'ON_SHIELD_BREAK' };
            const shieldPassiveResult = evaluateWeaponPassive(passive, shieldCtx);
            if (shieldPassiveResult) this.applyPassiveResult(shieldPassiveResult, player, currentTarget);
          }
        }
      }
    }

    // SELF_DAMAGE リスク: 攻撃後に HP を削る
    if (isDemonActive && demon!.form?.effectB.riskType === 'SELF_DAMAGE') {
      const selfDmgPct = demon!.form.effectB.riskValue ?? 10;
      const selfDmg = Math.floor(this.playerInitialMaxHp * selfDmgPct / 100);
      this.applyDamageToPlayer(selfDmg);
      this.addLog('DEMON_SELF_DAMAGE', player.name, player.name,
        `【深淵の理】魔神化の代償で ${selfDmg} の反動ダメージ！`);
      this.recordPlayerDefeat(player.name, `${player.name}は魔神化の反動に呑まれた。`);
    }

    // 魔神化行動消費
    if (isDemonActive && this.demonState) {
      this.demonState = consumeDemonAction(this.demonState);
    }
  }

  private resolvePlayerActionTargets(
    primaryTarget: MonsterData,
    skillData: SkillData | undefined,
    enemyCandidates: MonsterData[],
  ): MonsterData[] {
    if (skillData?.targetType !== 'ALL_ENEMIES') return [primaryTarget];

    const uniqueTargets = this.resolveEnemyCandidates(primaryTarget, enemyCandidates);
    const aliveTargets = uniqueTargets.filter(enemy => this.getEnemyRuntimeHp(enemy) > 0);
    return aliveTargets.length > 0 ? aliveTargets : [primaryTarget];
  }

  private applySkillSelfHeal(skillData: SkillData | undefined, damageDealt: number): void {
    const healSelfPct = skillData?.healSelfPct ?? 0;
    if (healSelfPct <= 0 || damageDealt <= 0) return;

    const healAmount = Math.floor(damageDealt * healSelfPct / 100);
    if (healAmount <= 0) return;

    const { player } = this.state;
    const playerStats = this.getMutableStats(player);
    const prevHp = playerStats.hp;
    playerStats.hp = Math.min(this.playerInitialMaxHp, playerStats.hp + healAmount);
    const actualHeal = playerStats.hp - prevHp;
    if (actualHeal <= 0) return;

    this.addLog(
      'HEAL',
      player.name,
      player.name,
      `${skillData?.name ?? '吸収'}：HP +${actualHeal} 回復。`,
      actualHeal,
      false,
      false,
      false,
      'NONE',
      'HEAL',
    );
  }

  private applyPassiveResult(
    result: WeaponPassiveResult,
    player: CharacterData,
    target: MonsterData,
  ): void {
    if (result.bonusDamage) {
      this.applyDamageToEnemy(target, result.bonusDamage);
    }
    if (result.demonGaugeDelta) {
      this.addDemonGauge(result.demonGaugeDelta);
      this.addLog('PASSIVE_DEMON_GAUGE', player.name, player.name,
        result.logDesc ?? '', undefined, false, false, false, 'NONE', 'MAGIC');
    } else if (result.avReduction) {
      this.addLog('PASSIVE_AV_BOOST', player.name, player.name,
        result.logDesc ?? '', undefined, false, false, false, 'NONE', 'MAGIC');
    } else if (result.logDesc) {
      this.addLog('PASSIVE_TRIGGER', player.name, target.name,
        result.logDesc, result.bonusDamage, false, false, false, 'NONE', 'MAGIC');
    }
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

  private processMonsterActions(preferredTarget: MonsterData, enemyCandidates: MonsterData[] = [preferredTarget]): void {
    const { player, monsters } = this.state;

    let followUpIndex = 0;
    monsters.forEach(monster => {
      if (!monster) return;
      const target = this.selectFollowUpTarget(preferredTarget, enemyCandidates, followUpIndex);
      if (!target) return;
      followUpIndex += 1;

      const attackProfile = calculateMonsterAttackProfile(monster, { awakened: player.isAwakened });
      const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(
        attackProfile.stats,
        {},
        target.stats,
        target.resistances,
        1.0,
        attackProfile.element,
      );
      const shieldResult = this.applySpiritualShield(target, damage, attackProfile.element);

      this.applyDamageToEnemy(target, shieldResult.damage);

      const desc = shieldResult.wasShielded
        ? `${monster.name}の追撃！ 霊的防壁に阻まれた。`
        : `${monster.name}の追撃！${attackProfile.spiritCoreName ? ` 霊核「${attackProfile.spiritCoreName}」が共鳴。` : ''}`;
      this.addLog('MONSTER_ATTACK', monster.name, target.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, attackProfile.element, 'STRIKE');
    });
  }

  private resolveEnemyCandidates(primaryTarget: MonsterData, enemyCandidates?: MonsterData[]): MonsterData[] {
    const candidatesById = new Map<string, MonsterData>();
    candidatesById.set(primaryTarget.id, primaryTarget);
    for (const enemy of enemyCandidates ?? []) {
      candidatesById.set(enemy.id, enemy);
    }
    for (const enemy of this.summonedEnemies) {
      candidatesById.set(enemy.id, enemy);
    }
    return Array.from(candidatesById.values());
  }

  private getOrderedAliveFollowUpTargets(preferredTarget: MonsterData, enemyCandidates: MonsterData[]): MonsterData[] {
    const aliveCandidates = enemyCandidates.filter(enemy => this.getEnemyRuntimeHp(enemy) > 0);
    const preferred = aliveCandidates.find(enemy => enemy.id === preferredTarget.id);
    if (!preferred) return aliveCandidates;
    return [
      preferred,
      ...aliveCandidates.filter(enemy => enemy.id !== preferredTarget.id),
    ];
  }

  private selectFollowUpTarget(
    preferredTarget: MonsterData,
    enemyCandidates: MonsterData[],
    followUpIndex: number,
  ): MonsterData | null {
    const aliveTargets = this.getOrderedAliveFollowUpTargets(preferredTarget, enemyCandidates);
    if (aliveTargets.length === 0) return null;
    return aliveTargets[followUpIndex % aliveTargets.length];
  }

  /**
   * 敵の反撃フェーズ: 隊列ヘイト重みで味方モンスターを選び攻撃する。
   */
  private processEnemyCounterAttack(enemy: MonsterData): void {
    const { player } = this.state;
    const monsterTarget = this.selectEnemyTarget();

    if (monsterTarget) {
      const rawDmg = Math.max(1, Math.floor(
        enemy.stats.atk * (1 - monsterTarget.stats.def / (monsterTarget.stats.def + 200))
      ));
      const sb = this.synergyBonus;
      const absorbed = sb.absorbDmgPct
        ? Math.floor(rawDmg * sb.absorbDmgPct / 100)
        : 0;
      const finalDmg = Math.max(1, rawDmg - absorbed);

      this.monsterCurrentHp[monsterTarget.id] = Math.max(
        0,
        (this.monsterCurrentHp[monsterTarget.id] ?? monsterTarget.stats.hp) - finalDmg
      );
      this.state.monsterCurrentHp = this.monsterCurrentHp;

      const isDead = this.monsterCurrentHp[monsterTarget.id] <= 0;
      const desc = isDead
        ? `${enemy.name}の攻撃！ ${monsterTarget.name}は倒れた！`
        : `${enemy.name}の攻撃！ ${monsterTarget.name}に${finalDmg}ダメージ${absorbed > 0 ? `（${absorbed}吸収）` : ''}。`;

      this.addLog('ENEMY_ATTACK', enemy.name, monsterTarget.name, desc, finalDmg);
    } else {
      // モンスター全滅 → アルドが直接受ける
      const playerProfile = calculateCharacterStatProfile(player);
      const incomingMult = getDemonIncomingDamageMultiplier(this.demonState?.form ?? null);
      const rawDmg = Math.max(1, Math.floor(
        enemy.stats.atk * (1 - playerProfile.total.def / (playerProfile.total.def + 200)) * incomingMult
      ));
      const nextHp = this.applyDamageToPlayer(rawDmg);
      this.addLog('ENEMY_ATTACK', enemy.name, player.name,
        isPlayerDead(nextHp)
          ? `${enemy.name}の攻撃！ ${player.name}は倒れた！`
          : `${enemy.name}の攻撃！ アルドに${rawDmg}ダメージ。`,
        rawDmg);
      this.recordPlayerDefeat(enemy.name, `${player.name}は倒れた。`);
    }
  }

  /**
   * 生存モンスターから隊列ヘイト重みで重み付き抽選する。
   * slot 0 = 50%, slot 1 = 30%, slot 2 = 20%
   */
  private selectEnemyTarget(): MonsterData | null {
    const HATE_WEIGHTS = [50, 30, 20] as const;
    const { monsters } = this.state;

    const aliveMonsters = monsters
      .map((m, idx) => m ? { monster: m, idx } : null)
      .filter((x): x is { monster: MonsterData; idx: number } =>
        x !== null && (this.monsterCurrentHp[x.monster.id] ?? 0) > 0
      );

    if (aliveMonsters.length === 0) return null;

    const totalWeight = aliveMonsters.reduce(
      (sum, { idx }) => sum + (HATE_WEIGHTS[idx] ?? 20), 0
    );
    let rand = Math.random() * totalWeight;
    for (const { monster, idx } of aliveMonsters) {
      rand -= HATE_WEIGHTS[idx] ?? 20;
      if (rand <= 0) return monster;
    }
    return aliveMonsters[aliveMonsters.length - 1].monster;
  }

  /**
   * ボスギミック発動チェック。HP変化後に呼ぶ。
   */
  private checkBossGimmicks(
    boss: MonsterData,
    prevHpPct: number,
    newHpPct: number,
  ): void {
    if (!boss.gimmicks) return;

    for (const g of boss.gimmicks) {
      const key = `${boss.id}:${g.trigger}:${g.effect}`;
      if (this.firedGimmicks.has(key)) continue;

      const shouldFire = shouldTriggerBossGimmick(g, {
        prevHpPct,
        newHpPct,
        turn: this.state.turn,
        shieldBroken: boss.shieldBroken,
      });

      if (!shouldFire) continue;
      this.firedGimmicks.add(key);
      this.applyBossGimmickEffect(boss, g);
    }
  }

  private applyBossGimmickEffect(boss: MonsterData, g: BossGimmick): void {
    const { player } = this.state;

    switch (g.effect) {
      case 'ENRAGE':
        boss.stats = { ...boss.stats, atk: Math.floor(boss.stats.atk * 1.5) };
        this.addLog('BOSS_ENRAGE', boss.name, boss.name,
          `【ENRAGE】${boss.name}が激怒した！ 攻撃力が大幅に上昇する！`);
        break;

      case 'AV_DELAY': {
        const turns = g.value ?? 1;
        const delayedEffect: StatusEffect = {
          type: 'PARALYSIS',
          remainingTurns: turns,
          stackCount: 1,
        };
        player.statusEffects = [...(player.statusEffects ?? []), delayedEffect];
        this.addLog('BOSS_AV_DELAY', boss.name, player.name,
          `【AV遅延】${boss.name}の特殊攻撃！ アルドの行動が${turns}ターン遅延する！`);
        break;
      }

      case 'REVIVE':
        this.setEnemyCurrentHp(boss, getReviveHp(this.getEnemyMaxHp(boss), g));
        boss.shieldBroken = false;
        boss.shieldHp = boss.maxShieldHp ?? 0;
        for (const g2 of boss.gimmicks ?? []) {
          if (g2.trigger === 'ON_REVIVE') {
            this.firedGimmicks.delete(bossGimmickKey(boss.id, g2));
          }
        }
        this.addLog('BOSS_REVIVE', boss.name, boss.name,
          `【REVIVE】${boss.name}が第2形態に移行した！ HPが回復し、防壁が再生する！`);
        break;

      case 'SUMMON_MINIONS':
        this.applySummonMinions(boss, g);
        break;
    }
  }

  private applySummonMinions(boss: MonsterData, g: BossGimmick): void {
    const aliveCount = this.activeEnemyCandidates.filter(enemy => this.getEnemyRuntimeHp(enemy) > 0).length;
    const availableSlots = Math.max(0, 3 - aliveCount);
    const minionSourceIds = resolveSummonMinionIds(boss.id, g.value, availableSlots);

    if (minionSourceIds.length === 0) {
      this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
        `【召喚】${boss.name}が手下を呼ぶが、戦場は既に満ちている。`);
      return;
    }

    const summoned = minionSourceIds
      .map(sourceId => this.createSummonedEnemy(sourceId, boss))
      .filter((enemy): enemy is MonsterData => Boolean(enemy));

    if (summoned.length === 0) {
      this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
        `【召喚】${boss.name}が手下を呼ぶが、召喚対象を解決できない。`);
      return;
    }

    for (const enemy of summoned) {
      this.summonedEnemies.push(enemy);
      this.activeEnemyCandidates.push(enemy);
      this.ensureEnemyRuntimeHp(enemy);
    }
    this.pendingSummons.push(...summoned.map(enemy => enemy.id));
    this.state.summonedEnemies = this.summonedEnemies;
    this.state.pendingSummons = this.pendingSummons;

    this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
      `【召喚】${boss.name}が${summoned.map(enemy => enemy.name).join(' / ')}を呼び出した！`);
  }

  private createSummonedEnemy(sourceId: string, boss: MonsterData): MonsterData | null {
    const enemy = this.masterData.getEnemy(sourceId);
    if (!enemy) return null;

    const runtimeId = `${boss.id}:summon:${sourceId}:${this.summonSequence++}`;
    return this.enemyDataToMonster(enemy, runtimeId);
  }

  private enemyDataToMonster(enemy: EnemyData, runtimeId: string): MonsterData {
    return {
      id: runtimeId,
      name: enemy.nameJa ?? enemy.name,
      tribe: enemy.tribe,
      cost: 0,
      tier: enemy.tier,
      stats: { ...enemy.stats },
      resistances: { ...enemy.resistances },
      weaknesses: [...enemy.weaknesses],
      shieldHp: enemy.shieldHp,
      maxShieldHp: enemy.maxShieldHp,
      shieldBroken: (enemy.shieldHp ?? 0) <= 0,
      gimmicks: enemy.gimmicks ? enemy.gimmicks.map(gimmick => ({ ...gimmick })) : undefined,
      statusEffects: [],
    };
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
    const shieldDamage = Math.max(1, Math.floor(damage));
    const remainingShield = Math.max(0, currentShield - shieldDamage);
    target.shieldHp = remainingShield;
    target.maxShieldHp = maxShield;

    if (!wasWeakShieldHit) {
      if (remainingShield <= 0) {
        target.shieldBroken = true;
        return {
          damage: Math.max(1, Math.floor(damage * 0.72)),
          wasShielded: true,
          wasWeakShieldHit: false,
          didBreak: true,
          remainingShield,
        };
      }

      return {
        damage: Math.max(1, Math.floor(damage * 0.22)),
        wasShielded: true,
        wasWeakShieldHit: false,
        didBreak: false,
        remainingShield,
      };
    }

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
    const playerStats = this.getMutableStats(player);
    const result = applyAreaGimmickToPlayer({
      areaGimmick,
      currentHp: playerStats.hp,
      maxHp: this.playerInitialMaxHp,
      statusEffects: player.statusEffects,
      isDemonMode: this.demonState?.isDemonMode ?? false,
      defenseReducePct: this.synergyBonus.defenseReducePct,
    });

    if (result.areaGimmick === 'SLIP_DAMAGE') {
      playerStats.hp = result.nextHp;
      this.addLog('GIMMICK', 'Area', player.name, `エリアギミック：スリップダメージにより${result.damage}ダメージ。`);
      this.recordPlayerDefeat('Area', `${player.name}はエリアギミックに呑まれた。`);
    }
    if (result.areaGimmick === 'STATUS_AILMENT') {
      if (result.immune) {
        this.addLog('GIMMICK', 'Area', player.name, '瘴気が襲うが、魔神化により状態異常を無効化した。');
        return;
      }
      player.statusEffects = result.statusEffects;
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
    if (sb.demonGaugePerTurn) {
      this.addDemonGauge(sb.demonGaugePerTurn);
      this.addLog('SYNERGY_GAUGE', 'SYNERGY', player.name,
        `DRAGONシナジー：魔神化ゲージ +${sb.demonGaugePerTurn}。`);
    }
  }

  private addDemonGauge(amount: number): void {
    if (!this.demonState || this.demonState.isDemonMode) return;
    this.demonState = {
      ...this.demonState,
      gauge: Math.min(100, this.demonState.gauge + amount),
    };
  }

  getDemonGauge(): number {
    return this.demonState?.gauge ?? 0;
  }

  public getPendingSummons(): string[] {
    return [...this.pendingSummons];
  }

  public consumePendingSummons(): string[] {
    const pending = [...this.pendingSummons];
    this.pendingSummons = [];
    this.state.pendingSummons = this.pendingSummons;
    return pending;
  }

  public getSummonedEnemies(): MonsterData[] {
    return this.summonedEnemies.map(enemy => ({
      ...enemy,
      stats: { ...enemy.stats },
      resistances: { ...enemy.resistances },
      weaknesses: enemy.weaknesses ? [...enemy.weaknesses] : undefined,
      gimmicks: enemy.gimmicks ? enemy.gimmicks.map(gimmick => ({ ...gimmick })) : undefined,
      statusEffects: enemy.statusEffects ? enemy.statusEffects.map(effect => ({
        ...effect,
        stacks: effect.stacks ? effect.stacks.map(stack => ({ ...stack })) : undefined,
      })) : undefined,
    }));
  }

  public getEnemyCurrentHp(enemyId: string): number | undefined {
    return this.enemyCurrentHp[enemyId];
  }

  private ensureEnemyRuntimeHp(enemy: MonsterData): void {
    if (this.enemyMaxHp[enemy.id] === undefined) {
      this.enemyMaxHp[enemy.id] = enemy.stats.hp;
    }
    if (this.enemyCurrentHp[enemy.id] === undefined) {
      this.enemyCurrentHp[enemy.id] = enemy.stats.hp;
    }
    this.state.enemyCurrentHp = this.enemyCurrentHp;
    this.state.enemyMaxHp = this.enemyMaxHp;
  }

  private getEnemyMaxHp(enemy: MonsterData): number {
    this.ensureEnemyRuntimeHp(enemy);
    return this.enemyMaxHp[enemy.id] ?? enemy.stats.hp;
  }

  private getEnemyRuntimeHp(enemy: MonsterData): number {
    this.ensureEnemyRuntimeHp(enemy);
    return this.enemyCurrentHp[enemy.id] ?? enemy.stats.hp;
  }

  private setEnemyCurrentHp(enemy: MonsterData, hp: number): number {
    this.ensureEnemyRuntimeHp(enemy);
    const maxHp = this.getEnemyMaxHp(enemy);
    const nextHp = Math.max(0, Math.min(maxHp, Math.floor(hp)));
    this.enemyCurrentHp[enemy.id] = nextHp;
    this.state.enemyCurrentHp = this.enemyCurrentHp;
    return nextHp;
  }

  private applyDamageToEnemy(
    enemy: MonsterData,
    damage: number,
  ): { prevHp: number; nextHp: number; maxHp: number; prevHpPct: number; newHpPct: number } {
    const maxHp = this.getEnemyMaxHp(enemy);
    const prevHp = this.getEnemyRuntimeHp(enemy);
    const nextHp = this.setEnemyCurrentHp(enemy, prevHp - Math.max(0, Math.floor(damage)));
    return {
      prevHp,
      nextHp,
      maxHp,
      prevHpPct: maxHp > 0 ? (prevHp / maxHp) * 100 : 100,
      newHpPct: maxHp > 0 ? (nextHp / maxHp) * 100 : 0,
    };
  }

  private getMutableStats(player: CharacterData): BaseStats {
    return player.stats;
  }

  private applyDamageToPlayer(damage: number): number {
    const playerStats = this.getMutableStats(this.state.player);
    playerStats.hp = reducePlayerHp(playerStats.hp, Math.max(0, damage));
    return playerStats.hp;
  }

  private isPlayerDefeated(): boolean {
    return isPlayerDead(this.getMutableStats(this.state.player).hp);
  }

  private recordPlayerDefeat(actorName: string, description: string): void {
    if (this.playerDefeatLogged || !this.isPlayerDefeated()) return;
    this.playerDefeatLogged = true;
    this.addLog('PLAYER_DEFEATED', actorName, this.state.player.name, description);
  }

  private updateState(): void {
    this.state.turn++;
    if (this.state.turn > 10) {
      this.state.wave = Math.min(3, this.state.wave + 1);
      this.state.turn = 1;
    }
  }

  private processRuntimeStatus(
    targetName: string,
    targetStats: BaseStats,
    effects: StatusEffect[] | undefined,
    targetMaxHp: number,
  ): { effects: StatusEffect[]; skipAction: boolean } {
    const isPlayer = targetName === this.state.player.name;
    const result = processStatusEffects(
      effects,
      { maxHp: targetMaxHp },
      Math.random,
      isPlayer ? { immuneTypes: this.synergyBonus.ailmentImmune as AilmentType[] } : undefined,
    );
    if (result.totalDamage > 0) {
      if (isPlayer) {
        targetStats.hp = reducePlayerHp(targetStats.hp, result.totalDamage);
      } else {
        targetStats.hp = Math.max(0, targetStats.hp - result.totalDamage);
      }
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
    if (isPlayer) {
      this.recordPlayerDefeat('STATUS', `${targetName}は状態異常に蝕まれて倒れた。`);
    }
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
      playerSp: this.state.player.currentEnergy,
      playerDemonGauge: this.demonState?.gauge ?? 0,
      playerHP: this.getMutableStats(this.state.player).hp,
      description
    });
  }
}
