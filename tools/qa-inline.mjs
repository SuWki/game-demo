import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4187;
const URL = `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = 'output/qa/inline-check';

const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((c) => fs.existsSync(c));

const summary = {
  url: URL,
  consoleErrors: [],
  panelsSeen: 0,
  resultSeen: false,
  replaySeen: false,
};

function normalize(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

async function clickFirstChoice(page) {
  const choice = page.locator('[data-choice]').first();
  if ((await choice.count()) === 0) return false;
  summary.panelsSeen += 1;
  await choice.click();
  await page.waitForTimeout(420); // Wait for flash animation (350ms + margin)
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
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-menu.png'), fullPage: true });
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1000);

  for (let step = 0; step < 70; step += 1) {
    if ((await page.locator('[data-action="restart"]').count()) > 0) break;
    if (await clickFirstChoice(page)) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, `panel-${String(step + 1).padStart(2, '0')}.png`), fullPage: true });
      continue;
    }
    if (step === 2) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, '02-battle-opening.png'), fullPage: true });
    }
    await movePattern(page);
  }

  await page.waitForTimeout(1000);
  summary.resultSeen = (await page.locator('[data-action="restart"]').count()) > 0;
  if (summary.resultSeen) {
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-result.png'), fullPage: true });
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Start dev server
  console.log('[QA] Starting dev server...');
  const server = spawn('npx', ['vite', '--port', String(PORT), '--host'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PATH: process.env.PATH },
  });

  server.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[vite] ${text}`);
  });
  server.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.error(`[vite] ${text}`);
  });

  try {
    console.log('[QA] Waiting for server to be ready...');
    const ready = await waitForServer(URL);
    if (!ready) {
      throw new Error(`Server did not start at ${URL} within 15s`);
    }
    console.log('[QA] Server is ready. Launching browser...');

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

    const screenText = await page.locator('body').textContent().catch(() => '');
    summary.finalScreenText = normalize(screenText).slice(0, 300);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
    await browser.close();
  } finally {
    console.log('[QA] Shutting down dev server...');
    server.kill();
  }

  console.log('\n[QA] Summary:');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.consoleErrors.length > 0) {
    console.error(`[QA] FAILED: ${summary.consoleErrors.length} console errors`);
    process.exit(1);
  }
  if (!summary.resultSeen) {
    console.error('[QA] FAILED: result screen not seen');
    process.exit(1);
  }
  console.log('[QA] PASSED: No console errors, result screen seen');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
