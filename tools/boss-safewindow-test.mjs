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
await page.waitForTimeout(3000);

// Function to get battle debug snapshot
async function getDebug() {
  return await page.evaluate(() => window.__pilotBattleDebug?.());
}

// Fast-forward through battles to reach the boss
// We'll auto-select upgrades and progress through nodes
async function progressThroughNodes(rounds) {
  for (let i = 0; i < rounds; i++) {
    // Wait for battle to end or panel to appear
    await page.waitForTimeout(3000);
    
    // Check if there's a choice panel
    const hasChoicePanel = await page.evaluate(() => {
      const panel = document.querySelector('.choice-strip, .panel-layer:not(.hidden)');
      return panel && panel.children.length > 0;
    });
    
    if (hasChoicePanel) {
      // Click first choice
      const clicked = await page.evaluate(() => {
        const choices = document.querySelectorAll('.choice-strip .choice-card, .choice-strip > *');
        if (choices.length > 0) {
          choices[0].click();
          return true;
        }
        return false;
      });
    }
    
    await page.waitForTimeout(1000);
  }
}

// Progress through the game
await progressThroughNodes(20);

// Check current state
let debug = await getDebug();
console.log('Current state after progression:');
if (debug) {
  console.log('  encounterType:', debug.encounterType);
  console.log('  phase:', debug.phase);
  console.log('  templateId:', debug.templateId);
  console.log('  playerHP:', debug.playerHp);
  console.log('  safeWindowAxis:', debug.pressureSafeWindowAxis);
  console.log('  safeWindowSpan:', debug.pressureSafeWindowSpan);
  console.log('  safeWindowSec:', debug.pressureSafeWindowSec);
  console.log('  safeWindowSecondarySpan:', debug.pressureSafeWindowSecondarySpan);
  console.log('  safeWindowCenter:', debug.pressureSafeWindowCenter);
  console.log('  safeWindowSecondaryCenter:', debug.pressureSafeWindowSecondaryCenter);
  console.log('  bossSafeWindowGraceSec:', debug.bossSafeWindowGraceSec);
} else {
  console.log('  (no debug data)');
}

// Take screenshot
await page.screenshot({ path: resolve(outputDir, 'progression-state.png') });

// Check if we're in a boss fight
if (debug?.encounterType !== 'boss') {
  console.log('\nNot in boss fight yet. Trying to advance more...');
  await progressThroughNodes(15);
  debug = await getDebug();
  console.log('After more progression:');
  if (debug) {
    console.log('  encounterType:', debug.encounterType);
    console.log('  phase:', debug.phase);
  }
}

// Wait for boss pressure pattern to activate and monitor safe window
console.log('\nMonitoring boss safe window for 30 seconds...');
const safeWindowSamples = [];
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(500);
  debug = await getDebug();
  if (debug?.pressureSafeWindowAxis) {
    safeWindowSamples.push({
      t: i * 0.5,
      axis: debug.pressureSafeWindowAxis,
      span: Math.round(debug.pressureSafeWindowSpan),
      secSpan: debug.pressureSafeWindowSecondarySpan ? Math.round(debug.pressureSafeWindowSecondarySpan) : 0,
      sec: Number(debug.pressureSafeWindowSec.toFixed(2)),
      grace: Number((debug.bossSafeWindowGraceSec || 0).toFixed(2)),
      playerHP: debug.playerHp,
      enemyCount: debug.enemies?.length || 0,
      center: Math.round(debug.pressureSafeWindowCenter),
      secondaryCenter: Math.round(debug.pressureSafeWindowSecondaryCenter),
    });
  }
}

console.log(`\nCaptured ${safeWindowSamples.length} safe window samples:`);
for (const s of safeWindowSamples.slice(0, 20)) {
  console.log(`  t=${s.t.toFixed(1)}s axis=${s.axis} span=${s.span} secSpan=${s.secSpan} sec=${s.sec} grace=${s.grace} hp=${s.playerHP} enemies=${s.enemyCount} center=(${s.center},${s.secondaryCenter})`);
}

// Check for deaths/game overs
const gameOver = await page.evaluate(() => {
  const resultPanel = document.querySelector('.result-screen, .panel-layer:not(.hidden)');
  return resultPanel?.textContent?.includes('失败') || resultPanel?.textContent?.includes('通关');
});

console.log('\nGame over:', gameOver);
console.log('Console errors:', consoleErrors.length);
for (const e of consoleErrors) console.log('  ', e);

await page.screenshot({ path: resolve(outputDir, 'final-state.png') });

await browser.close();
