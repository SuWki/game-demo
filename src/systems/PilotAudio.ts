import type { AudioCue } from '../game/types';

export class PilotAudio {
  private context: AudioContext | null = null;

  public unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  public play(cue: AudioCue): void {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    let duration = 0.08;

    switch (cue) {
      case 'click':
        oscillator.frequency.value = 420;
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        duration = 0.08;
        break;
      case 'upgrade':
        oscillator.frequency.value = 560;
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        duration = 0.12;
        break;
      case 'hit':
        oscillator.frequency.value = 240;
        gain.gain.setValueAtTime(0.015, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        duration = 0.06;
        break;
      case 'crit':
        oscillator.frequency.value = 760;
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        duration = 0.14;
        break;
      case 'pressure':
        oscillator.frequency.value = 180;
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        duration = 0.18;
        break;
      case 'result':
        oscillator.frequency.value = 320;
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        duration = 0.26;
        break;
    }

    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
