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
  pendingCueCount: number;
  lastAudibleRms: number;
  peakRms: number;
  audibleMoments: number;
  scheduledMusicSteps: number;
  cueCounts: Partial<Record<AudioCue, number>>;
}

const SCHEDULE_AHEAD_SEC = 0.42;
const RMS_AUDIBLE_THRESHOLD = 0.0035;

const MUSIC_PROFILES: Record<Exclude<MusicMode, 'silent'>, MusicProfile> = {
  menu: {
    stepSec: 0.34,
    gain: 0.38,
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
    gain: 0.44,
    bassType: 'sawtooth',
    leadType: 'triangle',
    accentType: 'square',
    bassPeak: 0.076,
    leadPeak: 0.032,
    accentPeak: 0.02,
    padPeak: 0.016,
    bass: [38, null, 38, null, 41, null, 43, null, 36, null, 38, null, 41, null, 43, null],
    lead: [53, null, 56, null, 58, null, 60, null, 53, null, 56, null, 60, null, 63, null],
    accent: [65, null, null, null, 68, null, null, null, 65, null, null, null, 70, null, null, null],
  },
  boss: {
    stepSec: 0.22,
    gain: 0.48,
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
    gain: 0.34,
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

export class PilotAudio {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private musicGain: GainNode | null = null;

  private sfxGain: GainNode | null = null;

  private analyser: AnalyserNode | null = null;

  private analyserData: Float32Array<ArrayBuffer> | null = null;

  private readonly lastPlayedAt = new Map<AudioCue, number>();

  private readonly cueCounts = new Map<AudioCue, number>();

  private readonly pendingCues: AudioCue[] = [];

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

  public setMusic(mode: MusicMode): void {
    this.desiredMusicMode = mode;
    this.syncMusicMode(false);
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
    profile.play(this.context, this.sfxGain, this.context.currentTime);
  }

  public getDebugSnapshot(): PilotAudioDebugSnapshot {
    return {
      contextState: this.context?.state ?? 'uninitialized',
      desiredMusicMode: this.desiredMusicMode,
      currentMusicMode: this.currentMusicMode,
      pendingCueCount: this.pendingCues.length,
      lastAudibleRms: Number(this.lastAudibleRms.toFixed(5)),
      peakRms: Number(this.peakRms.toFixed(5)),
      audibleMoments: this.audibleMoments,
      scheduledMusicSteps: this.scheduledMusicSteps,
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

    this.masterGain.gain.value = 1.02;
    this.musicGain.gain.value = 0.0001;
    this.sfxGain.gain.value = 1.18;

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(compressor);
    compressor.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    this.startScheduler();
    this.startMeter();
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

  private getProfile(cue: AudioCue): CueProfile {
    switch (cue) {
      case 'click':
        return {
          cooldownMs: 60,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 720,
              peak: 0.048,
              duration: 0.06,
              sweepTo: 520,
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
      case 'dash':
        return {
          cooldownMs: 140,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 180,
              peak: 0.04,
              duration: 0.08,
              sweepTo: 320,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520,
              peak: 0.026,
              duration: 0.1,
              delay: 0.02,
              sweepTo: 760,
            });
          },
        };
      case 'hit':
        return {
          cooldownMs: 100,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 190,
              peak: 0.048,
              duration: 0.04,
              sweepTo: 138,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 360,
              peak: 0.023,
              duration: 0.05,
              delay: 0.008,
              sweepTo: 250,
            });
          },
        };
      case 'kill':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 280,
              peak: 0.058,
              duration: 0.075,
              sweepTo: 450,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 640,
              peak: 0.036,
              duration: 0.09,
              delay: 0.014,
              sweepTo: 920,
            });
            createVoice(context, destination, now, {
              type: 'square',
              frequency: 210,
              peak: 0.02,
              duration: 0.05,
              delay: 0.01,
              sweepTo: 170,
            });
          },
        };
      case 'pickup':
        return {
          cooldownMs: 90,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 520,
              peak: 0.042,
              duration: 0.09,
              sweepTo: 760,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 820,
              peak: 0.032,
              duration: 0.1,
              delay: 0.014,
              sweepTo: 1060,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1120,
              peak: 0.019,
              duration: 0.05,
              delay: 0.028,
              sweepTo: 1320,
            });
          },
        };
      case 'crit':
        return {
          cooldownMs: 115,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 820,
              peak: 0.055,
              duration: 0.1,
              sweepTo: 1120,
            });
            createVoice(context, destination, now, {
              type: 'sine',
              frequency: 1120,
              peak: 0.038,
              duration: 0.11,
              delay: 0.016,
              sweepTo: 1380,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 1460,
              peak: 0.016,
              duration: 0.07,
              delay: 0.022,
              sweepTo: 1710,
            });
          },
        };
      case 'pressure':
        return {
          cooldownMs: 220,
          play: (context, destination, now) => {
            createVoice(context, destination, now, {
              type: 'sawtooth',
              frequency: 150,
              peak: 0.06,
              duration: 0.18,
              sweepTo: 100,
            });
            createVoice(context, destination, now, {
              type: 'triangle',
              frequency: 235,
              peak: 0.03,
              duration: 0.14,
              delay: 0.02,
              sweepTo: 152,
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
