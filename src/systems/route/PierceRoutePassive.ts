import {
  PIERCE_CHAIN_BURST_BONUS_RATIO,
  PIERCE_CHAIN_BURST_DAMAGE_MULTIPLIER,
  PIERCE_CHAIN_DECAY_SEC,
  PIERCE_CHAIN_MAX_STACKS,
  PIERCE_FRACTURE_DETONATE_COOLDOWN_SEC,
  PIERCE_FRACTURE_DETONATE_RADIUS,
  PIERCE_FRACTURE_DETONATE_RATIO,
  PIERCE_FRACTURE_SPREAD_RADIUS,
} from '../../data/balance';
import type { BattleState, RouteBuildStage, RunState } from '../../game/types';

/** 穿透路线被动：连锁累积 + committed 裂纹引爆 + matured 击杀扩散的唯一真相源。 */
export class PierceRoutePassive {
  updatePassiveTimers(battle: BattleState, dt: number): void {
    battle.pierceChainDecaySec = Math.max(0, battle.pierceChainDecaySec - dt);
    if (battle.pierceChainDecaySec === 0) {
      battle.pierceChainStacks = 0;
    }
  }

  /**
   * 穿透命中处理 — 唯一真相源。
   *
   * committed/matured 阶段，对穿透命中（bulletHitCount > 1）：
   * - 标记敌人（裂纹）
   * - 累积连锁层（最多 PIERCE_CHAIN_MAX_STACKS）
   * - 满 PIERCE_CHAIN_MAX_STACKS 时触发连锁爆发（×PIERCE_CHAIN_BURST_DAMAGE_MULTIPLIER + 直接扣血）
   *
   * committed 阶段独有：对已带裂纹标记的敌人再次穿透命中时**引爆**裂纹，
   *   造成 PIERCE_FRACTURE_DETONATE_RADIUS 半径内的 AOE 伤害（PIERCE_FRACTURE_DETONATE_RATIO）。
   *   每个 enemy 有 PIERCE_FRACTURE_DETONATE_COOLDOWN_SEC 冷却避免反复引爆。
   *
   * 返回修改后的伤害值（已含连锁爆发倍率）。引爆产生的 AOE 伤害由调用方
   *   通过返回的 `detonateInfo` 在 RunEngine 中应用（因为需要 enemy 集合访问）。
   */
  applyPiercePassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bulletHitCount: number,
    bulletDamage: number,
    pierceStage: RouteBuildStage,
  ): { damage: number; detonate?: { x: number; y: number; radius: number; ratio: number }; chainBurst?: boolean } {
    if (pierceStage !== 'committed' && pierceStage !== 'matured') {
      return { damage: bulletDamage };
    }

    if (bulletHitCount <= 1) {
      return { damage: bulletDamage };
    }

    let damage = bulletDamage;
    let chainBurst = false;

    // 标记敌人 + 累积连锁层
    const wasMarked = battle.pierceFractureMark.has(enemy.id);
    battle.pierceFractureMark.add(enemy.id);
    battle.pierceChainStacks = Math.min(PIERCE_CHAIN_MAX_STACKS, battle.pierceChainStacks + 1);
    battle.pierceChainDecaySec = PIERCE_CHAIN_DECAY_SEC;

    // 连锁爆发：满层时额外伤害
    if (battle.pierceChainStacks >= PIERCE_CHAIN_MAX_STACKS) {
      damage *= PIERCE_CHAIN_BURST_DAMAGE_MULTIPLIER;
      const bonusDamage = damage * PIERCE_CHAIN_BURST_BONUS_RATIO;
      enemy.hp -= bonusDamage;
      battle.pierceChainStacks = 0;
      battle.pierceChainDecaySec = 0;
      chainBurst = true;
    }

    // committed 阶段独有：对已带标记的敌人再次穿透命中时引爆裂纹
    // 已标记 + 冷却结束 → 触发 AOE 引爆
    let detonate: { x: number; y: number; radius: number; ratio: number } | undefined;
    if (pierceStage === 'committed' && wasMarked) {
      const lastDetonateSec = enemy.pierceFractureDetonateSec ?? 0;
      if (lastDetonateSec <= 0) {
        enemy.pierceFractureDetonateSec = PIERCE_FRACTURE_DETONATE_COOLDOWN_SEC;
        detonate = {
          x: enemy.x,
          y: enemy.y,
          radius: PIERCE_FRACTURE_DETONATE_RADIUS,
          ratio: PIERCE_FRACTURE_DETONATE_RATIO,
        };
      }
    }

    return { damage, detonate, chainBurst };
  }

  /** RunEngine 每帧调用，递减引爆冷却。 */
  tickDetonateCooldowns(battle: BattleState, dt: number): void {
    for (const enemy of battle.enemies) {
      const detonateSec = enemy.pierceFractureDetonateSec;
      if (detonateSec && detonateSec > 0) {
        enemy.pierceFractureDetonateSec = Math.max(0, detonateSec - dt);
      }
    }
  }

  applyPiercePassiveOnKill(battle: BattleState, enemy: BattleState['enemies'][number], pierceStage: RouteBuildStage): void {
    if (pierceStage === 'matured' && battle.pierceFractureMark.has(enemy.id)) {
      battle.enemies.forEach((target) => {
        if (target.id === enemy.id || target.hp <= 0) return;
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= PIERCE_FRACTURE_SPREAD_RADIUS) {
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
          maxCount: PIERCE_CHAIN_MAX_STACKS,
          active: battle.pierceChainStacks > 0,
          color: 0x68d4ff,
        },
      ],
    };
  }
}
