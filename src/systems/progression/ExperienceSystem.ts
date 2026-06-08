import { getExperienceToNextLevel } from '../../data/balance';
import type { BattleState, RunState } from '../../game/types';

export interface ExperienceSystemDeps {
  state: RunState;
  enqueueAudio: (cue: string) => void;
  enqueueTip: (text: string) => void;
  rollUpgradeChoices: (source: string) => import('../../game/types').UpgradeDefinition[];
  openQueuedLevelUpPanel: () => void;
}

export function gainExperience(deps: ExperienceSystemDeps, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  deps.state.experience += amount;
  let leveled = false;

  let guard = 0;
  while (deps.state.experience >= deps.state.experienceToNext && guard < 100) {
    if (!Number.isFinite(deps.state.experience) || !Number.isFinite(deps.state.experienceToNext)) {
      break;
    }
    deps.state.experience -= deps.state.experienceToNext;
    deps.state.level += 1;
    deps.state.experienceToNext = getExperienceToNextLevel(deps.state.level);
    deps.state.queuedLevelUps += 1;
    leveled = true;
    guard += 1;
  }

  if (leveled) {
    deps.enqueueAudio('levelUpReady');
    deps.enqueueTip(`等级提升 Lv.${deps.state.level}`);
    if (deps.state.status === 'battle' || deps.state.status === 'nodeChoice') {
      deps.state.upgradeFlashSec = Math.max(deps.state.upgradeFlashSec, 0.4);
      deps.state.levelUpPanelDelaySec = Math.max(deps.state.levelUpPanelDelaySec, 0.55);
    } else {
      deps.openQueuedLevelUpPanel();
    }
  }
}

export function openQueuedLevelUpPanel(deps: ExperienceSystemDeps): void {
  if (deps.state.queuedLevelUps <= 0 || deps.state.status === 'result') {
    return;
  }
  deps.state.levelUpPanelDelaySec = 0;
  deps.state.status = 'upgradeChoice';
  deps.state.upgradeSource = 'levelUp';
  deps.state.currentUpgradeIsReward = deps.state.queuedRewardUpgrades > 0;
  deps.state.upgradeChoices = deps.rollUpgradeChoices('levelUp');
  deps.state.currentEvent = null;
  deps.state.nodeOptions = [];
    if (deps.state.upgradeChoices.length === 0) {
      deps.state.queuedLevelUps = Math.max(0, deps.state.queuedLevelUps - 1);
      if (deps.state.currentUpgradeIsReward) {
        deps.state.queuedRewardUpgrades = Math.max(0, deps.state.queuedRewardUpgrades - 1);
      }
      deps.state.currentUpgradeIsReward = false;
      if (deps.state.queuedLevelUps > 0) {
        openQueuedLevelUpPanel(deps);
        return;
      }
      if (deps.state.status === 'upgradeChoice') {
        deps.state.status = 'battle';
      }
      return;
    }
}

export function updateExperienceOrbs(
  battle: BattleState,
  dt: number,
  playerX: number,
  playerY: number,
  pickupRadius: number,
  magnetRadius: number,
  killStreakMultiplier: number,
  killFlowSec: number,
  killFlowCount: number,
  pickupFlowSec: number,
  pickupFlowCount: number,
  tempoPulseSec: number,
  gainExperienceFn: (amount: number) => void,
  registerPickupFlowFn: (orbValue: number) => number,
): void {
  const flowRatio =
    killFlowSec > 0
      ? Math.min(1, killFlowSec / (killFlowCount >= 3 ? 1 : killFlowCount >= 2 ? 0.86 : 0.72))
      : 0;
  const pickupFlowRatio =
    pickupFlowSec > 0 && pickupFlowCount > 0
      ? Math.min(1, pickupFlowSec / getPickupFlowWindowSec(pickupFlowCount))
      : 0;
  const flowCarry = flowRatio > 0 ? killFlowCount * 0.72 + flowRatio * 1.24 : 0;
  const pickupCarry = pickupFlowRatio > 0 ? pickupFlowCount * 0.34 + pickupFlowRatio * 0.9 : 0;
  const effectiveMagnetRadius =
    magnetRadius +
    (flowRatio > 0 ? 38 + killFlowCount * 12 : 0) +
    (pickupFlowRatio > 0 ? 24 + pickupFlowCount * 9 : 0);
  const survivors = [];

  for (const orb of battle.experienceOrbs) {
    const distance = Math.hypot(orb.x - playerX, orb.y - playerY);
    if (distance <= pickupRadius) {
      gainExperienceFn(orb.value * killStreakMultiplier);
      const pickupChain = registerPickupFlowFn(orb.value);
      const pickupChainRatio =
        battle.pickupFlowSec > 0 && battle.pickupFlowCount > 0
          ? Math.min(1, battle.pickupFlowSec / getPickupFlowWindowSec(battle.pickupFlowCount))
          : 0;
      const pickupChainCarry =
        battle.pickupFlowCount * 0.36 + pickupChainRatio * 0.96;
      battle.playerRecoverySec = Math.max(
        battle.playerRecoverySec,
        0.18 + Math.min(0.1, flowCarry * 0.026 + pickupChainCarry * 0.022),
      );
      battle.tempoPulseSec = Math.max(
        battle.tempoPulseSec,
        0.14 + Math.min(0.18, orb.value * 0.006 + flowCarry * 0.028 + pickupChainCarry * 0.026),
      );
      if (battle.killFlowSec > 0) {
        battle.killFlowSec = Math.max(
          battle.killFlowSec,
          0.34 + Math.min(0.28, orb.value * 0.01 + flowCarry * 0.042 + pickupChainCarry * 0.03),
        );
        battle.playerMoveBoostSec = Math.max(
          battle.playerMoveBoostSec,
          0.16 + Math.min(0.18, battle.killFlowCount * 0.032 + flowCarry * 0.02 + pickupChainCarry * 0.026),
        );
        battle.tempoPulseSec = Math.max(
          battle.tempoPulseSec,
          0.2 + Math.min(0.2, battle.killFlowCount * 0.04 + orb.value * 0.004 + flowCarry * 0.02 + pickupChainCarry * 0.02),
        );
      }
      battle.playerTurnBurstSec = Math.max(
        battle.playerTurnBurstSec,
        0.08 + Math.min(0.08, pickupChain * 0.016 + pickupChainCarry * 0.02),
      );
      const chainVacuumRadius = effectiveMagnetRadius * (flowRatio > 0 ? 0.92 : 0.78);
      for (const linkedOrb of battle.experienceOrbs) {
        if (linkedOrb === orb) {
          continue;
        }
        const linkedDistance = Math.hypot(linkedOrb.x - playerX, linkedOrb.y - playerY);
        if (linkedDistance > chainVacuumRadius) {
          continue;
        }
        const linkedAngle = Math.atan2(playerY - linkedOrb.y, playerX - linkedOrb.x);
        const linkedSpeed = Math.max(
          240,
          300 + Math.max(0, chainVacuumRadius - linkedDistance) * 3 + flowCarry * 26 + pickupChainCarry * 18,
        );
        linkedOrb.velocityX = Math.cos(linkedAngle) * linkedSpeed;
        linkedOrb.velocityY = Math.sin(linkedAngle) * linkedSpeed;
      }
      continue;
    }

    if (distance <= effectiveMagnetRadius) {
      const angle = Math.atan2(playerY - orb.y, playerX - orb.x);
      const attraction =
        (235 +
          Math.max(0, effectiveMagnetRadius - distance) * 3.1 +
          Math.min(90, tempoPulseSec * 420) +
          flowCarry * 32 +
          pickupCarry * 26) *
        (distance <= effectiveMagnetRadius * 0.42 ? 1.24 : 1);
      const pullBlend = Math.min(1, 0.25 + dt * (9.4 + flowCarry * 1 + pickupCarry * 0.82));
      const targetVX = Math.cos(angle) * attraction;
      const targetVY = Math.sin(angle) * attraction;
      orb.velocityX += (targetVX - orb.velocityX) * pullBlend;
      orb.velocityY += (targetVY - orb.velocityY) * pullBlend;
    } else {
      orb.velocityX *= 0.9;
      orb.velocityY *= 0.9;
    }

    orb.x += orb.velocityX * dt;
    orb.y += orb.velocityY * dt;
    survivors.push(orb);
  }

  battle.experienceOrbs = survivors;
}

function getPickupFlowWindowSec(chainCount: number): number {
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
