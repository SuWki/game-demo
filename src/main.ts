import Phaser from 'phaser';
import './style.css';
import type { Services } from './game/types';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ResultScene } from './scenes/ResultScene';
import { MetaProgression } from './systems/MetaProgression';
import { MetricsTracker } from './systems/MetricsTracker';
import { PilotAudio } from './systems/PilotAudio';
import { OverlayController } from './ui/OverlayController';

declare global {
  interface Window {
    __pilotAudioDebug?: () => ReturnType<PilotAudio['getDebugSnapshot']>;
  }
}

const uiRoot = document.getElementById('ui-root');
const phaserRoot = document.getElementById('phaser-root');

if (!uiRoot || !phaserRoot) {
  throw new Error('Game shell is missing.');
}

const overlay = new OverlayController(uiRoot);
const metrics = new MetricsTracker(window.localStorage);
metrics.attachToWindow(window);

const services: Services = {
  overlay,
  metrics,
  meta: new MetaProgression(window.localStorage),
  audio: new PilotAudio(),
};

window.__pilotAudioDebug = () => services.audio.getDebugSnapshot();

const unlockAudio = () => {
  services.audio.unlock();
  if (services.audio.isRunning()) {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
};

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: phaserRoot,
  backgroundColor: '#09101a',
  scene: [BootScene, MainMenuScene, GameScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.registry.set('services', services);
