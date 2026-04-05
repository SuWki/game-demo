import { getAnomalyRoutePoolOptions } from './anomalyRoutePools';
import type { EventContentKind, EventDefinition } from '../game/types';

export const EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时整备',
    description: '短暂停机维护。你要更稳的续航，还是更敢压进下一段？',
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
    description: '承受额外负荷，换取一次异常路线强化。',
    selection: {
      baseWeight: 2.5,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.1,
        mid: 0.3,
      },
      noDominantRouteBonus: 1,
    },
    options: getAnomalyRoutePoolOptions('riskyProtocol', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'route-calibration',
    name: '读数校准',
    description: '系统建议你顺着已有倾向继续深入，或者先补一个保底。',
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
    description: '系统抓到一段更贴近当前路线的战斗遥测。要顺势压深，还是先换成更稳的整理？',
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
    description: '你截获了一段残留补给。现在拆成火力读数，还是拆成更稳的机体冗余？',
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
    description: '读数已经开始偏向一条路了，但系统提醒你先把坡度铺平也许更稳。',
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
    description: '机体需要一小段缓冲。你可以把它换成节奏空间，也可以换成更稳的容错。',
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
    id: 'relay-splice',
    name: '并线改道',
    contentKind: 'anomaly',
    description: '侧频总线短暂并轨。你可以借这次窗口把读法改道到另一条线，同时先拿到一段立刻见效的缓冲。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 0.78,
      minRound: 2,
      phaseBonuses: {
        mid: 0.55,
        late: 0.2,
      },
      hintedRouteBonus: 0.45,
      dominantRouteBonus: 0.95,
      committedRouteBonus: 0.3,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('relaySplice', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'route-handoff',
    name: '侧频接驳',
    contentKind: 'anomaly',
    description: '侧频接口短暂打开。你可以顺着当前读法微调，也可以借这拍直接把读法掰向另一条线。',
    selection: {
      baseWeight: 0.68,
      minRound: 2,
      phaseBonuses: {
        mid: 0.5,
        late: 0.18,
      },
      noDominantRouteBonus: 0.1,
      hintedRouteBonus: 0.3,
      committedRouteBonus: 0.25,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('routeHandoff', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'crit-reroute-window',
    name: '暴击转接窗',
    contentKind: 'anomaly',
    description: '当前暴击读法已经起势。你可以趁接口还没关死，把这条线切向别的收束。',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      phaseBonuses: {
        mid: 2.25,
        late: 0.95,
      },
      hintedRouteBonus: 1,
      dominantRouteBonus: 3.05,
      committedRouteBonus: 1.9,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      ...getAnomalyRoutePoolOptions('critRerouteWindow', ['pierce', 'dash']),
      {
        id: 'crit-reroute-window-hold',
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
        ],
      },
    ],
  },
  {
    id: 'pierce-reroute-window',
    name: '穿透转接窗',
    contentKind: 'anomaly',
    description: '当前穿透读法已经拉出清线节奏。你可以借这次窗口切向另一条收束方式。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      phaseBonuses: {
        mid: 2.25,
        late: 0.95,
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
        ],
      },
    ],
  },
  {
    id: 'dash-reroute-window',
    name: '穿梭转接窗',
    contentKind: 'anomaly',
    description: '当前穿梭节奏已经成形。你可以借这次窗口把反打节奏切向别的收束方式。',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      phaseBonuses: {
        mid: 2.25,
        late: 0.95,
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
    id: 'cross-branch-signal',
    name: '岔路讯号',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: '一段侧频样本插了进来。它不一定比当前方向更强，但足够让这局出现一次真正的转向诱惑。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.35,
      minRound: 2,
      phaseBonuses: {
        mid: 1.5,
        late: 1.7,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 2.2,
      committedRouteBonus: 1.5,
      maturedRouteBonus: 0.4,
    },
    options: getAnomalyRoutePoolOptions('crossBranchSignal', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: '封存记录只够开一次。你可以把它压成高风险兑现，也可以拆成这局独有的一段缓冲余地。',
    selection: {
      baseWeight: 1.15,
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
    id: 'mirror-cache',
    name: '镜像缓存',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: '尾段里突然拉出一段镜像样本。你可以把它压成当前路线的收尾，也可以拆成这局独有的一段混搭余量。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 0.7,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 1.9,
      committedRouteBonus: 1.2,
      maturedRouteBonus: 0.6,
    },
    options: [
      {
        id: 'mirror-cache-press',
        label: '压成当前收尾',
        description: '补一段尾段火力，并沿当前方向再压一步。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.18,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'mirror-cache-open',
        label: '拆成并轨余量',
        description: '补一段机动、弹速和再生，把尾段混搭窗口留宽一点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 24,
              moveSpeed: 16,
              regeneration: 0.12,
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
    id: 'crit-heat-bank',
    name: '热区记录',
    contentTier: 'rare',
    description: '一段暴击热区记录被锁定。你要把连发窗口继续拉长，还是把单次爆点压得更狠？',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'crit-heat-bank-feed',
        label: '续热供压',
        description: '把暴击触发接成更长的升温链。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.24,
              critChance: 0.05,
            },
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
      {
        id: 'crit-heat-bank-burst',
        label: '压成爆点',
        description: '把暴击伤害和爆发读数往收尾方向再推一截。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              critMultiplier: 0.32,
            },
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
    id: 'pierce-routing-map',
    name: '裂轨图谱',
    contentTier: 'rare',
    description: '你截获了一张贯穿波形图。要继续拉长链条，还是把清线扇面直接铺开？',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'pierce-routing-map-chain',
        label: '续链校正',
        description: '让贯穿链条更长、更稳，更适合一路打穿。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 26,
            },
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
      {
        id: 'pierce-routing-map-bloom',
        label: '扇裂展开',
        description: '把裂轨扇面和面压收益提前拉出来。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              damage: 2,
            },
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
    id: 'dash-weave-memory',
    name: '穿梭记忆',
    contentTier: 'rare',
    description: '机体留下了一段高压换位回放。要把擦身蓄能做厚，还是把反打窗口拉长？',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'dash-weave-memory-graze',
        label: '贴身取样',
        description: '把擦身收益和换位速度继续做厚，逼出更主动的走位节奏。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 14,
              dashInterval: -0.42,
              dashPulseDamage: 6,
            },
          },
          {
            type: 'route',
            routeId: 'dash',
          },
        ],
      },
      {
        id: 'dash-weave-memory-stabilize',
        label: '稳住净帧',
        description: '把无伤窗口和回线稳态拉长，换更可靠的反打空档。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInvulnerability: 0.1,
              regeneration: 0.12,
            },
          },
          {
            type: 'route',
            routeId: 'dash',
          },
        ],
      },
    ],
  },
  {
    id: 'phase-debt',
    name: '相位欠账',
    contentKind: 'anomaly',
    description: '异常账层把后半段压力提前透支到了现在。你可以立刻套现一段爆发，也可以把这次回震压成更厚的容错。',
    selection: {
      baseWeight: 1.3,
      minRound: 2,
      phaseBonuses: {
        mid: 1.25,
        late: 0.85,
      },
      noDominantRouteBonus: 0.3,
    },
    options: [
      {
        id: 'phase-debt-overclock',
        label: '先透支火线',
        description: '立刻换来一段更凶的火力，但机体会先吃下一次提前回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.18,
            },
          },
          {
            type: 'heal',
            amount: -12,
          },
        ],
      },
      {
        id: 'phase-debt-buffer',
        label: '先吞下回震',
        description: '把这次失真压成更厚的耐久和再生，代价是弹道会短暂变钝。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.14,
              projectileSpeed: -18,
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
    id: 'phase-splitter',
    name: '相位裂缝',
    contentKind: 'anomaly',
    description: '异常裂缝把互不兼容的读法短暂并排拉到面前。这不是普通补给，而是一拍真正的并轨试错。',
    selection: {
      baseWeight: 1.85,
      minRound: 2,
      phaseBonuses: {
        mid: 1.7,
        late: 0.95,
      },
      noDominantRouteBonus: 0.4,
    },
    options: [
      {
        id: 'phase-splitter-crit-pierce',
        label: '接入灼线样本',
        description: '补一段暴击升温和穿透清线的混搭样本，先拿到手感，再决定后续要不要顺着走。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              critChance: 0.03,
              projectileSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'phase-splitter-pierce-dash',
        label: '接入扇面位移',
        description: '把穿透扇面和位移窗口短接在一起，换更顺的中段走位。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              moveSpeed: 12,
              dashInterval: -0.18,
            },
          },
        ],
      },
      {
        id: 'phase-splitter-dash-crit',
        label: '接入反打热区',
        description: '用换位反打去接一段暴击升温，把主动出手的窗口撑开。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 10,
              fireRate: 0.12,
              critChance: 0.02,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'null-lens',
    name: '空镜偏折',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: '一段不属于当前局面的偏折样本被照了出来。你可以把它折成一次危险混搭，也可以把它压成更稳的尾段余量。',
    selection: {
      baseWeight: 0.92,
      minRound: 3,
      phaseBonuses: {
        late: 1.7,
        finalPrep: 0.75,
      },
      noDominantRouteBonus: 0.2,
    },
    options: [
      {
        id: 'null-lens-weave',
        label: '折成危险混搭',
        description: '立刻接上两种不安分的读法，收益更高，也要先吞一次波形回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critChance: 0.02,
              pierce: 1,
              moveSpeed: 12,
            },
          },
          {
            type: 'heal',
            amount: -8,
          },
        ],
      },
      {
        id: 'null-lens-brace',
        label: '压成稳态余量',
        description: '不抢当下爆发，改拿更厚的耐久、回收和弹道余量，给尾段留出读数。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              regeneration: 0.14,
              projectileSpeed: 18,
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
    id: 'carrier-breach',
    name: '载体失真',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: '异常载体开始失真。你可以把这段波形压成一次高收益冲刺，也可以拆成一段更宽的并轨余量。',
    selection: {
      baseWeight: 1.02,
      minRound: 2,
      phaseBonuses: {
        mid: 1,
        late: 1.8,
        finalPrep: 0.75,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 1.2,
      committedRouteBonus: 0.7,
    },
    options: [
      {
        id: 'carrier-breach-redline',
        label: '压成红线冲刺',
        description: '立刻换来一段更凶的输出，但机体会先吃下一次失真回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 7,
              fireRate: 0.18,
              critChance: 0.03,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
      {
        id: 'carrier-breach-open',
        label: '拆成并轨余量',
        description: '不赌当下爆发，改拿更宽的移动、弹道和恢复余量，把后续异常窗口留活。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 16,
              projectileSpeed: 20,
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
    id: 'boss-shadow-scan',
    name: 'Boss 阴影扫描',
    contentKind: 'anomaly',
    contentTier: 'rare',
    description: 'Boss 载体边界泄出了一段压力样本。你还没真正撞上最终关，但已经能先决定要拿哪种收束准备。',
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 2.1,
        finalPrep: 1.35,
      },
      noDominantRouteBonus: 0.25,
    },
    options: [
      {
        id: 'boss-shadow-scan-brace',
        label: '预装正面承压',
        description: '补一段正面顶压的厚度，准备在 Boss 压脸时仍能持续输出。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              damage: 3,
            },
          },
          {
            type: 'heal',
            amount: 18,
          },
        ],
      },
      {
        id: 'boss-shadow-scan-window',
        label: '预留侧向窗口',
        description: '把移动、弹速和回复提前补好，为最终 Boss 的封位和拖线留更宽的走位。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 18,
              projectileSpeed: 22,
              regeneration: 0.12,
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
];

export const STANDARD_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'event');

export const ANOMALY_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'anomaly');

export function getEventCatalogByKind(contentKind: EventContentKind): EventDefinition[] {
  if (contentKind === 'anomaly') {
    return ANOMALY_EVENT_CATALOG.length > 0 ? ANOMALY_EVENT_CATALOG : EVENT_CATALOG;
  }
  return STANDARD_EVENT_CATALOG.length > 0 ? STANDARD_EVENT_CATALOG : EVENT_CATALOG;
}
