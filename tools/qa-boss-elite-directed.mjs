import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/boss-elite-directed';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  bossSnapshots: [],
  eliteSnapshots: [],
  screenshots: [],
  audioSnapshots: [],
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
  
  // 开启无敌模式，便于观察
  await page.evaluate(() => {
    if (window.__pilotDebug) {
      window.__pilotDebug.setInvulnerable?.(true);
    }
  });
  
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1200);

  // 强制快速推进到Boss或精英战
  let bossFound = false;
  let eliteFound = false;
  let stepCount = 0;
  const maxSteps = 80;

  while ((stepCount < maxSteps) && (!bossFound || !eliteFound)) {
    stepCount++;
    
    // 检查当前战斗类型
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });
    
    if (debug) {
      const snap = {
        step: stepCount,
        templateId: debug.templateId,
        eliteAlive: debug.eliteAlive,
        eliteBehavior: debug.eliteBehavior,
        pressurePhaseLabel: debug.pressurePhaseLabel,
        bossFirelineCoverage: debug.bossFirelineCoverage,
        bossSafeWindowMoments: debug.bossSafeWindowMoments,
      };
      
      if (debug.templateId?.startsWith('boss') && !bossFound) {
        bossFound = true;
        summary.bossSnapshots.push(snap);
        await page.screenshot({ path: path.join(outputDir, `boss-${stepCount}.png`) });
        summary.screenshots.push(`boss-${stepCount}.png`);
        
        // 采样音频状态
        const audioDebug = await page.evaluate(() => {
          if (typeof window.__pilotAudioDebug === 'function') {
            return window.__pilotAudioDebug();
          }
          return null;
        });
        if (audioDebug) {
          summary.audioSnapshots.push({
            context: 'boss-fight',
            step: stepCount,
            masterVolume: audioDebug.masterVolume,
            currentMusicMode: audioDebug.currentMusicMode,
            cueCounts: audioDebug.cueCounts,
          });
        }
      }
      
      if (debug.templateId?.startsWith('elite') && !eliteFound) {
        eliteFound = true;
        summary.eliteSnapshots.push(snap);
        await page.screenshot({ path: path.join(outputDir, `elite-${stepCount}.png`) });
        summary.screenshots.push(`elite-${stepCount}.png`);
      }
    }

    // 如果有选择面板，点击第一个
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(300);
      continue;
    }
    
    // 检查是否到结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && stepCount > 10) {
      // 重开继续找
      await page.locator('[data-action="restart"]').click();
      await page.waitForTimeout(1000);
      bossFound = false;
      eliteFound = false;
      stepCount = 0;
      continue;
    }

    // 战斗中保持移动
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  
  console.log('Boss/Elite directed check done:');
  console.log('- Boss found:', bossFound, 'snaps:', summary.bossSnapshots.length);
  console.log('- Elite found:', eliteFound, 'snaps:', summary.eliteSnapshots.length);
  console.log('- Screenshots:', summary.screenshots.length);
  console.log('- Console errors:', summary.consoleErrors.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
