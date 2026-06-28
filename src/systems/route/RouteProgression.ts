import { ROUTE_VISUAL_MAP } from '../../data/routes';
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
      return '起势';
    case 'committed':
      return '站稳';
    case 'matured':
      return '发力';
    default:
      return '未起势';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '未起势',
      hinted: '起势',
      committed: '站稳',
      matured: '发力',
    },
    pierce: {
      unformed: '未起势',
      hinted: '起势',
      committed: '连上',
      matured: '贯通',
    },
    dash: {
      unformed: '未起势',
      hinted: '起势',
      committed: '贴身',
      matured: '发力',
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
          return '◆ ' + routeName + '起势：先盯一个。';
        case 'committed':
          return '◆ ' + routeName + '站稳：连打更重。';
        case 'matured':
          return '◆ ' + routeName + '发力：一波更容易炸开。';
        default:
          return routeName + '还没起势。';
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return '║ ' + routeName + '起势：先找直线。';
        case 'committed':
          return '║ ' + routeName + '站稳：前排会慢慢开。';
        case 'matured':
          return '║ ' + routeName + '发力：后面也会一起掉。';
        default:
          return routeName + '还没起势。';
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return '◌ ' + routeName + '起势：先贴身。';
        case 'committed':
          return '◌ ' + routeName + '站稳：贴身后还能接着打。';
        case 'matured':
          return '◌ ' + routeName + '发力：贴身后更容易清场。';
        default:
          return routeName + '还没起势。';
      }
    default:
      return routeName + '还没起势。';
  }
}

export function getRouteStageMomentText(routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff'): string {
  switch (routeId) {
    case 'crit':
      switch (stage) {
        case 'starter':
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击起势`;
        case 'bridge':
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击接上`;
        case 'payoff':
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击发力`;
        default:
          return '暴击变化';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return `${ROUTE_VISUAL_MAP.pierce.icon} 穿透起势`;
        case 'bridge':
          return `${ROUTE_VISUAL_MAP.pierce.icon} 穿透接上`;
        case 'payoff':
          return `${ROUTE_VISUAL_MAP.pierce.icon} 穿透打穿`;
        default:
          return '穿透变化';
      }
    case 'dash':
      switch (stage) {
        case 'starter':
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭起势`;
        case 'bridge':
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭贴身`;
        case 'payoff':
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭发力`;
        default:
          return '穿梭变化';
      }
    default:
      return '路线变化';
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
