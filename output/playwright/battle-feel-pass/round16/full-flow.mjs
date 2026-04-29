import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = 'E:/codex/unity-learning/output/playwright/battle-feel-pass/round16/full-flow';
const url = 'http://127.0.0.1:4173';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  panels: 0,
  resultSeen: false,
  replaySeen: false,
};

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

  const movePattern = async () => {
    for (const [key, duration] of [
      ['KeyD', 640],
      ['KeyS', 420],
      ['KeyA', 760],
      ['KeyW', 420],
      ['KeyD', 360],
    ]) {
      await page.keyboard.down(key);
      await wait(duration);
      await page.keyboard.up(key);
      if ((await page.locator('[data-choice]').count()) > 0 || (await page.locator('[data-action="restart"]').count()) > 0) {
        return;
      }
    }
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await wait(700);
  await page.screenshot({ path: path.join(outputDir, 'menu.png'), fullPage: true });
  await page.locator('[data-action="start"]').click();
  await wait(900);

  for (let step = 0; step < 64; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) {
      break;
    }

    const choiceCount = await page.locator('[data-choice]').count();
    if (choiceCount > 0) {
      summary.panels += 1;
      await page.screenshot({ path: path.join(outputDir, `panel-${step + 1}.png`), fullPage: true });
      await page.locator('[data-choice]').first().click();
      await wait(320);
      continue;
    }

    if (step === 2) {
      await page.screenshot({ path: path.join(outputDir, 'battle-opening.png'), fullPage: true });
    }
    if (step === 8) {
      await page.screenshot({ path: path.join(outputDir, 'battle-pressure.png'), fullPage: true });
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
