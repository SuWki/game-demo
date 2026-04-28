import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'output', 'asset-preview');
const visualDir = path.join(outDir, 'visual');
const audioDir = path.join(outDir, 'audio');

mkdirSync(visualDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

function writeText(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

function svgFrame({ title, subtitle, width = 256, height = 256, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="coreGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#f7fbff" stop-opacity="0.98"/>
      <stop offset="42%" stop-color="#6ee7ff" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#0b1428" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cyanHull" x1="20%" y1="5%" x2="80%" y2="95%">
      <stop offset="0%" stop-color="#e9fbff"/>
      <stop offset="45%" stop-color="#50d7ff"/>
      <stop offset="100%" stop-color="#11609a"/>
    </linearGradient>
    <linearGradient id="dangerHot" x1="15%" y1="10%" x2="85%" y2="90%">
      <stop offset="0%" stop-color="#ffd58a"/>
      <stop offset="45%" stop-color="#ff5b49"/>
      <stop offset="100%" stop-color="#6b1224"/>
    </linearGradient>
    <linearGradient id="eliteViolet" x1="15%" y1="5%" x2="85%" y2="95%">
      <stop offset="0%" stop-color="#fff1ff"/>
      <stop offset="35%" stop-color="#d36cff"/>
      <stop offset="100%" stop-color="#3d176e"/>
    </linearGradient>
    <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#263654" stroke-width="1" opacity="0.32"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" rx="24" fill="#08111f"/>
  <rect width="100%" height="100%" rx="24" fill="url(#grid)"/>
  ${body}
  <text x="18" y="${height - 32}" fill="#dceaff" font-family="Consolas, monospace" font-size="13" font-weight="700">${title}</text>
  <text x="18" y="${height - 15}" fill="#88a4c6" font-family="Consolas, monospace" font-size="10">${subtitle}</text>
</svg>`;
}

const visuals = {
  'unit-player-core.svg': svgFrame({
    title: 'unit-player-core v1',
    subtitle: 'cyan / forward / route anchor',
    body: `
  <ellipse cx="128" cy="136" rx="62" ry="72" fill="url(#coreGlow)" opacity="0.5"/>
  <path d="M128 34 L172 178 L128 154 L84 178 Z" fill="#081522" stroke="#b8f7ff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 46 L158 162 L128 143 L98 162 Z" fill="url(#cyanHull)" stroke="#07111f" stroke-width="3" stroke-linejoin="round"/>
  <path d="M128 74 L142 132 L128 124 L114 132 Z" fill="#f8fdff" opacity="0.9"/>
  <path d="M91 158 L57 197 L111 178 Z" fill="#163b62" stroke="#59e0ff" stroke-width="3" stroke-linejoin="round"/>
  <path d="M165 158 L199 197 L145 178 Z" fill="#163b62" stroke="#59e0ff" stroke-width="3" stroke-linejoin="round"/>
  <path d="M113 175 L128 220 L143 175 Z" fill="#ffb14b" filter="url(#softGlow)"/>
  <path d="M121 178 L128 204 L135 178 Z" fill="#fff3a7"/>
  <circle cx="128" cy="118" r="7" fill="#07111f" stroke="#dffbff" stroke-width="3"/>
  <path d="M128 20 L118 38 H138 Z" fill="#dffbff"/>`,
  }),
  'enemy-standard-a.svg': svgFrame({
    title: 'enemy-standard-a v1',
    subtitle: 'warm / hostile / ordinary',
    body: `
  <ellipse cx="128" cy="132" rx="56" ry="52" fill="#ff2f3d" opacity="0.18" filter="url(#softGlow)"/>
  <path d="M128 55 L188 117 L164 187 L92 187 L68 117 Z" fill="#1a0e16" stroke="#ffbd66" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 70 L171 118 L154 169 L102 169 L85 118 Z" fill="url(#dangerHot)" stroke="#3d101c" stroke-width="3" stroke-linejoin="round"/>
  <path d="M72 112 L34 91 L63 139 Z" fill="#6b1224" stroke="#ff7b4c" stroke-width="3"/>
  <path d="M184 112 L222 91 L193 139 Z" fill="#6b1224" stroke="#ff7b4c" stroke-width="3"/>
  <circle cx="111" cy="123" r="8" fill="#180914" stroke="#ffd07d" stroke-width="3"/>
  <circle cx="145" cy="123" r="8" fill="#180914" stroke="#ffd07d" stroke-width="3"/>
  <path d="M104 151 Q128 165 152 151" fill="none" stroke="#2a0710" stroke-width="6" stroke-linecap="round"/>
  <path d="M96 196 L80 225 M128 196 L128 229 M160 196 L176 225" stroke="#ff784f" stroke-width="5" stroke-linecap="round"/>`,
  }),
  'fx-xp-orb.svg': svgFrame({
    title: 'fx-xp-orb v1',
    subtitle: 'green / collectible / not bullet',
    body: `
  <path d="M62 169 C91 151 99 130 121 103" fill="none" stroke="#5cf7b2" stroke-width="8" stroke-linecap="round" opacity="0.34"/>
  <path d="M72 190 C101 166 112 143 134 118" fill="none" stroke="#b8ffd9" stroke-width="4" stroke-linecap="round" opacity="0.48"/>
  <circle cx="142" cy="104" r="62" fill="#042719" stroke="#b7ffd8" stroke-width="5" filter="url(#softGlow)"/>
  <circle cx="142" cy="104" r="44" fill="#16d484" opacity="0.88"/>
  <circle cx="128" cy="88" r="16" fill="#eafff3" opacity="0.75"/>
  <path d="M142 72 V136 M110 104 H174" stroke="#062719" stroke-width="10" stroke-linecap="round"/>
  <path d="M142 75 V133 M113 104 H171" stroke="#d7ffea" stroke-width="5" stroke-linecap="round"/>
  <circle cx="142" cy="104" r="72" fill="none" stroke="#5cf7b2" stroke-width="2" stroke-dasharray="8 8" opacity="0.75"/>`,
  }),
  'elite-core-main.svg': svgFrame({
    title: 'elite-core-main v1',
    subtitle: 'priority target / shielded core',
    body: `
  <circle cx="128" cy="126" r="72" fill="#5b1a82" opacity="0.28" filter="url(#softGlow)"/>
  <path d="M128 38 L200 84 L200 169 L128 215 L56 169 L56 84 Z" fill="#0b0c24" stroke="#ffc2ff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 58 L179 91 L179 161 L128 194 L77 161 L77 91 Z" fill="url(#eliteViolet)" stroke="#32104e" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="128" cy="126" r="32" fill="#090816" stroke="#fff2ff" stroke-width="5"/>
  <circle cx="128" cy="126" r="17" fill="#ffcf6e"/>
  <path d="M128 22 V52 M128 200 V232 M22 126 H55 M201 126 H234" stroke="#d36cff" stroke-width="5" stroke-linecap="round"/>
  <path d="M91 89 L66 64 M165 89 L190 64 M91 163 L66 188 M165 163 L190 188" stroke="#ffcf6e" stroke-width="4" stroke-linecap="round"/>`,
  }),
  'elite-escort-unit.svg': svgFrame({
    title: 'elite-escort-unit v1',
    subtitle: 'escort / smaller shield piece',
    body: `
  <circle cx="128" cy="128" r="60" fill="#3a155e" opacity="0.22" filter="url(#softGlow)"/>
  <path d="M128 61 L176 105 L159 181 L97 181 L80 105 Z" fill="#0b0c24" stroke="#c878ff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 78 L158 110 L147 162 L109 162 L98 110 Z" fill="#7d3dba" stroke="#281245" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="128" cy="124" r="18" fill="#150b26" stroke="#f3d7ff" stroke-width="4"/>
  <path d="M68 116 L38 101 M188 116 L218 101 M87 179 L64 210 M169 179 L192 210" stroke="#ffc86e" stroke-width="4" stroke-linecap="round"/>
  <path d="M112 124 H144" stroke="#fff3b2" stroke-width="5" stroke-linecap="round"/>`,
  }),
  'elite-core-crack.svg': svgFrame({
    title: 'elite-core-crack v1',
    subtitle: 'crack window / chase now',
    body: `
  <circle cx="128" cy="126" r="76" fill="#ffcf6e" opacity="0.18" filter="url(#softGlow)"/>
  <path d="M128 38 L200 84 L200 169 L128 215 L56 169 L56 84 Z" fill="#100818" stroke="#ffdf8d" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 58 L179 91 L179 161 L128 194 L77 161 L77 91 Z" fill="#7a2e7f" stroke="#2b112e" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="128" cy="126" r="35" fill="#160816" stroke="#fff2a8" stroke-width="5"/>
  <path d="M130 88 L116 115 L138 124 L119 159 L149 126 L131 119 L151 92" fill="none" stroke="#eaffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#softGlow)"/>
  <path d="M128 37 C109 76 82 90 56 84 M200 169 C166 160 145 181 128 215" fill="none" stroke="#ffcf6e" stroke-width="5" stroke-linecap="round" stroke-dasharray="12 8"/>
  <path d="M58 221 L103 182" stroke="#8ffaff" stroke-width="6" stroke-linecap="round"/>
  <path d="M76 222 L103 182 L62 196 Z" fill="#8ffaff"/>`,
  }),
  'boss-bastion-main.svg': svgFrame({
    title: 'boss-bastion-main v1',
    subtitle: 'fortress boss / fireline source',
    body: `
  <circle cx="128" cy="128" r="96" fill="#6b1224" opacity="0.22" filter="url(#softGlow)"/>
  <path d="M128 26 L221 80 L221 176 L128 230 L35 176 L35 80 Z" fill="#100b14" stroke="#ffd08c" stroke-width="6" stroke-linejoin="round"/>
  <path d="M128 48 L196 88 L196 168 L128 208 L60 168 L60 88 Z" fill="#4a1725" stroke="#ff685a" stroke-width="5" stroke-linejoin="round"/>
  <circle cx="128" cy="128" r="43" fill="#080712" stroke="#ffe0a8" stroke-width="6"/>
  <circle cx="128" cy="128" r="24" fill="#ff493f"/>
  <circle cx="128" cy="128" r="11" fill="#fff5c7"/>
  <path d="M128 26 V75 M128 181 V230 M35 80 L79 106 M177 150 L221 176 M221 80 L177 106 M79 150 L35 176" stroke="#ffb15e" stroke-width="8" stroke-linecap="round"/>
  <path d="M25 128 H76 M180 128 H231" stroke="#ff493f" stroke-width="10" stroke-linecap="round" opacity="0.9"/>
  <path d="M96 97 L160 159 M160 97 L96 159" stroke="#ffd08c" stroke-width="5" stroke-linecap="round" opacity="0.75"/>`,
  }),
  'fx-boss-bastion-fireline.svg': svgFrame({
    title: 'fx-boss-bastion-fireline v1',
    subtitle: 'lane danger / readable safe gap',
    width: 512,
    height: 192,
    body: `
  <rect x="38" y="56" width="436" height="24" rx="12" fill="#ff493f" opacity="0.3" filter="url(#softGlow)"/>
  <rect x="38" y="112" width="436" height="24" rx="12" fill="#ff493f" opacity="0.3" filter="url(#softGlow)"/>
  <rect x="38" y="61" width="170" height="14" rx="7" fill="#ffdf8d"/>
  <rect x="304" y="61" width="170" height="14" rx="7" fill="#ffdf8d"/>
  <rect x="38" y="117" width="118" height="14" rx="7" fill="#ffdf8d"/>
  <rect x="260" y="117" width="214" height="14" rx="7" fill="#ffdf8d"/>
  <path d="M224 36 L256 96 L288 36" fill="none" stroke="#8ffaff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M178 154 L210 102 L242 154" fill="none" stroke="#8ffaff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="226" y="83" fill="#dffbff" font-family="Consolas, monospace" font-size="16" font-weight="700">SAFE</text>
  <text x="176" y="145" fill="#dffbff" font-family="Consolas, monospace" font-size="16" font-weight="700">WINDOW</text>`,
  }),
  'player-projectile-core.svg': svgFrame({
    title: 'player-projectile-core v1',
    subtitle: 'thin cyan / player fire',
    body: `
  <path d="M128 42 C154 90 154 166 128 214 C102 166 102 90 128 42 Z" fill="#5ee8ff" filter="url(#softGlow)"/>
  <path d="M128 54 C144 96 144 158 128 200 C112 158 112 96 128 54 Z" fill="#eaffff"/>
  <path d="M99 180 C112 166 144 166 157 180" fill="none" stroke="#5ee8ff" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`,
  }),
  'enemy-projectile-core.svg': svgFrame({
    title: 'enemy-projectile-core v1',
    subtitle: 'warm bead / hostile fire',
    body: `
  <circle cx="128" cy="128" r="48" fill="#ff493f" opacity="0.32" filter="url(#softGlow)"/>
  <circle cx="128" cy="128" r="30" fill="#ff6b48" stroke="#ffd08c" stroke-width="5"/>
  <circle cx="118" cy="118" r="9" fill="#fff1b8"/>
  <path d="M128 72 V44 M128 184 V212 M72 128 H44 M184 128 H212" stroke="#ff6b48" stroke-width="5" stroke-linecap="round"/>`,
  }),
};

for (const [fileName, content] of Object.entries(visuals)) {
  writeText(path.join(visualDir, fileName), content);
}

const sampleRate = 44100;

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function envelope(t, duration, attack = 0.01, release = 0.05) {
  if (t < attack) {
    return t / attack;
  }
  const tail = Math.max(0.001, duration - release);
  if (t > tail) {
    return Math.max(0, (duration - t) / release);
  }
  return 1;
}

function oscillator(type, phase) {
  const p = phase % 1;
  if (type === 'square') {
    return p < 0.5 ? 1 : -1;
  }
  if (type === 'triangle') {
    return 4 * Math.abs(p - 0.5) - 1;
  }
  if (type === 'saw') {
    return 2 * p - 1;
  }
  return Math.sin(Math.PI * 2 * p);
}

function deterministicNoise(index) {
  const seed = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return (seed - Math.floor(seed)) * 2 - 1;
}

function synthSound(duration, layers) {
  const total = Math.max(1, Math.floor(duration * sampleRate));
  const samples = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate;
    let sample = 0;

    for (const layer of layers) {
      const start = layer.start ?? 0;
      const end = start + layer.duration;
      if (t < start || t > end) {
        continue;
      }

      const localT = t - start;
      const progress = Math.min(1, localT / layer.duration);
      const gain =
        layer.gain *
        envelope(localT, layer.duration, layer.attack ?? 0.006, layer.release ?? 0.04) *
        (layer.decay ? Math.exp(-progress * layer.decay) : 1);

      if (layer.type === 'noise') {
        sample += deterministicNoise(index + Math.floor(start * 1000)) * gain;
        continue;
      }

      const from = layer.from;
      const to = layer.to ?? from;
      const frequency = from * Math.pow(to / from, progress);
      sample += oscillator(layer.type ?? 'sine', localT * frequency) * gain;
    }

    samples[index] = clamp(sample * 0.82);
  }

  return samples;
}

function writeWav(filePath, samples) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(clamp(samples[index]) * 32767), 44 + index * bytesPerSample);
  }

  writeFileSync(filePath, buffer);
}

const sounds = {
  'player_shoot_core.wav': {
    description: 'short cyan pew, frequent but soft',
    duration: 0.13,
    layers: [
      { type: 'triangle', from: 880, to: 1320, gain: 0.22, duration: 0.09, attack: 0.004, release: 0.035, decay: 2.4 },
      { type: 'noise', gain: 0.045, duration: 0.035, attack: 0.002, release: 0.024, decay: 3.2 },
    ],
  },
  'player_hit_regular.wav': {
    description: 'compact metal tick plus body thump',
    duration: 0.15,
    layers: [
      { type: 'square', from: 420, to: 270, gain: 0.2, duration: 0.07, attack: 0.003, release: 0.04, decay: 2.8 },
      { type: 'noise', gain: 0.095, duration: 0.045, attack: 0.002, release: 0.035, decay: 4.2 },
    ],
  },
  'player_kill_regular.wav': {
    description: 'reward pop, stronger than hit',
    duration: 0.24,
    layers: [
      { type: 'triangle', from: 320, to: 620, gain: 0.22, duration: 0.13, attack: 0.006, release: 0.07, decay: 1.4 },
      { type: 'sine', from: 760, to: 1080, gain: 0.16, duration: 0.12, start: 0.035, attack: 0.006, release: 0.06, decay: 1.5 },
      { type: 'noise', gain: 0.075, duration: 0.065, attack: 0.002, release: 0.05, decay: 4 },
    ],
  },
  'player_pickup_single.wav': {
    description: 'light upward XP chirp',
    duration: 0.2,
    layers: [
      { type: 'triangle', from: 540, to: 860, gain: 0.16, duration: 0.1, attack: 0.006, release: 0.055, decay: 1.3 },
      { type: 'sine', from: 880, to: 1220, gain: 0.12, duration: 0.1, start: 0.04, attack: 0.006, release: 0.05, decay: 1.2 },
    ],
  },
  'player_hurt_core.wav': {
    description: 'heavy low hit, highest danger priority',
    duration: 0.34,
    layers: [
      { type: 'saw', from: 180, to: 72, gain: 0.34, duration: 0.2, attack: 0.004, release: 0.12, decay: 1.2 },
      { type: 'triangle', from: 88, to: 54, gain: 0.28, duration: 0.26, start: 0.015, attack: 0.006, release: 0.14, decay: 0.9 },
      { type: 'noise', gain: 0.12, duration: 0.11, attack: 0.002, release: 0.09, decay: 2.4 },
    ],
  },
  'player_near_miss.wav': {
    description: 'sharp air slice, not damage',
    duration: 0.16,
    layers: [
      { type: 'triangle', from: 1200, to: 2100, gain: 0.16, duration: 0.08, attack: 0.002, release: 0.05, decay: 2.2 },
      { type: 'noise', gain: 0.095, duration: 0.055, attack: 0.001, release: 0.04, decay: 5.2 },
    ],
  },
  'state_pressure_regular.wav': {
    description: 'low pressure swell, not a hit',
    duration: 0.58,
    layers: [
      { type: 'saw', from: 130, to: 86, gain: 0.24, duration: 0.46, attack: 0.025, release: 0.18, decay: 0.55 },
      { type: 'triangle', from: 220, to: 150, gain: 0.12, duration: 0.44, start: 0.04, attack: 0.02, release: 0.16, decay: 0.6 },
      { type: 'noise', gain: 0.045, duration: 0.36, start: 0.06, attack: 0.02, release: 0.16, decay: 1.2 },
    ],
  },
  'enemy_shot_regular.wav': {
    description: 'warm hostile launch, separated from player shoot',
    duration: 0.19,
    layers: [
      { type: 'square', from: 330, to: 210, gain: 0.2, duration: 0.1, attack: 0.004, release: 0.06, decay: 2.1 },
      { type: 'triangle', from: 720, to: 520, gain: 0.09, duration: 0.085, start: 0.01, attack: 0.004, release: 0.055, decay: 1.8 },
      { type: 'noise', gain: 0.06, duration: 0.045, attack: 0.002, release: 0.035, decay: 4.2 },
    ],
  },
  'route_crit_signature.wav': {
    description: 'bright burst signature',
    duration: 0.26,
    layers: [
      { type: 'triangle', from: 820, to: 1420, gain: 0.18, duration: 0.14, attack: 0.004, release: 0.075, decay: 1.2 },
      { type: 'sine', from: 1320, to: 1840, gain: 0.12, duration: 0.13, start: 0.035, attack: 0.004, release: 0.065, decay: 1.4 },
      { type: 'noise', gain: 0.07, duration: 0.055, attack: 0.002, release: 0.042, decay: 4.2 },
    ],
  },
  'route_pierce_signature.wav': {
    description: 'descending rail-through signature',
    duration: 0.31,
    layers: [
      { type: 'triangle', from: 760, to: 460, gain: 0.17, duration: 0.2, attack: 0.005, release: 0.08, decay: 1.1 },
      { type: 'sine', from: 1420, to: 900, gain: 0.095, duration: 0.18, start: 0.045, attack: 0.005, release: 0.075, decay: 1.1 },
      { type: 'noise', gain: 0.045, duration: 0.07, start: 0.055, attack: 0.002, release: 0.05, decay: 3.8 },
    ],
  },
  'route_dash_signature.wav': {
    description: 'close pass, turn-back thump',
    duration: 0.3,
    layers: [
      { type: 'triangle', from: 520, to: 340, gain: 0.17, duration: 0.17, attack: 0.004, release: 0.085, decay: 1.4 },
      { type: 'sine', from: 960, to: 720, gain: 0.105, duration: 0.12, start: 0.035, attack: 0.004, release: 0.06, decay: 1.5 },
      { type: 'noise', gain: 0.08, duration: 0.045, start: 0.015, attack: 0.002, release: 0.035, decay: 4.6 },
    ],
  },
};

for (const [fileName, spec] of Object.entries(sounds)) {
  const samples = synthSound(spec.duration, spec.layers);
  writeWav(path.join(audioDir, fileName), samples);
}

const visualCards = Object.keys(visuals)
  .map(
    (fileName) => `
      <article class="card">
        <img src="./visual/${fileName}" alt="${fileName}" />
        <strong>${fileName}</strong>
      </article>`,
  )
  .join('\n');

const audioCards = Object.entries(sounds)
  .map(
    ([fileName, spec]) => `
      <article class="card">
        <strong>${fileName}</strong>
        <p>${spec.description}</p>
        <audio controls src="./audio/${fileName}"></audio>
      </article>`,
  )
  .join('\n');

const contactSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" viewBox="0 0 1280 900">
  <rect width="1280" height="900" fill="#07101d"/>
  <text x="40" y="58" fill="#f2fbff" font-family="Consolas, monospace" font-size="28" font-weight="700">Pilot Survivor - First Visual Preview Sheet</text>
  <text x="40" y="88" fill="#8da5c2" font-family="Consolas, monospace" font-size="16">Readability first: player / enemy / XP / elite / boss / projectile layers</text>
  ${Object.keys(visuals)
    .map((fileName, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 40 + col * 240;
      const y = 120 + row * 340;
      return `<image href="./visual/${fileName}" x="${x}" y="${y}" width="196" height="${fileName.includes('fireline') ? 74 : 196}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${x}" y="${y + 224}" fill="#dceaff" font-family="Consolas, monospace" font-size="13">${fileName}</text>`;
    })
    .join('\n')}
</svg>`;

writeText(path.join(outDir, 'visual-contact-sheet.svg'), contactSheet);

const battleComposite = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <filter id="labelShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.75"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="#07101d"/>
  <image href="../qa/current-version/02-battle-opening.png" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" opacity="0.58"/>
  <rect width="1280" height="720" fill="#07101d" opacity="0.16"/>
  <text x="36" y="48" fill="#f2fbff" font-family="Consolas, monospace" font-size="26" font-weight="700" filter="url(#labelShadow)">Static Battle Readability Composite</text>
  <text x="36" y="78" fill="#9eb8d6" font-family="Consolas, monospace" font-size="15" filter="url(#labelShadow)">Preview only: check silhouette, color separation, projectile / XP confusion risk</text>

  <image href="./visual/unit-player-core.svg" x="570" y="320" width="112" height="112"/>
  <text x="560" y="452" fill="#65e6ff" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">player</text>

  <image href="./visual/enemy-standard-a.svg" x="364" y="238" width="82" height="82"/>
  <image href="./visual/enemy-standard-a.svg" x="810" y="246" width="82" height="82"/>
  <text x="355" y="338" fill="#ffbd66" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">ordinary enemies</text>

  <image href="./visual/fx-xp-orb.svg" x="705" y="404" width="58" height="58"/>
  <image href="./visual/fx-xp-orb.svg" x="766" y="436" width="48" height="48"/>
  <text x="704" y="496" fill="#5cf7b2" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">XP orbs</text>

  <image href="./visual/player-projectile-core.svg" x="638" y="214" width="42" height="86"/>
  <image href="./visual/enemy-projectile-core.svg" x="492" y="278" width="50" height="50"/>
  <text x="482" y="256" fill="#dceaff" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">projectile split</text>

  <image href="./visual/elite-core-main.svg" x="934" y="348" width="116" height="116"/>
  <image href="./visual/elite-escort-unit.svg" x="1030" y="300" width="74" height="74"/>
  <image href="./visual/elite-core-crack.svg" x="1072" y="398" width="84" height="84"/>
  <text x="930" y="498" fill="#ffc2ff" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">elite + crack</text>

  <image href="./visual/boss-bastion-main.svg" x="100" y="380" width="140" height="140"/>
  <image href="./visual/fx-boss-bastion-fireline.svg" x="182" y="506" width="300" height="112"/>
  <text x="104" y="546" fill="#ffd08c" font-family="Consolas, monospace" font-size="14" filter="url(#labelShadow)">boss fireline</text>

  <rect x="34" y="610" width="1210" height="72" rx="16" fill="#08111f" opacity="0.84" stroke="#2d4468"/>
  <text x="58" y="642" fill="#f2fbff" font-family="Consolas, monospace" font-size="16" font-weight="700">Pass if:</text>
  <text x="150" y="642" fill="#9eb8d6" font-family="Consolas, monospace" font-size="15">player faces clearly, XP never reads as hostile fire, enemy projectile stays warm, elite and boss remain higher priority than ordinary enemies.</text>
  <text x="58" y="666" fill="#fca5a5" font-family="Consolas, monospace" font-size="15">Reject if:</text>
  <text x="150" y="666" fill="#9eb8d6" font-family="Consolas, monospace" font-size="15">asset hides danger rings, adds noisy detail, or creates color conflict with existing route / danger signatures.</text>
</svg>`;

writeText(path.join(outDir, 'battle-readability-composite.svg'), battleComposite);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pilot Survivor Asset Preview</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07101d;
      --panel: #101d31;
      --line: #2d4468;
      --text: #f1f8ff;
      --muted: #8fa8c9;
      --accent: #65e6ff;
    }
    body {
      margin: 0;
      padding: 36px;
      background:
        radial-gradient(circle at 20% 0%, rgba(101, 230, 255, 0.14), transparent 30%),
        radial-gradient(circle at 80% 20%, rgba(255, 96, 82, 0.12), transparent 28%),
        var(--bg);
      color: var(--text);
      font-family: "Bahnschrift", "Segoe UI", sans-serif;
    }
    h1, h2 { margin: 0 0 14px; letter-spacing: 0.04em; }
    p { color: var(--muted); line-height: 1.6; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 18px;
      margin: 20px 0 40px;
    }
    .card {
      background: color-mix(in srgb, var(--panel) 86%, black);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
    }
    .card img {
      width: 100%;
      min-height: 160px;
      object-fit: contain;
      background: #08111f;
      border-radius: 14px;
      border: 1px solid rgba(101, 230, 255, 0.18);
    }
    strong { display: block; margin-top: 12px; font-family: Consolas, monospace; color: var(--accent); }
    audio { width: 100%; margin-top: 12px; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <h1>首批视觉与音效预览</h1>
  <p>这些文件是预览样张，不直接替换实机资源。先用于 A/B 观察：是否清楚、是否混淆、是否适合作品集视频。</p>
  <p><a href="./visual-contact-sheet.svg">打开视觉总览板</a> / <a href="./battle-readability-composite.svg">打开战斗合成检查板</a></p>
  <h2>视觉预览</h2>
  <section class="grid">${visualCards}</section>
  <h2>音效预览</h2>
  <section class="grid">${audioCards}</section>
</body>
</html>`;

writeText(path.join(outDir, 'index.html'), html);

const manifest = {
  generatedAt: new Date().toISOString(),
  purpose: 'first visual and audio preview, not runtime replacement',
  visualDir: path.relative(root, visualDir),
  audioDir: path.relative(root, audioDir),
  previewSheets: ['visual-contact-sheet.svg', 'battle-readability-composite.svg'],
  visuals: Object.keys(visuals),
  sounds: Object.entries(sounds).map(([fileName, spec]) => ({
    fileName,
    description: spec.description,
  })),
  nextCheck: [
    'Open output/asset-preview/index.html.',
    'Compare visuals on output/qa/current-version/02-battle-opening.png.',
    'Reject anything that looks like enemy bullets or hides danger signals.',
    'Only wire into runtime after A/B approval.',
  ],
};

writeText(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${Object.keys(visuals).length} visual previews and ${Object.keys(sounds).length} audio previews.`);
console.log(path.relative(root, outDir));
