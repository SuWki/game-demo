import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4199';
const OUT_DIR = path.resolve('output/playwright/stability-round25');
fs.mkdirSync(OUT_DIR, { recursive: true });

function normalize(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  } catch {
    return await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  }
}

async function exportMetrics(page) {
  return page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
}

async function readBattleDebug(page) {
  return page.evaluate(() => (window.__pilotBattleDebug ? window.__pilotBattleDebug() : null));
}

async function readAudioDebug(page) {
  return page.evaluate(() => (window.__pilotAudioDebug ? window.__pilotAudioDebug() : null));
}

async function getChoices(page) {
  return page.$$eval('.choice-card[data-choice]', (elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') ?? '',
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      type: (element.querySelector('.choice-type')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
}

async function moveBurst(page) {
  const sequence = [
    ['KeyD', 240],
    ['KeyS', 180],
    ['KeyA', 260],
    ['KeyW', 180],
    ['KeyD', 160],
    ['KeyW', 120],
  ];
  for (const [key, duration] of sequence) {
    if (await page.locator('.choice-card[data-choice]').count()) break;
    if (await page.locator('[data-action="restart"]').count()) break;
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(70);
  }
}

function getRouteFromChoice(choice) {
  if (/dash/i.test(choice.id)) return 'dash';
  if (/pierce/i.test(choice.id)) return 'pierce';
  if (/crit/i.test(choice.id)) return 'crit';
  return null;
}

function isNodePanel(choices) {
  return choices.length > 0 && choices.every((choice) => /^(opening|round|debug|node|boss|elite|battle|event)/i.test(choice.id));
}

function scoreChoice(choice, state, nodePanel) {
  let score = 0;
  const route = getRouteFromChoice(choice);
  const focusRoute = Object.entries(state.routeScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (nodePanel) {
    if (/elite|boss|battle/i.test(choice.id)) score += 2;
    if (route && focusRoute === route) score += 3;
    if (route && !focusRoute) score += 2;
    if (/final|late/i.test(choice.id)) score += 1;
    return score;
  }

  if (route) {
    score += 3;
    score += state.routeScores[route] * 1.6;
    if (!focusRoute) score += 2;
    if (focusRoute === route) score += 3;
  }
  if (/rare|epic|legend|payoff|finisher|zero-window|return-hold|afterimage|anchor/i.test(choice.id)) score += 3;
  if (/redirect|hybrid|pivot|switch|mirror/i.test(choice.id)) score += 1;
  if (/dash/i.test(choice.id) && state.forceDashBias) score += 2;
  return score;
}

async function runScenario(browser, index, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const summary = {
    runIndex: index,
    consoleErrors: [],
    resultSeen: false,
    replaySeen: false,
    panelCount: 0,
    lastRun: null,
    audioDebug: null,
    battleDebug: null,
    selectedChoices: [],
  };
  const state = {
    routeScores: { crit: 0, pierce: 0, dash: 0 },
    forceDashBias: Boolean(options.forceDashBias),
  };

  page.on('console', (message) => {
    if (message.type() === 'error') summary.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(String(error));
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-action="start"]');
  await page.waitForTimeout(700);

  for (let step = 0; step < (options.steps ?? 280); step += 1) {
    if (await page.locator('[data-action="restart"]').count()) {
      summary.resultSeen = true;
      break;
    }

    const choiceCount = await page.locator('.choice-card[data-choice]').count();
    if (choiceCount > 0) {
      const choices = await getChoices(page);
      const nodePanel = isNodePanel(choices);
      const ranked = choices
        .map((choice) => ({ choice, score: scoreChoice(choice, state, nodePanel) }))
        .sort((left, right) => right.score - left.score);
      const selected = ranked[0]?.choice ?? choices[0];
      const route = getRouteFromChoice(selected);
      if (route) state.routeScores[route] += nodePanel ? 1 : 2;
      summary.panelCount += 1;
      summary.selectedChoices.push({ id: selected.id, text: normalize(selected.text) });
      await page.click(`[data-choice="${selected.id}"]`);
      await page.waitForTimeout(320);
      continue;
    }

    await moveBurst(page);
  }

  await page.waitForTimeout(900);
  if ((await page.locator('[data-action="restart"]').count()) > 0) {
    summary.resultSeen = true;
  }
  const metrics = await exportMetrics(page);
  const session = metrics.sessions[metrics.sessions.length - 1];
  summary.lastRun = session.runs[session.runs.length - 1] ?? null;
  summary.audioDebug = await readAudioDebug(page);
  summary.battleDebug = await readBattleDebug(page);

  if (summary.resultSeen && (await page.locator('[data-action="restart"]').count())) {
    await page.click('[data-action="restart"]');
    await page.waitForTimeout(900);
    summary.replaySeen = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('.choice-card[data-choice]').count()) > 0;
  }

  await context.close();
  return summary;
}

const browser = await launchBrowser();
const fullFlow = await runScenario(browser, 1, { steps: 300, forceDashBias: false });
const longRuns = [];
for (let index = 1; index <= 8; index += 1) {
  longRuns.push(await runScenario(browser, index + 1, { steps: 320, forceDashBias: index % 3 === 0 }));
}
await browser.close();

const aggregate = {
  totalRuns: longRuns.length,
  wins: longRuns.filter((run) => run.lastRun?.outcome === 'victory').length,
  dashRuns: longRuns.filter((run) => run.lastRun?.routeId === 'dash' || /dash/i.test(run.lastRun?.buildSummary ?? '')).length,
  lateDashWindowRuns: longRuns.filter((run) => (run.lastRun?.lateDashWindowMoments ?? 0) > 0).length,
  eliteCrackRuns: longRuns.filter((run) => run.lastRun?.eliteCrackSeen).length,
  bossFirelineRuns: longRuns.filter((run) => (run.lastRun?.bossFirelineCoverage ?? 0) > 0).length,
  averageLateDashWindowMoments: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.lateDashWindowMoments ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  averageDashCounterMoments: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.dashCounterMoments ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  averageEliteCrackFollowThroughMoments: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.eliteCrackFollowThroughMoments ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  averageBossFirelineCoverage: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.bossFirelineCoverage ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  averageBossSafeWindowMoments: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.bossSafeWindowMoments ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  averageKillPickupContinueMoments: Number((longRuns.reduce((sum, run) => sum + (run.lastRun?.killPickupContinueMoments ?? 0), 0) / Math.max(1, longRuns.length)).toFixed(2)),
  consoleErrorRuns: longRuns.filter((run) => run.consoleErrors.length > 0).length,
};

fs.mkdirSync(path.join(OUT_DIR, 'full-flow'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'natural-long'), { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'full-flow', 'summary.json'), JSON.stringify(fullFlow, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'natural-long', 'summary.json'), JSON.stringify({ aggregate, runs: longRuns }, null, 2));
console.log(JSON.stringify({ fullFlow, aggregate }, null, 2));
