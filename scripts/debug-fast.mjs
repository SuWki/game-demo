import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('pageerror', err => console.log('  [ERROR]', err.message));

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

const DIRS = [['w'], ['s'], ['a'], ['d'], ['w', 'a'], ['s', 'd']];
let dirIdx = 0;

async function doMovement(p) {
  const dir = DIRS[dirIdx % DIRS.length];
  dirIdx++;
  for (const k of ['w', 'a', 's', 'd']) await p.keyboard.up(k).catch(() => {});
  for (const k of dir) await p.keyboard.down(k).catch(() => {});
}

for (let i = 0; i < 5; i++) {
  console.log(`\n=== Run ${i+1} ===`);
  const startTime = Date.now();
  const initialRunCount = await page.evaluate(() => {
    const m = window.__pilotMetrics;
    return m?.sessions?.length ? m.sessions[m.sessions.length - 1]?.runs?.length || 0 : 0;
  });
  console.log(`  Initial run count: ${initialRunCount}`);
  
  let lastLog = 0;
  while (true) {
    await doMovement(page);
    
    // Handle choices
    for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
      if (await page.$(sel)) {
        await page.waitForTimeout(150);
        await page.evaluate(({sel, idx}) => {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) els[idx % els.length].click();
        }, {sel, idx: i});
        await page.waitForTimeout(200);
      }
    }
    
    const currentRunCount = await page.evaluate(() => {
      const m = window.__pilotMetrics;
      return m?.sessions?.length ? m.sessions[m.sessions.length - 1]?.runs?.length || 0 : 0;
    });
    
    if (currentRunCount > initialRunCount) {
      console.log(`  Run completed! Count: ${currentRunCount}`);
      break;
    }
    
    if (Date.now() - startTime > 180000) {
      console.log(`  TIMEOUT after 3min`);
      break;
    }
    
    if (Date.now() - lastLog > 30000) {
      const status = await page.evaluate(() => {
        const m = window.__pilotMetrics;
        const run = m?.sessions?.length ? m.sessions[m.sessions.length - 1]?.runs?.slice(-1)[0] : null;
        return {
          runCount: run ? 1 : 0,
          status: run?.outcome || 'unknown',
          route: run?.routeId || '?',
          nodes: run?.nodesCleared || 0,
        };
      });
      console.log(`  [30s] Status: ${JSON.stringify(status)}`);
      lastLog = Date.now();
    }
    
    await page.waitForTimeout(500);
  }
  
  // Get result
  const result = await page.evaluate(() => {
    const screen = document.querySelector('.result-screen');
    if (!screen) return null;
    return {
      route: screen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?',
      buildStage: screen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?',
      upgrades: screen.querySelectorAll('.timeline-item strong').length,
    };
  });
  console.log(`  Result: ${result?.route} | ${result?.buildStage} | ${result?.upgrades} upgrades`);
  
  // Restart
  const btn = await page.$('[data-action="restart"]');
  if (btn && await btn.isVisible()) {
    await btn.click({ force: true, timeout: 5000 });
    console.log(`  Restarted`);
  } else {
    console.log(`  No restart button, reloading`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.click('[data-action="start"]');
    await page.waitForTimeout(2000);
  }
  
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
}

await browser.close();
