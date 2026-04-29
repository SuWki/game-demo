import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = "E:/codex/unity-learning/output/playwright/battle-feel-pass/round20/elite-quick-check";
const url = "http://127.0.0.1:4187";
const candidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
const summary = {
  consoleErrors: [],
  eliteSeen: false,
  crackSeen: false,
  resultSeen: false,
  replaySeen: false,
  eliteSnapshots: [],
};

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (msg) => {
  if (msg.type() === "error") summary.consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => summary.consoleErrors.push(String(err)));
const wait = (ms) => page.waitForTimeout(ms);
const readBattleDebug = () => page.evaluate(() => (window.__pilotBattleDebug ? window.__pilotBattleDebug() : null));

const movePattern = async () => {
  for (const [key, duration] of [["KeyD", 660], ["KeyS", 420], ["KeyA", 760], ["KeyW", 480], ["KeyD", 360]]) {
    await page.keyboard.down(key);
    await wait(duration);
    await page.keyboard.up(key);
    if ((await page.locator("[data-choice]").count()) > 0 || (await page.locator("[data-action='restart']").count()) > 0) {
      return;
    }
  }
};

await page.goto(url, { waitUntil: "domcontentloaded" });
await wait(800);
await page.locator("[data-action='start']").click();
await wait(900);

for (let step = 0; step < 56; step += 1) {
  if ((await page.locator("[data-action='restart']").count()) > 0) {
    break;
  }

  if ((await page.locator("[data-choice]").count()) > 0) {
    await page.locator("[data-choice]").first().click();
    await wait(320);
    continue;
  }

  const battleDebug = await readBattleDebug();
  if (battleDebug?.eliteAlive && battleDebug.encounterType === "battle") {
    summary.eliteSeen = true;
    summary.eliteSnapshots.push({
      templateId: battleDebug.templateId,
      eliteRecoverySec: battleDebug.eliteRecoverySec,
      escortCount: battleDebug.escortCount,
      escortRecoveryCount: battleDebug.escortRecoveryCount,
    });
    if (!fs.existsSync(path.join(outputDir, "elite-seen.png"))) {
      await page.screenshot({ path: path.join(outputDir, "elite-seen.png"), fullPage: true });
    }
    if (!summary.crackSeen && battleDebug.eliteRecoverySec > 0.08) {
      summary.crackSeen = true;
      await page.screenshot({ path: path.join(outputDir, "elite-crack.png"), fullPage: true });
    }
  }

  await movePattern();
}

await wait(1000);
if ((await page.locator("[data-action='restart']").count()) > 0) {
  summary.resultSeen = true;
  await page.screenshot({ path: path.join(outputDir, "result.png"), fullPage: true });
  await page.locator("[data-action='restart']").click();
  await wait(1000);
  summary.replaySeen = (await page.locator(".hud-shell").count()) > 0 || (await page.locator("[data-choice]").count()) > 0;
}

fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();