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

## 2026-04-06 Boss 阶段切换稳定化补充
本轮补的是“阶段切换抗 burst”，不是继续堆血。

### 阶段推进约束
- 当前阶段推进改为逐段检查：
  - `nextPressurePhase = currentPressurePhase + 1`
  - 每次更新最多只允许推进到下一段，不再同一轮连跳多个 phase
- 当前阶段若带最小驻留时间：
  - `phaseAdvanceAllowed = pressurePhaseElapsedSec >= minResidenceSec`
  - 未满足时，即使后续阈值也已满足，也继续停留在当前阶段

### 阶段触发后的短时承接
- 若 phase 定义了过渡 guard：
  - `phaseGuardSec = max(currentGuardSec, entryGuardSec)`
  - `phaseGuardedDamage = rawDamage * entryGuardDamageMultiplier`，当 `guardSec > 0`
- guard 结束后，elite / boss 会回到模板基础 guard 倍率，不额外保留新的常驻减伤。

### 阶段触发后的即时压力兑现
- 若 phase 定义了 `entryEscortBurst`：
  - `phaseEscortBurst = min(entryEscortBurst, escortMax - currentEscortCount)`
  - 切段当下立即补入这批护卫，而不是只等待下一次 respawn 节奏自然到达
- 这条规则的用途是让“转段”更快落到玩家可见战场，而不是只在后台等待参数慢慢生效。

### 轻量读数强化
- `pressureTransitionSec = 1.15`
- 在 `pressureTransitionSec > 0` 的窗口内：
  - HUD 子读数使用 `转段 {label}` 口径
  - 主核显示短时脉冲圈

### 当前取舍
- 这轮没有继续上调 Boss 基础血量来硬拖时长。
- 这轮的公式组合是：
  - `minResidenceSec` 保证阶段存在感
  - `entryGuardSec / entryGuardDamageMultiplier` 提供短时抗 burst 承接
  - `entryEscortBurst` 提供切段即时压力兑现
- 目标是让 Boss 的阶段体验成立，而不是把最终关做成纯海绵或重锁血。

## 2026-04-06 Boss 阶段行为解析补充
本轮新增的是“行为身份解析”，不是新的血量乘区。

### 行为解析规则
- `activeEliteBehavior = pressurePhase.behaviorOverride ?? eliteRule.behavior ?? 'frontline'`
- 当前规则只影响主核的移动 / 站位 / 护卫借位方式，不额外改写：
  - `eliteHp`
  - `eliteDamage`
  - `spawnInterval`
- 也就是说，本轮不是继续堆数值，而是把已有 `pressurePhases` 的行为身份落到运行层。

### 当前 Boss 模板签名
- `boss-hunt`
  - `接敌 -> frontline`
  - `逼近 -> screened`
  - `收束 -> frontline`
- `boss-lockdown`
  - `接敌 -> kiting`
  - `封位 -> screened`
  - `锁场 -> frontline`
- `boss-bastion`
  - `接敌 -> screened`
  - `交火 -> summoner`
  - `火线收束 -> kiting`

### 口径说明
- 这条规则的目标是让 phase 差异不再只是后台参数切换。
- 当前仍属于轻量扩展：
  - 复用旧的 `frontline / screened / kiting / summoner`
  - 不引入 Boss 专属 AI 系统
  - 不改变主流程与 battle 结算

## 2026-04-06 Boss Phase Signature Pressure 补充
本轮新增的是 `phase signature window`，不是新的血量乘区。

### 激活规则
- 当 Boss 进入带 signature 的 phase 时：
  - `pressureSignatureLabel = signatureLabel`
  - `pressureSignatureSec = signatureDurationSec`
  - `pressureSignaturePulseSec = 0`
- 若该 phase 没有声明 signature，则：
  - `pressureSignatureLabel = undefined`
  - `pressureSignatureSec = 0`

### 倒计时规则
- 每帧更新：
  - `pressureSignatureSec = max(0, pressureSignatureSec - dt)`
  - `pressureSignaturePulseSec = max(0, pressureSignaturePulseSec - dt)`
- 当 `pressureSignatureSec <= 0` 时，本次 signature window 结束，HUD 也不再继续显示该 signature。

### 脉冲兑现规则
- `signaturePulseReady = pressureSignatureSec > 0 && pressureSignaturePulseSec <= 0`
- 若 `signatureEscortBurst > 0`：
  - `signatureEscortSpawn = min(signatureEscortBurst, escortCap - currentEscortCount)`
- 若 `signatureVolleyCount > 0`：
  - `signatureVolleyShooters = elite + nearestRanged.slice(0, signatureVolleyCount - 1)`
  - 每个 shooter 继续沿用现有敌方投射物公式，不新建独立弹幕系统
- 每次兑现后：
  - `pressureSignaturePulseSec = signaturePulseIntervalSec`

### 当前取舍
- 这条规则的作用是让某个 phase 在短时间内有更稳定的“压力味道”。
- 它不会额外提高 Boss 常驻血量，也不会引入强锁血。
- 本轮的重点是：
  - `phase identity + signature window`
  - 而不是 `phase identity + 更多血量`

## 2026-04-06 Boss Phase Pattern Pulse 补充
本轮新增的是 `phase pattern pulse`，不是新的常驻数值乘区。

### 激活规则
- 若当前 `pressurePhase` 声明了：
  - `patternLabel`
  - `patternMode`
  - `patternPulseIntervalSec > 0`
- 则 battle 会进入该 phase 的持续 pattern 模式：
  - `pressurePatternLabel = patternLabel`
  - `pressurePatternMode = patternMode`
  - `pressurePatternPulseSec = min(0.65, patternPulseIntervalSec * 0.45)`

### 脉冲规则
- 每帧更新：
  - `pressurePatternPulseSec = max(0, pressurePatternPulseSec - dt)`
- 当 `pressurePatternPulseSec <= 0` 时，兑现一次该 phase 的 pattern：
  - `laneCrush` / `sideClamp`
    - 按 `patternEscortBurst` 从 arena 边缘补入一批定向 escort 波
  - `crossfireWave`
    - 按 `patternVolleyCount` 选择 shooter
    - 每个 shooter 以 `patternVolleyShotsPerShooter` 和 `patternVolleySpreadRad` 发出固定间隔齐射
- 每次兑现后：
  - `pressurePatternPulseSec = patternPulseIntervalSec`

### 空间压迫口径
- `laneCrush`
  - 通过上/下沿来波，让玩家更容易被压进纵向换位
- `sideClamp`
  - 通过左/右侧来波，让玩家更容易被压进横向夹封
- `crossfireWave`
  - 通过固定周期交叉齐射，让玩家读到“压迫波 -> 短喘息 -> 下一波”

### 当前取舍
- 这轮没有补新的 Boss AI 树。
- 这轮没有加独立安全区系统或场地机关。
- 当前做的是：
  - 用现有护卫刷新 / 敌方投射物 / 行为谱系
  - 兑现更稳定的 `phase 内空间压迫 / 节奏模式`

## 2026-04-06 Boss Phase Space Carving 补充
本轮新增的是 `safe window / danger zone carving`，不是新的场地系统。

### 安全窗尺寸
- 若 phase 定义了安全窗字段：
  - `safeWindowSpan = clamp(patternSafeWindowSize, minimumSpan, maximumSpan)`
- 当前实现口径：
  - 纵向安全窗：`minimumSpan = 164`
  - 横向安全窗：`minimumSpan = 132`
  - `maximumSpan = arenaDimension * 0.46`

### 安全窗中心
- `safeWindowCenter = clamp(laneAnchor * 0.72 + playerCoord * 0.28, margin + span / 2, dimension - margin - span / 2)`
- 含义：
  - 安全窗不会完全贴着玩家移动
  - 也不会固定死在同一个位置
  - 当前是“离散 lane 锚点 + 轻度跟随玩家”的折中方案

### 安全窗持续
- `safeWindowSec = clamp(patternSafeWindowLingerSec, 0.82, 1.9)`
- 含义：
  - 给玩家一小段可读、可反应的入窗时间
  - 不把场地压迫做成不可反应的瞬时陷阱

### 壁射危险区
- `wallShotDamage = round(contactDamage * 0.7)`
- `wallShotSpeed = 252 * rangedProjectileSpeedMultiplier`
- `wallShotRadius = 6`
- 纵向安全窗：
  - 上/下沿在安全窗外的列位发射纵向壁射
- 横向安全窗：
  - 左/右沿在安全窗外的行位发射横向壁射

### 当前取舍
- 这轮没有靠提高 Boss 基础血量来换取“空间感”。
- 这轮采用的是：
  - `patternSafeWindowSize`
  - `patternSafeWindowLingerSec`
  - `patternWallShotCount`
  - 现有 escort / projectile 系统
- 目标是让玩家读到“哪里危险、哪里短暂可站”，而不是把最终关变成更厚的 elite 或更乱的弹幕场。
## 2026-04-06 远程空间口袋公式补充
### `crossfire` pocket 尺寸
- `pocketWidth = clamp(patternSafeWindowSize ?? 184, 152, ARENA_WIDTH * 0.36)`
- `pocketHeight = clamp(patternSafeWindowSecondarySize ?? pocketWidth * 0.68, 108, ARENA_HEIGHT * 0.34)`
- `pocketLingerSec = clamp(patternSafeWindowLingerSec ?? 1.08, 0.78, 1.6)`

### `crossfire` pocket 中心
- 当前远程 pocket 采用锚点主导的轻量迁移：
  - anchor 序列：
    - `(0.34, 0.36)`
    - `(0.66, 0.36)`
    - `(0.64, 0.66)`
    - `(0.36, 0.66)`
    - `(0.50, 0.50)`
- `pocketCenterX = clamp(anchorX * 0.78 + playerX * 0.22, 108 + pocketWidth * 0.5, ARENA_WIDTH - 108 - pocketWidth * 0.5)`
- `pocketCenterY = clamp(anchorY * 0.78 + playerY * 0.22, 92 + pocketHeight * 0.5, ARENA_HEIGHT - 92 - pocketHeight * 0.5)`
- 取舍目标：
  - 口袋不直接贴着玩家跑
  - 但也不脱离当前战场太远，普通 build 仍能争取转场

### `crossfire` pocket 火线排布
- `slotPositions(dimension, margin, shotSlots, safeStart, safeEnd)` 仍沿用现有安全窗外槽位分布逻辑
- `crossfire` 当前在 pocket 外同时生成：
  - 上/下边缘纵向火线
  - 左/右边缘横向火线
- 压力弹道伤害继续复用现有 pressure projectile 公式：
  - `pressureProjectileSpeed = 252 * rangedProjectileSpeedMultiplier`
  - `pressureProjectileDamage = round(enemyContactDamage * damageMultiplier)`
- 本轮 `crossfire` 采用：
  - `damageMultiplier = 0.68`
  - `patternVolleyCount = 1`
  用来避免远程 pocket 刚落地就被额外火线噪音淹没
