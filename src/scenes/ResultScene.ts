import Phaser from 'phaser';
import type { RunResult, Services } from '../game/types';

export class ResultScene extends Phaser.Scene {
  public constructor() {
    super('ResultScene');
  }

  public create(data: { result: RunResult }): void {
    const services = this.game.registry.get('services') as Services;
    services.overlay.showResult(data.result, {
      onRestart: () => {
        services.audio.unlock();
        services.audio.play('click');
        services.metrics.beginRunFromRestart();
        this.scene.start('GameScene');
      },
      onBackToMenu: () => {
        services.audio.play('click');
        this.scene.start('MainMenuScene');
      },
      onExport: () => {
        services.audio.play('click');
        const content = window.__exportPilotMetrics();
        navigator.clipboard.writeText(content).catch(() => undefined);
        services.overlay.pushToast('埋点已导出到剪贴板');
      },
    });
  }
}
