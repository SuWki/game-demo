import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../output/qa/volume-bug-check');
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\wyl\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();

await page.goto('http://127.0.0.1:5199/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Click volume button (this also unlocks audio via pointerdown)
await page.click('[data-action="volume"]');
await page.waitForTimeout(1000);

// Set volume to 0%
await page.evaluate(() => {
  const slider = document.querySelector('[data-volume-slider]');
  if (slider) {
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(500);

const state0 = await page.evaluate(() => window.__pilotAudioDebug?.());
console.log('After setting to 0%:', JSON.stringify(state0));

// Set volume back to 80%
await page.evaluate(() => {
  const slider = document.querySelector('[data-volume-slider]');
  if (slider) {
    slider.value = '80';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(500);

const state80 = await page.evaluate(() => window.__pilotAudioDebug?.());
console.log('After setting back to 80%:', JSON.stringify(state80));

// Close panel
await page.click('[data-action="close"]');
await page.waitForTimeout(1000);

const stateClose = await page.evaluate(() => window.__pilotAudioDebug?.());
console.log('After closing panel:', JSON.stringify(stateClose));

// Now test: what if user sets to 0 and closes without restoring?
// Reload page, set volume to 0, close, start game
await page.goto('http://127.0.0.1:5199/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Click volume
await page.click('[data-action="volume"]');
await page.waitForTimeout(500);

// Set to 0
await page.evaluate(() => {
  const slider = document.querySelector('[data-volume-slider]');
  if (slider) {
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(300);

// Close without restoring
await page.click('[data-action="close"]');
await page.waitForTimeout(500);

// Start game
await page.click('[data-action="start"]');
await page.waitForTimeout(3000);

const stateGame = await page.evaluate(() => window.__pilotAudioDebug?.());
console.log('\nAfter set-to-0 + close + start game:', JSON.stringify(stateGame, null, 2));

// Check localStorage
const vol = await page.evaluate(() => localStorage.getItem('pilot-audio-volume'));
console.log('localStorage volume:', vol);

await browser.close();
