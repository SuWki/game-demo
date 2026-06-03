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
    explanation: '暴击打出来的口子。叠到3层就会直接炸开，顺手把附近敌人一起带走。',
    howToTrigger: '暴击命中一次就给敌人加1层破绽。',
    payoff: '满3层后爆开，打得越稳，连锁越容易滚起来。',
    routeId: 'crit',
  },
  超频: {
    term: '超频',
    explanation: '爆点炸开后的短时强势期。进了这个窗口，射速更快，下一轮更容易接上。',
    howToTrigger: '破绽爆点触发后自动进入超频。',
    payoff: '超频会把下一轮暴击做得更顺，能把爆点一路滚下去。',
    routeId: 'crit',
  },
  爆点: {
    term: '爆点',
    explanation: '破绽满层后炸开的范围爆炸，是暴击流最直接的开机手段。',
    howToTrigger: '目标身上的破绽到3层时自动触发。',
    payoff: '一个爆点能把下一轮节奏也带起来，清场会越来越快。',
    routeId: 'crit',
  },
  暴击连锁: {
    term: '暴击连锁',
    explanation: '一个爆点炸开后，还会顺手把周围敌人点着，继续往外滚。',
    howToTrigger: '爆点击中附近敌人时自动补上破绽。',
    payoff: '一个爆点可能带出一串爆点，最后直接清场。',
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
    title: '暴击流：先锁窗口，再连爆',
    coreIdea: '先把暴击做成稳定窗口，破绽叠满就炸，炸完继续把下一轮窗口顶起来。',
    mechanics: [
      '先把暴击窗口撑住，别急着乱换目标',
      '破绽叠到3层就炸，炸开就是一波清线',
      '爆点之后进入超频，下一轮更容易接上',
      '越往后越像连锁反应，最后直接收尾',
    ],
    goal: '一轮接一轮地炸，最后直接收场',
  },
  pierce: {
    title: '穿透流：一线切开',
    coreIdea: '穿透弹先把敌线切开，再让裂纹往外扩，最后把整片敌群一起穿过去。',
    mechanics: [
      '先找好一条线，让子弹穿过去',
      '裂纹会顺着空隙往外扩，越打越宽',
      '裂纹上的敌人会持续掉血，回响会补刀',
      '后面就不是清一群，而是整片一起散',
    ],
    goal: '让敌群自己裂开，一路穿到后面',
  },
  dash: {
    title: '穿梭流：节奏反打',
    coreIdea: '靠自动穿梭躲开压力，再用脉冲和反击把节奏抢回来。',
    mechanics: [
      '敌人和弹幕贴上来时，先躲开',
      '每次穿梭都会顺手打一圈脉冲',
      '脉冲叠满后，反击会突然变狠',
      '越会卡节奏，越像在反过来压场',
    ],
    goal: '边躲边打，最后把节奏彻底抢回来',
  },
};
