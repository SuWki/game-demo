import type { AudioCue, PhaseId, RouteBuildStage, RouteId, RunState } from '../../game/types';

const ROUTE_COMMIT_THRESHOLD = 3;
const ROUTE_MATURE_THRESHOLD = 5;

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

  const otherCounts = Object.entries(deps.state.routeCounts)
    .filter(([candidateRouteId]) => candidateRouteId !== routeId)
    .map(([, value]) => value);

  if (
    !deps.state.committedRoute &&
    count >= ROUTE_COMMIT_THRESHOLD &&
    otherCounts.every((value) => count >= value + 1)
  ) {
    deps.state.committedRoute = routeId;
    deps.markRouteCommitted(routeId, {
      phase: deps.state.phase,
      pickId: meta?.pickId ?? `route:${routeId}`,
    });
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'bridge'));
    deps.enqueueTip(deps.getRouteStageNarrative(routeId, 'committed'));
  }

  if (
    !deps.state.maturedRoute &&
    count >= ROUTE_MATURE_THRESHOLD &&
    otherCounts.every((value) => count >= value + 1)
  ) {
    deps.state.maturedRoute = routeId;
    deps.markRouteMatured(routeId);
    deps.enqueueAudio('routeMatured');
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'payoff'));
    deps.enqueueTip(deps.getRouteMatureHint(routeId));
  }
}

export function getRouteBuildStage(state: RunState, routeId: RouteId): RouteBuildStage {
  if (state.maturedRoute === routeId) {
    return 'matured';
  }
  if (state.committedRoute === routeId) {
    return 'committed';
  }
  if (state.routeCounts[routeId] > 0) {
    return 'hinted';
  }
  return 'unformed';
}

export function getBuildStageLabel(buildStage: RouteBuildStage): string {
  switch (buildStage) {
    case 'hinted':
      return '已出倾向';
    case 'committed':
      return '开始站稳';
    case 'matured':
      return '已经打顺';
    default:
      return '未站稳';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '没打顺',
      hinted: '开始连上',
      committed: '火力压住了',
      matured: '一串串炸开',
    },
    pierce: {
      unformed: '没打顺',
      hinted: '前排开始松动',
      committed: '火力压到后排',
      matured: '一路穿过去了',
    },
    dash: {
      unformed: '没打顺',
      hinted: '开始贴近',
      committed: '贴身能回打',
      matured: '贴身就能收人',
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
          return `${routeName}开始顺手了，先把破绽挂稳`;
        case 'committed':
          return `${routeName}已经连起来了，连着打会更疼`;
        case 'matured':
          return `${routeName}已经压住了，连打时会一串串炸开`;
        default:
          return `${routeName}还没站稳`;
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return `${routeName}开始顺手了，子弹能先穿开前排`;
        case 'committed':
          return `${routeName}已经连起来了，前排一散后排就露出来`;
        case 'matured':
          return `${routeName}已经压住了，子弹会直接带到后排`;
        default:
          return `${routeName}还没站稳`;
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return `${routeName}开始顺手了，先贴近再找回手`;
        case 'committed':
          return `${routeName}已经连起来了，贴住后还能回打`;
        case 'matured':
          return `${routeName}已经压住了，贴身一圈就能收人`;
        default:
          return `${routeName}还没站稳`;
      }
    default:
      return `${routeName}已经打顺了`;
  }
}

export function getRouteStageMomentText(routeId: RouteId, stage: 'starter' | 'bridge' | 'payoff'): string {
  switch (routeId) {
    case 'crit':
      switch (stage) {
        case 'starter':
          return '暴击开始连上了：破绽会越挂越稳';
        case 'bridge':
          return '暴击改打法了：先盯厚血目标压，破绽会溅到旁边';
        case 'payoff':
          return '暴击打疯了：连打会一串串炸开';
        default:
          return '暴击开始起势了';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return '穿透开始找上线了：前排会先被打散';
        case 'bridge':
          return '穿透接起来了：前排一散，后排就会掉血';
        case 'payoff':
          return '穿透打穿了：子弹会直接带到后排';
        default:
          return '穿透开始起势了';
      }
    case 'dash':
      switch (stage) {
        case 'starter':
          return '穿梭开始贴近了：先贴近，再回打';
        case 'bridge':
          return '穿梭接起来了：贴住后还能补一轮';
        case 'payoff':
          return '穿梭压住了：一圈就能收人';
        default:
          return '穿梭开始起势了';
      }
    default:
      return '这套开始打顺了';
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
