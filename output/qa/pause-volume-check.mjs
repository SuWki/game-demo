import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'E:/codex/unity-learning/output/qa/pause-volume-check';
const url = 'http://127.0.0.1:4187';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
const summary = { consoleErrors: [], initialVolume: null, volumeAfterAdjust: null };

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => { if (msg.type() === 'error') summary.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => summary.consoleErrors.push(String(err)));
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await wait(700);
await page.screenshot({ path: path.join(outDir, 'menu.png'), fullPage: true });
await page.locator('[data-action="start"]').click();
await wait(1200);
await page.screenshot({ path: path.join(outDir, 'battle.png'), fullPage: true });

await page.locator('[data-action="pause"]').click();
await wait(300);
await page.screenshot({ path: path.join(outDir, 'pause.png'), fullPage: true });

await page.locator('.panel-layer:not(.hidden) [data-action="volume"]').click();
await wait(300);
await page.screenshot({ path: path.join(outDir, 'volume.png'), fullPage: true });
summary.initialVolume = await page.evaluate(() => window.__pilotAudioDebug ? window.__pilotAudioDebug().masterVolume : null);
const slider = page.locator('[data-volume-slider]');
await slider.evaluate((el) => {
  const input = el;
  input.value = '78';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(150);
summary.volumeAfterAdjust = await page.evaluate(() => window.__pilotAudioDebug ? window.__pilotAudioDebug().masterVolume : null);
await page.screenshot({ path: path.join(outDir, 'volume-78.png'), fullPage: true });
await page.locator('.panel-layer:not(.hidden) [data-action="close"]').click();
await wait(200);
await page.screenshot({ path: path.join(outDir, 'after-close.png'), fullPage: true });

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
