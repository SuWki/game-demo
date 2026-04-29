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
import { BattleDebugPanel } from './ui/BattleDebugPanel';
import { OverlayController } from './ui/OverlayController';

declare global {
  interface Window {
    __pilotAudioDebug?: () => ReturnType<PilotAudio['getDebugSnapshot']>;
    __pilotBattleDebug?: () => ReturnType<GameScene['getBattleDebugSnapshot']> | null;
    __pilotDebug?: {
      getConfig: () => ReturnType<GameScene['getDebugConfig']> | null;
      getSnapshot: () => ReturnType<GameScene['getBattleDebugSnapshot']> | null;
      setConfig: (patch: Partial<ReturnType<GameScene['getDebugConfig']>>) => void;
      restartBattle: (options?: Partial<Pick<ReturnType<GameScene['getDebugConfig']>, 'templateId' | 'phase'>>) => void;
      setPressureState: (options: {
        eliteHpRatio?: number;
        remainingSec?: number;
        pressurePhaseElapsedSec?: number;
      }) => boolean;
      togglePanel: () => void;
    };
  }
}

const uiRoot = document.getElementById('ui-root');
const phaserRoot = document.getElementById('phaser-root');

if (!uiRoot || !phaserRoot) {
  throw new Error('Game shell is missing.');
}

const overlay = new OverlayController(uiRoot);
const debugPanel = new BattleDebugPanel(uiRoot);
const metrics = new MetricsTracker(window.localStorage);
metrics.attachToWindow(window);

const services: Services = {
  overlay,
  debugPanel,
  metrics,
  meta: new MetaProgression(window.localStorage),
  audio: new PilotAudio(),
};

const savedAudioVolume = Number(window.localStorage.getItem('pilot-audio-volume'));
services.audio.setVolume(Number.isFinite(savedAudioVolume) ? savedAudioVolume : 1);

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
  backgroundColor: '#06111a',
  scene: [BootScene, MainMenuScene, GameScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.registry.set('services', services);
window.__pilotBattleDebug = () => {
  try {
    const scene = game.scene.getScene('GameScene');
    return scene instanceof GameScene ? scene.getBattleDebugSnapshot() : null;
  } catch {
    return null;
  }
};
window.__pilotDebug = {
  getConfig: () => {
    try {
      const scene = game.scene.getScene('GameScene');
      return scene instanceof GameScene ? scene.getDebugConfig() : null;
    } catch {
      return null;
    }
  },
  getSnapshot: () => {
    try {
      const scene = game.scene.getScene('GameScene');
      return scene instanceof GameScene ? scene.getBattleDebugSnapshot() : null;
    } catch {
      return null;
    }
  },
  setConfig: (patch) => {
    try {
      const scene = game.scene.getScene('GameScene');
      if (scene instanceof GameScene) {
        scene.updateDebugConfig(patch);
      }
    } catch {
      // Ignore when GameScene is not active.
    }
  },
  restartBattle: (options) => {
    try {
      const scene = game.scene.getScene('GameScene');
      if (scene instanceof GameScene) {
        const config = scene.getDebugConfig();
        scene.restartDebugBattle(options?.templateId ?? config.templateId, options?.phase ?? config.phase);
      }
    } catch {
      // Ignore when GameScene is not active.
    }
  },
  setPressureState: (options) => {
    try {
      const scene = game.scene.getScene('GameScene');
      return scene instanceof GameScene ? scene.setDebugBattlePressureState(options) : false;
    } catch {
      return false;
    }
  },
  togglePanel: () => {
    try {
      const scene = game.scene.getScene('GameScene');
      if (scene instanceof GameScene) {
        scene.toggleDebugPanel();
      }
    } catch {
      // Ignore when GameScene is not active.
    }
  },
};
