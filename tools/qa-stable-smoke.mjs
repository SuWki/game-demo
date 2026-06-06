import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalize(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values)];
}

async function waitForVisible(locator, timeoutMs = 4000) {
  await locator.first().waitFor({ state: 'visible', timeoutMs });
}

async function capture(page, outDir, filename) {
  const outputPath = path.join(outDir, filename);
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

async function triggerScenario(page, config) {
  return page.evaluate((payload) => window.__pilotQaSmoke?.(payload) ?? false, config);
}

export async function runStableSmoke(options = {}) {
  const appUrl = options.appUrl ?? process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4173/game-demo/';
  const outDir = path.resolve(options.outDir ?? process.env.PILOT_QA_OUT_DIR ?? 'output/qa/stable-smoke');
  const routeId = options.routeId ?? process.env.PILOT_QA_ROUTE ?? 'crit';
  const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

  ensureDir(outDir);

  const summary = {
    appUrl,
    routeId,
    failed404Urls: [],
    consoleErrors: [],
    consoleWarns: [],
    coverage: {
      home: false,
      upgrade: false,
      anomaly: false,
      battleRouteMoment: false,
      resultMain: false,
      resultDetail: false,
    },
    screenshots: {},
    textChecks: {},
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

    await triggerScenario(page, { routeId, stage: 'upgrade' });
    await waitForVisible(page.locator('.choice-strip-upgrade'));
    summary.coverage.upgrade = true;
    summary.screenshots.upgrade = await capture(page, outDir, '02-upgrade.png');

    await triggerScenario(page, { routeId, stage: 'anomaly' });
    await waitForVisible(page.locator('.choice-context-anomaly'));
    summary.coverage.anomaly = true;
    summary.screenshots.anomaly = await capture(page, outDir, '03-anomaly.png');
    summary.textChecks.anomaly = normalize(await page.locator('.choice-context-anomaly').innerText());

    await triggerScenario(page, { routeId, stage: 'battle' });
    await page.evaluate(() => window.__pilotDebug?.setConfig?.({ invulnerablePlayer: true }));
    await waitForVisible(page.locator('.game-hud-fixed__route-moment'));
    summary.coverage.battleRouteMoment = true;
    summary.screenshots.battle = await capture(page, outDir, '04-battle-route-moment.png');
    summary.textChecks.routeMoment = normalize(await page.locator('.game-hud-fixed__route-moment').innerText());

    await triggerScenario(page, { routeId, stage: 'result' });
    await waitForVisible(page.locator('[data-action="details"]'), 6000);
    summary.coverage.resultMain = true;
    summary.screenshots.resultMain = await capture(page, outDir, '05-result-main.png');
    summary.textChecks.resultMain = normalize(await page.locator('body').innerText()).slice(0, 600);

    await page.click('[data-action="details"]');
    await waitForVisible(page.locator('.panel-result-details'));
    summary.coverage.resultDetail = true;
    summary.screenshots.resultDetail = await capture(page, outDir, '06-result-detail.png');
    summary.textChecks.resultDetail = normalize(await page.locator('.panel-result-details').innerText());

    const metrics = await page.evaluate(() => window.__pilotMetrics ?? null);
    const session = metrics?.sessions?.[metrics.sessions.length - 1] ?? null;
    summary.lastRun = session?.runs?.[session.runs.length - 1] ?? null;

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
