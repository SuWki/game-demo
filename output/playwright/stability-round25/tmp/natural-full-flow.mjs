import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4199';
const OUT_DIR = path.resolve('output/playwright/stability-round25/full-flow');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function launchBrowser() {
  try { return await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] }); }
  catch { return await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] }); }
}

async function exportMetrics(page) { return page.evaluate(() => JSON.parse(window.__exportPilotMetrics())); }
async function readBattleDebug(page) { return page.evaluate(() => (window.__pilotBattleDebug ? window.__pilotBattleDebug() : null)); }
async function readAudioDebug(page) { return page.evaluate(() => (window.__pilotAudioDebug ? window.__pilotAudioDebug() : null)); }
async function getChoices(page) {
  return page.$$eval('.choice-card[data-choice]', (elements) => elements.map((element) => ({
    id: element.getAttribute('data-choice') ?? '',
    text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
  })));
}
function getRoute(choiceId) {
  if (/dash/i.test(choiceId)) return 'dash';
  if (/pierce/i.test(choiceId)) return 'pierce';
  if (/crit/i.test(choiceId)) return 'crit';
  return null;
}
async function moveBurst(page) {
  for (const [key, duration] of [['KeyD', 220], ['KeyS', 180], ['KeyA', 240], ['KeyW', 180]]) {
    if (await page.locator('[data-choice]').count()) break;
    if (await page.locator('[data-action="restart"]').count()) break;
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const summary = { consoleErrors: [], panels: 0, resultSeen: false, replaySeen: false, routeScores: { crit: 0, pierce: 0, dash: 0 } };
page.on('console', (message) => { if (message.type() === 'error') summary.consoleErrors.push(message.text()); });
page.on('pageerror', (error) => { summary.consoleErrors.push(String(error)); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(OUT_DIR, 'menu.png'), fullPage: true });
await page.click('[data-action="start"]');
await page.waitForTimeout(700);

for (let step = 0; step < 220; step += 1) {
  if (await page.locator('[data-action="restart"]').count()) { summary.resultSeen = true; break; }
  const choiceCount = await page.locator('[data-choice]').count();
  if (choiceCount > 0) {
    const choices = await getChoices(page);
    if (!choices.length) {
      await page.waitForTimeout(120);
      continue;
    }
    const ranked = choices
      .map((choice) => {
        const route = getRoute(choice.id);
        let score = route ? 2 + summary.routeScores[route] * 1.5 : 0;
        if (/elite|boss|battle/i.test(choice.id)) score += 1;
        return { choice, score };
      })
      .sort((a, b) => b.score - a.score);
    const selected = ranked[0]?.choice ?? choices[0];
    if (!selected) {
      await page.waitForTimeout(120);
      continue;
    }
    const route = getRoute(selected.id);
    if (route) summary.routeScores[route] += 1;
    summary.panels += 1;
    await page.click(`[data-choice="${selected.id}"]`);
    await page.waitForTimeout(320);
    continue;
  }
  if (step === 8 || step === 60 || step === 120) {
    await page.screenshot({ path: path.join(OUT_DIR, `battle-${step}.png`), fullPage: true });
  }
  await moveBurst(page);
}

await page.waitForTimeout(900);
if (await page.locator('[data-action="restart"]').count()) {
  summary.resultSeen = true;
  await page.screenshot({ path: path.join(OUT_DIR, 'result.png'), fullPage: true });
  await page.click('[data-action="restart"]');
  await page.waitForTimeout(900);
  summary.replaySeen = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
}
const metrics = await exportMetrics(page);
const session = metrics.sessions[metrics.sessions.length - 1];
summary.lastRun = session.runs[session.runs.length - 1] ?? null;
summary.audioDebug = await readAudioDebug(page);
summary.battleDebug = await readBattleDebug(page);
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
