路线特化关卡设计文档
Route-Specific Encounter Design Document
版本: v1.0

日期: 2026-05-06

目标: 为Crit/Pierce/Dash三条路线设计专属的精英关和Boss关，充分检验每个流派的核心机制

一、设计理念总结
三条路线的核心差异
路线	节奏类型	核心机制	玩家决策点
Crit	爆发节奏型	破绽累积(5层)→终结打击(×2.5)→爆发连锁(×1.3)	何时触发终结打击？
Pierce	扩散控场型	穿透印记→击杀传播(120半径)→连锁累积(3层×1.4)	优先击杀哪个敌人？
Dash	机动爆发型	幽灵打击(70%额外子弹)→动量累积(5层+40%)→反击窗口(1.2秒)	何时Dash维持动量？
当前关卡系统的问题
现有的精英关和Boss关缺乏针对性：

elite/elite-vice/elite-lockdown 等关卡是通用设计
没有专门测试Crit的"蓄力-爆发"循环
没有专门测试Pierce的"印记传播"战术
没有专门测试Dash的"动量维持"能力
二、精英关设计（Round 2 中段）
2.1 Crit路线检验关：「蓄势压制」
模板ID: elite-pressure-hold

设计目标: 测试Crit玩家的节奏把控和爆发时机选择

核心机制

周期性护盾循环：
1. 护盾期（8.5秒）：Elite受到85%减伤，召唤3个厚血怪
2. 虚弱期（3秒）：Elite无护盾，可正常输出
3. 循环重复

Crit玩家最优策略：
- 护盾期：用普通怪累积5层破绽
- 虚弱期开始：立即用终结打击爆发（×2.5伤害）
- 虚弱期内：利用爆发连锁窗口（×1.3伤害）持续输出
完整配置

'elite-pressure-hold': {
  id: 'elite-pressure-hold',
  name: '蓄势压制',
  description: '精英会周期性召唤护盾小怪，必须在护盾窗口期爆发击杀',
  contentTier: 'rare',
  durationSec: 35,
  spawnIntervalSec: 1.2,
  enemyHp: 24,
  enemySpeed: 55,
  enemyDamage: 9,
  regularEnemyCap: 8,  // 较少杂兵，给玩家蓄力空间
  pressureMultiplier: 1.32,
  accent: 0xff6b4a,
  winCondition: { type: 'elite', target: 1 },
  spawnRule: { pattern: 'surround', burstCount: 1 },
  regularArchetypes: {
    standard: 3.5,  // 大量普通怪用于累积破绽
    brute: 0.8,
    skirmisher: 0.5,
    ranged: 0.2,
  },
  escortArchetypes: {
    standard: 0.5,
    brute: 3.0,  // 护盾期召唤厚血怪
    skirmisher: 0.3,
    ranged: 0.2,
  },
  eliteRule: {
    spawnAtSec: 3.5,
    hpMultiplier: 10.5,  // 较高血量，需要多次终结打击
    speedMultiplier: 0.95,  // 较慢，给玩家瞄准时间
    damageMultiplier: 2.5,
    guardSec: 5.5,  // 长护盾期
    guardDamageMultiplier: 0.35,  // 护盾期伤害大幅降低
    radius: 23,
    regularEnemyCap: 9,
    behavior: 'frontline',
    preferredDistance: 140,
    strafeStrength: 0.25,  // 低横移，易瞄准
    escortBatch: 3,
    escortRespawnSec: 8.5,  // 周期性护盾窗口
    escortMax: 6,
    pressurePhases: [
      {
        id: 'shield-cycle',
        label: '护盾循环',
        triggerHpRatio: 0.65,
        triggerRemainingSec: 18,
        minResidenceSec: 5,
        entryGuardSec: 4.0,
        entryGuardDamageMultiplier: 0.25,
        entryEscortBurst: 4,
        escortBatchBonus: 2,
        escortMaxBonus: 3,
        escortRespawnMultiplier: 0.7,
        regularEnemyCapBonus: 2,
      },
    ],
  },
}
节点配置（添加到nodes.ts）

{
  id: 'round-2-battle-crit-pressure',
  type: 'battle',
  phase: 'mid',
  title: '蓄势压制',
  description: '周期性护盾窗口，考验爆发时机把控',
  templateId: 'elite-pressure-hold',
  difficultyScale: 1.22,
  selection: {
    baseWeight: 2.8,
    soloMultiplier: 1.05,
    repeatTypeMultiplier: 0.76,
    routeBonuses: {
      crit: 1.85,  // Crit路线高权重
      pierce: 0.6,
      dash: 0.7,
    },
    battleCatchupBonus: 1.5,
  },
}
2.2 Pierce路线检验关：「感染压制」
模板ID: elite-contagion

设计目标: 测试Pierce玩家的击杀顺序选择和印记传播利用

核心机制

极高敌人密度环境：
1. Elite被12+护卫包围，形成多层防线
2. 护卫横向排列，最大化穿透价值
3. 击杀带印记的护卫会传播到120半径内所有敌人

Pierce玩家最优策略：
- 用穿透攻击标记多个敌人
- 优先击杀密集区域的带印记敌人
- 触发印记传播形成"感染链"
- 利用连锁累积（3层×1.4）清理护卫群
完整配置

'elite-contagion': {
  id: 'elite-contagion',
  name: '感染压制',
  description: '精英被密集护卫包围，击杀带印记的护卫可引发连锁崩溃',
  contentTier: 'rare',
  durationSec: 33,
  spawnIntervalSec: 0.85,
  enemyHp: 21,
  enemySpeed: 58,
  enemyDamage: 9,
  regularEnemyCap: 14,  // 高密度敌群
  pressureMultiplier: 1.42,
  accent: 0x4ac3ff,
  winCondition: { type: 'elite', target: 1 },
  spawnRule: {
    pattern: 'lanes',
    burstCount: 2,
    laneBias: 'horizontal',  // 横向密集排列
  },
  regularArchetypes: {
    standard: 2.8,
    brute: 1.5,
    skirmisher: 1.2,
    ranged: 0.5,
  },
  escortArchetypes: {
    standard: 2.5,  // 大量标准护卫，易于穿透
    brute: 1.0,
    skirmisher: 1.5,
    ranged: 0.8,
  },
  eliteRule: {
    spawnAtSec: 2.8,
    hpMultiplier: 9.2,
    speedMultiplier: 1.0,
    damageMultiplier: 2.38,
    guardSec: 4.0,
    guardDamageMultiplier: 0.55,
    radius: 22,
    regularEnemyCap: 16,  // 极高敌人上限
    behavior: 'screened',  // 躲在护卫后
    preferredDistance: 200,
    strafeStrength: 0.38,
    escortBatch: 4,  // 大量护卫
    escortRespawnSec: 4.2,
    escortMax: 12,  // 极高护卫上限
    pressurePhases: [
      {
        id: 'swarm',
        label: '蜂群',
        triggerHpRatio: 0.6,
        triggerRemainingSec: 16,
        minResidenceSec: 4.5,
        entryEscortBurst: 6,
        spawnIntervalMultiplier: 0.75,
        regularEnemyCapBonus: 4,
        escortBatchBonus: 2,
        escortMaxBonus: 6,
        escortRespawnMultiplier: 0.65,
        eliteSpeedMultiplier: 1.12,
      },
    ],
  },
}
节点配置

{
  id: 'round-2-battle-pierce-contagion',
  type: 'battle',
  phase: 'mid',
  title: '感染压制',
  description: '密集护卫群，考验印记传播战术',
  templateId: 'elite-contagion',
  difficultyScale: 1.23,
  selection: {
    baseWeight: 2.7,
    soloMultiplier: 1.08,
    repeatTypeMultiplier: 0.76,
    routeBonuses: {
      crit: 0.65,
      pierce: 1.92,  // Pierce路线高权重
      dash: 0.75,
    },
    battleCatchupBonus: 1.6,
  },
}
2.3 Dash路线检验关：「夹道压制」
模板ID: elite-gauntlet

设计目标: 测试Dash玩家的连续机动能力和动量维持

核心机制

高速+高弹幕环境：
1. Elite速度1.18x，高横移0.52，主动风筝玩家
2. 大量高速怪(skirmisher)和远程怪(ranged)
3. 频繁弹幕（1.1秒一波，3发齐射）

Dash玩家最优策略：
- 频繁Dash维持5层动量（+40%伤害）
- 利用幽灵打击（70%额外子弹）提升输出
- 在反击窗口（1.2秒）内集中火力
- 避免动量断层（2秒不Dash清空）
完整配置

'elite-gauntlet': {
  id: 'elite-gauntlet',
  name: '夹道压制',
  description: '精英会封锁区域并发射弹幕，必须频繁Dash穿梭才能生存',
  contentTier: 'rare',
  durationSec: 32,
  spawnIntervalSec: 0.9,
  enemyHp: 23,
  enemySpeed: 66,  // 高速敌人
  enemyDamage: 10,
  regularEnemyCap: 13,
  pressureMultiplier: 1.45,
  accent: 0x4aff9c,
  winCondition: { type: 'elite', target: 1 },
  spawnRule: {
    pattern: 'pincers',  // 侧翼夹击
    burstCount: 2,
  },
  regularArchetypes: {
    standard: 1.2,
    brute: 0.6,
    skirmisher: 3.5,  // 大量高速怪
    ranged: 1.8,  // 大量远程怪
  },
  escortArchetypes: {
    standard: 0.8,
    brute: 0.4,
    skirmisher: 2.8,
    ranged: 2.2,
  },
  eliteRule: {
    spawnAtSec: 2.5,
    hpMultiplier: 8.8,
    speedMultiplier: 1.18,  // 高速Elite
    damageMultiplier: 2.45,
    guardSec: 3.8,
    guardDamageMultiplier: 0.58,
    radius: 22,
    regularEnemyCap: 15,
    behavior: 'kiting',  // 风筝玩家
    preferredDistance: 180,
    strafeStrength: 0.52,  // 高横移
    escortBatch: 3,
    escortRespawnSec: 5.5,
    escortMax: 9,
    pressurePhases: [
      {
        id: 'lockdown',
        label: '封锁',
        signatureLabel: '弹幕封锁',
        signatureDurationSec: 3.5,
        signaturePulseIntervalSec: 1.1,  // 频繁弹幕
        signatureVolleyCount: 3,
        triggerHpRatio: 0.62,
        triggerRemainingSec: 15,
        minResidenceSec: 4.2,
        entryEscortBurst: 4,
        spawnIntervalMultiplier: 0.88,
        regularEnemyCapBonus: 3,
        escortBatchBonus: 2,
        escortMaxBonus: 3,
        rangedShotIntervalMultiplier: 1.25,
        rangedProjectileSpeedMultiplier: 1.15,
        eliteSpeedMultiplier: 1.22,
        strafeStrengthBonus: 0.15,
      },
    ],
  },
}
节点配置

{
  id: 'round-2-battle-dash-gauntlet',
  type: 'battle',
  phase: 'mid',
  title: '夹道压制',
  description: '高速弹幕封锁，考验连续机动能力',
  templateId: 'elite-gauntlet',
  difficultyScale: 1.24,
  selection: {
    baseWeight: 2.6,
    soloMultiplier: 1.06,
    repeatTypeMultiplier: 0.76,
    routeBonuses: {
      crit: 0.7,
      pierce: 0.8,
      dash: 1.88,  // Dash路线高权重
    },
    battleCatchupBonus: 1.55,
  },
}
三、Boss关设计（续）
3.1 Crit路线Boss：「处决首领」（续）

  eliteRule: {
    spawnAtSec: 2.0,
    hpMultiplier: 18.5,  // 极高血量
    speedMultiplier: 1.15,
    damageMultiplier: 2.65,
    guardSec: 6.5,  // 超长护盾期（狂暴状态）
    guardDamageMultiplier: 0.15,  // 狂暴时几乎免疫伤害
    radius: 28,
    regularEnemyCap: 11,
    behavior: 'frontline',
    preferredDistance: 120,
    strafeStrength: 0.42,
    escortBatch: 2,
    escortRespawnSec: 9.5,
    escortMax: 4,
    pressurePhases: [
      {
        id: 'berserk-cycle',
        label: '狂暴循环',
        signatureLabel: '狂暴冲锋',
        signatureDurationSec: 4.5,  // 4.5秒狂暴期
        signaturePulseIntervalSec: 1.5,
        signatureEscortBurst: 3,
        triggerHpRatio: 0.8,
        triggerRemainingSec: 28,
        minResidenceSec: 6.0,  // 狂暴-虚弱循环
        entryGuardSec: 4.5,  // 进入时狂暴
        entryGuardDamageMultiplier: 0.12,
        entryEscortBurst: 3,
        spawnIntervalMultiplier: 0.9,
        regularEnemyCapBonus: 3,
        escortRespawnMultiplier: 0.85,
        eliteSpeedMultiplier: 1.35,  // 狂暴时极快
        preferredDistanceDelta: -50,
      },
      {
        id: 'execution-window',
        label: '处决窗口',
        signatureLabel: '虚弱暴露',
        signatureDurationSec: 2.5,  // 2.5秒虚弱期
        triggerHpRatio: 0.35,
        triggerRemainingSec: 10,
        minResidenceSec: 5.5,
        entryGuardSec: 0,  // 无护盾
        entryGuardDamageMultiplier: 1.5,  // 虚弱期受到额外伤害
        entryEscortBurst: 5,
        regularEnemyCapBonus: 4,
        escortBatchBonus: 2,
        escortMaxBonus: 3,
        eliteSpeedMultiplier: 0.75,  // 虚弱时变慢
      },
    ],
  },
}
节点配置

{
  id: 'final-boss-executioner',
  type: 'boss',
  phase: 'finalBattle',
  title: '处决首领',
  description: '终局爆发战，把握虚弱窗口一击必杀',
  templateId: 'boss-executioner',
  difficultyScale: 1.42,
  selection: {
    baseWeight: 1,
    routeBonuses: {
      crit: 1.25,  // Crit路线高权重
    },
  },
}
3.2 Pierce路线Boss：「要塞首领」
模板ID: boss-fortress

设计目标: 终极穿透价值测试

核心机制

多层护卫墙机制：
1. Boss永远保持200+距离，躲在护卫后
2. 护卫形成3层横向墙（每层5个厚血怪）
3. 阶段1：召唤8个护卫形成双层墙
4. 阶段2：召唤10个护卫形成三层墙

Pierce玩家最优策略：
- 利用高穿透直接穿过护卫墙击中Boss
- 用印记传播清理密集护卫群
- 利用连锁累积（3层×1.4）快速清墙
- 失败惩罚：低穿透玩家必须逐个击杀15+护卫
完整配置

'boss-fortress': {
  id: 'boss-fortress',
  name: '要塞首领',
  description: 'Boss被多层护卫墙保护，必须穿透防线才能击中本体',
  encounterType: 'boss',
  durationSec: 40,
  spawnIntervalSec: 0.95,
  enemyHp: 28,
  enemySpeed: 54,
  enemyDamage: 11,
  regularEnemyCap: 11,
  pressureMultiplier: 1.55,
  accent: 0x3d9fff,
  winCondition: { type: 'elite', target: 1 },
  spawnRule: {
    pattern: 'lanes',
    burstCount: 2,
    laneBias: 'horizontal',  // 形成横向墙
  },
  regularArchetypes: {
    standard: 2.0,
    brute: 2.5,  // 大量厚血怪形成墙
    skirmisher: 0.8,
    ranged: 0.6,
  },
  escortArchetypes: {
    standard: 1.5,
    brute: 3.5,  // 护卫全是厚血怪
    skirmisher: 0.5,
    ranged: 0.8,
  },
  eliteRule: {
    spawnAtSec: 2.2,
    hpMultiplier: 17.8,
    speedMultiplier: 1.08,
    damageMultiplier: 2.58,
    guardSec: 5.2,
    guardDamageMultiplier: 0.42,
    radius: 29,
    regularEnemyCap: 13,
    behavior: 'screened',  // 永远躲在护卫后
    preferredDistance: 220,  // 极远距离
    strafeStrength: 0.48,
    escortBatch: 5,  // 大量护卫
    escortRespawnSec: 5.8,
    escortMax: 15,  // 极高护卫上限
    pressurePhases: [
      {
        id: 'wall-formation',
        label: '壁垒成型',
        signatureLabel: '护卫成墙',
        signatureDurationSec: 4.0,
        signaturePulseIntervalSec: 1.8,
        signatureEscortBurst: 6,  // 瞬间召唤6个护卫
        patternLabel: '横向壁垒',
        patternMode: 'laneCrush',
        patternEscortArchetype: 'brute',
        triggerHpRatio: 0.75,
        triggerRemainingSec: 26,
        minResidenceSec: 5.5,
        entryGuardSec: 3.0,
        entryGuardDamageMultiplier: 0.35,
        entryEscortBurst: 8,  // 进入时召唤8个护卫
        spawnIntervalMultiplier: 0.88,
        regularEnemyCapBonus: 4,
        escortBatchBonus: 3,
        escortMaxBonus: 8,
        escortRespawnMultiplier: 0.7,
      },
      {
        id: 'layered-defense',
        label: '多层防御',
        signatureLabel: '三重壁垒',
        signatureDurationSec: 3.5,
        signaturePulseIntervalSec: 1.5,
        signatureEscortBurst: 5,
        triggerHpRatio: 0.4,
        triggerRemainingSec: 12,
        minResidenceSec: 5.0,
        entryEscortBurst: 10,  // 召唤10个护卫形成三层墙
        regularEnemyCapBonus: 5,
        escortBatchBonus: 4,
        escortMaxBonus: 10,
        escortRespawnMultiplier: 0.65,
        eliteSpeedMultiplier: 1.15,
      },
    ],
  },
}
节点配置

{
  id: 'final-boss-fortress',
  type: 'boss',
  phase: 'finalBattle',
  title: '要塞首领',
  description: '终局穿透战，贯穿多层防线直击要害',
  templateId: 'boss-fortress',
  difficultyScale: 1.43,
  selection: {
    baseWeight: 1,
    routeBonuses: {
      pierce: 1.25,  // Pierce路线高权重
    },
  },
}
3.3 Dash路线Boss：「猎杀首领」
模板ID: boss-predator

设计目标: 终极机动性测试

核心机制

极速追击+密集弹幕：
1. Boss基础速度1.32x，狩猎模式1.42x，狂乱1.55x
2. 弹幕频率：0.85秒一波（狩猎），0.65秒一波（狂乱）
3. 安全窗口仅240像素，停留1.5秒
4. Boss主动追击，preferredDistance仅100

Dash玩家最优策略：
- 频繁Dash维持5层动量（+40%伤害）
- 利用幽灵打击（70%额外子弹）提升DPS
- 在反击窗口（1.2秒）内集中火力
- 利用Dash无敌帧穿过弹幕
- 失败惩罚：动量断层或被追上秒杀
完整配置

'boss-predator': {
  id: 'boss-predator',
  name: '猎杀首领',
  description: 'Boss会主动追击并发射密集弹幕，只有持续Dash才能生存',
  encounterType: 'boss',
  durationSec: 38,
  spawnIntervalSec: 0.88,
  enemyHp: 26,
  enemySpeed: 68,  // 极高速度
  enemyDamage: 11,
  regularEnemyCap: 14,
  pressureMultiplier: 1.58,
  accent: 0x3dff8a,
  winCondition: { type: 'elite', target: 1 },
  spawnRule: {
    pattern: 'pincers',
    burstCount: 2,
  },
  regularArchetypes: {
    standard: 1.0,
    brute: 0.5,
    skirmisher: 4.0,  // 极高速怪
    ranged: 2.5,
  },
  escortArchetypes: {
    standard: 0.6,
    brute: 0.3,
    skirmisher: 3.5,
    ranged: 3.0,
  },
  eliteRule: {
    spawnAtSec: 1.8,
    hpMultiplier: 17.2,
    speedMultiplier: 1.32,  // 极高速Boss
    damageMultiplier: 2.62,
    guardSec: 4.5,
    guardDamageMultiplier: 0.45,
    radius: 27,
    regularEnemyCap: 16,
    behavior: 'frontline',  // 主动追击
    preferredDistance: 100,  // 极近距离
    strafeStrength: 0.62,  // 极高横移
    escortBatch: 3,
    escortRespawnSec: 6.5,
    escortMax: 10,
    pressurePhases: [
      {
        id: 'hunt-mode',
        label: '狩猎模式',
        signatureLabel: '追击弹幕',
        signatureDurationSec: 3.8,
        signaturePulseIntervalSec: 0.85,  // 极快弹幕
        signatureVolleyCount: 4,
        patternLabel: '交叉追击',
        patternMode: 'crossfireWave',
        patternPulseIntervalSec: 1.2,
        patternVolleyCount: 3,
        patternVolleySpreadRad: 0.22,
        patternVolleyShotsPerShooter: 2,
        patternSafeWindowSize: 240,  // 较小安全窗
        patternSafeWindowLingerSec: 1.5,  // 短暂停留
        patternPocketShiftModes: ['sweep', 'edgeBounce'],
        triggerHpRatio: 0.78,
        triggerRemainingSec: 25,
        minResidenceSec: 5.2,
        entryGuardSec: 2.5,
        entryGuardDamageMultiplier: 0.38,
        entryEscortBurst: 4,
        spawnIntervalMultiplier: 0.82,
        regularEnemyCapBonus: 4,
        escortBatchBonus: 2,
        escortMaxBonus: 4,
        rangedShotIntervalMultiplier: 1.35,
        rangedProjectileSpeedMultiplier: 1.25,
        eliteSpeedMultiplier: 1.42,  // 狩猎模式速度暴增
        preferredDistanceDelta: -30,
        strafeStrengthBonus: 0.22,
      },
      {
        id: 'frenzy',
        label: '狂乱',
        signatureLabel: '弹幕风暴',
        signatureDurationSec: 3.2,
        signaturePulseIntervalSec: 0.65,  // 疯狂弹幕
        signatureVolleyCount: 5,
        triggerHpRatio: 0.38,
        triggerRemainingSec: 11,
        minResidenceSec: 4.8,
        entryEscortBurst: 6,
        spawnIntervalMultiplier: 0.78,
        regularEnemyCapBonus: 5,
        escortBatchBonus: 3,
        escortMaxBonus: 5,
        rangedShotIntervalMultiplier: 1.45,
        rangedProjectileSpeedMultiplier: 1.35,
        eliteSpeedMultiplier: 1.55,  // 狂乱速度极限
        strafeStrengthBonus: 0.28,
      },
    ],
  },
}
节点配置

{
  id: 'final-boss-predator',
  type: 'boss',
  phase: 'finalBattle',
  title: '猎杀首领',
  description: '终局机动战，极限走位反守为攻',
  templateId: 'boss-predator',
  difficultyScale: 1.44,
  selection: {
    baseWeight: 1,
    routeBonuses: {
      dash: 1.25,  // Dash路线高权重
    },
  },
}
四、实现步骤
步骤1：添加战斗模板
在 src/data/battleTemplates.ts 中添加6个新模板：


export const BATTLE_TEMPLATES: Record<BattleTemplateId, BattleTemplateDefinition> = {
  // ... 现有模板 ...
  
  // 新增精英关
  'elite-pressure-hold': { /* 上面的完整配置 */ },
  'elite-contagion': { /* 上面的完整配置 */ },
  'elite-gauntlet': { /* 上面的完整配置 */ },
  
  // 新增Boss关
  'boss-executioner': { /* 上面的完整配置 */ },
  'boss-fortress': { /* 上面的完整配置 */ },
  'boss-predator': { /* 上面的完整配置 */ },
};
步骤2：更新类型定义
在 src/game/types.ts 中添加新的模板ID：


export type BattleTemplateId =
  | 'elimination'
  // ... 现有ID ...
  | 'elite-pressure-hold'
  | 'elite-contagion'
  | 'elite-gauntlet'
  | 'boss-executioner'
  | 'boss-fortress'
  | 'boss-predator';
步骤3：添加节点蓝图
在 src/data/nodes.ts 的 ROUND_NODE_OFFERS 中添加：

Round 2（中段精英关）：


2: {
  phase: 'mid',
  countWeights: [/* 保持不变 */],
  blueprints: [
    // ... 现有蓝图 ...
    
    // 新增Crit检验关
    {
      id: 'round-2-battle-crit-pressure',
      type: 'battle',
      phase: 'mid',
      title: '蓄势压制',
      description: '周期性护盾窗口，考验爆发时机把控',
      templateId: 'elite-pressure-hold',
      difficultyScale: 1.22,
      selection: {
        baseWeight: 2.8,
        soloMultiplier: 1.05,
        repeatTypeMultiplier: 0.76,
        routeBonuses: {
          crit: 1.85,
          pierce: 0.6,
          dash: 0.7,
        },
        battleCatchupBonus: 1.5,
      },
    },
    
    // 新增Pierce检验关
    {
      id: 'round-2-battle-pierce-contagion',
      type: 'battle',
      phase: 'mid',
      title: '感染压制',
      description: '密集护卫群，考验印记传播战术',
      templateId: 'elite-contagion',
      difficultyScale: 1.23,
      selection: {
        baseWeight: 2.7,
        soloMultiplier: 1.08,
        repeatTypeMultiplier: 0.76,
        routeBonuses: {
          crit: 0.65,
          pierce: 1.92,
          dash: 0.75,
        },
        battleCatchupBonus: 1.6,
      },
    },
    
    // 新增Dash检验关
    {
      id: 'round-2-battle-dash-gauntlet',
      type: 'battle',
      phase: 'mid',
      title: '夹道压制',
      description: '高速弹幕封锁，考验连续机动能力',
      templateId: 'elite-gauntlet',
      difficultyScale: 1.24,
      selection: {
        baseWeight: 2.6,
        soloMultiplier: 1.06,
        repeatTypeMultiplier: 0.76,
        routeBonuses: {
          crit: 0.7,
          pierce: 0.8,
          dash: 1.88,
        },
        battleCatchupBonus: 1.55,
      },
    },
  ],
},
Round 5（最终Boss关）：


5: {
  phase: 'finalBattle',
  countWeights: [{ count: 1, weight: 1 }],
  blueprints: [
    // 保留现有3个Boss
    // ... 现有蓝图 ...
    
    // 新增Crit Boss
    {
      id: 'final-boss-executioner',
      type: 'boss',
      phase: 'finalBattle',
      title: '处决首领',
      description: '终局爆发战，把握虚弱窗口一击必杀',
      templateId: 'boss-executioner',
      difficultyScale: 1.42,
      selection: {
        baseWeight: 1,
        routeBonuses: {
          crit: 1.25,
        },
      },
    },
    
    // 新增Pierce Boss
    {
      id: 'final-boss-fortress',
      type: 'boss',
      phase: 'finalBattle',
      title: '要塞首领',
      description: '终局穿透战，贯穿多层防线直击要害',
      templateId: 'boss-fortress',
      difficultyScale: 1.43,
      selection: {
        baseWeight: 1,
        routeBonuses: {
          pierce: 1.25,
        },
      },
    },
    
    // 新增Dash Boss
    {
      id: 'final-boss-predator',
      type: 'boss',
      phase: 'finalBattle',
      title: '猎杀首领',
      description: '终局机动战，极限走位反守为攻',
      templateId: 'boss-predator',
      difficultyScale: 1.44,
      selection: {
        baseWeight: 1,
        routeBonuses: {
          dash: 1.25,
        },
      },
    },
  ],
},
五、设计验证表
流派	精英关	核心测试	Boss关	核心测试
Crit	蓄势压制	破绽累积→终结打击时机选择	处决首领	狂暴-虚弱窗口爆发循环
Pierce	感染压制	印记传播→击杀顺序战术	要塞首领	穿透墙体→连锁清场
Dash	夹道压制	动量维持→连续机动能力	猎杀首领	极限走位→反击窗口利用
六、平衡性考量
数值对比
指标	Crit关卡	Pierce关卡	Dash关卡
Elite血量	10.5x / 18.5x	9.2x / 17.8x	8.8x / 17.2x
敌人密度	低（8-9）	极高（14-16）	高（13-16）
移动速度	低（0.95x）	中（1.0x）	极高（1.18x-1.55x）
弹幕频率	无	无	极高（0.65-1.1秒）
护卫数量	中（6）	极高（12-15）	中（9-10）
设计平衡原则
Crit关卡：高血量+低密度，奖励精准爆发
Pierce关卡：高密度+横向排列，奖励穿透和AOE
Dash关卡：高速度+高弹幕，奖励机动性
七、测试要点
功能测试
 6个新模板能正常加载
 节点选择权重正确（路线匹配时高权重）
 Elite行为正确（frontline/screened/kiting）
 压力阶段转换正常
 护盾循环机制正常
平衡性测试
 Crit玩家在蓄势压制关有明显优势
 Pierce玩家在感染压制关有明显优势
 Dash玩家在夹道压制关有明显优势
 非对应路线玩家能通关但更困难
 Boss战时长控制在35-45秒
体验测试
 Crit玩家能感受到"蓄力-爆发"节奏
 Pierce玩家能看到印记传播效果
 Dash玩家能维持动量循环
 失败时能明确知道原因（动量断层/错过窗口等）
八、后续优化方向
视觉反馈增强

狂暴期Boss红光特效
虚弱期Boss蓝光特效
印记传播连锁动画
动量层数更明显的UI
音效设计

狂暴期低沉轰鸣
虚弱期高音提示
印记传播爆炸音
动量满层加速音
难度分级

简单模式：窗口期延长20%
困难模式：窗口期缩短30%
地狱模式：Boss血量+50%