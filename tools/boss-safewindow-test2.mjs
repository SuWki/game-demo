import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../output/qa/boss-safewindow-redesign');
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\wyl\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

await page.goto('http://127.0.0.1:5199/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Start game
await page.click('[data-action="start"]');
await page.waitForTimeout(2000);

// Give player max HP and progress to boss quickly
// Use the engine's internal state
async function setEngineState(updates) {
  await page.evaluate((updates) => {
    const scene = window.phaserGame?.scene?.getScene?.('GameScene');
    if (scene?.engine) {
      const state = scene.engine.getState();
      Object.assign(state, updates);
      if (updates.stats) Object.assign(state.stats, updates.stats);
    }
  }, updates);
}

// Wait for game to load
await page.waitForTimeout(1000);

// Progress through nodes quickly by auto-selecting
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(2500);
  
  // Give player HP boost
  await page.evaluate(() => {
    const scene = window.phaserGame?.scene?.getScene?.('GameScene');
    if (scene?.engine) {
      const state = scene.engine.getState();
      if (state.stats) {
        state.stats.hp = state.stats.maxHp;
        state.stats.dashInterval = 1.5;
      }
    }
  });
  
  // Check for choice panels and auto-select
  const clicked = await page.evaluate(() => {
    const choices = document.querySelectorAll('.choice-strip .choice-card');
    if (choices.length > 0) {
      // Prefer route upgrades
      for (const c of choices) {
        if (c.textContent?.includes('流派') || c.textContent?.includes('强化')) {
          c.click();
          return 'route';
        }
      }
      choices[0].click();
      return 'first';
    }
    // Also check for restart/continue buttons
    const actions = document.querySelectorAll('[data-action]');
    for (const a of actions) {
      if (a.textContent?.includes('继续') || a.textContent?.includes('重新')) {
        a.click();
        return 'action';
      }
    }
    return null;
  });
}

// Check if we're in boss fight
let debug = await page.evaluate(() => window.__pilotBattleDebug?.());
console.log('After progression:');
if (debug) {
  console.log('  encounterType:', debug.encounterType);
  console.log('  playerHP:', debug.playerHp);
  console.log('  phase:', debug.phase);
}

// If in boss, monitor for safe window
if (debug?.encounterType === 'boss') {
  console.log('\nIn boss fight! Monitoring for safe window...');
  
  // Keep healing and monitor
  const samples = [];
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250);
    
    // Keep player alive
    await page.evaluate(() => {
      const scene = window.phaserGame?.scene?.getScene?.('GameScene');
      if (scene?.engine) {
        const state = scene.engine.getState();
        if (state.battle) {
          state.stats.hp = Math.max(state.stats.hp, state.stats.maxHp * 0.6);
        }
      }
    });
    
    debug = await page.evaluate(() => window.__pilotBattleDebug?.());
    if (debug?.pressureSafeWindowAxis) {
      samples.push({
        t: i * 0.25,
        axis: debug.pressureSafeWindowAxis,
        span: Math.round(debug.pressureSafeWindowSpan),
        secSpan: debug.pressureSafeWindowSecondarySpan ? Math.round(debug.pressureSafeWindowSecondarySpan) : 0,
        sec: Number(debug.pressureSafeWindowSec.toFixed(2)),
        grace: Number((debug.bossSafeWindowGraceSec || 0).toFixed(2)),
        enemyCount: debug.enemies?.length || 0,
        playerX: Math.round(debug.playerX),
        playerY: Math.round(debug.playerY),
        centerX: Math.round(debug.pressureSafeWindowCenter),
        centerY: Math.round(debug.pressureSafeWindowSecondaryCenter),
        phase: debug.phase,
      });
    }
    
    // Check for game over
    const gameOver = await page.evaluate(() => {
      const text = document.querySelector('.panel-layer:not(.hidden)')?.textContent || '';
      return text.includes('失败') || text.includes('通关');
    });
    if (gameOver) {
      console.log('Game over detected at t=', i * 0.25);
      break;
    }
  }
  
  console.log(`\nCaptured ${samples.length} safe window samples:`);
  for (const s of samples.slice(0, 30)) {
    console.log(`  t=${s.t.toFixed(1)} axis=${s.axis} span=${s.span} secSpan=${s.secSpan} sec=${s.sec} grace=${s.grace} enemies=${s.enemyCount} player=(${s.playerX},${s.playerY}) center=(${s.centerX},${s.centerY}) phase=${s.phase}`);
  }
  
  // Analyze
  const verticalSamples = samples.filter(s => s.axis === 'vertical');
  const horizontalSamples = samples.filter(s => s.axis === 'horizontal');
  const pocketSamples = samples.filter(s => s.axis === 'pocket');
  console.log(`\nAxis distribution: vertical=${verticalSamples.length} horizontal=${horizontalSamples.length} pocket=${pocketSamples.length}`);
  
  // Check if vertical/horizontal samples have secondary span > 0
  const verticalWithSecSpan = verticalSamples.filter(s => s.secSpan > 0);
  const horizontalWithSecSpan = horizontalSamples.filter(s => s.secSpan > 0);
  console.log(`Vertical with secondary span: ${verticalWithSecSpan.length}/${verticalSamples.length}`);
  console.log(`Horizontal with secondary span: ${horizontalWithSecSpan.length}/${horizontalSamples.length}`);
  
  // Check grace period
  const maxGrace = Math.max(...samples.map(s => s.grace), 0);
  console.log(`Max grace period: ${maxGrace}s (target: 1.5s)`);
  
  // Check safe window size
  if (verticalSamples.length > 0) {
    const s = verticalSamples[0];
    console.log(`\nVertical sample: span=${s.span} secSpan=${s.secSpan} (product=${s.span * s.secSpan})`);
  }
  if (pocketSamples.length > 0) {
    const s = pocketSamples[0];
    console.log(`Pocket sample: span=${s.span} secSpan=${s.secSpan} (product=${s.span * s.secSpan})`);
  }
} else {
  console.log('Not in boss fight. Debug:', debug?.phase);
}

console.log('\nConsole errors:', consoleErrors.length);
for (const e of consoleErrors) console.log('  ', e);

await page.screenshot({ path: resolve(outputDir, 'boss-safewindow-test.png') });
await browser.close();
