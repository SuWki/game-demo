import Phaser from 'phaser';
import { BATTLE_TEMPLATES, getBattleEncounterLabel, getBattleEnemyReadout } from '../data/battleTemplates';
import { getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import type { BattleState, OverlayHudSnapshot, Services, ToastTone } from '../game/types';
import { RunEngine } from '../systems/RunEngine';

const XP_ORB_FILL = 0x67f08b;
const XP_ORB_STROKE = 0xcfffd7;
const ENEMY_PROJECTILE_FILL = 0xff5b63;
const ENEMY_PROJECTILE_TRAIL = 0xff8e95;
const ENEMY_PROJECTILE_STROKE = 0xffd0d4;

export class GameScene extends Phaser.Scene {
  private services!: Services;

  private engine!: RunEngine;

  private graphics!: Phaser.GameObjects.Graphics;

  private moveKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private arrowKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

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
    this.moveKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as GameScene['moveKeys'];
    this.arrowKeys = this.input.keyboard!.createCursorKeys();
    this.resultHandled = false;
    this.lastHudKey = '';
    this.lastPanelKey = '';
    this.syncOverlay();
    this.processAnnouncements();
  }

  public update(_: number, delta: number): void {
    this.engine.setInputState({
      up: this.moveKeys.up.isDown || this.arrowKeys.up.isDown,
      down: this.moveKeys.down.isDown || this.arrowKeys.down.isDown,
      left: this.moveKeys.left.isDown || this.arrowKeys.left.isDown,
      right: this.moveKeys.right.isDown || this.arrowKeys.right.isDown,
    });
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
      this.services.overlay.clearToasts();
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
        const panelTitle =
          state.upgradeSource === 'levelUp'
            ? `等级提升 Lv.${state.level}`
            : state.currentNode?.isFinalPrep
              ? '最终整备'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
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
        const tone = this.getToastTone(item.text);
        if (this.shouldDisplayToast(tone)) {
          this.services.overlay.pushToast(item.text, tone);
        }
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const battleText =
      state.status === 'battle' && state.battle
        ? `${getBattleEncounterLabel(state.battle.templateId, state.battle.encounterType)} · ${this.engine.getBattleLabel()}`
        : this.getRouteStatusText();
    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.ceil(state.stats.hp)} / ${state.stats.maxHp}`,
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.floor(state.experience)} / ${state.experienceToNext}`,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        color: route.color,
        active: this.engine.getDominantRoute() === route.id,
      })),
      battleText,
      battleSubtext:
        state.status === 'battle' && state.battle
          ? getBattleEnemyReadout(
              state.battle.templateId,
              state.battle.pressurePhaseLabel,
              state.battle.pressureTransitionSec > 0,
              state.battle.pressurePhaseIndex,
              state.battle.pressureSignatureLabel,
              state.battle.pressurePatternLabel,
              state.battle.pressureSafeWindowSec > 0 ? state.battle.pressureSafeWindowAxis : undefined,
            )
          : undefined,
    };
  }

  private getRouteStatusText(): string {
    const state = this.engine.getState();
    if (state.maturedRoute) {
      return `${ROUTE_NAME_MAP[state.maturedRoute]}路线已经成型`;
    }
    if (state.committedRoute) {
      return `${ROUTE_NAME_MAP[state.committedRoute]}路线开始站稳`;
    }

    const dominantRoute = this.engine.getDominantRoute();
    return dominantRoute ? `${ROUTE_NAME_MAP[dominantRoute]}倾向已出现` : '尚未站稳路线';
  }

  private getToastTone(text: string): ToastTone {
    if (text.includes('精英') || text.includes('高压') || text.includes('压力')) {
      return 'danger';
    }
    if (text.includes('开始站稳') || text.includes('已经成型') || text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
      return 'route';
    }
    if (text.includes('完成') || text.includes('已接入') || text.includes('已完成收束')) {
      return 'success';
    }
    if (text.includes('进入') || text.includes('前段') || text.includes('中段') || text.includes('后段') || text.includes('最终')) {
      return 'accent';
    }
    return 'neutral';
  }

  private shouldDisplayToast(tone: ToastTone): boolean {
    const status = this.engine.getState().status;
    if (status === 'battle' || status === 'upgradeChoice' || status === 'eventChoice' || status === 'nodeChoice') {
      return false;
    }

    return tone === 'danger' || tone === 'success';
  }

  private renderBattle(): void {
    const dominantRoute = this.engine.getDominantRoute();
    const accentColor = dominantRoute ? parseInt(ROUTE_COLOR_MAP[dominantRoute].slice(1), 16) : 0x61d7ff;

    this.graphics.clear();
    this.graphics.fillGradientStyle(0x07101d, 0x07101d, 0x131d31, 0x050911, 1);
    this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);

    this.graphics.fillStyle(accentColor, 0.045);
    this.graphics.fillEllipse(this.scale.width * 0.5, this.scale.height * 0.52, this.scale.width * 0.66, this.scale.height * 0.42);
    this.graphics.fillStyle(accentColor, 0.03);
    this.graphics.fillEllipse(this.scale.width * 0.52, this.scale.height * 0.48, this.scale.width * 0.42, this.scale.height * 0.22);
    this.graphics.fillStyle(0xffffff, 0.02);
    this.graphics.fillCircle(this.scale.width * 0.78, this.scale.height * 0.22, 120);

    this.graphics.lineStyle(1, 0x223047, 0.28);
    for (let x = 0; x <= this.scale.width; x += 80) {
      this.graphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y <= this.scale.height; y += 80) {
      this.graphics.lineBetween(0, y, this.scale.width, y);
    }

    this.graphics.lineStyle(1, accentColor, 0.08);
    for (let x = 50; x < this.scale.width; x += 140) {
      this.graphics.lineBetween(x, 54, x + 42, 54);
      this.graphics.lineBetween(x - 14, this.scale.height - 56, x + 28, this.scale.height - 56);
    }

    this.graphics.lineStyle(2, accentColor, 0.16);
    this.graphics.strokeRoundedRect(14, 14, this.scale.width - 28, this.scale.height - 28, 22);

    const battle = this.engine.getState().battle;
    if (!battle) {
      return;
    }

    this.renderBattleEntities(battle, accentColor);
  }

  private renderBattleEntities(battle: BattleState, accentColor: number): void {
    this.renderPressurePatternOverlay(battle, accentColor);

    for (const orb of battle.experienceOrbs) {
      this.graphics.fillStyle(XP_ORB_FILL, 0.92);
      this.graphics.fillCircle(orb.x, orb.y, 5);
      this.graphics.lineStyle(1, XP_ORB_STROKE, 0.3);
      this.graphics.strokeCircle(orb.x, orb.y, 8);
    }

    for (const pulse of battle.pulses) {
      this.graphics.lineStyle(2, 0x9cff97, pulse.lifeSec * 2.2);
      this.graphics.strokeCircle(pulse.x, pulse.y, pulse.radius);
      this.graphics.lineStyle(1, accentColor, pulse.lifeSec * 1.2);
      this.graphics.strokeCircle(pulse.x, pulse.y, pulse.radius * 0.62);
    }

    for (const bullet of battle.bullets) {
      this.graphics.fillStyle(0xe7f5ff, 0.9);
      this.graphics.fillCircle(bullet.x, bullet.y, 3);
    }

    for (const projectile of battle.enemyProjectiles) {
      this.graphics.lineStyle(2, ENEMY_PROJECTILE_TRAIL, 0.22);
      this.graphics.lineBetween(projectile.x - projectile.vx * 0.045, projectile.y - projectile.vy * 0.045, projectile.x, projectile.y);
      this.graphics.fillStyle(ENEMY_PROJECTILE_FILL, 0.96);
      this.graphics.fillCircle(projectile.x, projectile.y, projectile.radius);
      this.graphics.lineStyle(1, ENEMY_PROJECTILE_STROKE, 0.34);
      this.graphics.strokeCircle(projectile.x, projectile.y, projectile.radius + 2);
    }

    for (const enemy of battle.enemies) {
      const enemyFill = this.getEnemyFillColor(enemy);
      const enemyStroke = this.getEnemyStrokeColor(enemy);
      this.graphics.fillStyle(enemyFill, enemy.elite ? 0.98 : 0.95);

      if (enemy.elite) {
        this.graphics.fillCircle(enemy.x, enemy.y, enemy.radius);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 5);
        if (battle.pressureTransitionSec > 0) {
          const pulseAlpha = Math.min(0.44, 0.14 + battle.pressureTransitionSec * 0.2);
          const pulseRadius = enemy.radius + 12 + (1.15 - battle.pressureTransitionSec) * 7;
          this.graphics.lineStyle(4, BATTLE_TEMPLATES[battle.templateId].accent, pulseAlpha);
          this.graphics.strokeCircle(enemy.x, enemy.y, pulseRadius);
        }
        if (battle.pressureSignatureSec > 0) {
          const signatureAlpha = Math.min(0.28, 0.12 + battle.pressureSignatureSec * 0.04);
          const signatureRadius = enemy.radius + 15 + Math.sin(battle.elapsedSec * 7.5) * 2;
          this.graphics.lineStyle(3, BATTLE_TEMPLATES[battle.templateId].accent, signatureAlpha);
          this.graphics.strokeCircle(enemy.x, enemy.y, signatureRadius);
        }
        if (battle.pressurePatternFlashSec > 0) {
          const patternAlpha = Math.min(0.26, 0.08 + battle.pressurePatternFlashSec * 0.28);
          this.graphics.lineStyle(2, BATTLE_TEMPLATES[battle.templateId].accent, patternAlpha);
          this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 20 + battle.pressurePatternFlashSec * 12);
        }
        if (enemy.guardSec > 0) {
          const guardAlpha = Math.min(0.45, 0.16 + enemy.guardSec * 0.04);
          this.graphics.lineStyle(3, 0xfff2b0, guardAlpha);
          this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 10);
        }
      } else if (enemy.archetype === 'ranged') {
        this.graphics.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeRect(enemy.x - enemy.radius - 2, enemy.y - enemy.radius - 2, enemy.radius * 2 + 4, enemy.radius * 2 + 4);
      } else {
        this.graphics.fillCircle(enemy.x, enemy.y, enemy.radius);
        this.graphics.lineStyle(2, enemyStroke, 0.26);
        this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 4);
      }

      if (!enemy.elite && enemy.archetype === 'skirmisher') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(enemy.x - enemy.radius - 3, enemy.y, enemy.x + enemy.radius + 3, enemy.y);
        this.graphics.lineBetween(enemy.x - enemy.radius + 1, enemy.y - enemy.radius + 2, enemy.x + enemy.radius - 1, enemy.y + enemy.radius - 2);
      }

      if (!enemy.elite && enemy.archetype === 'brute') {
        this.graphics.lineStyle(3, enemyStroke, 0.24);
        this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 7);
        this.graphics.fillStyle(enemyStroke, 0.12);
        this.graphics.fillCircle(enemy.x, enemy.y, Math.max(4, enemy.radius - 4));
      }

      if (!enemy.elite && enemy.archetype === 'ranged') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(enemy.x, enemy.y - enemy.radius - 4, enemy.x, enemy.y + enemy.radius + 4);
        this.graphics.lineStyle(1, enemyStroke, enemy.rangedCooldownSec <= 0.65 ? 0.24 : 0.12);
        this.graphics.strokeCircle(enemy.x, enemy.y, enemy.radius + 10);
        if (enemy.rangedCooldownSec <= 0.65) {
          this.graphics.lineStyle(1, enemyStroke, 0.18);
          this.graphics.lineBetween(enemy.x, enemy.y, battle.playerX, battle.playerY);
        }
      }

      const hpRatio = enemy.hp / enemy.maxHp;
      this.graphics.fillStyle(0x1b2434, 0.84);
      this.graphics.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32, 4);
      this.graphics.fillStyle(enemy.elite ? 0xffdd7d : enemyStroke, 1);
      this.graphics.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32 * hpRatio, 4);
    }

    this.graphics.fillStyle(accentColor, battle.invulnerableSec > 0 ? 0.16 : 0.08);
    this.graphics.fillCircle(battle.playerX, battle.playerY, 56);
    this.graphics.lineStyle(2, accentColor, battle.invulnerableSec > 0 ? 0.55 : 0.24);
    this.graphics.strokeCircle(battle.playerX, battle.playerY, 26);
    this.graphics.lineStyle(1, 0xffffff, battle.invulnerableSec > 0 ? 0.46 : 0.14);
    this.graphics.strokeCircle(battle.playerX, battle.playerY, 16);
    this.graphics.fillStyle(battle.invulnerableSec > 0 ? 0x9cff97 : 0xe7f5ff, 1);
    this.graphics.fillCircle(battle.playerX, battle.playerY, 10);
  }

  private renderPressurePatternOverlay(battle: BattleState, accentColor: number): void {
    if (!battle.pressurePatternMode || !battle.pressurePatternLabel) {
      return;
    }

    const flashAlpha = Math.min(0.16, 0.04 + battle.pressurePatternFlashSec * 0.2);
    if (this.renderPressureSafeWindowOverlay(battle, accentColor, flashAlpha)) {
      return;
    }

    switch (battle.pressurePatternMode) {
      case 'sideClamp':
        this.graphics.fillStyle(accentColor, flashAlpha);
        this.graphics.fillRect(28, 92, 30, this.scale.height - 184);
        this.graphics.fillRect(this.scale.width - 58, 92, 30, this.scale.height - 184);
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.4);
        this.graphics.lineBetween(58, 120, 58, this.scale.height - 120);
        this.graphics.lineBetween(this.scale.width - 58, 120, this.scale.width - 58, this.scale.height - 120);
        return;
      case 'laneCrush':
        this.graphics.fillStyle(accentColor, flashAlpha);
        this.graphics.fillRect(84, 28, this.scale.width - 168, 28);
        this.graphics.fillRect(84, this.scale.height - 56, this.scale.width - 168, 28);
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
        this.graphics.lineBetween(112, 56, this.scale.width - 112, 56);
        this.graphics.lineBetween(112, this.scale.height - 56, this.scale.width - 112, this.scale.height - 56);
        return;
      case 'crossfireWave':
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.5);
        this.graphics.lineBetween(82, 112, this.scale.width - 82, this.scale.height - 112);
        this.graphics.lineBetween(82, this.scale.height - 112, this.scale.width - 82, 112);
        this.graphics.lineStyle(1, accentColor, flashAlpha * 1.1);
        this.graphics.lineBetween(132, 112, this.scale.width - 132, this.scale.height - 112);
        this.graphics.lineBetween(132, this.scale.height - 112, this.scale.width - 132, 112);
        return;
      default:
        return;
    }
  }

  private renderPressureSafeWindowOverlay(battle: BattleState, accentColor: number, flashAlpha: number): boolean {
    if (
      !battle.pressureSafeWindowAxis ||
      battle.pressureSafeWindowSec <= 0 ||
      battle.pressureSafeWindowSpan <= 0
    ) {
      return false;
    }

    const topInset = 88;
    const bottomInset = 82;
    const leftInset = 22;
    const rightInset = 22;
    const contentWidth = this.scale.width - leftInset - rightInset;
    const contentHeight = this.scale.height - topInset - bottomInset;
    const safeWindowAlpha = Math.min(0.18, 0.05 + battle.pressureSafeWindowSec * 0.08 + flashAlpha * 0.7);
    const dangerAlpha = Math.min(0.16, 0.05 + battle.pressureSafeWindowSec * 0.06 + flashAlpha * 0.95);
    const safeTint = 0x82ffca;
    const dangerTint = 0xff6d62;

    if (battle.pressureSafeWindowAxis === 'vertical') {
      const safeStart = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5,
        leftInset,
        this.scale.width - rightInset,
      );
      const safeEnd = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5,
        leftInset,
        this.scale.width - rightInset,
      );
      const safeWidth = Math.max(18, safeEnd - safeStart);

      if (safeStart > leftInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, topInset, safeStart - leftInset, contentHeight);
      }
      if (safeEnd < this.scale.width - rightInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(safeEnd, topInset, this.scale.width - rightInset - safeEnd, contentHeight);
      }

      this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
      this.graphics.fillRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
      this.graphics.strokeRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
      this.graphics.lineBetween(safeStart, topInset - 8, safeStart, this.scale.height - bottomInset + 8);
      this.graphics.lineBetween(safeEnd, topInset - 8, safeEnd, this.scale.height - bottomInset + 8);
      return true;
    }

    const safeStart = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5,
      topInset,
      this.scale.height - bottomInset,
    );
    const safeEnd = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5,
      topInset,
      this.scale.height - bottomInset,
    );
    const safeHeight = Math.max(18, safeEnd - safeStart);

    if (safeStart > topInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, topInset, contentWidth, safeStart - topInset);
    }
    if (safeEnd < this.scale.height - bottomInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, safeEnd, contentWidth, this.scale.height - bottomInset - safeEnd);
    }

    this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
    this.graphics.fillRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
    this.graphics.strokeRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
    this.graphics.lineBetween(leftInset - 8, safeStart, this.scale.width - rightInset + 8, safeStart);
    this.graphics.lineBetween(leftInset - 8, safeEnd, this.scale.width - rightInset + 8, safeEnd);
    return true;
  }

  private getEnemyFillColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0xffb347;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0xff7b63;
      case 'skirmisher':
        return 0xff4f86;
      case 'ranged':
        return 0xc98eff;
      case 'standard':
      default:
        return 0xff6578;
    }
  }

  private getEnemyStrokeColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0xffe2a8;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0xffcfb8;
      case 'skirmisher':
        return 0xffb4d1;
      case 'ranged':
        return 0xe2ccff;
      case 'standard':
      default:
        return 0xff9eb0;
    }
  }
}
