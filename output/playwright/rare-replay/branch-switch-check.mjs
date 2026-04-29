import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173";
const OUT_DIR = path.resolve("output/playwright/rare-replay");

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

async function readChoices(page) {
  return page.$$eval(".choice-card[data-choice]", (elements) =>
    elements.map((element) => ({
      id: element.getAttribute("data-choice") ?? "",
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      type: (element.querySelector(".choice-type")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
}

function choosePivotChoice(choices, pivotRoute) {
  const routeChoice = choices.find((choice) => choice.type.includes(pivotRoute))
    ?? choices.find((choice) => choice.text.includes(pivotRoute))
    ?? choices[0];
  return routeChoice;
}

function chooseNode(choices, seenEvent) {
  if (!seenEvent) {
    return choices.find((choice) => choice.type.includes("事件"))
      ?? choices.find((choice) => choice.type.includes("强化"))
      ?? choices[0];
  }
  return choices.find((choice) => choice.type.includes("强化"))
    ?? choices.find((choice) => choice.type.includes("事件"))
    ?? choices[0];
}

async function moveBurst(page) {
  const sequence = [
    ["KeyD", 300],
    ["KeyS", 220],
    ["KeyA", 300],
    ["KeyW", 220],
  ];
  for (const [key, duration] of sequence) {
    if ((await page.locator("[data-choice]").count()) > 0) {
      break;
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

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const page = await context.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.click('[data-action="start"]');
await page.waitForTimeout(500);

let firstRoutePicked = false;
let seenEvent = false;
let branchSwitchSeen = false;

for (let step = 0; step < 180; step += 1) {
  const metrics = await exportMetrics(page);
  const currentSession = metrics.sessions[metrics.sessions.length - 1];
  const switchEvent = currentSession.events.find((event) => event.name === "branch_switch");
  if (switchEvent) {
    branchSwitchSeen = true;
    await page.screenshot({
      path: path.join(OUT_DIR, "branch-switch-hit.png"),
      fullPage: true,
    });
    break;
  }

  if ((await page.locator('[data-action="restart"]').count()) > 0) {
    break;
  }

  const choiceCount = await page.locator(".choice-card[data-choice]").count();
  if (choiceCount > 0) {
    const choices = await readChoices(page);
    const isNodePanel = choices.every((choice) => ["战斗", "强化", "事件"].some((label) => choice.type.includes(label)));
    let selected;

    if (isNodePanel) {
      selected = chooseNode(choices, seenEvent);
      if (selected?.type.includes("事件")) {
        seenEvent = true;
      }
    } else if (!firstRoutePicked) {
      selected = choosePivotChoice(choices, "暴击");
      firstRoutePicked = true;
    } else {
      selected = choosePivotChoice(choices, "穿透");
    }

    if (selected) {
      await page.click(`[data-choice="${selected.id}"]`);
      await page.waitForTimeout(280);
      continue;
    }
  }

  await moveBurst(page);
}

const exported = await exportMetrics(page);
const session = exported.sessions[exported.sessions.length - 1];
const result = {
  branchSwitchSeen,
  branchSwitchEvents: session.events.filter((event) => event.name === "branch_switch"),
  lastRun: session.runs[session.runs.length - 1] ?? null,
  lastEvents: session.events.slice(-12),
  panelTitle: normalize(await page.locator(".floating-panel .eyebrow").textContent().catch(() => "")),
};

fs.writeFileSync(path.join(OUT_DIR, "branch-switch-summary.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await context.close();
await browser.close();
