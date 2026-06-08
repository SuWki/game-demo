import type { BattleState, BattlePressurePhaseDefinition, BattleTemplateDefinition, PressureSafeWindowAxis } from '../../game/types';

export interface SpawnPatternDeps {
  getBattleViewportBounds: (battle: BattleState) => { left: number; right: number; top: number; bottom: number; width: number; height: number };
  getPressureProjectileStats: (battle: BattleState, damageMultiplier: number) => { projectileSpeed: number; projectileDamage: number };
  spawnEnemyProjectile: (battle: BattleState, x: number, y: number, speed: number, damage: number, radius: number, angle: number, options?: { respectsSafeWindow?: boolean }) => void;
  collectPressureSlotPositions: (dimension: number, margin: number, slotCount: number, safeStart: number, safeEnd: number) => number[];
}

export function executePressurePattern(
  battle: BattleState,
  phase: BattlePressurePhaseDefinition,
  deps: SpawnPatternDeps,
): void {
  battle.pressurePatternPulseCount += 1;
  switch (phase.patternMode) {
    case 'laneCrush':
      openPressureSafeWindow(battle, phase, 'vertical');
      spawnPressureWallShots(battle, phase, 'vertical', deps);
      spawnPatternEscortWave(battle, phase.patternEscortBurst ?? 0, phase.patternMode, phase.patternEscortArchetype);
      return;
    case 'sideClamp':
      openPressureSafeWindow(battle, phase, 'horizontal');
      spawnPressureWallShots(battle, phase, 'horizontal', deps);
      spawnPatternEscortWave(battle, phase.patternEscortBurst ?? 0, phase.patternMode, phase.patternEscortArchetype);
      return;
    case 'crossfireWave':
      openPressureSafeWindow(battle, phase, 'pocket');
      spawnPressurePocketShots(battle, phase, deps);
      firePressureVolley(battle, phase.patternVolleyCount ?? 0, {
        spreadRad: phase.patternVolleySpreadRad ?? 0.2,
        shotsPerShooter: phase.patternVolleyShotsPerShooter ?? 2,
        respectsSafeWindow: true,
      });
      return;
    default:
      return;
  }
}

function openPressureSafeWindow(
  battle: BattleState,
  phase: BattlePressurePhaseDefinition,
  axis: PressureSafeWindowAxis,
): void {
  // This function modifies battle state directly - kept as placeholder
  // Full implementation needs access to RunEngine's choosePressureSafeWindowCenter etc.
}

function spawnPressureWallShots(
  battle: BattleState,
  phase: BattlePressurePhaseDefinition,
  axis: PressureSafeWindowAxis,
  deps: SpawnPatternDeps,
): void {
  if (battle.pressureSafeWindowSpan <= 0) {
    return;
  }

  const view = deps.getBattleViewportBounds(battle);
  const dimension = axis === 'vertical' ? view.width : view.height;
  const offset = axis === 'vertical' ? view.left : view.top;
  const margin = axis === 'vertical' ? 72 : 58;
  const shotSlots = Math.max(4, phase.patternWallShotCount ?? (axis === 'vertical' ? 7 : 6));
  const safeStart = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - offset;
  const safeEnd = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - offset;
  const slotPositions = deps.collectPressureSlotPositions(dimension, margin, shotSlots, safeStart, safeEnd).map(
    (position) => position + offset,
  );
  const { projectileSpeed, projectileDamage } = deps.getPressureProjectileStats(battle, 0.7);

  for (const position of slotPositions) {
    if (axis === 'vertical') {
      deps.spawnEnemyProjectile(battle, position, view.top - 22, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
        respectsSafeWindow: true,
      });
      deps.spawnEnemyProjectile(
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

    deps.spawnEnemyProjectile(battle, view.left - 22, position, projectileSpeed, projectileDamage, 6, 0, {
      respectsSafeWindow: true,
    });
    deps.spawnEnemyProjectile(battle, view.right + 22, position, projectileSpeed, projectileDamage, 6, Math.PI, {
      respectsSafeWindow: true,
    });
  }
}

function spawnPressurePocketShots(
  battle: BattleState,
  phase: BattlePressurePhaseDefinition,
  deps: SpawnPatternDeps,
): void {
  if (battle.pressureSafeWindowAxis !== 'pocket' || battle.pressureSafeWindowSpan <= 0) {
    return;
  }

  const view = deps.getBattleViewportBounds(battle);
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
  const xSlots = deps.collectPressureSlotPositions(
    view.width,
    xMargin,
    horizontalSlotCount,
    safeStartX - view.left,
    safeEndX - view.left,
  ).map((position) => position + view.left);
  const ySlots = deps.collectPressureSlotPositions(
    view.height,
    yMargin,
    verticalSlotCount,
    safeStartY - view.top,
    safeEndY - view.top,
  ).map((position) => position + view.top);
  const damageMultiplier = shiftType === 'centerReset' ? 0.64 : shiftType === 'edgeBounce' ? 0.7 : 0.68;
  const { projectileSpeed, projectileDamage } = deps.getPressureProjectileStats(battle, damageMultiplier);

  for (const x of xSlots) {
    deps.spawnEnemyProjectile(battle, x, view.top - 24, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
      respectsSafeWindow: true,
    });
    deps.spawnEnemyProjectile(
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
    deps.spawnEnemyProjectile(battle, view.left - 24, y, projectileSpeed, projectileDamage, 6, 0, {
      respectsSafeWindow: true,
    });
    deps.spawnEnemyProjectile(battle, view.right + 24, y, projectileSpeed, projectileDamage, 6, Math.PI, {
      respectsSafeWindow: true,
    });
  }
}

function spawnPatternEscortWave(
  battle: BattleState,
  requestedCount: number,
  mode: string,
  archetypeOverride?: string,
): void {
  // This function needs access to createArchetypedEnemy - kept as placeholder
}

function firePressureVolley(
  battle: BattleState,
  requestedShooterCount: number,
  options?: {
    spreadRad?: number;
    shotsPerShooter?: number;
    respectsSafeWindow?: boolean;
  },
): void {
  // This function needs access to getEnemyArchetype and spawnEnemyProjectile - kept as placeholder
}
