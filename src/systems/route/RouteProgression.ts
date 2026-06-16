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
      return '初具方向';
    case 'committed':
      return '开始成型';
    case 'matured':
      return '已经成型';
    default:
      return '尚未成型';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '尚未成型',
      hinted: '初具方向',
      committed: '开始成型',
      matured: '已经成型',
    },
    pierce: {
      unformed: '尚未成型',
      hinted: '初具方向',
      committed: '开始成型',
      matured: '已经成型',
    },
    dash: {
      unformed: '尚未成型',
      hinted: '初具方向',
      committed: '开始成型',
      matured: '已经成型',
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
          return routeName + '开始连起来了：抓住时机就能打出一串重击。';
        case 'committed':
          return routeName + '已经连起来了：先把破绽叠高。';
        case 'matured':
          return routeName + '已经成型了：一串串重击炸开。';
        default:
          return routeName + '尚未成型。';
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return routeName + '开始连起来了：前排会慢慢给后排让路。';
        case 'committed':
          return routeName + '已经连起来了：子弹会一路带过去。';
        case 'matured':
          return routeName + '已经成型了：子弹一路穿到后排。';
        default:
          return routeName + '尚未成型。';
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return routeName + '开始连起来了：先把换位和回打接上。';
        case 'committed':
          return routeName + '已经连起来了：贴身后更容易回打。';
        case 'matured':
          return routeName + '已经成型了：贴身一圈就能收人。';
        default:
          return routeName + '尚未成型。';
      }
    default:
      return routeName + '尚未成型。';
  }
}

export function getRouteStageMomentText(routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff'): string {
  switch (routeId) {
    case 'crit':
      switch (stage) {
        case 'starter':
          return '暴击开始连起来了';
        case 'bridge':
          return '暴击已经连起来了';
        case 'payoff':
          return '暴击已经成型了';
        default:
          return '暴击阶段变化';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return '穿透开始连起来了';
        case 'bridge':
          return '穿透已经连起来了';
        case 'payoff':
          return '穿透已经成型了';
        default:
          return '穿透阶段变化';
      }
    case 'dash':
      switch (stage) {
        case 'starter':
          return '穿梭开始连起来了';
        case 'bridge':
          return '穿梭已经连起来了';
        case 'payoff':
          return '穿梭已经成型了';
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
