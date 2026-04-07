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
- 当前执行焦点：0.9v 三流派收口 + 内容扩写与结构分层推进 + Boss 远程后段回归监控

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
- `boss-bastion / fireline` 在普通 build 下的自然覆盖率仍偏低，Boss 远程后段还需要继续观察
- 整局完整感虽然已经开始收口，但如果后续只继续补局部内容，不持续维护 `start -> node -> anomaly -> final prep -> boss -> result -> replay` 的承接，仍会重新退回“局部强、整局薄”
- 基础音效已完成首轮覆盖，但当前仍是轻量 cue 层；如果后续继续叠加而不控频，容易重新变吵
- 中文乱码与内部设计话术重新泄露到玩家可见文本

## 2026-04-08 0.9v 验收前修边更新
- 当前阶段判断更新为：项目已从“内容扩写与结构分层主线”切到“验收前修边主线”。
- 这不意味着项目已经完全封版，而是说明当前主线收益最高的工作已经从“继续扩写内容”转成：
  - 普通 build 回归校准
  - 最终关单点风险修正
  - 全链路可跑通与 readable 验收
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 的普通样本可见度继续抬升，当前自然样本为 `4 / 8`。
  - `boss-bastion / fireline` 在普通样本中已从 `0 / 8` 抬到 `1 / 8`，说明远程后段不再只由高 burst / 高机动样本承接。
  - `fireline` 现在补上了自己的轻量进段确认，但仍继续复用既有 `signature + pattern + pocket` carrier，没有引入新的 Boss 系统层。
- 当前更适合继续做：
  - 普通 build 的自然样本复检
  - 结果页 / replay / Boss 收尾读数的验收前复查
  - 持续维护 Boss / anomaly / template ownership 边界
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍然不是高频样本，最终关远程后段仍需继续监控。
  - 如果后续再回到“只前置时间阈值”或“只堆血拖长战斗”，容易破坏已经成立的高 burst / 高机动样本和最终关层次。

## 2026-04-07 0.9v 三流派收口更新
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“内容扩写与结构分层阶段”。
- 本轮主线已从 anomaly / template 单点扩写切到：
  - 暴击 / 穿透 / 穿梭三流派的 `0.9` 收口
  - 路线与 anomaly / battle template / boss 收尾关系澄清
  - `boss-bastion / fireline` 普通 build 覆盖率继续回归监控
- 当前最新进展：
  - 三流派各自补入了一张更像中后段承接的 route payoff：
    - `热区压缩`
    - `贯层回响`
    - `回切反打`
  - `热区记录 / 裂轨图谱 / 穿梭记忆` 已从普通 `event` 口径并回 anomaly lane，不再只是 route 奖励分发。
  - opening / mid / late 的 battle carrier 与 final boss 收尾入口，现在已开始按主路线做轻量 route-fit 倾向：
    - `crit` 更偏 `追猎主核`
    - `pierce` 更偏 `屏卫主核`
    - `dash` 更偏 `锁域主核`
  - 这层倾向当前仍是“轻量偏置”，不是硬锁单一路线。
- 当前更适合继续做：
  - 三流派在自然 run 中的 payoff 兑现样本验证
  - anomaly 与路线关系的第二轮深挖
  - template family 在路线 closeout 后的自然 run 读数复检
  - `boss-bastion / fireline` 普通 build 覆盖率继续观察
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍偏少见
  - route-fit 现在已经存在，但后续如果继续补大量泛用内容，不守住 route carrier 倾向，三流派仍可能重新掉回“能玩但不够像三条路”
  - route payoff anomaly 已回到 anomaly lane，但异常池后续若再次被普通路线奖励内容挤占，anomaly 识别感仍可能被稀释

## 2026-04-07 0.9v 内容扩写与结构分层更新
- 当前阶段判断更新为：项目已从 `0.9v` 的“读数 / 压力校准阶段”切到“内容扩写与结构分层阶段”。
- 本轮主线不再继续深挖单点 Boss pocket，而是转入：
  - anomaly 深度扩写
  - battle template 家族分层强化
  - 整局内容密度与阶段层次拉开
- 当前最新进展：
  - anomaly 现在新增了 `anomalyClass` 轻量口径，能够把 `routeWindow / distortion / hybrid / bossEcho` 区分开。
  - 新增 anomaly 内容：`断层竞价`、`幽栅并轨`、`终端税`。
  - 一批更工具化的 anomaly 已降权为支持层入口，不再主导 anomaly 主味道。
  - opening / mid / late 新增了更明确的 battle 承载点：
    - `厚线突围`
    - `拖场绞锁`
    - `尾段突压`
  - `elite-vice` 已真正进入中段节点候选，不再只是数据层孤立 rare 模板。
  - 节点卡和 anomaly 面板现在会显示更具体的玩家向描述，不再把不同内容都压成同一种占位说明。
- 当前更适合继续做：
  - anomaly 池的第二轮深度扩写
  - template family 的自然 run 样本验证
  - 三流派在新内容密度下的收束节奏校准
  - `boss-bastion / fireline` 普通 build 覆盖率继续监控
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 的自然覆盖率仍偏低
  - anomaly 虽然已经更像 anomaly，但 route-window 内容后续若回涨过多，仍可能再次稀释异常识别感
  - template layering 已经拉开第一轮，但后续如果只补参数，不继续维护节点分发与读数口径，仍可能重新掉回“同模板不同档位”

## 2026-04-07 0.9v 流程完整度推进更新
- 当前阶段判断更新为：项目已开始从 `0.9v` 的“读数 / 压力校准阶段”切入“流程完整度推进阶段”。
- 本轮不再继续深挖单点 Boss pocket，而是优先把一整局的前段 / 中段 / 后段 / final prep / boss / 结算 / replay 承接收口。
- 当前最新进展：
  - `opening / mid / late / finalPrep / finalBattle` 的节点面板说明已按阶段重写，不再只是泛“选择下一站”。
  - `round 2 / round 3` 的节点出牌现在更稳定给出 `2~3` 选，并提高 anomaly 露出率，让整局更像一条完整 run，而不是零散 panel 串联。
  - `PilotAudio` 已补齐 `start / confirm / anomaly / boss / victory / defeat / result` 首轮 cue，并接到开始、节点确认、异常、Boss、胜负与结果页。
  - `CORE_LOOP.md` 顶部摘要已经同步改回 `battle / upgrade / anomaly -> final prep -> boss -> 结算 -> replay` 的最新口径。
- 当前更适合继续做：
  - 自然 run 的整局节奏样本验证
  - 基础音效的第二轮去噪与素材替换准备
  - 普通 build 下 `boss-bastion / fireline` 覆盖率继续观察
- 当前最大风险更新为：
  - 远程 Boss 后段的普通 build 覆盖率仍然是最大未收口点
  - 当前音效仍属于“基础反馈闭环”，不是最终音频表现层
  - 如果后续内容扩写只顾局部，不继续维护整局承接，流程完整感仍会再次被稀释

## 2026-04-07 0.9v 远程 pocket 自然成立性校准
- 当前阶段判断继续保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 当前焦点已从“pocket 是否存在”进一步推进到“自然 build 样本里，pocket 转场决策是否足够常见”。
- 当前最新进展：
  - `boss-bastion / fireline` 已不再只依赖 targeted probe 证明成立
  - 在自然 build + 指定 `boss-bastion` 收尾样本里：
    - `highBurst` 已能看到 `fireline`
    - `highMobility` 已能看到 `fireline`
    - 两者都已出现 `edgeBounce + centerReset`，并出现真实转场决策窗口
  - `crossfire` 继续稳定承担远程前段主味道，没有被本轮校准抹平
- 当前更适合继续做：
  - 普通 build 下的 `fireline` 覆盖率校准
  - `crossfire -> fireline` 的轻量承接优化
  - battle readability 与 Boss / elite / final battle ownership 边界维护
- 当前最大风险更新为：
  - `fireline` 的自然成立性已经比上轮更稳，但普通 build 下仍偏少
  - 如果后续高 burst / 高机动继续上涨，而普通样本覆盖率又补不上，最终关远程后段仍可能再次被读回“交火段成立、收束段偏薄”
  - 因此下一步更需要的是普通样本覆盖率与自然承接校准，而不是继续堆血、堆怪或引入新系统

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

## 2026-04-06 0.9v Boss phase 内空间压迫 / 节奏模式更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“是否有 signature”，而是补“phase 内是否已经有稳定的压迫模式”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in`：补入 `纵压驱进`，通过上/下沿的压进波把“逼近段”变成更明确的纵向挤压期。
  - `boss-lockdown / pin-down`：补入 `侧翼夹封`，通过左右侧的封位波把“封位段”变成更明确的侧向走位压缩期。
  - `boss-bastion / crossfire`：补入 `交叉火线`，通过固定周期的交叉齐射把“交火段”变成更稳定的节奏压制期。
- 当前实现里，Boss phase 现在分成两层：
  - `signature window`：负责切段确认
  - `pattern pulse`：负责 phase 内持续的空间压迫 / 节奏模式
- 当前阶段的主要剩余风险更新为：
  - phase 内模式已经落地，但仍建立在现有护卫刷新、敌方投射物与旧行为谱系之上，不是独立 Boss pattern 系统。
  - 如果后续玩家 burst 与机动继续上涨，下一轮更可能需要补的是更强的空间占位 / 安全区雕刻，而不是继续增加血量。

## 2026-04-06 0.9v Boss phase 场地空间雕刻更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“有没有 pattern”，而是补“phase 内危险区 / 安全窗是否已经真正成立”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in / 纵压驱进`
    - 现在会打开一条纵向安全走廊
    - 走廊外由上/下沿壁射与厚体 escort 波共同压缩
  - `boss-lockdown / pin-down / 侧翼夹封`
    - 现在会打开一条横向安全走廊
    - 走廊外由左/右侧壁射与高速 escort 波共同封边
  - `boss-bastion / crossfire / 交叉火线`
    - 继续保留为节奏压制型 phase，不额外扩成安全窗系统
- 当前实现里，Boss phase 现在已经分成三层：
  - `signature window`：确认切段
  - `pattern pulse`：维持 phase 内模式
  - `safe / danger carving`：把 laneCrush / sideClamp 进一步落成玩家可读的空间结构
- 当前阶段的主要剩余风险更新为：
  - 安全窗雕刻目前只落在 `boss-hunt / boss-lockdown` 两个 phase 上，`boss-bastion` 仍主要依赖节奏火线成立。
  - 如果后续高 burst / 高机动构筑继续上涨，下一步更可能需要的是：
    - 继续验证真实玩家样本下的空间读数是否稳定
    - 或为 `crossfire` 一类远程 phase 补更明确的空间口袋
    而不是继续加血或加怪。
## 2026-04-06 远程 phase 状态补充
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 已从“节奏火线”推进到“远程空间口袋”。
  - 远程 phase 现在可以在场地内形成短时安全袋与四周危险区，而不再只靠齐射和护卫节奏成立。
  - 远程 pocket 继续复用现有 `pressurePhases / pattern pulse / safe-window` carrier，没有引入新的 Boss 系统层。
- 当前更适合继续做：
  - 远程 pocket 的真实玩家样本验证
  - pocket 转场模式与路径多样性维护
  - battle readability 与 Boss / elite / final battle ownership 边界维护
- 当前最大风险更新为：
  - `crossfire` 已经有稳定空间口袋，但 pocket 迁移仍属于轻量模板级实现；如果后续高 burst / 高机动进一步上升，仍要继续观察“玩家是否还需要真实转场决策”，而不是继续加血或堆投射物。
## 2026-04-06 远程 pocket 转场补充
- 当前阶段判断继续保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 已经不再只有单一 pocket 迁移味道，现已能在 `横切 / 回心` 之间切换。
  - `boss-bastion / fireline` 也已接入更短窗的 pocket carrier，当前会以 `压边迁火` 的方式承接后段。
  - 远程 Boss 的 pocket 迁移现在已经开始具备 phase 差异，而不只是同一套锚点循环。
- 当前更适合继续做：
  - 继续观察自然样本里 `fireline` 的 pocket 进入率
  - 补 pocket 转场路径与预判窗口的多样性
  - 持续维护 Boss / elite / final battle ownership 边界
- 当前最大风险更新为：
  - `crossfire / fireline` 已经拉开第一层 pocket shift 差异，但自然 run 中 `fireline` 仍偏后段；若后续高 burst / 高机动再上升，还要继续看“玩家是否真的需要转场决策”，而不是只在 targeted probe 中成立。
