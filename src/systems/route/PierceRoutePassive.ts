import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

export class PierceRoutePassive {
  updatePassiveTimers(battle: BattleState, dt: number): void {
    battle.pierceChainDecaySec = Math.max(0, battle.pierceChainDecaySec - dt);
    if (battle.pierceChainDecaySec === 0) {
      battle.pierceChainStacks = 0;
    }
  }

  applyPiercePassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bulletHitCount: number,
    pierceStage: RouteBuildStage,
  ): void {
    if (pierceStage === 'committed' || pierceStage === 'matured') {
      if (bulletHitCount > 1) {
        battle.pierceFractureMark.add(enemy.id);
        battle.pierceChainStacks = Math.min(3, battle.pierceChainStacks + 1);
        battle.pierceChainDecaySec = 2.0;

        if (battle.pierceChainStacks >= 3) {
          battle.pierceChainStacks = 0;
          battle.pierceChainDecaySec = 0;
        }
      }
    }
  }

  applyPiercePassiveOnKill(battle: BattleState, enemy: BattleState['enemies'][number], pierceStage: RouteBuildStage): void {
    if (pierceStage === 'matured' && battle.pierceFractureMark.has(enemy.id)) {
      const spreadRadius = 120;
      battle.enemies.forEach((target) => {
        if (target.id === enemy.id || target.hp <= 0) return;
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= spreadRadius) {
          battle.pierceFractureMark.add(target.id);
          target.hitFlashSec = 0.12;
        }
      });
    }
  }

  isActive(run: RunState): boolean {
    return run.routeCounts.pierce > 0;
  }

  getVisualState(battle: BattleState): { indicators: Array<{ type: string; count: number; maxCount: number; active: boolean; color: number }> } {
    return {
      indicators: [
        {
          type: 'diamonds',
          count: battle.pierceChainStacks,
          maxCount: 3,
          active: battle.pierceChainStacks > 0,
          color: 0x68d4ff,
        },
      ],
    };
  }
}
