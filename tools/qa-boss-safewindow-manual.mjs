#!/usr/bin/env node
/**
 * Boss 安全窗人工实机补验脚本 (MJS 版本)
 * 用于真实浏览器中观察 Boss 安全窗是否可读
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(process.cwd(), 'output/qa/boss-safewindow-manual');
const SERVER_URL = process.env.PILOT_SERVER_URL || 'http://127.0.0.1:8768';
const BOSS_TEMPLATE = process.env.PILOT_QA_BOSS || 'boss-bastion';
const OBSERVE_SECONDS = parseInt(process.env.PILOT_OBSERVE_SECONDS || '90');

// 确保输出目录存在
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 格式化时间戳
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// 格式化当前时间
const formatTime = () => new Date().toLocaleTimeString();

async function runManualVerification() {
  console.log('='.repeat(70));
  console.log('Boss 安全窗人工实机补验');
  console.log('='.repeat(70));
  console.log(`目标 Boss: ${BOSS_TEMPLATE}`);
  console.log(`观察时长: ${OBSERVE_SECONDS} 秒`);
  console.log(`服务器: ${SERVER_URL}`);
  console.log(`输出目录: ${OUTPUT_DIR}`);
  console.log('='.repeat(70));

  let browser;
  let page;

  try {
    console.log('\n[启动] 正在启动 Chromium 浏览器...');
    browser = await chromium.launch({
      headless: false, // 非 headless 模式，用于人工观察
      args: ['--window-size=1280,720'],
      slowMo: 50
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    // 监听 console 消息
    const consoleLogs = [];
    page.on('console', msg => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logEntry);
    });

    // 监听错误
    const errorLogs = [];
    page.on('pageerror', err => {
      errorLogs.push(err.message);
    });

    // 1. 打开游戏
    console.log('\n[1/6] 打开游戏页面...');
    await page.goto(SERVER_URL, { waitUntil: 'networkidle' });
    await delay(2000);
    console.log(`[${formatTime()}] 页面加载完成`);

    // 截图初始状态
    const screenshotBase = path.join(OUTPUT_DIR, `01-start-${timestamp()}.png`);
    await page.screenshot({ path: screenshotBase, fullPage: false });
    console.log(`[${formatTime()}] 截图保存: ${screenshotBase}`);

    // 2. 调用强制 Boss 触发
    console.log('\n[2/6] 调用 __pilotQaForceBoss 触发 Boss 战...');
    const forceResult = await page.evaluate((templateId) => {
      if (typeof window.__pilotQaForceBoss === 'function') {
        return window.__pilotQaForceBoss(templateId);
      }
      return { error: '__pilotQaForceBoss not found' };
    }, BOSS_TEMPLATE);
    console.log(`[${formatTime()}] 触发结果:`, forceResult);

    // 等待 Boss 战启动
    await delay(3000);

    // 截图 Boss 战开始
    const screenshotStart = path.join(OUTPUT_DIR, `02-battle-start-${timestamp()}.png`);
    await page.screenshot({ path: screenshotStart, fullPage: false });
    console.log(`[${formatTime()}] 截图保存: ${screenshotStart}`);

    // 3. 开始观察阶段
    console.log('\n[3/6] 开始观察 Boss 战...');
    console.log('='.repeat(70));
    console.log('请观察以下要点:');
    console.log('  1. 弹幕墙是否有明显缺口/安全窗?');
    console.log('  2. 玩家是否有移动/躲避空间?');
    console.log('  3. Boss 是否有持续压迫感?');
    console.log('  4. 是否能看到安全窗出现频率?');
    console.log('='.repeat(70));

    // 每隔一定时间截图并收集数据
    const sampleIntervals = [10, 30, 60]; // 秒
    const battleData = [];
    let startTime = Date.now();

    for (const sec of sampleIntervals) {
      const waitMs = sec * 1000 - (Date.now() - startTime);
      if (waitMs > 0) {
        console.log(`[${formatTime()}] 等待 ${Math.round(waitMs/1000)} 秒后截图...`);
        await delay(waitMs);
      }

      // 截图
      const ssPath = path.join(OUTPUT_DIR, `03-battle-${sec}s-${timestamp()}.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`[${formatTime()}] [${sec}s] 截图保存: ${ssPath}`);

      // 收集 debug 数据
      const debugData = await page.evaluate(() => {
        if (typeof window.__pilotBattleDebug === 'function') {
          return window.__pilotBattleDebug();
        }
        return null;
      });

      if (debugData) {
        console.log(`[${formatTime()}] [${sec}s] Debug:`, JSON.stringify(debugData, null, 2));
        battleData.push({ timestamp: sec, data: debugData });
      }

      // 收集 metrics 数据
      const metricsData = await page.evaluate(() => {
        if (window.__pilotMetrics) {
          return window.__pilotMetrics;
        }
        return null;
      });

      if (metricsData && metricsData.battle) {
        console.log(`[${formatTime()}] [${sec}s] Metrics:`, {
          bossSafeWindowMoments: metricsData.battle.bossSafeWindowMoments,
          bossFirelineCoverage: metricsData.battle.bossFirelineCoverage,
          eliteCrackSeen: metricsData.battle.eliteCrackSeen
        });
      }
    }

    // 额外等待到总观察时长
    const remainingTime = OBSERVE_SECONDS * 1000 - (Date.now() - startTime);
    if (remainingTime > 0) {
      console.log(`[${formatTime()}] 继续观察 ${Math.round(remainingTime/1000)} 秒...`);
      await delay(remainingTime);
    }

    // 最终截图
    const screenshotFinal = path.join(OUTPUT_DIR, `04-battle-final-${timestamp()}.png`);
    await page.screenshot({ path: screenshotFinal, fullPage: false });
    console.log(`[${formatTime()}] 截图保存: ${screenshotFinal}`);

    // 4. 收集错误日志
    console.log('\n[4/6] 收集错误日志...');
    console.log('Console logs:', consoleLogs.slice(-20));
    console.log('Page errors:', errorLogs);

    // 5. 保存观察数据
    console.log('\n[5/6] 保存观察数据...');
    const reportData = {
      timestamp: new Date().toISOString(),
      bossTemplate: BOSS_TEMPLATE,
      observeSeconds: OBSERVE_SECONDS,
      serverUrl: SERVER_URL,
      outputDir: OUTPUT_DIR,
      battleData: battleData,
      consoleLogs: consoleLogs,
      errorLogs: errorLogs,
      screenshots: [
        screenshotBase,
        screenshotStart,
        screenshotFinal,
        ...sampleIntervals.map(sec => path.join(OUTPUT_DIR, `03-battle-${sec}s-${timestamp()}.png`))
      ]
    };

    const reportPath = path.join(OUTPUT_DIR, 'observation-data.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`观察数据保存: ${reportPath}`);

    // 6. 生成结论模板
    console.log('\n[6/6] 生成结论模板...');
    const conclusionPath = path.join(OUTPUT_DIR, '观察结论.md');
    const conclusionTemplate = `# Boss 安全窗人工实机补验 - 观察结论

## 测试信息
- 目标 Boss: ${BOSS_TEMPLATE}
- 观察时长: ${OBSERVE_SECONDS} 秒
- 测试时间: ${new Date().toISOString()}
- 服务器: ${SERVER_URL}

## 观察要点记录

### 1. 安全窗可读性
- [ ] 能看到明显弹幕缺口/安全窗
- [ ] 安全窗出现频率足够 (参考: 约每 2-3 秒出现)
- [ ] 安全窗尺寸足够 (参考: 268px)
- [ ] 玩家能预判安全窗出现位置

### 2. 移动/躲避空间
- [ ] 玩家有持续移动空间
- [ ] 不会被连续弹幕墙封死所有方向
- [ ] 可以在移动中射击/反击

### 3. Boss 压迫感
- [ ] Boss 有持续威胁感
- [ ] 弹幕密度足够形成压力
- [ ] 不会因为过弱而变成"木桩"

### 4. 整体可读性
- [ ] 玩家能理解"应该躲哪里"
- [ ] 玩家能判断"什么时候可以反打"
- [ ] 战斗节奏有张有弛

## 观察数据摘要
\`\`\`json
${JSON.stringify({
  bossTemplate: BOSS_TEMPLATE,
  observeSeconds: OBSERVE_SECONDS,
  battleDataPoints: battleData.length,
  consoleLogCount: consoleLogs.length,
  errorLogCount: errorLogs.length
}, null, 2)}
\`\`\`

## Console Errors
\`\`\`
${errorLogs.length > 0 ? errorLogs.join('\n') : '无错误'}
\`\`\`

## 总体判断

### 可选结论 (请勾选一项):
- [ ] **可签收**: Boss 安全窗可读，压迫感足够，可以进入作品集阶段
- [ ] **过密不可读**: 弹幕墙过密，安全窗不够明显，需要增大安全窗/减少弹幕
- [ ] **压力不足**: Boss 过弱，缺乏压迫感，需要补阶段提示/攻击后反打窗口

### 详细说明:
(请在此补充具体观察细节和建议)

---
- 截图位置: ${OUTPUT_DIR}
- 数据文件: ${reportPath}
- 结论模板生成时间: ${new Date().toISOString()}
`;
    fs.writeFileSync(conclusionPath, conclusionTemplate, 'utf8');
    console.log(`结论模板已生成: ${conclusionPath}`);

    console.log('\n' + '='.repeat(70));
    console.log('人工实机补验完成');
    console.log('='.repeat(70));
    console.log(`\n请查看截图目录: ${OUTPUT_DIR}`);
    console.log(`观察数据: ${reportPath}`);
    console.log(`结论模板: ${conclusionPath}`);
    console.log('\n请在观察结论.md 中勾选实际观察结果。');

  } catch (error) {
    console.error('执行出错:', error);
    // 尝试截图保存错误状态
    try {
      if (page) {
        const errorScreenshot = path.join(OUTPUT_DIR, `error-${timestamp()}.png`);
        await page.screenshot({ path: errorScreenshot, fullPage: false });
        console.log(`错误截图保存: ${errorScreenshot}`);
      }
    } catch (ssError) {
      console.error('截图保存失败:', ssError);
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
}

// 运行验证
runManualVerification().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
