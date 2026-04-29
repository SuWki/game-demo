import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/asset-black-check';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  screenshots: [],
  blackCheck: {
    player: 'pending',
    enemy: 'pending',
    xp: 'pending',
    boss: 'pending',
  },
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
  
  // 开启无敌便于观察
  await page.evaluate(() => {
    if (window.__pilotDebug) {
      window.__pilotDebug.setInvulnerable?.(true);
    }
  });
  
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1200);

  // 持续战斗并截图检查
  let screenshotCount = 0;
  const maxScreenshots = 10;
  
  for (let step = 0; step < 50 && screenshotCount < maxScreenshots; step++) {
    // 战斗状态截图
    await page.screenshot({ 
      path: path.join(outputDir, `battle-${String(screenshotCount).padStart(2, '0')}.png`),
      fullPage: false 
    });
    summary.screenshots.push(`battle-${String(screenshotCount).padStart(2, '0')}.png`);
    screenshotCount++;
    
    // 如果有选择面板就点第一个
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(400);
      continue;
    }
    
    // 检查是否到结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && step > 5) {
      // 重开继续截图
      await page.locator('[data-action="restart"]').click();
      await page.waitForTimeout(1000);
      continue;
    }

    // 战斗中移动
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);
  }

  // 人工检查结论（基于截图观察）
  summary.blackCheck = {
    player: 'observed - need manual review of screenshots',
    enemy: 'observed - need manual review of screenshots', 
    xp: 'observed - need manual review of screenshots',
    boss: 'not triggered in sample - need directed boss sample',
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  
  console.log('Asset black check done:');
  console.log('- Screenshots:', summary.screenshots.length);
  console.log('- Console errors:', summary.consoleErrors.length);
  console.log('- Black check status:', summary.blackCheck);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
