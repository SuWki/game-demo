import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/stability-round25/full-flow';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  panels: [],
  choices: [],
  anomalyPanelSeen: false,
  bossNodeSeen: false,
  bossBattleSeen: false,
  bossBattleShot: false,
  replayStarted: false,
  consoleErrors: [],
  metrics: null,
  battleHudSeen: false,
  result: null,
};

function normalize(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      summary.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    summary.consoleErrors.push(String(err));
  });

  const wait = (ms) => page.waitForTimeout(ms);

  const snapshotPanel = async (tag) => {
    const title = normalize(await page.locator('.floating-panel .eyebrow').textContent().catch(() => ''));
    const description = normalize(await page.locator('.floating-panel .panel-description').textContent().catch(() => ''));
    const choices = await page.locator('[data-choice]').evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute('data-choice') || '',
        text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
        type: ((element.querySelector('.choice-type') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      })),
    );
    await page.screenshot({ path: path.join(outputDir, `${tag}.png`), fullPage: true });
    const panel = { tag, title, description, choices };
    summary.panels.push(panel);
    if (title.includes('寮傚父')) {
      summary.anomalyPanelSeen = true;
    }
    if (choices.some((choice) => choice.type.includes('Boss'))) {
      summary.bossNodeSeen = true;
    }
    return panel;
  };

  const movePattern = async () => {
    const sequence = [
      ['KeyD', 760],
      ['KeyS', 520],
      ['KeyA', 760],
      ['KeyW', 520],
      ['KeyD', 360],
      ['KeyW', 360],
    ];
    for (const [key, duration] of sequence) {
      await page.keyboard.down(key);
      await wait(duration);
      await page.keyboard.up(key);
      const panelCount = await page.locator('[data-choice]').count();
      const resultCount = await page.locator('[data-action="restart"]').count();
      if (panelCount > 0 || resultCount > 0) {
        break;
      }
    }
  };

  const chooseFromPanel = async (panel) => {
    if (!panel.choices.length) {
      return;
    }

    const isNodePanel = panel.title.includes('鑺傜偣閫夋嫨');
    const isUpgradePanel = panel.title.includes('寮哄寲') || panel.title.includes('鏁村') || panel.title.includes('绛夌骇鎻愬崌');
    let target = panel.choices[0];

    if (isNodePanel) {
      target =
        panel.choices.find((choice) => choice.type.includes('寮傚父')) ||
        panel.choices.find((choice) => choice.type.includes('Boss')) ||
        panel.choices.find((choice) => choice.type.includes('寮哄寲')) ||
        panel.choices[0];
    } else if (isUpgradePanel) {
      target =
        panel.choices.find((choice) => !choice.type.includes('閫氱敤')) ||
        panel.choices.find((choice) => choice.text.includes('绱?) || choice.text.includes('閲?)) ||
        panel.choices[0];
    } else {
      target =
        panel.choices.find((choice) => choice.text.includes('绐楀彛') || choice.text.includes('鏍锋湰') || choice.text.includes('鎵垮帇')) ||
        panel.choices.find((choice) => !choice.type.includes('浜嬩欢')) ||
        panel.choices[0];
    }

    summary.choices.push({ panel: panel.title, choice: target.text });
    await page.locator(`[data-choice="${target.id}"]`).click();
    await wait(280);
  };

  await page.goto('http://127.0.0.1:4199', { waitUntil: 'domcontentloaded' });
  await wait(800);
  await page.screenshot({ path: path.join(outputDir, 'menu.png'), fullPage: true });
  await page.locator('[data-action="start"]').click();
  await wait(800);

  for (let step = 0; step < 56; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }

    const panelCount = await page.locator('[data-choice]').count();
    if (panelCount > 0) {
      const panel = await snapshotPanel(`panel-${step + 1}`);
      await chooseFromPanel(panel);
      continue;
    }

    const hudCount = await page.locator('.hud-shell').count();
    if (hudCount > 0) {
      const hudText = normalize(await page.locator('.hud-kicker').textContent().catch(() => ''));
      if (hudText.includes('Boss杞戒綋') || hudText.includes('绮捐嫳鎴?) || hudText.includes('鐢熷瓨鎴?) || hudText.includes('鏅€氭垬')) {
        summary.battleHudSeen = true;
      }
      if (hudText.includes('Boss杞戒綋')) {
        summary.bossBattleSeen = true;
        if (!summary.bossBattleShot) {
          await page.screenshot({ path: path.join(outputDir, 'boss-battle.png'), fullPage: true });
          summary.bossBattleShot = true;
        }
      }
    }

    await movePattern();
  }

  await wait(1200);
  if ((await page.locator('[data-action="restart"]').count()) > 0) {
    await page.screenshot({ path: path.join(outputDir, 'result.png'), fullPage: true });
    summary.result = normalize(await page.locator('.result-card').textContent().catch(() => ''));
    await page.locator('[data-action="restart"]').click();
    await wait(1200);
    summary.replayStarted = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
    await page.screenshot({ path: path.join(outputDir, 'replay.png'), fullPage: true });
  }

  summary.metrics = await page.evaluate(() => {
    const exported = JSON.parse(window.__exportPilotMetrics());
    const session = exported.sessions[exported.sessions.length - 1];
    const bossEvents = session.events.filter(
      (event) => event.name === 'battle_template_entered' && event.payload?.encounterType === 'boss',
    );
    const anomalyEvents = session.events.filter(
      (event) => event.name === 'event_selected' && event.payload?.contentKind === 'anomaly',
    );
    return {
      runCount: session.runs.length,
      bossEvents: bossEvents.slice(-3),
      anomalyEvents: anomalyEvents.slice(-3),
      finalRun: session.runs[session.runs.length - 1],
      lastEvents: session.events.slice(-12),
    };
  });

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
