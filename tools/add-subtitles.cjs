const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ffmpeg = path.resolve('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
const inputVideo = path.resolve('展示视频无字幕版.mp4');
const outputVideo = path.resolve('展示视频字幕版.mp4');
const srtPath = path.resolve('output/subtitles.srt');

fs.mkdirSync('output', { recursive: true });

// Step 1: Probe duration
console.log('Step 1: Probing video duration...');
const probe = spawnSync(ffmpeg, ['-i', inputVideo], {
  encoding: 'utf8',
  timeout: 30000,
  stdio: ['pipe', 'pipe', 'pipe'],
});
const probeOutput = probe.stderr || probe.stdout || '';
const match = probeOutput.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2})\.(\d+)/);
if (!match) {
  console.error('Could not determine video duration!');
  process.exit(1);
}
const h = parseInt(match[1]);
const m = parseInt(match[2]);
const s = parseInt(match[3]);
const totalSec = h * 3600 + m * 60 + s;
console.log(`Duration: ${h}h ${m}m ${s}s (${totalSec}s)`);

// Step 2: Create SRT - distribute across full video
console.log('Step 2: Creating SRT subtitles...');
createSrt(totalSec);

// Step 3: Burn subtitles
console.log('Step 3: Burning subtitles into video...');
const srtEscaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
const vf = `subtitles='${srtEscaped}'`;

const args = [
  '-i', inputVideo,
  '-vf', vf,
  '-c:a', 'copy',
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '23',
  '-y',
  outputVideo,
];

const burn = spawnSync(ffmpeg, args, {
  encoding: 'utf8',
  timeout: 300000,
  stdio: ['pipe', 'pipe', 'pipe'],
  maxBuffer: 10 * 1024 * 1024,
});

console.log('Exit code:', burn.status);
if (burn.stderr) {
  console.log('Last output:', burn.stderr.slice(-300));
}

if (burn.status === 0 && fs.existsSync(outputVideo)) {
  const outSize = fs.statSync(outputVideo).size;
  console.log(`\nSuccess! Output: ${outputVideo} (${(outSize / 1024 / 1024).toFixed(1)} MB)`);
} else {
  console.error(`\nFFmpeg exited with code ${burn.status}`);
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function createSrt(totalSec) {
  // 12 segments, evenly distributed across the full video
  // Each segment gets totalSec/12 seconds
  const segments = [
    'PROJECT ORBITAL\n轨道计划 - 短局自动射击肉鸽',
    '开始作战\nWASD 移动，自动射击',
    'HUD 显示生命值、经验值、当前关卡与通关条件',
    '战斗关卡\n消灭敌人达成击杀数即可通关',
    '路线选择\n选择下一个战斗节点',
    '选择强化\n升级时选择流派强化卡牌',
    '强化节点\n获取一个流派强化，提升战斗力',
    '异常节点\n触发流派转折事件，改变战斗节奏',
    '不同敌人类型：标准、重装、游击、远程',
    '精英敌人拥有更高血量和特殊技能',
    '最终阶段\nBoss 战 — 击败金色血条首领即可通关',
    '结算页面\n显示路线节点、流派、强化记录与战斗统计',
  ];

  const segDuration = totalSec / segments.length;
  let srt = '';
  for (let i = 0; i < segments.length; i++) {
    const start = i * segDuration;
    const end = (i + 1) * segDuration;
    srt += `${i + 1}\n`;
    srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
    srt += `${segments[i]}\n\n`;
  }

  fs.writeFileSync(srtPath, '\ufeff' + srt, 'utf8');
  console.log(`SRT created: ${srtPath} (${segments.length} segments, ${segDuration.toFixed(1)}s each)`);
}
