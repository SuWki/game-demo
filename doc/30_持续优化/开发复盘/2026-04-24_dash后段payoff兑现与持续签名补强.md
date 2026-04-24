# 2026-04-24 dash 后段 payoff 兑现与持续签名补强

## 本轮目标

本轮只解决一个主问题：`dash` 路线后段 payoff 兑现与持续签名补强。

取舍依据：

- 以 `doc/00_接手入口/当前交接卡.md`、`doc/20_设计闭环/设计基线与约束.md`、`doc/20_设计闭环/版本目标与验收标准.md` 为当前阶段真相。
- 以 `doc/40_AI协作/三文档评审与下一步开发建议.md` 和 2026-04-24 两篇最新复盘为最近开发判断。
- 上一轮已经补过 `dash` 前中段内容密度、第三轮收束和 `finalPrep` 分发边界，所以这轮不该再回到大规模内容扩容或 selector 微调。

本轮不做：

- 不重写 `RunEngine`
- 不重开主流程
- 不再补 `dash starter`
- 不开新音频系统
- 不做大规模 `nodes / upgrades / anomaly` 扩容
- 不做满屏常驻重特效

## 实际修改了哪些文件

代码：

- `src/data/upgrades.ts`
- `src/data/nodes.ts`
- `src/systems/RunEngine.ts`
- `src/scenes/GameScene.ts`
- `src/systems/PilotAudio.ts`
- `src/game/types.ts`

文档：

- `doc/00_接手入口/当前交接卡.md`
- `doc/10_设计文档/表现与反馈设计.md`
- `doc/10_设计文档/音频与音效设计.md`
- `doc/30_持续优化/开发复盘/2026-04-24_dash后段payoff兑现与持续签名补强.md`

## 为什么先改这些

当前 `dash` 的问题已经不是“抽不到”或者“内容不够”，而是：

- 后段牌拿到后，实际战斗里更像更能活、更能跑，而不像已经成型的回切反打路线。
- `dash` 的局内高光多停留在短暂移动感，缺少一眼能认出的后段兑现签名。
- 和 `pierce` 对比时，`dash` 在混战里的听感仍不够独立。

所以这轮优先做三件事：

1. 只改一张桥接和一张后段 payoff，让后段收益更偏“追回主动权”。
2. 在运行时兑现链里，把 `dash` 命中后的 follow-through 从“续一点窗口”改成“短时追回射速、转向和反打权”。
3. 用短窗口视觉和音频把这段收益从代码状态变成玩家能听见、看见的战斗信息。

## 实际改了哪些表现内容

### 1. 后段 payoff 小步补强

- `dash-return-hold`
  - 增加 `dashPulseDamage`
  - 增加 `fireRate`
  - 略抬 `moveSpeed`
  - 略收 `regeneration`
  - 目标：让它从偏生存桥接，转成“借到窗后能立刻反打”的桥接
- `dash-zero-window`
  - 增加 `fireRate`
  - 增加 `moveSpeed`
  - 保留 `dashPulseDamage / dashInvulnerability`
  - 目标：让后段 rare payoff 更明确地兑现“空档被你抢回来了”
- `round-3-upgrade-commit-hold`
  - `dash` 倾向从 `0.34` 提到 `0.58`
  - 目标：只做最小必要微调，让第三轮整备更容易继续站稳 `dash`

### 2. 局内兑现链补强

- 新增 `applyDashDriveHitFollowThrough()`
  - 条件：`dash` 命中且 `dashDriveSec > 0`
  - 行为：
    - 追回一点射速
    - 追回一点转向 burst
    - 追回一点 move boost
    - 追回一点 tempo pulse
    - 近身 / 精英命中时续更多 `dashDriveSec`
  - 目标：玩家换位成功后，下一拍不是“还在飘”，而是“已经追回主动权”
- 精英裂口里补了 `dash` 专属 follow-through
  - 裂口命中时额外给出 fire cooldown 追回、move/turn/recovery 窗口和 pulse
  - 目标：让“裂口开了就冲进去回切”在手感上成立

### 3. `dash` 短窗口视觉签名

- 玩家身边新增短时折返标记
  - 两侧折线
  - 前方回切箭头
  - 收口三角
  - 只在 `dashDrive` 活跃期明显出现，不常驻
- 精英裂口里新增 `dash` 折返反打引导
  - 和 `pierce` 的长 rail、`crit` 的收束括号区分开
  - 更接近“折进去再追回来”，而不是“继续往前压”
- `syncAudioState()` 把 `dashDriveSec / playerTurnBurstSec` 纳入 intensity
  - 避免视觉上已经是 `dash` 高光，音频上下文却还停在普通战斗强度

### 4. `dash` 音频签名

- 没有新增 `AudioCue`
- 只增强现有 `hit / kill` 的 `dash` 分支
  - `hit` 更像低中频擦身回切
  - `kill` 更像追回主动权后的收口
- `hurt / nearMiss / pressure / enemyShot` 不改语义层，不让 `dash` 高光把危险提示盖掉

## 哪些问题被改善了

### build / 静态验证结论

- `npm run build` 通过
- 代码层面已经把 `dash` 后段兑现从“延长窗口”改成“延长窗口 + 追回下一拍”
- 数据层没有重新膨胀成内容扩容轮，只动了 2 张关键牌和 1 个后段节点倾向

### 自然样本结论

- `output/playwright/battle-feel-pass/round20/full-flow/summary.json`
  - `resultSeen = true`
  - `consoleErrors = []`
- 说明这轮没有把菜单 -> 战斗 -> 结算主线打断，也没有回退普通 full-flow

### 定向样本结论

- `output/playwright/battle-feel-pass/round24/dash-targeted-v3/summary.json`
  - `dashPicks = 4`
  - `routeFocusSeen = ['dash']`
  - `maxDashDriveSec = 0.9556`
  - `lateDashWindowMoments = 8`
  - `dashCounterMoments = 3`
- 对应截图：
  - `attempt-1/dash-window.png`
- 说明定向 `dash` 样本里，后段已经能比较稳定出现“窗口被抢回来、回切后继续打”的时刻，不再只是移动手感更快

### 音频观察结论

- `output/playwright/battle-feel-pass/round24/audio-snapshot/audio-debug.json`
  - 仍能看到 `enemyShot / nearMiss / hurt / pressure`
  - 同时主链 `shoot / hit / kill / pickup` 仍正常触发
- 说明这轮补 `dash` 时没有把危险 cue 挤没

## 当前还只是临时状态的部分

- `dash` 的持续视觉签名仍然是程序化线条和短窗口几何，不是正式资产态。
- `dash` 后段 payoff 目前主要靠运行时兑现链和轻量牌效调整，离正式“路线终盘名片”还有空间。
- 音频上 `dash` 已经比上一版更容易和 `pierce` 分开，但还没有形成像正式素材那样一耳朵就能记住的强记忆点。

## 如何验证

执行过：

1. `npm run build`
2. 自然 full-flow
3. 定向 `dash` 样本
4. 额外音频快照

这轮的验证口径：

- 自然 full-flow 看有没有回退主线、普通战回报链和结果页闭环
- 定向 `dash` 样本看后段是否真的出现明确 payoff 时刻
- 音频快照看 `dash` 增强有没有盖掉 `hurt / nearMiss / pressure / enemyShot`

## 当前还剩哪些风险

- 自然样本里 `dash` 后段 payoff 的触发率还需要继续观察，不能只靠一轮定向样本就下结论。
- `dash` 的视觉签名已经更清楚，但在极端高压混战里仍可能不如 `pierce` 那么稳定显眼。
- `Boss` 收尾与 `elite` 裂口目前没有看到回退，但本轮核心不是 Boss，因此仍应继续保持监控。

## 下一轮不该误做什么

- 不要因为这轮补了 `dash`，下一轮又回到大规模 `nodes / events / anomaly` 扩容。
- 不要把问题重新解释成 `finalPrep` 抽法问题，除非自然样本再次证明后段仍频繁发散。
- 不要为了追求更爽，直接把 `dash` 做成常驻重特效或大音量新 cue 堆叠。
- 不要在没有新证据时把本轮扩大成 Boss 专项轮或地图扩写轮。

## 本轮结论

这轮已经把 `dash` 从“后段有牌但不像真成型”往前推了一步：

- 后段 payoff 更像 payoff 了
- 局内短窗口更容易被看见了
- 命中和击杀的 `dash` 听感更容易被分出来了

它还没有到“完全收口”的程度，但已经从“结构上有”变成了“战斗里能感到”。这就是本轮该完成的事。
