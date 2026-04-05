# 项目当前状态

> 若与 [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 冲突，后续设计校准与偏离审计以该文件和最新 `DEV_ISSUE_LOG.md` 为准。

## 项目定位
这是一个 Web 端的极简自动战斗 Roguelite / 自动射击 demo。

### 当前一句话定位（对外版）
一个能在短局里快速读懂节奏、走出三条不同 build 路线的节点式自动射击 demo。

### 当前一句话定位（内部版）
一款以短局节点推进为骨架、围绕暴击 / 穿透 / 穿梭三条路线分化的俯视角自动射击原型，当前重点是验证短局循环是否足够清楚、顺手、可复玩。

## 阶段演化
- 核心循环成立
- 三条主要流派可玩
- 进入收束前的内容加厚阶段（已完成）
- 随后转入商业化测试版准备（已完成大半）
- 商业化测试版封版检查阶段（已完成）
- 当前进入：代码丢失后的文档驱动重建阶段
- 公式化成长与战斗内升级接入（已完成）
- 最小表现层收口第一轮（已完成）
- 当前执行焦点：redirect 默认吸引力校准 + hybrid 承接强化 + 稀有 / late payoff 比例边界维护 + 实跑样本验证

## 已确认的测试版结论
- `route_committed / route_matured` 已在自然长局中稳定触发
- 最小展示素材已产出为 GIF
- 测试版结论已达到“可发 itch.io 测试版”的状态

## 当前 0.9 路线（仍然有效）
- 单局结构升级
- 三流派 0.9 收口
- 轻局外闭环
- 内容复用底座
- 最小表现层收口

## 当前最大风险
- 当前 rare / hybrid / late payoff 的边界已经比前几轮清楚，但若后续继续只补普通 route-specific 内容，replay 动机仍会再次被常规分发稀释
- `redirectOfferSeenCount` 已经能够在真实跑局里稳定非零，说明“可转向机会”已经能被发出来；但 `redirectPickCount / branchSwitchCount` 在自然样本里仍偏低，说明默认吸引力与玩家惯性对冲后还不够稳
- mid 阶段虽然已不再主要被普通 payoff 污染，但普通 route-specific bridge 如果继续增量失控，仍可能重新把后段兑现感往前挤
- 稀有内容如果后续只是继续加数量而不守住低频，late 记忆点会重新退化成普通池换皮
- 中文乱码与内部设计话术重新泄露到玩家可见文本

## 2026-04-05 更新
- 最新阶段口径保持不变：项目仍处于“内容与可玩性阶段”，本轮不做骨架重建、不做新系统扩展。
- 本轮执行焦点改为：`redirect 默认吸引力校准 > hybrid 承接强化 > 多局样本验证`。
- 当前确认的最新进展：
  - mid 阶段真正的 off-route redirect 升级窗口已不再被同流派 `redirect` 变体挤占。
  - `relay-splice / route-handoff` 下调为次级改道入口，带 `hold` 选项的 reroute-window 事件被前置为更主要的主动转向窗口。
  - 自然跑局样本里 `redirectPickCount` 已不再长期为 0，`branchSwitchCount` 也重新出现了非零样本。
  - 新增的 redirect 观测字段 `redirectOfferSeenCount / redirectPickCount / redirectPickStage` 已接入并通过导出链路保留。
- 当前最大风险更新为：
  - 自然样本里的主动转向仍然偏少，虽然已不再是纯 0，但主要还集中在 mid-late / late 的明确窗口，mid 的稳定转向样本仍不足。
  - `relay-splice` 这类通用改道事件仍可能在部分跑局里被顺手拿来“顺当前路线”，说明 redirect 吸引力问题已从“看不到”转成“看到后是否真愿意翻主路线”。
  - `branchSwitchCount` 已修正为不会漏记“同一拍完成 switch + mature”的情况，但样本规模仍小，后续还需要继续观察真实分布。
- 同日新增用户设计基线文档 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`，后续需要重点审计：
  - 关卡类型是否应从当前 `battle / upgrade / event` 继续对齐到 `boss / battle / upgrade / anomaly`
  - 最终战是否仍只是 battle 模板近似
  - 强化唯一性、特殊强化最低品质、四类基础小怪是否已被当前实现偏离

## 2026-04-05 设计对齐审计补充
- 本轮已按 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 对当前实现做了一次 design alignment audit。
- 审计后确认的已符合项：
  - 玩家操作仍是 `WASD` 主移动 + 自动攻击；方向键目前只是附加兼容输入。
  - 击杀掉经验 -> 拾取 / 吸附 -> 升级三选一链路已成立。
  - 品质五档、品质权重与升级价值公式已存在。
  - `battle` 家族已覆盖普通 / 精英 / 生存三类模板。
- 审计后确认的近似项：
  - 地图推进是轻量 STS2 风格分支，但仍基于当前 `battle / upgrade / event` 节点口径。
  - 最终战会稳定收尾于 final battle，但仍是高压 `battle template` 近似，不是独立 Boss 关语义。
  - 异常关目前更接近低频 event / rare event，而不是玩家可感知的独立 `anomaly` 关。
  - 精英行为已有 `frontline / screened / kiting / summoner`，但只是接近“反向移动 + 护卫挡前”的读数。
- 审计后确认的明显偏离项：
  - `NodeType` 仍未扩到 `boss / battle / upgrade / anomaly`。
  - 基础敌人仍以 `regular / escort / elite` 组织，尚未形成四类明确基础小怪口径。
  - 当前没有真正独立的远程敌种与弹道体系。
- 本轮已直接修正的低风险问题：
  - 升级选择器与运行态现已按 `sourceId` 执行单局唯一，不再因 `repeatable` 元数据重复发放已拿过的强化。
  - 三流派 route 强化现已显式设定最低品质为绿，不再从白品池滚出。
- 仍刻意留到下一轮的结构问题：
  - `NodeType` 对齐、Boss 关独立语义、`anomaly` 玩家可感知化。
  - 四类基础小怪与远程怪数据层落地。
  - 生存关最后 `10s` 的显式增压规则。

## 当前边界
### 不再作为主线的内容
- 页面 UI 结构改版
- 更大关卡变化面
- 新系统
- 新战斗模板
- 新节点类型
- 新流派
- 全量正式素材替换
- 正式商业包装页

### 当前允许做的内容
- 节点候选数量与分布规则修正
- `nodes / events / upgrades` 内容批次扩容
- Content Selector 的阶段 / 流派 / build 倾向权重细化
- battle / elite / survival 模板变种补强
- 精英行为变体的数据化扩展
- 构筑导向与 replay 动机增强
- 低频稀有事件 / 低频模板变体 / 后段 rare payoff 内容补充
- 中后段 hybrid / pivot 内容补充
- redirect 机会与内容池比例边界维护
- 压力增长公式与升级价值公式压实
- 商业化测试版文档、埋点与公式口径维护
## 2026-04-05 结构语义最小落地补记
- 当前主循环仍处于“内容与可玩性阶段”，但节点与敌人语义已经开始按最新设计基线收口。
- 节点语义现已显式落到 `battle / upgrade / anomaly / boss`。
- 最终收尾节点现为显式 `boss`；结果页、节点记录与埋点导出会同步记录 `boss` 口径。
- `anomaly` 已是显式节点类型，但底层仍复用现有 `events` 数据池与事件面板，这是本轮保守实现，不是独立 anomaly 子系统。
- 基础敌人数据层现已拆为 `standard / brute / skirmisher / ranged` 四类；`regular / escort / elite` 保留为战斗角色语义。
- 仍保留的近似实现：
  - Boss 仍复用 elite-family battle template 承压，没有独立 Boss 机制树。
  - 生存关“最后 10 秒显式增压”还没有拆成单独公式段，只保留原有平滑压力增长。
