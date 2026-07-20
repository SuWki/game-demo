/**
 * 安全区机制多轮验证
 * - 检测游戏不卡死
 * - 检测安全区状态正常循环（warning → active → transition）
 * - 检测控制台无报错
 * - 截图检查表现层无残留图层
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const APP_URL = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4199/game-demo/';
const OUT_DIR = path.resolve(process.env.PILOT_QA_OUT_DIR ?? 'output/qa/safezone-verify');
const RUN_COUNT = Number(process.env.PILOT_QA_RUNS ?? '6');
const MAX_FRAMES = Number(process.env.PILOT_QA_MAX_FRAMES ?? '800');

const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((c) => fs.existsSync(c));

fs.mkdirSync(OUT_DIR, { recursive: true });

async function runSingleTest(runIndex) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--disable-gpu', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // 自动点击开始按钮
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, .btn, [role="button"]');
    for (const b of btns) {
      const text = b.textContent ?? '';
      if (text.includes('开始') || text.includes('Start') || text.includes('启动') || text.includes('进入')) {
        b.click();
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(1000);

  // 选择节点
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.node-choice-btn, .upgrade-choice-btn, button');
    for (const b of btns) {
      const text = b.textContent ?? '';
      if (text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
        b.click();
        return true;
      }
    }
    for (const b of btns) {
      const rect = b.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        b.click();
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(800);

  let freezeDetected = false;
  let frameCount = 0;
  let battleFrameCount = 0;
  let lastBattleSnapshot = '';
  let sameBattleSnapshotCount = 0;
  let maxEnemyCount = 0;
  let maxBulletCount = 0;
  let safeZoneActivations = 0;
  let safeZonePhaseTransitions = 0;
  let lastSafeZonePhase = '';
  let safeZoneAnomalies = [];

  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    const snap = await page.evaluate(() => {
      const debug = window.__pilotDebug;
      if (!debug || !debug.getSnapshot) return null;
      return debug.getSnapshot();
    }).catch(() => null);

    if (snap === null) {
      await page.waitForTimeout(100);
      continue;
    }

    frameCount++;
    maxEnemyCount = Math.max(maxEnemyCount, snap.enemyCount ?? 0);
    maxBulletCount = Math.max(maxBulletCount, snap.bulletCount ?? 0);

    // 检测安全区状态
    const sz = snap.safeZone;
    if (sz && sz.active) {
      if (lastSafeZonePhase === '' || lastSafeZonePhase === 'transition') {
        safeZoneActivations++;
      }
      if (lastSafeZonePhase && lastSafeZonePhase !== sz.phase) {
        safeZonePhaseTransitions++;
        // 验证相位顺序
        const validTransitions = {
          'warning': ['active'],
          'active': ['transition', 'warning'], // transition or next cycle warning
        };
        if (validTransitions[lastSafeZonePhase] && !validTransitions[lastSafeZonePhase].includes(sz.phase)) {
          safeZoneAnomalies.push(`frame ${frame}: invalid phase ${lastSafeZonePhase} → ${sz.phase}`);
        }
      }
      // 检查安全区参数合法性
      if (sz.halfWidth <= 0 || sz.halfHeight <= 0) {
        safeZoneAnomalies.push(`frame ${frame}: invalid zone size ${sz.halfWidth}×${sz.halfHeight}`);
      }
      if (sz.timer < -0.1) {
        safeZoneAnomalies.push(`frame ${frame}: timer overflow ${sz.timer}`);
      }
      // 检查安全区中心在视野范围内
      if (sz.centerX < 0 || sz.centerX > 960 || sz.centerY < 0 || sz.centerY > 540) {
        safeZoneAnomalies.push(`frame ${frame}: zone center out of bounds (${sz.centerX}, ${sz.centerY})`);
      }
      lastSafeZonePhase = sz.phase;
    } else {
      lastSafeZonePhase = '';
    }

    // 冻结检测
    const inBattle = (snap.status === 'battle' || (snap.enemyCount > 0 && snap.playerHp > 0)) && snap.status !== 'upgradeChoice';
    if (inBattle) {
      battleFrameCount++;
      const enemyPosSum = (snap.enemies ?? []).reduce((acc, e) => acc + Math.round(e.x) + Math.round(e.y), 0);
      const snapStr = JSON.stringify({
        hp: Math.round(snap.playerHp),
        ec: snap.enemyCount,
        bc: snap.bulletCount,
        eps: enemyPosSum,
        sz: sz && sz.active ? `${sz.phase}:${Math.round(sz.centerX)},${Math.round(sz.centerY)}` : '',
      });
      if (snapStr === lastBattleSnapshot) {
        sameBattleSnapshotCount++;
        if (sameBattleSnapshotCount > 90) {
          freezeDetected = true;
          console.log(`    FREEZE at frame ${frame}: status=${snap.status}, hp=${snap.playerHp}, enemies=${snap.enemyCount}`);
          break;
        }
      } else {
        sameBattleSnapshotCount = 0;
      }
      lastBattleSnapshot = snapStr;
    } else {
      sameBattleSnapshotCount = 0;
      lastBattleSnapshot = '';
    }

    // 移动鼠标
    if (snap.playerHp > 0) {
      const angle = frame * 0.03 + runIndex;
      await page.mouse.move(480 + Math.cos(angle) * 80, 270 + Math.sin(angle) * 80);
    }

    // 处理升级/节点面板
    if (frame % 80 === 40) {
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('.upgrade-choice-btn, .node-choice-btn, button');
        for (const b of btns) {
          const rect = b.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            b.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) await page.waitForTimeout(300);
    }

    // 在关键帧截图
    if (sz && sz.active && sz.phase === 'warning' && frame % 200 === 50) {
      const ssPath = path.join(OUT_DIR, `run-${runIndex}-warning-frame${frame}.png`);
      await page.screenshot({ path: ssPath }).catch(() => {});
    }

    await page.waitForTimeout(16);
  }

  // 最终截图
  const screenshotPath = path.join(OUT_DIR, `run-${runIndex}-final.png`);
  await page.screenshot({ path: screenshotPath }).catch(() => {});

  await browser.close();

  return {
    runIndex,
    frameCount,
    battleFrameCount,
    freezeDetected,
    maxEnemyCount,
    maxBulletCount,
    safeZoneActivations,
    safeZonePhaseTransitions,
    safeZoneAnomalies: safeZoneAnomalies.slice(0, 5),
    errors: errors.slice(0, 5),
    errorCount: errors.length,
  };
}

console.log(`Starting ${RUN_COUNT} safe zone verification runs...`);
const results = [];
for (let i = 0; i < RUN_COUNT; i++) {
  console.log(`Run ${i + 1}/${RUN_COUNT}...`);
  try {
    const result = await runSingleTest(i);
    results.push(result);
    console.log(`  Frames: ${result.frameCount}, BattleFrames: ${result.battleFrameCount}, Freeze: ${result.freezeDetected}`);
    console.log(`  SafeZone: activations=${result.safeZoneActivations}, transitions=${result.safeZonePhaseTransitions}, anomalies=${result.safeZoneAnomalies.length}`);
    console.log(`  MaxEnemies: ${result.maxEnemyCount}, MaxBullets: ${result.maxBulletCount}, Errors: ${result.errorCount}`);
    if (result.safeZoneAnomalies.length > 0) {
      for (const a of result.safeZoneAnomalies) console.log(`    ANOMALY: ${a}`);
    }
    if (result.errors.length > 0) {
      for (const err of result.errors) console.log(`    ${err}`);
    }
  } catch (e) {
    console.log(`  FAILED: ${e.message}`);
    results.push({ runIndex: i, frameCount: 0, battleFrameCount: 0, freezeDetected: true, maxEnemyCount: 0, maxBulletCount: 0, safeZoneActivations: 0, safeZonePhaseTransitions: 0, safeZoneAnomalies: [e.message], errors: [e.message], errorCount: 1 });
  }
}

console.log('\n=== Summary ===');
const passed = results.filter((r) => !r.freezeDetected && r.errorCount === 0 && r.frameCount > 100 && r.safeZoneAnomalies.length === 0);
const failed = results.filter((r) => r.freezeDetected || r.errorCount > 0 || r.frameCount <= 100 || r.safeZoneAnomalies.length > 0);
console.log(`Total runs: ${results.length}`);
console.log(`Passed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);
console.log(`Overall: ${failed.length === 0 ? 'PASSED' : 'FAILED'}`);

process.exit(failed.length === 0 ? 0 : 1);
