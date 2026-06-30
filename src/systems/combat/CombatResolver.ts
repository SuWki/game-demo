import type { BattleState, RouteBuildStage } from '../../game/types';

export interface CombatResolverDeps {
  getEffectiveCritChance: (battle: BattleState) => number;
  getEnemyRecoveryRatio: (enemy: BattleState['enemies'][number]) => number;
  getEliteCrackWindowRatio: (battle: BattleState) => number;
  getOrdinaryBattleSurgeRatio: (battle: BattleState) => number;
  isPickupLeadEnemy: (battle: BattleState, enemy: BattleState['enemies'][number]) => boolean;
  getPickupLeadRatio: (battle: BattleState) => number;
  getPierceLaneScore: (battle: BattleState, enemy: BattleState['enemies'][number]) => number;
  registerEnemyImpact: (battle: BattleState, enemy: BattleState['enemies'][number], sourceX: number, sourceY: number, options?: { flashSec?: number; kick?: number; pulseRadius?: number; pulseColor?: number; secondaryColor?: number }) => void;
  kickBattleShake: (battle: BattleState, durationSec: number, strength: number, frequency: number) => void;
  createCombatPulse: (battle: BattleState, config: { x: number; y: number; radius: number; lifeSec: number; color: number; secondaryColor?: number; fillAlpha?: number; strokeAlpha?: number; strokeWidth?: number; growthPerSec?: number; innerRadiusRatio?: number; spokeCount?: number; spokeLength?: number; angle?: number; spinRate?: number }) => void;
  enqueueAudio: (cue: string) => void;
  triggerPierceCrack: (battle: BattleState, enemy: BattleState['enemies'][number], bullet: BattleState['bullets'][number]) => void;
  trySpawnPierceEchoShots: (battle: BattleState, bullet: BattleState['bullets'][number], currentEnemy: BattleState['enemies'][number]) => void;
  applyEliteBreachHitFollowThrough: (battle: BattleState, enemy: BattleState['enemies'][number], bulletRouteFocus: string, critical: boolean, recoveryRatio: number, critStage: RouteBuildStage, pierceStage: RouteBuildStage, dashStage: RouteBuildStage) => void;
  markEliteCrackFollowThroughMoment: (battle: BattleState, strength: number) => void;
  applyDashDriveHitFollowThrough: (battle: BattleState, enemy: BattleState['enemies'][number], bulletRouteFocus: string, critical: boolean, recoveryRatio: number, eliteCrackRatio: number, dashStage: RouteBuildStage) => void;
  getRouteBuildStage: (routeId: string) => RouteBuildStage;
  getLiveCombatFocusRoute: (battle: BattleState) => string | null;
  queueRouteMoment: (routeId: string, text: string) => void;
  getRouteStageMomentText: (routeId: string, stage: 'starter' | 'bridge' | 'payoff') => string;
  enqueueTip: (text: string) => void;
  routeMomentShown: Record<string, boolean>;
  state: { stats: { critMultiplier: number }; routeCounts: { crit: number; pierce: number; dash: number }; activeRoutePerks?: Record<string, boolean> };
}

export function resolveBulletHit(
  battle: BattleState,
  bullet: BattleState['bullets'][number],
  enemy: BattleState['enemies'][number],
  deps: CombatResolverDeps,
): void {
  const critical = Math.random() < deps.getEffectiveCritChance(battle);
  let damage = critical ? bullet.damage * deps.state.stats.critMultiplier : bullet.damage;

  const critStage = deps.getRouteBuildStage('crit');
  if (critStage === 'committed' || critStage === 'matured') {
    if (!critical) {
      battle.critComboStacks = Math.min(5, battle.critComboStacks + 1);
      battle.critComboDecaySec = 2.0;
      if (battle.critComboStacks >= 5) {
        battle.critFinisherReady = true;
      }
    } else {
      if (battle.critFinisherReady) {
        damage *= 2.5;
        battle.critFinisherReady = false;
        battle.critComboStacks = 0;
        battle.critComboDecaySec = 0;
        battle.critBurstChainCount = 0;
        battle.critBurstChainSec = 2.0;
      } else if (battle.critBurstChainSec > 0 && battle.critBurstChainCount < 3) {
        damage *= 1.3;
        battle.critBurstChainCount += 1;
      }
      battle.critComboDecaySec = 2.0;
    }
  }

  if (bullet.routeFocus === 'pierce' || bullet.hitCount > 0) {
    damage *= Math.max(0.38, 1 - bullet.hitCount * 0.24);
  }

  const recoveryRatio = deps.getEnemyRecoveryRatio(enemy);
  const eliteCrackRatio = enemy.elite ? deps.getEliteCrackWindowRatio(battle) : 0;
  const ordinarySurgeRatio = deps.getOrdinaryBattleSurgeRatio(battle);
  const pickupLeadRatio = deps.isPickupLeadEnemy(battle, enemy) ? deps.getPickupLeadRatio(battle) : 0;

  if (recoveryRatio > 0) {
    const punishBonus = bullet.routeFocus === 'crit' ? 0.22 : bullet.routeFocus === 'pierce' ? 0.16 : bullet.routeFocus === 'dash' ? 0.14 : 0.12;
    damage *= 1 + punishBonus * recoveryRatio;
  }

  if (enemy.elite && eliteCrackRatio > 0.08) {
    if (bullet.routeFocus === 'crit') {
      damage *= 1 + 0.08 + eliteCrackRatio * 0.14;
    } else if (bullet.routeFocus === 'pierce') {
      const laneScore = deps.getPierceLaneScore(battle, enemy);
      damage *= 1 + Math.min(0.18, 0.06 + eliteCrackRatio * 0.08 + laneScore * 0.018);
    } else {
      damage *= 1 + eliteCrackRatio * 0.06;
    }
  }

  if (!enemy.elite && pickupLeadRatio > 0.08) {
    damage *= 1 + 0.04 + ordinarySurgeRatio * 0.06 + pickupLeadRatio * 0.08;
  }

  if (enemy.elite && enemy.guardSec > 0) {
    damage *= enemy.guardDamageMultiplier;
  }

  if (battle.dashZeroWindowReady && battle.dashCounterWindowSec > 0 && enemy.dashMarkSec > 0) {
    damage *= 1.25;
    enemy.routeHitFlashSec = 0.18;
  }

  enemy.hp -= damage;
  bullet.hitCount += 1;

  // 伤害飘字
  const damageKind: 'normal' | 'crit' | 'pierce' | 'dash' = critical
    ? 'crit'
    : bullet.routeFocus === 'pierce'
      ? 'pierce'
      : bullet.routeFocus === 'dash'
        ? 'dash'
        : 'normal';
  battle.damageNumbers.push({
    x: enemy.x + (Math.random() - 0.5) * 12,
    y: enemy.y - enemy.radius - 4,
    value: Math.round(damage),
    lifeSec: critical ? 0.9 : 0.65,
    maxLifeSec: critical ? 0.9 : 0.65,
    kind: damageKind,
    velocityX: (Math.random() - 0.5) * 30,
    velocityY: -55 - Math.random() * 20,
  });

  enemy.lastHitWasCrit = critical;
  enemy.lastHitWasPierce = bullet.hitCount > 1 || bullet.routeFocus === 'pierce';

  const pierceStage = deps.getRouteBuildStage('pierce');
  if (pierceStage === 'committed' || pierceStage === 'matured') {
    if (bullet.hitCount > 1) {
      battle.pierceFractureMark.add(enemy.id);
      battle.pierceChainStacks = Math.min(3, battle.pierceChainStacks + 1);
      battle.pierceChainDecaySec = 2.0;

      if (battle.pierceChainStacks >= 3) {
        deps.triggerPierceCrack(battle, enemy, bullet);
        battle.pierceChainStacks = 0;
        battle.pierceChainDecaySec = 0;
      }
    }
  }

  const impactCue: string = critical ? 'crit' : bullet.routeFocus === 'pierce' ? 'pierceHit' : bullet.routeFocus === 'dash' ? 'dashHit' : 'hit';
  deps.enqueueAudio(impactCue);
  deps.registerEnemyImpact(battle, enemy, bullet.x, bullet.y, {
    flashSec: critical ? 0.22 : 0.14,
    kick: critical ? 11 : 6,
    pulseRadius: enemy.radius + (critical ? 12 : 6),
    pulseColor: critical ? 0xffcf74 : 0xff7d86,
    secondaryColor: critical ? 0xfff8d4 : 0xffffff,
  });
  deps.kickBattleShake(battle, critical ? 0.14 : 0.08, critical ? 0.34 : 0.14, critical ? 30 : 25);

  deps.applyEliteBreachHitFollowThrough(battle, enemy, bullet.routeFocus ?? '', critical, recoveryRatio, critStage, pierceStage, deps.getRouteBuildStage('dash'));

  if (enemy.elite && eliteCrackRatio > 0.08) {
    deps.markEliteCrackFollowThroughMoment(battle, eliteCrackRatio * 0.68 + recoveryRatio * 0.22 + (critical ? 0.1 : 0));
  }

  deps.trySpawnPierceEchoShots(battle, bullet, enemy);
}
