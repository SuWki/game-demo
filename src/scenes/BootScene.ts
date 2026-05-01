import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('BootScene');
  }

  public preload(): void {
    // Player and basic units
    this.load.svg('preview-unit-player-core', 'assets/preview-runtime/visual/unit-player-core.svg', {
      width: 128,
      height: 128,
    });
    this.load.svg('preview-enemy-standard-a', 'assets/preview-runtime/visual/enemy-standard-a.svg', {
      width: 128,
      height: 128,
    });
    this.load.svg('preview-fx-xp-orb', 'assets/preview-runtime/visual/fx-xp-orb.svg', {
      width: 128,
      height: 128,
    });

    // Elite units
    this.load.svg('preview-elite-core-main', 'assets/preview-runtime/visual/elite-core-main.svg', {
      width: 256,
      height: 256,
    });
    this.load.svg('preview-elite-core-crack', 'assets/preview-runtime/visual/elite-core-crack.svg', {
      width: 256,
      height: 256,
    });
    this.load.svg('preview-elite-escort-unit', 'assets/preview-runtime/visual/elite-escort-unit.svg', {
      width: 256,
      height: 256,
    });

    // Boss units
    this.load.svg('preview-boss-bastion-main', 'assets/preview-runtime/visual/boss-bastion-main.svg', {
      width: 256,
      height: 256,
    });

    // Projectiles
    this.load.svg('preview-player-projectile-core', 'assets/preview-runtime/visual/player-projectile-core.svg', {
      width: 128,
      height: 128,
    });
    this.load.svg('preview-enemy-projectile-core', 'assets/preview-runtime/visual/enemy-projectile-core.svg', {
      width: 128,
      height: 128,
    });

    // Effects
    this.load.svg('preview-fx-boss-bastion-fireline', 'assets/preview-runtime/visual/fx-boss-bastion-fireline.svg', {
      width: 512,
      height: 192,
    });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#09101a');
    this.scene.start('MainMenuScene');
  }
}
