import type { RouteDefinition, RouteId } from '../game/types';

export const ROUTES: RouteDefinition[] = [
  {
    id: 'crit',
    name: '暴击',
    shortHint: '火力开始偏向暴击爆发。',
    matureHint: '暴击路线已经站稳，终局爆发成型。',
    color: '#ff8f70',
  },
  {
    id: 'pierce',
    name: '穿透',
    shortHint: '火力开始偏向贯穿清线。',
    matureHint: '穿透路线已经站稳，贯穿效率成型。',
    color: '#68d4ff',
  },
  {
    id: 'dash',
    name: '穿梭',
    shortHint: '机体开始偏向穿梭规避。',
    matureHint: '穿梭路线已经站稳，节奏循环成型。',
    color: '#9cff97',
  },
];

export const ROUTE_NAME_MAP: Record<RouteId, string> = ROUTES.reduce(
  (accumulator, route) => {
    accumulator[route.id] = route.name;
    return accumulator;
  },
  {} as Record<RouteId, string>,
);

export const ROUTE_COLOR_MAP: Record<RouteId, string> = ROUTES.reduce(
  (accumulator, route) => {
    accumulator[route.id] = route.color;
    return accumulator;
  },
  {} as Record<RouteId, string>,
);

// Build阶段配置 - 让玩家明确感知Build成长
export const BUILD_STAGE_CONFIG: Record<
  RouteId,
  Record<'hinted' | 'committed' | 'matured', { name: string; desc: string; color: string }>
> = {
  crit: {
    hinted: { name: '灼热', desc: '破绽开始累积', color: '#ff8f70' },
    committed: { name: '超频', desc: '暴击进入高速状态', color: '#ff6b2c' },
    matured: { name: '临界', desc: '暴击完全失控', color: '#ff4500' },
  },
  pierce: {
    hinted: { name: '裂解', desc: '裂纹开始扩散', color: '#68d4ff' },
    committed: { name: '裂潮', desc: '贯穿效率提升', color: '#00ccff' },
    matured: { name: '裂界', desc: '空间完全撕裂', color: '#0099ff' },
  },
  dash: {
    hinted: { name: '滑移', desc: '机动性增强', color: '#9cff97' },
    committed: { name: '相位', desc: '穿梭进入高频', color: '#7aff7a' },
    matured: { name: '超载', desc: '残影实体化', color: '#4aff4a' },
  },
};

// 获取Build阶段显示信息
export function getBuildStageInfo(
  routeId: RouteId,
  stage: 'hinted' | 'committed' | 'matured',
): { name: string; desc: string; color: string } {
  return BUILD_STAGE_CONFIG[routeId][stage];
}
