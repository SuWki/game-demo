# 数值与成长公式说明

> 若涉及强化唯一性、特殊强化最低品质、生存关最后 `10s` 压力增长或基础敌人族群公式，请同时参考 [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 并补齐对应约束。

## 当前口径说明
本文件是当前重建版的数值源头文档，用来约束：
- 角色基础属性
- 战斗内经验与升级
- 敌人血量 / 速度 / 出现频率
- 升级品质权重
- 三条路线的关键动态公式

如果后续文档与本文件冲突，以本文件和最新 `DEV_ISSUE_LOG.md` 为准。

## 结构取舍
- 当前节点口径已经切到：`boss / battle / upgrade / anomaly`
- 不改成完整多层大地图系统
- 地图表达只做轻量分支路线选择
- boss / anomaly 虽然有独立语义，但当前仍分别复用 battle / event 主流程，不额外扩新系统

## 一、角色基础属性
### 初始值
- `maxHp = 110`
- `hp = 110`
- `damage = 18`
- `fireRate = 2.2`
- `projectileSpeed = 360`
- `critChance = 0.06`
- `critMultiplier = 1.65`
- `pierce = 0`
- `multishot = 1`
- `moveSpeed = 248`
- `dashInterval = 5.4`
- `dashPulseDamage = 0`
- `dashInvulnerability = 0.24`
- `regeneration = 0`

### 基础运行公式
- 玩家移动速度：`playerMoveSpeed = moveSpeed`
- 拾取半径：`pickupRadius = 28 + moveSpeed * 0.04`
- 吸附半径：`magnetRadius = 120 + moveSpeed * 0.12`
- 子弹速度：`projectileSpeedFinal = projectileSpeed`
- 生命修正：`hp = clamp(hp + healOrMaxHpDelta, 0, maxHp)`

## 二、经验与升级
### 经验需求
- 下一次升级所需经验：
- `expToNext(level) = round(18 + level * 8 + level^2 * 3)`

### 敌人掉落经验
- 普通敌经验：
- `enemyExp = round(4 + battleIndex * 2 + phaseTier * 2 + templateBaseHp * 0.08)`
- 精英敌经验：
- `eliteExp = round(enemyExp * 4.5)`

### 战斗完成奖励经验
- `battleClearExp = round(templateBaseClear + battleIndex * 4 + phaseTier * 3)`
- `templateBaseClear`：
- 歼灭：`16`
- 生存压制：`20`
- 精英压制：`24`

### 升级流程
- 敌人死亡后掉经验球
- 经验球被玩家靠近拾取或进入吸附范围后回收
- 当 `experience >= experienceToNext` 时：
- `level += 1`
- `experience -= experienceToNext`
- `experienceToNext = expToNext(level)`
- 进入一次三选一升级面板

## 三、敌人数值公式
### 阶段 tier
- `opening = 0`
- `mid = 1`
- `late = 2`
- `finalPrep = 3`
- `finalBattle = 4`

### 战斗序号
- `battleIndex = max(1, round + 1)`

### 普通敌血量
- `enemyHp = round(template.enemyHp * (1 + (battleIndex - 1) * 0.2 + phaseTier * 0.12) * difficultyScale)`

### 精英血量
- `eliteHp = round(enemyHpBase * eliteHpMultiplier)`

### 普通敌速度
- `enemySpeed = round(template.enemySpeed * (1 + (battleIndex - 1) * 0.06 + phaseTier * 0.03) * difficultyScale)`

### 精英速度
- `eliteSpeed = round(enemySpeedBase * eliteSpeedMultiplier)`

### 敌人出现间隔
- `spawnInterval = clamp(template.spawnIntervalSec / depthFactor / pressureFactor, template.spawnIntervalSec * 0.38, template.spawnIntervalSec)`
- `depthFactor = 1 + (battleIndex - 1) * 0.08 + phaseTier * 0.05`
- `pressureFactor = 1 + min(elapsedSec, 30) * 0.015`

### 敌人出现频率
- `spawnFrequency = 1 / spawnInterval`

## 四、升级品质
### 品质级别
- 白：`common`
- 绿：`uncommon`
- 蓝：`rare`
- 紫：`epic`
- 金：`legendary`

### 品质倍率
- 白：`1.00`
- 绿：`1.20`
- 蓝：`1.45`
- 紫：`1.75`
- 金：`2.15`

### 品质权重
- `depthScore = (round - 1) * 1.15 + phaseTier * 0.9 + max(0, level - 1) * 0.18 + nodePrepBonus`
- `nodePrepBonus = 1.1`，仅 upgrade 节点生效
- `commonWeight = max(12, 78 - depthScore * 12)`
- `uncommonWeight = 18 + depthScore * 6`
- `rareWeight = max(3, 4 + depthScore * 5)`
- `epicWeight = max(0, depthScore > 1 ? 1 + (depthScore - 1) * 3 : 0)`
- `legendaryWeight = max(0, depthScore > 2 ? (depthScore - 2) * 2.2 : 0)`

### 品质生效方式
- 任意升级项的数值效果都按：
- `rolledValue = baseValue * rarityMultiplier`
- 再按属性类型做整数或两位小数取整

### 2026-04-05 审计后新增约束
- `routeSpecialEligible(rarity) = rarity >= uncommon`
- 当前实现口径：
  - 任何 `category = route` 的强化在最终发牌时，若品质掷骰落到 `common`，会被上抬到 `uncommon`
  - 这条约束用于保证三流派特殊强化从绿开始出现
- `upgradeOfferAllowed(sourceId) = sourceId not in pickedUpgradeIds`
- 当前实现口径：
  - 三选一候选生成时会直接排除本局已经拿过的 `sourceId`
  - 运行态结算时也只会把同一个 `sourceId` 记录一次
  - 旧的 `repeatable` 元数据目前仅作为历史兼容字段保留，不再驱动重复发放

## 五、节点与升级取舍
### battle
- 主要提供：敌人掉经验、战斗完成经验、风险换成长

## 2026-04-05 Boss / Elite 阶段压力补充
本轮新增的 `pressurePhases` 只服务 elite / boss 模板，不改主流程。

### 触发规则
- 当前阶段切换满足以下任一条件即可触发：
- `hpRatio <= triggerHpRatio`
- `remainingSec <= triggerRemainingSec`
- 阶段一旦切换，只向后推进，不回退。

### 阶段压力修正
- `spawnIntervalPhase = max(0.18, baseSpawnInterval * pressurePhase.spawnIntervalMultiplier)`
- `regularEnemyCapPhase = baseRegularEnemyCap + pressurePhase.regularEnemyCapBonus`
- `escortBatchPhase = baseEscortBatch + pressurePhase.escortBatchBonus`
- `escortMaxPhase = baseEscortMax + pressurePhase.escortMaxBonus`
- `escortRespawnPhase = max(0.75, baseEscortRespawnSec * pressurePhase.escortRespawnMultiplier)`
- `eliteMoveSpeedPhase = eliteBaseSpeed * pressurePhase.eliteSpeedMultiplier`
- `preferredDistancePhase = basePreferredDistance + pressurePhase.preferredDistanceDelta`
- `rangedShotIntervalPhase = max(0.65, baseRangedShotInterval * pressurePhase.rangedShotIntervalMultiplier)`
- `rangedProjectileSpeedPhase = baseRangedProjectileSpeed * pressurePhase.rangedProjectileSpeedMultiplier`

### 当前作用边界
- 这套阶段修正只改变已有模板里的压力节奏，不引入新的 Boss 系统层。
- 当前主要用于：
  - Boss 中后段护卫 / 刷怪 / 远程火线收紧
  - elite 中后段的轻量压进与封火
  - HUD 阶段读数同步

### upgrade
- 仍然保留为节点类型
- 但不再等同于“唯一升级来源”
- 其作用是给一次更偏高品质的整备三选一

### event
- 用于提供方向偏转、回复或补值

## 六、三路线动态公式
### 暴击
- 暴击触发后的过载延长：
- `critOverdriveGain = 0.45 / 0.55 / 0.70`
- 分别对应：未站稳 / 已站稳 / 已成型
- 有过载时射速：
- `effectiveFireRate = fireRate + 0.4 + critRouteCount * 0.12 (+ dashDriveBonus)`
- 有过载时暴击率：
- `effectiveCritChance = clamp(critChance + 0.08 + commitBonus + matureBonus, 0, 0.95)`
- 已成型时暴击溅射：
- `critSplashRatio = 0.45`

### 穿透
- 回响分裂数量：
- `echoCount = 1 + (multishot > 1 ? 1 : 0) + (matured ? 1 : 0)`
- 回响伤害倍率：
- `echoDamageRatio = committedOrMatured ? 0.72 : 0.58`
- 击破回冷：
- `cooldownRefund = committedOrMatured ? 0.06 : 0`

### 穿梭
- 擦身判定外圈：
- `grazeOuterRadius = 64 + moveSpeed * 0.03 + stageBonus`
- `stageBonus = 0 / 8 / 14`
- 分别对应：未站稳 / 已站稳 / 已成型
- 脉冲半径：
- `dashPulseRadius = 78 + moveSpeed * 0.04 + dashCharge * stageBonus`
- `stageBonus = 4 / 6 / 10`
- 脉冲伤害：
- `dashPulseDamage = baseDashPulseDamage + dashCharge * stageBonus`
- `stageBonus = 2 / 4 / 8`
- 脉冲回复：
- `dashPulseHeal = dashCharge * 1.1` 或 `dashCharge * 2.2`
- 穿梭减伤：
- `dashDamageMultiplier = 1 / 0.72 / 0.55`

## 七、当前仍是近似实现的部分
- 具体内容量仍偏少，数值主要服务于当前短局验证
- 权重公式已经可持续扩展，但不是旧版本成熟平衡值
- 敌人类型仍偏少，模板差异主要由参数与节奏承担
- 生存关当前只有持续压力增长公式，尚未补齐“最后 `10s` 显式增压”的独立规则
- 当前是“公式化第一版”，不是最终商业化平衡版
## 2026-04-05 Enemy Archetype Layer
基础敌人当前在模板/阶段基础数值之上，再叠加 archetype 乘区：

- `hp = round(baseHp * archetype.hpMultiplier)`
- `speed = round(baseSpeed * archetype.speedMultiplier)`
- `contactDamage = round(baseDamage * archetype.contactDamageMultiplier)`
- `radius = round(baseRadius * archetype.radiusMultiplier)`
- `xp = round(baseXp * archetype.experienceMultiplier)`

当前四类基础敌人乘区语义：

- `standard`：基准追压，不额外偏移。
- `brute`：高血量、大体型、低移速。
- `skirmisher`：低血量、高移速，并附带横向拉扯。
- `ranged`：中低接触伤害、保距移动、周期性发射敌方弹道。

远程怪当前的最小弹道规则：

- `projectileDamage = round(contactDamage * projectileDamageMultiplier)`
- `projectileSpeed = archetype.projectileSpeed`
- `projectileLifeSec = 3.2`
- `preferredDistance = archetype.preferredDistance`
- 当玩家距离低于保距阈值时后撤，高于阈值时补位，间隔 `shotIntervalSec` 发射一次投射物。

## 2026-04-05 普通升级发牌补充
普通升级三选一当前与节点整备三选一分开处理：

- `levelUpDeal = genericSlotA + genericSlotB + flexSlot`
- `routeOfferCount(levelUp) <= 1`

其中：

- `genericSlotA`：
  - 优先从 `generic stabilizer / bridge` 主池抽取
- `genericSlotB`：
  - 优先从放大的通用副池抽取
- `flexSlot`：
  - `flexWeight = genericSecondaryPool * 1.22 + routeWindowPool * 0.62`

route window 当前的约束是：

- 无 dominant route 时：
  - `routeWindowWeightScale = 0.52`
  - 仅允许路线 starter 低频露出
- 已有 dominant 但未 committed / matured 时：
  - `routeWindowWeightScale = 0.58`
  - 允许 `starter / bridge`
- 已 committed 或 matured 时：
  - `routeWindowWeightScale = 0.72`
  - 允许 `starter / bridge / payoff`
  - 仍排除 `redirect / finisher`

这条规则的目标是：

- 普通升级里保留路线信号
- 但不再允许路线 buff 占满整组牌
- 让一般属性强化继续成为普通升级池主干

## 2026-04-05 Elite / Boss 抗 burst 补充
本轮对 elite / boss 的强度修正采用“模板参数 + 最小机制”组合，而不是单纯堆血。

新增最小抗 burst 规则：

- `guardedDamage = rawDamage * guardDamageMultiplier`，当 `guardSec > 0`
- `guardSec = max(0, guardSec - dt)`

含义：

- elite / boss 入场后的短时间内会进入 guard 窗口
- guard 窗口内玩家子弹伤害按模板的 `guardDamageMultiplier` 缩放
- guard 结束后恢复正常受伤

当前 guard 主要由 battle template 的 `eliteRule` 提供：

- elite 系模板大致范围：
  - `guardSec ≈ 4.6 ~ 5.2`
  - `guardDamageMultiplier ≈ 0.42 ~ 0.48`
- boss 系模板大致范围：
  - `guardSec ≈ 6.2 ~ 6.8`
  - `guardDamageMultiplier ≈ 0.32 ~ 0.34`

这条规则与本轮同步上调的：

- `enemyHp`
- `enemyDamage`
- `pressureMultiplier`
- `regularEnemyCap`
- `eliteRule.hpMultiplier`

共同构成当前的 Boss / elite 压力修正口径。
