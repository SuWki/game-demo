import type { RouteDefinition, RouteId } from '../game/types';

export const ROUTES: RouteDefinition[] = [
  {
    id: 'crit',
    name: '暴击',
    shortHint: '暴击开始找窗口了。',
    matureHint: '暴击已经会收口了，后面会越打越狠。',
    color: '#ff8f70',
  },
  {
    id: 'pierce',
    name: '穿透',
    shortHint: '穿透开始拆线了。',
    matureHint: '穿透已经能一路穿过去，后排会自己掉。',
    color: '#68d4ff',
  },
  {
    id: 'dash',
    name: '穿梭',
    shortHint: '穿梭开始找反打节奏了。',
    matureHint: '穿梭已经能贴身收割，节奏会自己接上。',
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
