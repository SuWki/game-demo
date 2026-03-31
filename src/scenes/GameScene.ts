import Phaser from 'phaser';
import { getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_NAME_MAP } from '../data/routes';
import type { BattleState, OverlayHudSnapshot, Services } from '../game/types';
import { RunEngine } from '../systems/RunEngine';

export class GameScene extends Phaser.Scene {
  private services!: Services;

  private engine!: RunEngine;

  private graphics!: Phaser.GameObjects.Graphics;

  private resultHandled = false;

  private lastHudKey = '';

  private lastPanelKey = '';

  public constructor() {
    super('GameScene');
  }

  public create(): void {
    this.services = this.game.registry.get('services') as Services;
    this.engine = new RunEngine(this.services);
    this.graphics = this.add.graphics();
    this.resultHandled = false;
    this.lastHudKey = '';
    this.lastPanelKey = '';
    this.syncOverlay();
    this.processAnnouncements();
  }

  public update(_: number, delta: number): void {
    this.engine.tick(delta);
    this.processAnnouncements();
    this.syncOverlay();
    this.renderBattle();

    const state = this.engine.getState();
    if (!this.resultHandled && state.status === 'result' && state.result) {
      this.resultHandled = true;
      this.services.meta.recordRun(state.result);
      this.scene.start('ResultScene', {
        result: state.result,
      });
    }
  }

  private syncOverlay(): void {
    const state = this.engine.getState();
    const hudSnapshot = this.createHudSnapshot();
    const hudKey = JSON.stringify(hudSnapshot);
    if (hudKey !== this.lastHudKey) {
      this.services.overlay.showHud(hudSnapshot);
      this.lastHudKey = hudKey;
    }

    if (state.status === 'battle') {
      if (this.lastPanelKey) {
        this.services.overlay.hidePanel();
        this.lastPanelKey = '';
      }
      return;
    }

    if (state.status === 'nodeChoice') {
      const panelKey = `node:${state.phase}:${state.nodeOptions.map((node) => node.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.overlay.showNodePanel(getPhaseLabel(state.phase), state.nodeOptions, (nodeId) => {
          this.services.audio.play('click');
          this.engine.chooseNode(nodeId);
          this.processAnnouncements();
          this.syncOverlay();
        });
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'upgradeChoice') {
      const panelKey = `upgrade:${state.phase}:${state.upgradeChoices.map((upgrade) => upgrade.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.overlay.showUpgradePanel(
          state.currentNode?.isFinalPrep ? '最终整备' : `${getPhaseLabel(state.phase)}强化`,
          state.upgradeChoices,
          (upgradeId) => {
            this.engine.chooseUpgrade(upgradeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'eventChoice' && state.currentEvent) {
      const panelKey = `event:${state.currentEvent.id}:${state.currentEvent.options.map((option) => option.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.overlay.showEventPanel(state.currentEvent, (optionId) => {
          this.engine.chooseEventOption(optionId);
          this.processAnnouncements();
          this.syncOverlay();
        });
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (this.lastPanelKey) {
      this.services.overlay.hidePanel();
      this.lastPanelKey = '';
    }
  }

  private processAnnouncements(): void {
    for (const item of this.engine.drainAnnouncements()) {
      if (item.kind === 'tip' && item.text) {
        this.services.overlay.pushToast(item.text);
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.ceil(state.stats.hp)} / ${state.stats.maxHp}`,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        active: this.engine.getDominantRoute() === route.id,
      })),
      battleText:
        state.status === 'battle' && state.battle
          ? this.engine.getBattleLabel()
          : `${this.engine.getDominantRoute() ? `${ROUTE_NAME_MAP[this.engine.getDominantRoute()!]}倾向已出现` : '尚未站稳路线'}`,
    };
  }

  private renderBattle(): void {
    this.graphics.clear();
    this.graphics.fillGradientStyle(0x0b1324, 0x0b1324, 0x131e32, 0x171c2c, 1);
    this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    this.graphics.lineStyle(1, 0x223047, 0.65);
    for (let x = 0; x <= this.scale.width; x += 80) {
      this.graphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y <= this.scale.height; y += 80) {
      this.graphics.lineBetween(0, y, this.scale.width, y);
    }

    const battle = this.engine.getState().battle;
    if (!battle) {
      return;
    }

    this.renderBattleEntities(battle);
  }

  private renderBattleEntities(battle: BattleState): void {
    for (const pulse of battle.pulses) {
      this.graphics.lineStyle(2, 0x9cff97, pulse.lifeSec * 2.4);
      this.graphics.strokeCircle(pulse.x, pulse.y, pulse.radius);
    }

    for (const bullet of battle.bullets) {
      this.graphics.fillStyle(0xe7f5ff, 0.95);
      this.graphics.fillCircle(bullet.x, bullet.y, 3);
    }

    for (const enemy of battle.enemies) {
      this.graphics.fillStyle(enemy.elite ? 0xffb347 : 0xff6578, 0.95);
      this.graphics.fillCircle(enemy.x, enemy.y, enemy.radius);

      const hpRatio = enemy.hp / enemy.maxHp;
      this.graphics.fillStyle(0x1b2434, 0.8);
      this.graphics.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32, 4);
      this.graphics.fillStyle(enemy.elite ? 0xffdd7d : 0xff8aa1, 1);
      this.graphics.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32 * hpRatio, 4);
    }

    this.graphics.fillStyle(battle.invulnerableSec > 0 ? 0x9cff97 : 0x61d7ff, 1);
    this.graphics.fillCircle(battle.playerX, battle.playerY, 12);
    this.graphics.lineStyle(2, 0xffffff, 0.15);
    this.graphics.strokeCircle(battle.playerX, battle.playerY, 22);
  }
}
