// Build成长系统：强化阶段配置
// 为所有流派强化定义stage分层
// 适配11关结构：
//   starter: Floor 1 起始可出现
//   bridge: Floor 2 解锁
//   amplifier: Floor 4 解锁
//   payoff: Floor 7 解锁
//   legendary: Floor 9 解锁

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

// 阶段解锁配置
// 适配短局高密度Build结构（9~10节点）：
//   starter: Floor 1 起始可出现
//   bridge: Floor 2 解锁
//   amplifier: Floor 3 解锁
//   payoff: Floor 5 解锁
//   legendary: Floor 7 解锁
export const STAGE_UNLOCK_CONFIG = {
  // 第几关开始解锁某个阶段
  unlockRounds: {
    starter: 1,
    bridge: 2,
    amplifier: 3,
    payoff: 5,
    legendary: 7,
  },
  // 每个阶段的基础出现权重
  stageBaseWeights: {
    starter: 1.0,
    bridge: 0.9,
    amplifier: 0.8,
    payoff: 0.5,
    legendary: 0.08, // 8%基础概率
  },
  // 阶段稀有度偏好
  stageRarity: {
    starter: ['common', 'uncommon'],
    bridge: ['uncommon'],
    amplifier: ['uncommon', 'rare'],
    payoff: ['rare', 'epic'],
    legendary: ['epic', 'legendary'],
  },
};

// Build定向权重配置
export const BUILD_DIRECTED_CONFIG = {
  // 拿到N张后触发
  thresholds: {
    starterBonus: 2,      // 2张后增加权重
    bridgeUnlock: 2,      // 2张后解锁Bridge
    amplifierUnlock: 3, // 3张后解锁Amplifier（对应第3关）
    payoffUnlock: 5,    // 5张后解锁Payoff（对应第5关）
    legendaryUnlock: 7, // 7张后解锁Legendary（对应第7关）
  },
  // 权重调整
  weights: {
    sameRouteBonus: 0.5,      // 同流派+50%
    offRoutePenalty: 0.3,     // 其他流派-30%
    stageSynergyBonus: 0.25,  // 阶段协同+25%
    legendaryBaseRate: 0.08,  // Legendary基础出现率8%
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
    id: 'crit-established',
    routeId: 'crit',
    name: '暴击回路已成型',
    description: '获得3张暴击流核心牌后，破绽系统正式启动',
    requiredCards: 3,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'crit-matured',
    routeId: 'crit',
    name: '暴击风暴已激活',
    description: '获得5张暴击流牌后，进入超模状态',
    requiredCards: 5,
    minStage: 'payoff',
    uiEffect: 'transform',
  },
  {
    id: 'pierce-established',
    routeId: 'pierce',
    name: '裂纹扩散系统启动',
    description: '获得3张穿透流核心牌后，裂纹系统正式启动',
    requiredCards: 3,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'pierce-matured',
    routeId: 'pierce',
    name: '贯穿风暴已激活',
    description: '获得5张穿透流牌后，进入超模状态',
    requiredCards: 5,
    minStage: 'payoff',
    uiEffect: 'transform',
  },
  {
    id: 'dash-established',
    routeId: 'dash',
    name: '相位风暴已激活',
    description: '获得3张穿梭流核心牌后，脉冲系统正式启动',
    requiredCards: 3,
    minStage: 'amplifier',
    uiEffect: 'glow',
  },
  {
    id: 'dash-matured',
    routeId: 'dash',
    name: '相位暴走已启动',
    description: '获得5张穿梭流牌后，进入超模状态',
    requiredCards: 5,
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

// 计算Build定向权重
export function calculateDirectedWeight(
  upgradeId: string,
  routeId: string | undefined,
  routeCardCounts: Record<string, number>,
  currentRound: number,
): number {
  const stage = getUpgradeStage(upgradeId);

  // 检查阶段是否解锁
  if (!isStageUnlocked(stage, currentRound)) {
    return 0;
  }

  let weight = STAGE_UNLOCK_CONFIG.stageBaseWeights[stage];

  // 如果属于某个流派
  if (routeId) {
    const routeCount = routeCardCounts[routeId] ?? 0;

    // 同流派加成
    if (routeCount >= BUILD_DIRECTED_CONFIG.thresholds.starterBonus) {
      weight *= (1 + BUILD_DIRECTED_CONFIG.weights.sameRouteBonus);
    }

    // 阶段协同：如果已有同阶段牌，再增加权重
    // 这里简化处理，实际应该追踪已选牌的stage
  }

  return weight;
}
