import type { NodeOption, PhaseId, RouteId } from '../game/types';

interface NodeBlueprint {
  id: string;
  type: NodeOption['type'];
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
}

const ROUND_NODE_BLUEPRINTS: Record<number, NodeBlueprint[]> = {
  1: [
    {
      id: 'round-1-battle',
      type: 'battle',
      phase: 'opening',
      title: '歼灭推进',
      description: '继续搏成长，提前拉高推进速度。',
      templateId: 'elimination',
      difficultyScale: 1.08,
    },
    {
      id: 'round-1-upgrade',
      type: 'upgrade',
      phase: 'opening',
      title: '稳定整备',
      description: '低风险补强，适合把第一条倾向扶起来。',
    },
    {
      id: 'round-1-event',
      type: 'event',
      phase: 'opening',
      title: '试飞事件',
      description: '中风险拐方向，可能更快形成路线。',
    },
  ],
  2: [
    {
      id: 'round-2-battle',
      type: 'battle',
      phase: 'mid',
      title: '精英压制',
      description: '中段压力点，适合检验当前路线是否站稳。',
      templateId: 'elite',
      difficultyScale: 1.15,
    },
    {
      id: 'round-2-upgrade',
      type: 'upgrade',
      phase: 'mid',
      title: '中段强化',
      description: '稳住当前方向，把火力读数做实。',
    },
    {
      id: 'round-2-event',
      type: 'event',
      phase: 'mid',
      title: '中段事件',
      description: '高波动拐点，可能直接加快成型。',
    },
  ],
  3: [
    {
      id: 'round-3-battle',
      type: 'battle',
      phase: 'late',
      title: '生存压制',
      description: '后段高压段，测试你的收尾能力。',
      templateCandidates: [
        {
          templateId: 'survival',
          weight: 2,
        },
        {
          templateId: 'survival-rush',
          weight: 1,
        },
      ],
      difficultyScale: 1.24,
    },
    {
      id: 'round-3-upgrade',
      type: 'upgrade',
      phase: 'late',
      title: '后段修正',
      description: '补掉短板，避免后段突然失速。',
    },
    {
      id: 'round-3-event',
      type: 'event',
      phase: 'late',
      title: '后段事件',
      description: '沿着{focusLabel}冒险加码，可能直接站稳路线。',
    },
  ],
  4: [
    {
      id: 'final-prep',
      type: 'upgrade',
      phase: 'finalPrep',
      title: '最终整备',
      description: '最后一次整备，准备进入最终战。',
      isFinalPrep: true,
    },
  ],
  5: [
    {
      id: 'final-battle',
      type: 'battle',
      phase: 'finalBattle',
      title: '最终战',
      description: '用一场更高压的精英压制完成整局收束。',
      templateCandidates: [
        {
          templateId: 'elite',
          weight: 1,
        },
        {
          templateId: 'elite-lockdown',
          weight: 2,
        },
      ],
      difficultyScale: 1.38,
    },
  ],
};

function resolveDescription(template: string, focusRoute: RouteId | null): string {
  return template.replace('{focusLabel}', focusRoute ? '当前方向' : '任一方向');
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

function buildNode(blueprint: NodeBlueprint, focusRoute: RouteId | null): NodeOption {
  return {
    ...blueprint,
    description: resolveDescription(blueprint.description, focusRoute),
    templateId: pickTemplateId(blueprint.templateId, blueprint.templateCandidates),
  };
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
      templateId: 'elimination',
      difficultyScale: 1,
    },
    null,
  );
}

export function buildNodeOptions(round: number, focusRoute: RouteId | null): NodeOption[] {
  return (ROUND_NODE_BLUEPRINTS[round] ?? []).map((blueprint) => buildNode(blueprint, focusRoute));
}
