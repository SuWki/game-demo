import type {
  AnomalyClassId,
  BattleEncounterType,
  BattleTemplateId,
  ContentTier,
  EventContentKind,
  NodeType,
  PhaseId,
  PressurePocketShiftModeId,
  PressureSafeWindowAxis,
  RouteBuildStage,
  RouteId,
  RunEndingKind,
  RunOutcome,
  UpgradeCategory,
  UpgradeRarity,
  UpgradeSource,
  UpgradeValueBucket,
} from '../game/types';

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
  finalNodeType?: NodeType | null;
  durationSec?: number;
  battleWins?: number;
  nodesCleared?: number;
  firstCommitStage?: PhaseId;
  firstCommitPick?: string;
  branchSwitchCount?: number;
  branchSwitchPhaseCounts?: Partial<Record<PhaseId, number>>;
  rareSeenCount?: number;
  rarePayoffPickCount?: number;
  hybridPickCount?: number;
  hybridOfferSeenCount?: number;
  latePayoffSeenCount?: number;
  routeUpgradeOfferSeenCount?: number;
  routeUpgradePickCount?: number;
  upgradeOfferRarityCounts?: Partial<Record<UpgradeRarity, number>>;
  upgradeOfferValueBuckets?: Partial<Record<UpgradeValueBucket, number>>;
  nodeTypeCounts?: Partial<Record<NodeType, number>>;
  anomalySeenCount?: number;
  anomalyClassCounts?: Partial<Record<AnomalyClassId, number>>;
  bossEchoSeenCount?: number;
  redirectOfferSeenCount?: number;
  redirectPickCount?: number;
  redirectPickStage?: PhaseId;
}

interface ContentMetricMeta {
  phase?: PhaseId;
  source?: UpgradeSource;
  rarity?: UpgradeRarity;
  category?: UpgradeCategory;
  valueScore?: number;
  valueBucket?: UpgradeValueBucket;
  tags?: string[];
  isHybridPick?: boolean;
  isLatePayoff?: boolean;
  nodeType?: NodeType;
  encounterType?: BattleEncounterType;
  contentKind?: EventContentKind;
  anomalyClass?: AnomalyClassId;
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

  private branchSwitchPhaseCountsInRun: Partial<Record<PhaseId, number>> = {};

  private rareSeenCountInRun = 0;

  private rarePayoffPickCountInRun = 0;

  private hybridPickCountInRun = 0;

  private hybridOfferSeenCountInRun = 0;

  private latePayoffSeenCountInRun = 0;

  private routeUpgradeOfferSeenCountInRun = 0;

  private routeUpgradePickCountInRun = 0;

  private upgradeOfferRarityCountsInRun: Partial<Record<UpgradeRarity, number>> = {};

  private upgradeOfferValueBucketsInRun: Partial<Record<UpgradeValueBucket, number>> = {};

  private nodeTypeCountsInRun: Partial<Record<NodeType, number>> = {};

  private anomalySeenCountInRun = 0;

  private anomalyClassCountsInRun: Partial<Record<AnomalyClassId, number>> = {};

  private bossEchoSeenCountInRun = 0;

  private redirectOfferSeenCountInRun = 0;

  private redirectPickCountInRun = 0;

  private redirectPickStageInRun: PhaseId | null = null;

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

  public recordNodeSelected(nodeType: NodeType, title: string, meta?: { phase?: PhaseId; focusRoute?: RouteId | null }): void {
    this.incrementRecordCount(this.nodeTypeCountsInRun, nodeType);
    this.record('node_selected', {
      nodeType,
      title,
      phase: meta?.phase,
      focusRoute: meta?.focusRoute ?? undefined,
    });
  }

  public recordUpgradeOfferSeen(
    choices: Array<{
      sourceId: string;
      routeId?: RouteId;
      tags?: string[];
      rarity: UpgradeRarity;
      valueBucket: UpgradeValueBucket;
    }>,
    meta: { phase: PhaseId; source: UpgradeSource },
  ): void {
    const rarityCounts: Partial<Record<UpgradeRarity, number>> = {};
    const valueBuckets: Partial<Record<UpgradeValueBucket, number>> = {};
    let routeOptionCount = 0;
    let redirectOptionCount = 0;
    let hybridOptionCount = 0;

    for (const choice of choices) {
      this.incrementRecordCount(rarityCounts, choice.rarity);
      this.incrementRecordCount(valueBuckets, choice.valueBucket);
      this.incrementRecordCount(this.upgradeOfferRarityCountsInRun, choice.rarity);
      this.incrementRecordCount(this.upgradeOfferValueBucketsInRun, choice.valueBucket);

      if (choice.routeId) {
        routeOptionCount += 1;
      }
      if (choice.tags?.includes('redirect')) {
        redirectOptionCount += 1;
      }
      if (choice.tags?.some((tag) => tag === 'hybrid' || tag === 'redirect')) {
        hybridOptionCount += 1;
      }
    }

    if (routeOptionCount > 0) {
      this.routeUpgradeOfferSeenCountInRun += 1;
    }
    if (hybridOptionCount > 0) {
      this.hybridOfferSeenCountInRun += 1;
    }

    this.record('upgrade_offer_seen', {
      phase: meta.phase,
      source: meta.source,
      optionIds: choices.map((choice) => choice.sourceId),
      routeOptionCount,
      redirectOptionCount,
      hybridOptionCount,
      rarityCounts,
      valueBuckets,
    });
  }

  public recordUpgradeSelected(
    upgradeId: string,
    routeId?: RouteId,
    contentTier?: ContentTier,
    meta?: ContentMetricMeta,
  ): void {
    this.record('upgrade_selected', {
      upgradeId,
      routeId,
      contentTier,
      phase: meta?.phase,
      source: meta?.source,
      rarity: meta?.rarity,
      category: meta?.category,
      valueScore: meta?.valueScore,
      valueBucket: meta?.valueBucket,
      tags: meta?.tags,
    });
    this.trackContentCounters(contentTier, meta);
    if (routeId) {
      this.record(`${routeId}_selected_count`, { increment: 1 });
    }
    if (meta?.category === 'route') {
      this.routeUpgradePickCountInRun += 1;
    }
  }

  public recordEventSelected(
    eventId: string,
    optionId: string,
    routeId?: RouteId,
    contentTier?: ContentTier,
    meta?: ContentMetricMeta,
  ): void {
    this.record('event_selected', {
      eventId,
      optionId,
      routeId,
      contentTier,
      phase: meta?.phase,
      contentKind: meta?.contentKind ?? 'event',
      anomalyClass: meta?.anomalyClass,
    });
    this.trackContentCounters(contentTier, meta);
  }

  public recordBranchSwitch(fromRoute: RouteId, toRoute: RouteId, meta?: { phase: PhaseId; pickId: string }): void {
    this.branchSwitchCountInRun += 1;
    if (meta?.phase) {
      this.incrementRecordCount(this.branchSwitchPhaseCountsInRun, meta.phase);
    }
    this.record('branch_switch', {
      fromRoute,
      toRoute,
      phase: meta?.phase,
      pickId: meta?.pickId,
      branchSwitchCount: this.branchSwitchCountInRun,
    });
  }

  public recordBattleEntered(
    templateId: BattleTemplateId,
    title: string,
    contentTier?: ContentTier,
    meta?: ContentMetricMeta,
  ): void {
    this.record('battle_template_entered', {
      templateId,
      title,
      contentTier,
      phase: meta?.phase,
      nodeType: meta?.nodeType,
      encounterType: meta?.encounterType ?? 'battle',
    });
    this.trackContentCounters(contentTier, meta);
  }

  public recordBattleCompleted(templateId: BattleTemplateId, outcome: 'win' | 'loss', contentTier?: ContentTier): void {
    this.record('battle_template_completed', { templateId, outcome, contentTier });
  }

  public recordBossPhaseEntered(templateId: BattleTemplateId, phaseId: string, phaseLabel: string): void {
    this.record('boss_phase_entered', {
      templateId,
      phaseId,
      phaseLabel,
    });
  }

  public recordBossPhaseDuration(templateId: BattleTemplateId, phaseId: string, phaseLabel: string, durationSec: number): void {
    this.record('boss_phase_duration', {
      templateId,
      phaseId,
      phaseLabel,
      durationSec: Number(durationSec.toFixed(2)),
    });
  }

  public recordBossSignatureSeen(
    templateId: BattleTemplateId,
    phaseId: string,
    phaseLabel: string,
    signatureLabel: string,
    durationSec: number,
  ): void {
    this.record('boss_signature_seen', {
      templateId,
      phaseId,
      phaseLabel,
      signatureLabel,
      durationSec: Number(durationSec.toFixed(2)),
    });
  }

  public recordBossPhasePatternSeen(
    templateId: BattleTemplateId,
    phaseId: string,
    phaseLabel: string,
    patternLabel: string,
  ): void {
    this.record('boss_phase_pattern_seen', {
      templateId,
      phaseId,
      phaseLabel,
      patternLabel,
    });
  }

  public recordBossPhasePatternDuration(
    templateId: BattleTemplateId,
    phaseId: string,
    phaseLabel: string,
    patternLabel: string,
    durationSec: number,
  ): void {
    this.record('boss_phase_pattern_duration', {
      templateId,
      phaseId,
      phaseLabel,
      patternLabel,
      durationSec: Number(durationSec.toFixed(2)),
    });
  }

  public recordBossSafeWindowSeen(
    templateId: BattleTemplateId,
    phaseId: string,
    phaseLabel: string,
    patternLabel: string,
    axis: PressureSafeWindowAxis,
    span: number,
    durationSec: number,
    secondarySpan?: number,
    shiftType?: PressurePocketShiftModeId,
  ): void {
    this.record('boss_safe_window_seen', {
      templateId,
      phaseId,
      phaseLabel,
      patternLabel,
      axis,
      span: Math.round(span),
      secondarySpan: secondarySpan !== undefined ? Math.round(secondarySpan) : undefined,
      shiftType,
      durationSec: Number(durationSec.toFixed(2)),
    });
  }

  public recordRedirectOffer(meta: {
    phase: PhaseId;
    source: 'upgrade' | 'event';
    optionIds: string[];
  }): void {
    this.redirectOfferSeenCountInRun += 1;
    this.record('redirect_offer_seen', {
      phase: meta.phase,
      source: meta.source,
      optionIds: meta.optionIds,
      redirectOfferSeenCount: this.redirectOfferSeenCountInRun,
    });
  }

  public recordRedirectPick(meta: {
    phase: PhaseId;
    pickId: string;
    fromRoute: RouteId | null;
    toRoute: RouteId;
  }): void {
    this.redirectPickCountInRun += 1;
    if (!this.redirectPickStageInRun) {
      this.redirectPickStageInRun = meta.phase;
    }
    this.record('redirect_pick', {
      phase: meta.phase,
      pickId: meta.pickId,
      fromRoute: meta.fromRoute,
      toRoute: meta.toRoute,
      redirectPickCount: this.redirectPickCountInRun,
    });
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
    finalNodeType: NodeType | null;
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
    currentRun.finalNodeType = result.finalNodeType;
    currentRun.durationSec = result.durationSec;
    currentRun.battleWins = result.battleWins;
    currentRun.nodesCleared = result.nodesCleared;
    currentRun.firstCommitStage = this.firstCommitStageInRun ?? undefined;
    currentRun.firstCommitPick = this.firstCommitPickInRun ?? undefined;
    currentRun.branchSwitchCount = this.branchSwitchCountInRun;
    currentRun.branchSwitchPhaseCounts = this.branchSwitchPhaseCountsInRun;
    currentRun.rareSeenCount = this.rareSeenCountInRun;
    currentRun.rarePayoffPickCount = this.rarePayoffPickCountInRun;
    currentRun.hybridPickCount = this.hybridPickCountInRun;
    currentRun.hybridOfferSeenCount = this.hybridOfferSeenCountInRun;
    currentRun.latePayoffSeenCount = this.latePayoffSeenCountInRun;
    currentRun.routeUpgradeOfferSeenCount = this.routeUpgradeOfferSeenCountInRun;
    currentRun.routeUpgradePickCount = this.routeUpgradePickCountInRun;
    currentRun.upgradeOfferRarityCounts = this.upgradeOfferRarityCountsInRun;
    currentRun.upgradeOfferValueBuckets = this.upgradeOfferValueBucketsInRun;
    currentRun.nodeTypeCounts = this.nodeTypeCountsInRun;
    currentRun.anomalySeenCount = this.anomalySeenCountInRun;
    currentRun.anomalyClassCounts = this.anomalyClassCountsInRun;
    currentRun.bossEchoSeenCount = this.bossEchoSeenCountInRun;
    currentRun.redirectOfferSeenCount = this.redirectOfferSeenCountInRun;
    currentRun.redirectPickCount = this.redirectPickCountInRun;
    currentRun.redirectPickStage = this.redirectPickStageInRun ?? undefined;

    this.record('run_finished', {
      outcome: result.outcome,
      routeId: result.routeId,
      buildStage: result.buildStage,
      buildSummary: result.buildSummary,
      endingKind: result.endingKind,
      endingReason: result.endingReason,
      finalNodeTitle: result.finalNodeTitle,
      finalNodeType: result.finalNodeType,
      durationSec: result.durationSec,
      battleWins: result.battleWins,
      nodesCleared: result.nodesCleared,
      firstCommitStage: this.firstCommitStageInRun,
      firstCommitPick: this.firstCommitPickInRun,
      branchSwitchCount: this.branchSwitchCountInRun,
      branchSwitchPhaseCounts: this.branchSwitchPhaseCountsInRun,
      rareSeenCount: this.rareSeenCountInRun,
      rarePayoffPickCount: this.rarePayoffPickCountInRun,
      hybridPickCount: this.hybridPickCountInRun,
      hybridOfferSeenCount: this.hybridOfferSeenCountInRun,
      latePayoffSeenCount: this.latePayoffSeenCountInRun,
      routeUpgradeOfferSeenCount: this.routeUpgradeOfferSeenCountInRun,
      routeUpgradePickCount: this.routeUpgradePickCountInRun,
      upgradeOfferRarityCounts: this.upgradeOfferRarityCountsInRun,
      upgradeOfferValueBuckets: this.upgradeOfferValueBucketsInRun,
      nodeTypeCounts: this.nodeTypeCountsInRun,
      anomalySeenCount: this.anomalySeenCountInRun,
      anomalyClassCounts: this.anomalyClassCountsInRun,
      bossEchoSeenCount: this.bossEchoSeenCountInRun,
      redirectOfferSeenCount: this.redirectOfferSeenCountInRun,
      redirectPickCount: this.redirectPickCountInRun,
      redirectPickStage: this.redirectPickStageInRun,
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
    this.branchSwitchPhaseCountsInRun = {};
    this.rareSeenCountInRun = 0;
    this.rarePayoffPickCountInRun = 0;
    this.hybridPickCountInRun = 0;
    this.hybridOfferSeenCountInRun = 0;
    this.latePayoffSeenCountInRun = 0;
    this.routeUpgradeOfferSeenCountInRun = 0;
    this.routeUpgradePickCountInRun = 0;
    this.upgradeOfferRarityCountsInRun = {};
    this.upgradeOfferValueBucketsInRun = {};
    this.nodeTypeCountsInRun = {};
    this.anomalySeenCountInRun = 0;
    this.anomalyClassCountsInRun = {};
    this.bossEchoSeenCountInRun = 0;
    this.redirectOfferSeenCountInRun = 0;
    this.redirectPickCountInRun = 0;
    this.redirectPickStageInRun = null;
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

  private incrementRecordCount<T extends string>(counter: Partial<Record<T, number>>, key: T, amount = 1): void {
    counter[key] = (counter[key] ?? 0) + amount;
  }

  private trackContentCounters(contentTier?: ContentTier, meta?: ContentMetricMeta): void {
    if (contentTier === 'rare') {
      this.rareSeenCountInRun += 1;
    }

    if (meta?.isHybridPick) {
      this.hybridPickCountInRun += 1;
    }

    const phase = meta?.phase;
    if (meta?.isLatePayoff || ((phase === 'late' || phase === 'finalPrep' || phase === 'finalBattle') && contentTier === 'rare')) {
      this.latePayoffSeenCountInRun += 1;
    }

    if (contentTier === 'rare' && meta?.isLatePayoff) {
      this.rarePayoffPickCountInRun += 1;
    }

    if (meta?.contentKind === 'anomaly') {
      this.anomalySeenCountInRun += 1;
      if (meta.anomalyClass) {
        this.incrementRecordCount(this.anomalyClassCountsInRun, meta.anomalyClass);
        if (meta.anomalyClass === 'bossEcho') {
          this.bossEchoSeenCountInRun += 1;
        }
      }
    }
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
