/**
 * 安全区控制器
 *
 * 从 RunEngine.ts 抽离的职责：管理 Boss/普通战斗中的覆盖攻击安全区状态机。
 *
 * 安全区生命周期：warning -> active -> transition -> （下一轮 or 结束）
 * 在 active 阶段，玩家必须在区域内，否则会被覆盖攻击命中。
 *
 * 设计要点：
 * - 通过 `SafeZoneHost` 接口访问 RunEngine 共享方法（getEliteEnemy / getActivePressurePhase 等），
 *   避免直接 import RunEngine 类型造成循环依赖。
 * - 所有 SAFE_ZONE_TIERS 常量随之一并迁移。
 * - `clearBossSafeWindowBlockers` 也归属此类，因为它本质是"清理安全区周围挡路的小怪"。
 */

import { ARENA_HEIGHT, ARENA_WIDTH, clamp } from '../../data/balance';
import { getBattleViewportBounds } from './pressureSafeWindowMath';
import type {
  BattlePressurePhaseDefinition,
  BattleState,
  PlayerStats,
} from '../../game/types';

type ViewportBounds = ReturnType<typeof getBattleViewportBounds>;
type SafeZoneShiftMode = 'sweep' | 'edgeBounce' | 'centerReset';

/** RunEngine 暴露给 SafeZoneController 的能力接口。 */
export interface SafeZoneHost {
  /** 获取当前战斗中的精英敌人（如存在）。 */
  getEliteEnemy(battle: BattleState): BattleState['enemies'][number] | null;
  /** 获取当前活跃的压力阶段。 */
  getActivePressurePhase(battle: BattleState): BattlePressurePhaseDefinition | null;
  /** 读取玩家当前属性快照。 */
  getPlayerStats(): PlayerStats;
  /** 是否处于调试无敌状态。 */
  isInvulnerablePlayerDebug(): boolean;
  /** 对玩家造成覆盖攻击伤害（写入 state.stats.hp）。 */
  applyCoverAttackDamage(damage: number): void;
  /** 设置玩家受击反馈（无敌帧、伤害闪、击退方向、战斗脉冲）。 */
  applyCoverAttackFeedback(
    battle: BattleState,
    flashSec: number,
    invulnSec: number,
    angle: number,
    pulseConfig: {
      x: number;
      y: number;
      radius: number;
      lifeSec: number;
      color: number;
      secondaryColor?: number;
      fillAlpha?: number;
      strokeAlpha?: number;
      strokeWidth?: number;
      growthPerSec?: number;
      innerRadiusRatio?: number;
    },
  ): void;
  /** 判断点是否在压力安全窗口内（用于清理 Boss 火线阻挡者）。 */
  isPointInsidePressureSafeWindow(
    battle: BattleState,
    x: number,
    y: number,
    padding?: number,
  ): boolean;
}

interface SafeZoneTierConfig {
  warning: number;
  active: number;
  transition: number;
  shift: number;
  halfW: number;
  halfH: number;
  mult: number;
}

const SAFE_ZONE_TIERS: readonly SafeZoneTierConfig[] = [
  { warning: 1.5, active: 1.2, transition: 0.4, shift: 40, halfW: 130, halfH: 75, mult: 1.3 },
  { warning: 1.3, active: 1.0, transition: 0.35, shift: 80, halfW: 120, halfH: 70, mult: 1.8 },
  { warning: 1.1, active: 0.9, transition: 0.3, shift: 60, halfW: 100, halfH: 60, mult: 1.8 },
  { warning: 0.9, active: 0.7, transition: 0.25, shift: 45, halfW: 80, halfH: 50, mult: 1.8 },
  { warning: 0.8, active: 0.6, transition: 0.2, shift: 35, halfW: 65, halfH: 40, mult: 1.8 },
];

export class SafeZoneController {
  constructor(private readonly host: SafeZoneHost) {}

  /** RunEngine 每帧调用一次，驱动安全区状态机。 */
  update(battle: BattleState, dt: number): void {
    if (battle.safeZoneHintSec > 0) {
      battle.safeZoneHintSec = Math.max(0, battle.safeZoneHintSec - dt);
    }
    if (battle.safeZoneTutorialSec > 0) {
      battle.safeZoneTutorialSec = Math.max(0, battle.safeZoneTutorialSec - dt);
    }

    if (!battle.safeZone) {
      this.tryActivate(battle);
      return;
    }

    const sz = battle.safeZone;
    sz.timer -= dt;

    if (sz.timer <= 0) {
      if (sz.phase === 'warning') {
        this.executeCoverAttack(battle);
        sz.phase = 'active';
        sz.timer = sz.activeDuration;
      } else if (sz.phase === 'active') {
        sz.phase = 'transition';
        sz.timer = sz.transitionDuration;
      } else {
        sz.cycleCount++;
        if (this.shouldContinue(battle)) {
          this.startCycle(battle);
        } else {
          battle.safeZone = null;
        }
      }
    }

    if (battle.safeZone && battle.safeZone.phase === 'active') {
      this.deflectEnemies(battle);
    }
  }

  /** 清理 Boss 安全窗口里挡住玩家路径的小怪。 */
  clearBossSafeWindowBlockers(battle: BattleState): void {
    if (battle.encounterType !== 'boss' || !battle.pressureSafeWindowAxis) {
      return;
    }

    for (const enemy of battle.enemies) {
      if (enemy.elite) {
        continue;
      }

      const blocksWindow = this.host.isPointInsidePressureSafeWindow(battle, enemy.x, enemy.y, enemy.radius + 44);
      const blocksPlayer = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY) <= enemy.radius + 72;
      if (!blocksWindow && !blocksPlayer) {
        continue;
      }

      const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
      const pushDistance = 132 + enemy.radius * 1.8;
      enemy.x = clamp(enemy.x + Math.cos(angle) * pushDistance, 24, ARENA_WIDTH - 24);
      enemy.y = clamp(enemy.y + Math.sin(angle) * pushDistance, 24, ARENA_HEIGHT - 24);
    }
  }

  // ============================================================
  // 内部状态机
  // ============================================================

  private tryActivate(battle: BattleState): void {
    if (battle.encounterType !== 'boss' && battle.encounterType !== 'battle') return;
    if (battle.pressurePhaseIndex < 1) return;
    const elite = battle.eliteAlive ? this.host.getEliteEnemy(battle) : null;
    if (elite) {
      const hpRatio = elite.hp / Math.max(1, elite.maxHp);
      const threshold = battle.encounterType === 'boss' ? 0.15 : 0.20;
      if (hpRatio <= threshold) return;
    }
    const phase = this.host.getActivePressurePhase(battle);
    if (!phase || !phase.patternMode) return;
    this.startCycle(battle);
    if (battle.safeZoneHintSec <= 0) {
      battle.safeZoneHintSec = 3.0;
    }
  }

  private shouldContinue(battle: BattleState): boolean {
    const elite = battle.eliteAlive ? this.host.getEliteEnemy(battle) : null;
    if (!elite) return false;
    const hpRatio = elite.hp / Math.max(1, elite.maxHp);
    const threshold = battle.encounterType === 'boss' ? 0.15 : 0.20;
    if (hpRatio <= threshold) return false;
    const maxCycles = battle.encounterType === 'boss' ? 12 : 4;
    if (battle.safeZone && battle.safeZone.cycleCount >= maxCycles) return false;
    return true;
  }

  private getTier(battle: BattleState): number {
    if (!battle.safeZone) return 0;
    const cycle = battle.safeZone.cycleCount;
    const isBoss = battle.encounterType === 'boss';
    const tutorialCycles = isBoss ? 2 : 1;
    if (cycle < tutorialCycles) return 0;
    const elite = battle.eliteAlive ? this.host.getEliteEnemy(battle) : null;
    if (!elite) return 1;
    const hpRatio = elite.hp / Math.max(1, elite.maxHp);
    if (hpRatio > 0.6) return 1;
    if (hpRatio > 0.4) return 2;
    if (hpRatio > 0.25) return 3;
    return 4;
  }

  private startCycle(battle: BattleState): void {
    const tier = this.getTier(battle);
    const config = SAFE_ZONE_TIERS[Math.min(tier, 4)];
    const view = getBattleViewportBounds(battle);
    const prevZone = battle.safeZone;
    const anchorX = prevZone ? prevZone.centerX : battle.playerX;
    const anchorY = prevZone ? prevZone.centerY : battle.playerY;
    const shiftMode = this.chooseShiftMode(battle);
    const shiftDir = this.chooseShiftDirection(battle, anchorX, anchorY, shiftMode, view);
    let cx = anchorX + shiftDir.x * config.shift;
    let cy = anchorY + shiftDir.y * config.shift;
    cx = clamp(cx, view.left + config.halfW + 20, view.right - config.halfW - 20);
    cy = clamp(cy, view.top + config.halfH + 20, view.bottom - config.halfH - 20);
    const adjusted = this.adjustForEnemies(battle, cx, cy, config.halfW, config.halfH, view);
    cx = adjusted.x;
    cy = adjusted.y;
    const stats = this.host.getPlayerStats();
    const coverDamage = Math.max(8, Math.round(stats.maxHp * 0.12));
    const isBoss = battle.encounterType === 'boss';
    const coverMult = isBoss ? config.mult : Math.min(config.mult, 1.4);
    if (battle.safeZoneTutorialSec <= 0) {
      const prevCycles = prevZone?.cycleCount ?? 0;
      if (prevCycles === 0) {
        battle.safeZoneTutorialText = '移动到蓝色区域躲避覆盖攻击';
        battle.safeZoneTutorialSec = 2.5;
      } else if (prevCycles === 1 && isBoss) {
        battle.safeZoneTutorialText = '安全区会移动，注意跟随';
        battle.safeZoneTutorialSec = 2.0;
      }
    }
    battle.safeZone = {
      centerX: cx,
      centerY: cy,
      halfWidth: config.halfW,
      halfHeight: config.halfH,
      phase: 'warning',
      timer: config.warning,
      warningDuration: config.warning,
      activeDuration: config.active,
      transitionDuration: config.transition,
      coverAttackDamage: coverDamage,
      coverAttackMultiplier: coverMult,
      shiftMode,
      prevCenterX: anchorX,
      prevCenterY: anchorY,
      cycleCount: prevZone?.cycleCount ?? 0,
      difficultyTier: tier,
    };
    this.pushEnemiesOut(battle);
  }

  private chooseShiftMode(battle: BattleState): SafeZoneShiftMode {
    const cycle = battle.safeZone?.cycleCount ?? 0;
    const modes: SafeZoneShiftMode[] = ['sweep', 'edgeBounce', 'centerReset'];
    return modes[cycle % 3];
  }

  private chooseShiftDirection(
    battle: BattleState,
    anchorX: number,
    anchorY: number,
    mode: SafeZoneShiftMode,
    view: ViewportBounds,
  ): { x: number; y: number } {
    const cycle = battle.safeZone?.cycleCount ?? 0;
    if (mode === 'sweep') {
      return { x: cycle % 2 === 0 ? 1 : -1, y: 0 };
    }
    if (mode === 'edgeBounce') {
      const sx = cycle % 2 === 0 ? 1 : -1;
      const sy = cycle % 4 < 2 ? 1 : -1;
      return { x: sx, y: sy };
    }
    const towardCenterX = (view.left + view.right) * 0.5 - anchorX;
    const towardCenterY = (view.top + view.bottom) * 0.5 - anchorY;
    const mag = Math.hypot(towardCenterX, towardCenterY) || 1;
    if (cycle % 2 === 0) {
      return { x: -towardCenterX / mag, y: -towardCenterY / mag };
    }
    return { x: towardCenterX / mag, y: towardCenterY / mag };
  }

  private adjustForEnemies(
    battle: BattleState,
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    view: ViewportBounds,
  ): { x: number; y: number } {
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: 30, dy: 0 }, { dx: -30, dy: 0 },
      { dx: 0, dy: 30 }, { dx: 0, dy: -30 },
      { dx: 25, dy: 25 }, { dx: -25, dy: -25 },
      { dx: 25, dy: -25 }, { dx: -25, dy: 25 },
    ];
    let best = { x: cx, y: cy };
    let bestScore = -Infinity;
    for (const off of offsets) {
      const tx = clamp(cx + off.dx, view.left + halfW + 20, view.right - halfW - 20);
      const ty = clamp(cy + off.dy, view.top + halfH + 20, view.bottom - halfH - 20);
      let score = 100;
      for (const enemy of battle.enemies) {
        if (enemy.hp <= 0 || enemy.elite) continue;
        const ex = Math.abs(enemy.x - tx);
        const ey = Math.abs(enemy.y - ty);
        if (ex < halfW + enemy.radius && ey < halfH + enemy.radius) {
          score -= 35;
        } else if (ex < halfW + enemy.radius + 30 && ey < halfH + enemy.radius + 30) {
          score -= 12;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x: tx, y: ty };
      }
    }
    return best;
  }

  private pushEnemiesOut(battle: BattleState): void {
    const sz = battle.safeZone;
    if (!sz) return;
    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0 || enemy.elite) continue;
      const dx = enemy.x - sz.centerX;
      const dy = enemy.y - sz.centerY;
      if (Math.abs(dx) < sz.halfWidth + enemy.radius && Math.abs(dy) < sz.halfHeight + enemy.radius) {
        const pushLeft = sz.centerX - sz.halfWidth - enemy.radius - 40;
        const pushRight = sz.centerX + sz.halfWidth + enemy.radius + 40;
        const pushTop = sz.centerY - sz.halfHeight - enemy.radius - 40;
        const pushBottom = sz.centerY + sz.halfHeight + enemy.radius + 40;
        const distLeft = Math.abs(enemy.x - pushLeft);
        const distRight = Math.abs(enemy.x - pushRight);
        const distTop = Math.abs(enemy.y - pushTop);
        const distBottom = Math.abs(enemy.y - pushBottom);
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        if (minDist === distLeft) {
          enemy.x = clamp(pushLeft, 24, ARENA_WIDTH - 24);
        } else if (minDist === distRight) {
          enemy.x = clamp(pushRight, 24, ARENA_WIDTH - 24);
        } else if (minDist === distTop) {
          enemy.y = clamp(pushTop, 24, ARENA_HEIGHT - 24);
        } else {
          enemy.y = clamp(pushBottom, 24, ARENA_HEIGHT - 24);
        }
        enemy.recoverySec = Math.max(enemy.recoverySec, 0.5);
      }
    }
  }

  private deflectEnemies(battle: BattleState): void {
    const sz = battle.safeZone;
    if (!sz) return;
    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0 || enemy.elite) continue;
      const dx = enemy.x - sz.centerX;
      const dy = enemy.y - sz.centerY;
      if (Math.abs(dx) < sz.halfWidth + enemy.radius + 10 && Math.abs(dy) < sz.halfHeight + enemy.radius + 10) {
        if (Math.abs(dx) < sz.halfWidth && Math.abs(dy) < sz.halfHeight) {
          const pushLeft = sz.centerX - sz.halfWidth - enemy.radius - 5;
          const pushRight = sz.centerX + sz.halfWidth + enemy.radius + 5;
          const pushTop = sz.centerY - sz.halfHeight - enemy.radius - 5;
          const pushBottom = sz.centerY + sz.halfHeight + enemy.radius + 5;
          const distLeft = Math.abs(enemy.x - pushLeft);
          const distRight = Math.abs(enemy.x - pushRight);
          const distTop = Math.abs(enemy.y - pushTop);
          const distBottom = Math.abs(enemy.y - pushBottom);
          const minDist = Math.min(distLeft, distRight, distTop, distBottom);
          if (minDist === distLeft) enemy.x = pushLeft;
          else if (minDist === distRight) enemy.x = pushRight;
          else if (minDist === distTop) enemy.y = pushTop;
          else enemy.y = pushBottom;
        }
      }
    }
  }

  private executeCoverAttack(battle: BattleState): void {
    const sz = battle.safeZone;
    if (!sz) return;
    const playerInZone =
      Math.abs(battle.playerX - sz.centerX) < sz.halfWidth &&
      Math.abs(battle.playerY - sz.centerY) < sz.halfHeight;
    if (playerInZone) return;
    if (battle.invulnerableSec > 0 || this.host.isInvulnerablePlayerDebug()) return;

    const damage = sz.coverAttackDamage * sz.coverAttackMultiplier;
    this.host.applyCoverAttackDamage(damage);
    this.host.applyCoverAttackFeedback(
      battle,
      0.2,
      0.35,
      Math.atan2(battle.playerY - sz.centerY, battle.playerX - sz.centerX),
      {
        x: battle.playerX,
        y: battle.playerY,
        radius: 40,
        lifeSec: 0.3,
        color: 0xff4444,
        secondaryColor: 0xff8888,
        fillAlpha: 0.2,
        strokeAlpha: 0.8,
        strokeWidth: 3,
        growthPerSec: 200,
        innerRadiusRatio: 0.4,
      },
    );
  }
}
