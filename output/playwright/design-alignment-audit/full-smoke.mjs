import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = "E:/codex/unity-learning/output/playwright/design-alignment-audit";
fs.mkdirSync(outDir, { recursive: true });

const ROUTE_TYPES = ["\u66b4\u51fb", "\u7a7f\u900f", "\u7a7f\u68ad"];
const NON_ROUTE_TYPES = ["\u901a\u7528", "\u4e8b\u4ef6", "\u5f3a\u5316", "\u6218\u6597"];
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const summary = {
  panels: [],
  choices: [],
  routeChoiceRarities: [],
  routeCommonSeen: false,
  replayStarted: false,
  resultVisible: false,
  consoleErrors: [],
};

page.on("console", (msg) => {
  if (msg.type() === "error") summary.consoleErrors.push(msg.text());
});
page.on("pageerror", (error) => {
  summary.consoleErrors.push(String(error));
});

const wait = (ms) => page.waitForTimeout(ms);
const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
const isRouteType = (type) => ROUTE_TYPES.includes(type);

const snapshotPanel = async (tag) => {
  const title = await page.locator('.floating-panel .eyebrow').textContent().catch(() => null);
  const description = await page.locator('.floating-panel .panel-description').textContent().catch(() => null);
  const choices = await page.locator('[data-choice]').evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') || '',
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      type: ((element.querySelector('.choice-type') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      rarity: ((element.querySelector('.choice-rarity') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    })),
  );
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true });
  summary.panels.push({ tag, title: normalize(title), description: normalize(description), choices });
  summary.routeChoiceRarities.push(
    ...choices.filter((choice) => isRouteType(choice.type)).map((choice) => ({
      title: normalize(title),
      text: choice.text,
      rarity: choice.rarity,
    })),
  );
  if (choices.some((choice) => isRouteType(choice.type) && choice.rarity === "\u767d")) {
    summary.routeCommonSeen = true;
  }
  return { title: normalize(title), choices };
};

const chooseFromPanel = async (panel) => {
  if (!panel.choices.length) return;
  let target = panel.choices[0];
  const isNodePanel = panel.title.includes("\u8282\u70b9\u9009\u62e9");
  const isUpgradePanel = panel.title.includes("\u5f3a\u5316") || panel.title.includes("\u6574\u5907") || panel.title.includes("Lv.");

  if (isNodePanel) {
    target = panel.choices.find((choice) => choice.type === "\u4e8b\u4ef6")
      || panel.choices.find((choice) => choice.type === "\u5f3a\u5316")
      || panel.choices[0];
  } else if (isUpgradePanel) {
    target = panel.choices.find((choice) => choice.type === "\u66b4\u51fb")
      || panel.choices.find((choice) => isRouteType(choice.type))
      || panel.choices[0];
  } else {
    target = panel.choices.find((choice) => choice.type === "\u66b4\u51fb")
      || panel.choices.find((choice) => isRouteType(choice.type))
      || panel.choices[0];
  }

  summary.choices.push({ panel: panel.title, choice: target.text, rarity: target.rarity || null });
  await page.locator(`[data-choice="${target.id}"]`).click();
  await wait(250);
};

const movePattern = async () => {
  const sequence = [
    ["KeyD", 650],
    ["KeyS", 500],
    ["KeyA", 650],
    ["KeyW", 500],
  ];
  for (const [key, duration] of sequence) {
    await page.keyboard.down(key);
    await wait(duration);
    await page.keyboard.up(key);
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }
  }
};

await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
await wait(600);
await page.screenshot({ path: path.join(outDir, 'menu.png'), fullPage: true });
await page.locator('[data-action="start"]').click();
await wait(500);
await page.locator('canvas').click({ position: { x: 40, y: 40 } }).catch(() => undefined);

for (let step = 0; step < 40; step += 1) {
  if (await page.locator('[data-action="restart"]').count()) {
    summary.resultVisible = true;
    break;
  }

  const panelCount = await page.locator('[data-choice]').count();
  if (panelCount > 0) {
    const panel = await snapshotPanel(`panel-${step + 1}`);
    await chooseFromPanel(panel);
    continue;
  }

  await movePattern();
}

await wait(1200);
if (await page.locator('[data-action="restart"]').count()) {
  summary.resultVisible = true;
  await page.screenshot({ path: path.join(outDir, 'result.png'), fullPage: true });
  summary.resultText = normalize(await page.locator('.result-card').textContent().catch(() => ''));
  await page.locator('[data-action="restart"]').click();
  await wait(1200);
  summary.replayStarted = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
  await page.screenshot({ path: path.join(outDir, 'replay.png'), fullPage: true });
}

summary.metrics = await page.evaluate(() => {
  const exported = JSON.parse(window.__exportPilotMetrics());
  const currentSession = exported.sessions[exported.sessions.length - 1];
  const lastRun = currentSession.runs[currentSession.runs.length - 1] || null;
  return {
    runCount: currentSession.runs.length,
    eventCount: currentSession.events.length,
    lastRun,
    lastEvents: currentSession.events.slice(-12),
  };
});

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
console.log(JSON.stringify(summary, null, 2));