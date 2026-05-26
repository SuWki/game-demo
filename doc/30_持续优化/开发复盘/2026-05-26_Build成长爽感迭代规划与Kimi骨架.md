# 2026-05-26 Build成长爽感迭代规划与Kimi骨架

## 本轮背景

用户提供了两份外部优化提示词，核心诉求是把当前自动射击 Roguelike 从“短流程 Demo”推进到“路线成长更明显、Build 更早成型、中后期更爽”的版本。

这两份提示词方向有价值，但不能原样执行：

- `12~20节点流程` 属于后续大版本方向，会牵涉节点类型、地图节奏、数值曲线、Boss投放和QA样本全部重做。
- 当前项目定位仍是求职可展示 Demo，主流程、文案清理、路线读局和Boss/精英出题刚完成一轮收口，不适合立刻扩大到长线肉鸽。
- 当前代码已有 `battle / upgrade / anomaly / boss` 四类节点、`opening / mid / late / finalPrep / finalBattle` 五段结构，以及路线牌 `starter / bridge / payoff / finisher` 标签。
- 当前规则仍保留“一次升级面板最多出现一张路线牌”，交叉联动应通过卡牌效果和异常效果实现，而不是同一面板塞多张路线牌。

## 本轮推荐方向

本轮不直接做 12~20 节点大改，而是先做：

> 5关结构内的 Build 爽感提前与关键联动补强。

目标体验：

- 第1关：玩家看到某条路线的入口，不要求成型。
- 第2关：路线开始有明显承接，不再只是数值变强。
- 第3关：出现一次可感知的清场、连锁、爆点或脉冲爽点。
- 第4关：Build进入强势状态，但仍需要通过精英/生存/Boss安全区读局。
- 第5关：最终Boss成为路线释放场，而不是单纯血量检查。

## 本轮明确不做

- 不新增 `shop / gamble / curse / transform` 新 NodeType。
- 不把当前5关立即扩成12~20节点。
- 不恢复玩家周围常驻路线线条、环形仪表或大字提示。
- 不允许1到2张路线牌直接杀穿精英/Boss。
- 不取消“一次升级最多一张路线牌”的当前规则。
- 不重写 `RunEngine`、不重开主流程。

## 本轮可以做

### 1. 通过现有异常节点承载高风险高收益

先把“赌博/诅咒/转型”压进现有 `anomaly` 体系，作为异常子类型或事件标签，而不是新增节点类型。

示例方向：

- `玻璃火力`：生命上限降低，暴击爆点范围提高。
- `重炮模式`：移速降低，穿透裂纹扩散伤害提高。
- `断回血协议`：无法自然回血，击杀时触发一次小范围脉冲。
- `路线转接`：把当前主路线的一部分进度转为另一条路线的桥接收益。

### 2. 提前 bridge / payoff 的可见时机

不是无脑提高路线牌概率，而是调整内容分层：

- opening：仍以 starter 和少量 bridge 为主。
- mid：允许 bridge 稳定出现，并少量提前 payoff。
- late：payoff 和 finisher 开始成为主要爽点。
- finalPrep：补齐已经选择路线的关键缺口，不再发大量泛用数值。

### 3. 保持“最多一张路线牌”，但允许路线牌内部做交叉联动

交叉 Build 不通过同面板多路线牌实现，而通过标签实现：

- `crit_pierce`：暴击爆点会给敌人附加裂纹。
- `pierce_crit`：贯穿裂纹目标时，下一发更容易暴击。
- `dash_crit`：脉冲命中后，短时间内暴击爆点更明显。
- `dash_pierce`：脉冲命中的敌人被穿透时触发额外裂纹扩散。

### 4. 削弱泛用强化的存在感，但不要让它失去价值

泛用强化应负责：

- 补生存。
- 补基础输出。
- 补容错。

路线强化应负责：

- 改变触发条件。
- 改变命中反馈。
- 改变清场方式。
- 提供中后期爽点。

### 5. 敌人压力从“血厚”改成“数量、包围、站位题”

本轮优先小调：

- 降低部分精英血量倍率或护卫血量倍率，避免刮痧。
- 提高普通战和中后期战斗的刷怪压力。
- 保留Boss安全区和护卫出题，不让Boss贴脸堵路。
- 自动攻击在Boss战中继续优先Boss本体，避免被小怪拖死。

## Kimi开发伪代码骨架

### A. 成长阶段权重

```ts
function getBuildStageContext(state): BuildStageContext {
  const routeCount = max(state.routeCounts);
  const phase = state.phase;

  return {
    isOpening: phase === 'opening',
    isMid: phase === 'mid',
    isLate: phase === 'late' || phase === 'finalPrep',
    routeCount,
    dominantRoute: getDominantRoute(),
    allowBridge: phase !== 'opening' || routeCount >= 1,
    allowEarlyPayoff: phase === 'mid' && routeCount >= 2,
    allowFinisher: (phase === 'late' || phase === 'finalPrep') && routeCount >= 4,
  };
}
```

### B. 路线牌池分层

```ts
function buildRoutePoolByStage(pool, ctx) {
  if (!ctx.dominantRoute) {
    return onlyTags(pool, ['starter', 'bridge']);
  }

  if (ctx.isOpening) {
    return weightedMerge([
      [onlyTags(pool, ['starter']), 1.2],
      [onlyTags(pool, ['bridge']), 0.35],
      [onlyTags(pool, ['payoff', 'finisher']), 0],
    ]);
  }

  if (ctx.isMid) {
    return weightedMerge([
      [onlyTags(pool, ['starter']), 0.35],
      [onlyTags(pool, ['bridge']), 1.25],
      [onlyTags(pool, ['payoff']), ctx.allowEarlyPayoff ? 0.55 : 0.15],
      [onlyTags(pool, ['finisher']), 0],
    ]);
  }

  return weightedMerge([
    [onlyTags(pool, ['bridge']), 0.65],
    [onlyTags(pool, ['payoff']), 1.2],
    [onlyTags(pool, ['finisher']), ctx.allowFinisher ? 0.85 : 0.25],
  ]);
}
```

### C. 同面板规则

```ts
function sanitizeUpgradeChoices(choices) {
  choices = removeDuplicatePrimaryStat(choices);
  choices = limitRouteCards(choices, 1);
  choices = avoidSameRouteSameStageDuplicate(choices);
  return choices;
}
```

### D. 交叉联动标签

```ts
type RouteSynergyTag =
  | 'crit_pierce'
  | 'pierce_crit'
  | 'dash_crit'
  | 'dash_pierce';

function activateRoutePerkFromTags(upgrade) {
  for (const tag of upgrade.tags ?? []) {
    if (isRouteSynergyTag(tag)) {
      state.activeRoutePerks[tag] = true;
    }
  }
}
```

### E. 战斗结算接线

```ts
function onCritExplosion(enemy, battle) {
  if (state.activeRoutePerks.crit_pierce) {
    applyPierceCrack(enemy, { stacks: 1, duration: 1.2 });
  }
}

function onPierceCrackSpread(enemy, battle) {
  if (state.activeRoutePerks.pierce_crit) {
    battle.nextCritChanceBonusSec = 1.5;
  }
}

function onDashPulseHit(enemy, battle) {
  if (state.activeRoutePerks.dash_pierce) {
    applyPierceCrack(enemy, { stacks: 1, duration: 1.0 });
  }
  if (state.activeRoutePerks.dash_crit) {
    enemy.critMarkStacks += 1;
  }
}
```

### F. 异常节点风险收益模板

```ts
const anomalyTemplates = [
  {
    id: 'glass-crit',
    tags: ['anomaly', 'crit', 'highRisk'],
    cost: { maxHpMultiplier: 0.7 },
    reward: { activePerk: 'crit_pierce', critExplosionRadiusBonus: 24 },
    text: '生命上限降低，但暴击爆点会留下裂纹。',
  },
  {
    id: 'heavy-pierce',
    tags: ['anomaly', 'pierce', 'highRisk'],
    cost: { moveSpeedMultiplier: 0.85 },
    reward: { pierceCrackDamageBonus: 4, pierceSpreadRadiusBonus: 20 },
    text: '移动变慢，但贯穿后的裂纹扩散更强。',
  },
  {
    id: 'no-heal-pulse',
    tags: ['anomaly', 'dash', 'highRisk'],
    cost: { disableRegen: true },
    reward: { activePerk: 'dash_crit', dashPulseDamageBonus: 4 },
    text: '不再自动回血，但脉冲命中会帮你叠破绽。',
  },
];
```

## 验收标准

Kimi完成后必须汇报：

1. 用户原始问题和本轮解决方案。
2. 是否保留“一次升级最多一张路线牌”。
3. 第2关是否更容易出现 bridge。
4. 第3关是否能开始出现 payoff 爽点。
5. 泛用强化是否仍有选择价值。
6. 异常节点是否不再只是普通属性强化。
7. 三路线是否仍不会1到2张牌杀穿精英/Boss。
8. 是否没有恢复玩家周围常驻路线线条。
9. `npm run build` 结果。
10. `node tools/audit-route-upgrade-value.mjs` 结果。
11. 至少一次 full-flow QA 结果。

## 给Kimi的执行重点

- 优先改 `src/data/contentSelectors.ts`、`src/data/upgrades.ts`、`src/data/events.ts`、`src/systems/RunEngine.ts`、`src/data/balance.ts`。
- 如非必要，不改 `GameScene.ts`，避免重新引入表现层噪音。
- 如果新增标签或状态，必须同步 `src/game/types.ts`。
- 如果修改路线强度，必须跑路线价值审计。
- 如果修改异常节点，必须确认文案是玩家语言，不出现“构筑、承接、payoff、触发器、机制开发中”等内部词。

