/**
 * Dash 时刻监控器
 *
 * 从 RunEngine.ts 抽离的职责：记录战斗中具有读局价值的"时刻"，用于结果页和埋点。
 *
 * 这些时刻均为带冷却的计数器：当某类事件强度超过阈值且冷却结束时，对应计数 +1 并重置冷却。
 * 冷却由 RunEngine 主循环每帧调用 `tickCooldowns` 推进。
 *
 * 设计要点：
 * - 不持有自己的可变状态，所有计数/冷却都写入 `BattleState`。
 * - 通过 `DashMomentHost` 接口读取 `RunState.phase`，避免直接依赖 RunEngine 类型。
 * - RunEngine 中所有 `markXxxMoment` / `isLateDashMonitoringPhase` 调用改为委托到本类。
 */

import type { BattleState, PhaseId } from '../../game/types';

/** RunEngine 暴露给 DashMomentMonitor 的能力接口。 */
export interface DashMomentHost {
  /** 当前 RunState 阶段（用于判断是否进入 late/final 期）。 */
  getRunPhase(): PhaseId;
}

/** 各类时刻的强度阈值与冷却时长，集中配置便于调参。 */
const THRESHOLDS = {
  lateDashWindow: { strength: 0.28, cooldownSec: 0.34 },
  dashCounter: { strength: 0.24, cooldownSec: 0.42 },
  eliteCrackFollowThrough: { strength: 0.18, cooldownSec: 0.28 },
  killPickupContinue: { strength: 0.22, cooldownSec: 0.46 },
} as const;

const LATE_DASH_PHASES: ReadonlySet<PhaseId> = new Set(['late', 'finalPrep', 'finalBattle']);

export class DashMomentMonitor {
  constructor(private readonly host: DashMomentHost) {}

  /** RunEngine 每帧调用：推进 4 个监控冷却。 */
  tickCooldowns(battle: BattleState, dt: number): void {
    battle.monitorDashLateMomentCooldownSec = Math.max(0, battle.monitorDashLateMomentCooldownSec - dt);
    battle.monitorDashCounterCooldownSec = Math.max(0, battle.monitorDashCounterCooldownSec - dt);
    battle.monitorEliteCrackFollowThroughCooldownSec = Math.max(
      0,
      battle.monitorEliteCrackFollowThroughCooldownSec - dt,
    );
    battle.monitorKillPickupContinueCooldownSec = Math.max(0, battle.monitorKillPickupContinueCooldownSec - dt);
  }

  /** 是否处于 late/final 期（late dash window 时刻仅在此时段触发）。 */
  isLateDashMonitoringPhase(): boolean {
    return LATE_DASH_PHASES.has(this.host.getRunPhase());
  }

  /** 记录 late dash 窗口时刻（dash 路线在终局期的反打/贴身窗口）。 */
  markLateDashWindowMoment(battle: BattleState, strength: number): void {
    const cfg = THRESHOLDS.lateDashWindow;
    if (!this.isLateDashMonitoringPhase() || strength < cfg.strength || battle.monitorDashLateMomentCooldownSec > 0) {
      return;
    }
    battle.lateDashWindowMoments += 1;
    battle.monitorDashLateMomentCooldownSec = cfg.cooldownSec;
  }

  /** 记录 dash 反击时刻（dash 路线在受击/穿梭反打中的有效命中）。 */
  markDashCounterMoment(battle: BattleState, strength: number): void {
    const cfg = THRESHOLDS.dashCounter;
    if (strength < cfg.strength || battle.monitorDashCounterCooldownSec > 0) {
      return;
    }
    battle.dashCounterMoments += 1;
    battle.monitorDashCounterCooldownSec = cfg.cooldownSec;
  }

  /** 记录精英裂纹承接时刻（pierce 路线对精英的裂纹扩散承接）。 */
  markEliteCrackFollowThroughMoment(battle: BattleState, strength: number): void {
    const cfg = THRESHOLDS.eliteCrackFollowThrough;
    if (strength < cfg.strength || battle.monitorEliteCrackFollowThroughCooldownSec > 0) {
      return;
    }
    battle.eliteCrackFollowThroughMoments += 1;
    battle.monitorEliteCrackFollowThroughCooldownSec = cfg.cooldownSec;
  }

  /** 记录击杀-拾取延续时刻（kill/pickup 流的连续节奏）。 */
  markKillPickupContinueMoment(battle: BattleState, strength: number): void {
    const cfg = THRESHOLDS.killPickupContinue;
    if (strength < cfg.strength || battle.monitorKillPickupContinueCooldownSec > 0) {
      return;
    }
    battle.killPickupContinueMoments += 1;
    battle.monitorKillPickupContinueCooldownSec = cfg.cooldownSec;
  }
}
