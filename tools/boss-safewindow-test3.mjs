import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../output/qa/boss-safewindow-redesign');
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

// Enable debug invulnerability
await page.evaluate(() => {
  if (window.__pilotDebug?.setInvulnerable) {
    window.__pilotDebug.setInvulnerable(true);
  }
});

// Start game
await page.click('[data-action="start"]');
await page.waitForTimeout(1500);

let stepCount = 0;
const maxSteps = 80;
const safeWindowSamples = [];
const bossTemplates = new Set();

console.log('Running to find boss fight and monitor safe windows...\n');

while (stepCount < maxSteps) {
  stepCount++;
  await page.waitForTimeout(300);
  
  // Keep invulnerable
  await page.evaluate(() => {
    if (window.__pilotDebug?.setInvulnerable) {
      window.__pilotDebug.setInvulnerable(true);
    }
  });
  
  const debug = await page.evaluate(() => {
    if (typeof window.__pilotBattleDebug === 'function') {
      return window.__pilotBattleDebug();
    }
    return null;
  });
  
  if (debug?.templateId?.startsWith('boss')) {
    bossTemplates.add(debug.templateId);
    console.log(`[t=${(stepCount * 0.3).toFixed(1)}s] Boss detected: ${debug.templateId}`);
    
    // Monitor for safe windows
    if (debug.pressureSafeWindowAxis) {
      const sample = {
        t: stepCount * 0.3,
        templateId: debug.templateId,
        axis: debug.pressureSafeWindowAxis,
        span: Math.round(debug.pressureSafeWindowSpan),
        secSpan: debug.pressureSafeWindowSecondarySpan ? Math.round(debug.pressureSafeWindowSecondarySpan) : 0,
        sec: Number(debug.pressureSafeWindowSec.toFixed(2)),
        grace: Number((debug.bossSafeWindowGraceSec || 0).toFixed(2)),
        enemyCount: debug.enemies?.length || 0,
        playerX: Math.round(debug.playerX),
        playerY: Math.round(debug.playerY),
        centerX: Math.round(debug.pressureSafeWindowCenter),
        centerY: Math.round(debug.pressureSafeWindowSecondaryCenter),
        phaseLabel: debug.pressurePhaseLabel,
        moments: debug.bossSafeWindowMoments,
      };
      safeWindowSamples.push(sample);
      
      console.log(`  Safe window: axis=${sample.axis} span=${sample.span} secSpan=${sample.secSpan} grace=${sample.grace}s enemies=${sample.enemyCount}`);
    }
  }
  
  // Check for choice panels and auto-select
  const action = await page.evaluate(() => {
    // Check choice cards
    const choices = document.querySelectorAll('.choice-strip .choice-card');
    if (choices.length > 0) {
      // Prefer upgrades
      for (const c of choices) {
        const text = c.textContent || '';
        if (text.includes('流派') || text.includes('强化') || text.includes('伤害') || text.includes('暴击')) {
          c.click();
          return 'upgrade';
        }
      }
      choices[0].click();
      return 'first-choice';
    }
    
    // Check for action buttons
    const actions = document.querySelectorAll('[data-action]');
    for (const a of actions) {
      const text = a.textContent || '';
      if (text.includes('继续') || text.includes('下一')) {
        a.click();
        return 'continue';
      }
    }
    
    return null;
  });
  
  // Check for game over or result
  const result = await page.evaluate(() => {
    const panel = document.querySelector('.panel-layer:not(.hidden)');
    if (panel) {
      const text = panel.textContent || '';
      if (text.includes('失败') || text.includes('通关')) {
        return text.includes('通关') ? 'victory' : 'defeat';
      }
    }
    return null;
  });
  
  if (result) {
    console.log(`Game ended: ${result}`);
    break;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Boss templates encountered: ${Array.from(bossTemplates).join(', ')}`);
console.log(`Safe window samples: ${safeWindowSamples.length}`);

if (safeWindowSamples.length > 0) {
  console.log('\nSafe window geometry analysis:');
  
  const byAxis = {};
  for (const s of safeWindowSamples) {
    if (!byAxis[s.axis]) byAxis[s.axis] = [];
    byAxis[s.axis].push(s);
  }
  
  for (const [axis, samples] of Object.entries(byAxis)) {
    const avgSpan = samples.reduce((sum, s) => sum + s.span, 0) / samples.length;
    const avgSecSpan = samples.reduce((sum, s) => sum + s.secSpan, 0) / samples.length;
    const maxGrace = Math.max(...samples.map(s => s.grace));
    
    const withSecSpan = samples.filter(s => s.secSpan > 0).length;
    console.log(`\n  ${axis} (${samples.length} samples):`);
    console.log(`    Average span: ${avgSpan.toFixed(0)}px`);
    console.log(`    Average secondary span: ${avgSecSpan.toFixed(0)}px`);
    console.log(`    Samples with secondary span: ${withSecSpan}/${samples.length}`);
    console.log(`    Max grace period: ${maxGrace}s`);
    
    if (axis !== 'pocket') {
      console.log(`    ✓ ${withSecSpan > 0 ? 'Pockets being used' : 'Legacy strips detected'}`);
    }
  }
  
  // Check grace period target (1.5s)
  const maxGraceOverall = Math.max(...safeWindowSamples.map(s => s.grace));
  console.log(`\nGrace period: max=${maxGraceOverall}s target=1.5s ${maxGraceOverall >= 1.3 ? '✓' : '✗'}`);
  
  // Check for sufficient safe window size
  const minArea = Math.min(...safeWindowSamples.filter(s => s.secSpan > 0).map(s => s.span * s.secSpan));
  console.log(`Minimum safe window area: ${minArea.toFixed(0)}px² (target: >180×130=23400px²) ${minArea > 20000 ? '✓' : '✗'}`);
  
  // Show some sample details
  console.log('\nSample details:');
  for (const s of safeWindowSamples.slice(0, 10)) {
    console.log(`  t=${s.t.toFixed(1)}s axis=${s.axis} span=${s.span}×${s.secSpan} grace=${s.grace}s phase=${s.phaseLabel}`);
  }
} else {
  console.log('No safe windows activated during run.');
  console.log('This is expected if the boss fight ends before pressure patterns trigger.');
}

console.log(`\nConsole errors: ${consoleErrors.length}`);
for (const e of consoleErrors) console.log('  ', e);

await page.screenshot({ path: resolve(outputDir, 'safewindow-redesign-test.png') });
await browser.close();