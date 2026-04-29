import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/pause-resume';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  pausePanelVisible: false,
  resumeHidesPanel: false,
  hudVisibleAfterResume: false,
  consoleErrors: [],
};

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => {
    if (message.type() === 'error') summary.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => summary.consoleErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1200);

  // 进入战斗后暂停
  await page.locator('[data-action="pause"]').click();
  await page.waitForTimeout(400);
  summary.pausePanelVisible = (await page.locator('.commercial-pause-panel').count()) > 0;
  await page.screenshot({ path: path.join(outputDir, '01-pause-open.png'), fullPage: true });

  // 点击继续作战
  await page.locator('.panel-layer:not(.hidden) [data-action="resume"]').click();
  await page.waitForTimeout(600);
  summary.resumeHidesPanel = (await page.locator('.commercial-pause-panel').count()) === 0;
  summary.hudVisibleAfterResume = (await page.locator('.game-hud-fixed').count()) > 0;
  await page.screenshot({ path: path.join(outputDir, '02-after-resume.png'), fullPage: true });

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log('Pause-resume check done:', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
