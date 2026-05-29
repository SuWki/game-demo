import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Capture all console logs
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[RNG]') || text.includes('[DEBUG]')) {
    console.log('  ' + text);
  }
});

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

for (let i = 0; i < 8; i++) {
  console.log(`\n--- Run ${i+1} ---`);
  const startTime = Date.now();
  let choicesMade = [];
  
  while (true) {
    if (await page.$('.result-screen')) break;
    
    // Handle choices and log them
    for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
      const el = await page.$(sel);
      if (el) {
        await page.waitForTimeout(200);
        const choice = await page.evaluate((s) => {
          const els = document.querySelectorAll(s);
          if (els.length === 0) return null;
          const idx = Math.floor(Math.random() * els.length);
          const texts = Array.from(els).map(e => e.querySelector('strong')?.textContent || e.textContent?.trim() || '?');
          els[idx].click();
          return { idx, count: els.length, texts, selected: texts[idx] };
        }, sel);
        if (choice) {
          choicesMade.push(choice.selected);
          console.log(`    [Choice] ${choice.selected} (${choice.idx+1}/${choice.count})`);
        }
        await page.waitForTimeout(300);
      }
    }
    
    if (Date.now() - startTime > 120000) break;
    await page.waitForTimeout(100);
  }
  
  await page.waitForTimeout(1500);
  
  // Get result info
  const result = await page.evaluate(() => {
    const screen = document.querySelector('.result-screen');
    if (!screen) return null;
    const route = screen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?';
    const buildStage = screen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?';
    const upgrades = [];
    screen.querySelectorAll('.timeline-item strong').forEach(el => upgrades.push(el.textContent || ''));
    return { route, buildStage, upgrades };
  });
  
  if (result) {
    console.log(`    [Result] ${result.route} | ${result.buildStage} | ${result.upgrades.length} upgrades`);
  }
  
  const btn = await page.$('[data-action="restart"]');
  if (btn) {
    await btn.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
  } else {
    console.log('    [WARN] No restart button found');
    break;
  }
}

await browser.close();
