import type { AudioCue } from '../game/types';

type MusicMode = 'silent' | 'menu' | 'battle' | 'boss' | 'result';
type SequenceNote = number | null;

interface CueProfile {
  cooldownMs: number;
  play: (context: AudioContext, destination: AudioNode, now: number) => void;
}

interface MusicProfile {
  stepSec: number;
  gain: number;
  bassType: OscillatorType;
  leadType: OscillatorType;
  accentType: OscillatorType;
  bassPeak: number;
  leadPeak: number;
  accentPeak: number;
  padPeak: number;
  bass: SequenceNote[];
  lead: SequenceNote[];
  accent: SequenceNote[];
}

export interface PilotAudioDebugSnapshot {
  contextState: AudioContextState | 'uninitialized';
  desiredMusicMode: MusicMode;
  currentMusicMode: MusicMode;
  masterVolume: number;
  routeFocus: CombatCueContext['routeFocus'];
  encounter: CombatCueContext['encounter'];
  intensity: number;
  pendingCueCount: number;
  lastAudibleRms: number;
  peakRms: number;
  audibleMoments: number;
  scheduledMusicSteps: number;
  previewAudioEnabled: boolean;
  previewAudioReady: number;
  previewAudioCueCounts: Partial<Record<AudioCue, number>>;
  cueCounts: Partial<Record<AudioCue, number>>;
}

interface CombatCueContext {
  routeFocus: 'crit' | 'pierce' | 'dash' | null;
  encounter: 'ordinary' | 'elite' | 'boss' | 'survive' | 'flow';
  intensity: number;
}

const SCHEDULE_AHEAD_SEC = 0.42;
const RMS_AUDIBLE_THRESHOLD = 0.0035;
const RUNTIME_AUDIO_PREVIEW_STORAGE_KEY = 'pilot-runtime-preview-audio';
const PREVIEW_CUE_URLS: Partial<Record<AudioCue, string>> = {
  click: 'assets/preview-runtime/audio/ui_click.wav',
  confirm: 'assets/preview-runtime/audio/ui_confirm.wav',
  start: 'assets/preview-runtime/audio/ui_start.wav',
  resume: 'assets/preview-runtime/audio/ui_resume.wav',
  upgrade: 'assets/preview-runtime/audio/ui_upgrade.wav',
  upgradeEquipped: 'assets/preview-runtime/audio/upgrade_equipped.wav',
  anomaly: 'assets/preview-runtime/audio/ui_anomaly.wav',
  boss: 'assets/preview-runtime/audio/ui_boss_alert.wav',
  abilityReady: 'assets/preview-runtime/audio/ability_ready.wav',
  shoot: 'assets/preview-runtime/audio/player_shoot_core.wav',
  dash: 'assets/preview-runtime/audio/player_dash_start.wav',
  hit: 'assets/preview-runtime/audio/player_hit_regular.wav',
  pierceHit: 'assets/preview-runtime/audio/player_pierce_hit.wav',
  dashHit: 'assets/preview-runtime/audio/player_dash_hit.wav',
  critSplash: 'assets/preview-runtime/audio/player_crit_splash.wav',
  kill: 'assets/preview-runtime/audio/player_kill_regular.wav',
  pickup: 'assets/preview-runtime/audio/player_pickup_single.wav',
  hurt: 'assets/preview-runtime/audio/player_hurt_core.wav',
  enemyShot: 'assets/preview-runtime/audio/enemy_shot_regular.wav',
  nearMiss: 'assets/preview-runtime/audio/player_near_miss.wav',
  pressure: 'assets/preview-runtime/audio/state_pressure_regular.wav',
  lowHpWarning: 'assets/preview-runtime/audio/player_low_hp_warning.wav',
  crit: 'assets/preview-runtime/audio/route_crit_signature.wav',
  pierceEcho: 'assets/preview-runtime/audio/route_pierce_signature.wav',
  dashPulse: 'assets/preview-runtime/audio/route_dash_signature.wav',
  routeMatured: 'assets/preview-runtime/audio/route_matured.wav',
  relayStandard: 'assets/preview-runtime/audio/enemy_relay_standard.wav',
  relaySkirmisher: 'assets/preview-runtime/audio/enemy_relay_skirmisher.wav',
  relayBrute: 'assets/preview-runtime/audio/enemy_relay_brute.wav',
  relayRanged: 'assets/preview-runtime/audio/enemy_relay_ranged.wav',
  eliteSpawn: 'assets/preview-runtime/audio/enemy_elite_spawn.wav',
  victory: 'assets/preview-runtime/audio/ui_victory.wav',
  defeat: 'assets/preview-runtime/audio/ui_defeat.wav',
  result: 'assets/preview-runtime/audio/ui_result.wav',
};

// 音量平衡映射 - 根据音效类型调整音量
const CUE_VOLUME_MAP: Partial<Record<AudioCue, number>> = {
  // UI音效 - 0.5
  click: 0.5,
  confirm: 0.5,
  start: 0.6,
  resume: 0.52,
  upgrade: 0.75,
  upgradeEquipped: 0.68,
  anomaly: 0.8,
  boss: 0.9,
  abilityReady: 0.48,

  // 战斗音效 - 0.4-0.7
  shoot: 0.4, // 降低射击音量，避免疲劳
  hit: 0.5,
  hit: 0.5,
  pierceHit: 0.55,
  dashHit: 0.6,
  critSplash: 0.65,
  kill: 0.7,

  // 玩家状态 - 0.5-0.8
  hurt: 0.8, // 突出受伤反馈
  pickup: 0.5,
  dash: 0.6,
  nearMiss: 0.45,

  // 敌人音效 - 0.4-0.5
  enemyShot: 0.45,
  relayStandard: 0.5,
  relaySkirmisher: 0.5,
  relayBrute: 0.55,
  relayRanged: 0.5,

  // 特殊事件 - 0.75-0.9
  pressure: 0.85,
  lowHpWarning: 0.42,

  // 路线特效 - 0.65
  crit: 0.65,
  pierceEcho: 0.65,
  dashPulse: 0.65,
  routeMatured: 0.72,
  eliteSpawn: 0.74,

  // 结算 - 0.7-0.8
  victory: 0.8,
  defeat: 0.75,
  result: 0.7,
};

const MUSIC_PROFILES: Record<Exclude<MusicMode, 'silent'>, MusicProfile> = {
  menu: {
    stepSec: 0.34,
    gain: 0.46,
    bassType: 'triangle',
    leadType: 'sine',
    accentType: 'triangle',
    bassPeak: 0.078,
    leadPeak: 0.036,
    accentPeak: 0.019,
    padPeak: 0.025,
    bass: [45, null, 48, null, 52, null, 48, null],
    lead: [57, 60, 64, 60, 55, 59, 62, 59],
    accent: [69, null, null, 72, null, null, 71, null],
  },
  battle: {
    stepSec: 0.28,
    gain: 0.54,
    bassType: 'sawtooth',
    leadType: 'triangle',
    accentType: 'square',
    bassPeak: 0.076,
    leadPeak: 0.034,
    accentPeak: 0.022,
    padPeak: 0.016,
    bass: [38, null, 38, null, 41, null, 43, null, 36, null, 38, null, 41, null, 43, null],
    lead: [53, null, 56, null, 58, null, 60, null, 53, null, 56, null, 60, null, 63, null],
    accent: [65, null, null, null, 68, null, null, null, 65, null, null, null, 70, null, null, null],
  },
  boss: {
    stepSec: 0.22,
    gain: 0.56,
    bassType: 'sawtooth',
    leadType: 'square',
    accentType: 'triangle',
    bassPeak: 0.082,
    leadPeak: 0.034,
    accentPeak: 0.022,
    padPeak: 0.018,
    bass: [34, null, 34, 36, 34, null, 31, null, 34, null, 36, 38, 34, null, 29, null],
    lead: [58, null, 61, 58, null, 62, null, 65, 58, null, 63, 66, null, 65, null, 70],
    accent: [70, null, null, 73, null, null, 70, null, 68, null, null, 72, null, null, 68, null],
  },
  result: {
    stepSec: 0.34,
    gain: 0.42,
    bassType: 'triangle',
    leadType: 'sine',
    accentType: 'triangle',
    bassPeak: 0.064,
    leadPeak: 0.028,
    accentPeak: 0.015,
    padPeak: 0.02,
    bass: [45, null, 48, null, 52, null, 57, null],
    lead: [60, 64, 67, 72, 69, 64, 67, 64],
    accent: [72, null, null, 76, null, null, 74, null],
  },
};

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function createVoice(
  context: AudioContext,
  destination: AudioNode,
  now: number,
  options: {
    type: OscillatorType;
    frequency: number;
    peak: number;
    duration: number;
    release?: number;
    sweepTo?: number;
    delay?: number;
  },
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = now + (options.delay ?? 0);
  const attackAt = startAt + Math.min(0.012, Math.max(0.004, options.duration * 0.22));
  const releaseAt = startAt + options.duration;
  const stopAt = releaseAt + (options.release ?? 0.04);

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  if (options.sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(options.sweepTo, releaseAt);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.peak, attackAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(stopAt);
}

function connectWithOptionalPanner(
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  pan = 0,
): void {
  if ('createStereoPanner' in context) {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(panner);
    panner.connect(destination);
    return;
  }

  source.connect(destination);
}

function createImpactThump(
  context: AudioContext,
  destination: AudioNode,
  now: number,
  options: {
    peak: number;
    duration: number;
    frequency: number;
    sweepTo?: number;
    delay?: number;
    pan?: number;
    type?: OscillatorType;
  },
): void {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const startAt = now + (options.delay ?? 0);
  const attackAt = startAt + Math.min(0.012, Math.max(0.003, options.duration * 0.18));
  const releaseAt = startAt + options.duration;
  const stopAt = releaseAt + 0.06;

  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(34, options.sweepTo ?? options.frequency * 0.68), releaseAt);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(180, options.frequency * 3.8), startAt);
  filter.frequency.exponentialRampToValueAtTime(Math.max(96, options.frequency * 2.1), releaseAt);
  filter.Q.value = 0.55;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.peak, attackAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(filter);
  connectWithOptionalPanner(context, filter, gain, options.pan ?? 0);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(stopAt);
}

export class PilotAudio {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private musicGain: GainNode | null = null;

  private sfxGain: GainNode | null = null;

  private analyser: AnalyserNode | null = null;

  private analyserData: Float32Array<ArrayBuffer> | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private readonly lastPlayedAt = new Map<AudioCue, number>();

  private readonly cueCounts = new Map<AudioCue, number>();

  private readonly previewCueCounts = new Map<AudioCue, number>();

  private readonly pendingCues: AudioCue[] = [];

  private readonly previewBuffers = new Map<AudioCue, AudioBuffer>();

  private readonly loadingPreviewCues = new Set<AudioCue>();

  private desiredMusicMode: MusicMode = 'silent';

  private currentMusicMode: MusicMode = 'silent';

  private schedulerHandle: number | null = null;

  private meterHandle: number | null = null;

  private nextMusicNoteTime = 0;

  private musicStepIndex = 0;

  private scheduledMusicSteps = 0;

  private lastAudibleRms = 0;

  private peakRms = 0;

  private audibleMoments = 0;

  private resumePromise: Promise<void> | null = null;

  private masterVolume = 1;

  private readonly runtimeAudioPreviewEnabled =
    typeof window !== 'undefined' && window.localStorage.getItem(RUNTIME_AUDIO_PREVIEW_STORAGE_KEY) !== 'off';

  private cueContext: CombatCueContext = {
    routeFocus: null,
    encounter: 'ordinary',
    intensity: 0,
  };

  public unlock(): void {
    this.ensureAudioGraph();
    if (!this.context) {
      return;
    }

    if (this.context.state === 'running') {
      this.syncMusicMode(true);
      this.flushPendingCues();
      return;
    }

    if (!this.resumePromise) {
      this.resumePromise = this.context
        .resume()
        .catch(() => undefined)
        .then(() => {
          this.resumePromise = null;
          if (this.context?.state === 'running') {
            this.syncMusicMode(true);
            this.flushPendingCues();
          }
        });
    }
  }

  public isRunning(): boolean {
    return this.context?.state === 'running';
  }

  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1.5, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0.0001, this.masterVolume * 1.16);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setMusicVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1.5, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = Math.max(0.0001, clampedVolume);
    }
  }

  public setSfxVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1.5, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0.0001, clampedVolume * 1.42);
    }
  }

  public setMusic(mode: MusicMode): void {
    this.desiredMusicMode = mode;
    this.syncMusicMode(false);
  }

  public setCombatContext(context: CombatCueContext): void {
    this.cueContext = context;
  }

  public play(cue: AudioCue): void {
    if (!this.context || !this.sfxGain || this.context.state !== 'running') {
      this.queueCue(cue);
      return;
    }

    const nowMs = performance.now();
    const profile = this.getProfile(cue);
    const lastPlayedAt = this.lastPlayedAt.get(cue) ?? 0;
    if (nowMs - lastPlayedAt < profile.cooldownMs) {
      return;
    }

    this.lastPlayedAt.set(cue, nowMs);
    this.cueCounts.set(cue, (this.cueCounts.get(cue) ?? 0) + 1);
    if (this.playPreviewCue(cue)) {
      this.applyCueDuck(cue);
      return;
    }
    profile.play(this.context, this.sfxGain, this.context.currentTime);
    this.applyCueDuck(cue);
  }

  public getDebugSnapshot(): PilotAudioDebugSnapshot {
    return {
      contextState: this.context?.state ?? 'uninitialized',
      desiredMusicMode: this.desiredMusicMode,
      currentMusicMode: this.currentMusicMode,
      masterVolume: Number(this.masterVolume.toFixed(2)),
      routeFocus: this.cueContext.routeFocus,
      encounter: this.cueContext.encounter,
      intensity: Number(this.cueContext.intensity.toFixed(2)),
      pendingCueCount: this.pendingCues.length,
      lastAudibleRms: Number(this.lastAudibleRms.toFixed(5)),
      peakRms: Number(this.peakRms.toFixed(5)),
      audibleMoments: this.audibleMoments,
      scheduledMusicSteps: this.scheduledMusicSteps,
      previewAudioEnabled: this.runtimeAudioPreviewEnabled,
      previewAudioReady: this.previewBuffers.size,
      previewAudioCueCounts: Object.fromEntries(this.previewCueCounts.entries()),
      cueCounts: Object.fromEntries(this.cueCounts.entries()),
    };
  }

  private ensureAudioGraph(): void {
    if (this.context) {
      return;
    }

    this.context = new AudioContext();

    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyserData = new Float32Array(new ArrayBuffer(this.analyser.fftSize * Float32Array.BYTES_PER_ELEMENT));

    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    this.masterGain.gain.value = Math.max(0.0001, this.masterVolume * 1.16);
    this.musicGain.gain.value = 0.0001;
    this.sfxGain.gain.value = 1.42;

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(compressor);
    compressor.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    this.startScheduler();
    this.startMeter();
    this.loadPreviewAudioAssets();
  }

  private loadPreviewAudioAssets(): void {
    if (!this.runtimeAudioPreviewEnabled || !this.context) {
      return;
    }

    for (const cue of Object.keys(PREVIEW_CUE_URLS) as AudioCue[]) {
      if (this.previewBuffers.has(cue) || this.loadingPreviewCues.has(cue)) {
        continue;
      }
      const url = PREVIEW_CUE_URLS[cue];
      if (!url) {
        continue;
      }

      this.loadingPreviewCues.add(cue);
      void fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(`Unable to load ${url}`))))
        .then((buffer) => this.context?.decodeAudioData(buffer))
        .then((audioBuffer) => {
          if (audioBuffer) {
            this.previewBuffers.set(cue, audioBuffer);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          this.loadingPreviewCues.delete(cue);
        });
    }
  }

  private playPreviewCue(cue: AudioCue): boolean {
    if (!this.runtimeAudioPreviewEnabled || !this.context || !this.sfxGain) {
      return false;
    }

    const buffer = this.previewBuffers.get(cue);
    if (!buffer) {
      this.loadPreviewAudioAssets();
      return false;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = this.getPreviewCueGain(cue);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start(this.context.currentTime);
    this.previewCueCounts.set(cue, (this.previewCueCounts.get(cue) ?? 0) + 1);
    return true;
  }

  private getPreviewCueGain(cue: AudioCue): number {
    // 使用音量映射表，如果没有定义则使用默认值0.7
    return CUE_VOLUME_MAP[cue] ?? 0.7;
  }

  private startScheduler(): void {
    if (this.schedulerHandle !== null) {
      return;
    }

    this.schedulerHandle = window.setInterval(() => {
      this.scheduleMusic();
    }, 120);
  }

  private startMeter(): void {
    if (this.meterHandle !== null) {
      return;
    }

    this.meterHandle = window.setInterval(() => {
      this.sampleOutputLevel();
    }, 90);
  }

  private sampleOutputLevel(): void {
    if (!this.analyser || !this.analyserData) {
      return;
    }

    this.analyser.getFloatTimeDomainData(this.analyserData);
    let sum = 0;
    for (const sample of this.analyserData) {
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / this.analyserData.length);
    this.lastAudibleRms = rms;
    if (rms > this.peakRms) {
      this.peakRms = rms;
    }
    if (rms >= RMS_AUDIBLE_THRESHOLD) {
      this.audibleMoments += 1;
    }
  }

  private scheduleMusic(): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running') {
      return;
    }

    this.syncMusicMode(false);
    const profile = this.getMusicProfile(this.currentMusicMode);
    if (!profile) {
      return;
    }

    while (this.nextMusicNoteTime < this.context.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleMusicStep(profile, this.musicStepIndex, this.nextMusicNoteTime);
      this.musicStepIndex = (this.musicStepIndex + 1) % profile.bass.length;
      this.nextMusicNoteTime += profile.stepSec;
    }
  }

  private scheduleMusicStep(profile: MusicProfile, stepIndex: number, at: number): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    const step = stepIndex % profile.bass.length;
    const bassMidi = profile.bass[step];
    const leadMidi = profile.lead[step];
    const accentMidi = profile.accent[step];

    if (bassMidi !== null) {
      const bassHz = midiToHz(bassMidi);
      createVoice(this.context, this.musicGain, at, {
        type: profile.bassType,
        frequency: bassHz,
        peak: profile.bassPeak,
        duration: profile.stepSec * 1.4,
        release: 0.08,
        sweepTo: bassHz * 0.985,
      });
      if (step % 4 === 0) {
        createVoice(this.context, this.musicGain, at, {
          type: 'sine',
          frequency: bassHz * 2,
          peak: profile.padPeak,
          duration: profile.stepSec * 3.2,
          release: 0.16,
          delay: 0.02,
          sweepTo: bassHz * 2.02,
        });
      }
    }

    if (leadMidi !== null) {
      const leadHz = midiToHz(leadMidi);
      createVoice(this.context, this.musicGain, at, {
        type: profile.leadType,
        frequency: leadHz,
        peak: profile.leadPeak,
        duration: profile.stepSec * 0.75,
        release: 0.06,
        delay: 0.01,
        sweepTo: leadHz * 1.018,
      });
    }

    if (accentMidi !== null) {
      const accentHz = midiToHz(accentMidi);
      createVoice(this.context, this.musicGain, at, {
        type: profile.accentType,
        frequency: accentHz,
        peak: profile.accentPeak,
        duration: profile.stepSec * 0.32,
        release: 0.04,
        delay: profile.stepSec * 0.34,
        sweepTo: accentHz * 0.996,
      });
    }

    this.scheduledMusicSteps += 1;
  }

  private syncMusicMode(forceReset: boolean): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running') {
      return;
    }

    if (!forceReset && this.currentMusicMode === this.desiredMusicMode) {
      return;
    }

    this.currentMusicMode = this.desiredMusicMode;
    this.musicStepIndex = 0;
    this.nextMusicNoteTime = this.context.currentTime + 0.02;

    const profile = this.getMusicProfile(this.currentMusicMode);
    const targetGain = profile?.gain ?? 0.0001;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.08);
  }

  private queueCue(cue: AudioCue): void {
    if (this.pendingCues[this.pendingCues.length - 1] === cue) {
      return;
    }
    if (this.pendingCues.length >= 12) {
      this.pendingCues.shift();
    }
    this.pendingCues.push(cue);
  }

  private flushPendingCues(): void {
    if (this.pendingCues.length === 0) {
      return;
    }

    const queued = [...this.pendingCues];
    this.pendingCues.length = 0;
    for (const cue of queued) {
      this.play(cue);
    }
  }

  private getMusicProfile(mode: MusicMode): MusicProfile | null {
    if (mode === 'silent') {
      return null;
    }
    return MUSIC_PROFILES[mode];
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.context) {
      return null;
    }
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const buffer = this.context.createBuffer(1, this.context.sampleRate * 1.2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private createNoiseBurst(
    context: AudioContext,
    destination: AudioNode,
    now: number,
    options: {
      peak: number;
      duration: number;
      delay?: number;
      filterType?: BiquadFilterType;
      frequency?: number;
      q?: number;
      pan?: number;
      playbackRate?: number;
    },
  ): void {
    const buffer = this.createNoiseBuffer();
    if (!buffer) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.playbackRate ?? 1;

    const filter = context.createBiquadFilter();
    filter.type = options.filterType ?? 'bandpass';
    filter.frequency.value = options.frequency ?? 1400;
    filter.Q.value = options.q ?? 0.8;

    const gain = context.createGain();
    const startAt = now + (options.delay ?? 0);
    const attackAt = startAt + Math.min(0.008, Math.max(0.002, options.duration * 0.18));
    const releaseAt = startAt + options.duration;
    const stopAt = releaseAt + 0.05;

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(options.peak, attackAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    source.connect(filter);
    connectWithOptionalPanner(context, filter, gain, options.pan ?? 0);
    gain.connect(destination);
    source.start(startAt);
    source.stop(stopAt);
  }

  private getRouteFrequencyShift(scale = 1): number {
    switch (this.cueContext.routeFocus) {
      case 'crit':
        return 24 * scale;
      case 'pierce':
        return 12 * scale;
      case 'dash':
        return -16 * scale;
      default:
        return 0;
    }
  }

  private getEncounterIntensity(): number {
    return Math.max(0, Math.min(1, this.cueContext.intensity));
  }

  private isHighPressureEncounter(): boolean {
    return this.cueContext.encounter === 'elite' || this.cueContext.encounter === 'boss';
  }

  private getCueVariant(cue: AudioCue, range: number): number {
    const count = this.cueCounts.get(cue) ?? 0;
    const phase = (count % 4) - 1.5;
    return (phase / 1.5) * range;
  }

  private duckMusic(amount: number, durationSec: number): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running') {
      return;
    }

    const profile = this.getMusicProfile(this.currentMusicMode);
    if (!profile) {
      return;
    }

    const now = this.context.currentTime;
    const baseGain = profile.gain;
    const duckedGain = Math.max(0.0001, baseGain * (1 - Math.min(0.78, Math.max(0, amount))));
    const currentGain = Math.max(0.0001, this.musicGain.gain.value);
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(currentGain, now);
    this.musicGain.gain.exponentialRampToValueAtTime(duckedGain, now + 0.014);
    this.musicGain.gain.exponentialRampToValueAtTime(baseGain, now + Math.max(0.04, durationSec));
  }

  private applyCueDuck(cue: AudioCue): void {
    switch (cue) {
      case 'shoot':
        this.duckMusic(0.05, 0.04);
        return;
      case 'abilityReady':
      case 'resume':
        this.duckMusic(0.08, 0.06);
        return;
      case 'dash':
        this.duckMusic(0.1, 0.075);
        return;
      case 'hit':
      case 'pierceHit':
      case 'dashHit':
      case 'critSplash':
      case 'pierceEcho':
      case 'dashPulse':
      case 'relayStandard':
      case 'relaySkirmisher':
      case 'relayRanged':
        this.duckMusic(0.14, 0.075);
        return;
      case 'enemyShot':
        this.duckMusic(this.isHighPressureEncounter() ? 0.22 : 0.16, 0.09);
        return;
      case 'nearMiss':
        this.duckMusic(0.2, 0.095);
        return;
      case 'kill':
      case 'crit':
      case 'relayBrute':
        this.duckMusic(0.22, 0.115);
        return;
      case 'pressure':
      case 'boss':
      case 'routeMatured':
      case 'eliteSpawn':
        this.duckMusic(this.cueContext.encounter === 'boss' ? 0.35 : 0.29, 0.17);
        return;
      case 'hurt':
      case 'lowHpWarning':
        this.duckMusic(0.46, 0.2);
        return;
      default:
        return;
    }
  }

  private createRelayCueProfile(family: 'standard' | 'skirmisher' | 'brute' | 'ranged'): CueProfile {
    switch (family) {
      case 'standard':
        return {
          cooldownMs: 125,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('relayStandard', 18);
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 248 + variant,
              peak: 0.038,
              duration: 0.055,
              sweepTo: 184 + variant * 0.3,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 430 + variant * 1.1,
              peak: 0.022,
              duration: 0.05,
              delay: 0.01,
              sweepTo: 300 + variant * 0.55,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.018,
              duration: 0.03,
              frequency: 1420 + variant * 5,
              q: 1.24,
              pan: variant * 0.006,
            });
          },
        };
      case 'skirmisher':
        return {
          cooldownMs: 130,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('relaySkirmisher', 22);
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 620 + variant,
              peak: 0.03,
              duration: 0.05,
              sweepTo: 860 + variant * 1.4,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 920 + variant * 1.6,
              peak: 0.018,
              duration: 0.055,
              delay: 0.012,
              sweepTo: 1220 + variant * 1.8,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.02,
              duration: 0.04,
              frequency: 2480 + variant * 7,
              q: 1.34,
              pan: variant * 0.008,
            });
          },
        };
      case 'brute':
        return {
          cooldownMs: 170,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('relayBrute', 14);
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 140 + variant,
              peak: 0.052,
              duration: 0.12,
              sweepTo: 96 + variant * 0.18,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 228 + variant,
              peak: 0.024,
              duration: 0.08,
              delay: 0.018,
              sweepTo: 170 + variant * 0.24,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.02,
              duration: 0.05,
              frequency: 860 + variant * 3,
              q: 0.86,
              pan: variant * 0.004,
            });
            createImpactThump(context, destination, now, {
              peak: 0.03,
              duration: 0.1,
              frequency: 82 + variant * 0.16,
              sweepTo: 48 + variant * 0.05,
              pan: variant * 0.004,
              type: 'triangle',
            });
          },
        };
      case 'ranged':
      default:
        return {
          cooldownMs: 140,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('relayRanged', 18);
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 338 + variant,
              peak: 0.032,
              duration: 0.05,
              sweepTo: 246 + variant * 0.34,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 820 + variant * 1.2,
              peak: 0.018,
              duration: 0.06,
              delay: 0.006,
              sweepTo: 620 + variant,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1180 + variant * 1.6,
              peak: 0.014,
              duration: 0.04,
              delay: 0.016,
              sweepTo: 980 + variant * 1.2,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.016,
              duration: 0.028,
              frequency: 2220 + variant * 6,
              q: 1.22,
              pan: variant * 0.008,
            });
          },
        };
    }
  }

  private getProfile(cue: AudioCue): CueProfile {
    switch (cue) {
      case 'click':
        return {
          cooldownMs: 60,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('click', 36);
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 720 + variant,
              peak: 0.048,
              duration: 0.06,
              sweepTo: 520 + variant * 0.4,
            });
          },
        };
      case 'confirm':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 460,
              peak: 0.045,
              duration: 0.08,
              sweepTo: 620,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 760,
              peak: 0.026,
              duration: 0.09,
              delay: 0.025,
              sweepTo: 920,
            });
          },
        };
      case 'start':
        return {
          cooldownMs: 600,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 280,
              peak: 0.05,
              duration: 0.18,
              sweepTo: 410,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 420,
              peak: 0.036,
              duration: 0.18,
              delay: 0.07,
              sweepTo: 620,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 620,
              peak: 0.028,
              duration: 0.2,
              delay: 0.13,
              sweepTo: 840,
            });
          },
        };
      case 'resume':
        return {
          cooldownMs: 180,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 320,
              peak: 0.036,
              duration: 0.09,
              sweepTo: 470,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 560,
              peak: 0.022,
              duration: 0.11,
              delay: 0.02,
              sweepTo: 740,
            });
          },
        };
      case 'upgrade':
        return {
          cooldownMs: 120,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 460,
              peak: 0.048,
              duration: 0.12,
              sweepTo: 760,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 760,
              peak: 0.03,
              duration: 0.14,
              delay: 0.03,
              sweepTo: 980,
            });
          },
        };
      case 'upgradeEquipped':
        return {
          cooldownMs: 120,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 250,
              peak: 0.044,
              duration: 0.1,
              sweepTo: 220,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 640,
              peak: 0.028,
              duration: 0.12,
              delay: 0.018,
              sweepTo: 860,
            });
          },
        };
      case 'anomaly':
        return {
          cooldownMs: 180,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 240,
              peak: 0.028,
              duration: 0.18,
              sweepTo: 330,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 660,
              peak: 0.03,
              duration: 0.2,
              delay: 0.035,
              sweepTo: 940,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 980,
              peak: 0.018,
              duration: 0.16,
              delay: 0.08,
              sweepTo: 780,
            });
          },
        };
      case 'boss':
        return {
          cooldownMs: 540,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 110,
              peak: 0.07,
              duration: 0.22,
              sweepTo: 82,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 280,
              peak: 0.04,
              duration: 0.18,
              delay: 0.04,
              sweepTo: 420,
            });
          },
        };
      case 'abilityReady':
        return {
          cooldownMs: 260,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520,
              peak: 0.032,
              duration: 0.08,
              sweepTo: 700,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 780,
              peak: 0.02,
              duration: 0.09,
              delay: 0.018,
              sweepTo: 980,
            });
          },
        };
      case 'shoot':
        return {
          cooldownMs: 70,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('shoot', 28);
            const routeShift = this.getRouteFrequencyShift();
            const encounterLift = this.isHighPressureEncounter() ? 0.008 + this.getEncounterIntensity() * 0.01 : 0;
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 240 + variant + routeShift,
              peak: 0.037 + encounterLift * 0.8,
              duration: 0.04 + encounterLift * 0.2,
              sweepTo: 170 + variant * 0.28 + routeShift * 0.2,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 640 + variant * 1.6 + routeShift * 0.5,
              peak: 0.022 + encounterLift * 0.46,
              duration: 0.05,
              delay: 0.006,
              sweepTo: 460 + variant + routeShift * 0.24,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.021 + encounterLift * 0.42,
              duration: this.cueContext.routeFocus === 'pierce' ? 0.046 : 0.036,
              frequency:
                this.cueContext.routeFocus === 'crit'
                  ? 2460 + variant * 8
                  : this.cueContext.routeFocus === 'pierce'
                    ? 2640 + variant * 10
                    : 2200 + variant * 8,
              q: this.cueContext.routeFocus === 'pierce' ? 1.38 : 1.1,
              pan: variant * 0.006,
            });
            if (this.cueContext.routeFocus === 'crit') {
              createVoice(context, destination, now, {
                type: 'sine',
                frequency: 940 + variant * 1.4,
                peak: 0.016 + encounterLift * 0.28,
                duration: 0.042,
                delay: 0.01,
                sweepTo: 1180 + variant * 1.8,
              });
            } else if (this.cueContext.routeFocus === 'pierce') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 980 + variant * 1.8,
                peak: 0.018 + encounterLift * 0.22,
                duration: 0.064,
                delay: 0.008,
                sweepTo: 760 + variant * 1.1,
              });
              createVoice(context, destination, now, {
                type: 'sine',
                frequency: 1320 + variant * 1.2,
                peak: 0.01 + this.getEncounterIntensity() * 0.006,
                duration: 0.082,
                delay: 0.018,
                sweepTo: 1040 + variant * 0.8,
              });
            } else if (this.cueContext.routeFocus === 'dash') {
              createImpactThump(context, destination, now, {
                peak: 0.024 + encounterLift * 0.24,
                duration: 0.068,
                frequency: 94 + variant * 0.18,
                sweepTo: 58 + variant * 0.05,
                pan: variant * 0.003,
                type: 'triangle',
              });
              createVoice(context, destination, now, {
                type: 'square',
                frequency: 420 + variant * 0.8,
                peak: 0.012 + encounterLift * 0.14,
                duration: 0.048,
                delay: 0.014,
                sweepTo: 310 + variant * 0.5,
              });
            }
          },
        };
      case 'dash':
        return {
          cooldownMs: 140,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('dash', 32);
            const encounterLift = this.isHighPressureEncounter() ? 0.008 + this.getEncounterIntensity() * 0.012 : 0;
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 180 + variant,
              peak: 0.046 + encounterLift,
              duration: 0.088,
              sweepTo: 320 + variant * 0.7,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520 + variant * 1.3,
              peak: 0.028 + encounterLift * 0.32,
              duration: 0.104,
              delay: 0.02,
              sweepTo: 760 + variant * 1.8,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.028 + encounterLift * 0.36,
              duration: 0.072,
              frequency: 1640 + variant * 8,
              q: 1.05,
              pan: variant * 0.007,
            });
            createImpactThump(context, destination, now, {
              peak: 0.042 + encounterLift * 0.8,
              duration: 0.11 + encounterLift * 0.4,
              frequency: 108 + variant * 0.24,
              sweepTo: 64 + variant * 0.08,
              pan: variant * 0.004,
              type: 'triangle',
            });
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 740 + variant * 1.1,
              peak: 0.014 + encounterLift * 0.18,
              duration: 0.06,
              delay: 0.016,
              sweepTo: 520 + variant * 0.7,
            });
          },
        };
      case 'hit':
        return {
          cooldownMs: 100,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('hit', 22);
            const routeShift = this.getRouteFrequencyShift(0.8);
            const encounterThump = this.isHighPressureEncounter() ? 0.006 + this.getEncounterIntensity() * 0.01 : 0;
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 190 + variant + routeShift,
              peak: 0.06 + encounterThump,
              duration: 0.036,
              sweepTo: 138 + variant * 0.22 + routeShift * 0.18,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 360 + variant + routeShift * 0.45,
              peak: 0.027 + encounterThump * 0.4,
              duration: 0.05,
              delay: 0.008,
              sweepTo: 250 + variant * 0.4 + routeShift * 0.24,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.032 + encounterThump * 0.5,
              duration: 0.036,
              frequency:
                this.cueContext.routeFocus === 'crit'
                  ? 1480 + variant * 6
                  : this.cueContext.routeFocus === 'pierce'
                    ? 1760 + variant * 7
                    : 1240 + variant * 5,
              q: this.cueContext.routeFocus === 'pierce' ? 1.55 : 1.4,
              pan: variant * 0.008,
            });
            createImpactThump(context, destination, now, {
              peak: 0.032 + encounterThump * 0.8,
              duration: 0.052 + encounterThump * 0.42,
              frequency: 104 + variant * 0.24 - (this.cueContext.routeFocus === 'dash' ? 8 : 0),
              sweepTo: 68 + variant * 0.08 - (this.cueContext.routeFocus === 'dash' ? 6 : 0),
              pan: variant * 0.006,
            });
            if (this.cueContext.routeFocus === 'crit') {
              createVoice(context, destination, now, {
                type: 'sine',
                frequency: 880 + variant * 1.2,
                peak: 0.014 + encounterThump * 0.22,
                duration: 0.05,
                delay: 0.01,
                sweepTo: 1180 + variant * 1.6,
              });
            } else if (this.cueContext.routeFocus === 'pierce') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 820 + variant * 1.3,
                peak: 0.018 + encounterThump * 0.22,
                duration: 0.076,
                delay: 0.008,
                sweepTo: 610 + variant * 0.8,
              });
              this.createNoiseBurst(context, destination, now, {
                peak: 0.014 + encounterThump * 0.18,
                duration: 0.054,
                delay: 0.018,
                frequency: 2460 + variant * 8,
                q: 1.9,
                pan: variant * 0.006,
              });
            } else if (this.cueContext.routeFocus === 'dash') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 560 + variant * 1.2,
                peak: 0.02 + encounterThump * 0.24,
                duration: 0.072,
                delay: 0.006,
                sweepTo: 410 + variant * 0.8,
              });
              createVoice(context, destination, now, {
                type: 'square',
                frequency: 880 + variant * 1.4,
                peak: 0.012 + encounterThump * 0.16,
                duration: 0.046,
                delay: 0.016,
                sweepTo: 620 + variant,
              });
              this.createNoiseBurst(context, destination, now, {
                peak: 0.012 + encounterThump * 0.16,
                duration: 0.036,
                delay: 0.014,
                frequency: 2140 + variant * 7,
                q: 1.48,
                pan: variant * 0.007,
              });
            }
          },
        };
      case 'hurt':
        return {
          cooldownMs: 120,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('hurt', 18);
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 138 + variant,
              peak: 0.092,
              duration: 0.075,
              sweepTo: 72 + variant * 0.12,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520 + variant * 1.2,
              peak: 0.042,
              duration: 0.064,
              delay: 0.006,
              sweepTo: 260 + variant * 0.26,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.052,
              duration: 0.052,
              frequency: 1180 + variant * 6,
              q: 1.1,
            });
            createImpactThump(context, destination, now, {
              peak: 0.058,
              duration: 0.16,
              frequency: 82 + variant * 0.16,
              sweepTo: 42 + variant * 0.05,
              type: 'triangle',
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1180 + variant * 1.4,
              peak: 0.018,
              duration: 0.045,
              delay: 0.018,
              sweepTo: 720 + variant * 0.8,
            });
          },
        };
      case 'pierceHit':
        return {
          cooldownMs: 86,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('pierceHit', 24);
            const encounterThump = this.isHighPressureEncounter() ? 0.005 + this.getEncounterIntensity() * 0.008 : 0;
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 760 + variant * 1.4,
              peak: 0.034 + encounterThump,
              duration: 0.07,
              sweepTo: 520 + variant * 0.8,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1320 + variant * 2,
              peak: 0.015 + encounterThump * 0.25,
              duration: 0.052,
              delay: 0.012,
              sweepTo: 980 + variant * 1.1,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.022 + encounterThump * 0.4,
              duration: 0.046,
              delay: 0.006,
              frequency: 2860 + variant * 9,
              q: 2.15,
              pan: variant * 0.007,
            });
            createImpactThump(context, destination, now, {
              peak: 0.02 + encounterThump * 0.55,
              duration: 0.048,
              frequency: 94 + variant * 0.12,
              sweepTo: 62 + variant * 0.04,
              pan: variant * 0.005,
            });
          },
        };
      case 'dashHit':
        return {
          cooldownMs: 92,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('dashHit', 22);
            const encounterThump = this.isHighPressureEncounter() ? 0.005 + this.getEncounterIntensity() * 0.008 : 0;
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520 + variant,
              peak: 0.035 + encounterThump,
              duration: 0.066,
              sweepTo: 330 + variant * 0.5,
            });
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 910 + variant * 1.6,
              peak: 0.014 + encounterThump * 0.24,
              duration: 0.044,
              delay: 0.014,
              sweepTo: 610 + variant * 0.9,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.018 + encounterThump * 0.36,
              duration: 0.034,
              delay: 0.01,
              frequency: 1960 + variant * 8,
              q: 1.55,
              pan: variant * 0.008,
            });
            createImpactThump(context, destination, now, {
              peak: 0.026 + encounterThump * 0.6,
              duration: 0.052,
              frequency: 82 + variant * 0.12,
              sweepTo: 48 + variant * 0.04,
              type: 'triangle',
              pan: variant * 0.004,
            });
          },
        };
      case 'critSplash':
        return {
          cooldownMs: 82,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('critSplash', 20);
            const routeBoost = this.cueContext.routeFocus === 'crit' ? 1 : 0;
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1040 + variant * 1.2 + routeBoost * 46,
              peak: 0.038,
              duration: 0.07,
              sweepTo: 1460 + variant * 1.8 + routeBoost * 54,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1460 + variant * 1.5 + routeBoost * 58,
              peak: 0.022,
              duration: 0.09,
              delay: 0.012,
              sweepTo: 1840 + variant * 1.9 + routeBoost * 62,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.025,
              duration: 0.042,
              frequency: 3160 + variant * 8 + routeBoost * 96,
              q: 1.45,
              pan: variant * 0.006,
            });
            createImpactThump(context, destination, now, {
              peak: 0.018,
              duration: 0.05,
              frequency: 118 + variant * 0.14,
              sweepTo: 76 + variant * 0.04,
              type: 'triangle',
            });
          },
        };
      case 'pierceEcho':
        return {
          cooldownMs: 84,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('pierceEcho', 18);
            const routeBoost = this.cueContext.routeFocus === 'pierce' ? 1 : 0;
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 720 + variant * 1.2 + routeBoost * 42,
              peak: 0.032,
              duration: 0.08,
              sweepTo: 500 + variant * 0.82 + routeBoost * 28,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1180 + variant * 1.6 + routeBoost * 52,
              peak: 0.019,
              duration: 0.07,
              delay: 0.01,
              sweepTo: 880 + variant * 1.1 + routeBoost * 36,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.02,
              duration: 0.038,
              frequency: 2500 + variant * 8 + routeBoost * 104,
              q: 1.95,
              pan: variant * 0.007,
            });
            createImpactThump(context, destination, now, {
              peak: 0.014,
              duration: 0.044,
              frequency: 96 + variant * 0.1,
              sweepTo: 70 + variant * 0.04,
              type: 'triangle',
              pan: variant * 0.004,
            });
          },
        };
      case 'dashPulse':
        return {
          cooldownMs: 80,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('dashPulse', 18);
            const routeBoost = this.cueContext.routeFocus === 'dash' ? 1 : 0;
            createImpactThump(context, destination, now, {
              peak: 0.04,
              duration: 0.09,
              frequency: 92 + variant * 0.14 + routeBoost * 10,
              sweepTo: 58 + variant * 0.04 + routeBoost * 4,
              type: 'triangle',
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 460 + variant * 0.8 + routeBoost * 36,
              peak: 0.024,
              duration: 0.08,
              delay: 0.01,
              sweepTo: 640 + variant * 1.1 + routeBoost * 46,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.016,
              duration: 0.03,
              frequency: 1980 + variant * 8 + routeBoost * 84,
              q: 1.4,
              pan: variant * 0.006,
            });
          },
        };
      case 'kill':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('kill', 26);
            const routeShift = this.getRouteFrequencyShift();
            const encounterLift = this.isHighPressureEncounter() ? 0.01 + this.getEncounterIntensity() * 0.012 : 0;
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 280 + variant + routeShift * 0.4,
              peak: 0.07 + encounterLift,
              duration: 0.078,
              sweepTo: 450 + variant * 1.4 + routeShift * 0.5,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 640 + variant * 1.8 + routeShift,
              peak: 0.044 + encounterLift * 0.46,
              duration: 0.092,
              delay: 0.014,
              sweepTo: 920 + variant * 2.1 + routeShift * 1.2,
            });
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 210 + variant * 0.8,
              peak: 0.024,
              duration: 0.05,
              delay: 0.01,
              sweepTo: 170 + variant * 0.4,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.034 + encounterLift * 0.42,
              duration: 0.058,
              frequency:
                this.cueContext.routeFocus === 'crit'
                  ? 2060 + variant * 7
                  : this.cueContext.routeFocus === 'pierce'
                    ? 2280 + variant * 7
                    : 1760 + variant * 6,
              q: this.cueContext.routeFocus === 'pierce' ? 1.28 : 1.1,
              pan: variant * 0.007,
            });
            createImpactThump(context, destination, now, {
              peak: 0.029 + encounterLift * 0.56,
              duration: 0.078 + encounterLift * 0.5,
              frequency: 116 + variant * 0.16 - (this.cueContext.routeFocus === 'dash' ? 6 : 0),
              sweepTo: 72 + variant * 0.05 - (this.cueContext.routeFocus === 'dash' ? 5 : 0),
              pan: variant * 0.005,
            });
            if (this.cueContext.routeFocus === 'crit') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 1120 + variant * 2,
                peak: 0.02 + encounterLift * 0.22,
                duration: 0.08,
                delay: 0.028,
                sweepTo: 1480 + variant * 2.4,
              });
            } else if (this.cueContext.routeFocus === 'pierce') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 760 + variant * 1.4,
                peak: 0.021 + encounterLift * 0.18,
                duration: 0.12,
                delay: 0.02,
                sweepTo: 560 + variant,
              });
              createVoice(context, destination, now, {
                type: 'sine',
                frequency: 1420 + variant * 1.8,
                peak: 0.014 + encounterLift * 0.12,
                duration: 0.095,
                delay: 0.035,
                sweepTo: 1040 + variant * 1.1,
              });
            } else if (this.cueContext.routeFocus === 'dash') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 520 + variant * 1.1,
                peak: 0.022 + encounterLift * 0.22,
                duration: 0.12,
                delay: 0.012,
                sweepTo: 340 + variant * 0.72,
              });
              createVoice(context, destination, now, {
                type: 'sine',
                frequency: 980 + variant * 1.7,
                peak: 0.016 + encounterLift * 0.16,
                duration: 0.085,
                delay: 0.02,
                sweepTo: 720 + variant * 1.1,
              });
              this.createNoiseBurst(context, destination, now, {
                peak: 0.012 + encounterLift * 0.12,
                duration: 0.05,
                delay: 0.018,
                frequency: 1880 + variant * 6,
                q: 1.22,
                pan: variant * 0.007,
              });
            }
          },
        };
      case 'pickup':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('pickup', 18);
            const routeShift = this.getRouteFrequencyShift(0.7);
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520 + variant + routeShift * 0.4,
              peak: 0.044,
              duration: 0.084,
              sweepTo: 760 + variant * 1.2 + routeShift * 0.8,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 820 + variant * 1.4 + routeShift,
              peak: 0.034,
              duration: 0.092,
              delay: 0.014,
              sweepTo: 1060 + variant * 1.6 + routeShift * 1.2,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1120 + variant * 1.8 + routeShift * 0.6,
              peak: 0.02,
              duration: 0.046,
              delay: 0.028,
              sweepTo: 1320 + variant * 2 + routeShift * 0.8,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.013,
              duration: 0.024,
              frequency: 2800 + variant * 8,
              q: 1.5,
              pan: variant * 0.008,
            });
            if (this.cueContext.routeFocus === 'pierce') {
              createVoice(context, destination, now, {
                type: 'triangle',
                frequency: 680 + variant * 1.2,
                peak: 0.015,
                duration: 0.095,
                delay: 0.01,
                sweepTo: 980 + variant * 1.6,
              });
              this.createNoiseBurst(context, destination, now, {
                peak: 0.011,
                duration: 0.034,
                delay: 0.03,
                frequency: 3020 + variant * 8,
                q: 1.7,
                pan: variant * 0.006,
              });
            } else if (this.cueContext.routeFocus === 'dash') {
              createImpactThump(context, destination, now, {
                peak: 0.012,
                duration: 0.05,
                frequency: 96 + variant * 0.14,
                sweepTo: 68 + variant * 0.05,
                type: 'triangle',
              });
            }
          },
        };
      case 'crit':
        return {
          cooldownMs: 115,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('crit', 34);
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 820 + variant * 1.2,
              peak: 0.055,
              duration: 0.1,
              sweepTo: 1120 + variant * 2.2,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1120 + variant * 1.8,
              peak: 0.038,
              duration: 0.11,
              delay: 0.016,
              sweepTo: 1380 + variant * 2.4,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1460 + variant * 2.1,
              peak: 0.016,
              duration: 0.07,
              delay: 0.022,
              sweepTo: 1710 + variant * 2.8,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.034,
              duration: 0.05,
              frequency: 2400 + variant * 9,
              q: 1.35,
              pan: variant * 0.006,
            });
            createImpactThump(context, destination, now, {
              peak: 0.024,
              duration: 0.068,
              frequency: 132 + variant * 0.2,
              sweepTo: 84 + variant * 0.05,
              pan: variant * 0.004,
            });
          },
        };
      case 'enemyShot':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('enemyShot', 20);
            const encounterBoost = this.isHighPressureEncounter() ? 0.008 + this.getEncounterIntensity() * 0.014 : 0;
            createVoice(context, destination, now, {
              type: 'square',
              frequency: this.cueContext.encounter === 'boss' ? 250 + variant : 300 + variant,
              peak: 0.046 + encounterBoost,
              duration: 0.058 + encounterBoost * 0.3,
              sweepTo: this.cueContext.encounter === 'boss' ? 176 + variant * 0.28 : 214 + variant * 0.36,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 720 + variant * 1.2,
              peak: 0.026 + encounterBoost * 0.4,
              duration: 0.065,
              delay: 0.004,
              sweepTo: 560 + variant,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.025 + encounterBoost * 0.42,
              duration: this.isHighPressureEncounter() ? 0.052 : 0.042,
              frequency: this.cueContext.encounter === 'boss' ? 1380 + variant * 5 : this.isHighPressureEncounter() ? 1620 + variant * 5 : 1880 + variant * 5,
              q: this.isHighPressureEncounter() ? 1.04 : 1.2,
              pan: variant * 0.009,
            });
            if (this.isHighPressureEncounter()) {
              createImpactThump(context, destination, now, {
                peak: 0.021 + encounterBoost * 0.3,
                duration: 0.07,
                frequency: 98 + variant * 0.12,
                sweepTo: 64 + variant * 0.04,
                pan: variant * 0.004,
                type: 'triangle',
              });
            }
          },
        };
      case 'nearMiss':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('nearMiss', 18);
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 940 + variant,
              peak: 0.03,
              duration: 0.044,
              sweepTo: 1320 + variant * 1.6,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1480 + variant * 1.8,
              peak: 0.018,
              duration: 0.048,
              delay: 0.01,
              sweepTo: 1960 + variant * 2.2,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1420 + variant * 1.8,
              peak: 0.012,
              duration: 0.04,
              delay: 0.018,
              sweepTo: 1180 + variant,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.021,
              duration: 0.028,
              frequency: 3300 + variant * 8,
              q: 1.75,
              pan: variant * 0.008,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1360 + variant * 1.4,
              peak: 0.01,
              duration: 0.032,
              delay: 0.012,
              sweepTo: 1720 + variant * 1.8,
            });
          },
        };
      case 'relayStandard':
        return this.createRelayCueProfile('standard');
      case 'relaySkirmisher':
        return this.createRelayCueProfile('skirmisher');
      case 'relayBrute':
        return this.createRelayCueProfile('brute');
      case 'relayRanged':
        return this.createRelayCueProfile('ranged');
      case 'pressure':
        return {
          cooldownMs: 220,
          play: (context, destination, now) => {
            const variant = this.getCueVariant('pressure', 16);
            const encounterBoost = this.isHighPressureEncounter() ? 0.014 + this.getEncounterIntensity() * 0.022 : 0;
            const bossDrop = this.cueContext.encounter === 'boss' ? 22 : 0;
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 150 + variant - bossDrop,
              peak: 0.07 + encounterBoost,
              duration: 0.22 + encounterBoost * 0.62,
              sweepTo: 96 + variant * 0.18 - bossDrop * 0.55,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 220 + variant - bossDrop * 0.5,
              peak: 0.034 + encounterBoost * 0.52,
              duration: 0.17,
              delay: 0.02,
              sweepTo: 132 + variant * 0.26 - bossDrop * 0.42,
            });
            this.createNoiseBurst(context, destination, now, {
              peak: 0.03 + encounterBoost * 0.45,
              duration: this.isHighPressureEncounter() ? 0.09 : 0.08,
              frequency: this.cueContext.encounter === 'boss' ? 920 + variant * 4 : 1080 + variant * 4,
              q: this.cueContext.encounter === 'boss' ? 0.74 : 0.88,
            });
            createImpactThump(context, destination, now, {
              peak: 0.035 + encounterBoost * 0.78,
              duration: 0.14 + encounterBoost * 0.8,
              frequency: 82 + variant * 0.14 - (this.cueContext.encounter === 'boss' ? 8 : 0),
              sweepTo: 44 + variant * 0.03 - (this.cueContext.encounter === 'boss' ? 6 : 0),
              type: 'triangle',
            });
          },
        };
      case 'lowHpWarning':
        return {
          cooldownMs: 420,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 210,
              peak: 0.032,
              duration: 0.12,
              sweepTo: 180,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 420,
              peak: 0.018,
              duration: 0.1,
              delay: 0.025,
              sweepTo: 360,
            });
          },
        };
      case 'routeMatured':
        return {
          cooldownMs: 680,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 340,
              peak: 0.046,
              duration: 0.16,
              sweepTo: 520,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 620,
              peak: 0.028,
              duration: 0.18,
              delay: 0.035,
              sweepTo: 880,
            });
          },
        };
      case 'eliteSpawn':
        return {
          cooldownMs: 560,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 180,
              peak: 0.05,
              duration: 0.18,
              sweepTo: 128,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 320,
              peak: 0.026,
              duration: 0.14,
              delay: 0.026,
              sweepTo: 250,
            });
          },
        };
      case 'victory':
        return {
          cooldownMs: 760,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 260,
              peak: 0.05,
              duration: 0.22,
              sweepTo: 370,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 400,
              peak: 0.034,
              duration: 0.22,
              delay: 0.09,
              sweepTo: 560,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 600,
              peak: 0.028,
              duration: 0.24,
              delay: 0.18,
              sweepTo: 860,
            });
          },
        };
      case 'defeat':
        return {
          cooldownMs: 760,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 260,
              peak: 0.048,
              duration: 0.2,
              sweepTo: 160,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 160,
              peak: 0.028,
              duration: 0.24,
              delay: 0.06,
              sweepTo: 92,
            });
          },
        };
      case 'result':
        return {
          cooldownMs: 340,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 320,
              peak: 0.046,
              duration: 0.22,
              sweepTo: 430,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 450,
              peak: 0.034,
              duration: 0.24,
              delay: 0.12,
              sweepTo: 680,
            });
          },
        };
    }
  }
}
