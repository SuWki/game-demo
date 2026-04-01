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
