// 节点阶段控制系统
// 短局高密度Build肉鸽：9~10节点，5~8分钟一局
// 阶段控制节点生成节奏，确保Build快速成型与爽感释放

import type { RouteId } from '../game/types';

// 节点类型扩展
export type ExtendedNodeType =
  | 'battle'
  | 'upgrade'
  | 'anomaly'
  | 'boss'
  | 'buildNode'      // 新增：Build节点（保底流派强化）
  | 'recovery'       // 新增：恢复节点
  | 'gamble'         // 新增：赌博节点
  | 'elite'          // 新增：精英节点（独立类型）
  | 'survival'       // 新增：生存节点（独立类型）
  | 'highPressure';  // 新增：高压节点

// 阶段ID
export type StageId = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';

// 节点阶段配置
export interface NodeStageConfig {
  stageId: StageId;
  startFloor: number;  // 起始关卡（包含）
  endFloor: number;    // 结束关卡（包含）
  name: string;        // 阶段名称
  description: string; // 阶段描述

  // 节点类型权重配置
  nodeWeights: {
    battle: number;
    survival: number;
    elite: number;
    anomaly: number;
    upgrade: number;
    buildNode: number;
    recovery: number;
    gamble: number;
    highPressure: number;
  };

  // 选择数量权重（每关提供几个选项）
  countWeights: {
    count1: number;    // 1个选项的权重
    count2: number;    // 2个选项的权重
    count3: number;    // 3个选项的权重（默认）
  };

  // 禁止的标签（该阶段不会出现带这些标签的节点/强化）
  forbiddenTags: string[];

  // 偏好的标签（该阶段更可能出现带这些标签的节点/强化）
  preferredTags: string[];

  // 难度缩放系数
  difficultyScale: number;

  // Build成长相关
  buildProgress: {
    minCardsExpected: number;    // 该阶段预期最少强化数
    allowPayoff: boolean;        // 是否允许payoff强化
    allowLegendary: boolean;     // 是否允许legendary强化
  };
}

// 阶段配置映射（2026-05-28重构版）
// 11节点结构，三阶段：
//   Stage1（1~3关）：Build启动期 — 禁止高压，让玩家安全启动
//   Stage2（4~7关）：Build成型期 — 开始上压力，精英出现
//   Stage3（8~10关）：Build爆发期 — 高压拉满，为最终Boss铺垫
//   Node 11: Boss战
export const STAGE_CONFIGS: Record<StageId, NodeStageConfig> = {
  // Stage1（1~3关）：Build启动期
  // 目标：玩家安全启动Build，前3关不出现精英/高压
  // 禁止：高压精英、弹幕封锁、crossfireWave
  stage1: {
    stageId: 'stage1',
    startFloor: 1,
    endFloor: 3,
    name: '启动期',
    description: '安全构筑流派',
    nodeWeights: {
      battle: 50,
      survival: 20,
      elite: 0,
      anomaly: 18,
      upgrade: 25,
      buildNode: 10,
      recovery: 8,
      gamble: 0,
      highPressure: 0,
    },
    countWeights: {
      count1: 10,
      count2: 50,
      count3: 40,
    },
    forbiddenTags: ['boss', 'legendary', 'highPressure', 'extremeAnomaly', 'payoff', 'elite'],
    preferredTags: ['starter', 'bridge'],
    difficultyScale: 1.0,
    buildProgress: {
      minCardsExpected: 3,
      allowPayoff: false,
      allowLegendary: false,
    },
  },

  // Stage2（4~7关）：Build成型期
  // 目标：玩家开始commit，出现精英/Build节点
  // 允许：普通精英，buildNode，中压战斗
  // 禁止：highPressure精英（如laneCrush）
  stage2: {
    stageId: 'stage2',
    startFloor: 4,
    endFloor: 7,
    name: '成型期',
    description: '流派成型开始联动',
    nodeWeights: {
      battle: 30,
      survival: 12,
      elite: 20,
      anomaly: 15,
      upgrade: 20,
      buildNode: 18,
      recovery: 5,
      gamble: 5,
      highPressure: 5,
    },
    countWeights: {
      count1: 5,
      count2: 35,
      count3: 60,
    },
    forbiddenTags: ['boss', 'legendary', 'extremeAnomaly'],
    preferredTags: ['amplifier'],
    difficultyScale: 1.12,
    buildProgress: {
      minCardsExpected: 5,
      allowPayoff: false,
      allowLegendary: false,
    },
  },

  // Stage3（8~10关）：Build爆发期
  // 目标：Build进入Payoff，高压拉满
  // 允许：所有类型，稀有Build节点
  stage3: {
    stageId: 'stage3',
    startFloor: 8,
    endFloor: 10,
    name: '爆发期',
    description: '流派爆发火力全开',
    nodeWeights: {
      battle: 15,
      survival: 5,
      elite: 25,
      anomaly: 18,
      upgrade: 12,
      buildNode: 22,
      recovery: 8,
      gamble: 5,
      highPressure: 18,
    },
    countWeights: {
      count1: 2,
      count2: 30,
      count3: 68,
    },
    forbiddenTags: ['starter', 'boss'],
    preferredTags: ['payoff', 'legendary'],
    difficultyScale: 1.15,
    buildProgress: {
      minCardsExpected: 8,
      allowPayoff: true,
      allowLegendary: false,
    },
  },

  // Node 10: 最终整备（Boss前最后一站）
  stage4: {
    stageId: 'stage4',
    startFloor: 10,
    endFloor: 10,
    name: '最终整备',
    description: '迎接最终决战',
    nodeWeights: {
      battle: 5,
      survival: 0,
      elite: 10,
      anomaly: 10,
      upgrade: 35,
      buildNode: 30,
      recovery: 20,
      gamble: 10,
      highPressure: 5,
    },
    countWeights: {
      count1: 0,
      count2: 15,
      count3: 85,
    },
    forbiddenTags: ['starter', 'bridge'],
    preferredTags: ['payoff', 'legendary'],
    difficultyScale: 1.45,
    buildProgress: {
      minCardsExpected: 10,
      allowPayoff: true,
      allowLegendary: true,
    },
  },

  // Node 11: Boss战
  stage5: {
    stageId: 'stage5',
    startFloor: 11,
    endFloor: 11,
    name: '决战期',
    description: '最终决战',
    nodeWeights: {
      battle: 0,
      survival: 0,
      elite: 0,
      anomaly: 0,
      upgrade: 0,
      buildNode: 0,
      recovery: 20,
      gamble: 0,
      highPressure: 0,
    },
    countWeights: {
      count1: 0,
      count2: 0,
      count3: 100,
    },
    forbiddenTags: [],
    preferredTags: ['payoff', 'legendary'],
    difficultyScale: 1.5,
    buildProgress: {
      minCardsExpected: 10,
      allowPayoff: true,
      allowLegendary: true,
    },
  },
};

// 根据关卡获取所属阶段（2026-05-28重构版·11节点三阶段）
export function getStageByFloor(floor: number): StageId {
  if (floor >= 11) return 'stage5';  // Boss
  if (floor >= 10) return 'stage4';  // 最终整备
  if (floor >= 8) return 'stage3';   // 爆发期
  if (floor >= 4) return 'stage2';   // 成型期
  return 'stage1';                   // 启动期
}

// 获取阶段配置
export function getStageConfig(floor: number): NodeStageConfig {
  const stageId = getStageByFloor(floor);
  return STAGE_CONFIGS[stageId];
}

// Build倾向系统配置
export interface BuildAffinityConfig {
  // 基础权重调整
  routeWeightBonus: number;      // 每张同流派牌增加的权重系数
  maxBonus: number;              // 最大加成上限
  crossRouteChance: number;      // 跨流派出现概率（保底）
  pivotThreshold: number;        // 触发转向的阈值（拿到几张其他流派牌后）
}

export const BUILD_AFFINITY_CONFIG: BuildAffinityConfig = {
  routeWeightBonus: 0.12,   // 每张同流派牌+12%权重
  maxBonus: 0.6,            // 最高+60%权重
  crossRouteChance: 0.15,   // 保底15%概率出现跨流派
  pivotThreshold: 3,        // 拿到3张其他流派牌后可转向
};

// 计算Build倾向权重
export function calculateBuildAffinityWeight(
  baseWeight: number,
  routeId: RouteId | undefined,
  ownedCards: Record<RouteId, number>,
  dominantRoute: RouteId | null,
): number {
  if (!routeId || !dominantRoute) return baseWeight;

  const ownedCount = ownedCards[routeId] ?? 0;
  const dominantCount = ownedCards[dominantRoute] ?? 0;
  const totalCards = Object.values(ownedCards).reduce((sum, count) => sum + count, 0);

  // 同流派加成
  if (routeId === dominantRoute) {
    const bonus = Math.min(ownedCount * BUILD_AFFINITY_CONFIG.routeWeightBonus, BUILD_AFFINITY_CONFIG.maxBonus);
    return baseWeight * (1 + bonus);
  }

  // 跨流派惩罚（但保留保底概率）
  const crossRouteBonus = BUILD_AFFINITY_CONFIG.crossRouteChance;
  if (dominantCount >= BUILD_AFFINITY_CONFIG.pivotThreshold && ownedCount >= 2) {
    // 已满足转向条件，权重恢复
    return baseWeight * (1 + ownedCount * 0.08);
  }

  return baseWeight * crossRouteBonus;
}

// Boss前成长保障检查
export interface BuildReadinessCheck {
  isReady: boolean;
  missingCards: number;
  hasPayoff: boolean;
  hasCoreRoute: boolean;
  recommendations: string[];
}

export function checkBuildReadiness(
  floor: number,
  ownedCards: Record<RouteId, number>,
  selectedUpgrades: string[],
  payoffCardIds: string[],
): BuildReadinessCheck {
  const stageConfig = getStageConfig(floor);
  const totalCards = Object.values(ownedCards).reduce((sum, count) => sum + count, 0);
  const dominantRoute = (Object.entries(ownedCards) as [RouteId, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominantCount = dominantRoute ? (ownedCards[dominantRoute] ?? 0) : 0;

  // 检查是否有payoff牌
  const hasPayoff = selectedUpgrades.some(id => payoffCardIds.includes(id));

  // 检查是否有核心流派牌（2张以上=leaning）
  const hasCoreRoute = dominantCount >= 2;

  // 计算缺失的牌数
  const expectedCards = stageConfig.buildProgress.minCardsExpected;
  const missingCards = Math.max(0, expectedCards - totalCards);

  const recommendations: string[] = [];

  if (missingCards > 0) {
    recommendations.push(`建议补充${missingCards}张强化`);
  }

  if (!hasPayoff && floor >= 8) {
    recommendations.push('建议获取Payoff级强化');
  }

  if (dominantCount < 2) {
    recommendations.push('建议确定核心流派（至少2张）');
  } else if (dominantCount < 4) {
    recommendations.push('建议继续堆叠流派牌至4张Commit');
  }

  const isReady = !hasCoreRoute ? false : dominantCount >= 4 && (floor < 8 || hasPayoff);

  return {
    isReady,
    missingCards,
    hasPayoff,
    hasCoreRoute,
    recommendations,
  };
}

// 根据Build准备度调整节点权重
export function adjustWeightsByReadiness(
  weights: Record<string, number>,
  readiness: BuildReadinessCheck,
): Record<string, number> {
  const adjusted = { ...weights };

  if (!readiness.isReady) {
    // Build未成型时，提高buildNode和upgrade权重
    adjusted.buildNode = (adjusted.buildNode ?? 0) * 2.5;
    adjusted.upgrade = (adjusted.upgrade ?? 0) * 1.8;
    adjusted.anomaly = (adjusted.anomaly ?? 0) * 0.6;

    // 降低高风险节点
    adjusted.gamble = (adjusted.gamble ?? 0) * 0.5;
    adjusted.highPressure = (adjusted.highPressure ?? 0) * 0.7;
  }

  return adjusted;
}
