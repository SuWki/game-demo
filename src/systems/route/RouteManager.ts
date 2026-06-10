import type { BattleState } from '../../game/types';
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
}
