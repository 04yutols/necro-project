import type { EnemyData, EnemyStatScale, EnemyTier, StageData } from '../types/game';
import { applyEnemyStatScale } from './EnemyScaling';

const DEFAULT_WAVE_REWARD_WEIGHTS = [0.25, 0.32, 0.43] as const;
const TIER_RANK: Record<EnemyTier, number> = { BOSS: 3, ELITE: 2, MINION: 1 };

export interface BattleSessionWave {
  index: number;
  title: string;
  label: string;
  role: StageData['waves'][number]['role'];
  intent?: string;
  statScale?: EnemyStatScale;
  isBoss: boolean;
  rewards: { exp: number; gold: number };
  enemies: EnemyData[];
}

export interface BattleTargetAccessors<T> {
  isAlive: (candidate: T) => boolean;
  getTier: (candidate: T) => EnemyTier | undefined;
  getHp: (candidate: T) => number;
}

/**
 * UI戦闘とAPIヘッドレス戦闘が共有する、マスター由来の戦闘セッション境界。
 * 表示状態や乱数を持たず、WAVE解決と決定的な標的規則だけを一元化する。
 */
export class BattleSession {
  static buildWaves(
    stage: StageData,
    getEnemy: (enemyId: string) => EnemyData | undefined,
  ): BattleSessionWave[] {
    return stage.waves.map((wave, waveIndex) => {
      const enemies = wave.enemyIds.map((enemyId) => {
        const enemy = getEnemy(enemyId);
        if (!enemy) throw new Error(`Stage ${stage.id} references unknown enemy: ${enemyId}`);
        return applyEnemyStatScale(enemy, wave.statScale);
      });
      const weight = DEFAULT_WAVE_REWARD_WEIGHTS[waveIndex] ?? 1 / Math.max(1, stage.waves.length);
      return {
        index: waveIndex,
        title: stage.nameJa,
        label: wave.label,
        role: wave.role,
        intent: wave.intent,
        statScale: wave.statScale,
        isBoss: wave.role === 'BOSS',
        rewards: {
          exp: Math.max(0, Math.round(stage.rewards.baseExp * weight)),
          gold: Math.max(0, Math.round(stage.rewards.baseGold * weight)),
        },
        enemies,
      };
    });
  }

  static pickTarget<T>(candidates: readonly T[], accessors: BattleTargetAccessors<T>): T | null {
    return candidates
      .filter(accessors.isAlive)
      .map((candidate, index) => ({ candidate, index }))
      .sort((left, right) => {
        const tierDelta = (TIER_RANK[accessors.getTier(right.candidate) ?? 'MINION'] ?? 0)
          - (TIER_RANK[accessors.getTier(left.candidate) ?? 'MINION'] ?? 0);
        if (tierDelta !== 0) return tierDelta;
        const hpDelta = accessors.getHp(left.candidate) - accessors.getHp(right.candidate);
        return hpDelta !== 0 ? hpDelta : left.index - right.index;
      })[0]?.candidate ?? null;
  }
}

