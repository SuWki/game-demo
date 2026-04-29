import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4199';
const OUT_DIR = path.resolve('output/playwright/stability-round25/dash-natural-bias');
fs.mkdirSync(OUT_DIR, { recursive: true });
const executableCandidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const summary = { consoleErrors: [], panels: 0, resultSeen: false, routeScores: { crit: 0, pierce: 0, dash: 0 } };
page.on('console', (message) => { if (message.type() === 'error') summary.consoleErrors.push(message.text()); });
page.on('pageerror', (error) => { summary.consoleErrors.push(String(error)); });
const getChoices = () => page.$$eval('[data-choice]', (elements) => elements.map((element) => ({ id: element.getAttribute('data-choice') ?? '', text: (element.textContent ?? '').replace(/\s+/g, ' ').trim() })));
const getRoute = (id) => /dash/i.test(id) ? 'dash' : /pierce/i.test(id) ? 'pierce' : /crit/i.test(id) ? 'crit' : null;
async function moveBurst() {
  for (const [key, duration] of [['KeyD', 220], ['KeyS', 180], ['KeyA', 240], ['KeyW', 180], ['KeyD', 140]]) {
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) return;
    await page.keyboard.down(key); await page.waitForTimeout(duration); await page.keyboard.up(key); await page.waitForTimeout(60);
  }
}
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[data-action="start"]');
await page.waitForTimeout(700);
for (let step = 0; step < 260; step += 1) {
  if ((await page.locator('[data-action="restart"]').count()) > 0) { summary.resultSeen = true; break; }
  const choices = await getChoices();
  if (choices.length > 0) {
    const selected = choices.map((choice) => {
      const route = getRoute(choice.id);
      let score = route ? 2 + summary.routeScores[route] * 1.2 : 0;
      if (/dash/i.test(choice.id)) score += 3.5;
      if (/elite|boss|battle/i.test(choice.id)) score += 1;
      return { choice, score };
    }).sort((a, b) => b.score - a.score)[0]?.choice ?? choices[0];
    const route = getRoute(selected.id);
    if (route) summary.routeScores[route] += 1;
    summary.panels += 1;
    await page.click(`[data-choice="${selected.id}"]`);
    await page.waitForTimeout(320);
    continue;
  }
  await moveBurst();
}
await page.waitForTimeout(800);
const metrics = await page.evaluate(() => JSON.parse(window.__exportPilotMetrics()));
const session = metrics.sessions[metrics.sessions.length - 1];
summary.lastRun = session.runs[session.runs.length - 1] ?? null;
summary.audioDebug = await page.evaluate(() => window.__pilotAudioDebug ? window.__pilotAudioDebug() : null);
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
