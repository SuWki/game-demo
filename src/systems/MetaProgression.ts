import type { OverlayMetaSummary, RouteId, RunResult } from '../game/types';
import { ROUTE_NAME_MAP } from '../data/routes';

const META_STORAGE_KEY = 'pilot_meta_progress_v1';

interface MetaState {
  totalRuns: number;
  wins: number;
  lastRoute: RouteId | null;
  lastDurationSec: number;
}

export class MetaProgression {
  private readonly storage: Storage;

  private state: MetaState;

  public constructor(storage: Storage) {
    this.storage = storage;
    this.state = this.load();
  }

  public getSummary(): OverlayMetaSummary {
    return {
      totalRuns: this.state.totalRuns,
      wins: this.state.wins,
      lastRouteName: this.state.lastRoute ? ROUTE_NAME_MAP[this.state.lastRoute] : '未成型',
      lastRouteId: this.state.lastRoute,
      lastDurationSec: this.state.lastDurationSec,
    };
  }

  public getTotalRuns(): number {
    return this.state.totalRuns;
  }

  public recordRun(result: RunResult): void {
    this.state.totalRuns += 1;
    if (result.outcome === 'victory') {
      this.state.wins += 1;
    }
    this.state.lastRoute = result.routeId;
    this.state.lastDurationSec = result.runDurationSec;
    this.persist();
  }

  private load(): MetaState {
    const raw = this.storage.getItem(META_STORAGE_KEY);
    if (!raw) {
      return {
        totalRuns: 0,
        wins: 0,
        lastRoute: null,
        lastDurationSec: 0,
      };
    }

    try {
      return JSON.parse(raw) as MetaState;
    } catch {
      return {
        totalRuns: 0,
        wins: 0,
        lastRoute: null,
        lastDurationSec: 0,
      };
    }
  }

  private persist(): void {
    this.storage.setItem(META_STORAGE_KEY, JSON.stringify(this.state));
  }
}
