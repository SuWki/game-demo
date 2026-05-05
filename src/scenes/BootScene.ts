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
    this.load.svg('preview-enemy-brute', 'assets/preview-runtime/visual/enemy-brute.svg', {
      width: 256,
      height: 256,
    });
    this.load.svg('preview-enemy-skirmisher', 'assets/preview-runtime/visual/enemy-skirmisher.svg', {
      width: 256,
      height: 256,
    });
    this.load.svg('preview-enemy-ranged', 'assets/preview-runtime/visual/enemy-ranged.svg', {
      width: 256,
      height: 256,
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
    this.load.svg('preview-boss-hunt-main', 'assets/preview-runtime/visual/boss-hunt-main.svg', {
      width: 256,
      height: 256,
    });
    this.load.svg('preview-boss-lockdown-main', 'assets/preview-runtime/visual/boss-lockdown-main.svg', {
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
    this.load.svg('preview-fx-hit-normal', 'assets/preview-runtime/visual/fx-hit-normal.svg', {
      width: 64,
      height: 64,
    });
    this.load.svg('preview-fx-hit-crit', 'assets/preview-runtime/visual/fx-hit-crit.svg', {
      width: 128,
      height: 128,
    });
    this.load.svg('preview-fx-hit-pierce', 'assets/preview-runtime/visual/fx-hit-pierce.svg', {
      width: 96,
      height: 96,
    });
    this.load.svg('preview-fx-hit-dash', 'assets/preview-runtime/visual/fx-hit-dash.svg', {
      width: 96,
      height: 96,
    });
    this.load.svg('preview-fx-explosion-small', 'assets/preview-runtime/visual/fx-explosion-small.svg', {
      width: 128,
      height: 128,
    });
    this.load.svg('preview-fx-trail-crit', 'assets/preview-runtime/visual/fx-trail-crit.svg', {
      width: 32,
      height: 32,
    });
    this.load.svg('preview-fx-trail-pierce', 'assets/preview-runtime/visual/fx-trail-pierce.svg', {
      width: 32,
      height: 32,
    });
    this.load.svg('preview-fx-trail-dash', 'assets/preview-runtime/visual/fx-trail-dash.svg', {
      width: 32,
      height: 32,
    });
    this.load.svg('preview-fx-charge-glow', 'assets/preview-runtime/visual/fx-charge-glow.svg', {
      width: 64,
      height: 64,
    });
    this.load.svg('preview-fx-screen-flash-white', 'assets/preview-runtime/visual/fx-screen-flash-white.svg', {
      width: 960,
      height: 540,
    });
    this.load.svg('preview-fx-screen-flash-red', 'assets/preview-runtime/visual/fx-screen-flash-red.svg', {
      width: 960,
      height: 540,
    });
    this.load.svg('preview-fx-screen-flash-gold', 'assets/preview-runtime/visual/fx-screen-flash-gold.svg', {
      width: 960,
      height: 540,
    });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#09101a');
    this.scene.start('MainMenuScene');
  }
}
