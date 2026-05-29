import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Capture console logs
page.on('console', msg => {
  if (msg.text().includes('[RNG]')) console.log('  ' + msg.text());
});

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

for (let i = 0; i < 5; i++) {
  console.log(`\n--- Run ${i+1} ---`);
  const startTime = Date.now();
  while (true) {
    if (await page.$('.result-screen')) break;
    // Handle choices
    for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
      if (await page.$(sel)) {
        await page.waitForTimeout(200);
        await page.evaluate((s) => {
          const els = document.querySelectorAll(s);
          if (els.length > 0) els[Math.floor(Math.random() * els.length)].click();
        }, sel);
        await page.waitForTimeout(300);
      }
    }
    if (Date.now() - startTime > 120000) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1500);
  
  const btn = await page.$('[data-action="restart"]');
  if (btn) {
    await btn.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
  }
}

await browser.close();
