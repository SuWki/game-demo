import Phaser from 'phaser';
import type { RunResult, Services } from '../game/types';
import { setRNGSeed } from '../utils/rng';

export class ResultScene extends Phaser.Scene {
  public constructor() {
    super('ResultScene');
  }

  public create(data: { result: RunResult }): void {
    const services = this.game.registry.get('services') as Services;
    this.cameras.main.fadeIn(220, 6, 12, 18);
    services.audio.unlock();
    services.audio.setMusic('result');
    services.audio.play('result');
    services.overlay.showResult(data.result, {
      onRestart: () => {
        services.audio.unlock();
        services.audio.play('start');
        services.metrics.beginRunFromRestart();
        // 确保每局使用不同种子
        setRNGSeed(Date.now() + Math.floor(performance.now() * 1000));
        this.cameras.main.fadeOut(160, 6, 12, 18);
        this.time.delayedCall(170, () => {
          this.scene.start('GameScene');
        });
      },
      onBackToMenu: () => {
        services.audio.unlock();
        services.audio.play('click');
        this.cameras.main.fadeOut(140, 6, 12, 18);
        this.time.delayedCall(150, () => {
          this.scene.start('MainMenuScene');
        });
      },
    });
  }
}
