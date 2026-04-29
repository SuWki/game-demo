import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  } catch {
    return await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  }
}

const outDir = path.resolve("output/playwright/ratio-boundaries/smoke");
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(outDir, "menu.png"), fullPage: true });
await page.click('[data-action="start"]');
await page.waitForTimeout(1200);
for (const [key, duration] of [["KeyD", 450], ["KeyS", 320], ["KeyA", 420], ["KeyW", 320], ["KeyD", 240]]) {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, "battle.png"), fullPage: true });
const panelVisible = (await page.locator('.choice-card[data-choice]').count()) > 0;
if (panelVisible) {
  await page.screenshot({ path: path.join(outDir, "panel.png"), fullPage: true });
}
const summary = { panelVisible, consoleErrors, title: await page.title() };
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await context.close();
await browser.close();
