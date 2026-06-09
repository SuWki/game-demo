import type { BattleState, BattlePressurePhaseDefinition } from '../../game/types';

export interface BossBehaviorDeps {
  getActivePressurePhase: (battle: BattleState) => BattlePressurePhaseDefinition | null;
  getBattleViewportBounds: (battle: BattleState) => { left: number; right: number; top: number; bottom: number; width: number; height: number };
  isPointInsidePressureSafeWindow: (battle: BattleState, x: number, y: number, padding: number) => boolean;
  enqueueTip: (text: string) => void;
}

export function updateBossFirelineMonitoring(battle: BattleState, deps: BossBehaviorDeps): void {
  if (battle.encounterType !== 'boss' || battle.templateId !== 'boss-bastion') {
    return;
  }

  const phase = deps.getActivePressurePhase(battle);
  if (!phase || phase.id !== 'fireline') {
    return;
  }

  const view = deps.getBattleViewportBounds(battle);
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
  const coverage = dangerCoverage * 0.5 + projectileCoverage * 0.26 + escortCoverage * 0.12 + phasePulseCoverage * 0.12;
  battle.bossFirelineCoverage = Math.max(battle.bossFirelineCoverage, Number(coverage.toFixed(3)));
}

export function applyBossSafeWindowPenalty(battle: BattleState, dt: number, deps: BossBehaviorDeps): void {
  if (battle.encounterType !== 'boss' || battle.templateId !== 'boss-bastion') {
    return;
  }

  const phase = deps.getActivePressurePhase(battle);
  if (!phase || phase.id !== 'fireline') {
    return;
  }

  if (battle.pressureSafeWindowSec <= 0) {
    return;
  }

  if (deps.isPointInsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12)) {
    battle.bossSafeWindowGraceSec = Math.max(battle.bossSafeWindowGraceSec, 0.35);
    return;
  }

  battle.outsideSafeDamageTimerSec = (battle.outsideSafeDamageTimerSec ?? 0) + dt;
  const tickInterval = 0.28;
  const expectedTicks = Math.floor(battle.outsideSafeDamageTimerSec / tickInterval);
  if (expectedTicks > (battle.outsideSafeDamageTickCount ?? 0)) {
    battle.outsideSafeDamageTickCount = expectedTicks;
    // Damage tick would be applied here
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
