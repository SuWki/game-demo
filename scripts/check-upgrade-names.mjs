import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

// Auto-move + auto-choose 
const movementCtrl = { active: true };
(async function move() {
  const dirs = [['w','a'],['w','d'],['s','a'],['s','d'],['w'],['s'],['a'],['d']];
  let i = 0, held = [];
  while (movementCtrl.active) {
    for (const k of held) await page.keyboard.up(k).catch(()=>{});
    const d = dirs[i % dirs.length]; i++;
    held = [];
    for (const k of d) { await page.keyboard.down(k).catch(()=>{}); held.push(k); }
    await page.waitForTimeout(800 + Math.random() * 400);
  }
  for (const k of held) await page.keyboard.up(k).catch(()=>{});
})();

// Wait for result
while (!(await page.$('.result-screen'))) {
  for (const sel of ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]']) {
    const el = await page.$(sel);
    if (el) {
      await page.evaluate((s) => {
        const els = document.querySelectorAll(s);
        if (els.length) els[Math.floor(Math.random() * els.length)].click();
      }, sel);
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(100);
}

movementCtrl.active = false;
await page.waitForTimeout(1500);

// Read upgrade names
const names = await page.evaluate(() => {
  const names = [];
  document.querySelectorAll('.timeline-item strong').forEach(el => names.push(el.textContent || ''));
  const stage = document.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '';
  const route = document.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '';
  const reason = document.querySelector('.result-reason')?.textContent || '';
  return { names, stage, route, reason };
});

console.log('=== 升级名称 ===');
names.names.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
console.log(`\n构筑阶段: ${names.stage}`);
console.log(`流派走向: ${names.route}`);
console.log(`失败原因: ${names.reason}`);

await browser.close();
