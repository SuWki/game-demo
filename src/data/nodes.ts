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
        description: '遭遇敌群，消灭它们获得经验',
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
        description: '敌人从侧翼包抄，考验你的机动能力',
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
        description: '密集敌群正面压来，需要稳住阵线清理',
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
            pierce: 1.56,
          },
          battleCatchupBonus: 1.15,
        },
      },
      {
        id: 'round-1-battle-crossline',
        type: 'battle',
        phase: 'opening',
        title: '火线试压',
        description: '远程火力封锁航线，必须灵活走位应对',
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
            pierce: 0.72,
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
        description: '升级站：选择飞船强化',
        selection: {
          baseWeight: 4,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.2,
          routeBonuses: {
            crit: 0.16,
            pierce: 0.3,
          },
        },
      },
      {
        id: 'round-1-upgrade-fireline',
        type: 'upgrade',
        phase: 'opening',
        title: '火线整备',
        description: '战术升级：强化进攻能力',
        selection: {
          baseWeight: 3.2,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 0.8,
          routeBonuses: {
            crit: 0.1,
            pierce: 0.24,
          },
        },
      },
      {
        id: 'round-1-event',
        type: 'anomaly',
        phase: 'opening',
        title: '试飞异常',
        description: '空间异常：未知的机遇与风险',
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
        description: '导航异常：航线出现偏差信号',
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
        description: '时空裂痕：扭曲的空间波动',
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
      { count: 1, weight: 5 },
      { count: 2, weight: 55 },
      { count: 3, weight: 40 },
    ],
    blueprints: [
      {
        id: 'round-2-battle',
        type: 'battle',
        phase: 'mid',
        title: '精英压制',
        description: '精英敌舰来袭，正面硬战考验实力',
        templateCandidates: [
          { templateId: 'elite', weight: 2.4 },
          { templateId: 'elite-lockdown', weight: 1.5 },
          { templateId: 'elite-screen', weight: 1.4 },
        ],
        difficultyScale: 1.15,
        selection: {
          baseWeight: 5.8,
          soloMultiplier: 1.15,
          repeatTypeMultiplier: 0.72,
          routeBonuses: {
            crit: 1.1,
            pierce: 1.1,
            dash: 1.1,
          },
          battleCatchupBonus: 2.0,
        },
      },
      {
        id: 'round-2-battle-crit-hold',
        type: 'battle',
        phase: 'mid',
        title: '压线续热',
        description: '敌军持续压制，需要保持火力输出',
        templateCandidates: [
          { templateId: 'elite', weight: 1.6 },
          { templateId: 'elite-lockdown', weight: 1.2 },
          { templateId: 'elite-screen', weight: 1 },
        ],
        difficultyScale: 1.17,
        selection: {
          baseWeight: 2.72,
          soloMultiplier: 1.02,
          repeatTypeMultiplier: 0.76,
          routeBonuses: {
            crit: 0.92,
          },
          battleCatchupBonus: 1.25,
        },
      },
      {
        id: 'round-2-battle-screen',
        type: 'battle',
        phase: 'mid',
        title: '封锁突破',
        description: '敌舰被护卫掩护，先击破护卫再攻击本体',
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
            dash: 0.82,
          },
          battleCatchupBonus: 1.6,
        },
      },
      {
        id: 'round-2-battle-dash-cutback',
        type: 'battle',
        phase: 'mid',
        title: '回切压线',
        description: '敌舰封锁区域，利用机动性寻找反击机会',
        templateCandidates: [
          { templateId: 'elite-lockdown', weight: 1.8 },
          { templateId: 'elite-vice', weight: 1.35 },
          { templateId: 'elite-screen', weight: 0.95 },
        ],
        difficultyScale: 1.19,
        selection: {
          baseWeight: 2.96,
          soloMultiplier: 1.02,
          repeatTypeMultiplier: 0.76,
          routeBonuses: {
            dash: 1.34,
          },
          battleCatchupBonus: 1.3,
        },
      },
      {
        id: 'round-2-battle-vice',
        type: 'battle',
        phase: 'mid',
        title: '拖场绞锁',
        description: '敌舰与护卫协同作战，一场艰难的持久战',
        templateCandidates: [
          { templateId: 'elite-vice', weight: 2.2 },
          { templateId: 'elite-screen', weight: 0.9 },
          { templateId: 'elite-lockdown', weight: 0.8 },
        ],
        difficultyScale: 1.2,
        selection: {
          baseWeight: 1.78,
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
        description: '敌舰部署重型护盾，突破防御是关键',
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
        id: 'round-2-battle-pierce-hold',
        type: 'battle',
        phase: 'mid',
        title: '拆屏挂账',
        description: '敌军轮番进攻，撕开防线后逐个击破',
        templateCandidates: [
          { templateId: 'elite-bulwark', weight: 1.7 },
          { templateId: 'elite-screen', weight: 1.25 },
          { templateId: 'elite', weight: 0.95 },
        ],
        difficultyScale: 1.18,
        selection: {
          baseWeight: 2.84,
          soloMultiplier: 1.02,
          repeatTypeMultiplier: 0.76,
          routeBonuses: {
            pierce: 1.42,
          },
          battleCatchupBonus: 1.38,
        },
      },
      {
        id: 'round-2-upgrade',
        type: 'upgrade',
        phase: 'mid',
        title: '中段强化',
        description: '补给站：提升飞船战力',
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
        description: '维修站：稳固当前配置',
        selection: {
          baseWeight: 3.4,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.3,
          routeBonuses: {
            crit: 0.4,
            pierce: 0.74,
            dash: 0.66,
          },
        },
      },
      {
        id: 'round-2-upgrade-lock',
        type: 'upgrade',
        phase: 'mid',
        title: '方向定标',
        description: '专精升级：深化战术路线',
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
        description: '战术调整：重新评估发展方向',
        selection: {
          baseWeight: 2.7,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.1,
        },
      },
      {
        id: 'round-2-upgrade-mesh',
        type: 'upgrade',
        phase: 'mid',
        title: '并轨整备',
        description: '混合升级：融合不同战术风格',
        selection: {
          baseWeight: 2.25,
          soloMultiplier: 0.88,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1,
        },
      },
      {
        id: 'round-2-upgrade-turn',
        type: 'upgrade',
        phase: 'mid',
        title: '转折校准',
        description: '转折点：坚持当前路线还是转变战术',
        selection: {
          baseWeight: 2.15,
          soloMultiplier: 0.88,
          repeatTypeMultiplier: 0.78,
          lowHpBonus: 1.05,
          routeBonuses: {
            crit: 0.4,
            pierce: 0.72,
            dash: 0.72,
          },
        },
      },
      {
        id: 'round-2-event',
        type: 'anomaly',
        phase: 'mid',
        title: '中段异常',
        description: '空间扭曲：危险与机遇并存',
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
        description: '航线偏移：可能改变后续路径',
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
        description: '频率干扰：航线出现异常波动',
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
        description: '改道机会：是否要改变航线',
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
        description: '相位裂缝：不稳定的空间异常',
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
        description: '代价交易：付出代价换取收益',
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
        description: '分叉点：多条路径在此交汇',
        selection: {
          baseWeight: 2.25,
          soloMultiplier: 0.42,
          repeatTypeMultiplier: 0.6,
          noFocusBonus: 0.45,
        },
      },
      {
        id: 'round-2-anomaly-prelude',
        type: 'anomaly',
        phase: 'mid',
        title: '偏航试拍',
        description: '预兆信号：提前感知后续变化',
        selection: {
          baseWeight: 2.18,
          soloMultiplier: 0.4,
          repeatTypeMultiplier: 0.6,
          noFocusBonus: 0.36,
        },
      },
    ],
  },
  3: {
    phase: 'late',
    countWeights: [
      { count: 1, weight: 8 },
      { count: 2, weight: 52 },
      { count: 3, weight: 40 },
    ],
    blueprints: [
      {
        id: 'round-3-battle',
        type: 'battle',
        phase: 'late',
        title: '生存压制',
        description: '生存考验：在持续压力中坚持下去',
        templateCandidates: [
          { templateId: 'survival', weight: 1.8 },
          { templateId: 'survival-crossfire', weight: 0.45 },
          { templateId: 'survival-rush', weight: 1.2 },
          { templateId: 'survival-gauntlet', weight: 1.1 },
        ],
        difficultyScale: 1.24,
        selection: {
          baseWeight: 4.95,
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
        description: '狭路相逢：在狭窄空间中突围',
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
        description: '高速突袭：敌军快速逼近',
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
        description: '交叉火力：被夹在敌军火力之间',
        templateCandidates: [
          { templateId: 'survival-crossfire', weight: 1.9 },
          { templateId: 'survival-gauntlet', weight: 0.8 },
          { templateId: 'survival-rush', weight: 0.6 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 1.68,
          soloMultiplier: 0.82,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            dash: 1.05,
          },
          battleCatchupBonus: 0.9,
        },
      },
      {
        id: 'round-3-battle-sieve',
        type: 'battle',
        phase: 'late',
        title: '筛火求生',
        description: '火力网：远近敌军轮番进攻',
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
        id: 'round-3-battle-crit-soft-closeout',
        type: 'battle',
        phase: 'late',
        title: '热区续压',
        description: '持续压制：保持火力等待爆发时机',
        templateCandidates: [
          { templateId: 'survival-rush', weight: 1.45 },
          { templateId: 'survival', weight: 1.15 },
          { templateId: 'survival-sieve', weight: 0.85 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 2.08,
          soloMultiplier: 0.96,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            crit: 0.92,
          },
          battleCatchupBonus: 1,
        },
      },
      {
        id: 'round-3-battle-pierce-soft-closeout',
        type: 'battle',
        phase: 'late',
        title: '拆线回收',
        description: '层层防御：突破多重防线',
        templateCandidates: [
          { templateId: 'survival-sieve', weight: 1.4 },
          { templateId: 'survival-gauntlet', weight: 1.25 },
          { templateId: 'survival', weight: 0.85 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 2.06,
          soloMultiplier: 0.96,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            pierce: 0.92,
          },
          battleCatchupBonus: 1,
        },
      },
      {
        id: 'round-3-battle-dash-soft-closeout',
        type: 'battle',
        phase: 'late',
        title: '回摆追回',
        description: '反击时机：利用机动性反守为攻',
        templateCandidates: [
          { templateId: 'survival-crossfire', weight: 1.35 },
          { templateId: 'survival-rush', weight: 1.2 },
          { templateId: 'survival', weight: 0.9 },
        ],
        difficultyScale: 1.29,
        selection: {
          baseWeight: 2.07,
          soloMultiplier: 0.96,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            dash: 0.92,
          },
          battleCatchupBonus: 1,
        },
      },
      {
        id: 'round-3-battle-crit-closeout',
        type: 'battle',
        phase: 'late',
        title: '爆点追收',
        description: '爆发时刻：积蓄火力一击制胜',
        templateCandidates: [
          { templateId: 'survival-rush', weight: 1.6 },
          { templateId: 'survival', weight: 1.1 },
          { templateId: 'survival-sieve', weight: 0.9 },
        ],
        difficultyScale: 1.3,
        selection: {
          baseWeight: 1.75,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            crit: 1.28,
          },
          battleCatchupBonus: 0.95,
        },
      },
      {
        id: 'round-3-battle-pierce-closeout',
        type: 'battle',
        phase: 'late',
        title: '裂面清账',
        description: '贯穿攻势：穿透防线直击要害',
        templateCandidates: [
          { templateId: 'survival-sieve', weight: 1.55 },
          { templateId: 'survival-gauntlet', weight: 1.4 },
          { templateId: 'survival', weight: 0.8 },
        ],
        difficultyScale: 1.3,
        selection: {
          baseWeight: 1.72,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            pierce: 1.24,
          },
          battleCatchupBonus: 0.95,
        },
      },
      {
        id: 'round-3-battle-dash-closeout',
        type: 'battle',
        phase: 'late',
        title: '回线反压',
        description: '极限机动：在狭窄空间中反击',
        templateCandidates: [
          { templateId: 'survival-crossfire', weight: 1.5 },
          { templateId: 'survival-rush', weight: 1.35 },
          { templateId: 'survival-sieve', weight: 0.75 },
        ],
        difficultyScale: 1.3,
        selection: {
          baseWeight: 1.74,
          soloMultiplier: 0.9,
          repeatTypeMultiplier: 0.78,
          routeBonuses: {
            dash: 1.26,
          },
          battleCatchupBonus: 0.95,
        },
      },
      {
        id: 'round-3-upgrade',
        type: 'upgrade',
        phase: 'late',
        title: '后段修正',
        description: '紧急维修：修补弱点准备最终战',
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
        description: '最后调整：为决战做最后准备',
        selection: {
          baseWeight: 3.2,
          repeatTypeMultiplier: 0.82,
          lowHpBonus: 1.8,
        },
      },
      {
        id: 'round-3-upgrade-commit-hold',
        type: 'upgrade',
        phase: 'late',
        title: '定势整备',
        description: '战术定型：巩固当前战斗风格',
        selection: {
          baseWeight: 2.58,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.45,
          routeBonuses: {
            crit: 0.38,
            pierce: 0.5,
            dash: 0.58,
          },
        },
      },
      {
        id: 'round-3-upgrade-payoff',
        type: 'upgrade',
        phase: 'late',
        title: '收束筹码',
        description: '收益兑现：获得强力升级',
        selection: {
          baseWeight: 2.7,
          repeatTypeMultiplier: 0.82,
          lowHpBonus: 1.4,
        },
      },
      {
        id: 'round-3-upgrade-rareline',
        type: 'upgrade',
        phase: 'late',
        title: '稀有读数',
        description: '稀有机遇：可能改变战局的升级',
        selection: {
          baseWeight: 2.05,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.25,
        },
      },
      {
        id: 'round-3-upgrade-closeout',
        type: 'upgrade',
        phase: 'late',
        title: '终拍定稿',
        description: '终局定型：决定最终战斗方式',
        selection: {
          baseWeight: 2.15,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.2,
        },
      },
      {
        id: 'round-3-upgrade-sidefold',
        type: 'upgrade',
        phase: 'late',
        title: '旁路归并',
        description: '路线融合：整合不同战术体系',
        selection: {
          baseWeight: 1.48,
          repeatTypeMultiplier: 0.8,
          lowHpBonus: 1.1,
        },
      },
      {
        id: 'round-3-event',
        type: 'anomaly',
        phase: 'late',
        title: '后段异常',
        description: '深层异常：高风险高回报的选择',
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
        description: '孤注一掷：沿{focusLabel}全力押注',
        selection: {
          baseWeight: 3.02,
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
        description: '未知信号：神秘的黑匣子数据',
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
        description: '首领气息：感受到强大敌人的威压',
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
        description: '首领回响：提前感知最终敌人',
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
        description: '多重选择：多条路径但充满风险',
        selection: {
          baseWeight: 1.5,
          soloMultiplier: 0.3,
          repeatTypeMultiplier: 0.58,
          noFocusBonus: 0.18,
        },
      },
      {
        id: 'round-3-anomaly-switchboard',
        type: 'anomaly',
        phase: 'late',
        title: '并线残响',
        description: '战术交汇：融合战术并预见首领',
        selection: {
          baseWeight: 1.34,
          soloMultiplier: 0.26,
          repeatTypeMultiplier: 0.56,
          noFocusBonus: 0.12,
        },
      },
      {
        id: 'round-3-anomaly-sidecar',
        type: 'anomaly',
        phase: 'late',
        title: '首领侧录',
        description: '首领预兆：窥见最终战的端倪',
        selection: {
          baseWeight: 1.58,
          soloMultiplier: 0.26,
          repeatTypeMultiplier: 0.56,
          noFocusBonus: 0.14,
        },
      },
      {
        id: 'round-3-anomaly-closeout',
        type: 'anomaly',
        phase: 'late',
        title: '终段偏航',
        description: '最后抉择：决战前的最终选择',
        selection: {
          baseWeight: 1.88,
          soloMultiplier: 0.28,
          repeatTypeMultiplier: 0.56,
          noFocusBonus: 0.16,
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
        description: '最终整备：为决战做好准备',
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
        description: '决战准备：修补所有弱点',
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
        description: '最终首领：高速突袭型Boss',
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
        description: '最终首领：封锁控制型Boss',
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
        description: '最终首领：护盾防御型Boss',
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

  if (round <= 3) {
    if (blueprint.type === 'battle') {
      weight *= 1.18 + round * 0.05;
      if (offerContext.lastNodeType && offerContext.lastNodeType !== 'battle') {
        weight += 2.2 + Math.max(0, round - offerContext.battleWins) * 0.55;
      }
    } else if (blueprint.type === 'upgrade') {
      weight *= 0.78;
      if (offerContext.lastNodeType === 'anomaly') {
        weight *= 0.72;
      }
    } else if (blueprint.type === 'anomaly') {
      weight *= 0.14 + round * 0.06;
      if (offerContext.lastNodeType === 'upgrade') {
        weight *= 0.22;
      }
    }
  } else if (blueprint.type === 'anomaly') {
    weight *= Math.min(0.46, 0.14 + round * 0.06);
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
    const anomalyPicked = picks.some((blueprint) => blueprint.type === 'anomaly');
    const eligiblePool = anomalyPicked ? pool.filter((entry) => entry.blueprint.type !== 'anomaly') : pool;

    if (eligiblePool.length <= 0) {
      break;
    }

    const totalWeight = eligiblePool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedEntry = eligiblePool[eligiblePool.length - 1];

    for (let index = 0; index < eligiblePool.length; index += 1) {
      roll -= eligiblePool[index].weight;
      if (roll <= 0) {
        selectedEntry = eligiblePool[index];
        break;
      }
    }

    const selectedIndex = pool.indexOf(selectedEntry);
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
      description: '开局战斗：消灭敌人开始征程',
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
