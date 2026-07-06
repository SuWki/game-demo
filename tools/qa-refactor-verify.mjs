/**
 * QA 多局检测脚本 — 验证重构后游戏逻辑正常
 *
 * 流程：开始游戏 -> 自动战斗 -> 节点/强化/异常选择 -> Boss -> 结果页 -> 重开
 * 检查项：consoleErrors、panelsSeen、resultSeen、pauseSeen
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4187';
const outputDir = path.resolve('output/qa/refactor-verify');
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  url,
  consoleErrors: [],
  panelsSeen: 0,
  resultSeen: false,
  pauseSeen: false,
  rounds: 0,
  bossSeen: false,
};

function normalize(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

async function clickFirstChoice(page) {
  const choice = page.locator('[data-choice]').first();
  if ((await choice.count()) === 0) {
    return false;
  }
  summary.panelsSeen += 1;
  await choice.click();
  await page.waitForTimeout(320);
  return true;
}

async function movePattern(page) {
  const sequence = [
    ['KeyD', 640],
    ['KeyS', 440],
    ['KeyA', 760],
    ['KeyW', 440],
    ['KeyD', 360],
  ];
  for (const [key, duration] of sequence) {
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
  }
}

async function getHudText(page) {
  return normalize(await page.locator('#hud-center').textContent().catch(() => ''));
}

async function runOneRound(page, roundLabel) {
  // 开始游戏
  const startBtn = page.locator('#start-game-btn, [data-action="start"], button:has-text("开始"), button:has-text("进入")').first();
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(600);
  }

  let battleTime = 0;
  const maxBattleTime = 60000; // 60秒超时
  const stepMs = 1500;

  while (battleTime < maxBattleTime) {
    const hud = await getHudText(page);

    // 检查是否到达结果页
    if (hud.includes('结果') || hud.includes('结算') || hud.includes('重开') || hud.includes('再战')) {
      summary.resultSeen = true;
      console.log(`[${roundLabel}] 结果页已到达`);
      return;
    }

    // 检查是否有选择面板
    if (await clickFirstChoice(page)) {
      console.log(`[${roundLabel}] 选择面板 #${summary.panelsSeen}`);
      continue;
    }

    // 检查是否在 Boss 战
    if (hud.includes('Boss') || hud.includes('首领')) {
      summary.bossSeen = true;
      console.log(`[${roundLabel}] Boss 战进行中`);
    }

    // 战斗中：移动
    await movePattern(page);
    battleTime += stepMs;

    // 暂停测试
    if (battleTime === stepMs * 4 && !summary.pauseSeen) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      const paused = await getHudText(page);
      if (paused.includes('暂停') || paused.includes('pause') || paused.includes('继续')) {
        summary.pauseSeen = true;
        console.log(`[${roundLabel}] 暂停功能正常`);
      }
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }
  }

  console.log(`[${roundLabel}] 超时 (${maxBattleTime / 1000}s)`);
}

async function main() {
  console.log('=== QA 重构验证测试 ===');
  console.log(`URL: ${url}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Browser: ${executablePath ?? 'default chromium'}`);
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // 收集 console 错误
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // 忽略已知噪音
      if (!text.includes('favicon') && !text.includes('DevTools')) {
        summary.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    summary.consoleErrors.push(`PAGE_ERROR: ${err.message}`);
  });

  console.log('导航到游戏页面...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // 截图：开始页
  await page.screenshot({ path: path.join(outputDir, '00-start.png') });
  console.log('截图: 00-start.png');

  // 运行第一局
  console.log('\n--- 第 1 局 ---');
  await runOneRound(page, 'Round1');
  await page.screenshot({ path: path.join(outputDir, '01-round1-end.png') });

  // 尝试重开第二局
  console.log('\n--- 第 2 局 ---');
  const restartBtn = page.locator('[data-action="restart"], button:has-text("重开"), button:has-text("再战"), button:has-text("再来"), #restart-btn').first();
  if (await restartBtn.count() > 0) {
    await restartBtn.click();
    await page.waitForTimeout(800);
    summary.rounds += 1;
    await runOneRound(page, 'Round2');
    await page.screenshot({ path: path.join(outputDir, '02-round2-end.png') });
  } else {
    console.log('未找到重开按钮，尝试刷新页面...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await runOneRound(page, 'Round2-retry');
    await page.screenshot({ path: path.join(outputDir, '02-round2-retry.png') });
  }
  summary.rounds += 1;

  await browser.close();

  // 输出结果
  console.log('\n=== 测试结果 ===');
  console.log(`consoleErrors: ${summary.consoleErrors.length}`);
  if (summary.consoleErrors.length > 0) {
    console.log('错误详情:');
    for (const err of summary.consoleErrors) {
      console.log(`  - ${err}`);
    }
  }
  console.log(`panelsSeen: ${summary.panelsSeen}`);
  console.log(`resultSeen: ${summary.resultSeen}`);
  console.log(`pauseSeen: ${summary.pauseSeen}`);
  console.log(`bossSeen: ${summary.bossSeen}`);
  console.log(`rounds: ${summary.rounds}`);

  // 判断是否通过
  const passed = summary.consoleErrors.length === 0 && summary.panelsSeen > 0;
  console.log(`\n结果: ${passed ? 'PASS' : 'FAIL'}`);

  // 写入 JSON 结果
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2),
  );

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
