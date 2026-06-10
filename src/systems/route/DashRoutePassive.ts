import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

export class DashRoutePassive {
  updatePassiveTimers(battle: BattleState, dt: number): void {
    battle.dashMomentumDecaySec = Math.max(0, battle.dashMomentumDecaySec - dt);
    if (battle.dashMomentumDecaySec === 0) {
      battle.dashMomentumStacks = 0;
    }
    battle.dashCounterWindowSec = Math.max(0, battle.dashCounterWindowSec - dt);
    battle.dashConsecutiveWindowSec = Math.max(0, battle.dashConsecutiveWindowSec - dt);
    if (battle.dashConsecutiveWindowSec === 0) {
      battle.dashConsecutiveCount = 0;
    }
    for (const afterimage of battle.dashAfterimages) {
      afterimage.lifeSec = Math.max(0, afterimage.lifeSec - dt);
    }
    battle.dashAfterimages = battle.dashAfterimages.filter((afterimage) => afterimage.lifeSec > 0);
  }

  applyDashPassiveOnDash(battle: BattleState, dashStage: RouteBuildStage): void {
    const chainActive = battle.dashConsecutiveWindowSec > 0;
    battle.dashConsecutiveCount = chainActive ? Math.min(3, battle.dashConsecutiveCount + 1) : 1;
    battle.dashConsecutiveWindowSec = dashStage === 'matured' ? 2.2 : dashStage === 'committed' ? 2.0 : 1.6;
    if (dashStage === 'committed' || dashStage === 'matured') {
      battle.dashGhostStrikeReady = true;
      battle.dashMomentumStacks = Math.min(5, battle.dashMomentumStacks + 1);
      battle.dashMomentumDecaySec = 2.0;
      if (battle.dashConsecutiveCount >= 2) {
        battle.dashMomentumStacks = Math.min(5, battle.dashMomentumStacks + 1);
        battle.dashMomentumDecaySec = Math.max(battle.dashMomentumDecaySec, 2.2);
      }
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
      battle.dashAfterimages.push({
        x: enemy.x,
        y: enemy.y,
        lifeSec: dashStage === 'matured' ? 0.8 : dashStage === 'committed' ? 0.64 : 0.48,
        damage: Math.max(2, 2 + battle.dashConsecutiveCount + (enemy.elite ? 1 : 0)),
      });
      if (battle.dashAfterimages.length > 8) {
        battle.dashAfterimages.shift();
      }
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
