import { chromium } from 'playwright';

const TOTAL_RUNS = 10;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(2000);

await page.click('[data-action="start"]');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));

console.log('=== 10局测试 ===\n');
const startTime = Date.now();
let runCount = 0;
let lastState = '';
let stuckCounter = 0;
const data = [];

while (runCount < TOTAL_RUNS && Date.now() - startTime < 600000) {
  try {
    const state = await page.evaluate(() => {
      const resultScreen = document.querySelector('.result-screen');
      if (resultScreen) {
        const style = window.getComputedStyle(resultScreen);
        const parent = resultScreen.closest('.screen-layer');
        const parentStyle = parent ? window.getComputedStyle(parent) : null;
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && (!parentStyle || parentStyle.display !== 'none');
        if (visible) {
          return {
            type: 'result',
            route: resultScreen.querySelector('.core-stat-item:nth-child(3) strong')?.textContent || '?',
            buildStage: resultScreen.querySelector('.core-stat-item:nth-child(3) small')?.textContent || '?',
            upgrades: resultScreen.querySelectorAll('.timeline-item strong').length,
            isVictory: resultScreen.classList.contains('is-victory'),
          };
        }
      }
      
      const nodePanel = document.querySelector('.panel-node-choice');
      const upgradePanel = document.querySelector('.panel-upgrade-choice');
      const eventPanel = document.querySelector('.panel-event-choice');
      
      if (nodePanel) return { type: 'nodeChoice' };
      if (upgradePanel) return { type: 'upgradeChoice' };
      if (eventPanel) return { type: 'eventChoice' };
      
      return { type: 'battle' };
    });
    
    const stateKey = JSON.stringify(state);
    
    if (stateKey !== lastState) {
      lastState = stateKey;
      stuckCounter = 0;
    } else {
      stuckCounter++;
    }
    
    if (state.type === 'result') {
      const rich = await page.evaluate(() => {
        const m = window.__pilotMetrics;
        const run = m?.sessions?.length ? m.sessions[m.sessions.length - 1]?.runs?.slice(-1)[0] : null;
        return run ? { nodes: run.nodesCleared, finalNode: run.finalNodeTitle, routePicks: run.routeUpgradePickCount, rareSeen: run.rareSeenCount } : null;
      });

      runCount++;
      console.log(`  #${runCount}: ${state.isVictory ? '✓胜' : '✗败'} | ${state.route} ${state.buildStage} | ${state.upgrades}强化 ${rich?.nodes || 0}节点 [${rich?.finalNode || '?'}] | 流派牌:${rich?.routePicks || 0} 稀有:${rich?.rareSeen || 0}seen`);
      data.push({ ...state, rich });

      const btn = await page.$('[data-action="restart"]');
      if (btn && await btn.isVisible()) {
        await btn.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(2000);
      } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.click('[data-action="start"]');
        await page.waitForTimeout(2000);
      }
      await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
      lastState = '';
      stuckCounter = 0;
    } else if (state.type === 'nodeChoice' || state.type === 'upgradeChoice' || state.type === 'eventChoice') {
      if (stuckCounter > 5) {
        const selector = state.type === 'nodeChoice' ? '.panel-node-choice [data-choice]' :
                         state.type === 'upgradeChoice' ? '.panel-upgrade-choice [data-choice]' :
                         '.panel-event-choice [data-choice]';
        
        await page.evaluate((sel) => {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) els[0].click();
        }, selector);
        
        await page.waitForTimeout(500);
        stuckCounter = 0;
      }
    } else {
      if (stuckCounter % 10 === 0) {
        const dir = ['w', 'a', 's', 'd'][Math.floor(Date.now() / 500) % 4];
        await page.keyboard.down(dir);
        await page.waitForTimeout(300);
        await page.keyboard.up(dir);
      }
    }
    
    await page.waitForTimeout(100);
  } catch (err) {
    console.log(`  [Error] ${err.message.substring(0, 80)}`);
    // Try to recover by reloading
    try {
      await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.click('[data-action="start"]');
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__pilotDebug?.setConfig?.({ timeScale: 2 }));
      lastState = '';
      stuckCounter = 0;
    } catch (e2) {
      console.log(`  [Fatal] Cannot recover: ${e2.message.substring(0, 80)}`);
      break;
    }
  }
}

// Report
console.log('\n========== 报告 ==========\n');
const total = data.length;
const wins = data.filter(d => d.isVictory).length;
console.log(`完成: ${total}/10 | 胜: ${wins} | 败: ${total - wins}`);

const routes = {};
data.forEach(d => { routes[d.route] = (routes[d.route] || 0) + 1; });
console.log('\n流派:');
Object.entries(routes).sort((a,b) => b[1]-a[1]).forEach(([r,c]) => console.log(`  ${r}: ${c}局 (${(c/total*100).toFixed(0)}%)`));

const stages = {};
data.forEach(d => { stages[d.buildStage] = (stages[d.buildStage] || 0) + 1; });
console.log('\n阶段:');
Object.entries(stages).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log(`  ${s}: ${c}局`));

const upgrades = data.map(d => d.upgrades);
if (upgrades.length) {
  console.log(`\n强化: 平均${(upgrades.reduce((a,b)=>a+b,0)/upgrades.length).toFixed(1)} | 范围${Math.min(...upgrades)}-${Math.max(...upgrades)}`);
}

const nodes = data.map(d => d.rich?.nodes || 0);
if (nodes.length) {
  console.log(`节点: 平均${(nodes.reduce((a,b)=>a+b,0)/nodes.length).toFixed(1)} | 范围${Math.min(...nodes)}-${Math.max(...nodes)}`);
}

console.log('\n========== 结束 ==========\n');
await browser.close();
