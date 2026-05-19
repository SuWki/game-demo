import Phaser from 'phaser';
import './style.css';
import './style-space-combat.css';
import type { BattleTemplateId, Services } from './game/types';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ResultScene } from './scenes/ResultScene';
import { MetaProgression } from './systems/MetaProgression';
import { MetricsTracker } from './systems/MetricsTracker';
import { PilotAudio } from './systems/PilotAudio';
import { ConfigLoader } from './systems/ConfigLoader';
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
    __pilotQaForceBoss?: (templateId: BattleTemplateId) => void;
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

// 初始化配置加载器并预加载
const configLoader = new ConfigLoader();
await configLoader.preloadCore();

const services: Services = {
  overlay,
  debugPanel,
  metrics,
  meta: new MetaProgression(window.localStorage),
  audio: new PilotAudio(),
  configLoader,
};

const savedAudioVolume = Number(window.localStorage.getItem('pilot-audio-volume'));
const defaultAudioVolume = 0.4;
services.audio.setVolume(Number.isFinite(savedAudioVolume) && savedAudioVolume > 0 ? savedAudioVolume : defaultAudioVolume);

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

window.__pilotQaForceBoss = (templateId) => {
  const validBossTemplates = ['boss-bastion', 'boss-hunt', 'boss-lockdown'];
  if (!validBossTemplates.includes(templateId)) {
    // eslint-disable-next-line no-console
    console.warn(`[QA] Invalid boss template: ${templateId}. Valid: ${validBossTemplates.join(', ')}`);
    return;
  }
  window.localStorage.setItem('pilot-qa-force-boss', templateId);
  const menuScene = game.scene.getScene('MainMenuScene');
  if (menuScene) {
    menuScene.scene.start('GameScene');
    // eslint-disable-next-line no-console
    console.log(`[QA] Starting GameScene with forced boss: ${templateId}`);
    return;
  }
  const gameScene = game.scene.getScene('GameScene');
  if (gameScene instanceof GameScene) {
    try {
      gameScene.restartDebugBattle(templateId, 'finalBattle');
      // eslint-disable-next-line no-console
      console.log(`[QA] Forced boss battle restarted: ${templateId}`);
    } catch {
      // Scene exists but may not be fully created yet; rely on create() auto-trigger
      // eslint-disable-next-line no-console
      console.log(`[QA] GameScene not ready yet; will auto-trigger on create: ${templateId}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`[QA] Stored forced boss template. Start the game to trigger: ${templateId}`);
  }
};
