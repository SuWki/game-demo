import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4187';
const outputDir = 'output/qa/74fa9bd-verify';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  url,
  consoleErrors: [],
  upgradeCount: 0,
  pickupCount: 0,
  eliteEncountered: false,
  timeElapsed: 0,
  finalPhase: null,
};

async function run() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      summary.consoleErrors.push(text);
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 点击开始
  const startBtn = page.locator('button:has-text("开始试飞")');
  if ((await startBtn.count()) > 0) {
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  const startTime = Date.now();
  const targetDuration = 180000; // 3 分钟

  // 自动游玩 3 分钟
  while (Date.now() - startTime < targetDuration) {
    // 检查是否有选择面板
    const choice = page.locator('[data-choice]').first();
    if ((await choice.count()) > 0) {
      summary.upgradeCount++;
      await choice.click();
      await page.waitForTimeout(500);
      continue;
    }

    // 检查是否结束
    const resultPanel = page.locator('.result-panel');
    if ((await resultPanel.count()) > 0) {
      console.log('游戏结束，提前退出');
      break;
    }

    // 简单移动模式
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyS');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyA');
  }

  summary.timeElapsed = Math.floor((Date.now() - startTime) / 1000);

  // 获取调试信息
  try {
    const debugInfo = await page.evaluate(() => {
      if (window.__pilotDebug) {
        const info = window.__pilotDebug();
        return {
          phase: info.phase,
          round: info.round,
          level: info.level,
          xp: info.xp,
          xpToNext: info.xpToNext,
        };
      }
      return null;
    });
    if (debugInfo) {
      summary.finalPhase = debugInfo.phase;
      summary.finalLevel = debugInfo.level;
      summary.finalRound = debugInfo.round;
    }
  } catch (e) {
    console.log('无法获取调试信息');
  }

  // 截图
  await page.screenshot({ path: path.join(outputDir, 'final-state.png') });

  await browser.close();

  // 输出结果
  console.log('\n=== 74fa9bd 验证结果 ===');
  console.log(`运行时长: ${summary.timeElapsed}秒`);
  console.log(`升级次数: ${summary.upgradeCount}`);
  console.log(`最终阶段: ${summary.finalPhase || '未知'}`);
  console.log(`最终等级: ${summary.finalLevel || '未知'}`);
  console.log(`最终回合: ${summary.finalRound || '未知'}`);
  console.log(`Console 错误数: ${summary.consoleErrors.length}`);

  if (summary.consoleErrors.length > 0) {
    console.log('\nConsole 错误:');
    summary.consoleErrors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
  }

  // 判断
  console.log('\n=== 风险判断 ===');
  if (summary.upgradeCount > 10 && summary.timeElapsed < 180) {
    console.log('⚠️ 升级频率过高，可能需要回调经验值');
  } else {
    console.log('✅ 升级频率正常');
  }

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
}

run().catch(console.error);
