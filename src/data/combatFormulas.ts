/**
 * 战斗核心公式模块
 * 补充缺失的战斗细节计算公式
 */

import type { PlayerStats, RouteBuildStage } from '../game/types';

/**
 * 1. 暴击伤害计算
 * 基础伤害 × 暴击倍率
 */
export function calculateCritDamage(baseDamage: number, critMultiplier: number): number {
  return baseDamage * critMultiplier;
}

/**
 * 2. 暴击判定
 * 根据暴击率随机判定是否暴击
 */
export function rollCritical(critChance: number): boolean {
  return Math.random() < Math.min(0.95, Math.max(0, critChance));
}

/**
 * 3. 射速转开火间隔
 * 射速 = 每秒发射次数，间隔 = 1 / 射速
 */
export function getFireInterval(fireRate: number): number {
  return 1 / Math.max(0.1, fireRate);
}

/**
 * 4. 多重射击散射角度
 * 返回每发子弹相对于瞄准方向的角度偏移（弧度）
 */
export function getMultishotSpreadAngles(multishot: number): number[] {
  const count = Math.floor(multishot);
  if (count <= 1) {
    return [0];
  }

  // 总散射角度（弧度）
  const totalSpreadRad = (Math.PI / 12); // 15度
  const step = (totalSpreadRad * 2) / (count - 1);

  return Array.from({ length: count }, (_, i) => -totalSpreadRad + i * step);
}

/**
 * 5. 穿透伤害衰减
 * 每次穿透后伤害递减，但保持最低30%伤害
 */
export function getPierceDamageMultiplier(hitCount: number): number {
  if (hitCount <= 0) {
    return 1;
  }
  // 每次穿透衰减10%，最低保持30%
  return Math.max(0.3, 1 - hitCount * 0.1);
}

/**
 * 6. 每帧生命恢复
 * 根据再生属性和时间增量计算恢复量
 */
export function getRegenerationPerFrame(regeneration: number, deltaMs: number): number {
  return (regeneration * deltaMs) / 1000;
}

/**
 * 7. 弹道最大生命周期
 * 基于射程和弹速计算子弹存活时间
 */
export function getProjectileMaxLifetime(projectileSpeed: number, maxRange: number = 1200): number {
  return maxRange / Math.max(1, projectileSpeed);
}

/**
 * 8. 有效射速计算（考虑各种加成）
 * 包含暴击超载、冲刺驱动等状态加成
 */
export function getEffectiveFireRate(
  baseFireRate: number,
  critOverdriveSec: number,
  critRouteCount: number,
  dashDriveSec: number,
  dashRouteCount: number,
): number {
  let fireRate = baseFireRate;

  // 暴击超载加成
  if (critOverdriveSec > 0) {
    fireRate += 0.4 + critRouteCount * 0.12;
  }

  // 冲刺驱动加成
  if (dashDriveSec > 0) {
    fireRate += 0.35 + dashRouteCount * 0.1;
  }

  return fireRate;
}

/**
 * 9. 有效暴击率计算（考虑超载状态）
 */
export function getEffectiveCritChance(
  baseCritChance: number,
  buildStage: RouteBuildStage,
  critOverdriveSec: number,
): number {
  let critChance = baseCritChance;

  if (critOverdriveSec > 0) {
    critChance += 0.08;
    if (buildStage === 'committed') {
      critChance += 0.08;
    }
    if (buildStage === 'matured') {
      critChance += 0.08;
    }
  }

  return Math.min(0.95, Math.max(0, critChance));
}

/**
 * 10. 期望DPS计算
 * 考虑暴击率和暴击倍率的期望伤害输出
 */
export function getExpectedDPS(stats: PlayerStats): number {
  const critFactor = 1 + Math.min(0.95, stats.critChance) * Math.max(0, stats.critMultiplier - 1);
  return stats.damage * stats.fireRate * critFactor;
}

/**
 * 11. 穿透期望DPS倍率
 * 考虑穿透次数和衰减的期望伤害提升
 */
export function getPierceExpectedDamageMultiplier(pierce: number): number {
  if (pierce <= 0) {
    return 1;
  }

  let totalMultiplier = 1;
  for (let i = 1; i <= Math.floor(pierce); i++) {
    totalMultiplier += getPierceDamageMultiplier(i);
  }

  return totalMultiplier;
}

/**
 * 12. 多重射击期望DPS倍率
 * 简单的线性倍率（假设所有子弹都能命中）
 */
export function getMultishotDamageMultiplier(multishot: number): number {
  return Math.max(1, multishot);
}

/**
 * 13. 综合期望DPS
 * 考虑所有因素的完整DPS计算
 */
export function getComprehensiveDPS(stats: PlayerStats): number {
  const baseDPS = getExpectedDPS(stats);
  const pierceMultiplier = getPierceExpectedDamageMultiplier(stats.pierce);
  const multishotMultiplier = getMultishotDamageMultiplier(stats.multishot);

  return baseDPS * pierceMultiplier * multishotMultiplier;
}

/**
 * 14. 移动速度转换为像素/秒
 * 直接使用数值，但提供明确的单位说明
 */
export function getPlayerMoveSpeedPixelsPerSec(moveSpeed: number): number {
  // moveSpeed 已经是像素/秒单位
  return moveSpeed;
}

/**
 * 15. 无敌时间叠加规则
 * 取最大值，不累加
 */
export function mergeInvulnerabilityDuration(current: number, incoming: number): number {
  return Math.max(current, incoming);
}

/**
 * 16. 击退力度计算
 * 基于伤害和敌人类型计算击退向量
 */
export function calculateKnockback(
  damage: number,
  enemyRadius: number,
  isElite: boolean,
): { magnitude: number; duration: number } {
  const baseMagnitude = damage * 0.8;
  const radiusMultiplier = 1 / Math.max(1, enemyRadius / 12);
  const eliteResistance = isElite ? 0.3 : 1;

  return {
    magnitude: baseMagnitude * radiusMultiplier * eliteResistance,
    duration: 0.15 + damage * 0.002,
  };
}

/**
 * 17. 伤害数字显示格式化
 */
export function formatDamageNumber(damage: number, isCrit: boolean): string {
  const rounded = Math.round(damage);
  return isCrit ? `${rounded}!` : `${rounded}`;
}

/**
 * 18. 生存时间估算
 * 基于当前血量、敌人伤害和再生速率估算生存时间
 */
export function estimateSurvivalTime(
  currentHp: number,
  maxHp: number,
  incomingDPS: number,
  regeneration: number,
): number {
  const netDPS = Math.max(0.1, incomingDPS - regeneration);
  return currentHp / netDPS;
}

/**
 * 19. 战斗力评分
 * 综合评估玩家当前战斗力
 */
export function calculateCombatPowerScore(stats: PlayerStats): number {
  const offensiveScore = getComprehensiveDPS(stats) * 0.5;
  const survivalScore = (stats.maxHp + stats.regeneration * 100) * 0.3;
  const mobilityScore = stats.moveSpeed * 0.2;

  return offensiveScore + survivalScore + mobilityScore;
}

/**
 * 20. 伤害类型标签
 */
export type DamageType = 'normal' | 'crit' | 'pierce' | 'dash' | 'splash';

export interface DamageInstance {
  amount: number;
  type: DamageType;
  isCrit: boolean;
  pierceCount: number;
}

/**
 * 21. 创建伤害实例
 */
export function createDamageInstance(
  baseDamage: number,
  stats: PlayerStats,
  type: DamageType = 'normal',
  pierceCount: number = 0,
): DamageInstance {
  const isCrit = type !== 'splash' && rollCritical(stats.critChance);
  const critMultiplier = isCrit ? stats.critMultiplier : 1;
  const pierceMultiplier = getPierceDamageMultiplier(pierceCount);

  return {
    amount: baseDamage * critMultiplier * pierceMultiplier,
    type,
    isCrit,
    pierceCount,
  };
}
