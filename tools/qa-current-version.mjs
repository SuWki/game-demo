import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4187';
const outputDir = process.env.PILOT_QA_OUTPUT ?? 'output/qa/current-version';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  url,
  consoleErrors: [],
  panelsSeen: 0,
  resultSeen: false,
  replaySeen: false,
  pauseSeen: false,
  volumePanelSeen: false,
  initialVolume: null,
  volumeAfterAdjust: null,
  volumePersisted: null,
};

function normalize(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

async function clickFirstChoice(page) {
  const choice = page.locator('[data-choice]').first();
  if ((await choice.count()) === 0) {
    return false;
  }
  summary.panelsSeen += 1;
  await choice.click();
  await page.waitForTimeout(320);
  return true;
}

async function movePattern(page) {
  const sequence = [
    ['KeyD', 640],
    ['KeyS', 440],
    ['KeyA', 760],
    ['KeyW', 440],
    ['KeyD', 360],
  ];
  for (const [key, duration] of sequence) {
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
      return;
    }
  }
}

async function runFullFlow(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDir, '01-menu.png'), fullPage: true });
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(900);

  for (let step = 0; step < 70; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }
    if (await clickFirstChoice(page)) {
      await page.screenshot({ path: path.join(outputDir, `panel-${String(step + 1).padStart(2, '0')}.png`), fullPage: true });
      continue;
    }
    if (step === 2) {
      await page.screenshot({ path: path.join(outputDir, '02-battle-opening.png'), fullPage: true });
    }
    await movePattern(page);
  }

  await page.waitForTimeout(1000);
  summary.resultSeen = (await page.locator('[data-action="restart"]').count()) > 0;
  if (summary.resultSeen) {
    await page.screenshot({ path: path.join(outputDir, '03-result.png'), fullPage: true });
    await page.locator('[data-action="restart"]').click();
    await page.waitForTimeout(1400);
    summary.replaySeen =
      (await page.locator('.game-hud-fixed').count()) > 0 ||
      (await page.locator('[data-action="pause"]').count()) > 0 ||
      (await page.locator('[data-choice]').count()) > 0;
    await page.screenshot({ path: path.join(outputDir, '04-replay.png'), fullPage: true });
  }
}

async function runPauseAndVolume(page) {
  if ((await page.locator('[data-action="pause"]').count()) === 0) {
    return;
  }

  await page.locator('[data-action="pause"]').click();
  await page.waitForTimeout(350);
  summary.pauseSeen = (await page.locator('.commercial-pause-panel').count()) > 0;
  await page.screenshot({ path: path.join(outputDir, '05-pause.png'), fullPage: true });

  await page.locator('.panel-layer:not(.hidden) [data-action="volume"]').click();
  await page.waitForTimeout(300);
  summary.volumePanelSeen = (await page.locator('[data-volume-slider]').count()) > 0;
  await page.screenshot({ path: path.join(outputDir, '06-volume.png'), fullPage: true });

  summary.initialVolume = await page.evaluate(() => window.__pilotAudioDebug?.().masterVolume ?? null);
  await page.locator('[data-volume-slider]').evaluate((element) => {
    element.value = '78';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  summary.volumeAfterAdjust = await page.evaluate(() => window.__pilotAudioDebug?.().masterVolume ?? null);
  summary.volumePersisted = await page.evaluate(() => window.localStorage.getItem('pilot-audio-volume'));
  await page.screenshot({ path: path.join(outputDir, '07-volume-78.png'), fullPage: true });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      summary.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(String(error));
  });

  await runFullFlow(page);
  await runPauseAndVolume(page);

  const screenText = await page.locator('body').textContent().catch(() => '');
  summary.finalScreenText = normalize(screenText).slice(0, 300);
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
