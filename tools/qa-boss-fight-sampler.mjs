import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/boss-fight';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  bossSnapshots: [],
  bossFightStarted: false,
  bossFightCompleted: false,
  maxSafeWindowMoments: 0,
  maxFirelineCoverage: 0,
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

  // 开启无敌模式，强制推进到Boss
  await page.evaluate(() => {
    if (window.__pilotDebug) {
      window.__pilotDebug.setInvulnerable?.(true);
    }
  });

  // 疯狂点击第一个选择，快速推进到Boss
  let bossFound = false;
  for (let step = 0; step < 50 && !bossFound; step++) {
    // 先检查是否有选择面板
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      // 找Boss选项
      const bossChoice = await page.locator('[data-choice]:has-text("Boss")').first();
      if (await bossChoice.count() > 0) {
        await bossChoice.click();
        bossFound = true;
      } else {
        await page.locator('[data-choice]').first().click();
      }
      await page.waitForTimeout(400);
      continue;
    }
    
    // 检查是否在结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0) break;

    // 战斗中保持移动
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);

    // 采样
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });
    if (debug && debug.templateId && debug.templateId.startsWith('boss')) {
      summary.bossFightStarted = true;
      summary.bossSnapshots.push({
        step,
        templateId: debug.templateId,
        eliteAlive: debug.eliteAlive,
        eliteBehavior: debug.eliteBehavior,
        bossFirelineCoverage: debug.bossFirelineCoverage,
        bossSafeWindowMoments: debug.bossSafeWindowMoments,
        pressurePhaseLabel: debug.pressurePhaseLabel,
        pressurePhaseIndex: debug.pressurePhaseIndex,
      });
      if (debug.bossSafeWindowMoments > summary.maxSafeWindowMoments) {
        summary.maxSafeWindowMoments = debug.bossSafeWindowMoments;
      }
      if (debug.bossFirelineCoverage > summary.maxFirelineCoverage) {
        summary.maxFirelineCoverage = debug.bossFirelineCoverage;
      }
      await page.screenshot({ path: path.join(outputDir, `boss-${String(step).padStart(2, '0')}.png`) });
    }
  }

  summary.bossFightCompleted = (await page.locator('[data-action="restart"]').count()) > 0;

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log('Boss fight sampler done. Boss found:', summary.bossFightStarted, 
    'Snapshots:', summary.bossSnapshots.length, 
    'Max safe window moments:', summary.maxSafeWindowMoments,
    'Max fireline coverage:', summary.maxFirelineCoverage);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
