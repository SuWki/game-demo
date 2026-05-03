#!/usr/bin/env node
/**
 * Boss 收尾画面 QA 脚本
 * 验证 Boss 战结束时是否正确显示 .boss-ending-screen
 *
 * 运行方式: $env:PILOT_QA_BOSS='boss-bastion'; node tools\qa-boss-ending.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const bossId = process.env.PILOT_QA_BOSS ?? 'boss-bastion';
const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4187';
const outputDir = `E:/codex/unity-learning/output/qa/boss-ending/${bossId}`;

const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  bossId,
  url,
  consoleErrors: [],
  bossEndingSeen: false,
  bossEndingText: null,
  bossEndingScreenshot: null,
  bossEndingDebugSeen: false,
  panelBlocked: false,
  steps: 0,
  maxSteps: 1200,
};

async function closeUpgradeOrOverlayIfPresent(page) {
  const closeBtn = page.locator('[data-action="close"]').first();
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click();
    await page.waitForTimeout(200);
    return true;
  }
  const choiceBtn = page.locator('[data-choice]').first();
  if ((await choiceBtn.count()) > 0) {
    await choiceBtn.click();
    await page.waitForTimeout(320);
    return true;
  }
  return false;
}

async function waitForBossEnding(page) {
  for (let i = 0; i < 10; i++) {
    const debugState = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });

    if (debugState?.status === 'bossEnding') {
      return debugState.bossEnding ?? { label: 'bossEnding' };
    }
    await page.waitForTimeout(100);
  }
  return null;
}

async function captureBossEnding(page) {
  // 检查 .boss-ending-screen 是否真实显示
  const screen = page.locator('.boss-ending-screen').first();
  const count = await screen.count();

  if (count === 0) {
    return { seen: false, text: null };
  }

  // 获取显示的文本
  const text = await screen.textContent();

  // 截图
  const screenshotPath = path.join(outputDir, 'boss-ending-capture.png');
  await screen.screenshot({ path: screenshotPath });

  return { seen: true, text, screenshot: screenshotPath };
}

async function run() {
  if (!executablePath) {
    console.error('未找到 Chrome 或 Edge 浏览器');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--window-size=1280,720', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // 捕获 console 错误
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      summary.consoleErrors.push(msg.text());
    }
  });

  // 捕获 page 错误
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(error.message);
  });

  console.log(`打开 ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  console.log(`启动 Boss 战: ${bossId}`);
  const entryResult = await page.evaluate((id) => {
    if (typeof window.__pilotQaForceBoss === 'function') {
      window.__pilotQaForceBoss(id);
      return { method: '__pilotQaForceBoss', triggered: true };
    }
    return { method: 'none', triggered: false };
  }, bossId);

  if (!entryResult.triggered) {
    throw new Error('__pilotQaForceBoss 不可用，无法启动 Boss QA');
  }
  await page.waitForTimeout(1000);

  // 关闭可能出现的面板
  await closeUpgradeOrOverlayIfPresent(page);
  await page.waitForTimeout(500);

  // 模拟战斗直到 Boss 被击败或失败
  console.log('模拟 Boss 战...');
  for (let step = 0; step < summary.maxSteps; step++) {
    summary.steps = step;

    // 每 10 步检查一次面板遮挡
    if (step % 10 === 0) {
      const panelClosed = await closeUpgradeOrOverlayIfPresent(page);
      if (panelClosed) {
        summary.panelBlocked = true;
      }
    }

    // 检查是否进入 bossEnding 状态
    const bossEnding = await waitForBossEnding(page);
    if (bossEnding) {
      summary.bossEndingDebugSeen = true;
      console.log('检测到 bossEnding 状态:', bossEnding.label);

      // 等待 UI 显示
      await page.waitForTimeout(120);

      // 捕获 Boss 收尾画面
      const capture = await captureBossEnding(page);
      summary.bossEndingSeen = capture.seen;
      summary.bossEndingText = capture.text;
      summary.bossEndingScreenshot = capture.screenshot;

      if (capture.seen) {
        console.log('✅ Boss 收尾画面已显示');
        console.log('显示文本:', capture.text);
      } else {
        console.log('❌ Boss 收尾画面未显示');
      }

      break;
    }

    // 模拟移动和射击
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(50);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(50);
  }

  // 保存摘要
  const summaryPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n--- QA 摘要 ---');
  console.log(`Boss: ${summary.bossId}`);
  console.log(`Boss 收尾画面显示: ${summary.bossEndingSeen ? '✅' : '❌'}`);
  console.log(`显示文本: ${summary.bossEndingText}`);
  console.log(`Console 错误: ${summary.consoleErrors.length}`);
  console.log(`步骤数: ${summary.steps}`);
  console.log(`截图保存: ${summary.bossEndingScreenshot}`);

  await browser.close();

  process.exit(summary.bossEndingSeen ? 0 : 1);
}

run().catch((error) => {
  console.error('QA 运行失败:', error);
  process.exit(1);
});
