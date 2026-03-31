import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('BootScene');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#09101a');
    this.scene.start('MainMenuScene');
  }
}
