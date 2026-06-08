import type { BattleState, EnemyState, RouteBuildStage, RouteId, RunState } from '../../game/types';

export interface RoutePassiveContext {
  battle: BattleState;
  run: RunState;
  dt: number;
}

export interface HitContext extends RoutePassiveContext {
  damage: number;
  isCrit: boolean;
  target: EnemyState;
}

export interface KillContext extends RoutePassiveContext {
  enemy: EnemyState;
  wasCrit: boolean;
  wasPierce: boolean;
  wasDash: boolean;
}

export interface DashContext extends RoutePassiveContext {
  // Dash specific context
}

export interface RouteVisualState {
  indicators: RouteIndicator[];
}

export interface RouteIndicator {
  type: 'dots' | 'diamonds' | 'arrows' | 'ring';
  count: number;
  maxCount: number;
  active: boolean;
  color: number;
  label?: string;
}

export interface IRoutePassive {
  readonly routeId: RouteId;
  onHit(ctx: HitContext): void;
  onKill(ctx: KillContext): void;
  onDash(ctx: DashContext): void;
  onUpdate(ctx: RoutePassiveContext): void;
  getVisualState(battle: BattleState): RouteVisualState;
  isActive(run: RunState): boolean;
}
