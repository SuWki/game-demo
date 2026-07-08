import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:4187/game-demo/';
const outputDir = 'output/qa/first-level-freeze';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  url,
  consoleErrors: [],
  pageErrors: [],
  snapshots: [],
};

async function getGameState(page) {
  return page.evaluate(() => {
    const text = document.body.textContent?.replace(/\s+/g, ' ').trim() || '';
    // Try to get game state from the Phaser game instance
    const phaserGame = window.game;
    let sceneInfo = null;
    if (phaserGame && phaserGame.scene) {
      const scenes = phaserGame.scene.getScenes(true);
      sceneInfo = scenes.map(s => s.scene.key).join(', ');
    }
    // Get canvas info
    const canvas = document.querySelector('canvas');
    const canvasInfo = canvas ? {
      width: canvas.width,
      height: canvas.height,
      style: canvas.style.cssText?.slice(0, 200),
    } : null;
    // Check HUD text
    const hudText = document.querySelector('.game-hud-fixed')?.textContent?.replace(/\s+/g, ' ').trim()?.slice(0, 300) || '';
    return { text: text.slice(0, 300), hudText, sceneInfo, canvasInfo };
  });
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
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      summary.consoleErrors.push(`[${type}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    summary.pageErrors.push(String(error));
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // Start game
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1500);

  // Snapshot 1: initial battle state
  let state = await getGameState(page);
  summary.snapshots.push({ time: '1.5s after start', ...state });
  await page.screenshot({ path: path.join(outputDir, 'snap-01.png') });

  // Move for 3 seconds
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyS');

  // Snapshot 2: after 3s of movement
  state = await getGameState(page);
  summary.snapshots.push({ time: '4.5s after start', ...state });
  await page.screenshot({ path: path.join(outputDir, 'snap-02.png') });

  // Move for another 5 seconds with varied directions
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');

  // Snapshot 3: after more movement
  state = await getGameState(page);
  summary.snapshots.push({ time: '9.5s after start', ...state });
  await page.screenshot({ path: path.join(outputDir, 'snap-03.png') });

  // Check for choice/restart panels
  const choiceCount = await page.locator('[data-choice]').count();
  const restartCount = await page.locator('[data-action="restart"]').count();
  summary.snapshots.push({ time: 'panel check', choiceCount, restartCount });

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
