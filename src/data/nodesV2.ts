// 节点地图生成系统 - 11关动态章节结构
// 阶段控制 + Build倾向 + 随机节点地图

import type { NodeOption, NodeType, PhaseId, RouteId, BattleTemplateId } from '../game/types';
import {
  getStageConfig,
  getStageByFloor,
  calculateBuildAffinityWeight,
  checkBuildReadiness,
  adjustWeightsByReadiness,
  type StageId,
  type NodeStageConfig,
} from './nodeStages';
import { UPGRADE_ARCHETYPES } from './upgrades';
import { getUpgradeStage, STAGE_UNLOCK_CONFIG } from './upgradeStages';
import { rng } from '../utils/rng';

// 节点蓝图定义
interface NodeBlueprint {
  id: string;
  type: NodeType;
  phase: PhaseId;
  title: string;
  description: string;
  templateId?: BattleTemplateId;
  templateCandidates?: Array<{
    templateId: BattleTemplateId;
    weight?: number;
  }>;
  difficultyScale?: number;
  isFinalPrep?: boolean;
  tags?: string[];
  selection: NodeSelectionProfile;
}

interface NodeSelectionProfile {
  baseWeight: number;
  soloMultiplier?: number;
  repeatTypeMultiplier?: number;
  noFocusBonus?: number;
  routeBonuses?: Partial<Record<RouteId, number>>;
  battleCatchupBonus?: number;
  lowHpBonus?: number;
  // 阶段控制
  minFloor?: number;
  maxFloor?: number;
  stageWhitelist?: StageId[];
  stageBlacklist?: StageId[];
}

interface NodeOfferContext {
  focusRoute: RouteId | null;
  lastNodeType: NodeType | null;
  battleWins: number;
  hpRatio: number;
  selectedUpgrades: string[];
  routeCardCounts: Record<RouteId, number>;
  floor: number;
}

// 节点池定义 - 按类型分类
const NODE_POOLS: Record<string, NodeBlueprint[]> = {
  // 普通战斗节点
  battle: [
    {
      id: 'battle-elimination',
      type: 'battle',
      phase: 'opening',
      title: '歼灭行动',
      description: '消灭出现的敌人',
      templateCandidates: [
        { templateId: 'elimination', weight: 2.6 },
        { templateId: 'elimination-pincer', weight: 1.4 },
        { templateId: 'elimination-sweep', weight: 1 },
      ],
      difficultyScale: 1.12,
      selection: { baseWeight: 45 },
    },
    {
      id: 'battle-flank',
      type: 'battle',
      phase: 'opening',
      title: '侧压试飞',
      description: '敌人侧面包抄',
      templateCandidates: [
        { templateId: 'elimination-pincer', weight: 1.8 },
        { templateId: 'elimination', weight: 1.3 },
        { templateId: 'elimination-sweep', weight: 1.1 },
      ],
      difficultyScale: 1.1,
      selection: {
        baseWeight: 35,
        routeBonuses: { crit: 0.35, dash: 1.15 },
      },
    },
    {
      id: 'battle-breach',
      type: 'battle',
      phase: 'opening',
      title: '厚线突围',
      description: '敌人密集正面进攻',
      templateCandidates: [
        { templateId: 'elimination-sweep', weight: 2 },
        { templateId: 'elimination', weight: 1 },
        { templateId: 'elimination-pincer', weight: 0.8 },
      ],
      difficultyScale: 1.12,
      selection: {
        baseWeight: 28,
        routeBonuses: { pierce: 1.56 },
      },
    },
    {
      id: 'battle-crossline',
      type: 'battle',
      phase: 'opening',
      title: '火线试压',
      description: '远程敌人火力封锁',
      templateCandidates: [
        { templateId: 'elimination-crossline', weight: 2.1 },
        { templateId: 'elimination-pincer', weight: 1.1 },
        { templateId: 'elimination', weight: 0.8 },
      ],
      difficultyScale: 1.13,
      selection: {
        baseWeight: 29,
        routeBonuses: { pierce: 0.72, dash: 0.9 },
      },
    },
  ],

  // 精英战斗节点
  elite: [
    {
      id: 'elite-standard',
      type: 'elite',
      phase: 'mid',
      title: '精英压制',
      description: '敌军精英单位出现',
      templateCandidates: [
        { templateId: 'elite', weight: 2.4 },
        { templateId: 'elite-lockdown', weight: 1.5 },
        { templateId: 'elite-screen', weight: 1.4 },
      ],
      difficultyScale: 1.0,
      tags: ['elite', 'rare'],
      selection: {
        baseWeight: 25,
        minFloor: 4,
      },
    },
    {
      id: 'elite-pressure-hold',
      type: 'elite',
      phase: 'mid',
      title: '蓄势压制',
      description: '敌人有护盾间隙',
      templateId: 'elite-pressure-hold',
      difficultyScale: 1.05,
      tags: ['elite', 'rare', 'highPressure'],
      selection: {
        baseWeight: 18,
        minFloor: 3,
        routeBonuses: { crit: 1.85, pierce: 0.6, dash: 0.7 },
      },
    },
    {
      id: 'elite-contagion',
      type: 'elite',
      phase: 'mid',
      title: '感染压制',
      description: '击杀带印记的护卫',
      templateId: 'elite-contagion',
      difficultyScale: 1.05,
      tags: ['elite', 'rare', 'highPressure'],
      selection: {
        baseWeight: 17,
        minFloor: 4,
        routeBonuses: { crit: 0.65, pierce: 1.92, dash: 0.75 },
      },
    },
    {
      id: 'elite-gauntlet',
      type: 'elite',
      phase: 'mid',
      title: '夹道压制',
      description: '连续机动躲避',
      templateId: 'elite-gauntlet',
      difficultyScale: 1.07,
      tags: ['elite', 'rare', 'highPressure'],
      selection: {
        baseWeight: 16,
        minFloor: 4,
        routeBonuses: { crit: 0.7, pierce: 0.8, dash: 1.88 },
      },
    },
  ],

  // 生存节点
  survival: [
    {
      id: 'survival-standard',
      type: 'survival',
      phase: 'late',
      title: '生存压制',
      description: '限时坚守，敌军持续增援',
      templateCandidates: [
        { templateId: 'survival', weight: 1.8 },
        { templateId: 'survival-rush', weight: 1.2 },
        { templateId: 'survival-gauntlet', weight: 1.1 },
      ],
      difficultyScale: 1.24,
      selection: {
        baseWeight: 20,
        minFloor: 6,
      },
    },
    {
      id: 'survival-gauntlet',
      type: 'survival',
      phase: 'late',
      title: '夹道求生',
      description: '空间受限，敌军四面围堵',
      templateCandidates: [
        { templateId: 'survival-gauntlet', weight: 1.8 },
        { templateId: 'survival-rush', weight: 1.3 },
        { templateId: 'survival', weight: 1.1 },
      ],
      difficultyScale: 1.27,
      selection: {
        baseWeight: 15,
        minFloor: 6,
        routeBonuses: { pierce: 1.05 },
      },
    },
    {
      id: 'survival-rush',
      type: 'survival',
      phase: 'late',
      title: '尾段突压',
      description: '敌军加速逼近，攻势猛烈',
      templateCandidates: [
        { templateId: 'survival-rush', weight: 2 },
        { templateId: 'survival', weight: 1 },
        { templateId: 'survival-gauntlet', weight: 0.9 },
      ],
      difficultyScale: 1.28,
      tags: ['highPressure'],
      selection: {
        baseWeight: 12,
        minFloor: 6,
        routeBonuses: { crit: 0.35, dash: 1.1 },
      },
    },
  ],

  // Build节点 - 保底流派强化
  buildNode: [
    {
      id: 'build-node-route',
      type: 'buildNode',
      phase: 'mid',
      title: '方向整备',
      description: '获得核心强化组件',
      tags: ['buildNode', 'rare'],
      selection: {
        baseWeight: 15,
        minFloor: 4,
        noFocusBonus: -5,
      },
    },
    {
      id: 'build-node-amplifier',
      type: 'buildNode',
      phase: 'mid',
      title: '增幅整备',
      description: '获得中阶强化组件',
      tags: ['buildNode', 'amplifier', 'rare'],
      selection: {
        baseWeight: 12,
        minFloor: 4,
        maxFloor: 6,
      },
    },
    {
      id: 'build-node-payoff',
      type: 'buildNode',
      phase: 'late',
      title: '爆发整备',
      description: '获得高阶强化组件',
      tags: ['buildNode', 'payoff', 'rare'],
      selection: {
        baseWeight: 20,
        minFloor: 6,
      },
    },
    {
      id: 'build-node-legendary',
      type: 'buildNode',
      phase: 'finalPrep',
      title: '传奇整备',
      description: '获得传说级强化组件',
      tags: ['buildNode', 'legendary', 'epic'],
      selection: {
        baseWeight: 25,
        minFloor: 9,
      },
    },
  ],

  // 恢复节点
  recovery: [
    {
      id: 'recovery-standard',
      type: 'recovery',
      phase: 'late',
      title: '紧急修复',
      description: '机体修复，移除异常状态',
      tags: ['recovery'],
      selection: {
        baseWeight: 10,
        minFloor: 6,
        lowHpBonus: 15,
      },
    },
    {
      id: 'recovery-deep',
      type: 'recovery',
      phase: 'late',
      title: '深度修复',
      description: '深度修复，重置所有异常代价',
      tags: ['recovery', 'rare'],
      selection: {
        baseWeight: 8,
        minFloor: 6,
        lowHpBonus: 12,
      },
    },
  ],

  // 赌博节点
  gamble: [
    {
      id: 'gamble-rare',
      type: 'gamble',
      phase: 'finalPrep',
      title: '稀有赌局',
      description: '双份强化，敌军同步增强',
      tags: ['gamble', 'rare', 'extremeAnomaly'],
      selection: {
        baseWeight: 15,
        minFloor: 9,
      },
    },
    {
      id: 'gamble-legendary',
      type: 'gamble',
      phase: 'finalPrep',
      title: '传奇赌局',
      description: '传说级强化或大幅损伤',
      tags: ['gamble', 'legendary', 'extremeAnomaly'],
      selection: {
        baseWeight: 10,
        minFloor: 9,
      },
    },
    {
      id: 'gamble-double',
      type: 'gamble',
      phase: 'finalPrep',
      title: '双注赌局',
      description: '双倍奖励或双倍代价',
      tags: ['gamble', 'extremeAnomaly'],
      selection: {
        baseWeight: 12,
        minFloor: 9,
      },
    },
  ],

  // 异常节点
  anomaly: [
    {
      id: 'anomaly-route-window',
      type: 'anomaly',
      phase: 'opening',
      title: '侧频接驳',
      description: '短暂机会，微调或切换战法',
      tags: ['anomaly', 'routeWindow'],
      selection: {
        baseWeight: 20,
        minFloor: 1,
        maxFloor: 6,
        noFocusBonus: 0.5,
      },
    },
    {
      id: 'anomaly-distortion',
      type: 'anomaly',
      phase: 'mid',
      title: '系统改写',
      description: '改变玩法的特殊事件',
      tags: ['anomaly', 'distortion'],
      selection: {
        baseWeight: 15,
        minFloor: 2,
        soloMultiplier: 0.45,
      },
    },
    {
      id: 'anomaly-hybrid',
      type: 'anomaly',
      phase: 'mid',
      title: '偏航裂口',
      description: '航线发生偏移',
      tags: ['anomaly', 'hybrid'],
      selection: {
        baseWeight: 12,
        minFloor: 2,
        soloMultiplier: 0.42,
      },
    },
    {
      id: 'anomaly-advanced',
      type: 'anomaly',
      phase: 'late',
      title: '黑匣异常',
      description: '发现未知信号',
      tags: ['anomaly', 'advancedAnomaly'],
      selection: {
        baseWeight: 15,
        minFloor: 6,
        soloMultiplier: 0.3,
      },
    },
  ],

  // 升级节点（传统）
  upgrade: [
    {
      id: 'upgrade-standard',
      type: 'upgrade',
      phase: 'opening',
      title: '方向定标',
      description: '强化当前流派',
      selection: {
        baseWeight: 40,
        lowHpBonus: 1.2,
      },
    },
    {
      id: 'upgrade-fireline',
      type: 'upgrade',
      phase: 'opening',
      title: '机体整备',
      description: '提升生存和机动',
      selection: {
        baseWeight: 32,
        lowHpBonus: 0.8,
      },
    },
    {
      id: 'upgrade-late',
      type: 'upgrade',
      phase: 'late',
      title: '后期稳压',
      description: '为决战做准备',
      selection: {
        baseWeight: 25,
        minFloor: 6,
        lowHpBonus: 1.8,
      },
    },
    {
      id: 'upgrade-final',
      type: 'upgrade',
      phase: 'finalPrep',
      title: '最终整备',
      description: '最终战斗前的准备',
      isFinalPrep: true,
      selection: {
        baseWeight: 100,
        minFloor: 9,
      },
    },
  ],

  // 高压节点
  highPressure: [
    {
      id: 'high-pressure-gauntlet',
      type: 'highPressure',
      phase: 'late',
      title: '极限夹道',
      description: '极高密度敌人，极高风险',
      templateId: 'elite-gauntlet',
      difficultyScale: 1.18,
      tags: ['highPressure', 'extremeAnomaly'],
      selection: {
        baseWeight: 15,
        minFloor: 6,
        routeBonuses: { dash: 2.0, pierce: 1.5, crit: 1.2 },
      },
    },
    {
      id: 'high-pressure-contagion',
      type: 'highPressure',
      phase: 'late',
      title: '感染风暴',
      description: '多层护盾，多层感染',
      templateId: 'elite-contagion',
      difficultyScale: 1.22,
      tags: ['highPressure', 'extremeAnomaly'],
      selection: {
        baseWeight: 12,
        minFloor: 6,
        routeBonuses: { pierce: 2.2, crit: 1.0, dash: 0.8 },
      },
    },
  ],

  // Boss节点
  boss: [
    {
      id: 'boss-hunt',
      type: 'boss',
      phase: 'finalBattle',
      title: '追猎首领',
      description: '终局压迫战',
      templateId: 'boss-hunt',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { crit: 1.15 },
      },
    },
    {
      id: 'boss-lockdown',
      type: 'boss',
      phase: 'finalBattle',
      title: '锁域首领',
      description: '终局压迫战',
      templateId: 'boss-lockdown',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { crit: 1.15 },
      },
    },
    {
      id: 'boss-lockdown',
      type: 'boss',
      phase: 'finalBattle',
      title: '锁域首领',
      description: '终局压迫战',
      templateId: 'boss-lockdown',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { dash: 1.15 },
      },
    },
    {
      id: 'boss-bastion',
      type: 'boss',
      phase: 'finalBattle',
      title: '屏卫首领',
      description: '终局压迫战',
      templateId: 'boss-bastion',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { pierce: 1.15 },
      },
    },
    {
      id: 'boss-executioner',
      type: 'boss',
      phase: 'finalBattle',
      title: '处决首领',
      description: '终局爆发战',
      templateId: 'boss-executioner',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { crit: 1.25 },
      },
    },
    {
      id: 'boss-fortress',
      type: 'boss',
      phase: 'finalBattle',
      title: '要塞首领',
      description: '终局穿透战',
      templateId: 'boss-fortress',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { pierce: 1.25 },
      },
    },
    {
      id: 'boss-predator',
      type: 'boss',
      phase: 'finalBattle',
      title: '猎杀首领',
      description: '终局机动战',
      templateId: 'boss-predator',
      difficultyScale: 0.85,
      selection: {
        baseWeight: 1,
        minFloor: 10,
        maxFloor: 10,
        routeBonuses: { dash: 1.25 },
      },
    },
  ],
};

// 根据阶段获取可用节点池
function getAvailableNodesForFloor(
  floor: number,
  stageConfig: NodeStageConfig,
): NodeBlueprint[] {
  const allNodes: NodeBlueprint[] = [];

  // 收集所有可用节点
  Object.values(NODE_POOLS).forEach((pool) => {
    allNodes.push(...pool);
  });

  // 过滤节点
  return allNodes.filter((node) => {
    // 检查楼层限制
    if (node.selection.minFloor && floor < node.selection.minFloor) return false;
    if (node.selection.maxFloor && floor > node.selection.maxFloor) return false;

    // 检查禁止标签
    if (node.tags) {
      for (const tag of node.tags) {
        if (stageConfig.forbiddenTags.includes(tag)) return false;
      }
    }

    return true;
  });
}

// 计算节点权重
function calculateNodeWeight(
  node: NodeBlueprint,
  context: NodeOfferContext,
  stageConfig: NodeStageConfig,
  choiceCount: number,
): number {
  const { selection } = node;
  let weight = selection.baseWeight;

  // 阶段权重调整
  const stageWeight = (stageConfig.nodeWeights as Record<string, number>)[node.type] ?? 10;
  weight *= stageWeight / 100;

  // 单选项惩罚
  if (choiceCount === 1) {
    weight *= selection.soloMultiplier ?? 1;
  }

  // 重复类型惩罚
  if (context.lastNodeType === node.type) {
    weight *= selection.repeatTypeMultiplier ?? 0.5;
  }

  // 无流派加成
  if (!context.focusRoute) {
    weight += selection.noFocusBonus ?? 0;
  }

  // 流派加成
  if (context.focusRoute && selection.routeBonuses) {
    weight += selection.routeBonuses[context.focusRoute] ?? 0;
  }

  // 低血量加成
  if (context.hpRatio < 0.4) {
    weight += selection.lowHpBonus ?? 0;
  }

  // Build倾向系统 - 针对buildNode类型
  if (node.type === 'buildNode' && node.tags?.includes('buildNode')) {
    const dominantRoute = context.focusRoute;
    if (dominantRoute) {
      weight = calculateBuildAffinityWeight(
        weight,
        dominantRoute,
        context.routeCardCounts,
        dominantRoute,
      );
    }
  }

  return Math.max(0.1, weight);
}

// 加权随机选择数量
function pickWeightedCount(
  stageConfig: NodeStageConfig,
): number {
  const weights = [
    { count: 1, weight: stageConfig.countWeights.count1 },
    { count: 2, weight: stageConfig.countWeights.count2 },
    { count: 3, weight: stageConfig.countWeights.count3 },
  ];

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng().next() * totalWeight;

  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.count;
    }
  }

  return 3;
}

// 加权随机选择节点
function pickWeightedNodes(
  nodes: NodeBlueprint[],
  weights: number[],
  count: number,
): NodeBlueprint[] {
  const pool = nodes.map((node, i) => ({ node, weight: weights[i], index: i }))
    .filter((entry) => entry.weight > 0);

  const picks: NodeBlueprint[] = [];

  while (pool.length > 0 && picks.length < count) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng().next() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        picks.push(pool[i].node);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return picks;
}

// 选择模板ID
function pickTemplateId(
  candidates: Array<{ templateId: BattleTemplateId; weight?: number }> | undefined,
  fallback: BattleTemplateId | undefined,
): BattleTemplateId | undefined {
  if (!candidates || candidates.length === 0) {
    return fallback;
  }

  const totalWeight = candidates.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  let roll = rng().next() * totalWeight;

  for (const candidate of candidates) {
    roll -= candidate.weight ?? 1;
    if (roll <= 0) {
      return candidate.templateId;
    }
  }

  return candidates[candidates.length - 1].templateId;
}

// 构建节点选项
function buildNodeOption(node: NodeBlueprint, focusRoute: RouteId | null, laneIndex: number): NodeOption {
  const resolvedTemplateId = node.templateId ?? pickTemplateId(node.templateCandidates, undefined);

  return {
    id: node.id,
    type: node.type,
    title: node.title,
    description: node.description,
    templateId: resolvedTemplateId,
    phase: node.phase,
    isFinalPrep: node.isFinalPrep,
    difficultyScale: node.difficultyScale,
    laneIndex,
  };
}

// 主函数：生成节点选项
export function buildNodeOptionsV2(
  floor: number,
  focusRoute: RouteId | null,
  context: Omit<NodeOfferContext, 'focusRoute' | 'floor'>,
): NodeOption[] {
  // 第10关固定为Boss
  if (floor >= 10) {
    const bossNodes = NODE_POOLS.boss;
    const selectedBoss = rng().pick(bossNodes);
    return [buildNodeOption(selectedBoss, focusRoute, 0)];
  }

  // 获取当前阶段配置
  const stageConfig = getStageConfig(floor);

  // 获取可用节点池
  const availableNodes = getAvailableNodesForFloor(floor, stageConfig);

  // Build准备度检查
  const payoffCardIds = UPGRADE_ARCHETYPES
    .filter(u => getUpgradeStage(u.id) === 'payoff')
    .map(u => u.id);

  const readiness = checkBuildReadiness(
    floor,
    context.routeCardCounts,
    context.selectedUpgrades,
    payoffCardIds,
  );

  // 计算每个节点的权重
  const nodeWeights = availableNodes.map((node) =>
    calculateNodeWeight(node, { ...context, focusRoute, floor }, stageConfig, 3),
  );

  // 根据准备度调整权重
  const stageWeights = adjustWeightsByReadiness(
    stageConfig.nodeWeights as Record<string, number>,
    readiness,
  );

  // 重新计算权重（应用阶段调整）
  const adjustedWeights = availableNodes.map((node, i) => {
    const typeWeight = (stageWeights as Record<string, number>)[node.type]
      ?? (stageConfig.nodeWeights as Record<string, number>)[node.type]
      ?? 10;
    return nodeWeights[i] * (typeWeight / 100);
  });

  // 选择节点数量
  const choiceCount = pickWeightedCount(stageConfig);

  // 加权随机选择节点
  const selectedNodes = pickWeightedNodes(availableNodes, adjustedWeights, choiceCount);

  // 保底机制：确保Build未成型时有足够选择
  if (!readiness.isReady && selectedNodes.length < 2) {
    // 添加buildNode或upgrade
    const fallbackNodes = availableNodes.filter(
      (n) => n.type === 'buildNode' || n.type === 'upgrade',
    );
    if (fallbackNodes.length > 0) {
      selectedNodes.push(fallbackNodes[0]);
    }
  }

  // 强制至少1个战斗节点（验证Build）
  const hasBattle = selectedNodes.some((n) =>
    n.type === 'battle' || n.type === 'elite' || n.type === 'survival' || n.type === 'highPressure',
  );

  if (!hasBattle && selectedNodes.length < 3) {
    const battleNodes = availableNodes.filter((n) => n.type === 'battle');
    if (battleNodes.length > 0) {
      selectedNodes.push(rng().pick(battleNodes));
    }
  }

  return selectedNodes.map((node, index) => buildNodeOption(node, focusRoute, index));
}

// 获取阶段标签
export function getPhaseLabel(phase: PhaseId): string {
  switch (phase) {
    case 'opening':
      return '前段';
    case 'mid':
      return '中段';
    case 'late':
      return '后段';
    case 'finalPrep':
      return '最终整备';
    case 'finalBattle':
      return '最终战';
    case 'ended':
      return '结算';
    default:
      return '';
  }
}

// 创建起始战斗节点
export function createOpeningBattleNode(): NodeOption {
  return buildNodeOption({
    id: 'opening-battle',
    type: 'battle',
    phase: 'opening',
    title: '起始歼灭',
    description: '歼灭来犯之敌',
    templateCandidates: [
      { templateId: 'elimination', weight: 2.8 },
      { templateId: 'elimination-pincer', weight: 1.1 },
      { templateId: 'elimination-sweep', weight: 0.8 },
    ],
    difficultyScale: 1.06,
    selection: {
      baseWeight: 1,
    },
  }, null, 0);
}

// 兼容旧接口
export function buildNodeOptions(
  round: number,
  focusRoute: RouteId | null,
  context: Omit<NodeOfferContext, 'focusRoute' | 'floor'> & {
    selectedUpgrades?: string[];
    routeCardCounts?: Record<RouteId, number>;
  },
): NodeOption[] {
  // 适配旧接口，使用传入值或默认值
  const extendedContext: Omit<NodeOfferContext, 'focusRoute' | 'floor'> = {
    lastNodeType: context.lastNodeType,
    battleWins: context.battleWins,
    hpRatio: context.hpRatio,
    selectedUpgrades: context.selectedUpgrades ?? [],
    routeCardCounts: context.routeCardCounts ?? { crit: 0, pierce: 0, dash: 0 },
  };

  return buildNodeOptionsV2(round, focusRoute, extendedContext);
}
