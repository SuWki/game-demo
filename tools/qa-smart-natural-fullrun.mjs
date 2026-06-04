import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const APP_URL = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4199/game-demo/';
const OUT_DIR = path.resolve(process.env.PILOT_QA_OUT_DIR ?? 'output/qa/smart-natural-fullrun');
const RUN_COUNT = Number(process.env.PILOT_QA_RUNS ?? '10');
const MAX_STEPS = Number(process.env.PILOT_QA_MAX_STEPS ?? '720');
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const ARENA_WIDTH = 2400;
const ARENA_HEIGHT = 1560;
const CENTER_X = ARENA_WIDTH * 0.5;
const CENTER_Y = ARENA_HEIGHT * 0.5;
const NODE_TYPE_ORDER = ['event', 'upgrade', 'battle'];

const ROUTE_TEXT_KEYWORDS = {
  crit: ['暴击', '升温', '热区', '爆链', '聚焦', '灼', '冠火'],
  pierce: ['穿透', '裂轨', '回响', '贯穿', '棱镜', '拆线', '切层'],
  dash: ['穿梭', '擦身', '回线', '换位', '瞬返', '侧滑', '错位'],
};

const GENERIC_SURVIVAL_IDS = new Set([
  'generic-frame',
  'generic-thrusters',
  'generic-vector-buffer',
  'generic-branch-buffer',
  'generic-reroute-buffer',
  'generic-terminal-baffle',
  'generic-last-mile',
  'generic-tailfold',
  'generic-crown-pocket',
  'generic-pressure-bypass',
]);

const GENERIC_OFFENSE_IDS = new Set([
  'generic-firepower',
  'generic-salvo-cache',
  'generic-cadence',
  'generic-optics',
  'generic-ballistics',
  'generic-reactor',
]);

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

function getRouteFromId(id = '') {
  if (id.startsWith('crit-') || /crit/i.test(id)) return 'crit';
  if (id.startsWith('pierce-') || /pierce/i.test(id)) return 'pierce';
  if (id.startsWith('dash-') || /dash/i.test(id)) return 'dash';
  return null;
}

function detectRouteFromText(text = '') {
  let bestRoute = null;
  let bestScore = 0;
  for (const [routeId, keywords] of Object.entries(ROUTE_TEXT_KEYWORDS)) {
    const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRoute = routeId;
    }
  }
  return bestRoute;
}

function detectNodeType(choice) {
  const id = choice.baseId ?? '';
  const className = choice.className ?? '';
  const modeLabel = choice.modeLabel ?? '';
  const text = `${modeLabel} ${choice.text}`;

  if (className.includes('choice-strip-node')) {
    if (/boss/i.test(id) || text.includes('Boss') || text.includes('首领')) return 'boss';
    if (/event|anomaly/i.test(id) || text.includes('事件')) return 'event';
    if (/upgrade/i.test(id) || text.includes('强化')) return 'upgrade';
    return 'battle';
  }

  if (className.includes('choice-strip-event')) return 'event';
  if (className.includes('choice-strip-upgrade')) return 'upgrade';
  return 'upgrade';
}

function getFocusRoute(routeScores) {
  return Object.entries(routeScores).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function isRareUpgrade(choice) {
  return choice.rarityLabel === '金' || choice.rarityLabel === '紫' || /legend|epic|rare/i.test(choice.id);
}

function isHybridChoice(choice) {
  const text = choice.text;
  return text.includes('并轨') || text.includes('交叉') || text.includes('侧频') || text.includes('镜像') || text.includes('岔路');
}

function isRedirectChoice(choice) {
  const text = choice.text;
  return text.includes('改道') || text.includes('接驳') || text.includes('旁路') || text.includes('侧轨') || text.includes('错位');
}

function scoreNodeChoice(choice, state) {
  const nodeType = detectNodeType(choice);
  const route = getRouteFromId(choice.baseId) ?? detectRouteFromText(choice.text);
  const focusRoute = state.focusRoute ?? getFocusRoute(state.routeScores);
  let score = 0;

  if (nodeType === 'boss') score += 200;
  if (choice.text.includes('最终整备')) score += 14;
  if (nodeType === 'event' && !state.seenEventNode) score += 10;
  if (nodeType === 'upgrade') score += state.hpRatio < 0.55 ? 11 : 8;
  if (nodeType === 'battle') score += state.upgradeCount >= 4 ? 5 : 2;
  if (choice.text.includes('精英战')) score += state.upgradeCount >= 5 ? 4 : 1;
  if (state.hpRatio < 0.4 && nodeType === 'battle') score -= 4;
  if (route && focusRoute === route) score += 4;
  if (route && !focusRoute) score += 2;

  return score;
}

function scoreUpgradeChoice(choice, state) {
  const route = getRouteFromId(choice.baseId) ?? detectRouteFromText(choice.text);
  const focusRoute = state.focusRoute ?? getFocusRoute(state.routeScores);
  const rarityBonus = choice.rarityLabel === '金'
    ? 5
    : choice.rarityLabel === '紫'
      ? 4
      : choice.rarityLabel === '蓝'
        ? 3
        : choice.rarityLabel === '绿'
          ? 2
          : 1;
  let score = rarityBonus * 0.8;

  if (route) {
    if (state.lockedRoute && route === state.lockedRoute) score += 18;
    else if (!state.lockedRoute && focusRoute === route) score += 13;
    else if (!state.lockedRoute) score += 9;
    else score -= 4;
  }

  if (GENERIC_SURVIVAL_IDS.has(choice.baseId)) score += state.hpRatio < 0.5 ? 9 : 6;
  if (GENERIC_OFFENSE_IDS.has(choice.baseId)) score += 4;
  if (isRareUpgrade(choice)) score += 2;
  if (isHybridChoice(choice)) score += state.lockedRoute ? 2 : 4;
  if (isRedirectChoice(choice) && state.phase !== 'opening') score += 3;
  if (choice.text.includes('恢复') || choice.text.includes('耐久') || choice.text.includes('生命')) score += state.hpRatio < 0.6 ? 4 : 1;
  if (choice.text.includes('通关奖励')) score += 1;

  return { score, route };
}

function pickChoice(choices, state) {
  const nodePanel = choices.every((choice) => choice.className.includes('choice-strip-node'));
  const ranked = choices
    .map((choice) => ({
      choice,
      meta: nodePanel ? { score: scoreNodeChoice(choice, state), route: null } : scoreUpgradeChoice(choice, state),
    }))
    .sort((left, right) => right.meta.score - left.meta.score);
  return { nodePanel, ranked, picked: ranked[0]?.choice ?? choices[0], meta: ranked[0]?.meta ?? { score: 0, route: null } };
}

function computeMovement(snapshot) {
  if (!snapshot || snapshot.status !== 'battle') return [];

  const playerX = snapshot.playerX;
  const playerY = snapshot.playerY;
  let steerX = (CENTER_X - playerX) * 0.003;
  let steerY = (CENTER_Y - playerY) * 0.003;

  if (playerX < 240) steerX += 3;
  if (playerX > ARENA_WIDTH - 240) steerX -= 3;
  if (playerY < 200) steerY += 3;
  if (playerY > ARENA_HEIGHT - 200) steerY -= 3;

  if (snapshot.pressureSafeWindowSec > 0.05 && snapshot.pressureSafeWindowSpan > 0) {
    const urgency = snapshot.pressureSafeWindowTravelDistance > 0 ? 0.018 : 0.009;
    if (snapshot.pressureSafeWindowAxis === 'vertical') {
      steerX += (snapshot.pressureSafeWindowCenter - playerX) * urgency;
    } else if (snapshot.pressureSafeWindowAxis === 'horizontal') {
      steerY += (snapshot.pressureSafeWindowCenter - playerY) * urgency;
    } else {
      steerX += (snapshot.pressureSafeWindowCenter - playerX) * 0.012;
      steerY += (snapshot.pressureSafeWindowSecondaryCenter - playerY) * 0.012;
    }
  }

  for (const projectile of snapshot.enemyProjectiles ?? []) {
    const dx = playerX - projectile.x;
    const dy = playerY - projectile.y;
    const distance = Math.max(18, Math.hypot(dx, dy));
    const weight = distance < 200 ? 26000 / (distance * distance) : 9000 / (distance * distance);
    steerX += (dx / distance) * weight;
    steerY += (dy / distance) * weight;

    const futureDx = playerX - (projectile.x + projectile.vx * 0.32);
    const futureDy = playerY - (projectile.y + projectile.vy * 0.32);
    const futureDistance = Math.max(18, Math.hypot(futureDx, futureDy));
    if (futureDistance < 120) {
      const perpX = -projectile.vy;
      const perpY = projectile.vx;
      const side = (futureDx * perpX + futureDy * perpY) >= 0 ? 1 : -1;
      const magnitude = Math.max(1, Math.hypot(perpX, perpY));
      steerX += side * (perpX / magnitude) * 2.4;
      steerY += side * (perpY / magnitude) * 2.4;
    }
  }

  let eliteTarget = null;
  let eliteDistance = Infinity;
  for (const enemy of snapshot.enemies ?? []) {
    const dx = playerX - enemy.x;
    const dy = playerY - enemy.y;
    const distance = Math.max(24, Math.hypot(dx, dy));
    const repel = distance < 280 ? 180 / distance : 72 / distance;
    steerX += (dx / distance) * repel;
    steerY += (dy / distance) * repel;

    if ((enemy.elite || enemy.role === 'elite') && distance < eliteDistance) {
      eliteTarget = enemy;
      eliteDistance = distance;
    }
  }

  if (eliteTarget) {
    const dx = eliteTarget.x - playerX;
    const dy = eliteTarget.y - playerY;
    const distance = Math.max(40, Math.hypot(dx, dy));
    const tangentX = -dy / distance;
    const tangentY = dx / distance;
    steerX += tangentX * 1.3;
    steerY += tangentY * 1.3;
    if (distance < 240) {
      steerX -= (dx / distance) * 1.9;
      steerY -= (dy / distance) * 1.9;
    } else if (distance > 420) {
      steerX += (dx / distance) * 0.8;
      steerY += (dy / distance) * 0.8;
    }
  }

  const keys = [];
  if (steerX > 0.45) keys.push('KeyD');
  if (steerX < -0.45) keys.push('KeyA');
  if (steerY > 0.45) keys.push('KeyS');
  if (steerY < -0.45) keys.push('KeyW');
  return keys;
}

async function setKeys(page, heldKeys, desiredKeys) {
  for (const key of [...heldKeys]) {
    if (!desiredKeys.includes(key)) {
      await page.keyboard.up(key);
      heldKeys.delete(key);
    }
  }
  for (const key of desiredKeys) {
    if (!heldKeys.has(key)) {
      await page.keyboard.down(key);
      heldKeys.add(key);
    }
  }
}

async function readChoices(page) {
  return page.$$eval('[data-choice]', (elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') ?? '',
      baseId: (element.getAttribute('data-choice') ?? '').split(':')[0],
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      className: element.className,
      modeLabel: (element.querySelector('.choice-mode-badge')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      rarityLabel: (element.querySelector('.choice-rarity')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
}

async function exportMetrics(page) {
  return page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
}

async function readBattleDebug(page) {
  return page.evaluate(() => (window.__pilotBattleDebug ? window.__pilotBattleDebug() : null));
}

async function runScenario(browser, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const heldKeys = new Set();
  const summary = {
    runIndex: index,
    consoleErrors: [],
    failed404: [],
    panels: 0,
    resultSeen: false,
    timedOut: false,
    bossSeen: false,
    selectedChoices: [],
  };
  const state = {
    routeScores: { crit: 0, pierce: 0, dash: 0 },
    focusRoute: null,
    lockedRoute: null,
    phase: 'opening',
    hpRatio: 1,
    seenEventNode: false,
    upgradeCount: 0,
  };

  page.on('console', (message) => {
    if (message.type() === 'error') summary.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(String(error));
  });
  page.on('response', (response) => {
    if (response.status() === 404) summary.failed404.push(response.url());
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  if (index === 1) {
    await page.screenshot({ path: path.join(OUT_DIR, 'run-01-menu.png'), fullPage: true });
  }
  await page.click('[data-action="start"]');
  await page.waitForTimeout(700);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (await page.locator('[data-action="restart"]').count()) {
      summary.resultSeen = true;
      break;
    }

    const debug = await readBattleDebug(page);
    if (debug?.status === 'battle') {
      state.phase = debug.phase ?? state.phase;
      state.hpRatio = debug.playerMaxHp > 0 ? debug.playerHp / debug.playerMaxHp : 1;
      if (typeof debug.templateId === 'string' && debug.templateId.startsWith('boss')) {
        summary.bossSeen = true;
      }
    }

    const choices = await readChoices(page);
    if (choices.length > 0) {
      await setKeys(page, heldKeys, []);
      const { nodePanel, picked, meta } = pickChoice(choices, state);
      summary.panels += 1;
      summary.selectedChoices.push({
        panel: nodePanel ? 'node' : 'reward',
        pickedId: picked.id,
        pickedText: picked.text,
        score: Number(meta.score.toFixed(2)),
      });

      if (nodePanel) {
        const nodeType = detectNodeType(picked);
        if (nodeType === 'event') state.seenEventNode = true;
      } else {
        state.upgradeCount += 1;
        if (meta.route) {
          state.routeScores[meta.route] += isHybridChoice(picked) ? 2 : 1;
          state.focusRoute = getFocusRoute(state.routeScores);
          if (!state.lockedRoute && state.routeScores[meta.route] >= 2) {
            state.lockedRoute = meta.route;
          }
        }
      }

      await page.click(`[data-choice="${picked.id}"]`);
      await page.waitForTimeout(nodePanel ? 420 : 280);
      continue;
    }

    const desiredKeys = computeMovement(debug);
    await setKeys(page, heldKeys, desiredKeys);

    if (index <= 2 && (step === 20 || step === 120 || step === 260)) {
      await page.screenshot({ path: path.join(OUT_DIR, `run-${String(index).padStart(2, '0')}-step-${step}.png`), fullPage: true });
    }

    await page.waitForTimeout(120);
  }

  await setKeys(page, heldKeys, []);
  await page.waitForTimeout(900);
  if (await page.locator('[data-action="restart"]').count()) {
    summary.resultSeen = true;
    await page.screenshot({ path: path.join(OUT_DIR, `run-${String(index).padStart(2, '0')}-result.png`), fullPage: true });
  }

  const metrics = await exportMetrics(page);
  const session = metrics.sessions[metrics.sessions.length - 1];
  summary.lastRun = session.runs[session.runs.length - 1] ?? null;
  summary.endBattleDebug = await readBattleDebug(page);
  if (!summary.resultSeen) {
    summary.timedOut = true;
    if (typeof summary.endBattleDebug?.templateId === 'string' && summary.endBattleDebug.templateId.startsWith('boss')) {
      summary.bossSeen = true;
    }
  }
  summary.finalScreenText = await readFinalScreenText(page);
  summary.failed404 = [...new Set(summary.failed404)];

  await context.close();
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
    bossReachedRuns: runs.filter((run) => run.lastRun?.finalNodeType === 'boss' || run.bossSeen).length,
    timedOutRuns: runs.filter((run) => run.timedOut).length,
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

  const scriptPath = new URL(import.meta.url).pathname.replace(/^\//, '');
  const report = {
    sourceScript: path.relative(process.cwd(), scriptPath).replace(/\\/g, '/'),
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
