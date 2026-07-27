/**
 * 压力窗口控制器
 *
 * 从 RunEngine.ts 抽离的职责：管理 Boss/精英战的压力阶段状态机、压力签名/模式脉冲、
 * 安全区几何计算、Boss 火线监控、Boss 安全区宽限期，以及压力弹幕（墙壁射击 / 口袋射击）的生成。
 *
 * 压力阶段生命周期：pressurePhaseIndex 推进 → activatePressureSignature + activatePressurePattern →
 * 每帧 updatePressureSignature / updatePressurePattern 脉冲 → executePressurePattern 分发到 escort/volley。
 *
 * 设计要点：
 * - 通过 `PressureWindowHost` 接口访问 RunEngine 共享方法（template 查找 / escort 生成 / 投射物生成 /
 *   metrics 埋点 / tip&audio 队列），避免直接 import RunEngine 类型造成循环依赖。
 * - 几何纯函数仍留在 `pressureSafeWindowMath.ts`，本类只持有需要状态/服务的协调逻辑。
 * - 与 `SafeZoneController` 互补：本类管 pressure phase / pattern / 几何槽位；SafeZoneController 管覆盖攻击
 *   安全区（warning→active→transition 状态机）。两者通过 `getActivePressurePhase` 共享压力阶段定义。
 */

import { clamp } from '../../data/balance';
import type {
  AudioCue,
  BattlePressurePhaseDefinition,
  BattleState,
  BattleTemplateDefinition,
  BattleTemplateId,
  EnemyArchetypeId,
  PhaseId,
  PlayerStats,
  PressurePocketShiftModeId,
  PressurePatternModeId,
  PressureSafeWindowAxis,
} from '../../game/types';
import {
  CENTER_X,
  CENTER_Y,
  calculateBossSafeWindowGraceSec,
  chooseBossPressureSafePocketCenter,
  chooseBossPressureSafeWindowCenter,
  collectPressureSlotPositions,
  getBattleViewportBounds,
  getBossSafeWindowLingerSec,
  getPressurePocketShiftProfile,
  type PressurePocketShiftProfile,
} from './pressureSafeWindowMath';

/** Pressure volley 调用选项（与 RunEngine.firePressureVolley 对齐）。 */
export interface PressureVolleyOptions {
  spreadRad?: number;
  shotsPerShooter?: number;
  respectsSafeWindow?: boolean;
}

/** RunEngine 暴露给 PressureWindowController 的能力接口。 */
export interface PressureWindowHost {
  /** 获取当前战斗模板。 */
  getBattleTemplate(id: BattleTemplateId): BattleTemplateDefinition;
  /** 获取当前活跃的压力阶段（由 RunEngine 暴露给 SafeZoneController / 本控制器共用）。 */
  getActivePressurePhase(battle: BattleState): BattlePressurePhaseDefinition | null;
  /** 计算精英护卫刷新间隔（受当前压力阶段 escortRespawnMultiplier 影响）。 */
  getEliteEscortRespawnSec(template: BattleTemplateDefinition, battle: BattleState): number;
  /** 当前战斗在 run 中的序号（用于难度缩放）。 */
  getCurrentBattleIndex(): number;
  /** 当前 RunState 阶段（opening/mid/late/finalPrep/finalBattle/ended）。 */
  getRunPhase(): PhaseId;
  /** 读取玩家属性快照（用于计算 Boss 安全区宽限期）。 */
  getPlayerStats(): PlayerStats;

  // ---- 投射物 / 护卫生成 ----
  spawnPhaseEscortBurst(battle: BattleState, count: number): void;
  spawnPatternEscortWave(
    battle: BattleState,
    count: number,
    mode: PressurePatternModeId,
    archetypeOverride?: EnemyArchetypeId,
  ): void;
  firePressureVolley(battle: BattleState, requestedShooterCount: number, options?: PressureVolleyOptions): void;
  spawnEnemyProjectile(
    battle: BattleState,
    x: number,
    y: number,
    projectileSpeed: number,
    damage: number,
    radius: number,
    angleOverride?: number,
    options?: { respectsSafeWindow?: boolean },
  ): void;

  // ---- 战斗数值 ----
  getContactDamage(
    template: BattleTemplateDefinition,
    round: number,
    phase: PhaseId,
    difficultyScale: number,
    damageMultiplier?: number,
  ): number;

  // ---- Boss 埋点 ----
  readonly metrics: {
    recordBossPhaseEntered(templateId: BattleTemplateId, phaseId: string, phaseLabel: string): void;
    recordBossPhasePatternSeen(
      templateId: BattleTemplateId,
      phaseId: string,
      phaseLabel: string,
      patternLabel: string,
    ): void;
    recordBossSignatureSeen(
      templateId: BattleTemplateId,
      phaseId: string,
      phaseLabel: string,
      signatureLabel: string,
      durationSec: number,
    ): void;
    recordBossPhaseDuration(
      templateId: BattleTemplateId,
      phaseId: string,
      phaseLabel: string,
      durationSec: number,
    ): void;
    recordBossPhasePatternDuration(
      templateId: BattleTemplateId,
      phaseId: string,
      phaseLabel: string,
      patternLabel: string,
      durationSec: number,
    ): void;
    recordBossSafeWindowSeen(
      templateId: BattleTemplateId,
      phaseId: string,
      phaseLabel: string,
      patternLabel: string,
      axis: PressureSafeWindowAxis,
      span: number,
      durationSec: number,
      secondarySpan?: number,
      shiftType?: PressurePocketShiftModeId,
    ): void;
  };

  // ---- 玩家反馈 ----
  enqueueTip(text: string): void;
  enqueueAudio(cue: AudioCue): void;
}

export class PressureWindowController {
  constructor(private readonly host: PressureWindowHost) {}

  // ============================================================
  // 压力阶段推进
  // ============================================================

  /** 每帧由 RunEngine 调用：检查是否进入下一压力阶段（HP / 时间触发）。 */
  updatePressurePhase(battle: BattleState): void {
    const template = this.host.getBattleTemplate(battle.templateId);
    const phases = template.eliteRule?.pressurePhases;
    if (!battle.eliteAlive || !phases || phases.length === 0) {
      return;
    }

    const eliteEnemy = battle.enemies.find((enemy) => enemy.elite);
    if (!eliteEnemy) {
      return;
    }

    const currentPhase = this.host.getActivePressurePhase(battle);
    if (currentPhase && battle.pressurePhaseElapsedSec < (currentPhase.minResidenceSec ?? 0)) {
      return;
    }

    const nextIndex = battle.pressurePhaseIndex + 1;
    if (nextIndex < 0 || nextIndex >= phases.length) {
      return;
    }

    const nextPhase = phases[nextIndex];
    const hpTriggered =
      nextPhase.triggerHpRatio !== undefined && eliteEnemy.hp / Math.max(1, eliteEnemy.maxHp) <= nextPhase.triggerHpRatio;
    const timeTriggered =
      nextPhase.triggerRemainingSec !== undefined && battle.remainingSec <= nextPhase.triggerRemainingSec;
    if (!hpTriggered && !timeTriggered) {
      return;
    }

    if (battle.encounterType === 'boss' && currentPhase) {
      this.recordBossPhaseMetrics(battle, currentPhase, battle.pressurePhaseElapsedSec);
    }

    battle.pressurePhaseIndex = nextIndex;
    battle.pressurePhaseLabel = nextPhase.label;
    battle.pressurePhaseElapsedSec = 0;
    battle.pressureTransitionSec = Math.max(battle.pressureTransitionSec, 1.15);

    if ((nextPhase.entryGuardSec ?? 0) > 0) {
      eliteEnemy.guardSec = Math.max(eliteEnemy.guardSec, nextPhase.entryGuardSec ?? 0);
      eliteEnemy.guardDamageMultiplier = Math.min(
        eliteEnemy.guardDamageMultiplier,
        nextPhase.entryGuardDamageMultiplier ?? eliteEnemy.guardDamageMultiplier,
      );
    }

    if ((template.eliteRule?.escortBatch ?? 0) > 0) {
      battle.eliteSupportCooldownSec = Math.min(
        battle.eliteSupportCooldownSec,
        Math.max(0.75, this.host.getEliteEscortRespawnSec(template, battle) * 0.55),
      );
    }

    this.host.spawnPhaseEscortBurst(battle, nextPhase.entryEscortBurst ?? 0);
    this.activatePressureSignature(battle, nextPhase);
    this.activatePressurePattern(battle, nextPhase);
    if (battle.encounterType === 'boss') {
      this.host.metrics.recordBossPhaseEntered(battle.templateId, nextPhase.id, nextPhase.label);
    }
    this.host.enqueueTip(
      `${battle.encounterType === 'boss' ? 'Boss 开招' : '精英进场'}：${
        nextPhase.signatureLabel ?? nextPhase.patternLabel ?? nextPhase.label
      }`,
    );
    this.host.enqueueAudio(battle.encounterType === 'boss' ? 'boss' : 'pressure');
  }

  // ============================================================
  // 压力签名脉冲
  // ============================================================

  /** 启动压力签名（精英/Boss 阶段进入时调用）。 */
  activatePressureSignature(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    const durationSec = phase.signatureDurationSec ?? 0;
    if (durationSec <= 0 || !phase.signatureLabel) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignatureSec = 0;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    battle.pressureSignatureLabel = phase.signatureLabel;
    battle.pressureSignatureSec = durationSec;
    battle.pressureSignaturePulseSec = 0;

    if (battle.encounterType === 'boss') {
      this.host.metrics.recordBossSignatureSeen(
        battle.templateId,
        phase.id,
        phase.label,
        phase.signatureLabel,
        durationSec,
      );
    }
  }

  /** 每帧推进压力签名倒计时，到点触发 escort burst / volley。 */
  updatePressureSignature(battle: BattleState, dt: number): void {
    if (battle.pressureSignatureSec <= 0) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    const phase = this.host.getActivePressurePhase(battle);
    if (!phase) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignatureSec = 0;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    battle.pressureSignatureSec = Math.max(0, battle.pressureSignatureSec - dt);
    battle.pressureSignaturePulseSec = Math.max(0, battle.pressureSignaturePulseSec - dt);
    if (battle.pressureSignatureSec <= 0) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    const pulseIntervalSec = phase.signaturePulseIntervalSec ?? 0;
    const shouldPulse = pulseIntervalSec > 0 && battle.pressureSignaturePulseSec <= 0;
    if (!shouldPulse) {
      return;
    }

    if ((phase.signatureEscortBurst ?? 0) > 0) {
      this.host.spawnPhaseEscortBurst(battle, phase.signatureEscortBurst ?? 0);
    }
    if ((phase.signatureVolleyCount ?? 0) > 0) {
      this.host.firePressureVolley(battle, phase.signatureVolleyCount ?? 0);
    }

    battle.pressureSignaturePulseSec = pulseIntervalSec;
  }

  // ============================================================
  // 压力模式脉冲（含安全区开窗）
  // ============================================================

  /** 清空压力安全窗口（保留玩家短暂无敌避免瞬秒）。 */
  clearPressureSafeWindow(battle: BattleState): void {
    if (battle.encounterType === 'boss' && battle.pressureSafeWindowSec > 0) {
      battle.invulnerableSec = Math.max(battle.invulnerableSec, 0.45);
    }
    battle.pressureSafeWindowAxis = undefined;
    battle.pressureSafeWindowShiftType = undefined;
    battle.pressureSafeWindowCenter = CENTER_X;
    battle.pressureSafeWindowSpan = 0;
    battle.pressureSafeWindowSecondaryCenter = CENTER_Y;
    battle.pressureSafeWindowSecondarySpan = 0;
    battle.pressureSafeWindowSec = 0;
    battle.bossSafeWindowGraceSec = 0;
  }

  /** 清空压力模式（含安全窗口）。 */
  clearPressurePattern(battle: BattleState): void {
    battle.pressurePatternLabel = undefined;
    battle.pressurePatternMode = undefined;
    battle.pressurePatternPulseSec = 0;
    battle.pressurePatternFlashSec = 0;
    battle.pressurePatternPulseCount = 0;
    battle.pressurePocketShiftSeen = [];
    this.clearPressureSafeWindow(battle);
  }

  /** 启动压力模式（精英/Boss 阶段进入时调用）。 */
  activatePressurePattern(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    const pulseIntervalSec = phase.patternPulseIntervalSec ?? 0;
    if (pulseIntervalSec <= 0 || !phase.patternLabel || !phase.patternMode) {
      this.clearPressurePattern(battle);
      return;
    }

    battle.pressurePatternLabel = phase.patternLabel;
    battle.pressurePatternMode = phase.patternMode;
    battle.pressurePatternPulseSec = Math.min(0.65, Math.max(0.2, pulseIntervalSec * 0.45));
    battle.pressurePatternFlashSec = Math.max(battle.pressurePatternFlashSec, 0.24);
    battle.pressurePatternPulseCount = 0;
    this.clearPressureSafeWindow(battle);

    if (battle.encounterType === 'boss') {
      this.host.metrics.recordBossPhasePatternSeen(
        battle.templateId,
        phase.id,
        phase.label,
        phase.patternLabel,
      );
    }
  }

  /** 每帧推进压力模式脉冲，到点触发 executePressurePattern。 */
  updatePressurePattern(battle: BattleState, dt: number): void {
    battle.pressurePatternFlashSec = Math.max(0, battle.pressurePatternFlashSec - dt);
    battle.pressureSafeWindowSec = Math.max(0, battle.pressureSafeWindowSec - dt);
    if (battle.pressureSafeWindowSec <= 0) {
      this.clearPressureSafeWindow(battle);
    }
    const phase = this.host.getActivePressurePhase(battle);
    if (!phase || !phase.patternLabel || !phase.patternMode || (phase.patternPulseIntervalSec ?? 0) <= 0) {
      this.clearPressurePattern(battle);
      return;
    }

    if (battle.pressurePatternLabel !== phase.patternLabel || battle.pressurePatternMode !== phase.patternMode) {
      this.activatePressurePattern(battle, phase);
    }

    battle.pressurePatternPulseSec = Math.max(0, battle.pressurePatternPulseSec - dt);
    if (battle.pressurePatternPulseSec > 0) {
      return;
    }

    this.executePressurePattern(battle, phase);
    battle.pressurePatternPulseSec = phase.patternPulseIntervalSec ?? 0;
    battle.pressurePatternFlashSec = Math.max(battle.pressurePatternFlashSec, 0.48);
  }

  /** 执行一次压力模式脉冲（根据 patternMode 分发到 escort / volley）。 */
  private executePressurePattern(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    battle.pressurePatternPulseCount += 1;
    switch (phase.patternMode) {
      case 'laneCrush':
        this.host.spawnPatternEscortWave(
          battle,
          phase.patternEscortBurst ?? 0,
          phase.patternMode,
          phase.patternEscortArchetype,
        );
        return;
      case 'sideClamp':
        this.host.spawnPatternEscortWave(
          battle,
          phase.patternEscortBurst ?? 0,
          phase.patternMode,
          phase.patternEscortArchetype,
        );
        return;
      case 'crossfireWave':
        this.host.firePressureVolley(battle, phase.patternVolleyCount ?? 0, {
          spreadRad: phase.patternVolleySpreadRad ?? 0.2,
          shotsPerShooter: phase.patternVolleyShotsPerShooter ?? 2,
          respectsSafeWindow: true,
        });
        return;
      default:
        return;
    }
  }

  // ============================================================
  // Boss 火线监控
  // ============================================================

  /** 每帧由 RunEngine 调用：在 boss-bastion 的 fireline 阶段更新火线覆盖率（埋点用）。 */
  updateBossFirelineMonitoring(battle: BattleState): void {
    if (battle.encounterType !== 'boss' || battle.templateId !== 'boss-bastion') {
      return;
    }

    const phase = this.host.getActivePressurePhase(battle);
    if (!phase || phase.id !== 'fireline') {
      return;
    }

    const view = getBattleViewportBounds(battle);
    const visibleProjectiles = battle.enemyProjectiles.filter(
      (projectile) =>
        projectile.x >= view.left - 18 &&
        projectile.x <= view.right + 18 &&
        projectile.y >= view.top - 18 &&
        projectile.y <= view.bottom + 18,
    ).length;
    const activeEscorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.hp > 0).length;
    const safeAreaRatio =
      battle.pressureSafeWindowAxis === 'pocket' &&
      battle.pressureSafeWindowSpan > 0 &&
      battle.pressureSafeWindowSecondarySpan > 0
        ? (battle.pressureSafeWindowSpan * battle.pressureSafeWindowSecondarySpan) / Math.max(1, view.width * view.height)
        : battle.pressureSafeWindowAxis && battle.pressureSafeWindowSpan > 0
          ? battle.pressureSafeWindowSpan / Math.max(1, battle.pressureSafeWindowAxis === 'vertical' ? view.width : view.height)
          : 0;
    const dangerCoverage = clamp(1 - safeAreaRatio, 0, 1);
    const projectileCoverage = clamp(visibleProjectiles / 18, 0, 1);
    const escortCoverage = clamp(activeEscorts / 5, 0, 1);
    const phasePulseCoverage = clamp(battle.pressurePatternPulseCount / 4, 0, 1);
    const coverage =
      dangerCoverage * 0.5 +
      projectileCoverage * 0.26 +
      escortCoverage * 0.12 +
      phasePulseCoverage * 0.12;
    battle.bossFirelineCoverage = Math.max(battle.bossFirelineCoverage, Number(coverage.toFixed(3)));
  }

  // ============================================================
  // Boss 安全区宽限期
  // ============================================================

  /** 刷新 Boss 安全区宽限期（玩家在区外时的反应时间补偿）。 */
  refreshBossSafeWindowGrace(battle: BattleState): void {
    if (battle.encounterType !== 'boss') {
      return;
    }

    const graceSec = calculateBossSafeWindowGraceSec(battle, this.host.getPlayerStats());
    if (graceSec <= 0) {
      battle.bossSafeWindowGraceSec = 0;
      battle.outsideSafeDamageTimerSec = 0;
      return;
    }

    battle.bossSafeWindowGraceSec = graceSec;
    battle.outsideSafeDamageTimerSec = 0;
  }

  /** 安全区惩罚（已停用，保留接口便于将来恢复）。 */
  applyBossSafeWindowPenalty(_battle: BattleState, _dt: number): void {
    // 安全区惩罚机制已移除
  }

  // ============================================================
  // 压力弹幕生成
  // ============================================================

  /** 计算压力弹幕投射物的速度与伤害（受当前阶段 rangedProjectileSpeedMultiplier 影响）。 */
  getPressureProjectileStats(
    battle: BattleState,
    damageMultiplier: number,
  ): { projectileSpeed: number; projectileDamage: number } {
    const currentPhase = this.host.getActivePressurePhase(battle);
    return {
      projectileSpeed: 252 * (currentPhase?.rangedProjectileSpeedMultiplier ?? 1),
      projectileDamage: Math.max(
        6,
        Math.round(
          this.host.getContactDamage(
            this.host.getBattleTemplate(battle.templateId),
            this.host.getCurrentBattleIndex(),
            this.host.getRunPhase(),
            battle.difficultyScale,
            damageMultiplier,
          ),
        ),
      ),
    };
  }

  /** 生成轴向墙壁射击（安全区两侧均匀槽位投射物）。 */
  spawnPressureWallShots(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    if (battle.pressureSafeWindowSpan <= 0) {
      return;
    }

    const view = getBattleViewportBounds(battle);
    const dimension = axis === 'vertical' ? view.width : view.height;
    const offset = axis === 'vertical' ? view.left : view.top;
    const margin = axis === 'vertical' ? 72 : 58;
    const shotSlots = Math.max(4, phase.patternWallShotCount ?? (axis === 'vertical' ? 7 : 6));
    const safeStart = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - offset;
    const safeEnd = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - offset;
    const slotPositions = collectPressureSlotPositions(dimension, margin, shotSlots, safeStart, safeEnd).map(
      (position) => position + offset,
    );
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, 0.7);

    for (const position of slotPositions) {
      if (axis === 'vertical') {
        this.host.spawnEnemyProjectile(battle, position, view.top - 22, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
          respectsSafeWindow: true,
        });
        this.host.spawnEnemyProjectile(
          battle,
          position,
          view.bottom + 22,
          projectileSpeed,
          projectileDamage,
          6,
          -Math.PI / 2,
          {
            respectsSafeWindow: true,
          },
        );
        continue;
      }

      this.host.spawnEnemyProjectile(battle, view.left - 22, position, projectileSpeed, projectileDamage, 6, 0, {
        respectsSafeWindow: true,
      });
      this.host.spawnEnemyProjectile(battle, view.right + 22, position, projectileSpeed, projectileDamage, 6, Math.PI, {
        respectsSafeWindow: true,
      });
    }
  }

  /** 生成口袋射击（围绕 pocket 安全区四周的投射物）。 */
  spawnPressurePocketShots(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    if (battle.pressureSafeWindowAxis !== 'pocket' || battle.pressureSafeWindowSpan <= 0) {
      return;
    }

    const view = getBattleViewportBounds(battle);
    const shiftType = battle.pressureSafeWindowShiftType ?? 'sweep';
    const safeStartX = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5;
    const safeEndX = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5;
    const safeStartY = battle.pressureSafeWindowSecondaryCenter - battle.pressureSafeWindowSecondarySpan * 0.5;
    const safeEndY = battle.pressureSafeWindowSecondaryCenter + battle.pressureSafeWindowSecondarySpan * 0.5;
    const horizontalSlotCount = Math.max(4, (phase.patternWallShotCount ?? 5) + (shiftType === 'edgeBounce' ? 1 : 0));
    const verticalSlotCount = Math.max(
      4,
      (phase.patternWallShotCount ?? 5) - 1 + (shiftType === 'centerReset' ? -1 : 0),
    );
    const xMargin = shiftType === 'edgeBounce' ? 72 : 84;
    const yMargin = shiftType === 'centerReset' ? 76 : 68;
    const xSlots = collectPressureSlotPositions(
      view.width,
      xMargin,
      horizontalSlotCount,
      safeStartX - view.left,
      safeEndX - view.left,
    ).map((position) => position + view.left);
    const ySlots = collectPressureSlotPositions(
      view.height,
      yMargin,
      verticalSlotCount,
      safeStartY - view.top,
      safeEndY - view.top,
    ).map((position) => position + view.top);
    const damageMultiplier = shiftType === 'centerReset' ? 0.64 : shiftType === 'edgeBounce' ? 0.7 : 0.68;
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, damageMultiplier);

    for (const x of xSlots) {
      this.host.spawnEnemyProjectile(battle, x, view.top - 24, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
        respectsSafeWindow: true,
      });
      this.host.spawnEnemyProjectile(
        battle,
        x,
        view.bottom + 24,
        projectileSpeed,
        projectileDamage,
        6,
        -Math.PI / 2,
        {
          respectsSafeWindow: true,
        },
      );
    }

    for (const y of ySlots) {
      this.host.spawnEnemyProjectile(battle, view.left - 24, y, projectileSpeed, projectileDamage, 6, 0, {
        respectsSafeWindow: true,
      });
      this.host.spawnEnemyProjectile(battle, view.right + 24, y, projectileSpeed, projectileDamage, 6, Math.PI, {
        respectsSafeWindow: true,
      });
    }
  }

  // ============================================================
  // Boss 阶段埋点收尾
  // ============================================================

  /** 记录当前阶段的持续时间（在阶段切换或战斗结束时调用）。 */
  recordBossPhaseMetrics(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    durationSec: number,
  ): void {
    this.host.metrics.recordBossPhaseDuration(
      battle.templateId,
      phase.id,
      phase.label,
      durationSec,
    );
    if (phase.patternLabel) {
      this.host.metrics.recordBossPhasePatternDuration(
        battle.templateId,
        phase.id,
        phase.label,
        phase.patternLabel,
        durationSec,
      );
    }
  }

  /** 战斗结束时收尾：记录最后一个活跃阶段的持续时间。 */
  finalizeBossPressureMetrics(battle: BattleState): void {
    if (battle.encounterType !== 'boss') {
      return;
    }

    const activePhase = this.host.getActivePressurePhase(battle);
    if (!activePhase || battle.pressurePhaseElapsedSec <= 0) {
      return;
    }

    this.recordBossPhaseMetrics(battle, activePhase, battle.pressurePhaseElapsedSec);
  }

  // ============================================================
  // 安全区几何（开窗 / 中心选择）— 仅供 RunEngine 内部或其他控制器调用
  // ============================================================

  /**
   * 开启压力安全窗口。
   * - axis = 'vertical' / 'horizontal'：轴向矩形安全区，玩家在主轴上移动避弹。
   * - axis = 'pocket'：口袋安全区，玩家在四方位走位避弹，附带 shift 模式（sweep/edgeBounce/centerReset）。
   */
  openPressureSafeWindow(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    const view = getBattleViewportBounds(battle);

    if (axis === 'pocket') {
      const shiftType = this.getPressurePocketShiftType(battle, phase);
      const shiftProfile = getPressurePocketShiftProfile(shiftType);
      // 安全区尺寸：足够大让玩家有走位空间，不被小怪挤压
      const baseSafeWindowSpan = clamp((phase.patternSafeWindowSize ?? 240) * 0.95, 180, view.width * 0.42);
      const baseSafeWindowSecondarySpan = clamp(
        (phase.patternSafeWindowSecondarySize ?? baseSafeWindowSpan * 0.85) * 0.95,
        160,
        view.height * 0.42,
      );
      const safeWindowSpan = clamp(baseSafeWindowSpan * shiftProfile.widthScale, 186, view.width * 0.52);
      const safeWindowSecondarySpan = clamp(
        baseSafeWindowSecondarySpan * shiftProfile.heightScale,
        166,
        view.height * 0.50,
      );
      const safeWindowCenter = this.choosePressureSafePocketCenter(battle, safeWindowSpan, safeWindowSecondarySpan, shiftType);
      const baseSafeWindowSec = (phase.patternSafeWindowLingerSec ?? 1.08) * shiftProfile.lingerScale;
      const safeWindowSec =
        battle.encounterType === 'boss'
          ? getBossSafeWindowLingerSec(baseSafeWindowSec, phase.patternPulseIntervalSec)
          : clamp(baseSafeWindowSec, 0.72, 1.72);

      battle.pressureSafeWindowAxis = axis;
      battle.pressureSafeWindowShiftType = shiftType;
      battle.pressureSafeWindowCenter = safeWindowCenter.x;
      battle.pressureSafeWindowSpan = safeWindowSpan;
      battle.pressureSafeWindowSecondaryCenter = safeWindowCenter.y;
      battle.pressureSafeWindowSecondarySpan = safeWindowSecondarySpan;
      battle.pressureSafeWindowSec = safeWindowSec;
      if (battle.encounterType === 'boss') {
        battle.bossSafeWindowMoments += 1;
      }

      if (battle.encounterType === 'boss' && !battle.pressurePocketShiftSeen.includes(shiftType)) {
        this.host.metrics.recordBossSafeWindowSeen(
          battle.templateId,
          phase.id,
          phase.label,
          phase.patternLabel ?? phase.label,
          axis,
          safeWindowSpan,
          safeWindowSec,
          safeWindowSecondarySpan,
          shiftType,
        );
        battle.pressurePocketShiftSeen.push(shiftType);
      }
      return;
    }

    const dimension = axis === 'vertical' ? view.width : view.height;
    const secondaryDimension = axis === 'vertical' ? view.height : view.width;
    const minimumSpan = axis === 'vertical' ? 200 : 180;
    const maximumSpan = dimension * 0.48;
    const safeWindowSpan = clamp(
      (phase.patternSafeWindowSize ?? (axis === 'vertical' ? 260 : 200)) * 0.92,
      minimumSpan,
      maximumSpan,
    );
    // 安全区副轴长度：与主轴接近，形成近似正方形矩形，让玩家有四方位走位空间
    const secondarySpan = clamp(safeWindowSpan * 0.85, 160, secondaryDimension * 0.44);
    const safeWindowCenter = this.choosePressureSafeWindowCenter(battle, axis, safeWindowSpan);
    const safeWindowSecondaryCenter =
      axis === 'vertical' ? view.top + view.height * 0.5 : view.left + view.width * 0.5;
    const baseSafeWindowSec = phase.patternSafeWindowLingerSec ?? (axis === 'vertical' ? 1.28 : 1.18);
    const safeWindowSec =
      battle.encounterType === 'boss'
        ? getBossSafeWindowLingerSec(baseSafeWindowSec, phase.patternPulseIntervalSec)
        : clamp(baseSafeWindowSec, 0.82, 1.9);

    battle.pressureSafeWindowAxis = axis;
    battle.pressureSafeWindowShiftType = undefined;
    battle.pressureSafeWindowCenter = safeWindowCenter;
    battle.pressureSafeWindowSpan = safeWindowSpan;
    battle.pressureSafeWindowSecondaryCenter = safeWindowSecondaryCenter;
    battle.pressureSafeWindowSecondarySpan = secondarySpan;
    battle.pressureSafeWindowSec = safeWindowSec;
    if (battle.encounterType === 'boss') {
      battle.bossSafeWindowMoments += 1;
    }

    if (battle.encounterType === 'boss' && battle.pressurePatternPulseCount === 1) {
      this.host.metrics.recordBossSafeWindowSeen(
        battle.templateId,
        phase.id,
        phase.label,
        phase.patternLabel ?? phase.label,
        axis,
        safeWindowSpan,
        safeWindowSec,
      );
    }
  }

  /** 选择轴向安全区中心（普通战：避开敌人；Boss 战：委托到 pure 函数）。 */
  private choosePressureSafeWindowCenter(
    battle: BattleState,
    axis: PressureSafeWindowAxis,
    span: number,
  ): number {
    const view = getBattleViewportBounds(battle);
    const dimension = axis === 'vertical' ? view.width : view.height;
    const viewStart = axis === 'vertical' ? view.left : view.top;
    const playerCoord = axis === 'vertical' ? battle.playerX : battle.playerY;
    const laneRatios = axis === 'vertical' ? [0.32, 0.68, 0.5, 0.36, 0.64] : [0.3, 0.7, 0.5, 0.38, 0.62];
    const pulseIndex = Math.max(0, battle.pressurePatternPulseCount - 1) % laneRatios.length;
    const anchoredLane = viewStart + dimension * laneRatios[pulseIndex];
    if (battle.encounterType === 'boss') {
      return chooseBossPressureSafeWindowCenter(battle, axis, span, anchoredLane);
    }
    const margin = axis === 'vertical' ? 72 : 58;
    const minCenter = viewStart + margin + span * 0.5;
    const maxCenter = viewStart + dimension - margin - span * 0.5;

    // 生成候选中心点：锚点+玩家位置+均匀分布
    const candidates = [
      clamp(anchoredLane, minCenter, maxCenter),
      clamp(anchoredLane * 0.72 + playerCoord * 0.28, minCenter, maxCenter),
      clamp(viewStart + dimension * 0.25, minCenter, maxCenter),
      clamp(viewStart + dimension * 0.5, minCenter, maxCenter),
      clamp(viewStart + dimension * 0.75, minCenter, maxCenter),
    ];

    // 选敌人最少的候选位置
    const secondarySpan = battle.pressureSafeWindowSecondarySpan || span * 0.85;
    let bestCenter = candidates[1];
    let bestScore = Infinity;
    for (const cand of candidates) {
      const score = this.scoreSafeWindowCandidate(battle, axis, cand, span, secondarySpan);
      if (score < bestScore) {
        bestScore = score;
        bestCenter = cand;
      }
    }
    return bestCenter;
  }

  /** 给候选中心打分：敌人越少分越低（越好）。 */
  private scoreSafeWindowCandidate(
    battle: BattleState,
    axis: PressureSafeWindowAxis,
    center: number,
    span: number,
    secondarySpan: number,
  ): number {
    const isVertical = axis === 'vertical';
    const primaryStart = center - span * 0.5;
    const primaryEnd = center + span * 0.5;
    const secondaryCenter = isVertical
      ? battle.playerY
      : battle.playerX;
    const secondaryStart = secondaryCenter - secondarySpan * 0.5;
    const secondaryEnd = secondaryCenter + secondarySpan * 0.5;

    let score = 0;
    for (const enemy of battle.enemies) {
      const ep = isVertical ? enemy.x : enemy.y;
      const es = isVertical ? enemy.y : enemy.x;
      if (ep >= primaryStart - 30 && ep <= primaryEnd + 30 && es >= secondaryStart - 30 && es <= secondaryEnd + 30) {
        // 敌人在安全区内或边缘，每个+10分（越低越好）
        score += 10;
      } else {
        // 离安全区越远的敌人分数越低
        const distToEdge = Math.max(0, Math.abs(ep - center) - span * 0.5);
        score += Math.max(0, 3 - distToEdge * 0.02);
      }
    }
    return score;
  }

  /** 在敌人稀疏处寻找口袋安全区中心（普通战）。 */
  private findEnemyAwarePocketCenter(
    battle: BattleState,
    spanX: number,
    spanY: number,
    anchorX: number,
    anchorY: number,
    playerBlend: number,
  ): { x: number; y: number } {
    const view = getBattleViewportBounds(battle);
    const blendedX = anchorX * (1 - playerBlend) + battle.playerX * playerBlend;
    const blendedY = anchorY * (1 - playerBlend) + battle.playerY * playerBlend;
    const minX = view.left + 84 + spanX * 0.5;
    const maxX = view.right - 84 - spanX * 0.5;
    const minY = view.top + 74 + spanY * 0.5;
    const maxY = view.bottom - 74 - spanY * 0.5;

    // 生成候选中心点
    const candidates: { x: number; y: number }[] = [
      { x: clamp(blendedX, minX, maxX), y: clamp(blendedY, minY, maxY) },
      { x: clamp(anchorX, minX, maxX), y: clamp(anchorY, minY, maxY) },
      { x: clamp(view.left + view.width * 0.3, minX, maxX), y: clamp(view.top + view.height * 0.3, minY, maxY) },
      { x: clamp(view.left + view.width * 0.7, minX, maxX), y: clamp(view.top + view.height * 0.3, minY, maxY) },
      { x: clamp(view.left + view.width * 0.3, minX, maxX), y: clamp(view.top + view.height * 0.7, minY, maxY) },
      { x: clamp(view.left + view.width * 0.7, minX, maxX), y: clamp(view.top + view.height * 0.7, minY, maxY) },
      { x: clamp(view.left + view.width * 0.5, minX, maxX), y: clamp(view.top + view.height * 0.5, minY, maxY) },
    ];

    let best = candidates[0];
    let bestScore = Infinity;
    for (const cand of candidates) {
      const x0 = cand.x - spanX * 0.5;
      const x1 = cand.x + spanX * 0.5;
      const y0 = cand.y - spanY * 0.5;
      const y1 = cand.y + spanY * 0.5;
      let score = 0;
      for (const enemy of battle.enemies) {
        if (enemy.x >= x0 - 30 && enemy.x <= x1 + 30 && enemy.y >= y0 - 30 && enemy.y <= y1 + 30) {
          score += 10;
        } else {
          const dist = Math.hypot(enemy.x - cand.x, enemy.y - cand.y);
          score += Math.max(0, 3 - dist * 0.01);
        }
      }
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return best;
  }

  /** 选择口袋安全区中心（普通战：findEnemyAwarePocketCenter；Boss 战：委托到 pure 函数）。 */
  private choosePressureSafePocketCenter(
    battle: BattleState,
    spanX: number,
    spanY: number,
    shiftType: PressurePocketShiftModeId,
  ): { x: number; y: number } {
    const view = getBattleViewportBounds(battle);
    const shiftModes = this.host.getActivePressurePhase(battle)?.patternPocketShiftModes;
    const shiftModeCount = Math.max(1, shiftModes?.length ?? 0);
    const shiftCycleIndex = Math.floor(Math.max(0, battle.pressurePatternPulseCount - 1) / shiftModeCount);
    const shiftProfile = getPressurePocketShiftProfile(shiftType);
    const anchor = shiftProfile.anchors[shiftCycleIndex % shiftProfile.anchors.length];
    const anchorX = view.left + view.width * anchor.x;
    const anchorY = view.top + view.height * anchor.y;
    if (battle.encounterType === 'boss') {
      return chooseBossPressureSafePocketCenter(battle, spanX, spanY, shiftType, anchorX, anchorY);
    }
    const playerBlend = shiftProfile.playerBlend;
    return this.findEnemyAwarePocketCenter(battle, spanX, spanY, anchorX, anchorY, playerBlend);
  }

  /** 选择口袋 shift 模式（sweep / edgeBounce / centerReset 循环）。 */
  private getPressurePocketShiftType(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
  ): PressurePocketShiftModeId {
    const shiftModes: PressurePocketShiftModeId[] =
      phase.patternPocketShiftModes?.length ? phase.patternPocketShiftModes : ['sweep'];
    const pulseIndex = Math.max(0, battle.pressurePatternPulseCount - 1);
    return shiftModes[pulseIndex % shiftModes.length] ?? 'sweep';
  }
}
