import { getAnomalyRoutePoolOptions } from './anomalyRoutePools';
import { normalizeEffectsToSingleStat } from './upgrades';
import type { ContentEffect, EventContentKind, EventDefinition, RouteReference } from '../game/types';

const RAW_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时整备',
    description: '机体需要快速维护。选择更稳定的防护，还是压榨更多火力？',
    selection: {
      baseWeight: 4.4,
      phaseBonuses: {
        opening: 1.2,
        mid: 0.6,
      },
      noDominantRouteBonus: 1.6,
    },
    options: [
      {
        id: 'field-maintenance-heal',
        label: '补强外甲',
        description: '恢复 22 点耐久，并提高 8 点上限。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
            },
          },
          {
            type: 'heal',
            amount: 22,
          },
        ],
      },
      {
        id: 'field-maintenance-damage',
        label: '压榨火控',
        description: '伤害与射速小幅抬升。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.25,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'risky-protocol',
    name: '高压试飞',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '危险试飞协议：立即承受伤害，换取一次战术转向的机会。',
    selection: {
      baseWeight: 1.15,
      maxRound: 2,
      phaseBonuses: {
        opening: 0.9,
        mid: 0.15,
      },
      noDominantRouteBonus: 0.8,
    },
    options: getAnomalyRoutePoolOptions('riskyProtocol', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'cold-start-warp',
    name: '冷启偏折',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '系统异常波动：不稳定的能量涌动，可以转化为火力或防护，但代价不同。',
    selection: {
      baseWeight: 1.05,
      maxRound: 2,
      phaseBonuses: {
        opening: 0.95,
        mid: 0.55,
      },
      noDominantRouteBonus: 0.6,
    },
    options: [
      {
        id: 'cold-start-warp-redline',
        label: '先吞一口红线',
        description: '立刻换一段更猛的火力，但会先吃下一次冷启动回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.14,
            },
          },
          {
            type: 'heal',
            amount: -8,
          },
        ],
      },
      {
        id: 'cold-start-warp-brace',
        label: '先垫一层缓冲',
        description: '把失真压成更厚的前段容错，但弹道会短暂变钝。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
              regeneration: 0.1,
              projectileSpeed: -12,
            },
          },
          {
            type: 'heal',
            amount: 8,
          },
        ],
      },
    ],
  },
  {
    id: 'route-calibration',
    name: '读数校准',
    description: '战术建议：继续强化当前作战方式，或者先恢复机体状态。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.3,
      minRound: 2,
      phaseBonuses: {
        mid: 1.3,
        late: 0.4,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 3.4,
      committedRouteBonus: 1.6,
      maturedRouteBonus: 0.2,
    },
    options: [
      {
        id: 'route-calibration-focus',
        label: '继续压当前方向',
        description: '强化已有路线的关键手感。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.15,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'route-calibration-stabilize',
        label: '补一个稳态',
        description: '恢复 12 点耐久，并提高射速。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.2,
            },
          },
          {
            type: 'heal',
            amount: 12,
          },
        ],
      },
    ],
  },
  {
    id: 'targeted-telemetry',
    name: '定向遥测',
    description: '战术数据匹配：发现适合当前战法的作战数据。深入强化，还是转为防御？',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.2,
      minRound: 2,
      phaseBonuses: {
        mid: 1,
        late: 0.7,
      },
      hintedRouteBonus: 0.8,
      dominantRouteBonus: 3.2,
      committedRouteBonus: 1.5,
      maturedRouteBonus: 0.6,
    },
    options: [
      {
        id: 'targeted-telemetry-press',
        label: '追当前窗口',
        description: '把当前路线继续往前压一小步，并补一点基础火力。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.12,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'targeted-telemetry-buffer',
        label: '换一段缓冲',
        description: '恢复 14 点耐久，并提高 6 点上限。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
            },
          },
          {
            type: 'heal',
            amount: 14,
          },
        ],
      },
    ],
  },
  {
    id: 'salvage-bay',
    name: '回收舱段',
    description: '截获残留补给：可以拆解为火力组件或防护装甲。',
    selection: {
      baseWeight: 3.4,
      phaseBonuses: {
        opening: 0.6,
        mid: 0.8,
        late: 0.2,
      },
      noDominantRouteBonus: 0.8,
    },
    options: [
      {
        id: 'salvage-bay-fire',
        label: '拆成火控件',
        description: '基础伤害上升，并补一点射速。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.16,
            },
          },
        ],
      },
      {
        id: 'salvage-bay-guard',
        label: '拆成缓冲甲',
        description: '恢复 16 点耐久，并提高一点再生。',
        effects: [
          {
            type: 'heal',
            amount: 16,
          },
          {
            type: 'stats',
            modifiers: {
              regeneration: 0.12,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'signal-soften',
    name: '缓冲信号',
    description: '战术调整建议：当前作战方式已初见成效，可以继续深入或保留灵活性。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.4,
        late: 0.7,
      },
      hintedRouteBonus: 1.6,
      dominantRouteBonus: 2.4,
      committedRouteBonus: 1.4,
      maturedRouteBonus: 0.4,
    },
    options: [
      {
        id: 'signal-soften-lean',
        label: '顺着读法微调',
        description: '沿当前方向补一段手感，但先不急着把承诺压死。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.14,
              moveSpeed: 12,
            },
          },
        ],
      },
      {
        id: 'signal-soften-open',
        label: '保留转向余地',
        description: '补一段续航和机动，把后面的分支留宽一点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              regeneration: 0.1,
              moveSpeed: 10,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'coolant-detour',
    name: '冷却绕行',
    description: '冷却缓冲时间：可以转化为更快的攻击节奏，或更稳定的防护。',
    selection: {
      baseWeight: 2.8,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 1,
    },
    options: [
      {
        id: 'coolant-detour-tempo',
        label: '换节奏窗口',
        description: '射速和弹速上升，帮助把中段衔接得更顺。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.18,
              projectileSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'coolant-detour-guard',
        label: '换稳定容错',
        description: '恢复 12 点耐久，并补一点上限和再生。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
              regeneration: 0.08,
            },
          },
          {
            type: 'heal',
            amount: 12,
          },
        ],
      },
    ],
  },
  {
    id: 'route-handoff',
    name: '侧频接驳',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '紧急战术切换：短暂的机会窗口，可以微调当前战法或切换到全新方向。',
    selection: {
      baseWeight: 0.26,
      minRound: 2,
      phaseBonuses: {
        mid: 0.36,
        late: 0.12,
      },
      noDominantRouteBonus: 0.1,
      hintedRouteBonus: 0.2,
      committedRouteBonus: 0.16,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('routeHandoff', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'crit-reroute-window',
    name: '暴击转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '暴击战术转向：当前暴击打法已成型，可以切换到其他作战方式。',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 1.22,
      minRound: 2,
      phaseBonuses: {
        mid: 1.68,
        late: 0.7,
      },
      hintedRouteBonus: 0.24,
      dominantRouteBonus: 2.68,
      committedRouteBonus: 1.62,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      ...getAnomalyRoutePoolOptions('critRerouteWindow', ['pierce', 'dash']),
      {
        id: 'crit-reroute-window-hold',
        routeId: 'crit',
        label: '先稳当前火力',
        description: '不急着转向，先补一段基础火力和耐久，留着后面再判断。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.1,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
    ],
  },
  {
    id: 'pierce-reroute-window',
    name: '穿透转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿透战术转向：当前穿透打法已形成清场节奏，可以切换到其他作战方式。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 1.45,
      minRound: 2,
      phaseBonuses: {
        mid: 2.05,
        late: 0.78,
      },
      hintedRouteBonus: 1,
      dominantRouteBonus: 3.05,
      committedRouteBonus: 1.9,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      ...getAnomalyRoutePoolOptions('pierceRerouteWindow', ['crit', 'dash']),
      {
        id: 'pierce-reroute-window-hold',
        routeId: 'pierce',
        label: '先稳当前清线',
        description: '不急着转向，先补一段稳定火力和耐久，把窗口留到后面。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              projectileSpeed: 16,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
    ],
  },
  {
    id: 'dash-reroute-window',
    name: '穿梭转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿梭战术转向：当前穿梭节奏已成型，可以切换到其他作战方式。',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 1.45,
      minRound: 2,
      phaseBonuses: {
        mid: 2.05,
        late: 0.78,
      },
      hintedRouteBonus: 1,
      dominantRouteBonus: 3.05,
      committedRouteBonus: 1.9,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      ...getAnomalyRoutePoolOptions('dashRerouteWindow', ['crit', 'pierce']),
      {
        id: 'dash-reroute-window-hold',
        label: '先稳当前机动',
        description: '不急着转向，先补一段移速、再生和耐久，让后续窗口更宽。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 10,
              regeneration: 0.08,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '封存数据解锁：珍贵的一次性资源，可以转化为强大火力或持久防护。',
    selection: {
      baseWeight: 1.28,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 0.7,
      },
      noDominantRouteBonus: 0.4,
    },
    options: [
      {
        id: 'blackbox-bargain-redline',
        label: '压成红线输出',
        description: '伤害与射速大幅抬升，但机体会立刻承压。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 8,
              fireRate: 0.24,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
      {
        id: 'blackbox-bargain-slack',
        label: '拆成喘息余地',
        description: '换一段续航、机动和弹道缓冲，把尾段窗口留宽一点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 24,
              moveSpeed: 14,
              regeneration: 0.14,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'overload-firecontrol',
    name: '过载火控',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '火控系统过载：牺牲射速换取巨大伤害，彻底改变输出方式。',
    selection: {
      baseWeight: 0.95,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 1.1,
    },
    options: [
      {
        id: 'overload-firecontrol-accept',
        label: '接受过载',
        description: '射速降低 40%，伤害提升 80%。适合高射速流派转型为重火力输出。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.4,
              damage: 8,
            },
          },
        ],
      },
      {
        id: 'overload-firecontrol-decline',
        label: '拒绝过载',
        description: '保持当前配置，获得少量通用强化。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              fireRate: 0.08,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'compressed-cycle',
    name: '压缩循环',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '输出循环压缩：牺牲伤害换取极高射速，让火力变得密集而轻快。',
    selection: {
      baseWeight: 0.92,
      minRound: 2,
      phaseBonuses: {
        mid: 1.15,
        late: 0.85,
      },
      noDominantRouteBonus: 1.05,
    },
    options: [
      {
        id: 'compressed-cycle-accept',
        label: '接受压缩',
        description: '伤害降低 30%，射速提升 70%。适合低射速流派转型为高频输出。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              fireRate: 0.7,
            },
          },
        ],
      },
      {
        id: 'compressed-cycle-decline',
        label: '拒绝压缩',
        description: '保持当前配置，获得少量通用强化。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              fireRate: 0.08,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'fixed-turret',
    name: '固定炮台',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '固定炮台改造：牺牲机动性换取强大火力，从灵活战斗转为站桩输出。',
    selection: {
      baseWeight: 0.88,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 0.9,
      },
      noDominantRouteBonus: 1.15,
    },
    options: [
      {
        id: 'fixed-turret-accept',
        label: '接受改造',
        description: '移速降低 50%，伤害提升 40%，射速提升 30%。适合高机动流派转型为站桩输出。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -50,
              damage: 4,
              fireRate: 0.3,
            },
          },
        ],
      },
      {
        id: 'fixed-turret-decline',
        label: '拒绝改造',
        description: '保持当前配置，获得少量通用强化。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              moveSpeed: 8,
            },
          },
        ],
      },
    ],
  },
];

function normalizeEventOptionEffects(
  eventDef: EventDefinition,
  eventId: string,
  option: EventDefinition['options'][number],
): EventDefinition['options'][number] {
  if (!option.effects || option.effects.length === 0) {
    return option;
  }

  const normalizedEffects = normalizeEffectsToSingleStat(
    `${eventId}:${option.id}`,
    option.effects,
    option.routeId && option.routeId !== 'dominant' ? option.routeId : undefined,
  );

  return {
    ...option,
    effects: appendImplicitAnomalyRouteSupport(eventDef, option, normalizedEffects),
  };
}

export const EVENT_CATALOG: EventDefinition[] = RAW_EVENT_CATALOG.map((eventDef) => ({
  ...eventDef,
  options: eventDef.options.map((option) => normalizeEventOptionEffects(eventDef, eventDef.id, option)),
}));

export const STANDARD_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'event');

export const ANOMALY_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'anomaly');

export function getEventCatalogByKind(contentKind: EventContentKind): EventDefinition[] {
  if (contentKind === 'anomaly') {
    return ANOMALY_EVENT_CATALOG.length > 0 ? ANOMALY_EVENT_CATALOG : EVENT_CATALOG;
  }
  return STANDARD_EVENT_CATALOG.length > 0 ? STANDARD_EVENT_CATALOG : EVENT_CATALOG;
}

function appendImplicitAnomalyRouteSupport(
  eventDef: EventDefinition,
  option: EventDefinition['options'][number],
  effects: ContentEffect[],
): ContentEffect[] {
  if ((eventDef.contentKind ?? 'event') !== 'anomaly') {
    return effects;
  }

  if (effects.some((effect) => effect.type === 'route')) {
    return effects;
  }

  const routeSupport = resolveImplicitAnomalyRouteSupport(eventDef, option);
  if (!routeSupport) {
    return effects;
  }

  return [
    ...effects.map((effect) =>
      effect.type === 'stats'
        ? {
            type: 'stats' as const,
            modifiers: {
              ...effect.modifiers,
            },
          }
        : { ...effect },
    ),
    ...Array.from({ length: routeSupport.count }, () => ({
      type: 'route' as const,
      routeId: routeSupport.routeId,
    })),
  ];
}

function resolveImplicitAnomalyRouteSupport(
  eventDef: EventDefinition,
  option: EventDefinition['options'][number],
): { routeId: RouteReference; count: number } | null {
  const explicitRoute = option.routeId ?? eventDef.routeAffinity;

  if (eventDef.anomalyClass === 'routeWindow') {
    return explicitRoute ? { routeId: explicitRoute, count: 2 } : null;
  }

  if (eventDef.anomalyClass === 'bossEcho') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  if (eventDef.anomalyClass === 'hybrid') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  if (eventDef.anomalyClass === 'distortion') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  return null;
}
