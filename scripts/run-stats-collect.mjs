import { chromium } from 'playwright';
import { ensureDevServer } from './_ensure-dev-server.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TOTAL_RUNS = parseInt(process.argv.find((_, i) => process.argv[i - 1] === '--total') || '10');
const TIMEOUT_MS = 150000;
const DATA_FILE = 'scripts/_run-data.json';

export function loadData() {
  if (existsSync(DATA_FILE)) try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
  return [];
}
export function saveData(d) { writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

function isInsideSafeZone(s) {
  const axis = s.pressureSafeWindowAxis;
  if (!axis || !s.pressureSafeWindowSpan || s.pressureSafeWindowSpan <= 0 || !s.pressureSafeWindowSec || s.pressureSafeWindowSec <= 0) return 'none';
  const half = s.pressureSafeWindowSpan * 0.5;
  const px = s.playerX, py = s.playerY;
  const cx = s.pressureSafeWindowCenter;
  const cy = s.pressureSafeWindowSecondaryCenter;
  if (axis === 'vertical') return (px >= cx - half && px <= cx + half) ? 'inside' : 'outside';
  if (axis === 'horizontal') return (py >= cx - half && py <= cx + half) ? 'inside' : 'outside';
  if (axis === 'pocket') {
    const halfY = (s.pressureSafeWindowSecondarySpan || s.pressureSafeWindowSpan) * 0.5;
    return (px >= cx - half && px <= cx + half && py >= cy - halfY && py <= cy + halfY) ? 'inside' : 'outside';
  }
  return 'none';
}

function calcDirection(s) {
  const axis = s.pressureSafeWindowAxis;
  if (axis && s.pressureSafeWindowSpan > 0 && s.pressureSafeWindowSec > 0) {
    const half = s.pressureSafeWindowSpan * 0.5;
    const px = s.playerX, py = s.playerY;
    const cx = s.pressureSafeWindowCenter;
    const cy = s.pressureSafeWindowSecondaryCenter;
    if (axis === 'vertical') {
      if (px < cx - half) return { x: 1, y: 0 };
      if (px > cx + half) return { x: -1, y: 0 };
      return { x: 0, y: 1 };
    }
    if (axis === 'horizontal') {
      if (py < cx - half) return { x: 0, y: 1 };
      if (py > cx + half) return { x: 0, y: -1 };
      return { x: 1, y: 0 };
    }
    const halfY = (s.pressureSafeWindowSecondarySpan || s.pressureSafeWindowSpan) * 0.5;
    let dx = 0, dy = 0;
    if (px < cx - half) dx = 1;
    else if (px > cx + half) dx = -1;
    if (py < cy - halfY) dy = 1;
    else if (py > cy + halfY) dy = -1;
    if (dx === 0 && dy === 0) { dx = 1; }
    return { x: dx, y: dy };
  }
  const t = Date.now() / 800;
  return { x: Math.cos(t), y: Math.sin(t) };
}

function dirToKeys(dir) {
  return {
    up: dir.y < -0.3,
    down: dir.y > 0.3,
    left: dir.x < -0.3,
    right: dir.x > 0.3,
  };
}

async function main() {
  const stopServer = await ensureDevServer();
  const allData = loadData();
  const startIdx = allData.length;

  if (startIdx >= TOTAL_RUNS) {
    console.log(`已完成 ${startIdx}/${TOTAL_RUNS} 局`);
    stopServer();
    return;
  }

  console.log(`\n=== ${TOTAL_RUNS}局测试 (安全区AI v2) 开始 ===\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.click('[data-action="start"]');
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

  for (let i = startIdx; i < TOTAL_RUNS; i++) {
    const startTime = Date.now();
    let completed = false;
    let held = { up: false, down: false, left: false, right: false };

    process.stdout.write(`  #${i + 1}: `);

    while (Date.now() - startTime < TIMEOUT_MS) {
      const panelClicked = await page.evaluate((runIdx) => {
        const panels = ['.panel-node-choice [data-choice]', '.panel-upgrade-choice [data-choice]', '.panel-event-choice [data-choice]'];
        for (const sel of panels) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) { els[runIdx % els.length].click(); return true; }
        }
        return false;
      }, i);

      if (panelClicked) {
        await page.waitForTimeout(200);
        continue;
      }

      const snap = await page.evaluate(() => { try { return window.__pilotDebug?.getSnapshot?.() || null; } catch { return null; } });
      if (snap) {
        const dir = calcDirection(snap);
        const target = dirToKeys(dir);

        for (const k of ['up', 'down', 'left', 'right']) {
          if (target[k] !== held[k]) {
            const key = { up: 'w', down: 's', left: 'a', right: 'd' }[k];
            if (target[k]) await page.keyboard.down(key).catch(() => {});
            else await page.keyboard.up(key).catch(() => {});
            held[k] = target[k];
          }
        }
      }

      const resultData = await page.evaluate(() => {
        const el = document.querySelector('.result-screen');
        if (!el) return null;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        const parent = el.closest('.screen-layer');
        if (parent && window.getComputedStyle(parent).display === 'none') return null;
        const title = el.querySelector('.result-title');
        if (!title || !title.textContent) return null;
        const coreStatEls = [...el.querySelectorAll('.core-stat-item')];
        const routeText = coreStatEls[2]?.querySelector('strong')?.textContent?.trim() || '';
        const buildStageText = coreStatEls[2]?.querySelector('small')?.textContent?.trim() || '';
        const timelineItems = [...el.querySelectorAll('.timeline-item')];
        return {
          isVictory: el.classList.contains('is-victory'),
          route: routeText, buildStage: buildStageText,
          upgradeCount: timelineItems.length,
          upgrades: timelineItems.map(item => ({ name: item.querySelector('strong')?.textContent?.trim() || '' })),
        };
      });

      if (resultData) {
        completed = true;
        for (const k of ['w', 'a', 's', 'd']) await page.keyboard.up(k).catch(() => {});
        const wallSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

        const rich = await page.evaluate(() => {
          const m = window.__pilotMetrics;
          const run = m?.sessions?.length ? m.sessions[m.sessions.length - 1]?.runs?.slice(-1)[0] : null;
          if (!run) return null;
          return {
            outcome: run.outcome, routeId: run.routeId, buildStage: run.buildStage,
            endingKind: run.endingKind, endingReason: run.endingReason,
            finalNodeTitle: run.finalNodeTitle, finalNodeType: run.finalNodeType,
            durationSec: run.durationSec, battleWins: run.battleWins, nodesCleared: run.nodesCleared,
            rareSeenCount: run.rareSeenCount, routeUpgradePickCount: run.routeUpgradePickCount,
          };
        });

        allData.push({ ...resultData, rich, wallSec, runIndex: i + 1 });
        saveData(allData);

        const kills = rich?.battleWins ?? 0;
        const nodes = rich?.nodesCleared ?? 0;
        const dur = rich?.durationSec ? `${rich.durationSec.toFixed(0)}s` : '?';
        console.log(`\r  #${i + 1}: ${resultData.isVictory ? '✓胜' : '✗败'} | 游戏${dur} | ${resultData.route} ${resultData.buildStage} | ${kills}击杀 | ${nodes}节点 [${rich?.finalNodeTitle || '?'}] | ${resultData.upgradeCount}强化 | ${rich?.endingKind || ''}`);
        break;
      }

      await page.waitForTimeout(50);
    }

    if (!completed) {
      for (const k of ['w', 'a', 's', 'd']) await page.keyboard.up(k).catch(() => {});
      const wallSec = (Date.now() - startTime) / 1000;
      console.log(`\r  #${i + 1}: ⚠超时 (${wallSec.toFixed(0)}s)`);
      allData.push({ isVictory: false, route: '超时', buildStage: '', upgradeCount: 0, wallSec, rich: null, timeout: true, runIndex: i + 1 });
      saveData(allData);
    }

    try {
      const btn = await page.$('[data-action="restart"]');
      if (btn && await btn.isVisible()) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.click('[data-action="start"]');
        await page.waitForTimeout(2000);
      }
      await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
    } catch (e) {
      try {
        await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.click('[data-action="start"]');
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
      } catch {}
    }
  }

  const wins = allData.filter(d => d.isVictory).length;
  console.log(`\n--- ${allData.length}/${TOTAL_RUNS} 完成 | 胜率: ${(wins / allData.length * 100).toFixed(0)}% ---`);
  await browser.close();
  stopServer();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
