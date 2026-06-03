import type { RouteDefinition, RouteId } from '../game/types';

export const ROUTES: RouteDefinition[] = [
  {
    id: 'crit',
    name: '暴击',
    shortHint: '先把火力拧成一个稳定窗口。',
    matureHint: '暴击已经能一路连爆，后面就是收尾。',
    color: '#ff8f70',
  },
  {
    id: 'pierce',
    name: '穿透',
    shortHint: '先把敌线切开，再往后穿。',
    matureHint: '穿透已经能撑起整条清线，后面就是控场。',
    color: '#68d4ff',
  },
  {
    id: 'dash',
    name: '穿梭',
    shortHint: '先把节奏抓住，边躲边打。',
    matureHint: '穿梭已经能反过来压场，后面就是收割。',
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
    hinted: { name: '灼热', desc: '已经能看出是暴击路了', color: '#ff8f70' },
    committed: { name: '超频', desc: '暴击开始滚起来了', color: '#ff6b2c' },
    matured: { name: '临界', desc: '这套已经能直接收尾', color: '#ff4500' },
  },
  pierce: {
    hinted: { name: '裂解', desc: '已经能看出是穿透路了', color: '#68d4ff' },
    committed: { name: '裂潮', desc: '穿透开始顺着一条线滚', color: '#00ccff' },
    matured: { name: '裂界', desc: '这套能把整片敌群切开', color: '#0099ff' },
  },
  dash: {
    hinted: { name: '滑移', desc: '已经能看出是穿梭路了', color: '#9cff97' },
    committed: { name: '相位', desc: '穿梭开始接上节奏', color: '#7aff7a' },
    matured: { name: '超载', desc: '这套已经能反打收场', color: '#4aff4a' },
  },
};

// 获取Build阶段显示信息
export function getBuildStageInfo(
  routeId: RouteId,
  stage: 'hinted' | 'committed' | 'matured',
): { name: string; desc: string; color: string } {
  return BUILD_STAGE_CONFIG[routeId][stage];
}
