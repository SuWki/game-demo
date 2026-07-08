import { ROUTE_VISUAL_MAP } from '../../data/routes';
import type { AudioCue, PhaseId, RouteBuildStage, RouteId, RunState } from '../../game/types';

/** 各阶段解锁所需的最小流派计数 */
export const ROUTE_STAGE_THRESHOLDS: Record<Exclude<RouteBuildStage, 'unformed'>, number> = {
  hinted: 2,
  committed: 5,
  matured: 8,
};

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

  if (count === ROUTE_STAGE_THRESHOLDS.hinted) {
    deps.markRouteHint(routeId);
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'starter'));
  }

  if (!deps.firstRouteHintRecorded && count >= 1) {
    deps.setFirstRouteHintRecorded(true);
    deps.markFirstRouteHint(routeId);
    deps.enqueueTip(deps.getRouteShortHint(routeId));
  }

  if (count === ROUTE_STAGE_THRESHOLDS.committed && deps.state.committedRoute !== routeId) {
    deps.state.committedRoute = routeId;
    deps.markRouteCommitted(routeId, {
      phase: deps.state.phase,
      pickId: meta?.pickId ?? `route:${routeId}`,
    });
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'bridge'));
    deps.enqueueTip(deps.getRouteStageNarrative(routeId, 'committed'));
  }

  if (count >= ROUTE_STAGE_THRESHOLDS.matured && deps.state.maturedRoute !== routeId) {
    deps.state.maturedRoute = routeId;
    deps.markRouteMatured(routeId);
    deps.enqueueAudio('routeMatured');
    deps.queueRouteMoment(routeId, deps.getRouteStageMomentText(routeId, 'payoff'));
    deps.enqueueTip(deps.getRouteMatureHint(routeId));
  }
}

export function getRouteBuildStage(state: RunState, routeId: RouteId): RouteBuildStage {
  const count = state.routeCounts[routeId];
  if (count >= ROUTE_STAGE_THRESHOLDS.matured || state.maturedRoute === routeId) {
    return 'matured';
  }
  if (count >= ROUTE_STAGE_THRESHOLDS.committed || state.committedRoute === routeId) {
    return 'committed';
  }
  if (count >= ROUTE_STAGE_THRESHOLDS.hinted) {
    return 'hinted';
  }
  return 'unformed';
}

/** 返回当前流派构筑进度信息，用于 UI 显示 */
export function getRouteBuildProgressInfo(state: RunState, routeId: RouteId): {
  count: number;
  currentStage: RouteBuildStage;
  nextThreshold: number | null;
  /** 下一个阶段的 ID，如 'hinted' | 'committed' | 'matured' */
  nextStageId: Exclude<RouteBuildStage, 'unformed'> | null;
  /** 下一个阶段的中文标签，如 '初现' | '成型' | '成型' */
  nextStageName: string | null;
} {
  const count = state.routeCounts[routeId];
  const currentStage = getRouteBuildStage(state, routeId);
  let nextThreshold: number | null = null;
  let nextStageId: Exclude<RouteBuildStage, 'unformed'> | null = null;
  let nextStageName: string | null = null;
  if (count < ROUTE_STAGE_THRESHOLDS.hinted) {
    nextThreshold = ROUTE_STAGE_THRESHOLDS.hinted;
    nextStageId = 'hinted';
    nextStageName = getBuildStageLabel('hinted');
  } else if (count < ROUTE_STAGE_THRESHOLDS.committed) {
    nextThreshold = ROUTE_STAGE_THRESHOLDS.committed;
    nextStageId = 'committed';
    nextStageName = getBuildStageLabel('committed');
  } else if (count < ROUTE_STAGE_THRESHOLDS.matured) {
    nextThreshold = ROUTE_STAGE_THRESHOLDS.matured;
    nextStageId = 'matured';
    nextStageName = getBuildStageLabel('matured');
  }
  return { count, currentStage, nextThreshold, nextStageId, nextStageName };
}

/** 返回指定流派在指定阶段解锁的效果描述，用于 tooltip */
export function getRouteStageUnlockDescription(routeId: RouteId, stage: Exclude<RouteBuildStage, 'unformed'>): string {
  const threshold = ROUTE_STAGE_THRESHOLDS[stage];
  let unlockText = '';
  switch (routeId) {
    case 'crit':
      if (stage === 'hinted') {
        unlockText = '暴击率小幅提升，超频时间延长';
      } else if (stage === 'committed') {
        unlockText = '超频期间额外暴击率 +8%，超频持续时间更长';
      } else {
        unlockText = '超频期间暴击命中溅射周围敌人（暴击溅射）';
      }
      break;
    case 'pierce':
      if (stage === 'hinted') {
        unlockText = '子弹可穿透敌人命中后排，穿透后伤害衰减更低';
      } else if (stage === 'committed') {
        unlockText = '穿透命中后概率标记敌人，标记敌人受伤加深（穿透印记）';
      } else {
        unlockText = '子弹回声数量大幅增加，一发变三发（回声分裂）';
      }
      break;
    case 'dash':
      if (stage === 'hinted') {
        unlockText = '冲刺触发脉冲伤害，贴身反打能力增强';
      } else if (stage === 'committed') {
        unlockText = '冲刺期间受伤大幅降低，脉冲回血启动';
      } else {
        unlockText = '脉冲伤害翻倍，擦弹范围更广，冲刺冷却更短';
      }
      break;
  }
  return `流派强化到达 ${threshold} 张解锁：${unlockText}`;
}

export function getBuildStageLabel(buildStage: RouteBuildStage): string {
  switch (buildStage) {
    case 'hinted':
      return '初现';
    case 'committed':
      return '成型';
    case 'matured':
      return '成型';
    default:
      return '未成型';
  }
}

export function getRouteStageLabel(routeId: RouteId, buildStage: RouteBuildStage): string {
  const labelMap: Record<RouteId, Record<RouteBuildStage, string>> = {
    crit: {
      unformed: '未成型',
      hinted: '初现',
      committed: '成型',
      matured: '成型',
    },
    pierce: {
      unformed: '未成型',
      hinted: '初现',
      committed: '连上',
      matured: '贯通',
    },
    dash: {
      unformed: '未成型',
      hinted: '初现',
      committed: '贴身',
      matured: '成型',
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
          return '◆ ' + routeName + '初现：先盯一个。';
        case 'committed':
          return '◆ ' + routeName + '成型：连续输出能力强化。';
        case 'matured':
          return '◆ ' + routeName + '成型：爆发伤害大幅提升。';
        default:
          return routeName + '尚未成型。';
      }
    case 'pierce':
      switch (buildStage) {
        case 'hinted':
          return '║ ' + routeName + '初现：先找直线。';
        case 'committed':
          return '║ ' + routeName + '成型：前排持续被突破。';
        case 'matured':
          return '║ ' + routeName + '成型：后排同时受到伤害。';
        default:
          return routeName + '尚未成型。';
      }
    case 'dash':
      switch (buildStage) {
        case 'hinted':
          return '◌ ' + routeName + '初现：先贴身。';
        case 'committed':
          return '◌ ' + routeName + '成型：贴身后可持续输出。';
        case 'matured':
          return '◌ ' + routeName + '成型：贴身输出能力大幅提升。';
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
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击初现`;
        case 'bridge':
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击接上`;
        case 'payoff':
          return `${ROUTE_VISUAL_MAP.crit.icon} 暴击成型`;
        default:
          return '暴击变化';
      }
    case 'pierce':
      switch (stage) {
        case 'starter':
          return `${ROUTE_VISUAL_MAP.pierce.icon} 穿透初现`;
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
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭初现`;
        case 'bridge':
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭贴身`;
        case 'payoff':
          return `${ROUTE_VISUAL_MAP.dash.icon} 穿梭成型`;
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
