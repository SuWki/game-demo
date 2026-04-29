import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round3';
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
await wait(900);
await page.keyboard.down('KeyD');
await wait(700);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyS');
await wait(380);
await page.keyboard.up('KeyS');
await wait(350);
await page.screenshot({ path: path.join(outputDir, 'battle-opening.png'), fullPage: true });
await page.keyboard.down('KeyA');
await wait(920);
await page.keyboard.up('KeyA');
await page.keyboard.down('KeyW');
await wait(460);
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyD');
await wait(520);
await page.keyboard.up('KeyD');
await wait(900);
await page.screenshot({ path: path.join(outputDir, 'battle-pressure.png'), fullPage: true });
await browser.close();
