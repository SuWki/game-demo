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

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

await page.goto('http://127.0.0.1:5199/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Click start button to unlock audio (via pointerdown)
await page.click('[data-action="start"]');
await page.waitForTimeout(500);

// Go back to menu (refresh page)
await page.goto('http://127.0.0.1:5199/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Now click volume button
await page.click('[data-action="volume"]');
await page.waitForTimeout(1000);

// Check audio state before volume change
const audioStateBefore = await page.evaluate(() => {
  return window.__pilotAudioDebug?.();
});
console.log('Audio state BEFORE volume change:', JSON.stringify(audioStateBefore, null, 2));

// Adjust volume slider to 50%
await page.evaluate(() => {
  const slider = document.querySelector('[data-volume-slider]');
  if (slider) {
    slider.value = '50';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(500);

// Check audio state after volume change
const audioStateAfter = await page.evaluate(() => {
  return window.__pilotAudioDebug?.();
});
console.log('\nAudio state AFTER volume change to 50%:', JSON.stringify(audioStateAfter, null, 2));

// Close volume panel
await page.click('[data-action="close"]');
await page.waitForTimeout(1000);

// Check audio state after closing panel
const audioStateAfterClose = await page.evaluate(() => {
  return window.__pilotAudioDebug?.();
});
console.log('\nAudio state AFTER closing panel:', JSON.stringify(audioStateAfterClose, null, 2));

// Check localStorage
const savedVolume = await page.evaluate(() => localStorage.getItem('pilot-audio-volume'));
console.log('\nSaved volume in localStorage:', savedVolume);

// Now try to start the game and check if audio works
await page.click('[data-action="start"]');
await page.waitForTimeout(3000);

const audioStateInGame = await page.evaluate(() => {
  return window.__pilotAudioDebug?.();
});
console.log('\nAudio state IN GAME:', JSON.stringify(audioStateInGame, null, 2));

// Take screenshot
await page.screenshot({ path: resolve(outputDir, 'after-volume-adjust.png') });

console.log('\nConsole errors:', consoleErrors.length);
for (const e of consoleErrors) console.log('  ', e);

await browser.close();
