import type {
  BattleState,
  BattleTemplateDefinition,
  ContentEffect,
  PhaseId,
  PlayerStats,
  RouteBuildStage,
  StatModifiers,
  UpgradeRarity,
  UpgradeSource,
  UpgradeValueBucket,
} from '../game/types';

export const VIEWPORT_WIDTH = 960;
export const VIEWPORT_HEIGHT = 540;
export const ARENA_WIDTH = 2400;
export const ARENA_HEIGHT = 1560;
export const PLAYER_BODY_RADIUS = 12;
export const PLAYER_COLLISION_RADIUS = 18;

const RARITY_MULTIPLIERS: Record<UpgradeRarity, number> = {
  common: 1,
  uncommon: 1.22,
  rare: 1.58,
  epic: 1.96,
  legendary: 2.38,
};

export const UPGRADE_VALUE_BUCKET_THRESHOLDS = {
  mid: 42,
  high: 74,
  spike: 110,
} as const;

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

const UPGRADE_VALUE_REFERENCE = {
  damage: 18,
  fireRate: 2.6,
  projectileSpeed: 380,
  critChance: 0.18,
  critMultiplier: 1.9,
  multishot: 1.1,
  pierce: 0.4,
  moveSpeed: 258,
  maxHp: 122,
  dashInterval: 4.9,
  dashPulseDamage: 14,
  dashInvulnerability: 0.3,
  regeneration: 0.12,
} as const;

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
    critOverdriveCritBonus: 0,
    critSplashRadius: 0,
    flawDurationBonus: 0,
    critOverdriveDurationBonus: 0,
    pierceEchoDamageBonus: 0,
    crackSpreadRadius: 0,
    pierceCooldownRefundBonus: 0,
    dashChargeSpeed: 0,
    dashCounterDamageBonus: 0,
    dashGrazeRadiusBonus: 0,
  };
}

export function createUpgradeValueReferenceStats(): PlayerStats {
  return {
    maxHp: UPGRADE_VALUE_REFERENCE.maxHp,
    hp: UPGRADE_VALUE_REFERENCE.maxHp,
    damage: UPGRADE_VALUE_REFERENCE.damage,
    fireRate: UPGRADE_VALUE_REFERENCE.fireRate,
    projectileSpeed: UPGRADE_VALUE_REFERENCE.projectileSpeed,
    critChance: UPGRADE_VALUE_REFERENCE.critChance,
    critMultiplier: UPGRADE_VALUE_REFERENCE.critMultiplier,
    pierce: UPGRADE_VALUE_REFERENCE.pierce,
    multishot: UPGRADE_VALUE_REFERENCE.multishot,
    moveSpeed: UPGRADE_VALUE_REFERENCE.moveSpeed,
    dashInterval: UPGRADE_VALUE_REFERENCE.dashInterval,
    dashPulseDamage: UPGRADE_VALUE_REFERENCE.dashPulseDamage,
    dashInvulnerability: UPGRADE_VALUE_REFERENCE.dashInvulnerability,
    regeneration: UPGRADE_VALUE_REFERENCE.regeneration,
    critOverdriveCritBonus: 0,
    critSplashRadius: 0,
    flawDurationBonus: 0,
    critOverdriveDurationBonus: 0,
    pierceEchoDamageBonus: 0,
    crackSpreadRadius: 0,
    pierceCooldownRefundBonus: 0,
    dashChargeSpeed: 0,
    dashCounterDamageBonus: 0,
    dashGrazeRadiusBonus: 0,
  };
}

export function getExperienceToNextLevel(level: number): number {
  return Math.round(18 + level * 8 + level * level * 3);
}

export function getUpgradeRarityMultiplier(rarity: UpgradeRarity): number {
  return RARITY_MULTIPLIERS[rarity];
}

export function getUpgradeValueBucket(totalValue: number): UpgradeValueBucket {
  if (totalValue >= UPGRADE_VALUE_BUCKET_THRESHOLDS.spike) {
    return 'spike';
  }
  if (totalValue >= UPGRADE_VALUE_BUCKET_THRESHOLDS.high) {
    return 'high';
  }
  if (totalValue >= UPGRADE_VALUE_BUCKET_THRESHOLDS.mid) {
    return 'mid';
  }
  return 'low';
}

export function getUpgradeRarityWeights(
  round: number,
  phase: PhaseId,
  level: number,
  source: UpgradeSource,
): Record<UpgradeRarity, number> {
  const phaseTier = getPhaseTier(phase);
  const depthScore = (round - 1) * 1.15 + phaseTier * 0.9 + Math.max(0, level - 1) * 0.18 + (source === 'nodePrep' ? 1.1 : 0);

  const common = Math.max(10, 76 - depthScore * 12.5);
  const uncommon = 18 + depthScore * 6.2;
  const rare = Math.max(4, 5 + depthScore * 5.8 + (phaseTier >= 1 ? 1.2 : 0));
  const epic = Math.max(0, depthScore > 0.9 ? 1.2 + (depthScore - 0.9) * 3.6 : 0);
  const legendary = Math.max(0, depthScore > 1.9 ? 0.5 + (depthScore - 1.9) * 2.8 : 0);

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
  return 18 + stats.moveSpeed * 0.035;
}

export function getMagnetRadius(stats: PlayerStats): number {
  return 68 + stats.moveSpeed * 0.09;
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
  const depthFactor = 1 + (round - 1) * 0.17 + getPhaseTier(phase) * 0.1;
  return Math.round(template.enemyHp * depthFactor * difficultyScale * eliteMultiplier);
}

export function getEnemyMoveSpeed(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  difficultyScale: number,
  speedMultiplier = 1,
): number {
  const depthFactor = 1 + (round - 1) * 0.05 + getPhaseTier(phase) * 0.02;
  return Math.round(template.enemySpeed * depthFactor * difficultyScale * speedMultiplier);
}

export function getEnemyContactDamage(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  difficultyScale: number,
  damageMultiplier = 1,
): number {
  const depthFactor = 1 + (round - 1) * 0.12 + getPhaseTier(phase) * 0.08;
  return Math.round(template.enemyDamage * depthFactor * difficultyScale * damageMultiplier);
}

export function getEnemySpawnInterval(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  elapsedSec: number,
): number {
  const depthFactor = 1 + (round - 1) * 0.06 + getPhaseTier(phase) * 0.04;
  // 使用对数曲线替代线性增长，避免30秒上限
  // 对数曲线特点：前期增长快，后期增长慢但持续增长
  const pressureFactor = 1 + Math.log(1 + elapsedSec / 10) * 0.3;
  const interval = template.spawnIntervalSec / (depthFactor * pressureFactor);
  return clamp(interval, template.spawnIntervalSec * 0.44, template.spawnIntervalSec);
}

export function getRegularEnemyCap(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  capMultiplier = 1,
): number {
  // 提高增长系数以增强后期压迫感
  const depthFactor = 1 + (round - 1) * 0.1 + getPhaseTier(phase) * 0.08;
  const earlyBuffer = round <= 2 ? 0.92 : 1;
  return Math.max(3, Math.round(template.regularEnemyCap * depthFactor * capMultiplier * earlyBuffer));
}

export function getSpawnBurstCount(template: BattleTemplateDefinition): number {
  return Math.max(1, template.spawnRule?.burstCount ?? 1);
}

export function getEnemyExperienceValue(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  isElite: boolean,
): number {
  const phaseTier = getPhaseTier(phase);
  const baseValue = 4 + round * 2.5 + phaseTier * 2.5 + template.enemyHp * 0.09;
  const earlyBoost = round <= 2 ? 1.12 : 1;
  return Math.round((isElite ? baseValue * 4.5 : baseValue) * earlyBoost);
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
  return Math.round(baseValue + round * 4 + phaseTier * 3 + (round <= 2 ? 2 : 0));
}

export function getPressureSnapshot(
  template: BattleTemplateDefinition,
  round: number,
  phase: PhaseId,
  difficultyScale: number,
  elapsedSec: number,
): {
  enemyHp: number;
  enemySpeed: number;
  enemyDamage: number;
  spawnIntervalSec: number;
  spawnFrequency: number;
  regularEnemyCap: number;
  regularPressureIndex: number;
  eliteHp: number | null;
  eliteSpeed: number | null;
  eliteDamage: number | null;
  elitePressureIndex: number;
  totalPressureIndex: number;
} {
  const enemyHp = getEnemyHealth(template, round, phase, difficultyScale);
  const enemySpeed = getEnemyMoveSpeed(template, round, phase, difficultyScale);
  const enemyDamage = getEnemyContactDamage(template, round, phase, difficultyScale);
  const spawnIntervalSec = getEnemySpawnInterval(template, round, phase, elapsedSec);
  const spawnFrequency = Number((1 / spawnIntervalSec).toFixed(2));
  const regularEnemyCap = getRegularEnemyCap(template, round, phase);

  const damageFactor = enemyDamage / template.enemyDamage;
  const speedFactor = enemySpeed / template.enemySpeed;
  const hpFactor = enemyHp / template.enemyHp;
  const frequencyFactor = template.spawnIntervalSec / spawnIntervalSec;
  const crowdFactor = regularEnemyCap / template.regularEnemyCap;
  // 平衡压力指数权重：降低伤害权重，提高其他维度
  const regularPressureIndex = Number(
    (
      template.pressureMultiplier *
      (
        damageFactor * 0.26 +      // 0.34 → 0.26 (-24%)
        speedFactor * 0.22 +        // 0.18 → 0.22 (+22%)
        frequencyFactor * 0.26 +    // 0.24 → 0.26 (+8%)
        crowdFactor * 0.18 +        // 0.16 → 0.18 (+13%)
        hpFactor * 0.08             // 保持不变
      )
    ).toFixed(2),
  );

  if (!template.eliteRule) {
    return {
      enemyHp,
      enemySpeed,
      enemyDamage,
      spawnIntervalSec: Number(spawnIntervalSec.toFixed(2)),
      spawnFrequency,
      regularEnemyCap,
      regularPressureIndex,
      eliteHp: null,
      eliteSpeed: null,
      eliteDamage: null,
      elitePressureIndex: 0,
      totalPressureIndex: regularPressureIndex,
    };
  }

  const eliteHp = getEnemyHealth(template, round, phase, difficultyScale, template.eliteRule.hpMultiplier);
  const eliteSpeed = getEnemyMoveSpeed(template, round, phase, difficultyScale, template.eliteRule.speedMultiplier);
  const eliteDamage = getEnemyContactDamage(template, round, phase, difficultyScale, template.eliteRule.damageMultiplier);
  const elitePressureIndex = Number(
    (
      (
        (eliteDamage / enemyDamage) * 0.28 +
        (eliteSpeed / enemySpeed) * 0.12 +
        (eliteHp / enemyHp) * 0.24
      ) * 0.82
    ).toFixed(2),
  );

  return {
    enemyHp,
    enemySpeed,
    enemyDamage,
    spawnIntervalSec: Number(spawnIntervalSec.toFixed(2)),
    spawnFrequency,
    regularEnemyCap,
    regularPressureIndex,
    eliteHp,
    eliteSpeed,
    eliteDamage,
    elitePressureIndex,
    totalPressureIndex: Number((regularPressureIndex + elitePressureIndex).toFixed(2)),
  };
}

function cloneStats(stats: PlayerStats): PlayerStats {
  return {
    ...stats,
  };
}

function applyStatModifiers(target: PlayerStats, modifiers: StatModifiers): void {
  target.maxHp += modifiers.maxHp ?? 0;
  target.hp = clamp(target.hp, 0, target.maxHp);
  target.damage += modifiers.damage ?? 0;
  target.fireRate += modifiers.fireRate ?? 0;
  target.projectileSpeed += modifiers.projectileSpeed ?? 0;
  target.critChance = clamp(target.critChance + (modifiers.critChance ?? 0), 0, 0.95);
  target.critMultiplier += modifiers.critMultiplier ?? 0;
  target.pierce = clamp(target.pierce + (modifiers.pierce ?? 0), 0, 2);
  target.multishot = clamp(target.multishot + (modifiers.multishot ?? 0), 1, 4);
  target.moveSpeed += modifiers.moveSpeed ?? 0;
  // 降低Dash冷却下限，提升Dash流派上限
  target.dashInterval = Math.max(1.8, target.dashInterval + (modifiers.dashInterval ?? 0));
  target.dashPulseDamage += modifiers.dashPulseDamage ?? 0;
  target.dashInvulnerability += modifiers.dashInvulnerability ?? 0;
  // 生命回复系数再下调，避免回复过强抹掉战斗压力
  target.regeneration += (modifiers.regeneration ?? 0) * 0.12;
  target.critOverdriveCritBonus += modifiers.critOverdriveCritBonus ?? 0;
  target.critSplashRadius += modifiers.critSplashRadius ?? 0;
  target.flawDurationBonus += modifiers.flawDurationBonus ?? 0;
  target.critOverdriveDurationBonus += modifiers.critOverdriveDurationBonus ?? 0;
  target.pierceEchoDamageBonus += modifiers.pierceEchoDamageBonus ?? 0;
  target.crackSpreadRadius += modifiers.crackSpreadRadius ?? 0;
  target.pierceCooldownRefundBonus += modifiers.pierceCooldownRefundBonus ?? 0;
  target.dashChargeSpeed += modifiers.dashChargeSpeed ?? 0;
  target.dashCounterDamageBonus += modifiers.dashCounterDamageBonus ?? 0;
  target.dashGrazeRadiusBonus += modifiers.dashGrazeRadiusBonus ?? 0;
}

function getExpectedSingleTargetDps(stats: PlayerStats): number {
  const critFactor = 1 + clamp(stats.critChance, 0, 0.95) * Math.max(0, stats.critMultiplier - 1);
  return stats.damage * stats.fireRate * critFactor;
}

export function estimateUpgradeValue(
  effects: ContentEffect[],
  referenceStats: PlayerStats = createUpgradeValueReferenceStats(),
): {
  directDps: number;
  utility: number;
  survival: number;
  mobility: number;
  routeSynergy: number;
  total: number;
} {
  const before = cloneStats(referenceStats);
  const after = cloneStats(referenceStats);
  let healAmount = 0;
  let routeEffects = 0;

  for (const effect of effects) {
    if (effect.type === 'stats') {
      applyStatModifiers(after, effect.modifiers);
      continue;
    }

    if (effect.type === 'heal') {
      healAmount += effect.amount;
      continue;
    }

    routeEffects += 1;
  }

  const directDps = Math.max(
    0,
    ((getExpectedSingleTargetDps(after) - getExpectedSingleTargetDps(before)) / getExpectedSingleTargetDps(before)) * 220,
  );
  const projectileSpeedDelta = Math.max(0, (after.projectileSpeed - before.projectileSpeed) / before.projectileSpeed);
  const pierceDelta = Math.max(0, after.pierce - before.pierce);
  const multishotDelta = Math.max(0, after.multishot - before.multishot);
  const critComboBonus =
    Math.max(0, after.critChance - before.critChance) > 0 && Math.max(0, after.critMultiplier - before.critMultiplier) > 0 ? 8 : 0;
  const pierceComboBonus = pierceDelta > 0 && multishotDelta > 0 ? 10 : 0;
  const utility =
    projectileSpeedDelta * 24 +
    pierceDelta * (18 + Math.max(0, before.multishot - 1) * 10) +
    multishotDelta * (34 + Math.max(0, before.pierce) * 8) +
    critComboBonus +
    pierceComboBonus;
  // 提升生存价值权重，平衡DPS与生存的选择
  const survival =
    Math.max(0, ((after.maxHp - before.maxHp) / before.maxHp) * 160) +  // 110 → 160 (+45%)
    Math.max(0, after.regeneration - before.regeneration) * 150 +        // 115 → 150 (+30%)
    Math.max(0, healAmount) * 2.0;                                       // 1.4 → 2.0 (+43%)
  const dashStatCount =
    Number(after.moveSpeed > before.moveSpeed) +
    Number(after.dashInterval < before.dashInterval) +
    Number(after.dashInvulnerability > before.dashInvulnerability) +
    Number(after.dashPulseDamage > before.dashPulseDamage);
  // 提升机动价值权重，增强移速和Dash的吸引力
  const mobility =
    Math.max(0, ((after.moveSpeed - before.moveSpeed) / before.moveSpeed) * 200) +  // 140 → 200 (+43%)
    Math.max(0, ((before.dashInterval - after.dashInterval) / before.dashInterval) * 130) +  // 96 → 130 (+35%)
    Math.max(0, ((after.dashInvulnerability - before.dashInvulnerability) / before.dashInvulnerability) * 55) +  // 42 → 55 (+31%)
    Math.max(0, ((after.dashPulseDamage - before.dashPulseDamage) / Math.max(10, before.damage * 0.75)) * 42);  // 32 → 42 (+31%)
  const routeSynergy = routeEffects * 14 + (dashStatCount >= 2 ? 8 : 0);
  const total = directDps + utility + survival + mobility + routeSynergy;

  return {
    directDps: Number(directDps.toFixed(1)),
    utility: Number(utility.toFixed(1)),
    survival: Number(survival.toFixed(1)),
    mobility: Number(mobility.toFixed(1)),
    routeSynergy: Number(routeSynergy.toFixed(1)),
    total: Number(total.toFixed(1)),
  };
}

export function getDashGrazeOuterRadius(stats: PlayerStats, buildStage: RouteBuildStage): number {
  return 64 + stats.moveSpeed * 0.03 + (stats.dashGrazeRadiusBonus ?? 0) + (buildStage === 'matured' ? 14 : buildStage === 'committed' ? 8 : 0);
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
  const routeBaseline = buildStage === 'unformed' ? 0 : buildStage === 'matured' ? 6 : buildStage === 'committed' ? 4 : 2;
  return Math.max(routeBaseline, stats.dashPulseDamage) + dashCharge * stageBonus;
}

export function getDashPulseHeal(dashCharge: number, buildStage: RouteBuildStage): number {
  if (buildStage === 'unformed') {
    return 0;
  }
  const baseHeal = buildStage === 'matured' ? 0.42 : 0.18;
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
    critChance += 0.08 + (stats.critOverdriveCritBonus ?? 0);
    if (buildStage === 'committed') {
      critChance += 0.08;
    }
    if (buildStage === 'matured') {
      critChance += 0.08;
    }
  }
  return clamp(critChance, 0, 0.95);
}

export function getCritSplashRatio(buildStage: RouteBuildStage, critOverdriveSec: number, stats?: PlayerStats): number {
  if (buildStage !== 'matured' || critOverdriveSec <= 0) {
    return 0;
  }
  const baseRatio = 0.45;
  const bonus = stats?.critSplashRadius ?? 0;
  return baseRatio + bonus;
}

export function getPierceEchoCount(multishot: number, buildStage: RouteBuildStage): number {
  let count = 1;
  if (multishot > 1 && buildStage === 'matured') {
    count += 1;
  }
  if (buildStage === 'matured') {
    count += 1;
  }
  return count;
}

export function getPierceEchoDamageRatio(buildStage: RouteBuildStage, stats?: PlayerStats): number {
  const baseRatio = buildStage === 'matured' ? 0.34 : buildStage === 'committed' ? 0.28 : 0.22;
  return baseRatio + (stats?.pierceEchoDamageBonus ?? 0);
}

export function getPierceCooldownRefund(buildStage: RouteBuildStage, stats?: PlayerStats): number {
  const baseRefund = buildStage === 'matured' ? 0.012 : buildStage === 'committed' ? 0.008 : 0;
  return baseRefund + (stats?.pierceCooldownRefundBonus ?? 0);
}

// ============================================================
// 暴击路线被动 — 数值常量（设计调整时只改这里）
// ============================================================

/** 破绽累积最大层数（5 层后下一次暴击触发终结打击）。 */
export const CRIT_COMBO_MAX_STACKS = 5;
/** 破绽/暴击衰减窗口：未命中超过此时长后层数清零。 */
export const CRIT_COMBO_DECAY_SEC = 2.0;
/** 终结打击伤害倍率（原伤害 × 此倍率 = +150% 暴击伤害）。 */
export const CRIT_FINISHER_DAMAGE_MULTIPLIER = 2.5;
/** 爆发连锁伤害倍率（终结打击后窗口内每次暴击 +30% 伤害）。 */
export const CRIT_BURST_CHAIN_DAMAGE_MULTIPLIER = 1.3;
/** 爆发连锁最大触发次数（终结打击后 2 秒内最多 3 次）。 */
export const CRIT_BURST_CHAIN_MAX_HITS = 3;
/** 爆发连锁窗口持续时间（秒）。 */
export const CRIT_BURST_CHAIN_WINDOW_SEC = 2.0;
/** Crit focus lock 锁定窗口：层数加成系数。 */
export const CRIT_FOCUS_LOCK_PER_STACK = 0.12;
/** Crit focus lock 锁定窗口：matured 阶段额外加成。 */
export const CRIT_FOCUS_LOCK_MATURED_BONUS = 0.22;
/** Crit focus lock 锁定窗口：committed 阶段额外加成。 */
export const CRIT_FOCUS_LOCK_COMMITTED_BONUS = 0.1;
/** Crit focus lock 锁定窗口：暴击命中后基础值（无爆发加成）。 */
export const CRIT_FOCUS_LOCK_BASE_SEC = 0.92;
/** Crit focus lock 锁定窗口：暴击命中后激活值（爆发窗口期）。 */
export const CRIT_FOCUS_LOCK_BURST_SEC = 1.14;
/** Crit focus lock 锁定窗口：非暴击累积时的初始基础值。 */
export const CRIT_FOCUS_LOCK_ACCUM_BASE_SEC = 0.86;

// ============================================================
// 穿透路线被动 — 数值常量
// ============================================================

/** 连锁反应最大层数（穿透命中累积，达到此值触发额外伤害）。 */
export const PIERCE_CHAIN_MAX_STACKS = 3;
/** 连锁反应衰减窗口（秒）。 */
export const PIERCE_CHAIN_DECAY_SEC = 2.0;
/** 连锁爆发伤害倍率（满 3 层时 ×1.4）。 */
export const PIERCE_CHAIN_BURST_DAMAGE_MULTIPLIER = 1.4;
/** 连锁爆发额外伤害比例（直接扣血比例，0.4 = +40%）。 */
export const PIERCE_CHAIN_BURST_BONUS_RATIO = 0.4;
/** committed 阶段裂纹引爆半径（px）。 */
export const PIERCE_FRACTURE_DETONATE_RADIUS = 80;
/** committed 阶段裂纹引爆伤害比例（0.2 = 20% 基础伤害的 AOE）。 */
export const PIERCE_FRACTURE_DETONATE_RATIO = 0.2;
/** committed 阶段裂纹引爆冷却（秒，防止单敌人被反复引爆）。 */
export const PIERCE_FRACTURE_DETONATE_COOLDOWN_SEC = 0.6;
/** matured 阶段击杀标记敌人时的裂纹扩散半径（px）。 */
export const PIERCE_FRACTURE_SPREAD_RADIUS = 120;

