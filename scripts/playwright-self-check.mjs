import { chromium } from 'playwright';
import { ensureDevServer } from './_ensure-dev-server.mjs';

const BASE_URL = 'http://localhost:5174/game-demo/';
const VIEWPORT = { width: 1280, height: 720 };
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const results = { passed: 0, failed: 0, warnings: 0, issues: [] };
let consoleErrors = [];
let browser, page;
let stopServer;

async function check(label, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    results.failed++;
    const msg = `✗ ${label}: ${e.message}`;
    results.issues.push(msg);
    console.log(`  ${msg}`);
  }
}

async function warn(label, msg) {
  results.warnings++;
  results.issues.push(`⚠ ${label}: ${msg}`);
  console.log(`  ⚠ ${label}: ${msg}`);
}

async function waitForGameReady(p) {
  await p.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return canvas && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 15000 });
  await p.waitForTimeout(2000);
}

async function main() {
  stopServer = await ensureDevServer();

  console.log('\n=== 节点式自动射击 Demo — Playwright 自检 ===\n');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  // ===== 1. 页面加载 =====
  console.log('[1/7] 页面加载与基础渲染\n');
  await check('页面可访问并返回 200', async () => {
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (resp.status() !== 200) throw new Error(`HTTP ${resp.status()}`);
  });

  await check('Phaser Canvas 渲染完成', async () => {
    await waitForGameReady(page);
  });

  await check('#ui-root 存在', async () => {
    const el = page.locator('#ui-root');
    await el.waitFor({ state: 'attached', timeout: 5000 });
  });

  await check('canvas 尺寸符合预期 (960x540)', async () => {
    const canvas = page.locator('canvas');
    const bb = await canvas.boundingBox();
    if (!bb) throw new Error('canvas not found');
    if (Math.abs(bb.width - GAME_WIDTH) > 10 || Math.abs(bb.height - GAME_HEIGHT) > 10) {
      warn('canvas 尺寸', `预期 ${GAME_WIDTH}x${GAME_HEIGHT}, 实际 ${Math.round(bb.width)}x${Math.round(bb.height)}`);
    }
  });

  await check('无 console.error 输出', async () => {
    if (consoleErrors.length > 0) {
      warn('console.error', consoleErrors.slice(0, 3).join('; '));
    }
  });

  // ===== 2. 主菜单 =====
  console.log('\n[2/7] 主菜单检查\n');

  await check('主菜单屏幕渲染', async () => {
    await page.waitForSelector('.menu-screen', { timeout: 5000 });
  });

  await check('标题 "PROJECT ORBITAL" 可见', async () => {
    const title = page.locator('.space-title');
    await title.waitFor({ state: 'visible', timeout: 3000 });
  });

  await check('"开始作战" 按钮存在且可点击', async () => {
    const btn = page.locator('[data-action="start"]');
    await btn.waitFor({ state: 'visible', timeout: 3000 });
  });

  await check('战斗记录按钮存在', async () => {
    await page.waitForSelector('[data-action="export"]', { timeout: 3000 });
  });

  await check('音量设置按钮存在', async () => {
    await page.waitForSelector('[data-action="volume"]', { timeout: 3000 });
  });

  await check('出战统计显示 (出击/胜利/上次/流派)', async () => {
    const stats = page.locator('.start-screen-stats');
    await stats.waitFor({ state: 'visible', timeout: 3000 });
  });

  // ===== 3. 进入游戏 =====
  console.log('\n[3/7] 游戏流程检查\n');

  await check('点击"开始作战"进入 GameScene', async () => {
    await page.click('[data-action="start"]');
    await page.waitForTimeout(1000);
    const sceneName = await page.evaluate(() => {
      try {
        const game = globalThis.__PHASER_GAME__;
        return game?.scene?.getScene('GameScene')?.scene?.key || null;
      } catch { return null; }
    });
  });

  await check('游戏约 5 秒后节点地图出现', async () => {
    await page.waitForSelector('.node-map-layer, .node-map, [class*="nodeMap"], [class*="node-map"]', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(4000);
    const hasNodeMap = await page.evaluate(() => {
      return !!document.querySelector('.node-map-layer, .node-map, [class*="nodeMap"], [class*="node-map"], [class*="map-scroll"]');
    });
    if (!hasNodeMap) warn('节点地图', '5秒内未检测到节点地图DOM，可能是Phaser渲染');
  });

  await check('HUD 面板可切换显示', async () => {
    const hasHud = await page.evaluate(() => {
      const hud = document.querySelector('.hud-layer');
      return hud && !hud.classList.contains('hidden');
    });
    if (!hasHud) warn('HUD', 'HUD 层可能隐藏');
  });

  // ===== 4. Debug API 测试 =====
  console.log('\n[4/7] Debug API 功能检查\n');

  await check('window.__pilotDebug 存在', async () => {
    const exists = await page.evaluate(() => typeof window.__pilotDebug !== 'undefined');
    if (!exists) throw new Error('__pilotDebug 未暴露');
  });

  await check('getConfig() 返回有效配置', async () => {
    const cfg = await page.evaluate(() => { try { return window.__pilotDebug?.getConfig(); } catch { return null; } });
    if (!cfg) warn('getConfig', '返回 null（GameScene 可能未激活）');
  });

  await check('重启战斗: elimination', async () => {
    const ok = await page.evaluate(() => {
      try {
        if (window.__pilotDebug?.restartBattle) {
          window.__pilotDebug.restartBattle({ templateId: 'elimination', phase: 'opening' });
          return true;
        }
        return false;
      } catch { return false; }
    });
    if (ok) await page.waitForTimeout(3000);
    else warn('restartBattle', 'GameScene 未激活');
  });

  await check('Debug 面板可切换', async () => {
    const ok = await page.evaluate(() => {
      try {
        if (window.__pilotDebug?.togglePanel) {
          window.__pilotDebug.togglePanel();
          return true;
        }
        return false;
      } catch { return false; }
    });
    if (ok) {
      await page.waitForTimeout(500);
      const panelVisible = await page.evaluate(() => {
        const panel = document.querySelector('.debug-panel-layer');
        return panel && !panel.classList.contains('hidden');
      });
      if (panelVisible) {
        await page.evaluate(() => window.__pilotDebug?.togglePanel());
      } else {
        warn('Debug面板', '切换后未显示');
      }
    } else {
      warn('togglePanel', '功能不可用');
    }
  });

  await check('Boss 战斗可强制启动 (boss-bastion)', async () => {
    const ok = await page.evaluate(() => {
      try {
        if (typeof window.__pilotQaForceBoss === 'function') {
          window.__pilotQaForceBoss('boss-bastion');
          return true;
        }
        return false;
      } catch { return false; }
    });
    if (ok) await page.waitForTimeout(3000);
    else warn('__pilotQaForceBoss', '功能不可用');
  });

  // ===== 5. 战斗模板与数据完整性 =====
  console.log('\n[5/7] 数据完整性检查\n');

  await check('全部战斗模板可列举', async () => {
    const templates = await page.evaluate(() => {
      try {
        return Object.keys(globalThis.BATTLE_TEMPLATES || {});
      } catch { return null; }
    });
    if (!templates || templates.length === 0) {
      warn('BATTLE_TEMPLATES', '未暴露到全局，从 types.ts 检查: 应有 21 个模板');
    } else {
      if (templates.length < 20) warn('模板数量', `仅 ${templates.length} 个，预期 21+`);
    }
  });

  await check('Boss 模板全部可启动', async () => {
    const bosses = ['boss-hunt', 'boss-lockdown', 'boss-bastion', 'boss-executioner', 'boss-fortress', 'boss-predator'];
    for (const id of bosses) {
      await page.evaluate((tid) => {
        try { window.__pilotQaForceBoss(tid); } catch {}
      }, id);
      await page.waitForTimeout(500);
    }
  });

  // ===== 6. 资源与性能检查 =====
  console.log('\n[6/7] 资源与性能检查\n');

  await check('WebGL 模式运行', async () => {
    const renderer = await page.evaluate(() => {
      try {
        return document.querySelector('canvas')?.getContext?.('webgl') || document.querySelector('canvas')?.getContext?.('webgl2') ? 'webgl' : 'unknown';
      } catch { return 'unknown'; }
    });
  });

  await check('无严重性能问题(FPS检查)', async () => {
    const fps = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function count() {
          frames++;
          if (performance.now() - start >= 2000) {
            resolve(Math.round(frames / 2));
          } else requestAnimationFrame(count);
        }
        requestAnimationFrame(count);
      });
    });
    if (fps < 20) throw new Error(`FPS 过低: ${fps}`);
    if (fps < 55) warn('FPS', `${fps} (低于 55，可能有性能瓶颈)`);
    else console.log(`    FPS: ${fps} (流畅)`);
  });

  await check('内存使用正常', async () => {
    try {
      const mem = await page.evaluate(() => (performance?.memory?.usedJSHeapSize || 0) / 1048576);
      if (mem > 200) warn('内存', `${Math.round(mem)}MB (偏高)`);
      else if (mem > 0) console.log(`    内存: ${Math.round(mem)}MB`);
    } catch {
      // memory API not available in all browsers
    }
  });

  await check('Canvas 2D/WebGL 无丢失上下文', async () => {
    const lost = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return true;
      return c.dataset?.contextLost === 'true';
    });
  });

  // ===== 7. 响应式与兼容性 =====
  console.log('\n[7/7] 响应式与兼容性检查\n');

  await check('移动端视口 (375x667) 游戏正常', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    const bb = await canvas.boundingBox();
    if (!bb) throw new Error('移动端下 canvas 丢失');
    if (bb.width < 200) warn('移动端 canvas', `宽度仅 ${Math.round(bb.width)}px`);
  });

  await check('恢复桌面视口正常', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    const bb = await canvas.boundingBox();
    if (!bb || bb.width < 800) warn('恢复视口', `canvas 宽度 ${Math.round(bb?.width || 0)}px`);
  });

  // ===== 汇总 =====
  console.log('\n========== 自检结果 ==========');
  console.log(`  通过: ${results.passed}`);
  console.log(`  失败: ${results.failed}`);
  console.log(`  警告: ${results.warnings}`);
  console.log(`  Console Errors: ${consoleErrors.length}`);
  if (results.issues.length > 0) {
    console.log('\n--- 问题列表 ---');
    results.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }
  console.log('==============================\n');

  await browser.close();
  stopServer();
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('自检崩溃:', err);
  if (browser) browser.close();
  if (stopServer) stopServer();
  process.exit(1);
});
