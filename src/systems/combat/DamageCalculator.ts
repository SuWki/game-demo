import type { BattleState, PlayerStats, RouteBuildStage } from '../../game/types';
import {
  getCritOverdriveDurationGain,
  getCritSplashRatio,
  getDashCooldownAfterPulse,
  getDashDamageMultiplier,
  getDashDriveDuration,
  getDashPulseDamage,
  getDashPulseHeal,
  getDashPulseRadius,
  getEffectiveCritChance,
  getEffectiveFireRate,
  getPierceCooldownRefund,
  getPierceEchoCount,
  getPierceEchoDamageRatio,
} from '../../data/balance';

export function calculateCritOverdriveDuration(buildStage: RouteBuildStage): number {
  return getCritOverdriveDurationGain(buildStage);
}

export function calculateEffectiveFireRate(
  stats: PlayerStats,
  battle: BattleState,
  critRouteCount: number,
  dashRouteCount: number,
): number {
  return getEffectiveFireRate(stats, battle, critRouteCount, dashRouteCount);
}

export function calculateEffectiveCritChance(
  stats: PlayerStats,
  buildStage: RouteBuildStage,
  critOverdriveSec: number,
): number {
  return getEffectiveCritChance(stats, buildStage, critOverdriveSec);
}

export function calculateCritSplashRatio(
  buildStage: RouteBuildStage,
  critOverdriveSec: number,
  stats?: PlayerStats,
): number {
  return getCritSplashRatio(buildStage, critOverdriveSec, stats);
}

export function calculateDashPulseDamage(
  stats: PlayerStats,
  dashCharge: number,
  buildStage: RouteBuildStage,
): number {
  return getDashPulseDamage(stats, dashCharge, buildStage);
}

export function calculateDashPulseRadius(
  stats: PlayerStats,
  dashCharge: number,
  buildStage: RouteBuildStage,
): number {
  return getDashPulseRadius(stats, dashCharge, buildStage);
}

export function calculateDashDriveDuration(dashCharge: number, routeCount: number): number {
  return getDashDriveDuration(dashCharge, routeCount);
}

export function calculateDashCooldownAfterPulse(stats: PlayerStats, buildStage: RouteBuildStage): number {
  return getDashCooldownAfterPulse(stats, buildStage);
}

export function calculateDashPulseHeal(dashCharge: number, buildStage: RouteBuildStage): number {
  return getDashPulseHeal(dashCharge, buildStage);
}

export function calculateDashDamageMultiplier(buildStage: RouteBuildStage, dashDriveSec: number): number {
  return getDashDamageMultiplier(buildStage, dashDriveSec);
}

export function calculatePierceEchoCount(multishot: number, buildStage: RouteBuildStage): number {
  return getPierceEchoCount(multishot, buildStage);
}

export function calculatePierceEchoDamageRatio(buildStage: RouteBuildStage, stats?: PlayerStats): number {
  return getPierceEchoDamageRatio(buildStage, stats);
}

export function calculatePierceCooldownRefund(buildStage: RouteBuildStage, stats?: PlayerStats): number {
  return getPierceCooldownRefund(buildStage, stats);
}
