import Phaser from 'phaser';
import type { Services } from '../game/types';

interface Star {
  x: number;
  y: number;
  z: number;
  brightness: number;
  twinklePhase: number;
}

export class MainMenuScene extends Phaser.Scene {
  private stars: Star[] = [];
  private backgroundGraphics!: Phaser.GameObjects.Graphics;

  public constructor() {
    super('MainMenuScene');
  }

  public create(): void {
    const services = this.game.registry.get('services') as Services;

    // Initialize background graphics
    this.backgroundGraphics = this.add.graphics();
    this.backgroundGraphics.setDepth(-1000);

    // Initialize starfield
    this.initStarfield();

    this.cameras.main.fadeIn(180, 4, 10, 16);
    services.audio.setMusic('menu');
    const showMainMenu = (): void => {
      services.overlay.showMenu(
        services.meta.getSummary(),
        () => {
          services.audio.unlock();
          services.audio.play('start');
          services.metrics.beginRunFromMenu();
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
              showMainMenu();
            },
          );
        },
      );
    };

    showMainMenu();
  }

  private initStarfield(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const starCount = 120;

    // Create stars with random positions and properties
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 3 + 0.5, // Depth for parallax (0.5-3.5)
        brightness: Math.random() * 0.6 + 0.4, // 0.4-1.0
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(time: number, delta: number): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Clear and redraw background
    this.backgroundGraphics.clear();

    // Draw gradient background
    this.backgroundGraphics.fillGradientStyle(0x0a0e27, 0x0a0e27, 0x1a1e3a, 0x1a1e3a, 1);
    this.backgroundGraphics.fillRect(0, 0, width, height);

    // Update and draw stars
    const moveSpeed = delta * 0.01; // Slow movement
    const twinkleSpeed = delta * 0.002;

    for (const star of this.stars) {
      // Move stars slowly downward with parallax
      star.y += moveSpeed * star.z;

      // Wrap around when star goes off screen
      if (star.y > height + 10) {
        star.y = -10;
        star.x = Math.random() * width;
      }

      // Update twinkle phase
      star.twinklePhase += twinkleSpeed;
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7; // 0.4-1.0

      // Calculate star properties based on depth
      const size = (4 - star.z) * 0.8; // Closer stars are bigger
      const alpha = star.brightness * twinkle * (4 - star.z) * 0.25; // Closer stars are brighter

      // Draw star
      this.backgroundGraphics.fillStyle(0xffffff, alpha);
      this.backgroundGraphics.fillCircle(star.x, star.y, size);
    }
  }
}
