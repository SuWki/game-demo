import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173";
const OUT_DIR = path.resolve("output/playwright/ratio-boundaries/natural");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUTE_KEYWORDS = {
  crit: ["暴击", "升温", "热区", "爆链", "聚焦", "连发", "灼区", "旁路升温"],
  pierce: ["穿透", "裂轨", "回响", "扇裂", "贯穿", "棱镜", "续链", "侧轨借线"],
  dash: ["穿梭", "擦身", "回线", "换位", "净帧", "瞬返", "侧滑", "错位取样"],
};
const RARE_KEYWORDS = [
  "灼区归档", "棱镜破轨", "瞬返空档", "岔路讯号", "黑匣押注", "热区记录", "裂轨图谱", "穿梭记忆",
  "交火求生", "绞锁压制", "黑匣异常", "交火夹层", "镜像缓存", "终段并轨"
];
const HYBRID_KEYWORDS = [
  "侧频缓存", "开环余量", "交叉回授", "终段并轨", "岔路讯号", "镜像缓存", "侧频接驳", "旁路升温", "侧轨借线", "错位取样"
];
const REDIRECT_KEYWORDS = ["岔路", "接驳", "旁路", "侧轨", "错位", "偏航", "改道"];
const PAYOFF_KEYWORDS = ["终端爆发", "续链增程", "穿梭定标", "灼区归档", "棱镜破轨", "瞬返空档", "终段并轨", "热区记录", "裂轨图谱", "穿梭记忆", "镜像缓存"];
const HEAL_KEYWORDS = ["恢复", "回复", "缓冲", "稳态", "喘息", "补强外甲", "缓冲甲"];
const NODE_TYPE_ORDER = ["事件", "强化", "战斗"];

function normalize(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  } catch {
    return await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  }
}

async function exportMetrics(page) {
  return page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
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

async function readHud(page) {
  const text = normalize(await page.locator('.hud-shell').textContent().catch(() => ''));
  const hpMatch = text.match(/耐久\s*(\d+)\s*\/\s*(\d+)/);
  let phase = 'opening';
  if (text.includes('最终战')) phase = 'finalBattle';
  else if (text.includes('最终整备')) phase = 'finalPrep';
  else if (text.includes('后段')) phase = 'late';
  else if (text.includes('中段')) phase = 'mid';
  return {
    phase,
    hpRatio: hpMatch ? Number(hpMatch[1]) / Math.max(1, Number(hpMatch[2])) : 1,
    text,
  };
}

function detectRoute(text) {
  const scores = Object.entries(ROUTE_KEYWORDS).map(([routeId, keywords]) => ({
    routeId,
    score: keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].routeId : null;
}

function hasAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getFocusRoute(routeScores) {
  return Object.entries(routeScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function chooseNodeChoice(choices, state) {
  const rareNode = choices.find((choice) => hasAnyKeyword(choice.text, RARE_KEYWORDS));
  if (rareNode) return rareNode;

  const midRedirectNode = choices.find((choice) => /偏航|接驳|黑匣/.test(choice.text));
  if ((state.phase === 'mid' || state.phase === 'late') && midRedirectNode) {
    return midRedirectNode;
  }

  if (state.hpRatio < 0.45) {
    return choices.find((choice) => choice.type.includes('强化'))
      ?? choices.find((choice) => choice.type.includes('事件'))
      ?? choices[0];
  }

  if (!state.seenEventNode) {
    const eventNode = choices.find((choice) => choice.type.includes('事件'));
    if (eventNode) {
      return eventNode;
    }
  }

  for (const nodeType of NODE_TYPE_ORDER) {
    const candidate = choices.find((choice) => choice.type.includes(nodeType) && !state.nodeTypeCounts[nodeType]);
    if (candidate) {
      return candidate;
    }
  }

  return choices.find((choice) => choice.type.includes('事件'))
    ?? choices.find((choice) => choice.type.includes('强化'))
    ?? choices[0];
}

function scorePanelChoice(choice, state) {
  const text = `${choice.type} ${choice.text}`;
  const route = detectRoute(text);
  const isRare = hasAnyKeyword(text, RARE_KEYWORDS);
  const isHybrid = hasAnyKeyword(text, HYBRID_KEYWORDS);
  const isRedirect = hasAnyKeyword(text, REDIRECT_KEYWORDS);
  const isPayoff = hasAnyKeyword(text, PAYOFF_KEYWORDS);
  const isHeal = hasAnyKeyword(text, HEAL_KEYWORDS);
  const focusRoute = getFocusRoute(state.routeScores);

  let score = 0;
  if (isRare) score += 10;
  if (isHybrid) score += 8;
  if (isRedirect) score += 7;
  if (isPayoff && (state.phase === 'late' || state.phase === 'finalPrep' || state.phase === 'finalBattle')) score += 6;
  if (isHeal && state.hpRatio < 0.5) score += 5;
  if (route) {
    score += state.routeScores[route] * 1.6;
    if (!focusRoute) score += 2;
    if (focusRoute === route) score += 2.5;
    if (focusRoute && focusRoute !== route && (isHybrid || isRedirect || isRare)) score += 5;
  }
  if (state.phase === 'mid' && state.branchSwitchIntent === 0 && (isHybrid || isRedirect)) {
    score += 3;
  }
  if (state.phase === 'late' && state.rarePanelsSeen === 0 && isRare) {
    score += 4;
  }
  if (choice.text.includes('保留转向余地') || choice.text.includes('并轨余量')) {
    score += 3;
  }

  return { score, route, isRare, isHybrid, isRedirect, isPayoff };
}

async function moveBurst(page) {
  const sequence = [
    ['KeyD', 260],
    ['KeyS', 190],
    ['KeyA', 260],
    ['KeyW', 190],
    ['KeyD', 180],
    ['KeyW', 160],
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

async function runScenario(browser, index, replay = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const summary = {
    runIndex: index,
    consoleErrors: [],
    choices: [],
    rarePanelsSeen: 0,
    replayStarted: false,
  };
  const state = {
    routeScores: { crit: 0, pierce: 0, dash: 0 },
    phase: 'opening',
    hpRatio: 1,
    seenEventNode: false,
    branchSwitchIntent: 0,
    rarePanelsSeen: 0,
    nodeTypeCounts: { '事件': 0, '强化': 0, '战斗': 0 },
  };

  page.on('console', (message) => {
    if (message.type() === 'error') summary.consoleErrors.push(message.text());
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-action="start"]');
  await page.waitForTimeout(600);

  for (let step = 0; step < 260; step += 1) {
    if (await page.locator('[data-action="restart"]').count()) break;

    const hud = await readHud(page);
    state.phase = hud.phase;
    state.hpRatio = hud.hpRatio;

    const choiceCount = await page.locator('.choice-card[data-choice]').count();
    if (choiceCount > 0) {
      const choices = await getChoices(page);
      const isNodePanel = choices.every((choice) => NODE_TYPE_ORDER.some((label) => choice.type.includes(label)));
      const panelTitle = normalize(await page.locator('.floating-panel .eyebrow').textContent().catch(() => ''));
      let selected;

      if (isNodePanel) {
        selected = chooseNodeChoice(choices, state);
        for (const nodeType of NODE_TYPE_ORDER) {
          if (selected?.type.includes(nodeType)) {
            state.nodeTypeCounts[nodeType] += 1;
            if (nodeType === '事件') state.seenEventNode = true;
          }
        }
      } else {
        const scored = choices
          .map((choice) => ({ choice, meta: scorePanelChoice(choice, state) }))
          .sort((left, right) => right.meta.score - left.meta.score);
        selected = scored[0]?.choice;
        const meta = scored[0]?.meta;
        if (meta?.route) {
          state.routeScores[meta.route] += meta.isRedirect ? 3 : meta.isHybrid ? 2 : 1;
          const focusRoute = getFocusRoute(state.routeScores);
          if (focusRoute && meta.route !== focusRoute && (meta.isRedirect || meta.isRare)) {
            state.branchSwitchIntent += 1;
          }
        }
        if (meta?.isRare) {
          state.rarePanelsSeen += 1;
          summary.rarePanelsSeen += 1;
          if (summary.rarePanelsSeen <= 2) {
            await page.screenshot({ path: path.join(OUT_DIR, `run-${index}-rare-${summary.rarePanelsSeen}.png`), fullPage: true });
          }
        }
      }

      if (selected) {
        summary.choices.push({ panelTitle, choice: selected.text });
        await page.click(`[data-choice="${selected.id}"]`);
        await page.waitForTimeout(320);
        continue;
      }
    }

    await moveBurst(page);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, `run-${index}-final.png`), fullPage: true });
  const metrics = await exportMetrics(page);
  const session = metrics.sessions[metrics.sessions.length - 1];
  const lastRun = session.runs[session.runs.length - 1] ?? null;
  summary.lastRun = lastRun;
  summary.branchSwitchEvents = session.events.filter((event) => event.name === 'branch_switch');

  if (replay && (await page.locator('[data-action="restart"]').count())) {
    await page.click('[data-action="restart"]');
    await page.waitForTimeout(900);
    summary.replayStarted = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('.choice-card[data-choice]').count()) > 0;
    await page.screenshot({ path: path.join(OUT_DIR, `run-${index}-replay.png`), fullPage: true });
    summary.metricsAfterReplay = await exportMetrics(page);
  }

  await context.close();
  return summary;
}

const browser = await launchBrowser();
const runs = [];
for (let index = 1; index <= 4; index += 1) {
  runs.push(await runScenario(browser, index, index === 1));
}
await browser.close();

const aggregate = {
  totalRuns: runs.length,
  branchSwitchNonZeroRuns: runs.filter((run) => (run.lastRun?.branchSwitchCount ?? 0) > 0).length,
  rareSeenRuns: runs.filter((run) => (run.lastRun?.rareSeenCount ?? 0) > 0).length,
  hybridPickRuns: runs.filter((run) => (run.lastRun?.hybridPickCount ?? 0) > 0).length,
  latePayoffRuns: runs.filter((run) => (run.lastRun?.latePayoffSeenCount ?? 0) > 0).length,
  averageBranchSwitchCount: Number((runs.reduce((sum, run) => sum + (run.lastRun?.branchSwitchCount ?? 0), 0) / runs.length).toFixed(2)),
  averageRareSeenCount: Number((runs.reduce((sum, run) => sum + (run.lastRun?.rareSeenCount ?? 0), 0) / runs.length).toFixed(2)),
  averageHybridPickCount: Number((runs.reduce((sum, run) => sum + (run.lastRun?.hybridPickCount ?? 0), 0) / runs.length).toFixed(2)),
  averageLatePayoffSeenCount: Number((runs.reduce((sum, run) => sum + (run.lastRun?.latePayoffSeenCount ?? 0), 0) / runs.length).toFixed(2)),
  consoleErrorRuns: runs.filter((run) => run.consoleErrors.length > 0).length,
};

const report = { aggregate, runs };
fs.writeFileSync(path.join(OUT_DIR, 'natural-summary.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
