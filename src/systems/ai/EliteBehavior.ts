import type { BattleState, BattleTemplateDefinition, EliteBehaviorId } from '../../game/types';
import { clamp, ARENA_WIDTH, ARENA_HEIGHT } from '../../data/balance';

export interface EliteBehaviorDeps {
  getActiveEliteBehavior: (battle: BattleState, template: BattleTemplateDefinition) => EliteBehaviorId;
  getElitePressureCycle: (behavior: EliteBehaviorId) => { pulseSec: number; cooldownSec: number; recoverySec: number };
  getActiveEscortCount: (battle: BattleState) => number;
  getEliteNearbyEscorts: (battle: BattleState, eliteEnemy: BattleState['enemies'][number] | null, maxDistance: number) => Array<BattleState['enemies'][number]>;
  getEnemyRecoveryRatio: (enemy: BattleState['enemies'][number]) => number;
  getEliteCrackWindowRatio: (battle: BattleState) => number;
  triggerEnemyPressurePulse: (enemy: BattleState['enemies'][number], durationSec: number, cooldownSec: number) => boolean;
  syncEscortPressureFromElite: (battle: BattleState, eliteEnemy: BattleState['enemies'][number], behavior: EliteBehaviorId) => { syncedCount: number; rangedCount: number };
  crackEliteEscortScreen: (battle: BattleState, eliteEnemy: BattleState['enemies'][number], behavior: EliteBehaviorId) => number;
  extendEliteCrackWindow: (battle: BattleState, eliteEnemy: BattleState['enemies'][number], behavior: EliteBehaviorId, crackedEscorts: number, laneScore: number, critStage: string, pierceStage: string) => void;
  pushEnemyRecovery: (enemy: BattleState['enemies'][number], recoverySec: number) => void;
  createCombatPulse: (battle: BattleState, config: { x: number; y: number; radius: number; lifeSec: number; color: number; secondaryColor?: number; fillAlpha?: number; strokeAlpha?: number; strokeWidth?: number; growthPerSec?: number; innerRadiusRatio?: number; spokeCount?: number; spokeLength?: number; angle?: number; spinRate?: number }) => void;
  enqueueAudio: (cue: string) => void;
  firePressureVolley: (battle: BattleState, count: number, options?: { spreadRad?: number; shotsPerShooter?: number }) => void;
  spawnPhaseEscortBurst: (battle: BattleState, count: number) => void;
  getPierceLaneScore: (battle: BattleState, enemy: BattleState['enemies'][number]) => number;
  getRouteBuildStage: (routeId: string) => string;
  getLiveCombatFocusRoute: (battle: BattleState) => string | null;
  enqueueTip: (text: string) => void;
  displaceEscortOnEliteCrack: (battle: BattleState, eliteEnemy: BattleState['enemies'][number], escort: BattleState['enemies'][number], behavior: EliteBehaviorId, index: number) => void;
  getActivePressurePhase: (battle: BattleState) => { preferredDistanceDelta?: number; strafeStrengthBonus?: number; eliteSpeedMultiplier?: number } | null;
}

export function updateEliteEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  template: BattleTemplateDefinition,
  dt: number,
  deps: EliteBehaviorDeps,
): void {
  const eliteRule = template.eliteRule;
  if (!eliteRule) {
    return;
  }

  const pressurePhase = deps.getActivePressurePhase(battle);
  const activeBehavior = deps.getActiveEliteBehavior(battle, template);
  const cycle = deps.getElitePressureCycle(activeBehavior);
  const escortCount = deps.getActiveEscortCount(battle);
  const transitionMobilityRatio = clamp(battle.pressureTransitionSec / 1.15, 0, 1);
  const preferredDistance = (eliteRule.preferredDistance ?? 170) + (pressurePhase?.preferredDistanceDelta ?? 0);
  const strafeStrength = (eliteRule.strafeStrength ?? 0.2) + (pressurePhase?.strafeStrengthBonus ?? 0) + transitionMobilityRatio * (battle.encounterType === 'boss' ? 0.14 : 0.08);
  const movementSpeed = enemy.speed * (pressurePhase?.eliteSpeedMultiplier ?? 1) * (1 + transitionMobilityRatio * (battle.encounterType === 'boss' ? 0.12 : 0.06));

  const dx = battle.playerX - enemy.x;
  const dy = battle.playerY - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  const strafeX = -dirY;
  const strafeY = dirX;
  const strafeDirection = Math.sin(battle.elapsedSec * 1.35 + enemy.id * 0.7);
  const pressureRatio = Math.min(1, enemy.pressurePulseSec / cycle.pulseSec);
  const recoveryRatio = deps.getEnemyRecoveryRatio(enemy);
  const crackRatio = deps.getEliteCrackWindowRatio(battle);

  let moveX = 0;
  let moveY = 0;

  const canTriggerPulse =
    crackRatio <= 0.08 &&
    enemy.pressurePulseSec <= 0 &&
    enemy.tacticCooldownSec <= 0 &&
    enemy.recoverySec <= 0.08 &&
    (
      (activeBehavior === 'frontline' && distance <= preferredDistance * 1.14) ||
      (activeBehavior === 'kiting' && distance <= preferredDistance * 1.08) ||
      (activeBehavior === 'screened' && escortCount > 0 && distance <= preferredDistance * 1.14) ||
      (activeBehavior === 'summoner' && (escortCount <= 1 || distance <= preferredDistance * 0.9))
    );

  if (canTriggerPulse) {
    startElitePressurePulse(enemy, battle, template, activeBehavior, deps);
  }

  // Movement logic based on behavior
  switch (activeBehavior) {
    case 'kiting':
      applyKitingBaseline(moveX, moveY, distance, preferredDistance, dirX, dirY, strafeX, strafeY, strafeDirection, strafeStrength, pressureRatio);
      break;
    case 'screened':
    case 'summoner':
      applyScreenedBehavior(moveX, moveY, enemy, battle, activeBehavior, distance, preferredDistance, dirX, dirY, strafeX, strafeY, strafeDirection, strafeStrength, pressureRatio, deps);
      break;
    case 'frontline':
    default:
      applyFrontlineBehavior(moveX, moveY, distance, preferredDistance, dirX, dirY, strafeX, strafeY, strafeDirection, strafeStrength, pressureRatio);
      break;
  }

  // Apply crack ratio chase behavior
  applyCrackChaseBehavior(moveX, moveY, enemy, battle, activeBehavior, distance, preferredDistance, dirX, dirY, strafeX, strafeY, strafeDirection, strafeStrength, crackRatio);

  // Apply recovery retreat behavior
  applyRecoveryRetreatBehavior(moveX, moveY, enemy, battle, dirX, dirY, strafeX, strafeY, strafeDirection, recoveryRatio);

  // Apply body block avoidance
  applyBodyBlockAvoidance(moveX, moveY, enemy, battle, dirX, dirY, strafeX, strafeY, strafeDirection);

  const moveMagnitude = Math.max(1, Math.hypot(moveX, moveY));
  const speedMultiplier = 1 + pressureRatio * (activeBehavior === 'frontline' ? 0.18 : activeBehavior === 'kiting' ? 0.12 : 0.1) - recoveryRatio * 0.42 - crackRatio * 0.12;

  enemy.x = clamp(enemy.x + (moveX / moveMagnitude) * movementSpeed * speedMultiplier * dt, -48, ARENA_WIDTH + 48);
  enemy.y = clamp(enemy.y + (moveY / moveMagnitude) * movementSpeed * speedMultiplier * dt, -48, ARENA_HEIGHT + 48);
}

function applyKitingBaseline(
  moveX: number,
  moveY: number,
  distance: number,
  preferredDistance: number,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
  strafeStrength: number,
  pressureRatio: number,
): void {
  if (distance < preferredDistance * 0.88) {
    moveX -= dirX * 1.18;
    moveY -= dirY * 1.18;
  } else if (distance > preferredDistance * 1.14) {
    moveX += dirX * 0.74;
    moveY += dirY * 0.74;
  }
  moveX += strafeX * strafeDirection * strafeStrength;
  moveY += strafeY * strafeDirection * strafeStrength;
  if (pressureRatio > 0) {
    moveX -= dirX * (0.12 + pressureRatio * 0.2);
    moveY -= dirY * (0.12 + pressureRatio * 0.2);
    moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.26);
    moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.26);
  }
}

function applyScreenedBehavior(
  moveX: number,
  moveY: number,
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  activeBehavior: EliteBehaviorId,
  distance: number,
  preferredDistance: number,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
  strafeStrength: number,
  pressureRatio: number,
  deps: EliteBehaviorDeps,
): void {
  const escorts = battle.enemies.filter((candidate) => !candidate.elite && candidate.role === 'escort' && candidate.hp > 0);
  if (escorts.length > 0) {
    const escortCenter = escorts.reduce((acc, escort) => ({ x: acc.x + escort.x, y: acc.y + escort.y }), { x: 0, y: 0 });
    escortCenter.x /= escorts.length;
    escortCenter.y /= escorts.length;
    const screenDx = escortCenter.x - battle.playerX;
    const screenDy = escortCenter.y - battle.playerY;
    const screenDistance = Math.max(1, Math.hypot(screenDx, screenDy));
    const behindDistance = activeBehavior === 'summoner' ? 56 : 42;
    const targetX = escortCenter.x + (screenDx / screenDistance) * behindDistance;
    const targetY = escortCenter.y + (screenDy / screenDistance) * behindDistance;
    const targetDx = targetX - enemy.x;
    const targetDy = targetY - enemy.y;
    const targetDistance = Math.max(1, Math.hypot(targetDx, targetDy));
    moveX += (targetDx / targetDistance) * 0.92;
    moveY += (targetDy / targetDistance) * 0.92;
    moveX += strafeX * strafeDirection * (strafeStrength + 0.04);
    moveY += strafeY * strafeDirection * (strafeStrength + 0.04);
    if (distance < preferredDistance * 0.72) {
      moveX -= dirX * 0.55;
      moveY -= dirY * 0.55;
    }
    if (pressureRatio > 0) {
      const screenStrength = activeBehavior === 'summoner' ? 0.34 : 0.24;
      moveX -= dirX * (screenStrength + pressureRatio * 0.16);
      moveY -= dirY * (screenStrength + pressureRatio * 0.16);
      moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.18);
      moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.18);
    }
  } else {
    applyKitingBaseline(moveX, moveY, distance, preferredDistance, dirX, dirY, strafeX, strafeY, strafeDirection, strafeStrength, pressureRatio);
    if (pressureRatio > 0) {
      moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.14);
      moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.14);
    }
  }
}

function applyFrontlineBehavior(
  moveX: number,
  moveY: number,
  distance: number,
  preferredDistance: number,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
  strafeStrength: number,
  pressureRatio: number,
): void {
  if (distance > preferredDistance * 0.76) {
    moveX += dirX;
    moveY += dirY;
  } else {
    moveX += dirX * 0.28;
    moveY += dirY * 0.28;
  }
  moveX += strafeX * strafeDirection * Math.max(0.08, strafeStrength * 0.6);
  moveY += strafeY * strafeDirection * Math.max(0.08, strafeStrength * 0.6);
  if (pressureRatio > 0) {
    moveX += dirX * (0.4 + pressureRatio * 0.44);
    moveY += dirY * (0.4 + pressureRatio * 0.44);
  }
}

function applyCrackChaseBehavior(
  moveX: number,
  moveY: number,
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  activeBehavior: EliteBehaviorId,
  distance: number,
  preferredDistance: number,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
  strafeStrength: number,
  crackRatio: number,
): void {
  const chaseBlend = Math.min(0.68, 0.22 + crackRatio * 0.42);
  const chaseForward = distance > preferredDistance * 0.84
    ? activeBehavior === 'kiting' ? 0.18 : activeBehavior === 'screened' || activeBehavior === 'summoner' ? 0.26 : 0.34
    : distance < preferredDistance * 0.62
      ? activeBehavior === 'kiting' ? -0.14 : -0.08
      : 0.1;
  const chaseStrafeScale = activeBehavior === 'kiting' ? 0.55 : activeBehavior === 'screened' || activeBehavior === 'summoner' ? 0.4 : 0.28;
  const chaseMoveX = dirX * chaseForward + strafeX * strafeDirection * Math.max(0.04, strafeStrength * chaseStrafeScale);
  const chaseMoveY = dirY * chaseForward + strafeY * strafeDirection * Math.max(0.04, strafeStrength * chaseStrafeScale);
  moveX = moveX * (1 - chaseBlend) + chaseMoveX * chaseBlend;
  moveY = moveY * (1 - chaseBlend) + chaseMoveY * chaseBlend;
}

function applyRecoveryRetreatBehavior(
  moveX: number,
  moveY: number,
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
  recoveryRatio: number,
): void {
  moveX -= dirX * (0.14 + recoveryRatio * 0.24);
  moveY -= dirY * (0.14 + recoveryRatio * 0.24);
  moveX += strafeX * strafeDirection * (0.08 + recoveryRatio * 0.16);
  moveY += strafeY * strafeDirection * (0.08 + recoveryRatio * 0.16);
}

function applyBodyBlockAvoidance(
  moveX: number,
  moveY: number,
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dirX: number,
  dirY: number,
  strafeX: number,
  strafeY: number,
  strafeDirection: number,
): void {
  const bodyBlockDistance = battle.encounterType === 'boss' ? enemy.radius + 92 : enemy.radius + 62;
  const antiBodyBlockRatio = clamp((bodyBlockDistance - Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY)) / bodyBlockDistance, 0, 1);
  if (antiBodyBlockRatio > 0) {
    const awayStrength = battle.encounterType === 'boss' ? 2.15 + antiBodyBlockRatio * 2.1 : 1.35 + antiBodyBlockRatio * 1.15;
    moveX -= dirX * awayStrength;
    moveY -= dirY * awayStrength;
    moveX += strafeX * strafeDirection * (0.2 + antiBodyBlockRatio * 0.35);
    moveY += strafeY * strafeDirection * (0.2 + antiBodyBlockRatio * 0.35);
  }
}

function startElitePressurePulse(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  template: BattleTemplateDefinition,
  behavior: EliteBehaviorId,
  deps: EliteBehaviorDeps,
): void {
  const cycle = deps.getElitePressureCycle(behavior);
  if (!deps.triggerEnemyPressurePulse(enemy, cycle.pulseSec, cycle.cooldownSec)) {
    return;
  }

  const escortCount = deps.getActiveEscortCount(battle);
  if (behavior === 'kiting') {
    deps.firePressureVolley(battle, 1, { spreadRad: 0.18, shotsPerShooter: 2 });
  } else if (behavior === 'screened') {
    if (escortCount <= 1) {
      deps.spawnPhaseEscortBurst(battle, 1);
    }
  } else if (behavior === 'summoner') {
    deps.spawnPhaseEscortBurst(battle, escortCount === 0 ? 2 : 1);
  } else if (behavior === 'frontline' && escortCount === 0 && (template.eliteRule?.escortBatch ?? 0) > 0) {
    deps.spawnPhaseEscortBurst(battle, 1);
  }

  const syncedEscortState = deps.syncEscortPressureFromElite(battle, enemy, behavior);

  deps.createCombatPulse(battle, {
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius + 16,
    lifeSec: 0.16,
    color: 0xffc47b,
    secondaryColor: 0xfff6d4,
    fillAlpha: 0.06,
    strokeAlpha: 0.62,
    strokeWidth: 3,
    growthPerSec: 168,
    innerRadiusRatio: 0.68,
  });

  if (syncedEscortState.syncedCount > 0) {
    deps.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + 28 + Math.min(12, syncedEscortState.syncedCount * 4),
      lifeSec: 0.12,
      color: 0xffdfae,
      secondaryColor: 0xfff8e2,
      fillAlpha: 0.03,
      strokeAlpha: 0.34,
      strokeWidth: 2,
      growthPerSec: 156,
      innerRadiusRatio: 0.76,
    });
  }

  battle.tempoPulseSec = Math.max(battle.tempoPulseSec, syncedEscortState.syncedCount > 0 ? 0.22 : 0.18);
  deps.enqueueAudio('pressure');
}
