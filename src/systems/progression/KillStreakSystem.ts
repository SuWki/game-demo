import type { BattleState } from '../../game/types';

export function registerKillFlow(
  battle: BattleState,
  enemy: BattleState['enemies'][number],
): number {
  if (battle.killFlowSec > 0) {
    battle.killFlowCount = Math.min(4, battle.killFlowCount + 1);
  } else {
    battle.killFlowCount = 1;
  }

  battle.killFlowSec = Math.max(
    battle.killFlowSec,
    enemy.elite ? 1.08 : 0.76 + Math.min(0.12, battle.killFlowCount * 0.03),
  );
  battle.playerMoveBoostSec = Math.max(
    battle.playerMoveBoostSec,
    enemy.elite ? 0.26 : 0.13 + Math.min(0.16, battle.killFlowCount * 0.034),
  );
  battle.tempoPulseSec = Math.max(
    battle.tempoPulseSec,
    enemy.elite ? 0.36 : 0.17 + Math.min(0.2, battle.killFlowCount * 0.054),
  );

  // Kill Streak System
  if (battle.killStreakDecaySec > 0) {
    battle.killStreakCount += 1;
  } else {
    battle.killStreakCount = 1;
  }

  battle.killStreakDecaySec = 3.0;
  battle.killStreakMultiplier = 1.0 + Math.min(0.5, battle.killStreakCount * 0.05);

  return battle.killFlowCount;
}

export function getPickupFlowWindowSec(chainCount: number): number {
  if (chainCount >= 4) {
    return 0.88;
  }
  if (chainCount === 3) {
    return 0.8;
  }
  if (chainCount === 2) {
    return 0.72;
  }
  return 0.62;
}

export function getPickupFlowRatio(battle: BattleState): number {
  if (battle.pickupFlowSec <= 0 || battle.pickupFlowCount <= 0) {
    return 0;
  }
  return Math.min(1, battle.pickupFlowSec / getPickupFlowWindowSec(battle.pickupFlowCount));
}

export function getKillFlowRatio(battle: BattleState): number {
  if (battle.killFlowSec <= 0 || battle.killFlowCount <= 0) {
    return 0;
  }
  return Math.min(
    1,
    battle.killFlowSec /
      (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72),
  );
}

export function registerPierceFlow(
  battle: BattleState,
  options: {
    laneScore?: number;
    hitCount?: number;
    echoCount?: number;
    eliteCrackRatio?: number;
    pickupCarry?: number;
  } = {},
): number {
  if (battle.pierceFlowSec > 0) {
    battle.pierceFlowCount = Math.min(5, battle.pierceFlowCount + 1);
  } else {
    battle.pierceFlowCount = 1;
  }

  const laneScore = options.laneScore ?? 0;
  const hitCount = options.hitCount ?? 1;
  const echoCount = options.echoCount ?? 0;
  const eliteCrackRatio = options.eliteCrackRatio ?? 0;
  const pickupCarry = options.pickupCarry ?? 0;
  const flowWeight =
    battle.pierceFlowCount * 0.04 +
    Math.min(0.14, Math.max(0, laneScore - 1) * 0.05) +
    Math.min(0.1, Math.max(0, hitCount - 1) * 0.035) +
    Math.min(0.1, echoCount * 0.04) +
    Math.min(0.12, eliteCrackRatio * 0.16) +
    Math.min(0.08, pickupCarry * 0.012);

  battle.pierceFlowSec = Math.max(battle.pierceFlowSec, 0.46 + flowWeight);
  battle.playerMoveBoostSec = Math.max(battle.playerMoveBoostSec, 0.1 + Math.min(0.12, flowWeight * 0.65));
  battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.12 + Math.min(0.16, flowWeight * 0.72));
  battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.06 + Math.min(0.08, flowWeight * 0.42));

  return battle.pierceFlowCount;
}

export function registerPickupFlow(
  battle: BattleState,
  orbValue: number,
): number {
  if (battle.pickupFlowSec > 0) {
    battle.pickupFlowCount = Math.min(4, battle.pickupFlowCount + 1);
  } else {
    battle.pickupFlowCount = 1;
  }

  const pickupWeight =
    battle.pickupFlowCount * 0.035 +
    Math.min(0.12, orbValue * 0.004);

  battle.pickupFlowSec = Math.max(battle.pickupFlowSec, 0.38 + pickupWeight);

  return battle.pickupFlowCount;
}

export function getPickupFlowCarry(battle: BattleState): number {
  const pickupFlowRatio = getPickupFlowRatio(battle);
  return pickupFlowRatio > 0 ? battle.pickupFlowCount * 0.34 + pickupFlowRatio * 0.9 : 0;
}

export function getKillFlowCarry(battle: BattleState): number {
  const killFlowRatio = getKillFlowRatio(battle);
  return killFlowRatio > 0 ? battle.killFlowCount * 0.72 + killFlowRatio * 1.24 : 0;
}
