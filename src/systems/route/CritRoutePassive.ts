import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

export class CritRoutePassive {
  updatePassiveTimers(battle: BattleState, dt: number): void {
    battle.critComboDecaySec = Math.max(0, battle.critComboDecaySec - dt);
    if (battle.critComboDecaySec === 0) {
      battle.critComboStacks = 0;
      battle.critFinisherReady = false;
    }
    battle.critBurstChainSec = Math.max(0, battle.critBurstChainSec - dt);
    if (battle.critBurstChainSec === 0) {
      battle.critBurstChainCount = 0;
    }
    battle.critFocusLockSec = Math.max(0, battle.critFocusLockSec - dt);
    if (
      battle.critFocusTargetId !== null &&
      (battle.critFocusLockSec <= 0 || !battle.enemies.some((enemy) => enemy.id === battle.critFocusTargetId && enemy.hp > 0))
    ) {
      battle.critFocusTargetId = null;
      battle.critFocusLockSec = 0;
    }
    battle.critBurstBonusSec = Math.max(0, battle.critBurstBonusSec - dt);
  }

  applyCritPassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    critical: boolean,
    bulletDamage: number,
    critStage: RouteBuildStage,
  ): { damage: number; shouldPlayAudio: boolean } {
    let damage = bulletDamage;
    let shouldPlayAudio = false;

    if (critStage === 'committed' || critStage === 'matured') {
      if (!critical) {
        battle.critComboStacks = Math.min(5, battle.critComboStacks + 1);
        battle.critComboDecaySec = 2.0;
        if (battle.critComboStacks >= 5) {
          battle.critFinisherReady = true;
        }
      } else {
        if (battle.critFinisherReady) {
          damage *= 2.5;
          battle.critFinisherReady = false;
          battle.critComboStacks = 0;
          battle.critComboDecaySec = 0;
          battle.critBurstChainCount = 0;
          battle.critBurstChainSec = 2.0;
        } else if (battle.critBurstChainSec > 0 && battle.critBurstChainCount < 3) {
          damage *= 1.3;
          battle.critBurstChainCount += 1;
        }
        battle.critComboDecaySec = 2.0;
      }
    }

    return { damage, shouldPlayAudio };
  }

  applyCritPassiveOnKill(battle: BattleState, enemy: BattleState['enemies'][number], critStage: RouteBuildStage): void {
    if (critStage === 'committed' || critStage === 'matured') {
      battle.critOverdriveSec = Math.min(4.2, battle.critOverdriveSec + (enemy.elite ? 0.42 : 0.18));
    }
  }

  isActive(run: RunState): boolean {
    return run.routeCounts.crit > 0;
  }

  getVisualState(battle: BattleState): { indicators: Array<{ type: string; count: number; maxCount: number; active: boolean; color: number }> } {
    return {
      indicators: [
        {
          type: 'dots',
          count: battle.critComboStacks,
          maxCount: 5,
          active: battle.critComboStacks > 0,
          color: 0xff8f70,
        },
      ],
    };
  }
}
