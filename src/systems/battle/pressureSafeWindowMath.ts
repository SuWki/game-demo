/**
 * 压力安全窗口几何计算 — 纯函数模块
 *
 * 从 RunEngine.ts 中提取的安全区位置/尺寸计算逻辑。
 * 这些函数不依赖 RunEngine 实例状态，仅依赖传入参数和常量。
 */

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  clamp,
  createBaseStats,
  getPlayerMoveSpeed,
} from '../../data/balance';
import type {
  BattleState,
  PressurePocketShiftModeId,
  PressureSafeWindowAxis,
  PlayerStats,
} from '../../game/types';

// ============================================================
// 常量
// ============================================================

export const CENTER_X = ARENA_WIDTH / 2;
export const CENTER_Y = ARENA_HEIGHT / 2;
export const BOSS_SAFE_WINDOW_REACTION_SEC = 0.82;
export const BOSS_SAFE_WINDOW_POCKET_REACTION_SEC = 0.64;
export const BASE_PLAYER_MOVE_SPEED = createBaseStats().moveSpeed;
export const BOSS_SAFE_WINDOW_EDGE_MARGIN_X = 12;
export const BOSS_SAFE_WINDOW_EDGE_MARGIN_Y = 10;

// ============================================================
// 视口计算
// ============================================================

export function getBattleViewportBounds(battle: BattleState): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
} {
  const width = Math.min(VIEWPORT_WIDTH, ARENA_WIDTH);
  const height = Math.min(VIEWPORT_HEIGHT, ARENA_HEIGHT);
  const left = clamp(battle.playerX - width * 0.5, 0, Math.max(0, ARENA_WIDTH - width));
  const top = clamp(battle.playerY - height * 0.5, 0, Math.max(0, ARENA_HEIGHT - height));

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
  };
}

// ============================================================
// 安全区停留时间与目标距离
// ============================================================

export function getBossSafeWindowLingerSec(
  baseLingerSec: number,
  pulseIntervalSec: number | undefined,
): number {
  const minimumReadableSec = Math.max(baseLingerSec, (pulseIntervalSec ?? baseLingerSec) + 0.12);
  return clamp(minimumReadableSec, 1.12, 2.34);
}

export function getBossSafeWindowTargetDistance(axis: PressureSafeWindowAxis): number {
  const reactionSec =
    axis === 'pocket' ? BOSS_SAFE_WINDOW_POCKET_REACTION_SEC : BOSS_SAFE_WINDOW_REACTION_SEC;
  const targetDistance = BASE_PLAYER_MOVE_SPEED * reactionSec;
  return axis === 'pocket'
    ? clamp(targetDistance, 118, 172)
    : clamp(targetDistance, 132, 204);
}

// ============================================================
// Boss 安全区中心选择
// ============================================================

export function chooseBossPressureSafeWindowCenter(
  battle: BattleState,
  axis: PressureSafeWindowAxis,
  span: number,
  anchoredLane: number,
): number {
  const view = getBattleViewportBounds(battle);
  const dimension = axis === 'vertical' ? view.width : view.height;
  const viewStart = axis === 'vertical' ? view.left : view.top;
  const viewEnd = viewStart + dimension;
  const playerCoord = axis === 'vertical' ? battle.playerX : battle.playerY;
  const margin = axis === 'vertical' ? BOSS_SAFE_WINDOW_EDGE_MARGIN_X : BOSS_SAFE_WINDOW_EDGE_MARGIN_Y;
  const minCenter = viewStart + margin + span * 0.5;
  const maxCenter = viewEnd - margin - span * 0.5;
  if (battle.bossSafeWindowMoments <= 0) {
    return clamp(playerCoord, minCenter, maxCenter);
  }
  const targetDistance = getBossSafeWindowTargetDistance(axis);
  const positiveTravelMax = Math.max(0, maxCenter - playerCoord);
  const negativeTravelMax = Math.max(0, playerCoord - minCenter);
  const preferredSign = anchoredLane >= playerCoord ? 1 : -1;
  const preferredTravelMax = preferredSign > 0 ? positiveTravelMax : negativeTravelMax;
  const alternateTravelMax = preferredSign > 0 ? negativeTravelMax : positiveTravelMax;
  const travelSign =
    preferredTravelMax >= Math.min(targetDistance, 48) || preferredTravelMax >= alternateTravelMax - 16
      ? preferredSign
      : -preferredSign;
  const resolvedTravelMax = travelSign > 0 ? positiveTravelMax : negativeTravelMax;
  const resolvedTravelDistance = Math.min(targetDistance, resolvedTravelMax);
  const center = playerCoord + travelSign * resolvedTravelDistance;
  return clamp(center, minCenter, maxCenter);
}

export function chooseBossPressureSafePocketCenter(
  battle: BattleState,
  spanX: number,
  spanY: number,
  shiftType: PressurePocketShiftModeId,
  anchorX: number,
  anchorY: number,
): { x: number; y: number } {
  const view = getBattleViewportBounds(battle);
  const halfX = spanX * 0.5;
  const halfY = spanY * 0.5;
  const minX = view.left + BOSS_SAFE_WINDOW_EDGE_MARGIN_X + halfX;
  const maxX = view.right - BOSS_SAFE_WINDOW_EDGE_MARGIN_X - halfX;
  const minY = view.top + BOSS_SAFE_WINDOW_EDGE_MARGIN_Y + halfY;
  const maxY = view.bottom - BOSS_SAFE_WINDOW_EDGE_MARGIN_Y - halfY;
  if (battle.bossSafeWindowMoments <= 0) {
    return {
      x: clamp(battle.playerX, minX, maxX),
      y: clamp(battle.playerY, minY, maxY),
    };
  }
  const targetDistance = getBossSafeWindowTargetDistance('pocket');
  const directionX = anchorX - battle.playerX;
  const directionY = anchorY - battle.playerY;
  const directionLength = Math.hypot(directionX, directionY);
  const fallbackAngle = getBossPressurePocketFallbackAngle(battle, shiftType);
  const baseAngle = directionLength > 1 ? Math.atan2(directionY, directionX) : fallbackAngle;
  const lateralSign = battle.pressurePatternPulseCount % 2 === 0 ? 1 : -1;
  const angleOffsets = [0, 0.42 * lateralSign, -0.42 * lateralSign, 0.82 * lateralSign, -0.82 * lateralSign];
  const radialOffsets = [0, -28, 26];
  let bestCandidate = {
    x: clamp(anchorX, minX, maxX),
    y: clamp(anchorY, minY, maxY),
  };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const angleOffset of angleOffsets) {
    const angle = baseAngle + angleOffset;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    for (const radialOffset of radialOffsets) {
      const rawX = battle.playerX + dirX * (targetDistance + radialOffset);
      const rawY = battle.playerY + dirY * (targetDistance + radialOffset);
      const candidateX = clamp(rawX, minX, maxX);
      const candidateY = clamp(rawY, minY, maxY);
      const centerDistance = Math.hypot(candidateX - battle.playerX, candidateY - battle.playerY);
      const anchorDrift = Math.hypot(candidateX - anchorX, candidateY - anchorY);
      const clampLoss = Math.hypot(candidateX - rawX, candidateY - rawY);
      const score =
        Math.abs(centerDistance - targetDistance) +
        anchorDrift * 0.18 +
        clampLoss * 0.52;

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = { x: candidateX, y: candidateY };
      }
    }
  }

  return bestCandidate;
}

export function getBossPressurePocketFallbackAngle(
  battle: BattleState,
  shiftType: PressurePocketShiftModeId,
): number {
  const baseAngle =
    shiftType === 'edgeBounce'
      ? Math.PI * 0.18
      : shiftType === 'centerReset'
        ? -Math.PI * 0.5
        : -Math.PI * 0.28;
  return baseAngle + Math.max(0, battle.pressurePatternPulseCount - 1) * 0.46;
}

// ============================================================
// 口袋偏移配置
// ============================================================

export interface PressurePocketShiftProfile {
  anchors: Array<{ x: number; y: number }>;
  playerBlend: number;
  widthScale: number;
  heightScale: number;
  lingerScale: number;
}

export function getPressurePocketShiftProfile(
  shiftType: PressurePocketShiftModeId,
): PressurePocketShiftProfile {
  switch (shiftType) {
    case 'centerReset':
      return {
        anchors: [
          { x: 0.5, y: 0.5 },
          { x: 0.34, y: 0.36 },
          { x: 0.5, y: 0.5 },
          { x: 0.66, y: 0.64 },
          { x: 0.5, y: 0.5 },
        ],
        playerBlend: 0.18,
        widthScale: 1.08,
        heightScale: 1.06,
        lingerScale: 1.08,
      };
    case 'edgeBounce':
      return {
        anchors: [
          { x: 0.24, y: 0.3 },
          { x: 0.76, y: 0.3 },
          { x: 0.8, y: 0.7 },
          { x: 0.2, y: 0.7 },
          { x: 0.2, y: 0.5 },
          { x: 0.8, y: 0.5 },
        ],
        playerBlend: 0.14,
        widthScale: 0.92,
        heightScale: 0.94,
        lingerScale: 0.9,
      };
    case 'sweep':
    default:
      return {
        anchors: [
          { x: 0.34, y: 0.36 },
          { x: 0.66, y: 0.36 },
          { x: 0.64, y: 0.66 },
          { x: 0.36, y: 0.66 },
          { x: 0.5, y: 0.5 },
        ],
        playerBlend: 0.22,
        widthScale: 1,
        heightScale: 1,
        lingerScale: 1,
      };
  }
}

// ============================================================
// 弹幕槽位与安全区判定
// ============================================================

export function collectPressureSlotPositions(
  dimension: number,
  margin: number,
  shotSlots: number,
  safeStart: number,
  safeEnd: number,
): number[] {
  const slotPositions: number[] = [];
  const safePadding = 30;

  for (let index = 0; index < shotSlots; index += 1) {
    const ratio = shotSlots === 1 ? 0.5 : index / (shotSlots - 1);
    const position = margin + ratio * (dimension - margin * 2);
    if (position > safeStart - safePadding && position < safeEnd + safePadding) {
      continue;
    }
    slotPositions.push(position);
  }

  if (slotPositions.length === 0) {
    slotPositions.push(
      clamp(safeStart - (safePadding + 18), margin, dimension - margin),
      clamp(safeEnd + safePadding + 18, margin, dimension - margin),
    );
  }

  return slotPositions;
}

export function isPointInsidePressureSafeWindow(
  battle: BattleState,
  x: number,
  y: number,
  padding = 0,
): boolean {
  if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSec <= 0 || battle.pressureSafeWindowSpan <= 0) {
    return false;
  }

  const safeStartX = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - padding;
  const safeEndX = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 + padding;

  if (battle.pressureSafeWindowAxis === 'vertical') {
    if (!(x >= safeStartX && x <= safeEndX)) {
      return false;
    }
    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return true;
    }
    const safeStartY =
      battle.pressureSafeWindowSecondaryCenter -
      battle.pressureSafeWindowSecondarySpan * 0.5 -
      padding;
    const safeEndY =
      battle.pressureSafeWindowSecondaryCenter +
      battle.pressureSafeWindowSecondarySpan * 0.5 +
      padding;
    return y >= safeStartY && y <= safeEndY;
  }

  if (battle.pressureSafeWindowAxis === 'horizontal') {
    if (!(y >= safeStartX && y <= safeEndX)) {
      return false;
    }
    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return true;
    }
    const safeStartX2 =
      battle.pressureSafeWindowSecondaryCenter -
      battle.pressureSafeWindowSecondarySpan * 0.5 -
      padding;
    const safeEndX2 =
      battle.pressureSafeWindowSecondaryCenter +
      battle.pressureSafeWindowSecondarySpan * 0.5 +
      padding;
    return x >= safeStartX2 && x <= safeEndX2;
  }

  if (battle.pressureSafeWindowSecondarySpan <= 0) {
    return false;
  }

  const safeStartY =
    battle.pressureSafeWindowSecondaryCenter -
    battle.pressureSafeWindowSecondarySpan * 0.5 -
    padding;
  const safeEndY =
    battle.pressureSafeWindowSecondaryCenter +
    battle.pressureSafeWindowSecondarySpan * 0.5 +
    padding;
  return x >= safeStartX && x <= safeEndX && y >= safeStartY && y <= safeEndY;
}

export function getDistanceOutsidePressureSafeWindow(
  battle: BattleState,
  x: number,
  y: number,
  padding = 0,
): number {
  if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSec <= 0 || battle.pressureSafeWindowSpan <= 0) {
    return 0;
  }

  const halfPrimary = battle.pressureSafeWindowSpan * 0.5 + padding;

  if (battle.pressureSafeWindowAxis === 'vertical') {
    const dx = Math.max(0, Math.abs(x - battle.pressureSafeWindowCenter) - halfPrimary);
    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return dx;
    }
    const halfY = battle.pressureSafeWindowSecondarySpan * 0.5 + padding;
    const dy = Math.max(0, Math.abs(y - battle.pressureSafeWindowSecondaryCenter) - halfY);
    return Math.hypot(dx, dy);
  }

  if (battle.pressureSafeWindowAxis === 'horizontal') {
    const dy = Math.max(0, Math.abs(y - battle.pressureSafeWindowCenter) - halfPrimary);
    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return dy;
    }
    const halfX = battle.pressureSafeWindowSecondarySpan * 0.5 + padding;
    const dx = Math.max(0, Math.abs(x - battle.pressureSafeWindowSecondaryCenter) - halfX);
    return Math.hypot(dx, dy);
  }

  // pocket
  const dx = Math.max(0, Math.abs(x - battle.pressureSafeWindowCenter) - halfPrimary);
  if (battle.pressureSafeWindowSecondarySpan <= 0) {
    return dx;
  }

  const halfY = battle.pressureSafeWindowSecondarySpan * 0.5 + padding;
  const dy = Math.max(0, Math.abs(y - battle.pressureSafeWindowSecondaryCenter) - halfY);
  return Math.hypot(dx, dy);
}

// ============================================================
// Boss 安全区宽限期计算
// ============================================================

export function calculateBossSafeWindowGraceSec(
  battle: BattleState,
  stats: PlayerStats,
): number {
  const distance = getDistanceOutsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12);
  if (distance <= 0) {
    return 0;
  }
  const moveSpeed = Math.max(120, getPlayerMoveSpeed(stats));
  return clamp(distance / moveSpeed + 0.34, 0.72, 1.5);
}
