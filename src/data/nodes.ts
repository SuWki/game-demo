import type { NodeOption, NodeType, PhaseId, RouteId } from '../game/types';

interface NodeSelectionProfile {
  baseWeight: number;
  soloMultiplier?: number;
  repeatTypeMultiplier?: number;
  noFocusBonus?: number;
  battleCatchupBonus?: number;
  lowHpBonus?: number;
}

interface NodeBlueprint {
  id: string;
  type: NodeType;
  phase: PhaseId;
  title: string;
  description: string;
  templateId?: NodeOption['templateId'];
  templateCandidates?: Array<{
    templateId: NonNullable<NodeOption['templateId']>;
    weight?: number;
  }>;
  difficultyScale?: number;
  isFinalPrep?: boolean;
  selection: NodeSelectionProfile;
}

interface NodeOfferContext {
  focusRoute: RouteId | null;
  lastNodeType: NodeType | null;
  battleWins: number;
  hpRatio: number;
}

interface RoundNodeOffer {
  phase: PhaseId;
  countWeights: Array<{
    count: 1 | 2 | 3;
    weight: number;
  }>;
  blueprints: NodeBlueprint[];
}

const ROUND_NODE_OFFERS: Record<number, RoundNodeOffer> = {
  1: {
    phase: 'opening',
    countWeights: [
      { count: 1, weight: 8 },
      { count: 2, weight: 50 },
      { count: 3, weight: 42 },
    ],
    blueprints: [
      {
        id: 'round-1-battle',
        type: 'battle',
        phase: 'opening',
        title: '歼灭推进',
        description: '继续搏成长，提前拉高推进速度。',
        templateCandidates: [
          { templateId: 'elimination', weight: 2.6 },
          { templateId: 'elimination-pincer', weight: 1.4 },
          { templateId: 'elimination-sweep', weight: 1 },
        ],
        difficultyScale: 1.08,
        selection: {
          baseWeight: 5,
          repeatTypeMultiplier: 0.72,
          battleCatchupBonus: 1.4,
        },
      },
      {
        id: 'round-1-battle-flank',
        type: 'battle',
        phase: 'opening',
        title: '侧压试飞',
        description: '更早要求换侧，但经验节奏仍偏前期开路。',
        templateCandidates: [
          { templateId: 'elimination-pincer', weight: 1.8 },
          { templateId: 'elimination', weight: 1.3 },
          { templateId: 'elimination-sweep', weight: 1.1 },
        ],
        difficultyScale: 1.06,
        selection: {
          baseWeight: 3.4,
          repeatTypeMultiplier: 0.72,
          battleCatchupBonus: 1.2,
        },
      },
      {
        id: 'round-1-upgrade',
        type: 'upgrade',
        phase: 'opening',
        title: '稳定整备',
        description: '低风险补强，适合把第一条倾向扶起来。',
        selection: {
          baseWeight: 4,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.2,
        },
      },
      {
        id: 'round-1-upgrade-fireline',
        type: 'upgrade',
        phase: 'opening',
        title: '火线整备',
        description: '直接补火控，把前两拍读数尽快拉清。',
        selection: {
          baseWeight: 3.2,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 0.8,
        },
      },
      {
        id: 'round-1-event',
        type: 'anomaly',
        phase: 'opening',
        title: '试飞事件',
        description: '中风险拐方向，可能更快形成路线。',
        selection: {
          baseWeight: 1.8,
          soloMultiplier: 0.25,
          repeatTypeMultiplier: 0.55,
          noFocusBonus: 0.5,
        },
      },
      {
        id: 'round-1-event-probe',
        type: 'anomaly',
        phase: 'opening',
        title: '路线试配',
        description: '用一次试配把下一拍路线信号摸清，但不急着立刻锁死。',
        selection: {
          baseWeight: 2.1,
          soloMultiplier: 0.36,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.9,
        },
      },
    ],
  },
  2: {
    phase: 'mid',
    countWeights: [
      { count: 1, weight: 12 },
      { count: 2, weight: 46 },
      { count: 3, weight: 42 },
    ],
    blueprints: [
      {
        id: 'round-2-battle',
        type: 'battle',
        phase: 'mid',
        title: '精英压制',
        description: '中段压力点，适合检验当前路线是否站稳。',
        templateCandidates: [
          { templateId: 'elite', weight: 2.1 },
          { templateId: 'elite-lockdown', weight: 1.3 },
          { templateId: 'elite-screen', weight: 1.2 },
        ],
        difficultyScale: 1.15,
        selection: {
          baseWeight: 5.1,
          soloMultiplier: 1.12,
          repeatTypeMultiplier: 0.76,
          battleCatchupBonus: 1.8,
        },
      },
      {
        id: 'round-2-battle-screen',
        type: 'battle',
        phase: 'mid',
        title: '封锁突破',
        description: '护卫拉扯更明显的中段压力点，更看换位与拆线能力。',
        templateCandidates: [
          { templateId: 'elite-screen', weight: 1.8 },
          { templateId: 'elite', weight: 1.3 },
          { templateId: 'elite-lockdown', weight: 1.1 },
        ],
        difficultyScale: 1.18,
        selection: {
          baseWeight: 3.5,
          soloMultiplier: 1.08,
          repeatTypeMultiplier: 0.76,
          battleCatchupBonus: 1.6,
        },
      },
      {
        id: 'round-2-upgrade',
        type: 'upgrade',
        phase: 'mid',
        title: '中段强化',
        description: '稳住当前方向，先把 starter 接成更顺的 bridge。',
        selection: {
          baseWeight: 3.8,
          soloMultiplier: 0.92,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.4,
        },
      },
      {
        id: 'round-2-upgrade-bridge',
        type: 'upgrade',
        phase: 'mid',
        title: '过渡整备',
        description: '补一段过渡读数，让方向更清楚，但还留得住转向余地。',
        selection: {
          baseWeight: 3.4,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.3,
        },
      },
      {
        id: 'round-2-upgrade-lock',
        type: 'upgrade',
        phase: 'mid',
        title: '方向定标',
        description: '更偏方向定向的一次整备，用来把中段差异扶稳，而不是直接锁死。',
        selection: {
          baseWeight: 1.5,
          soloMultiplier: 0.86,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 0.9,
        },
      },
      {
        id: 'round-2-event',
        type: 'anomaly',
        phase: 'mid',
        title: '中段事件',
        description: '高波动拐点，会放大方向差异，但不一定立刻定型。',
        selection: {
          baseWeight: 2.6,
          soloMultiplier: 0.45,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 1,
        },
      },
      {
        id: 'round-2-event-shift',
        type: 'anomaly',
        phase: 'mid',
        title: '偏航窗口',
        description: '可以顺着当前读法微调，也能顺手把转向窗口留住。',
        selection: {
          baseWeight: 2.8,
          soloMultiplier: 0.42,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.8,
        },
      },
      {
        id: 'round-2-event-handoff',
        type: 'anomaly',
        phase: 'mid',
        title: '侧频接驳',
        description: '这一拍更像一次重评路线的机会，适合判断要不要借侧频改道。',
        selection: {
          baseWeight: 1.95,
          soloMultiplier: 0.46,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.6,
        },
      },
      {
        id: 'round-2-event-reroute',
        type: 'anomaly',
        phase: 'mid',
        title: '改道评估',
        description: '这一拍更像一次主动换线的预演，适合判断现在转过去值不值。',
        selection: {
          baseWeight: 2.55,
          soloMultiplier: 0.48,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.5,
        },
      },
    ],
  },
  3: {
    phase: 'late',
    countWeights: [
      { count: 1, weight: 20 },
      { count: 2, weight: 52 },
      { count: 3, weight: 28 },
    ],
    blueprints: [
      {
        id: 'round-3-battle',
        type: 'battle',
        phase: 'late',
        title: '生存压制',
        description: '后段高压段，测试你的收尾能力。',
        templateCandidates: [
          { templateId: 'survival', weight: 1.8 },
          { templateId: 'survival-crossfire', weight: 0.45 },
          { templateId: 'survival-rush', weight: 1.2 },
          { templateId: 'survival-gauntlet', weight: 1.1 },
        ],
        difficultyScale: 1.24,
        selection: {
          baseWeight: 5.3,
          soloMultiplier: 1.18,
          repeatTypeMultiplier: 0.8,
          battleCatchupBonus: 1.3,
        },
      },
      {
        id: 'round-3-battle-gauntlet',
        type: 'battle',
        phase: 'late',
        title: '夹道求生',
        description: '夹道式高压更容易暴露后段 build 的换位短板。',
        templateCandidates: [
          { templateId: 'survival-gauntlet', weight: 1.8 },
          { templateId: 'survival-rush', weight: 1.3 },
          { templateId: 'survival', weight: 1.1 },
        ],
        difficultyScale: 1.27,
        selection: {
          baseWeight: 3.8,
          soloMultiplier: 1.1,
          repeatTypeMultiplier: 0.8,
          battleCatchupBonus: 1.2,
        },
      },
      {
        id: 'round-3-battle-crossfire',
        type: 'battle',
        phase: 'late',
        title: '交火夹层',
        description: '低频高压模板，会把尾段走位压得更像一次独立记忆点。',
        templateCandidates: [
          { templateId: 'survival-crossfire', weight: 1.9 },
          { templateId: 'survival-gauntlet', weight: 0.8 },
          { templateId: 'survival-rush', weight: 0.6 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 1.1,
          soloMultiplier: 0.82,
          repeatTypeMultiplier: 0.78,
          battleCatchupBonus: 0.9,
        },
      },
      {
        id: 'round-3-upgrade',
        type: 'upgrade',
        phase: 'late',
        title: '后段修正',
        description: '补掉短板，避免后段突然失速。',
        selection: {
          baseWeight: 3.4,
          repeatTypeMultiplier: 0.82,
          lowHpBonus: 1.6,
        },
      },
      {
        id: 'round-3-upgrade-anchor',
        type: 'upgrade',
        phase: 'late',
        title: '尾段稳压',
        description: '给一次更偏收尾的修正窗口，适合把最后短板补平。',
        selection: {
          baseWeight: 3.2,
          repeatTypeMultiplier: 0.82,
          lowHpBonus: 1.8,
        },
      },
      {
        id: 'round-3-event',
        type: 'anomaly',
        phase: 'late',
        title: '后段事件',
        description: '沿着{focusLabel}冒险加码，可能直接站稳路线。',
        selection: {
          baseWeight: 2.6,
          soloMultiplier: 0.3,
          repeatTypeMultiplier: 0.6,
          noFocusBonus: 0.7,
        },
      },
      {
        id: 'round-3-event-last-bet',
        type: 'anomaly',
        phase: 'late',
        title: '尾段押注',
        description: '沿着{focusLabel}再压一次，争取把收尾气质做实。',
        selection: {
          baseWeight: 2.5,
          soloMultiplier: 0.42,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.5,
        },
      },
      {
        id: 'round-3-event-blackbox',
        type: 'anomaly',
        phase: 'late',
        title: '黑匣异常',
        description: '低频异常节点，可能让这一局在尾段撞上一段截然不同的记忆点。',
        selection: {
          baseWeight: 1.28,
          soloMultiplier: 0.26,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.3,
        },
      },
    ],
  },
  4: {
    phase: 'finalPrep',
    countWeights: [{ count: 1, weight: 1 }],
    blueprints: [
      {
        id: 'final-prep',
        type: 'upgrade',
        phase: 'finalPrep',
        title: '最终整备',
        description: '最后一次整备，准备进入最终战。',
        isFinalPrep: true,
        selection: {
          baseWeight: 1,
        },
      },
    ],
  },
  5: {
    phase: 'finalBattle',
    countWeights: [{ count: 1, weight: 1 }],
    blueprints: [
      {
        id: 'final-boss',
        type: 'boss',
        phase: 'finalBattle',
        title: '最终战',
        description: '用一场更高压的精英压制完成整局收束。',
        templateCandidates: [
          { templateId: 'boss-hunt', weight: 1.2 },
          { templateId: 'boss-lockdown', weight: 1.1 },
          { templateId: 'boss-bastion', weight: 1.05 },
        ],
        difficultyScale: 1.38,
        selection: {
          baseWeight: 1,
        },
      },
    ],
  },
};

function resolveDescription(template: string, focusRoute: RouteId | null): string {
  return template.replace('{focusLabel}', focusRoute ? '当前方向' : '任一方向');
}

function pickWeightedCount(countWeights: RoundNodeOffer['countWeights']): 1 | 2 | 3 {
  const totalWeight = countWeights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of countWeights) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.count;
    }
  }

  return countWeights[countWeights.length - 1].count;
}

function pickTemplateId(
  templateId: NodeOption['templateId'],
  templateCandidates: NodeBlueprint['templateCandidates'],
): NodeOption['templateId'] {
  if (!templateCandidates || templateCandidates.length === 0) {
    return templateId;
  }

  const totalWeight = templateCandidates.reduce((sum, candidate) => sum + (candidate.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const candidate of templateCandidates) {
    roll -= candidate.weight ?? 1;
    if (roll <= 0) {
      return candidate.templateId;
    }
  }

  return templateCandidates[templateCandidates.length - 1].templateId;
}

function getNodeWeight(blueprint: NodeBlueprint, offerContext: NodeOfferContext, choiceCount: number, round: number): number {
  const { selection } = blueprint;
  let weight = selection.baseWeight;

  if (choiceCount === 1) {
    weight *= selection.soloMultiplier ?? 1;
  }

  if (offerContext.lastNodeType === blueprint.type) {
    weight *= selection.repeatTypeMultiplier ?? 1;
  }

  if (!offerContext.focusRoute) {
    weight += selection.noFocusBonus ?? 0;
  }

  if (blueprint.type === 'battle' && offerContext.battleWins < round) {
    weight += selection.battleCatchupBonus ?? 0;
  }

  if (blueprint.type === 'upgrade' && offerContext.hpRatio <= 0.62) {
    weight += selection.lowHpBonus ?? 0;
  }

  return Math.max(0.1, weight);
}

function buildNode(blueprint: NodeBlueprint, focusRoute: RouteId | null): NodeOption {
  const resolvedTitle =
    blueprint.type === 'boss'
      ? '\u6700\u7ec8 Boss'
      : blueprint.type === 'anomaly' && blueprint.id === 'round-3-event-blackbox'
        ? '\u9ed1\u5333\u5f02\u5e38'
        : blueprint.title;
  const resolvedDescription =
    blueprint.type === 'boss'
      ? '\u7528\u4e00\u573a\u660e\u786e\u7684 Boss \u6536\u675f\u5173\u5b8c\u6210\u6574\u5c40\u6536\u675f\u3002'
      : resolveDescription(blueprint.description, focusRoute);

  return {
    ...blueprint,
    title: resolvedTitle,
    description: resolvedDescription,
    templateId: pickTemplateId(blueprint.templateId, blueprint.templateCandidates),
  };
}

function pickWeightedUniqueBlueprints(offer: RoundNodeOffer, context: NodeOfferContext, choiceCount: number, round: number): NodeBlueprint[] {
  const pool = offer.blueprints.map((blueprint) => ({
    blueprint,
    weight: getNodeWeight(blueprint, context, choiceCount, round),
  }));
  const picks: NodeBlueprint[] = [];

  while (pool.length > 0 && picks.length < choiceCount) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < pool.length; index += 1) {
      roll -= pool[index].weight;
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }

    picks.push(pool[selectedIndex].blueprint);
    pool.splice(selectedIndex, 1);
  }

  return picks;
}

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

export function createOpeningBattleNode(): NodeOption {
  return buildNode(
    {
      id: 'opening-battle',
      type: 'battle',
      phase: 'opening',
      title: '起始歼灭',
      description: '用一场基础歼灭战把节奏立起来。',
      templateCandidates: [
        { templateId: 'elimination', weight: 2.8 },
        { templateId: 'elimination-pincer', weight: 1.1 },
        { templateId: 'elimination-sweep', weight: 0.8 },
      ],
      difficultyScale: 1,
      selection: {
        baseWeight: 1,
      },
    },
    null,
  );
}

export function buildNodeOptions(
  round: number,
  focusRoute: RouteId | null,
  context: Omit<NodeOfferContext, 'focusRoute'>,
): NodeOption[] {
  const offer = ROUND_NODE_OFFERS[round];
  if (!offer) {
    return [];
  }

  const choiceCount = pickWeightedCount(offer.countWeights);
  const picked = pickWeightedUniqueBlueprints(
    offer,
    {
      ...context,
      focusRoute,
    },
    choiceCount,
    round,
  );

  return picked.map((blueprint, index) => ({
    ...buildNode(blueprint, focusRoute),
    laneIndex: index,
  }));
}
