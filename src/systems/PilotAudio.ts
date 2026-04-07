import type { AudioCue } from '../game/types';

interface CueProfile {
  cooldownMs: number;
  play: (context: AudioContext, masterGain: GainNode, now: number) => number;
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
  const releaseAt = startAt + options.duration;

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  if (options.sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(options.sweepTo, releaseAt);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.peak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + (options.release ?? 0.02));

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(releaseAt + (options.release ?? 0.02));
}

export class PilotAudio {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private readonly lastPlayedAt = new Map<AudioCue, number>();

  public unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.36;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  public play(cue: AudioCue): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const nowMs = performance.now();
    const profile = this.getProfile(cue);
    const lastPlayedAt = this.lastPlayedAt.get(cue) ?? 0;
    if (nowMs - lastPlayedAt < profile.cooldownMs) {
      return;
    }

    this.lastPlayedAt.set(cue, nowMs);
    profile.play(this.context, this.masterGain, this.context.currentTime);
  }

  private getProfile(cue: AudioCue): CueProfile {
    switch (cue) {
      case 'click':
        return {
          cooldownMs: 40,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 510,
              peak: 0.032,
              duration: 0.045,
              sweepTo: 410,
            });
            return 0.07;
          },
        };
      case 'confirm':
        return {
          cooldownMs: 70,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 420,
              peak: 0.028,
              duration: 0.055,
              sweepTo: 580,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 720,
              peak: 0.016,
              duration: 0.06,
              delay: 0.02,
              sweepTo: 860,
            });
            return 0.1;
          },
        };
      case 'start':
        return {
          cooldownMs: 500,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 300,
              peak: 0.03,
              duration: 0.14,
              sweepTo: 430,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 430,
              peak: 0.024,
              duration: 0.16,
              delay: 0.05,
              sweepTo: 620,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 620,
              peak: 0.02,
              duration: 0.16,
              delay: 0.1,
              sweepTo: 820,
            });
            return 0.22;
          },
        };
      case 'upgrade':
        return {
          cooldownMs: 100,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 440,
              peak: 0.028,
              duration: 0.12,
              sweepTo: 700,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 690,
              peak: 0.022,
              duration: 0.1,
              delay: 0.03,
              sweepTo: 940,
            });
            return 0.16;
          },
        };
      case 'anomaly':
        return {
          cooldownMs: 180,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 250,
              peak: 0.022,
              duration: 0.16,
              sweepTo: 340,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 640,
              peak: 0.024,
              duration: 0.18,
              delay: 0.04,
              sweepTo: 930,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 920,
              peak: 0.014,
              duration: 0.12,
              delay: 0.08,
              sweepTo: 760,
            });
            return 0.24;
          },
        };
      case 'boss':
        return {
          cooldownMs: 520,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'sawtooth',
              frequency: 126,
              peak: 0.042,
              duration: 0.2,
              sweepTo: 88,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 340,
              peak: 0.024,
              duration: 0.18,
              delay: 0.04,
              sweepTo: 480,
            });
            return 0.26;
          },
        };
      case 'hit':
        return {
          cooldownMs: 70,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'square',
              frequency: 190,
              peak: 0.011,
              duration: 0.025,
              sweepTo: 150,
            });
            return 0.05;
          },
        };
      case 'crit':
        return {
          cooldownMs: 80,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 760,
              peak: 0.034,
              duration: 0.08,
              sweepTo: 1020,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 1010,
              peak: 0.024,
              duration: 0.1,
              delay: 0.015,
              sweepTo: 1280,
            });
            return 0.12;
          },
        };
      case 'pressure':
        return {
          cooldownMs: 160,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'sawtooth',
              frequency: 140,
              peak: 0.04,
              duration: 0.18,
              sweepTo: 96,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 230,
              peak: 0.017,
              duration: 0.16,
              delay: 0.02,
              sweepTo: 150,
            });
            return 0.2;
          },
        };
      case 'victory':
        return {
          cooldownMs: 700,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 260,
              peak: 0.032,
              duration: 0.18,
              sweepTo: 360,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 390,
              peak: 0.026,
              duration: 0.2,
              delay: 0.08,
              sweepTo: 540,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 580,
              peak: 0.022,
              duration: 0.22,
              delay: 0.16,
              sweepTo: 820,
            });
            return 0.34;
          },
        };
      case 'defeat':
        return {
          cooldownMs: 700,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'sawtooth',
              frequency: 280,
              peak: 0.032,
              duration: 0.18,
              sweepTo: 180,
            });
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 180,
              peak: 0.02,
              duration: 0.22,
              delay: 0.06,
              sweepTo: 108,
            });
            return 0.3;
          },
        };
      case 'result':
        return {
          cooldownMs: 300,
          play: (context, masterGain, now) => {
            createVoice(context, masterGain, now, {
              type: 'triangle',
              frequency: 300,
              peak: 0.034,
              duration: 0.2,
              sweepTo: 410,
            });
            createVoice(context, masterGain, now, {
              type: 'sine',
              frequency: 430,
              peak: 0.03,
              duration: 0.24,
              delay: 0.12,
              sweepTo: 660,
            });
            return 0.32;
          },
        };
    }
  }
}
