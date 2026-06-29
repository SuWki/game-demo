import type { RunState, NodeOption } from '../../game/types';
import { createBaseStats, getExperienceToNextLevel } from '../../data/balance';

export function createRunState(openingNode: NodeOption): RunState {
  return {
    status: 'battle',
    phase: 'opening',
    round: 0,
    totalRounds: 5,
    level: 1,
    experience: 0,
    experienceToNext: getExperienceToNextLevel(1),
    queuedLevelUps: 0,
    queuedRewardUpgrades: 0,
    currentUpgradeIsReward: false,
    upgradeSource: null,
    routeCounts: {
      crit: 0,
      pierce: 0,
      dash: 0,
    },
    committedRoute: null,
    maturedRoute: null,
    stats: createBaseStats(),
    selectedUpgrades: [],
    eventHistory: [],
    traversedNodes: [],
    battleWins: 0,
    nodeOptions: [],
    currentNode: openingNode,
    lastUpgradeChanges: null,
    upgradeFlashSec: 0,
    levelUpPanelDelaySec: 0,
    upgradeChoices: [],
    currentEvent: null,
    battle: null,
    result: null,
    routeMomentText: null,
    routeMomentRouteId: null,
    routeMomentSec: 0,
    activeRoutePerks: {},
    anomalyNodeSeen: false,
  };
}
