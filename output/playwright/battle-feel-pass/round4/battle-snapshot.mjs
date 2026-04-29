import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round4';
const url = 'http://127.0.0.1:4178';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await wait(700);
await page.click('[data-action="start"]');
await wait(850);
for (const [key, duration] of [['KeyD', 640], ['KeyS', 420], ['KeyA', 920], ['KeyW', 360], ['KeyD', 440]]) {
  await page.keyboard.down(key);
  await wait(duration);
  await page.keyboard.up(key);
  if ((await page.locator('[data-choice]').count()) > 0) break;
}
await wait(260);
await page.screenshot({ path: path.join(outputDir, 'battle-opening.png'), fullPage: true });
for (const [key, duration] of [['KeyA', 760], ['KeyW', 480], ['KeyD', 620], ['KeyS', 320], ['KeyD', 420]]) {
  await page.keyboard.down(key);
  await wait(duration);
  await page.keyboard.up(key);
  if ((await page.locator('[data-choice]').count()) > 0) break;
}
await wait(880);
await page.screenshot({ path: path.join(outputDir, 'battle-pressure.png'), fullPage: true });
await browser.close();
