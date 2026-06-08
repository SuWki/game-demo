import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

export class DashRoutePassive {
  updatePassiveTimers(battle: BattleState, dt: number): void {
    battle.dashMomentumDecaySec = Math.max(0, battle.dashMomentumDecaySec - dt);
    if (battle.dashMomentumDecaySec === 0) {
      battle.dashMomentumStacks = 0;
    }
    battle.dashCounterWindowSec = Math.max(0, battle.dashCounterWindowSec - dt);
  }

  applyDashPassiveOnDash(battle: BattleState, dashStage: RouteBuildStage): void {
    if (dashStage === 'committed' || dashStage === 'matured') {
      battle.dashGhostStrikeReady = true;
      battle.dashMomentumStacks = Math.min(5, battle.dashMomentumStacks + 1);
      battle.dashMomentumDecaySec = 2.0;
    }
  }

  applyDashPassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    dashStage: RouteBuildStage,
  ): void {
    if (battle.dashCounterWindowSec > 0 && enemy.dashMarkSec > 0) {
      enemy.routeHitFlashSec = 0.14;
      enemy.routeHitKind = 'dash';
    }
  }

  isActive(run: RunState): boolean {
    return run.routeCounts.dash > 0;
  }

  getVisualState(battle: BattleState): { indicators: Array<{ type: string; count: number; maxCount: number; active: boolean; color: number }> } {
    return {
      indicators: [
        {
          type: 'arrows',
          count: battle.dashMomentumStacks,
          maxCount: 5,
          active: battle.dashMomentumStacks > 0,
          color: 0x9cff97,
        },
      ],
    };
  }
}
