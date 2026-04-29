import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round17/pressure-idle-check';
const url = 'http://127.0.0.1:4184';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const summary = { consoleErrors: [] };
page.on('console', (msg) => { if (msg.type() === 'error') summary.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => summary.consoleErrors.push(String(err)));
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await wait(700);
await page.locator('[data-action="start"]').click();
await wait(7200);
await page.screenshot({ path: path.join(outputDir, 'battle-idle-pressure.png'), fullPage: true });
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
