import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Capture RNG seed changes
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[RNG] setRNGSeed')) {
    console.log('  ' + text);
  }
});

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

// Run 5 games with explicit different choices
for (let i = 0; i < 5; i++) {
  console.log(`\n=== Run ${i+1} ===`);
  const startTime = Date.now();
  let choiceCount = 0;
  
  while (true) {
    // Check for visible result screen
    const visibleResult = await page.evaluate(() => {
      const el = document.querySelector('.result-screen');
      if (!el) return false;
      return el.checkVisibility?.();
    });
    
    if (visibleResult) break;
    
    // Handle choices - use different strategy per run
    for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
      if (await page.$(sel)) {
        await page.waitForTimeout(150);
        // Use run index to vary the choice
        await page.evaluate(({sel, runIdx}) => {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            let idx = 0;
            if (runIdx % 3 === 1) idx = els.length - 1;
            else if (runIdx % 3 === 2) idx = Math.floor(els.length / 2);
            els[idx].click();
          }
        }, {sel, runIdx: i});
        choiceCount++;
        await page.waitForTimeout(200);
      }
    }
    
    if (Date.now() - startTime > 120000) {
      console.log('  [TIMEOUT]');
      break;
    }
    await page.waitForTimeout(100);
  }
  
  await page.waitForTimeout(500);
  
  const result = await page.evaluate(() => {
    const screen = document.querySelector('.result-screen');
    if (!screen) return null;
    const route = screen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?';
    const buildStage = screen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?';
    const upgradeCount = screen.querySelectorAll('.timeline-item strong').length;
    const upgrades = [];
    screen.querySelectorAll('.timeline-item strong').forEach(el => upgrades.push(el.textContent || ''));
    return { route, buildStage, upgradeCount, upgrades };
  });
  
  console.log(`  [Result] ${result?.route} | ${result?.buildStage} | ${result?.upgradeCount} upgrades`);
  console.log(`  [Choices made] ${choiceCount}`);
  if (result?.upgrades) {
    console.log(`  [Upgrades] ${result.upgrades.slice(0, 5).join(', ')}...`);
  }
  
  // Click restart
  const btn = await page.$('[data-action="restart"]');
  if (btn && await btn.isVisible()) {
    await btn.click({ force: true, timeout: 5000 });
    console.log('  [Restarted]');
  } else {
    console.log('  [Reload]');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.click('[data-action="start"]');
    await page.waitForTimeout(2000);
  }
  
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
}

await browser.close();
