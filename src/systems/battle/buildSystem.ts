import type { RouteId, RouteBuildStage } from '../../game/types';

// ============================================================
// Build系统辅助函数
// 处理路线判定、阶段计算等纯函数逻辑
// ============================================================

// ============================================================
// 阶段阈值常量
// ============================================================

export const ROUTE_LEANING_THRESHOLD = 2;   // 2张同流派 → leaning
export const ROUTE_COMMIT_THRESHOLD = 4;     // 4张同流派 → committed
export const ROUTE_MATURE_THRESHOLD = 7;     // 7张同流派 → matured (payoff)

// 路线计数的类型
type RouteCounts = Record<RouteId, number>;

// ============================================================
// 路线判定
// ============================================================

/**
 * 获取主导路线
 * 返回计数最高的路线ID，如果所有路线计数都为0则返回null
 */
export function getDominantRoute(routeCounts: RouteCounts): RouteId | null {
  const entries = Object.entries(routeCounts) as Array<[RouteId, number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top && top[1] > 0 ? top[0] : null;
}

/**
 * 计算Build阶段
 * 根据路线计数和已确定路线计算当前阶段
 */
export function calculateBuildStage(
  routeCounts: RouteCounts,
  committedRoute: RouteId | null,
  maturedRoute: RouteId | null,
): RouteBuildStage {
  if (maturedRoute) return 'matured';
  if (committedRoute) return 'committed';

  const dominant = getDominantRoute(routeCounts);
  if (!dominant) return 'unformed';

  const count = routeCounts[dominant] ?? 0;

  if (count >= ROUTE_MATURE_THRESHOLD) return 'matured';
  if (count >= ROUTE_COMMIT_THRESHOLD) return 'committed';
  if (count >= ROUTE_LEANING_THRESHOLD) return 'hinted';
  return 'unformed';
}

/**
 * 计算特定路线的Build阶段
 */
export function calculateRouteBuildStage(
  routeId: RouteId,
  routeCounts: RouteCounts,
  committedRoute: RouteId | null,
  maturedRoute: RouteId | null,
): RouteBuildStage {
  const count = routeCounts[routeId] ?? 0;

  if (maturedRoute === routeId) return 'matured';
  if (committedRoute === routeId) return 'committed';
  if (count >= ROUTE_MATURE_THRESHOLD) return 'matured';
  if (count >= ROUTE_COMMIT_THRESHOLD) return 'committed';
  if (count >= ROUTE_LEANING_THRESHOLD) return 'hinted';
  return count > 0 ? 'hinted' : 'unformed';
}

/**
 * 获取结果路线
 * 优先级：成型路线 > 站稳路线 > 主导路线
 */
export function getResultRoute(
  routeCounts: RouteCounts,
  committedRoute: RouteId | null,
  maturedRoute: RouteId | null,
): RouteId | null {
  return maturedRoute ?? committedRoute ?? getDominantRoute(routeCounts);
}

// ============================================================
// Build阶段信息
// ============================================================

/**
 * 获取阶段标签
 */
export function getBuildStageLabel(buildStage: RouteBuildStage): string {
  switch (buildStage) {
    case 'hinted':
      return '已出倾向';
    case 'committed':
      return '开始站稳';
    case 'matured':
      return '已经成型';
    default:
      return '未站稳';
  }
}

/**
 * 获取Build总结文本
 */
export function getBuildSummary(
  routeId: RouteId | null,
  buildStage: RouteBuildStage,
  routeNameMap: Record<RouteId, string>,
): string {
  if (!routeId) {
    return '本局还没有形成清晰打法';
  }

  const routeName = routeNameMap[routeId];
  switch (buildStage) {
    case 'matured':
      return `${routeName}流已经成型`;
    case 'committed':
      return `${routeName}流已经开始站稳`;
    case 'hinted':
      return `${routeName}倾向已经出现`;
    default:
      return '本局还没有形成清晰打法';
  }
}

// ============================================================
// 路线相关工具函数
// ============================================================

/**
 * 检查是否为混合标签
 */
export function isHybridTagged(tags: string[] | undefined): boolean {
  if (!tags) return false;
  return tags.includes('hybrid') || tags.includes('cross-route');
}

/**
 * 检查是否为重定向升级选择
 */
export function isRedirectUpgradePick(
  choiceRouteId: RouteId | 'dominant' | undefined,
  dominantRoute: RouteId | null,
): boolean {
  if (!choiceRouteId || !dominantRoute) return false;
  if (choiceRouteId === 'dominant') return false;
  return choiceRouteId !== dominantRoute;
}
