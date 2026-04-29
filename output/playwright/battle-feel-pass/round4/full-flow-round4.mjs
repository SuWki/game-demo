import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round4/full-flow';
const url = 'http://127.0.0.1:4178';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
const summary = { consoleErrors: [], panels: 0, resultSeen: false, replaySeen: false };
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => { if (msg.type() === 'error') summary.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => summary.consoleErrors.push(String(err)));
const wait = (ms) => page.waitForTimeout(ms);
async function movePattern() {
  for (const [key, duration] of [['KeyD', 660], ['KeyS', 420], ['KeyA', 760], ['KeyW', 420], ['KeyD', 360]]) {
    await page.keyboard.down(key); await wait(duration); await page.keyboard.up(key);
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) return;
  }
}
await page.goto(url, { waitUntil: 'domcontentloaded' });
await wait(700);
await page.screenshot({ path: path.join(outputDir, 'menu.png'), fullPage: true });
await page.click('[data-action="start"]');
await wait(900);
for (let step = 0; step < 72; step += 1) {
  if ((await page.locator('[data-action="restart"]').count()) > 0) break;
  const choices = page.locator('[data-choice]');
  const choiceCount = await choices.count();
  if (choiceCount > 0) {
    summary.panels += 1;
    await page.screenshot({ path: path.join(outputDir, `panel-${step + 1}.png`), fullPage: true });
    await choices.nth(0).click();
    await wait(320);
    continue;
  }
  if (step === 2) {
    await page.screenshot({ path: path.join(outputDir, 'battle.png'), fullPage: true });
  }
  await movePattern();
}
await wait(1000);
if ((await page.locator('[data-action="restart"]').count()) > 0) {
  summary.resultSeen = true;
  await page.screenshot({ path: path.join(outputDir, 'result.png'), fullPage: true });
  await page.click('[data-action="restart"]');
  await wait(1100);
  summary.replaySeen = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
  await page.screenshot({ path: path.join(outputDir, 'replay.png'), fullPage: true });
}
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
