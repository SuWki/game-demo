import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/directed-boss';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  bossSnapshots: [],
  eliteSnapshots: [],
};

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => {
    if (message.type() === 'error') summary.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => summary.consoleErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1200);

  // 强制开启无敌和Boss调试，快速推进到Boss
  await page.evaluate(() => {
    if (window.__pilotDebug) {
      window.__pilotDebug.setInvulnerable?.(true);
    }
  });

  // 疯狂点击第一个选择，快速推进
  for (let step = 0; step < 30; step++) {
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(300);
      continue;
    }
    
    // 移动一下保持战斗进行
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);

    // 采样
    const debug = await page.evaluate(() => {
      if (typeof window.__pilotBattleDebug === 'function') {
        return window.__pilotBattleDebug();
      }
      return null;
    });
    if (debug) {
      const snap = {
        step,
        templateId: debug.templateId,
        eliteAlive: debug.eliteAlive,
        eliteBehavior: debug.eliteBehavior,
        pressurePhaseLabel: debug.pressurePhaseLabel,
        bossFirelineCoverage: debug.bossFirelineCoverage,
        bossSafeWindowMoments: debug.bossSafeWindowMoments,
      };
      if (debug.templateId && debug.templateId.startsWith('boss')) {
        summary.bossSnapshots.push(snap);
      } else if (debug.templateId && debug.templateId.startsWith('elite')) {
        summary.eliteSnapshots.push(snap);
      }
    }

    // 检查是否到结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && step > 8) break;
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log('Directed boss check done. Boss snaps:', summary.bossSnapshots.length, 'Elite snaps:', summary.eliteSnapshots.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
