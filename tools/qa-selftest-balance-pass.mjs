import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4188/game-demo/';
const outputDir = path.resolve('output/qa/selftest-balance-pass');
const maxSteps = 2200;
const stepDelayMs = 100;
const moveThreshold = 18;
const routes = ['crit', 'pierce', 'dash'];
const routeUpgradePrefixes = new Set(routes);
const rarityScores = {
  common: 8,
  uncommon: 14,
  rare: 24,
  epic: 34,
  legendary: 46,
};
const genericScores = {
  'generic-frame': 26,
  'generic-overclock': 24,
  'generic-pressure-bypass': 24,
  'generic-reroute-buffer': 22,
  'generic-vector-buffer': 18,
  'generic-thrusters': 18,
  'generic-cadence': 16,
  'generic-firepower': 16,
  'generic-ballistics': 14,
  'generic-optics': 14,
  'generic-reactor': 12,
  'generic-salvo-cache': 14,
  'generic-terminal-weave': 12,
  'generic-branch-buffer': 16,
};
const scenarios = [
  { index: 1, policy: 'route', preferredRoute: 'pierce', committedRouteHint: 'pierce' },
  { index: 2, policy: 'survival', preferredRoute: 'crit', committedRouteHint: 'dash' },
  { index: 3, policy: 'route', preferredRoute: 'dash', committedRouteHint: 'pierce' },
  { index: 4, policy: 'survival', preferredRoute: 'pierce', committedRouteHint: 'pierce' },
  { index: 5, policy: 'route', preferredRoute: 'crit', committedRouteHint: 'dash' },
  { index: 6, policy: 'survival', preferredRoute: 'dash', committedRouteHint: 'dash' },
];

function createRunSummary(scenario) {
  return {
    index: scenario.index,
    policy: scenario.policy,
    preferredRoute: scenario.preferredRoute,
    committedRouteHint: scenario.committedRouteHint,
    resultSeen: false,
    outcome: 'timeout',
    durationSec: 0,
    buildStage: 'unformed',
    routeId: null,
    endingReason: 'timeout',
    endingKind: 'timeOut',
    finalNodeTitle: null,
    finalNodeType: null,
    battleWins: 0,
    nodesCleared: 0,
    nodesSelected: 0,
    nodeTypes: {},
    nodeTitles: [],
    upgradesChosen: 0,
    routeUpgradesChosen: 0,
    chosenUpgrades: [],
    eventChoices: 0,
    routeUpgradeOfferSeenCount: 0,
    routeUpgradePickCount: 0,
    upgradeOfferRarityCounts: {},
    upgradeOfferValueBuckets: {},
    consoleErrors: [],
    failedUrls: [],
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function increment(counter, key, amount = 1) {
  counter[key] = (counter[key] ?? 0) + amount;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function getRawId(choiceId) {
  return String(choiceId ?? '').split(':')[0];
}

function getChoiceRoute(rawId) {
  const prefix = rawId.split('-')[0];
  return routeUpgradePrefixes.has(prefix) ? prefix : null;
}

function getChoiceRarity(choiceId) {
  const rarity = String(choiceId ?? '').split(':')[1];
  return rarityScores[rarity] ? rarity : null;
}

function getChoiceKind(rawId) {
  if (rawId.startsWith('round-') || rawId.startsWith('final-') || rawId.startsWith('opening-')) {
    if (rawId.includes('boss')) return 'boss';
    if (rawId.includes('battle')) return 'battle';
    if (rawId.includes('event') || rawId.includes('anomaly')) return 'anomaly-node';
    if (rawId.includes('upgrade') || rawId === 'final-prep') return 'upgrade-node';
  }
  if (rawId.startsWith('generic-')) {
    return 'generic-upgrade';
  }
  if (getChoiceRoute(rawId)) {
    return 'route-upgrade';
  }
  return 'event-option';
}

function parseChoiceType(choice) {
  const rawId = getRawId(choice.id);
  return {
    rawId,
    route: getChoiceRoute(rawId),
    rarity: getChoiceRarity(choice.id),
    kind: getChoiceKind(rawId),
  };
}

function moveToward(playerX, playerY, targetX, targetY) {
  const dx = targetX - playerX;
  const dy = targetY - playerY;
  return {
    up: dy < -moveThreshold,
    down: dy > moveThreshold,
    left: dx < -moveThreshold,
    right: dx > moveThreshold,
  };
}

function createFallbackMovement(step, preferredRoute) {
  const cadence = preferredRoute === 'dash' ? 5 : preferredRoute === 'crit' ? 7 : 8;
  const segment = Math.floor(step / cadence) % 6;
  return {
    up: segment === 4 || segment === 5,
    down: segment === 1,
    left: segment === 2 || (preferredRoute === 'dash' && segment === 3),
    right: segment === 0 || (preferredRoute === 'crit' && segment === 3),
  };
}

function createBattleMovement(snapshot, step, preferredRoute) {
  const fallback = createFallbackMovement(step, preferredRoute);
  if (!snapshot) {
    return fallback;
  }

  if (snapshot.pressureSafeWindowSec > 0 && snapshot.pressureSafeWindowAxis) {
    if (snapshot.pressureSafeWindowAxis === 'pocket') {
      return moveToward(
        snapshot.playerX,
        snapshot.playerY,
        snapshot.pressureSafeWindowCenter,
        snapshot.pressureSafeWindowSecondaryCenter,
      );
    }
    if (snapshot.pressureSafeWindowAxis === 'vertical') {
      return moveToward(snapshot.playerX, snapshot.playerY, snapshot.pressureSafeWindowCenter, snapshot.playerY);
    }
    return moveToward(snapshot.playerX, snapshot.playerY, snapshot.playerX, snapshot.pressureSafeWindowCenter);
  }

  const elite = snapshot.enemies?.find((enemy) => enemy.elite);
  if (elite) {
    const dx = snapshot.playerX - elite.x;
    const dy = snapshot.playerY - elite.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance < 210) {
      return moveToward(
        snapshot.playerX,
        snapshot.playerY,
        snapshot.playerX + (dx / distance) * 220,
        snapshot.playerY + (dy / distance) * 220,
      );
    }
  }

  if (Array.isArray(snapshot.enemies) && snapshot.enemies.length > 0) {
    const centroid = snapshot.enemies.reduce(
      (acc, enemy) => {
        acc.x += enemy.x;
        acc.y += enemy.y;
        return acc;
      },
      { x: 0, y: 0 },
    );
    centroid.x /= snapshot.enemies.length;
    centroid.y /= snapshot.enemies.length;

    const awayDx = snapshot.playerX - centroid.x;
    const awayDy = snapshot.playerY - centroid.y;
    const awayDistance = Math.max(1, Math.hypot(awayDx, awayDy));
    if (awayDistance < 260 || snapshot.enemyProjectileCount > 6) {
      return moveToward(
        snapshot.playerX,
        snapshot.playerY,
        snapshot.playerX + (awayDx / awayDistance) * 220,
        snapshot.playerY + (awayDy / awayDistance) * 220,
      );
    }
  }

  return fallback;
}

async function syncKeys(page, nextState, heldKeys) {
  const mapping = {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
  };

  for (const [direction, key] of Object.entries(mapping)) {
    const shouldHold = Boolean(nextState[direction]);
    const isHeld = heldKeys.has(key);
    if (shouldHold && !isHeld) {
      heldKeys.add(key);
      await page.keyboard.down(key);
    } else if (!shouldHold && isHeld) {
      heldKeys.delete(key);
      await page.keyboard.up(key);
    }
  }
}

async function releaseKeys(page, heldKeys) {
  for (const key of [...heldKeys]) {
    heldKeys.delete(key);
    await page.keyboard.up(key);
  }
}

async function getChoices(page) {
  return page.$$eval('[data-choice]', (elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice'),
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
}

async function getLiveState(page) {
  return page.evaluate(() => {
    const snapshot = window.__pilotBattleDebug?.() ?? null;
    const store = window.__pilotMetrics;
    const session = store?.sessions?.[store.sessions.length - 1];
    const events = session?.events ?? [];
    let committedRoute = null;
    let maturedRoute = null;
    for (const event of events) {
      if (event.name === 'route_committed') {
        committedRoute = event.payload?.routeId ?? committedRoute;
      }
      if (event.name === 'route_matured') {
        maturedRoute = event.payload?.routeId ?? maturedRoute;
      }
    }
    return {
      snapshot,
      committedRoute,
      maturedRoute,
    };
  });
}

function scoreUpgradeChoice(choice, meta, scenario, runState) {
  let score = 0;
  score += rarityScores[meta.rarity] ?? 0;

  if (meta.kind === 'route-upgrade') {
    score += 18;
    if (meta.route === scenario.preferredRoute) {
      score += scenario.policy === 'route' ? 48 : 34;
    } else {
      score += scenario.policy === 'route' ? -10 : -4;
    }

    if (runState.committedRoute && meta.route === runState.committedRoute) {
      score += 22;
    }
    if (runState.maturedRoute && meta.route === runState.maturedRoute) {
      score += 28;
    }
    if (runState.routeSignals[meta.route] > 0) {
      score += 12;
    }
  }

  if (meta.kind === 'generic-upgrade') {
    score += genericScores[meta.rawId] ?? 10;
    if (runState.hpRatio < 0.65 && (meta.rawId === 'generic-frame' || meta.rawId === 'generic-pressure-bypass')) {
      score += 18;
    }
    if (runState.hpRatio < 0.55 && meta.rawId === 'generic-overclock') {
      score += 16;
    }
    if (scenario.policy === 'survival' && (meta.rawId === 'generic-frame' || meta.rawId === 'generic-thrusters' || meta.rawId === 'generic-reroute-buffer')) {
      score += 8;
    }
  }

  if (!runState.committedRoute && !runState.maturedRoute && meta.kind === 'route-upgrade') {
    score += 10;
  }

  return score;
}

function scoreEventChoice(choice, meta, scenario, runState) {
  let score = 0;
  if (meta.route === scenario.preferredRoute) {
    score += 42;
  } else if (meta.route) {
    score -= 6;
  } else {
    score += 10;
  }

  if (runState.hpRatio < 0.5 && meta.rawId.includes('risky')) {
    score -= 16;
  }

  if (runState.committedRoute && meta.route === runState.committedRoute) {
    score += 10;
  }

  return score;
}

function scoreNodeChoice(choice, meta, scenario, runState) {
  if (meta.kind === 'boss') {
    return 1000;
  }

  const routeLocked = Boolean(runState.committedRoute || runState.maturedRoute);
  let score = 0;

  if (!routeLocked) {
    if (meta.kind === 'upgrade-node') score += 52;
    if (meta.kind === 'anomaly-node') score += 36;
    if (meta.kind === 'battle') score += 24;
  } else {
    if (meta.kind === 'battle') score += 42;
    if (meta.kind === 'upgrade-node') score += runState.hpRatio < 0.55 ? 44 : 28;
    if (meta.kind === 'anomaly-node') score += 20;
  }

  if (runState.hpRatio < 0.45) {
    if (meta.kind === 'upgrade-node') score += 20;
    if (meta.kind === 'anomaly-node') score += 10;
    if (meta.kind === 'battle') score -= 10;
  }

  if (!routeLocked && runState.nodesSelected >= 2 && meta.kind === 'battle') {
    score -= 8;
  }

  if (meta.rawId.includes('round-3') && meta.kind === 'battle' && runState.hpRatio < 0.6) {
    score -= 8;
  }

  if (scenario.policy === 'route' && meta.kind === 'upgrade-node') {
    score += 6;
  }

  return score;
}

function chooseBestChoice(choices, scenario, runState) {
  let bestChoice = choices[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const choice of choices) {
    const meta = parseChoiceType(choice);
    let score = 0;
    if (meta.kind === 'battle' || meta.kind === 'upgrade-node' || meta.kind === 'anomaly-node' || meta.kind === 'boss') {
      score = scoreNodeChoice(choice, meta, scenario, runState);
    } else if (meta.kind === 'event-option') {
      score = scoreEventChoice(choice, meta, scenario, runState);
    } else {
      score = scoreUpgradeChoice(choice, meta, scenario, runState);
    }

    if (score > bestScore) {
      bestChoice = choice;
      bestScore = score;
    }
  }

  return bestChoice;
}

function updateChoiceTracking(choice, runState) {
  const meta = parseChoiceType(choice);
  if (meta.kind === 'route-upgrade' && meta.route) {
    runState.routeSignals[meta.route] += 1;
  }
  if (meta.kind === 'event-option' && meta.route) {
    runState.routeSignals[meta.route] += 1;
  }
}

async function collectRunMetrics(page) {
  return page.evaluate(() => {
    const store = window.__pilotMetrics;
    const session = store?.sessions?.[store.sessions.length - 1];
    const run = session?.runs?.[session.runs.length - 1] ?? null;
    const events = (session?.events ?? []).filter((event) => event.runIndex === run?.runIndex);
    return {
      run,
      events,
      bodyText: document.body?.innerText ?? '',
    };
  });
}

function summarizeRun(runSummary, metrics) {
  const run = metrics.run;
  runSummary.resultSeen = Boolean(run);
  if (!run) {
    return;
  }

  runSummary.outcome = run.outcome ?? 'ended';
  runSummary.durationSec = Number((run.durationSec ?? 0).toFixed(2));
  runSummary.buildStage = run.buildStage ?? 'unformed';
  runSummary.routeId = run.routeId ?? null;
  runSummary.endingReason = run.endingReason ?? 'unknown';
  runSummary.endingKind = run.endingKind ?? 'timeOut';
  runSummary.finalNodeTitle = run.finalNodeTitle ?? null;
  runSummary.finalNodeType = run.finalNodeType ?? null;
  runSummary.battleWins = run.battleWins ?? 0;
  runSummary.nodesCleared = run.nodesCleared ?? 0;
  runSummary.nodesSelected = (metrics.events ?? []).filter((event) => event.name === 'node_selected').length;
  runSummary.routeUpgradeOfferSeenCount = run.routeUpgradeOfferSeenCount ?? 0;
  runSummary.routeUpgradePickCount = run.routeUpgradePickCount ?? 0;
  runSummary.upgradeOfferRarityCounts = run.upgradeOfferRarityCounts ?? {};
  runSummary.upgradeOfferValueBuckets = run.upgradeOfferValueBuckets ?? {};

  for (const event of metrics.events ?? []) {
    if (event.name === 'node_selected') {
      const nodeType = event.payload?.nodeType ?? 'unknown';
      increment(runSummary.nodeTypes, nodeType);
      if (event.payload?.title) {
        runSummary.nodeTitles.push(event.payload.title);
      }
    }

    if (event.name === 'upgrade_selected') {
      const upgradeId = String(event.payload?.upgradeId ?? '');
      const sourceId = getRawId(upgradeId);
      const routeId = event.payload?.routeId ?? getChoiceRoute(sourceId);
      const rarity = event.payload?.rarity ?? getChoiceRarity(upgradeId);
      runSummary.upgradesChosen += 1;
      if (routeId) {
        runSummary.routeUpgradesChosen += 1;
      }
      runSummary.chosenUpgrades.push({
        id: sourceId,
        routeId,
        rarity,
        phase: event.payload?.phase ?? null,
        source: event.payload?.source ?? null,
      });
    }

    if (event.name === 'event_selected') {
      runSummary.eventChoices += 1;
    }
  }
}

function buildAggregate(runs) {
  const aggregate = {
    sampleSize: runs.length,
    clears: 0,
    clearRate: 0,
    avgDurationSec: 0,
    avgBattleWins: 0,
    avgNodesCleared: 0,
    avgNodesSelected: 0,
    avgUpgradesChosen: 0,
    outcomeCounts: {},
    buildStageCounts: {},
    routeCounts: {},
    endingReasonCounts: {},
    finalNodeTitleCounts: {},
    finalNodeTypeCounts: {},
    failedUrlCounts: {},
  };

  for (const run of runs) {
    if (run.outcome === 'victory') {
      aggregate.clears += 1;
    }
    aggregate.avgDurationSec += run.durationSec;
    aggregate.avgBattleWins += run.battleWins;
    aggregate.avgNodesCleared += run.nodesCleared;
    aggregate.avgNodesSelected += run.nodesSelected;
    aggregate.avgUpgradesChosen += run.upgradesChosen;
    increment(aggregate.outcomeCounts, run.outcome ?? 'unknown');
    increment(aggregate.buildStageCounts, run.buildStage ?? 'unformed');
    increment(aggregate.routeCounts, run.routeId ?? 'none');
    increment(aggregate.endingReasonCounts, run.endingReason ?? 'unknown');
    increment(aggregate.finalNodeTitleCounts, run.finalNodeTitle ?? 'unknown');
    increment(aggregate.finalNodeTypeCounts, run.finalNodeType ?? 'unknown');
    for (const failedUrl of run.failedUrls) {
      increment(aggregate.failedUrlCounts, failedUrl);
    }
  }

  const divisor = Math.max(1, runs.length);
  aggregate.clearRate = Number((aggregate.clears / divisor).toFixed(2));
  aggregate.avgDurationSec = Number((aggregate.avgDurationSec / divisor).toFixed(2));
  aggregate.avgBattleWins = Number((aggregate.avgBattleWins / divisor).toFixed(2));
  aggregate.avgNodesCleared = Number((aggregate.avgNodesCleared / divisor).toFixed(2));
  aggregate.avgNodesSelected = Number((aggregate.avgNodesSelected / divisor).toFixed(2));
  aggregate.avgUpgradesChosen = Number((aggregate.avgUpgradesChosen / divisor).toFixed(2));

  return aggregate;
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    });
  } catch {
    return chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    });
  }
}

async function runScenario(browser, scenario) {
  const runSummary = createRunSummary(scenario);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const heldKeys = new Set();
  const runState = {
    hpRatio: 1,
    routeSignals: { crit: 0, pierce: 0, dash: 0 },
    committedRoute: null,
    maturedRoute: null,
    nodesSelected: 0,
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runSummary.consoleErrors.push(normalizeText(message.text()));
    }
  });
  page.on('pageerror', (error) => {
    runSummary.consoleErrors.push(normalizeText(String(error)));
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const requestUrl = response.url();
      if (!runSummary.failedUrls.includes(requestUrl)) {
        runSummary.failedUrls.push(requestUrl);
      }
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(900);

  for (let step = 0; step < maxSteps; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }

    const choices = await getChoices(page);
    if (choices.length > 0) {
      await releaseKeys(page, heldKeys);
      const pickedChoice = chooseBestChoice(choices, scenario, runState);
      updateChoiceTracking(pickedChoice, runState);
      const meta = parseChoiceType(pickedChoice);
      if (meta.kind === 'battle' || meta.kind === 'upgrade-node' || meta.kind === 'anomaly-node' || meta.kind === 'boss') {
        runState.nodesSelected += 1;
      }
      await page.locator(`[data-choice="${pickedChoice.id}"]`).click();
      await page.waitForTimeout(320);
      continue;
    }

    const liveState = await getLiveState(page);
    runState.committedRoute = liveState.committedRoute;
    runState.maturedRoute = liveState.maturedRoute;
    if (liveState.snapshot) {
      runState.hpRatio = clamp(
        liveState.snapshot.playerHp / Math.max(1, liveState.snapshot.playerMaxHp),
        0,
        1,
      );
    }
    await syncKeys(
      page,
      createBattleMovement(liveState.snapshot, step, scenario.preferredRoute),
      heldKeys,
    );
    await page.waitForTimeout(stepDelayMs);
  }

  await releaseKeys(page, heldKeys);
  await page.waitForTimeout(700);
  runSummary.resultSeen = (await page.locator('[data-action="restart"]').count()) > 0;
  if (runSummary.resultSeen) {
    await page.screenshot({
      path: path.join(outputDir, `run-${scenario.index}-result.png`),
      fullPage: true,
    });
  }

  summarizeRun(runSummary, await collectRunMetrics(page));
  await context.close();
  return runSummary;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await launchBrowser();
  const runs = [];

  try {
    for (const scenario of scenarios) {
      runs.push(await runScenario(browser, scenario));
    }
  } finally {
    await browser.close();
  }

  const summary = {
    url,
    aggregate: buildAggregate(runs),
    runs,
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
