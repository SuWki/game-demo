import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Show key console logs
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[RNG]') || text.includes('[DEBUG] GameScene: transitioning') || text.includes('[DEBUG] ResultScene: create')) {
    console.log('  ' + text);
  }
});

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

for (let i = 0; i < 10; i++) {
  console.log(`\n=== Run ${i+1} ===`);
  const startTime = Date.now();
  
  // Wait for VISIBLE result screen
  while (true) {
    const visibleResult = await page.evaluate(() => {
      const el = document.querySelector('.result-screen');
      if (!el) return false;
      // Check if element is actually visible (not hidden by CSS)
      const style = window.getComputedStyle(el);
      const parent = el.closest('.screen-layer');
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      return el.checkVisibility?.() && style.display !== 'none' && style.visibility !== 'hidden' && (!parentStyle || parentStyle.display !== 'none');
    });
    
    if (visibleResult) break;
    
    // Handle choices
    for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
      if (await page.$(sel)) {
        await page.waitForTimeout(150);
        await page.evaluate((s) => {
          const els = document.querySelectorAll(s);
          if (els.length > 0) els[Math.floor(Math.random() * els.length)].click();
        }, sel);
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
    return { route, buildStage, upgradeCount };
  });
  
  console.log(`  [Result] ${result?.route} | ${result?.buildStage} | ${result?.upgradeCount} upgrades`);
  
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
