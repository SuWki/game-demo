import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH, clamp, getPlayerMoveSpeed } from '../data/balance';
import { BATTLE_TEMPLATES, getBattleEncounterLabel } from '../data/battleTemplates';
import { getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import type {
  BattleDebugConfig,
  BattleDebugRuntimeConfig,
  BattleDebugSnapshot,
  BattleState,
  DebugBattlePhaseId,
  OverlayHudSnapshot,
  PlayerStats,
  Services,
  ToastTone,
} from '../game/types';
import { RunEngine } from '../systems/RunEngine';
import type { BattleDebugTemplateOption } from '../ui/BattleDebugPanel';

const XP_ORB_FILL = 0x67f08b;
const XP_ORB_STROKE = 0xcfffd7;
const ENEMY_PROJECTILE_FILL = 0xff5b63;
const ENEMY_PROJECTILE_TRAIL = 0xff8e95;
const ENEMY_PROJECTILE_STROKE = 0xffd0d4;
const ENEMY_ESCORT_FILL = 0xa57df0;
const ENEMY_ESCORT_STROKE = 0xd5bfff;
const ELITE_FILL = 0xffb56a;
const ELITE_STROKE = 0xffddb0;
const BOSS_FILL = 0xff9462;
const BOSS_STROKE = 0xffd4b8;
const SAFE_WINDOW_TINT = 0x82ffca;
const SAFE_WINDOW_DANGER = 0xff6d62;
const TERRAIN_TILE_SIZE = 160;
const RUNTIME_VISUAL_PREVIEW_STORAGE_KEY = 'pilot-runtime-preview-assets';

// Preview texture keys
const PREVIEW_PLAYER_TEXTURE = 'preview-unit-player-core';
const PREVIEW_STANDARD_ENEMY_TEXTURE = 'preview-enemy-standard-a';
const PREVIEW_XP_ORB_TEXTURE = 'preview-fx-xp-orb';
const PREVIEW_ELITE_CORE_TEXTURE = 'preview-elite-core-main';
const PREVIEW_ELITE_CRACK_TEXTURE = 'preview-elite-core-crack';
const PREVIEW_ELITE_ESCORT_TEXTURE = 'preview-elite-escort-unit';
const PREVIEW_BOSS_BASTION_TEXTURE = 'preview-boss-bastion-main';
const PREVIEW_PLAYER_PROJECTILE_TEXTURE = 'preview-player-projectile-core';
const PREVIEW_ENEMY_PROJECTILE_TEXTURE = 'preview-enemy-projectile-core';
const PREVIEW_BOSS_FIRELINE_TEXTURE = 'preview-fx-boss-bastion-fireline';

function createPanelStatSummary(stats: PlayerStats): OverlayHudSnapshot['statSummary'] {
  return [
    { label: '伤害', value: stats.damage.toFixed(0), tone: 'offense' },
    { label: '射速', value: `${Math.round(stats.fireRate * 60)}/分`, tone: 'offense' },
    { label: '弹速', value: stats.projectileSpeed.toFixed(0), tone: 'offense' },
    { label: '暴击率', value: `${Math.round(stats.critChance * 100)}%`, tone: 'offense' },
    { label: '暴伤', value: `${Math.round(stats.critMultiplier * 100)}%`, tone: 'offense' },
    { label: '穿透', value: stats.pierce.toFixed(0), tone: 'utility' },
    { label: '多重', value: stats.multishot.toFixed(0), tone: 'utility' },
    { label: '生命', value: `${Math.ceil(stats.hp)} / ${Math.round(stats.maxHp)}`, tone: 'survival' },
    { label: '移速', value: stats.moveSpeed.toFixed(0), tone: 'mobility' },
    { label: '再生', value: `${Math.round(stats.regeneration * 10)}/10秒`, tone: 'survival' },
  ];
}
const TERRAIN_BLOT_SIZE = 384;
/*
const PHASE_TRACK = [
  { phase: 'opening', label: '前段' },
  { phase: 'mid', label: '中段' },
  { phase: 'late', label: '后段' },
  { phase: 'finalPrep', label: '整备' },
  { phase: 'finalBattle', label: 'Boss' },
] as const;
*/
const PHASE_TRACK = [
  { phase: 'opening', label: '前段' },
  { phase: 'mid', label: '中段' },
  { phase: 'late', label: '后段' },
  { phase: 'finalPrep', label: '整备' },
  { phase: 'finalBattle', label: 'Boss' },
] as const;

const DEBUG_SYNC_INTERVAL_MS = 120;

export class GameScene extends Phaser.Scene {
  private services!: Services;

  private engine!: RunEngine;

  private graphics!: Phaser.GameObjects.Graphics;

  private readonly runtimePreviewImages: Phaser.GameObjects.Image[] = [];

  private runtimePreviewImageCursor = 0;

  private runtimeVisualPreviewEnabled = true;

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

  private lastPauseKey = '';

  private gamePaused = false;

  private debugSyncElapsedMs = DEBUG_SYNC_INTERVAL_MS;

  // Floating text system for route feedback
  private readonly floatingTexts: Phaser.GameObjects.Text[] = [];

  private floatingTextCursor = 0;

  private critTextCooldownSec = 0;

  private pierceTextCooldownSec = 0;

  private dashTextCooldownSec = 0;

  private readonly debugConfig: BattleDebugConfig = {
    panelOpen: false,
    paused: false,
    timeScale: 1,
    freezeEnemyMovement: false,
    freezeEnemyProjectiles: false,
    freezeEnemySpawning: false,
    freezePlayerAutoFire: false,
    invulnerablePlayer: false,
    showEnemyVectors: false,
    showProjectileVectors: false,
    showCollisionRadii: false,
    phase: 'opening',
    templateId: 'elimination',
  };

  public constructor() {
    super('GameScene');
  }

  public create(): void {
    this.services = this.game.registry.get('services') as Services;
    this.services.audio.unlock();
    this.services.audio.setMusic('battle');
    this.engine = new RunEngine(this.services);
    this.engine.setDebugConfig(this.getRuntimeDebugConfig());
    this.runtimePreviewImages.length = 0;
    this.runtimePreviewImageCursor = 0;
    this.graphics = this.add.graphics();
    this.graphics.setDepth(10);
    this.runtimeVisualPreviewEnabled = window.localStorage.getItem(RUNTIME_VISUAL_PREVIEW_STORAGE_KEY) !== 'off';
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
    this.lastPauseKey = '';
    this.debugSyncElapsedMs = DEBUG_SYNC_INTERVAL_MS;
    this.services.debugPanel.bind(this.getDebugTemplateOptions(), {
      onConfigChange: (patch) => this.updateDebugConfig(patch),
      onRestartBattle: (templateId, phase) => this.restartDebugBattle(templateId, phase),
      onUiSound: (cue) => {
        this.services.audio.play(cue);
      },
    });
    this.services.debugPanel.setVisible(this.debugConfig.panelOpen);
    this.input.keyboard!.on('keydown-F3', this.handleDebugPanelToggle, this);
    this.input.keyboard!.on('keydown-F4', this.handleDebugPauseToggle, this);
    this.input.keyboard!.on('keydown-ESC', this.handlePauseToggle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.syncOverlay();
    this.processAnnouncements();
    this.syncDebugPanel(true);

    const forcedBossTemplate = window.localStorage.getItem('pilot-qa-force-boss');
    if (forcedBossTemplate) {
      window.localStorage.removeItem('pilot-qa-force-boss');
      const validBossTemplates = ['boss-bastion', 'boss-hunt', 'boss-lockdown'];
      if (validBossTemplates.includes(forcedBossTemplate)) {
        this.time.delayedCall(400, () => {
          this.restartDebugBattle(forcedBossTemplate as BattleDebugConfig['templateId'], 'finalBattle');
          // eslint-disable-next-line no-console
          console.log(`[QA] Auto-triggered forced boss battle: ${forcedBossTemplate}`);
        });
      }
    }
  }

  public update(_: number, delta: number): void {
    this.engine.setInputState({
      up: this.moveKeys.up.isDown || this.arrowKeys.up.isDown,
      down: this.moveKeys.down.isDown || this.arrowKeys.down.isDown,
      left: this.moveKeys.left.isDown || this.arrowKeys.left.isDown,
      right: this.moveKeys.right.isDown || this.arrowKeys.right.isDown,
    });
    const scaledDelta = this.isSimulationPaused() ? 0 : delta * this.debugConfig.timeScale;
    if (scaledDelta > 0) {
      this.engine.tick(scaledDelta);
    }
    const state = this.engine.getState();
    this.syncAudioState(state);
    this.processAnnouncements();
    this.syncOverlay();
    this.renderBattle();
    this.syncDebugPanel();
    if (!this.resultHandled && state.status === 'result' && state.result) {
      this.resultHandled = true;
      this.services.meta.recordRun(state.result);
      this.scene.start('ResultScene', {
        result: state.result,
      });
    }
  }

  public getDebugConfig(): BattleDebugConfig {
    return { ...this.debugConfig };
  }

  public updateDebugConfig(patch: Partial<BattleDebugConfig>): void {
    Object.assign(this.debugConfig, patch);
    if (patch.templateId && BATTLE_TEMPLATES[patch.templateId].encounterType === 'boss') {
      this.debugConfig.phase = 'finalBattle';
    }
    this.debugConfig.timeScale = Phaser.Math.Clamp(this.debugConfig.timeScale, 0.1, 2);
    this.services.debugPanel.setVisible(this.debugConfig.panelOpen);
    this.engine.setDebugConfig(this.getRuntimeDebugConfig());
    this.syncDebugPanel(true);
  }

  public restartDebugBattle(templateId: BattleDebugConfig['templateId'], phase: DebugBattlePhaseId): void {
    const normalizedPhase = BATTLE_TEMPLATES[templateId].encounterType === 'boss' ? 'finalBattle' : phase;
    this.debugConfig.templateId = templateId;
    this.debugConfig.phase = normalizedPhase;
    this.debugConfig.paused = false;
    this.gamePaused = false;
    this.resultHandled = false;
    this.lastHudKey = '';
    this.lastPanelKey = '';
    this.lastPauseKey = '';
    this.engine.restartDebugBattle(templateId, normalizedPhase);
    this.engine.setDebugConfig(this.getRuntimeDebugConfig());
    this.processAnnouncements();
    this.syncOverlay();
    this.syncDebugPanel(true);
  }

  public setDebugBattlePressureState(options: {
    eliteHpRatio?: number;
    remainingSec?: number;
    pressurePhaseElapsedSec?: number;
  }): boolean {
    return this.engine.setDebugBattlePressureState(options);
  }

  public toggleDebugPanel(): void {
    this.updateDebugConfig({
      panelOpen: !this.debugConfig.panelOpen,
    });
  }

  public getBattleDebugSnapshot(): BattleDebugSnapshot {
    const state = this.engine.getState();
    const battle = state.battle;
    if (!battle) {
      return {
        status: state.status,
        phase: state.phase,
        templateId: null,
        encounterType: null,
        playerX: 0,
        playerY: 0,
        playerHp: state.stats.hp,
        playerMaxHp: state.stats.maxHp,
        enemyCount: 0,
        projectileCount: 0,
        bulletCount: 0,
        orbCount: 0,
        eliteAlive: false,
        dashDriveSec: 0,
        playerTurnBurstSec: 0,
        eliteRecoverySec: 0,
        elitePressureSec: 0,
        eliteCrackWindowSec: 0,
        escortCount: 0,
        escortRecoveryCount: 0,
        escortCrackCount: 0,
        enemyProjectileCount: 0,
        breachProjectileCount: 0,
        breachSuppressionRatio: 0,
        pressureSafeWindowAxis: null,
        pressureSafeWindowCenter: 0,
        pressureSafeWindowSpan: 0,
        pressureSafeWindowSecondaryCenter: 0,
        pressureSafeWindowSecondarySpan: 0,
        pressureSafeWindowSec: 0,
        pressureSafeWindowCenterDistance: 0,
        pressureSafeWindowTravelDistance: 0,
        lateDashWindowMoments: 0,
        dashCounterMoments: 0,
        eliteCrackSeen: false,
        eliteCrackFollowThroughMoments: 0,
        bossFirelineCoverage: 0,
        bossSafeWindowMoments: 0,
        outsideSafeDamageTicks: 0,
        insideSafeProjectileClears: 0,
        killPickupContinueMoments: 0,
        enemies: [],
        enemyProjectiles: [],
      };
    }

    const elite = battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0) ?? null;
    const escorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0);
    const breachSuppressionRatio = this.getEliteBreachProjectileSuppressionRatio(battle);
    const breachProjectileCount =
      elite && breachSuppressionRatio > 0.08
        ? battle.enemyProjectiles.filter((projectile) => this.getEliteBreachProjectileCorridorRatio(battle, projectile) > 0.18).length
        : 0;
    return {
      status: state.status,
      phase: state.phase,
      templateId: battle.templateId,
      encounterType: battle.encounterType,
      playerX: battle.playerX,
      playerY: battle.playerY,
      playerHp: state.stats.hp,
      playerMaxHp: state.stats.maxHp,
      enemyCount: battle.enemies.length,
      projectileCount: battle.enemyProjectiles.length,
      bulletCount: battle.bullets.length,
      orbCount: battle.experienceOrbs.length,
      eliteAlive: battle.eliteAlive,
      dashDriveSec: battle.dashDriveSec,
      playerTurnBurstSec: battle.playerTurnBurstSec,
      eliteRecoverySec: elite?.recoverySec ?? 0,
      elitePressureSec: elite?.pressurePulseSec ?? 0,
      eliteCrackWindowSec: battle.eliteCrackWindowSec,
      escortCount: escorts.length,
      escortRecoveryCount: escorts.filter((enemy) => enemy.recoverySec > 0.08).length,
      escortCrackCount: battle.eliteCrackEscortCount,
      enemyProjectileCount: battle.enemyProjectiles.length,
      breachProjectileCount,
      breachSuppressionRatio,
      pressureSafeWindowAxis: battle.pressureSafeWindowAxis ?? null,
      pressureSafeWindowCenter: battle.pressureSafeWindowCenter,
      pressureSafeWindowSpan: battle.pressureSafeWindowSpan,
      pressureSafeWindowSecondaryCenter: battle.pressureSafeWindowSecondaryCenter,
      pressureSafeWindowSecondarySpan: battle.pressureSafeWindowSecondarySpan,
      pressureSafeWindowSec: battle.pressureSafeWindowSec,
      pressureSafeWindowCenterDistance: this.getPressureSafeWindowCenterDistance(battle),
      pressureSafeWindowTravelDistance: this.getPressureSafeWindowTravelDistance(battle),
      lateDashWindowMoments: battle.lateDashWindowMoments,
      dashCounterMoments: battle.dashCounterMoments,
      eliteCrackSeen: battle.eliteCrackSeen,
      eliteCrackFollowThroughMoments: battle.eliteCrackFollowThroughMoments,
      bossFirelineCoverage: battle.bossFirelineCoverage,
      bossSafeWindowMoments: battle.bossSafeWindowMoments,
      outsideSafeDamageTicks: battle.outsideSafeDamageTicks ?? 0,
      insideSafeProjectileClears: battle.insideSafeProjectileClears ?? 0,
      killPickupContinueMoments: battle.killPickupContinueMoments,
      enemies: [...battle.enemies]
        .sort((left, right) => {
          if (left.elite !== right.elite) {
            return left.elite ? -1 : 1;
          }
          return left.id - right.id;
        })
        .slice(0, 8)
        .map((enemy) => ({
          id: enemy.id,
          archetype: enemy.archetype,
          role: enemy.role,
          elite: enemy.elite,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          x: enemy.x,
          y: enemy.y,
          recoverySec: enemy.recoverySec,
          pressurePulseSec: enemy.pressurePulseSec,
          rangedCooldownSec: enemy.rangedCooldownSec,
          moveVX: enemy.debugMoveVX,
          moveVY: enemy.debugMoveVY,
        })),
      enemyProjectiles: battle.enemyProjectiles.slice(0, 10).map((projectile) => ({
        id: projectile.id,
        x: projectile.x,
        y: projectile.y,
        vx: projectile.vx,
        vy: projectile.vy,
        damage: projectile.damage,
        lifeSec: projectile.lifeSec,
        radius: projectile.radius,
      })),
    };
  }

  private getPressureSafeWindowCenterDistance(battle: BattleState): number {
    if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSpan <= 0 || battle.pressureSafeWindowSec <= 0) {
      return 0;
    }

    if (battle.pressureSafeWindowAxis === 'vertical') {
      return Math.abs(battle.playerX - battle.pressureSafeWindowCenter);
    }
    if (battle.pressureSafeWindowAxis === 'horizontal') {
      return Math.abs(battle.playerY - battle.pressureSafeWindowCenter);
    }

    return Math.hypot(
      battle.playerX - battle.pressureSafeWindowCenter,
      battle.playerY - battle.pressureSafeWindowSecondaryCenter,
    );
  }

  private getPressureSafeWindowTravelDistance(battle: BattleState): number {
    if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSpan <= 0 || battle.pressureSafeWindowSec <= 0) {
      return 0;
    }

    const halfX = battle.pressureSafeWindowSpan * 0.5;
    if (battle.pressureSafeWindowAxis === 'vertical') {
      return Math.max(Math.abs(battle.playerX - battle.pressureSafeWindowCenter) - halfX, 0);
    }
    if (battle.pressureSafeWindowAxis === 'horizontal') {
      return Math.max(Math.abs(battle.playerY - battle.pressureSafeWindowCenter) - halfX, 0);
    }

    const halfY = battle.pressureSafeWindowSecondarySpan * 0.5;
    const dx = Math.max(Math.abs(battle.playerX - battle.pressureSafeWindowCenter) - halfX, 0);
    const dy = Math.max(Math.abs(battle.playerY - battle.pressureSafeWindowSecondaryCenter) - halfY, 0);
    return Math.hypot(dx, dy);
  }

  private handleDebugPanelToggle(event: KeyboardEvent): void {
    event.preventDefault();
    this.services.audio.play('click');
    this.toggleDebugPanel();
  }

  private handleDebugPauseToggle(event: KeyboardEvent): void {
    event.preventDefault();
    this.services.audio.play('click');
    this.updateDebugConfig({
      paused: !this.debugConfig.paused,
    });
  }

  private handlePauseToggle(event: KeyboardEvent): void {
    event.preventDefault();
    this.toggleGamePause();
  }

  private handleSceneShutdown(): void {
    this.input.keyboard?.off('keydown-F3', this.handleDebugPanelToggle, this);
    this.input.keyboard?.off('keydown-F4', this.handleDebugPauseToggle, this);
    this.input.keyboard?.off('keydown-ESC', this.handlePauseToggle, this);
    this.runtimePreviewImages.length = 0;
    this.runtimePreviewImageCursor = 0;
    this.services.debugPanel.unbind();
  }

  private isSimulationPaused(): boolean {
    return this.debugConfig.paused || this.gamePaused;
  }

  private toggleGamePause(): void {
    const state = this.engine.getState();
    if (state.status !== 'battle' || !state.battle) {
      return;
    }

    const wasPaused = this.gamePaused;
    this.gamePaused = !this.gamePaused;
    this.lastHudKey = '';
    this.lastPauseKey = '';
    if (wasPaused) {
      this.services.overlay.hidePanel();
    }
    this.services.audio.play('click');
    this.syncOverlay();
  }

  private getRuntimeDebugConfig(): BattleDebugRuntimeConfig {
    return {
      freezeEnemyMovement: this.debugConfig.freezeEnemyMovement,
      freezeEnemyProjectiles: this.debugConfig.freezeEnemyProjectiles,
      freezeEnemySpawning: this.debugConfig.freezeEnemySpawning,
      freezePlayerAutoFire: this.debugConfig.freezePlayerAutoFire,
      invulnerablePlayer: this.debugConfig.invulnerablePlayer,
    };
  }

  private getDebugTemplateOptions(): BattleDebugTemplateOption[] {
    return Object.values(BATTLE_TEMPLATES).map((template) => ({
      id: template.id,
      label: template.name,
      group:
        template.encounterType === 'boss'
          ? 'Boss'
          : template.winCondition.type === 'elite'
            ? 'Elite'
            : template.winCondition.type === 'survive'
              ? 'Survival'
              : 'Battle',
    }));
  }

  private syncDebugPanel(force = false): void {
    this.debugSyncElapsedMs += force ? DEBUG_SYNC_INTERVAL_MS : this.game.loop.delta;
    if (!force && this.debugSyncElapsedMs < DEBUG_SYNC_INTERVAL_MS) {
      return;
    }
    this.debugSyncElapsedMs = 0;
    this.services.debugPanel.sync(this.getDebugConfig(), this.getBattleDebugSnapshot());
  }

  /*
  private syncOverlay(): void {
    const state = this.engine.getState();
    const hudSnapshot = this.createHudSnapshot();
    const hudKey = JSON.stringify(hudSnapshot);
    if (hudKey !== this.lastHudKey) {
      this.services.overlay.showHud(hudSnapshot, () => this.toggleGamePause());
      this.lastHudKey = hudKey;
    }

    if (state.status === 'battle') {
      if (this.gamePaused) {
        const pauseKey = `pause:${state.phase}:${state.currentNode?.id ?? 'battle'}:${state.battle?.templateId ?? 'none'}`;
        if (pauseKey !== this.lastPauseKey) {
          this.services.overlay.showPausePanel(hudSnapshot, {
            onResume: () => this.toggleGamePause(),
            onRestart: () => {
              this.services.audio.play('start');
              this.services.metrics.beginRunFromRestart();
              this.gamePaused = false;
              this.lastPauseKey = '';
              this.services.overlay.hidePanel();
              this.scene.start('GameScene');
            },
            onBackToMenu: () => {
              this.services.audio.play('click');
              this.gamePaused = false;
              this.lastPauseKey = '';
              this.services.overlay.hidePanel();
              this.scene.start('MainMenuScene');
            },
            onVolume: () => {
              this.services.audio.play('click');
              this.services.overlay.showVolumePanel(
                '音量设置',
                '调整整体播放音量。',
                this.services.audio.getVolume(),
                (volume) => {
                  this.services.audio.setVolume(volume);
                  window.localStorage.setItem('pilot-audio-volume', String(volume));
                },
                () => {
                  this.services.audio.play('click');
                  this.lastPauseKey = '';
                  this.syncOverlay();
                },
              );
            },
          });
          this.lastPauseKey = pauseKey;
        }
        if (this.lastPanelKey) {
          this.services.overlay.hidePanel();
          this.lastPanelKey = '';
        }
        return;
      }

      if (this.lastPauseKey) {
        this.services.overlay.hidePanel();
        this.lastPauseKey = '';
      }
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
        this.services.audio.play('click');
        this.services.overlay.showNodePanel(
          getPhaseLabel(state.phase),
          state.nodeOptions,
          this.getPanelProgressSnapshot(),
          (nodeId) => {
            this.services.audio.play('confirm');
            this.engine.chooseNode(nodeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'upgradeChoice') {
      const panelKey = `upgrade:${state.phase}:${state.upgradeChoices.map((upgrade) => upgrade.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
        const panelTitle =
          state.upgradeSource === 'levelUp'
            ? `等级提升 Lv.${state.level}`
            : state.currentNode?.isFinalPrep
              ? '最终整备'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
          this.getUpgradePanelDescription(),
          this.getPanelProgressSnapshot(),
          state.upgradeChoices,
          (upgradeId) => {
            this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
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
        this.services.audio.play(state.currentEvent.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
        this.services.overlay.showEventPanel(state.currentEvent, this.getPanelProgressSnapshot(), (optionId) => {
          this.services.audio.play(state.currentEvent?.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
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
      const forceBattleToast =
        item.text.includes('Boss 已进场') ||
        item.text.includes('首领已进场') ||
        item.text.includes('精英裂口打开') ||
        item.text.includes('裂口出现') ||
        item.text.includes('安全窗打开') ||
        item.text.includes('压力上升');
        if (this.shouldDisplayToast(tone) || forceBattleToast) {
          this.services.overlay.pushToast(item.text, tone);
        }
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private syncAudioState(state: ReturnType<RunEngine['getState']>): void {
    const battle = state.battle;
    const routeFocus =
      battle ? this.getLiveCombatFocusRoute(battle) : state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
    const encounter =
      state.phase === 'finalBattle' || (state.status === 'battle' && battle?.encounterType === 'boss')
        ? 'boss'
        : state.status === 'battle' && battle?.encounterType === 'battle' && battle.eliteAlive
          ? 'elite'
          : state.status === 'battle' && battle && BATTLE_TEMPLATES[battle.templateId].winCondition.type === 'survive'
            ? 'survive'
            : state.status === 'battle'
              ? 'ordinary'
              : 'flow';
    const intensity = battle
        ? Phaser.Math.Clamp(
          Math.max(
            battle.tempoPulseSec / 0.3,
            battle.killFlowSec / 0.9,
            battle.dashDriveSec / 1.15,
            battle.pierceFlowSec / 0.74,
            battle.pickupFlowSec / 0.8,
            battle.playerTurnBurstSec / 0.18,
            battle.eliteCrackWindowSec / 0.82,
            battle.playerImpactSec / 0.34,
          ),
          0,
          1,
        )
      : 0;
    this.services.audio.setCombatContext({
      routeFocus,
      encounter,
      intensity,
    });

    if (state.phase === 'finalBattle' || (state.status === 'battle' && state.battle?.encounterType === 'boss')) {
      this.services.audio.setMusic('boss');
      return;
    }

    if (state.status === 'result') {
      this.services.audio.setMusic('result');
      return;
    }

    this.services.audio.setMusic('battle');
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const routeStatusText = this.getRouteStatusText();
    const progressSnapshot = this.getRunProgressSnapshot();
    const objectiveSnapshot = this.getObjectiveSnapshot();
    const statusText =
      state.status === 'battle' && state.battle ? this.getBattleStatusText(state.battle) : routeStatusText;

    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.round(state.stats.hp)} / ${Math.round(state.stats.maxHp)}`,
      hpRatio: state.stats.hp / Math.max(1, state.stats.maxHp),
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.round(state.experience)} / ${Math.round(state.experienceToNext)}`,
      experienceRatio: state.experience / Math.max(1, state.experienceToNext),
      routeStatusText,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        color: route.color,
        active: this.engine.getDominantRoute() === route.id,
      })).filter((route) => route.value > 0 || route.active),
      statSummary: createPanelStatSummary(state.stats),
      statusText,
      statusSubtext:
        state.status === 'battle' && state.battle ? this.getBattleStatusSubtext(state.battle) : progressSnapshot.progressDetail,
      progressLabel: progressSnapshot.progressLabel,
      progressDetail: progressSnapshot.progressDetail,
      phaseTrack: progressSnapshot.phaseTrack,
      objectiveLabel: objectiveSnapshot.objectiveLabel,
      objectiveText: objectiveSnapshot.objectiveText,
      objectiveDetail: objectiveSnapshot.objectiveDetail,
      objectiveProgressText: objectiveSnapshot.objectiveProgressText,
      objectiveTone: objectiveSnapshot.objectiveTone,
    };
  }

  private getBattleStatusText(battle: BattleState): string {
    return `${getBattleEncounterLabel(battle.templateId, battle.encounterType)} · ${this.getBattleIdentityLabel(battle)}`;
  }

  private getBattleIdentityLabel(battle: BattleState): string {
    const nodeTitle = this.engine.getState().currentNode?.title;
    if (battle.encounterType === 'boss') {
      return nodeTitle ?? BATTLE_TEMPLATES[battle.templateId].name;
    }

    return battle.label || nodeTitle || BATTLE_TEMPLATES[battle.templateId].name;
  }

  private getBattleStatusSubtext(battle: BattleState): string {
    const summaryParts: string[] = [];
    if (battle.encounterType === 'boss') {
      summaryParts.push(battle.eliteAlive ? 'Boss 已进场' : 'Boss 即将进场');
    }
    if (battle.pressurePhaseLabel) {
      summaryParts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }
    if (battle.pressureSignatureLabel) {
      summaryParts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      summaryParts.push(`区域 ${battle.pressurePatternLabel}`);
    }
    return summaryParts.join(' / ') || BATTLE_TEMPLATES[battle.templateId].description;

    const parts: string[] = [];

    if (battle.encounterType === 'boss') {
      parts.push(battle.eliteAlive ? '首领已进场' : '首领即将进场');
      parts.push(battle.eliteAlive ? '金色血条与箭头标记就是 Boss' : '金色血条出现后优先锁定首领');
    }

    if (battle.pressurePhaseLabel) {
      parts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }

    if (battle.pressureSignatureLabel) {
      parts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      parts.push(`空间 ${battle.pressurePatternLabel}`);
    }

    return parts.join(' · ') || BATTLE_TEMPLATES[battle.templateId].description;
  }

  private getPanelProgressSnapshot(): Pick<
    OverlayHudSnapshot,
    'progressLabel' | 'progressDetail' | 'phaseTrack' | 'levelText' | 'routeStatusText' | 'statSummary'
  > {
    const state = this.engine.getState();
    const progress = this.getRunProgressSnapshot();
    return {
      progressLabel: progress.progressLabel,
      progressDetail: progress.progressDetail,
      phaseTrack: progress.phaseTrack,
      levelText: `Lv.${state.level}`,
      routeStatusText: this.getRouteStatusText(),
      statSummary: createPanelStatSummary(state.stats),
    };
  }

  private getBossDistanceText(currentStep: number, totalRounds: number): string {
    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已在眼前';
    }
    if (remainingStops === 1) {
      return '再过 1 站进 Boss';
    }
    return `距 Boss 还剩 ${remainingStops} 站`;

    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已登场';
    }
    if (remainingStops === 1) {
      return '再推进 1 站就进 Boss';
    }
    return `离 Boss 还剩 ${remainingStops} 站`;
  }

  private getUpgradePanelDescription(): string {
    const state = this.engine.getState();
    if (state.upgradeSource === 'levelUp') {
      return '战斗里立刻补一项强化。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '最后一手补强，选完直接进 Boss。';
    }
    return '补当前打法最缺的一拍。';

    if (state.upgradeSource === 'levelUp') {
      return '这是战斗内升级，选完 1 项强化后会立刻回到当前战斗。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '这是 Boss 前最后一次整备，选完后会直接进入最终战。';
    }
    return '选择 1 项强化，补完这一手后继续推进。';
  }

  private getRunProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;
    let compactDetail = `${currentPhaseLabel}推进中，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      compactDetail = '最后整备，选完直接进 Boss。';
    } else if (state.phase === 'finalBattle') {
      compactDetail = '最终战已开始，这一战决定本局收束。';
    } else if (nextPhaseLabel) {
      compactDetail = `过完这一站进入${nextPhaseLabel}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds} / ${bossDistanceText}`,
      progressDetail: compactDetail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
        }
        if (step === currentStep) {
          return {
            label: entry.label,
            state: entry.phase === 'finalBattle' ? ('boss-active' as const) : ('active' as const),
          };
        }
        return {
          label: entry.label,
          state: entry.phase === 'finalBattle' ? ('boss-upcoming' as const) : ('upcoming' as const),
        };
      }),
    };

    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;

    let detail = `当前是${currentPhaseLabel}，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      detail = '这是 Boss 前最后一次整备，选完这一手就会进入最终战。';
    } else if (state.phase === 'finalBattle') {
      detail = '最终 Boss 已登场，本局结果就看这一战能不能收住。';
    } else if (nextPhaseLabel) {
      detail = `当前是${currentPhaseLabel}，完成这一站后进入${nextPhaseLabel}。${bossDistanceText}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds} · ${bossDistanceText}`,
      progressDetail: detail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
        }
        if (step === currentStep) {
          return {
            label: entry.label,
            state: entry.phase === 'finalBattle' ? ('boss-active' as const) : ('active' as const),
          };
        }
        return {
          label: entry.label,
          state: entry.phase === 'finalBattle' ? ('boss-upcoming' as const) : ('upcoming' as const),
        };
      }),
    };
  }

  private getObjectiveSnapshot(): Pick<
    OverlayHudSnapshot,
    'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'
  > {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: '盯住金色血条首领。',
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} / 终结首领` : '首领即将进场',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return this.getEliteObjectiveSnapshot(battle);
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '先稳住站位和血量。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '击破敌群',
        objectiveDetail: '清够数量就能推进。',
        objectiveProgressText: `${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '选定后立刻进 Boss。',
          objectiveProgressText: '最终收束入口',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '最后补一手再进 Boss。',
          objectiveProgressText: '整备后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选择下一站',
        objectiveDetail: `第 ${currentStep} / ${state.totalRounds} 站`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '选完立刻回战斗。' : '补完这一手继续推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完直接进 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常处理' : '完成事件选择',
        objectiveDetail: '处理完继续推进。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线收成型。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };

    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: `${targetTitle} 就是本局 Boss。盯住场上的大体型首领与金色血条，击破即可过关。`,
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} 已进场 · 击败首领就能完成本局` : '首领即将进场 · 先稳住第一轮压力',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return this.getEliteObjectiveSnapshot(battle);
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '这是生存战，稳住走位和血量，倒计时归零就能过关。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '击破敌群',
        objectiveDetail: `这是普通战，击破 ${battle.targetKills} 个敌人即可推进。`,
        objectiveProgressText: `已击破 ${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '这是最后一站，确认后会立刻进入本局首领收尾。',
          objectiveProgressText: '选定后立即进入 Boss',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '这是首领战前最后一次整备，确认后先补最后一手。',
          objectiveProgressText: '整备完成后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选择下一站',
        objectiveDetail: `当前第 ${currentStep} / ${state.totalRounds} 段，选完这一站后再继续推进。`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '这是战斗内升级，选完后会立刻回到当前战斗。' : '补完这一手后，流程会继续向下一段推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完这一手就进入 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常抉择' : '完成事件选择',
        objectiveDetail: '选完这一项后会继续推进，不会额外插入隐藏流程。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线扶到成型，并在 Boss 战前尽量补齐收尾能力。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
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

  }
  */

  private syncOverlay(): void {
    const state = this.engine.getState();
    const hudSnapshot = this.createHudSnapshot();
    const hudKey = JSON.stringify(hudSnapshot);
    if (hudKey !== this.lastHudKey) {
      this.services.overlay.showHud(hudSnapshot, () => this.toggleGamePause());
      this.lastHudKey = hudKey;
    }

    if (state.status === 'battle') {
      if (this.gamePaused) {
        const pauseKey = `pause:${state.phase}:${state.currentNode?.id ?? 'battle'}:${state.battle?.templateId ?? 'none'}`;
        if (pauseKey !== this.lastPauseKey) {
          this.services.overlay.showPausePanel(hudSnapshot, {
            onResume: () => this.toggleGamePause(),
            onRestart: () => {
              this.services.audio.play('start');
              this.services.metrics.beginRunFromRestart();
              this.gamePaused = false;
              this.lastHudKey = '';
              this.lastPauseKey = '';
              this.services.overlay.hidePanel();
              this.scene.start('GameScene');
            },
            onBackToMenu: () => {
              this.services.audio.play('click');
              this.gamePaused = false;
              this.lastHudKey = '';
              this.lastPauseKey = '';
              this.services.overlay.hidePanel();
              this.scene.start('MainMenuScene');
            },
            onVolume: () => {
              this.services.audio.play('click');
              this.services.overlay.showVolumePanel(
                '音量设置',
                '调整整体播放音量。',
                this.services.audio.getVolume(),
                (volume) => {
                  this.services.audio.setVolume(volume);
                  window.localStorage.setItem('pilot-audio-volume', String(volume));
                },
                () => {
                  this.services.audio.play('click');
                  this.lastPauseKey = '';
                  this.syncOverlay();
                },
              );
            },
          });
          this.lastPauseKey = pauseKey;
        }
        if (this.lastPanelKey) {
          this.services.overlay.hidePanel();
          this.lastPanelKey = '';
        }
        return;
      }

      if (this.lastPauseKey) {
        this.services.overlay.hidePanel();
        this.lastPauseKey = '';
      }
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
        this.services.audio.play('click');
        this.services.overlay.showNodePanel(
          getPhaseLabel(state.phase),
          state.nodeOptions,
          this.getPanelProgressSnapshot(),
          (nodeId) => {
            this.services.audio.play('confirm');
            this.engine.chooseNode(nodeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'upgradeChoice') {
      const panelKey = `upgrade:${state.phase}:${state.upgradeChoices.map((upgrade) => upgrade.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
        const panelTitle =
          state.upgradeSource === 'levelUp'
            ? `等级提升 Lv.${state.level}`
            : state.currentNode?.isFinalPrep
              ? '最终整备'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
          this.getUpgradePanelDescription(),
          this.getPanelProgressSnapshot(),
          state.upgradeChoices,
          (upgradeId) => {
            this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
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
        this.services.audio.play(state.currentEvent.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
        this.services.overlay.showEventPanel(state.currentEvent, this.getPanelProgressSnapshot(), (optionId) => {
          this.services.audio.play(state.currentEvent?.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
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
      const forceBattleToast =
        item.text.includes('Boss 已进场') ||
        item.text.includes('首领已进场') ||
        item.text.includes('精英裂口打开') ||
        item.text.includes('裂口出现') ||
        item.text.includes('安全窗打开') ||
        item.text.includes('压力上升');
        if (this.shouldDisplayToast(tone) || forceBattleToast) {
          this.services.overlay.pushToast(item.text, tone);
        }
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private syncAudioState(state: ReturnType<RunEngine['getState']>): void {
    const battle = state.battle;
    const routeFocus =
      battle ? this.getLiveCombatFocusRoute(battle) : state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
    const encounter =
      state.phase === 'finalBattle' || (state.status === 'battle' && battle?.encounterType === 'boss')
        ? 'boss'
        : state.status === 'battle' && battle?.encounterType === 'battle' && battle.eliteAlive
          ? 'elite'
          : state.status === 'battle' && battle && BATTLE_TEMPLATES[battle.templateId].winCondition.type === 'survive'
            ? 'survive'
            : state.status === 'battle'
              ? 'ordinary'
              : 'flow';
    const intensity = battle
      ? Phaser.Math.Clamp(
          Math.max(
            battle.tempoPulseSec / 0.3,
            battle.killFlowSec / 0.9,
            battle.pierceFlowSec / 0.74,
            battle.pickupFlowSec / 0.8,
            battle.eliteCrackWindowSec / 0.82,
            battle.playerImpactSec / 0.34,
          ),
          0,
          1,
        )
      : 0;
    this.services.audio.setCombatContext({
      routeFocus,
      encounter,
      intensity,
    });

    if (state.phase === 'finalBattle' || (state.status === 'battle' && state.battle?.encounterType === 'boss')) {
      this.services.audio.setMusic('boss');
      return;
    }

    if (state.status === 'result') {
      this.services.audio.setMusic('result');
      return;
    }

    this.services.audio.setMusic('battle');
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const routeStatusText = this.getRouteStatusText();
    const progressSnapshot = this.getRunProgressSnapshot();
    const objectiveSnapshot = this.getObjectiveSnapshot();
    const statusText = this.getHudModeText(state);

    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.round(state.stats.hp)} / ${Math.round(state.stats.maxHp)}`,
      hpRatio: state.stats.hp / Math.max(1, state.stats.maxHp),
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.round(state.experience)} / ${Math.round(state.experienceToNext)}`,
      experienceRatio: state.experience / Math.max(1, state.experienceToNext),
      routeStatusText,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        color: route.color,
        active: this.engine.getDominantRoute() === route.id,
      })).filter((route) => route.value > 0 || route.active),
      statSummary: createPanelStatSummary(state.stats),
      statusText,
      statusSubtext:
        state.status === 'battle' && state.battle ? this.getBattleStatusSubtext(state.battle) : progressSnapshot.progressDetail,
      progressLabel: progressSnapshot.progressLabel,
      progressDetail: progressSnapshot.progressDetail,
      phaseTrack: progressSnapshot.phaseTrack,
      objectiveLabel: objectiveSnapshot.objectiveLabel,
      objectiveText: objectiveSnapshot.objectiveText,
      objectiveDetail: objectiveSnapshot.objectiveDetail,
      objectiveProgressText: objectiveSnapshot.objectiveProgressText,
      objectiveTone: objectiveSnapshot.objectiveTone,
    };
  }

  private getBattleStatusText(battle: BattleState): string {
    return `${getBattleEncounterLabel(battle.templateId, battle.encounterType)} · ${this.getBattleIdentityLabel(battle)}`;
  }

  private getHudModeText(state: ReturnType<RunEngine['getState']>): string {
    if (state.status === 'battle' && state.battle) {
      if (state.battle.encounterType === 'boss') {
        return state.battle.eliteAlive ? 'Boss战 击败首领' : 'Boss战 首领进场中';
      }
      const winCondition = BATTLE_TEMPLATES[state.battle.templateId].winCondition.type;
      if (winCondition === 'kills') {
        return `歼灭 ${state.battle.kills}/${state.battle.targetKills}`;
      }
      if (winCondition === 'survive') {
        return `生存 ${Math.ceil(state.battle.remainingSec)}秒`;
      }
      if (winCondition === 'elite') {
        return '精英';
      }
      return getBattleEncounterLabel(state.battle.templateId, state.battle.encounterType);
    }

    if (state.status === 'upgradeChoice') {
      return state.currentNode?.isFinalPrep ? '最终整备' : '选择强化';
    }

    if (state.status === 'eventChoice') {
      return state.currentEvent?.contentKind === 'anomaly' ? '异常处理' : '选择事件';
    }

    if (state.status === 'nodeChoice') {
      return '选择路线';
    }

    if (state.status === 'result') {
      return '本局结算';
    }

    return this.getRouteStatusText();
  }

  private getBattleIdentityLabel(battle: BattleState): string {
    const nodeTitle = this.engine.getState().currentNode?.title;
    if (battle.encounterType === 'boss') {
      return nodeTitle ?? BATTLE_TEMPLATES[battle.templateId].name;
    }

    return battle.label || nodeTitle || BATTLE_TEMPLATES[battle.templateId].name;
  }

  private getBattleStatusSubtext(battle: BattleState): string {
    const summaryParts: string[] = [];
    if (battle.encounterType === 'boss') {
      summaryParts.push(battle.eliteAlive ? 'Boss 已进场' : 'Boss 即将进场');
    }
    if (battle.pressurePhaseLabel) {
      summaryParts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }
    if (battle.pressureSignatureLabel) {
      summaryParts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      summaryParts.push(`区域 ${battle.pressurePatternLabel}`);
    }
    return summaryParts.join(' / ') || BATTLE_TEMPLATES[battle.templateId].description;
  }

  private getPanelProgressSnapshot(): Pick<
    OverlayHudSnapshot,
    'progressLabel' | 'progressDetail' | 'phaseTrack' | 'levelText' | 'routeStatusText' | 'statSummary'
  > {
    const state = this.engine.getState();
    const progress = this.getRunProgressSnapshot();
    return {
      progressLabel: progress.progressLabel,
      progressDetail: progress.progressDetail,
      phaseTrack: progress.phaseTrack,
      levelText: `Lv.${state.level}`,
      routeStatusText: this.getRouteStatusText(),
      statSummary: createPanelStatSummary(state.stats),
    };
  }

  private getBossDistanceText(currentStep: number, totalRounds: number): string {
    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已在眼前';
    }
    if (remainingStops === 1) {
      return '再过 1 站进 Boss';
    }
    return `距 Boss 还剩 ${remainingStops} 站`;
  }

  private getUpgradePanelDescription(): string {
    const state = this.engine.getState();
    if (state.upgradeSource === 'levelUp') {
      return '战斗里立刻补一项强化。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '最后一手补强，选完直接进 Boss。';
    }
    return '补当前打法最缺的一拍。';
  }

  private getRunProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;

    let progressDetail = `${currentPhaseLabel}推进中，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      progressDetail = '最后整备，选完直接进 Boss。';
    } else if (state.phase === 'finalBattle') {
      progressDetail = '最终战已开始，这一战决定整局收束。';
    } else if (nextPhaseLabel) {
      progressDetail = `过完这一站进入${nextPhaseLabel}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds}`,
      progressDetail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
        }
        if (step === currentStep) {
          return {
            label: entry.label,
            state: entry.phase === 'finalBattle' ? ('boss-active' as const) : ('active' as const),
          };
        }
        return {
          label: entry.label,
          state: entry.phase === 'finalBattle' ? ('boss-upcoming' as const) : ('upcoming' as const),
        };
      }),
    };
  }

  private getObjectiveSnapshot(): Pick<
    OverlayHudSnapshot,
    'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'
  > {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);

    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: '盯住金色血条，把最后一段收掉。',
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} / 终结首领` : '首领即将进场',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return this.getEliteObjectiveSnapshot(battle);
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '优先活下来，别贪线。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '清掉这一波敌群',
        objectiveDetail: '击破数量够了就能继续推进。',
        objectiveProgressText: `${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '选定后立刻进入 Boss。',
          objectiveProgressText: '最终收束入口',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '补最后一手，再进 Boss。',
          objectiveProgressText: '整备后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选下一站路线',
        objectiveDetail: `当前第 ${currentStep} / ${state.totalRounds} 站。`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '选完立刻回战斗。' : '补完这一手继续推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完直接进 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常处理' : '完成事件选择',
        objectiveDetail: '处理完就继续往下走。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线收成型。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };
  }

  private getEliteObjectiveSnapshot(
    battle: BattleState,
  ): Pick<OverlayHudSnapshot, 'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'> {
    const escortCount = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0).length;
    const crackRatio = battle.eliteCrackWindowSec > 0 ? Math.min(1, battle.eliteCrackWindowSec / 0.82) : 0;
    const breachFlashRatio = battle.eliteBreachFlashSec > 0 ? Math.min(1, battle.eliteBreachFlashSec / 0.48) : 0;
    const displayedCrackRatio = Math.max(crackRatio, breachFlashRatio * 0.92);

    if (!battle.eliteAlive) {
      return {
        objectiveLabel: '当前目标',
        objectiveText: '稳住第一轮压力',
        objectiveDetail: '精英还没进场，先把站位和血量稳住。',
        objectiveProgressText: '精英即将进场',
        objectiveTone: 'elite',
      };
    }

    if (displayedCrackRatio > 0.1) {
      return {
        objectiveLabel: '当前目标',
        objectiveText: '裂口已开，压上本体',
        objectiveDetail: '沿楔形追进去，别把火力再丢回护卫。',
        objectiveProgressText: `窗口 ${battle.eliteCrackWindowSec.toFixed(1)}s · 破口 ${Math.max(1, battle.eliteCrackEscortCount)}`,
        objectiveTone: 'elite',
      };
    }

    if (escortCount > 0) {
      return {
        objectiveLabel: '当前目标',
        objectiveText: '先拆护卫，等裂口',
        objectiveDetail: '护卫还在成屏，别硬顶本体，等破口再追。',
        objectiveProgressText: `护卫 ${escortCount} · 本体在后`,
        objectiveTone: 'elite',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '盯住精英本体',
      objectiveDetail: '屏障已经变薄，继续压本体就能过关。',
      objectiveProgressText: `${BATTLE_TEMPLATES[battle.templateId].name} · 击破本体`,
      objectiveTone: 'elite',
    };
  }

  private getRouteStatusText(): string {
    const state = this.engine.getState();
    if (state.maturedRoute) {
      return `${ROUTE_NAME_MAP[state.maturedRoute]}已成型`;
    }
    if (state.committedRoute) {
      return `${ROUTE_NAME_MAP[state.committedRoute]}正在成线`;
    }

    const dominantRoute = this.engine.getDominantRoute();
    return dominantRoute ? `${ROUTE_NAME_MAP[dominantRoute]}开始冒头` : '还没站稳主路线';
  }

  private getToastTone(text: string): ToastTone {
    if (text.includes('精英') || text.includes('高压') || text.includes('压力') || text.includes('Boss')) {
      return 'danger';
    }
    if (text.includes('成型') || text.includes('成线') || text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
      return 'route';
    }
    if (text.includes('完成') || text.includes('接入') || text.includes('收住')) {
      return 'success';
    }
    if (text.includes('进入') || text.includes('前段') || text.includes('中段') || text.includes('后段') || text.includes('整备')) {
      return 'accent';
    }
    return 'neutral';
  }

  private shouldDisplayToast(tone: ToastTone): boolean {
    const status = this.engine.getState().status;
    if (status === 'battle') {
      return tone === 'danger' || tone === 'route';
    }

    if (status === 'upgradeChoice' || status === 'eventChoice' || status === 'nodeChoice') {
      return false;
    }

    return tone === 'danger' || tone === 'success' || tone === 'route';
  }

  private renderBattle(): void {
    const dominantRoute = this.engine.getDominantRoute();
    const accentColor = dominantRoute ? parseInt(ROUTE_COLOR_MAP[dominantRoute].slice(1), 16) : 0x61d7ff;
    const battle = this.engine.getState().battle;

    this.graphics.clear();
    this.beginRuntimePreviewImageFrame();
    if (!battle) {
      this.graphics.fillGradientStyle(0x13100d, 0x13100d, 0x070706, 0x050505, 1);
      this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
      this.endRuntimePreviewImageFrame();
      return;
    }

    const camera = this.getBattleCameraRect(battle);
    this.renderBattleTerrain(battle, camera, accentColor);
    this.renderBattleEntities(battle, camera, accentColor);
    this.endRuntimePreviewImageFrame();
  }

  private beginRuntimePreviewImageFrame(): void {
    this.runtimePreviewImageCursor = 0;
  }

  private endRuntimePreviewImageFrame(): void {
    for (let index = this.runtimePreviewImageCursor; index < this.runtimePreviewImages.length; index += 1) {
      this.runtimePreviewImages[index].setVisible(false);
    }
  }

  private renderRuntimePreviewImage(
    textureKey: string,
    x: number,
    y: number,
    size: number,
    rotation = 0,
    alpha = 0.82,
  ): boolean {
    if (!this.runtimeVisualPreviewEnabled || !this.textures.exists(textureKey)) {
      return false;
    }

    let image = this.runtimePreviewImages[this.runtimePreviewImageCursor];
    if (!image) {
      image = this.add.image(0, 0, textureKey);
      image.setDepth(30);
      image.setBlendMode(Phaser.BlendModes.NORMAL);
      this.runtimePreviewImages.push(image);
    }

    image
      .setTexture(textureKey)
      .setPosition(x, y)
      .setDisplaySize(size, size)
      .setRotation(rotation)
      .setAlpha(alpha)
      .setVisible(true);
    this.runtimePreviewImageCursor += 1;
    return true;
  }

  private getBattleCameraRect(battle: BattleState): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  } {
    const width = this.scale.width;
    const height = this.scale.height;
    const maxLeft = Math.max(0, ARENA_WIDTH - width);
    const maxTop = Math.max(0, ARENA_HEIGHT - height);
    const baseLeft = clamp(battle.playerX - width * 0.5, 0, maxLeft);
    const baseTop = clamp(battle.playerY - height * 0.5, 0, maxTop);
    const shakeWindow = battle.cameraShakeSec > 0 ? Phaser.Math.Clamp(battle.cameraShakeSec / 0.22, 0, 1) : 0;
    const shakeStrength = Math.min(1, battle.cameraShakeStrength) * (0.18 + shakeWindow * 0.36);
    const shakePhase = battle.elapsedSec * 11 + battle.kills * 0.08;
    const shakeX =
      battle.cameraShakeSec > 0
        ? Math.sin(shakePhase) * (1.1 + shakeWindow * 0.8) * shakeStrength
        : 0;
    const shakeY =
      battle.cameraShakeSec > 0
        ? Math.cos(shakePhase * 0.82 + 0.42) * (0.8 + shakeWindow * 0.58) * shakeStrength
        : 0;
    const left = clamp(baseLeft + shakeX, 0, maxLeft);
    const top = clamp(baseTop + shakeY, 0, maxTop);

    return {
      left,
      right: left + width,
      top,
      bottom: top + height,
      width,
      height,
    };
  }

  private worldToScreen(
    camera: { left: number; top: number },
    x: number,
    y: number,
  ): { x: number; y: number } {
    return {
      x: x - camera.left,
      y: y - camera.top,
    };
  }

  private isVisibleInCamera(
    camera: { left: number; right: number; top: number; bottom: number },
    x: number,
    y: number,
    padding = 40,
  ): boolean {
    return x >= camera.left - padding && x <= camera.right + padding && y >= camera.top - padding && y <= camera.bottom + padding;
  }

  private getTerrainNoise(x: number, y: number, salt = 0): number {
    const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.129) * 43758.5453123;
    return value - Math.floor(value);
  }

  private renderBattleTerrain(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.graphics.fillGradientStyle(0x0b1721, 0x0f2030, 0x060a0f, 0x04070b, 1);
    this.graphics.fillRect(0, 0, camera.width, camera.height);

    const blotStartX = Math.floor(camera.left / TERRAIN_BLOT_SIZE) - 1;
    const blotEndX = Math.ceil(camera.right / TERRAIN_BLOT_SIZE) + 1;
    const blotStartY = Math.floor(camera.top / TERRAIN_BLOT_SIZE) - 1;
    const blotEndY = Math.ceil(camera.bottom / TERRAIN_BLOT_SIZE) + 1;
    for (let blotY = blotStartY; blotY <= blotEndY; blotY += 1) {
      for (let blotX = blotStartX; blotX <= blotEndX; blotX += 1) {
        const noise = this.getTerrainNoise(blotX, blotY, 7);
        const worldX = blotX * TERRAIN_BLOT_SIZE + TERRAIN_BLOT_SIZE * 0.5;
        const worldY = blotY * TERRAIN_BLOT_SIZE + TERRAIN_BLOT_SIZE * 0.5;
        const screen = this.worldToScreen(camera, worldX, worldY);
        const width = 190 + noise * 140;
        const height = 88 + this.getTerrainNoise(blotX, blotY, 9) * 90;
        this.graphics.fillStyle(noise > 0.54 ? 0x33404b : 0x1a232c, noise > 0.54 ? 0.16 : 0.1);
        this.graphics.fillEllipse(screen.x, screen.y, width, height);
      }
    }

    const tileStartX = Math.floor(camera.left / TERRAIN_TILE_SIZE) - 1;
    const tileEndX = Math.ceil(camera.right / TERRAIN_TILE_SIZE) + 1;
    const tileStartY = Math.floor(camera.top / TERRAIN_TILE_SIZE) - 1;
    const tileEndY = Math.ceil(camera.bottom / TERRAIN_TILE_SIZE) + 1;
    for (let tileY = tileStartY; tileY <= tileEndY; tileY += 1) {
      for (let tileX = tileStartX; tileX <= tileEndX; tileX += 1) {
        const noise = this.getTerrainNoise(tileX, tileY, 1);
        const worldX = tileX * TERRAIN_TILE_SIZE;
        const worldY = tileY * TERRAIN_TILE_SIZE;
        const screen = this.worldToScreen(camera, worldX, worldY);
        const tileColor = noise > 0.62 ? 0x213244 : noise > 0.3 ? 0x182634 : 0x101922;
        this.graphics.fillStyle(tileColor, 0.18 + noise * 0.08);
        this.graphics.fillRoundedRect(screen.x, screen.y, TERRAIN_TILE_SIZE - 8, TERRAIN_TILE_SIZE - 8, 20);

        const detailNoise = this.getTerrainNoise(tileX, tileY, 4);
        this.graphics.fillStyle(0x71869a, 0.07 + detailNoise * 0.06);
        this.graphics.fillEllipse(
          screen.x + 24 + detailNoise * 44,
          screen.y + 20 + this.getTerrainNoise(tileX, tileY, 5) * 52,
          20 + detailNoise * 26,
          8 + detailNoise * 16,
        );

        if (detailNoise > 0.42) {
          const pebbleCount = detailNoise > 0.72 ? 2 : 1;
          for (let pebble = 0; pebble < pebbleCount; pebble += 1) {
            const px = screen.x + 18 + this.getTerrainNoise(tileX, tileY, 20 + pebble) * (TERRAIN_TILE_SIZE - 36);
            const py = screen.y + 18 + this.getTerrainNoise(tileX, tileY, 30 + pebble) * (TERRAIN_TILE_SIZE - 36);
            this.graphics.fillStyle(0x0d1116, 0.18);
            this.graphics.fillCircle(px, py, 2 + this.getTerrainNoise(tileX, tileY, 40 + pebble) * 3);
          }
        }
      }
    }

    this.renderEncounterBackdrop(battle, camera, accentColor);
  }

  private renderEncounterBackdrop(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pulse = 0.5 + Math.sin(battle.elapsedSec * 1.7 + battle.kills * 0.08) * 0.5;
    const encounterGlow =
      template.winCondition.type === 'survive'
        ? this.mixColor(accentColor, 0xff8677, 0.22)
        : template.winCondition.type === 'elite'
          ? this.mixColor(accentColor, 0xffd8a8, 0.22)
          : this.mixColor(accentColor, 0xc2e0ff, 0.2);

    if (template.winCondition.type === 'survive') {
      const edgeAlpha = 0.032 + pulse * 0.03;
      this.graphics.fillStyle(encounterGlow, edgeAlpha);
      this.graphics.fillRect(0, 0, camera.width, 26);
      this.graphics.fillRect(0, camera.height - 26, camera.width, 26);
      this.graphics.lineStyle(2, encounterGlow, 0.035 + pulse * 0.05);
      this.graphics.lineBetween(0, 34, camera.width, 34);
      this.graphics.lineBetween(0, camera.height - 34, camera.width, camera.height - 34);
    } else if (template.winCondition.type === 'elite') {
      const topBeaconY = this.worldToScreen(camera, ARENA_WIDTH * 0.5, 116).y;
      const centerBeacon = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      this.graphics.lineStyle(2, encounterGlow, 0.035 + pulse * 0.05);
      this.graphics.lineBetween(camera.width * 0.5, topBeaconY, centerBeacon.x, centerBeacon.y - 64);
      this.graphics.lineStyle(1.5, encounterGlow, 0.035 + pulse * 0.04);
      this.graphics.lineBetween(centerBeacon.x - 56, centerBeacon.y, centerBeacon.x - 20, centerBeacon.y);
      this.graphics.lineBetween(centerBeacon.x + 20, centerBeacon.y, centerBeacon.x + 56, centerBeacon.y);
      this.graphics.lineBetween(centerBeacon.x, centerBeacon.y - 56, centerBeacon.x, centerBeacon.y - 22);
    } else {
      const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      this.graphics.lineStyle(1.5, encounterGlow, 0.025 + pulse * 0.035);
      this.graphics.lineBetween(center.x - 132, center.y, center.x - 78, center.y);
      this.graphics.lineBetween(center.x + 78, center.y, center.x + 132, center.y);
      this.graphics.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
      this.graphics.fillTriangle(center.x - 150, center.y, center.x - 126, center.y - 12, center.x - 126, center.y + 12);
      this.graphics.fillTriangle(center.x + 150, center.y, center.x + 126, center.y - 12, center.x + 126, center.y + 12);
    }

    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    if (pattern === 'lanes' && laneBias === 'vertical') {
      for (const worldX of [ARENA_WIDTH * 0.24, ARENA_WIDTH * 0.5, ARENA_WIDTH * 0.76]) {
        const screenX = worldX - camera.left;
        if (screenX < -40 || screenX > camera.width + 40) {
          continue;
        }
        this.graphics.fillStyle(encounterGlow, 0.032 + pulse * 0.026);
        this.graphics.fillRect(screenX - 18, 0, 36, camera.height);
        this.graphics.lineStyle(1.5, encounterGlow, 0.03 + pulse * 0.04);
        this.graphics.lineBetween(screenX, 0, screenX, camera.height);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      // 横向车道背景层已删除 - 避免三条半透明条纹残留
      // 如需调试显示，请取消下方注释
      /*
      for (const worldY of [ARENA_HEIGHT * 0.24, ARENA_HEIGHT * 0.5, ARENA_HEIGHT * 0.76]) {
        const screenY = worldY - camera.top;
        if (screenY < -40 || screenY > camera.height + 40) {
          continue;
        }
        this.graphics.fillStyle(encounterGlow, 0.03 + pulse * 0.024);
        this.graphics.fillRect(0, screenY - 16, camera.width, 32);
        this.graphics.lineStyle(1.5, encounterGlow, 0.03 + pulse * 0.04);
        this.graphics.lineBetween(0, screenY, camera.width, screenY);
      }
      */
      return;
    }

    if (pattern === 'pincers') {
      const sideYBase = (battle.elapsedSec * 88) % Math.max(180, ARENA_HEIGHT - 120);
      for (let index = 0; index < 3; index += 1) {
        const worldY = 72 + ((sideYBase + index * 180) % Math.max(220, ARENA_HEIGHT - 120));
        const left = this.worldToScreen(camera, 52, worldY);
        const right = this.worldToScreen(camera, ARENA_WIDTH - 52, worldY);
        if (left.y >= -48 && left.y <= camera.height + 48) {
          this.graphics.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          this.graphics.fillTriangle(left.x, left.y, left.x + 24, left.y - 16, left.x + 24, left.y + 16);
        }
        if (right.y >= -48 && right.y <= camera.height + 48) {
          this.graphics.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          this.graphics.fillTriangle(right.x, right.y, right.x - 24, right.y - 16, right.x - 24, right.y + 16);
        }
      }
      return;
    }

    const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
    this.graphics.lineStyle(1.5, encounterGlow, 0.025 + pulse * 0.035);
    this.graphics.lineBetween(center.x - 148, center.y - 74, center.x - 96, center.y - 46);
    this.graphics.lineBetween(center.x - 148, center.y + 74, center.x - 96, center.y + 46);
    this.graphics.lineBetween(center.x + 96, center.y - 46, center.x + 148, center.y - 74);
    this.graphics.lineBetween(center.x + 96, center.y + 46, center.x + 148, center.y + 74);
  }

  private renderBattleEntities(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.renderEncounterFlowOverlay(battle, camera, accentColor);
    this.renderPressurePatternOverlay(battle, camera, accentColor);

    // Boss fireline texture overlay disabled - it was blocking the gameplay view
    // Only programmatic indicators (safe zones, danger indicators) are shown now

    const tempoRatio = Math.min(1, battle.tempoPulseSec / 0.3);
    const dominantRoute = this.engine.getDominantRoute();
    const state = this.engine.getState();
    const liveFocusRoute = this.getLiveCombatFocusRoute(battle);
    const flowChainRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const pickupFlowRatio =
      battle.pickupFlowSec > 0
        ? Math.min(
            1,
            battle.pickupFlowSec /
              (battle.pickupFlowCount >= 4 ? 0.88 : battle.pickupFlowCount === 3 ? 0.8 : battle.pickupFlowCount === 2 ? 0.72 : 0.62),
          )
        : 0;
    const pierceFlowRatio =
      battle.pierceFlowSec > 0
        ? Math.min(1, battle.pierceFlowSec / (0.46 + Math.min(0.28, battle.pierceFlowCount * 0.06)))
        : 0;
    const flowGuideColor =
      liveFocusRoute === 'crit'
        ? this.mixColor(accentColor, 0xffd882, 0.24)
        : liveFocusRoute === 'pierce'
          ? this.mixColor(accentColor, 0xdff6ff, 0.22)
          : liveFocusRoute === 'dash'
            ? this.mixColor(accentColor, 0xbfffea, 0.22)
            : this.mixColor(accentColor, 0xfff2c3, 0.18);
    const pickupGuideColor = this.mixColor(0x9df7c5, liveFocusRoute === 'dash' ? 0xdffff6 : 0xffffff, 0.18);
    const pierceReadRatio = liveFocusRoute === 'pierce' ? Math.min(1, state.routeCounts.pierce / 5) : 0;
    const pierceSignatureRatio = Math.max(pierceReadRatio * 0.55, pierceFlowRatio);
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    for (const orb of battle.experienceOrbs) {
      if (!this.isVisibleInCamera(camera, orb.x, orb.y, 20)) {
        continue;
      }

      const screen = this.worldToScreen(camera, orb.x, orb.y);
      const orbSpeed = Math.hypot(orb.velocityX, orb.velocityY);
      const orbSpeedRatio = Phaser.Math.Clamp(orbSpeed / 320, 0, 1);
      const distanceToPlayer = Math.hypot(orb.x - battle.playerX, orb.y - battle.playerY);
      const pulse = 0.5 + Math.sin(battle.elapsedSec * 5.6 + orb.id * 0.77) * 0.5;
      if (orbSpeedRatio > 0.06) {
        const tail = this.worldToScreen(camera, orb.x - orb.velocityX * 0.05, orb.y - orb.velocityY * 0.05);
        this.graphics.fillStyle(XP_ORB_STROKE, 0.03 + orbSpeedRatio * 0.05);
        this.graphics.fillCircle(tail.x, tail.y, 1.2 + orbSpeedRatio * 0.7);
      }
      if (distanceToPlayer <= 180) {
        const linkAlpha = 0.03 + (1 - distanceToPlayer / 180) * 0.08;
        this.graphics.fillStyle(XP_ORB_STROKE, linkAlpha);
        this.graphics.fillCircle(screen.x, screen.y, 11 + (1 - distanceToPlayer / 180) * 3);
      }
      if (flowChainRatio > 0.12 && distanceToPlayer <= 210 + battle.killFlowCount * 16) {
        const flowLinkAlpha =
          0.025 + flowChainRatio * (0.06 + Math.max(0, 1 - distanceToPlayer / (210 + battle.killFlowCount * 16)) * 0.06);
        this.graphics.lineStyle(1.2, flowGuideColor, flowLinkAlpha);
        this.graphics.strokeCircle(screen.x, screen.y, 12 + flowChainRatio * 4);
      }
      if (pierceSignatureRatio > 0.12 && distanceToPlayer <= 230) {
        const railAlpha = 0.04 + pierceSignatureRatio * Math.max(0, 1 - distanceToPlayer / 230) * 0.12;
        this.graphics.lineStyle(1.1, this.mixColor(0x8fdcff, 0xffffff, 0.16), railAlpha);
        this.graphics.strokeCircle(screen.x, screen.y, 11 + pierceSignatureRatio * 4);
      }
      this.graphics.fillStyle(XP_ORB_FILL, 0.12 + pulse * 0.14 + orbSpeedRatio * 0.08);
      this.graphics.fillCircle(screen.x, screen.y, 9 + pulse * 2);
      this.graphics.fillStyle(XP_ORB_FILL, 0.92);
      this.graphics.fillCircle(screen.x, screen.y, 5);
      this.graphics.lineStyle(1.5, XP_ORB_STROKE, 0.3 + pulse * 0.2 + orbSpeedRatio * 0.12);
      this.graphics.strokeCircle(screen.x, screen.y, 8 + pulse * 2 + orbSpeedRatio * 2);
      this.graphics.lineStyle(1.2, XP_ORB_STROKE, 0.14 + pulse * 0.12);
      this.graphics.lineBetween(screen.x - 4, screen.y, screen.x + 4, screen.y);
      this.graphics.lineBetween(screen.x, screen.y - 4, screen.x, screen.y + 4);
      this.renderRuntimePreviewImage(PREVIEW_XP_ORB_TEXTURE, screen.x, screen.y, 26 + pulse * 3 + orbSpeedRatio * 2, 0, 0.72);
    }

    for (const pulse of battle.pulses) {
      if (!this.isVisibleInCamera(camera, pulse.x, pulse.y, pulse.radius + 12)) {
        continue;
      }

      const screen = this.worldToScreen(camera, pulse.x, pulse.y);
      const lifeRatio = pulse.maxLifeSec > 0 ? pulse.lifeSec / pulse.maxLifeSec : 0;
      if (pulse.fillAlpha > 0) {
        this.graphics.fillStyle(pulse.color, pulse.fillAlpha * lifeRatio);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(8, pulse.radius * 0.78));
      }
      this.graphics.lineStyle(pulse.strokeWidth, pulse.color, pulse.strokeAlpha * lifeRatio);
      this.graphics.strokeCircle(screen.x, screen.y, pulse.radius);
      this.graphics.lineStyle(
        Math.max(1, pulse.strokeWidth - 1),
        pulse.secondaryColor,
        Math.min(1, pulse.strokeAlpha * 0.78) * lifeRatio,
      );
      this.graphics.strokeCircle(screen.x, screen.y, Math.max(6, pulse.radius * pulse.innerRadiusRatio));
      if (pulse.spokeCount > 0 && pulse.spokeLength > 0) {
        const spokeAlpha = Math.min(1, pulse.strokeAlpha * 0.72) * lifeRatio;
        const spokeInnerRadius = Math.max(5, pulse.radius * Math.max(0.34, pulse.innerRadiusRatio * 0.68));
        const spokeOuterRadius = pulse.radius + pulse.spokeLength * (0.36 + lifeRatio * 0.64);
        const spokeWidth = Math.max(1, pulse.strokeWidth - 0.4);
        this.graphics.lineStyle(spokeWidth, pulse.secondaryColor, spokeAlpha * 0.78);
        for (let spoke = 0; spoke < pulse.spokeCount; spoke += 1) {
          const angle = pulse.angle + (spoke / pulse.spokeCount) * Math.PI * 2;
          const innerX = screen.x + Math.cos(angle) * spokeInnerRadius;
          const innerY = screen.y + Math.sin(angle) * spokeInnerRadius;
          const outerX = screen.x + Math.cos(angle) * spokeOuterRadius;
          const outerY = screen.y + Math.sin(angle) * spokeOuterRadius;
          this.graphics.lineBetween(innerX, innerY, outerX, outerY);
        }
        this.graphics.lineStyle(Math.max(1, spokeWidth - 0.6), pulse.color, spokeAlpha);
        for (let spoke = 0; spoke < pulse.spokeCount; spoke += 1) {
          const angle = pulse.angle + (spoke / pulse.spokeCount) * Math.PI * 2 + 0.06;
          const innerX = screen.x + Math.cos(angle) * (spokeInnerRadius * 0.72);
          const innerY = screen.y + Math.sin(angle) * (spokeInnerRadius * 0.72);
          const outerX = screen.x + Math.cos(angle) * (spokeOuterRadius - pulse.spokeLength * 0.22);
          const outerY = screen.y + Math.sin(angle) * (spokeOuterRadius - pulse.spokeLength * 0.22);
          this.graphics.lineBetween(innerX, innerY, outerX, outerY);
        }
      }
    }

    for (const bullet of battle.bullets) {
      if (!this.isVisibleInCamera(camera, bullet.x, bullet.y, 18)) {
        continue;
      }

      const screen = this.worldToScreen(camera, bullet.x, bullet.y);

      // Try to render preview image for bullet core
      const bulletCoreSize = 10 + (bullet.canEcho ? 2 : 0);
      const bulletRotation = Math.atan2(bullet.vy, bullet.vx);
      const previewRendered = this.renderRuntimePreviewImage(
        PREVIEW_PLAYER_PROJECTILE_TEXTURE,
        screen.x,
        screen.y,
        bulletCoreSize,
        bulletRotation,
        0.75,
      );

      const tailDistance =
        bullet.routeFocus === 'dash'
          ? 0.018
          : bullet.routeFocus === 'crit'
            ? 0.016
            : bullet.routeFocus === 'pierce'
              ? 0.022 + pierceSignatureRatio * 0.003
              : 0.015;
      const tail = this.worldToScreen(camera, bullet.x - bullet.vx * tailDistance, bullet.y - bullet.vy * tailDistance);
      const bulletSpeedRatio = Phaser.Math.Clamp(Math.hypot(bullet.vx, bullet.vy) / 520, 0.35, 1);
      const bulletHitRatio = Phaser.Math.Clamp(bullet.hitCount / 3, 0, 1);
      const bulletDirX = bulletSpeedRatio > 0 ? bullet.vx / Math.max(1, Math.hypot(bullet.vx, bullet.vy)) : 0;
      const bulletDirY = bulletSpeedRatio > 0 ? bullet.vy / Math.max(1, Math.hypot(bullet.vx, bullet.vy)) : 0;
      const bulletOrthoX = -bulletDirY;
      const bulletOrthoY = bulletDirX;
      let bulletTint = bullet.pierceRemaining > 0 || bullet.canEcho ? accentColor : 0xf8fbff;
      if (bullet.routeFocus === 'crit') {
        bulletTint = this.mixColor(0xffcb74, accentColor, 0.22);
      } else if (bullet.routeFocus === 'pierce') {
        bulletTint = this.mixColor(0x8fd8ff, accentColor, 0.28);
      } else if (bullet.routeFocus === 'dash') {
        bulletTint = this.mixColor(0x8cffdf, accentColor, 0.26);
      }
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 1.8 : 1.2) + bulletHitRatio * 0.5,
        bulletTint,
        (bullet.canEcho ? 0.12 : 0.06) + bulletHitRatio * 0.03,
      );
      this.graphics.lineBetween(
        tail.x - bulletDirX * (5 + bulletSpeedRatio * 4),
        tail.y - bulletDirY * (5 + bulletSpeedRatio * 4),
        screen.x,
        screen.y,
      );
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 1.4 : 0.95) + bulletHitRatio * 0.4,
        bulletTint,
        (bullet.canEcho ? 0.28 : 0.18) + bulletHitRatio * 0.06,
      );
      this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
      this.graphics.fillStyle(bulletTint, (bullet.canEcho ? 0.24 : 0.14) + bulletHitRatio * 0.06);
      this.graphics.fillCircle(screen.x, screen.y, (bullet.canEcho ? 6.5 : 4.8) + bulletHitRatio * 1.1);
      if (bullet.routeFocus === 'crit') {
        this.graphics.lineStyle(1.35, bulletTint, 0.16 + bulletSpeedRatio * 0.1);
        this.graphics.lineBetween(
          screen.x - bulletDirX * 8 + bulletOrthoX * 4,
          screen.y - bulletDirY * 8 + bulletOrthoY * 4,
          screen.x + bulletDirX * 7,
          screen.y + bulletDirY * 7,
        );
        this.graphics.lineBetween(
          screen.x - bulletDirX * 8 - bulletOrthoX * 4,
          screen.y - bulletDirY * 8 - bulletOrthoY * 4,
          screen.x + bulletDirX * 7,
          screen.y + bulletDirY * 7,
        );
      } else if (bullet.routeFocus === 'pierce') {
        this.graphics.lineStyle(
          1.3 + bulletHitRatio * 0.6 + pierceFlowRatio * 0.25,
          bulletTint,
          0.16 + bulletSpeedRatio * 0.1 + bulletHitRatio * 0.08 + pierceFlowRatio * 0.06,
        );
        const tickReach = 5 + bulletHitRatio * 2 + pierceSignatureRatio * 2;
        this.graphics.lineBetween(
          screen.x - bulletOrthoX * tickReach,
          screen.y - bulletOrthoY * tickReach,
          screen.x + bulletOrthoX * tickReach,
          screen.y + bulletOrthoY * tickReach,
        );
        if (pierceSignatureRatio > 0.12) {
          this.graphics.lineStyle(1.1, this.mixColor(bulletTint, 0xffffff, 0.32), 0.1 + pierceSignatureRatio * 0.12);
          this.graphics.strokeCircle(screen.x, screen.y, 7 + pierceSignatureRatio * 2 + bulletHitRatio * 2);
        }
        if (bulletHitRatio > 0) {
          this.graphics.lineStyle(1.4, this.mixColor(bulletTint, 0xffffff, 0.24), 0.14 + bulletHitRatio * 0.16);
          this.graphics.lineBetween(
            tail.x + bulletDirX * 4,
            tail.y + bulletDirY * 4,
            screen.x + bulletDirX * 10,
            screen.y + bulletDirY * 10,
          );
        }
      } else if (bullet.routeFocus === 'dash') {
        this.graphics.fillStyle(bulletTint, 0.12 + bulletSpeedRatio * 0.1);
        this.graphics.fillTriangle(
          screen.x - bulletDirX * 12,
          screen.y - bulletDirY * 12,
          screen.x - bulletDirX * 4 + bulletOrthoX * 4.5,
          screen.y - bulletDirY * 4 + bulletOrthoY * 4.5,
          screen.x - bulletDirX * 4 - bulletOrthoX * 4.5,
          screen.y - bulletDirY * 4 - bulletOrthoY * 4.5,
        );
      }
      this.graphics.fillStyle(0xf8fbff, 0.98);
      this.graphics.fillCircle(screen.x, screen.y, (bullet.canEcho ? 3.4 : 2.8) + bulletHitRatio * 0.5);
      if (bullet.pierceRemaining > 0) {
        this.graphics.lineStyle(1 + bulletHitRatio * 0.4, this.mixColor(accentColor, 0xffffff, 0.35), 0.4 + bulletHitRatio * 0.1);
        this.graphics.strokeCircle(screen.x, screen.y, 6 + bulletHitRatio * 1.5);
      }
    }

    const eliteProjectileSuppressionRatio = this.getEliteBreachProjectileSuppressionRatio(battle);
    for (const projectile of battle.enemyProjectiles) {
      if (!this.isVisibleInCamera(camera, projectile.x, projectile.y, 24)) {
        continue;
      }

      const breachCorridorRatio =
        eliteProjectileSuppressionRatio > 0.08
          ? this.getEliteBreachProjectileCorridorRatio(battle, projectile)
          : 0;
      const projectileTrailColor =
        breachCorridorRatio > 0.08
          ? this.mixColor(
              ENEMY_PROJECTILE_TRAIL,
              0xffe0a3,
              0.16 + eliteProjectileSuppressionRatio * 0.18 + breachCorridorRatio * 0.18,
            )
          : ENEMY_PROJECTILE_TRAIL;
      const projectileFillColor =
        breachCorridorRatio > 0.08
          ? this.mixColor(
              ENEMY_PROJECTILE_FILL,
              0xfff1c6,
              0.18 + eliteProjectileSuppressionRatio * 0.2 + breachCorridorRatio * 0.18,
            )
          : ENEMY_PROJECTILE_FILL;
      const projectileStrokeColor =
        breachCorridorRatio > 0.08
          ? this.mixColor(
              ENEMY_PROJECTILE_STROKE,
              0xfaffff,
              0.12 + eliteProjectileSuppressionRatio * 0.16 + breachCorridorRatio * 0.12,
            )
          : ENEMY_PROJECTILE_STROKE;
      const screen = this.worldToScreen(camera, projectile.x, projectile.y);

      // Try to render preview image for enemy projectile core
      const projectileCoreSize = Math.max(10, projectile.radius * 2.2);
      const projectileRotation = Math.atan2(projectile.vy, projectile.vx);
      this.renderRuntimePreviewImage(
        PREVIEW_ENEMY_PROJECTILE_TEXTURE,
        screen.x,
        screen.y,
        projectileCoreSize,
        projectileRotation,
        0.7,
      );

      const tail = this.worldToScreen(
        camera,
        projectile.x - projectile.vx * (0.046 - breachCorridorRatio * 0.01),
        projectile.y - projectile.vy * (0.046 - breachCorridorRatio * 0.01),
      );
      const projectileSpeed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
      const projectileDirX = projectile.vx / projectileSpeed;
      const projectileDirY = projectile.vy / projectileSpeed;
      const projectileOrthoX = -projectileDirY;
      const projectileOrthoY = projectileDirX;
      const projectilePulse = 0.5 + Math.sin(battle.elapsedSec * 9 + projectile.id * 0.43) * 0.5;
      this.graphics.lineStyle(
        projectile.radius > 5 ? 1.9 : 1.35,
        projectileTrailColor,
        0.1 + projectilePulse * 0.05 + breachCorridorRatio * 0.05,
      );
      this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
      const headLength = projectile.radius + 3 + projectilePulse * 2.4;
      const wingWidth = projectile.radius + 1.5 + projectilePulse * 1.2;
      this.graphics.fillStyle(projectileFillColor, 0.07 + projectilePulse * 0.06 + breachCorridorRatio * 0.04);
      this.graphics.fillTriangle(
        screen.x + projectileDirX * headLength,
        screen.y + projectileDirY * headLength,
        screen.x - projectileDirX * (projectile.radius * 0.6) + projectileOrthoX * wingWidth,
        screen.y - projectileDirY * (projectile.radius * 0.6) + projectileOrthoY * wingWidth,
        screen.x - projectileDirX * (projectile.radius * 0.6) - projectileOrthoX * wingWidth,
        screen.y - projectileDirY * (projectile.radius * 0.6) - projectileOrthoY * wingWidth,
      );
      this.graphics.fillStyle(projectileFillColor, 0.1 + projectilePulse * 0.06 + breachCorridorRatio * 0.04);
      this.graphics.fillCircle(screen.x, screen.y, projectile.radius + 2.2 + projectilePulse * 1.2);
      this.graphics.fillStyle(projectileFillColor, 0.94);
      this.graphics.fillCircle(screen.x, screen.y, projectile.radius);
      this.graphics.lineStyle(1, projectileStrokeColor, 0.36 + projectilePulse * 0.06 + breachCorridorRatio * 0.06);
      this.graphics.strokeCircle(screen.x, screen.y, projectile.radius + 2);
      this.graphics.lineStyle(0.9, projectileStrokeColor, 0.1 + projectilePulse * 0.12 + breachCorridorRatio * 0.04);
      this.graphics.lineBetween(
        screen.x - projectileDirX * 2 + projectileOrthoX * (wingWidth * 0.72),
        screen.y - projectileDirY * 2 + projectileOrthoY * (wingWidth * 0.72),
        screen.x + projectileDirX * (headLength - 1),
        screen.y + projectileDirY * (headLength - 1),
      );
      this.graphics.lineBetween(
        screen.x - projectileDirX * 2 - projectileOrthoX * (wingWidth * 0.72),
        screen.y - projectileDirY * 2 - projectileOrthoY * (wingWidth * 0.72),
        screen.x + projectileDirX * (headLength - 1),
        screen.y + projectileDirY * (headLength - 1),
      );
    }

    this.renderEliteEscortField(battle, camera);
    const pickupLeadRatio =
      battle.pickupLeadEnemyId === null
        ? 0
        : Phaser.Math.Clamp(battle.pickupLeadSec / 0.36, 0, 1);
    const pickupLeadFlowRatio =
      battle.pickupFlowSec > 0
        ? Phaser.Math.Clamp(
            battle.pickupFlowSec /
              (battle.pickupFlowCount >= 4 ? 0.88 : battle.pickupFlowCount === 3 ? 0.8 : battle.pickupFlowCount === 2 ? 0.72 : 0.62),
            0,
            1,
          )
        : 0;

    for (const enemy of battle.enemies) {
      const flashRatio = Math.min(1, enemy.hitFlashSec / 0.18);
      const spawnRatio = Math.min(1, enemy.spawnFlashSec / (enemy.elite ? 0.46 : 0.28));
      const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
      const pressureRatio = this.getEnemyPressureRatio(enemy);
      const leadFocusRatio = battle.pickupLeadEnemyId === enemy.id ? pickupLeadRatio : 0;
      const onScreen = this.isVisibleInCamera(camera, enemy.x, enemy.y, enemy.radius + 30);
      const screen = this.worldToScreen(camera, enemy.x + enemy.hitOffsetX, enemy.y + enemy.hitOffsetY);
      const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
      const bodyBaseFill =
        enemy.elite && battle.encounterType === 'boss'
          ? BOSS_FILL
          : enemy.elite
            ? ELITE_FILL
            : this.getEnemyFillColor(enemy);
      const bodyBaseStroke =
        enemy.elite && battle.encounterType === 'boss'
          ? BOSS_STROKE
          : enemy.elite
            ? ELITE_STROKE
            : this.getEnemyStrokeColor(enemy);
      const enemyFill = this.mixColor(bodyBaseFill, 0xffffff, flashRatio * 0.55 + recoveryRatio * 0.1);
      const enemyStroke = this.mixColor(bodyBaseStroke, 0xffffff, flashRatio * 0.4 + recoveryRatio * 0.16);

      if (enemy.elite && !onScreen) {
        const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
        const clampedX = Phaser.Math.Clamp(screen.x, 48, camera.width - 48);
        const clampedY = Phaser.Math.Clamp(screen.y, 54, camera.height - 54);
        const angle = Math.atan2(screen.y - clampedY, screen.x - clampedX);

        this.graphics.fillStyle(0x1b1410, 0.88);
        this.graphics.fillCircle(clampedX, clampedY, 18);
        this.graphics.lineStyle(2, 0xffd774, 0.9);
        this.graphics.strokeCircle(clampedX, clampedY, 18);
        this.graphics.fillStyle(0xffd774, 0.96);
        this.graphics.fillTriangle(
          clampedX + Math.cos(angle) * 18,
          clampedY + Math.sin(angle) * 18,
          clampedX + Math.cos(angle + 2.45) * 10,
          clampedY + Math.sin(angle + 2.45) * 10,
          clampedX + Math.cos(angle - 2.45) * 10,
          clampedY + Math.sin(angle - 2.45) * 10,
        );
        this.graphics.fillStyle(0x241a12, 0.96);
        this.graphics.fillRoundedRect(clampedX - 24, clampedY + 22, 48, 5, 3);
        this.graphics.fillStyle(0xffd774, 1);
        this.graphics.fillRoundedRect(clampedX - 24, clampedY + 22, 48 * hpRatio, 5, 3);
        continue;
      }

      if (!onScreen) {
        continue;
      }

      if (!enemy.elite && leadFocusRatio > 0.08) {
        const leadColor = this.mixColor(0x9df7c5, enemyStroke, 0.28);
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        this.graphics.fillStyle(leadColor, 0.03 + leadFocusRatio * 0.07);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 6 + pickupLeadFlowRatio * 3);
        this.graphics.lineStyle(1.8, leadColor, 0.14 + leadFocusRatio * 0.24);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 12 + pickupLeadFlowRatio * 6);
        if (enemy.archetype === 'standard') {
          this.graphics.lineStyle(2, leadColor, 0.16 + leadFocusRatio * 0.2);
          this.graphics.lineBetween(
            screen.x + Math.cos(faceAngle - 0.2) * (enemy.radius + 3),
            screen.y + Math.sin(faceAngle - 0.2) * (enemy.radius + 3),
            screen.x + Math.cos(faceAngle) * (enemy.radius + 15 + leadFocusRatio * 8),
            screen.y + Math.sin(faceAngle) * (enemy.radius + 15 + leadFocusRatio * 8),
          );
          this.graphics.lineBetween(
            screen.x + Math.cos(faceAngle + 0.2) * (enemy.radius + 3),
            screen.y + Math.sin(faceAngle + 0.2) * (enemy.radius + 3),
            screen.x + Math.cos(faceAngle) * (enemy.radius + 15 + leadFocusRatio * 8),
            screen.y + Math.sin(faceAngle) * (enemy.radius + 15 + leadFocusRatio * 8),
          );
        } else if (enemy.archetype === 'brute') {
          this.graphics.fillStyle(leadColor, 0.04 + leadFocusRatio * 0.08);
          this.graphics.fillTriangle(
            screen.x + Math.cos(faceAngle) * (enemy.radius + 18 + leadFocusRatio * 10),
            screen.y + Math.sin(faceAngle) * (enemy.radius + 18 + leadFocusRatio * 10),
            screen.x + Math.cos(faceAngle + 0.4) * (enemy.radius + 4),
            screen.y + Math.sin(faceAngle + 0.4) * (enemy.radius + 4),
            screen.x + Math.cos(faceAngle - 0.4) * (enemy.radius + 4),
            screen.y + Math.sin(faceAngle - 0.4) * (enemy.radius + 4),
          );
        } else if (enemy.archetype === 'skirmisher') {
          this.graphics.lineStyle(2, leadColor, 0.16 + leadFocusRatio * 0.22);
          this.graphics.lineBetween(
            screen.x - enemy.radius - 10,
            screen.y - enemy.radius - 8,
            screen.x + enemy.radius + 6,
            screen.y - 2,
          );
          this.graphics.lineBetween(
            screen.x - enemy.radius - 10,
            screen.y + enemy.radius + 8,
            screen.x + enemy.radius + 6,
            screen.y + 2,
          );
        } else if (enemy.archetype === 'ranged') {
          const bracket = enemy.radius + 12 + leadFocusRatio * 6;
          this.graphics.lineStyle(1.8, leadColor, 0.14 + leadFocusRatio * 0.22);
          this.graphics.lineBetween(screen.x - bracket, screen.y - bracket, screen.x - bracket + 10, screen.y - bracket);
          this.graphics.lineBetween(screen.x - bracket, screen.y - bracket, screen.x - bracket, screen.y - bracket + 10);
          this.graphics.lineBetween(screen.x + bracket, screen.y - bracket, screen.x + bracket - 10, screen.y - bracket);
          this.graphics.lineBetween(screen.x + bracket, screen.y - bracket, screen.x + bracket, screen.y - bracket + 10);
          this.graphics.lineBetween(screen.x - bracket, screen.y + bracket, screen.x - bracket + 10, screen.y + bracket);
          this.graphics.lineBetween(screen.x - bracket, screen.y + bracket, screen.x - bracket, screen.y + bracket - 10);
          this.graphics.lineBetween(screen.x + bracket, screen.y + bracket, screen.x + bracket - 10, screen.y + bracket);
          this.graphics.lineBetween(screen.x + bracket, screen.y + bracket, screen.x + bracket, screen.y + bracket - 10);
        }
      }

      this.graphics.fillStyle(0x000000, enemy.elite ? 0.24 : 0.18);
      this.graphics.fillEllipse(screen.x, screen.y + enemy.radius + 7, enemy.radius * 1.8, enemy.radius * 0.72);
      if (recoveryRatio > 0) {
        const recoveryColor =
          enemy.archetype === 'ranged'
            ? this.mixColor(enemyStroke, 0xa8f6ff, 0.44)
            : enemy.archetype === 'brute'
              ? this.mixColor(enemyStroke, 0xffd7af, 0.34)
              : enemy.archetype === 'skirmisher'
                ? this.mixColor(enemyStroke, 0xb8ffef, 0.34)
                : this.mixColor(enemyStroke, 0xffefc4, 0.28);
        const recoveryRadius = enemy.radius + 10 + (1 - recoveryRatio) * 8;
        this.graphics.lineStyle(2.4, recoveryColor, 0.12 + recoveryRatio * 0.26);
        this.graphics.strokeCircle(screen.x, screen.y, recoveryRadius);
        this.graphics.fillStyle(recoveryColor, 0.03 + recoveryRatio * 0.08);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 4 + recoveryRatio * 2);
        this.graphics.lineStyle(2, recoveryColor, 0.14 + recoveryRatio * 0.24);
        this.graphics.lineBetween(screen.x - recoveryRadius, screen.y, screen.x - enemy.radius - 4, screen.y);
        this.graphics.lineBetween(screen.x + enemy.radius + 4, screen.y, screen.x + recoveryRadius, screen.y);
        const recoilLength = Math.hypot(enemy.hitOffsetX, enemy.hitOffsetY);
        if (recoilLength > 0.25) {
          const recoilDirX = enemy.hitOffsetX / recoilLength;
          const recoilDirY = enemy.hitOffsetY / recoilLength;
          const recoilOrthoX = -recoilDirY;
          const recoilOrthoY = recoilDirX;
          const tailReach = enemy.radius + 12 + recoveryRatio * 12;
          if (enemy.archetype === 'brute') {
            this.graphics.fillStyle(recoveryColor, 0.04 + recoveryRatio * 0.08);
            this.graphics.fillTriangle(
              screen.x - recoilDirX * (tailReach + 10),
              screen.y - recoilDirY * (tailReach + 10),
              screen.x - recoilDirX * 6 + recoilOrthoX * (8 + recoveryRatio * 6),
              screen.y - recoilDirY * 6 + recoilOrthoY * (8 + recoveryRatio * 6),
              screen.x - recoilDirX * 6 - recoilOrthoX * (8 + recoveryRatio * 6),
              screen.y - recoilDirY * 6 - recoilOrthoY * (8 + recoveryRatio * 6),
            );
            this.graphics.lineStyle(2.6, recoveryColor, 0.12 + recoveryRatio * 0.2);
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 3),
              screen.y - recoilDirY * (enemy.radius + 3),
              screen.x - recoilDirX * (tailReach + 4),
              screen.y - recoilDirY * (tailReach + 4),
            );
          } else if (enemy.archetype === 'skirmisher') {
            this.graphics.lineStyle(2, recoveryColor, 0.14 + recoveryRatio * 0.2);
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 2) + recoilOrthoX * 7,
              screen.y - recoilDirY * (enemy.radius + 2) + recoilOrthoY * 7,
              screen.x - recoilDirX * tailReach + recoilOrthoX * (12 + recoveryRatio * 6),
              screen.y - recoilDirY * tailReach + recoilOrthoY * (12 + recoveryRatio * 6),
            );
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 2) - recoilOrthoX * 7,
              screen.y - recoilDirY * (enemy.radius + 2) - recoilOrthoY * 7,
              screen.x - recoilDirX * tailReach - recoilOrthoX * (12 + recoveryRatio * 6),
              screen.y - recoilDirY * tailReach - recoilOrthoY * (12 + recoveryRatio * 6),
            );
          } else if (enemy.archetype === 'ranged') {
            this.graphics.lineStyle(1.8, recoveryColor, 0.12 + recoveryRatio * 0.2);
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 4) + recoilOrthoX * (enemy.radius * 0.7),
              screen.y - recoilDirY * (enemy.radius + 4) + recoilOrthoY * (enemy.radius * 0.7),
              screen.x - recoilDirX * tailReach + recoilOrthoX * (enemy.radius * 0.96),
              screen.y - recoilDirY * tailReach + recoilOrthoY * (enemy.radius * 0.96),
            );
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 4) - recoilOrthoX * (enemy.radius * 0.7),
              screen.y - recoilDirY * (enemy.radius + 4) - recoilOrthoY * (enemy.radius * 0.7),
              screen.x - recoilDirX * tailReach - recoilOrthoX * (enemy.radius * 0.96),
              screen.y - recoilDirY * tailReach - recoilOrthoY * (enemy.radius * 0.96),
            );
          } else {
            this.graphics.lineStyle(2, recoveryColor, 0.12 + recoveryRatio * 0.2);
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 2),
              screen.y - recoilDirY * (enemy.radius + 2),
              screen.x - recoilDirX * tailReach,
              screen.y - recoilDirY * tailReach,
            );
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 1) + recoilOrthoX * 5,
              screen.y - recoilDirY * (enemy.radius + 1) + recoilOrthoY * 5,
              screen.x - recoilDirX * (tailReach - 4) + recoilOrthoX * 9,
              screen.y - recoilDirY * (tailReach - 4) + recoilOrthoY * 9,
            );
            this.graphics.lineBetween(
              screen.x - recoilDirX * (enemy.radius + 1) - recoilOrthoX * 5,
              screen.y - recoilDirY * (enemy.radius + 1) - recoilOrthoY * 5,
              screen.x - recoilDirX * (tailReach - 4) - recoilOrthoX * 9,
              screen.y - recoilDirY * (tailReach - 4) - recoilOrthoY * 9,
            );
          }
        }
      }
      if (spawnRatio > 0) {
        this.graphics.lineStyle(2, enemyStroke, 0.36 * spawnRatio);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10 + (1 - spawnRatio) * 18);
      }
      if (flashRatio > 0) {
        this.graphics.fillStyle(0xffffff, 0.06 + flashRatio * 0.16);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 5 + flashRatio * 4);
        const hitDirLength = Math.max(1, Math.hypot(enemy.hitOffsetX, enemy.hitOffsetY));
        const hitDirX = enemy.hitOffsetX / hitDirLength;
        const hitDirY = enemy.hitOffsetY / hitDirLength;
        const hitOrthoX = -hitDirY;
        const hitOrthoY = hitDirX;
        const sparkColor = this.mixColor(enemyStroke, 0xffffff, 0.34);
        this.graphics.fillStyle(sparkColor, 0.06 + flashRatio * 0.12);
        this.graphics.fillTriangle(
          screen.x + hitDirX * (enemy.radius + 12 + flashRatio * 10),
          screen.y + hitDirY * (enemy.radius + 12 + flashRatio * 10),
          screen.x + hitOrthoX * (7 + flashRatio * 5),
          screen.y + hitOrthoY * (7 + flashRatio * 5),
          screen.x - hitOrthoX * (7 + flashRatio * 5),
          screen.y - hitOrthoY * (7 + flashRatio * 5),
        );
        this.graphics.lineStyle(2, sparkColor, 0.16 + flashRatio * 0.34);
        this.graphics.lineBetween(
          screen.x + hitDirX * (enemy.radius * 0.2),
          screen.y + hitDirY * (enemy.radius * 0.2),
          screen.x + hitDirX * (enemy.radius + 10 + flashRatio * 10),
          screen.y + hitDirY * (enemy.radius + 10 + flashRatio * 10),
        );
        this.graphics.lineBetween(
          screen.x + hitDirX * 5 + hitOrthoX * 6,
          screen.y + hitDirY * 5 + hitOrthoY * 6,
          screen.x + hitDirX * (enemy.radius + 2) + hitOrthoX * (10 + flashRatio * 6),
          screen.y + hitDirY * (enemy.radius + 2) + hitOrthoY * (10 + flashRatio * 6),
        );
        this.graphics.lineBetween(
          screen.x + hitDirX * 5 - hitOrthoX * 6,
          screen.y + hitDirY * 5 - hitOrthoY * 6,
          screen.x + hitDirX * (enemy.radius + 2) - hitOrthoX * (10 + flashRatio * 6),
          screen.y + hitDirY * (enemy.radius + 2) - hitOrthoY * (10 + flashRatio * 6),
        );
      }
      if (pressureRatio > 0) {
        const pressureColor =
          enemy.elite
            ? this.mixColor(BATTLE_TEMPLATES[battle.templateId].accent, 0xfff0bf, 0.3)
            : enemy.archetype === 'brute'
              ? this.mixColor(enemyStroke, 0xffe1b2, 0.28)
              : enemy.archetype === 'skirmisher'
                ? this.mixColor(enemyStroke, 0xcaffef, 0.28)
                : enemy.archetype === 'ranged'
                  ? this.mixColor(enemyStroke, 0xdff7ff, 0.32)
                  : this.mixColor(enemyStroke, 0xfff1c9, 0.24);
        this.graphics.lineStyle(
          enemy.elite ? 3 : 2,
          pressureColor,
          enemy.elite ? 0.16 + pressureRatio * 0.3 : 0.08 + pressureRatio * 0.2,
        );
        this.graphics.strokeCircle(
          screen.x,
          screen.y,
          enemy.radius + (enemy.elite ? 14 : 9) + (1 - pressureRatio) * (enemy.elite ? 10 : 6),
        );
        if (enemy.elite) {
          const nearbyEscorts = battle.enemies
            .filter((candidate) => !candidate.elite)
            .sort(
              (left, right) =>
                Math.hypot(left.x - enemy.x, left.y - enemy.y) - Math.hypot(right.x - enemy.x, right.y - enemy.y),
            )
            .slice(0, 2);
          if (nearbyEscorts.length > 0) {
            this.graphics.lineStyle(2, pressureColor, 0.08 + pressureRatio * 0.18);
            for (const escort of nearbyEscorts) {
              const escortScreen = this.worldToScreen(camera, escort.x, escort.y);
              this.graphics.lineBetween(screen.x, screen.y, escortScreen.x, escortScreen.y);
            }
          } else {
            const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
            this.graphics.lineStyle(2, pressureColor, 0.12 + pressureRatio * 0.18);
            this.graphics.lineBetween(
              screen.x + Math.cos(faceAngle - 0.22) * (enemy.radius + 2),
              screen.y + Math.sin(faceAngle - 0.22) * (enemy.radius + 2),
              screen.x + Math.cos(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
              screen.y + Math.sin(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
            );
            this.graphics.lineBetween(
              screen.x + Math.cos(faceAngle + 0.22) * (enemy.radius + 2),
              screen.y + Math.sin(faceAngle + 0.22) * (enemy.radius + 2),
              screen.x + Math.cos(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
              screen.y + Math.sin(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
            );
          }
        }
      }
      this.graphics.fillStyle(enemyFill, enemy.elite ? 0.98 : 0.95);

      if (enemy.elite) {
        // Determine which elite texture to use based on state
        let eliteTexture = PREVIEW_ELITE_CORE_TEXTURE;
        let eliteSize = enemy.radius * 3.2;

        if (battle.encounterType === 'boss') {
          eliteTexture = PREVIEW_BOSS_BASTION_TEXTURE;
          eliteSize = enemy.radius * 3.6;
        } else if (battle.eliteCrackWindowSec > 0.08) {
          eliteTexture = PREVIEW_ELITE_CRACK_TEXTURE;
        }

        // Try to render preview image, fallback to procedural if not available
        const previewRendered = this.renderRuntimePreviewImage(
          eliteTexture,
          screen.x,
          screen.y,
          eliteSize,
          faceAngle + Math.PI / 2,
          0.82,
        );

        if (!previewRendered) {
          // Procedural fallback
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius);
          this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.12), 0.22);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius * 0.56);
        }

        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 5);

        if (battle.encounterType === 'boss') {
          const bossBracketReach = enemy.radius + 14;
          this.graphics.lineStyle(2.2, enemyStroke, 0.34);
          this.graphics.lineBetween(screen.x - bossBracketReach, screen.y, screen.x - enemy.radius - 4, screen.y);
          this.graphics.lineBetween(screen.x + enemy.radius + 4, screen.y, screen.x + bossBracketReach, screen.y);
          this.graphics.lineBetween(screen.x, screen.y - bossBracketReach, screen.x, screen.y - enemy.radius - 4);
          this.graphics.lineBetween(screen.x, screen.y + enemy.radius + 4, screen.x, screen.y + bossBracketReach);
        }
        if (battle.pressureTransitionSec > 0) {
          const pulseAlpha = Math.min(0.44, 0.14 + battle.pressureTransitionSec * 0.2);
          const pulseRadius = enemy.radius + 12 + (1.15 - battle.pressureTransitionSec) * 7;
          this.graphics.lineStyle(4, BATTLE_TEMPLATES[battle.templateId].accent, pulseAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, pulseRadius);
        }
        if (battle.pressureSignatureSec > 0) {
          const signatureAlpha = Math.min(0.28, 0.12 + battle.pressureSignatureSec * 0.04);
          const signatureRadius = enemy.radius + 15 + Math.sin(battle.elapsedSec * 7.5) * 2;
          this.graphics.lineStyle(3, BATTLE_TEMPLATES[battle.templateId].accent, signatureAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, signatureRadius);
        }
        if (battle.pressurePatternFlashSec > 0) {
          const patternAlpha = Math.min(0.26, 0.08 + battle.pressurePatternFlashSec * 0.28);
          this.graphics.lineStyle(2, BATTLE_TEMPLATES[battle.templateId].accent, patternAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 20 + battle.pressurePatternFlashSec * 12);
        }
        if (enemy.guardSec > 0) {
          const guardAlpha = Math.min(0.45, 0.16 + enemy.guardSec * 0.04);
          this.graphics.lineStyle(3, 0xfff2b0, guardAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        }
      } else if (enemy.archetype === 'ranged') {
        this.graphics.fillRoundedRect(screen.x - enemy.radius, screen.y - enemy.radius, enemy.radius * 2, enemy.radius * 2, 8);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeRoundedRect(
          screen.x - enemy.radius - 2,
          screen.y - enemy.radius - 2,
          enemy.radius * 2 + 4,
          enemy.radius * 2 + 4,
          10,
        );
      } else if (enemy.archetype === 'brute') {
        this.graphics.fillEllipse(screen.x, screen.y, enemy.radius * 2.16, enemy.radius * 1.84);
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.08), 0.16);
        this.graphics.fillEllipse(screen.x, screen.y, enemy.radius * 1.2, enemy.radius * 1.02);
        this.graphics.lineStyle(2.4, enemyStroke, 0.32);
        this.graphics.strokeEllipse(screen.x, screen.y, enemy.radius * 2.32, enemy.radius * 2);
      } else if (enemy.archetype === 'skirmisher') {
        const tipReach = enemy.radius + 8;
        const wingReach = enemy.radius + 4;
        this.graphics.fillTriangle(
          screen.x + Math.cos(faceAngle) * tipReach,
          screen.y + Math.sin(faceAngle) * tipReach,
          screen.x + Math.cos(faceAngle + 2.32) * wingReach,
          screen.y + Math.sin(faceAngle + 2.32) * wingReach,
          screen.x + Math.cos(faceAngle - 2.32) * wingReach,
          screen.y + Math.sin(faceAngle - 2.32) * wingReach,
        );
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.12), 0.16);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(3.2, enemy.radius * 0.32));
        this.graphics.lineStyle(2, enemyStroke, 0.34);
        this.graphics.strokeTriangle(
          screen.x + Math.cos(faceAngle) * (tipReach + 2),
          screen.y + Math.sin(faceAngle) * (tipReach + 2),
          screen.x + Math.cos(faceAngle + 2.34) * (wingReach + 2),
          screen.y + Math.sin(faceAngle + 2.34) * (wingReach + 2),
          screen.x + Math.cos(faceAngle - 2.34) * (wingReach + 2),
          screen.y + Math.sin(faceAngle - 2.34) * (wingReach + 2),
        );
      } else {
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius);
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.08), 0.14);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(3.6, enemy.radius * 0.36));
        this.graphics.lineStyle(2, enemyStroke, 0.26);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 4);
        if (enemy.archetype === 'standard' && enemy.role === 'regular') {
          this.renderRuntimePreviewImage(
            PREVIEW_STANDARD_ENEMY_TEXTURE,
            screen.x,
            screen.y,
            enemy.radius * 3.1,
            faceAngle + Math.PI / 2,
            0.78,
          );
        }
      }

      if (!enemy.elite && enemy.role === 'escort') {
        // Try to render escort preview image
        const escortRendered = this.renderRuntimePreviewImage(
          PREVIEW_ELITE_ESCORT_TEXTURE,
          screen.x,
          screen.y,
          enemy.radius * 3.4,
          faceAngle + Math.PI / 2,
          0.76,
        );

        if (!escortRendered) {
          // Procedural fallback
          const escortFill = this.mixColor(ENEMY_ESCORT_FILL, enemyFill, 0.24);
          const escortStroke = this.mixColor(ENEMY_ESCORT_STROKE, enemyStroke, 0.26);
          this.graphics.lineStyle(1.6, escortStroke, 0.22 + recoveryRatio * 0.18 + pressureRatio * 0.08);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10 + recoveryRatio * 4);
          this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y, screen.x - enemy.radius - 4, screen.y);
          this.graphics.lineBetween(screen.x + enemy.radius + 4, screen.y, screen.x + enemy.radius + 12, screen.y);
          this.graphics.fillStyle(escortFill, 0.08 + pressureRatio * 0.1);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 3);
        }
      }

      if (!enemy.elite && enemy.archetype === 'skirmisher') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(screen.x - enemy.radius - 3, screen.y, screen.x + enemy.radius + 3, screen.y);
        this.graphics.lineBetween(
          screen.x - enemy.radius + 1,
          screen.y - enemy.radius + 2,
          screen.x + enemy.radius - 1,
          screen.y + enemy.radius - 2,
        );
        const orbitAngle = battle.elapsedSec * 4.4 + enemy.id * 0.7;
        const orbitRadius = enemy.radius + 9;
        this.graphics.fillStyle(enemyStroke, 0.18);
        this.graphics.fillCircle(
          screen.x + Math.cos(orbitAngle) * orbitRadius,
          screen.y + Math.sin(orbitAngle) * orbitRadius,
          2.4,
        );
        this.graphics.fillCircle(
          screen.x + Math.cos(orbitAngle + Math.PI) * orbitRadius,
          screen.y + Math.sin(orbitAngle + Math.PI) * orbitRadius,
          2,
        );
        if (spawnRatio > 0.12) {
          const sweepAlpha = 0.08 + spawnRatio * 0.14;
          this.graphics.lineStyle(2, enemyStroke, sweepAlpha);
          this.graphics.lineBetween(
            screen.x - enemy.radius - 10,
            screen.y - enemy.radius - 6,
            screen.x + enemy.radius + 2,
            screen.y - 2,
          );
          this.graphics.lineBetween(
            screen.x - enemy.radius - 10,
            screen.y + enemy.radius + 6,
            screen.x + enemy.radius + 2,
            screen.y + 2,
          );
        }
        if (pressureRatio > 0) {
          this.graphics.lineStyle(2, enemyStroke, 0.12 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 13 + pressureRatio * 4);
        }
      }

      if (!enemy.elite && enemy.archetype === 'brute') {
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        this.graphics.lineStyle(3, enemyStroke, 0.24);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 7);
        this.graphics.fillStyle(enemyStroke, 0.12);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(4, enemy.radius - 4));
        this.graphics.lineStyle(2, enemyStroke, 0.24);
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle) * (enemy.radius - 2),
          screen.y + Math.sin(faceAngle) * (enemy.radius - 2),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle + 0.34) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle + 0.34) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle - 0.34) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle - 0.34) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10),
        );
        if (spawnRatio > 0.12) {
          const pushLength = enemy.radius + 16 + spawnRatio * 10;
          this.graphics.fillStyle(enemyStroke, 0.04 + spawnRatio * 0.08);
          this.graphics.fillTriangle(
            screen.x + Math.cos(faceAngle) * pushLength,
            screen.y + Math.sin(faceAngle) * pushLength,
            screen.x + Math.cos(faceAngle + 0.42) * (enemy.radius + 2),
            screen.y + Math.sin(faceAngle + 0.42) * (enemy.radius + 2),
            screen.x + Math.cos(faceAngle - 0.42) * (enemy.radius + 2),
            screen.y + Math.sin(faceAngle - 0.42) * (enemy.radius + 2),
          );
        }
        if (pressureRatio > 0) {
          this.graphics.lineStyle(3, enemyStroke, 0.1 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 11 + pressureRatio * 4);
        }
      }

      if (!enemy.elite && enemy.archetype === 'ranged') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(screen.x, screen.y - enemy.radius - 4, screen.x, screen.y + enemy.radius + 4);
        if (spawnRatio > 0.12) {
          const braceAlpha = 0.08 + spawnRatio * 0.14;
          this.graphics.lineStyle(1.5, enemyStroke, braceAlpha);
          this.graphics.lineBetween(
            screen.x - enemy.radius - 10,
            screen.y - enemy.radius - 6,
            screen.x - enemy.radius - 2,
            screen.y - 1,
          );
          this.graphics.lineBetween(
            screen.x + enemy.radius + 10,
            screen.y - enemy.radius - 6,
            screen.x + enemy.radius + 2,
            screen.y - 1,
          );
          this.graphics.lineStyle(1.2, enemyStroke, braceAlpha - 0.02);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 12 + spawnRatio * 3);
        }
        const lockRatio = Phaser.Math.Clamp(1 - enemy.rangedCooldownSec / 0.85, 0, 1);
        this.graphics.lineStyle(1, enemyStroke, enemy.rangedCooldownSec <= 0.65 ? 0.24 + lockRatio * 0.14 : 0.12);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        if (enemy.rangedCooldownSec <= 0.65) {
          const predictedTarget = this.getProjectedEnemyAimScreenPoint(enemy, battle, camera);
          this.graphics.lineStyle(1 + lockRatio, this.mixColor(enemyStroke, 0xffffff, 0.22), 0.2 + lockRatio * 0.18);
          this.graphics.lineBetween(screen.x, screen.y, predictedTarget.x, predictedTarget.y);
          this.graphics.lineStyle(1, this.mixColor(enemyStroke, 0xffffff, 0.3), 0.14 + lockRatio * 0.2);
          this.graphics.strokeCircle(predictedTarget.x, predictedTarget.y, 10 + lockRatio * 8);
          this.graphics.lineBetween(predictedTarget.x - 14, predictedTarget.y, predictedTarget.x - 5, predictedTarget.y);
          this.graphics.lineBetween(predictedTarget.x + 5, predictedTarget.y, predictedTarget.x + 14, predictedTarget.y);
          this.graphics.lineBetween(predictedTarget.x, predictedTarget.y - 14, predictedTarget.x, predictedTarget.y - 5);
          this.graphics.lineBetween(predictedTarget.x, predictedTarget.y + 5, predictedTarget.x, predictedTarget.y + 14);
          this.graphics.lineStyle(1, enemyStroke, 0.14 + lockRatio * 0.16);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 14 + lockRatio * 5);
        }
        if (recoveryRatio > 0) {
          const recoverColor = this.mixColor(enemyStroke, 0xb4ffff, 0.28);
          this.graphics.lineStyle(2, recoverColor, 0.16 + recoveryRatio * 0.22);
          this.graphics.lineBetween(screen.x - enemy.radius - 10, screen.y - enemy.radius - 8, screen.x - enemy.radius - 3, screen.y - 2);
          this.graphics.lineBetween(screen.x + enemy.radius + 10, screen.y - enemy.radius - 8, screen.x + enemy.radius + 3, screen.y - 2);
        }
        if (pressureRatio > 0) {
          this.graphics.lineStyle(1.5, enemyStroke, 0.12 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 16 + pressureRatio * 5);
        }
      }

      if (!enemy.elite && enemy.archetype === 'standard' && pressureRatio > 0) {
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        this.graphics.lineStyle(2, enemyStroke, 0.1 + pressureRatio * 0.18);
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle - 0.24) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle - 0.24) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle + 0.24) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle + 0.24) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
        );
      } else if (!enemy.elite && enemy.archetype === 'standard' && spawnRatio > 0.12) {
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        const intentAlpha = 0.08 + spawnRatio * 0.12;
        this.graphics.lineStyle(1.6, enemyStroke, intentAlpha);
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle - 0.28) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle - 0.28) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10 + spawnRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10 + spawnRatio * 6),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle + 0.28) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle + 0.28) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10 + spawnRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10 + spawnRatio * 6),
        );
      }

      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.elite && battle.encounterType === 'boss') {
        const barWidth = 92;
        const barX = screen.x - barWidth * 0.5;
        const barY = screen.y - enemy.radius - 24;
        this.graphics.fillStyle(0x231b14, 0.92);
        this.graphics.fillRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 1);
        this.graphics.fillRoundedRect(barX, barY, barWidth * hpRatio, 6, 3);
        this.graphics.lineStyle(2, 0xffd774, 0.5);
        this.graphics.strokeRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 0.96);
        this.graphics.fillTriangle(screen.x, barY - 10, screen.x - 7, barY - 1, screen.x + 7, barY - 1);
      } else {
        this.graphics.fillStyle(0x1b1612, 0.84);
        this.graphics.fillRect(screen.x - 16, screen.y - enemy.radius - 10, 32, 4);
        this.graphics.fillStyle(enemy.elite ? 0xffdd7d : enemyStroke, 1);
        this.graphics.fillRect(screen.x - 16, screen.y - enemy.radius - 10, 32 * hpRatio, 4);
      }

      if (liveFocusRoute === 'crit' && !enemy.elite && hpRatio <= 0.4) {
        const executeColor = this.mixColor(0xffd66f, accentColor, 0.28);
        const bracketAlpha = 0.18 + (1 - hpRatio) * 0.34;
        this.graphics.lineStyle(2, executeColor, bracketAlpha);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y - enemy.radius - 8, screen.x - enemy.radius - 4, screen.y - enemy.radius - 8);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y - enemy.radius - 8, screen.x - enemy.radius - 12, screen.y - enemy.radius);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y - enemy.radius - 8, screen.x + enemy.radius + 4, screen.y - enemy.radius - 8);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y - enemy.radius - 8, screen.x + enemy.radius + 12, screen.y - enemy.radius);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y + enemy.radius + 8, screen.x - enemy.radius - 4, screen.y + enemy.radius + 8);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y + enemy.radius + 8, screen.x - enemy.radius - 12, screen.y + enemy.radius);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y + enemy.radius + 8, screen.x + enemy.radius + 4, screen.y + enemy.radius + 8);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y + enemy.radius + 8, screen.x + enemy.radius + 12, screen.y + enemy.radius);
      }

      if (liveFocusRoute === 'dash') {
        const dx = enemy.x - battle.playerX;
        const dy = enemy.y - battle.playerY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const dashMoveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
        const alignment =
          dashMoveMagnitude > 0.05 ? ((dx / distance) * battle.playerMoveDirX) + ((dy / distance) * battle.playerMoveDirY) : 0;
        if (alignment > 0.7 && distance <= 180) {
          const pursuitColor = this.mixColor(0x8effdc, accentColor, 0.26);
          const pursuitAlpha = 0.08 + alignment * 0.12 + (battle.dashDriveSec > 0 ? 0.05 : 0);
          this.graphics.lineStyle(1.5, pursuitColor, pursuitAlpha * 0.9);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 12);
        }
      }
    }

    const impactRatio = Math.min(1, battle.playerImpactSec / 0.34);
    const recoveryRatio = Math.min(1, battle.playerRecoverySec / 0.26);
    const critAuraRatio = battle.critOverdriveSec > 0 ? Math.min(1, battle.critOverdriveSec / 4.2) : 0;
    const dashDriveRatio = battle.dashDriveSec > 0 ? Math.min(1, battle.dashDriveSec / 1.15) : 0;
    const playerPierceFlowRatio =
      battle.pierceFlowSec > 0
        ? Math.min(1, battle.pierceFlowSec / (0.46 + Math.min(0.28, battle.pierceFlowCount * 0.06)))
        : 0;
    const freezeRatio = battle.impactFreezeSec > 0 ? Math.min(1, battle.impactFreezeSec / 0.09) : 0;
    const shotFlashRatio = battle.playerShotFlashSec > 0 ? Math.min(1, battle.playerShotFlashSec / 0.08) : 0;
    const shotRecoilRatio = battle.playerShotRecoilSec > 0 ? Math.min(1, battle.playerShotRecoilSec / 0.11) : 0;
    const moveBoostRatio = battle.playerMoveBoostSec > 0 ? Math.min(1, battle.playerMoveBoostSec / 0.18) : 0;
    const turnBurstRatio = battle.playerTurnBurstSec > 0 ? Math.min(1, battle.playerTurnBurstSec / 0.14) : 0;
    const nearMissRatio = battle.playerNearMissSec > 0 ? Math.min(1, battle.playerNearMissSec / 0.14) : 0;
    const killFlowRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const damageFlashRatio = battle.playerDamageFlashSec > 0 ? Math.min(1, battle.playerDamageFlashSec / 0.34) : 0;
    const hpRatio = state.stats.hp / Math.max(1, state.stats.maxHp);
    const lowHpRatio = Phaser.Math.Clamp((0.46 - hpRatio) / 0.46, 0, 1);
    const criticalHpRatio = Phaser.Math.Clamp((0.24 - hpRatio) / 0.24, 0, 1);
    const dangerPulse = 0.5 + Math.sin(battle.elapsedSec * 6.3 + battle.kills * 0.12) * 0.5;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const moveDirX = moveMagnitude > 0.01 ? battle.playerMoveDirX / moveMagnitude : 0;
    const moveDirY = moveMagnitude > 0.01 ? battle.playerMoveDirY / moveMagnitude : 0;
    const velocityMagnitude = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    const velocityRatio = Phaser.Math.Clamp(velocityMagnitude / Math.max(1, getPlayerMoveSpeed(state.stats) * 1.16), 0, 1);
    const aimMagnitude = Math.hypot(battle.playerAimDirX, battle.playerAimDirY);
    const aimDirX = aimMagnitude > 0.01 ? battle.playerAimDirX / aimMagnitude : 0;
    const aimDirY = aimMagnitude > 0.01 ? battle.playerAimDirY / aimMagnitude : -1;
    const aimOrthoX = -aimDirY;
    const aimOrthoY = aimDirX;
    const damageDirX = Math.cos(battle.playerDamageAngle);
    const damageDirY = Math.sin(battle.playerDamageAngle);
    const nearMissDirX = Math.cos(battle.playerNearMissAngle);
    const nearMissDirY = Math.sin(battle.playerNearMissAngle);
    const knockbackSpeed = Math.hypot(battle.playerKnockbackVX, battle.playerKnockbackVY);
    const knockbackRatio = Math.min(1, knockbackSpeed / 240);
    const hurtDirX = knockbackSpeed > 0.01 ? battle.playerKnockbackVX / knockbackSpeed : -aimDirX;
    const hurtDirY = knockbackSpeed > 0.01 ? battle.playerKnockbackVY / knockbackSpeed : -aimDirY;
    const hurtOrthoX = -hurtDirY;
    const hurtOrthoY = hurtDirX;
    const pickupGuideEnemy =
      battle.pickupLeadEnemyId === null
        ? null
        : battle.enemies.find((enemy) => enemy.id === battle.pickupLeadEnemyId && enemy.hp > 0) ?? null;
    const pickupGuideDirX = pickupGuideEnemy ? (pickupGuideEnemy.x - battle.playerX) / Math.max(1, Math.hypot(pickupGuideEnemy.x - battle.playerX, pickupGuideEnemy.y - battle.playerY)) : moveMagnitude > 0.08 ? moveDirX : aimDirX;
    const pickupGuideDirY = pickupGuideEnemy ? (pickupGuideEnemy.y - battle.playerY) / Math.max(1, Math.hypot(pickupGuideEnemy.x - battle.playerX, pickupGuideEnemy.y - battle.playerY)) : moveMagnitude > 0.08 ? moveDirY : aimDirY;
    const pickupGuideOrthoX = -pickupGuideDirY;
    const pickupGuideOrthoY = pickupGuideDirX;
    const recoilOffset = shotRecoilRatio * battle.playerShotRecoilStrength;
    const bodyX = playerScreen.x - aimDirX * recoilOffset;
    const bodyY = playerScreen.y - aimDirY * recoilOffset;
    const muzzleX = bodyX + aimDirX * (16 + shotFlashRatio * 10);
    const muzzleY = bodyY + aimDirY * (16 + shotFlashRatio * 10);
    const combatReadRatio = Math.max(
      tempoRatio,
      shotFlashRatio,
      critAuraRatio,
      dashDriveRatio,
      nearMissRatio,
      killFlowRatio,
      damageFlashRatio * 0.9,
      pierceReadRatio,
      moveBoostRatio,
      turnBurstRatio,
      velocityRatio * 0.8,
    );
    const liveFocusColor =
      liveFocusRoute === 'crit'
        ? this.mixColor(accentColor, 0xffd882, 0.34)
        : liveFocusRoute === 'pierce'
          ? this.mixColor(accentColor, 0xdff6ff, 0.3)
          : liveFocusRoute === 'dash'
            ? this.mixColor(accentColor, 0xbfffea, 0.3)
            : accentColor;
    const incomingThreatMarkers =
      impactRatio <= 0.12 && damageFlashRatio <= 0.18 && nearMissRatio <= 0.1
        ? this.getIncomingThreatMarkers(battle)
        : [];

    this.graphics.fillStyle(0x000000, 0.22);
    this.graphics.fillEllipse(bodyX, bodyY + 18, 34, 14);
    this.graphics.fillStyle(liveFocusColor, 0.05 + combatReadRatio * 0.08);
    this.graphics.fillEllipse(bodyX, bodyY, 38 + combatReadRatio * 10, 38 + combatReadRatio * 10);
    if (playerPierceFlowRatio > 0.08) {
      const railColor = this.mixColor(0x8fdcff, 0xffffff, 0.22);
      const railDirX = Math.abs(battle.playerAimDirX) > 0.01 || Math.abs(battle.playerAimDirY) > 0.01 ? battle.playerAimDirX : 1;
      const railDirY = Math.abs(battle.playerAimDirX) > 0.01 || Math.abs(battle.playerAimDirY) > 0.01 ? battle.playerAimDirY : 0;
      const railOrthoX = -railDirY;
      const railOrthoY = railDirX;
      const railLength = 34 + playerPierceFlowRatio * 26;
      const railOffset = 13 + playerPierceFlowRatio * 5;
      this.graphics.lineStyle(1.8 + playerPierceFlowRatio * 0.8, railColor, 0.12 + playerPierceFlowRatio * 0.24);
      this.graphics.lineBetween(
        bodyX - railDirX * (railLength * 0.55) + railOrthoX * railOffset,
        bodyY - railDirY * (railLength * 0.55) + railOrthoY * railOffset,
        bodyX + railDirX * railLength + railOrthoX * railOffset,
        bodyY + railDirY * railLength + railOrthoY * railOffset,
      );
      this.graphics.lineBetween(
        bodyX - railDirX * (railLength * 0.55) - railOrthoX * railOffset,
        bodyY - railDirY * (railLength * 0.55) - railOrthoY * railOffset,
        bodyX + railDirX * railLength - railOrthoX * railOffset,
        bodyY + railDirY * railLength - railOrthoY * railOffset,
      );
      this.graphics.lineStyle(1.2, railColor, 0.08 + playerPierceFlowRatio * 0.16);
      this.graphics.strokeCircle(bodyX, bodyY, 24 + playerPierceFlowRatio * 10);
    }
    if (impactRatio > 0) {
      this.graphics.fillStyle(0xff6964, 0.12 + impactRatio * 0.16);
      this.graphics.fillCircle(playerScreen.x, playerScreen.y, 66 + impactRatio * 10);
      this.graphics.fillStyle(0xff8d84, 0.08 + impactRatio * 0.12 + knockbackRatio * 0.06);
      this.graphics.fillTriangle(
        playerScreen.x - hurtDirX * (32 + knockbackRatio * 26),
        playerScreen.y - hurtDirY * (32 + knockbackRatio * 26),
        playerScreen.x - hurtDirX * 8 + hurtOrthoX * (10 + knockbackRatio * 10),
        playerScreen.y - hurtDirY * 8 + hurtOrthoY * (10 + knockbackRatio * 10),
        playerScreen.x - hurtDirX * 8 - hurtOrthoX * (10 + knockbackRatio * 10),
        playerScreen.y - hurtDirY * 8 - hurtOrthoY * (10 + knockbackRatio * 10),
      );
      this.graphics.lineStyle(2, 0xffdad3, 0.16 + impactRatio * 0.2);
      this.graphics.lineBetween(
        playerScreen.x + hurtOrthoX * 14,
        playerScreen.y + hurtOrthoY * 14,
        playerScreen.x + hurtDirX * (18 + freezeRatio * 10),
        playerScreen.y + hurtDirY * (18 + freezeRatio * 10),
      );
      this.graphics.lineBetween(
        playerScreen.x - hurtOrthoX * 14,
        playerScreen.y - hurtOrthoY * 14,
        playerScreen.x + hurtDirX * (18 + freezeRatio * 10),
        playerScreen.y + hurtDirY * (18 + freezeRatio * 10),
      );
    }
    if (damageFlashRatio > 0) {
      const damageColor = this.mixColor(0xff6a63, 0xfff0cb, 0.22);
      const damageRadius = 42 + damageFlashRatio * 10;
      const damageOrthoX = -damageDirY;
      const damageOrthoY = damageDirX;
      this.graphics.fillStyle(damageColor, 0.04 + damageFlashRatio * 0.08);
      this.graphics.fillTriangle(
        playerScreen.x + damageDirX * (damageRadius + 34 + damageFlashRatio * 24),
        playerScreen.y + damageDirY * (damageRadius + 34 + damageFlashRatio * 24),
        playerScreen.x + damageDirX * 12 + damageOrthoX * (18 + damageFlashRatio * 12),
        playerScreen.y + damageDirY * 12 + damageOrthoY * (18 + damageFlashRatio * 12),
        playerScreen.x + damageDirX * 12 - damageOrthoX * (18 + damageFlashRatio * 12),
        playerScreen.y + damageDirY * 12 - damageOrthoY * (18 + damageFlashRatio * 12),
      );
      this.graphics.lineStyle(2.2, damageColor, 0.12 + damageFlashRatio * 0.24);
      this.graphics.lineBetween(
        playerScreen.x + damageDirX * 20,
        playerScreen.y + damageDirY * 20,
        playerScreen.x + damageDirX * (damageRadius - 6),
        playerScreen.y + damageDirY * (damageRadius - 6),
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle,
        damageRadius,
        18 + damageFlashRatio * 16,
        9 + damageFlashRatio * 5,
        damageColor,
        0.16 + damageFlashRatio * 0.34,
        0.05 + damageFlashRatio * 0.12,
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle + 0.17,
        damageRadius + 8,
        10 + damageFlashRatio * 8,
        5 + damageFlashRatio * 3,
        damageColor,
        0.08 + damageFlashRatio * 0.16,
        0,
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle - 0.17,
        damageRadius + 8,
        10 + damageFlashRatio * 8,
        5 + damageFlashRatio * 3,
        damageColor,
        0.08 + damageFlashRatio * 0.16,
        0,
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle,
        damageRadius + 18,
        26 + damageFlashRatio * 20,
        12 + damageFlashRatio * 7,
        this.mixColor(damageColor, 0xffffff, 0.16),
        0.1 + damageFlashRatio * 0.16,
        0,
      );
    }
    if (tempoRatio > 0) {
      const surgeDirX = moveMagnitude > 0.08 ? moveDirX : aimDirX;
      const surgeDirY = moveMagnitude > 0.08 ? moveDirY : aimDirY;
      const surgeOrthoX = -surgeDirY;
      const surgeOrthoY = surgeDirX;
      const surgeColor = this.mixColor(liveFocusColor, 0xffffff, 0.18);
      for (let streak = 0; streak < 3; streak += 1) {
        const offset = 18 + streak * 12 + tempoRatio * 10;
        const width = 8 + streak * 2;
        this.graphics.fillStyle(surgeColor, 0.06 + tempoRatio * (0.06 - streak * 0.01));
        this.graphics.fillTriangle(
          bodyX - surgeDirX * (offset + 12) + surgeOrthoX * width,
          bodyY - surgeDirY * (offset + 12) + surgeOrthoY * width,
          bodyX - surgeDirX * offset,
          bodyY - surgeDirY * offset,
          bodyX - surgeDirX * (offset + 12) - surgeOrthoX * width,
          bodyY - surgeDirY * (offset + 12) - surgeOrthoY * width,
        );
      }
    }
    if (killFlowRatio > 0) {
      const flowDirX = moveMagnitude > 0.08 ? moveDirX : aimDirX;
      const flowDirY = moveMagnitude > 0.08 ? moveDirY : aimDirY;
      const flowOrthoX = -flowDirY;
      const flowOrthoY = flowDirX;
      const flowColor = this.mixColor(liveFocusColor, 0xfff2c3, 0.26 + killFlowRatio * 0.16);
      const chainCount = Math.max(1, battle.killFlowCount);
      for (let streak = 0; streak < Math.min(4, chainCount + 1); streak += 1) {
        const offset = 14 + streak * 10 + killFlowRatio * 8;
        const width = 8 + streak * 2 + killFlowRatio * 4;
        this.graphics.fillStyle(flowColor, 0.05 + killFlowRatio * 0.05 - streak * 0.008);
        this.graphics.fillTriangle(
          bodyX - flowDirX * (offset + 14) + flowOrthoX * width,
          bodyY - flowDirY * (offset + 14) + flowOrthoY * width,
          bodyX - flowDirX * offset,
          bodyY - flowDirY * offset,
          bodyX - flowDirX * (offset + 14) - flowOrthoX * width,
          bodyY - flowDirY * (offset + 14) - flowOrthoY * width,
        );
      }
    }
    if (pickupFlowRatio > 0) {
      for (let streak = 0; streak < Math.min(4, Math.max(1, battle.pickupFlowCount)); streak += 1) {
        const offset = 10 + streak * 9 + pickupFlowRatio * 7;
        const width = 6 + streak * 2 + pickupFlowRatio * 3;
        this.graphics.fillStyle(pickupGuideColor, 0.04 + pickupFlowRatio * 0.05 - streak * 0.006);
        this.graphics.fillTriangle(
          bodyX + pickupGuideDirX * (offset + 16) + pickupGuideOrthoX * width,
          bodyY + pickupGuideDirY * (offset + 16) + pickupGuideOrthoY * width,
          bodyX + pickupGuideDirX * offset,
          bodyY + pickupGuideDirY * offset,
          bodyX + pickupGuideDirX * (offset + 16) - pickupGuideOrthoX * width,
          bodyY + pickupGuideDirY * (offset + 16) - pickupGuideOrthoY * width,
        );
      }

      const pipCount = Math.min(4, Math.max(1, battle.pickupFlowCount));
      for (let index = 0; index < pipCount; index += 1) {
        const angle = battle.elapsedSec * 6.4 + index * 0.5 - 0.55;
        const radius = 22 + index * 5 + pickupFlowRatio * 6;
        this.graphics.fillStyle(pickupGuideColor, 0.08 + pickupFlowRatio * 0.14 - index * 0.015);
        this.graphics.fillCircle(
          bodyX + pickupGuideDirX * 8 + pickupGuideOrthoX * Math.sin(angle) * 10,
          bodyY + pickupGuideDirY * 8 + pickupGuideOrthoY * Math.cos(angle) * (radius * 0.18),
          2.6 + pickupFlowRatio * 1.8 - index * 0.2,
        );
      }

      if (
        pickupGuideEnemy &&
        this.isVisibleInCamera(camera, pickupGuideEnemy.x, pickupGuideEnemy.y, pickupGuideEnemy.radius + 18)
      ) {
        const guideTargetScreen = this.worldToScreen(camera, pickupGuideEnemy.x, pickupGuideEnemy.y);
        this.graphics.fillStyle(pickupGuideColor, 0.06 + pickupFlowRatio * 0.08);
        this.graphics.fillCircle(
          guideTargetScreen.x,
          guideTargetScreen.y,
          pickupGuideEnemy.radius + 9 + pickupFlowRatio * 4,
        );
        this.graphics.lineStyle(1.2, pickupGuideColor, 0.12 + pickupFlowRatio * 0.16);
        this.graphics.strokeCircle(
          guideTargetScreen.x,
          guideTargetScreen.y,
          pickupGuideEnemy.radius + 10 + pickupFlowRatio * 5,
        );
      }
    }
    if (velocityRatio > 0.08 || moveBoostRatio > 0.08) {
      const trailDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const trailDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const trailOrthoX = -trailDirY;
      const trailOrthoY = trailDirX;
      const trailColor = this.mixColor(liveFocusColor, 0xe9ffff, 0.22 + moveBoostRatio * 0.16);
      for (let streak = 0; streak < 3; streak += 1) {
        const offset = 14 + streak * (10 + velocityRatio * 8);
        const width = 7 + streak * 2 + moveBoostRatio * 4;
        this.graphics.fillStyle(trailColor, 0.04 + velocityRatio * 0.04 + moveBoostRatio * 0.05 - streak * 0.01);
        this.graphics.fillTriangle(
          bodyX - trailDirX * (offset + 14) + trailOrthoX * width,
          bodyY - trailDirY * (offset + 14) + trailOrthoY * width,
          bodyX - trailDirX * offset,
          bodyY - trailDirY * offset,
          bodyX - trailDirX * (offset + 14) - trailOrthoX * width,
          bodyY - trailDirY * (offset + 14) - trailOrthoY * width,
        );
      }
    }
    if (turnBurstRatio > 0.08) {
      const skidColor = this.mixColor(0xbef7ff, liveFocusColor, 0.28);
      this.graphics.lineStyle(2, skidColor, 0.12 + turnBurstRatio * 0.24);
      this.graphics.lineBetween(
        bodyX + moveDirY * 16,
        bodyY - moveDirX * 16,
        bodyX + moveDirY * (30 + turnBurstRatio * 18),
        bodyY - moveDirX * (30 + turnBurstRatio * 18),
      );
      this.graphics.lineBetween(
        bodyX - moveDirY * 16,
        bodyY + moveDirX * 16,
        bodyX - moveDirY * (30 + turnBurstRatio * 18),
        bodyY + moveDirX * (30 + turnBurstRatio * 18),
      );
    }
    for (const [index, marker] of incomingThreatMarkers.entries()) {
      const markerColor =
        marker.kind === 'projectile'
          ? this.mixColor(0xff6f74, 0xffe6dd, 0.18)
          : marker.kind === 'ranged'
            ? this.mixColor(0xff9a78, 0xffffff, 0.22)
            : this.mixColor(0xffb694, liveFocusColor, 0.1);
      const radius = 56 + index * 10 + marker.strength * 8;
      const length = 10 + marker.strength * 10;
      const halfWidth = 5 + marker.strength * 3;
      const dirX = Math.cos(marker.angle);
      const dirY = Math.sin(marker.angle);
      const orthoX = -dirY;
      const orthoY = dirX;
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        marker.angle,
        radius,
        length,
        halfWidth,
        markerColor,
        0.06 + marker.strength * 0.16,
        0.02 + marker.strength * 0.06,
      );
      this.graphics.lineStyle(1.2, markerColor, 0.04 + marker.strength * 0.14);
      this.graphics.lineBetween(
        playerScreen.x + dirX * (radius - 9) + orthoX * 5,
        playerScreen.y + dirY * (radius - 9) + orthoY * 5,
        playerScreen.x + dirX * (radius + length * 0.24),
        playerScreen.y + dirY * (radius + length * 0.24),
      );
      this.graphics.lineBetween(
        playerScreen.x + dirX * (radius - 9) - orthoX * 5,
        playerScreen.y + dirY * (radius - 9) - orthoY * 5,
        playerScreen.x + dirX * (radius + length * 0.24),
        playerScreen.y + dirY * (radius + length * 0.24),
      );
    }
    if (nearMissRatio > 0) {
      const nearMissColor = this.mixColor(0xffa289, 0xffffff, 0.22);
      this.graphics.lineStyle(1.5, nearMissColor, 0.08 + nearMissRatio * 0.18);
      this.graphics.lineBetween(
        playerScreen.x + nearMissDirX * 28,
        playerScreen.y + nearMissDirY * 28,
        playerScreen.x + nearMissDirX * (44 + nearMissRatio * 10),
        playerScreen.y + nearMissDirY * (44 + nearMissRatio * 10),
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerNearMissAngle,
        48 + (1 - nearMissRatio) * 8,
        12 + nearMissRatio * 8,
        7 + nearMissRatio * 4,
        nearMissColor,
        0.1 + nearMissRatio * 0.18,
        0.03 + nearMissRatio * 0.06,
      );
    }
    if (critAuraRatio > 0) {
      const spokeColor = this.mixColor(accentColor, 0xfff0ad, 0.38);
      this.graphics.lineStyle(2, spokeColor, 0.18 + critAuraRatio * 0.3);
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const angle = battle.elapsedSec * 4.8 + spoke * (Math.PI / 2);
        this.graphics.lineBetween(
          playerScreen.x + Math.cos(angle) * 22,
          playerScreen.y + Math.sin(angle) * 22,
          playerScreen.x + Math.cos(angle) * 34,
          playerScreen.y + Math.sin(angle) * 34,
        );
      }
      this.graphics.lineStyle(3, spokeColor, 0.16 + critAuraRatio * 0.26);
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18,
        playerScreen.y + aimDirY * 18,
        playerScreen.x + aimDirX * (48 + critAuraRatio * 18),
        playerScreen.y + aimDirY * (48 + critAuraRatio * 18),
      );
      this.graphics.lineStyle(1.5, 0xfff8d0, 0.16 + critAuraRatio * 0.22);
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18 + aimOrthoX * 8,
        playerScreen.y + aimDirY * 18 + aimOrthoY * 8,
        playerScreen.x + aimDirX * (40 + critAuraRatio * 12),
        playerScreen.y + aimDirY * (40 + critAuraRatio * 12),
      );
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18 - aimOrthoX * 8,
        playerScreen.y + aimDirY * 18 - aimOrthoY * 8,
        playerScreen.x + aimDirX * (40 + critAuraRatio * 12),
        playerScreen.y + aimDirY * (40 + critAuraRatio * 12),
      );
    }
    if (liveFocusRoute === 'crit' && combatReadRatio > 0.08) {
      const critSlashColor = this.mixColor(accentColor, 0xfff0b0, 0.32);
      this.graphics.lineStyle(2.4, critSlashColor, 0.16 + combatReadRatio * 0.28);
      this.graphics.lineBetween(
        bodyX - aimOrthoX * 16 - aimDirX * 6,
        bodyY - aimOrthoY * 16 - aimDirY * 6,
        bodyX + aimDirX * (42 + combatReadRatio * 22),
        bodyY + aimDirY * (42 + combatReadRatio * 22),
      );
      this.graphics.lineBetween(
        bodyX + aimOrthoX * 16 - aimDirX * 6,
        bodyY + aimOrthoY * 16 - aimDirY * 6,
        bodyX + aimDirX * (42 + combatReadRatio * 22),
        bodyY + aimDirY * (42 + combatReadRatio * 22),
      );
      this.graphics.fillStyle(critSlashColor, 0.08 + combatReadRatio * 0.12);
      this.graphics.fillTriangle(
        bodyX + aimDirX * (26 + combatReadRatio * 14),
        bodyY + aimDirY * (26 + combatReadRatio * 14),
        bodyX + aimOrthoX * 12,
        bodyY + aimOrthoY * 12,
        bodyX - aimOrthoX * 12,
        bodyY - aimOrthoY * 12,
      );
    }
    if (pierceReadRatio > 0) {
      const laneColor = this.mixColor(accentColor, 0xe7f7ff, 0.34);
      const laneLength = 76 + pierceReadRatio * 28;
      this.graphics.lineStyle(1.5, laneColor, 0.08 + pierceReadRatio * 0.08);
      this.graphics.lineBetween(
        playerScreen.x - aimDirX * 18,
        playerScreen.y - aimDirY * 18,
        playerScreen.x + aimDirX * laneLength,
        playerScreen.y + aimDirY * laneLength,
      );
      this.graphics.fillStyle(laneColor, 0.05 + pierceReadRatio * 0.06);
      this.graphics.fillTriangle(
        playerScreen.x + aimDirX * 20,
        playerScreen.y + aimDirY * 20,
        playerScreen.x + aimOrthoX * 8,
        playerScreen.y + aimOrthoY * 8,
        playerScreen.x - aimOrthoX * 8,
        playerScreen.y - aimOrthoY * 8,
      );
    }
    if (liveFocusRoute === 'pierce' && combatReadRatio > 0.08) {
      const latticeColor = this.mixColor(accentColor, 0xe7f7ff, 0.34);
      this.graphics.lineStyle(1.4, latticeColor, 0.1 + combatReadRatio * 0.12);
      this.graphics.fillTriangle(
        bodyX + aimDirX * (28 + combatReadRatio * 12),
        bodyY + aimDirY * (28 + combatReadRatio * 12),
        bodyX + aimOrthoX * 9,
        bodyY + aimOrthoY * 9,
        bodyX - aimOrthoX * 9,
        bodyY - aimOrthoY * 9,
      );
      this.graphics.strokeCircle(playerScreen.x + aimDirX * 24, playerScreen.y + aimDirY * 24, 8 + combatReadRatio * 2);
    }
    if (lowHpRatio > 0) {
      const dangerColor = this.mixColor(0xff5d58, accentColor, 0.16);
      const dangerHighlight = this.mixColor(dangerColor, 0xffffff, 0.16);
      const edgeAlpha = 0.025 + lowHpRatio * 0.05 + dangerPulse * lowHpRatio * 0.035;
      const edgeDepth = 18 + lowHpRatio * 28;
      const cornerInset = 18;
      const cornerLength = 20 + lowHpRatio * 20 + dangerPulse * 8;
      this.graphics.fillStyle(dangerColor, edgeAlpha);
      this.graphics.fillRect(0, 0, camera.width, edgeDepth);
      this.graphics.fillRect(0, camera.height - edgeDepth, camera.width, edgeDepth);
      this.graphics.fillRect(0, edgeDepth, edgeDepth, camera.height - edgeDepth * 2);
      this.graphics.fillRect(camera.width - edgeDepth, edgeDepth, edgeDepth, camera.height - edgeDepth * 2);
      this.graphics.lineStyle(2 + criticalHpRatio * 1.4, dangerHighlight, 0.12 + lowHpRatio * 0.22 + dangerPulse * 0.06);
      this.graphics.lineBetween(cornerInset, cornerInset, cornerInset + cornerLength, cornerInset);
      this.graphics.lineBetween(cornerInset, cornerInset, cornerInset, cornerInset + cornerLength);
      this.graphics.lineBetween(camera.width - cornerInset, cornerInset, camera.width - cornerInset - cornerLength, cornerInset);
      this.graphics.lineBetween(camera.width - cornerInset, cornerInset, camera.width - cornerInset, cornerInset + cornerLength);
      this.graphics.lineBetween(cornerInset, camera.height - cornerInset, cornerInset + cornerLength, camera.height - cornerInset);
      this.graphics.lineBetween(cornerInset, camera.height - cornerInset, cornerInset, camera.height - cornerInset - cornerLength);
      this.graphics.lineBetween(
        camera.width - cornerInset,
        camera.height - cornerInset,
        camera.width - cornerInset - cornerLength,
        camera.height - cornerInset,
      );
      this.graphics.lineBetween(
        camera.width - cornerInset,
        camera.height - cornerInset,
        camera.width - cornerInset,
        camera.height - cornerInset - cornerLength,
      );
      this.graphics.lineStyle(2.2, dangerHighlight, 0.12 + lowHpRatio * 0.24);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 44 + dangerPulse * 9 + lowHpRatio * 10);
      if (criticalHpRatio > 0) {
        this.graphics.lineStyle(2.2, this.mixColor(0xffc29c, 0xffffff, 0.22), 0.1 + criticalHpRatio * 0.22 + dangerPulse * 0.08);
        this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 68 + dangerPulse * 12 + criticalHpRatio * 12);
      }
    }

    if (battle.invulnerableSec > 0 || freezeRatio > 0.08) {
      const shieldColor = battle.invulnerableSec > 0 ? 0x9cff97 : this.mixColor(liveFocusColor, 0xffffff, 0.16);
      this.graphics.lineStyle(
        1.8 + freezeRatio * 0.8,
        shieldColor,
        battle.invulnerableSec > 0 ? 0.48 : 0.18 + freezeRatio * 0.16,
      );
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 18 + freezeRatio * 8);
    }
    this.graphics.fillStyle(
      impactRatio > 0 ? this.mixColor(0xf8fbff, 0xff8c86, impactRatio * 0.8) : battle.invulnerableSec > 0 ? 0x9cff97 : 0xf8fbff,
      1,
    );
    if (shotFlashRatio > 0) {
      const flashColor =
        liveFocusRoute === 'crit'
          ? this.mixColor(0xffcf76, 0xffffff, 0.24)
          : liveFocusRoute === 'pierce'
            ? this.mixColor(0x98dcff, 0xffffff, 0.26)
            : liveFocusRoute === 'dash'
              ? this.mixColor(0x8effde, 0xffffff, 0.24)
              : 0xf8fbff;
      this.graphics.fillStyle(flashColor, 0.18 + shotFlashRatio * 0.3);
      this.graphics.fillTriangle(
        muzzleX + aimDirX * (14 + shotFlashRatio * 16),
        muzzleY + aimDirY * (14 + shotFlashRatio * 16),
        bodyX + aimOrthoX * (5 + shotFlashRatio * 8),
        bodyY + aimOrthoY * (5 + shotFlashRatio * 8),
        bodyX - aimOrthoX * (5 + shotFlashRatio * 8),
        bodyY - aimOrthoY * (5 + shotFlashRatio * 8),
      );
      this.graphics.lineStyle(2, flashColor, 0.14 + shotFlashRatio * 0.24);
      this.graphics.lineBetween(
        bodyX + aimOrthoX * 7,
        bodyY + aimOrthoY * 7,
        muzzleX + aimDirX * (20 + shotFlashRatio * 18),
        muzzleY + aimDirY * (20 + shotFlashRatio * 18),
      );
      this.graphics.lineBetween(
        bodyX - aimOrthoX * 7,
        bodyY - aimOrthoY * 7,
        muzzleX + aimDirX * (20 + shotFlashRatio * 18),
        muzzleY + aimDirY * (20 + shotFlashRatio * 18),
      );
      this.graphics.lineStyle(1.6, flashColor, 0.12 + shotFlashRatio * 0.22);
      this.graphics.lineBetween(
        muzzleX + aimOrthoX * (4 + shotFlashRatio * 3),
        muzzleY + aimOrthoY * (4 + shotFlashRatio * 3),
        muzzleX + aimDirX * (30 + shotFlashRatio * 24) + aimOrthoX * (10 + shotFlashRatio * 6),
        muzzleY + aimDirY * (30 + shotFlashRatio * 24) + aimOrthoY * (10 + shotFlashRatio * 6),
      );
      this.graphics.lineBetween(
        muzzleX - aimOrthoX * (4 + shotFlashRatio * 3),
        muzzleY - aimOrthoY * (4 + shotFlashRatio * 3),
        muzzleX + aimDirX * (30 + shotFlashRatio * 24) - aimOrthoX * (10 + shotFlashRatio * 6),
        muzzleY + aimDirY * (30 + shotFlashRatio * 24) - aimOrthoY * (10 + shotFlashRatio * 6),
      );
      if (killFlowRatio > 0.08) {
        this.graphics.lineStyle(1.4, this.mixColor(flashColor, 0xffffff, 0.18), 0.08 + killFlowRatio * 0.18);
        this.graphics.strokeCircle(muzzleX, muzzleY, 10 + killFlowRatio * 10 + shotFlashRatio * 6);
      }
    }
    this.graphics.fillCircle(bodyX, bodyY, 10 + velocityRatio * 0.8);
    this.renderRuntimePreviewImage(PREVIEW_PLAYER_TEXTURE, bodyX, bodyY, 48 + velocityRatio * 4, Math.atan2(aimDirY, aimDirX) + Math.PI / 2, 0.78);
    const playerBarWidth = 40;
    const playerBarHeight = 6;
    const playerBarX = playerScreen.x - playerBarWidth * 0.5;
    const playerBarY = playerScreen.y - 30;
    const playerBarColor =
      hpRatio <= 0.35 ? 0xff6d62 : hpRatio <= 0.68 ? 0xffc65a : 0x59da78;
    this.graphics.fillStyle(0x22160f, 0.82);
    this.graphics.fillRoundedRect(playerBarX, playerBarY, playerBarWidth, playerBarHeight, 3);
    this.graphics.fillStyle(playerBarColor, 1);
    this.graphics.fillRoundedRect(playerBarX, playerBarY, playerBarWidth * hpRatio, playerBarHeight, 3);
    this.graphics.lineStyle(1.2, 0xf4f0e6, 0.36);
    this.graphics.strokeRoundedRect(playerBarX, playerBarY, playerBarWidth, playerBarHeight, 3);

    this.graphics.fillGradientStyle(
      0x000000,
      0x000000,
      0x000000,
      0x000000,
      0.034 + impactRatio * 0.04 + lowHpRatio * 0.025,
    );
    this.graphics.fillRect(0, 0, camera.width, camera.height);
    if (impactRatio > 0) {
      this.graphics.fillStyle(0xff5f59, 0.03 + impactRatio * 0.05);
      this.graphics.fillRect(0, 0, camera.width, camera.height);
      const impactAngle = battle.playerDamageFlashSec > 0 ? battle.playerDamageAngle : Math.atan2(-hurtDirY, -hurtDirX);
      const impactDirX = Math.cos(impactAngle);
      const impactDirY = Math.sin(impactAngle);
      const impactOrthoX = -impactDirY;
      const impactOrthoY = impactDirX;
      const edgeReach = Math.max(camera.width, camera.height) * 0.56;
      this.graphics.fillStyle(0xff8a72, 0.028 + impactRatio * 0.05);
      this.graphics.fillTriangle(
        playerScreen.x + impactDirX * edgeReach + impactOrthoX * (90 + impactRatio * 70),
        playerScreen.y + impactDirY * edgeReach + impactOrthoY * (90 + impactRatio * 70),
        playerScreen.x + impactDirX * edgeReach - impactOrthoX * (90 + impactRatio * 70),
        playerScreen.y + impactDirY * edgeReach - impactOrthoY * (90 + impactRatio * 70),
        playerScreen.x - impactDirX * (10 + impactRatio * 8),
        playerScreen.y - impactDirY * (10 + impactRatio * 8),
      );
    }
  }

  private getLiveCombatFocusRoute(battle: BattleState): 'crit' | 'pierce' | 'dash' | null {
    const state = this.engine.getState();
    if (battle.dashDriveSec > 0 && state.routeCounts.dash > 0) {
      return 'dash';
    }
    if (battle.critOverdriveSec > 0 && state.routeCounts.crit > 0) {
      return 'crit';
    }
    if (battle.pierceFlowSec > 0 && state.routeCounts.pierce > 0) {
      return 'pierce';
    }
    return state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
  }

  private getProjectedEnemyAimScreenPoint(
    enemy: BattleState['enemies'][number],
    battle: BattleState,
    camera: { left: number; top: number },
  ): { x: number; y: number } {
    return this.worldToScreen(camera, battle.playerX, battle.playerY);
  }

  private getIncomingThreatMarkers(
    battle: BattleState,
  ): Array<{ angle: number; strength: number; kind: 'projectile' | 'ranged' | 'pressure' }> {
    const markers: Array<{ angle: number; strength: number; kind: 'projectile' | 'ranged' | 'pressure' }> = [];

    for (const projectile of battle.enemyProjectiles) {
      const dx = projectile.x - battle.playerX;
      const dy = projectile.y - battle.playerY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance > 186) {
        continue;
      }
      const toPlayerX = -dx / distance;
      const toPlayerY = -dy / distance;
      const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
      const velocityX = projectile.vx / speed;
      const velocityY = projectile.vy / speed;
      const approach = velocityX * toPlayerX + velocityY * toPlayerY;
      if (approach < 0.12) {
        continue;
      }
      const proximity = Phaser.Math.Clamp(1 - distance / 186, 0, 1);
      markers.push({
        angle: Math.atan2(dy, dx),
        strength: Phaser.Math.Clamp(proximity * 0.72 + approach * 0.56 + (projectile.radius > 5 ? 0.08 : 0), 0, 1),
        kind: 'projectile',
      });
    }

    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0 || enemy.elite) {
        continue;
      }
      const dx = enemy.x - battle.playerX;
      const dy = enemy.y - battle.playerY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      if (enemy.archetype === 'ranged') {
        const lockRatio =
          enemy.rangedCooldownSec <= 0.72 ? Phaser.Math.Clamp((0.72 - enemy.rangedCooldownSec) / 0.72, 0, 1) : 0;
        const pressureRatio = this.getEnemyPressureRatio(enemy);
        if (distance <= 252 && (lockRatio > 0.18 || pressureRatio > 0.18)) {
          const proximity = Phaser.Math.Clamp(1 - distance / 252, 0, 1);
          markers.push({
            angle,
            strength: Phaser.Math.Clamp(lockRatio * 0.68 + pressureRatio * 0.38 + proximity * 0.26, 0, 1),
            kind: 'ranged',
          });
        }
        continue;
      }

      const pressureRatio = this.getEnemyPressureRatio(enemy);
      if (pressureRatio <= 0.18) {
        continue;
      }
      const maxDistance = enemy.archetype === 'skirmisher' ? 178 : enemy.archetype === 'brute' ? 164 : 150;
      if (distance > maxDistance) {
        continue;
      }
      const proximity = Phaser.Math.Clamp(1 - distance / maxDistance, 0, 1);
      const archetypeBias = enemy.archetype === 'skirmisher' ? 0.14 : enemy.archetype === 'brute' ? 0.1 : 0.04;
      markers.push({
        angle,
        strength: Phaser.Math.Clamp(pressureRatio * 0.64 + proximity * 0.34 + archetypeBias, 0, 1),
        kind: 'pressure',
      });
    }

    markers.sort((left, right) => right.strength - left.strength);
    const chosen: Array<{ angle: number; strength: number; kind: 'projectile' | 'ranged' | 'pressure' }> = [];
    for (const marker of markers) {
      const overlaps = chosen.some(
        (existing) => Math.abs(Phaser.Math.Angle.Wrap(existing.angle - marker.angle)) < 0.42,
      );
      if (overlaps) {
        continue;
      }
      chosen.push(marker);
      if (chosen.length >= 2) {
        break;
      }
    }
    return chosen;
  }

  private renderDirectionalChevron(
    centerX: number,
    centerY: number,
    angle: number,
    innerRadius: number,
    length: number,
    halfWidth: number,
    color: number,
    lineAlpha: number,
    fillAlpha: number,
  ): void {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const orthoX = -dirY;
    const orthoY = dirX;
    const baseX = centerX + dirX * innerRadius;
    const baseY = centerY + dirY * innerRadius;
    const tipX = centerX + dirX * (innerRadius + length);
    const tipY = centerY + dirY * (innerRadius + length);
    const leftX = baseX - dirX * (length * 0.28) + orthoX * halfWidth;
    const leftY = baseY - dirY * (length * 0.28) + orthoY * halfWidth;
    const rightX = baseX - dirX * (length * 0.28) - orthoX * halfWidth;
    const rightY = baseY - dirY * (length * 0.28) - orthoY * halfWidth;

    if (fillAlpha > 0) {
      this.graphics.fillStyle(color, fillAlpha);
      this.graphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    }

    this.graphics.lineStyle(2, color, lineAlpha);
    this.graphics.lineBetween(leftX, leftY, tipX, tipY);
    this.graphics.lineBetween(rightX, rightY, tipX, tipY);
    this.graphics.lineStyle(1.4, color, lineAlpha * 0.8);
    this.graphics.lineBetween(baseX + orthoX * (halfWidth * 0.42), baseY + orthoY * (halfWidth * 0.42), leftX, leftY);
    this.graphics.lineBetween(baseX - orthoX * (halfWidth * 0.42), baseY - orthoY * (halfWidth * 0.42), rightX, rightY);
  }

  private renderEliteEscortField(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  ): void {
    const elite = battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0);
    if (!elite || !this.isVisibleInCamera(camera, elite.x, elite.y, elite.radius + 96)) {
      return;
    }

    const elitePressure = this.getEnemyPressureRatio(elite);
    const eliteRecovery = this.getEnemyRecoveryRatio(elite);
    const eliteCrackRatio = battle.eliteCrackWindowSec > 0 ? Math.min(1, battle.eliteCrackWindowSec / 0.82) : 0;
    const eliteBreachFlashRatio = battle.eliteBreachFlashSec > 0 ? Math.min(1, battle.eliteBreachFlashSec / 0.48) : 0;
    const displayedRecovery = Math.max(eliteRecovery, eliteCrackRatio * 0.88, eliteBreachFlashRatio * 0.9);
    const liveFocusRoute = this.getLiveCombatFocusRoute(battle);
    const escorts = battle.enemies
      .filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0)
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(enemy.x - elite.x, enemy.y - elite.y),
      }))
      .filter(
        (entry) =>
          entry.distance <= 228 &&
          this.isVisibleInCamera(camera, entry.enemy.x, entry.enemy.y, entry.enemy.radius + 28),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 4);

    if (escorts.length === 0 && elitePressure <= 0.05 && displayedRecovery <= 0.08) {
      return;
    }

    const eliteScreen = this.worldToScreen(camera, elite.x, elite.y);
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    const pulseColor = this.mixColor(BATTLE_TEMPLATES[battle.templateId].accent, 0xffefbf, 0.34);
    const crackColor = this.mixColor(0xfff0c4, 0xf5fbff, 0.42);

    if (escorts.length > 0 && (elitePressure > 0.04 || eliteCrackRatio > 0.08 || eliteBreachFlashRatio > 0.08)) {
      const fieldAlpha = Math.max(
        0.06 + elitePressure * 0.18,
        0.08 + eliteCrackRatio * 0.16,
        0.1 + eliteBreachFlashRatio * 0.14,
      );
      this.graphics.lineStyle(1.8, pulseColor, fieldAlpha);
      for (const entry of escorts) {
        const escortScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
        this.graphics.lineBetween(eliteScreen.x, eliteScreen.y, escortScreen.x, escortScreen.y);
        this.graphics.strokeCircle(
          escortScreen.x,
          escortScreen.y,
          entry.enemy.radius + 10 + Math.max(elitePressure * 6, eliteCrackRatio * 7),
        );
      }
      if (escorts.length >= 2) {
        for (let index = 0; index < escorts.length - 1; index += 1) {
          const from = this.worldToScreen(camera, escorts[index].enemy.x, escorts[index].enemy.y);
          const to = this.worldToScreen(camera, escorts[index + 1].enemy.x, escorts[index + 1].enemy.y);
          this.graphics.fillStyle(pulseColor, 0.018 + elitePressure * 0.04 + eliteBreachFlashRatio * 0.04);
          this.graphics.fillTriangle(eliteScreen.x, eliteScreen.y, from.x, from.y, to.x, to.y);
        }
        this.graphics.lineStyle(1.3, pulseColor, Math.max(0.04 + elitePressure * 0.14, 0.06 + eliteCrackRatio * 0.12));
        for (let index = 0; index < escorts.length - 1; index += 1) {
          const from = this.worldToScreen(camera, escorts[index].enemy.x, escorts[index].enemy.y);
          const to = this.worldToScreen(camera, escorts[index + 1].enemy.x, escorts[index + 1].enemy.y);
          this.graphics.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }

    if (displayedRecovery > 0.08) {
      const chaseDx = playerScreen.x - eliteScreen.x;
      const chaseDy = playerScreen.y - eliteScreen.y;
      const chaseDistance = Math.max(1, Math.hypot(chaseDx, chaseDy));
      const chaseDirX = chaseDx / chaseDistance;
      const chaseDirY = chaseDy / chaseDistance;
      const chaseOrthoX = -chaseDirY;
      const chaseOrthoY = chaseDirX;
      const breachLength = Math.max(
        28,
        Math.min(chaseDistance - 12, elite.radius + 86 + displayedRecovery * 42 + battle.eliteCrackEscortCount * 4),
      );
      const breachWidth = elite.radius + 8 + displayedRecovery * 14 + eliteCrackRatio * 10;
      const breachLeftX = eliteScreen.x + chaseOrthoX * breachWidth;
      const breachLeftY = eliteScreen.y + chaseOrthoY * breachWidth;
      const breachRightX = eliteScreen.x - chaseOrthoX * breachWidth;
      const breachRightY = eliteScreen.y - chaseOrthoY * breachWidth;
      const breachTipX = eliteScreen.x + chaseDirX * breachLength;
      const breachTipY = eliteScreen.y + chaseDirY * breachLength;
      const playerProjection = chaseDx * chaseDirX + chaseDy * chaseDirY;
      const playerLateral = Math.abs(chaseDx * chaseOrthoX + chaseDy * chaseOrthoY);
      const playerInBreachCorridor =
        playerProjection >= elite.radius - 14 &&
        playerProjection <= breachLength + 12 &&
        playerLateral <= breachWidth * 1.1;
      this.graphics.fillStyle(crackColor, 0.03 + displayedRecovery * 0.06);
      this.graphics.fillTriangle(breachLeftX, breachLeftY, breachTipX, breachTipY, breachRightX, breachRightY);
      this.graphics.lineStyle(1.6, crackColor, 0.08 + displayedRecovery * 0.18);
      this.graphics.lineBetween(breachLeftX, breachLeftY, breachTipX, breachTipY);
      this.graphics.lineBetween(breachRightX, breachRightY, breachTipX, breachTipY);
      this.graphics.lineStyle(2.2, crackColor, 0.08 + displayedRecovery * 0.22);
      this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, elite.radius + 26 + (1 - displayedRecovery) * 10);
      this.graphics.lineStyle(1.8, crackColor, 0.08 + displayedRecovery * 0.2);
      this.graphics.lineBetween(
        eliteScreen.x - (elite.radius + 8),
        eliteScreen.y,
        eliteScreen.x - (elite.radius + 24 + displayedRecovery * 10),
        eliteScreen.y,
      );
      this.graphics.lineBetween(
        eliteScreen.x + elite.radius + 8,
        eliteScreen.y,
        eliteScreen.x + elite.radius + 24 + displayedRecovery * 10,
        eliteScreen.y,
      );
      const chaseGuideColor = this.mixColor(crackColor, 0xffffff, 0.18);
      const chaseGuideAlpha = 0.04 + displayedRecovery * 0.14 + eliteCrackRatio * 0.08;
      this.graphics.lineStyle(1.6, chaseGuideColor, chaseGuideAlpha);
      this.graphics.lineBetween(playerScreen.x, playerScreen.y, breachTipX, breachTipY);
      const flowLead = (battle.elapsedSec * 2.4) % 1;
      for (let marker = 0; marker < 4; marker += 1) {
        const flowRatio = (flowLead + marker * 0.19) % 1;
        const markerDistance = breachLength * (0.18 + flowRatio * 0.7);
        const markerX = eliteScreen.x + chaseDirX * markerDistance;
        const markerY = eliteScreen.y + chaseDirY * markerDistance;
        const markerWidth = 8 + displayedRecovery * 4 - marker * 0.8;
        this.graphics.lineStyle(1.4, chaseGuideColor, chaseGuideAlpha * (0.92 - marker * 0.12));
        this.graphics.lineBetween(
          markerX - chaseOrthoX * markerWidth,
          markerY - chaseOrthoY * markerWidth,
          markerX + chaseOrthoX * markerWidth,
          markerY + chaseOrthoY * markerWidth,
        );
      }
      for (let marker = 0; marker < 3; marker += 1) {
        const markerDistance = breachLength * (0.32 + marker * 0.18);
        const markerX = eliteScreen.x + chaseDirX * markerDistance;
        const markerY = eliteScreen.y + chaseDirY * markerDistance;
        const markerSize = 6 + displayedRecovery * 4 + marker * 1.5;
        this.graphics.lineStyle(1.4, chaseGuideColor, chaseGuideAlpha + 0.04 - marker * 0.01);
        this.graphics.lineBetween(
          markerX - chaseDirX * markerSize + chaseOrthoX * markerSize * 0.8,
          markerY - chaseDirY * markerSize + chaseOrthoY * markerSize * 0.8,
          markerX,
          markerY,
        );
        this.graphics.lineBetween(
          markerX - chaseDirX * markerSize - chaseOrthoX * markerSize * 0.8,
          markerY - chaseDirY * markerSize - chaseOrthoY * markerSize * 0.8,
          markerX,
          markerY,
        );
      }
      if (playerInBreachCorridor) {
        this.graphics.lineStyle(2.1, chaseGuideColor, chaseGuideAlpha + 0.12 + eliteBreachFlashRatio * 0.06);
        this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 18 + displayedRecovery * 6);
        this.graphics.lineStyle(1.4, chaseGuideColor, chaseGuideAlpha + 0.08);
        this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 28 + displayedRecovery * 8);
      }
      for (const entry of escorts) {
        const escortRecovery = this.getEnemyRecoveryRatio(entry.enemy);
        if (escortRecovery <= 0.05) {
          continue;
        }
        const escortScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
        const linkAlpha = 0.05 + Math.max(eliteRecovery, escortRecovery) * 0.12;
        this.graphics.lineStyle(1.3, crackColor, linkAlpha);
        this.graphics.strokeCircle(
          escortScreen.x,
          escortScreen.y,
          entry.enemy.radius + 12 + escortRecovery * 8,
        );
      }

      if (eliteCrackRatio > 0.08) {
        const focusColor =
          liveFocusRoute === 'crit'
            ? this.mixColor(0xffdc88, 0xffffff, 0.22)
            : liveFocusRoute === 'pierce'
              ? this.mixColor(0x9bddff, 0xffffff, 0.18)
              : this.mixColor(crackColor, 0xffffff, 0.16);
        const focusAlpha = 0.08 + eliteCrackRatio * 0.22;
        const chaseAngle = Math.atan2(eliteScreen.y - playerScreen.y, eliteScreen.x - playerScreen.x);
        this.renderDirectionalChevron(
          playerScreen.x,
          playerScreen.y,
          chaseAngle,
          42 + eliteCrackRatio * 10,
          20 + eliteCrackRatio * 14,
          8 + eliteCrackRatio * 4,
          focusColor,
          focusAlpha,
          0.03 + eliteCrackRatio * 0.06,
        );

        if (liveFocusRoute === 'crit') {
          const bracketReach = elite.radius + 18 + eliteCrackRatio * 10;
          this.graphics.lineStyle(2, focusColor, focusAlpha + 0.04);
          this.graphics.lineBetween(eliteScreen.x - bracketReach, eliteScreen.y - bracketReach * 0.66, eliteScreen.x - elite.radius - 6, eliteScreen.y - bracketReach * 0.66);
          this.graphics.lineBetween(eliteScreen.x - bracketReach, eliteScreen.y - bracketReach * 0.66, eliteScreen.x - bracketReach, eliteScreen.y - elite.radius - 6);
          this.graphics.lineBetween(eliteScreen.x + bracketReach, eliteScreen.y - bracketReach * 0.66, eliteScreen.x + elite.radius + 6, eliteScreen.y - bracketReach * 0.66);
          this.graphics.lineBetween(eliteScreen.x + bracketReach, eliteScreen.y - bracketReach * 0.66, eliteScreen.x + bracketReach, eliteScreen.y - elite.radius - 6);
          this.graphics.lineBetween(eliteScreen.x - bracketReach, eliteScreen.y + bracketReach * 0.66, eliteScreen.x - elite.radius - 6, eliteScreen.y + bracketReach * 0.66);
          this.graphics.lineBetween(eliteScreen.x - bracketReach, eliteScreen.y + bracketReach * 0.66, eliteScreen.x - bracketReach, eliteScreen.y + elite.radius + 6);
          this.graphics.lineBetween(eliteScreen.x + bracketReach, eliteScreen.y + bracketReach * 0.66, eliteScreen.x + elite.radius + 6, eliteScreen.y + bracketReach * 0.66);
          this.graphics.lineBetween(eliteScreen.x + bracketReach, eliteScreen.y + bracketReach * 0.66, eliteScreen.x + bracketReach, eliteScreen.y + elite.radius + 6);
        } else if (liveFocusRoute === 'pierce') {
          this.graphics.lineStyle(1.4, focusColor, focusAlpha * 0.9);
          this.graphics.lineBetween(
            eliteScreen.x - chaseOrthoX * (elite.radius + 10),
            eliteScreen.y - chaseOrthoY * (elite.radius + 10),
            eliteScreen.x + chaseOrthoX * (elite.radius + 10),
            eliteScreen.y + chaseOrthoY * (elite.radius + 10),
          );
        } else if (liveFocusRoute === 'dash') {
          const foldReach = elite.radius + 24 + eliteCrackRatio * 16;
          const foldSide = elite.radius + 14 + eliteCrackRatio * 8;
          this.graphics.lineStyle(2.1, focusColor, focusAlpha + 0.03);
          this.graphics.lineBetween(
            eliteScreen.x - chaseDirX * 10 + chaseOrthoX * foldSide,
            eliteScreen.y - chaseDirY * 10 + chaseOrthoY * foldSide,
            eliteScreen.x + chaseDirX * foldReach,
            eliteScreen.y + chaseDirY * foldReach,
          );
          this.graphics.lineBetween(
            eliteScreen.x - chaseDirX * 10 - chaseOrthoX * foldSide,
            eliteScreen.y - chaseDirY * 10 - chaseOrthoY * foldSide,
            eliteScreen.x + chaseDirX * foldReach,
            eliteScreen.y + chaseDirY * foldReach,
          );
        }

        if (battle.encounterType === 'battle') {
          if (liveFocusRoute === 'crit') {
            for (let index = 0; index < 2; index += 1) {
              const chaseOffset = 42 + index * 22 + eliteCrackRatio * 10;
              const chevronX = eliteScreen.x - chaseDirX * chaseOffset;
              const chevronY = eliteScreen.y - chaseDirY * chaseOffset;
              this.renderDirectionalChevron(
                chevronX,
                chevronY,
                chaseAngle,
                16 + eliteCrackRatio * 6,
                9 + eliteCrackRatio * 5,
                4 + eliteCrackRatio * 2,
                focusColor,
                focusAlpha * (0.82 - index * 0.12),
                0.02 + eliteCrackRatio * 0.04,
              );
            }
            this.graphics.lineStyle(1.6, focusColor, focusAlpha * 0.88);
            this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, elite.radius + 10 + eliteCrackRatio * 6);
            this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, elite.radius + 18 + eliteCrackRatio * 8);
          } else if (liveFocusRoute === 'pierce') {
            const throughLength = elite.radius + 42 + eliteCrackRatio * 24 + battle.eliteCrackEscortCount * 10;
            const railOffset = elite.radius + 16 + eliteCrackRatio * 8;
            this.graphics.lineStyle(1.8, focusColor, focusAlpha * 0.86);
            this.graphics.lineBetween(
              eliteScreen.x - chaseDirX * (elite.radius + 14),
              eliteScreen.y - chaseDirY * (elite.radius + 14),
              eliteScreen.x + chaseDirX * throughLength,
              eliteScreen.y + chaseDirY * throughLength,
            );
            this.graphics.lineStyle(1.3, focusColor, focusAlpha * 0.68);
            this.graphics.lineBetween(
              eliteScreen.x - chaseDirX * 10 + chaseOrthoX * railOffset,
              eliteScreen.y - chaseDirY * 10 + chaseOrthoY * railOffset,
              eliteScreen.x + chaseDirX * (throughLength - 10) + chaseOrthoX * railOffset,
              eliteScreen.y + chaseDirY * (throughLength - 10) + chaseOrthoY * railOffset,
            );
            this.graphics.lineBetween(
              eliteScreen.x - chaseDirX * 10 - chaseOrthoX * railOffset,
              eliteScreen.y - chaseDirY * 10 - chaseOrthoY * railOffset,
              eliteScreen.x + chaseDirX * (throughLength - 10) - chaseOrthoX * railOffset,
              eliteScreen.y + chaseDirY * (throughLength - 10) - chaseOrthoY * railOffset,
            );
            for (let marker = 0; marker < 3; marker += 1) {
              const railRatio = ((battle.elapsedSec * 1.9) + marker * 0.24) % 1;
              const railDistance = throughLength * (0.18 + railRatio * 0.68);
              const railCoreX = eliteScreen.x + chaseDirX * railDistance;
              const railCoreY = eliteScreen.y + chaseDirY * railDistance;
              this.graphics.fillStyle(focusColor, focusAlpha * (0.44 - marker * 0.08));
              this.graphics.fillCircle(
                railCoreX + chaseOrthoX * railOffset,
                railCoreY + chaseOrthoY * railOffset,
                2.2 + eliteCrackRatio * 1.4,
              );
              this.graphics.fillCircle(
                railCoreX - chaseOrthoX * railOffset,
                railCoreY - chaseOrthoY * railOffset,
                2.2 + eliteCrackRatio * 1.4,
              );
            }
            for (const entry of escorts.slice(0, 2)) {
              const escortScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
              this.graphics.lineStyle(1.2, focusColor, focusAlpha * 0.52);
              this.graphics.lineBetween(
                escortScreen.x,
                escortScreen.y,
                escortScreen.x - chaseOrthoX * (10 + eliteCrackRatio * 4),
                escortScreen.y - chaseOrthoY * (10 + eliteCrackRatio * 4),
              );
              this.graphics.lineBetween(
                escortScreen.x,
                escortScreen.y,
                escortScreen.x + chaseOrthoX * (10 + eliteCrackRatio * 4),
                escortScreen.y + chaseOrthoY * (10 + eliteCrackRatio * 4),
              );
            }
          } else if (liveFocusRoute === 'dash') {
            const returnDepth = elite.radius + 34 + eliteCrackRatio * 20;
            const returnOffset = elite.radius + 16 + eliteCrackRatio * 8;
            this.graphics.lineStyle(1.8, focusColor, focusAlpha * 0.86);
            this.graphics.lineBetween(
              eliteScreen.x - chaseDirX * 10 + chaseOrthoX * returnOffset,
              eliteScreen.y - chaseDirY * 10 + chaseOrthoY * returnOffset,
              eliteScreen.x + chaseDirX * returnDepth,
              eliteScreen.y + chaseDirY * returnDepth,
            );
            this.graphics.lineBetween(
              eliteScreen.x - chaseDirX * 10 - chaseOrthoX * returnOffset,
              eliteScreen.y - chaseDirY * 10 - chaseOrthoY * returnOffset,
              eliteScreen.x + chaseDirX * returnDepth,
              eliteScreen.y + chaseDirY * returnDepth,
            );
            for (let marker = 0; marker < 3; marker += 1) {
              const returnRatio = ((battle.elapsedSec * 2.4) + marker * 0.22) % 1;
              const returnDistance = returnDepth * (0.18 + returnRatio * 0.66);
              const markerX = eliteScreen.x + chaseDirX * returnDistance;
              const markerY = eliteScreen.y + chaseDirY * returnDistance;
              const markerSize = 6 + eliteCrackRatio * 4 + marker * 1.4;
              this.graphics.lineStyle(1.2, focusColor, focusAlpha * (0.72 - marker * 0.1));
              this.graphics.lineBetween(
                markerX - chaseDirX * markerSize + chaseOrthoX * markerSize * 0.8,
                markerY - chaseDirY * markerSize + chaseOrthoY * markerSize * 0.8,
                markerX,
                markerY,
              );
              this.graphics.lineBetween(
                markerX - chaseDirX * markerSize - chaseOrthoX * markerSize * 0.8,
                markerY - chaseDirY * markerSize - chaseOrthoY * markerSize * 0.8,
                markerX,
                markerY,
              );
            }
            this.graphics.lineStyle(1.4, focusColor, focusAlpha * 0.72);
            this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, elite.radius + 12 + eliteCrackRatio * 8);
          }
        }
      }
    }

    this.renderDebugBattleOverlay(battle, camera);
  }

  private renderDebugBattleOverlay(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  ): void {
    if (
      !this.debugConfig.showEnemyVectors &&
      !this.debugConfig.showProjectileVectors &&
      !this.debugConfig.showCollisionRadii
    ) {
      return;
    }

    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    if (this.debugConfig.showCollisionRadii) {
      this.graphics.lineStyle(1.2, 0x8ff7ff, 0.85);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 12);
    }

    for (const enemy of battle.enemies) {
      if (!this.isVisibleInCamera(camera, enemy.x, enemy.y, enemy.radius + 48)) {
        continue;
      }

      const screen = this.worldToScreen(camera, enemy.x, enemy.y);
      if (this.debugConfig.showCollisionRadii) {
        this.graphics.lineStyle(1, enemy.elite ? 0xffd39a : 0xff9ea4, enemy.elite ? 0.95 : 0.68);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius);
      }

      if (this.debugConfig.showEnemyVectors) {
        const moveSpeed = Math.hypot(enemy.debugMoveVX, enemy.debugMoveVY);
        if (moveSpeed > 0.5) {
          const vectorScale = 0.07;
          const endX = screen.x + enemy.debugMoveVX * vectorScale;
          const endY = screen.y + enemy.debugMoveVY * vectorScale;
          this.graphics.lineStyle(1.6, enemy.elite ? 0xffe6aa : 0xffc48d, 0.92);
          this.graphics.lineBetween(screen.x, screen.y, endX, endY);
          this.renderDirectionalChevron(
            endX,
            endY,
            Math.atan2(enemy.debugMoveVY, enemy.debugMoveVX),
            8,
            5,
            2,
            enemy.elite ? 0xfff3c9 : 0xffd7af,
            0.9,
            0,
          );
        }
      }
    }

    if (this.debugConfig.showProjectileVectors || this.debugConfig.showCollisionRadii) {
      for (const projectile of battle.enemyProjectiles) {
        if (!this.isVisibleInCamera(camera, projectile.x, projectile.y, projectile.radius + 48)) {
          continue;
        }

        const screen = this.worldToScreen(camera, projectile.x, projectile.y);
        if (this.debugConfig.showCollisionRadii) {
          this.graphics.lineStyle(1, 0xff7b82, 0.92);
          this.graphics.strokeCircle(screen.x, screen.y, projectile.radius);
        }
        if (this.debugConfig.showProjectileVectors) {
          const vectorScale = 0.065;
          const endX = screen.x + projectile.vx * vectorScale;
          const endY = screen.y + projectile.vy * vectorScale;
          this.graphics.lineStyle(1.4, 0xffd4d8, 0.88);
          this.graphics.lineBetween(screen.x, screen.y, endX, endY);
          this.renderDirectionalChevron(
            endX,
            endY,
            Math.atan2(projectile.vy, projectile.vx),
            7,
            4,
            2,
            0xfff0f2,
            0.9,
            0,
          );
        }
      }
    }
  }

  private renderEncounterFlowOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
  ): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const alpha = 0.026 + Math.min(0.04, battle.tempoPulseSec * 0.1 + (battle.elapsedSec / Math.max(1, template.durationSec)) * 0.028);
    const flowPulse = 0.5 + Math.sin(battle.elapsedSec * 2.2) * 0.5;

    if (pattern === 'pincers') {
      const slide = ((battle.elapsedSec * 84) % 64) - 18;
      this.graphics.fillStyle(accentColor, alpha * (0.34 + flowPulse * 0.22));
      this.graphics.fillRect(0, 68, 22, camera.height - 136);
      this.graphics.fillRect(camera.width - 22, 68, 22, camera.height - 136);
      this.graphics.lineStyle(2, accentColor, alpha * 1.25);
      for (let lane = 0; lane < 3; lane += 1) {
        const y = 132 + lane * ((camera.height - 264) / 2);
        this.graphics.lineBetween(36, y, 78, y - 20);
        this.graphics.lineBetween(36, y, 78, y + 20);
        this.graphics.lineBetween(camera.width - 36, y, camera.width - 78, y - 20);
        this.graphics.lineBetween(camera.width - 36, y, camera.width - 78, y + 20);
        this.graphics.fillStyle(accentColor, alpha * (0.48 + flowPulse * 0.16));
        this.graphics.fillRoundedRect(22 + slide, y - 7, 24, 14, 5);
        this.graphics.fillRoundedRect(camera.width - 46 - slide, y - 7, 24, 14, 5);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'vertical') {
      const laneWidth = camera.width / 4;
      const sweep = (battle.elapsedSec * 98) % Math.max(80, camera.height - 104);
      for (let lane = 1; lane <= 3; lane += 1) {
        const x = laneWidth * lane;
        this.graphics.fillStyle(accentColor, alpha * 0.45);
        this.graphics.fillRect(x - 14, 22, 28, camera.height - 44);
        this.graphics.lineStyle(1, accentColor, alpha * 1.1);
        this.graphics.lineBetween(x, 18, x, camera.height - 18);
        this.graphics.fillStyle(accentColor, alpha * (0.54 + flowPulse * 0.14));
        this.graphics.fillRoundedRect(x - 12, 24 + sweep * 0.52, 24, 18, 6);
        this.graphics.fillRoundedRect(x - 12, camera.height - 42 - sweep * 0.52, 24, 18, 6);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      // 横向车道流向overlay已删除 - 避免三条半透明条纹残留
      // 如需调试显示，请取消下方注释
      /*
      const laneHeight = camera.height / 4;
      const sweep = (battle.elapsedSec * 104) % Math.max(96, camera.width - 156);
      for (let lane = 1; lane <= 3; lane += 1) {
        const y = laneHeight * lane;
        this.graphics.fillStyle(accentColor, alpha * 0.42);
        this.graphics.fillRect(18, y - 14, camera.width - 36, 28);
        this.graphics.lineStyle(1, accentColor, alpha * 1.05);
        this.graphics.lineBetween(18, y, camera.width - 18, y);
        this.graphics.fillStyle(accentColor, alpha * (0.52 + flowPulse * 0.14));
        this.graphics.fillRoundedRect(24 + sweep * 0.48, y - 12, 18, 24, 6);
        this.graphics.fillRoundedRect(camera.width - 42 - sweep * 0.48, y - 12, 18, 24, 6);
      }
      */
      return;
    }

    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;
    const arm = 34 + flowPulse * 14;
    const edgeInsetX = 34;
    const edgeInsetY = 42;
    this.graphics.lineStyle(2, accentColor, alpha * 1.08);
    this.graphics.lineBetween(edgeInsetX, centerY - 48, edgeInsetX + arm, centerY - 18);
    this.graphics.lineBetween(edgeInsetX, centerY + 48, edgeInsetX + arm, centerY + 18);
    this.graphics.lineBetween(camera.width - edgeInsetX, centerY - 48, camera.width - edgeInsetX - arm, centerY - 18);
    this.graphics.lineBetween(camera.width - edgeInsetX, centerY + 48, camera.width - edgeInsetX - arm, centerY + 18);
    this.graphics.lineBetween(centerX - 48, edgeInsetY, centerX - 18, edgeInsetY + arm);
    this.graphics.lineBetween(centerX + 48, edgeInsetY, centerX + 18, edgeInsetY + arm);
    this.graphics.lineBetween(centerX - 48, camera.height - edgeInsetY, centerX - 18, camera.height - edgeInsetY - arm);
    this.graphics.lineBetween(centerX + 48, camera.height - edgeInsetY, centerX + 18, camera.height - edgeInsetY - arm);
    this.graphics.fillStyle(accentColor, alpha * (0.46 + flowPulse * 0.12));
    this.graphics.fillTriangle(edgeInsetX - 2, centerY, edgeInsetX + 18, centerY - 12, edgeInsetX + 18, centerY + 12);
    this.graphics.fillTriangle(
      camera.width - edgeInsetX + 2,
      centerY,
      camera.width - edgeInsetX - 18,
      centerY - 12,
      camera.width - edgeInsetX - 18,
      centerY + 12,
    );
  }

  private renderPressurePatternOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
  ): void {
    if (!battle.pressurePatternMode || !battle.pressurePatternLabel) {
      return;
    }

    const flashAlpha = Math.min(0.16, 0.04 + battle.pressurePatternFlashSec * 0.2);
    const renderedSafeWindow = this.renderPressureSafeWindowOverlay(battle, camera, accentColor, flashAlpha);
    if (renderedSafeWindow && battle.pressureSafeWindowAxis !== 'pocket') {
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
        if (battle.pressureSafeWindowShiftType === 'centerReset') {
          this.graphics.lineStyle(2, accentColor, flashAlpha * 1.3);
          this.graphics.strokeCircle(this.scale.width * 0.5, this.scale.height * 0.5, 66);
          this.graphics.strokeCircle(this.scale.width * 0.5, this.scale.height * 0.5, 102);
        }
        if (battle.pressureSafeWindowShiftType === 'edgeBounce') {
          this.graphics.lineStyle(2, accentColor, flashAlpha * 1.25);
          this.graphics.lineBetween(72, 138, 120, 138);
          this.graphics.lineBetween(72, this.scale.height - 138, 120, this.scale.height - 138);
          this.graphics.lineBetween(this.scale.width - 72, 138, this.scale.width - 120, 138);
          this.graphics.lineBetween(this.scale.width - 72, this.scale.height - 138, this.scale.width - 120, this.scale.height - 138);
        }
        return;
      default:
        return;
    }
  }

  private renderPressureSafeWindowOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
    flashAlpha: number,
  ): boolean {
    if (
      !battle.pressureSafeWindowAxis ||
      battle.pressureSafeWindowSec <= 0 ||
      battle.pressureSafeWindowSpan <= 0
    ) {
      return false;
    }

    const topInset = 22;
    const bottomInset = 20;
    const leftInset = 20;
    const rightInset = 20;
    const contentWidth = camera.width - leftInset - rightInset;
    const contentHeight = camera.height - topInset - bottomInset;
    const safeWindowAlpha = Math.min(0.18, 0.05 + battle.pressureSafeWindowSec * 0.08 + flashAlpha * 0.7);
    const dangerAlpha = Math.min(0.16, 0.05 + battle.pressureSafeWindowSec * 0.06 + flashAlpha * 0.95);
    const safeTint = SAFE_WINDOW_TINT;
    const dangerTint = SAFE_WINDOW_DANGER;

    if (battle.pressureSafeWindowAxis === 'pocket') {
      if (battle.pressureSafeWindowSecondarySpan <= 0) {
        return false;
      }

      const safeStartX = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeEndX = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeStartY = Phaser.Math.Clamp(
        battle.pressureSafeWindowSecondaryCenter - battle.pressureSafeWindowSecondarySpan * 0.5 - camera.top,
        topInset,
        camera.height - bottomInset,
      );
      const safeEndY = Phaser.Math.Clamp(
        battle.pressureSafeWindowSecondaryCenter + battle.pressureSafeWindowSecondarySpan * 0.5 - camera.top,
        topInset,
        camera.height - bottomInset,
      );
      const safeWidth = Math.max(28, safeEndX - safeStartX);
      const safeHeight = Math.max(24, safeEndY - safeStartY);

      if (safeStartY > topInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, topInset, contentWidth, safeStartY - topInset);
      }
      if (safeEndY < camera.height - bottomInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, safeEndY, contentWidth, camera.height - bottomInset - safeEndY);
      }
      if (safeStartX > leftInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha * 0.92);
        this.graphics.fillRect(leftInset, safeStartY, safeStartX - leftInset, safeHeight);
      }
      if (safeEndX < camera.width - rightInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha * 0.92);
        this.graphics.fillRect(safeEndX, safeStartY, camera.width - rightInset - safeEndX, safeHeight);
      }

      this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.58);
      this.graphics.fillRect(safeStartX, safeStartY, safeWidth, safeHeight);
      this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.36);
      this.graphics.strokeRect(safeStartX, safeStartY, safeWidth, safeHeight);
      this.renderSafeWindowBrackets(safeStartX, safeStartY, safeWidth, safeHeight, safeTint, accentColor, safeWindowAlpha, flashAlpha);
      this.graphics.lineStyle(2, accentColor, flashAlpha * 1.3);
      this.graphics.lineBetween(safeStartX, safeStartY, safeStartX, safeEndY);
      this.graphics.lineBetween(safeEndX, safeStartY, safeEndX, safeEndY);
      this.graphics.lineBetween(safeStartX, safeStartY, safeEndX, safeStartY);
      this.graphics.lineBetween(safeStartX, safeEndY, safeEndX, safeEndY);
      return true;
    }

    if (battle.pressureSafeWindowAxis === 'vertical') {
      const safeStart = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeEnd = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeWidth = Math.max(18, safeEnd - safeStart);

      if (safeStart > leftInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, topInset, safeStart - leftInset, contentHeight);
      }
      if (safeEnd < camera.width - rightInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(safeEnd, topInset, camera.width - rightInset - safeEnd, contentHeight);
      }

      this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
      this.graphics.fillRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
      this.graphics.strokeRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.renderSafeWindowBrackets(safeStart, topInset - 4, safeWidth, contentHeight + 8, safeTint, accentColor, safeWindowAlpha, flashAlpha);
      this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
      this.graphics.lineBetween(safeStart, topInset - 8, safeStart, camera.height - bottomInset + 8);
      this.graphics.lineBetween(safeEnd, topInset - 8, safeEnd, camera.height - bottomInset + 8);
      return true;
    }

    const safeStart = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.top,
      topInset,
      camera.height - bottomInset,
    );
    const safeEnd = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.top,
      topInset,
      camera.height - bottomInset,
    );
    const safeHeight = Math.max(18, safeEnd - safeStart);

    if (safeStart > topInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, topInset, contentWidth, safeStart - topInset);
    }
    if (safeEnd < camera.height - bottomInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, safeEnd, contentWidth, camera.height - bottomInset - safeEnd);
    }

    this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
    this.graphics.fillRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
    this.graphics.strokeRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.renderSafeWindowBrackets(leftInset - 4, safeStart, contentWidth + 8, safeHeight, safeTint, accentColor, safeWindowAlpha, flashAlpha);
    this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
    this.graphics.lineBetween(leftInset - 8, safeStart, camera.width - rightInset + 8, safeStart);
    this.graphics.lineBetween(leftInset - 8, safeEnd, camera.width - rightInset + 8, safeEnd);
    return true;
  }

  private renderSafeWindowBrackets(
    x: number,
    y: number,
    width: number,
    height: number,
    safeTint: number,
    accentColor: number,
    safeWindowAlpha: number,
    flashAlpha: number,
  ): void {
    const corner = Math.min(18, Math.max(10, Math.min(width, height) * 0.22));
    this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.18);
    this.graphics.lineBetween(x, y, x + corner, y);
    this.graphics.lineBetween(x, y, x, y + corner);
    this.graphics.lineBetween(x + width - corner, y, x + width, y);
    this.graphics.lineBetween(x + width, y, x + width, y + corner);
    this.graphics.lineBetween(x, y + height - corner, x, y + height);
    this.graphics.lineBetween(x, y + height, x + corner, y + height);
    this.graphics.lineBetween(x + width - corner, y + height, x + width, y + height);
    this.graphics.lineBetween(x + width, y + height - corner, x + width, y + height);
    this.graphics.lineStyle(1.2, accentColor, flashAlpha * 0.9 + safeWindowAlpha * 0.34);
    this.graphics.lineBetween(x + width * 0.5, y + 8, x + width * 0.5, y + Math.min(height - 8, 22));
    this.graphics.lineBetween(x + 8, y + height * 0.5, x + Math.min(width - 8, 22), y + height * 0.5);
    this.graphics.lineBetween(x + width - 8, y + height * 0.5, x + Math.max(8, width - 22), y + height * 0.5);
  }

  private getEnemyRecoveryRatio(enemy: BattleState['enemies'][number]): number {
    const recoveryWindow =
      enemy.elite
        ? 0.32
        : enemy.archetype === 'brute'
          ? 0.44
          : enemy.archetype === 'ranged'
            ? 0.42
            : enemy.archetype === 'skirmisher'
              ? 0.34
              : 0.24;
    return clamp(enemy.recoverySec / recoveryWindow, 0, 1);
  }

  private getEnemyPressureRatio(enemy: BattleState['enemies'][number]): number {
    const pressureWindow =
      enemy.elite
        ? 0.72
        : enemy.archetype === 'brute'
          ? 0.22
          : enemy.archetype === 'ranged'
            ? 0.2
            : enemy.archetype === 'skirmisher'
              ? 0.18
              : 0.16;
    return clamp(enemy.pressurePulseSec / pressureWindow, 0, 1);
  }

  private getEliteBreachProjectileSuppressionRatio(battle: BattleState): number {
    if (battle.encounterType !== 'battle' || !battle.eliteAlive) {
      return 0;
    }

    const crackRatio = clamp(battle.eliteCrackWindowSec / 0.82, 0, 1);
    if (crackRatio <= 0.08) {
      return 0;
    }

    const recoveryRatio = clamp(battle.playerRecoverySec / 0.26, 0, 1);
    const impactPenalty = clamp(battle.playerImpactSec / 0.34, 0, 1);
    return clamp(crackRatio * 0.76 + recoveryRatio * 0.24 - impactPenalty * 0.12, 0, 1);
  }

  private getEliteBreachProjectileCorridorRatio(
    battle: BattleState,
    projectile: BattleState['enemyProjectiles'][number],
  ): number {
    if (battle.encounterType !== 'battle' || !battle.eliteAlive) {
      return 0;
    }

    const elite = battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0) ?? null;
    if (!elite) {
      return 0;
    }

    const crackRatio = clamp(battle.eliteCrackWindowSec / 0.82, 0, 1);
    if (crackRatio <= 0.08) {
      return 0;
    }

    const playerDx = battle.playerX - elite.x;
    const playerDy = battle.playerY - elite.y;
    const playerDistance = Math.max(1, Math.hypot(playerDx, playerDy));
    const dirX = playerDx / playerDistance;
    const dirY = playerDy / playerDistance;
    const orthoX = -dirY;
    const orthoY = dirX;
    const relX = projectile.x - elite.x;
    const relY = projectile.y - elite.y;
    const projection = relX * dirX + relY * dirY;
    const corridorLength = Math.max(
      elite.radius + 20,
      Math.min(playerDistance - 10, elite.radius + 92 + crackRatio * 36 + battle.eliteCrackEscortCount * 8),
    );
    if (projection < elite.radius - 8 || projection > corridorLength) {
      return 0;
    }

    const lateral = Math.abs(relX * orthoX + relY * orthoY);
    const corridorWidth = elite.radius + 18 + crackRatio * 24 + battle.eliteCrackEscortCount * 5 + projectile.radius * 1.2;
    if (lateral > corridorWidth) {
      return 0;
    }

    const centerRatio = 1 - lateral / Math.max(1, corridorWidth);
    const depthRatio =
      1 -
      Math.min(
        1,
        Math.abs(projection - corridorLength * 0.54) / Math.max(16, corridorLength * 0.62),
      );
    return clamp(centerRatio * 0.74 + depthRatio * 0.26, 0, 1);
  }

  private getEnemyFillColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return ELITE_FILL;
    }

    const baseColor =
      enemy.role === 'escort'
        ? ENEMY_ESCORT_FILL
        : enemy.archetype === 'brute'
          ? 0xc7555c
          : enemy.archetype === 'skirmisher'
            ? 0xff5f95
            : enemy.archetype === 'ranged'
              ? 0xb878ff
              : 0xd94f7a;

    switch (enemy.archetype) {
      default:
        return baseColor;
    }
  }

  private getEnemyStrokeColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return ELITE_STROKE;
    }

    const baseColor =
      enemy.role === 'escort'
        ? ENEMY_ESCORT_STROKE
        : enemy.archetype === 'brute'
          ? 0xffd1bf
          : enemy.archetype === 'skirmisher'
            ? 0xffd5e3
            : enemy.archetype === 'ranged'
              ? 0xe7d7ff
              : 0xffb0c2;

    switch (enemy.archetype) {
      default:
        return baseColor;
    }
  }

  private mixColor(base: number, target: number, amount: number): number {
    const ratio = clamp(amount, 0, 1);
    const baseR = (base >> 16) & 0xff;
    const baseG = (base >> 8) & 0xff;
    const baseB = base & 0xff;
    const targetR = (target >> 16) & 0xff;
    const targetG = (target >> 8) & 0xff;
    const targetB = target & 0xff;

    const mixedR = Math.round(baseR + (targetR - baseR) * ratio);
    const mixedG = Math.round(baseG + (targetG - baseG) * ratio);
    const mixedB = Math.round(baseB + (targetB - baseB) * ratio);

    return (mixedR << 16) | (mixedG << 8) | mixedB;
  }

  // Route feedback floating text system
  private renderRouteFeedbackTexts(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
  ): void {
    const state = this.engine.getState();
    const dt = 1 / 60; // Assume 60fps for cooldown calculation

    // Update cooldowns
    this.critTextCooldownSec = Math.max(0, this.critTextCooldownSec - dt);
    this.pierceTextCooldownSec = Math.max(0, this.pierceTextCooldownSec - dt);
    this.dashTextCooldownSec = Math.max(0, this.dashTextCooldownSec - dt);

    // Crit feedback: show when crit overdrive is active and just started or periodically
    if (battle.critOverdriveSec > 0 && state.routeCounts.crit > 0 && this.critTextCooldownSec <= 0) {
      this.showFloatingText('暴击', camera, 0xffaa44);
      this.critTextCooldownSec = 0.45; // Cooldown to prevent spam
    }

    // Pierce feedback: show when pierce flow is active
    if (battle.pierceFlowSec > 0 && state.routeCounts.pierce > 0 && this.pierceTextCooldownSec <= 0) {
      const pierceCount = Math.min(battle.pierceFlowCount, 3);
      this.showFloatingText(`贯穿 ${pierceCount}`, camera, 0x44aaff);
      this.pierceTextCooldownSec = 0.55;
    }

    // Dash feedback: show when dash drive is active
    if (battle.dashDriveSec > 0 && state.routeCounts.dash > 0 && this.dashTextCooldownSec <= 0) {
      const dashCharge = Math.min(battle.dashCharge + 1, 3);
      this.showFloatingText(`脉冲 ${dashCharge}`, camera, 0x44ff88);
      this.dashTextCooldownSec = 0.5;
    }

    // Update and hide expired floating texts
    for (const text of this.floatingTexts) {
      if (text.visible) {
        const currentY = text.y;
        const currentAlpha = text.alpha;
        text.setY(currentY - 0.8);
        text.setAlpha(currentAlpha - 0.018);
        if (text.alpha <= 0) {
          text.setVisible(false);
        }
      }
    }
  }

  private showFloatingText(
    content: string,
    camera: { left: number; top: number; width: number; height: number },
    color: number,
  ): void {
    // Position text near player but not blocking center
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = -50 - Math.random() * 30;
    const x = camera.width * 0.5 + offsetX;
    const y = camera.height * 0.5 + offsetY;

    let text = this.floatingTexts[this.floatingTextCursor];
    if (!text) {
      text = this.add.text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      text.setDepth(100);
      this.floatingTexts.push(text);
    }

    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    text.setText(content);
    text.setColor(colorHex);
    text.setPosition(x, y);
    text.setAlpha(1);
    text.setVisible(true);
    text.setScale(1);

    this.floatingTextCursor = (this.floatingTextCursor + 1) % 8; // Max 8 concurrent texts
  }
}
