import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, { timeout: 15000 });
await page.waitForTimeout(3000);

// Check SVG via Phaser texture cache
const textures = await page.evaluate(() => {
  const games = (window.Phaser && window.Phaser.GAMES) || [];
  const g = games[0];
  if (!g || !g.textures || !g.textures.list) return { error: 'Phaser.GAMES not available' };

  const checks = [
    'preview-unit-player-core',
    'preview-enemy-standard-a',
    'preview-enemy-brute',
    'preview-enemy-skirmisher',
    'preview-enemy-ranged',
    'preview-bg-space-nebula',
    'preview-bg-floor-hex-tile',
    'preview-bg-boss-danger',
    'preview-bg-boss-core',
    'preview-elite-core-main',
    'preview-boss-bastion-main',
    'preview-boss-hunt-main',
    'preview-boss-lockdown-main',
    'preview-player-projectile-core',
    'preview-enemy-projectile-core',
    'preview-fx-hit-normal',
    'preview-fx-explosion-small',
    'preview-fx-charge-glow',
    'preview-fx-screen-flash-white',
  ];
  const results = {};
  for (const key of checks) {
    const tex = g.textures.get(key);
    results[key] = tex && tex.key === '__MISSING' ? 'missing' : tex ? 'loaded' : 'not found';
  }
  return results;
});

console.log('=== SVG 纹理加载状态 ===');
let allLoaded = true;
for (const [key, status] of Object.entries(textures)) {
  if (key === 'error') {
    console.log(`  ERROR: ${textures.error}`);
    allLoaded = false;
  } else {
    const icon = status === 'loaded' ? '✓' : '✗';
    if (status !== 'loaded') allLoaded = false;
    console.log(`  ${icon} ${key}: ${status}`);
  }
}
console.log(`\n整体: ${allLoaded ? '全部加载成功' : '部分纹理缺失'}`);

// Try to check Phaser.Cache for asset loading errors
const loadErrors = await page.evaluate(() => {
  try {
    const games = (window.Phaser && window.Phaser.GAMES) || [];
    const g = games[0];
    if (!g) return null;
    const cache = g.cache;
    const svgCache = cache?.svg?.entries;
    if (svgCache) {
      const results = {};
      for (const [key, entry] of svgCache) {
        results[key] = entry?.failed ? 'failed' : entry?.data ? 'cached' : 'pending';
      }
      return results;
    }
    return { note: 'SVG cache not accessible directly' };
  } catch {
    return { error: 'exception' };
  }
});
if (loadErrors) console.log('\nCache check:', JSON.stringify(loadErrors).slice(0, 200));

await browser.close();
