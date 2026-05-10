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
  StatusEffect,
  BossGimmick,
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
  private firedGimmicks: Set<string> = new Set();
  private enemyMaxHp: Record<string, number> = {};
  private demonState: DemonRuntimeState | null = null;

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
  }

  /**
   * 戦闘シミュレーションを実行し、ログを返す。
   * フロントエンドでのアニメーション駆動に使用される。
   */
  public simulateAction(
    actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL',
    target: MonsterData,
    skillId?: string,
  ): BattleLog[] {
    this.logs = [];
    const { player } = this.state;

    // 1. ターン開始時のエリアギミック判定 (GDD-006)
    this.processAreaGimmick();

    // 1.5. 種族シナジー: ターン開始時効果 (docs/設計書/18)
    this.applyTurnStartSynergy();

    // 2. 状態異常のターン開始処理 (docs/設計書/17)
    const isDemonActive = this.demonState?.isDemonMode ?? false;
    if (isDemonActive && isDemonStatusImmune(this.demonState!)) {
      // 魔神化中は状態異常をスキップ
    } else {
      const playerStatus = this.processRuntimeStatus(player.name, player.stats, player.statusEffects);
      player.statusEffects = playerStatus.effects;
      if (playerStatus.skipAction) {
        this.addLog('STATUS_SKIP', player.name, player.name, `${player.name}は状態異常で行動できない。`);
        this.updateState();
        return this.logs;
      }
    }

    // 3. プレイヤー行動 (GDD-003)
    this.processPlayerAction(actionType, target, skillId);

    // 4. 軍団の追撃・シナジー (GDD-005)
    this.processMonsterActions(target);

    // 5. 敵の反撃 (docs/設計書/26)
    this.processEnemyCounterAttack(target);

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
    const ult = demon.form.ultimateSkill;
    const stats = calculateCharacterStatProfile(player).total;

    const ignoreDef = shouldBypassDefense(demon.form);
    const defStats = ignoreDef ? { ...target.stats, def: 0 } : target.stats;

    const isAoe = ult.damage.targetType === 'ALL';
    const targets: MonsterData[] = isAoe
      ? (this.state.monsters.filter(Boolean) as MonsterData[])
      : [target];

    for (const t of targets) {
      const resistances = ult.damage.flags?.includes('IGNORE_RESISTANCE') ? {} : (t.resistances ?? {});
      const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(
        stats,
        player.elementDmgBoosts ?? {},
        defStats,
        resistances,
        ult.damage.power,
        ult.damage.element,
      );
      const shieldResult = this.applySpiritualShield(t, damage, ult.damage.element);

      this.enemyMaxHp[t.id] = this.enemyMaxHp[t.id] ?? t.stats.hp;
      t.stats.hp = Math.max(0, t.stats.hp - shieldResult.damage);

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

  private processPlayerAction(
    actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL',
    target: MonsterData,
    skillId?: string,
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
    let energyGain = 20;
    let skillData = null;

    if (actionType === 'PHYSICAL_ATTACK') {
      energyCost = 0;
      attackType = 'SLASH';
    } else if (actionType === 'MAGIC_SKILL' && skillId) {
      skillData = this.masterData.getSkill(skillId);
      if (skillData) {
        energyCost = skillData.mpCost;
        power = skillData.power;
        actionName = skillData.name;
        if (skillData.element) element = skillData.element;
        attackType = skillData.attackType ?? (skillData.type === 'MAGICAL' ? 'MAGIC' : 'SLASH');
        energyGain = skillData.isUltimate ? 0 : 15;
      }
    } else {
      energyCost = 0;
      attackType = 'SLASH';
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
      this.addLog('NO_ENERGY', player.name, target.name, `エネルギーが不足しています！（必要: ${totalEnergyCost}）`);
      return;
    }

    // エネルギー消費・獲得
    player.currentEnergy = Math.min(player.maxEnergy, Math.max(0, player.currentEnergy - totalEnergyCost + energyGain));

    // ── ダメージ計算（hitCount 回ループ）────────────
    let totalDamage = 0;
    let isCritical = false;
    let isWeakness = false;
    let isResisted = false;

    for (let hit = 0; hit < hitCount; hit++) {
      const resistances = ignoreRes ? {} : (target.resistances ?? {});
      const defStats = ignoreDef ? { ...target.stats, def: 0 } : target.stats;
      const result = this.calculateDamage(
        { ...stats, atk: Math.floor(stats.atk * demonDmgMult) },
        elementBoosts,
        defStats,
        resistances,
        power,
        element,
      );
      totalDamage += result.damage;
      isCritical = isCritical || result.isCritical;
      isWeakness = isWeakness || result.isWeakness;
      isResisted = isResisted || result.isResisted;
    }

    const shieldResult = this.applySpiritualShield(target, totalDamage, element);
    if (shieldResult.didBreak) {
      player.currentEnergy = Math.min(player.maxEnergy, player.currentEnergy + 30);
    }

    // HP 変化 + ボスギミックチェック
    this.enemyMaxHp[target.id] = this.enemyMaxHp[target.id] ?? target.stats.hp;
    const maxHp = this.enemyMaxHp[target.id];
    const prevHpPct = maxHp > 0 ? (target.stats.hp / maxHp) * 100 : 100;
    target.stats.hp = Math.max(0, target.stats.hp - shieldResult.damage);
    const newHpPct = maxHp > 0 ? (target.stats.hp / maxHp) * 100 : 0;
    this.checkBossGimmicks(target, prevHpPct, newHpPct);

    if (target.stats.hp <= 0) {
      const reviveGimmick = target.gimmicks?.find(
        (g) => g.effect === 'REVIVE' && !this.firedGimmicks.has(`${target.id}:HP_BELOW_50:REVIVE`)
      );
      if (reviveGimmick) {
        this.firedGimmicks.add(`${target.id}:HP_BELOW_50:REVIVE`);
        this.applyBossGimmickEffect(target, reviveGimmick);
      }
    }

    // SELF_DAMAGE リスク: 攻撃後に HP を削る
    if (isDemonActive && demon!.form?.effectB.riskType === 'SELF_DAMAGE') {
      const selfDmgPct = demon!.form.effectB.riskValue ?? 10;
      const selfDmg = Math.floor(this.playerInitialMaxHp * selfDmgPct / 100);
      this.getMutableStats(player).hp = Math.max(1, this.getMutableStats(player).hp - selfDmg);
      this.addLog('DEMON_SELF_DAMAGE', player.name, player.name,
        `【深淵の理】魔神化の代償で ${selfDmg} の反動ダメージ！`);
    }

    // 魔神化行動消費
    if (isDemonActive && this.demonState) {
      this.demonState = consumeDemonAction(this.demonState);
    }

    let desc = `${player.name}の${actionName}！`;
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

    this.addLog(actionType, player.name, target.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, element, attackType);
    this.tryApplyActionAilment(player, target, skillId, element, attackType);

    // 武器パッシブ
    const weapon = player.equipment?.weapon;
    if (weapon) {
      for (const passive of [weapon.passiveA, weapon.passiveB]) {
        if (!passive) continue;
        const attackCtx: WeaponPassiveContext = {
          trigger: 'ON_ATTACK',
          actor: player,
          target,
          isCritical,
          didBreakShield: shieldResult.didBreak,
          isDemonMode: this.demonState?.isDemonMode ?? false,
        };
        const passiveResult = evaluateWeaponPassive(passive, attackCtx);
        if (passiveResult) this.applyPassiveResult(passiveResult, player, target);

        if (shieldResult.didBreak) {
          const shieldCtx: WeaponPassiveContext = { ...attackCtx, trigger: 'ON_SHIELD_BREAK' };
          const shieldPassiveResult = evaluateWeaponPassive(passive, shieldCtx);
          if (shieldPassiveResult) this.applyPassiveResult(shieldPassiveResult, player, target);
        }
      }
    }
  }

  private applyPassiveResult(
    result: WeaponPassiveResult,
    player: CharacterData,
    target: MonsterData,
  ): void {
    if (result.bonusDamage) {
      target.stats.hp = Math.max(0, target.stats.hp - result.bonusDamage);
    }
    if (result.demonGaugeDelta) {
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

  private processMonsterActions(target: MonsterData): void {
    const { player, monsters } = this.state;

    monsters.forEach(monster => {
      if (!monster) return;

      const monsterStats = { ...monster.stats };
      if (player.isAwakened) {
        monsterStats.atk = Math.floor(monsterStats.atk * 1.5);
      }

      const { damage, isCritical, isWeakness, isResisted } = this.calculateDamage(monsterStats, {}, target.stats, target.resistances, 1.0, 'NONE');
      const shieldResult = this.applySpiritualShield(target, damage, 'NONE');

      this.enemyMaxHp[target.id] = this.enemyMaxHp[target.id] ?? target.stats.hp;
      target.stats.hp = Math.max(0, target.stats.hp - shieldResult.damage);

      const desc = shieldResult.wasShielded
        ? `${monster.name}の追撃！ 霊的防壁に阻まれた。`
        : `${monster.name}の追撃！`;
      this.addLog('MONSTER_ATTACK', monster.name, target.name, desc, shieldResult.damage, isCritical, isWeakness, isResisted, 'NONE', 'STRIKE');
    });
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
      const ms = this.getMutableStats(player);
      const incomingMult = getDemonIncomingDamageMultiplier(this.demonState?.form ?? null);
      const rawDmg = Math.max(1, Math.floor(
        enemy.stats.atk * (1 - ms.def / (ms.def + 200)) * incomingMult
      ));
      ms.hp = Math.max(1, ms.hp - rawDmg);
      this.addLog('ENEMY_ATTACK', enemy.name, player.name,
        `${enemy.name}の攻撃！ アルドに${rawDmg}ダメージ。`, rawDmg);
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

      const shouldFire = (() => {
        switch (g.trigger) {
          case 'HP_BELOW_50':     return prevHpPct > 50 && newHpPct <= 50;
          case 'TURN_3':          return this.state.turn === 3;
          case 'ON_SHIELD_BREAK': return boss.shieldBroken === true;
          case 'ON_REVIVE':       return false;
          default:                return false;
        }
      })();

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
        boss.stats = { ...boss.stats, hp: Math.floor((this.enemyMaxHp[boss.id] ?? boss.stats.hp) * 0.5) };
        boss.shieldBroken = false;
        boss.shieldHp = boss.maxShieldHp ?? 0;
        for (const g2 of boss.gimmicks ?? []) {
          if (g2.trigger === 'ON_REVIVE') {
            this.firedGimmicks.delete(`${boss.id}:${g2.trigger}:${g2.effect}`);
          }
        }
        this.addLog('BOSS_REVIVE', boss.name, boss.name,
          `【REVIVE】${boss.name}が第2形態に移行した！ HPが回復し、防壁が再生する！`);
        break;

      case 'SUMMON_MINIONS':
        this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
          `【召喚】${boss.name}が手下を呼んだ！`);
        break;
    }
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
      if (this.demonState?.isDemonMode) {
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

  private getMutableStats(player: CharacterData): BaseStats {
    return ((player as any).stats ?? (player as any).baseStats) as BaseStats;
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
