import type { BattleState, RunState } from '../../game/types';
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
  }

  getCritPassive(): CritRoutePassive {
    return this.critPassive;
  }

  getPiercePassive(): PierceRoutePassive {
    return this.piercePassive;
  }

  getDashPassive(): DashRoutePassive {
    return this.dashPassive;
  }

  isActive(routeId: 'crit' | 'pierce' | 'dash', run: RunState): boolean {
    switch (routeId) {
      case 'crit':
        return this.critPassive.isActive(run);
      case 'pierce':
        return this.piercePassive.isActive(run);
      case 'dash':
        return this.dashPassive.isActive(run);
    }
  }
}
