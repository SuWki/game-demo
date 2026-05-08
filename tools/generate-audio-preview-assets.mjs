import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 48000;
const MASTER_GAIN = 0.9;

const root = process.cwd();
const outDir = path.join(root, 'public', 'assets', 'preview-runtime', 'audio');
const mirrorDir = path.join(root, 'output', 'asset-preview', 'audio');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(mirrorDir, { recursive: true });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function createStereoBuffer(durationSec) {
  const length = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
  return {
    sampleRate: SAMPLE_RATE,
    left: new Float32Array(length),
    right: new Float32Array(length),
  };
}

function addSample(buffer, index, value, pan = 0) {
  if (index < 0 || index >= buffer.left.length) {
    return;
  }
  const leftGain = Math.sqrt((1 - clamp(pan, -1, 1)) * 0.5);
  const rightGain = Math.sqrt((1 + clamp(pan, -1, 1)) * 0.5);
  buffer.left[index] += value * leftGain;
  buffer.right[index] += value * rightGain;
}

function applySoftClip(buffer, gain = MASTER_GAIN) {
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] = Math.tanh(buffer.left[i] * gain);
    buffer.right[i] = Math.tanh(buffer.right[i] * gain);
  }
}

function addTone(buffer, options) {
  const {
    startSec = 0,
    durationSec,
    frequency,
    endFrequency = frequency,
    amplitude = 0.3,
    pan = 0,
    waveform = 'sine',
    attackSec = 0.005,
    decaySec = 0.04,
    sustain = 0.65,
    releaseSec = 0.04,
    vibratoHz = 0,
    vibratoDepth = 0,
    phaseOffset = 0,
  } = options;

  const startIndex = Math.floor(startSec * SAMPLE_RATE);
  const sampleCount = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
  const attack = Math.max(1, Math.floor(attackSec * SAMPLE_RATE));
  const decay = Math.max(1, Math.floor(decaySec * SAMPLE_RATE));
  const release = Math.max(1, Math.floor(releaseSec * SAMPLE_RATE));

  let phase = phaseOffset;
  for (let localIndex = 0; localIndex < sampleCount; localIndex += 1) {
    const t = localIndex / sampleCount;
    const globalIndex = startIndex + localIndex;
    if (globalIndex >= buffer.left.length) {
      break;
    }

    const currentFrequency = frequency + (endFrequency - frequency) * t;
    const vibrato = vibratoHz > 0 ? Math.sin((Math.PI * 2 * vibratoHz * localIndex) / SAMPLE_RATE) * vibratoDepth : 0;
    const step = (Math.PI * 2 * (currentFrequency + vibrato)) / SAMPLE_RATE;
    phase += step;

    let wave = 0;
    switch (waveform) {
      case 'triangle':
        wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case 'square':
        wave = Math.sign(Math.sin(phase)) || 1;
        break;
      case 'saw':
        wave = 2 * ((phase / (Math.PI * 2)) % 1) - 1;
        break;
      case 'noise':
        wave = Math.random() * 2 - 1;
        break;
      default:
        wave = Math.sin(phase);
        break;
    }

    let env = sustain;
    if (localIndex < attack) {
      env = localIndex / attack;
    } else if (localIndex < attack + decay) {
      const decayT = (localIndex - attack) / decay;
      env = 1 - (1 - sustain) * decayT;
    } else if (localIndex > sampleCount - release) {
      env = sustain * ((sampleCount - localIndex) / release);
    }

    addSample(buffer, globalIndex, wave * amplitude * env, pan);
  }
}

function addNoiseBurst(buffer, options) {
  const {
    startSec = 0,
    durationSec,
    amplitude = 0.2,
    pan = 0,
    tone = 0.5,
    attackSec = 0.002,
    releaseSec = 0.03,
  } = options;
  const startIndex = Math.floor(startSec * SAMPLE_RATE);
  const sampleCount = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
  const attack = Math.max(1, Math.floor(attackSec * SAMPLE_RATE));
  const release = Math.max(1, Math.floor(releaseSec * SAMPLE_RATE));

  let smooth = 0;
  for (let localIndex = 0; localIndex < sampleCount; localIndex += 1) {
    const globalIndex = startIndex + localIndex;
    if (globalIndex >= buffer.left.length) {
      break;
    }
    const white = Math.random() * 2 - 1;
    smooth = smooth * tone + white * (1 - tone);

    let env = 1;
    if (localIndex < attack) {
      env = localIndex / attack;
    } else if (localIndex > sampleCount - release) {
      env = (sampleCount - localIndex) / release;
    }

    addSample(buffer, globalIndex, smooth * amplitude * env, pan);
  }
}

function addRepeater(buffer, options) {
  const {
    startSec = 0,
    repeats = 3,
    gapSec = 0.03,
    build,
  } = options;
  for (let i = 0; i < repeats; i += 1) {
    build(startSec + i * gapSec, i, repeats);
  }
}

function normalize(buffer, peak = 0.96) {
  let maxAmp = 0;
  for (let i = 0; i < buffer.left.length; i += 1) {
    maxAmp = Math.max(maxAmp, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
  }
  if (maxAmp <= 0) {
    return;
  }
  const gain = peak / maxAmp;
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] *= gain;
    buffer.right[i] *= gain;
  }
}

function writeWav(filePath, buffer) {
  const channelCount = 2;
  const bitsPerSample = 16;
  const blockAlign = channelCount * (bitsPerSample / 8);
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = buffer.left.length * blockAlign;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channelCount, 22);
  wav.writeUInt32LE(buffer.sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < buffer.left.length; i += 1) {
    const left = Math.round(clamp(buffer.left[i], -1, 1) * 32767);
    const right = Math.round(clamp(buffer.right[i], -1, 1) * 32767);
    wav.writeInt16LE(left, offset);
    wav.writeInt16LE(right, offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filePath, wav);
}

function createUiClick() {
  const b = createStereoBuffer(0.08);
  addTone(b, { durationSec: 0.045, frequency: 1480, endFrequency: 980, amplitude: 0.28, waveform: 'triangle', sustain: 0.25, releaseSec: 0.02 });
  addTone(b, { startSec: 0.004, durationSec: 0.028, frequency: 2200, endFrequency: 1800, amplitude: 0.1, waveform: 'square', sustain: 0.18, releaseSec: 0.018 });
  normalize(b);
  applySoftClip(b, 0.92);
  return b;
}

function createUiConfirm() {
  const b = createStereoBuffer(0.18);
  addTone(b, { durationSec: 0.11, frequency: 620, endFrequency: 860, amplitude: 0.22, waveform: 'triangle', sustain: 0.45, releaseSec: 0.05 });
  addTone(b, { startSec: 0.018, durationSec: 0.11, frequency: 930, endFrequency: 1240, amplitude: 0.16, waveform: 'sine', sustain: 0.4, releaseSec: 0.06 });
  addNoiseBurst(b, { durationSec: 0.032, amplitude: 0.03, tone: 0.82 });
  normalize(b);
  applySoftClip(b, 0.9);
  return b;
}

function createUiStart() {
  const b = createStereoBuffer(1.02);
  addTone(b, { durationSec: 0.58, frequency: 86, endFrequency: 132, amplitude: 0.16, waveform: 'saw', sustain: 0.72, releaseSec: 0.12 });
  addTone(b, { startSec: 0.08, durationSec: 0.42, frequency: 260, endFrequency: 520, amplitude: 0.12, waveform: 'triangle', sustain: 0.54, releaseSec: 0.1 });
  addRepeater(b, {
    startSec: 0.14,
    repeats: 4,
    gapSec: 0.12,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.09, frequency: 920 + i * 90, endFrequency: 1220 + i * 110, amplitude: 0.09, waveform: 'square', sustain: 0.18, releaseSec: 0.05, pan: -0.15 + i * 0.1 });
    },
  });
  addNoiseBurst(b, { startSec: 0.03, durationSec: 0.24, amplitude: 0.045, tone: 0.9 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createUiHover() {
  const b = createStereoBuffer(0.09);
  addTone(b, { durationSec: 0.05, frequency: 980, endFrequency: 860, amplitude: 0.09, waveform: 'sine', sustain: 0.18, releaseSec: 0.025 });
  addTone(b, { startSec: 0.008, durationSec: 0.038, frequency: 680, endFrequency: 760, amplitude: 0.035, waveform: 'triangle', sustain: 0.16, releaseSec: 0.02 });
  normalize(b);
  applySoftClip(b, 0.8);
  return b;
}

function createUiResume() {
  const b = createStereoBuffer(0.22);
  addNoiseBurst(b, { durationSec: 0.06, amplitude: 0.012, tone: 0.96, pan: -0.12 });
  addTone(b, { durationSec: 0.12, frequency: 300, endFrequency: 440, amplitude: 0.11, waveform: 'triangle', sustain: 0.24, releaseSec: 0.05 });
  addTone(b, { startSec: 0.018, durationSec: 0.1, frequency: 580, endFrequency: 760, amplitude: 0.05, waveform: 'sine', sustain: 0.2, releaseSec: 0.05, pan: 0.1 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createUiUpgrade() {
  const b = createStereoBuffer(0.55);
  [57, 64, 69, 76].forEach((midi, i) => {
    addTone(b, {
      startSec: i * 0.05,
      durationSec: 0.18,
      frequency: midiToHz(midi),
      endFrequency: midiToHz(midi + 2),
      amplitude: 0.14 - i * 0.012,
      waveform: i % 2 === 0 ? 'triangle' : 'sine',
      sustain: 0.38,
      releaseSec: 0.08,
      pan: -0.2 + i * 0.13,
    });
  });
  addNoiseBurst(b, { startSec: 0.06, durationSec: 0.07, amplitude: 0.03, tone: 0.86 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createUpgradeEquipped() {
  const b = createStereoBuffer(0.42);
  addTone(b, { durationSec: 0.08, frequency: 210, endFrequency: 180, amplitude: 0.12, waveform: 'triangle', sustain: 0.26, releaseSec: 0.04 });
  addNoiseBurst(b, { startSec: 0.002, durationSec: 0.02, amplitude: 0.012, tone: 0.9 });
  addTone(b, { startSec: 0.03, durationSec: 0.16, frequency: 560, endFrequency: 760, amplitude: 0.08, waveform: 'triangle', sustain: 0.22, releaseSec: 0.07 });
  addTone(b, { startSec: 0.055, durationSec: 0.14, frequency: 840, endFrequency: 1080, amplitude: 0.04, waveform: 'sine', sustain: 0.16, releaseSec: 0.06, pan: 0.12 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createUiAnomaly() {
  const b = createStereoBuffer(0.78);
  addTone(b, { durationSec: 0.42, frequency: 230, endFrequency: 190, amplitude: 0.12, waveform: 'saw', sustain: 0.68, releaseSec: 0.16, vibratoHz: 8, vibratoDepth: 12 });
  addTone(b, { startSec: 0.04, durationSec: 0.38, frequency: 690, endFrequency: 520, amplitude: 0.11, waveform: 'triangle', sustain: 0.34, releaseSec: 0.1, vibratoHz: 11, vibratoDepth: 28, pan: -0.3 });
  addTone(b, { startSec: 0.08, durationSec: 0.32, frequency: 1020, endFrequency: 880, amplitude: 0.09, waveform: 'square', sustain: 0.22, releaseSec: 0.08, pan: 0.28 });
  addNoiseBurst(b, { durationSec: 0.2, amplitude: 0.038, tone: 0.72 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createAbilityReady() {
  const b = createStereoBuffer(0.24);
  addTone(b, { durationSec: 0.08, frequency: 520, endFrequency: 700, amplitude: 0.1, waveform: 'triangle', sustain: 0.18, releaseSec: 0.04 });
  addTone(b, { startSec: 0.018, durationSec: 0.09, frequency: 760, endFrequency: 980, amplitude: 0.05, waveform: 'sine', sustain: 0.14, releaseSec: 0.05 });
  addTone(b, { startSec: 0.034, durationSec: 0.06, frequency: 1180, endFrequency: 1320, amplitude: 0.018, waveform: 'sine', sustain: 0.12, releaseSec: 0.03 });
  normalize(b);
  applySoftClip(b, 0.82);
  return b;
}

function createCooldownBlocked() {
  const b = createStereoBuffer(0.16);
  addTone(b, { durationSec: 0.07, frequency: 180, endFrequency: 140, amplitude: 0.11, waveform: 'triangle', sustain: 0.22, releaseSec: 0.04 });
  addNoiseBurst(b, { startSec: 0.004, durationSec: 0.018, amplitude: 0.008, tone: 0.94 });
  addTone(b, { startSec: 0.012, durationSec: 0.05, frequency: 420, endFrequency: 300, amplitude: 0.03, waveform: 'sine', sustain: 0.18, releaseSec: 0.03 });
  normalize(b);
  applySoftClip(b, 0.8);
  return b;
}

function createBossAlert() {
  const b = createStereoBuffer(1.62);
  addTone(b, { durationSec: 0.8, frequency: 72, endFrequency: 58, amplitude: 0.19, waveform: 'saw', sustain: 0.8, releaseSec: 0.22 });
  addRepeater(b, {
    startSec: 0.08,
    repeats: 3,
    gapSec: 0.36,
    build: (time) => {
      addTone(b, { startSec: time, durationSec: 0.19, frequency: 420, endFrequency: 560, amplitude: 0.15, waveform: 'square', sustain: 0.28, releaseSec: 0.08 });
      addTone(b, { startSec: time + 0.03, durationSec: 0.21, frequency: 840, endFrequency: 720, amplitude: 0.08, waveform: 'triangle', sustain: 0.22, releaseSec: 0.08, pan: 0.1 });
    },
  });
  addNoiseBurst(b, { startSec: 0.02, durationSec: 0.5, amplitude: 0.035, tone: 0.88 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createMoveLoop() {
  const b = createStereoBuffer(2.0);
  addTone(b, { durationSec: 2.0, frequency: 74, endFrequency: 80, amplitude: 0.09, waveform: 'triangle', sustain: 0.72, releaseSec: 0.12, vibratoHz: 0.5, vibratoDepth: 2 });
  addTone(b, { durationSec: 2.0, frequency: 132, endFrequency: 126, amplitude: 0.04, waveform: 'sine', sustain: 0.68, releaseSec: 0.12, vibratoHz: 0.8, vibratoDepth: 3, pan: -0.08 });
  addNoiseBurst(b, { startSec: 0.08, durationSec: 1.84, amplitude: 0.01, tone: 0.995, pan: 0.1 });
  normalize(b, 0.82);
  applySoftClip(b, 0.72);
  return b;
}

function createShoot() {
  const b = createStereoBuffer(0.12);
  addTone(b, { durationSec: 0.06, frequency: 760, endFrequency: 600, amplitude: 0.14, waveform: 'triangle', sustain: 0.28, releaseSec: 0.03 });
  addTone(b, { startSec: 0.006, durationSec: 0.065, frequency: 1120, endFrequency: 920, amplitude: 0.055, waveform: 'sine', sustain: 0.18, releaseSec: 0.03 });
  addNoiseBurst(b, { startSec: 0.002, durationSec: 0.016, amplitude: 0.008, tone: 0.9 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createDash() {
  const b = createStereoBuffer(0.28);
  addNoiseBurst(b, { durationSec: 0.18, amplitude: 0.05, tone: 0.92, pan: -0.15 });
  addTone(b, { durationSec: 0.16, frequency: 220, endFrequency: 620, amplitude: 0.18, waveform: 'triangle', sustain: 0.26, releaseSec: 0.05, pan: 0.08 });
  addTone(b, { startSec: 0.05, durationSec: 0.12, frequency: 840, endFrequency: 510, amplitude: 0.07, waveform: 'sine', sustain: 0.25, releaseSec: 0.04 });
  normalize(b);
  applySoftClip(b, 0.9);
  return b;
}

function createHit() {
  const b = createStereoBuffer(0.13);
  addTone(b, { durationSec: 0.055, frequency: 190, endFrequency: 145, amplitude: 0.14, waveform: 'triangle', sustain: 0.24, releaseSec: 0.03 });
  addTone(b, { startSec: 0.01, durationSec: 0.06, frequency: 520, endFrequency: 390, amplitude: 0.075, waveform: 'sine', sustain: 0.18, releaseSec: 0.03 });
  addNoiseBurst(b, { durationSec: 0.02, amplitude: 0.012, tone: 0.86 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createPierceHit() {
  const b = createStereoBuffer(0.2);
  addTone(b, { durationSec: 0.07, frequency: 1420, endFrequency: 1120, amplitude: 0.1, waveform: 'sine', sustain: 0.16, releaseSec: 0.03, pan: 0.05 });
  addNoiseBurst(b, { durationSec: 0.028, amplitude: 0.014, tone: 0.76, pan: 0.06 });
  addRepeater(b, {
    startSec: 0.055,
    repeats: 3,
    gapSec: 0.026,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.06, frequency: 760 - i * 50, endFrequency: 520 - i * 20, amplitude: 0.045 - i * 0.007, waveform: 'sine', sustain: 0.25, releaseSec: 0.03, pan: -0.25 + i * 0.2 });
    },
  });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createDashHit() {
  const b = createStereoBuffer(0.19);
  addTone(b, { durationSec: 0.09, frequency: 160, endFrequency: 122, amplitude: 0.15, waveform: 'triangle', sustain: 0.28, releaseSec: 0.04 });
  addNoiseBurst(b, { startSec: 0.01, durationSec: 0.04, amplitude: 0.016, tone: 0.9, pan: -0.08 });
  addTone(b, { startSec: 0.016, durationSec: 0.08, frequency: 720, endFrequency: 500, amplitude: 0.055, waveform: 'sine', sustain: 0.2, releaseSec: 0.04, pan: 0.08 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createCritSplash() {
  const b = createStereoBuffer(0.42);
  addTone(b, { durationSec: 0.11, frequency: 260, endFrequency: 480, amplitude: 0.16, waveform: 'triangle', sustain: 0.28, releaseSec: 0.06 });
  addNoiseBurst(b, { durationSec: 0.11, amplitude: 0.04, tone: 0.8 });
  addRepeater(b, {
    startSec: 0.07,
    repeats: 4,
    gapSec: 0.045,
    build: (time, i, total) => {
      const pan = -0.45 + (i / Math.max(1, total - 1)) * 0.9;
      addTone(b, { startSec: time, durationSec: 0.14, frequency: 720 + i * 130, endFrequency: 1180 + i * 120, amplitude: 0.07 - i * 0.009, waveform: 'sine', sustain: 0.18, releaseSec: 0.08, pan });
    },
  });
  normalize(b);
  applySoftClip(b, 0.9);
  return b;
}

function createPierceEcho() {
  const b = createStereoBuffer(0.62);
  addRepeater(b, {
    startSec: 0.01,
    repeats: 5,
    gapSec: 0.07,
    build: (time, i) => {
      const decay = 1 - i * 0.14;
      addTone(b, { startSec: time, durationSec: 0.12, frequency: 1320 - i * 70, endFrequency: 980 - i * 55, amplitude: 0.09 * decay, waveform: 'triangle', sustain: 0.2, releaseSec: 0.07, pan: i % 2 === 0 ? -0.25 : 0.25 });
      addNoiseBurst(b, { startSec: time, durationSec: 0.03, amplitude: 0.018 * decay, tone: 0.68, pan: i % 2 === 0 ? -0.18 : 0.18 });
    },
  });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createDashPulse() {
  const b = createStereoBuffer(0.34);
  addTone(b, { durationSec: 0.18, frequency: 146, endFrequency: 92, amplitude: 0.16, waveform: 'triangle', sustain: 0.36, releaseSec: 0.08 });
  addRepeater(b, {
    startSec: 0.035,
    repeats: 3,
    gapSec: 0.05,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.11, frequency: 500 + i * 80, endFrequency: 360 + i * 40, amplitude: 0.05 - i * 0.009, waveform: 'sine', sustain: 0.2, releaseSec: 0.05, pan: -0.25 + i * 0.25 });
    },
  });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createHurt() {
  const b = createStereoBuffer(0.24);
  addTone(b, { durationSec: 0.12, frequency: 176, endFrequency: 108, amplitude: 0.2, waveform: 'saw', sustain: 0.3, releaseSec: 0.07 });
  addTone(b, { startSec: 0.01, durationSec: 0.1, frequency: 980, endFrequency: 620, amplitude: 0.08, waveform: 'square', sustain: 0.14, releaseSec: 0.04 });
  addNoiseBurst(b, { durationSec: 0.07, amplitude: 0.045, tone: 0.72 });
  normalize(b);
  applySoftClip(b, 0.94);
  return b;
}

function createKill() {
  const b = createStereoBuffer(0.38);
  addTone(b, { durationSec: 0.1, frequency: 260, endFrequency: 440, amplitude: 0.16, waveform: 'triangle', sustain: 0.22, releaseSec: 0.05 });
  addTone(b, { startSec: 0.018, durationSec: 0.14, frequency: 680, endFrequency: 1020, amplitude: 0.1, waveform: 'sine', sustain: 0.2, releaseSec: 0.08 });
  addNoiseBurst(b, { durationSec: 0.08, amplitude: 0.034, tone: 0.78 });
  addRepeater(b, {
    startSec: 0.08,
    repeats: 3,
    gapSec: 0.06,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.1, frequency: 820 + i * 120, endFrequency: 620 + i * 70, amplitude: 0.045 - i * 0.008, waveform: 'triangle', sustain: 0.18, releaseSec: 0.06, pan: -0.2 + i * 0.2 });
    },
  });
  normalize(b);
  applySoftClip(b, 0.9);
  return b;
}

function createPickup() {
  const b = createStereoBuffer(0.18);
  addTone(b, { durationSec: 0.1, frequency: 620, endFrequency: 980, amplitude: 0.15, waveform: 'triangle', sustain: 0.26, releaseSec: 0.05 });
  addTone(b, { startSec: 0.026, durationSec: 0.09, frequency: 980, endFrequency: 1320, amplitude: 0.07, waveform: 'sine', sustain: 0.18, releaseSec: 0.04 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createCrit() {
  const b = createStereoBuffer(0.26);
  addTone(b, { durationSec: 0.11, frequency: 820, endFrequency: 1120, amplitude: 0.11, waveform: 'triangle', sustain: 0.18, releaseSec: 0.05 });
  addTone(b, { startSec: 0.016, durationSec: 0.12, frequency: 1120, endFrequency: 1420, amplitude: 0.065, waveform: 'sine', sustain: 0.18, releaseSec: 0.06 });
  addTone(b, { startSec: 0.025, durationSec: 0.09, frequency: 300, endFrequency: 500, amplitude: 0.045, waveform: 'triangle', sustain: 0.18, releaseSec: 0.04 });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createEnemyShot() {
  const b = createStereoBuffer(0.15);
  addTone(b, { durationSec: 0.075, frequency: 520, endFrequency: 390, amplitude: 0.12, waveform: 'triangle', sustain: 0.24, releaseSec: 0.04 });
  addTone(b, { startSec: 0.008, durationSec: 0.08, frequency: 320, endFrequency: 240, amplitude: 0.065, waveform: 'sine', sustain: 0.26, releaseSec: 0.04 });
  addNoiseBurst(b, { durationSec: 0.022, amplitude: 0.01, tone: 0.9 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createNearMiss() {
  const b = createStereoBuffer(0.14);
  addNoiseBurst(b, { durationSec: 0.08, amplitude: 0.022, tone: 0.96, pan: 0.3 });
  addTone(b, { durationSec: 0.08, frequency: 860, endFrequency: 1180, amplitude: 0.045, waveform: 'sine', sustain: 0.16, releaseSec: 0.03, pan: 0.2 });
  normalize(b);
  applySoftClip(b, 0.82);
  return b;
}

function createRelayStandard() {
  const b = createStereoBuffer(0.32);
  addTone(b, { durationSec: 0.16, frequency: 240, endFrequency: 320, amplitude: 0.11, waveform: 'triangle', sustain: 0.34, releaseSec: 0.06 });
  addTone(b, { startSec: 0.03, durationSec: 0.12, frequency: 680, endFrequency: 860, amplitude: 0.05, waveform: 'sine', sustain: 0.2, releaseSec: 0.05 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createRelaySkirmisher() {
  const b = createStereoBuffer(0.24);
  addNoiseBurst(b, { durationSec: 0.06, amplitude: 0.016, tone: 0.92, pan: -0.18 });
  addTone(b, { durationSec: 0.12, frequency: 640, endFrequency: 920, amplitude: 0.075, waveform: 'triangle', sustain: 0.2, releaseSec: 0.05, pan: 0.12 });
  addTone(b, { startSec: 0.03, durationSec: 0.08, frequency: 980, endFrequency: 820, amplitude: 0.028, waveform: 'sine', sustain: 0.16, releaseSec: 0.03 });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createRelayBrute() {
  const b = createStereoBuffer(0.42);
  addTone(b, { durationSec: 0.24, frequency: 110, endFrequency: 82, amplitude: 0.19, waveform: 'saw', sustain: 0.42, releaseSec: 0.08 });
  addTone(b, { startSec: 0.03, durationSec: 0.14, frequency: 260, endFrequency: 210, amplitude: 0.08, waveform: 'triangle', sustain: 0.3, releaseSec: 0.05 });
  addNoiseBurst(b, { startSec: 0.02, durationSec: 0.08, amplitude: 0.022, tone: 0.84 });
  normalize(b);
  applySoftClip(b, 0.92);
  return b;
}

function createRelayRanged() {
  const b = createStereoBuffer(0.28);
  addTone(b, { durationSec: 0.16, frequency: 460, endFrequency: 780, amplitude: 0.11, waveform: 'triangle', sustain: 0.24, releaseSec: 0.06 });
  addTone(b, { startSec: 0.02, durationSec: 0.13, frequency: 980, endFrequency: 900, amplitude: 0.05, waveform: 'square', sustain: 0.16, releaseSec: 0.04, pan: 0.18 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createPressure() {
  const b = createStereoBuffer(0.72);
  addTone(b, { durationSec: 0.46, frequency: 92, endFrequency: 78, amplitude: 0.18, waveform: 'triangle', sustain: 0.76, releaseSec: 0.18 });
  addRepeater(b, {
    startSec: 0.03,
    repeats: 3,
    gapSec: 0.16,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.11, frequency: 160 - i * 8, endFrequency: 120 - i * 8, amplitude: 0.055 - i * 0.008, waveform: 'sine', sustain: 0.3, releaseSec: 0.05 });
    },
  });
  addNoiseBurst(b, { startSec: 0.05, durationSec: 0.16, amplitude: 0.012, tone: 0.96 });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createLowHpWarning() {
  const b = createStereoBuffer(0.92);
  addRepeater(b, {
    startSec: 0.02,
    repeats: 2,
    gapSec: 0.34,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.12, frequency: 220 - i * 10, endFrequency: 190 - i * 10, amplitude: 0.09, waveform: 'triangle', sustain: 0.26, releaseSec: 0.05 });
      addTone(b, { startSec: time + 0.025, durationSec: 0.09, frequency: 420 - i * 18, endFrequency: 360 - i * 16, amplitude: 0.04, waveform: 'sine', sustain: 0.18, releaseSec: 0.04 });
    },
  });
  addTone(b, { startSec: 0.0, durationSec: 0.92, frequency: 68, endFrequency: 64, amplitude: 0.025, waveform: 'sine', sustain: 0.7, releaseSec: 0.08 });
  normalize(b);
  applySoftClip(b, 0.8);
  return b;
}

function createRouteMatured() {
  const b = createStereoBuffer(0.82);
  [55, 60, 64, 67].forEach((midi, i) => {
    addTone(b, {
      startSec: i * 0.045,
      durationSec: 0.22,
      frequency: midiToHz(midi),
      endFrequency: midiToHz(midi + 2),
      amplitude: 0.11 - i * 0.01,
      waveform: i % 2 === 0 ? 'triangle' : 'sine',
      sustain: 0.26,
      releaseSec: 0.1,
      pan: -0.18 + i * 0.12,
    });
  });
  addTone(b, { startSec: 0.18, durationSec: 0.26, frequency: 310, endFrequency: 430, amplitude: 0.055, waveform: 'triangle', sustain: 0.22, releaseSec: 0.12 });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createEliteSpawn() {
  const b = createStereoBuffer(0.74);
  addTone(b, { durationSec: 0.24, frequency: 144, endFrequency: 118, amplitude: 0.15, waveform: 'triangle', sustain: 0.34, releaseSec: 0.08 });
  addTone(b, { startSec: 0.03, durationSec: 0.18, frequency: 250, endFrequency: 210, amplitude: 0.07, waveform: 'sine', sustain: 0.28, releaseSec: 0.06 });
  addRepeater(b, {
    startSec: 0.16,
    repeats: 2,
    gapSec: 0.14,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.11, frequency: 420 + i * 26, endFrequency: 360 + i * 22, amplitude: 0.045 - i * 0.006, waveform: 'triangle', sustain: 0.2, releaseSec: 0.05 });
    },
  });
  addNoiseBurst(b, { startSec: 0.02, durationSec: 0.09, amplitude: 0.016, tone: 0.9 });
  normalize(b);
  applySoftClip(b, 0.84);
  return b;
}

function createVictory() {
  const b = createStereoBuffer(1.36);
  [60, 64, 67, 72].forEach((midi, i) => {
    addTone(b, {
      startSec: i * 0.08,
      durationSec: 0.36,
      frequency: midiToHz(midi),
      endFrequency: midiToHz(midi + (i === 3 ? 3 : 1)),
      amplitude: 0.12 - i * 0.012,
      waveform: i % 2 === 0 ? 'triangle' : 'sine',
      sustain: 0.42,
      releaseSec: 0.14,
      pan: -0.28 + i * 0.18,
    });
  });
  addTone(b, { startSec: 0.26, durationSec: 0.45, frequency: 392, endFrequency: 587, amplitude: 0.08, waveform: 'triangle', sustain: 0.34, releaseSec: 0.16 });
  normalize(b);
  applySoftClip(b, 0.86);
  return b;
}

function createDefeat() {
  const b = createStereoBuffer(1.28);
  addTone(b, { durationSec: 0.42, frequency: midiToHz(57), endFrequency: midiToHz(50), amplitude: 0.13, waveform: 'saw', sustain: 0.56, releaseSec: 0.14 });
  addTone(b, { startSec: 0.09, durationSec: 0.44, frequency: midiToHz(52), endFrequency: midiToHz(45), amplitude: 0.09, waveform: 'triangle', sustain: 0.48, releaseSec: 0.16, pan: -0.12 });
  addNoiseBurst(b, { startSec: 0.02, durationSec: 0.2, amplitude: 0.028, tone: 0.75 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

function createResult() {
  const b = createStereoBuffer(0.52);
  addRepeater(b, {
    startSec: 0.03,
    repeats: 4,
    gapSec: 0.08,
    build: (time, i) => {
      addTone(b, { startSec: time, durationSec: 0.12, frequency: 540 + i * 90, endFrequency: 680 + i * 110, amplitude: 0.08 - i * 0.01, waveform: i % 2 === 0 ? 'triangle' : 'sine', sustain: 0.24, releaseSec: 0.05, pan: -0.18 + i * 0.12 });
    },
  });
  addTone(b, { startSec: 0.2, durationSec: 0.18, frequency: 320, endFrequency: 420, amplitude: 0.06, waveform: 'triangle', sustain: 0.28, releaseSec: 0.07 });
  normalize(b);
  applySoftClip(b, 0.88);
  return b;
}

const assets = [
  ['ui_click.wav', createUiClick],
  ['ui_confirm.wav', createUiConfirm],
  ['ui_start.wav', createUiStart],
  ['ui_hover.wav', createUiHover],
  ['ui_resume.wav', createUiResume],
  ['ui_upgrade.wav', createUiUpgrade],
  ['upgrade_equipped.wav', createUpgradeEquipped],
  ['ui_anomaly.wav', createUiAnomaly],
  ['ui_boss_alert.wav', createBossAlert],
  ['ability_ready.wav', createAbilityReady],
  ['ability_cooldown_click.wav', createCooldownBlocked],
  ['player_move_loop.wav', createMoveLoop],
  ['player_shoot_core.wav', createShoot],
  ['player_dash_start.wav', createDash],
  ['player_hit_regular.wav', createHit],
  ['player_pierce_hit.wav', createPierceHit],
  ['player_dash_hit.wav', createDashHit],
  ['player_crit_splash.wav', createCritSplash],
  ['route_pierce_signature.wav', createPierceEcho],
  ['route_dash_signature.wav', createDashPulse],
  ['player_hurt_core.wav', createHurt],
  ['player_kill_regular.wav', createKill],
  ['player_pickup_single.wav', createPickup],
  ['route_crit_signature.wav', createCrit],
  ['enemy_shot_regular.wav', createEnemyShot],
  ['player_near_miss.wav', createNearMiss],
  ['enemy_relay_standard.wav', createRelayStandard],
  ['enemy_relay_skirmisher.wav', createRelaySkirmisher],
  ['enemy_relay_brute.wav', createRelayBrute],
  ['enemy_relay_ranged.wav', createRelayRanged],
  ['state_pressure_regular.wav', createPressure],
  ['player_low_hp_warning.wav', createLowHpWarning],
  ['route_matured.wav', createRouteMatured],
  ['enemy_elite_spawn.wav', createEliteSpawn],
  ['ui_victory.wav', createVictory],
  ['ui_defeat.wav', createDefeat],
  ['ui_result.wav', createResult],
];

const manifest = [];
for (const [fileName, create] of assets) {
  const buffer = create();
  const outPath = path.join(outDir, fileName);
  const mirrorPath = path.join(mirrorDir, fileName);
  writeWav(outPath, buffer);
  writeWav(mirrorPath, buffer);
  manifest.push({
    fileName,
    durationSec: Number((buffer.left.length / SAMPLE_RATE).toFixed(3)),
    bytes: fs.statSync(outPath).size,
  });
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(mirrorDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ generated: manifest.length, outDir, mirrorDir }, null, 2));
