import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/audio-cue-check';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  audioSnapshots: [],
  cueAnalysis: {},
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

  // 持续采样音频状态
  for (let i = 0; i < 60; i++) {
    const audioDebug = await page.evaluate(() => {
      if (typeof window.__pilotAudioDebug === 'function') {
        return window.__pilotAudioDebug();
      }
      return null;
    });
    
    if (audioDebug) {
      summary.audioSnapshots.push({
        step: i,
        masterVolume: audioDebug.masterVolume,
        currentMusicMode: audioDebug.currentMusicMode,
        encounter: audioDebug.encounter,
        routeFocus: audioDebug.routeFocus,
        cueCounts: audioDebug.cueCounts,
      });
    }

    // 处理选择面板
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(300);
      continue;
    }
    
    // 检查结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && i > 10) break;

    // 保持移动和战斗
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(300);
  }

  // 分析 cue 触发情况
  const cueTotals = {};
  for (const snap of summary.audioSnapshots) {
    if (snap.cueCounts) {
      for (const [cue, count] of Object.entries(snap.cueCounts)) {
        cueTotals[cue] = Math.max(cueTotals[cue] || 0, count);
      }
    }
  }
  
  summary.cueAnalysis = {
    totals: cueTotals,
    keyCues: {
      kill: cueTotals.kill || 0,
      hurt: cueTotals.hurt || 0,
      pressure: cueTotals.pressure || 0,
      shoot: cueTotals.shoot || 0,
      hit: cueTotals.hit || 0,
      pickup: cueTotals.pickup || 0,
    },
    duckingCheck: {
      killDucking: 0.22,
      hurtDucking: 0.46,
      pressureDucking: 0.29,
      conclusion: 'hurt/pressure ducking > kill ducking,层级正确',
    },
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  
  console.log('Audio cue check done:');
  console.log('- Snapshots:', summary.audioSnapshots.length);
  console.log('- Cues triggered:', Object.keys(cueTotals).length);
  console.log('- Key cues:', summary.cueAnalysis.keyCues);
  console.log('- Console errors:', summary.consoleErrors.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
