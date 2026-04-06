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

## 2026-04-06 0.9v Boss phase 行为身份更新
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不是再补“有没有 phase”，而是补“phase 是否已经有行为身份”。
- 当前 Boss 的阶段行为口径现已更新为：
  - `boss-hunt`：`接敌(frontline) -> 逼近(screened) -> 收束(frontline)`
  - `boss-lockdown`：`接敌(kiting) -> 封位(screened) -> 锁场(frontline)`
  - `boss-bastion`：`接敌(screened) -> 交火(summoner) -> 火线收束(kiting)`
- 当前实现里，`updateEliteEnemy(...)` 已不再固定读取模板基准行为；Boss 主核会按当前 phase 的行为身份真正切换移动方式。
- HUD 战况子读数也会同步显示当前主核行为口径，因此 phase 差异不再只停留在后台参数层。
- 当前阶段的主要剩余风险更新为：
  - Boss 的阶段行为差异虽然已经落到运行层，但仍复用旧的 `frontline / screened / kiting / summoner` 行为谱系。
  - 如果后续玩家 burst 或机动继续上涨，最终关仍可能需要更明确的 phase 专属压力兑现，而不只是继续沿旧行为谱系微调。

## 2026-04-05 0.9v 读数 / 压力校准更新
- 当前阶段判断更新为：项目已进入 `0.9v` 早期常规开发中的“读数 / 压力校准阶段”。
- 本轮源头口径明确为：`DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md`。
- 本轮新增的稳定实现：
  - `boss / elite` 模板已补入轻量 `pressurePhases`，压力不再只靠高血、护卫和通用刷怪加速成立。
  - 最终 Boss 现在会通过 `HP 阈值 / 剩余时间阈值` 进入不同压力段，HUD 会显示当前阶段读数。
  - `anomaly` 池继续保持独立于普通 event 池，并额外补入“代价 / 扭曲 / 混搭”导向的 anomaly 条目，避免再次退化成普通 route push。
  - 过于普通 event 化的 `relay-splice / route-handoff` 已降到次级 anomaly 入口，不再主导 anomaly 识别感。
- 当前阶段的主要剩余风险：
  - Boss 阶段压力已经有了结构入口，但自然玩家 burst 继续上涨后，是否还需要第二轮节奏雕刻，仍要靠真实跑局样本验证。
  - anomaly 的内容质量已经比前一轮更像 anomaly，但自然浏览器自动化样本仍偏容易死在中段，后续还需要继续结合真实玩家样本看记忆点是否足够稳。

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
- `boss` 现已拥有独立的 Boss 模板承载入口；最终节点只会从 `boss-hunt / boss-lockdown / boss-bastion` 模板池抽取，不再直接落回 elite-family 模板 ID。
- `anomaly` 已是显式节点类型；当前异常节点只会从带 `contentKind: anomaly` 的内容池抽取，并在面板标题与埋点里继续保持 `anomaly` 口径。
- 基础敌人数据层现已拆为 `standard / brute / skirmisher / ranged` 四类；`regular / escort / elite` 保留为战斗角色语义。
- 仍保留的近似实现：
  - Boss 仍复用现有 elite 风格胜利条件与大部分战斗机制，没有独立 Boss 机制树。
  - anomaly 仍复用现有事件面板与效果结算流，不是独立 anomaly 子系统。
  - 生存关“最后 10 秒显式增压”还没有拆成单独公式段，只保留原有平滑压力增长。

## 2026-04-05 0.9v Boss / Anomaly 首批内容补记
- 当前阶段判断更新为：恢复收口已完成，项目可以按 `0.9v 内容与可玩性开发` 继续推进。
- 本轮不再补“恢复语义”，而是沿已经切开的 `boss / anomaly` 新载体补第一批专属内容。
- Boss 侧新增的首批专属承载：
  - 最终节点不再统一显示成泛 `最终 Boss`，而是会明确落成 `追猎主核 / 锁域主核 / 屏卫主核` 三个 Boss 节点入口。
  - Boss HUD / 进入提示 / 结果页收尾节点会继续沿具体 Boss 名称工作，避免后续内容再次退回“更强 elite”口径。
- anomaly 侧新增的首批专属内容：
  - 新增 anomaly 专属事件：`相位裂缝`、`载体失真`、`Boss 阴影扫描`。
  - mid / late 节点池新增 anomaly 节点蓝图：`相位裂缝`、`Boss 阴影`，让异常节点本身也更像独立内容线，而不是普通 event 占位符。
  - anomaly 内容分发现在显式走独立 anomaly catalog，而不是继续从合并事件池临时过滤。
- 仍保留的复用边界：
  - Boss 仍复用 battle 结算与大部分现有承压规则，本轮没有继续扩 Boss 专属系统。
  - anomaly 仍复用 event 面板与 effect 结算，本轮重点是把内容站位与内容入口立住。

## 2026-04-05 0.9v 战斗层读数补记
- 本轮不再处理“是否已有四类基础敌人 / 是否已有 boss-anomaly 载体”这类恢复期问题；这些语义已在代码中成立，当前重点转为 0.9v 战斗读数强化。
- 当前战斗层的最新判断是：
  - `regular / escort / elite` 继续保留为战斗职责层语义。
  - `standard / brute / skirmisher / ranged` 才是基础敌人 archetype 语义。
  - `boss / anomaly` 载体继续保留独立 node / template / content lane，但底层仍复用既有 battle / event 结算。
- battle 模板本轮进一步拉开 archetype ownership：
  - `elimination / elimination-pincer` 更强调 `standard + skirmisher` 的前段快压与侧压。
  - `elimination-sweep / survival-gauntlet` 更强调 `brute` 的厚体推进。
  - `elite-screen / survival-crossfire / boss-bastion` 更强调 `ranged` 火线与护卫遮线。
  - `elite-lockdown / boss-lockdown` 更强调 `skirmisher + escort` 的封位与反拉压迫。
- HUD 现会直接显示：
  - encounter 口径，例如 `普通战 / 精英战 / 生存战 / Boss载体`
  - 模板读数摘要，例如 `敌群 / 节奏 / 护卫 / 主核行为`
- 结果页收尾节点现会显式显示 `节点类型 + 节点标题`，例如 `Boss · 锁域主核`，避免 0.9v 常规开发时再次被旧 `elite` 语义稀释。
- 本轮仍刻意不做的深改：
  - 不新增独立 Boss AI 树。
  - 不新增 anomaly 子系统。
  - 不重写战斗主流程或 RunEngine。

## 2026-04-05 0.9v 战斗读数与升级池修正补记
- 当前项目维持在 `0.9v 常规开发阶段`，本轮优先级不是补普通内容量，而是修正战斗读数、压缩交互遮挡、稳住 Boss/anomaly ownership。
- 普通升级三选一现已从普通节点整备 selector 中切开，改为独立 `levelUp` 发牌逻辑：
  - 结构为 `2 个通用强化 + 1 个弹性槽`
  - 普通升级中最多只出现 `1` 个路线强化
  - 流派 buff 的出现率低于一般属性强化，一般属性强化重新回到升级池主干
- anomaly 路线强化现已从普通事件/升级口径中拆出，独立收纳到 anomaly route pool；后续 anomaly 路线内容应继续沿 anomaly lane 扩写，而不是反向污染普通升级池。
- 玩家可见 UI 本轮继续去设计语气：
  - 节点卡、异常面板、升级面板、HUD 提示优先显示功能性说明
  - 不再把内部设计性 blueprint / event 描述直接泄露给玩家
- 战斗可读性本轮重点修正为：
  - 顶部 HUD 压缩为更轻的 top rail
  - 战斗中常规 toast / 横幅抑制
  - 经验球绿色、敌方子弹红色
  - Boss / elite 增加最小抗 burst 承接，避免继续被瞬秒
- 当前最大风险更新为：
  - 普通升级读数已经更健康，但 route 信号也更克制；后续要继续观察自然跑局里是否会出现“过于通用化”的反向稀释。
  - Boss / elite 当前主要靠模板参数和 guard 窗口稳住强度，还不是完整的阶段机制体验。

## 2026-04-06 0.9v Boss 抗 burst 切段补记
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮源头口径继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准，不回退到恢复期，也不提前进入纯内容堆量。
- 本轮确认的问题不是“Boss 没有阶段”，而是“已有 `pressurePhases` 在高 burst 下仍可能被压平”：
  - 同一轮检查里连续跨过多个阈值时，阶段可能被连跳。
  - 切段后主要只有后台参数变化，玩家不一定能稳定感到进入了新段。
- 本轮已落地的强化：
  - Boss phase 现在新增最小驻留时间，避免刚切段就被下一段阈值立刻吞掉。
  - Boss phase 切换时会补一小段过渡 guard 与一次即时护卫兑现，让“转段”不是只存在于参数层。
  - HUD 子读数会在切段瞬间使用 `转段` 口径，战场上也会出现轻量脉冲圈提示，帮助玩家感知最终关进入新压力段。
- 当前仍保留的边界：
  - 这轮仍然没有做硬锁血或独立 Boss 系统。
  - Boss 仍复用 battle 主流程，当前做的是“模板层切段稳定化”，不是重写最终关机制树。
- 当前主要剩余风险更新为：
  - Boss 切段现在更不容易被高 burst 直接压成一条直线，但如果后续玩家爆发继续上升，最终关仍可能需要更强的“阶段内行为差异”，而不只是模板层承接。

## 2026-04-06 0.9v Boss phase 专属压力签名更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“是否有 phase”或“phase 是否有行为身份”，而是补“phase 是否已经拥有可感知的专属压力签名”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in`：补入 `逼近压线`，以短时护卫脉冲把“压线逼近”从后台参数变成可见压力段。
  - `boss-lockdown / pin-down`：补入 `护卫封位`，以更短周期的护卫补位把封位段和普通 `screened` 变体拉开。
  - `boss-bastion / crossfire`：补入 `火线齐射`，用短窗齐射把“交火段”做成更明确的远程压制期。
- 当前实现里，Boss phase 除了复用已有 `frontline / screened / kiting / summoner` 行为谱系外，还会在 phase enter 后触发独立 signature window；HUD 读数与主核外圈也会同步显示该 signature。
- 当前阶段的主要剩余风险更新为：
  - phase signature 已经落地，但仍复用现有护卫刷新与敌方弹道系统，不是独立 Boss 行为树。
  - 如果后续玩家 burst 与机动继续上涨，下一轮更可能需要补“phase 内空间压迫/节奏模式”的更强签名，而不是继续调血量。
