import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

console.log('Starting game...');
const startTime = Date.now();
let runCount = 0;
let lastState = '';
let stuckCounter = 0;

while (runCount < 3 && Date.now() - startTime < 300000) {
  const state = await page.evaluate(() => {
    const resultScreen = document.querySelector('.result-screen');
    if (resultScreen) {
      const style = window.getComputedStyle(resultScreen);
      const parent = resultScreen.closest('.screen-layer');
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && (!parentStyle || parentStyle.display !== 'none');
      if (visible) {
        return {
          type: 'result',
          route: resultScreen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?',
          buildStage: resultScreen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?',
          upgrades: resultScreen.querySelectorAll('.timeline-item strong').length,
        };
      }
    }
    
    const nodePanel = document.querySelector('.panel-node-choice');
    const upgradePanel = document.querySelector('.panel-upgrade-choice');
    const eventPanel = document.querySelector('.panel-event-choice');
    
    if (nodePanel) return { type: 'nodeChoice' };
    if (upgradePanel) return { type: 'upgradeChoice' };
    if (eventPanel) return { type: 'eventChoice' };
    
    return { type: 'battle' };
  });
  
  const stateKey = JSON.stringify(state);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  
  if (stateKey !== lastState) {
    console.log(`[${elapsed}s] ${state.type}`);
    lastState = stateKey;
    stuckCounter = 0;
  } else {
    stuckCounter++;
  }
  
  if (state.type === 'result') {
    console.log(`  Run ${runCount + 1} complete!`);
    runCount++;
    
    const btn = await page.$('[data-action="restart"]');
    if (btn && await btn.isVisible()) {
      await btn.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2000);
    } else {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.click('[data-action="start"]');
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
    lastState = '';
  } else if (state.type === 'nodeChoice' || state.type === 'upgradeChoice' || state.type === 'eventChoice') {
    if (stuckCounter > 5) {
      console.log(`  [Clicking panel...]`);
      const selector = state.type === 'nodeChoice' ? '.panel-node-choice [data-choice]' :
                       state.type === 'upgradeChoice' ? '.panel-upgrade-choice [data-choice]' :
                       '.panel-event-choice [data-choice]';
      
      const clicked = await page.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          els[0].click();
          return true;
        }
        return false;
      }, selector);
      
      console.log(`  Clicked: ${clicked}`);
      await page.waitForTimeout(500);
      stuckCounter = 0;
    }
  } else {
    // Battle movement
    if (stuckCounter % 10 === 0) {
      const dir = ['w', 'a', 's', 'd'][Math.floor(Date.now() / 500) % 4];
      await page.keyboard.down(dir);
      await page.waitForTimeout(300);
      await page.keyboard.up(dir);
    }
  }
  
  await page.waitForTimeout(100);
}

console.log(`\nCompleted ${runCount} runs`);
await browser.close();
