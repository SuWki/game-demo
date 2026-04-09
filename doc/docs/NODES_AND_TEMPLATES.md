# 节点与战斗模板说明

> 本文记录的是当前实现口径；若与 [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 冲突，后续设计对齐应以该设计基线为准，并明确记录近似实现差距。

## 节点模型
当前节点分为四类：
1. boss
2. battle
3. upgrade
4. anomaly

### 2026-04-05 0.9v 承载与压力更新
- `boss` 已是独立节点语义，末尾固定从 Boss 模板池中收尾，不再回退成普通 elite-family 近似。
- `anomaly` 已是独立节点语义，并且只会从 anomaly 内容池抽取，不再与普通 event 池混用。
- 现有 anomaly 仍复用 event 结算流；现有 boss 仍复用 battle 主流程，但两者的 node / content / metrics 归属已切开。
- `elite / boss` 模板现在可挂接 `pressurePhases`，用来表达阶段性压力切换：
  - 触发条件可以来自 `HP 阈值` 或 `剩余时间阈值`
  - 当前主要作用在：刷怪节奏、场上数量、护卫刷新、远程火线和主核走位压力
  - HUD 子读数会显示当前压力阶段，避免只能靠体感猜 Boss 是否已经转段

### 与 2026-04-05 设计基线的对齐状态
- 已符合：
  - 轻量地图推进与 `1 ~ 3` 候选节点的短局结构仍成立。
  - `battle` 家族已经覆盖普通 / 精英 / 生存三类模板。
  - 最终战已明确通过 `boss` 节点进入，不再沿旧 `battle / event` 命名继续漂移。
  - anomaly 已明确作为独立节点和独立内容池存在。
- 近似符合：
  - boss 仍复用现有 battle 结算与战斗主循环，没有单独的 Boss 系统层。
  - anomaly 仍复用现有 event 处理流，没有单独的 anomaly 系统层。
- 明显偏离：
  - 暂无新的节点语义偏离，但 elite / boss 的阶段压力表达仍是“轻量模板层”，还不是完整的 Boss 分段机制。

### 当前地图表达
- 仍然不是复杂大地图
- 当前采用“短局轻分支路线”表达
- 每次清完一个节点后，从加权抽出的 `1 ~ 3` 个候选节点里选 1 条继续推进
- 精英战仍然通过 battle 模板进入，不单独拆出新节点类型
- 同阶段允许存在多个 node blueprint 变体，用来降低标题和推进节奏的重复感

### battle
定位：高风险 / 中高收益 / 主推进
- 主要负责经验掉落、等级提升和战斗模板体验

### upgrade
定位：低风险 / 稳定收益 / 修 build
- 当前不是唯一升级来源
- 作用是给一次更稳、品质更高的整备三选一

### anomaly
定位：中高波动 / 低频异常 / 风险换扭转
- 主要承担：异常窗口、代价换收益、扭曲混搭、Boss 前的特殊准备
- 不再承担普通 event 的泛化补给职责

## 节点选择原则
不是做复杂大地图，而是做短局节点推进。
目标是让玩家能感受到：
- battle 是搏成长
- upgrade 是稳修正
- anomaly 是异常扭转与记忆点

## 当前节点分发焦点
- 前段：更强调“路线信号出现但不锁死”，starter 与中性过渡内容优先，避免过早强承诺
- 中段：更强调“starter 接 bridge，再逐步站稳”；当前 anomaly 需要提供真实可读的异常窗口，而不是继续退回普通 route push
- 后段：更强调“committed 后的 payoff 与收尾修正”，把强兑现内容集中到 late / final
- 后段同时应承接少量低频高辨识度内容：rare anomaly、rare battle 变体、late rare payoff，用来强化 replay 记忆点，但不能回渗到 mid
- 当前 round 2 的事件节点比前几轮更需要承担“重评路线”的职责；round 3 的 rare 节点则应继续保持低频而非变成常规池

## 2026-04-10 1.0 第一阶段第 3 轮：replay / rare / hybrid 载体补充
### 新增 node carrier
- `并轨整备`
  - 中段 upgrade 载体
  - 职责：给 hybrid / redirect 一个更自然的整备入口，而不是只靠普通中段强化承载
- `稀有读数`
  - 后段 upgrade 载体
  - 职责：把 rare / late payoff 更明确地拉成“低频高收益窗口”
- `并线残响`
  - 后段 anomaly 载体
  - 职责：把 `hybrid + bossEcho` 一起抬上来，更像这局最后一次偏航与收束前预读

### 当前 late 节点承载原则
- late 的 battle / upgrade / anomaly 现在需要共同承担：
  - 收尾修正
  - 稀有兑现
  - 低频偏航
  - replay 记忆点
- 但仍然保持：
  - 不新建独立节点系统
  - 不把 rare carrier 常态化
  - 不让 anomaly 回退成普通奖励分发

## 2026-04-07 三流派 carrier 收口补充
### route-fit 倾向
- 本轮没有新建 route-specific node 系统，而是在现有 blueprint 权重上补了一层轻量 `routeBonuses`。
- 当前原则是：
  - 只做“更可能遇到”，不做“只会遇到”
  - 让 battle / boss carrier 更像路线承载，不把内容锁死成单一路线

### 当前 battle carrier 倾向
- `crit`
  - opening 更容易撞上 `侧压试飞`
  - mid 更容易撞上 `精英压制`
  - late 更容易撞上 `尾段突压`
  - 目标读数：前段点火，中段稳火，后段压爆点
- `pierce`
  - opening 更容易撞上 `厚线突围`
  - mid 更容易撞上 `拖场绞锁`
  - late 更容易撞上 `夹道求生`
  - 目标读数：前段清线，中段续链，后段贯穿收束
- `dash`
  - opening 更容易撞上 `侧压试飞`
  - mid 更容易撞上 `封锁突破`
  - late 更容易撞上 `交火夹层 / 尾段突压`
  - 目标读数：前段换位，中段回线，后段反打求生

### 当前 final boss 收尾倾向
- `追猎主核`
  - 更偏暴击收尾
  - 强调正面压脸与爆发兑现
- `锁域主核`
  - 更偏穿梭收尾
  - 强调换位、回线与反打节奏
- `屏卫主核`
  - 更偏穿透收尾
  - 强调清屏、拆线与再找收束窗口
- 以上仍是轻量偏置，不是 route hard-lock；目的是拉清 ownership，而不是让最终关变成固定配对

## 2026-04-07 anomaly 深度与 template layering 补充
### anomaly 识别口径
- anomaly event 现在新增轻量 `anomalyClass`：
  - `routeWindow`
  - `distortion`
  - `hybrid`
  - `bossEcho`
- 当前使用原则是：
  - `routeWindow` 继续承担异常改道和 reroute 支持入口
  - `distortion / hybrid / bossEcho` 负责把 anomaly 做成更像异常的低频记忆点
- selector 侧当前会按 `anomalyClass + phase` 做轻量分发倾斜：
  - opening 仍允许少量 `routeWindow`
  - mid / late 更优先 `distortion / hybrid`
  - late / finalPrep 更容易出现 `bossEcho`
- 本轮新增 anomaly 内容：
  - `断层竞价`
  - `幽栅并轨`
  - `终端税`
- 本轮补回 anomaly lane 的 route payoff：
  - `热区记录`
  - `裂轨图谱`
  - `穿梭记忆`
- 这些内容此前更像 route-specific rare event；当前已经回到 anomaly 口径，用来承担三流派自己的异常兑现，而不是普通奖励分发
- 本轮被降为支持层的 anomaly：
  - `risky-protocol`
  - `relay-splice`
  - `route-handoff`
  - `crit / pierce / dash-reroute-window`
  - `cross-branch-signal`

### battle 节点承载
- opening 新增 `厚线突围`
  - 主要承载 `elimination-sweep`
  - 用来把“厚线推进 / 清线突围”从普通歼灭里分出来
- mid 新增 `拖场绞锁`
  - 主要承载 `elite-vice`
  - 用来把“低频拖场 / 持续补援”的精英战味道拉出来
- late 新增 `尾段突压`
  - 主要承载 `survival-rush`
  - 用来把“后段高速求生”从普通 survival 里分出来
- 节点卡当前会直接显示 blueprint 的玩家向描述，不再把不同 battle / anomaly 都读成同一种占位说明

### template family 当前职责
- opening / elimination family
  - `elimination`：清线推进
  - `elimination-pincer`：侧压换位
  - `elimination-sweep`：厚线突围
- mid / elite family
  - `elite`：正面拆主核
  - `elite-lockdown`：侧压封位
  - `elite-screen`：护卫遮线
  - `elite-vice`：低频拖场绞锁
- late / survival family
  - `survival`：基础后段求生
  - `survival-rush`：尾段突压
  - `survival-gauntlet`：厚体压线
  - `survival-crossfire`：低频交火记忆点

## 战斗模板
只保留三类：
1. 歼灭
2. 精英压制
3. 生存压制

### 歼灭
- 基础主干模板
- 承担清怪、推进、节奏铺垫作用

### 精英压制
- 中段更有个性的压力点
- 更容易形成记忆点
- 现已支持轻量 `pressurePhases`，让 elite 不再主要只靠“高血 + 护卫”成立

### 生存压制
- 后段高潮候选模板
- 强调撑住与节奏切换

### Boss 载体
- `boss-hunt / boss-lockdown / boss-bastion` 已是独立 Boss 模板池
- 当前可以通过 `pressurePhases` 提供至少两段不同的收尾压力
- 仍然复用现有 battle 主流程，不额外扩出 Boss 系统

## 模板切换点结论
当前不存在“明显固定骨架”，但仍有“轻度家族吸附”。
当前处理原则是：
- 保持 battle / elite / survival 三大家族不变
- 优先通过 blueprint 变体、候选数量和家族内权重去拉开体验
- rare 记忆点优先通过后段 blueprint 低频变体与家族内 rare 模板候选完成
- rare 模板只作为家族内低频候选，不拆出第四类节点，也不改主流程
- 不通过新增第四类节点或重做地图结构来解决重复感
- 不通过把普通 route-specific 节点继续堆高来冒充转向空间；真实 redirect 应由少量 mid 事件节点与低频 rare 节点承担

## 2026-04-05 round 2 节点口径补充
- round 2 的 redirect 责任进一步细化为：
  - `round-2-event-reroute`：主要承担“hold vs reroute”的主动转向窗口
  - `round-2-event-handoff`：保留为次级波动窗口，不再主导 redirect 体验
  - `round-2-upgrade-lock`：继续保持低权重，避免普通 route-specific 强导向重新挤占 mid
- 最新分发原则是：
  - mid 先让玩家看到更清楚的 reroute 评估窗口
  - late 再把 rare / payoff 记忆点集中兑现
  - 不通过把通用 relay/handoff 大量堆进 mid 来伪造 branch switching

## 2026-04-05 设计对齐审计补充
- 最终战：
  - 当前是“高压 final battle 模板收尾”
  - 目标是“玩家可感知的独立 Boss 关”
- anomaly：
  - 当前是“低频 event / rare event 近似”
  - 目标是“独立且可感知的异常关”
- 本轮策略：
  - 不直接扩 `NodeType`
  - 先把偏离点固定写进审计和 issue log，避免后续继续按旧口径漂移
## 2026-04-05 Node / Encounter Semantics Addendum
### 节点语义
- `NodeType` 当前以 `battle | upgrade | anomaly | boss` 为准。
- `anomaly` 节点现在会从带 `contentKind: anomaly` 的内容池抽取内容；节点卡、面板标题、节点记录和指标事件均按 `anomaly` 处理。
- 最终节点固定为 `boss`，不再沿用 `battle / finalBattle event-like` 的旧口径。

### 模板语义
- `battle` 模板家族仍覆盖普通关 / 精英关 / 生存关。
- `boss` 现在有独立的 `boss-hunt / boss-lockdown / boss-bastion` 模板承载入口；最终节点只会从 Boss 模板池抽取。
- `boss` 仍复用现有 elite 风格胜利条件与大部分战斗机制，因此这是“承载边界落地”，不是完整 Boss 系统。

### 基础敌人语义
- 基础敌人 archetype 现为：
  - `standard`
  - `brute`
  - `skirmisher`
  - `ranged`
- `regular / escort / elite` 明确是战斗角色层，不再承担基础敌种分类职责。
- `battleTemplates` 已新增 `regularArchetypes` / `escortArchetypes` 权重，用于驱动不同模板的敌种混合。

## 2026-04-05 0.9v Boss / Anomaly 内容承载补充
### Boss 节点与模板
- 最终 Boss 不再只显示一个泛 `最终 Boss` 节点；当前会直接以具体 Boss 蓝图落地：
  - `追猎主核 -> boss-hunt`
  - `锁域主核 -> boss-lockdown`
  - `屏卫主核 -> boss-bastion`
- 这让 Boss 内容的入口从“Boss 模板池存在”推进到“节点标题 / 节点描述 / HUD / 结果口径都能承接具体 Boss 内容”。
- Boss 仍复用现有 battle 机制与 win condition；本轮做的是内容承载补强，不是 Boss 系统扩建。

### anomaly 节点与内容
- anomaly 现在已有第一批明确站在 anomaly 载体上的内容：
  - 节点蓝图：`相位裂缝`、`Boss 阴影`
  - 事件内容：`相位裂缝`、`载体失真`、`Boss 阴影扫描`
- selector 侧现已使用显式 anomaly catalog，后续补异常内容时应继续加到 anomaly lane，而不是重新混回普通 `event` 池。
- anomaly 仍复用 event 面板和 effect 结算；本轮重点是把节点与内容池的站位做对。

## 2026-04-05 0.9v 战斗层模板补充
### 模板读数
- battle HUD 现在不只显示模板名，还会基于现有模板数据直接给出读数摘要：
  - `敌群`：由 `regularArchetypes` 的高权重 archetype 推导
  - `节奏`：由 `spawnRule.pattern / laneBias` 推导
  - `护卫`：由 `escortArchetypes` 推导
  - `主核`：由 `eliteRule.behavior` 推导
- 这层读数是从现有模板字段直接推导出来的轻量表达，不是新系统。

### archetype ownership
- 当前模板家族的主要归属更新为：
  - `elimination`：前段普通怪为主，少量高速怪补侧压。
  - `elimination-pincer`：更偏 `skirmisher`，强调包夹与换位。
  - `elimination-sweep / survival-gauntlet`：更偏 `brute`，强调厚体推进与线性挤压。
  - `elite-screen / survival-crossfire / boss-bastion`：更偏 `ranged`，强调火线与遮线。
  - `elite-lockdown / boss-lockdown`：更偏 `skirmisher + escort`，强调封位、反拉与护卫压场。
  - `boss-hunt`：更偏 `brute + frontline`，强调正面顶压。

### 角色语义
- `regular / escort / elite` 继续作为战斗角色层：
  - `regular`：普通刷出的基础敌群
  - `escort`：围绕精英/Boss 的护卫层
  - `elite`：模板主核承压单位
- 这意味着后续继续扩敌人内容时，应优先沿 archetype 扩写，而不是重新把 `regular / escort / elite` 当作基础敌种分类。

### 仍保留的近似实现
- `ranged` 已有保距移动、敌方弹道与可见瞄线，但还不是完整远程 AI 体系。
- 当前模板读数来自现有权重和行为字段推导，还不是独立的 encounter director。

## 2026-04-05 Upgrade / Anomaly Ownership Addendum
### 普通升级三选一
- 普通 `levelUp` 不再复用节点整备的 route-leaning 发牌逻辑，而是走独立的普通升级池：
  - `2` 个通用槽
  - `1` 个弹性槽
- 这意味着普通升级三选一里：
  - 最多只允许出现 `1` 个路线强化
  - 通用属性强化重新成为主干
  - route buff 只作为较低频的提示/承接窗口，而不是占满整组卡面

### anomaly route pool
- anomaly 中的路线项现已从 `events.ts` 内联定义中拆出，改为独立 anomaly route pool 承载。
- 当前走独立池的 anomaly 路线内容包括：
  - `risky-protocol`
  - `relay-splice`
  - `route-handoff`
  - `crit-reroute-window`
  - `pierce-reroute-window`
  - `dash-reroute-window`
  - `cross-branch-signal`
- 后续继续补 anomaly 路线内容时，应优先扩 anomaly route pool / anomaly event lane，而不是往普通升级池或普通事件池回灌。

### 玩家可见文案口径
- 节点卡、升级面板、异常面板当前优先显示玩家向摘要，而不是直接显示 blueprint / event 原始描述。
- 原始描述字段仍保留给数据层与编辑使用，但当前 UI 口径应以：
  - battle：关卡类型 + 简洁收益说明
  - upgrade：直接说明“选择 1 项强化，立即生效”
  - anomaly：直接说明“异常窗口已打开，选择一项处理方案”
  为准，避免再次把内部设计性语气暴露给玩家。

## 2026-04-06 Boss Phase Stabilization Addendum
### Boss 阶段切换
- 当前 `boss-hunt / boss-lockdown / boss-bastion` 的 `pressurePhases` 不再只是阈值触发后立即换参数。
- Boss phase 现在允许挂接以下轻量承接字段：
  - `minResidenceSec`
  - `entryGuardSec`
  - `entryGuardDamageMultiplier`
  - `entryEscortBurst`
- 当前实现口径是：
  - 每次压力检查最多只推进到“下一段”，不再允许同一轮直接连跳多个 Boss phase。
  - 若当前阶段尚未达到 `minResidenceSec`，则下一段即使阈值也满足，也会继续停留在当前阶段一小段可感知时间。

### 阶段承接
- phase 切换后会立即兑现一小段过渡承接：
  - 短时 guard，防止刚转段就被 burst 再次压平
  - 一次即时护卫补入，让新阶段的场面变化更快落到屏幕上
- 这层承接只服务 Boss phase 稳定化，不是锁血，也不是独立 Boss 子系统。

### 阶段读数
- HUD 子读数在 phase 切换瞬间会使用 `转段` 前缀，而不是继续只显示静态 `阶段` 标签。
- 战场上会为主核补一个短时脉冲圈提示，帮助玩家感知“Boss 已进入下一压力段”。
- 当前仍保留的边界：
  - 没有重新加回大面积 toast / 横幅。
  - 没有把 elite 的轻量 phase 体验抬成和 Boss 同层级的独立机制。

## 2026-04-06 Boss Phase Behavior Identity Addendum
### phase 行为覆写
- `pressurePhases` 现在除了压力节奏参数外，还允许挂接：
  - `behaviorOverride`
- 当前运行口径是：
  - `activeEliteBehavior = pressurePhase.behaviorOverride ?? eliteRule.behavior`
- 这意味着 phase 不再只改变：
  - 护卫数量
  - 刷怪节奏
  - 远程射速
  - 主核速度 / 距离参数
- 也会改变主核本体的行为身份。

### 当前 Boss phase 身份
- `boss-hunt`
  - `接敌`：`frontline`
  - `逼近`：`screened`
  - `收束`：`frontline`
- `boss-lockdown`
  - `接敌`：`kiting`
  - `封位`：`screened`
  - `锁场`：`frontline`
- `boss-bastion`
  - `接敌`：`screened`
  - `交火`：`summoner`
  - `火线收束`：`kiting`

### 读数同步
- battle HUD 子读数现在会显示当前 phase 下的主核行为，而不是只显示模板初始行为。
- 这让玩家在不增加新 UI 遮挡的前提下，也能从 `阶段 / 主核 / 敌群 / 节奏 / 护卫` 读数里确认 Boss 已经进入另一种打法阶段。

### 当前边界
- 这轮没有引入新的 Boss 行为系统；只是把现有 `frontline / screened / kiting / summoner` 行为谱系正式接到 phase 层。
- elite 仍保留自己的轻量 phase 压力，不与 Boss 的阶段行为身份混成同一承载层级。

## 2026-04-06 Boss Phase Signature Addendum
### phase signature carrier
- `pressurePhases` 现在除了 `behaviorOverride` 与切段承接字段外，还允许挂接：
  - `signatureLabel`
  - `signatureDurationSec`
  - `signaturePulseIntervalSec`
  - `signatureEscortBurst`
  - `signatureVolleyCount`
- 这层 carrier 的含义是：
  - phase 进入后的一小段专属压力窗口
  - 用可重复、可学习的短时脉冲确认“这段 phase 在干什么”
  - 不引入新的 Boss 子系统，只复用现有护卫刷新与敌方弹道能力

### 当前 Boss signature 映射
- `boss-hunt`
  - `逼近`：`逼近压线`
  - 主要兑现：短时额外护卫脉冲，强化贴线逼近感
- `boss-lockdown`
  - `封位`：`护卫封位`
  - 主要兑现：更密的护卫封位脉冲，强化走位压缩感
- `boss-bastion`
  - `交火`：`火线齐射`
  - 主要兑现：短窗齐射，强化远程火线与交火段辨识度

### 当前读数口径
- 当 signature window 激活时，battle HUD 子读数会补上 `压迫 {signatureLabel}`。
- 战场表现只增加轻量确认：
  - Boss 主核额外外圈
  - 原有 phase / 行为 / 敌群读数继续保留
- 本轮没有重新加回大横幅，也没有把 elite 抬到同级 signature 机制。

### 当前边界
- 这轮做的是 `Boss phase signature`，不是完整 Boss pattern 系统。
- `final battle` 继续由 Boss 模板池承载；elite 仍只保留轻量 phase 压力，不共享 Boss signature carrier。

## 2026-04-06 Boss Phase Pattern Addendum
### phase pattern carrier
- `pressurePhases` 现在额外允许挂接持续型 pattern 字段：
  - `patternLabel`
  - `patternMode`
  - `patternPulseIntervalSec`
  - `patternEscortBurst`
  - `patternEscortArchetype`
  - `patternVolleyCount`
  - `patternVolleySpreadRad`
  - `patternVolleyShotsPerShooter`
- 这层 carrier 的含义是：
  - phase 进入后，不只是有一个短时 signature
  - phase 本体还能持续兑现某种稳定的空间压迫或节奏模式

### 当前 Boss pattern 映射
- `boss-hunt / close-in`
  - `patternLabel = 纵压驱进`
  - `patternMode = laneCrush`
  - 主要兑现：上/下沿的厚体压进波
- `boss-lockdown / pin-down`
  - `patternLabel = 侧翼夹封`
  - `patternMode = sideClamp`
  - 主要兑现：左/右侧的高速护卫夹封波
- `boss-bastion / crossfire`
  - `patternLabel = 交叉火线`
  - `patternMode = crossfireWave`
  - 主要兑现：固定周期的交叉齐射

### 当前取舍
- `signature` 继续负责“phase 切了”的短时确认。
- `pattern` 负责“这一阶段持续怎么压你”。
- 这轮仍没有给 elite 增加同层级的 pattern 载体，避免 final battle 再次掉回 elite-family 同层语义。

## 2026-04-06 Boss Phase Space Carving Addendum
### phase 内空间雕刻 carrier
- `pressurePhases` 现在还允许挂接轻量场地雕刻字段：
  - `patternSafeWindowSize`
  - `patternSafeWindowLingerSec`
  - `patternWallShotCount`
- 这层 carrier 的含义是：
  - 不是新建场地机关系统
  - 而是在现有 `pattern pulse + escort wave + enemy projectile` 上，把某个 phase 做成更可读的危险区 / 安全窗结构

### 当前 Boss 空间雕刻映射
- `boss-hunt / close-in / 纵压驱进`
  - 打开一条纵向安全走廊
  - 上/下沿壁射在走廊外形成纵压危险区
  - 厚体 escort 波继续沿纵向把玩家往安全窗内压
- `boss-lockdown / pin-down / 侧翼夹封`
  - 打开一条横向安全走廊
  - 左/右侧壁射在走廊外形成横向封边危险区
  - 高速 escort 波继续在安全窗两端补压
- `boss-bastion / crossfire / 交叉火线`
  - 继续保留为节奏型火线 phase
  - 本轮没有强行补成安全窗结构，避免把远程 phase 也做成同一味道

### 当前读数口径
- battle HUD 子读数在安全窗激活时会补上：
  - `安全窗 纵向`
  - 或 `安全窗 横向`
- 战场 overlay 不再只画抽象压迫条，而是会：
  - 淡显安全窗区域
  - 在安全窗外给出低透明危险区遮罩
  - 用边界线提示当前走廊边缘

### 当前边界
- 这轮仍然没有引入独立 hazard / arena system。
- 当前空间雕刻仍复用：
  - enemy projectile
  - escort wave
  - pattern pulse
- 这意味着 Boss 的空间结构已经比上轮明确，但还不是完整场地机制树。
## 2026-04-06 Boss 远程空间口袋补充
- `boss-bastion / crossfire / 交叉火线` 现在不再只是“固定齐射 + 护卫刷新”的远程 phase。
- 当前远程 phase 的 carrier 继续复用：
  - `pressurePhases`
  - `pattern pulse`
  - `safe-window`
- 但 `crossfire` 现在新增了 `pocket` 语义：
  - `patternSafeWindowSize = 184`
  - `patternSafeWindowSecondarySize = 126`
  - `patternSafeWindowLingerSec = 1.16`
  - `patternWallShotCount = 5`
- 这意味着 `boss-bastion` 的远程段现在会：
  - 生成一个短时安全袋
  - 用上下左右四向火线把口袋外压成危险区
  - 保留低量齐射确认“远程火线”身份
- 当前三种 Boss phase 的空间口径因此变成：
  - `boss-hunt / close-in`：纵向安全走廊
  - `boss-lockdown / pin-down`：横向安全走廊
  - `boss-bastion / crossfire`：矩形安全口袋
- ownership 边界保持不变：
  - 这仍是 Boss template 内的轻量 carrier 扩展
  - 没有把 elite-family 一并升级到同层远程 pocket 语义
  - `final battle` 仍通过 Boss template pool 收尾，不回退成普通 elite-family 模板近似
## 2026-04-06 Boss 远程 pocket 转场补充
- `boss-bastion` 当前已有两个远程 pocket phase：
  - `crossfire / 交叉火线`
  - `fireline / 压边迁火`
- 两者继续共用：
  - `pattern pulse`
  - `crossfireWave`
  - `safe-window(pocket)`
- 但当前 pocket 转场不再只有一套锚点序列：
  - `crossfire`：`sweep + centerReset`
  - `fireline`：`edgeBounce + centerReset`
- 这意味着：
  - `crossfire` 更偏横切换区，再穿插短时回心窗口
  - `fireline` 更偏边缘转场和压边迁位，再穿插短时回心
- 当前 pocket shift 仍是轻量模板字段，不是新的 Boss 系统：
  - `patternPocketShiftModes`
  - phase 内 pocket 尺寸 / linger / 玩家混合权重的轻量差异
- ownership 边界保持不变：
  - 这层 pocket shift richness 只落在 Boss template 内
  - elite 与普通 ranged 仍不进入同层 pocket 转场语义
  - final battle 继续依赖 Boss template pool，而不是退回 old elite-family

## 2026-04-08 Boss Bastion Fireline Calibration Addendum
### 普通样本承接结论
- 当前 `boss-bastion` 的普通样本问题已经不再是“有没有远程后段”，而是很多短战局会在 `接敌 / 交火` 内直接分出胜负。
- 因此本轮没有继续把 `fireline` 粗暴做成更早的纯时间后段，而是改成：
  - 让 `crossfire` 更容易通过 HP 承接出现
  - 缩短 `crossfire` 的最短驻留
  - 让 `fireline` 更容易通过 HP 承接接上
  - 再用现有 `signature` carrier 给 `fireline` 补一层进段确认

### 当前 `boss-bastion` 远程段口径
- `crossfire / 交叉火线`
  - 仍承担远程前段主味道
  - 当前更偏“更早被普通样本读到”，而不是继续只靠时间轴后推
- `fireline / 压边迁火`
  - 仍承担远程收束段
  - 当前更偏“短战局里也能被普通样本自然读到一次”，而不是只在高 burst / 高机动里成立
  - 现已拥有自己的轻量 signature entry，不再只有 pocket/pattern 在做后段确认

### ownership 边界
- 这轮仍然只改 `boss-bastion` 的 phase carrier，没有把同层语义下放给 elite-family。
- `fireline` 依然是 final battle 内的 Boss 远程后段，不是普通 `screened / kiting` elite 的厚体版。
- 当前 Boss / elite / final battle 的边界保持不变：
  - Boss 负责阶段承接与最终收束
  - elite 继续只保留轻量模板级压力
  - final battle 继续通过 Boss template pool 收尾
## 2026-04-09 1.0 第一轮内容扩写补充
### anomaly 池加厚
- anomaly 仍沿现有独立载体扩写，没有回退到普通 `event` 语义。
- 本轮新增 anomaly：
  - `冷启偏折 / cold-start-warp`
  - `裂谱合拍 / frayed-accord`
  - `屏卫预读 / escort-overread`
  - `首领残响 / crown-residue`
- 分发口径更新为：
  - opening 仍允许少量 `routeWindow`
  - mid / late 更偏 `distortion / hybrid`
  - late / finalPrep 更偏 `bossEcho`
- 因此 anomaly 的职责进一步从“给路线一点偏航机会”扩展到“低频失真、混搭与 Boss 前预读”。

### battle template 家族补量
- opening family 新增 `elimination-crossline / 火线歼灭`
  - 更早引入远程火线，承担前段基础换位与补线读数。
- elite family 新增 `elite-bulwark / 壁垒压制`
  - 强化中段“拆屏护卫 -> 穿本体”的硬仗身份。
- survival family 新增 `survival-sieve / 筛火求生`
  - 强化 late 段“漏火线 + 高速怪 + 回线求生”的后段承压。
- 本轮没有新增新的 Boss 家族，刻意保持 `boss-hunt / boss-lockdown / boss-bastion` 不变，避免破坏 0.9v freeze 基线。

### 节点承载补量
- opening 新增：
  - `火线试压`，主承载 `elimination-crossline`
  - `冷启裂口`，把 opening anomaly 做成真正的低频记忆点入口
- mid 新增：
  - `壁垒拆解`，主承载 `elite-bulwark`
  - `欠账裂纹`，把 mid anomaly 拉成更明确的代价/收益窗口
- late 新增：
  - `筛火求生`，主承载 `survival-sieve`
  - `首领残响`，把 Boss echo 提前泄到 late 段
- final prep 新增：
  - `Boss 预整备`，补强首领前最后一次承压与收尾修正载体

### 1.0 第一轮承载边界
- 本轮仍只用现有 `template / rule / selector / family / blueprint / nodes / upgrades` 数据结构扩写。
- `boss` 继续只从 Boss 模板池收尾；`anomaly` 继续只从 anomaly 池抽取；普通关 / 生存关 / 精英关继续维持家族分层。
- `boss-bastion / fireline` 仍是回归监控项，没有因为这轮内容补量被重新拉回主线专项。

## 2026-04-09 1.0 第一阶段第 2 轮：node / upgrade / route / selector 承接补充
### nodePrep 发牌边界
- `nodePrep` 当前已和普通 `levelUp` 一样，收口为：
  - `2` 张通用强化
  - `1` 张弹性槽
- 这意味着 upgrade 节点当前也遵守：
  - 单次三选一里最多 `1` 张路线强化
  - 通用属性强化继续是主干
  - route / redirect / hybrid 只在弹性槽里承担“提示 / 转向 / 收尾”角色

### 当前节点新增的 route carrier
- mid 新增 `改道整备`
  - 主要职责是把 upgrade 节点显式拉成“重评路线”的中段窗口
  - 重点承接 `bridge / redirect / hybrid`
- mid 新增 `分叉噪井`
  - 主要职责是把 anomaly 节点拉成更明确的中段分叉判断点
  - 不再只是普通 routeWindow 的换名入口
- late 新增 `收束筹码`
  - 主要职责是把 upgrade 节点推向 late payoff / rare generic / 混搭收尾
- late 新增 `余辉偏折`
  - 主要职责是给后段 anomaly 保留稀有收益、混搭和低频转向的窗口

### selector 当前关系
- 普通 `levelUp`
  - 保持 `2 通用 + 1 flex`
  - `routeWindowWeightScale` 当前为：
    - 无 dominant：`0.56`
    - hinted dominant：`0.64`
    - committed / matured：`0.78`
- `nodePrep`
  - 不再走“多张 route 牌堆满 upgrade 节点”的旧近似
  - 当前更像“通用整备 + 1 张路线/redirect/hybrid/late payoff 弹性槽”
- `redirect / hybrid`
  - mid / late 的 upgrade 节点现在是主要承接入口之一
  - `finalPrep` 继续压住 redirect 专项卡，避免最终整备重新掉回分叉噪音池

### ownership 边界
- 本轮没有引入新的 node type，也没有把 route 逻辑写回 `RunEngine`。
- route build 的承接仍然沿：
  - node blueprint
  - upgrade archetype
  - selector weight
  这三层完成。
- `Boss / anomaly / template ownership` 边界不变：
  - Boss 继续由 Boss 模板池收尾
  - anomaly 继续走 anomaly 池
  - template family 继续承担 encounter identity
