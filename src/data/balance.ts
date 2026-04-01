import type {
  BattleState,
  BattleTemplateDefinition,
  PhaseId,
  PlayerStats,
  RouteBuildStage,
  UpgradeRarity,
  UpgradeSource,
} from '../game/types';

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 540;
export const PLAYER_BODY_RADIUS = 12;
export const PLAYER_COLLISION_RADIUS = 18;

const RARITY_MULTIPLIERS: Record<UpgradeRarity, number> = {
  common: 1,
  uncommon: 1.2,
  rare: 1.45,
  epic: 1.75,
  legendary: 2.15,
};

export const RARITY_LABEL_MAP: Record<UpgradeRarity, string> = {
  common: '白',
  uncommon: '绿',
  rare: '蓝',
  epic: '紫',
  legendary: '金',
};

export const RARITY_COLOR_MAP: Record<UpgradeRarity, string> = {
  common: '#d6dde6',
  uncommon: '#83d87c',
  rare: '#69b5ff',
  epic: '#bb84ff',
  legendary: '#ffca69',
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getPhaseTier(phase: PhaseId): number {
  switch (phase) {
    case 'opening':
      return 0;
    case 'mid':
      return 1;
    case 'late':
      return 2;
    case 'finalPrep':
      return 3;
    case 'finalBattle':
      return 4;
    case 'ended':
    default:
      return 0;
  }
}

export function createBaseStats(): PlayerStats {
  return {
    maxHp: 110,
    hp: 110,
    damage: 18,
    fireRate: 2.2,
    projectileSpeed: 360,
    critChance: 0.06,
    critMultiplier: 1.65,
    pierce: 0,
    multishot: 1,
    moveSpeed: 248,
    dashInterval: 5.4,
    dashPulseDamage: 0,
    dashInvulnerability: 0.24,
    regeneration: 0,
  };
}

export function getExperienceToNextLevel(level: number): number {
  return Math.round(18 + level * 8 + level * level * 3);
}

export function getUpgradeRarityMultiplier(rarity: UpgradeRarity): number {
  return RARITY_MULTIPLIERS[rarity];
}

export function getUpgradeRarityWeights(
  round: number,
  phase: PhaseId,
  level: number,
  source: UpgradeSource,
): Record<UpgradeRarity, number> {
  const phaseTier = getPhaseTier(phase);
  const depthScore = (round - 1) * 1.15 + phaseTier * 0.9 + Math.max(0, level - 1) * 0.18 + (source === 'nodePrep' ? 1.1 : 0);

  const common = Math.max(12, 78 - depthScore * 12);
  const uncommon = 18 + depthScore * 6;
  const rare = Math.max(3, 4 + depthScore * 5);
  const epic = Math.max(0, depthScore > 1 ? 1 + (depthScore - 1) * 3 : 0);
  const legendary = Math.max(0, depthScore > 2 ? (depthScore - 2) * 2.2 : 0);

  return {
    common,
    uncommon,
    rare,
    epic,
    legendary,
  };
}

export function getPlayerMoveSpeed(stats: PlayerStats): number {
  return stats.moveSpeed;
}

export function getPickupRadius(stats: PlayerStats): number {
  return 28 + stats.moveSpeed * 0.04;
}

export function getMagnetRadius(stats: PlayerStats): number {
  return 120 + stats.moveSpeed * 0.12;
}

export function getProjectileSpeed(stats: PlayerStats): number {
  return stats.projectileSpeed;
}

export function getEnemyHealth(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  difficultyScale: number,
  eliteMultiplier = 1,
): number {
  const depthFactor = 1 + (round - 1) * 0.2 + getPhaseTier(phase) * 0.12;
  return Math.round(template.enemyHp * depthFactor * difficultyScale * eliteMultiplier);
}

export function getEnemyMoveSpeed(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  difficultyScale: number,
  speedMultiplier = 1,
): number {
  const depthFactor = 1 + (round - 1) * 0.06 + getPhaseTier(phase) * 0.03;
  return Math.round(template.enemySpeed * depthFactor * difficultyScale * speedMultiplier);
}

export function getEnemySpawnInterval(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  elapsedSec: number,
): number {
  const depthFactor = 1 + (round - 1) * 0.08 + getPhaseTier(phase) * 0.05;
  const pressureFactor = 1 + Math.min(elapsedSec, 30) * 0.015;
  const interval = template.spawnIntervalSec / (depthFactor * pressureFactor);
  return clamp(interval, template.spawnIntervalSec * 0.38, template.spawnIntervalSec);
}

export function getEnemyExperienceValue(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  isElite: boolean,
): number {
  const phaseTier = getPhaseTier(phase);
  const baseValue = 4 + round * 2 + phaseTier * 2 + template.enemyHp * 0.08;
  return Math.round(isElite ? baseValue * 4.5 : baseValue);
}

export function getBattleCompletionExperience(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
): number {
  const phaseTier = getPhaseTier(phase);
  const baseValue =
    template.winCondition.type === 'elite'
      ? 24
      : template.winCondition.type === 'survive'
        ? 20
        : 16;
  return Math.round(baseValue + round * 4 + phaseTier * 3);
}

export function getDashGrazeOuterRadius(stats: PlayerStats, buildStage: RouteBuildStage): number {
  return 64 + stats.moveSpeed * 0.03 + (buildStage === 'matured' ? 14 : buildStage === 'committed' ? 8 : 0);
}

export function getDashGrazeInnerRadius(): number {
  return PLAYER_COLLISION_RADIUS + 10;
}

export function getDashPulseRadius(stats: PlayerStats, dashCharge: number, buildStage: RouteBuildStage): number {
  const stageBonus = buildStage === 'matured' ? 10 : buildStage === 'committed' ? 6 : 4;
  return 78 + stats.moveSpeed * 0.04 + dashCharge * stageBonus;
}

export function getDashPulseDamage(stats: PlayerStats, dashCharge: number, buildStage: RouteBuildStage): number {
  const stageBonus = buildStage === 'matured' ? 8 : buildStage === 'committed' ? 4 : 2;
  return stats.dashPulseDamage + dashCharge * stageBonus;
}

export function getDashPulseHeal(dashCharge: number, buildStage: RouteBuildStage): number {
  if (buildStage === 'unformed') {
    return 0;
  }
  const baseHeal = buildStage === 'matured' ? 2.2 : 1.1;
  return dashCharge * baseHeal;
}

export function getDashDriveDuration(dashCharge: number, routeCount: number): number {
  return (routeCount > 0 ? 0.9 : 0.45) + dashCharge * 0.18;
}

export function getDashCooldownAfterPulse(stats: PlayerStats, buildStage: RouteBuildStage): number {
  return Math.max(1.5, stats.dashInterval - (buildStage === 'matured' ? 0.35 : buildStage === 'committed' ? 0.2 : 0));
}

export function getDashDamageMultiplier(buildStage: RouteBuildStage, dashDriveSec: number): number {
  if (dashDriveSec <= 0) {
    return 1;
  }
  if (buildStage === 'matured') {
    return 0.55;
  }
  if (buildStage === 'committed') {
    return 0.72;
  }
  return 0.85;
}

export function getCritOverdriveDurationGain(buildStage: RouteBuildStage): number {
  if (buildStage === 'matured') {
    return 0.7;
  }
  if (buildStage === 'committed') {
    return 0.55;
  }
  return 0.45;
}

export function getEffectiveFireRate(stats: PlayerStats, battle: BattleState, critRouteCount: number, dashRouteCount: number): number {
  let fireRate = stats.fireRate;
  if (battle.critOverdriveSec > 0) {
    fireRate += 0.4 + critRouteCount * 0.12;
  }
  if (battle.dashDriveSec > 0) {
    fireRate += 0.35 + dashRouteCount * 0.1;
  }
  return fireRate;
}

export function getEffectiveCritChance(stats: PlayerStats, buildStage: RouteBuildStage, critOverdriveSec: number): number {
  let critChance = stats.critChance;
  if (critOverdriveSec > 0) {
    critChance += 0.08;
    if (buildStage === 'committed') {
      critChance += 0.08;
    }
    if (buildStage === 'matured') {
      critChance += 0.08;
    }
  }
  return clamp(critChance, 0, 0.95);
}

export function getCritSplashRatio(buildStage: RouteBuildStage, critOverdriveSec: number): number {
  if (buildStage !== 'matured' || critOverdriveSec <= 0) {
    return 0;
  }
  return 0.45;
}

export function getPierceEchoCount(multishot: number, buildStage: RouteBuildStage): number {
  let count = 1;
  if (multishot > 1) {
    count += 1;
  }
  if (buildStage === 'matured') {
    count += 1;
  }
  return count;
}

export function getPierceEchoDamageRatio(buildStage: RouteBuildStage): number {
  return buildStage === 'committed' || buildStage === 'matured' ? 0.72 : 0.58;
}

export function getPierceCooldownRefund(buildStage: RouteBuildStage): number {
  return buildStage === 'committed' || buildStage === 'matured' ? 0.06 : 0;
}
