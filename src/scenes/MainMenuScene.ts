import Phaser from 'phaser';
import type { Services } from '../game/types';

export class MainMenuScene extends Phaser.Scene {
  public constructor() {
    super('MainMenuScene');
  }

  public create(): void {
    const services = this.game.registry.get('services') as Services;
    services.audio.setMusic('menu');
    services.overlay.showMenu(
      services.meta.getSummary(),
      () => {
        services.audio.unlock();
        services.audio.play('start');
        services.metrics.beginRunFromMenu();
        services.overlay.pushToast('试飞开始', 'accent');
        this.scene.start('GameScene');
      },
      () => {
        services.audio.unlock();
        services.audio.play('click');
        const content = window.__exportPilotMetrics();
        navigator.clipboard.writeText(content).catch(() => undefined);
        services.overlay.pushToast('埋点已导出到剪贴板', 'success');
      },
    );
  }
}
