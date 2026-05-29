// Build成长系统：强化阶段配置
// 为所有流派强化定义stage分层
// 适配11关结构（2026-05-28重构版）：
//   starter:   第1关起始可出现，持续到第10关
//   amplifier: 第4关解锁
//   payoff:    第7关解锁
//   legendary: 第10关解锁

export type UpgradeStage = 'starter' | 'bridge' | 'amplifier' | 'payoff' | 'legendary';

// 强化ID到阶段的映射
// 注意：这里的阶段应该与 UPGRADE_ARCHETYPES 中的 tags 保持一致
export const UPGRADE_STAGE_MAP: Record<string, UpgradeStage> = {
  // Crit流派 - Starter (第1关起始)
  'crit-aim': 'starter',
  'crit-primer': 'starter',
  'crit-brush': 'starter',

  // Crit流派 - Bridge (第2关解锁)
  'crit-afterglow': 'bridge',
  'crit-heat-latch': 'bridge',
  'crit-burst': 'bridge',
  'crit-flare-path': 'bridge',
  'crit-sidechannel': 'bridge',

  // Crit流派 - Amplifier (第3关解锁)
  // 注意：真正的Amplifier牌应该是更高级的联动牌，当前配置中大部分Amplifier实际上是Bridge

  // Crit流派 - Payoff (第5关解锁)
  'crit-embershard': 'payoff',
  'crit-crownfire': 'payoff',
  'crit-superheat': 'payoff',
  'crit-finish': 'payoff',

  // Pierce流派 - Starter (第1关起始)
  'pierce-core': 'starter',
  'pierce-rail': 'starter',
  'pierce-seamline': 'starter',

  // Pierce流派 - Bridge (第2关解锁)
  'pierce-vector': 'bridge',
  'pierce-seamkeep': 'bridge',
  'pierce-shearline': 'bridge',
  'pierce-fan': 'bridge',
  'pierce-relay-spine': 'bridge',
  'pierce-echo': 'bridge',

  // Pierce流派 - Payoff (第5关解锁)
  'pierce-riftbloom': 'payoff',
  'pierce-floodgate': 'payoff',
  'pierce-prism': 'payoff',
  'pierce-chain': 'payoff',
  'pierce-cutback': 'payoff',

  // Dash流派 - Starter (第1关起始)
  'dash-brush': 'starter',
  'dash-feint': 'starter',
  'dash-lanebreak': 'starter',

  // Dash流派 - Bridge (第2关解锁)
  'dash-slipstream': 'bridge',
  'dash-loop': 'bridge',
  'dash-sidestep-bank': 'bridge',
  'dash-return-hold': 'bridge',
  'dash-retrace-beat': 'bridge',
  'dash-counterline': 'bridge',
  'dash-anchor': 'bridge',

  // Dash流派 - Payoff (第5关解锁)
  'dash-afterimage': 'payoff',
  'dash-zero-window': 'payoff',
  'dash-cutback': 'payoff',

  // 交叉联动 - Bridge (第2关解锁)
  'crit-pierce-bridge': 'bridge',
  'pierce-crit-bridge': 'bridge',
  'dash-crit-bridge': 'bridge',
  'dash-pierce-bridge': 'bridge',

  // 重定向牌 - Bridge (第2关解锁)
  'pierce-reroute-seam': 'bridge',
  'pierce-reroute-ledger': 'bridge',
  'pierce-sidestitch': 'bridge',
  'dash-reroute-cutin': 'bridge',
  'dash-reroute-recall': 'bridge',

  // 重定向窗口牌 - Bridge (第2关解锁)
  'crit-reroute-window': 'bridge',
  'pierce-reroute-window': 'bridge',
  'dash-reroute-window': 'bridge',

  // 通用强化 - Starter (第1关起始)
  'generic-firepower': 'starter',
  'generic-cadence': 'starter',
  'generic-ballistics': 'starter',
  'generic-optics': 'starter',
  'generic-reactor': 'starter',
  'generic-frame': 'starter',
  'generic-thrusters': 'starter',
  'generic-overclock': 'starter',
  'generic-pressure-bypass': 'starter',
  'generic-salvo-cache': 'starter',
  'generic-drift-anchor': 'starter',
  'generic-borrowed-tail': 'starter',
  'generic-rapid-fire-module': 'starter',
  'generic-cleanup-protocol': 'starter',
  'generic-terminal-overload': 'starter',

  // 缺失的流派强化补充
  // (当前无缺失)

  // Legendary传奇强化 (第7关解锁)
  'crit-meltdown': 'legendary',
  'crit-crimson-storm': 'legendary',
  'crit-ash-judgment': 'legendary',
  'crit-eternal-burn': 'legendary',
  'crit-core-resonance': 'legendary',
  'pierce-infinite-refraction': 'legendary',
  'pierce-deep-penetration': 'legendary',
  'pierce-fracture-storm': 'legendary',
  'pierce-singularity': 'legendary',
  'pierce-zero-cut': 'legendary',
  'dash-phase-rampage': 'legendary',
  'dash-overload-pulse': 'legendary',
  'dash-time-slice': 'legendary',
  'dash-infinite-phase': 'legendary',
  'dash-pulse-storm': 'legendary',
};

// 阶段解锁配置（2026-05-28重构版）
// 适配11节点结构，让玩家有更多时间Build：
//   starter:    第1关开始（覆盖整个游戏）
//   amplifier:  第4关解锁（开始有联动）
//   payoff:     第7关解锁（开始成型）
//   legendary:  第10关解锁（终局爆发）
export const STAGE_UNLOCK_CONFIG = {
  unlockRounds: {
    starter: 1,
    bridge: 1,      // bridge与starter合并，第1关就可用
    amplifier: 4,
    payoff: 7,
    legendary: 10,
  },
  // 每个阶段的基础出现权重
  stageBaseWeights: {
    starter: 1.0,
    bridge: 0.9,
    amplifier: 0.8,
    payoff: 0.5,
    legendary: 0.08,
  },
  // 阶段稀有度偏好
  stageRarity: {
    starter: ['common', 'uncommon', 'rare'],
    bridge: ['common', 'uncommon', 'rare'],
    amplifier: ['uncommon', 'rare'],
    payoff: ['rare', 'epic'],
    legendary: ['epic', 'legendary'],
  },
};

// Build定向权重配置（2026-05-28重构版）
// 新的阈值匹配 BuildStage 系统：
//   leaning:  2张 → 权重提升
//   commit:   4张 → 大幅提升
//   payoff:   7张 → 解锁终局强度
export const BUILD_DIRECTED_CONFIG = {
  thresholds: {
    leaningBonus: 2,       // 2张后增加同流派权重
    commitBonus: 4,        // 4张后大幅增加同流派权重
    payoffUnlock: 7,       // 7张后解锁Payoff
    legacyUnlock: 10,      // 10张后解锁legendary
  },
  weights: {
    sameRouteBoost: 1.8,      // 同流派+80%（比以前50%更高）
    committedRouteBoost: 3.0, // commit后同流派+200%
    offRoutePenalty: 0.3,     // 其他流派-70%
    stageSynergyBonus: 0.25,
    legendaryBaseRate: 0.08,
  },
};

// 流派里程碑定义
export interface BuildMilestone {
  id: string;
  routeId: 'crit' | 'pierce' | 'dash';
  name: string;
  description: string;
  requiredCards: number;
  minStage?: UpgradeStage;
  uiEffect?: 'flash' | 'glow' | 'transform';
}

export const BUILD_MILESTONES: BuildMilestone[] = [
  {
    id: 'crit-leaning',
    routeId: 'crit',
    name: '暴击倾向出现',
    description: '获得2张暴击牌，暴击流派出现率提升',
    requiredCards: 2,
    minStage: 'starter',
    uiEffect: 'glow',
  },
  {
    id: 'crit-established',
    routeId: 'crit',
    name: '暴击回路已成型',
    description: '获得4张暴击流核心牌后，破绽系统正式启动',
    requiredCards: 4,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'crit-matured',
    routeId: 'crit',
    name: '暴击风暴已激活',
    description: '获得7张暴击流牌后，进入超模状态',
    requiredCards: 7,
    minStage: 'payoff',
    uiEffect: 'transform',
  },
  {
    id: 'pierce-leaning',
    routeId: 'pierce',
    name: '穿透倾向出现',
    description: '获得2张穿透牌，穿透流派出现率提升',
    requiredCards: 2,
    minStage: 'starter',
    uiEffect: 'glow',
  },
  {
    id: 'pierce-established',
    routeId: 'pierce',
    name: '裂纹扩散系统启动',
    description: '获得4张穿透流核心牌后，裂纹系统正式启动',
    requiredCards: 4,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'pierce-matured',
    routeId: 'pierce',
    name: '贯穿风暴已激活',
    description: '获得7张穿透流牌后，进入超模状态',
    requiredCards: 7,
    minStage: 'payoff',
    uiEffect: 'transform',
  },
  {
    id: 'dash-leaning',
    routeId: 'dash',
    name: '穿梭倾向出现',
    description: '获得2张穿梭牌，穿梭流派出现率提升',
    requiredCards: 2,
    minStage: 'starter',
    uiEffect: 'glow',
  },
  {
    id: 'dash-established',
    routeId: 'dash',
    name: '相位风暴已激活',
    description: '获得4张穿梭流核心牌后，脉冲系统正式启动',
    requiredCards: 4,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'dash-matured',
    routeId: 'dash',
    name: '相位暴走已启动',
    description: '获得7张穿梭流牌后，进入超模状态',
    requiredCards: 7,
    minStage: 'payoff',
    uiEffect: 'transform',
  },
];

// 获取强化阶段的辅助函数
export function getUpgradeStage(upgradeId: string): UpgradeStage {
  return UPGRADE_STAGE_MAP[upgradeId] ?? 'amplifier';
}

// 检查某阶段是否已解锁
export function isStageUnlocked(stage: UpgradeStage, currentRound: number): boolean {
  return currentRound >= STAGE_UNLOCK_CONFIG.unlockRounds[stage];
}

// 计算Build定向权重（2026-05-28重构版）
// 根据流派牌数量动态调整权重：
//   0-1张: 基础权重
//   2-3张: leaning → 同流派+80%
//   4-6张: commit  → 同流派+200%
//   7+张:  payoff  → 同流派+300%
export function calculateDirectedWeight(
  upgradeId: string,
  routeId: string | undefined,
  routeCardCounts: Record<string, number>,
  currentRound: number,
  dominantRoute: string | null,
): number {
  const stage = getUpgradeStage(upgradeId);

  if (!isStageUnlocked(stage, currentRound)) {
    return 0;
  }

  let weight = STAGE_UNLOCK_CONFIG.stageBaseWeights[stage];

  if (routeId) {
    const routeCount = routeCardCounts[routeId] ?? 0;
    const isDominant = dominantRoute === routeId;

    // leaning级加成（2+张）
    if (routeCount >= BUILD_DIRECTED_CONFIG.thresholds.leaningBonus) {
      if (isDominant) {
        weight *= BUILD_DIRECTED_CONFIG.weights.sameRouteBoost;
      } else {
        weight *= (1 + BUILD_DIRECTED_CONFIG.weights.offRoutePenalty);
      }
    }

    // commit级大幅加成（4+张）
    if (routeCount >= BUILD_DIRECTED_CONFIG.thresholds.commitBonus && isDominant) {
      weight *= BUILD_DIRECTED_CONFIG.weights.committedRouteBoost;
    }

    // payoff级终局加成（7+张）
    if (routeCount >= BUILD_DIRECTED_CONFIG.thresholds.payoffUnlock && isDominant) {
      weight *= 1.5;
    }
  }

  return weight;
}
