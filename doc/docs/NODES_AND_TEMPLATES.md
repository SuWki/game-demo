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
