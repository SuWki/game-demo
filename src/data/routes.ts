import type { RouteDefinition, RouteId } from '../game/types';

export const ROUTES: RouteDefinition[] = [
  {
    id: 'crit',
    name: '暴击',
    shortHint: '暴击开始连起来了。',
    matureHint: '暴击已经能一串串炸开了。',
    color: '#ff8f70',
  },
  {
    id: 'pierce',
    name: '穿透',
    shortHint: '穿透已经连起来了。',
    matureHint: '穿透已经能打到后排了。',
    color: '#68d4ff',
  },
  {
    id: 'dash',
    name: '穿梭',
    shortHint: '穿梭已经连起来了。',
    matureHint: '穿梭已经能贴身收人了。',
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
