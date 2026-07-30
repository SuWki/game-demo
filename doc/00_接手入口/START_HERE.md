# START HERE

## 这份文档是干嘛的

接手项目时第一个要看的文件。看完之后你应该能回答：

- 这是个什么项目，现在做到哪一步
- 接下来该做什么、不该做什么
- 该读哪些文档、改哪些代码、怎么验证

## 项目简介

一个用 `Phaser + TypeScript + Vite` 写的网页端短局自动射击原型。玩家手动走位、自动开火，一局 8 到 12 分钟，走完五个节点后打 Boss。核心验证点是 `crit / pierce / dash` 三条流派路线能不能让玩家愿意马上再开一局。

## 一局流程

开始页 → 进入一局 → 普通战 / 精英战 / 生存战 → 节点选择 → 强化选择 → 异常事件 → 最终整备 → Boss 战 → 结果页 → 重开

## 当前阶段

- 阶段：`1.0 第一阶段后半段`
- 状态：可运行、可继续开发，从「能玩」往「值得反复玩、能写进求职作品」推进
- 当前重点：核心体验验收、路线成型、表现层信息清晰、求职作品素材整理

最近三次重要改动：

- `2026-07-27` RunEngine 第三轮拆分。新增 `PressureWindowController.ts`（845 行）和 `DashMomentMonitor.ts`（91 行），RunEngine 从 9622 行降到 8711 行。`SafeZoneHost` / `DashMomentHost` / `PressureWindowHost` 三套接口委托跑通，`tsc --noEmit` 通过。
- `2026-07-27` P0/P1 修复。补全 `EnemyState.slowSec` 死字段（之前只写不读），让 Dash 路线的减速效果真正生效；把暴击命中被动逻辑从 RunEngine 内联代码迁到 `CritRoutePassive.applyCritPassiveOnHit`，作为唯一逻辑入口；给 `balance.ts` 加了 11 个 Crit 路线命名常量替代魔法数字。
- `2026-07-06` 表现层增强。Boss 入场加了暗化加名字横幅，升级面板选中卡牌加了闪光与音效，击杀连击大于等于 3 时屏幕右上角显示金色连击数。

## 当前主要待办

主问题已经从「路线单点补强」转到「整局体验顺不顺、清不清楚、想不想再开一局」。重点关注：

- 普通战的「击杀 → 掉落 → 吸附 → 升级 → 继续追击」回报链顺不顺
- 移动、开火、命中、击杀、拾取是不是连成一气的身体感
- `shoot / hit / kill / pickup / hurt / nearMiss / pressure / enemyShot` 八个音效在混战里能不能分开
- `crit / pierce / dash` 三条路线是不是真的靠多张牌搭出来，而不是一张高价值牌就杀穿
- 精英战和 Boss 战是不是考验不同路线的解法，而不只是血更厚
- 背景、路线特效、Boss 安全区、敌弹、XP 球是不是同时能看清，不互相抢
- 镜头、全屏闪、边框脉冲会不会让人晕
- 玩家可见文字不能有乱码、英文占位或过度技术化

## 当前已确认状态

截至 `2026-07-27`：

- 主流程跑通：菜单、战斗、节点、升级、异常、最终整备、Boss、Boss 收尾、结果页都接通了
- 预览素材部分接入，不再是纯测试占位，但要继续防背景和特效干扰画面
- 镜头预测偏移、抖动、穿梭缩放、连杀边框缩放都已经收回来，等人工实机确认晕不晕
- 关卡选择前的「进度条感」装饰已经换成「下一站 / 选择规则」说明
- `crit / pierce / dash` 已经有 `starter / bridge / payoff / finisher` 四层结构、路线牌上限、价值审计、敌人状态标记和 11 张关键牌真实机制
- 路线价值审计硬违规 0、超预算 0，但这只说明预算健康，不代表三路线体验已经做完
- 仍需人工实机回答：第几张路线牌开始成型、是不是 1 到 2 张牌就杀穿精英或 Boss、`pierce` 蓝色裂纹看得清不清、`crit` 是不是还明显比另外两条强
- Boss 安全区、区外惩罚、区内清弹和 Boss 氛围层都已接入，但「压力大但公平」仍需人工验证
- 强制 Boss / debug 战斗入口不再把 `[DEBUG]` 写进玩家 HUD
- 玩家周围不再画常驻路线线条、冷却条、光环或大型圆环；敌方瞄准线、Boss 安全区、精英护卫关系线、近失/受击方向属于战斗信息，不能误删
- 路线牌描述已经通过 `ROUTE_DESCRIPTION_OVERRIDES` 做统一覆盖，新增路线牌必须写清「触发条件 + 实际收益」

### 还没做完的几件事

- 路线成型验收：确认三路线是不是真的靠多张牌组合，而不是单张高价值牌就成路线
- 关卡和敌人职责：普通战、精英战、生存战、Boss 战要给玩家不同任务，不能都只是清怪
- 操控和舒适度：移动、拾取、镜头、背景、全屏反馈要先过人工体感，再继续加表现
- 表现层画面：路线特效、Boss 安全区、敌弹、XP 球、背景贴片不能混成视觉噪音
- 求职作品素材：要能展示「问题 → 设计假设 → 改法 → 验证数据/截图 → 复盘」的链路，不能只放最终画面

## 三条路线

- `crit` 暴击路线：升温、爆发、连续命中后集中输出
- `pierce` 穿透路线：拆线、贯穿、拉轨、清线和回收
- `dash` 穿梭路线：换位、擦身、蓄能反击和节奏循环

路线不是开局锁死，而是：前段给方向 → 中段立住 → 后段爆发 → Boss 战验证

## 当前页面范围

已经存在可以继续打磨：

- 开始页
- 战斗 HUD
- 节点选择页
- 强化选择页
- 异常事件页
- 最终整备页
- 结果页

明确不要擅自新增：

- 设置页、商店页、图鉴页、背包页
- 常驻装备栏、常驻技能树
- 长剧情对话页、大型统计报表页

## 代码地图

主入口：`src/main.ts`

场景：

- [MainMenuScene.ts](file:///d:/codex/codex/auto-shooter-demo/src/scenes/MainMenuScene.ts)：开始页、开始按钮、导出入口
- [GameScene.ts](file:///d:/codex/codex/auto-shooter-demo/src/scenes/GameScene.ts)：主战斗场景、输入、渲染、HUD 同步、调试面板同步
- [ResultScene.ts](file:///d:/codex/codex/auto-shooter-demo/src/scenes/ResultScene.ts)：结果页、重开、返回菜单

系统：

- [RunEngine.ts](file:///d:/codex/codex/auto-shooter-demo/src/systems/RunEngine.ts)：单局主循环、战斗、节点、升级、异常、路线、结果。已完成三轮拆分，从 9622 行降到 8711 行
- [PilotAudio.ts](file:///d:/codex/codex/auto-shooter-demo/src/systems/PilotAudio.ts)：程序化音乐、SFX、ducking、cue 上下文、音频快照
- [MetricsTracker.ts](file:///d:/codex/codex/auto-shooter-demo/src/systems/MetricsTracker.ts)：埋点和导出
- [MetaProgression.ts](file:///d:/codex/codex/auto-shooter-demo/src/systems/MetaProgression.ts)：局外轻量统计

### 子系统目录

- `src/systems/spawn/` — 敌人生成（PressureCurve + EnemySpawner + SpawnPatternEngine）
- `src/systems/combat/` — 战斗（DamageCalculator + BulletSystem + CombatResolver + DashSystem）
- `src/systems/route/` — 路线（RouteManager + CritRoutePassive + PierceRoutePassive + DashRoutePassive + RouteProgression）
- `src/systems/progression/` — 成长（KillStreakSystem + ExperienceSystem + UpgradeEngine）
- `src/systems/ai/` — AI（EnemyAI + EliteBehavior + BossBehavior）
- `src/systems/state/` — 状态工厂（BattleStateFactory + RunStateFactory）
- `src/systems/battle/` — 战斗纯函数和控制器（pressureSafeWindowMath + resultAnalysis + SafeZoneController + PressureWindowController + DashMomentMonitor）

UI：

- [OverlayController.ts](file:///d:/codex/codex/auto-shooter-demo/src/ui/OverlayController.ts)：HUD、选择面板、异常面板、结果页、toast
- [BattleDebugPanel.ts](file:///d:/codex/codex/auto-shooter-demo/src/ui/BattleDebugPanel.ts)：调试面板
- [style.css](file:///d:/codex/codex/auto-shooter-demo/src/style.css)：DOM UI 视觉样式

数据：

- [balance.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/balance.ts)：数值公式、经验、磁吸、移动、路线参数（含 11 个 Crit 路线命名常量）
- [battleTemplates.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/battleTemplates.ts)：普通战、精英战、生存战、Boss 战模板
- [nodes.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/nodes.ts)：节点推进
- [upgrades.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/upgrades.ts)：强化定义
- [events.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/events.ts)：异常事件
- [contentSelectors.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/contentSelectors.ts)：内容分发权重
- [routes.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/routes.ts)：路线定义
- [enemyArchetypes.ts](file:///d:/codex/codex/auto-shooter-demo/src/data/enemyArchetypes.ts)：普通敌家族

类型：

- [types.ts](file:///d:/codex/codex/auto-shooter-demo/src/game/types.ts)：核心共享语义。改这里必须同步文档

详细架构见 [技术架构总览.md](file:///d:/codex/codex/auto-shooter-demo/doc/00_接手入口/技术架构总览.md)。进度跟踪见 [当前交接卡.md](file:///d:/codex/codex/auto-shooter-demo/doc/00_接手入口/当前交接卡.md)。

## 最常改的地方

- 战斗手感和回报链：`RunEngine.ts`、`GameScene.ts`、`balance.ts`、`PilotAudio.ts`
- 音效反馈：`PilotAudio.ts`、`GameScene.syncAudioState(...)`、`RunEngine` 的 cue 触发点
- UI 和页面表达：`OverlayController.ts`、`style.css`、`MainMenuScene.ts`、`ResultScene.ts`
- 路线成型：`contentSelectors.ts`、`upgrades.ts`、`events.ts`、`nodes.ts`
- Boss 和精英压力：`battleTemplates.ts`、`RunEngine.ts`、`GameScene.ts`、`PressureWindowController.ts`

## 不要轻易做的事

- 不要改已拆分出的子系统接口（`RouteManager` / `*RoutePassive` / `PressureWindowController` / `DashMomentMonitor` / `SafeZoneController`），除非同步更新所有调用方
- 不要重开主流程
- 不要把项目改成复杂大地图
- 不要新增没有验证价值的大系统
- 不要一次性新增大量 `AudioCue`
- 不要引入复杂音频中间件
- 不要一次性全量替换图片资源
- 不要把手感问题转成说明型 UI 问题
- 不要只改代码不更新文档

## 推荐阅读顺序

第一次接手按这个顺序读：

1. [当前交接卡.md](file:///d:/codex/codex/auto-shooter-demo/doc/00_接手入口/当前交接卡.md)
2. [项目总览.md](file:///d:/codex/codex/auto-shooter-demo/doc/00_接手入口/项目总览.md)
3. [技术架构总览.md](file:///d:/codex/codex/auto-shooter-demo/doc/00_接手入口/技术架构总览.md)
4. [完整体验设计方案.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/完整体验设计方案.md)
5. [核心循环设计.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/核心循环设计.md)
6. [战斗与首领设计.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/战斗与首领设计.md)
7. [流派路线设计.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/流派路线设计.md)
8. [表现与反馈设计.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/表现与反馈设计.md)
9. [音频与音效设计.md](file:///d:/codex/codex/auto-shooter-demo/doc/10_设计文档/音频与音效设计.md)
10. [设计基线与约束.md](file:///d:/codex/codex/auto-shooter-demo/doc/20_设计闭环/设计基线与约束.md)

提示词协作规则：

- 后续给开发 GPT 的提示词默认直接在对话里给
- 不再新增「提示词文档」
- 需要沉淀到文档的，只写项目事实、设计约束、验收标准和开发复盘

## 每轮开发流程

1. 先读 `START_HERE.md` 和 `当前交接卡.md`
2. 本轮只解决一个主问题
3. 阅读对应专题设计文档
4. 先用中文说清楚：当前项目是什么、当前阶段、本轮要解决什么、不做什么、准备改哪些文件
5. 再改代码
6. 至少跑 `npm run build`
7. 按任务性质做 full-flow、debug 面板、音频快照或截图验证
8. 更新 `当前交接卡.md`
9. 如果设计边界变化，同步更新 `10_设计文档` 与 `20_设计闭环`

## 验证最低标准

任何开发完成后，至少要说明：

- `npm run build` 是否通过
- 是否跑过 菜单 → 战斗 → 节点 / 强化 / 异常 / 整备 → Boss / 结果页 完整流程
- 是否有 `consoleErrors`
- 如果改战斗手感，说明移动、开火、命中、击杀、拾取链条是否改善
- 如果改音频，说明 `shoot / hit / kill / pickup / hurt / nearMiss / pressure / enemyShot` 是否更可辨
- 如果改路线，说明 `crit / pierce / dash` 是否有回退
- 如果改精英或 Boss，说明是否做过定向调试样本

## 接手后第一句话应该回答什么

新接手的人应该先用中文回答：

- 这是一个 Phaser + TypeScript + Vite 的短局节点推进自动射击原型
- 当前处于 `1.0 第一阶段后半段`，核心循环和核心战斗打磨
- 本轮我会先确认当前主问题，再只解决一个明确问题
- 我不会重写已拆分出的子系统接口、不会重开主流程、不会扩无关大系统
- 我会先读本轮相关文档，再说明计划，再改代码，最后验证并更新交接卡
