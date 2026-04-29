import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173";
const OUT_DIR = path.resolve("output/playwright/commitment-pacing");
const ROUTE_LABELS = {
  crit: "暴击",
  pierce: "穿透",
  dash: "穿梭",
};
const SAFE_KEYWORDS = ["缓冲", "稳", "续航", "整备", "容错", "修正", "保留", "旁路", "冷却"];
const ROUTE_PREFERENCES = {
  crit: ["余热", "连发", "预热", "暴击", "热区", "聚焦", "爆链"],
  pierce: ["导程", "裂轨", "穿透", "贯穿", "回响", "扇裂", "续链"],
  dash: ["换位", "净帧", "穿梭", "回线", "擦身", "侧滑", "余程"],
};

fs.mkdirSync(OUT_DIR, { recursive: true });

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
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function getChoiceButtons(page) {
  return page.$$eval(".choice-card[data-choice]", (elements) =>
    elements.map((element) => ({
      id: element.getAttribute("data-choice"),
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      type: (element.querySelector(".choice-type")?.textContent ?? "").trim(),
    })),
  );
}

function scoreRouteChoice(button, route) {
  const routeLabel = ROUTE_LABELS[route];
  if (!(button.type === routeLabel || button.text.includes(routeLabel))) {
    return -1;
  }

  let score = 10;
  for (const keyword of ROUTE_PREFERENCES[route]) {
    if (button.text.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

function chooseNodeButton(buttons, seenNodeTypes) {
  const byType = new Map(buttons.map((button) => [button.type, button]));
  if (!seenNodeTypes.has("强化") && byType.has("强化")) {
    seenNodeTypes.add("强化");
    return byType.get("强化");
  }
  if (!seenNodeTypes.has("事件") && byType.has("事件")) {
    seenNodeTypes.add("事件");
    return byType.get("事件");
  }
  if (byType.has("战斗")) {
    seenNodeTypes.add("战斗");
    return byType.get("战斗");
  }
  return buttons[0];
}

function choosePanelButton(buttons, route) {
  const scoredRouteButtons = buttons
    .map((button) => ({ button, score: scoreRouteChoice(button, route) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score);

  if (scoredRouteButtons.length > 0) {
    return scoredRouteButtons[0].button;
  }

  const safeButton = buttons.find((button) => SAFE_KEYWORDS.some((keyword) => button.text.includes(keyword)));
  return safeButton ?? buttons[0];
}

async function readHudState(page) {
  return page.evaluate(() => {
    const blockValues = Array.from(document.querySelectorAll(".hud-block strong")).map((element) =>
      (element.textContent ?? "").trim(),
    );
    const routeValues = Array.from(document.querySelectorAll(".route-chip")).map((chip) => ({
      label: (chip.querySelector("span")?.textContent ?? "").trim(),
      value: (chip.querySelector("strong")?.textContent ?? "").trim(),
      active: chip.classList.contains("active"),
    }));

    return {
      level: blockValues[0] ?? "",
      exp: blockValues[1] ?? "",
      phase: blockValues[2] ?? "",
      node: blockValues[3] ?? "",
      hp: blockValues[4] ?? "",
      routeValues,
    };
  });
}

async function moveBurst(page) {
  const sequence = [
    ["KeyD", 260],
    ["KeyS", 220],
    ["KeyA", 260],
    ["KeyW", 220],
    ["KeyD", 180],
    ["KeyW", 180],
  ];

  for (const [key, duration] of sequence) {
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const store = window.__pilotMetrics;
    const session = store.sessions[store.sessions.length - 1];
    return {
      lastRun: session.runs[session.runs.length - 1] ?? null,
      eventNames: session.events.map((event) => event.name),
      lastEvents: session.events.slice(-12),
    };
  });
}

async function runScenario(context, route, options) {
  const page = await context.newPage();
  const seenNodeTypes = new Set();
  let capturedSignal = false;
  let capturedMid = false;

  await page.goto(URL, { waitUntil: "networkidle" });
  await capture(page, `${route}-menu`);
  await page.click('[data-action="start"]');
  await page.waitForTimeout(500);

  for (let step = 0; step < 220; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      await capture(page, `${route}-result`);
      const metrics = await readMetrics(page);

      if (options.replay) {
        await page.click('[data-action="restart"]');
        await page.waitForTimeout(700);
        await capture(page, `${route}-replay`);
        const replayMetrics = await readMetrics(page);
        return {
          route,
          phaseStop: "result",
          metrics,
          replayMetrics,
        };
      }

      return {
        route,
        phaseStop: "result",
        metrics,
      };
    }

    const choiceCount = await page.locator(".choice-card[data-choice]").count();
    if (choiceCount > 0) {
      const buttons = await getChoiceButtons(page);
      const nodePanel = buttons.every((button) => ["战斗", "强化", "事件"].includes(button.type));
      const chosen = nodePanel ? chooseNodeButton(buttons, seenNodeTypes) : choosePanelButton(buttons, route);
      if (!capturedSignal && !nodePanel) {
        await capture(page, `${route}-first-signal`);
        capturedSignal = true;
      }
      await page.click(`[data-choice="${chosen.id}"]`);
      await page.waitForTimeout(300);
      continue;
    }

    const hudState = await readHudState(page);
    if (!capturedMid && hudState.phase === "中段") {
      await capture(page, `${route}-mid`);
      capturedMid = true;
      if (!options.fullRun) {
        return {
          route,
          phaseStop: "mid",
          hudState,
          metrics: await readMetrics(page),
        };
      }
    }

    await moveBurst(page);
  }

  return {
    route,
    phaseStop: "timeout",
    metrics: await readMetrics(page),
  };
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: {
    width: 1440,
    height: 960,
  },
});

const results = [];
results.push(await runScenario(context, "crit", { fullRun: true, replay: true }));
results.push(await runScenario(context, "pierce", { fullRun: false, replay: false }));
results.push(await runScenario(context, "dash", { fullRun: false, replay: false }));

await browser.close();

fs.writeFileSync(path.join(OUT_DIR, "route-flow-summary.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
