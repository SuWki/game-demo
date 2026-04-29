import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173";
const OUT_DIR = path.resolve("output/playwright/rare-replay");
const ROUTE_LABELS = {
  crit: "暴击",
  pierce: "穿透",
  dash: "穿梭",
};
const ROUTE_KEYWORDS = {
  crit: ["暴击", "升温", "热区", "爆链", "聚焦", "连发", "灼区"],
  pierce: ["穿透", "裂轨", "回响", "扇裂", "贯穿", "棱镜", "续链"],
  dash: ["穿梭", "擦身", "回线", "换位", "净帧", "瞬返", "侧滑"],
};
const RARE_KEYWORDS = [
  "灼区归档",
  "棱镜破轨",
  "瞬返空档",
  "岔路讯号",
  "黑匣押注",
  "热区记录",
  "裂轨图谱",
  "穿梭记忆",
  "交火求生",
  "绞锁压制",
  "黑匣异常",
  "交火夹层",
];
const HYBRID_KEYWORDS = ["侧频缓存", "开环余量", "岔路讯号", "黑匣押注"];
const NODE_TYPE_ORDER = ["事件", "强化", "战斗"];

fs.mkdirSync(OUT_DIR, { recursive: true });

function normalize(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: "msedge",
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    });
  } catch {
    return await chromium.launch({
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    });
  }
}

async function capture(page, name) {
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    fullPage: true,
  });
}

async function getChoices(page) {
  return page.$$eval(".choice-card[data-choice]", (elements) =>
    elements.map((element) => ({
      id: element.getAttribute("data-choice") ?? "",
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      type: (element.querySelector(".choice-type")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
}

function scoreRouteChoice(choice, routeId) {
  const routeLabel = ROUTE_LABELS[routeId];
  let score = 0;
  if (choice.type === routeLabel || choice.text.includes(routeLabel)) {
    score += 12;
  }
  for (const keyword of ROUTE_KEYWORDS[routeId]) {
    if (choice.text.includes(keyword)) {
      score += 2;
    }
  }
  for (const keyword of HYBRID_KEYWORDS) {
    if (choice.text.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

function chooseNodeChoice(choices, seenNodeTypes) {
  const rareNode = choices.find((choice) => RARE_KEYWORDS.some((keyword) => choice.text.includes(keyword)));
  if (rareNode) {
    return rareNode;
  }

  for (const nodeType of NODE_TYPE_ORDER) {
    const candidate = choices.find((choice) => choice.type.includes(nodeType) && !seenNodeTypes.has(nodeType));
    if (candidate) {
      seenNodeTypes.add(nodeType);
      return candidate;
    }
  }

  const preferred = choices.find((choice) => choice.type.includes("事件"))
    ?? choices.find((choice) => choice.type.includes("强化"))
    ?? choices[0];
  if (preferred?.type) {
    for (const nodeType of NODE_TYPE_ORDER) {
      if (preferred.type.includes(nodeType)) {
        seenNodeTypes.add(nodeType);
        break;
      }
    }
  }
  return preferred;
}

function choosePanelChoice(choices, routeId) {
  const rareRouteChoice = choices
    .map((choice) => ({ choice, score: scoreRouteChoice(choice, routeId) + (RARE_KEYWORDS.some((keyword) => choice.text.includes(keyword)) ? 6 : 0) }))
    .sort((left, right) => right.score - left.score)[0];

  if (rareRouteChoice && rareRouteChoice.score > 0) {
    return rareRouteChoice.choice;
  }

  const hybridChoice = choices.find((choice) => HYBRID_KEYWORDS.some((keyword) => choice.text.includes(keyword)));
  return hybridChoice ?? choices[0];
}

async function moveBurst(page) {
  const sequence = [
    ["KeyD", 320],
    ["KeyS", 250],
    ["KeyA", 320],
    ["KeyW", 250],
    ["KeyD", 220],
    ["KeyW", 200],
  ];

  for (const [key, duration] of sequence) {
    const panelVisible = await page.locator("[data-choice]").count();
    const resultVisible = await page.locator('[data-action="restart"]').count();
    if (panelVisible > 0 || resultVisible > 0) {
      break;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
  }
}

async function exportMetrics(page) {
  return page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
}

async function runScenario(browser, routeId, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const seenNodeTypes = new Set();
  const summary = {
    routeId,
    consoleErrors: [],
    rarePanels: [],
    chosen: [],
    replayStarted: false,
    metrics: null,
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      summary.consoleErrors.push(message.text());
    }
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await capture(page, `${routeId}-menu.png`);
  await page.click('[data-action="start"]');
  await page.waitForTimeout(500);

  for (let step = 0; step < 220; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }

    const choiceCount = await page.locator(".choice-card[data-choice]").count();
    if (choiceCount > 0) {
      const choices = await getChoices(page);
      const isNodePanel = choices.every((choice) => NODE_TYPE_ORDER.some((label) => choice.type.includes(label)));
      const panelTitle = normalize(await page.locator(".floating-panel .eyebrow").textContent().catch(() => ""));
      const selected = isNodePanel ? chooseNodeChoice(choices, seenNodeTypes) : choosePanelChoice(choices, routeId);

      if (choices.some((choice) => RARE_KEYWORDS.some((keyword) => choice.text.includes(keyword)))) {
        const tag = `${routeId}-rare-panel-${summary.rarePanels.length + 1}.png`;
        await capture(page, tag);
        summary.rarePanels.push({
          tag,
          panelTitle,
          choices,
        });
      }

      summary.chosen.push({
        panelTitle,
        choice: selected?.text ?? "",
      });

      if (selected) {
        await page.click(`[data-choice="${selected.id}"]`);
        await page.waitForTimeout(320);
        continue;
      }
    }

    await moveBurst(page);
  }

  await page.waitForTimeout(1000);
  await capture(page, `${routeId}-final.png`);
  summary.metrics = await exportMetrics(page);

  if ((await page.locator('[data-action="restart"]').count()) > 0 && options.replay) {
    await page.click('[data-action="restart"]');
    await page.waitForTimeout(800);
    summary.replayStarted = (await page.locator(".hud-shell").count()) > 0 || (await page.locator("[data-choice]").count()) > 0;
    await capture(page, `${routeId}-replay.png`);
    summary.metricsAfterReplay = await exportMetrics(page);
  }

  await context.close();
  return summary;
}

const browser = await launchBrowser();
const results = [];
results.push(await runScenario(browser, "crit", { replay: true }));
results.push(await runScenario(browser, "pierce"));
results.push(await runScenario(browser, "dash"));
await browser.close();

fs.writeFileSync(path.join(OUT_DIR, "rare-replay-summary.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
