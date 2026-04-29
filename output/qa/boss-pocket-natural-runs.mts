import { RunEngine } from '../../src/systems/RunEngine.ts';

const noopProxy = new Proxy(
  {},
  {
    get() {
      return () => {};
    },
  },
);

const services = {
  metrics: noopProxy,
  overlay: {},
  meta: {},
  audio: {},
};

const TICK_MS = 50;
const MAX_STEPS = 8400;
const FORCE_BASTION_FINAL = true;

const scenarios = [
  {
    id: 'normal',
    preferredRoute: null,
    statWeights: {
      damage: 1.6,
      fireRate: 14,
      projectileSpeed: 0.03,
      critChance: 52,
      critMultiplier: 18,
      multishot: 14,
      maxHp: 0.2,
      moveSpeed: 0.06,
      dashInterval: 2,
      dashPulseDamage: 0.8,
      dashInvulnerability: 10,
      regeneration: 10,
      pierce: 7,
    },
  },
  {
    id: 'highBurst',
    preferredRoute: 'crit',
    statWeights: {
      damage: 2.6,
      fireRate: 20,
      projectileSpeed: 0.04,
      critChance: 84,
      critMultiplier: 28,
      multishot: 22,
      maxHp: 0.12,
      moveSpeed: 0.03,
      dashInterval: 0.8,
      dashPulseDamage: 0.2,
      dashInvulnerability: 4,
      regeneration: 4,
      pierce: 8,
    },
  },
  {
    id: 'highMobility',
    preferredRoute: 'dash',
    statWeights: {
      damage: 0.8,
      fireRate: 8,
      projectileSpeed: 0.02,
      critChance: 20,
      critMultiplier: 10,
      multishot: 10,
      maxHp: 0.16,
      moveSpeed: 0.14,
      dashInterval: 10,
      dashPulseDamage: 1.5,
      dashInvulnerability: 22,
      regeneration: 12,
      pierce: 4,
    },
  },
] as const;

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createEngine() {
  return new RunEngine(services);
}

function scoreModifiers(
  modifiers: Record<string, number | undefined>,
  weights: Record<string, number>,
): number {
  let score = 0;
  for (const [key, value] of Object.entries(modifiers)) {
    if (!value) {
      continue;
    }

    if (key === 'dashInterval') {
      score += Math.abs(value) * (weights[key] ?? 0);
      continue;
    }

    score += value * (weights[key] ?? 0);
  }

  return score;
}

function scoreUpgrade(upgrade: any, scenario: (typeof scenarios)[number], state: Readonly<any>): number {
  let score = 0;
  const rarityScore = {
    common: 8,
    uncommon: 14,
    rare: 20,
    epic: 28,
    legendary: 36,
  }[upgrade.rarity];
  score += rarityScore ?? 0;

  if (upgrade.routeId) {
    if (scenario.preferredRoute && upgrade.routeId === scenario.preferredRoute) {
      score += 40;
    } else if (scenario.preferredRoute && upgrade.routeId !== scenario.preferredRoute) {
      score -= 10;
    } else {
      score += 8;
    }
  }

  for (const effect of upgrade.effects ?? []) {
    if (effect.type === 'route') {
      if (scenario.preferredRoute && effect.routeId === scenario.preferredRoute) {
        score += 28;
      } else if (!scenario.preferredRoute) {
        score += 6;
      }
      continue;
    }

    if (effect.type === 'heal') {
      const missingHp = state.stats.maxHp - state.stats.hp;
      score += missingHp > 0 ? Math.min(effect.amount, missingHp) * 0.2 : 0;
      continue;
    }

    if (effect.type === 'stats') {
      score += scoreModifiers(effect.modifiers ?? {}, scenario.statWeights);
    }
  }

  if (upgrade.tags?.includes('payoff')) {
    score += scenario.preferredRoute && upgrade.routeId === scenario.preferredRoute ? 8 : 2;
  }
  if (upgrade.tags?.includes('redirect') && scenario.preferredRoute) {
    score -= 6;
  }

  return score;
}

function scoreEventOption(option: any, scenario: (typeof scenarios)[number], state: Readonly<any>): number {
  let score = 0;

  if (option.routeId) {
    const resolvedRoute = option.routeId === 'dominant' ? state.committedRoute ?? state.maturedRoute ?? state.dominantRoute : option.routeId;
    if (scenario.preferredRoute && resolvedRoute === scenario.preferredRoute) {
      score += 28;
    } else if (scenario.preferredRoute && resolvedRoute && resolvedRoute !== scenario.preferredRoute) {
      score -= 8;
    } else {
      score += 5;
    }
  }

  for (const effect of option.effects ?? []) {
    if (effect.type === 'route') {
      if (scenario.preferredRoute && effect.routeId === scenario.preferredRoute) {
        score += 24;
      } else if (!scenario.preferredRoute) {
        score += 6;
      }
      continue;
    }

    if (effect.type === 'heal') {
      const missingHp = state.stats.maxHp - state.stats.hp;
      score += missingHp > 0 ? Math.min(effect.amount, missingHp) * 0.22 : 0;
      continue;
    }

    if (effect.type === 'stats') {
      score += scoreModifiers(effect.modifiers ?? {}, scenario.statWeights);
    }
  }

  return score;
}

function scoreNode(node: any, scenario: (typeof scenarios)[number], state: Readonly<any>): number {
  const hpRatio = state.stats.hp / Math.max(1, state.stats.maxHp);
  const desiredRouteLocked = Boolean(scenario.preferredRoute && (state.committedRoute === scenario.preferredRoute || state.maturedRoute === scenario.preferredRoute));
  let score = 0;

  switch (node.type) {
    case 'boss':
      return 1000;
    case 'battle':
      score += 34;
      if (state.round <= 2) {
        score += 6;
      }
      break;
    case 'anomaly':
      score += state.round >= 2 ? 30 : 18;
      if (!desiredRouteLocked && scenario.preferredRoute) {
        score += 6;
      }
      break;
    case 'upgrade':
      score += 24;
      if (hpRatio < 0.48) {
        score += 14;
      }
      if (!desiredRouteLocked && scenario.preferredRoute) {
        score += 4;
      }
      break;
    default:
      break;
  }

  if (node.templateId === 'boss-bastion') {
    score += 2;
  }

  return score;
}

function pickBest<T>(items: T[], scoreFn: (item: T) => number): T {
  const ranked = [...items].sort((left, right) => scoreFn(right) - scoreFn(left));
  return ranked[0] ?? items[0];
}

function createFallbackInput(step: number, scenarioId: string) {
  const cadence = scenarioId === 'highMobility' ? 5 : scenarioId === 'highBurst' ? 7 : 8;
  const segment = Math.floor(step / cadence) % 6;
  return {
    up: segment === 4 || segment === 5,
    down: segment === 1,
    left: segment === 2 || (scenarioId === 'highMobility' && segment === 3),
    right: segment === 0 || (scenarioId === 'highBurst' && segment === 3),
  };
}

function moveToward(playerX: number, playerY: number, targetX: number, targetY: number, fallback: ReturnType<typeof createFallbackInput>) {
  const dx = targetX - playerX;
  const dy = targetY - playerY;
  const threshold = 18;

  return {
    up: dy < -threshold,
    down: dy > threshold,
    left: dx < -threshold,
    right: dx > threshold,
  };
}

function createBattleInput(step: number, battle: Readonly<any>, scenarioId: string) {
  const fallback = createFallbackInput(step, scenarioId);
  if (battle.pressureSafeWindowSec > 0 && battle.pressureSafeWindowAxis) {
    if (battle.pressureSafeWindowAxis === 'pocket') {
      return moveToward(
        battle.playerX,
        battle.playerY,
        battle.pressureSafeWindowCenter,
        battle.pressureSafeWindowSecondaryCenter,
        fallback,
      );
    }

    if (battle.pressureSafeWindowAxis === 'vertical') {
      return moveToward(
        battle.playerX,
        battle.playerY,
        battle.pressureSafeWindowCenter,
        battle.playerY,
        fallback,
      );
    }

    return moveToward(
      battle.playerX,
      battle.playerY,
      battle.playerX,
      battle.pressureSafeWindowCenter,
      fallback,
    );
  }

  return fallback;
}

function createRunSummary(seed: number, scenarioId: string) {
  return {
    seed,
    scenario: scenarioId,
    outcome: 'ongoing',
    finalRoute: null as string | null,
    buildStage: null as string | null,
    bossTemplateId: null as string | null,
    crossfireSeen: false,
    firelineSeen: false,
    crossfireShiftTypes: [] as string[],
    firelineShiftTypes: [] as string[],
    repositionDecisions: 0,
    firelineRepositionDecisions: 0,
    firstFirelineRemainingSec: null as number | null,
    firstFirelineElapsedSec: null as number | null,
    runDurationSec: 0,
  };
}

function recordPocketDecision(run: ReturnType<typeof createRunSummary>, battle: Readonly<any>) {
  if (battle.pressureSafeWindowAxis !== 'pocket' || battle.pressureSafeWindowSec <= 0) {
    return;
  }

  const phaseLabel = battle.pressurePhaseLabel ?? 'unknown';
  const shiftType = battle.pressureSafeWindowShiftType;
  if (!shiftType) {
    return;
  }

  if (phaseLabel === '交火' && !run.crossfireShiftTypes.includes(shiftType)) {
    run.crossfireShiftTypes.push(shiftType);
  }
  if (phaseLabel === '火线收束' && !run.firelineShiftTypes.includes(shiftType)) {
    run.firelineShiftTypes.push(shiftType);
  }

  const decisionThreshold =
    Math.max(battle.pressureSafeWindowSpan, battle.pressureSafeWindowSecondarySpan || battle.pressureSafeWindowSpan) * 0.68;
  const offset = Math.hypot(
    battle.pressureSafeWindowCenter - battle.playerX,
    battle.pressureSafeWindowSecondaryCenter - battle.playerY,
  );
  if (offset >= decisionThreshold) {
    run.repositionDecisions += 1;
    if (phaseLabel === '火线收束') {
      run.firelineRepositionDecisions += 1;
    }
  }
}

function sampleNaturalScenario(scenario: (typeof scenarios)[number]) {
  const originalRandom = Math.random;
  const runs = [];

  try {
    for (let seed = 1; seed <= 24; seed += 1) {
      Math.random = createSeededRandom(seed);
      const engine = createEngine();
      const run = createRunSummary(seed, scenario.id);
      let lastPocketPulseKey = '';

      for (let step = 0; step < MAX_STEPS; step += 1) {
        const state = engine.getState();
        run.finalRoute = state.maturedRoute ?? state.committedRoute ?? engine.getDominantRoute();
        run.buildStage = state.result?.buildStage ?? (state.maturedRoute ? 'matured' : state.committedRoute ? 'committed' : run.finalRoute ? 'hinted' : 'unformed');

        if (state.status === 'battle' && state.battle) {
          run.runDurationSec += TICK_MS / 1000;
          run.bossTemplateId = state.battle.encounterType === 'boss' ? state.battle.templateId : run.bossTemplateId;

          if (state.battle.templateId === 'boss-bastion') {
            if (state.battle.pressurePhaseLabel === '交火') {
              run.crossfireSeen = true;
            }
            if (state.battle.pressurePhaseLabel === '火线收束') {
              run.firelineSeen = true;
              run.firstFirelineRemainingSec ??= Number(state.battle.remainingSec.toFixed(2));
              run.firstFirelineElapsedSec ??= Number(state.battle.elapsedSec.toFixed(2));
            }

            const pulseKey = `${state.battle.pressurePhaseLabel ?? 'unknown'}:${state.battle.pressurePatternPulseCount}`;
            if (pulseKey !== lastPocketPulseKey) {
              recordPocketDecision(run, state.battle);
              lastPocketPulseKey = pulseKey;
            }
          }

          engine.setInputState(createBattleInput(step, state.battle, scenario.id));
          engine.tick(TICK_MS);
          continue;
        }

        if (state.status === 'upgradeChoice' && state.upgradeChoices.length > 0) {
          const choice = pickBest(state.upgradeChoices, (upgrade) => scoreUpgrade(upgrade, scenario, state));
          engine.chooseUpgrade(choice.id);
          continue;
        }

        if (state.status === 'eventChoice' && state.currentEvent?.options?.length) {
          const option = pickBest(state.currentEvent.options, (candidate) => scoreEventOption(candidate, scenario, state));
          engine.chooseEventOption(option.id);
          continue;
        }

        if (state.status === 'nodeChoice' && state.nodeOptions.length > 0) {
          if (FORCE_BASTION_FINAL && state.nodeOptions.some((candidate) => candidate.type === 'boss')) {
            const forcedBoss = {
              ...state.nodeOptions[0],
              id: 'qa-final-boss-bastion',
              type: 'boss' as const,
              title: '屏卫主核',
              description: '自然样本校准用最终 Boss 载体。',
              templateId: 'boss-bastion' as const,
              phase: 'finalBattle' as const,
              difficultyScale: 1.4,
            };
            (engine as any).state.nodeOptions = [forcedBoss];
            engine.chooseNode(forcedBoss.id);
            continue;
          }

          const node = pickBest(state.nodeOptions, (candidate) => scoreNode(candidate, scenario, state));
          engine.chooseNode(node.id);
          continue;
        }

        if (state.status === 'result') {
          run.outcome = state.result?.outcome ?? 'ended';
          run.finalRoute = state.result?.routeId ?? run.finalRoute;
          run.buildStage = state.result?.buildStage ?? run.buildStage;
          run.bossTemplateId = state.result?.finalNodeType === 'boss' ? run.bossTemplateId : run.bossTemplateId;
          break;
        }
      }

      runs.push(run);
    }
  } finally {
    Math.random = originalRandom;
  }

  const bossBastionRuns = runs.filter((run) => run.bossTemplateId === 'boss-bastion');
  return {
    scenario: scenario.id,
    forcedBossTemplateId: FORCE_BASTION_FINAL ? 'boss-bastion' : null,
    runCount: runs.length,
    bossBastionRuns: bossBastionRuns.length,
    victories: runs.filter((run) => run.outcome === 'victory').length,
    intendedRouteRuns: scenario.preferredRoute
      ? runs.filter((run) => run.finalRoute === scenario.preferredRoute).length
      : runs.filter((run) => run.finalRoute !== null).length,
    crossfireSeenRuns: bossBastionRuns.filter((run) => run.crossfireSeen).length,
    firelineSeenRuns: bossBastionRuns.filter((run) => run.firelineSeen).length,
    firelineDecisionRuns: bossBastionRuns.filter((run) => run.firelineRepositionDecisions > 0).length,
    averageRepositionDecisions: Number(
      (
        bossBastionRuns.reduce((sum, run) => sum + run.repositionDecisions, 0) /
        Math.max(1, bossBastionRuns.length)
      ).toFixed(2),
    ),
    averageFirstFirelineRemainingSec: Number(
      (
        bossBastionRuns
          .filter((run) => run.firstFirelineRemainingSec !== null)
          .reduce((sum, run) => sum + (run.firstFirelineRemainingSec ?? 0), 0) /
        Math.max(
          1,
          bossBastionRuns.filter((run) => run.firstFirelineRemainingSec !== null).length,
        )
      ).toFixed(2),
    ),
    sampleRuns: runs.filter((run) => run.bossTemplateId === 'boss-bastion'),
  };
}

const results = scenarios.map((scenario) => sampleNaturalScenario(scenario));
console.log(JSON.stringify(results, null, 2));
