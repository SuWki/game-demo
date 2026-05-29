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

while (runCount < 5 && Date.now() - startTime < 600000) {
  // Check DOM state
  const state = await page.evaluate(() => {
    // Check for result screen
    const resultScreen = document.querySelector('.result-screen');
    if (resultScreen) {
      const style = window.getComputedStyle(resultScreen);
      const parent = resultScreen.closest('.screen-layer');
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      const visible = style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      (!parentStyle || parentStyle.display !== 'none');
      
      if (visible) {
        const title = resultScreen.querySelector('.result-title')?.textContent || '';
        const route = resultScreen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?';
        const buildStage = resultScreen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?';
        const upgrades = resultScreen.querySelectorAll('.timeline-item strong').length;
        const isVictory = resultScreen.classList.contains('is-victory');
        return {
          type: 'result',
          visible: true,
          title,
          route,
          buildStage,
          upgrades,
          isVictory
        };
      }
    }
    
    // Check for panels
    const nodePanel = document.querySelector('.panel-node-choice');
    const upgradePanel = document.querySelector('.panel-upgrade-choice');
    const eventPanel = document.querySelector('.panel-event-choice');
    
    if (nodePanel) {
      const choices = nodePanel.querySelectorAll('[data-choice]').length;
      return { type: 'nodeChoice', choices };
    }
    if (upgradePanel) {
      const choices = upgradePanel.querySelectorAll('[data-choice]').length;
      return { type: 'upgradeChoice', choices };
    }
    if (eventPanel) {
      const choices = eventPanel.querySelectorAll('[data-choice]').length;
      return { type: 'eventChoice', choices };
    }
    
    return { type: 'battle' };
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  
  if (state.type === 'result') {
    console.log(`[${elapsed}s] RESULT: ${state.title} | ${state.route} | ${state.buildStage} | ${state.upgrades} upgrades`);
    
    // Get metrics
    const metrics = await page.evaluate(() => {
      const m = window.__pilotMetrics;
      if (!m?.sessions?.length) return null;
      const runs = m.sessions[m.sessions.length - 1].runs;
      return runs.length ? runs[runs.length - 1] : null;
    });
    
    if (metrics) {
      console.log(`  Metrics: route=${metrics.routeId}, nodes=${metrics.nodesCleared}, outcome=${metrics.outcome}`);
    }
    
    runCount++;
    
    // Click restart
    const btn = await page.$('[data-action="restart"]');
    if (btn && await btn.isVisible()) {
      await btn.click({ force: true, timeout: 5000 });
      console.log(`  Restarted (run ${runCount}/5)`);
      await page.waitForTimeout(2000);
    } else {
      console.log(`  No restart button, reloading`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.click('[data-action="start"]');
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
  } else if (state.type === 'nodeChoice' || state.type === 'upgradeChoice' || state.type === 'eventChoice') {
    console.log(`[${elapsed}s] ${state.type} (${state.choices} choices)`);
    await page.waitForTimeout(200);
    
    const selector = state.type === 'nodeChoice' ? '.panel-node-choice [data-choice]' :
                     state.type === 'upgradeChoice' ? '.panel-upgrade-choice [data-choice]' :
                     '.panel-event-choice [data-choice]';
    
    // Alternate choices based on run count
    const idx = runCount % 3;
    await page.evaluate(({sel, idx}) => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        let pickIdx = 0;
        if (idx === 1) pickIdx = els.length - 1;
        else if (idx === 2) pickIdx = Math.floor(els.length / 2);
        els[pickIdx].click();
      }
    }, {sel: selector, idx});
    await page.waitForTimeout(300);
  } else {
    // Battle - move around
    if (parseInt(elapsed) % 10 === 0) {
      console.log(`[${elapsed}s] Battle...`);
    }
    
    // Simple WASD movement
    const dirs = ['w', 'a', 's', 'd'];
    const dir = dirs[Math.floor(Date.now() / 1000) % 4];
    await page.keyboard.down(dir);
    await page.waitForTimeout(400);
    await page.keyboard.up(dir);
  }
  
  await page.waitForTimeout(100);
}

console.log(`\nCompleted ${runCount} runs`);
await browser.close();
