import type { BattleState, RouteBuildStage } from '../../game/types';
import { CritRoutePassive } from './CritRoutePassive';
import { PierceRoutePassive } from './PierceRoutePassive';
import { DashRoutePassive } from './DashRoutePassive';

export class RouteManager {
  private critPassive: CritRoutePassive;
  private piercePassive: PierceRoutePassive;
  private dashPassive: DashRoutePassive;

  constructor() {
    this.critPassive = new CritRoutePassive();
    this.piercePassive = new PierceRoutePassive();
    this.dashPassive = new DashRoutePassive();
  }

  updatePassiveTimers(battle: BattleState, dt: number): void {
    this.critPassive.updatePassiveTimers(battle, dt);
    this.piercePassive.updatePassiveTimers(battle, dt);
    this.dashPassive.updatePassiveTimers(battle, dt);
    // committed 阶段裂纹引爆冷却递减
    this.piercePassive.tickDetonateCooldowns(battle, dt);
  }

  applyDashPassiveOnDash(battle: BattleState, dashStage: RouteBuildStage): void {
    this.dashPassive.applyDashPassiveOnDash(battle, dashStage);
  }

  /** 穿透路线命中处理：连锁累积 + committed 裂纹引爆 + 满层连锁爆发。返回最终伤害与可选引爆信息。 */
  applyPiercePassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bulletHitCount: number,
    bulletDamage: number,
    pierceStage: RouteBuildStage,
  ): { damage: number; detonate?: { x: number; y: number; radius: number; ratio: number }; chainBurst?: boolean } {
    return this.piercePassive.applyPiercePassiveOnHit(battle, enemy, bulletHitCount, bulletDamage, pierceStage);
  }

  applyDashPassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    dashStage: RouteBuildStage,
  ): void {
    this.dashPassive.applyDashPassiveOnHit(battle, enemy, dashStage);
  }

  /** 暴击路线命中处理：破绽累积 + 终结打击 + 爆发连锁 + 锁定增益。 */
  applyCritPassiveOnHit(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    critical: boolean,
    bulletDamage: number,
    critStage: RouteBuildStage,
  ): number {
    return this.critPassive.applyCritPassiveOnHit(battle, enemy, critical, bulletDamage, critStage);
  }
}
