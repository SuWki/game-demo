import {
  CRIT_BURST_CHAIN_DAMAGE_MULTIPLIER,
  CRIT_BURST_CHAIN_MAX_HITS,
  CRIT_BURST_CHAIN_WINDOW_SEC,
  CRIT_COMBO_DECAY_SEC,
  CRIT_COMBO_MAX_STACKS,
  CRIT_FINISHER_DAMAGE_MULTIPLIER,
  CRIT_FOCUS_LOCK_ACCUM_BASE_SEC,
  CRIT_FOCUS_LOCK_BASE_SEC,
  CRIT_FOCUS_LOCK_BURST_SEC,
  CRIT_FOCUS_LOCK_COMMITTED_BONUS,
  CRIT_FOCUS_LOCK_MATURED_BONUS,
  CRIT_FOCUS_LOCK_PER_STACK,
} from '../../data/balance';
import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

/** 暴击路线被动：破绽累积 + 终结打击 + 爆发连锁 + 锁定增益的唯一真相源。 */
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

  /**
   * 暴击路线命中处理 — 唯一真相源。
   *
   * RunEngine.updateBullets 中每次暴击/非暴击命中都应调用本方法。
   * 返回修改后的伤害值（已含终结打击 ×CRIT_FINISHER_DAMAGE_MULTIPLIER、爆发连锁 ×CRIT_BURST_CHAIN_DAMAGE_MULTIPLIER 系数）。
   */
  applyCritPassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    critical: boolean,
    bulletDamage: number,
    critStage: RouteBuildStage,
  ): number {
    if (critStage !== 'committed' && critStage !== 'matured') {
      return bulletDamage;
    }

    let damage = bulletDamage;

    if (!critical) {
      // 非暴击命中：累积破绽层数（最多 CRIT_COMBO_MAX_STACKS 层）
      battle.critComboStacks = Math.min(CRIT_COMBO_MAX_STACKS, battle.critComboStacks + 1);
      battle.critComboDecaySec = CRIT_COMBO_DECAY_SEC;
      if (battle.critComboStacks >= CRIT_COMBO_MAX_STACKS) {
        battle.critFinisherReady = true;
      }
      if (battle.critComboStacks >= 3) {
        const holdBoost = critStage === 'matured' ? CRIT_FOCUS_LOCK_MATURED_BONUS : CRIT_FOCUS_LOCK_COMMITTED_BONUS;
        battle.critFocusLockSec = Math.max(
          battle.critFocusLockSec,
          CRIT_FOCUS_LOCK_ACCUM_BASE_SEC + battle.critComboStacks * CRIT_FOCUS_LOCK_PER_STACK + holdBoost,
        );
      }
    } else {
      // 暴击命中
      if (battle.critFinisherReady) {
        // 终结打击：CRIT_COMBO_MAX_STACKS 层时暴击伤害 +150%
        damage *= CRIT_FINISHER_DAMAGE_MULTIPLIER;
        battle.critFinisherReady = false;
        battle.critComboStacks = 0;
        battle.critComboDecaySec = 0;
        battle.critBurstChainCount = 0;
        battle.critBurstChainSec = CRIT_BURST_CHAIN_WINDOW_SEC;
      } else if (battle.critBurstChainSec > 0 && battle.critBurstChainCount < CRIT_BURST_CHAIN_MAX_HITS) {
        // 爆发连锁：终结打击后窗口内每次暴击额外 +30% 伤害（最多 CRIT_BURST_CHAIN_MAX_HITS 次）
        damage *= CRIT_BURST_CHAIN_DAMAGE_MULTIPLIER;
        battle.critBurstChainCount += 1;
      }
      battle.critFocusLockSec = Math.max(
        battle.critFocusLockSec,
        battle.critBurstBonusSec > 0 || battle.critBurstChainSec > 0 ? CRIT_FOCUS_LOCK_BURST_SEC : CRIT_FOCUS_LOCK_BASE_SEC,
      );
      // 暴击也重置衰减计时器
      battle.critComboDecaySec = CRIT_COMBO_DECAY_SEC;
    }

    return damage;
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
          maxCount: CRIT_COMBO_MAX_STACKS,
          active: battle.critComboStacks > 0,
          color: 0xff8f70,
        },
      ],
    };
  }
}
