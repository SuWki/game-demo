import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(3000);

// Check textures by looking at canvas WebGL rendered images
// Also check if there were Phaser loading errors
const result = await page.evaluate(() => {
  // Access Phaser game through scene manager
  // Phaser stores game ref on the canvas
  const canvas = document.querySelector('canvas');
  const parent = canvas?.parentElement;
  
  // Check for loading errors from Phaser
  const loadErrors = [];
  const imgElements = document.querySelectorAll('img[src*="preview-runtime"]');
  imgElements.forEach(img => {
    if (img.complete && img.naturalWidth === 0) {
      loadErrors.push(`img failed: ${img.src}`);
    }
  });
  
  // Look for phaser texture cache through __pilotDebug scene access
  let textureCount = 'unknown';
  try {
    // Try accessing via Phaser internal: game.textures exists
    // But game is not exposed globally - we need another approach
    // Check if the canvas has a __phaser property
    const keys = Object.keys(canvas || {}).filter(k => k.startsWith('__'));
    return {
      canvasKeys: keys,
      imgLoadErrors: loadErrors,
      canvasW: canvas?.width,
      canvasH: canvas?.height,
      parentId: parent?.id,
    };
  } catch (e) {
    return { error: e.message };
  }
});

console.log('Canvas info:', JSON.stringify(result, null, 2));

// Now try the actual game flow to see if SVGs work for real
// We can tell by whether battle rendering works correctly
await page.click('[data-action="start"]');
await page.waitForTimeout(5000);

// Use __pilotDebug to check battle state - if textures failed, battle would be blank
const snap = await page.evaluate(() => {
  try {
    const s = window.__pilotDebug?.getSnapshot?.();
    return s ? { hasSnapshot: true, stageLabel: s.stageLabel || 'unknown' } : { hasSnapshot: false };
  } catch { return { error: 'exception' }; }
});
console.log('Battle snapshot:', JSON.stringify(snap));

// Force restart battle to verify rendering works
await page.evaluate(() => {
  window.__pilotDebug?.restartBattle?.({ templateId: 'elimination', phase: 'opening' });
});
await page.waitForTimeout(3000);
const snap2 = await page.evaluate(() => {
  try {
    const s = window.__pilotDebug?.getSnapshot?.();
    return s ? { ok: true, stageLabel: s.stageLabel } : { ok: false };
  } catch { return { error: 'exception' }; }
});
console.log('After restart:', JSON.stringify(snap2));

// Check if textures loaded by looking at Phaser's internal texture manager
// via the game's scene
const texStatus = await page.evaluate(() => {
  try {
    // Access the game through __pilotDebug internals
    const config = window.__pilotDebug?.getConfig?.();
    if (!config) return { config: null };
    
    // Try to check if phaser game is accessible from the canvas
    const canvas = document.querySelector('canvas');
    // In Phaser 3, the game instance is not stored on the canvas directly
    // But we can use __pilotBattleDebug which calls game.scene.getScene
    return { config: Object.keys(config).slice(0, 10) };
  } catch {
    return { error: 'texture check failed' };
  }
});
console.log('Config:', JSON.stringify(texStatus));

await browser.close();
