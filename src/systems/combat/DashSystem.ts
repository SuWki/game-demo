import type { BattleState, RouteBuildStage } from '../../game/types';
import { clamp } from '../../data/balance';

export interface DashSystemDeps {
  getRouteBuildStage: (routeId: string) => RouteBuildStage;
  getDashPulseRadius: (dashCharge: number, buildStage: RouteBuildStage) => number;
  getDashPulseDamage: (dashCharge: number, buildStage: RouteBuildStage) => number;
  getDashCooldownAfterPulse: (buildStage: RouteBuildStage) => number;
  getDashDriveDuration: (dashCharge: number) => number;
  createCombatPulse: (battle: BattleState, config: { x: number; y: number; radius: number; lifeSec: number; color: number; secondaryColor?: number; fillAlpha?: number; strokeAlpha?: number; strokeWidth?: number; growthPerSec?: number; innerRadiusRatio?: number; spokeCount?: number; spokeLength?: number; angle?: number; spinRate?: number }) => void;
  kickBattleShake: (battle: BattleState, durationSec: number, strength: number, frequency: number) => void;
  enqueueAudio: (cue: string) => void;
  enqueueTip: (text: string) => void;
  queueRouteMoment: (routeId: string, text: string) => void;
  getRouteStageMomentText: (routeId: string, stage: 'starter' | 'bridge' | 'payoff') => string;
  registerEnemyImpact?: (battle: BattleState, enemy: BattleState['enemies'][number], sourceX: number, sourceY: number, options?: { flashSec?: number; kick?: number; pulseRadius?: number; pulseColor?: number; secondaryColor?: number }) => void;
  state: { stats: { dashPulseDamage: number; dashInvulnerability: number }; routeCounts: { dash: number }; activeRoutePerks?: Record<string, boolean> };
  routeMomentShown: Record<string, boolean>;
}

export function updateDashCooldown(battle: BattleState, dt: number): void {
  battle.dashCooldownSec -= dt;
}

export function tryTriggerDash(
  battle: BattleState,
  deps: DashSystemDeps,
): boolean {
  if ((deps.state.stats.dashPulseDamage <= 0 && deps.state.routeCounts.dash <= 0) || battle.dashCooldownSec > 0) {
    return false;
  }

  const dashStage = deps.getRouteBuildStage('dash');
  const dashCharge = battle.dashCharge;
  const pulseRadius = deps.getDashPulseRadius(dashCharge, dashStage);
  const pulseDamage = deps.getDashPulseDamage(dashCharge, dashStage);
  let dashPulseHits = 0;

  battle.dashCooldownSec = deps.getDashCooldownAfterPulse(dashStage);
  battle.invulnerableSec = deps.state.stats.dashInvulnerability + (dashStage === 'matured' ? 0.12 : 0);
  battle.dashDriveSec = Math.max(battle.dashDriveSec, deps.getDashDriveDuration(dashCharge));

  deps.createCombatPulse(battle, {
    x: battle.playerX,
    y: battle.playerY,
    radius: Math.max(34, pulseRadius * 0.52),
    lifeSec: 0.32,
    color: 0x8dffe3,
    secondaryColor: 0xf4fffd,
    fillAlpha: 0.12,
    strokeAlpha: 0.94,
    strokeWidth: 3,
    growthPerSec: 240,
    innerRadiusRatio: 0.58,
    spokeCount: 6 + Math.min(3, dashCharge),
    spokeLength: 22 + dashCharge * 3,
    angle: Math.atan2(battle.playerAimDirY, battle.playerAimDirX),
    spinRate: 9.2,
  });
  deps.kickBattleShake(battle, 0.18, 0.42 + dashCharge * 0.06, 20);
  battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18);
  deps.enqueueAudio('dash');

  battle.dashCounterWindowSec = 1.2;

  if (dashStage === 'committed' || dashStage === 'matured') {
    battle.dashGhostStrikeReady = true;
  }

  if (dashStage === 'committed' || dashStage === 'matured') {
    battle.dashMomentumStacks = Math.min(5, battle.dashMomentumStacks + 1);
    battle.dashMomentumDecaySec = 2.0;
  }

  for (const enemy of battle.enemies) {
    const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
    if (distance <= pulseRadius) {
      enemy.hp -= pulseDamage;
      dashPulseHits += 1;
      enemy.lastHitWasCrit = false;
      enemy.lastHitWasPierce = false;

      const oldStacks = enemy.dashPulseStacks ?? 0;
      enemy.dashMarkSec = 1.5;
      enemy.routeHitFlashSec = 0.16;
      enemy.routeHitKind = 'dash';

      const stackGain = (oldStacks === 0 && (deps.state.activeRoutePerks?.dashBrush ?? false)) ? 2 : 1;
      enemy.dashPulseStacks = Math.min(3, oldStacks + stackGain);

      if ((deps.state.activeRoutePerks?.dashSidestepBank ?? false) && battle.dashCounterWindowSec > 0) {
        enemy.dashPulseStacks = Math.min(3, enemy.dashPulseStacks + 1);
      }

      if (enemy.dashPulseStacks >= 3) {
        let returnDamage = 6;
        if ((deps.state.activeRoutePerks?.dashZeroWindow ?? false) && enemy.dashMarkSec > 0) {
          returnDamage += 4;
        }
        enemy.hp -= returnDamage;
        enemy.dashPulseStacks = 0;
        enemy.dashMarkedForBonus = true;

        deps.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 20,
          lifeSec: 0.20,
          color: 0x7aff7a,
          secondaryColor: 0xc8ffc8,
          fillAlpha: 0.10,
          strokeAlpha: 0.82,
          strokeWidth: 2.5,
          growthPerSec: 200,
          innerRadiusRatio: 0.5,
        });
        deps.enqueueAudio('dashHit');
      }

      if ((deps.state.activeRoutePerks?.dashAfterimage ?? false) && enemy.dashPulseStacks === 0) {
        enemy.hp -= 3;
        enemy.routeHitFlashSec = 0.12;
        deps.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 15,
          lifeSec: 0.15,
          color: 0x5aff5a,
          secondaryColor: 0xa0ffa0,
          fillAlpha: 0.06,
          strokeAlpha: 0.6,
          strokeWidth: 1.5,
          growthPerSec: 150,
          innerRadiusRatio: 0.6,
        });
      }

      if (deps.registerEnemyImpact) {
        deps.registerEnemyImpact(battle, enemy, battle.playerX, battle.playerY, {
          flashSec: 0.18,
          kick: 12,
          pulseRadius: enemy.radius + 10,
          pulseColor: 0x86ffd1,
          secondaryColor: 0xffffff,
        });
      }

      if (deps.state.routeCounts.dash > 0) {
        const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
        const knockback = (dashStage === 'matured' ? 40 : dashStage === 'committed' ? 30 : 18) + dashCharge * 4;
        enemy.x += Math.cos(angle) * knockback;
        enemy.y += Math.sin(angle) * knockback;
      }
    }
  }

  const dashMomentStage = dashStage === 'matured' ? 'payoff' : dashStage === 'committed' ? 'bridge' : 'starter';
  if (dashPulseHits > 0) {
    deps.enqueueAudio('dashPulse');
    deps.enqueueTip(`贴身一圈打到 ${dashPulseHits} 个敌人`);
  } else {
    deps.enqueueTip('贴身一圈：拿到短暂无伤');
  }

  if (dashCharge >= 2 && !deps.routeMomentShown.dash) {
    deps.routeMomentShown.dash = true;
    deps.queueRouteMoment('dash', deps.getRouteStageMomentText('dash', dashMomentStage));
  }

  battle.dashCharge = 0;
  return true;
}
