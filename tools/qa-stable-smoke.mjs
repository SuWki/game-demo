import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const defaultRoutes = ['crit', 'pierce'];
const anomalyCaptureRoleByRoute = {
  crit: 'transform',
  pierce: 'transform',
};
const anomalyTripletByRoute = {
  crit: {
    direction: {
      eventId: 'crit-reroute-window',
      optionId: 'crit-reroute-window-direction',
      label: 'crit-direction',
    },
    core: {
      eventId: 'crit-reroute-window',
      optionId: 'crit-reroute-window-core',
      label: 'crit-core',
    },
    transform: {
      eventId: 'crit-reroute-window',
      optionId: 'crit-reroute-window-transform',
      label: 'crit-transform',
    },
  },
  pierce: {
    direction: {
      eventId: 'pierce-reroute-window',
      optionId: 'pierce-reroute-window-direction',
      label: 'pierce-direction',
    },
    core: {
      eventId: 'pierce-reroute-window',
      optionId: 'pierce-reroute-window-hold',
      label: 'pierce-core',
    },
    transform: {
      eventId: 'pierce-reroute-window',
      optionId: 'pierce-reroute-window-breakthrough',
      label: 'pierce-transform',
    },
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalize(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values)];
}

function toRouteList(options = {}) {
  if (Array.isArray(options.routeIds) && options.routeIds.length > 0) {
    return uniq(options.routeIds);
  }

  const envRoute = options.routeId ?? process.env.PILOT_QA_ROUTE;
  if (typeof envRoute === 'string' && envRoute.trim()) {
    return uniq(
      envRoute
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  return [...defaultRoutes];
}

function getResultMode(options = {}) {
  const mode = options.resultMode ?? process.env.PILOT_QA_RESULT_MODE ?? 'victory';
  return mode === 'defeat' ? 'defeat' : 'victory';
}

async function waitForVisible(locator, timeoutMs = 4000) {
  await locator.first().waitFor({ state: 'visible', timeout: timeoutMs });
}

async function capture(page, outDir, filename) {
  const outputPath = path.join(outDir, filename);
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

async function triggerScenario(page, config) {
  return page.evaluate((payload) => window.__pilotQaSmoke?.(payload) ?? false, config);
}

function createRouteCoverage() {
  return {
    anomaly: false,
    battleBridge: false,
    battlePayoff: false,
    resultDetail: false,
  };
}

function pushCapture(summary, captureMeta) {
  summary.captures.push({
    routeId: captureMeta.routeId ?? null,
    stage: captureMeta.stage,
    stageLevel: captureMeta.stageLevel ?? null,
    anomalyRole: captureMeta.anomalyRole ?? null,
    routeMomentText: captureMeta.routeMomentText ?? null,
    pageSegment: captureMeta.pageSegment,
    screenshot: captureMeta.screenshot,
  });
}

async function captureBattleStage(page, routeId, battleLevel, routeScreenshots, routeTextChecks, routeCoverage, summary, outDir) {
  await triggerScenario(page, { routeId, stage: 'battle', battleLevel });
  await page.evaluate(() => window.__pilotDebug?.setConfig?.({ invulnerablePlayer: true }));
  const routeMoment = page.locator('.game-hud-fixed__route-moment');
  await waitForVisible(routeMoment);
  if (routeId === 'dash') {
    await page.waitForFunction(() => {
      const text = document.querySelector('.game-hud-fixed__route-moment')?.textContent ?? '';
      return text.includes('贴身') || text.includes('贴近') || text.includes('贴住') || text.includes('回打') || text.includes('收人');
    }, null, { timeout: 6000 });
  } else {
    await page.waitForTimeout(900);
  }

  const screenshotKey = battleLevel === 'payoff' ? 'battlePayoff' : 'battleBridge';
  const textKey = battleLevel === 'payoff' ? 'routeMomentPayoff' : 'routeMomentBridge';
  const pageSegment = battleLevel === 'payoff' ? 'battle-route-moment-payoff' : 'battle-route-moment-bridge';
  const filename = `${routeId}-battle-${battleLevel}.png`;
  routeCoverage[battleLevel === 'payoff' ? 'battlePayoff' : 'battleBridge'] = true;
  routeScreenshots[screenshotKey] = await capture(page, outDir, filename);
  routeTextChecks[textKey] = normalize(await routeMoment.textContent());
  pushCapture(summary, {
    routeId,
    stage: 'battle',
    stageLevel: battleLevel,
    routeMomentText: routeTextChecks[textKey],
    pageSegment,
    screenshot: routeScreenshots[screenshotKey],
  });
}

async function captureBossSignatureStage(page, summary, outDir) {
  await page.evaluate(() => window.__pilotQaForceBoss?.('boss-bastion'));
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.__pilotDebug?.setConfig?.({ invulnerablePlayer: true });
    window.__pilotDebug?.setPressureState?.({
      eliteHpRatio: 0.72,
      remainingSec: 24,
      pressurePhaseElapsedSec: 0,
    });
  });
  await page.waitForTimeout(1200);
  await waitForVisible(page.locator('.game-hud-fixed__mode'));
  const screenshot = await capture(page, outDir, 'boss-signature.png');
  summary.coverage.bossSignature = true;
  summary.screenshots.bossSignature = screenshot;
  pushCapture(summary, {
    routeId: 'boss-bastion',
    stage: 'boss',
    stageLevel: 'signature',
    pageSegment: 'boss-signature',
    screenshot,
  });
}

export async function runStableSmoke(options = {}) {
  const appUrl = options.appUrl ?? process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4173/game-demo/';
  const outDir = path.resolve(options.outDir ?? process.env.PILOT_QA_OUT_DIR ?? 'output/qa/stable-smoke');
  const routeIds = toRouteList(options);
  const resultMode = getResultMode(options);
  const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

  ensureDir(outDir);

  const summary = {
    appUrl,
    routeIds,
    resultMode,
    failed404Urls: [],
    consoleErrors: [],
    consoleWarns: [],
    coverage: {
      home: false,
      upgrade: false,
      bossSignature: false,
      routes: Object.fromEntries(routeIds.map((routeId) => [routeId, createRouteCoverage()])),
    },
    screenshots: {
      home: null,
      upgrade: null,
      bossSignature: null,
      routes: Object.fromEntries(routeIds.map((routeId) => [routeId, {}])),
    },
    textChecks: {
      home: '',
      upgrade: '',
      routes: Object.fromEntries(routeIds.map((routeId) => [routeId, {}])),
    },
    captures: [],
    anomalyTripletByRoute,
  };

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on('response', (response) => {
      if (response.status() === 404) {
        summary.failed404Urls.push(response.url());
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        summary.consoleErrors.push(message.text());
      }
      if (message.type() === 'warning' || message.type() === 'warn') {
        summary.consoleWarns.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      summary.consoleErrors.push(String(error));
    });

    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await waitForVisible(page.locator('[data-action="start"]'));
    summary.coverage.home = true;
    summary.screenshots.home = await capture(page, outDir, '01-home.png');
    summary.textChecks.home = normalize(await page.locator('body').innerText()).slice(0, 400);
    pushCapture(summary, {
      routeId: null,
      stage: 'home',
      pageSegment: 'menu-home',
      screenshot: summary.screenshots.home,
    });

    const firstRouteId = routeIds[0] ?? 'crit';
    await triggerScenario(page, { routeId: firstRouteId, stage: 'upgrade' });
    await waitForVisible(page.locator('.choice-strip-upgrade'));
    summary.coverage.upgrade = true;
    summary.screenshots.upgrade = await capture(page, outDir, '02-upgrade.png');
    summary.textChecks.upgrade = normalize((await page.locator('.choice-strip-upgrade').allInnerTexts()).join(' '));
    pushCapture(summary, {
      routeId: firstRouteId,
      stage: 'upgrade',
      pageSegment: 'choice-upgrade',
      screenshot: summary.screenshots.upgrade,
    });

    for (const routeId of routeIds) {
      const anomalyRole = anomalyCaptureRoleByRoute[routeId] ?? 'transform';
      const routeScreenshots = summary.screenshots.routes[routeId];
      const routeTextChecks = summary.textChecks.routes[routeId];
      const routeCoverage = summary.coverage.routes[routeId];

      await triggerScenario(page, { routeId, stage: 'anomaly', anomalyRole });
      await waitForVisible(page.locator('.choice-context-anomaly'), 6000);
      routeCoverage.anomaly = true;
      routeScreenshots.anomaly = await capture(page, outDir, `${routeId}-anomaly.png`);
      routeTextChecks.anomaly = normalize(await page.locator('.choice-context-anomaly').innerText());
      pushCapture(summary, {
        routeId,
        stage: 'anomaly',
        anomalyRole,
        pageSegment: 'choice-anomaly',
        screenshot: routeScreenshots.anomaly,
      });

      await captureBattleStage(page, routeId, 'bridge', routeScreenshots, routeTextChecks, routeCoverage, summary, outDir);
      await captureBattleStage(page, routeId, 'payoff', routeScreenshots, routeTextChecks, routeCoverage, summary, outDir);

      if (!summary.coverage.bossSignature) {
        await captureBossSignatureStage(page, summary, outDir);
      }

      await triggerScenario(page, { routeId, stage: 'result', resultMode });
      await waitForVisible(page.locator('[data-action="details"]'), 6000);
      await page.click('[data-action="details"]');
      await waitForVisible(page.locator('.panel-result-details'));
      routeCoverage.resultDetail = true;
      routeScreenshots.result = await capture(page, outDir, `${routeId}-result-detail.png`);
      routeTextChecks.resultDetail = normalize(await page.locator('.panel-result-details').innerText());
      pushCapture(summary, {
        routeId,
        stage: 'result',
        stageLevel: 'payoff',
        anomalyRole: ['direction', 'core', 'transform'],
        pageSegment: 'result-detail',
        screenshot: routeScreenshots.result,
      });
    }

    summary.failed404Urls = uniq(summary.failed404Urls);
    summary.consoleErrors = uniq(summary.consoleErrors);
    summary.consoleWarns = uniq(summary.consoleWarns);

    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    await page.close();
    return summary;
  } finally {
    await browser.close();
  }
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (invokedUrl === import.meta.url) {
  runStableSmoke().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
