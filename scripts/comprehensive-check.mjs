import { chromium } from 'playwright';
import { ensureDevServer } from './_ensure-dev-server.mjs';

const stopServer = await ensureDevServer();

const BASE = 'http://localhost:5174/game-demo/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Track all issues
const issues = [];
const unique404s = new Map();
let totalErrors = 0;

page.on('response', r => {
  if (r.status() === 404) {
    const url = r.url();
    const count = (unique404s.get(url) || 0) + 1;
    unique404s.set(url, count);
    totalErrors++;
  }
});
page.on('pageerror', err => issues.push(`[PAGE ERROR] ${err.message}`));

// Navigate and wait for game to settle
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(3000);

// Check for missing JSON data files
console.log('\n=== 404 资源分析 (页面加载阶段) ===');
for (const [url, count] of unique404s) {
  const path = url.replace(BASE, '/game-demo/');
  const localPath = url.replace('http://localhost:5174', '');
  console.log(`  ${count}x 404: ${path}`);
}
if (unique404s.size === 0) console.log('  无 404 (通过 Vite 代理正常)');

// 1. Check BootScene SVG assets via fetch
console.log('\n=== BootScene SVG 资产加载测试 ===');
const svgAssets = [
  'assets/preview-runtime/visual/unit-player-core.svg',
  'assets/preview-runtime/visual/enemy-standard-a.svg',
  'assets/preview-runtime/visual/bg-space-nebula.svg',
  'assets/preview-runtime/visual/boss-bastion-main.svg',
  'assets/preview-runtime/visual/elite-core-main.svg',
];
for (const asset of svgAssets) {
  const resp = await page.evaluate(async (a) => {
    try {
      const r = await fetch(`/${a}`);
      return r.status;
    } catch { return -1; }
  }, asset);
  if (resp !== 200) {
    const resp2 = await page.evaluate(async (a) => {
      try {
        const r = await fetch(`/game-demo/${a}`);
        return r.status;
      } catch { return -1; }
    }, asset);
    issues.push(`SVG 路径错误: /${asset} → ${resp}, 尝试 /game-demo/${asset} → ${resp2}`);
  }
}

// 2. Check JSON data files via fetch (simulating ConfigLoader)
console.log('\n=== ConfigLoader JSON 数据文件测试 ===');
const jsonFiles = ['data/upgrades.json', 'data/battleTemplates.json', 'data/enemyArchetypes.json', 'data/balance.json'];
for (const file of jsonFiles) {
  const status = await page.evaluate(async (f) => {
    try {
      const r = await fetch(`/${f}`);
      return r.status;
    } catch { return -1; }
  }, file);
  if (status !== 200) {
    const status2 = await page.evaluate(async (f) => {
      try {
        const r = await fetch(`/game-demo/${f}`);
        return r.status;
      } catch { return -1; }
    }, file);
    issues.push(`JSON 路径错误: /${file} → ${status}, 正确路径 /game-demo/${file} → ${status2}`);
    console.log(`  ✗ /${file} → ${status} (正确: /game-demo/${file} → ${status2})`);
  } else {
    console.log(`  ✓ /${file} → 200`);
  }
}

// 3. Check canvas rendering
console.log('\n=== Phaser Canvas 渲染测试 ===');
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  const gl = c.getContext('webgl') || c.getContext('webgl2');
  return {
    width: c.width,
    height: c.height,
    hasWebGL: !!gl,
    available: !!c,
  };
});
console.log(`  Canvas: ${canvasInfo?.width}x${canvasInfo?.height}, WebGL: ${canvasInfo?.hasWebGL}`);

if (canvasInfo && (canvasInfo.width < 200 || canvasInfo.height < 200)) {
  issues.push(`Canvas 尺寸异常: ${canvasInfo.width}x${canvasInfo.height}`);
}

// 4. Check scene transitions
console.log('\n=== 场景切换测试 ===');
await page.click('[data-action="start"]');
await page.waitForTimeout(3000);

const sceneState = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return { canvasExists: !!canvas, canvasWidth: canvas?.width };
});
console.log(`  点击开始后 Canvas: ${sceneState.canvasExists} (${sceneState.canvasWidth}px)`);

// 5. Check debug tools
console.log('\n=== Debug API 可用性 ===');
const debugTools = await page.evaluate(() => {
  const d = window.__pilotDebug;
  return {
    exists: !!d,
    hasGetConfig: typeof d?.getConfig === 'function',
    hasSetConfig: typeof d?.setConfig === 'function',
    hasRestartBattle: typeof d?.restartBattle === 'function',
    hasTogglePanel: typeof d?.togglePanel === 'function',
    hasGetSnapshot: typeof d?.getSnapshot === 'function',
    hasQaForceBoss: typeof window.__pilotQaForceBoss === 'function',
  };
});
for (const [key, val] of Object.entries(debugTools)) {
  console.log(`  ${val ? '✓' : '✗'} ${key}: ${val}`);
}
if (!debugTools.hasGetConfig) issues.push('Debug API __pilotDebug 未完全暴露');

// 6. Check Phaser game object accessible
console.log('\n=== Phaser 内部状态 ===');
const phaserInfo = await page.evaluate(() => {
  const games = window.Phaser?.GAMES;
  if (!games || games.length === 0) return null;
  const g = games[0];
  const scenes = g.scene.getScenes(true).map(s => s.scene.key);
  return { sceneCount: g.scene.scenes.length, activeScenes: scenes, isRunning: g.isRunning };
});
if (phaserInfo) {
  console.log(`  Scenes: ${phaserInfo.activeScenes.join(', ')}`);
  console.log(`  Total scenes: ${phaserInfo.sceneCount}, Running: ${phaserInfo.isRunning}`);
} else {
  issues.push('Phaser.GAMES 无法访问，window.Phaser 可能未暴露');
}

// 7. Summary
console.log('\n========== 问题总结 ==========');
if (issues.length === 0) {
  console.log('  未发现严重问题');
} else {
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
}
console.log(`  总 404 请求: ${totalErrors}`);
console.log(`  唯一 404 URL: ${unique404s.size}`);
console.log(`  发现的 issues: ${issues.length}`);
console.log('==============================\n');

await browser.close();
stopServer();
