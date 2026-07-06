/**
 * 结果分析 — 纯函数模块
 *
 * 从 RunEngine.ts 中提取的路线判定、统计差异和结果构建阶段计算。
 */

import type {
  PickedEventRecord,
  PlayerStats,
  RouteBuildStage,
  RouteId,
  RunState,
  StatModifiers,
  UpgradeArchetype,
  UpgradeDefinition,
} from '../../game/types';

/**
 * 路线证据计数所需的最小属性集。
 * 同时兼容 UpgradeArchetype 和 UpgradeDefinition。
 */
interface RouteEvidenceSource {
  routeId?: RouteId;
  rarity?: string;
}

/**
 * 计算升级前后的属性差异。
 */
export function calculateStatChanges(
  before: PlayerStats,
  after: PlayerStats,
): StatModifiers {
  const changes: StatModifiers = {};

  if (after.maxHp !== before.maxHp) changes.maxHp = after.maxHp - before.maxHp;
  if (after.damage !== before.damage) changes.damage = after.damage - before.damage;
  if (after.fireRate !== before.fireRate) changes.fireRate = after.fireRate - before.fireRate;
  if (after.projectileSpeed !== before.projectileSpeed)
    changes.projectileSpeed = after.projectileSpeed - before.projectileSpeed;
  if (after.critChance !== before.critChance)
    changes.critChance = after.critChance - before.critChance;
  if (after.critMultiplier !== before.critMultiplier)
    changes.critMultiplier = after.critMultiplier - before.critMultiplier;
  if (after.pierce !== before.pierce) changes.pierce = after.pierce - before.pierce;
  if (after.multishot !== before.multishot)
    changes.multishot = after.multishot - before.multishot;
  if (after.moveSpeed !== before.moveSpeed)
    changes.moveSpeed = after.moveSpeed - before.moveSpeed;
  if (after.dashInterval !== before.dashInterval)
    changes.dashInterval = after.dashInterval - before.dashInterval;
  if (after.dashPulseDamage !== before.dashPulseDamage)
    changes.dashPulseDamage = after.dashPulseDamage - before.dashPulseDamage;
  if (after.dashInvulnerability !== before.dashInvulnerability)
    changes.dashInvulnerability = after.dashInvulnerability - before.dashInvulnerability;
  if (after.regeneration !== before.regeneration)
    changes.regeneration = after.regeneration - before.regeneration;

  return changes;
}

/**
 * 根据已选强化和事件历史，统计各路线的证据计数。
 */
export function getResultRouteEvidenceCounts(
  selectedUpgrades: RouteEvidenceSource[],
  eventHistory: PickedEventRecord[],
): Record<RouteId, number> {
  const counts: Record<RouteId, number> = {
    crit: 0,
    pierce: 0,
    dash: 0,
  };

  for (const upgrade of selectedUpgrades) {
    if (upgrade.routeId) {
      counts[upgrade.routeId] += upgrade.rarity === 'rare' ? 2 : 1;
    }
  }

  for (const record of eventHistory) {
    if (record.routeId) {
      counts[record.routeId] += record.anomalyClass ? 2 : 1;
    }
  }

  return counts;
}

/**
 * 从 routeCounts 中找出占主导的路线。
 */
export function getDominantRouteFromCounts(
  routeCounts: RunState['routeCounts'],
): RouteId | null {
  const entries = Object.entries(routeCounts) as Array<[RouteId, number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top && top[1] > 0 ? top[0] : null;
}

/**
 * 推断玩家本局最可能的路线。
 */
export function getInferredResultRoute(
  selectedUpgradeIds: string[],
  allUpgrades: UpgradeArchetype[],
  eventHistory: PickedEventRecord[],
  routeCounts: RunState['routeCounts'],
): RouteId | null {
  const selectedUpgrades = selectedUpgradeIds
    .map((id) => allUpgrades.find((upgrade) => upgrade.id === id))
    .filter((upgrade): upgrade is UpgradeArchetype => upgrade !== undefined);

  const counts = getResultRouteEvidenceCounts(selectedUpgrades, eventHistory);
  const dominantRoute = getDominantRouteFromCounts(routeCounts);
  const rankedRoutes = (Object.entries(counts) as Array<[RouteId, number]>).sort(
    (left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    },
  );
  const [bestRoute, bestCount] = rankedRoutes[0] ?? [null, 0];
  if (bestRoute && bestCount > 0) {
    return bestRoute;
  }
  return dominantRoute;
}

/**
 * 根据路线和证据计数推断构建阶段。
 * @param fallbackStage - 当 routeId 为 null 时的回退阶段
 */
export function getResultBuildStage(
  routeId: RouteId | null,
  selectedUpgrades: RouteEvidenceSource[],
  eventHistory: PickedEventRecord[],
  maturedRoute: RouteId | null,
  committedRoute: RouteId | null,
  fallbackStage: RouteBuildStage,
): RouteBuildStage {
  if (!routeId) {
    return fallbackStage;
  }

  if (maturedRoute === routeId) {
    return 'matured';
  }
  if (committedRoute === routeId) {
    return 'committed';
  }

  const counts = getResultRouteEvidenceCounts(selectedUpgrades, eventHistory);
  const evidence = counts[routeId];
  if (evidence >= 5) {
    return 'matured';
  }
  if (evidence >= 2) {
    return 'committed';
  }
  if (evidence >= 1) {
    return 'hinted';
  }
  return 'unformed';
}

/**
 * 根据当前状态获取默认构建阶段。
 */
export function getDefaultBuildStage(
  maturedRoute: RouteId | null,
  committedRoute: RouteId | null,
  dominantRoute: RouteId | null,
): RouteBuildStage {
  if (maturedRoute) {
    return 'matured';
  }
  if (committedRoute) {
    return 'committed';
  }
  if (dominantRoute) {
    return 'hinted';
  }
  return 'unformed';
}
