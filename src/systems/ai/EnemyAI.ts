import type { BattleState, BattleTemplateDefinition } from '../../game/types';
import { PLAYER_COLLISION_RADIUS, ARENA_WIDTH, ARENA_HEIGHT, clamp } from '../../data/balance';

export interface EnemyAIDeps {
  getBattleTemplate: (id: string) => BattleTemplateDefinition;
  getEnemyRecoveryRatio: (enemy: BattleState['enemies'][number]) => number;
  getEnemyPressureWindowSec: (enemy: BattleState['enemies'][number]) => number;
  getEnemyRecoveryOnCollisionSec: (enemy: BattleState['enemies'][number]) => number;
  getEnemyArchetypeDef: (id: string) => { strafeStrength?: number; preferredDistance?: number; shotIntervalSec?: number; projectileSpeed?: number; projectileDamageMultiplier?: number; projectileRadius?: number };
  getActivePressurePhase: (battle: BattleState) => { rangedProjectileSpeedMultiplier?: number } | null;
  getPlayerLaneTargetCoordinate: (battle: BattleState, axis: 'horizontal' | 'vertical', laneOffset?: number) => number;
  findNearestAlly: (battle: BattleState, source: BattleState['enemies'][number], predicate?: (candidate: BattleState['enemies'][number]) => boolean) => BattleState['enemies'][number] | null;
  countNearbyAllies: (battle: BattleState, source: BattleState['enemies'][number], maxDistance: number, predicate?: (candidate: BattleState['enemies'][number]) => boolean) => number;
  getOrdinaryBattleSurgeRatio: (battle: BattleState) => number;
  isPickupLeadEnemy: (battle: BattleState, enemy: BattleState['enemies'][number]) => boolean;
  getPickupLeadRatio: (battle: BattleState) => number;
  triggerRegularPressureBeat: (battle: BattleState, enemy: BattleState['enemies'][number], durationSec: number, cooldownSec: number, options?: { rangedLeadSec?: number }) => boolean;
  syncRegularPressurePack: (battle: BattleState, source: BattleState['enemies'][number], options?: { radius?: number; limit?: number; durationSec?: number; cooldownSec?: number; predicate?: (candidate: BattleState['enemies'][number]) => boolean }) => number;
  primeRegularPressureLead: (battle: BattleState, enemy: BattleState['enemies'][number], intensity?: number) => void;
  enqueueRegularRelayAudio: (archetype: string) => void;
  pushEnemyRecovery: (enemy: BattleState['enemies'][number], recoverySec: number) => void;
  createCombatPulse: (battle: BattleState, config: { x: number; y: number; radius: number; lifeSec: number; color: number; secondaryColor?: number; fillAlpha?: number; strokeAlpha?: number; strokeWidth?: number; growthPerSec?: number; innerRadiusRatio?: number; spokeCount?: number; spokeLength?: number; angle?: number; spinRate?: number }) => void;
  spawnEnemyProjectile: (battle: BattleState, x: number, y: number, speed: number, damage: number, radius: number, angle: number) => void;
  getRangedShotIntervalSec: (archetype: ReturnType<typeof import('../../data/enemyArchetypes').getEnemyArchetype>, battle: BattleState) => number;
  isSkirmisherHeavyTemplate: (template: BattleTemplateDefinition) => boolean;
  isRangedHeavyTemplate: (template: BattleTemplateDefinition) => boolean;
  debugConfig: { freezeEnemyMovement: boolean; freezeEnemyProjectiles: boolean; invulnerablePlayer: boolean };
  state: { routeCounts: { dash: number }; stats: { dashInvulnerability: number; hp: number; maxHp: number } };
  getDashGrazeOuterRadius: (buildStage: string) => number;
  getDashGrazeInnerRadius: () => number;
  finishBattleOnPlayerDefeat: (battle: BattleState) => boolean;
  queueImpactFreeze: (battle: BattleState, durationSec: number, factor: number) => void;
  pushPlayerKnockback: (battle: BattleState, sourceX: number, sourceY: number, force: number) => void;
  kickBattleShake: (battle: BattleState, durationSec: number, strength: number, frequency: number) => void;
  registerPlayerThreatDirection: (battle: BattleState, sourceX: number, sourceY: number, flashSec: number) => void;
  dampenEliteBreachProjectile: (battle: BattleState, projectile: BattleState['enemyProjectiles'][number], dt: number) => boolean;
  isPointInsidePressureSafeWindow: (battle: BattleState, x: number, y: number, padding: number) => boolean;
  getEliteEnemy: (battle: BattleState) => BattleState['enemies'][number] | null;
  getEliteCrackWindowRatio: (battle: BattleState) => number;
  stabilizeEliteCrackEscort: (battle: BattleState, escort: BattleState['enemies'][number]) => void;
  updateEliteEnemy: (enemy: BattleState['enemies'][number], battle: BattleState, template: BattleTemplateDefinition, dt: number) => void;
  resolveElitePressurePulse: (enemy: BattleState['enemies'][number], battle: BattleState, template: BattleTemplateDefinition) => void;
  handleEnemyDefeated: (battle: BattleState, enemy: BattleState['enemies'][number]) => void;
  updateEscortEnemy: (enemy: BattleState['enemies'][number], battle: BattleState, dt: number) => void;
  enqueueAudio: (cue: string) => void;
}

export function updateEnemies(battle: BattleState, dt: number, deps: EnemyAIDeps): void {
  const template = deps.getBattleTemplate(battle.templateId);
  const survivors: BattleState['enemies'] = [];

  for (const enemy of battle.enemies) {
    const previousX = enemy.x;
    const previousY = enemy.y;
    const hadPressurePulse = enemy.pressurePulseSec > 0;

    enemy.guardSec = Math.max(0, enemy.guardSec - dt);
    if (enemy.elite && enemy.guardSec <= 0) {
      enemy.guardDamageMultiplier = template.eliteRule?.guardDamageMultiplier ?? 1;
    }
    enemy.grazeCooldownSec = Math.max(0, enemy.grazeCooldownSec - dt);
    enemy.recoverySec = Math.max(0, enemy.recoverySec - dt);
    enemy.hitFlashSec = Math.max(0, enemy.hitFlashSec - dt);
    enemy.spawnFlashSec = Math.max(0, enemy.spawnFlashSec - dt);
    enemy.pressurePulseSec = Math.max(0, enemy.pressurePulseSec - dt);
    enemy.tacticCooldownSec = Math.max(0, enemy.tacticCooldownSec - dt);
    enemy.critMarkSec = Math.max(0, enemy.critMarkSec - dt);
    enemy.pierceMarkSec = Math.max(0, enemy.pierceMarkSec - dt);
    enemy.dashMarkSec = Math.max(0, enemy.dashMarkSec - dt);
    enemy.routeHitFlashSec = Math.max(0, (enemy.routeHitFlashSec ?? 0) - dt);
    enemy.hitOffsetX *= Math.max(0, 1 - dt * 14);
    enemy.hitOffsetY *= Math.max(0, 1 - dt * 14);

    if (enemy.hp <= 0) {
      battle.kills += 1;
      deps.handleEnemyDefeated(battle, enemy);
      if (enemy.elite) {
        battle.eliteAlive = false;
      }
      continue;
    }

    if (enemy.elite && template.eliteRule) {
      deps.updateEliteEnemy(enemy, battle, template, dt);
    } else {
      if (!enemy.elite && enemy.role === 'escort' && battle.eliteAlive && battle.eliteCrackWindowSec > 0) {
        deps.stabilizeEliteCrackEscort(battle, enemy);
      }
      updateArchetypeEnemy(enemy, battle, dt, deps);
    }

    if (enemy.elite && hadPressurePulse && enemy.pressurePulseSec <= 0) {
      deps.resolveElitePressurePulse(enemy, battle, template);
    }

    if (deps.debugConfig.freezeEnemyMovement) {
      enemy.x = previousX;
      enemy.y = previousY;
      enemy.hitOffsetX = 0;
      enemy.hitOffsetY = 0;
    }

    enemy.debugMoveVX = dt > 0 ? (enemy.x - previousX) / dt : 0;
    enemy.debugMoveVY = dt > 0 ? (enemy.y - previousY) / dt : 0;

    const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
    const dashStage = deps.state.routeCounts.dash > 0 ? 'committed' : 'unformed';
    if (
      deps.state.routeCounts.dash > 0 &&
      enemy.grazeCooldownSec <= 0 &&
      distance <= deps.getDashGrazeOuterRadius(dashStage) &&
      distance > deps.getDashGrazeInnerRadius()
    ) {
      enemy.grazeCooldownSec = 0.8;
      battle.dashCharge = Math.min(6, battle.dashCharge + 1);
      deps.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 8,
        lifeSec: 0.14,
        color: 0x77ffd9,
        secondaryColor: 0xf2fffb,
        fillAlpha: 0.05,
        strokeAlpha: 0.42,
        strokeWidth: 2,
        growthPerSec: 128,
        innerRadiusRatio: 0.76,
      });
      if (dashStage === 'committed') {
        battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.7);
        battle.dashCooldownSec = Math.max(0.75, battle.dashCooldownSec - 0.35);
        deps.state.stats.hp = clamp(deps.state.stats.hp + 0.22, 0, deps.state.stats.maxHp);
        battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.12);
      }
    }

    if (distance <= enemy.radius + PLAYER_COLLISION_RADIUS) {
      if (battle.invulnerableSec <= 0 && !deps.debugConfig.invulnerablePlayer) {
        if (
          battle.encounterType === 'boss' &&
          deps.isPointInsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12)
        ) {
          battle.invulnerableSec = Math.max(battle.invulnerableSec, 0.12);
          const bounceAngle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
          enemy.x = clamp(enemy.x + Math.cos(bounceAngle) * 34, -48, ARENA_WIDTH + 48);
          enemy.y = clamp(enemy.y + Math.sin(bounceAngle) * 34, -48, ARENA_HEIGHT + 48);
          enemy.hitFlashSec = Math.max(enemy.hitFlashSec, 0.12);
          continue;
        }
      }
      const bounceAngle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
      const bounceDistance = enemy.elite ? 14 : 22;
      enemy.x = clamp(enemy.x + Math.cos(bounceAngle) * bounceDistance, -48, ARENA_WIDTH + 48);
      enemy.y = clamp(enemy.y + Math.sin(bounceAngle) * bounceDistance, -48, ARENA_HEIGHT + 48);
      enemy.hitOffsetX = Math.cos(bounceAngle) * (enemy.elite ? 8 : 11);
      enemy.hitOffsetY = Math.sin(bounceAngle) * (enemy.elite ? 8 : 11);
      enemy.hitFlashSec = Math.max(enemy.hitFlashSec, 0.1);
      deps.pushEnemyRecovery(enemy, deps.getEnemyRecoveryOnCollisionSec(enemy));
      deps.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 12,
        lifeSec: 0.14,
        color: 0xbef6ff,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.42,
        strokeWidth: 2,
        growthPerSec: 140,
        innerRadiusRatio: 0.72,
      });
      if (deps.debugConfig.freezeEnemyMovement) {
        enemy.x = previousX;
        enemy.y = previousY;
        enemy.hitOffsetX = 0;
        enemy.hitOffsetY = 0;
      }
      enemy.debugMoveVX = dt > 0 ? (enemy.x - previousX) / dt : 0;
      enemy.debugMoveVY = dt > 0 ? (enemy.y - previousY) / dt : 0;
      survivors.push(enemy);
      continue;
    }

    survivors.push(enemy);
  }

  battle.enemies = survivors;
}

function updateArchetypeEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dt: number,
  deps: EnemyAIDeps,
): void {
  if (enemy.role === 'escort') {
    deps.updateEscortEnemy(enemy, battle, dt);
    return;
  }

  switch (enemy.archetype) {
    case 'standard':
      updateStandardEnemy(enemy, battle, dt, deps);
      return;
    case 'brute':
      updateBruteEnemy(enemy, battle, dt, deps);
      return;
    case 'skirmisher':
      updateSkirmisherEnemy(enemy, battle, dt, deps);
      return;
    case 'ranged':
      updateRangedEnemy(enemy, battle, dt, deps);
      return;
    default:
      updateStandardEnemy(enemy, battle, dt, deps);
      return;
  }
}

function updateStandardEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dt: number,
  deps: EnemyAIDeps,
): void {
  const dx = battle.playerX - enemy.x;
  const dy = battle.playerY - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  enemy.x = clamp(enemy.x + dirX * enemy.speed * dt * 0.5, -36, ARENA_WIDTH + 36);
  enemy.y = clamp(enemy.y + dirY * enemy.speed * dt * 0.5, -36, ARENA_HEIGHT + 36);
}

function updateBruteEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dt: number,
  deps: EnemyAIDeps,
): void {
  const dx = battle.playerX - enemy.x;
  const dy = battle.playerY - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  enemy.x = clamp(enemy.x + dirX * enemy.speed * dt * 0.4, -44, ARENA_WIDTH + 44);
  enemy.y = clamp(enemy.y + dirY * enemy.speed * dt * 0.4, -44, ARENA_HEIGHT + 44);
}

function updateSkirmisherEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dt: number,
  deps: EnemyAIDeps,
): void {
  const dx = battle.playerX - enemy.x;
  const dy = battle.playerY - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  enemy.x = clamp(enemy.x + dirX * enemy.speed * dt * 0.6, -36, ARENA_WIDTH + 36);
  enemy.y = clamp(enemy.y + dirY * enemy.speed * dt * 0.6, -36, ARENA_HEIGHT + 36);
}

function updateRangedEnemy(
  enemy: BattleState['enemies'][number],
  battle: BattleState,
  dt: number,
  deps: EnemyAIDeps,
): void {
  const dx = battle.playerX - enemy.x;
  const dy = battle.playerY - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  enemy.x = clamp(enemy.x - dirX * enemy.speed * dt * 0.3, -42, ARENA_WIDTH + 42);
  enemy.y = clamp(enemy.y - dirY * enemy.speed * dt * 0.3, -42, ARENA_HEIGHT + 42);
}

export function updateEnemyProjectiles(battle: BattleState, dt: number, deps: EnemyAIDeps): void {
  const survivors: BattleState['enemyProjectiles'] = [];

  for (const projectile of battle.enemyProjectiles) {
    if (!deps.debugConfig.freezeEnemyProjectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.lifeSec -= dt;
    }

    if (
      projectile.lifeSec <= 0 ||
      projectile.x < -48 ||
      projectile.x > ARENA_WIDTH + 48 ||
      projectile.y < -48 ||
      projectile.y > ARENA_HEIGHT + 48
    ) {
      continue;
    }

    // 安全区内清理所有弹体（不论 Boss 还是普通战斗）
    if (
      battle.pressureSafeWindowSec > 0 &&
      deps.isPointInsidePressureSafeWindow(battle, projectile.x, projectile.y, projectile.radius + 14)
    ) {
      battle.insideSafeProjectileClears += 1;
      continue;
    }

    if (deps.dampenEliteBreachProjectile(battle, projectile, dt)) {
      continue;
    }

    const distance = Math.hypot(projectile.x - battle.playerX, projectile.y - battle.playerY);
    if (!deps.debugConfig.freezeEnemyProjectiles && distance <= projectile.radius + PLAYER_COLLISION_RADIUS) {
      if (battle.invulnerableSec <= 0 && !deps.debugConfig.invulnerablePlayer) {
        deps.state.stats.hp = clamp(deps.state.stats.hp - projectile.damage, 0, deps.state.stats.maxHp);
        battle.invulnerableSec = 0.32;
        battle.playerImpactSec = Math.max(battle.playerImpactSec, 0.3);
        deps.queueImpactFreeze(battle, projectile.radius > 5 ? 0.082 : 0.062, projectile.radius > 5 ? 0.12 : 0.16);
        deps.pushPlayerKnockback(battle, projectile.x, projectile.y, projectile.radius > 5 ? 220 : 170);
        deps.kickBattleShake(battle, 0.2, projectile.radius > 5 ? 0.44 : 0.4, 9);
        deps.registerPlayerThreatDirection(battle, projectile.x, projectile.y, 0.3);
        deps.createCombatPulse(battle, {
          x: battle.playerX,
          y: battle.playerY,
          radius: projectile.radius + 16,
          lifeSec: 0.2,
          color: 0xff7b68,
          secondaryColor: 0xffddd7,
          fillAlpha: 0.1,
          strokeAlpha: 0.84,
          strokeWidth: 3,
          growthPerSec: 180,
          innerRadiusRatio: 0.62,
          spokeCount: projectile.radius > 5 ? 5 : 4,
          spokeLength: projectile.radius > 5 ? 24 : 18,
          angle: Math.atan2(battle.playerY - projectile.y, battle.playerX - projectile.x),
          spinRate: projectile.radius > 5 ? 6 : 4.8,
        });
        deps.enqueueAudio('hurt');
        if (deps.finishBattleOnPlayerDefeat(battle)) {
          battle.enemyProjectiles = survivors;
          return;
        }
      }
      continue;
    }

    survivors.push(projectile);
  }

  battle.enemyProjectiles = survivors;
}
