import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = "E:/codex/unity-learning/output/playwright/battle-feel-pass/round20/family-check";
const url = "http://127.0.0.1:4187";
const candidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
const summary = { consoleErrors: [], resultSeen: false, replaySeen: false };

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (msg) => { if (msg.type() === "error") summary.consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => summary.consoleErrors.push(String(err)));
const wait = (ms) => page.waitForTimeout(ms);

const movePattern = async () => {
  for (const [key, duration] of [["KeyD", 760], ["KeyS", 440], ["KeyA", 860], ["KeyW", 520], ["KeyD", 420]]) {
    await page.keyboard.down(key);
    await wait(duration);
    await page.keyboard.up(key);
    if ((await page.locator("[data-choice]").count()) > 0 || (await page.locator("[data-action='restart']").count()) > 0) return;
  }
};

await page.goto(url, { waitUntil: "domcontentloaded" });
await wait(800);
await page.locator("[data-action='start']").click();
await wait(900);

for (let step = 0; step < 40; step += 1) {
  if ((await page.locator("[data-action='restart']").count()) > 0) break;
  if ((await page.locator("[data-choice]").count()) > 0) {
    await page.locator("[data-choice]").first().click();
    await wait(320);
    continue;
  }
  await movePattern();
  if (step === 8) {
    await page.screenshot({ path: path.join(outputDir, "battle-family-mid.png"), fullPage: true });
  }
  if (step === 14) {
    await page.screenshot({ path: path.join(outputDir, "battle-family-late.png"), fullPage: true });
  }
}

await wait(1000);
if ((await page.locator("[data-action='restart']").count()) > 0) {
  summary.resultSeen = true;
  await page.screenshot({ path: path.join(outputDir, "result.png"), fullPage: true });
  await page.locator("[data-action='restart']").click();
  await wait(900);
  summary.replaySeen = (await page.locator(".hud-shell").count()) > 0 || (await page.locator("[data-choice]").count()) > 0;
}

fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();