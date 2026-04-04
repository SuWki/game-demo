import type { BattleTemplateId, ContentTier, NodeType, PhaseId, RouteBuildStage, RouteId, RunEndingKind, RunOutcome } from '../game/types';

export const PILOT_METRICS_STORAGE_KEY = 'commercial_pilot_metrics_v1';

interface MetricEvent {
  name: string;
  at: string;
  runIndex: number | null;
  payload?: Record<string, unknown>;
}

interface MetricRunSummary {
  runIndex: number;
  startedAt: string;
  finishedAt?: string;
  outcome?: RunOutcome;
  routeId?: RouteId | null;
  buildStage?: RouteBuildStage;
  buildSummary?: string;
  endingKind?: RunEndingKind;
  endingReason?: string;
  finalNodeTitle?: string;
  durationSec?: number;
  battleWins?: number;
  nodesCleared?: number;
  firstCommitStage?: PhaseId;
  firstCommitPick?: string;
  branchSwitchCount?: number;
}

interface MetricSession {
  id: string;
  startedAt: string;
  events: MetricEvent[];
  runs: MetricRunSummary[];
}

interface MetricStore {
  version: 'v1';
  updatedAt: string;
  sessions: MetricSession[];
}

declare global {
  interface Window {
    __pilotMetrics: MetricStore;
    __exportPilotMetrics: () => string;
  }
}

export class MetricsTracker {
  private readonly storage: Storage;

  private readonly store: MetricStore;

  private readonly session: MetricSession;

  private sessionRunIndex = 0;

  private currentRunStartedAtMs = 0;

  private hintedRoutesInRun = new Set<RouteId>();

  private committedRouteInRun: RouteId | null = null;

  private maturedRouteInRun: RouteId | null = null;

  private firstCommitStageInRun: PhaseId | null = null;

  private firstCommitPickInRun: string | null = null;

  private branchSwitchCountInRun = 0;

  private runFinished = false;

  public constructor(storage: Storage) {
    this.storage = storage;
    this.store = this.load();
    this.session = {
      id: `session_${Date.now()}`,
      startedAt: new Date().toISOString(),
      events: [],
      runs: [],
    };
    this.store.sessions.push(this.session);
    this.record('session_start');
  }

  public attachToWindow(target: Window): void {
    target.__pilotMetrics = this.store;
    target.__exportPilotMetrics = () => {
      const content = JSON.stringify(this.store, null, 2);
      console.log(content);
      return content;
    };
  }

  public beginRunFromMenu(): void {
    this.record('click_start_game');
    if (this.isReplayAfterFirstRun()) {
      this.record('restart_after_first_run', { source: 'menu' });
    }
    this.beginRun(false);
  }

  public beginRunFromRestart(): void {
    if (this.isReplayAfterFirstRun()) {
      this.record('restart_after_first_run', { source: 'result' });
    }
    this.beginRun(true);
  }

  public markFirstUpgrade(): void {
    this.recordRunTime('first_upgrade_time');
  }

  public markRouteHint(routeId: RouteId): void {
    if (this.hintedRoutesInRun.has(routeId)) {
      return;
    }
    this.hintedRoutesInRun.add(routeId);
    this.recordRunTime('route_hint_time', { routeId });
  }

  public markFirstRouteHint(routeId: RouteId): void {
    this.recordRunTime('first_route_hint_time', { routeId });
  }

  public markRouteCommitted(routeId: RouteId, meta?: { phase: PhaseId; pickId: string }): void {
    if (this.committedRouteInRun === routeId) {
      return;
    }
    this.committedRouteInRun = routeId;
    if (!this.firstCommitStageInRun && meta) {
      this.firstCommitStageInRun = meta.phase;
      this.firstCommitPickInRun = meta.pickId;
    }
    this.recordRunTime('route_lock_time', {
      routeId,
      phase: meta?.phase,
      pickId: meta?.pickId,
    });
    this.record('route_committed', {
      routeId,
      phase: meta?.phase,
      pickId: meta?.pickId,
    });
  }

  public markRouteMatured(routeId: RouteId): void {
    if (this.maturedRouteInRun === routeId) {
      return;
    }
    this.maturedRouteInRun = routeId;
    this.recordRunTime('build_mature_time', { routeId });
    this.record('route_matured', { routeId });
  }

  public recordNodeSelected(nodeType: NodeType, title: string): void {
    this.record('node_selected', { nodeType, title });
  }

  public recordUpgradeSelected(upgradeId: string, routeId?: RouteId, contentTier?: ContentTier): void {
    this.record('upgrade_selected', { upgradeId, routeId, contentTier });
    if (routeId) {
      this.record(`${routeId}_selected_count`, { increment: 1 });
    }
  }

  public recordEventSelected(eventId: string, optionId: string, routeId?: RouteId, contentTier?: ContentTier): void {
    this.record('event_selected', { eventId, optionId, routeId, contentTier });
  }

  public recordBranchSwitch(fromRoute: RouteId, toRoute: RouteId, meta?: { phase: PhaseId; pickId: string }): void {
    this.branchSwitchCountInRun += 1;
    this.record('branch_switch', {
      fromRoute,
      toRoute,
      phase: meta?.phase,
      pickId: meta?.pickId,
      branchSwitchCount: this.branchSwitchCountInRun,
    });
  }

  public recordBattleEntered(templateId: BattleTemplateId, title: string, contentTier?: ContentTier): void {
    this.record('battle_template_entered', { templateId, title, contentTier });
  }

  public recordBattleCompleted(templateId: BattleTemplateId, outcome: 'win' | 'loss', contentTier?: ContentTier): void {
    this.record('battle_template_completed', { templateId, outcome, contentTier });
  }

  public finishRun(result: {
    outcome: RunOutcome;
    routeId: RouteId | null;
    durationSec: number;
    buildStage: RouteBuildStage;
    buildSummary: string;
    endingKind: RunEndingKind;
    endingReason: string;
    finalNodeTitle: string;
    battleWins: number;
    nodesCleared: number;
  }): void {
    if (this.runFinished || this.sessionRunIndex <= 0) {
      return;
    }

    const currentRun = this.session.runs[this.session.runs.length - 1];
    if (!currentRun || currentRun.finishedAt) {
      return;
    }

    this.runFinished = true;
    this.recordRunTime('run_duration', { durationSec: result.durationSec });
    if (result.endingKind === 'hpDepleted') {
      this.recordRunTime('death_time');
    }
    currentRun.finishedAt = new Date().toISOString();
    currentRun.outcome = result.outcome;
    currentRun.routeId = result.routeId;
    currentRun.buildStage = result.buildStage;
    currentRun.buildSummary = result.buildSummary;
    currentRun.endingKind = result.endingKind;
    currentRun.endingReason = result.endingReason;
    currentRun.finalNodeTitle = result.finalNodeTitle;
    currentRun.durationSec = result.durationSec;
    currentRun.battleWins = result.battleWins;
    currentRun.nodesCleared = result.nodesCleared;
    currentRun.firstCommitStage = this.firstCommitStageInRun ?? undefined;
    currentRun.firstCommitPick = this.firstCommitPickInRun ?? undefined;
    currentRun.branchSwitchCount = this.branchSwitchCountInRun;

    this.record('run_finished', {
      outcome: result.outcome,
      routeId: result.routeId,
      buildStage: result.buildStage,
      buildSummary: result.buildSummary,
      endingKind: result.endingKind,
      endingReason: result.endingReason,
      finalNodeTitle: result.finalNodeTitle,
      durationSec: result.durationSec,
      battleWins: result.battleWins,
      nodesCleared: result.nodesCleared,
      firstCommitStage: this.firstCommitStageInRun,
      firstCommitPick: this.firstCommitPickInRun,
      branchSwitchCount: this.branchSwitchCountInRun,
    });

    if (currentRun.runIndex === 1) {
      this.record('first_run_end', {
        outcome: result.outcome,
        routeId: result.routeId,
        buildStage: result.buildStage,
        endingKind: result.endingKind,
        durationSec: result.durationSec,
      });
    }

    this.persist();
  }

  private beginRun(fromRestart: boolean): void {
    this.sessionRunIndex += 1;
    this.currentRunStartedAtMs = performance.now();
    this.hintedRoutesInRun = new Set<RouteId>();
    this.committedRouteInRun = null;
    this.maturedRouteInRun = null;
    this.firstCommitStageInRun = null;
    this.firstCommitPickInRun = null;
    this.branchSwitchCountInRun = 0;
    this.runFinished = false;
    this.session.runs.push({
      runIndex: this.sessionRunIndex,
      startedAt: new Date().toISOString(),
    });

    if (!fromRestart && this.sessionRunIndex === 1) {
      this.record('first_run_start');
    }

    if (this.sessionRunIndex === 2) {
      this.record('second_run_start');
    }

    this.persist();
  }

  private isReplayAfterFirstRun(): boolean {
    return this.sessionRunIndex === 1 && Boolean(this.session.runs[0]?.finishedAt);
  }

  private recordRunTime(name: string, payload?: Record<string, unknown>): void {
    const durationSec = this.currentRunStartedAtMs > 0 ? Number(((performance.now() - this.currentRunStartedAtMs) / 1000).toFixed(2)) : 0;
    this.record(name, {
      ...payload,
      durationSec,
    });
  }

  private record(name: string, payload?: Record<string, unknown>): void {
    this.session.events.push({
      name,
      at: new Date().toISOString(),
      runIndex: this.sessionRunIndex || null,
      payload,
    });
    this.persist();
  }

  private load(): MetricStore {
    const raw = this.storage.getItem(PILOT_METRICS_STORAGE_KEY);
    if (!raw) {
      return {
        version: 'v1',
        updatedAt: new Date().toISOString(),
        sessions: [],
      };
    }

    try {
      return JSON.parse(raw) as MetricStore;
    } catch {
      return {
        version: 'v1',
        updatedAt: new Date().toISOString(),
        sessions: [],
      };
    }
  }

  private persist(): void {
    this.store.updatedAt = new Date().toISOString();
    this.storage.setItem(PILOT_METRICS_STORAGE_KEY, JSON.stringify(this.store));
    if (typeof window !== 'undefined') {
      window.__pilotMetrics = this.store;
    }
  }
}
