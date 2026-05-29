import type { RouteId } from '../game/types';

export interface MechanicEntry {
  term: string;
  explanation: string;
  howToTrigger: string;
  payoff: string;
  routeId?: RouteId;
}

export const MECHANIC_GLOSSARY: Record<string, MechanicEntry> = {
  // ===== Crit 流 =====
  破绽: {
    term: '破绽',
    explanation: '暴击命中时在敌人身上留下的标记。累计3层后自动引爆，造成额外爆点伤害。',
    howToTrigger: '暴击命中敌人即留下1层破绽标记。',
    payoff: '满3层后爆炸扩散至附近敌人，高暴击率可触发连续爆点连锁。',
    routeId: 'crit',
  },
  超频: {
    term: '超频',
    explanation: '触发爆点后进入的短时间强化状态。超频期间射速提升、暴击收益增加。',
    howToTrigger: '破绽爆点触发后自动进入超频状态。',
    payoff: '超频状态下更容易叠加新的破绽，形成"爆点→超频→更快叠破绽→更多爆点"的正循环。',
    routeId: 'crit',
  },
  爆点: {
    term: '爆点',
    explanation: '破绽满层触发的范围爆炸伤害。是暴击流的主要清场手段。',
    howToTrigger: '目标身上破绽达到3层时自动触发。',
    payoff: '爆点可触发超频，超频可加速破绽累积，形成爆发连锁。',
    routeId: 'crit',
  },
  暴击连锁: {
    term: '暴击连锁',
    explanation: '爆点爆炸会波及附近敌人，对其施加破绽标记，形成链式反应。',
    howToTrigger: '爆点击中附近敌人时自动施加破绽。',
    payoff: '一个爆点可能引发全屏连续爆点，达成"瞬间清场"效果。',
    routeId: 'crit',
  },

  // ===== Pierce 流 =====
  裂纹: {
    term: '裂纹',
    explanation: '穿透弹命中后在地面或敌人身上留下的裂痕轨迹。裂纹会持续一段时间并向附近敌人扩散。',
    howToTrigger: '穿透弹穿过敌人时在地面留下裂纹。部分升级可使穿透弹直接在敌人身上施加裂纹。',
    payoff: '裂纹上的敌人持续受到伤害，裂纹扩散后可覆盖大面积敌群。',
    routeId: 'pierce',
  },
  回响: {
    term: '回响',
    explanation: '穿透命中后的额外裂解伤害。对裂纹上的敌人造成追加伤害。',
    howToTrigger: '穿透弹命中敌人后自动触发回响伤害。',
    payoff: '回响对裂纹目标伤害提升，与裂纹扩散形成协同。',
    routeId: 'pierce',
  },
  穿透扩散: {
    term: '穿透扩散',
    explanation: '裂纹向附近敌人自动传播的机制。扩散后的裂纹可继续传播，形成连锁清线。',
    howToTrigger: '裂纹存在期间自动向范围内最近的敌人扩散。',
    payoff: '一条裂纹可最终覆盖整波敌人，达成"一线穿全屏"的清场效果。',
    routeId: 'pierce',
  },
  裂界: {
    term: '裂界',
    explanation: '穿透流的终局形态——裂纹可无限传播、不再消失，整个战场被裂纹网络覆盖。',
    howToTrigger: '达成Matured阶段且持有核心Legendary升级时激活。',
    payoff: '裂纹变成永久性地形效果，敌人持续受到裂界伤害。',
    routeId: 'pierce',
  },

  // ===== Dash 流 =====
  脉冲: {
    term: '脉冲',
    explanation: '穿梭触发时释放的范围冲击波。对周围敌人造成伤害并叠加脉冲层数。',
    howToTrigger: '每次穿梭（自动闪避）触发时自动释放脉冲。',
    payoff: '脉冲命中敌人可叠层，满层后触发强化脉冲和额外伤害。',
    routeId: 'dash',
  },
  穿梭: {
    term: '穿梭',
    explanation: '自动触发的短距离闪避位移。穿梭期间无敌并释放脉冲攻击附近敌人。',
    howToTrigger: '敌弹或敌人接近时自动触发穿梭。穿梭有冷却时间，部分升级可缩短冷却。',
    payoff: '穿梭既是生存手段也是伤害来源——穿梭→脉冲→叠层→反击。',
    routeId: 'dash',
  },
  反击: {
    term: '反击',
    explanation: '脉冲层数满后触发的加强版脉冲攻击。伤害和范围大幅提升。',
    howToTrigger: '脉冲叠满层数后自动触发反击。',
    payoff: '反击是Dash流的主要爆发手段，配合残影可造成大范围伤害。',
    routeId: 'dash',
  },
  残影: {
    term: '残影',
    explanation: '穿梭或反击后留下的短暂残像。残影会自动攻击附近的敌人。',
    howToTrigger: '穿梭或反击后自动生成残影。',
    payoff: '多个残影同时攻击可形成"残影风暴"，持续压制大范围区域。',
    routeId: 'dash',
  },
  叠层: {
    term: '叠层',
    explanation: '脉冲命中敌人累积的层数机制。层数越高，反击伤害越强。',
    howToTrigger: '脉冲每命中一个敌人积累1层。',
    payoff: '满层后触发反击——Dash流的核心爆发循环。',
    routeId: 'dash',
  },
  无伤: {
    term: '无伤',
    explanation: '穿梭触发后的短暂无敌时间。期间免疫所有伤害。',
    howToTrigger: '穿梭自动触发后进入无敌状态。',
    payoff: '合理利用无敌时间可规避高伤害弹幕，是Dash流的核心生存手段。',
    routeId: 'dash',
  },

  // ===== 通用 =====
  标记: {
    term: '标记',
    explanation: '流派机制在敌人身上留下的效果标识。不同流派有不同的标记类型。',
    howToTrigger: '对应流派攻击命中时施加。',
    payoff: '标记是流派联动的核心——通过标记实现伤害叠加和连锁触发。',
  },
  扩面: {
    term: '扩面',
    explanation: '同时发射更多子弹，增加攻击覆盖面。',
    howToTrigger: '持有扩面类升级时自动生效。',
    payoff: '更多子弹=更高命中率=更快叠加流派标记。',
  },
};

export function getMechanicExplanation(term: string): string | null {
  return MECHANIC_GLOSSARY[term]?.explanation ?? null;
}

export function getRouteMechanics(routeId: RouteId): MechanicEntry[] {
  return Object.values(MECHANIC_GLOSSARY).filter((entry) => entry.routeId === routeId);
}

export const ROUTE_INTRO_TEXT: Record<RouteId, { title: string; coreIdea: string; mechanics: string[]; goal: string }> = {
  crit: {
    title: '暴击流：破绽爆发',
    coreIdea: '通过暴击叠加破绽标记，满3层触发爆点爆炸，进入超频状态加速循环。',
    mechanics: [
      '暴击命中 → 留下破绽标记（最多3层）',
      '破绽满3层 → 触发爆点范围爆炸',
      '爆点触发 → 进入超频状态（射速+暴击收益提升）',
      '超频状态 → 更容易叠加新破绽',
    ],
    goal: '全屏连续爆点，爆炸连锁清场',
  },
  pierce: {
    title: '穿透流：裂纹扩散',
    coreIdea: '穿透弹留下裂纹轨迹，裂纹自动扩散覆盖敌群，配合回响造成持续裂解伤害。',
    mechanics: [
      '穿透命中 → 在地面/敌人身上留下裂纹',
      '裂纹存在 → 自动向附近敌人扩散传播',
      '裂纹伤害 + 回响 → 持续裂解被覆盖的敌人',
      '扩散连锁 → 一条裂纹覆盖全屏敌群',
    ],
    goal: '裂纹网络覆盖战场，一线穿全屏',
  },
  dash: {
    title: '穿梭流：脉冲反击',
    coreIdea: '自动穿梭闪避攻击，释放脉冲伤害并叠层，满层后触发强力反击。',
    mechanics: [
      '敌人/弹幕接近 → 自动穿梭闪避',
      '穿梭触发 → 释放脉冲范围伤害',
      '脉冲命中 → 累积层数',
      '层数满 → 触发反击（强化脉冲+额外伤害）',
    ],
    goal: '残影风暴持续压制，穿梭中打出爆发',
  },
};
