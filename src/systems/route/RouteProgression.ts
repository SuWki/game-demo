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
      return '???';
    case 'committed':
      return '???';
    case 'matured':
      return '???';
    default:
      return '???';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '?????',
      hinted: '?????',
      committed: '????',
      matured: '????',
    },
    pierce: {
      unformed: '???',
      hinted: '?????',
      committed: '????',
      matured: '????',
    },
    dash: {
      unformed: '???',
      hinted: '????',
      committed: '????',
      matured: '????',
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
          return routeName + '????????????????????';
        case 'committed':
          return routeName + '?????????????';
        case 'matured':
          return routeName + '??????????????';
        default:
          return routeName + '????';
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return routeName + '????????????????';
        case 'committed':
          return routeName + '?????????????';
        case 'matured':
          return routeName + '?????????????????';
        default:
          return routeName + '????';
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return routeName + '????????????????';
        case 'committed':
          return routeName + '???????????????';
        case 'matured':
          return routeName + '?????????????';
        default:
          return routeName + '????';
      }
    default:
      return routeName + '??????';
  }
}

export function getRouteStageMomentText(routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff'): string {
  switch (routeId) {
    case 'crit':
      switch (stage) {
        case 'starter':
          return '????????????';
        case 'bridge':
          return '???????????????';
        case 'payoff':
          return '??????????????';
        default:
          return '???????';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return '????????????????';
        case 'bridge':
          return '?????????????????';
        case 'payoff':
          return '????????????';
        default:
          return '???????';
      }
    case 'dash':
      switch (stage) {
        case 'starter':
          return '?????????????';
        case 'bridge':
          return '??????????????';
        case 'payoff':
          return '??????????????';
        default:
          return '???????';
      }
    default:
      return '????????';
  }
}

function getRouteName(routeId: RouteId): string {
  const names: Record<RouteId, string> = {
    crit: '??',
    pierce: '??',
    dash: '??',
  };
  return names[routeId];
}
