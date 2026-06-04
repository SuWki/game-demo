import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const APP_URL = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4201/game-demo/';
const OUT_DIR = path.resolve(process.env.PILOT_QA_OUT_DIR ?? 'output/qa/retest-natural-long-boss-pass');
const RUN_COUNT = Number(process.env.PILOT_QA_RUNS ?? '10');
const MAX_STEPS = Number(process.env.PILOT_QA_MAX_STEPS ?? '240');
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalize(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

async function readFinalScreenText(page) {
  const selectors = [
    '.result-screen:not(.hidden) .result-screen-container',
    '.result-screen:not(.hidden)',
    '.panel-result-details:not(.hidden)',
    '.panel-layer.panel-layer-center:not(.hidden)',
    '.screen-layer .screen-minimal:not(.hidden)',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && (await locator.isVisible().catch(() => false))) {
      const text = normalize(await locator.innerText().catch(() => ''));
      if (text) {
        return text.slice(0, 500);
      }
    }
  }

  return '';
}

function getRoute(id = '') {
  if (/dash/i.test(id)) return 'dash';
  if (/pierce/i.test(id)) return 'pierce';
  if (/crit/i.test(id)) return 'crit';
  return null;
}

async function readChoices(page) {
  return page.$$eval('[data-choice]', (elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') ?? '',
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
}

async function moveBurst(page) {
  for (const [key, duration] of [
    ['KeyD', 220],
    ['KeyS', 180],
    ['KeyA', 240],
    ['KeyW', 180],
    ['KeyD', 140],
  ]) {
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
      return;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }
}

async function exportMetrics(page) {
  return page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
}

async function runScenario(browser, index) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const summary = {
    runIndex: index,
    consoleErrors: [],
    failed404: [],
    panels: 0,
    resultSeen: false,
    routeScores: { crit: 0, pierce: 0, dash: 0 },
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      summary.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(String(error));
  });
  page.on('response', (response) => {
    if (response.status() === 404) {
      summary.failed404.push(response.url());
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  if (index === 1) {
    await page.screenshot({ path: path.join(OUT_DIR, 'run-01-menu.png'), fullPage: true });
  }
  await page.click('[data-action="start"]');
  await page.waitForTimeout(700);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      summary.resultSeen = true;
      break;
    }

    const choices = await readChoices(page);
    if (choices.length > 0) {
      const selected =
        choices
          .map((choice) => {
            const route = getRoute(choice.id);
            let score = route ? 2 + summary.routeScores[route] * 1.35 : 0;
            if (/elite|boss|battle/i.test(choice.id)) score += 1;
            if (/dash/i.test(choice.id) && index % 2 === 0) score += 0.5;
            return { choice, score };
          })
          .sort((left, right) => right.score - left.score)[0]?.choice ?? choices[0];
      const route = getRoute(selected.id);
      if (route) {
        summary.routeScores[route] += 1;
      }
      summary.panels += 1;
      await page.click(`[data-choice="${selected.id}"]`);
      await page.waitForTimeout(320);
      continue;
    }

    await moveBurst(page);
  }

  await page.waitForTimeout(800);
  const metrics = await exportMetrics(page);
  const session = metrics.sessions[metrics.sessions.length - 1];
  summary.lastRun = session.runs[session.runs.length - 1] ?? null;
  summary.finalScreenText = await readFinalScreenText(page);
  summary.failed404 = [...new Set(summary.failed404)];

  await page.close();
  return summary;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  ensureDir(OUT_DIR);
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  const runs = [];
  for (let index = 1; index <= RUN_COUNT; index += 1) {
    runs.push(await runScenario(browser, index));
  }
  await browser.close();

  const aggregate = {
    totalRuns: runs.length,
    wins: runs.filter((run) => run.lastRun?.outcome === 'victory').length,
    bossReachedRuns: runs.filter((run) => run.lastRun?.finalNodeType === 'boss').length,
    routeCounts: countBy(runs, (run) => run.lastRun?.routeId ?? 'none'),
    buildStageCounts: countBy(runs, (run) => run.lastRun?.buildStage ?? 'unknown'),
    finalNodeTypeCounts: countBy(runs, (run) => run.lastRun?.finalNodeType ?? 'unknown'),
    finalNodeTitleCounts: countBy(runs, (run) => run.lastRun?.finalNodeTitle ?? 'unknown'),
    avgDurationSec: Number((runs.reduce((sum, run) => sum + (run.lastRun?.durationSec ?? 0), 0) / runs.length).toFixed(2)),
    avgBattleWins: Number((runs.reduce((sum, run) => sum + (run.lastRun?.battleWins ?? 0), 0) / runs.length).toFixed(2)),
    avgNodesCleared: Number((runs.reduce((sum, run) => sum + (run.lastRun?.nodesCleared ?? 0), 0) / runs.length).toFixed(2)),
    avgPanels: Number((runs.reduce((sum, run) => sum + run.panels, 0) / runs.length).toFixed(2)),
    consoleErrorRuns: runs.filter((run) => run.consoleErrors.length > 0).length,
    failed404Urls: [...new Set(runs.flatMap((run) => run.failed404))],
  };

  const report = {
    sourceScript: path.relative(process.cwd(), new URL(import.meta.url).pathname.replace(/^\//, '')).replace(/\\/g, '/'),
    aggregate,
    runs,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
