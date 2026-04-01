# 数值与成长公式说明

## 当前口径说明
本文件是当前重建版的数值源头文档，用来约束：
- 角色基础属性
- 战斗内经验与升级
- 敌人血量 / 速度 / 出现频率
- 升级品质权重
- 三条路线的关键动态公式

如果后续文档与本文件冲突，以本文件和最新 `DEV_ISSUE_LOG.md` 为准。

## 结构取舍
- 仍然保留当前阶段文档要求的三类节点：`battle / upgrade / event`
- 不改成完整多层大地图系统
- 地图表达只做轻量分支路线选择
- 精英仍然作为 battle 模板的一部分，而不是新增第四种节点

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

## 五、节点与升级取舍
### battle
- 主要提供：敌人掉经验、战斗完成经验、风险换成长

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
- 当前是“公式化第一版”，不是最终商业化平衡版
