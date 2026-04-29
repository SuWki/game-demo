import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/force-boss';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  bossSnapshots: [],
  screenshots: [],
  audioSnapshots: [],
  bossTemplates: ['boss-hunt', 'boss-bastion', 'boss-lockdown'],
  foundBossTemplates: [],
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

  // 尝试多次重开来刷出 Boss
  for (let run = 0; run < 10 && summary.foundBossTemplates.length < 2; run++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    
    // 开启无敌模式
    await page.evaluate(() => {
      if (window.__pilotDebug) {
        window.__pilotDebug.setInvulnerable?.(true);
      }
    });
    
    await page.locator('[data-action="start"]').click();
    await page.waitForTimeout(1200);

    let stepCount = 0;
    let bossFoundInRun = false;

    while (stepCount < 60 && !bossFoundInRun) {
      stepCount++;
      
      // 检查战斗类型
      const debug = await page.evaluate(() => {
        if (typeof window.__pilotBattleDebug === 'function') {
          return window.__pilotBattleDebug();
        }
        return null;
      });
      
      if (debug && debug.templateId?.startsWith('boss')) {
        bossFoundInRun = true;
        if (!summary.foundBossTemplates.includes(debug.templateId)) {
          summary.foundBossTemplates.push(debug.templateId);
        }
        
        const snap = {
          run,
          step: stepCount,
          templateId: debug.templateId,
          eliteAlive: debug.eliteAlive,
          eliteBehavior: debug.eliteBehavior,
          pressurePhaseLabel: debug.pressurePhaseLabel,
          bossFirelineCoverage: debug.bossFirelineCoverage,
          bossSafeWindowMoments: debug.bossSafeWindowMoments,
        };
        summary.bossSnapshots.push(snap);
        
        const screenshotName = `boss-${debug.templateId}-r${run}-s${stepCount}.png`;
        await page.screenshot({ path: path.join(outputDir, screenshotName) });
        summary.screenshots.push(screenshotName);
        
        // 采样音频
        const audioDebug = await page.evaluate(() => {
          if (typeof window.__pilotAudioDebug === 'function') {
            return window.__pilotAudioDebug();
          }
          return null;
        });
        if (audioDebug) {
          summary.audioSnapshots.push({
            context: 'boss-fight',
            run,
            step: stepCount,
            templateId: debug.templateId,
            masterVolume: audioDebug.masterVolume,
            currentMusicMode: audioDebug.currentMusicMode,
            encounter: audioDebug.encounter,
            cueCounts: audioDebug.cueCounts,
          });
        }
        
        // 在 Boss 战中多采样几次
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(800);
          const midDebug = await page.evaluate(() => {
            if (typeof window.__pilotBattleDebug === 'function') {
              return window.__pilotBattleDebug();
            }
            return null;
          });
          if (midDebug) {
            summary.bossSnapshots.push({
              run,
              step: stepCount,
              subStep: i,
              templateId: midDebug.templateId,
              eliteAlive: midDebug.eliteAlive,
              eliteBehavior: midDebug.eliteBehavior,
              pressurePhaseLabel: midDebug.pressurePhaseLabel,
              bossFirelineCoverage: midDebug.bossFirelineCoverage,
              bossSafeWindowMoments: midDebug.bossSafeWindowMoments,
            });
          }
          await page.keyboard.down('KeyW');
          await page.waitForTimeout(300);
          await page.keyboard.up('KeyW');
        }
        
        break; // 找到 Boss，结束本轮
      }

      // 处理选择面板
      const choices = await page.locator('[data-choice]').count();
      if (choices > 0) {
        // 尝试找 Boss 选项
        const bossChoice = await page.locator('[data-choice]:has-text("Boss")').count();
        if (bossChoice > 0) {
          await page.locator('[data-choice]:has-text("Boss")').first().click();
        } else {
          await page.locator('[data-choice]').first().click();
        }
        await page.waitForTimeout(400);
        continue;
      }
      
      // 检查结果页
      const restartVisible = await page.locator('[data-action="restart"]').count();
      if (restartVisible > 0) {
        break; // 本轮结束，未找到 Boss
      }

      // 保持移动
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(200);
      await page.keyboard.up('KeyD');
      await page.waitForTimeout(200);
    }
    
    // 如果本轮没找到 Boss，重开
    if (!bossFoundInRun) {
      const restartBtn = await page.locator('[data-action="restart"]').count();
      if (restartBtn > 0) {
        await page.locator('[data-action="restart"]').click();
        await page.waitForTimeout(1000);
      }
    }
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  
  console.log('Force Boss check done:');
  console.log('- Found Boss templates:', summary.foundBossTemplates);
  console.log('- Boss snaps:', summary.bossSnapshots.length);
  console.log('- Screenshots:', summary.screenshots.length);
  console.log('- Console errors:', summary.consoleErrors.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
