import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);
await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

// Auto-play until result screen or timeout
const startTime = Date.now();
let resultFound = false;
while (Date.now() - startTime < 120000) {
  if (await page.$('.result-screen')) { resultFound = true; break; }
  const panels = ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]'];
  for (const sel of panels) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await page.waitForTimeout(200);
      break;
    }
  }
  await page.waitForTimeout(100);
}

await page.waitForTimeout(1500);

// Check game state via engine
const engineState = await page.evaluate(() => {
  const scenes = window.__PHASER_GAME__?.scene?.scenes || [];
  for (const s of scenes) {
    const engine = s.engine;
    if (engine && engine.state) {
      const st = engine.state;
      return {
        routeCounts: st.routeCounts,
        selectedUpgrades: st.selectedUpgrades,
        round: st.round,
        phase: st.phase,
        committedRoute: st.committedRoute,
        maturedRoute: st.maturedRoute,
        status: st.status,
        result: st.result ? { outcome: st.result.outcome, routeId: st.result.routeId, buildStage: st.result.buildStage } : null
      };
    }
  }
  // Check __pilotMetrics
  const m = window.__pilotMetrics;
  if (m?.sessions?.length) {
    const lastRun = m.sessions[m.sessions.length-1]?.runs?.slice(-1)[0];
    return { fromMetrics: true, routeId: lastRun?.routeId, buildStage: lastRun?.buildStage, routePicks: lastRun?.routeUpgradePickCount, nodesCleared: lastRun?.nodesCleared };
  }
  return { error: 'not found' };
});

console.log("Engine state:");
console.log(JSON.stringify(engineState, null, 2));

// Also check DOM
const domData = await page.evaluate(() => {
  const screen = document.querySelector('.result-screen');
  if (!screen) return null;
  return {
    route: screen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '',
    buildStage: screen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '',
    reason: screen.querySelector('.result-reason')?.textContent || ''
  };
});

console.log("\nDOM result:");
console.log(JSON.stringify(domData, null, 2));

await browser.close();
