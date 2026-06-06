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
      label: '钉住暴击方向',
    },
    core: {
      eventId: 'crit-reroute-window',
      optionId: 'crit-reroute-window-core',
      label: '补进暴击核心',
    },
    transform: {
      eventId: 'crit-lock-protocol',
      optionId: 'crit-lock-transform',
      label: '压上红线爆发',
    },
  },
  pierce: {
    direction: {
      eventId: 'route-handoff',
      optionId: 'route-handoff-pierce',
      label: '改道穿透侧频',
    },
    core: {
      eventId: 'pierce-reroute-window',
      optionId: 'pierce-reroute-window-hold',
      label: '先稳穿透火力',
    },
    transform: {
      eventId: 'pierce-reroute-window',
      optionId: 'pierce-reroute-window-breakthrough',
      label: '压上穿透打穿',
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
    battleRouteMoment: false,
    resultDetail: false,
  };
}

function pushCapture(summary, captureMeta) {
  summary.captures.push({
    routeId: captureMeta.routeId ?? null,
    stage: captureMeta.stage,
    anomalyRole: captureMeta.anomalyRole ?? null,
    routeMomentText: captureMeta.routeMomentText ?? null,
    pageSegment: captureMeta.pageSegment,
    screenshot: captureMeta.screenshot,
  });
}

export async function runStableSmoke(options = {}) {
  const appUrl = options.appUrl ?? process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4173/game-demo/';
  const outDir = path.resolve(options.outDir ?? process.env.PILOT_QA_OUT_DIR ?? 'output/qa/stable-smoke');
  const routeIds = toRouteList(options);
  const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

  ensureDir(outDir);

  const summary = {
    appUrl,
    routeIds,
    failed404Urls: [],
    consoleErrors: [],
    consoleWarns: [],
    coverage: {
      home: false,
      upgrade: false,
      routes: Object.fromEntries(routeIds.map((routeId) => [routeId, createRouteCoverage()])),
    },
    screenshots: {
      home: null,
      upgrade: null,
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

      await triggerScenario(page, { routeId, stage: 'battle' });
      await page.evaluate(() => window.__pilotDebug?.setConfig?.({ invulnerablePlayer: true }));
      await waitForVisible(page.locator('.game-hud-fixed__route-moment'));
      routeCoverage.battleRouteMoment = true;
      routeScreenshots.battle = await capture(page, outDir, `${routeId}-battle-route-moment.png`);
      routeTextChecks.routeMoment = normalize(await page.locator('.game-hud-fixed__route-moment').innerText());
      pushCapture(summary, {
        routeId,
        stage: 'battle',
        routeMomentText: routeTextChecks.routeMoment,
        pageSegment: 'battle-route-moment',
        screenshot: routeScreenshots.battle,
      });

      await triggerScenario(page, { routeId, stage: 'result' });
      await waitForVisible(page.locator('[data-action="details"]'), 6000);
      await page.click('[data-action="details"]');
      await waitForVisible(page.locator('.panel-result-details'));
      routeCoverage.resultDetail = true;
      routeScreenshots.result = await capture(page, outDir, `${routeId}-result-detail.png`);
      routeTextChecks.resultDetail = normalize(await page.locator('.panel-result-details').innerText());
      pushCapture(summary, {
        routeId,
        stage: 'result',
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
