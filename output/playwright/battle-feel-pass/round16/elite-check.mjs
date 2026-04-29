import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round16/elite-check';
const url = 'http://127.0.0.1:4173';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  panels: [],
  eliteRouteChosen: false,
  eliteBattleSeen: false,
  eliteScreensCaptured: 0,
  resultSeen: false,
  replaySeen: false,
  hudText: '',
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
  const readBattleDebug = () =>
    page.evaluate(() => (window.__pilotBattleDebug ? window.__pilotBattleDebug() : null));

  const movePattern = async () => {
    const sequence = [
      ['KeyD', 720],
      ['KeyS', 460],
      ['KeyA', 760],
      ['KeyW', 480],
      ['KeyD', 360],
      ['KeyW', 260],
    ];
    for (const [key, duration] of sequence) {
      await page.keyboard.down(key);
      await wait(duration);
      await page.keyboard.up(key);
      if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
        return;
      }
    }
  };

  const readPanel = async (tag) => {
    const title = normalize(await page.locator('.floating-panel .eyebrow').textContent().catch(() => ''));
    const choices = await page.locator('[data-choice]').evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute('data-choice') || '',
        text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      })),
    );
    const panel = { tag, title, choices };
    summary.panels.push(panel);
    await page.screenshot({ path: path.join(outputDir, `${tag}.png`), fullPage: true });
    return panel;
  };

  const choosePanel = async (panel) => {
    if (!panel.choices.length) {
      return;
    }

    const isRoutePanel = panel.title.includes('关卡路线');
    const isUpgradePanel =
      panel.title.includes('强化') || panel.title.includes('整备') || panel.title.includes('等级提升');
    let target = panel.choices[0];

    if (isRoutePanel) {
      target =
        panel.choices.find((choice) => /精英战|壁垒|压制|拆解|屏卫/.test(choice.text)) ||
        panel.choices.find((choice) => choice.text.includes('战斗')) ||
        panel.choices[0];
      if (/精英战|壁垒|压制|拆解/.test(target.text)) {
        summary.eliteRouteChosen = true;
      }
    } else if (isUpgradePanel) {
      target =
        panel.choices.find((choice) => choice.text.includes('流派强化')) ||
        panel.choices.find((choice) => choice.text.includes('蓝') || choice.text.includes('紫')) ||
        panel.choices[0];
    }

    await page.locator(`[data-choice="${target.id}"]`).click();
    await wait(300);
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await wait(900);
  await page.screenshot({ path: path.join(outputDir, 'menu.png'), fullPage: true });
  await page.locator('[data-action="start"]').click();
  await wait(900);

  for (let step = 0; step < 88; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }

    const panelCount = await page.locator('[data-choice]').count();
    if (panelCount > 0) {
      const panel = await readPanel(`panel-${step + 1}`);
      await choosePanel(panel);
      continue;
    }

    const hudText = normalize(await page.locator('.hud-shell').textContent().catch(() => ''));
    const battleDebug = await readBattleDebug();
    if (
      /击败精英|精英压制|拆掉精英本体|先拆护卫|精英已进场/.test(hudText) ||
      (battleDebug?.eliteAlive && battleDebug.encounterType === 'battle' && /^elite/.test(battleDebug.templateId ?? ''))
    ) {
      summary.eliteBattleSeen = true;
      summary.hudText = hudText;
      for (let sample = 0; sample < 6 && summary.eliteScreensCaptured < 2; sample += 1) {
        if ((await page.locator('[data-choice]').count()) > 0) {
          break;
        }
        const crackDebug = await readBattleDebug();
        if (
          summary.eliteScreensCaptured === 0 &&
          crackDebug?.eliteAlive &&
          crackDebug.eliteRecoverySec > 0.08 &&
          crackDebug.escortRecoveryCount > 0
        ) {
          await page.screenshot({ path: path.join(outputDir, 'battle-elite-1.png'), fullPage: true });
          summary.eliteScreensCaptured += 1;
        } else if (
          summary.eliteScreensCaptured === 1 &&
          crackDebug?.eliteAlive &&
          crackDebug.eliteRecoverySec > 0.1 &&
          crackDebug.escortRecoveryCount > 1
        ) {
          await page.screenshot({ path: path.join(outputDir, 'battle-elite-2.png'), fullPage: true });
          summary.eliteScreensCaptured += 1;
        }
        await wait(180);
      }
    }

    await movePattern();
  }

  await wait(1000);
  if ((await page.locator('[data-action="restart"]').count()) > 0) {
    summary.resultSeen = true;
    await page.screenshot({ path: path.join(outputDir, 'result.png'), fullPage: true });
    await page.locator('[data-action="restart"]').click();
    await wait(1100);
    summary.replaySeen = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
    await page.screenshot({ path: path.join(outputDir, 'replay.png'), fullPage: true });
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
