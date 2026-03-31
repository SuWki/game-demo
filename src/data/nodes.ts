import type { NodeOption, PhaseId, RouteId } from '../game/types';

function buildBattleNode(
  id: string,
  phase: PhaseId,
  title: string,
  description: string,
  templateId: NodeOption['templateId'],
  difficultyScale: number,
): NodeOption {
  return {
    id,
    type: 'battle',
    phase,
    title,
    description,
    templateId,
    difficultyScale,
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
  return buildBattleNode(
    'opening-battle',
    'opening',
    '起始歼灭',
    '用一场基础歼灭战把节奏立起来。',
    'elimination',
    1,
  );
}

export function buildNodeOptions(round: number, focusRoute: RouteId | null): NodeOption[] {
  if (round === 1) {
    return [
      buildBattleNode('round-1-battle', 'opening', '歼灭推进', '继续搏成长，提前拉高推进速度。', 'elimination', 1.08),
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
    ];
  }

  if (round === 2) {
    return [
      buildBattleNode('round-2-battle', 'mid', '精英压制', '中段压力点，适合检验当前路线是否站稳。', 'elite', 1.15),
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
    ];
  }

  if (round === 3) {
    return [
      buildBattleNode('round-3-battle', 'late', '生存压制', '后段高压段，测试你的收尾能力。', 'survival', 1.24),
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
        description: `沿着${focusRoute ? '当前方向' : '任一方向'}冒险加码，可能直接站稳路线。`,
      },
    ];
  }

  if (round === 4) {
    return [
      {
        id: 'final-prep',
        type: 'upgrade',
        phase: 'finalPrep',
        title: '最终整备',
        description: '最后一次整备，准备进入最终战。',
        isFinalPrep: true,
      },
    ];
  }

  if (round === 5) {
    return [
      buildBattleNode('final-battle', 'finalBattle', '最终战', '用一场更高压的精英压制完成整局收束。', 'elite', 1.38),
    ];
  }

  return [];
}
