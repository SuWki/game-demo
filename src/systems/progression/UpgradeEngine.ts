import type { RunState, PlayerStats, StatModifiers } from '../../game/types';
import { clamp } from '../../data/balance';

export interface UpgradeEngineDeps {
  state: RunState;
  applyModifiers: (modifiers: Partial<PlayerStats>) => void;
  advanceRoute: (routeId: string, meta?: { pickId: string }) => void;
  getDominantRoute: () => string | null;
  activateRoutePerkFromTags: (tags?: string[]) => void;
  recordBranchSwitch: (from: string, to: string, meta: { phase: string; pickId: string }) => void;
}

export function applyEffects(
  deps: UpgradeEngineDeps,
  effects: Array<{ type: string; modifiers?: StatModifiers; amount?: number; routeId?: string }>,
  meta?: { pickId: string },
): void {
  const previousDominantRoute = deps.getDominantRoute();
  const maturedRouteBefore = deps.state.maturedRoute;
  let routeAdvanced = false;

  for (const effect of effects) {
    if (effect.type === 'stats' && effect.modifiers) {
      deps.applyModifiers(effect.modifiers);
      continue;
    }

    if (effect.type === 'heal' && effect.amount !== undefined) {
      deps.state.stats.hp = clamp(deps.state.stats.hp + effect.amount, 0, deps.state.stats.maxHp);
      continue;
    }

    if (effect.routeId) {
      const routeId = effect.routeId === 'dominant' ? deps.getDominantRoute() : effect.routeId;
      if (routeId) {
        deps.advanceRoute(routeId, meta);
        routeAdvanced = true;
      }
    }
  }

  if (!routeAdvanced || !previousDominantRoute) {
    return;
  }

  const nextDominantRoute = deps.getDominantRoute();
  if (
    nextDominantRoute &&
    nextDominantRoute !== previousDominantRoute &&
    !maturedRouteBefore
  ) {
    deps.recordBranchSwitch(previousDominantRoute, nextDominantRoute, {
      phase: deps.state.phase,
      pickId: meta?.pickId ?? 'route-effect',
    });
  }
}
