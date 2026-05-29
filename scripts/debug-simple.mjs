import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

// Simple WASD movement
const pressKey = async (key) => await page.keyboard.down(key);
const releaseKey = async (key) => await page.keyboard.up(key);

console.log('Starting game...');
const startTime = Date.now();

// Run for 5 minutes max
while (Date.now() - startTime < 300000) {
  // Check game state
  const state = await page.evaluate(() => {
    const debug = window.__pilotDebug;
    if (!debug) return { error: 'no debug' };
    
    // Try to get engine state
    const services = window.__pilotServices;
    if (!services) return { error: 'no services' };
    
    // Check for result screen
    const resultScreen = document.querySelector('.result-screen');
    if (resultScreen) {
      const style = window.getComputedStyle(resultScreen);
      const visible = style.display !== 'none' && style.visibility !== 'hidden';
      const title = resultScreen.querySelector('.result-title')?.textContent || '';
      const route = resultScreen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?';
      const upgrades = resultScreen.querySelectorAll('.timeline-item strong').length;
      return {
        type: 'result',
        visible,
        title,
        route,
        upgrades
      };
    }
    
    // Check for panels
    const nodePanel = document.querySelector('.panel-node-choice');
    const upgradePanel = document.querySelector('.panel-upgrade-choice');
    const eventPanel = document.querySelector('.panel-event-choice');
    
    if (nodePanel) return { type: 'nodeChoice' };
    if (upgradePanel) return { type: 'upgradeChoice' };
    if (eventPanel) return { type: 'eventChoice' };
    
    return { type: 'battle' };
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`[${elapsed}s] ${JSON.stringify(state)}`);
  
  // Handle panels
  if (state.type === 'nodeChoice' || state.type === 'upgradeChoice' || state.type === 'eventChoice') {
    await page.waitForTimeout(200);
    const selector = state.type === 'nodeChoice' ? '.panel-node-choice [data-choice]' :
                     state.type === 'upgradeChoice' ? '.panel-upgrade-choice [data-choice]' :
                     '.panel-event-choice [data-choice]';
    
    await page.evaluate((sel) => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) els[0].click();
    }, selector);
    await page.waitForTimeout(300);
  }
  
  // Simple movement
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  await page.keyboard.up('d');
  
  // Check if game completed
  if (state.type === 'result' && state.visible) {
    console.log('Game completed!');
    console.log(`Result: ${state.title} | Route: ${state.route} | Upgrades: ${state.upgrades}`);
    
    // Click restart
    const btn = await page.$('[data-action="restart"]');
    if (btn) {
      await btn.click({ force: true, timeout: 5000 });
      console.log('Restarted');
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
    }
    break;
  }
  
  await page.waitForTimeout(200);
}

await browser.close();
