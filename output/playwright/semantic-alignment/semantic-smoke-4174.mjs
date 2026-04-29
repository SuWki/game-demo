import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'E:/codex/unity-learning/output/playwright/semantic-alignment';
fs.mkdirSync(outDir, { recursive: true });

const ANOMALY_LABEL = '\u5f02\u5e38';
const BOSS_LABEL = 'Boss';
const ROUTE_TYPES = ['\u66b4\u51fb', '\u7a7f\u900f', '\u7a7f\u68ad'];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const summary = {
  panels: [],
  nodeTypeSeen: [],
  battleSnapshots: [],
  battleStates: [],
  resultVisible: false,
  replayStarted: false,
  consoleErrors: [],
  metrics: null,
};

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    summary.consoleErrors.push(msg.text());
  }
});
page.on('pageerror', (error) => {
  summary.consoleErrors.push(String(error));
});

const wait = (ms) => page.waitForTimeout(ms);
const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();

let anomalyVisited = false;
let extraBattleVisited = false;

async function captureBattleState(tag) {
  const state = await page.evaluate(() => {
    const phaser = window.Phaser || globalThis.Phaser;
    const game = phaser?.GAMES?.[0];
    const scene = game?.scene?.keys?.GameScene;
    const runState = scene?.engine?.getState?.();
    const battle = runState?.battle;
    if (!battle) {
      return null;
    }

    return {
      encounterType: battle.encounterType,
      templateId: battle.templateId,
      label: battle.label,
      enemyArchetypes: battle.enemies.map((enemy) => enemy.archetype),
      enemyRoles: battle.enemies.map((enemy) => enemy.role),
      enemyProjectileCount: battle.enemyProjectiles.length,
      nodeType: runState.currentNode?.type ?? null,
      nodeTitle: runState.currentNode?.title ?? null,
    };
  }).catch(() => null);

  if (state) {
    summary.battleStates.push({ tag, ...state });
  }

  return state;
}

async function snapshotBattle(tag) {
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true });
  const state = await captureBattleState(tag);
  summary.battleSnapshots.push({
    tag,
    encounterType: state?.encounterType ?? null,
    templateId: state?.templateId ?? null,
    nodeType: state?.nodeType ?? null,
    enemyArchetypes: state ? Array.from(new Set(state.enemyArchetypes)) : [],
    enemyProjectileCount: state?.enemyProjectileCount ?? null,
  });
}

async function snapshotPanel(tag) {
  const title = normalize(await page.locator('.floating-panel .eyebrow').textContent().catch(() => ''));
  const choices = await page.locator('[data-choice]').evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-choice') || '',
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      type: ((element.querySelector('.choice-type') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      rarity: ((element.querySelector('.choice-rarity') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    })),
  );
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true });
  summary.panels.push({ tag, title, choices });
  for (const choice of choices) {
    if (!summary.nodeTypeSeen.includes(choice.type) && choice.type) {
      summary.nodeTypeSeen.push(choice.type);
    }
  }
  return { title, choices };
}

async function chooseFromPanel(panel) {
  if (!panel.choices.length) {
    return;
  }

  const isNodePanel = panel.title.includes('\u8282\u70b9\u9009\u62e9');
  let target = panel.choices[0];

  if (isNodePanel) {
    const anomalyChoice = panel.choices.find((choice) => choice.type === ANOMALY_LABEL);
    const battleChoice = panel.choices.find((choice) => choice.type === '\u6218\u6597');
    const bossChoice = panel.choices.find((choice) => choice.type === BOSS_LABEL);
    target =
      bossChoice ||
      (!anomalyVisited && anomalyChoice) ||
      (!extraBattleVisited && battleChoice) ||
      panel.choices.find((choice) => choice.type === '\u5f3a\u5316') ||
      anomalyChoice ||
      battleChoice ||
      panel.choices[0];
  } else {
    target =
      panel.choices.find((choice) => ROUTE_TYPES.includes(choice.type)) ||
      panel.choices[0];
  }

  await page.locator(`[data-choice="${target.id}"]`).click();
  await wait(280);

  if (target.type === ANOMALY_LABEL) {
    anomalyVisited = true;
  }

  if (target.type === '\u6218\u6597') {
    extraBattleVisited = true;
    await wait(2400);
    await snapshotBattle(`battle-route-${summary.battleSnapshots.length + 1}`);
  }

  if (target.type === BOSS_LABEL) {
    await wait(2600);
    await snapshotBattle('battle-boss');
  }
}

async function movePattern() {
  const sequence = [
    ['KeyD', 700],
    ['KeyS', 520],
    ['KeyA', 700],
    ['KeyW', 520],
  ];

  for (const [key, duration] of sequence) {
    await page.keyboard.down(key);
    await wait(duration);
    await page.keyboard.up(key);

    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }
  }
}

await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
await wait(700);
await page.screenshot({ path: path.join(outDir, 'menu.png'), fullPage: true });
await page.locator('[data-action="start"]').click();
await wait(2400);
await snapshotBattle('battle-opening');

let openingCaptured = false;
let rangedCaptured = false;
let bossCaptured = false;

for (let step = 0; step < 60; step += 1) {
  if (await page.locator('[data-action="restart"]').count()) {
    summary.resultVisible = true;
    break;
  }

  const choiceCount = await page.locator('[data-choice]').count();
  if (choiceCount > 0) {
    const panel = await snapshotPanel(`panel-${step + 1}`);
    await chooseFromPanel(panel);
    continue;
  }

  await movePattern();

  const battleState = await captureBattleState(`loop-${step + 1}`);
  if (battleState && !openingCaptured) {
    await snapshotBattle('battle-opening');
    openingCaptured = true;
  }

  if (battleState && !rangedCaptured && battleState.enemyArchetypes.includes('ranged')) {
    await snapshotBattle('battle-ranged');
    rangedCaptured = true;
  }

  if (battleState && !bossCaptured && battleState.encounterType === 'boss') {
    await snapshotBattle('battle-boss');
    bossCaptured = true;
  }
}

await wait(1200);
if (await page.locator('[data-action="restart"]').count()) {
  summary.resultVisible = true;
  await page.screenshot({ path: path.join(outDir, 'result.png'), fullPage: true });
  await page.locator('[data-action="restart"]').click();
  await wait(1200);
  summary.replayStarted = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
  await page.screenshot({ path: path.join(outDir, 'replay.png'), fullPage: true });
}

summary.metrics = await page.evaluate(() => {
  const exported = JSON.parse(window.__exportPilotMetrics());
  const currentSession = exported.sessions[exported.sessions.length - 1];
  const lastRun = currentSession.runs[currentSession.runs.length - 1] || null;
  return {
    runCount: currentSession.runs.length,
    eventCount: currentSession.events.length,
    lastRun,
    lastEvents: currentSession.events.slice(-16),
  };
});

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
console.log(JSON.stringify(summary, null, 2));
