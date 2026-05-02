import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const bossTemplate = process.env.PILOT_QA_BOSS ?? 'boss-bastion';
const outputDir = 'E:/codex/unity-learning/output/qa/boss-directed-v2';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  url,
  bossTemplate,
  consoleErrors: [],
  bossSnapshots: [],
  screenshots: [],
  audioSnapshots: [],
  bossSafeWindowMoments: 0,
  outsideSafeDamageTicks: 0,
  insideSafeProjectileClears: 0,
  bossAliveDurationSec: 0,
};

// 关闭升级面板或覆盖层
async function closeUpgradeOrOverlayIfPresent(page) {
  // 检查并关闭升级面板
  const upgradeChoices = await page.locator('[data-upgrade-choice]').count();
  if (upgradeChoices > 0) {
    // 随机选择一个升级
    const choices = await page.locator('[data-upgrade-choice]').all();
    if (choices.length > 0) {
      await choices[0].click();
      await page.waitForTimeout(400);
    }
  }

  // 检查并关闭事件/异常面板
  const eventOptions = await page.locator('[data-event-option]').count();
  if (eventOptions > 0) {
    const options = await page.locator('[data-event-option]').all();
    if (options.length > 0) {
      await options[0].click();
      await page.waitForTimeout(400);
    }
  }

  // 检查暂停面板
  const resumeBtn = await page.locator('[data-action="resume"]').count();
  if (resumeBtn > 0) {
    await page.locator('[data-action="resume"]').click();
    await page.waitForTimeout(300);
  }
}

// 等待Boss战状态
async function waitForBossBattleState(page, templateId, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });

    if (debug && debug.templateId === templateId) {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleLogs = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') summary.consoleErrors.push(text);
    if (text.includes('[DEBUG]')) consoleLogs.push(text);
  });
  page.on('pageerror', (error) => summary.consoleErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // 使用测试专用入口强制触发指定 Boss
  const entryResult = await page.evaluate((template) => {
    if (typeof window.__pilotQaForceBoss === 'function') {
      window.__pilotQaForceBoss(template);
      return { method: '__pilotQaForceBoss', triggered: true };
    }
    return { method: 'none', triggered: false };
  }, bossTemplate);

  // eslint-disable-next-line no-console
  console.log(`Boss entry result: ${JSON.stringify(entryResult)}`);

  // 等待并确保关闭任何面板（升级、事件等）
  await closeUpgradeOrOverlayIfPresent(page);
  await page.waitForTimeout(500);

  // 确保进入Boss战
  const bossEntered = await waitForBossBattleState(page, bossTemplate, 3000);
  if (!bossEntered) {
    // eslint-disable-next-line no-console
    console.log('Boss战未能自动进入，尝试手动点击开始');

    // 如果 API 没有把场景切到 GameScene（比如旧版本），手动点击开始
    const gameSceneActive = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas != null && canvas.width > 0;
    });

    if (!gameSceneActive || entryResult.triggered === false) {
      const startBtn = page.locator('[data-action="start"]');
      if ((await startBtn.count()) > 0) {
        await startBtn.click();
        await page.waitForTimeout(1200);
      }

      // 再次尝试调用 forceBoss（此时 GameScene 应该已激活）
      if (!entryResult.triggered) {
        await page.evaluate((template) => {
          if (typeof window.__pilotQaForceBoss === 'function') {
            window.__pilotQaForceBoss(template);
          }
        }, bossTemplate);
        await page.waitForTimeout(800);
      }
    }
  }

  // 再次关闭可能弹出的面板
  await closeUpgradeOrOverlayIfPresent(page);
  await page.waitForTimeout(500);

  // Boss 战采样阶段：持续观察 60 秒
  let bossEntered = false;
  let bossAliveStartTime = 0;
  const maxSteps = 60;
  for (let step = 1; step <= maxSteps; step += 1) {
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });

    if (debug) {
      const snap = {
        step,
        templateId: debug.templateId,
        eliteAlive: debug.eliteAlive,
        bossFirelineCoverage: debug.bossFirelineCoverage,
        bossSafeWindowMoments: debug.bossSafeWindowMoments,
        outsideSafeDamageTicks: debug.outsideSafeDamageTicks,
        insideSafeProjectileClears: debug.insideSafeProjectileClears,
      };
      summary.bossSnapshots.push(snap);

      // 更新汇总数据
      summary.bossSafeWindowMoments = Math.max(summary.bossSafeWindowMoments, debug.bossSafeWindowMoments || 0);
      summary.outsideSafeDamageTicks = Math.max(summary.outsideSafeDamageTicks, debug.outsideSafeDamageTicks || 0);
      summary.insideSafeProjectileClears = Math.max(summary.insideSafeProjectileClears, debug.insideSafeProjectileClears || 0);

      // 检测到目标 Boss 模板时开启无敌，以便完整观察战斗
      if (debug.templateId === bossTemplate && !bossEntered) {
        bossEntered = true;
        bossAliveStartTime = Date.now();
        await page.evaluate(() => {
          if (window.__pilotDebug) {
            window.__pilotDebug.setConfig({ invulnerablePlayer: true });
          }
        });
      }

      // 计算Boss存活时间
      if (debug.templateId === bossTemplate && debug.eliteAlive && bossAliveStartTime > 0) {
        summary.bossAliveDurationSec = (Date.now() - bossAliveStartTime) / 1000;
      }

      // 在 Boss 存活期间截图
      if (debug.templateId === bossTemplate && debug.eliteAlive) {
        const fileName = `boss-${bossTemplate}-${String(step).padStart(2, '0')}.png`;
        await page.screenshot({ path: path.join(outputDir, fileName) });
        summary.screenshots.push(fileName);
      }

      // 音频采样
      if (step % 15 === 0) {
        const audioDebug = await page.evaluate(() => {
          if (typeof window.__pilotAudioDebug === 'function') {
            return window.__pilotAudioDebug();
          }
          return null;
        });
        if (audioDebug) {
          summary.audioSnapshots.push({
            step,
            masterVolume: audioDebug.masterVolume,
            currentMusicMode: audioDebug.currentMusicMode,
            cueCounts: audioDebug.cueCounts,
          });
        }
      }
    }

    // 检查是否已到结果页（玩家死亡或超时）
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && step > 10) {
      const fileName = `boss-${bossTemplate}-result.png`;
      await page.screenshot({ path: path.join(outputDir, fileName) });
      summary.screenshots.push(fileName);
      break;
    }

    // 期间持续检查并关闭面板
    if (step % 5 === 0) {
      await closeUpgradeOrOverlayIfPresent(page);
    }

    // 简单移动以触发战斗
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(600);
  }

  await browser.close();

  summary.consoleLogs = consoleLogs.slice(0, 40);
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8',
  );

  // eslint-disable-next-line no-console
  console.log(`Boss directed QA completed for ${bossTemplate}`);
  // eslint-disable-next-line no-console
  console.log(`Screenshots: ${summary.screenshots.length}`);
  // eslint-disable-next-line no-console
  console.log(`Snapshots: ${summary.bossSnapshots.length}`);
  // eslint-disable-next-line no-console
  console.log(`Console errors: ${summary.consoleErrors.length}`);
  // eslint-disable-next-line no-console
  console.log(`Boss Safe Window Moments: ${summary.bossSafeWindowMoments}`);
  // eslint-disable-next-line no-console
  console.log(`Outside Safe Damage Ticks: ${summary.outsideSafeDamageTicks}`);
  // eslint-disable-next-line no-console
  console.log(`Inside Safe Projectile Clears: ${summary.insideSafeProjectileClears}`);
  // eslint-disable-next-line no-console
  console.log(`Boss Alive Duration: ${summary.bossAliveDurationSec.toFixed(1)}s`);

  // 验收检查
  if (summary.bossSafeWindowMoments === 0) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ 警告: bossSafeWindowMoments = 0，Boss安全区可能未正确触发');
  }
  if (summary.outsideSafeDamageTicks === 0) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ 警告: outsideSafeDamageTicks = 0，区外伤害可能未正确记录');
  }
  if (summary.consoleErrors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️ 警告: 存在 ${summary.consoleErrors.length} 个 console error`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
