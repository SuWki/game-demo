/**
 * 战斗系统辅助函数
 * 纯函数，不依赖外部状态
 */

import { clamp } from '../../data/balance';
import type { BattleTemplateDefinition, EnemyArchetypeId } from '../../game/types';

// ============================================================
// 敌人相关计算
// ============================================================

/**
 * 计算自适应生成批次数量
 */
export function calculateAdaptiveSpawnBurstCount(
  template: BattleTemplateDefinition,
  activeCount: number,
  cap: number,
  archetypeCounts: Record<EnemyArchetypeId, number>,
): number {
  const baseCount = template.spawnRule?.burstCount ?? 1;

  if (cap <= 0) return baseCount;

  const fillRatio = activeCount / cap;

  if (fillRatio < 0.3) {
    return Math.max(1, baseCount + 1);
  }

  if (fillRatio > 0.85) {
    return Math.max(1, baseCount - 1);
  }

  const rangedSkew = (archetypeCounts.ranged ?? 0) - (archetypeCounts.brute ?? 0);
  if (rangedSkew > 2) {
    return Math.max(1, baseCount - 1);
  }

  return baseCount;
}

/**
 * 计算普通战斗补充窗口时间
 */
export function calculateRefillWindow(
  template: BattleTemplateDefinition,
  activeCount: number,
  cap: number,
  archetypeCounts: Record<EnemyArchetypeId, number>,
): number {
  const baseInterval = template.spawnIntervalSec;
  const fillRatio = cap > 0 ? activeCount / cap : 0;
  const rangedExcess = Math.max(0, (archetypeCounts.ranged ?? 0) - 3);

  let window = baseInterval;

  if (fillRatio < 0.25) {
    window *= 0.6;
  } else if (fillRatio > 0.8) {
    window *= 1.4;
  }

  window *= 1 + rangedExcess * 0.1;

  return Math.max(0.08, window);
}

// ============================================================
// 护卫生成计算
// ============================================================

export interface PressurePhase {
  escortBatchBonus?: number;
  escortMaxBonus?: number;
  escortRespawnMultiplier?: number;
}

export function calculateEscortBatch(
  baseBatch: number,
  phase: PressurePhase | null,
): number {
  return Math.max(0, baseBatch + (phase?.escortBatchBonus ?? 0));
}

export function calculateEscortMax(
  baseMax: number,
  phase: PressurePhase | null,
): number {
  return Math.max(0, baseMax + (phase?.escortMaxBonus ?? 0));
}

export function calculateEscortRespawnSec(
  baseRespawn: number,
  phase: PressurePhase | null,
): number {
  const multiplier = phase?.escortRespawnMultiplier ?? 1;
  return Math.max(0.75, baseRespawn * multiplier);
}

// ============================================================
// 位置计算
// ============================================================

export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function getPatternEscortSpawnPosition(
  view: ViewportBounds,
  mode: string,
  index: number,
  spawnCursor: number,
): { x: number; y: number } {
  const margin = 44;
  const sideOffset = 46 + Math.floor(index / 2) * 34;
  const jitter = ((spawnCursor % 3) - 1) * 12;

  switch (mode) {
    case 'laneCrush':
      return {
        x: view.left + margin + (index % 2) * (view.width - margin * 2) + jitter,
        y: view.top + 100 + Math.floor(index / 2) * 80,
      };
    case 'sideClamp':
      return {
        x: view.left + margin + sideOffset + (index % 2) * (view.width - margin * 2 - sideOffset * 2),
        y: view.top + 80 + Math.floor(index / 2) * 60,
      };
    case 'crossfireWave':
      return {
        x: view.left + view.width / 2 + (index % 2 === 0 ? -1 : 1) * (100 + index * 20),
        y: view.top + 60 + Math.floor(index / 2) * 50,
      };
    default:
      return {
        x: view.left + view.width / 2 + (Math.random() - 0.5) * 200,
        y: view.top + 60 + Math.random() * 100,
      };
  }
}

// ============================================================
// 敌人行为计算
// ============================================================

export interface EnemyMovementContext {
  playerX: number;
  playerY: number;
  elapsedSec: number;
}

export function calculateStandardEnemyMovement(
  enemyX: number,
  enemyY: number,
  enemyId: number,
  spawnFlashSec: number,
  ctx: EnemyMovementContext,
  pattern: string,
  laneBias: string,
  recoveryRatio: number,
): { moveX: number; moveY: number } {
  const dx = ctx.playerX - enemyX;
  const dy = ctx.playerY - enemyY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  const strafeX = -dirY;
  const strafeY = dirX;
  const weave = Math.sin(ctx.elapsedSec * 1.4 + enemyId * 0.33);

  const openingRatio = Math.min(1, spawnFlashSec / 0.22);
  const pushWeight = distance > 150 ? 1.02 : distance > 90 ? 0.9 : 0.78;

  let moveX = dirX * pushWeight + strafeX * weave * 0.08;
  let moveY = dirY * pushWeight + strafeY * weave * 0.08;

  // 夹击模式
  if (pattern === 'pincers') {
    const clampTargetY = ctx.playerY + ((enemyId % 3) - 1) * 20;
    const clampBias = clamp((clampTargetY - enemyY) / 92, -1, 1);
    moveX = dirX * (distance > 150 ? 0.96 : distance > 92 ? 0.88 : 0.8);
    moveY = dirY * 0.42 + clampBias * 0.62 + strafeY * weave * 0.08;
  }
  // 车道模式
  else if (pattern === 'lanes') {
    if (laneBias === 'vertical') {
      const laneAlign = clamp((ctx.playerX - enemyX) / 84, -1, 1);
      moveX = laneAlign * 0.76 + dirX * 0.32 + strafeX * weave * 0.04;
      moveY = dirY * (distance > 114 ? 0.94 : 0.72);
    } else {
      const laneAlign = clamp((ctx.playerY - enemyY) / 84, -1, 1);
      moveX = dirX * (distance > 114 ? 0.94 : 0.72);
      moveY = laneAlign * 0.76 + dirY * 0.32 + strafeY * weave * 0.04;
    }
  }

  // 恢复减速
  moveX *= recoveryRatio;
  moveY *= recoveryRatio;

  return { moveX, moveY };
}

export function calculateBruteEnemyMovement(
  enemyX: number,
  enemyY: number,
  playerX: number,
  playerY: number,
  recoveryRatio: number,
): { moveX: number; moveY: number } {
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const distance = Math.max(1, Math.hypot(dx, dy));

  return {
    moveX: (dx / distance) * 0.95 * recoveryRatio,
    moveY: (dy / distance) * 0.95 * recoveryRatio,
  };
}

export function calculateSkirmisherEnemyMovement(
  enemyX: number,
  enemyY: number,
  enemyId: number,
  playerX: number,
  playerY: number,
  elapsedSec: number,
  recoveryRatio: number,
): { moveX: number; moveY: number } {
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  const strafeX = -dirY;
  const strafeY = dirX;
  const weave = Math.sin(elapsedSec * 2.5 + enemyId * 0.5);

  return {
    moveX: (dirX * 0.7 + strafeX * weave * 0.4) * recoveryRatio,
    moveY: (dirY * 0.7 + strafeY * weave * 0.4) * recoveryRatio,
  };
}

export function calculateRangedEnemyMovement(
  enemyX: number,
  enemyY: number,
  enemyId: number,
  playerX: number,
  playerY: number,
  recoveryRatio: number,
): { moveX: number; moveY: number; idealDistance: number } {
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;

  const idealDistance = 180 + (enemyId % 3) * 30;
  const distanceDelta = distance - idealDistance;

  let moveX = 0;
  let moveY = 0;

  if (distanceDelta > 30) {
    moveX = dirX * 0.6;
    moveY = dirY * 0.6;
  } else if (distanceDelta < -30) {
    moveX = -dirX * 0.8;
    moveY = -dirY * 0.8;
  } else {
    const strafeX = -dirY;
    const strafeY = dirX;
    moveX = strafeX * 0.4;
    moveY = strafeY * 0.4;
  }

  return {
    moveX: moveX * recoveryRatio,
    moveY: moveY * recoveryRatio,
    idealDistance,
  };
}
