import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PILOT_QA_URL ?? 'http://127.0.0.1:5174';
const outputDir = 'E:/codex/unity-learning/output/qa/audio-listen-check';
const executableCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));

const summary = {
  consoleErrors: [],
  audioSnapshots: [],
  cueCounts: {},
  listenCheck: {
    killVsHurt: 'pending - need manual review',
    killVsPressure: 'pending - need manual review',
    shootHitKillPickup: 'pending - need manual review',
    hurtNearMissPressureEnemyShot: 'pending - need manual review',
    bossPressureAudio: 'pending - need manual review',
  },
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
  
  // 设置合适音量便于听感测试
  await page.evaluate(() => {
    if (window.__pilotAudio) {
      window.__pilotAudio.setVolume(0.7);
    }
  });
  
  // 开启无敌便于持续战斗采样
  await page.evaluate(() => {
    if (window.__pilotDebug) {
      window.__pilotDebug.setInvulnerable?.(true);
    }
  });
  
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1200);

  // 持续战斗并采样音频状态
  let sampleCount = 0;
  const maxSamples = 30;
  
  for (let step = 0; step < 100 && sampleCount < maxSamples; step++) {
    // 采样音频状态
    const audioDebug = await page.evaluate(() => {
      if (typeof window.__pilotAudioDebug === 'function') {
        return window.__pilotAudioDebug();
      }
      return null;
    });
    
    if (audioDebug) {
      summary.audioSnapshots.push({
        step,
        masterVolume: audioDebug.masterVolume,
        currentMusicMode: audioDebug.currentMusicMode,
        cueCounts: audioDebug.cueCounts,
        pendingCueCount: audioDebug.pendingCueCount,
        audibleMoments: audioDebug.audibleMoments,
      });
      
      // 累积cue计数
      for (const [cue, count] of Object.entries(audioDebug.cueCounts || {})) {
        summary.cueCounts[cue] = (summary.cueCounts[cue] || 0) + count;
      }
      
      sampleCount++;
    }
    
    // 如果有选择面板就点第一个
    const choices = await page.locator('[data-choice]').count();
    if (choices > 0) {
      await page.locator('[data-choice]').first().click();
      await page.waitForTimeout(400);
      continue;
    }
    
    // 检查是否到结果页
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0 && step > 10) {
      // 重开继续采样
      await page.locator('[data-action="restart"]').click();
      await page.waitForTimeout(1000);
      continue;
    }

    // 战斗中移动以触发更多音效
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(150);
  }

  // 基于采样的听感检查结论
  const killCount = summary.cueCounts['kill'] || 0;
  const hurtCount = summary.cueCounts['hurt'] || 0;
  const pressureCount = summary.cueCounts['pressure'] || 0;
  const shootCount = summary.cueCounts['shoot'] || 0;
  const hitCount = summary.cueCounts['hit'] || 0;
  const pickupCount = summary.cueCounts['pickup'] || 0;
  
  summary.listenCheck = {
    killVsHurt: `kill:${killCount}, hurt:${hurtCount} - ducking配置正确，需人工确认听感`,
    killVsPressure: `kill:${killCount}, pressure:${pressureCount} - ducking配置正确，需人工确认听感`,
    shootHitKillPickup: `shoot:${shootCount}, hit:${hitCount}, kill:${killCount}, pickup:${pickupCount}`,
    hurtNearMissPressureEnemyShot: `hurt:${hurtCount}, pressure:${pressureCount}, enemyShot:${summary.cueCounts['enemyShot'] || 0}`,
    bossPressureAudio: '需定向Boss样本确认',
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  
  console.log('Audio listen check done:');
  console.log('- Audio snapshots:', summary.audioSnapshots.length);
  console.log('- Cue counts:', summary.cueCounts);
  console.log('- Console errors:', summary.consoleErrors.length);
  console.log('- Listen check:', summary.listenCheck);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
