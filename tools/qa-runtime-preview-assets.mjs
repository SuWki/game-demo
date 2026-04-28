import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const outDir = path.join(root, 'output', 'qa', 'runtime-preview-assets');
const url = process.env.QA_URL ?? 'http://127.0.0.1:4187';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

fs.mkdirSync(outDir, { recursive: true });

const expectedAssets = [
  '/assets/preview-runtime/visual/unit-player-core.svg',
  '/assets/preview-runtime/visual/enemy-standard-a.svg',
  '/assets/preview-runtime/visual/fx-xp-orb.svg',
  '/assets/preview-runtime/audio/player_shoot_core.wav',
  '/assets/preview-runtime/audio/player_hit_regular.wav',
  '/assets/preview-runtime/audio/player_kill_regular.wav',
  '/assets/preview-runtime/audio/player_pickup_single.wav',
  '/assets/preview-runtime/audio/player_hurt_core.wav',
];

const assetStatuses = [];
for (const asset of expectedAssets) {
  try {
    const response = await fetch(`${url}${asset}`);
    assetStatuses.push({
      asset,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') ?? '',
      bytes: Number(response.headers.get('content-length') ?? 0),
    });
  } catch (error) {
    assetStatuses.push({
      asset,
      status: 0,
      ok: false,
      contentType: '',
      bytes: 0,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const summary = {
  url,
  allAssetsOk: assetStatuses.every((asset) => asset.ok),
  assetStatuses,
  browserCheck: executablePath ? 'pending' : 'skipped-no-local-chrome-or-edge',
  consoleErrors: [],
  previewAudioEnabled: null,
  previewAudioReady: 0,
  previewAudioCueCounts: {},
  cueCounts: {},
  screenshot: null,
};

if (executablePath) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      summary.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    summary.consoleErrors.push(error.message);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.removeItem('pilot-runtime-preview-assets');
    window.localStorage.removeItem('pilot-runtime-preview-audio');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1600);
  const screenshotPath = path.join(outDir, 'battle-preview-runtime.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.waitForTimeout(1800);
  const audioDebug = await page.evaluate(() => window.__pilotAudioDebug?.() ?? null);
  summary.browserCheck = 'completed';
  summary.previewAudioEnabled = audioDebug?.previewAudioEnabled ?? null;
  summary.previewAudioReady = audioDebug?.previewAudioReady ?? 0;
  summary.previewAudioCueCounts = audioDebug?.previewAudioCueCounts ?? {};
  summary.cueCounts = audioDebug?.cueCounts ?? {};
  summary.screenshot = path.relative(root, screenshotPath);
  await browser.close();
}

fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));

if (!summary.allAssetsOk || summary.consoleErrors.length > 0 || summary.previewAudioEnabled === false) {
  process.exit(1);
}
