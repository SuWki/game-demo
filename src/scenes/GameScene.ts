import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH, clamp, getPlayerMoveSpeed } from '../data/balance';
import { getBattleEncounterLabel } from '../data/battleTemplates';
import { getPhaseLabel } from '../data/nodes';
import { ROUTE_COLOR_MAP } from '../data/routes';
import {
  mixColor as mixColorPure,
  worldToScreen as worldToScreenPure,
  isVisibleInCamera as isVisibleInCameraPure,
  getTerrainNoise as getTerrainNoisePure,
} from './renderHelpers';
import type {
  BattleDebugConfig,
  BattleDebugRuntimeConfig,
  BattleDebugSnapshot,
  BattleState,
  BattleTemplateDefinition,
  BattleTemplateId,
  DebugBattlePhaseId,
  OverlayHudSnapshot,
  PlayerStats,
  QaSmokeScenarioConfig,
  RunState,
  Services,
} from '../game/types';
import { RunEngine } from '../systems/RunEngine';
import { ParticleDirector } from './ParticleDirector';
import { HudComposer } from './HudComposer';
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
const TERRAIN_TILE_SIZE = 160;
const RUNTIME_VISUAL_PREVIEW_STORAGE_KEY = 'pilot-runtime-preview-assets';

// Preview texture keys
const PREVIEW_PLAYER_TEXTURE = 'preview-unit-player-core';
const PREVIEW_STANDARD_ENEMY_TEXTURE = 'preview-enemy-standard-a';
const PREVIEW_BRUTE_ENEMY_TEXTURE = 'preview-enemy-brute';
const PREVIEW_SKIRMISHER_ENEMY_TEXTURE = 'preview-enemy-skirmisher';
const PREVIEW_RANGED_ENEMY_TEXTURE = 'preview-enemy-ranged';
const PREVIEW_XP_ORB_TEXTURE = 'preview-fx-xp-orb';
const PREVIEW_BG_SPACE_NEBULA_TEXTURE = 'preview-bg-space-nebula';
const PREVIEW_BG_FLOOR_HEX_TEXTURE = 'preview-bg-floor-hex-tile';
const PREVIEW_BG_FLOOR_HOLO_TEXTURE = 'preview-bg-floor-holo-tile';
const PREVIEW_BG_DEBRIS_DECAL_TEXTURE = 'preview-bg-debris-decal';
const PREVIEW_BG_BOSS_DANGER_TEXTURE = 'preview-bg-boss-danger';
const PREVIEW_BG_BOSS_CORE_TEXTURE = 'preview-bg-boss-core';
const PREVIEW_ELITE_CORE_TEXTURE = 'preview-elite-core-main';
const PREVIEW_ELITE_CRACK_TEXTURE = 'preview-elite-core-crack';
const PREVIEW_ELITE_ESCORT_TEXTURE = 'preview-elite-escort-unit';
const PREVIEW_BOSS_BASTION_TEXTURE = 'preview-boss-bastion-main';
const PREVIEW_BOSS_HUNT_TEXTURE = 'preview-boss-hunt-main';
const PREVIEW_BOSS_LOCKDOWN_TEXTURE = 'preview-boss-lockdown-main';
const PREVIEW_PLAYER_PROJECTILE_TEXTURE = 'preview-player-projectile-core';
const PREVIEW_ENEMY_PROJECTILE_TEXTURE = 'preview-enemy-projectile-core';
const PREVIEW_BOSS_FIRELINE_TEXTURE = 'preview-fx-boss-bastion-fireline';
const PREVIEW_FX_HIT_NORMAL_TEXTURE = 'preview-fx-hit-normal';
const PREVIEW_FX_HIT_CRIT_TEXTURE = 'preview-fx-hit-crit';
const PREVIEW_FX_HIT_PIERCE_TEXTURE = 'preview-fx-hit-pierce';
const PREVIEW_FX_HIT_DASH_TEXTURE = 'preview-fx-hit-dash';
const PREVIEW_FX_EXPLOSION_SMALL_TEXTURE = 'preview-fx-explosion-small';
const PREVIEW_FX_CHARGE_GLOW_TEXTURE = 'preview-fx-charge-glow';

const TERRAIN_BLOT_SIZE = 384;

const DEBUG_SYNC_INTERVAL_MS = 120;

export class GameScene extends Phaser.Scene {
  private services!: Services;

  private engine!: RunEngine;

  private graphics!: Phaser.GameObjects.Graphics;

  private terrainGraphics!: Phaser.GameObjects.Graphics;

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

  private touchInput = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  };

  private joystickGraphics!: Phaser.GameObjects.Graphics;

  private resultHandled = false;

  private lastHudKey = '';

  private lastPanelKey = '';

  private lastPauseKey = '';

  private gamePaused = false;

  private debugSyncElapsedMs = DEBUG_SYNC_INTERVAL_MS;

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
    hideBossPressureOverlay: false, // 隐藏Boss压力遮罩
  };


  private lastTurnBurstSec = 0;

  private lastDashDriveSec = 0;

  private lastShotFlashSec = 0;

  private readonly enemyLabelTexts: Phaser.GameObjects.Text[] = [];

  private enemyLabelCursor = 0;

  private readonly damageNumberTexts: Phaser.GameObjects.Text[] = [];
  private lastDamageCount = 0; // Track last frame's damage count to detect new ones

  
  private killStreakText: Phaser.GameObjects.Text | null = null;

  private dyingEnemies: Array<{
    id: number;
    x: number;
    y: number;
    radius: number;
    elite: boolean;
    archetype: string;
    lifeSec: number;
    maxLifeSec: number;
  }> = [];

  private lastSeenEnemyHp: Map<number, number> = new Map();

  private particles!: ParticleDirector;
  private hud!: HudComposer;

  private bossSafeHintText!: Phaser.GameObjects.Text;

  private battleRewardTransitionText!: Phaser.GameObjects.Text;

  public constructor() {
    super('GameScene');
  }

  // ============================================================
  // 配置访问方法（通过 ConfigLoader）
  // ============================================================

  public create(): void {
    this.services = this.game.registry.get('services') as Services;
    this.services.audio.unlock();
    this.services.audio.setMusic('battle');
    this.engine = new RunEngine(this.services);
    this.engine.setDebugConfig(this.getRuntimeDebugConfig());
    this.hud = new HudComposer(this.engine, this.services.configLoader);
    this.runtimePreviewImages.length = 0;
    this.runtimePreviewImageCursor = 0;
    // Create the 'white-pixel' texture used by particle emitters.
    // Phaser shows a green placeholder rectangle for missing textures,
    // so this must be created before any particle effects are emitted.
    if (!this.textures.exists('white-pixel')) {
      const gfx = this.make.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(0, 0, 4, 4);
      gfx.generateTexture('white-pixel', 4, 4);
      gfx.destroy();
    }

    this.terrainGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(1);
    this.graphics = this.add.graphics();
    this.graphics.setDepth(10);
    this.particles = new ParticleDirector(this, this.graphics);
    this.bossSafeHintText = this.add.text(0, 0, '进入绿色安全区域', {
      fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
      fontSize: '17px',
      fontStyle: '700',
      color: '#e9fff7',
      stroke: '#08221c',
      strokeThickness: 3,
      shadow: {
        offsetX: 0,
        offsetY: 1,
        color: 'rgba(8, 24, 22, 0.38)',
        blur: 6,
        fill: true,
        stroke: false,
      },
    });
    this.bossSafeHintText
      .setOrigin(0.5, 0.5)
      .setDepth(95)
      .setVisible(false);
    this.battleRewardTransitionText = this.add.text(0, 0, '通关', {
      fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
      fontSize: '28px',
      fontStyle: '700',
      color: '#fff4c7',
      stroke: '#2d1a08',
      strokeThickness: 4,
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: 'rgba(20, 10, 4, 0.42)',
        blur: 8,
        fill: true,
        stroke: false,
      },
    });
    this.battleRewardTransitionText
      .setOrigin(0.5, 0.5)
      .setDepth(96)
      .setVisible(false);
    this.cameras.main.setZoom(1);
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

    // Mobile virtual joystick
    this.joystickGraphics = this.add.graphics();
    this.joystickGraphics.setDepth(100);
    this.joystickGraphics.setVisible(false);
    this.setupTouchInput();

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
          if (import.meta.env.DEV) console.log(`[QA] Auto-triggered forced boss battle: ${forcedBossTemplate}`);
        });
      }
    }

    const storedQaSmokeScenario = window.localStorage.getItem('pilot-qa-smoke-scenario');
    if (storedQaSmokeScenario) {
      window.localStorage.removeItem('pilot-qa-smoke-scenario');
      try {
        const config = JSON.parse(storedQaSmokeScenario) as QaSmokeScenarioConfig;
        this.time.delayedCall(320, () => {
          this.runQaSmokeScenario(config);
          if (import.meta.env.DEV) console.log(`[QA] Auto-triggered smoke scenario: ${storedQaSmokeScenario}`);
        });
      } catch {
        if (import.meta.env.DEV) console.warn(`[QA] Invalid smoke scenario payload: ${storedQaSmokeScenario}`);
      }
    }
  }

  public update(_: number, delta: number): void {
    const touchDir = this.getTouchDirection();
    this.engine.setInputState({
      up: this.moveKeys.up.isDown || this.arrowKeys.up.isDown || touchDir.up,
      down: this.moveKeys.down.isDown || this.arrowKeys.down.isDown || touchDir.down,
      left: this.moveKeys.left.isDown || this.arrowKeys.left.isDown || touchDir.left,
      right: this.moveKeys.right.isDown || this.arrowKeys.right.isDown || touchDir.right,
    });
    // 限制单帧最大 delta，防止首帧或切后台后回归时一次性模拟过长时间导致卡顿
    const clampedDelta = Math.min(delta, 100);
    const scaledDelta = this.isSimulationPaused() ? 0 : clampedDelta * this.debugConfig.timeScale;
    if (scaledDelta > 0) {
      this.engine.tick(scaledDelta);
    }
    const state = this.engine.getState();
    this.syncAudioState(state);
    this.processAnnouncements();
    this.syncOverlay();

    // Boss 战结束过渡画面 / 关卡结束过渡
    if (state.status === 'bossEnding' && state.bossEnding) {
      this.renderBossEnding(state.bossEnding);
    } else if (state.status === 'battleRewardTransition' && state.battleRewardTransition) {
      this.renderBattleRewardTransition(state.battleRewardTransition);
    } else if (state.status === 'phaseTransition' && state.phaseTransition) {
      this.renderPhaseTransition(state.phaseTransition);
    } else {
      this.renderBattle();
    }

    this.syncDebugPanel();
    if (!this.resultHandled && state.status === 'result' && state.result) {
      this.resultHandled = true;
      this.services.meta.recordRun(state.result);
      this.cameras.main.fadeOut(280, 6, 12, 18);
      this.time.delayedCall(300, () => {
        this.scene.start('ResultScene', {
          result: state.result,
        });
      });
    }
  }

  public getDebugConfig(): BattleDebugConfig {
    return { ...this.debugConfig };
  }

  public updateDebugConfig(patch: Partial<BattleDebugConfig>): void {
    Object.assign(this.debugConfig, patch);
    if (patch.templateId && this.services.configLoader.getBattleTemplate(patch.templateId).encounterType === 'boss') {
      this.debugConfig.phase = 'finalBattle';
    }
    this.debugConfig.timeScale = Phaser.Math.Clamp(this.debugConfig.timeScale, 0.1, 2);
    this.services.debugPanel.setVisible(this.debugConfig.panelOpen);
    this.engine.setDebugConfig(this.getRuntimeDebugConfig());
    this.syncDebugPanel(true);
  }

  public restartDebugBattle(templateId: BattleDebugConfig['templateId'], phase: DebugBattlePhaseId): void {
    const normalizedPhase = this.services.configLoader.getBattleTemplate(templateId).encounterType === 'boss' ? 'finalBattle' : phase;
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

  public runQaSmokeScenario(config: QaSmokeScenarioConfig): void {
    this.resultHandled = false;
    this.gamePaused = false;
    this.lastHudKey = '';
    this.lastPanelKey = '';
    this.lastPauseKey = '';
    this.engine.configureQaSmokeScenario(config);
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
        dashCounterWindowSec: 0,
        eliteCrackSeen: false,
        eliteCrackFollowThroughMoments: 0,
        bossFirelineCoverage: 0,
        bossSafeWindowMoments: 0,
        bossSafeWindowGraceSec: 0,
        outsideSafeDamageTimerSec: 0,
        outsideSafeDamageTickCount: 0,
        insideSafeProjectileClears: 0,
        killPickupContinueMoments: 0,
        enemies: [],
        enemyProjectiles: [],
        safeZone: null,
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
      dashCounterWindowSec: battle.dashCounterWindowSec,
      eliteCrackSeen: battle.eliteCrackSeen,
      eliteCrackFollowThroughMoments: battle.eliteCrackFollowThroughMoments,
      bossFirelineCoverage: battle.bossFirelineCoverage,
      bossSafeWindowMoments: battle.bossSafeWindowMoments,
      bossSafeWindowGraceSec: battle.bossSafeWindowGraceSec,
      outsideSafeDamageTimerSec: battle.outsideSafeDamageTimerSec ?? 0,
      outsideSafeDamageTickCount: battle.outsideSafeDamageTickCount ?? 0,
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
      safeZone: battle.safeZone
        ? {
            active: true,
            phase: battle.safeZone.phase,
            centerX: battle.safeZone.centerX,
            centerY: battle.safeZone.centerY,
            halfWidth: battle.safeZone.halfWidth,
            halfHeight: battle.safeZone.halfHeight,
            timer: battle.safeZone.timer,
            cycleCount: battle.safeZone.cycleCount,
          }
        : null,
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

  // ========== Mobile virtual joystick ==========
  private setupTouchInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left half of screen = movement joystick
      if (pointer.x < this.cameras.main.width * 0.45) {
        this.touchInput.active = true;
        this.touchInput.startX = pointer.x;
        this.touchInput.startY = pointer.y;
        this.touchInput.currentX = pointer.x;
        this.touchInput.currentY = pointer.y;
        this.joystickGraphics.setVisible(true);
        this.drawJoystick();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.touchInput.active && pointer.isDown) {
        this.touchInput.currentX = pointer.x;
        this.touchInput.currentY = pointer.y;
        this.drawJoystick();
      }
    });

    this.input.on('pointerup', () => {
      this.touchInput.active = false;
      this.joystickGraphics.setVisible(false);
      this.joystickGraphics.clear();
    });
  }

  private getTouchDirection(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    if (!this.touchInput.active) {
      return { up: false, down: false, left: false, right: false };
    }
    const dx = this.touchInput.currentX - this.touchInput.startX;
    const dy = this.touchInput.currentY - this.touchInput.startY;
    const deadzone = 12;
    return {
      up: dy < -deadzone,
      down: dy > deadzone,
      left: dx < -deadzone,
      right: dx > deadzone,
    };
  }

  private drawJoystick(): void {
    const g = this.joystickGraphics;
    g.clear();

    const maxRadius = 50;
    const dx = this.touchInput.currentX - this.touchInput.startX;
    const dy = this.touchInput.currentY - this.touchInput.startY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = this.touchInput.startX + Math.cos(angle) * clampedDist;
    const knobY = this.touchInput.startY + Math.sin(angle) * clampedDist;

    // Base ring
    g.lineStyle(2, 0x73d8ff, 0.25);
    g.strokeCircle(this.touchInput.startX, this.touchInput.startY, maxRadius);
    g.fillStyle(0x73d8ff, 0.06);
    g.fillCircle(this.touchInput.startX, this.touchInput.startY, maxRadius);

    // Knob
    g.lineStyle(2, 0x73d8ff, 0.55);
    g.fillStyle(0x73d8ff, 0.35);
    g.fillCircle(knobX, knobY, 16);
    g.strokeCircle(knobX, knobY, 16);
  }

  private handleSceneShutdown(): void {
    this.input.keyboard?.off('keydown-F3', this.handleDebugPanelToggle, this);
    this.input.keyboard?.off('keydown-F4', this.handleDebugPauseToggle, this);
    this.input.keyboard?.off('keydown-ESC', this.handlePauseToggle, this);
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.runtimePreviewImages.length = 0;
    this.runtimePreviewImageCursor = 0;
    this.services.debugPanel.unbind();
    this.cleanupAllParticles();
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
    return this.services.configLoader.getBattleTemplates().map((template) => ({
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

  private buildHudFingerprint(snap: OverlayHudSnapshot): string {
    // 只拼接高频变化的原始字段，跳过数组/嵌套对象的完整序列化
    const rp = snap.routeProgress.map((r) => `${r.routeId}${r.value}${r.active ? 1 : 0}`).join(',');
    const rr = snap.routeResources.map((r) => `${r.routeId}${r.stacks}${r.finisherReady ? 1 : 0}${Math.round(r.windowSec * 100)}`).join(',');
    const ss = snap.statSummary.map((s) => s.label + s.value).join(',');
    const pt = snap.phaseTrack.map((p) => p.label + p.state).join(',');
    return [
      snap.phaseLabel, snap.nodeLabel, snap.hpText, snap.hpRatio.toFixed(3),
      snap.levelText, snap.experienceText, snap.experienceRatio.toFixed(3),
      snap.routeStatusText, snap.statusText, snap.statusSubtext ?? '',
      snap.progressLabel, snap.progressDetail,
      snap.objectiveLabel, snap.objectiveText, snap.objectiveDetail,
      snap.objectiveProgressText, snap.objectiveTone,
      rp, rr, ss, pt,
    ].join('|');
  }

  private syncOverlay(): void {
    const state = this.engine.getState();
    if (state.status === 'bossEnding' && state.bossEnding) {
      const panelKey = `bossEnding:${state.bossEnding.outcome}:${state.bossEnding.label}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.overlay.showBossEnding(state.bossEnding);
        this.lastPanelKey = panelKey;
      }
      return;
    }

    const hudSnapshot = this.hud.createHudSnapshot();
    // 用轻量指纹代替 JSON.stringify，避免每帧序列化大对象
    const hudKey = this.buildHudFingerprint(hudSnapshot);
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
              this.cameras.main.fadeOut(180, 4, 10, 16);
              this.time.delayedCall(200, () => {
                this.scene.start('GameScene');
              });
            },
            onVolume: () => {
              this.services.audio.play('click');
              this.services.overlay.showVolumePanel(
                '音量调整',
                '当前音量大小',
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
          this.hud.getPanelProgressSnapshot(),
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
              ? '最终强化'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
          this.hud.getUpgradePanelDescription(),
          this.hud.getPanelProgressSnapshot(),
          state.upgradeChoices,
          (upgradeId) => {
            this.services.audio.play('upgrade');
            this.services.audio.play('confirm');
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
        this.services.overlay.showEventPanel(state.currentEvent, this.hud.getPanelProgressSnapshot(), (optionId) => {
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
          : state.status === 'battle' && battle && this.services.configLoader.getBattleTemplate(battle.templateId).winCondition.type === 'survive'
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

  // NOTE: HUD 快照构建已迁移到 HudComposer（createHudSnapshot / getPanelProgressSnapshot /
  //       getUpgradePanelDescription / getRouteStatusText / getObjectiveSnapshot 等方法）。
  //       GameScene 通过 this.hud.* 调用，不再保留实现副本。

  private renderBossEnding(bossEnding: NonNullable<RunState['bossEnding']>): void {
    this.battleRewardTransitionText.setVisible(false);
    const { outcome, label, elapsedSec, durationSec } = bossEnding;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const fadeRatio = Math.min(1, elapsedSec / 0.18);
    const pulseRatio = Math.min(1, elapsedSec / durationSec);
    const resultColor = outcome === 'victory' ? 0xffd774 : 0xff6b6b;
    const battle = this.engine.getState().battle;

    this.renderBattle();

    this.graphics.fillStyle(0x070504, 0.24 + fadeRatio * 0.18);
    this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    this.graphics.fillStyle(resultColor, 0.12 + fadeRatio * 0.06);
    this.graphics.fillRect(0, 0, this.scale.width, 12);
    this.graphics.fillRect(0, this.scale.height - 12, this.scale.width, 12);

    const ringRadius = 92 + pulseRatio * 18;
    this.graphics.lineStyle(3, resultColor, 0.7 * fadeRatio);
    this.graphics.strokeCircle(centerX, centerY, ringRadius);
    this.graphics.lineStyle(1.5, resultColor, 0.42 * fadeRatio);
    for (let i = 0; i < 4; i++) {
      const angle = elapsedSec * 0.6 + (i * Math.PI) / 2;
      const x1 = centerX + Math.cos(angle) * (ringRadius + 8);
      const y1 = centerY + Math.sin(angle) * (ringRadius + 8);
      const x2 = centerX + Math.cos(angle) * (ringRadius + 28);
      const y2 = centerY + Math.sin(angle) * (ringRadius + 28);
      this.graphics.lineBetween(x1, y1, x2, y2);
    }

    this.graphics.fillStyle(resultColor, 0.08 + fadeRatio * 0.12);
    this.graphics.fillCircle(centerX, centerY, 54 + pulseRatio * 18);
    if (battle?.encounterType === 'boss') {
      const bossScreen = this.worldToScreen(this.getBattleCameraRect(battle), battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0)?.x ?? battle.playerX, battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0)?.y ?? battle.playerY);
      this.graphics.lineStyle(4, resultColor, 0.24 + fadeRatio * 0.18);
      this.graphics.strokeCircle(bossScreen.x, bossScreen.y, 74 + pulseRatio * 18);
      this.graphics.lineStyle(2, resultColor, 0.2 + fadeRatio * 0.12);
      this.graphics.lineBetween(bossScreen.x - 88, bossScreen.y, bossScreen.x - 48, bossScreen.y);
      this.graphics.lineBetween(bossScreen.x + 48, bossScreen.y, bossScreen.x + 88, bossScreen.y);
      this.graphics.lineBetween(bossScreen.x, bossScreen.y - 88, bossScreen.x, bossScreen.y - 48);
      this.graphics.lineBetween(bossScreen.x, bossScreen.y + 48, bossScreen.x, bossScreen.y + 88);
    }
  }

  private renderPhaseTransition(phaseTransition: NonNullable<RunState['phaseTransition']>): void {
    this.battleRewardTransitionText.setVisible(false);
    const { elapsedSec, durationSec } = phaseTransition;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const fadeInRatio = Math.min(1, elapsedSec / 0.14);
    const progressRatio = Math.min(1, elapsedSec / durationSec);
    const fadeOutRatio = Math.max(0, (elapsedSec - Math.max(0, durationSec - 0.2)) / 0.2);
    const resultColor = 0xffd774;

    this.renderBattle();

    this.graphics.fillStyle(0x070504, 0.14 + fadeInRatio * 0.12);
    this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    this.graphics.lineStyle(1.6, resultColor, 0.4 * fadeInRatio * (1 - fadeOutRatio));
    this.graphics.strokeCircle(centerX, centerY, 56 + progressRatio * 12);
    this.graphics.fillStyle(resultColor, 0.08 + fadeInRatio * 0.08);
    this.graphics.fillCircle(centerX, centerY, 28 + progressRatio * 10);

    const barWidth = 160;
    const barHeight = 3;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 72;
    this.graphics.fillStyle(resultColor, 0.34 * fadeInRatio);
    this.graphics.fillRect(barX, barY, barWidth * (1 - progressRatio), barHeight);
    this.graphics.fillStyle(0xffffff, 0.08 * (1 - fadeOutRatio));
    this.graphics.fillRect(barX, barY + 5, barWidth, 1.5);
  }

  private renderBattleRewardTransition(battleRewardTransition: NonNullable<RunState['battleRewardTransition']>): void {
    const { elapsedSec, durationSec } = battleRewardTransition;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const fadeRatio = Math.min(1, elapsedSec / 0.12);
    const pulseRatio = Math.min(1, elapsedSec / durationSec);
    const fadeOutRatio = Math.max(0, (elapsedSec - Math.max(0, durationSec - 0.18)) / 0.18);
    const resultColor = 0xffd774;

    this.renderBattle();

    this.graphics.fillStyle(0x050404, 0.18 + fadeRatio * 0.12);
    this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    this.graphics.fillStyle(resultColor, 0.14 * fadeRatio * (1 - fadeOutRatio));
    this.graphics.fillRect(0, centerY - 42, this.scale.width, 84);
    this.graphics.lineStyle(2.4, resultColor, 0.5 * fadeRatio * (1 - fadeOutRatio));
    this.graphics.strokeRect(24, centerY - 38, this.scale.width - 48, 76);

    const ringRadius = 46 + pulseRatio * 16;
    this.graphics.lineStyle(2.2, resultColor, 0.56 * fadeRatio * (1 - fadeOutRatio));
    this.graphics.strokeCircle(centerX, centerY, ringRadius);
    this.graphics.lineStyle(1.2, resultColor, 0.3 * fadeRatio * (1 - fadeOutRatio));
    this.graphics.strokeCircle(centerX, centerY, ringRadius + 18);
    this.graphics.fillStyle(resultColor, 0.12 * fadeRatio * (1 - fadeOutRatio));
    this.graphics.fillCircle(centerX, centerY, 20 + pulseRatio * 10);

    const barWidth = 220;
    const barHeight = 3;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 56;
    this.graphics.fillStyle(resultColor, 0.36 * fadeRatio);
    this.graphics.fillRect(barX, barY, barWidth * (1 - pulseRatio), barHeight);
    this.graphics.fillStyle(0xffffff, 0.1 * (1 - fadeOutRatio));
    this.graphics.fillRect(barX, barY + 5, barWidth, 1.5);
    this.battleRewardTransitionText
      .setPosition(centerX, centerY)
      .setAlpha(0.74 + fadeRatio * 0.26 - fadeOutRatio * 0.18)
      .setScale(0.94 + pulseRatio * 0.08)
      .setVisible(true);
  }

  private renderBattle(): void {
    this.battleRewardTransitionText.setVisible(false);
    const dominantRoute = this.engine.getDominantRoute();
    const accentColor = dominantRoute ? parseInt(ROUTE_COLOR_MAP[dominantRoute].slice(1), 16) : 0x61d7ff;
    const battle = this.engine.getState().battle;

    this.terrainGraphics.clear();
    this.graphics.clear();
    this.beginRuntimePreviewImageFrame();
    this.beginEnemyLabelFrame();
    if (!battle) {
      this.bossSafeHintText.setVisible(false);
      this.graphics.fillGradientStyle(0x13100d, 0x13100d, 0x070706, 0x050505, 1);
      this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
      this.endRuntimePreviewImageFrame();
      this.endEnemyLabelFrame();
      return;
    }

    const camera = this.getBattleCameraRect(battle);
    this.renderBattleTerrain(battle, camera, accentColor);
    this.renderLowHealthWarning(battle, camera);
    this.renderBattleEntities(battle, camera, accentColor);
    this.renderEliteBossLabels(battle, camera);
    this.renderRouteAura(battle, camera);
    this.renderDamageNumbers(battle, camera);
    this.renderDyingEnemies(battle, camera);
    this.renderCritFlashRings();
    this.renderUpgradeFlash();
    this.renderBossSafeWindowHint(battle);
    this.renderRouteMomentOverlay(battle);
    this.renderSafeZone(battle, camera);
    this.renderSafeZoneHints(battle);
    this.endRuntimePreviewImageFrame();
    this.endEnemyLabelFrame();
  }

  private beginEnemyLabelFrame(): void {
    this.enemyLabelCursor = 0;
  }

  private endEnemyLabelFrame(): void {
    for (let index = this.enemyLabelCursor; index < this.enemyLabelTexts.length; index += 1) {
      this.enemyLabelTexts[index].setVisible(false);
    }
  }

  // ========== Particle System ==========
  // NOTE: 实现已迁移到 ParticleDirector，下面方法保留为薄委托，
  //       以便逐步替换调用点；后续可全部改为直接调用 this.particles.*。

  private createParticleEmitter(
    x: number,
    y: number,
    config: {
      color: number;
      count: number;
      speed: number;
      lifespan: number;
      scale: number;
      alpha?: number;
      blendMode?: Phaser.BlendModes;
    },
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.particles.createEmitter(x, y, config);
  }

  private emitParticles(
    x: number,
    y: number,
    config: {
      color: number;
      count: number;
      speed: number;
      lifespan: number;
      scale: number;
      alpha?: number;
      blendMode?: Phaser.BlendModes;
    },
  ): void {
    this.particles.emitParticles(x, y, config);
  }

  private cleanupAllParticles(): void {
    this.particles.cleanupAll();
  }

  // ========== Specialized Particle Effects ==========

  /** Bullet hit spark effect */
  private emitHitSpark(x: number, y: number, isCrit: boolean): void {
    this.particles.emitHitSpark(x, y, isCrit);
  }

  /** Critical hit burst effect */
  private emitCritBurst(x: number, y: number): void {
    this.particles.emitCritBurst(x, y);
  }

  /** Crit radial flash ring — draws an expanding golden ring at the impact point */
  private emitCritFlashRing(x: number, y: number, maxLifeSec: number = 0.3): void {
    this.particles.emitCritFlashRing(x, y, maxLifeSec);
  }

  private renderCritFlashRings(): void {
    this.particles.renderCritFlashRings();
  }

  /** Pierce ripple effect */
  private emitPierceRipple(x: number, y: number): void {
    this.particles.emitPierceRipple(x, y);
  }

  /** Dash trail effect */
  private emitDashTrail(x: number, y: number): void {
    this.particles.emitDashTrail(x, y);
  }

  private renderBossSafeWindowHint(battle: BattleState): void {
    // 安全区提示已移除
    this.bossSafeHintText.setVisible(false);
    void battle;
  }

  private renderRouteMomentOverlay(battle: BattleState): void {
    const state = this.engine.getState();
    void battle;
    void state;
  }

  // ========== 安全区渲染 ==========

  private safeZoneText: Phaser.GameObjects.Text | null = null;
  private safeZoneHintText: Phaser.GameObjects.Text | null = null;

  private renderSafeZone(
    battle: BattleState,
    camera: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  ): void {
    const sz = battle.safeZone;
    if (!sz) return;

    const screen = this.worldToScreen(camera, sz.centerX, sz.centerY);
    const w = sz.halfWidth * 2;
    const h = sz.halfHeight * 2;
    const x = screen.x - sz.halfWidth;
    const y = screen.y - sz.halfHeight;

    if (sz.phase === 'warning') {
      // 预警阶段：安全区蓝色 + 区外红色闪烁
      const warningRatio = sz.timer / sz.warningDuration;
      const pulse = 0.5 + 0.5 * Math.sin(battle.elapsedSec * 12);

      // 安全区蓝色半透明矩形
      this.graphics.fillStyle(0x2a7fff, 0.08 + warningRatio * 0.06);
      this.graphics.fillRect(x, y, w, h);

      // 边缘呼吸光效
      const edgeAlpha = 0.4 + pulse * 0.3;
      this.graphics.lineStyle(2.5, 0x4a9fff, edgeAlpha);
      this.graphics.strokeRect(x, y, w, h);

      // 内层细线
      this.graphics.lineStyle(1, 0x6abfff, edgeAlpha * 0.5);
      this.graphics.strokeRect(x + 4, y + 4, w - 8, h - 8);

      // 中心十字标记
      this.graphics.lineStyle(1.5, 0x4a9fff, 0.3 + pulse * 0.2);
      this.graphics.lineBetween(screen.x - 8, screen.y, screen.x + 8, screen.y);
      this.graphics.lineBetween(screen.x, screen.y - 8, screen.x, screen.y + 8);

      // 区外红色预警闪烁
      const redAlpha = 0.06 + pulse * 0.08;
      this.graphics.fillStyle(0xff2222, redAlpha);
      // 上方
      this.graphics.fillRect(0, 0, this.scale.width, Math.max(0, y));
      // 下方
      this.graphics.fillRect(0, y + h, this.scale.width, Math.max(0, this.scale.height - y - h));
      // 左方
      this.graphics.fillRect(0, y, Math.max(0, x), h);
      // 右方
      this.graphics.fillRect(x + w, y, Math.max(0, this.scale.width - x - w), h);

      // 引导线（玩家不在区内时）
      const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
      const dx = screen.x - playerScreen.x;
      const dy = screen.y - playerScreen.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 60) {
        this.graphics.lineStyle(1.5, 0x4a9fff, 0.15 + pulse * 0.1);
        const dashLen = 8;
        const gapLen = 6;
        const steps = Math.floor(dist / (dashLen + gapLen));
        for (let i = 0; i < steps; i++) {
          const t1 = (i * (dashLen + gapLen)) / dist;
          const t2 = (i * (dashLen + gapLen) + dashLen) / dist;
          this.graphics.lineBetween(
            playerScreen.x + dx * t1,
            playerScreen.y + dy * t1,
            playerScreen.x + dx * t2,
            playerScreen.y + dy * t2,
          );
        }
      }
    } else if (sz.phase === 'active') {
      // 存续阶段：稳定蓝色显示
      const activeRatio = sz.timer / sz.activeDuration;
      this.graphics.fillStyle(0x2a7fff, 0.06 + activeRatio * 0.04);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(2, 0x4a9fff, 0.25 + activeRatio * 0.15);
      this.graphics.strokeRect(x, y, w, h);
    } else {
      // 过渡阶段：淡出
      const transRatio = sz.timer / sz.transitionDuration;
      this.graphics.fillStyle(0x2a7fff, 0.04 * transRatio);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(1.5, 0x4a9fff, 0.2 * transRatio);
      this.graphics.strokeRect(x, y, w, h);
    }
  }

  private renderSafeZoneHints(battle: BattleState): void {
    // 战前提示横幅
    if (battle.safeZoneHintSec > 0) {
      if (!this.safeZoneHintText) {
        this.safeZoneHintText = this.add.text(0, 0, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          fontStyle: '700',
          color: '#4a9fff',
          backgroundColor: 'rgba(8, 16, 28, 0.8)',
          padding: { left: 16, right: 16, top: 6, bottom: 6 },
        });
        this.safeZoneHintText.setOrigin(0.5, 0.5);
        this.safeZoneHintText.setDepth(200);
      }
      const alpha = Math.min(1, battle.safeZoneHintSec / 0.5);
      this.safeZoneHintText
        .setText('战斗中会出现安全区（蓝色区域），区外将受到覆盖攻击伤害')
        .setPosition(this.scale.width * 0.5, this.scale.height * 0.18)
        .setAlpha(alpha)
        .setVisible(true);
    } else if (this.safeZoneHintText) {
      this.safeZoneHintText.setVisible(false);
    }

    // 教学文字
    if (battle.safeZoneTutorialSec > 0 && battle.safeZoneTutorialText) {
      if (!this.safeZoneText) {
        this.safeZoneText = this.add.text(0, 0, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: '700',
          color: '#6abfff',
          backgroundColor: 'rgba(8, 16, 28, 0.72)',
          padding: { left: 10, right: 10, top: 4, bottom: 4 },
        });
        this.safeZoneText.setOrigin(0.5, 0.5);
        this.safeZoneText.setDepth(200);
      }
      const sz = battle.safeZone;
      const camera = this.getBattleCameraRect(battle);
      const tx = sz ? this.worldToScreen(camera, sz.centerX, sz.centerY).x : this.scale.width * 0.5;
      const ty = sz ? this.worldToScreen(camera, sz.centerX, sz.centerY).y - sz.halfHeight - 20 : this.scale.height * 0.3;
      const alpha = Math.min(1, battle.safeZoneTutorialSec / 0.5);
      this.safeZoneText
        .setText(battle.safeZoneTutorialText)
        .setPosition(tx, ty)
        .setAlpha(alpha)
        .setVisible(true);
    } else if (this.safeZoneText) {
      this.safeZoneText.setVisible(false);
    }
  }

  private renderEliteBossLabels(
    battle: BattleState,
    camera: { left: number; top: number },
  ): void {
    for (const enemy of battle.enemies) {
      if (!enemy.elite || enemy.hp <= 0) {
        continue;
      }
      const screen = this.worldToScreen(camera, enemy.x, enemy.y);
      const label = battle.encounterType === 'boss' ? 'Boss' : '精英';
      const tone = battle.encounterType === 'boss' ? '#ffd774' : '#ffdd7d';
      const text = this.getEnemyLabelText(battle.encounterType === 'boss');
      text
        .setText(label)
        .setPosition(screen.x, screen.y - enemy.radius - (battle.encounterType === 'boss' ? 39 : 23))
        .setColor(tone);
      if (battle.encounterType === 'boss') {
        text.setFontSize(13);
      } else {
        text.setFontSize(11);
      }
      text.setVisible(true);
    }
  }

  private getEnemyLabelText(isBoss: boolean): Phaser.GameObjects.Text {
    let text = this.enemyLabelTexts[this.enemyLabelCursor];
    if (!text) {
      text = this.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: isBoss ? '13px' : '11px',
        fontStyle: '700',
        color: isBoss ? '#ffd774' : '#ffdd7d',
        backgroundColor: 'rgba(12, 18, 22, 0.72)',
        padding: { left: 5, right: 5, top: 1, bottom: 1 },
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(90);
      this.enemyLabelTexts.push(text);
    }
    this.enemyLabelCursor += 1;
    return text;
  }

  private renderRouteAura(
    battle: BattleState,
    camera: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
    },
  ): void {
    // 玩家周围常驻路线线条已取消；路线反馈改到敌人受击特效上。
    void battle;
    void camera;
  }

  private renderDamageNumbers(
    battle: BattleState,
    camera: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  ): void {
    const dnCount = battle.damageNumbers.length;
    for (let i = 0; i < dnCount; i += 1) {
      const dn = battle.damageNumbers[i];
      const screen = this.worldToScreen(camera, dn.x, dn.y);
      const lifeRatio = Phaser.Math.Clamp(dn.lifeSec / dn.maxLifeSec, 0, 1);
      const isCrit = dn.kind === 'crit';
      const isDash = dn.kind === 'dash';
      const isPierce = dn.kind === 'pierce';

      let text = this.damageNumberTexts[i];
      if (!text) {
        // New damage number - trigger particle effect
        if (isCrit) {
          this.emitCritBurst(screen.x, screen.y);
        } else if (isPierce) {
          this.emitPierceRipple(screen.x, screen.y);
        } else if (isDash) {
          this.emitDashTrail(screen.x, screen.y);
        } else {
          this.emitHitSpark(screen.x, screen.y, false);
        }
        
        text = this.add.text(0, 0, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: '900',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        });
        text.setOrigin(0.5, 0.5);
        text.setDepth(100);
        this.damageNumberTexts.push(text);
      }

      const fontSize = isCrit ? 18 + (1 - lifeRatio) * 2 : isDash ? 15 : isPierce ? 14 : 13;
      const color = isCrit ? '#ffd700' : isDash ? '#7aff7a' : isPierce ? '#a8d8ff' : '#ffffff';
      const alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      const scale = isCrit && lifeRatio > 0.8 ? 1 + (1 - lifeRatio) * 2 : 1;

      text.setText(String(dn.value));
      text.setFontSize(fontSize);
      text.setColor(color);
      text.setAlpha(alpha);
      text.setScale(scale);
      text.setPosition(screen.x, screen.y);
      text.setVisible(true);
    }
    for (let i = dnCount; i < this.damageNumberTexts.length; i += 1) {
      this.damageNumberTexts[i].setVisible(false);
    }
    this.lastDamageCount = dnCount;
  }

  private renderDyingEnemies(
    battle: BattleState,
    camera: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  ): void {
    // Track newly dead enemies
    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0) {
        const prevHp = this.lastSeenEnemyHp.get(enemy.id);
        if (prevHp === undefined || prevHp > 0) {
          // Just died - add to dying animation list
          const deathDuration = enemy.elite ? 0.5 : 0.22;
          this.dyingEnemies.push({
            id: enemy.id,
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius,
            elite: enemy.elite,
            archetype: enemy.archetype,
            lifeSec: deathDuration,
            maxLifeSec: deathDuration,
          });
        }
      }
      this.lastSeenEnemyHp.set(enemy.id, enemy.hp);
    }

    // Render dying enemies
    for (const dying of this.dyingEnemies) {
      const screen = this.worldToScreen(camera, dying.x, dying.y);
      const lifeRatio = Phaser.Math.Clamp(dying.lifeSec / dying.maxLifeSec, 0, 1);
      const alpha = lifeRatio;
      const scale = dying.elite
        ? 1 + (1 - lifeRatio) * 0.3 // Elite: expand slightly
        : 1 - (1 - lifeRatio) * 0.5; // Regular: shrink

      const renderRadius = dying.radius * scale;

      // Flash white
      const flashColor = dying.elite ? 0xffffff : 0xffe8cc;
      this.graphics.fillStyle(flashColor, alpha * 0.6);
      this.graphics.fillCircle(screen.x, screen.y, renderRadius * 1.2);

      // Core body
      const bodyColor = dying.elite ? 0xff8844 : 0xff6644;
      this.graphics.fillStyle(bodyColor, alpha * 0.9);
      this.graphics.fillCircle(screen.x, screen.y, renderRadius);

      // Elite: burst particles (use Phaser particle system)
      if (dying.elite && lifeRatio > 0.3 && lifeRatio < 0.35) {
        // Emit once during the animation — enhanced explosion
        this.emitParticles(screen.x, screen.y, {
          color: 0xffd700,
          count: 16,
          speed: 100,
          lifespan: 0.45,
          scale: 3.5,
          alpha: 0.95,
          blendMode: Phaser.BlendModes.ADD,
        });
        // Secondary shockwave
        this.emitParticles(screen.x, screen.y, {
          color: 0xff6600,
          count: 8,
          speed: 60,
          lifespan: 0.3,
          scale: 5,
          alpha: 0.6,
          blendMode: Phaser.BlendModes.ADD,
        });
        // Flash ring for elite death
        this.emitCritFlashRing(screen.x, screen.y, 0.35);
      }
    }

    // Update timers and remove expired
    const dt = 1 / 60;
    for (const dying of this.dyingEnemies) {
      dying.lifeSec -= dt;
    }
    this.dyingEnemies = this.dyingEnemies.filter((d) => d.lifeSec > 0);
  }

  private renderUpgradeFlash(): void {
    const state = this.engine.getState();
    const battle = state.battle;
    if (state.upgradeFlashSec <= 0 || !battle) {
      return;
    }
    const camera = this.getBattleCameraRect(battle);
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    const flashRatio = Phaser.Math.Clamp(state.upgradeFlashSec / 0.18, 0, 1);
    const pulse = 0.5 + Math.sin(battle.elapsedSec * 10) * 0.5;
    const glowColor = this.mixColor(0x7af7d4, 0xffffff, 0.2);

    this.graphics.fillStyle(glowColor, 0.03 + flashRatio * 0.05);
    this.graphics.fillCircle(playerScreen.x, playerScreen.y, 32 + flashRatio * 18 + pulse * 3);
    this.graphics.lineStyle(2, glowColor, 0.22 + flashRatio * 0.16);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 28 + flashRatio * 16 + pulse * 2);
    this.graphics.lineStyle(1.1, 0xffffff, 0.08 + flashRatio * 0.08);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 42 + flashRatio * 22);
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
    options?: { height?: number; depth?: number },
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
      .setDepth(options?.depth ?? 30)
      .setPosition(x, y)
      .setDisplaySize(size, options?.height ?? size)
      .setRotation(rotation)
      .setAlpha(alpha)
      .setVisible(true);
    this.runtimePreviewImageCursor += 1;
    return true;
  }

  private getPreviewEnemyTexture(archetype: string): string | null {
    if (archetype === 'brute') {
      return PREVIEW_BRUTE_ENEMY_TEXTURE;
    }
    if (archetype === 'skirmisher') {
      return PREVIEW_SKIRMISHER_ENEMY_TEXTURE;
    }
    if (archetype === 'ranged') {
      return PREVIEW_RANGED_ENEMY_TEXTURE;
    }
    if (archetype === 'standard') {
      return PREVIEW_STANDARD_ENEMY_TEXTURE;
    }
    return null;
  }

  private getPreviewBossTexture(templateId: string): string {
    if (templateId === 'boss-hunt') {
      return PREVIEW_BOSS_HUNT_TEXTURE;
    }
    if (templateId === 'boss-lockdown') {
      return PREVIEW_BOSS_LOCKDOWN_TEXTURE;
    }
    return PREVIEW_BOSS_BASTION_TEXTURE;
  }

  private getRouteHitTexture(routeHitKind?: string): string {
    if (routeHitKind === 'crit') {
      return PREVIEW_FX_HIT_CRIT_TEXTURE;
    }
    if (routeHitKind === 'pierce') {
      return PREVIEW_FX_HIT_PIERCE_TEXTURE;
    }
    if (routeHitKind === 'dash') {
      return PREVIEW_FX_HIT_DASH_TEXTURE;
    }
    return PREVIEW_FX_HIT_NORMAL_TEXTURE;
  }

  private getBattleCameraRect(battle: BattleState): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    visibleWorldWidth: number;
    visibleWorldHeight: number;
  } {
    const zoom = 1.34;
    const visibleWorldWidth = this.scale.width / zoom;
    const visibleWorldHeight = this.scale.height / zoom;
    const width = this.scale.width;
    const height = this.scale.height;
    const maxLeft = Math.max(0, ARENA_WIDTH - visibleWorldWidth);
    const maxTop = Math.max(0, ARENA_HEIGHT - visibleWorldHeight);

    // Keep the camera centered and stable. Predictive camera drift caused motion sickness during playtests.
    const predictionOffsetX = 0;
    const predictionOffsetY = 0;

    const baseLeft = clamp(battle.playerX - visibleWorldWidth * 0.5 + predictionOffsetX, 0, maxLeft);
    const baseTop = clamp(battle.playerY - visibleWorldHeight * 0.5 + predictionOffsetY, 0, maxTop);
    // 镜头抖动 — 增强为带随机噪声的冲击式抖动
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (battle.cameraShakeSec > 0 && battle.cameraShakeStrength > 0.01) {
      const shakePhase = battle.elapsedSec * battle.cameraShakeFrequency * Math.PI * 2;
      const noiseX = Math.sin(shakePhase * 2.3 + 1.7) * 0.4 + Math.sin(shakePhase * 5.1) * 0.2;
      const noiseY = Math.cos(shakePhase * 1.9 + 3.1) * 0.4 + Math.cos(shakePhase * 4.7) * 0.2;
      shakeOffsetX = (Math.sin(shakePhase) + noiseX) * battle.cameraShakeStrength * 3.5;
      shakeOffsetY = (Math.cos(shakePhase * 1.37) + noiseY) * battle.cameraShakeStrength * 3.5;
    }
    const left = clamp(baseLeft + shakeOffsetX, 0, maxLeft);
    const top = clamp(baseTop + shakeOffsetY, 0, maxTop);

    return {
      left,
      right: left + visibleWorldWidth,
      top,
      bottom: top + visibleWorldHeight,
      width,
      height,
      visibleWorldWidth,
      visibleWorldHeight,
    };
  }

  private worldToScreen(
    camera: { left: number; top: number; right?: number; bottom?: number; width?: number; height?: number },
    x: number,
    y: number,
  ): { x: number; y: number } {
    return worldToScreenPure(camera, x, y, this.scale.width, this.scale.height);
  }

  private isVisibleInCamera(
    camera: { left: number; right: number; top: number; bottom: number },
    x: number,
    y: number,
    padding = 40,
  ): boolean {
    return isVisibleInCameraPure(camera, x, y, padding);
  }

  private getTerrainNoise(x: number, y: number, salt = 0): number {
    return getTerrainNoisePure(x, y, salt);
  }

  private renderBattleTerrain(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    const g = this.terrainGraphics;
    this.renderRuntimePreviewImage(
      PREVIEW_BG_SPACE_NEBULA_TEXTURE,
      camera.width * 0.5,
      camera.height * 0.5,
      camera.width,
      0,
      0.9,
      { height: camera.height, depth: 2 },
    );
    g.fillGradientStyle(0x0b1721, 0x0f2030, 0x060a0f, 0x04070b, 0.58, 0.62, 0.86, 0.88);
    g.fillRect(0, 0, camera.width, camera.height);

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
        if (noise > 0.58) {
          this.renderRuntimePreviewImage(
            PREVIEW_BG_DEBRIS_DECAL_TEXTURE,
            screen.x,
            screen.y,
            width * 1.1,
            (noise - 0.5) * Math.PI,
            0.34,
            { height: height * 1.65, depth: 3 },
          );
        }
        g.fillStyle(noise > 0.54 ? 0x33404b : 0x1a232c, noise > 0.54 ? 0.16 : 0.1);
        g.fillEllipse(screen.x, screen.y, width, height);
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
        const tileTexture = noise > 0.68 ? PREVIEW_BG_FLOOR_HOLO_TEXTURE : PREVIEW_BG_FLOOR_HEX_TEXTURE;
        this.renderRuntimePreviewImage(
          tileTexture,
          screen.x + (TERRAIN_TILE_SIZE - 8) * 0.5,
          screen.y + (TERRAIN_TILE_SIZE - 8) * 0.5,
          TERRAIN_TILE_SIZE - 8,
          0,
          0.5 + noise * 0.16,
          { depth: 3 },
        );
        g.fillStyle(tileColor, 0.12 + noise * 0.06);
        g.fillRoundedRect(screen.x, screen.y, TERRAIN_TILE_SIZE - 8, TERRAIN_TILE_SIZE - 8, 20);

        const detailNoise = this.getTerrainNoise(tileX, tileY, 4);
        g.fillStyle(0x71869a, 0.07 + detailNoise * 0.06);
        g.fillEllipse(
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
            g.fillStyle(0x0d1116, 0.18);
            g.fillCircle(px, py, 2 + this.getTerrainNoise(tileX, tileY, 40 + pebble) * 3);
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
    const g = this.terrainGraphics;
    const template = this.services.configLoader.getBattleTemplate(battle.templateId);
    const pulse = 0.5 + Math.sin(battle.elapsedSec * 1.7 + battle.kills * 0.08) * 0.5;
    const encounterGlow =
      template.winCondition.type === 'survive'
        ? this.mixColor(accentColor, 0xff8677, 0.22)
        : template.winCondition.type === 'elite'
          ? this.mixColor(accentColor, 0xffd8a8, 0.22)
          : this.mixColor(accentColor, 0xc2e0ff, 0.2);

    if (template.winCondition.type === 'survive') {
      const edgeAlpha = 0.032 + pulse * 0.03;
      g.fillStyle(encounterGlow, edgeAlpha);
      g.fillRect(0, 0, camera.width, 26);
      g.fillRect(0, camera.height - 26, camera.width, 26);
      g.lineStyle(2, encounterGlow, 0.035 + pulse * 0.05);
      g.lineBetween(0, 34, camera.width, 34);
      g.lineBetween(0, camera.height - 34, camera.width, camera.height - 34);
    } else if (template.winCondition.type === 'elite') {
      const topBeaconY = this.worldToScreen(camera, ARENA_WIDTH * 0.5, 116).y;
      const centerBeacon = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      g.lineStyle(2, encounterGlow, 0.035 + pulse * 0.05);
      g.lineBetween(camera.width * 0.5, topBeaconY, centerBeacon.x, centerBeacon.y - 64);
      g.lineStyle(1.5, encounterGlow, 0.035 + pulse * 0.04);
      g.lineBetween(centerBeacon.x - 56, centerBeacon.y, centerBeacon.x - 20, centerBeacon.y);
      g.lineBetween(centerBeacon.x + 20, centerBeacon.y, centerBeacon.x + 56, centerBeacon.y);
      g.lineBetween(centerBeacon.x, centerBeacon.y - 56, centerBeacon.x, centerBeacon.y - 22);
    } else {
      const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      g.lineStyle(1.5, encounterGlow, 0.025 + pulse * 0.035);
      g.lineBetween(center.x - 132, center.y, center.x - 78, center.y);
      g.lineBetween(center.x + 78, center.y, center.x + 132, center.y);
      g.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
      g.fillTriangle(center.x - 150, center.y, center.x - 126, center.y - 12, center.x - 126, center.y + 12);
      g.fillTriangle(center.x + 150, center.y, center.x + 126, center.y - 12, center.x + 126, center.y + 12);
    }

    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    if (pattern === 'lanes' && laneBias === 'vertical') {
      // Lane indicators removed - too distracting
      return;
    }

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      return;
    }

    if (pattern === 'pincers') {
      const sideYBase = (battle.elapsedSec * 88) % Math.max(180, ARENA_HEIGHT - 120);
      for (let index = 0; index < 3; index += 1) {
        const worldY = 72 + ((sideYBase + index * 180) % Math.max(220, ARENA_HEIGHT - 120));
        const left = this.worldToScreen(camera, 52, worldY);
        const right = this.worldToScreen(camera, ARENA_WIDTH - 52, worldY);
        if (left.y >= -48 && left.y <= camera.height + 48) {
          g.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          g.fillTriangle(left.x, left.y, left.x + 24, left.y - 16, left.x + 24, left.y + 16);
        }
        if (right.y >= -48 && right.y <= camera.height + 48) {
          g.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          g.fillTriangle(right.x, right.y, right.x - 24, right.y - 16, right.x - 24, right.y + 16);
        }
      }
      return;
    }

    const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
    g.lineStyle(1.5, encounterGlow, 0.025 + pulse * 0.035);
    g.lineBetween(center.x - 148, center.y - 74, center.x - 96, center.y - 46);
    g.lineBetween(center.x - 148, center.y + 74, center.x - 96, center.y + 46);
    g.lineBetween(center.x + 96, center.y - 46, center.x + 148, center.y - 74);
    g.lineBetween(center.x + 96, center.y + 46, center.x + 148, center.y + 74);
  }

  private renderLowHealthWarning(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  ): void {
    const state = this.engine.getState();
    const healthRatio = state.stats.hp / state.stats.maxHp;

    // P0优化：低血量警告（<30%时触发）— 增强版带心跳脉冲
    if (healthRatio < 0.3) {
      const pulseSpeed = healthRatio < 0.15 ? 10 : 6; // 血量越低脉动越快
      const pulseAlpha = 0.5 + Math.sin(battle.elapsedSec * pulseSpeed) * 0.5;
      const warningAlpha = (0.3 - healthRatio) / 0.3; // 血量越低越明显
      const edgeThickness = healthRatio < 0.15 ? 55 : 42;

      // 屏幕边缘红色渐变警告 — 增强亮度
      const redColor = 0xff0000;
      const finalAlpha = pulseAlpha * warningAlpha * (healthRatio < 0.15 ? 0.55 : 0.4);

      // 上边缘
      this.graphics.fillGradientStyle(redColor, redColor, 0x000000, 0x000000, finalAlpha, finalAlpha, 0, 0);
      this.graphics.fillRect(0, 0, camera.width, edgeThickness);

      // 下边缘
      this.graphics.fillGradientStyle(0x000000, 0x000000, redColor, redColor, 0, 0, finalAlpha, finalAlpha);
      this.graphics.fillRect(0, camera.height - edgeThickness, camera.width, edgeThickness);

      // 左边缘
      this.graphics.fillGradientStyle(redColor, 0x000000, redColor, 0x000000, finalAlpha, 0, finalAlpha, 0);
      this.graphics.fillRect(0, 0, edgeThickness, camera.height);

      // 右边缘
      this.graphics.fillGradientStyle(0x000000, redColor, 0x000000, redColor, 0, finalAlpha, 0, finalAlpha);
      this.graphics.fillRect(camera.width - edgeThickness, 0, edgeThickness, camera.height);

      // 极低血量（<15%）时增加屏幕中央暗化 vignette
      if (healthRatio < 0.15) {
        const vignetteAlpha = pulseAlpha * warningAlpha * 0.08;
        this.graphics.fillGradientStyle(
          0x000000, 0x000000, 0x000000, 0x000000,
          vignetteAlpha, vignetteAlpha, vignetteAlpha * 2, vignetteAlpha * 2,
        );
        this.graphics.fillRect(0, 0, camera.width, camera.height);
      }
    }
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

    const dominantRoute = this.engine.getDominantRoute();
    const engineState = this.engine.getState();
    const liveFocusRoute = this.getLiveCombatFocusRoute(battle);
    const flowChainRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
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
    const cameraScale = camera.width / Math.max(1, camera.right - camera.left);
    const actorScale = cameraScale * 1.08;
    const pierceSignatureRatio = pierceFlowRatio;
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
      const expansionRatio = 1 - lifeRatio;
      const impactRadius = Math.max(6, pulse.radius * (0.58 + expansionRatio * 0.34));
      const distanceToPlayer = Math.hypot(pulse.x - battle.playerX, pulse.y - battle.playerY);
      const isPlayerSidePulse = distanceToPlayer <= Math.max(42, pulse.radius * 0.45);
      const glowAlpha = Math.min(isPlayerSidePulse ? 0.16 : 0.3, pulse.fillAlpha * 0.7 + pulse.strokeAlpha * 0.06) * lifeRatio;
      if (glowAlpha > 0) {
        this.graphics.fillStyle(pulse.color, glowAlpha * (isPlayerSidePulse ? 0.24 : 0.38));
        this.graphics.fillCircle(screen.x, screen.y, impactRadius * (isPlayerSidePulse ? 0.92 : 1.08));
        this.graphics.fillStyle(pulse.secondaryColor, glowAlpha * 0.12);
        this.graphics.fillCircle(screen.x, screen.y, impactRadius * 0.48);
      }
      const rimAlpha = Math.min(isPlayerSidePulse ? 0.24 : 0.42, pulse.strokeAlpha * 0.36) * lifeRatio;
      this.graphics.lineStyle(Math.max(1.1, pulse.strokeWidth * (isPlayerSidePulse ? 0.48 : 0.62)), pulse.color, rimAlpha);
      this.graphics.strokeCircle(screen.x, screen.y, impactRadius);
      if (!isPlayerSidePulse && pulse.spokeCount > 0 && pulse.spokeLength > 0) {
        const shardCount = Math.min(5, Math.max(3, pulse.spokeCount));
        const shardAlpha = Math.min(0.28, pulse.strokeAlpha * 0.24) * lifeRatio;
        const shardInner = impactRadius * 0.36;
        const shardOuter = impactRadius + pulse.spokeLength * (0.24 + expansionRatio * 0.38);
        this.graphics.lineStyle(Math.max(1, pulse.strokeWidth * 0.5), pulse.secondaryColor, shardAlpha);
        for (let shard = 0; shard < shardCount; shard += 1) {
          const angle = pulse.angle + pulse.lifeSec * pulse.spinRate + (shard / shardCount) * Math.PI * 2;
          this.graphics.lineBetween(
            screen.x + Math.cos(angle) * shardInner,
            screen.y + Math.sin(angle) * shardInner,
            screen.x + Math.cos(angle) * shardOuter,
            screen.y + Math.sin(angle) * shardOuter,
          );
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
              ? 0.012 + pierceSignatureRatio * 0.001
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
      // 路线弹道不再叠加独立圆环素材，避免角色附近出现无意义线段。
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 1.2 : 1.05) + bulletHitRatio * 0.32,
        bulletTint,
        (bullet.canEcho ? 0.08 : 0.04) + bulletHitRatio * 0.02,
      );
      this.graphics.lineBetween(
        tail.x - bulletDirX * (5 + bulletSpeedRatio * 4),
        tail.y - bulletDirY * (5 + bulletSpeedRatio * 4),
        screen.x,
        screen.y,
      );
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 1.0 : 0.9) + bulletHitRatio * 0.24,
        bulletTint,
        (bullet.canEcho ? 0.16 : 0.1) + bulletHitRatio * 0.04,
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
          1.0 + bulletHitRatio * 0.35 + pierceFlowRatio * 0.12,
          bulletTint,
          0.08 + bulletSpeedRatio * 0.04 + bulletHitRatio * 0.06 + pierceFlowRatio * 0.04,
        );
        const tickReach = 5 + bulletHitRatio * 2 + pierceSignatureRatio * 2;
        this.graphics.lineBetween(
          screen.x - bulletOrthoX * tickReach,
          screen.y - bulletOrthoY * tickReach,
          screen.x + bulletOrthoX * tickReach,
          screen.y + bulletOrthoY * tickReach,
        );
        if (pierceSignatureRatio > 0.12) {
          this.graphics.lineStyle(0.9, this.mixColor(bulletTint, 0xffffff, 0.32), 0.05 + pierceSignatureRatio * 0.07);
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
      if (bullet.pierceRemaining > 0 && bullet.routeFocus !== 'pierce') {
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
    if (battle.dashAfterimages.length > 0) {
      const dashAfterimages = battle.dashAfterimages.slice(-6);
      for (const afterimage of dashAfterimages) {
        const dashAfterimageRatio = Phaser.Math.Clamp(afterimage.lifeSec / 0.8, 0, 1);
        const afterimageScreen = this.worldToScreen(camera, afterimage.x, afterimage.y);
        const afterimageReach = 10 + Math.min(20, afterimage.damage * 0.9) + (1 - dashAfterimageRatio) * 14;
        this.graphics.lineStyle(1.6, 0x7aff7a, 0.12 + dashAfterimageRatio * 0.32);
        this.graphics.strokeCircle(afterimageScreen.x, afterimageScreen.y, afterimageReach);
        this.graphics.lineStyle(1.1, 0xeafff8, 0.08 + dashAfterimageRatio * 0.2);
        this.graphics.lineBetween(
          afterimageScreen.x - afterimageReach * 0.72,
          afterimageScreen.y,
          afterimageScreen.x + afterimageReach * 0.72,
          afterimageScreen.y,
        );
        this.graphics.fillStyle(0xeafff8, 0.06 + dashAfterimageRatio * 0.12);
        this.graphics.fillCircle(afterimageScreen.x, afterimageScreen.y, 1.8 + dashAfterimageRatio);
      }
    }
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
      const renderRadius = enemy.radius * actorScale;

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
          const leadMarkerRadius = enemy.radius + 10 + leadFocusRatio * 5;
          this.graphics.fillStyle(leadColor, 0.16 + leadFocusRatio * 0.18);
          this.graphics.fillCircle(
            screen.x + Math.cos(faceAngle) * leadMarkerRadius,
            screen.y + Math.sin(faceAngle) * leadMarkerRadius,
            3.2 + leadFocusRatio * 1.4,
          );
          this.graphics.fillCircle(
            screen.x - Math.cos(faceAngle) * (enemy.radius + 4),
            screen.y - Math.sin(faceAngle) * (enemy.radius + 4),
            2.2 + leadFocusRatio * 0.8,
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
      this.graphics.fillEllipse(screen.x, screen.y + renderRadius + 7 * actorScale, renderRadius * 1.8, renderRadius * 0.72);
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
            ? this.mixColor(this.services.configLoader.getBattleTemplate(battle.templateId).accent, 0xfff0bf, 0.3)
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

      // 流派构筑第二轮：敌人状态标记可视化
      const activeRoutePerks = this.engine.getState().activeRoutePerks;
      // critMark: 橙色破绽环 — 大幅增强可见度
      if (enemy.critMarkSec > 0) {
        const critMarkRatio = Math.min(1, enemy.critMarkSec / 2.5);
        const critColor = 0xff7a1a; // 鲜亮橙色
        const critBrightColor = 0xffcc66;
        const critReach = enemy.radius + 22 + (1 - critMarkRatio) * 8;
        const critPulse = 0.5 + Math.sin(battle.elapsedSec * 8 + enemy.id * 0.7) * 0.5;
        // 脉冲填充
        this.graphics.fillStyle(critColor, 0.08 + critMarkRatio * 0.12 + critPulse * 0.06);
        this.graphics.fillCircle(screen.x, screen.y, critReach * 0.9);
        // 主菱形外环
        this.renderDiamondOutline(screen.x, screen.y, critReach, critColor, 0.45 + critMarkRatio * 0.45, 4);
        // 旋转星芒
        const shardCount = 4;
        for (let i = 0; i < shardCount; i++) {
          const angle = battle.elapsedSec * 2.4 + (i * Math.PI * 2) / shardCount;
          const inner = enemy.radius * 0.5;
          const outer = critReach + 6 + critPulse * 4;
          this.graphics.lineStyle(3, critBrightColor, 0.3 + critMarkRatio * 0.3);
          this.graphics.lineBetween(
            screen.x + Math.cos(angle) * inner,
            screen.y + Math.sin(angle) * inner,
            screen.x + Math.cos(angle) * outer,
            screen.y + Math.sin(angle) * outer,
          );
        }
        if ((enemy.critMarkStacks ?? 0) >= 2) {
          const stackReach = enemy.radius + 30 + Math.max(0, (enemy.critMarkStacks ?? 0) - 2) * 6;
          this.renderDiamondOutline(screen.x, screen.y, stackReach, this.mixColor(critColor, 0xffd997, 0.3), 0.25 + critMarkRatio * 0.3, 2.8);
        }
        if (activeRoutePerks?.critLockProtocol) {
          const bracketRadius = enemy.radius + 34 + (1 - critMarkRatio) * 6;
          this.renderTargetBrackets(screen.x, screen.y, bracketRadius, 10, 0xffd58a, 0.4 + critMarkRatio * 0.5);
        }
        // 短促爆闪效果
        if (enemy.hitFlashSec > 0.08) {
          this.graphics.fillStyle(critColor, 0.2 + critMarkRatio * 0.25);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 8);
          this.graphics.fillStyle(0xffffff, 0.3 + critMarkRatio * 0.2);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius * 0.5);
        }
      }
      // pierceMark: 蓝色贯穿裂纹 — 大幅增强可见度
      if (enemy.pierceMarkSec > 0) {
        const pierceMarkRatio = Math.min(1, enemy.pierceMarkSec / 1.8);
        const pierceColor = 0x2eb4ff; // 鲜亮冷蓝
        const pierceBrightColor = 0xaaf0ff;
        const piercePulse = 0.5 + Math.sin(battle.elapsedSec * 7 + enemy.id * 0.5) * 0.5;
        const crackAlpha = 0.4 + pierceMarkRatio * 0.45;
        const crackLen = enemy.radius * 2.2;
        // 蓝色发光填充
        this.graphics.fillStyle(pierceColor, 0.06 + pierceMarkRatio * 0.1 + piercePulse * 0.04);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 12);
        // 主裂纹 X
        this.graphics.lineStyle(4, pierceColor, crackAlpha);
        this.graphics.lineBetween(screen.x - crackLen, screen.y - 8, screen.x + crackLen, screen.y + 8);
        this.graphics.lineBetween(screen.x - crackLen * 0.85, screen.y + 8, screen.x + crackLen * 0.85, screen.y - 8);
        // 中心亮线
        this.graphics.lineStyle(2.5, pierceBrightColor, 0.3 + pierceMarkRatio * 0.4);
        this.graphics.lineBetween(screen.x - crackLen * 0.5, screen.y, screen.x + crackLen * 0.5, screen.y);
        // 贯穿箭头
        this.graphics.fillStyle(pierceBrightColor, 0.4 + pierceMarkRatio * 0.3);
        this.graphics.fillCircle(screen.x + crackLen, screen.y + 8 * (crackLen / (crackLen || 1)), 5);
        this.graphics.fillCircle(screen.x - crackLen, screen.y - 8 * (crackLen / (crackLen || 1)), 5);
        if (activeRoutePerks?.pierceBreakthrough) {
          this.graphics.lineStyle(3, 0xa7e9ff, 0.3 + pierceMarkRatio * 0.35);
          this.graphics.lineBetween(screen.x - enemy.radius * 2.4, screen.y, screen.x + enemy.radius * 2.4, screen.y);
          this.graphics.fillStyle(0xbdefff, 0.3 + pierceMarkRatio * 0.25);
          this.graphics.fillCircle(screen.x + enemy.radius * 1.4, screen.y, 4);
          this.graphics.fillCircle(screen.x + enemy.radius * 2.0, screen.y, 3);
        }
        if ((enemy.pierceMarkStacks ?? 0) >= 2) {
          const railReach = enemy.radius * (1.8 + Math.min(0.4, (enemy.pierceMarkStacks ?? 0) * 0.1));
          this.graphics.lineStyle(2.5, 0xb8ecff, 0.25 + pierceMarkRatio * 0.3);
          this.graphics.lineBetween(screen.x - railReach, screen.y - 4, screen.x + railReach, screen.y - 4);
          this.graphics.lineBetween(screen.x - railReach, screen.y + 4, screen.x + railReach, screen.y + 4);
          if ((enemy.pierceMarkStacks ?? 0) >= 3) {
            this.graphics.fillStyle(0xe7fbff, 0.25 + pierceMarkRatio * 0.25);
            this.graphics.fillCircle(screen.x - railReach * 0.78, screen.y, 3.5);
            this.graphics.fillCircle(screen.x + railReach * 0.78, screen.y, 3.5);
          }
        }
      }
      // dashMark: 绿色脉冲残影 — 大幅增强可见度
      if (enemy.dashMarkSec > 0) {
        const dashMarkRatio = Math.min(1, enemy.dashMarkSec / 1.5);
        const dashColor = 0x2eff5e; // 鲜亮脉冲绿
        const dashBrightColor = 0xc8ffd8;
        const dashPulse = 0.5 + Math.sin(battle.elapsedSec * 9 + enemy.id * 0.6) * 0.5;
        const pulseAlpha = 0.3 + dashMarkRatio * 0.5;
        const pulseRadius = enemy.radius + 18 + (1 - dashMarkRatio) * 8;
        // 绿色发光填充
        this.graphics.fillStyle(dashColor, 0.06 + dashMarkRatio * 0.1 + dashPulse * 0.04);
        this.graphics.fillCircle(screen.x, screen.y, pulseRadius * 0.9);
        // 双弧环
        this.graphics.lineStyle(3.5, dashColor, pulseAlpha);
        this.graphics.beginPath();
        this.graphics.arc(screen.x, screen.y, pulseRadius, -1.3 + dashMarkRatio * 0.3, 0.9 + dashMarkRatio * 0.3, false);
        this.graphics.strokePath();
        this.graphics.beginPath();
        this.graphics.arc(screen.x, screen.y, pulseRadius, Math.PI - 0.8 + dashMarkRatio * 0.3, Math.PI + 1.3 + dashMarkRatio * 0.3, false);
        this.graphics.strokePath();
        // 脉冲粒子点
        this.graphics.fillStyle(dashBrightColor, 0.5 + dashMarkRatio * 0.3);
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + battle.elapsedSec * 2.5 + dashMarkRatio * 1.2;
          const dist = enemy.radius + 16 + (1 - dashMarkRatio) * 6;
          this.graphics.fillCircle(screen.x + Math.cos(angle) * dist, screen.y + Math.sin(angle) * dist, 4);
        }
        // 层数环
        if ((enemy.dashPulseStacks ?? 0) >= 2) {
          const dashStackRatio = Math.min(1, (enemy.dashPulseStacks ?? 0) / 3);
          this.graphics.lineStyle(2.5, dashColor, 0.25 + dashStackRatio * 0.3);
          this.graphics.beginPath();
          this.graphics.arc(screen.x, screen.y, enemy.radius + 8 + dashStackRatio * 8, -0.4, 1.8, false);
          this.graphics.strokePath();
          this.graphics.beginPath();
          this.graphics.arc(screen.x, screen.y, enemy.radius + 8 + dashStackRatio * 8, Math.PI - 0.6, Math.PI + 1.2, false);
          this.graphics.strokePath();
        }
        if (enemy.dashMarkedForBonus) {
          const dashFoldReach = enemy.radius + 22;
          this.graphics.lineStyle(2.5, 0xeafff8, 0.3 + dashMarkRatio * 0.25);
          this.graphics.lineBetween(screen.x - dashFoldReach, screen.y - 5, screen.x - 8, screen.y + 5);
          this.graphics.lineBetween(screen.x + 8, screen.y - 5, screen.x + dashFoldReach, screen.y + 5);
          this.graphics.fillStyle(0xeafff8, 0.4 + dashMarkRatio * 0.2);
          this.graphics.fillCircle(screen.x - dashFoldReach, screen.y + 5, 4);
          this.graphics.fillCircle(screen.x + dashFoldReach, screen.y - 5, 4);
        }
      }

      // 流派构筑第三轮：敌人命中瞬间特效（替代玩家周围常驻线条）
      if (enemy.routeHitFlashSec && enemy.routeHitFlashSec > 0) {
        const flashRatio = enemy.routeHitFlashSec / 0.18;
        this.renderRuntimePreviewImage(
          this.getRouteHitTexture(enemy.routeHitKind),
          screen.x,
          screen.y,
          enemy.radius * (enemy.routeHitKind === 'crit' ? 4.1 : 3.3),
          faceAngle,
          0.42 + flashRatio * 0.28,
        );
        if (enemy.routeHitKind === 'crit') {
          const critFlashColor = 0xff4444;
          const critBrightColor = 0xffaa55;
          const coreRadius = enemy.radius * (0.52 + (1 - flashRatio) * 0.28);
          this.renderDiamondOutline(screen.x, screen.y, enemy.radius + 20 + (1 - flashRatio) * 12, critBrightColor, 0.38 * flashRatio, 2.6);
          this.graphics.fillStyle(critFlashColor, 0.18 * flashRatio);
          this.graphics.fillCircle(screen.x, screen.y, coreRadius);
          this.graphics.fillStyle(critBrightColor, 0.7 * flashRatio);
          for (let shard = 0; shard < 6; shard += 1) {
            const angle = faceAngle + shard * (Math.PI / 3);
            const inner = enemy.radius * 0.38;
            const outer = enemy.radius + 20 + (1 - flashRatio) * 14;
            const shardWidth = 6 + (shard % 2) * 2;
            this.graphics.fillTriangle(
              screen.x + Math.cos(angle) * inner,
              screen.y + Math.sin(angle) * inner,
              screen.x + Math.cos(angle + 0.14) * (outer - shardWidth),
              screen.y + Math.sin(angle + 0.14) * (outer - shardWidth),
              screen.x + Math.cos(angle - 0.14) * outer,
              screen.y + Math.sin(angle - 0.14) * outer,
            );
          }
        } else if (enemy.routeHitKind === 'pierce') {
          const pierceFlashColor = 0x00d4ff;
          const pierceBrightColor = 0x88f0ff;
          const slashLen = enemy.radius * 2 + 18;
          const split = 6 + (1 - flashRatio) * 10;
          this.graphics.lineStyle(4.4, pierceFlashColor, 0.76 * flashRatio);
          this.graphics.lineBetween(screen.x - slashLen, screen.y - split, screen.x + slashLen, screen.y + split);
          this.graphics.lineBetween(screen.x - slashLen, screen.y + split, screen.x + slashLen, screen.y - split);
          this.graphics.lineStyle(2, pierceBrightColor, 0.92 * flashRatio);
          this.graphics.lineBetween(screen.x - slashLen * 0.9, screen.y, screen.x + slashLen * 0.9, screen.y);
          if (this.engine.getState().activeRoutePerks?.pierceBreakthrough) {
            this.graphics.lineStyle(2.4, 0xcdf7ff, 0.45 * flashRatio);
            this.graphics.lineBetween(screen.x - slashLen * 0.18, screen.y - split * 2.2, screen.x + slashLen * 1.05, screen.y - split * 0.4);
            this.graphics.lineBetween(screen.x - slashLen * 0.18, screen.y + split * 2.2, screen.x + slashLen * 1.05, screen.y + split * 0.4);
          }
          this.graphics.fillStyle(0xffffff, 0.7 * flashRatio);
          this.graphics.fillCircle(screen.x, screen.y, 3);
        } else if (enemy.routeHitKind === 'dash') {
          const dashFlashColor = 0x72ffc8;
          const dashBrightColor = 0xeafff8;
          const waveRadius = enemy.radius + 10 + (1 - flashRatio) * 20;
          this.graphics.fillStyle(dashFlashColor, 0.08 * flashRatio);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius * 0.84);
          this.graphics.fillStyle(dashBrightColor, 0.32 * flashRatio);
          this.graphics.fillCircle(screen.x, screen.y, enemy.radius * 0.54);
          this.graphics.lineStyle(3, dashFlashColor, 0.36 * flashRatio);
          for (let arc = 0; arc < 3; arc += 1) {
            const start = faceAngle + arc * 1.96 - 0.66;
            this.graphics.beginPath();
            this.graphics.arc(screen.x, screen.y, waveRadius - arc * 6, start, start + 1.04, false);
            this.graphics.strokePath();
          }
          this.graphics.lineStyle(1.6, dashBrightColor, 0.28 * flashRatio);
          this.graphics.lineBetween(screen.x - waveRadius * 0.55, screen.y + 2, screen.x + waveRadius * 0.55, screen.y - 2);
        }
      } else if (enemy.hitFlashSec > 0) {
        const normalHitRatio = Phaser.Math.Clamp(enemy.hitFlashSec / 0.14, 0, 1);
        this.renderRuntimePreviewImage(
          PREVIEW_FX_HIT_NORMAL_TEXTURE,
          screen.x,
          screen.y,
          renderRadius * 2.35,
          faceAngle,
          0.26 + normalHitRatio * 0.22,
        );
      }
      if (!enemy.elite && enemy.hitFlashSec > 0.1 && enemy.hp <= enemy.maxHp * 0.22) {
        const breakRatio = Phaser.Math.Clamp(enemy.hitFlashSec / 0.18, 0, 1);
        this.renderRuntimePreviewImage(
          PREVIEW_FX_EXPLOSION_SMALL_TEXTURE,
          screen.x,
          screen.y,
          renderRadius * 3.25,
          battle.elapsedSec * 2.8,
          0.18 + breakRatio * 0.22,
        );
      }

      this.graphics.fillStyle(enemyFill, enemy.elite ? 0.98 : 0.95);
      const enemyPreviewTexture =
        !enemy.elite && enemy.role !== 'escort' && enemy.archetype !== 'standard'
          ? this.getPreviewEnemyTexture(enemy.archetype)
          : null;
      const enemyPreviewRendered =
        enemyPreviewTexture !== null
          ? this.renderRuntimePreviewImage(enemyPreviewTexture, screen.x, screen.y, renderRadius * 3.15, faceAngle + Math.PI / 2, 0.78)
          : false;

      if (enemy.elite) {
        // Determine which elite texture to use based on state
        let eliteTexture = PREVIEW_ELITE_CORE_TEXTURE;
        let eliteSize = renderRadius * 3.2;

        if (battle.encounterType === 'boss') {
          eliteTexture = this.getPreviewBossTexture(battle.templateId);
          eliteSize = renderRadius * 3.6;
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
          this.graphics.fillCircle(screen.x, screen.y, renderRadius);
          this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.12), 0.22);
          this.graphics.fillCircle(screen.x, screen.y, renderRadius * 0.56);
        }

        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeCircle(screen.x, screen.y, renderRadius + 5 * cameraScale);

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
          this.graphics.lineStyle(4, this.services.configLoader.getBattleTemplate(battle.templateId).accent, pulseAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, pulseRadius);
        }
        if (battle.pressureSignatureSec > 0) {
          const signatureAlpha = Math.min(0.28, 0.12 + battle.pressureSignatureSec * 0.04);
          const signatureRadius = enemy.radius + 15 + Math.sin(battle.elapsedSec * 7.5) * 2;
          this.graphics.lineStyle(3, this.services.configLoader.getBattleTemplate(battle.templateId).accent, signatureAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, signatureRadius);
        }
        if (battle.pressurePatternFlashSec > 0) {
          const patternAlpha = Math.min(0.26, 0.08 + battle.pressurePatternFlashSec * 0.28);
          this.graphics.lineStyle(2, this.services.configLoader.getBattleTemplate(battle.templateId).accent, patternAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 20 + battle.pressurePatternFlashSec * 12);
        }
        if (enemy.guardSec > 0) {
          const guardAlpha = Math.min(0.45, 0.16 + enemy.guardSec * 0.04);
          this.graphics.lineStyle(3, 0xfff2b0, guardAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        }
      } else if (enemy.archetype === 'ranged') {
        if (!enemyPreviewRendered) {
        this.graphics.fillRoundedRect(screen.x - renderRadius, screen.y - renderRadius, renderRadius * 2, renderRadius * 2, 8 * cameraScale);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeRoundedRect(
          screen.x - renderRadius - 2 * cameraScale,
          screen.y - renderRadius - 2 * cameraScale,
          renderRadius * 2 + 4 * cameraScale,
          renderRadius * 2 + 4 * cameraScale,
          10 * cameraScale,
        );
        }
      } else if (enemy.archetype === 'brute') {
        if (!enemyPreviewRendered) {
        this.graphics.fillEllipse(screen.x, screen.y, renderRadius * 2.16, renderRadius * 1.84);
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.08), 0.16);
        this.graphics.fillEllipse(screen.x, screen.y, renderRadius * 1.2, renderRadius * 1.02);
        this.graphics.lineStyle(2.4, enemyStroke, 0.32);
        this.graphics.strokeEllipse(screen.x, screen.y, renderRadius * 2.32, renderRadius * 2);
        }
      } else if (enemy.archetype === 'skirmisher') {
        if (!enemyPreviewRendered) {
        const tipReach = renderRadius + 8 * cameraScale;
        const wingReach = renderRadius + 4 * cameraScale;
        this.graphics.fillTriangle(
          screen.x + Math.cos(faceAngle) * tipReach,
          screen.y + Math.sin(faceAngle) * tipReach,
          screen.x + Math.cos(faceAngle + 2.32) * wingReach,
          screen.y + Math.sin(faceAngle + 2.32) * wingReach,
          screen.x + Math.cos(faceAngle - 2.32) * wingReach,
          screen.y + Math.sin(faceAngle - 2.32) * wingReach,
        );
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.12), 0.16);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(3.2 * cameraScale, renderRadius * 0.32));
        this.graphics.lineStyle(2, enemyStroke, 0.34);
        this.graphics.strokeTriangle(
          screen.x + Math.cos(faceAngle) * (tipReach + 2 * cameraScale),
          screen.y + Math.sin(faceAngle) * (tipReach + 2 * cameraScale),
          screen.x + Math.cos(faceAngle + 2.34) * (wingReach + 2 * cameraScale),
          screen.y + Math.sin(faceAngle + 2.34) * (wingReach + 2 * cameraScale),
          screen.x + Math.cos(faceAngle - 2.34) * (wingReach + 2 * cameraScale),
          screen.y + Math.sin(faceAngle - 2.34) * (wingReach + 2 * cameraScale),
        );
        }
      } else {
        this.graphics.fillCircle(screen.x, screen.y, renderRadius);
        this.graphics.fillStyle(this.mixColor(enemyFill, 0xffffff, 0.08), 0.14);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(3.6 * cameraScale, renderRadius * 0.36));
        this.graphics.lineStyle(2, enemyStroke, 0.26);
        this.graphics.strokeCircle(screen.x, screen.y, renderRadius + 4 * cameraScale);
        if (enemy.archetype === 'standard' && enemy.role === 'regular') {
          this.renderRuntimePreviewImage(
            PREVIEW_STANDARD_ENEMY_TEXTURE,
            screen.x,
            screen.y,
            renderRadius * 3.1,
            faceAngle + Math.PI / 2,
            0.78,
          );
        }
      }

      if (!enemy.elite && enemy.role === 'escort') {
        // 只使用图片素材
        this.renderRuntimePreviewImage(
          PREVIEW_ELITE_ESCORT_TEXTURE,
          screen.x,
          screen.y,
          renderRadius * 3.4,
          faceAngle + Math.PI / 2,
          0.76,
        );
      }

      if (!enemy.elite && enemy.archetype === 'skirmisher') {
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
          const spawnGlowRadius = enemy.radius + 11 + spawnRatio * 5;
          this.graphics.lineStyle(1.6, enemyStroke, 0.06 + spawnRatio * 0.12);
          this.graphics.strokeCircle(screen.x, screen.y, spawnGlowRadius);
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
        if (pressureRatio > 0) {
          this.graphics.lineStyle(3, enemyStroke, 0.1 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 11 + pressureRatio * 4);
        }
      }

      if (!enemy.elite && enemy.archetype === 'ranged') {
        const lockRatio = Phaser.Math.Clamp(1 - enemy.rangedCooldownSec / 0.85, 0, 1);
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
        if (pressureRatio > 0) {
          this.graphics.lineStyle(1.5, enemyStroke, 0.12 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 16 + pressureRatio * 5);
        }
      }

      // Standard敌人的装饰性线段已删除

      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.elite && battle.encounterType === 'boss') {
        const barWidth = 92;
        const barX = screen.x - barWidth * 0.5;
        const barY = screen.y - renderRadius - 24 * actorScale;
        this.graphics.fillStyle(0x231b14, 0.92);
        this.graphics.fillRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 1);
        this.graphics.fillRoundedRect(barX, barY, barWidth * hpRatio, 6, 3);
        this.graphics.lineStyle(2, 0xffd774, 0.5);
        this.graphics.strokeRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 0.96);
        this.graphics.fillTriangle(screen.x, barY - 10, screen.x - 7, barY - 1, screen.x + 7, barY - 1);
        if (battle.pressureSignatureLabel && battle.pressureSignatureSec > 0) {
          const bossSignatureRatio = Math.min(1, battle.pressureSignatureSec / 3.8);
          const bossSignatureColor = this.mixColor(accentColor, 0xffefbf, 0.4);
          const bossSignatureReach = enemy.radius + 14 + bossSignatureRatio * 6;
          this.graphics.lineStyle(2.8, bossSignatureColor, 0.16 + bossSignatureRatio * 0.22);
          this.graphics.strokeCircle(screen.x, screen.y, bossSignatureReach);
          this.graphics.lineStyle(1.6, bossSignatureColor, 0.12 + bossSignatureRatio * 0.12);
          this.graphics.lineBetween(screen.x - bossSignatureReach, screen.y, screen.x - bossSignatureReach + 10, screen.y);
          this.graphics.lineBetween(screen.x + bossSignatureReach - 10, screen.y, screen.x + bossSignatureReach, screen.y);
        }
      } else {
        this.graphics.fillStyle(0x1b1612, 0.84);
        this.graphics.fillRect(screen.x - 16 * actorScale, screen.y - renderRadius - 10 * actorScale, 32 * actorScale, 4 * actorScale);
        this.graphics.fillStyle(enemy.elite ? 0xffdd7d : enemyStroke, 1);
        this.graphics.fillRect(screen.x - 16 * actorScale, screen.y - renderRadius - 10 * actorScale, 32 * actorScale * hpRatio, 4 * actorScale);
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

      if (liveFocusRoute === 'crit' && activeRoutePerks?.critBridgeFocus && battle.critFocusTargetId === enemy.id && battle.critFocusLockSec > 0) {
        const critPayoffRatio = battle.critBurstBonusSec > 0 ? Math.min(1, battle.critBurstBonusSec / 2.8) : 0;
        const critChainRatio = battle.critBurstChainSec > 0 ? Math.min(1, battle.critBurstChainSec / 2.0) : 0;
        const focusAlpha = Phaser.Math.Clamp((battle.critFocusLockSec / 1.8) + critPayoffRatio * 0.08 + critChainRatio * 0.04, 0.12, 0.62);
        const focusPulse = 0.5 + Math.sin(battle.elapsedSec * 5.2) * 0.5;
        const focusColor = this.mixColor(0xff9050, accentColor, 0.3 + focusPulse * 0.15);
        const focusReach = enemy.radius + 8 + focusPulse * 3 + critPayoffRatio * 2;
        this.graphics.lineStyle(2.5, focusColor, focusAlpha);
        this.graphics.strokeCircle(screen.x, screen.y, focusReach);
        this.graphics.lineStyle(1.5, focusColor, focusAlpha * 0.6);
        const focusAngle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
        for (let tick = 0; tick < 4; tick += 1) {
          const a = focusAngle + tick * Math.PI * 0.5 + battle.elapsedSec * 1.8;
          const innerR = focusReach - 4;
          const outerR = focusReach + 4;
          this.graphics.lineBetween(
            screen.x + Math.cos(a) * innerR,
            screen.y + Math.sin(a) * innerR,
            screen.x + Math.cos(a) * outerR,
            screen.y + Math.sin(a) * outerR,
          );
        }
        if (enemy.elite || (enemy.critMarkSec > 0 && (enemy.critMarkStacks ?? 0) >= 2) || critPayoffRatio > 0 || critChainRatio > 0) {
          this.graphics.lineStyle(2, focusColor, focusAlpha * 0.8);
          this.graphics.strokeCircle(screen.x, screen.y, focusReach + 6 + critPayoffRatio * 4 + critChainRatio * 2);
        }
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
    const critBurstRatio = battle.critBurstBonusSec > 0 ? Math.min(1, battle.critBurstBonusSec / 2.5) : 0;
    const critChainRatio = battle.critBurstChainSec > 0 ? Math.min(1, battle.critBurstChainSec / 2.0) : 0;
    const dashDriveRatio = battle.dashDriveSec > 0 ? Math.min(1, battle.dashDriveSec / 1.15) : 0;
    const freezeRatio = battle.impactFreezeSec > 0 ? Math.min(1, battle.impactFreezeSec / 0.09) : 0;
    const shotFlashRatio = battle.playerShotFlashSec > 0 ? Math.min(1, battle.playerShotFlashSec / 0.08) : 0;
    const shotRecoilRatio = battle.playerShotRecoilSec > 0 ? Math.min(1, battle.playerShotRecoilSec / 0.11) : 0;
    const moveBoostRatio = battle.playerMoveBoostSec > 0 ? Math.min(1, battle.playerMoveBoostSec / 0.18) : 0;
    const turnBurstRatio = battle.playerTurnBurstSec > 0 ? Math.min(1, battle.playerTurnBurstSec / 0.14) : 0;
    const nearMissRatio = battle.playerNearMissSec > 0 ? Math.min(1, battle.playerNearMissSec / 0.14) : 0;
    const damageFlashRatio = battle.playerDamageFlashSec > 0 ? Math.min(1, battle.playerDamageFlashSec / 0.34) : 0;
    const hpRatio = engineState.stats.hp / Math.max(1, engineState.stats.maxHp);
    const lowHpRatio = Phaser.Math.Clamp((0.46 - hpRatio) / 0.46, 0, 1);
    const criticalHpRatio = Phaser.Math.Clamp((0.24 - hpRatio) / 0.24, 0, 1);
    const dangerPulse = 0.5 + Math.sin(battle.elapsedSec * 6.3 + battle.kills * 0.12) * 0.5;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const moveDirX = moveMagnitude > 0.01 ? battle.playerMoveDirX / moveMagnitude : 0;
    const moveDirY = moveMagnitude > 0.01 ? battle.playerMoveDirY / moveMagnitude : 0;
    const velocityMagnitude = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    const velocityRatio = Phaser.Math.Clamp(velocityMagnitude / Math.max(1, getPlayerMoveSpeed(engineState.stats) * 1.16), 0, 1);
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
    const recoilOffset = shotRecoilRatio * battle.playerShotRecoilStrength;
    const bodyX = playerScreen.x - aimDirX * recoilOffset;
    const bodyY = playerScreen.y - aimDirY * recoilOffset;
    const muzzleX = bodyX + aimDirX * (16 + shotFlashRatio * 10);
    const muzzleY = bodyY + aimDirY * (16 + shotFlashRatio * 10);
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
    this.graphics.fillEllipse(bodyX, bodyY + 18 * actorScale, 34 * actorScale, 14 * actorScale);
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
    if (velocityRatio > 0.08 || moveBoostRatio > 0.08) {
      const trailDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const trailDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const trailOrthoX = -trailDirY;
      const trailOrthoY = trailDirX;
      const trailColor = this.mixColor(liveFocusColor, 0xe9ffff, 0.22 + moveBoostRatio * 0.16);
      for (let streak = 0; streak < 1; streak += 1) {
        const offset = 14 + streak * (10 + velocityRatio * 8);
        const width = 7 + streak * 2 + moveBoostRatio * 4;
        this.graphics.fillStyle(trailColor, 0.018 + velocityRatio * 0.025 + moveBoostRatio * 0.03);
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
if (liveFocusRoute === 'crit' && (critAuraRatio > 0.12 || critBurstRatio > 0.08 || critChainRatio > 0.08)) {
const critPulse = 0.5 + Math.sin(battle.elapsedSec * 7.6) * 0.5;
const critAuraColor = this.mixColor(0xff7a1a, 0xffe4a3, 0.28 + critBurstRatio * 0.18);
const auraReach = 30 + critAuraRatio * 14 + critBurstRatio * 18;
// 橙色发光填充
this.graphics.fillStyle(critAuraColor, 0.04 + critAuraRatio * 0.06 + critBurstRatio * 0.04);
this.graphics.fillCircle(bodyX, bodyY, auraReach * 0.85);
this.renderDiamondOutline(bodyX, bodyY, auraReach, critAuraColor, 0.2 + critAuraRatio * 0.25 + critBurstRatio * 0.15, 3);
this.renderTargetBrackets(bodyX, bodyY, 22 + critPulse * 6 + critBurstRatio * 12, 6, critAuraColor, 0.12 + critChainRatio * 0.2);
}
if (liveFocusRoute === 'dash' && (dashDriveRatio > 0.12 || velocityRatio > 0.18)) {
const dashAuraColor = this.mixColor(0x2eff5e, 0xffffff, 0.18 + dashDriveRatio * 0.14);
const dashArcRadius = 24 + dashDriveRatio * 16 + velocityRatio * 6;
// 绿色发光填充
this.graphics.fillStyle(dashAuraColor, 0.05 + dashDriveRatio * 0.08);
this.graphics.fillCircle(bodyX, bodyY, dashArcRadius * 0.8);
this.graphics.lineStyle(3, dashAuraColor, 0.15 + dashDriveRatio * 0.25);
      this.graphics.beginPath();
      this.graphics.arc(bodyX, bodyY, dashArcRadius, -0.7, 0.7, false);
      this.graphics.strokePath();
      this.graphics.beginPath();
      this.graphics.arc(bodyX, bodyY, dashArcRadius, Math.PI - 0.3, Math.PI + 0.9, false);
      this.graphics.strokePath();
      if (dashDriveRatio > 0.2) {
        const sweepAlpha = 0.12 + dashDriveRatio * 0.18;
        const sweepRadius = dashArcRadius + 10 + battle.dashMomentumStacks * 2;
        this.graphics.lineStyle(3.2, this.mixColor(0x66ffd4, 0xffffff, 0.22), sweepAlpha);
        this.graphics.beginPath();
        this.graphics.arc(bodyX, bodyY, sweepRadius, -1.2, -0.2, false);
        this.graphics.strokePath();
        this.graphics.beginPath();
        this.graphics.arc(bodyX, bodyY, sweepRadius, 0.2, 1.2, false);
        this.graphics.strokePath();
        this.graphics.fillStyle(0x8effdc, 0.08 + dashDriveRatio * 0.08);
        this.graphics.fillCircle(bodyX, bodyY, 20 + dashDriveRatio * 10 + battle.dashMomentumStacks * 2);
      }
    }
    if (turnBurstRatio > 0.08) {
      // Trigger particle effect on turn burst start
      if (this.lastTurnBurstSec === 0 && battle.playerTurnBurstSec > 0) {
        const turnAngle = Math.atan2(-moveDirY, -moveDirX);
        const particleColor = this.mixColor(0xbef7ff, liveFocusColor, 0.28);
        for (let i = 0; i < 3; i++) {
          const angle = turnAngle + (Math.random() - 0.5) * 1.05;
          const speed = 50 + Math.random() * 100;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const particle = this.add.circle(bodyX, bodyY, 1.6 + Math.random() * 1.2, particleColor, 0.28);
          particle.setDepth(-1);
          this.tweens.add({
            targets: particle,
            x: bodyX + vx * 0.3,
            y: bodyY + vy * 0.3,
            alpha: 0,
            scale: 0.3,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => particle.destroy(),
          });
        }
      }

      const skidColor = this.mixColor(0xbef7ff, liveFocusColor, 0.28);
      this.graphics.lineStyle(1.4, skidColor, 0.05 + turnBurstRatio * 0.12);
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
    // Route signatures stay on enemies and projectiles; the player silhouette stays clean.
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

    // Kill Streak screen edge glow
    if (battle.killStreakCount >= 2) {
      const streakRatio = Math.min(1, (battle.killStreakCount - 2) / 8); // 0 at 2 kills, 1 at 10+ kills
      const streakPulse = Math.sin(this.time.now * 0.008) * 0.5 + 0.5;
      const streakColor = this.mixColor(0xffd700, 0xffffff, 0.3); // Golden glow
      const outerAlpha = 0.12 + streakRatio * 0.1 + streakPulse * streakRatio * 0.04;
      const innerAlpha = 0.01 + streakRatio * 0.025;
      const edgeDepth = 16 + streakRatio * 10;

      this.graphics.fillGradientStyle(
        streakColor,
        streakColor,
        streakColor,
        streakColor,
        outerAlpha,
        outerAlpha,
        innerAlpha,
        innerAlpha,
      );
      this.graphics.fillRect(0, 0, camera.width, edgeDepth);

      this.graphics.fillGradientStyle(
        streakColor,
        streakColor,
        streakColor,
        streakColor,
        innerAlpha,
        innerAlpha,
        outerAlpha,
        outerAlpha,
      );
      this.graphics.fillRect(0, camera.height - edgeDepth, camera.width, edgeDepth);

      this.graphics.fillGradientStyle(
        streakColor,
        streakColor,
        streakColor,
        streakColor,
        outerAlpha,
        innerAlpha,
        outerAlpha,
        innerAlpha,
      );
      this.graphics.fillRect(0, 0, edgeDepth, camera.height);

      this.graphics.fillGradientStyle(
        streakColor,
        streakColor,
        streakColor,
        streakColor,
        innerAlpha,
        outerAlpha,
        innerAlpha,
        outerAlpha,
      );
      this.graphics.fillRect(camera.width - edgeDepth, 0, edgeDepth, camera.height);

      const innerInset = 6 + streakRatio * 4;
      const innerLineAlpha = 0.12 + streakRatio * 0.16 + streakPulse * 0.04;
      this.graphics.lineStyle(1.6 + streakRatio * 1.2, streakColor, innerLineAlpha);
      this.graphics.strokeRect(
        innerInset,
        innerInset,
        Math.max(0, camera.width - innerInset * 2),
        Math.max(0, camera.height - innerInset * 2),
      );

      // Corner accents for high streaks
      if (battle.killStreakCount >= 5) {
        const cornerInset = 4;
        const cornerLength = 22 + streakRatio * 10;
        this.graphics.lineStyle(2 + streakRatio * 1.2, streakColor, 0.18 + streakRatio * 0.18 + streakPulse * 0.06);
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
      }
    }

    // Kill Streak combo counter text — display large combo number on screen
    if (battle.killStreakCount >= 3) {
      const streakRatio = Math.min(1, (battle.killStreakCount - 3) / 7); // 0 at 3 kills, 1 at 10+
      const streakPulse = Math.sin(this.time.now * 0.012) * 0.5 + 0.5;
      const comboScale = 1 + streakRatio * 0.4 + streakPulse * streakRatio * 0.15;
      const comboAlpha = 0.6 + streakRatio * 0.35 + streakPulse * 0.05;

      if (!this.killStreakText) {
        this.killStreakText = this.add.text(0, 0, '', {
          fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 5,
        });
        this.killStreakText.setOrigin(1, 0); // Right-aligned, top-aligned to keep within screen bounds
        this.killStreakText.setDepth(180);
      }

      // Position: below the pause button (top-right corner), right-aligned with padding
      const comboX = camera.width - 16;
      const comboY = 56;

      this.killStreakText
        .setText(`${battle.killStreakCount} 连击!`)
        .setPosition(comboX, comboY)
        .setScale(comboScale)
        .setAlpha(comboAlpha)
        .setVisible(true);

      // Draw a subtle backing circle behind the combo text (offset for right-aligned origin)
      const textWidth = this.killStreakText.width * comboScale;
      const circleX = comboX - textWidth * 0.5;
      const circleY = comboY + this.killStreakText.height * comboScale * 0.5;
      const backRadius = 36 + streakRatio * 12;
      this.graphics.lineStyle(2 + streakRatio * 1.5, 0xffd700, 0.1 + streakRatio * 0.2 + streakPulse * 0.06);
      this.graphics.strokeCircle(circleX, circleY, backRadius);
      this.graphics.fillStyle(0xffd700, 0.02 + streakRatio * 0.04);
      this.graphics.fillCircle(circleX, circleY, backRadius * 0.8);
    } else {
      if (this.killStreakText) {
        this.killStreakText.setVisible(false);
      }
    }

    // Route state is now expressed by enemy hit VFX instead of extra player-side gauges.

    // The old top-center yellow upgrade bar was ambiguous during battle start,
    // so we now rely on the upgrade choice panel itself rather than re-showing
    // an unlabeled overlay after combat resumes.

    if (battle.invulnerableSec > 0 || freezeRatio > 0.08) {
      const isInvuln = battle.invulnerableSec > 0;
      const invulnRatio = Math.min(1, battle.invulnerableSec / 0.35);
      const shieldColor = isInvuln ? 0x4cff6a : this.mixColor(liveFocusColor, 0xffffff, 0.16);
      // 外层发光环
      this.graphics.lineStyle(
        4 + freezeRatio * 1.2,
        shieldColor,
        isInvuln ? 0.4 + invulnRatio * 0.3 : 0.1 + freezeRatio * 0.12,
      );
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 20 + freezeRatio * 5);
      // 内层亮环
      if (isInvuln) {
        this.graphics.lineStyle(2, 0xeaffd8, 0.25 + invulnRatio * 0.3);
        this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 14 + invulnRatio * 3);
        // 无敌时绿色发光填充
        this.graphics.fillStyle(0x4cff6a, 0.06 + invulnRatio * 0.08);
        this.graphics.fillCircle(playerScreen.x, playerScreen.y, 24 + invulnRatio * 6);
      }
    }
    this.graphics.fillStyle(
      impactRatio > 0
        ? this.mixColor(0xf8fbff, 0xff8c86, impactRatio * 0.8)
        : battle.invulnerableSec > 0
          ? 0x5cff7a
          : 0xf8fbff,
      1,
    );
    if (shotFlashRatio > 0) {
      this.lastShotFlashSec = battle.playerShotFlashSec;

      // Get fire rate to adjust muzzle flash
      const state = this.engine.getState();
      const fireRate = state.stats.fireRate;

      // Calculate fire rate tier (baseline is 1.0)
      // Low fire rate (< 1.5): Large, orange-red flash
      // Medium fire rate (1.5-3.0): Standard flash
      // High fire rate (> 3.0): Small, blue-white flash
      const fireRateTier = fireRate < 1.5 ? 'low' : fireRate > 3.0 ? 'high' : 'medium';

      // Adjust flash size based on fire rate
      const sizeMultiplier = fireRateTier === 'low' ? 1.4 : fireRateTier === 'high' ? 0.7 : 1.0;

      // Adjust flash color based on fire rate
      let flashColor: number;
      if (fireRateTier === 'low') {
        // Low fire rate: Orange-red, powerful
        flashColor = liveFocusRoute === 'crit'
          ? this.mixColor(0xff8844, 0xffaa44, 0.3)
          : liveFocusRoute === 'pierce'
            ? this.mixColor(0xff9966, 0xffbb88, 0.3)
            : liveFocusRoute === 'dash'
              ? this.mixColor(0xff9955, 0xffbb77, 0.3)
              : 0xffaa66;
      } else if (fireRateTier === 'high') {
        // High fire rate: Blue-white, rapid
        flashColor = liveFocusRoute === 'crit'
          ? this.mixColor(0xaaddff, 0xffffff, 0.4)
          : liveFocusRoute === 'pierce'
            ? this.mixColor(0x88ccff, 0xffffff, 0.4)
            : liveFocusRoute === 'dash'
              ? this.mixColor(0x99ddff, 0xffffff, 0.4)
              : 0xccf0ff;
      } else {
        // Medium fire rate: Standard colors
        flashColor = liveFocusRoute === 'crit'
          ? this.mixColor(0xffcf76, 0xffffff, 0.24)
          : liveFocusRoute === 'pierce'
            ? this.mixColor(0x98dcff, 0xffffff, 0.26)
            : liveFocusRoute === 'dash'
              ? this.mixColor(0x8effde, 0xffffff, 0.24)
              : 0xf8fbff;
      }

      this.graphics.fillStyle(flashColor, 0.18 + shotFlashRatio * 0.3);
      this.graphics.fillTriangle(
        muzzleX + aimDirX * (14 + shotFlashRatio * 16 * sizeMultiplier),
        muzzleY + aimDirY * (14 + shotFlashRatio * 16 * sizeMultiplier),
        bodyX + aimOrthoX * (5 + shotFlashRatio * 8 * sizeMultiplier),
        bodyY + aimOrthoY * (5 + shotFlashRatio * 8 * sizeMultiplier),
        bodyX - aimOrthoX * (5 + shotFlashRatio * 8 * sizeMultiplier),
        bodyY - aimOrthoY * (5 + shotFlashRatio * 8 * sizeMultiplier),
      );
      if (liveFocusRoute === 'pierce') {
        const pierceRailColor = this.mixColor(0x98dcff, 0xffffff, 0.28);
        const railOffset = 8 + shotFlashRatio * 6;
        this.graphics.lineStyle(2, pierceRailColor, 0.12 + shotFlashRatio * 0.22);
        this.graphics.lineBetween(
          bodyX + aimOrthoX * railOffset,
          bodyY + aimOrthoY * railOffset,
          muzzleX + aimDirX * (20 + shotFlashRatio * 18 * sizeMultiplier) + aimOrthoX * railOffset,
          muzzleY + aimDirY * (20 + shotFlashRatio * 18 * sizeMultiplier) + aimOrthoY * railOffset,
        );
        this.graphics.lineBetween(
          bodyX - aimOrthoX * railOffset,
          bodyY - aimOrthoY * railOffset,
          muzzleX + aimDirX * (20 + shotFlashRatio * 18 * sizeMultiplier) - aimOrthoX * railOffset,
          muzzleY + aimDirY * (20 + shotFlashRatio * 18 * sizeMultiplier) - aimOrthoY * railOffset,
        );
        this.graphics.lineStyle(1.4, pierceRailColor, 0.08 + shotFlashRatio * 0.16);
        this.graphics.lineBetween(
          bodyX,
          bodyY,
          muzzleX + aimDirX * (28 + shotFlashRatio * 20 * sizeMultiplier),
          muzzleY + aimDirY * (28 + shotFlashRatio * 20 * sizeMultiplier),
        );
      } else {
        this.graphics.lineStyle(2, flashColor, 0.14 + shotFlashRatio * 0.24);
        this.graphics.lineBetween(
          bodyX + aimOrthoX * 7,
          bodyY + aimOrthoY * 7,
          muzzleX + aimDirX * (20 + shotFlashRatio * 18 * sizeMultiplier),
          muzzleY + aimDirY * (20 + shotFlashRatio * 18 * sizeMultiplier),
        );
        this.graphics.lineBetween(
          bodyX - aimOrthoX * 7,
          bodyY - aimOrthoY * 7,
          muzzleX + aimDirX * (20 + shotFlashRatio * 18 * sizeMultiplier),
          muzzleY + aimDirY * (20 + shotFlashRatio * 18 * sizeMultiplier),
        );
        this.graphics.lineStyle(1.6, flashColor, 0.12 + shotFlashRatio * 0.22);
        this.graphics.lineBetween(
          muzzleX + aimOrthoX * (4 + shotFlashRatio * 3),
          muzzleY + aimOrthoY * (4 + shotFlashRatio * 3),
          muzzleX + aimDirX * (30 + shotFlashRatio * 24 * sizeMultiplier) + aimOrthoX * (10 + shotFlashRatio * 6),
          muzzleY + aimDirY * (30 + shotFlashRatio * 24 * sizeMultiplier) + aimOrthoY * (10 + shotFlashRatio * 6),
        );
        this.graphics.lineBetween(
          muzzleX - aimOrthoX * (4 + shotFlashRatio * 3),
          muzzleY - aimOrthoY * (4 + shotFlashRatio * 3),
          muzzleX + aimDirX * (30 + shotFlashRatio * 24 * sizeMultiplier) - aimOrthoX * (10 + shotFlashRatio * 6),
          muzzleY + aimDirY * (30 + shotFlashRatio * 24 * sizeMultiplier) - aimOrthoY * (10 + shotFlashRatio * 6),
        );
      }

      // Add muzzle smoke effect for low fire rate
      if (fireRateTier === 'low' && shotFlashRatio > 0.3) {
        this.graphics.fillStyle(0x888888, 0.08 + shotFlashRatio * 0.12);
        this.graphics.fillCircle(
          muzzleX + aimDirX * (20 + shotFlashRatio * 10),
          muzzleY + aimDirY * (20 + shotFlashRatio * 10),
          6 + shotFlashRatio * 8
        );
      }

    }

    // 不再在玩家周围生成常驻移动圆环，避免与敌方预警线混淆。

    // Ground interaction effects
    // Dash burst effect when dash starts
    if (battle.dashDriveSec > 0 && this.lastDashDriveSec === 0) {
      // Dash just started - create a readable burst around the player.
      const burstColor = 0x00d4ff;
      const particleCount = 7;

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 14 + Math.random() * 10;
        const targetX = bodyX + Math.cos(angle) * distance;
        const targetY = bodyY + Math.sin(angle) * distance;

        const particle = this.add.circle(bodyX, bodyY, 2.8 + Math.random() * 1.4, burstColor, 0.34);
        particle.setDepth(-1);

        this.tweens.add({
          targets: particle,
          x: targetX,
          y: targetY,
          alpha: 0,
          scale: 0.3,
          duration: 180,
          ease: 'Cubic.easeOut',
          onComplete: () => particle.destroy(),
        });
      }
      this.graphics.lineStyle(3.4, 0x7ef7da, 0.24);
      this.graphics.strokeCircle(bodyX, bodyY, 22 + battle.dashMomentumStacks * 3);
      this.graphics.lineStyle(1.8, 0xeafff8, 0.18);
      this.graphics.strokeCircle(bodyX, bodyY, 34 + battle.dashMomentumStacks * 4);
    }

    // Enhanced ground trail during dash
    if (dashDriveRatio > 0.3 && velocityMagnitude > 150) {
      const scorchAlpha = 0.08 + dashDriveRatio * 0.08;
      const scorchSize = 5 + dashDriveRatio * 4;
      const driftDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const driftDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const driftOrthoX = -driftDirY;
      const driftOrthoY = driftDirX;

      this.graphics.fillStyle(0x00d4ff, scorchAlpha);
      this.graphics.fillCircle(bodyX, bodyY, scorchSize);
      this.graphics.fillStyle(0x8effdc, 0.06 + dashDriveRatio * 0.07);
      this.graphics.fillTriangle(
        bodyX - driftDirX * 22 + driftOrthoX * 8,
        bodyY - driftDirY * 22 + driftOrthoY * 8,
        bodyX + driftDirX * 6,
        bodyY + driftDirY * 6,
        bodyX - driftDirX * 22 - driftOrthoX * 8,
        bodyY - driftDirY * 22 - driftOrthoY * 8,
      );
    }

    // 流派反馈放到敌人受击层，玩家身上不再叠加常驻充能环。

    this.graphics.fillCircle(bodyX, bodyY, (10 + velocityRatio * 0.8) * actorScale);
    this.renderRuntimePreviewImage(PREVIEW_PLAYER_TEXTURE, bodyX, bodyY, (48 + velocityRatio * 4) * actorScale, Math.atan2(aimDirY, aimDirX) + Math.PI / 2, 0.78);
    const playerBarWidth = 40 * actorScale;
    const playerBarHeight = 6 * actorScale;
    const playerBarX = playerScreen.x - playerBarWidth * 0.5;
    const playerBarY = playerScreen.y - 30 * actorScale;
    const playerBarColor =
      hpRatio <= 0.35 ? 0xff6d62 : hpRatio <= 0.68 ? 0xffc65a : 0x59da78;
    this.graphics.fillStyle(0x22160f, 0.82);
    this.graphics.fillRoundedRect(playerBarX, playerBarY, playerBarWidth, playerBarHeight, 3);
    this.graphics.fillStyle(playerBarColor, 1);
    this.graphics.fillRoundedRect(playerBarX, playerBarY, playerBarWidth * hpRatio, playerBarHeight, 3);
    this.graphics.lineStyle(1.2, 0xf4f0e6, 0.36);
    this.graphics.strokeRoundedRect(playerBarX, playerBarY, playerBarWidth, playerBarHeight, 3);

    // 穿梭为自动触发，不在角色旁显示冷却条，避免误导为可按键技能。

    // Update turn burst tracking
    this.lastTurnBurstSec = battle.playerTurnBurstSec;

    // Camera zoom effects stay disabled to avoid motion sickness.
    if (this.cameras.main.zoom !== 1) {
      this.cameras.main.setZoom(1);
    }
    this.lastDashDriveSec = battle.dashDriveSec;

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

  private renderDiamondOutline(
    centerX: number,
    centerY: number,
    radius: number,
    color: number,
    alpha: number,
    width: number,
  ): void {
    this.graphics.lineStyle(width, color, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(centerX, centerY - radius);
    this.graphics.lineTo(centerX + radius, centerY);
    this.graphics.lineTo(centerX, centerY + radius);
    this.graphics.lineTo(centerX - radius, centerY);
    this.graphics.closePath();
    this.graphics.strokePath();
  }

  private renderTargetBrackets(
    centerX: number,
    centerY: number,
    radius: number,
    size: number,
    color: number,
    alpha: number,
  ): void {
    this.graphics.lineStyle(2, color, alpha);
    this.graphics.lineBetween(centerX - radius, centerY - size, centerX - radius + size, centerY - size);
    this.graphics.lineBetween(centerX - radius, centerY - size, centerX - radius, centerY + size);
    this.graphics.lineBetween(centerX + radius, centerY - size, centerX + radius - size, centerY - size);
    this.graphics.lineBetween(centerX + radius, centerY - size, centerX + radius, centerY + size);
    this.graphics.lineBetween(centerX - radius, centerY + size, centerX - radius + size, centerY + size);
    this.graphics.lineBetween(centerX - radius, centerY + size, centerX - radius, centerY - size);
    this.graphics.lineBetween(centerX + radius, centerY + size, centerX + radius - size, centerY + size);
    this.graphics.lineBetween(centerX + radius, centerY + size, centerX + radius, centerY - size);
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
    const pulseColor = this.mixColor(this.services.configLoader.getBattleTemplate(battle.templateId).accent, 0xffefbf, 0.34);
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

    if (battle.encounterType === 'boss') {
      const bossSignatureRatio = battle.pressureSignatureSec > 0 ? Math.min(1, battle.pressureSignatureSec / 3.6) : 0;
      const bossPatternRatio = battle.pressurePatternFlashSec > 0 ? Math.min(1, battle.pressurePatternFlashSec / 0.72) : 0;
      const bossPulseRatio = Math.min(1, battle.pressurePatternPulseCount / 4);
      const bossStageRatio = Math.max(bossSignatureRatio, bossPatternRatio, bossPulseRatio);
      if (bossStageRatio > 0) {
        const bossColor = this.mixColor(this.services.configLoader.getBattleTemplate(battle.templateId).accent, 0xffefbf, 0.34);
        const stageAlpha = 0.14 + bossStageRatio * 0.2;
        const stageReach = elite.radius + 24 + bossStageRatio * 14;
        this.graphics.lineStyle(2.4, bossColor, stageAlpha);
        this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, stageReach);
        this.graphics.lineStyle(1.6, bossColor, stageAlpha * 0.82);

        switch (battle.pressurePatternMode) {
          case 'laneCrush': {
            const offset = elite.radius + 22 + bossPulseRatio * 8;
            const laneLength = stageReach + 18;
            this.graphics.lineBetween(eliteScreen.x - offset, eliteScreen.y - laneLength, eliteScreen.x - offset, eliteScreen.y + laneLength);
            this.graphics.lineBetween(eliteScreen.x + offset, eliteScreen.y - laneLength, eliteScreen.x + offset, eliteScreen.y + laneLength);
            this.graphics.lineBetween(eliteScreen.x - offset - 12, eliteScreen.y - 6, eliteScreen.x + offset + 12, eliteScreen.y - 6);
            this.graphics.lineBetween(eliteScreen.x - offset - 12, eliteScreen.y + 6, eliteScreen.x + offset + 12, eliteScreen.y + 6);
            break;
          }
          case 'sideClamp': {
            const reachX = elite.radius + 42 + bossPulseRatio * 14;
            const reachY = elite.radius + 18 + bossPulseRatio * 8;
            this.graphics.lineBetween(eliteScreen.x - reachX, eliteScreen.y - reachY, eliteScreen.x - 12, eliteScreen.y);
            this.graphics.lineBetween(eliteScreen.x - reachX, eliteScreen.y + reachY, eliteScreen.x - 12, eliteScreen.y);
            this.graphics.lineBetween(eliteScreen.x + reachX, eliteScreen.y - reachY, eliteScreen.x + 12, eliteScreen.y);
            this.graphics.lineBetween(eliteScreen.x + reachX, eliteScreen.y + reachY, eliteScreen.x + 12, eliteScreen.y);
            this.graphics.lineBetween(eliteScreen.x - reachX, eliteScreen.y, eliteScreen.x + reachX, eliteScreen.y);
            break;
          }
          case 'crossfireWave':
          default: {
            const crossReach = elite.radius + 40 + bossPulseRatio * 14;
            this.graphics.lineBetween(eliteScreen.x - crossReach, eliteScreen.y - crossReach * 0.72, eliteScreen.x + crossReach, eliteScreen.y + crossReach * 0.72);
            this.graphics.lineBetween(eliteScreen.x - crossReach, eliteScreen.y + crossReach * 0.72, eliteScreen.x + crossReach, eliteScreen.y - crossReach * 0.72);
            this.graphics.lineBetween(eliteScreen.x - crossReach * 0.92, eliteScreen.y, eliteScreen.x + crossReach * 0.92, eliteScreen.y);
            break;
          }
        }

        for (const escort of escorts.slice(0, 3)) {
          const escortScreen = this.worldToScreen(camera, escort.enemy.x, escort.enemy.y);
          this.graphics.lineStyle(1.2, bossColor, stageAlpha * 0.6);
          this.graphics.lineBetween(eliteScreen.x, eliteScreen.y, escortScreen.x, escortScreen.y);
          this.graphics.fillStyle(bossColor, stageAlpha * 0.34);
          this.graphics.fillCircle(escortScreen.x, escortScreen.y, escort.enemy.radius + 4 + bossStageRatio * 2);
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
      const chaseAngle = Math.atan2(chaseDirY, chaseDirX);
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
      // The old chase guide drew long player-side lines/rings and read like a
      // stray route layer, so the breach is now shown only near enemies.
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
            if (battle.critFinisherReady || battle.critBurstChainSec > 0 || battle.critBurstBonusSec > 0) {
              const payoffRatio = Math.max(
                Math.min(1, battle.critBurstChainSec / 2.0),
                Math.min(1, battle.critBurstBonusSec / 2.5),
                Math.min(1, battle.critComboStacks / 5),
              );
              const payoffReach = elite.radius + 28 + eliteCrackRatio * 12 + payoffRatio * 6;
              this.graphics.lineStyle(2.4, focusColor, focusAlpha * (0.82 + payoffRatio * 0.12));
              this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, payoffReach);
              const nearbyPayoffEnemies = battle.enemies
                .filter((candidate) => !candidate.elite && candidate.hp > 0)
                .map((candidate) => ({
                  enemy: candidate,
                  distance: Math.hypot(candidate.x - elite.x, candidate.y - elite.y),
                }))
                .filter((entry) => entry.distance <= 180)
                .sort((left, right) => left.distance - right.distance)
                .slice(0, 3);
              for (const [index, entry] of nearbyPayoffEnemies.entries()) {
                const burstScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
                const burstAlpha = focusAlpha * (0.52 - index * 0.1);
                this.graphics.lineStyle(1.4, focusColor, burstAlpha);
                this.graphics.lineBetween(eliteScreen.x, eliteScreen.y, burstScreen.x, burstScreen.y);
                this.graphics.strokeCircle(
                  burstScreen.x,
                  burstScreen.y,
                  entry.enemy.radius + 6 + payoffRatio * 3 + index * 1.2,
                );
                this.graphics.fillStyle(focusColor, burstAlpha * 0.5);
                this.graphics.fillCircle(burstScreen.x, burstScreen.y, 2.4 + payoffRatio);
              }
            }
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
            if (battle.pierceFlowCount >= 3 || battle.pierceChainStacks >= 2) {
              const piercePayoffReach = throughLength + 28 + battle.pierceChainStacks * 6;
              this.graphics.lineStyle(2.1, focusColor, focusAlpha * 0.92);
              this.graphics.lineBetween(
                eliteScreen.x - chaseDirX * (elite.radius + 14),
                eliteScreen.y - chaseDirY * (elite.radius + 14),
                eliteScreen.x + chaseDirX * piercePayoffReach,
                eliteScreen.y + chaseDirY * piercePayoffReach,
              );
              this.graphics.fillStyle(focusColor, focusAlpha * 0.34);
              for (let marker = 0; marker < 3; marker += 1) {
                const ratio = 0.28 + marker * 0.22;
                const markerX = eliteScreen.x + chaseDirX * piercePayoffReach * ratio;
                const markerY = eliteScreen.y + chaseDirY * piercePayoffReach * ratio;
                this.graphics.fillCircle(markerX + chaseOrthoX * railOffset, markerY + chaseOrthoY * railOffset, 2.2);
                this.graphics.fillCircle(markerX - chaseOrthoX * railOffset, markerY - chaseOrthoY * railOffset, 2.2);
              }
              this.graphics.lineStyle(3, this.mixColor(focusColor, 0xffffff, 0.18), focusAlpha * 0.28);
              this.graphics.lineBetween(
                eliteScreen.x - chaseDirX * (elite.radius + 8),
                eliteScreen.y - chaseDirY * (elite.radius + 8),
                eliteScreen.x + chaseDirX * (piercePayoffReach + 22),
                eliteScreen.y + chaseDirY * (piercePayoffReach + 22),
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
            if (battle.dashDriveSec > 0 || battle.dashMomentumStacks >= 2) {
              const dashPayoffRadius = elite.radius + 24 + eliteCrackRatio * 10 + battle.dashMomentumStacks * 3;
              this.graphics.lineStyle(2, this.mixColor(focusColor, 0xffffff, 0.16), focusAlpha * 0.42);
              this.graphics.beginPath();
              this.graphics.arc(eliteScreen.x, eliteScreen.y, dashPayoffRadius, -0.4, 1.05, false);
              this.graphics.strokePath();
              this.graphics.beginPath();
              this.graphics.arc(eliteScreen.x, eliteScreen.y, dashPayoffRadius, Math.PI - 1.05, Math.PI + 0.4, false);
              this.graphics.strokePath();
            }
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
    _battle: BattleState,
    _camera: { left: number; top: number; width: number; height: number },
    _accentColor: number,
  ): void {
    // 遭遇流装饰遮罩已移除 — 不再画场内装饰线条和箭头
  }

  private renderPressurePatternOverlay(
    _battle: BattleState,
    _camera: { left: number; top: number; width: number; height: number },
    _accentColor: number,
  ): void {
    // 压力模式遮罩已移除 — 不再画场内色块遮盖层
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
    return mixColorPure(base, target, amount);
  }
}

