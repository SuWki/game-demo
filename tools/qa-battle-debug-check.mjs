import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/battle-debug';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  battleDebugSnapshots: [],
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

  // 持续战斗并采样 debug 数据
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);
    
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });
    if (debug) {
      summary.battleDebugSnapshots.push({
        step: i,
        templateId: debug.templateId,
        eliteAlive: debug.eliteAlive,
        eliteBehavior: debug.eliteBehavior,
        bossFirelineCoverage: debug.bossFirelineCoverage,
        bossSafeWindowMoments: debug.bossSafeWindowMoments,
        pressurePhaseLabel: debug.pressurePhaseLabel,
      });
    }
    
    // 如果有选择面板就点第一个
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(400);
    }
    
    // 检查是否到结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && i > 10) break;
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log('Battle debug check done. Snapshots:', summary.battleDebugSnapshots.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
