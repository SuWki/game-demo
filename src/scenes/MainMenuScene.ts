import Phaser from 'phaser';
import type { Services } from '../game/types';

export class MainMenuScene extends Phaser.Scene {
  public constructor() {
    super('MainMenuScene');
  }

  public create(): void {
    const services = this.game.registry.get('services') as Services;
    this.cameras.main.fadeIn(180, 4, 10, 16);
    services.audio.setMusic('menu');
    services.overlay.showMenu(
      services.meta.getSummary(),
      () => {
        services.audio.unlock();
        services.audio.play('start');
        services.metrics.beginRunFromMenu();
        services.overlay.pushToast('行动开始，先拿到第一条主路线信号。', 'accent');
        this.cameras.main.fadeOut(140, 4, 10, 16);
        this.time.delayedCall(150, () => {
          this.scene.start('GameScene');
        });
      },
      () => {
        services.audio.unlock();
        services.audio.play('click');
        const content = window.__exportPilotMetrics();
        navigator.clipboard.writeText(content).catch(() => undefined);
        services.overlay.pushToast('记录已复制到剪贴板。', 'success');
      },
      () => {
        services.audio.unlock();
        services.audio.play('click');
        services.overlay.showVolumePanel(
          '音量设置',
          '调整整体播放音量。',
          services.audio.getVolume(),
          (volume) => {
            services.audio.setVolume(volume);
            window.localStorage.setItem('pilot-audio-volume', String(volume));
          },
          () => {
            services.audio.play('click');
            services.overlay.hidePanel();
          },
        );
      },
    );
  }
}
