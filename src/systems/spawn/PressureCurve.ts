import type { BattleState, BattleTemplateDefinition, RunState } from '../../game/types';
import {
  getEnemyHealth,
  getEnemyMoveSpeed,
  getEnemySpawnInterval,
  getRegularEnemyCap,
} from '../../data/balance';

export interface PressureCurveParams {
  template: BattleTemplateDefinition;
  round: number;
  phase: RunState['phase'];
  difficultyScale: number;
  elapsedSec: number;
  eliteAlive: boolean;
  eliteRule?: BattleTemplateDefinition['eliteRule'];
  activePressurePhase?: {
    spawnIntervalMultiplier?: number;
    regularEnemyCapBonus?: number;
  } | null;
}

export function getRegularEnemyHp(params: PressureCurveParams, eliteMultiplier = 1): number {
  return getEnemyHealth(params.template, params.round, params.phase, params.difficultyScale, eliteMultiplier);
}

export function getRegularEnemySpeed(params: PressureCurveParams, speedMultiplier = 1): number {
  return getEnemyMoveSpeed(params.template, params.round, params.phase, params.difficultyScale, speedMultiplier);
}

export function getEnemySpawnIntervalForBattle(params: PressureCurveParams): number {
  const pressureMultiplier = params.activePressurePhase?.spawnIntervalMultiplier ?? 1;
  const baseInterval = getEnemySpawnInterval(params.template, params.round, params.phase, params.elapsedSec);
  const result = Math.max(0.18, baseInterval * pressureMultiplier);
  if (!Number.isFinite(result) || result <= 0) {
    return 0.74;
  }
  return result;
}

export function getRegularEnemyCapForBattle(params: PressureCurveParams): number {
  const template = params.template;
  const baseCap = template.regularEnemyCap;
  if (!Number.isFinite(baseCap) || baseCap <= 0) {
    return 9;
  }
  const eliteCapMultiplier =
    template.eliteRule && params.eliteAlive
      ? (template.eliteRule.regularEnemyCap ?? baseCap) / baseCap
      : 1;
  const result = Math.max(
    1,
    getRegularEnemyCap(template, params.round, params.phase, eliteCapMultiplier) +
      (params.activePressurePhase?.regularEnemyCapBonus ?? 0),
  );
  if (!Number.isFinite(result)) {
    return 9;
  }
  return result;
}
