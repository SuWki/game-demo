import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173";
const OUT_DIR = path.resolve("output/playwright/ratio-boundaries/switch-seeker");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUTE_LABELS = { crit: "暴击", pierce: "穿透", dash: "穿梭" };
const ROUTE_KEYWORDS = {
  crit: ["暴击", "升温", "热区", "爆链", "聚焦", "灼区", "旁路升温"],
  pierce: ["穿透", "裂轨", "回响", "扇裂", "贯穿", "棱镜", "侧轨借线"],
  dash: ["穿梭", "擦身", "回线", "换位", "瞬返", "侧滑", "错位取样"],
};
const REDIRECT_KEYWORDS = ["岔路", "接驳", "旁路", "侧轨", "错位", "偏航", "接入", "切向"];
const HYBRID_KEYWORDS = ["侧频缓存", "开环余量", "交叉回授", "终段并轨", "镜像缓存"];

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  } catch {
    return await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  }
}

function normalize(value) { return (value ?? "").replace(/\s+/g, " ").trim(); }
async function exportMetrics(page) { return page.evaluate(() => JSON.parse(window.__exportPilotMetrics())); }
async function readChoices(page) {
  return page.$$eval('.choice-card[data-choice]', (elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') ?? '',
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      type: (element.querySelector('.choice-type')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
}

function choiceRoute(choice) {
  const text = `${choice.type} ${choice.text}`;
  const scored = Object.entries(ROUTE_KEYWORDS).map(([routeId, keywords]) => ({
    routeId,
    score: keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].routeId : null;
}

function chooseNode(choices) {
  return choices.find((choice) => /偏航|接驳|事件/.test(choice.text) || choice.type.includes('事件'))
    ?? choices.find((choice) => choice.type.includes('强化'))
    ?? choices[0];
}

function choosePanel(choices, startRoute, targetRoute, lockedStartRoute) {
  const scored = choices.map((choice) => {
    const route = choiceRoute(choice);
    const text = `${choice.type} ${choice.text}`;
    let score = 0;
    if (!lockedStartRoute && route === startRoute) score += 12;
    if (lockedStartRoute && route === targetRoute) score += 14;
    if (lockedStartRoute && route !== startRoute && (text.includes(ROUTE_LABELS[targetRoute]) || REDIRECT_KEYWORDS.some((keyword) => text.includes(keyword)))) score += 8;
    if (REDIRECT_KEYWORDS.some((keyword) => text.includes(keyword))) score += 7;
    if (HYBRID_KEYWORDS.some((keyword) => text.includes(keyword))) score += 5;
    return { choice, route, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.choice ?? choices[0];
}

async function moveBurst(page) {
  for (const [key, duration] of [["KeyD", 260], ["KeyS", 200], ["KeyA", 260], ["KeyW", 200], ["KeyD", 180]]) {
    if (await page.locator('.choice-card[data-choice]').count()) break;
    if (await page.locator('[data-action="restart"]').count()) break;
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(70);
  }
}

async function runScenario(browser, index, startRoute, targetRoute) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-action="start"]');
  await page.waitForTimeout(600);

  let lockedStartRoute = false;
  let branchSwitchSeen = false;

  for (let step = 0; step < 240; step += 1) {
    const metrics = await exportMetrics(page);
    const session = metrics.sessions[metrics.sessions.length - 1];
    const switchEvent = session.events.find((event) => event.name === 'branch_switch');
    if (switchEvent) {
      branchSwitchSeen = true;
      await page.screenshot({ path: path.join(OUT_DIR, `scenario-${index}-switch.png`), fullPage: true });
      break;
    }

    if (await page.locator('[data-action="restart"]').count()) {
      break;
    }

    const choiceCount = await page.locator('.choice-card[data-choice]').count();
    if (choiceCount > 0) {
      const choices = await readChoices(page);
      const isNodePanel = choices.every((choice) => ['战斗', '强化', '事件'].some((label) => choice.type.includes(label)));
      let selected;
      if (isNodePanel) {
        selected = chooseNode(choices);
      } else {
        selected = choosePanel(choices, startRoute, targetRoute, lockedStartRoute);
        const route = choiceRoute(selected);
        if (!lockedStartRoute && route === startRoute) {
          lockedStartRoute = true;
        }
      }
      if (selected) {
        await page.click(`[data-choice="${selected.id}"]`);
        await page.waitForTimeout(320);
        continue;
      }
    }

    await moveBurst(page);
  }

  await page.screenshot({ path: path.join(OUT_DIR, `scenario-${index}-final.png`), fullPage: true });
  const metrics = await exportMetrics(page);
  const session = metrics.sessions[metrics.sessions.length - 1];
  const lastRun = session.runs[session.runs.length - 1] ?? null;
  const result = {
    startRoute,
    targetRoute,
    branchSwitchSeen,
    branchSwitchEvents: session.events.filter((event) => event.name === 'branch_switch'),
    lastRun,
    panelTitle: normalize(await page.locator('.floating-panel .eyebrow').textContent().catch(() => '')),
  };
  await context.close();
  return result;
}

const browser = await launchBrowser();
const results = [];
results.push(await runScenario(browser, 1, 'crit', 'pierce'));
results.push(await runScenario(browser, 2, 'pierce', 'dash'));
results.push(await runScenario(browser, 3, 'dash', 'crit'));
await browser.close();

fs.writeFileSync(path.join(OUT_DIR, 'switch-summary.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
