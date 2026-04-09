import type { NodeOption, NodeType, PhaseId, RouteId } from '../game/types';

interface NodeSelectionProfile {
  baseWeight: number;
  soloMultiplier?: number;
  repeatTypeMultiplier?: number;
  noFocusBonus?: number;
  routeBonuses?: Partial<Record<RouteId, number>>;
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
        description: '基础清线战，优先把经验和推进节奏立起来。',
        templateCandidates: [
          { templateId: 'elimination', weight: 2.6 },
          { templateId: 'elimination-pincer', weight: 1.4 },
          { templateId: 'elimination-sweep', weight: 1 },
        ],
        difficultyScale: 1.12,
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
        description: '更早要求换侧的前段战，用来读清机动与短爆发窗口。',
        templateCandidates: [
          { templateId: 'elimination-pincer', weight: 1.8 },
          { templateId: 'elimination', weight: 1.3 },
          { templateId: 'elimination-sweep', weight: 1.1 },
        ],
        difficultyScale: 1.1,
        selection: {
          baseWeight: 3.4,
          repeatTypeMultiplier: 0.72,
          routeBonuses: {
            crit: 0.35,
            dash: 1.15,
          },
          battleCatchupBonus: 1.2,
        },
      },
      {
        id: 'round-1-battle-breach',
        type: 'battle',
        phase: 'opening',
        title: '厚线突围',
        description: '厚体敌群沿线推进，更考清线节奏和正面站位。',
        templateCandidates: [
          { templateId: 'elimination-sweep', weight: 2 },
          { templateId: 'elimination', weight: 1 },
          { templateId: 'elimination-pincer', weight: 0.8 },
        ],
        difficultyScale: 1.12,
        selection: {
          baseWeight: 2.8,
          repeatTypeMultiplier: 0.72,
          routeBonuses: {
            pierce: 1.25,
          },
          battleCatchupBonus: 1.15,
        },
      },
      {
        id: 'round-1-battle-crossline',
        type: 'battle',
        phase: 'opening',
        title: '火线试压',
        description: '早段就会被远程线打断直跑，更看基础换位和补线判断。',
        templateCandidates: [
          { templateId: 'elimination-crossline', weight: 2.1 },
          { templateId: 'elimination-pincer', weight: 1.1 },
          { templateId: 'elimination', weight: 0.8 },
        ],
        difficultyScale: 1.13,
        selection: {
          baseWeight: 2.9,
          repeatTypeMultiplier: 0.72,
          routeBonuses: {
            pierce: 0.4,
            dash: 0.9,
          },
          battleCatchupBonus: 1.15,
        },
      },
      {
        id: 'round-1-upgrade',
        type: 'upgrade',
        phase: 'opening',
        title: '稳定整备',
        description: '获得一次稳定强化。',
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
        description: '获得一次偏进攻的强化。',
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
        title: '试飞异常',
        description: '前段的异常口子偏轻，但已经开始偏离普通补给节奏。',
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
        title: '试飞校准',
        description: '偏航样本开始渗进前段，适合早点看到异常路线的味道。',
        selection: {
          baseWeight: 2.1,
          soloMultiplier: 0.36,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.9,
        },
      },
      {
        id: 'round-1-event-ripple',
        type: 'anomaly',
        phase: 'opening',
        title: '冷启裂口',
        description: '前段偶尔会先漏出一拍失真，不一定给路线，但会提前给这一局加记忆点。',
        selection: {
          baseWeight: 1.45,
          soloMultiplier: 0.2,
          repeatTypeMultiplier: 0.54,
          noFocusBonus: 0.75,
        },
      },
    ],
  },
  2: {
    phase: 'mid',
    countWeights: [
      { count: 1, weight: 8 },
      { count: 2, weight: 44 },
      { count: 3, weight: 48 },
    ],
    blueprints: [
      {
        id: 'round-2-battle',
        type: 'battle',
        phase: 'mid',
        title: '精英压制',
        description: '偏首领正压的中段检定，适合看当前 build 能不能正面站稳。',
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
          routeBonuses: {
            crit: 0.9,
          },
          battleCatchupBonus: 1.8,
        },
      },
      {
        id: 'round-2-battle-screen',
        type: 'battle',
        phase: 'mid',
        title: '封锁突破',
        description: '护卫遮线更重的中段战，重点在拆护卫和换位。',
        templateCandidates: [
          { templateId: 'elite-screen', weight: 1.8 },
          { templateId: 'elite', weight: 1.3 },
          { templateId: 'elite-lockdown', weight: 1.1 },
          { templateId: 'elite-vice', weight: 0.55 },
        ],
        difficultyScale: 1.18,
        selection: {
          baseWeight: 3.5,
          soloMultiplier: 1.08,
          repeatTypeMultiplier: 0.76,
          routeBonuses: {
            pierce: 0.45,
            dash: 0.65,
          },
          battleCatchupBonus: 1.6,
        },
      },
      {
        id: 'round-2-battle-vice',
        type: 'battle',
        phase: 'mid',
        title: '拖场绞锁',
        description: '低频的绞锁压制，会把中段打成一场拆护卫与反压并存的硬仗。',
        templateCandidates: [
          { templateId: 'elite-vice', weight: 2.2 },
          { templateId: 'elite-screen', weight: 0.9 },
          { templateId: 'elite-lockdown', weight: 0.8 },
        ],
        difficultyScale: 1.2,
        selection: {
          baseWeight: 1.4,
          soloMultiplier: 0.82,
          repeatTypeMultiplier: 0.74,
          routeBonuses: {
            pierce: 1,
          },
          battleCatchupBonus: 1.05,
        },
      },
      {
        id: 'round-2-battle-bulwark',
        type: 'battle',
        phase: 'mid',
        title: '壁垒拆解',
        description: '厚屏护卫更重的中段首领战，重点在拆壁垒、穿本体和抢站位。',
        templateCandidates: [
          { templateId: 'elite-bulwark', weight: 2.1 },
          { templateId: 'elite-screen', weight: 1 },
          { templateId: 'elite', weight: 0.9 },
        ],
        difficultyScale: 1.2,
        selection: {
          baseWeight: 2.7,
          soloMultiplier: 0.96,
          repeatTypeMultiplier: 0.74,
          routeBonuses: {
            pierce: 1.15,
          },
          battleCatchupBonus: 1.2,
        },
      },
      {
        id: 'round-2-upgrade',
        type: 'upgrade',
        phase: 'mid',
        title: '中段强化',
        description: '获得一次中段强化。',
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
        description: '补一段过渡强化，稳住当前战力。',
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
        description: '获得一次偏路线的中段强化。',
        selection: {
          baseWeight: 1.5,
          soloMultiplier: 0.86,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 0.9,
        },
      },
      {
        id: 'round-2-upgrade-reroute',
        type: 'upgrade',
        phase: 'mid',
        title: '改道整备',
        description: '给一次更像分叉重评的整备窗口，适合补桥接或尝试转向。',
        selection: {
          baseWeight: 2.7,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.1,
        },
      },
      {
        id: 'round-2-event',
        type: 'anomaly',
        phase: 'mid',
        title: '中段异常',
        description: '中段开始出现真正的扭曲窗口，重点不再只是补给，而是改写记忆点。',
        selection: {
          baseWeight: 2.9,
          soloMultiplier: 0.45,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 1,
        },
      },
      {
        id: 'round-2-event-shift',
        type: 'anomaly',
        phase: 'mid',
        title: '偏航裂口',
        description: '短时失真口子已经撑开，能顺着当前读法微调，也能把后面分支搅乱。',
        selection: {
          baseWeight: 3.1,
          soloMultiplier: 0.42,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.8,
        },
      },
      {
        id: 'round-2-event-handoff',
        type: 'anomaly',
        phase: 'mid',
        title: '侧频噪点',
        description: '异常侧频短暂沾到路线边缘，更像一次扭曲改道，而不是平稳接驳。',
        selection: {
          baseWeight: 2.15,
          soloMultiplier: 0.46,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.6,
        },
      },
      {
        id: 'round-2-event-reroute',
        type: 'anomaly',
        phase: 'mid',
        title: '改道失真',
        description: '中段主动转向窗口，重点是判断现在改道值不值。',
        selection: {
          baseWeight: 2.8,
          soloMultiplier: 0.48,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.5,
        },
      },
      {
        id: 'round-2-anomaly-fracture',
        type: 'anomaly',
        phase: 'mid',
        title: '相位裂缝',
        description: '真正闯进中段节奏的异常试错口，不只是普通补给换名。',
        selection: {
          baseWeight: 2.15,
          soloMultiplier: 0.4,
          repeatTypeMultiplier: 0.62,
          noFocusBonus: 0.35,
        },
      },
      {
        id: 'round-2-anomaly-ledger',
        type: 'anomaly',
        phase: 'mid',
        title: '欠账裂纹',
        description: '中段异常已经开始逼你在代价和后续窗口之间做明确取舍。',
        selection: {
          baseWeight: 2.35,
          soloMultiplier: 0.38,
          repeatTypeMultiplier: 0.6,
          noFocusBonus: 0.28,
        },
      },
      {
        id: 'round-2-anomaly-prism',
        type: 'anomaly',
        phase: 'mid',
        title: '分叉噪井',
        description: '中段异常会把分叉窗口放大一拍，更适合判断这局要不要改道。',
        selection: {
          baseWeight: 2.25,
          soloMultiplier: 0.42,
          repeatTypeMultiplier: 0.6,
          noFocusBonus: 0.45,
        },
      },
    ],
  },
  3: {
    phase: 'late',
    countWeights: [
      { count: 1, weight: 12 },
      { count: 2, weight: 46 },
      { count: 3, weight: 42 },
    ],
    blueprints: [
      {
        id: 'round-3-battle',
        type: 'battle',
        phase: 'late',
        title: '生存压制',
        description: '基础后段求生段，重点看你能否在持续压力里把手感收住。',
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
        description: '厚体压线更重的后段战，通道感更强，空档更短。',
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
          routeBonuses: {
            pierce: 1.05,
          },
          battleCatchupBonus: 1.2,
        },
      },
      {
        id: 'round-3-battle-rush',
        type: 'battle',
        phase: 'late',
        title: '尾段突压',
        description: '高速敌潮更容易把你从站位里挤出去，考后段求生与回线能力。',
        templateCandidates: [
          { templateId: 'survival-rush', weight: 2 },
          { templateId: 'survival', weight: 1 },
          { templateId: 'survival-gauntlet', weight: 0.9 },
        ],
        difficultyScale: 1.28,
        selection: {
          baseWeight: 3.2,
          soloMultiplier: 1.08,
          repeatTypeMultiplier: 0.8,
          routeBonuses: {
            crit: 0.35,
            dash: 1.1,
          },
          battleCatchupBonus: 1.15,
        },
      },
      {
        id: 'round-3-battle-crossfire',
        type: 'battle',
        phase: 'late',
        title: '交火夹层',
        description: '低频交火后段，会把你逼进更明确的换边决策。',
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
          routeBonuses: {
            dash: 0.75,
          },
          battleCatchupBonus: 0.9,
        },
      },
      {
        id: 'round-3-battle-sieve',
        type: 'battle',
        phase: 'late',
        title: '筛火求生',
        description: '远程火线和高速怪会轮着漏进来，更考后段换边、补线和回线能力。',
        templateCandidates: [
          { templateId: 'survival-sieve', weight: 2 },
          { templateId: 'survival-crossfire', weight: 1 },
          { templateId: 'survival-rush', weight: 0.8 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 2.4,
          soloMultiplier: 0.92,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            pierce: 0.65,
            dash: 0.5,
          },
          battleCatchupBonus: 1,
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
        id: 'round-3-upgrade-payoff',
        type: 'upgrade',
        phase: 'late',
        title: '收束筹码',
        description: '把后段强化更明确地推向兑现，适合补一张晚来的高收益强化。',
        selection: {
          baseWeight: 2.7,
          repeatTypeMultiplier: 0.82,
          lowHpBonus: 1.4,
        },
      },
      {
        id: 'round-3-event',
        type: 'anomaly',
        phase: 'late',
        title: '后段异常',
        description: '后段异常更强调押注和代价，不再只是顺手补一段路线。',
        selection: {
          baseWeight: 2.9,
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
        description: '沿着{focusLabel}再压一次，但这一拍更像失稳押注，不只是普通加码。',
        selection: {
          baseWeight: 2.8,
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
        description: '低频黑匣样本会让这局在尾段撞上一段截然不同的记忆点。',
        selection: {
          baseWeight: 1.5,
          soloMultiplier: 0.26,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.3,
        },
      },
      {
        id: 'round-3-anomaly-shadow',
        type: 'anomaly',
        phase: 'late',
        title: 'Boss 阴影',
        description: 'Boss 压力样本提前外泄，这一拍更像收束前的预演，而不是普通事件。',
        selection: {
          baseWeight: 1.6,
          soloMultiplier: 0.3,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.15,
        },
      },
      {
        id: 'round-3-anomaly-residue',
        type: 'anomaly',
        phase: 'late',
        title: '首领残响',
        description: '后段开始提前泄出 Boss 味道，这一拍更像收尾前的预读与押注。',
        selection: {
          baseWeight: 1.7,
          soloMultiplier: 0.28,
          repeatTypeMultiplier: 0.56,
          noFocusBonus: 0.1,
        },
      },
      {
        id: 'round-3-anomaly-pivot',
        type: 'anomaly',
        phase: 'late',
        title: '余辉偏折',
        description: '后段异常会把稀有收益、混搭机会和改道诱惑摊得更开，但不保证白拿。',
        selection: {
          baseWeight: 1.85,
          soloMultiplier: 0.3,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.18,
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
      {
        id: 'final-prep-shadow',
        type: 'upgrade',
        phase: 'finalPrep',
        title: 'Boss 预整备',
        description: '最后一次补 Boss 收尾准备，先把短板修到能打完为止。',
        isFinalPrep: true,
        selection: {
          baseWeight: 1,
          routeBonuses: {
            pierce: 0.1,
            dash: 0.1,
            crit: 0.1,
          },
        },
      },
    ],
  },
  5: {
    phase: 'finalBattle',
    countWeights: [{ count: 1, weight: 1 }],
    blueprints: [
      {
        id: 'final-boss-hunt',
        type: 'boss',
        phase: 'finalBattle',
        title: '追猎首领',
        description: '最终 Boss 会直接压脸收束整局，更考验你把前面积起来的爆发顶穿到收尾。',
        templateId: 'boss-hunt',
        difficultyScale: 1.38,
        selection: {
          baseWeight: 1,
          routeBonuses: {
            crit: 1.15,
          },
        },
      },
      {
        id: 'final-boss-lockdown',
        type: 'boss',
        phase: 'finalBattle',
        title: '锁域首领',
        description: '最终 Boss 会用更早的护卫和封位把场地压紧，更考验换位、回线和反打节奏。',
        templateId: 'boss-lockdown',
        difficultyScale: 1.39,
        selection: {
          baseWeight: 1,
          routeBonuses: {
            dash: 1.15,
          },
        },
      },
      {
        id: 'final-boss-bastion',
        type: 'boss',
        phase: 'finalBattle',
        title: '屏卫首领',
        description: '最终 Boss 会借屏卫与远程火线拖长对局，更适合用贯穿清线后再找收束窗口。',
        templateId: 'boss-bastion',
        difficultyScale: 1.4,
        selection: {
          baseWeight: 1,
          routeBonuses: {
            pierce: 1.15,
          },
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

  if (offerContext.focusRoute) {
    weight += selection.routeBonuses?.[offerContext.focusRoute] ?? 0;
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
  const resolvedDescription = resolveDescription(blueprint.description, focusRoute);

  return {
    ...blueprint,
    title: blueprint.title,
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
      difficultyScale: 1.06,
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
