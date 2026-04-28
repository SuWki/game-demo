import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('BootScene');
  }

  public preload(): void {
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
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#09101a');
    this.scene.start('MainMenuScene');
  }
}
