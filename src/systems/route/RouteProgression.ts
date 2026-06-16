import type { AudioCue, PhaseId, RouteBuildStage, RouteId, RunState } from '../../game/types';

export interface RouteAdvanceMeta {
  pickId: string;
}

export interface RouteAdvanceDeps {
  state: RunState;
  firstRouteHintRecorded: boolean;
  setFirstRouteHintRecorded: (value: boolean) => void;
  markRouteHint: (routeId: RouteId) => void;
  markFirstRouteHint: (routeId: RouteId) => void;
  markRouteCommitted: (routeId: RouteId, meta: { phase: PhaseId; pickId: string }) => void;
  markRouteMatured: (routeId: RouteId) => void;
  queueRouteMoment: (routeId: RouteId, text: string) => void;
  enqueueTip: (text: string) => void;
  enqueueAudio: (cue: AudioCue) => void;
  getRouteStageMomentText: (routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff') => string;
  getRouteStageNarrative: (routeId: RouteId, stage: RouteBuildStage) => string;
  getRouteShortHint: (routeId: RouteId) => string;
  getRouteMatureHint: (routeId: RouteId) => string;
}

export function advanceRoute(deps: RouteAdvanceDeps, routeId: RouteId, meta?: RouteAdvanceMeta): void {
  deps.state.routeCounts[routeId] += 1;
  const count = deps.state.routeCounts[routeId];

  if (count === 1) {
    deps.markRouteHint(routeId);
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'starter'));
  }

  if (!deps.firstRouteHintRecorded) {
    deps.setFirstRouteHintRecorded(true);
    deps.markFirstRouteHint(routeId);
    deps.enqueueTip(deps.getRouteShortHint(routeId));
  }

  if (count === 2 && deps.state.committedRoute !== routeId) {
    deps.state.committedRoute = routeId;
    deps.markRouteCommitted(routeId, {
      phase: deps.state.phase,
      pickId: meta?.pickId ?? `route:${routeId}`,
    });
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'bridge'));
    deps.enqueueTip(deps.getRouteStageNarrative(routeId, 'committed'));
  }

  if (count >= 3 && deps.state.maturedRoute !== routeId) {
    deps.state.maturedRoute = routeId;
    deps.markRouteMatured(routeId);
    deps.enqueueAudio('routeMatured');
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'payoff'));
    deps.enqueueTip(deps.getRouteMatureHint(routeId));
  }
}

export function getRouteBuildStage(state: RunState, routeId: RouteId): RouteBuildStage {
  const count = state.routeCounts[routeId];
  if (count >= 3 || state.maturedRoute === routeId) {
    return 'matured';
  }
  if (count >= 2 || state.committedRoute === routeId) {
    return 'committed';
  }
  if (count >= 1) {
    return 'hinted';
  }
  return 'unformed';
}

export function getBuildStageLabel(buildStage: RouteBuildStage): string {
  switch (buildStage) {
    case 'hinted':
      return '已开始';
    case 'committed':
      return '进行中';
    case 'matured':
      return '已完成';
    default:
      return '未开始';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '未开始',
      hinted: '已开始',
      committed: '进行中',
      matured: '已完成',
    },
    pierce: {
      unformed: '未开始',
      hinted: '已开始',
      committed: '进行中',
      matured: '已完成',
    },
    dash: {
      unformed: '未开始',
      hinted: '已开始',
      committed: '进行中',
      matured: '已完成',
    },
  };

  return labelMap[routeId][buildStage];
}

export function getRouteStageNarrative(routeId: RouteId, buildStage: RouteBuildStage): string {
  const routeName = getRouteName(routeId);
  switch (routeId) {
    case 'crit':
      switch (buildStage) {
        case 'hinted':
          return routeName + '起手：抓住时机打出一串重击。';
        case 'committed':
          return routeName + '进行中：持续叠加暴击破绽。';
        case 'matured':
          return routeName + '已完成：连续暴击造成爆发伤害。';
        default:
          return routeName + '未开始。';
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return routeName + '起手：前排伤害逐渐传导到后排。';
        case 'committed':
          return routeName + '进行中：子弹穿透整排敌人。';
        case 'matured':
          return routeName + '已完成：子弹穿透整排敌人造成大量伤害。';
        default:
          return routeName + '未开始。';
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return routeName + '起手：接近敌人后可触发反击。';
        case 'committed':
          return routeName + '进行中：接近敌人后持续触发反击。';
        case 'matured':
          return routeName + '已完成：接近敌人后持续输出。';
        default:
          return routeName + '未开始。';
      }
    default:
      return routeName + '未开始。';
  }
}

export function getRouteStageMomentText(routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff'): string {
  switch (routeId) {
    case 'crit':
      switch (stage) {
        case 'starter':
          return '暴击起手';
        case 'bridge':
          return '暴击进行中';
        case 'payoff':
          return '暴击已完成';
        default:
          return '暴击阶段变化';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return '穿透起手';
        case 'bridge':
          return '穿透进行中';
        case 'payoff':
          return '穿透已完成';
        default:
          return '穿透阶段变化';
      }
    case 'dash':
      switch (stage) {
        case 'starter':
          return '穿梭起手';
        case 'bridge':
          return '穿梭进行中';
        case 'payoff':
          return '穿梭已完成';
        default:
          return '穿梭阶段变化';
      }
    default:
      return '流派阶段变化';
  }
}

function getRouteName(routeId: RouteId): string {
  const names: Record<RouteId, string> = {
    crit: '暴击',
    pierce: '穿透',
    dash: '穿梭',
  };
  return names[routeId];
}
