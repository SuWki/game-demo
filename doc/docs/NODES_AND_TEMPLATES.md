# 节点与战斗模板说明

> 本文记录的是当前实现口径；若与 [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 冲突，后续设计对齐应以该设计基线为准，并明确记录近似实现差距。

## 节点模型
当前节点只有三类：
1. battle
2. upgrade
3. event

### 与 2026-04-05 设计基线的对齐状态
- 已符合：
  - 轻量地图推进与 `1 ~ 3` 候选节点的短局结构仍成立。
  - `battle` 家族已经覆盖普通 / 精英 / 生存三类模板。
- 近似符合：
  - 最终战已固定放在整局尾声，但当前仍是 `finalBattle -> battle template` 近似，不是独立 Boss 关。
  - 低频 rare 事件当前可承担一部分“异常感”，但还不是玩家明确识别的 `anomaly` 节点。
- 明显偏离：
  - 当前 `NodeType` 仍是 `battle / upgrade / event`，尚未对齐目标 `boss / battle / upgrade / anomaly`。
  - 这轮不直接扩节点类型，只记录差距并保留当前实现口径。

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

### event
定位：中风险 / 高波动 / 构筑转折

## 节点选择原则
不是做复杂大地图，而是做短局节点推进。
目标是让玩家能感受到：
- battle 是搏成长
- upgrade 是稳修正
- event 是拐方向

## 当前节点分发焦点
- 前段：更强调“路线信号出现但不锁死”，starter 与中性过渡内容优先，避免过早强承诺
- 中段：更强调“starter 接 bridge，再逐步站稳”；当前还需要让 `event-shift / event-handoff` 一类节点真正提供转向窗口，而不是只给普通 route-specific 补强
- 后段：更强调“committed 后的 payoff 与收尾修正”，把强兑现内容集中到 late / final
- 后段同时应承接少量低频高辨识度内容：rare 事件、rare battle 变体、late rare payoff，用来强化 replay 记忆点，但不能回渗到 mid
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

### 生存压制
- 后段高潮候选模板
- 强调撑住与节奏切换

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
