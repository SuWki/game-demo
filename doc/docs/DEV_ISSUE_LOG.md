# DEV ISSUE LOG
## [1.0 第一阶段第 8 轮候选签收复检] commit timing 前推 / freeze 监控回补
### 本轮口径
- 本轮继续按 `1.0 第一阶段第 8 轮候选` 处理，不前推到第 9 轮。原因是最新阶段文档、最新 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 与最新 [DEV_ISSUE_LOG.md](./DEV_ISSUE_LOG.md) 都还把 round8 候选签收列为当前任务，尚无更晚轮次落盘。
- 若旧摘要与当前 docs 冲突，本节开始统一以后续顺序覆盖：
  - 最新阶段文档
  - 最新 [PROJECT_STATUS.md](./PROJECT_STATUS.md)
  - 最新 [DEV_ISSUE_LOG.md](./DEV_ISSUE_LOG.md)
  - [ROADMAP_1_0.md](./ROADMAP_1_0.md)
  - [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md)
- 本轮继续遵守：
  - 不改主流程
  - 不重写 `RunEngine`
  - 不引入新系统
  - 不把内容逻辑写回引擎
  - 不把整轮重新做成 Boss 专项轮 / high-memory 轮 / selector-only 轮

### 文档盘点后的当前判断
- route 侧的主问题已经从“starter 漂移”继续收窄成 `pierce` 的 `bridge -> committed` 坡度仍偏晚。
- `boss-bastion / fireline` 仍是 round8 候选是否签收的主阻塞；允许做轻量 phase handoff 校准，但不允许回退成拖时长或 Boss 主流程改造。
- `crit` 的既有边界仍然是“不能重新被拉成 off-route committed”；docs 没有要求为了 round8 签收把它强行提前锁死。

### 本轮实现
- `src/data/upgrades.ts`
  - 上调 `pierce-core / pierce-rail / pierce-seamline` 的 opening starter emergence
  - 上调 `pierce-fan / pierce-relay-spine / pierce-seamkeep` 的 mid bridge surfacing，并把 `pierce-fan / pierce-relay-spine` 调成更像真实 commit-hold carrier
  - 对 `crit-afterglow / crit-heat-latch` 只做极轻量 bridge surfacing 前推，避免 `crit` 因为本轮只顾 `pierce` 而完全掉回 generic
- `src/data/events.ts`
  - `pierce-ledger-hold` 与 `pierce-seam-anchor` 的 route option 各补一拍 `route` 承接，让 anomaly 真正承担 `bridge -> committed` 的保守前推
- `src/data/nodes.ts`
  - `round-2-battle-pierce-hold / round-2-upgrade-bridge` 做保护性前推
  - `round-2-battle-crit-hold` 只做轻量保护，不把本轮变成 `crit` 专项轮
- `src/data/battleTemplates.ts`
  - `boss-bastion / crossfire`
    - `triggerHpRatio = 0.82`
    - `triggerRemainingSec = 28`
    - `minResidenceSec = 3.2`
  - `boss-bastion / fireline`
    - `triggerHpRatio = 0.72`
    - `triggerRemainingSec = 18`

### 回归结果
- `npm run build`
  - 通过
- 浏览器 route-flow rerun
  - `pierce`
    - 当前样本为 `routeId = pierce / buildStage = matured / firstCommitStage = mid / firstCommitPick = upgrade:pierce-seamkeep`
    - 本轮主阻塞里的 `pierce -> dash hinted` 未再复现
  - `crit`
    - 当前样本仍可能以 `routeId = crit / buildStage = hinted / firstCommitStage = null` 结束
    - 但没有出现 off-route reroute；当前更像 run 提前折损导致 commit 没站满，而不是被别路线抢走主味
- Boss 自然样本复检
  - `normal`
    - `bossBastionRuns = 8 / 24`
    - `crossfireSeenRuns = 3 / 24`
    - `firelineSeenRuns = 0 / 24`
  - `highBurst`
    - `bossBastionRuns = 5 / 24`
    - `crossfireSeenRuns = 5 / 24`
    - `firelineSeenRuns = 2 / 24`
  - `highMobility`
    - `bossBastionRuns = 5 / 24`
    - `crossfireSeenRuns = 4 / 24`
    - `firelineSeenRuns = 1 / 24`

### 当前结论
- `pierce` 的 commit timing 已经前推到 mid，不再主要依赖更后的 late carrier 才能成线。
- `boss-bastion / fireline` 只部分回补：`crossfire` 有抬升，但 `normal firelineSeenRuns` 仍为 `0 / 24`。
- 因此 round8 候选本轮仍不能签收；主原因是 `boss-bastion / fireline`，而不是 `pierce` starter 漂移。

## [1.0 第一阶段第 8 轮候选] opening-to-mid continuity 收口 / no-focus starter 漂移清扫
### 本轮口径
- 若旧摘要仍停在第 7 轮或更早轮次，本轮统一以：
  - 最新阶段文档
  - 最新 `PROJECT_STATUS.md`
  - 最新 `DEV_ISSUE_LOG.md`
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  为准；如冲突，以本节覆盖。
- `0.9v freeze` 继续作为稳定底座；本轮不改主流程、不重写 `RunEngine`、不引入新系统，也不回拉成 high-memory closeout / Boss / telemetry 专项轮。
- 本轮主线前推为：`1.0 第一阶段` 里的“opening-to-mid continuity 收口 / no-focus starter 漂移清扫候选轮”。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - 当前主问题已经不再是 late closeout 或 replay 内容量，而是 opening / mid 的 first beat continuity
  - `redirect hold` 的职责已明确：它是“继续承接当前路线的一拍”，不是纯缓冲
  - `nodePrep / levelUp` 只能继续做轻量 dominant-route protection，仍遵守 `2 通用 + 1 flex`
  - `crit / pierce / dash` 在 opening / mid 的第一拍都应先把自身 starter / bridge 站出来，而不是靠 late carrier 补读法
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - 文档没有要求把 no-focus opening 直接做成强制路由，因此没有把 early game 写成硬锁路线
  - 文档没有要求为了 continuity 再扩 telemetry，因此继续复用现有字段与 route-flow / Boss 脚本
  - 文档没有要求为 round8 再扩 bossEcho / closeout 新入口，因此本轮不把 early-mid 问题重新伪装成 late 内容量问题

### 当前成因判断
- 当前更像“dominant route 已经存在，但 opening / mid 第一拍 continuity 仍不够稳”，而不是 late closeout 再次失效。
- `crit`
  - 主因更像 hinted 后的 mid bridge surfacing 偏低，导致在少数 rerun 里连续空吃泛用牌
  - 不是 reroute-window 再次把它强行带偏
- `pierce`
  - 主因更像 no-focus opening starter emergence 仍会漏拍，导致第一张 route starter 有时不浮出来，或者先被别路 starter 抢味
  - 不是 `pierce -> dash/hinted` 的 redirect 噪音回潮，也不是 late closeout 不够

### 本轮实现
- `src/data/upgrades.ts`
  - 新增 / 补强 continuity carrier：
    - `续热点火`
    - `拆线起幅`
    - `拆缝续程`
  - 上调 `crit-afterglow / crit-heat-latch / pierce-core / pierce-rail / pierce-seamline / pierce-seamkeep` 的 opening-mid 权重
  - 给 `crit-afterglow / crit-heat-latch / pierce-seamline / pierce-seamkeep` 小幅补入 `regeneration`，避免“先站路线”直接吃掉普通样本的基础容错
- `src/data/events.ts`
  - 上调 `crit-ember-hold / pierce-ledger-hold` 的 mid continuity 倾向
  - 新增 `pierce-seam-anchor`，作为 mid 的 `pierce` continuity support anomaly
- `src/data/nodes.ts`
  - opening / mid node route-fit 继续只做保护性微调：
    - `厚线突围`
    - `交错火线`
    - `过渡整备`
    - `转折校准`
  - 目标是让 `crit / pierce` 在 ordinary sample 的 opening-mid 更容易拿到当前线承接
- `src/data/contentSelectors.ts`
  - `levelUp`
    - no-focus opening 的 route starter emergence 明显上调
    - hinted early-mid dominant route 的 bridge surfacing 上调
    - no-focus mid 的 route 倾斜保持保守，不直接写成强制 committed
  - `nodePrep`
    - 延续上一轮的 protection 口径，不额外扩张 selector 职责

### 静态抽样
- `levelUp`
  - `opening-no-focus-levelup`
    - route offer rate 由约 `0.50` 提到约 `0.65`
  - `mid-crit-hinted-levelup`
    - route offer rate 由约 `0.27` 提到约 `0.38`
  - `mid-pierce-hinted-levelup`
    - route offer rate 由约 `0.26` 提到约 `0.39`
- 结论：
  - 本轮主增益不是把 route 卡变多到失控，而是让 current-line starter / bridge 更容易在正确窗口浮上来

### 验证
- `npm run build`
  - 通过
- 浏览器 route-flow rerun：
  - `crit`
    - `routeId = crit`
    - `buildStage = matured`
    - `outcome = victory`
    - `branchSwitchCount = 0`
  - `pierce`
    - `routeId = pierce`
    - `buildStage = committed`
    - `outcome = victory`
    - `branchSwitchCount = 0`
    - 不再复现“被带到 `dash hinted`”
    - 但 `firstCommitStage` 仍偏晚，说明 continuity 改善已经落地，commit timing 仍有残余
  - `dash`
    - 当前 rerun 仍可能落到 `unformed`
    - 符合本轮没有把主线重新拉成穿梭专项轮的边界
- 开场截图复检：
  - `crit / pierce` 当前 rerun 的第一拍都能看见本线 starter，而不是继续靠 redirect 回正
- Boss 监控回归：
  - `normal`
    - `bossBastionRuns = 8 / 24`
    - `crossfireSeenRuns = 2 / 24`
    - `firelineSeenRuns = 0 / 24`
  - `highBurst`
    - `bossBastionRuns = 5 / 24`
    - `crossfireSeenRuns = 5 / 24`
    - `firelineSeenRuns = 2 / 24`
  - `highMobility`
    - `bossBastionRuns = 4 / 24`
    - `crossfireSeenRuns = 3 / 24`
    - `firelineSeenRuns = 2 / 24`
  - 结论：
    - route continuity 主线已前推
    - 但 Boss 监控项相较第 7 轮基线仍有回落，尤其 normal `firelineSeenRuns` 回到 `0 / 24`
    - 因此 round8 更适合记为“候选已实现，但未完全抹平 freeze 监控风险”

### 当前结论
- 当前阶段判断仍是：`1.0 第一阶段`。
- 本轮真正压掉的是：
  - `crit` 的 hinted 后纯泛用断桥样本
  - `pierce` 被带到 `dash hinted` 的自然 rerun 样本
  - no-focus opening 里“整轮都看不到 route starter”的一部分普通样本
- 本轮仍保留的最大风险是：
  - `pierce` 的 commit timing 仍可能偏晚
  - `boss-bastion / fireline` 的 normal 样本可见性弱于第 7 轮基线

## [1.0 第一阶段第 7 轮] 自然 rerun 收口 / 残余漂移定向清扫
### 本轮口径
- 若旧文档仍停在 `1.0 第一阶段第 6 轮` 的“残余漂移压缩 / committed 稳定成型”，本轮继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v freeze` 继续作为稳定底座；本轮不改主流程、不重写 `RunEngine`、不引入新系统，也不回拉成 Boss 专项轮或 telemetry 轮。
- 本轮主线继续前推为：`1.0 第一阶段` 中的“自然 rerun 收口 / 残余漂移定向清扫轮”。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - 当前主问题已从“committed retention 仍不够稳”继续收窄成“early-mid ordinary sample route continuity 仍有残余噪音”
  - `soft closeout / committed retention` 继续负责 ordinary-sample 承接，但本轮重点前移到 opening / mid，不再继续补 high-memory closeout
  - `redirect follow-through`、`hybrid support`、`bossEcho support` 的职责边界已清晰：redirect 仍是 mid 改道窗口，hybrid / bossEcho 继续做 support，不应为了 round7 再扩一轮入口
  - `reroute-window` 仍可保留“现在转得过去”的窗口感，但 hinted dominant route 不应再被一次 ordinary-sample 改道轻易拉散
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - 文档没有要求把 natural rerun 收口写回引擎，因此本轮继续只改现有 content carrier 和轻量 selector / route-fit
  - 文档没有要求为 round7 新增 telemetry 字段，因此沿用现有 run summary 与 route-flow / Boss 回归脚本
  - 文档没有要求把 no-focus opening 直接做成强制路由分发，因此本轮没有把 early game 改成硬锁路线

### 当前缺口
- round6 结束后，当前最顽固的残余漂移主要收窄为两类：
  - `crit` hinted 阶段仍可能被早期 `reroute-window` 一拍带偏
  - `pierce` 即使不再稳定停在 `unformed`，也仍可能在 no-focus opening / mid starter 窗口里被别路 starter 抢走第一拍
- 因此本轮要解决的不是“再补更多晚段内容”，而是：
  - 把当前路线的 hold / continuity 做成真实承接
  - 降低 ordinary sample 里过早改道的噪音
  - 提高 `crit / pierce` 在 opening-to-mid 的自然成型率

### 本轮实现
- `src/data/events.ts`
  - `crit-reroute-window`
    - hinted 阶段出现权重下调，避免它在 ordinary sample 里过早抢走主味
  - `crit-reroute-window-hold`
    - 明确标注为 `crit`
    - 从“纯数值缓冲”改成“当前路线继续推进 +1”
  - `pierce-reroute-window-hold`
    - 明确标注为 `pierce`
    - 同样补入当前路线推进 +1
  - `crit-ember-hold / pierce-ledger-hold`
    - 只做 mid continuity 向的小幅增权，不扩新 anomaly family
- `src/data/anomalyRoutePools.ts`
  - `crit-reroute-window-pierce / crit-reroute-window-dash`
    - 改道推进从 `+3` 压到 `+2`
    - 目标不是删除 redirect，而是避免 hinted `crit` 被单个 reroute-window 直接拉成别路 committed
- `src/data/upgrades.ts`
  - `crit-linekeep`
    - mid / hinted 权重小幅上调，强化 `crit` 的 early-mid hold
  - `pierce-ledger-fanout`
    - mid / hinted 权重小幅上调，强化 `pierce` 的 ordinary-sample commit-hold
- `src/data/nodes.ts`
  - `厚线突围`
    - pierce route-fit 小幅上调
  - `拆屏挂账`
    - pierce route-fit 与 battleCatchup 小幅上调
  - `过渡整备 / 转折校准`
    - 补入 `crit / pierce` 的小幅 routeBonuses，让 ordinary sample 的 mid upgrade node 更容易承担 continuity，而不是只给泛用节点
- `src/data/contentSelectors.ts`
  - `levelUp`
    - non-committed dominant route 的 route-window scale 轻量上调
    - 目标是让 ordinary sample 在 early-mid 更容易看到当前路线的 starter / bridge 承接，而不是继续把第三张位完全留给泛用噪音
- docs 同步更新：
  - `PROJECT_STATUS.md`
  - `ROUTES_SPEC.md`
- 本轮刻意没有改：
  - `RunEngine`
  - Boss 模板 / Boss phase 参数
  - telemetry 字段
  - redirect / bossEcho 新 family
  因为本轮要解决的是 natural rerun 的残余漂移，而不是系统轮、Boss 轮或新内容轮

### 数据结构变更
- 无新的系统结构或类型结构变更。
- 本轮只调整：
  - existing reroute-window hold / redirect push 强度
  - existing crit / pierce continuity carrier 权重
  - opening / mid node route-fit
  - ordinary-sample levelUp route-window 保护

### 验证
- `npm run build`
  - 通过
- 浏览器 route-flow rerun：`npm exec --yes --package=playwright -- node output/playwright/commitment-pacing/route-flow-check.mjs`
  - `crit`
    - 当前 rerun 回到 `routeId = crit`
    - `buildStage = committed`
    - `firstCommitPick = upgrade:crit-flare-path`
    - 说明 round6 的“早期 reroute-window 直接带偏到 dash committed”已被压下
  - `pierce`
    - 当前 rerun 不再停在 `mid unformed`
    - 但仍可能停在 `dash hinted`
    - 说明 `pierce` 的残余漂移已从“中段直接散掉”收窄到“opening / mid no-focus starter continuity 仍不够稳”
  - `dash`
    - 当前 rerun 仍可能停在 `unformed`
    - 符合本轮没有把主线重新拉成穿梭专项补强的边界
- 定向 panel trace（临时 Playwright 复检）
  - `pierce` rerun 中已能看到 `pierce-rail`
  - 但 ordinary sample 在无显式焦点时仍可能先吃到泛用或别路 starter，说明剩余问题更像 opening-to-mid continuity / 选择可读性，而不是 late closeout 再次失效
- Boss 监控回归：`npm exec --yes --package=tsx -- tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 8 / 24`
    - `crossfireSeenRuns = 4 / 24`
    - `firelineSeenRuns = 2 / 24`
  - `highBurst`
    - `bossBastionRuns = 9 / 24`
    - `crossfireSeenRuns = 9 / 24`
    - `firelineSeenRuns = 2 / 24`
  - `highMobility`
    - `bossBastionRuns = 7 / 24`
    - `crossfireSeenRuns = 7 / 24`
    - `firelineSeenRuns = 4 / 24`
  - 结论：
    - 未见新的明显恶化
    - `fireline` 仍不是 normal 样本里的高频承接，但没有因本轮 early-mid continuity 调整而回落
    - 本轮处理方式仍符合“监控 / 保护性观察”，没有把 Boss 风险拉回主线

### 当前结论
- 当前阶段判断应更新为：`1.0 第一阶段` 中的“自然 rerun 收口 / 残余漂移定向清扫轮”。
- 本轮真正收口的是：
  - `crit` 早期 `reroute-window -> dash committed`
  - reroute-window hold 只是数值缓冲、不能继续承接当前路线
  - `crit / pierce` ordinary-sample continuity carrier 偏弱
- 本轮仍保留的最大残余风险是：
  - `pierce` 虽不再稳定复现 `mid unformed`，但 natural rerun 仍可能落到 `dash hinted`
  - 结合 panel trace，这更像 no-focus opening / mid starter continuity 残余噪音，而不是 late carrier 不够或 Boss 问题回潮

## [1.0 第一阶段第 6 轮] 残余漂移压缩 / committed 稳定成型
### 本轮口径
- 若旧文档仍停在 `1.0 第一阶段第 5 轮` 的“玩法差异稳读 / 低命中样本补洞”，本轮继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v freeze` 继续作为稳定底座；本轮不改主流程、不重写 `RunEngine`、不引入新系统，也不回拉成 Boss 专项轮或 telemetry 轮。
- 本轮主线继续前推为：`1.0 第一阶段` 中的“残余漂移压缩 / committed 稳定成型轮”。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - 当前主问题已经从“普通样本里的玩法差异不够稳”进一步收窄成“committed retention 不够稳”
  - ordinary sample 里 dominant route 在 mid-late 需要被持续承接，不能只靠 strongest late carrier / route-specific bossEcho 才成立
  - `soft closeout` 负责 ordinary-sample hold；`hybrid support` 负责尾段怎么继续接；`bossEcho support` 负责 Boss 前预读；`redirect follow-through` 已有入口，但不应继续在 ordinary sample 里抢主味
  - `pivot / hold node` 应承担承势与定势，而不是继续把节点只做成 route 标签分发器
  - 三选一仍遵守“最多 1 张路线强化、路线强化低于通用强化、单局唯一”；`finalPrep` 继续压住 redirect 专项卡
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - 文档没有要求把 committed retention 写回引擎，因此本轮只扩现有 upgrade / anomaly / node carrier，并做轻量 selector 校准
  - 文档没有要求为了 round6 再补 telemetry 字段，因此本轮沿用现有摘要字段，不额外扩 metrics
  - 文档没有要求继续补 redirect 新入口；结合当前缺口判断，本轮将 redirect 视为“已有、够用、需要降噪”的内容层，而不是继续加量

### 当前缺口
- 第 5 轮已经补上了 ordinary-sample soft closeout，但少数 rerun 仍会在 mid-late 漂移，说明问题已经收敛为：
  - dominant route 持续承接不稳
  - hinted ordinary sample 的 off-route redirect / generic hybrid 噪音仍偏高
  - `crit` 比 `pierce` 更容易掉成 `unformed / 只剩 hinted`
- 因此本轮要解决的不是“再造更亮高潮”，而是让 committed 后的读法更容易站稳。

### 本轮实现
- `src/data/upgrades.ts`
  - 新增 committed retention / ordinary-sample support：
    - `压线留焰`
    - `拆账铺面`
    - `回线留窗`
  - 取舍说明：
    - `crit / pierce` 是主补对象
    - `dash` 只做轻量承接，避免本轮再变成穿梭专项轮
    - `压线留焰` 额外补了 1 层 route 推进，让它更像 committed hold，而不是普通 bridge
- `src/data/events.ts`
  - 新增 hybrid retention anomaly：
    - `压线余焰`
    - `拆账余缝`
  - 新增 generic bossEcho support：
    - `尾段预录`
  - 取舍说明：
    - `bossEcho` 本轮只补 support，不再走 route-specific 高记忆点扩写
    - `redirect` 本轮不继续加新内容，避免 ordinary sample 再被偏航入口稀释
- `src/data/nodes.ts`
  - 新增 mid battle hold carrier：
    - `压线续热`
    - `拆屏挂账`
  - 新增 late upgrade hold carrier：
    - `定势整备`
  - 目标是让 node 本身也承担“承势 / 定势”，而不是只把 run 阅读交给 upgrade / anomaly
- `src/data/contentSelectors.ts`
  - `levelUp`
    - committed route window scale：`0.78 -> 1.02`
    - committed flex 内 route window scale：`0.68 -> 0.90`
    - 目标是让 committed late ordinary sample 更稳定地看见 dominant-route follow-up，而不是连续空吃通用牌
  - `nodePrep`
    - late flex pool：
      - off-route redirect：`0.82 -> 0.74`
      - generic hybrid：`0.92 -> 0.88`
    - hinted ordinary sample：
      - dominant hint：`1.20 -> 1.58`
      - off-route redirect：`1.22 -> 0.58`
      - generic hybrid：`0.68 -> 0.36`
    - committed ordinary sample：
      - dominant committed：`1.34 -> 1.52`
      - off-route redirect：`0.92 -> 0.56`
      - generic late flex：`0.56 -> 0.46`
  - 取舍说明：
    - 这轮 selector 的目标是“保护 dominant route 的持续承接”，不是抬高 rare / bossEcho 命中率
    - redirect / hybrid 仍保留 mid 改道窗口，但不再在 ordinary sample 里与 dominant route 等强对冲
- docs 同步更新：
  - `PROJECT_STATUS.md`
  - `ROUTES_SPEC.md`
  - `NODES_AND_TEMPLATES.md`
- 本轮刻意没有改：
  - `RunEngine`
  - Boss 模板 / Boss phase 参数
  - telemetry 字段
  因为本轮要解决的是 committed retention，而不是系统轮、Boss 轮或观测轮

### 数据结构变更
- 无新的系统结构或类型结构变更。
- 本轮只扩：
  - committed retention carrier
  - ordinary-sample hybrid / bossEcho support
  - node 的 hold / commit-hold blueprint
  - selector 的保护性 route-fit 校准

### 验证
- `npm run build`
  - 通过
- 静态抽样：ordinary sample route continuity
  - committed late `levelUp`
    - `crit`
      - dominant route offer：`0.23 -> 0.37`
    - `pierce`
      - dominant route offer：`0.28 -> 0.38`
  - mid hinted `nodePrep`
    - `crit`
      - dominant route offer：`0.40 -> 0.60`
      - off-route redirect：`0.46 -> 0.30`
    - `pierce`
      - dominant route offer：`0.38 -> 0.58`
      - off-route redirect：`0.48 -> 0.31`
  - late committed `nodePrep`
    - `crit`
      - dominant route offer：`0.50 -> 0.59`
      - off-route redirect：`0.18 -> 0.13`
    - `pierce`
      - dominant route offer：`0.44 -> 0.58`
      - off-route redirect：`0.21 -> 0.14`
  - 说明：
    - round6 的主增益不是“更亮”，而是 dominant route 在 ordinary sample 里的持续承接更稳
    - 当前 residual drift 更像“偶发未站稳”，而不是整局重新掉散
- 浏览器 route-flow rerun：`node output/playwright/commitment-pacing/route-flow-check.mjs`
  - 最新 rerun 仍带有普通样本抖动：
    - `crit`
      - 全量 rerun 被早期 `reroute-window` 带偏到 `dash committed`
      - 说明当前 ordinary sample 仍可能在 hinted 阶段被 mid 改道窗口拉散
    - `pierce`
      - 最新 rerun 在 mid 提前结束为 `unformed`
      - 说明 `pierce -> dash/hinted` 虽比上一轮更少见，但 ordinary-sample retention 仍未完全站稳
    - `dash`
      - 最新 rerun 也停在 `unformed`
      - 符合本轮并未把主线转成穿梭专项补强的边界
  - 取舍说明：
    - 该脚本是自然自动游玩监控，不是强制 route harness
    - 因此它更适合证明“残余漂移是否还存在”，而不适合作为单点 closure 证明
- 定向 crit rerun：
  - 额外用定向 Playwright rerun 复检 `crit`
  - 当前结果：
    - `routeId = crit`
    - `buildStage = committed`
    - `firstCommitStage = mid`
  - 说明 round6 结束时，`crit -> unformed` 已收窄成“偶发 hinted、可被继续推到 committed”，不再是稳定掉散
- 结果页截图复查：
  - `crit-rerun-round6.png`
    - 已正确显示 `路线 = 暴击`
    - 已正确显示 `成型 = 开始站稳`
    - 收尾节点与结束原因可读
  - `pierce-result.png`
    - 最新 rerun 结果页仍可正常显示路线 / 成型 / 结束信息
    - 但该样本停在 `unformed`，印证 ordinary-sample residual drift 仍未清零
- 通用 Playwright client
  - 依赖解析失败，原因是 skill 脚本目录未解析到 `playwright` 包
  - 本轮回归仍以前述项目内 Playwright 脚本与截图复查为主，未影响主结论
- Boss 监控回归：`npm exec --yes --package=tsx -- tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 6`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 1`
  - `highBurst`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 8`
    - `firelineSeenRuns = 2`
  - `highMobility`
    - `bossBastionRuns = 7`
    - `crossfireSeenRuns = 7`
    - `firelineSeenRuns = 4`
  - 结论：
    - 未见新的明显恶化
    - `fireline` 仍不是 normal 样本里的高频承接
    - 本轮处理方式仍符合“监控 / 保护性观察”，没有把 Boss 风险劫持回主线

### 当前结论
- 当前阶段判断应更新为：`1.0 第一阶段` 中的“残余漂移压缩 / committed 稳定成型轮”。
- 本轮真正补上的不是更多高记忆点爆点，而是：
  - ordinary sample 的 committed retention
  - `crit / pierce` 的 mid-late hold carrier
  - generic bossEcho support 的轻量补位
  - ordinary sample 下 hinted / committed 的 selector 降噪
- 当前最大残余风险有两条：
  - residual drift 虽已压缩，但普通样本里仍可能出现 `crit 被 reroute 拉散`、`pierce mid 停在 unformed` 这类还没完全站稳的样本
  - `boss-bastion / fireline` 监控项未恶化，但仍有抽样波动，暂不宜宣称完全收口

## [1.0 第一阶段第 5 轮] 玩法差异稳读 / 低命中样本补洞
### 本轮口径
- 若旧文档仍停在 `1.0 第一阶段第 4 轮` 的“高记忆点 run 分化 / 收束显性化”，本轮继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v freeze` 继续作为稳定底座；本轮不改主流程、不重写 `RunEngine`、不引入新系统，也不回拉成 Boss 专项轮或 telemetry 轮。
- 本轮主线前推为：`1.0 第一阶段` 中的“玩法差异稳读 / 低命中样本补洞轮”。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - 当前主要问题已经不是“内容不够多”，而是普通样本里仍有局面会被读成“主路线不同，但玩法差异只读出一半”
  - 即使没撞到 route-specific bossEcho / strongest late carrier，committed 后也应通过 ordinary sample carrier 持续读出差异
  - `closeout` 负责强收束；`bossEcho` 负责 Boss 前预读与尾段分岔；`hybrid` 负责 mixed closeout 的理由；`redirect` 仍主要负责 mid 改道，但允许少量 follow-through 把转向后的玩法读法接稳
  - `pivot node / soft closeout carrier` 应承担“普通样本里的转折点、偏航点、收束点”承接，而不是继续只靠 rare 命中
  - 三选一仍遵守“最多 1 张路线强化、路线强化低于通用强化、单局唯一”；`finalPrep` 继续压住 redirect 专项卡
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - 文档没有要求把玩法差异稳读写回引擎，因此本轮只扩现有数据载体，不额外引入状态机或新系统
  - 文档没有要求额外 telemetry 字段来证明 ordinary sample 稳读，因此本轮沿用现有摘要字段，不为“看起来完整”再扩 telemetry
  - `boss-bastion / fireline` 本轮只允许做轻量、数据驱动、非专项化支撑，因此没有回到 Boss phase / 数值专项调参

### 当前缺口
- 第 4 轮补上的 high-memory 内容更像“命中了会明显加分”，但还没把“没命中时的玩法差异稳读”一起补齐。
- committed 后三流派已经各有 closeout 口径，但在普通样本里仍偶尔会退回“同一种 build 的不同标签”。
- residual drift 的本质已经不是“没有差异”，而是“差异对 strong late carrier / route-specific bossEcho 的依赖仍偏高”。

### 本轮实现
- `src/data/upgrades.ts`
  - 新增 ordinary-sample soft closeout：
    - `续热压线`
    - `拆线归账`
    - `回摆取窗`
  - 新增 redirect follow-through：
    - `借焰续拍`
    - `借层回收`
    - `借位追回`
  - 目标不是制造更大爆点，而是让 committed 后即使没撞 strongest closeout，也能继续读成不同玩法。
- `src/data/events.ts`
  - 新增 route-specific hybrid soft closeout anomaly：
    - `热区余拍`
    - `拆线余账`
    - `回线余拍`
  - 新增轻量 bossEcho support：
    - `迁火预录`
  - 目标是把 `hybrid / bossEcho` 从“命中会很亮”补成“普通样本里也能解释尾段为什么这么收”。
- `src/data/nodes.ts`
  - 新增 late soft-closeout battle carrier：
    - `热区续压`
    - `拆线回收`
    - `回摆追回`
  - 这些 carrier 继续沿现有 battle family 承接，不新建 route-specific node 系统。
- `src/data/contentSelectors.ts`
  - 仅做小幅、非主导式 `nodePrep` 调整：
    - `nodePrepHintFlexPool`
      - dominant route scale：`1.14 -> 1.20`
      - off-route redirect scale：`1.16 -> 1.22`
      - generic hybrid scale：`0.74 -> 0.68`
    - `nodePrepCommittedFlexPool`
      - dominant payoff scale：`1.22 -> 1.34`
      - off-route redirect scale：`0.84 -> 0.92`
      - generic late flex scale：`0.64 -> 0.56`
  - 目标是让 ordinary sample 的 committed 后 route-fit 更稳，不是单纯提高 rare / bossEcho 命中率。
- docs 同步更新：
  - `PROJECT_STATUS.md`
  - `ROUTES_SPEC.md`
  - `NODES_AND_TEMPLATES.md`
- 本轮刻意没有改：
  - `RunEngine`
  - Boss 模板 / Boss phase 参数
  - telemetry 字段
  因为本轮要解决的是 ordinary sample 稳读，而不是再开系统轮、Boss 轮或观测轮。

### 数据结构变更
- 无新的系统结构或类型结构变更。
- 本轮只扩：
  - ordinary-sample route carriers
  - hybrid / bossEcho anomaly content
  - late soft-closeout node blueprint
  - nodePrep 的轻量 route-fit 分发

### 验证
- `npm run build`
  - 通过
- 静态 `nodePrep` 抽样，对比改动前后：
  - `crit`
    - mid `avgRoute 0.49 -> 0.59`
    - late `0.61 -> 0.69`
  - `pierce`
    - mid `0.51 -> 0.59`
    - late `0.61 -> 0.70`
  - `dash`
    - mid `0.44 -> 0.62`
    - late `0.57 -> 0.69`
  - 说明：
    - ordinary sample 的 mid / late route-fit 已显著上升
    - 本轮主要补的是稳读承接，不是 rare 命中
- ordinary-sample soft carrier 覆盖（改动后）：
  - `crit`
    - mid route panels：`101`，其中 soft `36`
    - late route panels：`233`，其中 soft `102`，strong `15`
    - late 非 route-specific bossEcho anomalies：`431`，其中 soft `83`
  - `pierce`
    - mid `102 / 28`
    - late `242 / 106`，strong `35`
    - anomaly `425 / 105`
  - `dash`
    - mid `93 / 24`
    - late `252 / 127`，strong `38`
    - anomaly `430 / 97`
  - 说明：
    - 三流派已不再主要依赖 strongest late carrier 才能被读出来
    - ordinary sample 的 soft carrier 已能承担更多 committed 后读法
- 路线与 replay 回归：`npm exec --yes --package=playwright -- node output/playwright/commitment-pacing/route-flow-check.mjs`
  - 可跑到 `result / replay`
  - 当前 rerun 里：
    - `crit` 样本在 mid 提前结束，停在 `unformed`
    - `pierce` 样本漂到 `dash / hinted`
    - `dash` 样本停在 `dash / hinted`
  - 说明“构筑差异已存在，但玩法差异不总能完整读出”的 residual drift 仍在，而且 ordinary sample 稳读还没有完全压住
- 浏览器全链路回归：`npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - anomaly panel / result / replay / console clean 均正常
  - 本次单样本没撞到 boss node，因此只能证明主流程与闭环未回退，不能拿来替代 Boss 证明
- Boss 监控回归：`npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 11`
    - `crossfireSeenRuns = 3`
    - `firelineSeenRuns = 2`
  - `highBurst`
    - `bossBastionRuns = 12`
    - `crossfireSeenRuns = 11`
    - `firelineSeenRuns = 4`
  - `highMobility`
    - `bossBastionRuns = 6`
    - `crossfireSeenRuns = 6`
    - `firelineSeenRuns = 4`
  - 结论：
    - normal 固定样本较第 4 轮 `0 / 8` 已改善
    - highBurst / highMobility 未见崩坏，但仍有波动，暂不写成全面收口
    - 本轮处理方式仍符合“轻量支撑，不把 Boss 风险劫持成主线”

### 当前结论
- 当前阶段判断应更新为：`1.0 第一阶段` 中的“玩法差异稳读 / 低命中样本补洞轮”。
- 本轮真正补上的不是更多高记忆点爆点，而是：
  - committed 后 ordinary sample 的 soft closeout 承接
  - route-specific 的 mid-late bridge / follow-through
  - hybrid / bossEcho 对尾段读法的轻量支撑
  - `nodePrep` 的轻量 route-fit 稳读校准
- 当前最大残余风险有两条：
  - residual drift 仍未清零，少数 run 仍会出现“主路线已经分化，但玩法差异只读出一半”，此次 ordinary-sample rerun 里甚至出现 `crit -> unformed`、`pierce -> dash/hinted`
  - `boss-bastion / fireline` 的 normal 样本虽回升，但高 burst / 高机动样本仍有抽样波动，尚不宜宣称完全收口

## [1.0 第一阶段第 4 轮] 高记忆点 run 分化 / 收束显性化
### 本轮口径
- 若旧文档仍停在 `1.0 第一阶段第 3 轮` 的“构筑分化 / replay 动机补厚”，本轮继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v freeze` 继续作为稳定底座；本轮不是新系统轮，不重写 `RunEngine`，也不回拉成 Boss 专项调参轮。
- 本轮主线前推为：`1.0 第一阶段` 中的“高记忆点 run 分化 / 收束显性化轮”。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - 高记忆点内容应继续落在 `late / final` 的 route closeout、`bossEcho / hybrid` anomaly 与 node carrier 上
  - `redirect` 仍主要负责 mid 改道，不负责替代 late closeout 本身
  - `bossEcho` 负责 Boss 前预读与收束分岔，不应退回 Boss 调参替代品
  - committed 之后三流派应分别读成：
    - `crit`: 升温后爆点兑现
    - `pierce`: 清线 / 穿线 / 扩面 / 回响收束
    - `dash`: 换位 / 回摆 / 反打 / 回线收束
  - `finalPrep` 继续压住 redirect 专项卡，避免最终整备重新变成分叉噪音池
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - build 差异如何 100% 转译成玩法差异，没有单独新系统口径；本轮只继续补 carrier，不把内容逻辑写回引擎
  - selector / telemetry 没有必要再扩成新一轮主线；本轮优先用现有分发与已有摘要字段承接

### 当前缺口
- replay prompt 已经能读到低频内容，但很多 run 的走势差异仍然不够强，容易被读成“同一路线 + 少量 rare 变化”。
- `hybrid / redirect / bossEcho / rare payoff` 已经有入口，但还不够稳定地形成“转折点 / 偏航点 / 收束点”的整局阅读。
- committed 之后三流派虽然已有口径，但中后段内容量还不够总能把这三种玩法持续读出来。

### 本轮实现
- `src/data/upgrades.ts`
  - 新增 generic closeout：
    - `尾流归并`
    - `余响备压`
  - 新增 route closeout：
    - `灼链追爆`
    - `裂幕归账`
    - `回线追拍`
  - 目标是让 generic late-payoff 与三流派 committed 后的后段承接更像“不同结尾”，而不只是继续涨数值。
- `src/data/events.ts`
  - 新增 hybrid anomaly：
    - `错拍并账`
    - `侧频并轨`
  - 新增 route-specific bossEcho：
    - `灼冠预读`
    - `裂屏预账`
    - `回线窥影`
  - 方向是把 `hybrid / bossEcho` 从“有入口”推到“更能解释这局为什么这么收”。
- `src/data/nodes.ts`
  - 中段新增：
    - `转折校准`
    - `偏航试拍`
  - 后段 battle 新增：
    - `爆点追收`
    - `裂面清账`
    - `回线反压`
  - 后段 upgrade / anomaly 新增：
    - `终拍定稿`
    - `旁路归并`
    - `首领侧录`
    - `终段偏航`
  - 目标是让 node 不再只是 phase 占位，而是更像转折点 / 偏航点 / 收束点。
- docs 同步更新：
  - `PROJECT_STATUS.md`
  - `ROUTES_SPEC.md`
  - `NODES_AND_TEMPLATES.md`
- 本轮刻意没有改：
  - selector
  - telemetry
  - `RunEngine`
  - Boss 参数
  因为抽样显示新内容已能进自然样本，不需要把本轮重新做成调参轮。

### 数据结构变更
- 无新的系统结构或类型结构变更。
- 本轮只扩：
  - upgrade archetype
  - anomaly content
  - node blueprint

### 验证
- `npm run build`
  - 通过
- 静态计数
  - upgrades：
    - `73 -> 78`
    - `hybrid 10 -> 11`
    - `route payoff 21 -> 24`
  - anomaly：
    - `28 -> 33`
    - `hybrid 7 -> 9`
    - `bossEcho 5 -> 8`
- late committed 抽样（500 样本 / route）
  - `crit`
    - `crit-crown-preview = 108`
    - `crit-ember-rail = 34`
    - `round-3-battle-crit-closeout = 82`
  - `pierce`
    - `pierce-screen-ledger = 87`
    - `pierce-seam-ledger = 23`
    - `round-3-battle-pierce-closeout = 74`
  - `dash`
    - `dash-return-preview = 94`
    - `dash-retrace-beat = 33`
    - `round-3-battle-dash-closeout = 73`
  - 说明：
    - 新 route-specific closeout 与 bossEcho 已进入自然 late 样本
    - 新增 mid / late node carrier 也已能正常露出
    - 因此本轮没有额外补 selector
- 路线与 replay 回归：`npm exec --yes --package=playwright -- node output/playwright/commitment-pacing/route-flow-check.mjs`
  - 三条路线均可跑到 `result`
  - replay 重开链路保持正常
  - 新 late node 已出现在真实样本：
    - `回线反压`
  - 但 deterministic 样本里仍存在停在 `hinted` 的局，说明“构筑差异已存在、玩法差异未必总能完整读出”的残余漂移仍在
- 浏览器全链路回归：`npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - anomaly panel / boss node / result / replay 均可跑通
  - `consoleErrors = []`
  - summary 已看到新增节点：
    - `首领侧录`
  - `battle_template_entered(encounterType = boss)` 继续正常记录
- Boss 监控回归：`npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 2`
    - `firelineSeenRuns = 0`
  - `highBurst`
    - `bossBastionRuns = 12`
    - `firelineSeenRuns = 5`
  - `highMobility`
    - `bossBastionRuns = 9`
    - `firelineSeenRuns = 5`
  - 结论：
    - 高 burst / 高机动样本未见明显回退
    - 但固定 normal 样本里的 `fireline` 从上一轮 `1 / 9` 回到当前 `0 / 8`
    - 这一项当前只能定义为“监控项轻微恶化风险”，还不到重开 Boss 专项轮的程度

### 当前结论
- 当前阶段判断应更新为：`1.0 第一阶段` 中的“高记忆点 run 分化 / 收束显性化轮”。
- 本轮真正补上的不是更多标签，而是：
  - route-specific closeout
  - route-specific bossEcho 预读
  - mid 的转折 / 偏航节点
  - late 的 closeout battle / upgrade / anomaly carrier
- 当前最大残余风险有两条：
  - 普通 build 下 `boss-bastion / fireline` 监控项出现轻微回落
  - run 与 run 的玩法差异读法虽然更厚，但仍未达到“任何样本都稳定读出三种完全不同玩法”
## [1.0 第一阶段第 3 轮] replay 动机补厚 / hybrid・redirect・rare payoff 扩写
### 本轮口径
- 若旧文档仍停在 `1.0 第一阶段第 2 轮` 的“结构承接补厚”，本轮继续以：
  - 最新用户 brief
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - `ROADMAP_1_0.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v freeze` 继续作为稳定底座；本轮不是 Boss 专项调参轮，也不是 selector / telemetry 独立优化轮。
- `boss-bastion / fireline` 继续只做回归监控，不抢占主线。

### 文档盘点结论
- docs 已足够明确、可直接实现的边界：
  - rare payoff 主要继续留在 `late / final`
  - `hybrid / redirect` 需要让 run 与 run 之间更像不同打法，而不是只多一个标签
  - anomaly 仍要保持独立异常层，不回退成普通 event 奖励分发
  - 三选一继续遵守“最多 1 张路线强化、路线强化低于通用强化、单局唯一”
- docs 仍不够明确、因此本轮按保守近似处理的部分：
  - replay 动机没有单独新系统口径，因此本轮只在现有 result prompt 上做轻量增强
  - telemetry 不新拆 replay 事件族，只在现有 run summary 上补最小字段

### 当前缺口
- 内容量虽然已经够做结构承接，但 replay 动机仍容易读成“同一路线继续做大”。
- `hybrid / redirect / rare payoff / late payoff` 已有入口，但还不够厚，不足以稳定制造“这局和上一局不是一回事”的 run 阅读。
- `bossEcho` anomaly 仍偏薄，结果页 replay prompt 也还没有真正把低频内容读回给玩家。

### 本轮实现
- `src/data/upgrades.ts`
  - 新增 generic：
    - `镜格并流`
    - `借尾并幅`
    - `余波护仓`
  - 新增 route redirect：
    - `借爆并焰`
    - `借层并轨`
    - `借窗回返`
  - 目标是同时补：
    - mid 的真实改道窗口
    - late 的稀有混搭收束
    - replay 级低频尾段牌
- `src/data/events.ts`
  - 新增 anomaly：
    - `并轨超调`
    - `影缝并联`
    - `口袋回读`
    - `首领并线`
  - 方向是继续加厚：
    - `hybrid`
    - `bossEcho`
  - 而不是继续回涨 `routeWindow`
- `src/data/nodes.ts`
  - 新增节点载体：
    - `并轨整备`
    - `稀有读数`
    - `并线残响`
  - 中段多一个 hybrid / redirect 承接口，后段多一个 rare / bossEcho 承接口
- `src/data/contentSelectors.ts`
  - 只做轻量 selector 微调：
    - late / finalPrep 的 `hybrid` anomaly 倍率小幅上调
    - late / finalPrep 的 `bossEcho` anomaly 倍率小幅上调
  - 目标只是避免新内容完全投不出来，不把本轮做成 selector 调参轮
- `src/game/types.ts`
  - `RunState` 新增 `eventHistory`
  - 新增 `PickedEventRecord`
- `src/systems/RunEngine.ts`
  - anomaly 选择现在会记录轻量 `eventHistory`
  - replay prompt 不再只看“有没有碰到 anomaly”，开始读入：
    - rare payoff
    - hybrid
    - redirect
    - bossEcho
  - 结果页因此能更像“这局为什么值得再开一局”的收尾提示
- `src/systems/MetricsTracker.ts`
  - 在现有 run summary 上补：
    - `rarePayoffPickCount`
    - `bossEchoSeenCount`
  - 不新建独立 telemetry 系统

### 数据结构变更
- `src/game/types.ts`
  - 新增 `PickedEventRecord`
  - `RunState.eventHistory`
- `src/systems/MetricsTracker.ts`
  - `MetricRunSummary` 新增：
    - `rarePayoffPickCount`
    - `bossEchoSeenCount`
- 本轮没有改主流程，没有重写 `RunEngine`，没有新建大系统。

### 验证
- `npm run build`
  - 通过
- 静态内容盘点
  - upgrades：
    - `67 -> 73`
    - `hybrid 8 -> 10`
    - `redirect 6 -> 9`
    - `rare 12 -> 14`
  - anomaly：
    - `24 -> 28`
    - `hybrid 5 -> 7`
    - `bossEcho 3 -> 5`
- late `nodePrep` / anomaly 抽样
  - `lateNodePrepCritHinted`
    - `avgRoute = 0.55`
    - `avgHybrid = 1.20`
    - `avgRedirect = 0.17`
    - `avgRare = 0.43`
  - late anomaly 命中（500 样本）
    - `distortion = 166`
    - `hybrid = 166`
    - `bossEcho = 128`
    - `routeWindow = 40`
  - 说明：
    - 新 replay-grade anomaly 已进入自然 late 池
    - `routeWindow` 仍被压在次级入口，没有重新抢回 anomaly 主味道
- Boss 监控回归：`npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 9`
    - `crossfireSeenRuns = 5`
    - `firelineSeenRuns = 1`
  - `highBurst`
    - `bossBastionRuns = 13`
    - `firelineSeenRuns = 2`
  - `highMobility`
    - `bossBastionRuns = 7`
    - `firelineSeenRuns = 1`
  - 结论：
    - 本轮内容扩写没有把 `boss-bastion / fireline` 明显做坏
    - 普通 build 仍然是低频监控项，但没有发现恶化
- 浏览器全链路回归：`npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - anomaly panel / boss node / result / replay 均可跑通
  - `consoleErrors = []`
  - 最新截图已人工复核：
    - `result.png`
    - `panel-14.png`
    - `panel-40.png`
    - `replay.png`
  - 截图确认：
    - 新 anomaly 文案无乱码、无超框
    - 结果页 route trace 与 replay 收尾保持干净
    - HUD / 面板没有被新内容挤坏
  - `summary.bossBattleSeen = false` 仍是旧 QA matcher 滞后；metrics 继续确认 `battle_template_entered(encounterType = boss)`

### 当前结论
- 当前阶段判断应更新为：`1.0 第一阶段` 中的“构筑分化 / replay 动机补厚轮”。
- 本轮真正补上的不是单纯内容数量，而是：
  - replay-grade low-frequency content
  - hybrid / redirect 的真实中后段承接
  - rare / late payoff 的自然载体
  - result replay prompt 对 run 差异的读法
- 当前最大残余风险保持不变：
  - 普通 build 下 `boss-bastion / fireline` 仍是低频样本
  - 它继续属于监控项，而不是本轮阻断项
## [1.0 第一阶段第 2 轮] node / upgrade / route / selector 深化 + telemetry 收口
### 本轮口径
- 若旧文档仍停留在 `0.9v freeze sign-off` 或 `1.0 第一轮开发启动` 的更早摘要，本轮以：
  - 最新用户 brief
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - `ROADMAP_1_0.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准。
- `0.9v 可封版状态` 继续作为稳定底座；本轮不回退去做 Boss 专项调参，也不扩新系统。
- `boss-bastion / fireline` 继续保留为 1.0 监控项，只做回归复检，不作为主线任务。

### 文档盘点结论
- `PROJECT_STATUS.md` 顶部执行焦点仍停在 `0.9v freeze sign-off`，已落后于最新阶段口径；本轮按 `1.0 第一阶段中段推进期` 修正。
- docs 已明确可直接实现的边界包括：
  - 三选一中最多 `1` 张路线强化
  - 路线强化低于通用强化频率
  - 路线强化从 `uncommon` 起跳
  - 同一 `sourceId` 单局唯一
  - `starter -> committed -> payoff -> hybrid / redirect` 的承接层次
- docs 仍不够明确、因此本轮按保守近似实现的部分：
  - `nodePrep` 的具体槽位结构此前没有写死；本轮沿普通 `levelUp` 的结构化发牌思路，收口为 `2 通用 + 1 flex`
  - telemetry 只补低成本字段，不新建独立 selector 观测系统

### 关键发现
- 原实现里 `excludeFromFinalPrep` 实际会屏蔽所有 `nodePrep`，而不是只屏蔽 `finalPrep`。
- 这会直接导致：
  - redirect / hybrid 在中段 upgrade 节点几乎不可见
  - late 无主路线 upgrade 节点可能发出空面板
- 因此本轮先修真实承接问题，再补内容量。

### 本轮实现
- `src/data/upgrades.ts`
  - 新增通用 bridge / late flex：
    - `generic-salvo-cache / 齐射缓存`
    - `generic-drift-anchor / 漂移定舵`
    - `generic-branch-buffer / 支路缓冲`
    - `generic-last-mile / 终段余量`
  - 新增暴击承接：
    - `crit-sparkline / 火迹预压`
    - `crit-crownfire / 冠火收束`
    - `crit-reroute-spark / 借火切入`
  - 新增穿透承接：
    - `pierce-relay-spine / 并轨穿脊`
    - `pierce-floodgate / 裂层清账`
    - `pierce-reroute-seam / 借线破层`
  - 新增穿梭承接：
    - `dash-sidestep-bank / 侧返蓄窗`
    - `dash-afterimage / 残影回切`
    - `dash-reroute-cutin / 偏帧切入`
- `src/data/nodes.ts`
  - mid 新增：
    - `改道整备`
    - `分叉噪井`
  - late 新增：
    - `收束筹码`
    - `余辉偏折`
- `src/data/contentSelectors.ts`
  - 普通 `levelUp` 继续保持 `2 通用 + 1 flex`，并把 route window 倍率更新为：
    - `0.56 / 0.64 / 0.78`
  - 修正 `excludeFromFinalPrep`：
    - 现在只在 `phase = finalPrep` 时生效
    - 不再误伤 mid / late 的普通 `nodePrep`
  - `nodePrep` 发牌重构为：
    - `2` 张通用强化
    - `1` 张弹性槽
  - 让 `nodePrep` 也遵守“最多 `1` 张路线强化”的当前设计边界。
  - 中段 hinted / committed 的 flex 现在会在：
    - dominant bridge / payoff
    - redirect
    - hybrid
    之间做更明确的承接，而不是一次面板塞入多张 route 卡。
- `src/data/balance.ts`
  - 新增 `UpgradeValueBucket` 阈值：
    - `mid >= 65`
    - `high >= 105`
    - `spike >= 150`
- `src/game/types.ts`
  - `UpgradeDefinition` 新增：
    - `valueBucket`
- `src/systems/MetricsTracker.ts`
  - 新增 `upgrade_offer_seen`
  - `node_selected` 补充：
    - `phase`
    - `focusRoute`
  - `upgrade_selected` 补充：
    - `source`
    - `rarity`
    - `category`
    - `valueScore`
    - `valueBucket`
    - `tags`
  - `event_selected` 补充：
    - `anomalyClass`
  - run summary 新增：
    - `branchSwitchPhaseCounts`
    - `hybridOfferSeenCount`
    - `routeUpgradeOfferSeenCount`
    - `routeUpgradePickCount`
    - `upgradeOfferRarityCounts`
    - `upgradeOfferValueBuckets`
    - `nodeTypeCounts`
    - `anomalySeenCount`
    - `anomalyClassCounts`
- `src/systems/RunEngine.ts`
  - 打开 `levelUp / nodePrep` 面板时记录 `upgrade_offer_seen`
  - upgrade / anomaly pick 时把扩展 telemetry meta 透传给 metrics

### 数据结构变更
- `src/game/types.ts`
  - 新增 `UpgradeValueBucket = 'low' | 'mid' | 'high' | 'spike'`
  - `UpgradeDefinition.valueBucket`
- 本轮没有改主流程，没有重写 `RunEngine`，没有引入新系统。

### 验证
- `npm run build`
  - 通过。
- 静态 selector 抽样
  - `opening-no-focus-levelup`
    - `avgRoute = 0.27`
    - `avgGeneric = 2.73`
  - `mid-no-focus-nodeprep`
    - `avgRoute = 0.61`
    - `avgGeneric = 2.39`
    - `emptyRuns = 0`
  - `late-no-focus-nodeprep`
    - `avgRoute = 0.39`
    - `avgGeneric = 2.61`
    - `avgRedirect = 0.12`
    - `avgHybrid = 1.27`
    - `emptyRuns = 0`
  - `mid-crit-hinted-nodeprep`
    - `avgRoute = 0.78`
    - `avgGeneric = 2.22`
    - `avgRedirect = 0.36`
    - `avgHybrid = 1.38`
  - 结论：
    - `nodePrep` 不再出现空面板
    - 普通 / 节点升级现在都回到“通用强于路线”的分布
    - redirect / hybrid 在中段已进入可见区间
- Boss 监控回归：`npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 7`
    - `crossfireSeenRuns = 3`
    - `firelineSeenRuns = 1`
  - `highBurst`
    - `bossBastionRuns = 13`
    - `firelineSeenRuns = 6`
  - `highMobility`
    - `bossBastionRuns = 8`
    - `firelineSeenRuns = 3`
  - 结论：
    - 本轮主线改动没有把 `boss-bastion / fireline` 明显做坏
    - 普通 build 仍是低频监控项，但没有恶化为不可见
- 浏览器全链路回归：`npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - anomaly 面板出现
  - Boss 节点出现
  - result / replay 跑通
  - `consoleErrors = []`
  - `metricBossEvents = 1`
  - 说明：
    - `summary.bossBattleSeen = false` 仍是旧 QA matcher 的文案滞后
    - 但 metrics 已确认 `battle_template_entered(encounterType = boss)`，截图也已人工复核

### 当前结论
- 项目当前应判断为：`1.0 第一阶段中段推进期`。
- 本轮真正补上的不是孤立内容量，而是：
  - node / upgrade / route / selector 的承接厚度
  - redirect / hybrid 的可见窗口
  - upgrade 价值与品质的 telemetry 观测
- 当前最大残余风险保持不变：
  - 普通 build 下 `boss-bastion / fireline` 仍然是低频样本
  - 最终关远程后段仍需继续监控，但不是本轮阻断项

## [1.0 第一轮开发] anomaly 深度扩写 / template 家族补量 / 第一批内容扩容
### 本轮口径
- 若旧文档仍停留在 `0.9v freeze sign-off` 或封版检查阶段，本轮以 `最新用户 brief + FREEZE_SIGNOFF_0_9V.md + DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- `0.9v 可封版状态` 继续作为稳定底座；本轮正式切入 `1.0 第一轮开发`，目标是内容扩写，不回退去做 0.9v 大修。
- `boss-bastion / fireline` 继续保留为轻量回归监控项，而不是本轮主线任务。

### 盘点结论
- anomaly 已经独立成层，但 opening / mid 的自然样本仍偏 `routeWindow`，`bossEcho` 在 late / finalPrep 之前偏薄。
- battle template 家族分层已经成立，但 opening / elite / survival 的原始模板数量仍偏少，节点承载密度还不够像 1.0。
- nodes / upgrades 已经有阶段身份，但 replay 动机仍更多来自路线收束，缺少“这局没遇到另一类低频内容”的再开一局理由。
- `boss-bastion / fireline` 在普通 build 下仍然低频，但本轮目标是扩内容厚度，不重开 Boss 专项调参。

### 本轮实现
- `src/data/battleTemplates.ts`
  - 新增 opening 模板 `elimination-crossline / 火线歼灭`，把前段远程火线压进普通战，强化基础换位与补线读数。
  - 新增 elite 模板 `elite-bulwark / 壁垒压制`，让中段更明确承担“拆屏护卫再穿本体”的硬仗角色。
  - 新增 survival 模板 `survival-sieve / 筛火求生`，把 late 段的漏火线、补线与回线压力拉成独立家族变体。
- `src/data/nodes.ts`
  - opening 新增节点载体：`火线试压`、`冷启裂口`
  - mid 新增节点载体：`壁垒拆解`、`欠账裂纹`
  - late 新增节点载体：`筛火求生`、`首领残响`
  - final prep 新增 `Boss 预整备`，补足收尾前的内容承接。
- `src/data/upgrades.ts`
  - 通用层新增 `视界缓存`、`终端护幕`
  - 暴击新增 `灼迹导火`、`余烬爆点`
  - 穿透新增 `切层折返`、`裂面回响`
  - 穿梭新增 `相位蓄返`、`回切留影`
  - 这一批仍走现有 `generic / route / rare / payoff` 体系，没有新建升级系统。
- `src/data/events.ts`
  - 新增 anomaly：`冷启偏折`、`裂谱合拍`、`屏卫预读`、`首领残响`
  - 下调更偏工具化的 `risky-protocol / relay-splice / route-handoff / cross-branch-signal`
  - 让 anomaly 更偏 `distortion / hybrid / bossEcho`，而不是继续把 routeWindow 堆厚。
- `src/data/contentSelectors.ts`
  - 下调 `routeWindow` 在 opening / mid / late / finalPrep 的倍率
  - 提高 `distortion / hybrid / bossEcho`，尤其 late / finalPrep 的 bossEcho 暴露
  - 目标是让 anomaly 池更像 1.0 的独立低频内容层，而不是路线补丁层。
- `src/systems/RunEngine.ts`
  - 新增 `getAnomalyVisitCount()`
  - replay prompt 现在会识别“这一局几乎没见到 anomaly”并直接把 replay 动机指向低频内容与异常窗口，而不只是泛化地提示再打一次。

### 数据结构变更
- `src/game/types.ts`
  - `BattleTemplateId` 新增：
    - `elimination-crossline`
    - `elite-bulwark`
    - `survival-sieve`
- 本轮没有改主流程，没有重写 `RunEngine`，没有引入新系统。
- 本轮没有新增新的埋点族；仍沿用现有 battle / anomaly / boss / result 观测结构。

### 验证
- `npm run build`
  - 通过。
- 内容厚度复核
  - `eventsTotal = 30`
  - `anomalyTotal = 24`
  - `anomalyByClass = { routeWindow: 7, distortion: 9, hybrid: 5, bossEcho: 3 }`
  - `upgradesTotal = 54`
  - `templates = { opening: 4, elite: 5, survival: 5, boss: 3 }`
- 自然样本回归：`npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`: `bossBastionRuns = 7`, `crossfireSeenRuns = 3`, `firelineSeenRuns = 1`, `firelineDecisionRuns = 1`
  - `highBurst`: `bossBastionRuns = 2`, `firelineSeenRuns = 1`
  - `highMobility`: `bossBastionRuns = 4`, `firelineSeenRuns = 2`
  - 结论：这轮内容扩写没有把 `boss-bastion / fireline` 打坏；普通 build 仍是低频监控项，但没有明显变差。
- 浏览器全链路回归：`npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - anomaly 面板出现
  - Boss 节点出现
  - result / replay 跑通
  - `consoleErrors = []`
  - `summary.metrics` 明确记录了 `battle_template_entered(encounterType = boss)`、`boss_safe_window_seen(phaseId = fireline)` 等事件
  - `summary.bossBattleSeen = false` 仍是旧 QA 匹配条件滞后，不是玩法回退；截图与 metrics 都已确认 Boss 战实际进入

### 当前结论
- 项目已从 `0.9v freeze` 基线正式切到 `1.0 第一轮开发 / 1.0 内容扩写阶段`。
- 本轮通过现有数据驱动层加厚了 anomaly、battle template、nodes、upgrades 与 replay 动机，没有破坏 `Boss / anomaly / template ownership`。
- 当前最大残余风险仍然是：普通 build 下 `boss-bastion / fireline` 依旧属于低频样本，最终关远程后段仍需持续监控，但它不是本轮阻断项。
## [0.9v 音频阻断项修复] BGM / 战斗音效 / UI 音效恢复
### 本轮口径
- 若文档旧结论与真实运行反馈冲突，本轮继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md + 本轮最新用户口径` 为准。
- 因此，即便上轮文档已把项目写到 `0.9v 可封版状态`，本轮仍先按最新真实反馈临时回退到 `0.9v 封版前阻断项修复`：
  - 原因是游戏内实际听不到持续可感知的声音
  - 这属于真实 blocker，不属于后续版本监控项

### 盘点结论
- 仓库中已经存在 `PilotAudio` 与若干 `AudioCue` 接线：
  - `start / confirm / anomaly / boss / hit / crit / pressure / victory / defeat / result`
  - `MainMenuScene / GameScene / ResultScene / RunEngine` 也已有对应调用入口
- 但当前实现存在三个关键问题，叠加后会被玩家体验成“完全没声音”：
  - 没有任何实际音频资源文件，也没有 BGM 轨道
  - `PilotAudio` 只有极短、极轻的一次性程序化提示音，缺少持续可感知的声底
  - 音频解锁依赖场景内局部调用，首个交互后的 `AudioContext.resume()` 与首个 cue 之间没有补播保障，容易让玩家把第一印象直接读成静音
- 因此本轮切入点不是重做音频系统，而是：
  - 继续沿用 `PilotAudio`
  - 补最小可持续的程序化 BGM
  - 补稳定的浏览器解锁与补播
  - 保留现有 cue 接线并把听感拉到“实际可听见”

### 本轮实现
- `src/systems/PilotAudio.ts`
  - 将原本仅有短提示音的 `PilotAudio` 扩展为最小可用音频层：
    - 拆出 `music / sfx / master` 三层增益
    - 补入 `menu / battle / boss / result` 四种程序化 BGM 模式
    - 用定时调度的音序而不是资源文件，生成持续可听见的背景音乐
    - 保留既有 cue 类别，但整体提高可感知度，并给 `hit / crit / pressure` 增加更稳的 cooldown
  - 增加首交互解锁后的补播队列：
    - 如果 cue 在 `AudioContext` 仍未 running 时触发，不再直接丢失
    - 在 `resume()` 完成后自动补播排队 cue
  - 增加运行时音频调试快照：
    - 当前上下文状态
    - 当前 / 目标音乐模式
    - 峰值 RMS
    - 已调度音乐步数
    - 已播放 cue 计数
- `src/main.ts`
  - 新增全局首次 `pointerdown / keydown` 音频解锁，处理浏览器自动播放限制
  - 将 `window.__pilotAudioDebug()` 暴露到运行时，供 Playwright 做真实音频状态验证
- `src/scenes/MainMenuScene.ts`
  - 开始页进入时声明 `menu` 音乐模式
  - 开始 / 导出按钮现在都会先解锁音频再播 UI 音效
- `src/scenes/GameScene.ts`
  - 进入局内时解锁音频并进入 `battle` 音乐模式
  - 根据当前状态在 `battle / boss / result` 音乐模式之间切换
- `src/scenes/ResultScene.ts`
  - 结果页进入时切到 `result` 音乐模式
  - replay / 返回开始页 / 导出按钮现在都会先解锁再播 UI 音效
- 本轮没有引入外部音频资源文件，也没有新建复杂音频系统；采用的是最小可用的程序化生成方案

### 数据结构变更
- 无 gameplay 数据结构变更。
- 新增运行时调试接口：
  - `window.__pilotAudioDebug(): PilotAudioDebugSnapshot`

### 验证
- `npm run build`
  - 通过。
- 开始页音频验证：`output/playwright/audio-blocker-check/menu-audio-summary.json`
  - `contextState = running`
  - `currentMusicMode = menu`
  - `peakRms = 0.01144`
  - `scheduledMusicSteps = 6`
  - 说明首次交互后，开始页 BGM 已可实际输出
- 局内音频验证：`output/playwright/audio-blocker-check/battle-live-audio-summary.json`
  - `currentMusicMode = battle`
  - `peakRms = 0.01025`
  - `cueCounts.start = 1`
  - `cueCounts.pressure = 1`
  - `cueCounts.hit = 2`
  - 说明局内 BGM、命中与压力反馈已可听见
- Boss / 结果页 / replay 音频验证：`output/playwright/audio-blocker-check/fullflow-audio-summary.json`
  - `metrics.bossEvents[0].payload.encounterType = boss`
  - `resultAudio.cueCounts.boss = 2`
  - `resultAudio.currentMusicMode = result`
  - `exportAudio.cueCounts.click = 1`
  - `replayAudio.cueCounts.start = 2`
  - `replayStarted = true`
  - 说明 Boss 进入、结果页、导出按钮和 replay 已有明确音频反馈
- `consoleErrors = []`
- 本轮验证结论：
  - 音频不再只是“代码里有结构”
  - 而是在真实浏览器运行里已经能看到 running 的 `AudioContext`、非零音频峰值和关键 cue 触发

### 当前结论
- 本轮封版前阻断项“游戏内实际听不到声音”已关闭。
- 项目当前可恢复判断为：
  - 回到 `0.9v freeze sign-off`
  - 回到 `0.9v 可封版状态`
- 当前显式残余风险重新收口为：
  - 普通 build 下 `boss-bastion / fireline` 仍然是低频样本
  - 最终关远程后段仍存在“前段成立、收束偏薄”的残余风险

## [0.9v freeze sign-off] 封版签收 / 残余风险登记 / 文档收口
### 本轮口径
- 若旧阶段文档、代码现状与本轮结论存在口径差异，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md + 本轮 freeze sign-off 口径` 为准。
- 当前阶段已从“封版检查 + 可封版判断”正式收口到 `0.9v freeze sign-off`；本轮不继续开发新内容、不重写 `RunEngine`、不引入新系统，只做封版结论、残余风险登记、文档收口与本地提交。

### freeze sign-off 盘点结论
- 当前主流程已达到可封版状态：
  - `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 已稳定可跑通
  - 三流派已达到可验收状态
  - Boss / anomaly / template ownership 已稳定
  - HUD / 文案 / 音效 / 结果页 / replay 当前没有剩余 blocker
- 当前没有“必须修掉才能封版”的阻断项。
- 当前仍需被明确写进封版结论的残余风险只有一项：
  - 普通 build 下 `boss-bastion / fireline` 仍是低频样本
  - 最终关远程后段仍存在“前段成立、收束偏薄”的残余风险
- 该风险当前应定义为：
  - 后续版本观察项 / 监控项
  - 而不是当前阻断封版项

### 本轮实现
- `doc/docs/DEV_ISSUE_LOG.md`
  - 新增 freeze sign-off 顶部结论，正式记录项目已进入 `0.9v 可封版状态`。
- `doc/docs/PROJECT_STATUS.md`
  - 将当前执行焦点收口到 `0.9v freeze sign-off + 残余风险登记 + 文档收口`。
  - 将 `boss-bastion / fireline` 明确定义为残余风险，而不是继续重开开发轮的阻断项。
- `doc/docs/FREEZE_SIGNOFF_0_9V.md`
  - 新增简洁封版结论文档，集中记录：
    - 当前为何可以定义为 `0.9v 可封版状态`
    - 当前显式残余风险是什么
    - 为什么该风险属于监控项而不是阻断项
- 本轮没有修改玩法代码、没有调整数值、没有新增埋点字段。

### 数据结构变更
- 无。

### 验证
- `npm run build`
  - 通过。
- 文档一致性复核：
  - `PROJECT_STATUS.md`
  - `FREEZE_SIGNOFF_0_9V.md`
  - `DEV_ISSUE_LOG.md`
  - 口径已统一为 `0.9v freeze sign-off / 0.9v 可封版状态`
- 自动化验证口径沿用上一轮封版检查结果：
  - `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 已在上一轮验证中稳定跑通
  - `boss-bastion / fireline` 在普通 build 中维持“低频但可见”，未被重新定义为 blocker
- 本轮未重跑自然样本脚本与 Playwright 全链路。
  - 原因：本轮仅做文档收口，没有任何代码、数据、数值或 UI 逻辑变更
  - 因此本轮验证重点放在：
    - 构建仍然通过
    - 文档结论与最新开发记录口径一致

### 当前结论
- 项目当前已正式进入 `0.9v 可封版状态`。
- 当前显式残余风险列表如下：
  - 普通 build 下 `boss-bastion / fireline` 仍然是低频样本
  - 最终关远程后段仍存在“前段成立、收束偏薄”的残余风险
- 上述风险当前属于 freeze 之后的监控项，不属于 `0.9v` 阻断封版项。

## [0.9v 封版检查] 最终回归 / 残余风险监控 / 清单收口
### 本轮口径
- 若文档与代码、旧阶段记录与当前任务冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md + 本轮最新用户口径` 为准。
- 当前阶段已从“验收前修边”推进到 `0.9v 封版检查阶段`；本轮不重开内容扩写、不重写 `RunEngine`、不引入新系统，只做最终回归与小范围高价值修正。

### 盘点结论
- 当前整局主流程已经达到可封版回归的基础稳定度：
  - `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 可稳定跑通
  - 三流派在自然 run 中仍能成立
  - anomaly 仍保有独立识别感
  - Boss / anomaly / template ownership 没有出现回退迹象
- 当前仍需显式写进封版结论的残余风险，仍只有一个：
  - 普通 build 下 `boss-bastion / fireline` 的自然覆盖率偏低
  - 远程后段已经不是“完全看不到”，但仍属于低频成立项
- 本轮唯一需要动代码的小问题，是最终整备 / 最终战的目标卡仍然过于泛化：
  - 只显示 `选择下一站`
  - 对封版态来说不够直接，不利于玩家理解“这一步已经在锁定收尾”

### 本轮实现
- `src/scenes/GameScene.ts`
  - 在 `getObjectiveSnapshot()` 里，为 `nodeChoice` 增加更直接的收尾读数：
    - 最终整备入口改为 `进入最终整备`
    - 最终战入口改为 `确认最终战`
  - 同步补上更明确的说明与进度文本：
    - `这是首领战前最后一次整备，确认后先补最后一手。`
    - `这是最后一站，确认后会立刻进入本局首领收尾。`
- 本轮没有调整数值、没有调整 Boss 模板参数、没有新增埋点字段；`fireline` 继续维持监控项而不是重新拉回专项开发。

### 数据结构变更
- 无。

### 验证
- `npm run build`
  - 通过。
- `npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 10`
    - `crossfireSeenRuns = 7`
    - `firelineSeenRuns = 2`
    - `firelineDecisionRuns = 1`
  - `highBurst`
    - `bossBastionRuns = 2`
    - `firelineSeenRuns = 1`
  - `highMobility`
    - `bossBastionRuns = 5`
    - `firelineSeenRuns = 5`
  - 说明本轮只改目标卡读数，没有把普通 / 高 burst / 高机动样本做坏；`fireline` 仍维持“普通样本低频但可见”的状态。
- `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - 全链路可跑通。
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - 额外人工复检截图：
    - `panel-14` 已显示 `进入最终整备`
    - `panel-16` 已显示 `确认最终战`
    - `result` / `replay` 未出现新的超框或乱码
- 关于浏览器摘要里的 `bossBattleSeen = false`
  - 当前确认这是 QA 脚本匹配口径滞后，不是产品回退。
  - 同一份 `summary.json` 内仍明确记录：
    - `battle_template_entered(payload.encounterType = boss)`
  - 再结合最终战节点截图与结果页收尾截图，足以确认 Boss 战实际已进入且流程完整。

### 观测口径
- 本轮没有新增封版检查专用埋点。
- 原因：
  - 当前要回答的问题是“流程是否稳定、残余风险是否回退、封版前小修是否生效”。
  - 这些问题现有口径已经足够覆盖：
    - `run_finished`
    - `battle_template_entered`
    - `boss_phase_entered`
    - `boss_phase_pattern_duration`
    - `boss_safe_window_seen`
    - 本地样本脚本与 Playwright 截图复检

### 当前结论
- 项目当前已可判断为：进入 `0.9v 可封版状态`。
- 但封版结论必须继续保留一条显式风险注记：
  - 普通 build 下 `boss-bastion / fireline` 仍是低频样本
  - 最终关远程后段仍需作为 freeze sign-off 的残余监控项
- 这意味着下一步更适合做最终封版清单复核，而不是重新开启大规模开发轮。

## [0.9v 验收前修边] 全流程闭环 / 文案-HUD / 结果页收束感修边
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前阶段保持在 `0.9v 验收前修边阶段`；本轮不重开内容扩写，不改主流程，不引入新系统，也不把开发重新拉回 Boss 专项深挖。

### 盘点结论
- 当前 `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 已经能稳定跑通，剩余缺口主要是“验收感不够收束”，不是结构缺失。
- 运行时截图里的玩家可见文本仍然干净，没有出现新的乱码或内部设计术语泄露；源码终端里的乱码主要属于读取编码假象，不是运行时界面污染。
- HUD 当前已不再重压战斗区，但路线读数在前段仍有“全 0 chip 占位”的轻噪音；结果页对“本局路线怎么走完”“为什么值得 replay”表达还偏薄。
- 关键音效事件已经基本覆盖，本轮更适合做接线一致性复检，而不是再扩音频层。
- `boss-bastion / fireline` 仍然是当前最大的单点回归监控项，但本轮验证里没有出现明显回退迹象。

### 本轮实现
- `src/data/battleTemplates.ts`
  - 将玩家可见的战斗读数从偏设计口吻压回更自然的表述：
    - `Boss载体 -> Boss战`
    - `主核 -> 首领`
    - `准备交火 -> 交战在即`
  - 同步将几处玩家可见的 Boss / 精英模板名改成更外显的命名，避免结果页和 HUD 再出现“主核”口径。
- `src/data/nodes.ts`
  - 最终关 Boss 节点标题从 `追猎主核 / 锁域主核 / 屏卫主核` 调整为 `追猎首领 / 锁域首领 / 屏卫首领`。
  - 中段精英节点说明里的 `主核` 口径同步改为 `首领`。
- `src/game/types.ts`
  - `RunResult` 补入：
    - `routeTrace`
    - `replayPrompt`
- `src/systems/RunEngine.ts`
  - 结算时补生成本局节点路径摘要，供结果页直接表达“这一局怎么走到了收尾”。
  - 按路线成立度与结束方式补一条轻量 replay 提示，强化“再来一局”的完成感与动机。
- `src/ui/OverlayController.ts`
  - 结果页新增“本局路线” trace 区块，不再只给收尾节点和统计数字。
  - 结果页新增 replay prompt，让失败局和完成局都更像一个完整闭环，而不是只剩按钮。
  - HUD 的路线条现在只显示已出现的 route progress；如果尚未站稳，则改成单枚 `未站稳` chip，减少前段视觉噪音。
- `src/style.css`
  - 为结果页路径 trace / replay prompt 补充轻量样式。
  - 为 HUD 新增 `route-chip-muted`，把早局路线信息压回更轻的占位表达。
- 本轮没有新增音效系统或新 cue，只复检现有 `start / confirm / anomaly / boss / victory / defeat / result` 接线，确保修边后仍然统一。

### 数据结构变更
- `RunResult.routeTrace: NodeRecord[]`
- `RunResult.replayPrompt: string`

### 验证
- `npm run build`
  - 通过。
- `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `start -> battle / upgrade / anomaly -> boss -> result -> replay` 全链路可跑通。
  - 新结果页截图已复检：
    - 本局路线 trace 已显示。
    - replay prompt 已显示。
    - 无明显超框、无新的文字污染。
  - 新 HUD 截图已复检：
    - 前段不再显示三枚 `0` 路线 chip。
    - Boss 战 HUD 未被本轮修边重新压重。
  - `consoleErrors = []`
- 基于最新构建另起预览端口 `127.0.0.1:4174` 复检
  - 玩家可见的新文案已经生效：
    - 中段节点说明已显示 `偏首领正压`
    - 结果页 trace / replay prompt 保持正常
  - `consoleErrors = []`
- `npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 1`
    - `firelineDecisionRuns = 1`
  - `highBurst`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 1`
  - `highMobility`
    - `crossfireSeenRuns = 5`
    - `firelineSeenRuns = 3`
  - 说明本轮闭环 / HUD / 结果页修边没有把 `boss-bastion / fireline` 做坏。

### 观测口径
- 本轮没有新增埋点字段。
- 原因：
  - 当前结果页与 replay 完成感修边不需要新埋点系统。
  - `boss-bastion / fireline` 的回归观察继续复用：
    - `boss_phase_entered`
    - `boss_phase_duration`
    - `boss_signature_seen`
    - `boss_phase_pattern_seen`
    - `boss_safe_window_seen`
    - 以及本地自然样本脚本 `output/qa/boss-pocket-natural-runs.mts`

### 当前剩余风险
- `boss-bastion / fireline` 在普通 build 下依旧不是高频样本；当前仍然是 `1 / 8` 级别的可见度，继续是封版前的最大残余监控点。
- 结果页与 HUD 已更接近验收态，但项目还没到“直接宣告冻结”的程度；更合适的下一步是正式进入一轮 `0.9v 封版检查`，做最终一致性与残余风险复检。
## [0.9v 验收前修边] 普通 build 回归校准 + `boss-bastion / fireline` 自然覆盖率修正
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 本轮不再继续做大范围内容扩写，也不重开 Boss 系统专项；主线切到普通 build 回归校准与最终关远程后段覆盖率修正。
- 当前阶段判断更新为：项目已更适合进入 `0.9v 验收前修边阶段`，但 `boss-bastion / fireline` 仍是最大的单点回归监控项。

### 盘点结论
- 当前 `boss-bastion / fireline` 的问题已经不是“phase 不存在”，而是普通 build 的 boss 战更容易在 `接敌 / 交火` 内分出胜负：
  - 一部分 run 会在 `crossfire` 前就超时或败退。
  - 另一部分 run 能进入 `crossfire`，但会在 `crossfire -> fireline` 的承接窗口里提前击杀或提前失败。
- 第一轮只前移 `triggerRemainingSec` 的试调没有抬起普通 build，反而对高机动样本有回退风险；因此本轮最终切入点改为：
  - `crossfire` 更早通过 HP 承接成立。
  - 缩短 `crossfire` 的最短驻留。
  - 让 `fireline` 主要通过 HP 承接而不是更激进的时间前置进入。
  - 用现有 signature carrier 给 `fireline` 补一层轻量进段确认。

### 本轮实现
- `src/data/battleTemplates.ts`
  - `boss-bastion / crossfire`
    - `triggerHpRatio: 0.72 -> 0.78`
    - `minResidenceSec: 4.4 -> 3.4`
    - `triggerRemainingSec` 保持 `25`，没有继续粗暴前置到更早时间点。
  - `boss-bastion / fireline`
    - 新增轻量进段确认：
      - `signatureLabel = 压边迁火`
      - `signatureDurationSec = 2.8`
      - `signaturePulseIntervalSec = 1.02`
      - `signatureVolleyCount = 2`
    - 调整承接与可读性：
      - `triggerHpRatio: 0.48 -> 0.62`
      - `patternSafeWindowLingerSec: 0.98 -> 1.02`
      - `triggerRemainingSec` 维持 `15`
      - `entryGuardSec / entryGuardDamageMultiplier` 维持既有值，避免重新做成强锁血味道
- 取舍说明：
  - 没有加 Boss 基础血量，没有加怪量，也没有补新的 pressure system。
  - 没有继续把 `fireline` 粗暴前提到更早的纯时间后段，而是让短战局 normal sample 也能通过 HP 承接读到后段。

### 数据结构变更
- 无新增数据结构。
- 继续复用既有 `pressurePhases + signature + pattern + safe-window(pocket)` carrier，只在 `boss-bastion` 的 phase 配置上做兼容数值微调。

### 验证
- `npm run build` 通过。
- `npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 4`，较上一轮 `3` 提升
    - `firelineSeenRuns = 1`，较上一轮 `0` 提升
    - `firelineDecisionRuns = 1`
  - `highBurst`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 1`
    - 无明显回退
  - `highMobility`
    - `crossfireSeenRuns = 5`
    - `firelineSeenRuns = 3`
    - 维持上一轮可见度与转场决策读数
- `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `start -> battle / upgrade / anomaly -> final prep -> boss -> result -> replay` 全链路可跑通
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - 最新 `boss-battle.png` 与 `result.png` 已复检：无明显超框、无新乱码、HUD/readability 未被这轮回归校准破坏

### 观测口径
- 本轮没有新增 `boss_fireline_seen_natural / boss_fireline_phase_enter / boss_fireline_completion_window`。
- 原因是当前已有观测已能覆盖等价判断：
  - `boss_phase_entered`
  - `boss_phase_duration`
  - `boss_signature_seen`
  - `boss_phase_pattern_seen`
  - `boss_safe_window_seen`
  - 以及本地自然样本脚本 `output/qa/boss-pocket-natural-runs.mts`
- 继续新增一组 fireline 专名埋点，只会重复已有信号，不符合本轮“最小校准、不引入新系统”的边界。

### 当前剩余风险
- 普通 build 下 `boss-bastion / fireline` 已从 `0 -> 1`，但自然覆盖率仍偏低，依旧是当前最大的单点风险。
- 当前最主要的残余问题已收敛为：
  - 普通样本里 `fireline` 已经能更自然出现，但仍然偏少。
  - 某些 run 仍会停在 `接敌 / 交火` 段结束，最终关远程后段还需要继续监控。
- 下一步更适合继续做：
  - 普通 build 的自然样本复检与回归监控
  - 最终关 readability / result closure 的验收前修边
  而不是重新回到大规模内容扩写。

## [0.9v 内容扩写与结构分层] 三流派 0.9 收口 + 普通 build 回归监控
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前主线已不再是 Boss pocket 深挖；本轮改为围绕 `暴击 / 穿透 / 穿梭` 三条路线做 `0.9v` 收口。
- `boss-bastion / fireline` 继续只作为普通 build 回归监控项，本轮不把它重新拉回主线专项。

### 盘点结论
- 暴击流前段信号已经成立，但中后段仍偏“暴击相关数值继续变高”，还不够像 `升温 -> 连发维持 -> 爆点收尾` 的完整路线。
- 穿透流底层其实已经有 `echo / cooldown refund`，但内容层不少 payoff 仍停留在弹速、multishot、基础伤害的普通火力语言里，`清线 / 续链 / 回响 / 扇裂` 身份还不够满。
- 穿梭流底层机制最独特，但内容层此前更偏机动和容错，和 `规避蓄能 -> 回线反打 -> Boss 收尾` 的联系还不够紧。
- anomaly 与三流派的互动仍有一块“看起来像路线奖励分发”的残余：`热区记录 / 裂轨图谱 / 穿梭记忆` 原本还挂在普通 `event` 口径下，没有真正站到 anomaly lane。
- battle / boss 载体已经分层，但路线与 carrier 的关系此前主要靠玩家自己读；数据层还缺一层“轻量 route-fit 倾向”。

### 本轮实现
- `src/data/upgrades.ts`
  - 为三流派各补一张更偏中后段承接的 route payoff：
    - `热区压缩`
    - `贯层回响`
    - `回切反打`
  - 取舍目标不是继续泛补卡池，而是让：
    - 暴击更像中段压热区、后段兑现爆点
    - 穿透更像中段起回响、后段铺扇裂
    - 穿梭更像中段开始把换位转成反打收益
- `src/data/events.ts`
  - 将三条路线原本偏普通事件化的 rare payoff 内容正式并回 anomaly lane：
    - `热区记录 -> anomaly / distortion`
    - `裂轨图谱 -> anomaly / hybrid`
    - `穿梭记忆 -> anomaly / distortion`
  - 同步补强这些 route anomaly 的选项味道：
    - `热区记录` 现在更明确分成“续热点火”与“压缩爆点”
    - `裂轨图谱` 现在更明确分成“续链打穿”与“扇裂铺面”
    - `穿梭记忆` 现在更明确分成“擦身蓄能”与“稳帧反打”
- `src/data/nodes.ts`
  - `NodeSelectionProfile` 新增轻量 `routeBonuses`，不改节点系统，只在现有 blueprint 权重上补一层 route-fit 倾向。
  - opening / mid / late 的 battle blueprints 现在会按路线给轻量权重倾斜：
    - `侧压试飞 / 尾段突压` 更偏暴击、穿梭
    - `厚线突围 / 拖场绞锁 / 夹道求生` 更偏穿透
    - `封锁突破 / 交火夹层` 更偏穿梭与部分穿透
  - final boss blueprints 现在也有轻量 route-fit 倾向，但仍不是硬锁：
    - `追猎主核` 更偏暴击收尾
    - `锁域主核` 更偏穿梭收尾
    - `屏卫主核` 更偏穿透收尾
  - Boss 节点描述同步改成更玩家向的 route-fit 读数，帮助最终关与路线关系更清楚。

### 数据结构变更
- `src/data/nodes.ts`
  - 本地 `NodeSelectionProfile` 新增 `routeBonuses?: Partial<Record<RouteId, number>>`
- 未新增新系统、未扩 `RunEngine` 主结构、未新增新的埋点类型。

### 验证
- `npm run build` 通过。
- 路线静态抽样验证通过：
  - opening / mid / late battle carrier 已出现轻量 route-fit 倾向：
    - `crit` 更常撞上 `侧压试飞 / 精英压制 / 尾段突压`
    - `pierce` 更常撞上 `厚线突围 / 拖场绞锁 / 夹道求生`
    - `dash` 更常撞上 `侧压试飞 / 封锁突破 / 交火夹层 / 尾段突压`
  - final boss 抽样已拉开轻量偏置：
    - `crit -> 追猎主核 629 / 1200`
    - `pierce -> 屏卫主核 616 / 1200`
    - `dash -> 锁域主核 653 / 1200`
  - 新增的 route payoff upgrade 已进入 route-leaning upgrade 窗口：
    - `mid nodePrep` 抽样中，`热区压缩 / 贯层回响 / 回切反打` 均能稳定进入对应路线的中段强化候选
  - late anomaly 抽样中，`热区记录 / 裂轨图谱 / 穿梭记忆` 已按各自路线出现在 anomaly lane，而不再只停留在普通 event 池
- Boss 远程后段回归监控：
  - `npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`：`crossfireSeenRuns = 3`、`firelineSeenRuns = 0`
  - `highBurst`：`firelineSeenRuns = 1`
  - `highMobility`：`firelineSeenRuns = 3`
  - 说明本轮没有把 `boss-bastion / fireline` 明显做坏；普通 build 覆盖率仍是既有风险点
- 浏览器全链路验证通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `start -> battle / upgrade / anomaly -> final prep -> boss -> result -> replay` 全链路可跑通
  - 最新 `boss-battle.png / result.png / panel-17.png` 已复检：
    - Boss HUD、结果页、最终整备新卡文本均无乱码
    - 新 Boss 节点描述无明显超框
    - console errors 仍为 `[]`

### 当前剩余风险
- 普通 build 下 `boss-bastion / fireline` 的自然覆盖率仍偏低，依旧是当前最大的单点回归监控项。
- 三流派现在已经更像三条不同 build 线，但 route-fit 仍是“轻量倾向”，不是强锁定；后续如果内容继续扩写而不维护这个倾向层，仍可能重新被读回“同一套 build 换不同数值”。
- route payoff anomaly 已并回 anomaly lane，但后续若再补大量普通 route 奖励事件，不继续守住 anomaly 边界，仍可能再次稀释异常识别感。

## [0.9v 内容扩写与结构分层] anomaly 深度扩写 + battle template 家族分层
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 本轮不再把整轮开发投入到 Boss 远程 pocket 微调；`boss-bastion / fireline` 只保留为普通 build 回归监控项。
- 当前阶段判断更新为：项目已从 `0.9v` 的“读数 / 压力校准阶段”切入“内容扩写与结构分层阶段”。

### 盘点结论
- anomaly lane 已经独立，但池子里仍混着一批偏“路线改道工具”的 anomaly；它们能承担 route window，却不够像低频扭曲记忆点。
- battle template 家族已经存在，但前段 / 中段 / 后段里仍有几组更像“同家族参数档位”而不是稳定职责分层。
- `elite-vice` 这类低频模板此前实际上没有稳定节点入口，`elimination-sweep` 与 `survival-rush` 的阶段职责也不够显眼。
- `boss-bastion / fireline` 的普通 build 覆盖率仍偏低，但本轮只要求不回退，不继续把它当主线深挖。

### 本轮实现
- `src/game/types.ts`
  - `EventDefinition` 新增轻量 `anomalyClass`：
    - `routeWindow`
    - `distortion`
    - `hybrid`
    - `bossEcho`
- `src/data/contentSelectors.ts`
  - anomaly 选择现在会按 `anomalyClass + phase` 做轻量乘区：
    - `routeWindow` 保留为支持型异常入口，但不再主导 late / finalPrep 的 anomaly 味道
    - `distortion / hybrid / bossEcho` 在 mid / late / finalPrep 更容易成为 anomaly 主池记忆点
- `src/data/events.ts`
  - 新增更像 anomaly 的内容：
    - `断层竞价`
    - `幽栅并轨`
    - `终端税`
  - 明确给现有 anomaly 标注 `anomalyClass`
  - 下调一批过于工具化的 anomaly 入口权重：
    - `risky-protocol`
    - `relay-splice`
    - `route-handoff`
    - `crit / pierce / dash-reroute-window`
    - `cross-branch-signal`
  - 上调一批更偏扭曲 / 混搭 / Boss 阴影的 anomaly：
    - `phase-debt`
    - `phase-splitter`
    - `null-lens`
    - `carrier-breach`
    - `blackbox-bargain`
    - `mirror-cache`
    - `boss-shadow-scan`
- `src/data/nodes.ts`
  - 新增 battle blueprints：
    - opening：`厚线突围`
    - mid：`拖场绞锁`
    - late：`尾段突压`
  - 强化 anomaly 节点标题与描述，让节点本身更像异常承载，而不是普通 event 面板入口。
  - 修正 `round-3-event-blackbox` 的旧字形特殊处理，玩家可见标题恢复为 `黑匣异常`。
- `src/data/battleTemplates.ts`
  - 继续只用现有 `template / rule / selector / blueprint` 数据结构强化 family 差异。
  - 前段普通战：
    - `elimination` 更明确承担清线推进
    - `elimination-pincer` 更明确承担侧压换位
    - `elimination-sweep` 更明确承担厚线突围
  - 中段精英战：
    - `elite` 更偏正面拆主核
    - `elite-screen` 更偏护卫遮线
    - `elite-lockdown` 更偏侧压封位
    - `elite-vice` 更偏低频拖场绞锁
  - 后段生存战：
    - `survival` 更偏基础求生
    - `survival-rush` 更偏尾段突压
    - `survival-gauntlet` 更偏厚体压线
    - `survival-crossfire` 继续承担低频交火记忆点
  - 顺手修正了远程 pocket HUD 中 `横切 / 回心 / 压边` 的中文读数。
- `src/ui/OverlayController.ts`
  - 节点卡不再把 battle / anomaly 都读成统一占位描述，而是直接显示 blueprint 的玩家向描述。
  - anomaly 面板现在会按 `anomalyClass` 显示不同说明：
    - 改道窗口
    - 扭曲处理
    - 并轨样本
    - Boss 阴影准备

### 验证
- `npm run build` 通过。
- anomaly 抽样验证通过：
  - `mid-crit-hinted` 样本里，前排 anomaly 已变成 `phase-splitter / ghost-mesh / faultline-auction` 这类扭曲 / 混搭内容；`routeWindow` 仍存在，但不再独占 anomaly 主味道。
  - `late-pierce-committed` 样本里，`distortion + hybrid + bossEcho` 总量已明显高于单纯 route-window。
- 节点 / 模板抽样验证通过：
  - opening 可稳定抽到 `厚线突围`
  - mid 可稳定抽到 `拖场绞锁`，且 `elite-vice` 已真正进入节点候选
  - late 可稳定抽到 `尾段突压`，`survival-rush / survival-gauntlet / survival-crossfire` 分工更清楚
- Boss 远程后段回归监控：
  - `npx tsx output/qa/boss-pocket-natural-runs.mts`
  - `normal`：`crossfireSeenRuns = 3`、`firelineSeenRuns = 0`
  - `highBurst`：`firelineSeenRuns = 1`
  - `highMobility`：`firelineSeenRuns = 1`
  - 说明本轮没有把 Boss 远程后段直接做坏，但普通 build 下的 `fireline` 覆盖率仍是监控项。
- 浏览器全链路验证通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `start -> battle / anomaly -> final prep -> boss -> result -> replay` 全链路可跑通
  - 新节点文案、异常说明和结果页截图已复检，无明显超框、无乱码、无新 console error

### 当前剩余风险
- `boss-bastion / fireline` 在普通 build 下仍偏少见，依然是整局里最大的单点回归监控项。
- anomaly 的 route-window 入口本轮被降成支持层，但后续若继续大量补路线工具内容，仍可能再次稀释 anomaly 识别感。
- battle template 分层已经拉开第一轮，但后续如果只继续补模板数值、不继续维护 blueprint 与 UI 读数，仍可能重新被读回“同模板不同档位”。

## [0.9v 流程完整度推进] 整局链路收口与基础音效首轮覆盖
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目不再适合继续深挖单点 Boss pocket；本轮目标是把 `start -> battle / upgrade / anomaly -> final prep -> boss -> result -> replay` 的整局完整感和基础反馈闭环收口出来，不改主流程、不重写 `RunEngine`、不引入新系统。

### 盘点结论
- 当前整局结构已经是完整链路：
  - `开始页 -> 起始 battle -> opening / mid / late 节点推进 -> final prep -> boss -> 结算 -> replay`
- 真正的缺口不在“有没有系统”，而在两层轻缺口：
  - 阶段承接还偏轻，节点面板更像泛用 panel，`mid / late / finalPrep / finalBattle` 的整局味道不够稳
  - 基础音效只覆盖了 `click / upgrade / hit / crit / pressure / result`，缺少明显的 `start / confirm / anomaly / boss / victory / defeat`
- 文档口径也有一处需要同步：
  - `CORE_LOOP.md` 顶部摘要仍残留旧的 `battle / upgrade / event` 说法，需要回到当前代码与基线要求的 `battle / upgrade / anomaly / final prep / boss / replay`

### 本轮实现
- `src/data/nodes.ts`
  - 调整 `round 2 / round 3` 的 `countWeights`，降低单选占比，提高 `2~3` 选出现率。
  - 轻量上调 `mid / late` anomaly 节点蓝图权重，让自然 run 更容易看到 battle / upgrade / anomaly 的完整节奏，而不是单一路径连走。
- `src/ui/OverlayController.ts`
  - 节点面板现在会按 `opening / mid / late / finalPrep / finalBattle` 给出阶段说明。
  - 取舍目标不是重做 UI，而是让 panel 本身承担整局承接说明，减少“只有卡片变了、整局没变”的感觉。
- `src/scenes/GameScene.ts`
  - 节点确认音由普通 `click` 改为 `confirm`。
  - anomaly 面板首次打开时会播放 anomaly cue，让异常节点不再只在按钮确认后才有反馈。
- `src/game/types.ts`
  - `AudioCue` 扩展为：
    - `confirm`
    - `start`
    - `anomaly`
    - `boss`
    - `victory`
    - `defeat`
- `src/systems/PilotAudio.ts`
  - 在现有轻量合成音结构上补齐上述 cue 的首轮 profile。
  - 本轮没有新建复杂音频系统，只继续沿 `PilotAudio` 做频率 / 时长 / cooldown 层级区分。
- `src/scenes/MainMenuScene.ts`
  - 开始游戏改为播放 `start`，不再和普通 `click` 共用同一 cue。
- `src/systems/RunEngine.ts`
  - anomaly 选项确认改为播放 `anomaly`。
  - 普通 battle 进入仍使用 `pressure`，Boss 进入与 Boss phase 转段改为播放 `boss`。
  - `mid / late / finalPrep / finalBattle` 进入时补入轻量 phase-advance cue，帮助整局阶段切换更像完整 run。
  - 胜利 / 失败结算前改为分别播放 `victory / defeat`。
- `src/scenes/ResultScene.ts`
  - 结果页打开时播放 `result`，重开时播放 `start`，把“结算打开”和“重新开始一局”分开。
- `doc/docs/CORE_LOOP.md`
  - 顶部摘要已同步到当前口径：`battle / upgrade / anomaly -> final prep -> boss -> 结算 -> replay`

### 数据结构变更
- `AudioCue` 新增：
  - `confirm`
  - `start`
  - `anomaly`
  - `boss`
  - `victory`
  - `defeat`
- `ROUND_NODE_OFFERS` 的 `round 2 / round 3` 分发权重已更新，用于提高中后段完整跑局的节点丰富度。
- 本轮没有新增 metrics 字段；继续沿现有埋点结构导出即可。

### 验证
- `npm run build` 通过。
- 节点分发抽样验证通过：
  - `round 2`
    - `1 选 = 66 / 800`
    - `2 选 = 329 / 800`
    - `3 选 = 405 / 800`
    - `anomalyOffers = 636 / 800`
  - `round 3`
    - `1 选 = 104 / 800`
    - `2 选 = 372 / 800`
    - `3 选 = 324 / 800`
    - `anomalyOffers = 452 / 800`
- 浏览器全链路验证通过：
  - `node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - 最新截图已复查：
    - 节点 panel 现在会按阶段说明 run 位置
    - 结果页收尾信息依然干净，`Boss · 锁域主核` 口径保持正确

### 剩余风险
- `boss-bastion / fireline` 在普通 build 下的自然覆盖率仍偏低，依然是整局阶段里最大的单点风险。
- 当前音效仍是“基础反馈闭环”版本，不是最终素材和混音版本；后续继续加 cue 时要严控密度，避免重新变吵。
- 这轮刻意没有继续深挖 Boss pocket、没有扩音频系统、没有大做表现层；原因是当前更高收益的是先把整局完整感和基础闭环站稳。

## [0.9v 读数 / 压力校准] 远程 phase pocket 转场自然成立性校准
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标不是继续加新 pocket 类型，也不是继续堆血，而是让 `boss-bastion / fireline` 的 pocket 转场在自然样本里更常见、更容易形成真实“留还是转”的判断。

### 盘点结论
- 上轮 targeted phase probe 已能证明：
  - `crossfire` 能稳定出现 `sweep / centerReset`
  - `fireline` 能稳定出现 `edgeBounce / centerReset`
- 但旧的 `output/qa/boss-pocket-natural-runs.mts` 并不可信：
  - 它是冷启动单 Boss 沙盒，而不是完整自然推进
  - 更关键的是它没有处理 battle 内 `levelUp` 面板，导致 run 经常停在 `upgradeChoice`，样本被误读成 `outcome: ongoing`
- 修正脚本后，当前真正的问题被确认是：
  - `crossfire` 在自然 build 里已经稳定可见
  - `fireline` 虽然不再只存在于 targeted probe，但仍偏后段、偏少见
  - 普通 build 尤其容易在看到 `crossfire` 后就结束于击杀或败退，`fireline` 的自然存在感仍不足
- 本轮更稳妥的最小切入点仍然不是新系统，而是继续沿现有 `pressurePhases + pattern pulse + pocket` 做轻量前置：
  - 让 `fireline` 稍早触发
  - 保持 `crossfire -> fireline` 的阶段层次，不把后段直接前置成同味道 phase

### 本轮实现
- `src/data/battleTemplates.ts`
  - `boss-bastion / fireline / 火线收束`
    - `patternPulseIntervalSec: 1.18 -> 1.08`
    - `triggerHpRatio: 0.35 -> 0.48`
    - `triggerRemainingSec: 10 -> 15`
    - `minResidenceSec: 4.8 -> 4.2`
  - 取舍目标：
    - 不是新增 pocket 类型
    - 也不是靠堆血硬拖到后段
    - 而是让 `fireline` 在自然样本里更容易留下最小存在感，同时保留 `crossfire` 作为前一段远程主味道
- `output/qa/boss-pocket-natural-runs.mts`
  - 改写为完整自然推进样本：
    - 会处理 `battle / nodeChoice / upgradeChoice / eventChoice / result`
    - 不再被 level-up 面板卡成 `ongoing`
  - 样本步长从 `100ms` 降到 `50ms`，减少远程 pocket 与躲线读数被粗步长踩坏
  - 为了避免最终 Boss 池的 `1/3` 随机性把 `boss-bastion` 样本稀释掉，当前自然样本采用：
    - 自然 build 推进到 final prep
    - final battle 锁定为 `boss-bastion`
  - 这是“自然 build + 指定最终关载体”的 QA 口径，不是旧的 targeted phase probe

### 验证
- `npm run build` 通过。
- `npx tsx output/qa/boss-space-windows.mts` 继续通过，确认：
  - `boss-hunt / close-in` 纵向安全窗未被本轮校准破坏
  - `boss-lockdown / pin-down` 横向安全窗未被本轮校准破坏
  - `boss-bastion / crossfire` 仍能稳定给出 `pocket + shiftType`
- `npx tsx output/qa/boss-pocket-natural-runs.mts` 结果更新为：
  - `highBurst`
    - `bossBastionRuns = 9`
    - `crossfireSeenRuns = 9`
    - `firelineSeenRuns = 2`
    - `firelineDecisionRuns = 1`
    - 已出现 `edgeBounce + centerReset`，且样本内出现了 `11` 次 fireline 转场决策窗口
  - `highMobility`
    - `bossBastionRuns = 5`
    - `crossfireSeenRuns = 5`
    - `firelineSeenRuns = 1`
    - `firelineDecisionRuns = 1`
    - 已出现 `edgeBounce + centerReset`，且样本内出现了 `13` 次 fireline 转场决策窗口
  - `normal`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 0`
    - 说明普通 build 下 `fireline` 仍然偏少，但当前问题已从“只靠 targeted probe 才存在”推进到“自然 build 的覆盖率仍需继续抬”
- 浏览器全链路验证继续通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `anomaly -> boss -> result -> replay` 可跑通
  - `consoleErrors = []`
  - 最新截图确认 HUD 与结果页仍然干净，没有因为自然化校准重新膨胀 UI

### 剩余风险
- `fireline` 现在已经不再只存在于 targeted probe；高 burst / 高机动自然 build 下都能出现真实 pocket 转场决策。
- 但普通 build 的 `fireline` 自然进入率仍然偏低，这意味着当前最大风险已收敛为：
  - 最终关远程后段在普通 build 下仍可能偏向“交火段成立、收束段稀薄”
  - 下一步更适合继续做普通样本覆盖率校准或 `crossfire -> fireline` 的轻量承接优化
  - 而不是继续加血、加怪或扩成新 Boss 系统

## [0.9v 读数 / 压力校准] 远程 phase pocket 转场模式丰富化
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标不是继续补血量或补怪量，而是让远程 phase 的 pocket 转场不只剩单一锚点迁移。

### 盘点结论
- 当前最单一的 pocket 迁移逻辑仍在 `boss-bastion / crossfire`。
- 上轮 pocket 虽然已经成立，但本质上还是：
  - 固定锚点序列
  - 少量玩家位置混合
  - 一种主要的“中区横移 / 斜移”味道
- 这种做法已经足够让玩家看到安全袋，但高机动 build 更容易把它读成“记住一套转场节拍后继续风筝”。
- 更稳妥的最小切入点不是加新系统，而是：
  - 在现有 `pattern pulse + pocket` 上补 `shift mode`
  - 让 `boss-bastion` 的不同远程 phase 使用不同 pocket 转场风格
  - 并把 pocket 的短标签同步进 HUD 与低成本观测

### 本轮实现
- `src/game/types.ts`
  - 新增 `PressurePocketShiftModeId = sweep / centerReset / edgeBounce`
  - `BattlePressurePhaseDefinition` 新增 `patternPocketShiftModes`
  - `BattleState` 新增：
    - `pressureSafeWindowShiftType`
    - `pressurePocketShiftSeen`
- `src/data/battleTemplates.ts`
  - `boss-bastion / crossfire / 交火`
    - pocket 转场改为 `sweep + centerReset`
  - `boss-bastion / fireline / 火线收束`
    - 不再只是旧参数收束段
    - 现在也接入 `crossfireWave` pocket carrier
    - pocket 转场改为 `edgeBounce + centerReset`
    - 并使用更短 linger、更小 pocket 与更快 pulse，形成“压边迁火”味道
  - battle readout 现在会把 pocket 读成：
    - `安全袋 横切`
    - `安全袋 回心`
    - `安全袋 压边`
- `src/systems/RunEngine.ts`
  - pocket 打开时会先解析当前 `shiftType`
  - 不同 `shiftType` 会轻量影响：
    - 锚点集合
    - 玩家混合权重
    - pocket 尺寸
    - linger 时长
  - `crossfire` 现在不再只走单一锚点循环；`fireline` 也不再复用同一套 pocket 迁移节拍
  - `boss_safe_window_seen(axis = pocket)` 现在会按 phase 记录第一次见到的 `shiftType`
- `src/scenes/GameScene.ts`
  - HUD 子读数现在可直接读出当前 pocket 的短标签
  - `crossfireWave` overlay 会根据 `shiftType` 做轻量差异：
    - `centerReset`：更强调中心确认
    - `edgeBounce`：更强调边缘压迫
    - `sweep`：继续保持火线横切读数
- `src/systems/MetricsTracker.ts`
  - 没有新增 `boss_pocket_shift_seen / boss_pocket_shift_type / boss_pocket_reposition_used` 事件族
  - 继续复用 `boss_safe_window_seen`
  - 并补了可选 `shiftType`

### 验证
- `npm run build` 通过。
- `npx tsx output/qa/boss-space-windows.mts` 继续通过，确认：
  - `boss-hunt / close-in` 仍是纵向安全窗
  - `boss-lockdown / pin-down` 仍是横向安全窗
  - 说明本轮没有把既有 corridor phase 做坏
- 新增本地 QA 脚本 `output/qa/boss-pocket-shifts.mts` 做 pocket 转场抽样，覆盖：
  - `normal`
  - `highBurst`
  - `highMobility`
  - 三组样本都能确认 `boss-bastion / crossfire` 的 pocket 稳定存在
  - `crossfire` 已能看到 `sweep / centerReset`
  - 额外 targeted 样本确认 `fireline` 已能看到 `edgeBounce`
  - 高机动样本中 `fireline` 已能实际进入 `edgeBounce + centerReset` 的压边迁火段
- 浏览器全链路验证继续通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `anomaly -> boss -> result -> replay` 可跑通
  - `consoleErrors = []`
  - HUD 与结果页截图继续保持干净
  - 这次浏览器样本命中的是 `boss-hunt`，所以 pocket shift 的主验证仍以运行时 QA 抽样为主

### 剩余风险
- `boss-bastion` 现在已经不只是一种 pocket 转场，但 `fireline` 的 `centerReset` 在自然样本里仍偏后段，当前更多由 targeted phase probe 证明其成立。
- 如果后续高 burst / 高机动继续上涨，下一步更可能需要的是：
  - 继续丰富 pocket 路径与 phase 间转场窗口
  - 持续观察自然样本里 `fireline` 是否足够常见、是否真的迫使玩家提前转场
  而不是继续加血或堆投射物。

## [0.9v 读数 / 压力校准] 远程 phase 空间口袋强化 + 真实玩家样本验证
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是给远程 Boss phase 补稳定空间口袋，并补真实玩家式样本验证，不回退到恢复期，也不转去纯内容堆量。

### 盘点结论
- 当前真正薄弱的远程 phase 是 `boss-bastion / crossfire`。
- 它此前的主要压力来源仍是：
  - 齐射节奏
  - 护卫刷新
  - 远程敌人与敌方投射物
  - 旧 `screened / summoner / kiting` 行为谱系的延伸
- 玩家已经能感觉到“交叉火线”有压力，但还不够稳定读出：
  - 哪里是危险区
  - 哪里是短时安全口袋
  - 什么时候该横切或转场
- 高机动 / 高 burst 构筑下，`crossfire` 最容易退回“风筝火线”而不是“读场地口袋”。

### 本轮实现
- `src/game/types.ts`
  - `PressureSafeWindowAxis` 扩到 `vertical / horizontal / pocket`
  - `BattlePressurePhaseDefinition` 新增 `patternSafeWindowSecondarySize`
  - `BattleState` 新增：
    - `pressureSafeWindowSecondaryCenter`
    - `pressureSafeWindowSecondarySpan`
- `src/data/battleTemplates.ts`
  - `boss-bastion / crossfire` 现在不再只是纯齐射 phase，补入：
    - `patternSafeWindowSize = 184`
    - `patternSafeWindowSecondarySize = 126`
    - `patternSafeWindowLingerSec = 1.16`
    - `patternWallShotCount = 5`
    - `patternPulseIntervalSec = 1.52`
    - `patternVolleyCount = 1`
  - battle readout 现在会在远程口袋激活时读成 `安全袋`，不再误读成纵向/横向安全窗。
- `src/systems/RunEngine.ts`
  - `crossfireWave` 现在改为：
    - 打开一个短时、会迁移的 `pocket` 安全区
    - 从上下左右四侧发射排布火线，压口袋外区域
    - 保留低量齐射，维持远程 phase 身份
  - 新增 / 扩展：
    - `choosePressureSafePocketCenter(...)`
    - `collectPressureSlotPositions(...)`
    - `getPressureProjectileStats(...)`
    - `spawnPressurePocketShots(...)`
  - 口袋中心改成“锚点主导 + 少量跟随玩家”，避免高机动下直接贴脸跑。
- `src/scenes/GameScene.ts`
  - 远程 pocket 激活时，场地会显示矩形安全袋与四周危险区遮罩。
  - `crossfireWave` 在 pocket 存在时仍保留轻量交叉线条，保证玩家能继续读出“远程火线 phase”，而不是误看成近战走廊。
- `src/systems/MetricsTracker.ts`
  - 继续复用已有：
    - `boss_phase_pattern_seen`
    - `boss_phase_pattern_duration`
  - `boss_safe_window_seen` 现在允许：
    - `axis = pocket`
    - `secondarySpan`
  - 本轮没有新增 `boss_remote_phase_seen / boss_safe_pocket_seen / boss_phase_escape_window_used` 新事件族，避免把远程 pattern 观测拆成高噪音埋点；已有 pattern + safe-window 事件已足够等价表达。

### 验证
- `npm run build` 通过。
- `npx tsx output/qa/boss-space-windows.mts` 通过，并确认：
  - `boss-bastion / 交叉火线`
    - `safeWindowAxis = pocket`
    - `firstSpan = 184`
    - `secondarySpan = 126`
    - `safeWindowCount = 2`
- 额外补了一轮脚本化“真实玩家式”样本验证，覆盖：
  - `normal`
  - `highBurst`
  - `highMobility`
  结论是三组样本都能稳定看到远程 pocket，且 pocket 会从左中区域迁移到右中区域，不再只是原地吃节奏火线。
- 浏览器全链路验证继续通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `anomaly -> boss -> result -> replay` 仍可跑通
  - `consoleErrors = []`
  - 最新截图确认 HUD 没有重新膨胀，结果页口径保持干净

### 剩余风险
- `boss-bastion / crossfire` 现在已经有远程空间口袋，但 pocket 迁移节奏仍是轻量 carrier，不是完整 Boss 远程场地系统。
- 如果后续玩家 burst 与机动继续上涨，下一步更可能需要的是：
  - 增加 pocket 路径与转场模式的变化
  - 继续用真实玩家样本校验“口袋是否仍需要决策”
  而不是继续堆血或继续只堆投射物。

## [重建阶段] 文档恢复版说明
原始开发日志文件已丢失。本文件为基于历史文档和对话记录重建的简化版开发日志，用于恢复项目上下文和后续继续开发。

## [0.9v 读数 / 压力校准] Boss phase 内场地空间雕刻 + 安全区 / 危险区模式稳定
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是 `Boss phase 内场地空间雕刻 + 安全区 / 危险区模式稳定`，不是重写系统，不是回到恢复期，也不是继续靠堆血加压。

### 盘点结论
- 当前 Boss 的 `phase / signature / pattern` 三层都已经存在，问题已不再是“有没有阶段入口”。
- 当前真正的剩余缺口是：
  - `boss-hunt / close-in` 与 `boss-lockdown / pin-down` 虽然已有持续 pattern，但危险区 / 安全窗结构仍不够稳。
  - phase 内空间读数主要还靠：
    - 护卫刷新
    - 敌方投射物
    - 旧行为谱系
    - 轻量 overlay 条纹
  - 高机动 build 下，玩家更容易把这些 phase 读成“边走边打就能磨过去”，而不是“场地被雕刻成了某种形状”。
- 本轮最小切入点确定为：
  - 保留 `signature window` 做切段确认
  - 保留 `pattern pulse` 做持续模式
  - 再为 `laneCrush / sideClamp` 补 `safe window + wall shots`，把空间结构真正落到场面里

### 本轮实现
- `src/game/types.ts`
  - 继续沿上一轮已开的口子，正式接上：
    - `patternSafeWindowSize`
    - `patternSafeWindowLingerSec`
    - `patternWallShotCount`
    - `pressurePatternPulseCount`
    - `pressureSafeWindowAxis`
    - `pressureSafeWindowCenter`
    - `pressureSafeWindowSpan`
    - `pressureSafeWindowSec`
- `src/systems/RunEngine.ts`
  - Boss battle 初始化时现在会带上 safe-window 运行态。
  - 新增：
    - `clearPressureSafeWindow(...)`
    - `openPressureSafeWindow(...)`
    - `choosePressureSafeWindowCenter(...)`
    - `spawnPressureWallShots(...)`
  - `laneCrush`
    - 打开纵向安全走廊
    - 在走廊外由上/下沿发射壁射
    - 继续补厚体 escort 波
  - `sideClamp`
    - 打开横向安全走廊
    - 在走廊外由左/右沿发射壁射
    - 继续补高速 escort 波
  - `crossfireWave`
    - 继续保持交叉齐射节奏型 phase
    - 本轮不强行补成安全窗结构
- `src/data/battleTemplates.ts`
  - `boss-hunt / close-in` 现补入：
    - `patternSafeWindowSize = 224`
    - `patternSafeWindowLingerSec = 1.28`
    - `patternWallShotCount = 7`
  - `boss-lockdown / pin-down` 现补入：
    - `patternSafeWindowSize = 162`
    - `patternSafeWindowLingerSec = 1.22`
    - `patternWallShotCount = 6`
  - HUD 读数现在会在安全窗激活时补上 `安全窗 纵向/横向`
- `src/scenes/GameScene.ts`
  - `renderPressurePatternOverlay(...)` 不再只画抽象压迫条。
  - 当安全窗激活时：
    - 危险区会被低透明遮罩压出来
    - 安全窗会被轻量高亮与边界线标出
  - 仍不增加大弹框或额外 HUD 遮挡。
- `src/systems/MetricsTracker.ts`
  - 新增低成本观测：
    - `boss_safe_window_seen`
  - 继续复用：
    - `boss_phase_pattern_seen`
    - `boss_phase_pattern_duration`
    作为 `boss_space_pattern_seen / boss_pressure_mode_duration` 的等价观测，不重复造字段名。

### 验证
- `npm run build` 通过。
- `npx tsx output/qa/boss-space-windows.mts` 验证通过：
  - `boss-hunt / 纵压驱进`
    - `safeWindowAxis = vertical`
    - `safeWindowCount = 2`
    - `firstSpan = 224`
    - 高机动样本下 `averageOffset = 125.07`
  - `boss-lockdown / 侧翼夹封`
    - `safeWindowAxis = horizontal`
    - `safeWindowCount = 2`
    - `firstSpan = 162`
    - 高机动样本下 `averageOffset = 145.28`
  - `boss-bastion / 交叉火线`
    - 仍无安全窗
    - 继续保持节奏型 pattern，不与前两类混味道
- 上述抽样同时覆盖：
  - `normal`
  - `highBurst`
  - `highMobility`
  三组样本；高 burst 下 phase 仍能进入安全窗层，高机动下安全窗不会直接贴着玩家跑。
- 浏览器全链路验证通过：
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `battleHudSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - `run_finished.payload.finalNodeType = boss`
  - 结果页继续显示 `Boss · 屏卫主核`

### 剩余风险
- 安全窗 / 危险区雕刻目前只落在：
  - `boss-hunt / close-in`
  - `boss-lockdown / pin-down`
- `boss-bastion / crossfire` 仍主要靠火线节奏成立；如果后续高机动 / 高 burst 继续上涨，下一步更可能需要的是：
  - 为远程型 phase 补更明确的空间口袋或收缩节奏
  - 或继续结合真实玩家样本验证当前安全窗是否已足够可学
  而不是继续堆血或堆怪。

## [0.9v 读数 / 压力校准] Boss 阶段内行为差异强化
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是 `Boss 阶段内行为差异强化 + 最终关身份稳定`，不是重写系统，不是回到恢复期，也不是泛补普通内容。

### 盘点结论
- 当前 Boss 的阶段切换、最小驻留和切段承接已经存在，问题已不再是“有没有 phase”。
- 当前真正的剩余缺口是：
  - `updateEliteEnemy(...)` 仍然固定读取模板基准 `eliteRule.behavior`
  - phase 之间虽然已有护卫、刷怪、速度、远程节奏差异，但主核行为本身没有跟着切段
  - 因而玩家更容易把不同 phase 读成“同一个 Boss 的不同数值档”
- 当前最容易继续失真的 phase 是：
  - `boss-lockdown` 的 `封位 -> 锁场`
  - `boss-bastion` 的 `交火 -> 火线收束`
  - `boss-hunt` 的 `逼近 -> 收束`
- 本轮最小切入点确定为：
  - `pressurePhases.behaviorOverride`
  - 运行时主核行为按当前 phase 解析
  - HUD 子读数同步显示当前主核行为身份

### 本轮实现
- `src/game/types.ts`
  - `BattlePressurePhaseDefinition` 新增：
    - `behaviorOverride?: EliteBehaviorId`
- `src/data/battleTemplates.ts`
  - Boss phase 现在可以显式声明行为身份，而不是只做软参数加压：
    - `boss-hunt`：`接敌(frontline) -> 逼近(screened) -> 收束(frontline)`
    - `boss-lockdown`：`接敌(kiting) -> 封位(screened) -> 锁场(frontline)`
    - `boss-bastion`：`接敌(screened) -> 交火(summoner) -> 火线收束(kiting)`
  - 新增 `getBattleActiveEliteBehavior(...)`，把当前 phase 的行为解析集中到模板层。
  - `getBattleEnemyReadout(...)` 现已改为读取当前 active behavior，而不是永远显示模板初始行为。
- `src/systems/RunEngine.ts`
  - `updateEliteEnemy(...)` 现已按当前 phase 的 active behavior 驱动主核移动，而不是固定沿用模板基准行为。
  - 这意味着 phase 之间的差异不再只来自：
    - 护卫节奏
    - 刷怪量
    - 速度
    - 远程射速
  - 还会来自主核本体的行为身份切换。
- `src/scenes/GameScene.ts`
  - HUD 子读数现会带上当前 phase 对应的主核行为口径，帮助玩家从战况条直接读出“这段 Boss 现在是遮线、反拉还是顶压”。

### 验证
- `npm run build` 通过。
- 本地 `tsx` 抽样确认：
  - `boss-hunt` 会解析为：
    - `接敌 -> frontline`
    - `逼近 -> screened`
    - `收束 -> frontline`
  - `boss-lockdown` 会解析为：
    - `接敌 -> kiting`
    - `封位 -> screened`
    - `锁场 -> frontline`
  - `boss-bastion` 会解析为：
    - `接敌 -> screened`
    - `交火 -> summoner`
    - `火线收束 -> kiting`
- engine 级全链路抽样确认：
  - `开始 -> 节点推进 -> anomaly -> boss -> 结算` 可跑通
  - 抽样样本中 `boss-bastion` 实际经历了：
    - `接敌(screened)`
    - `交火(summoner)`
    - `火线收束(kiting)`
  - 结果口径仍为 `finalNodeType = boss`
- 浏览器烟测确认：
  - 复用现有 `output/playwright/battle-layer-0.9v/full-flow.mjs` 全链路跑通
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `battleHudSeen = true`
  - `replayStarted = true`
  - 浏览器 `console error = 0`
  - 指标继续命中：
    - `battle_template_entered.payload.encounterType = boss`
    - `event_selected.payload.contentKind = anomaly`
    - `run_finished.payload.finalNodeType = boss`

### 剩余风险
- Boss phase 的行为身份现在已经落到运行层，但仍复用旧的 `frontline / screened / kiting / summoner` 行为谱系，不是 Boss 专属行为系统。
- 如果后续玩家 burst 与机动继续上涨，最终关下一步更可能需要的是：
  - 更明确的阶段内行为签名
  - 或少量 phase 专属压力兑现
  而不是继续只靠旧行为谱系 + 模板软承接。

## [0.9v 读数 / 压力校准] Boss 抗 burst 切段强化
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是 `Boss 抗 burst 阶段切换强化 + 最终关阶段读数稳定`，不是重写系统，不是回到恢复期，也不是泛补普通内容。

### 盘点结论
- 当前 Boss 的阶段切换入口已经存在，触发条件来自：
  - `HP 阈值`
  - `剩余时间阈值`
  - 护卫刷新节奏
  - 模板层压力修正
- 当前会被 burst 压平的根因有两个：
  - `updatePressurePhase(...)` 原先允许同一轮检查里连续跨过多个阈值，导致高 burst 时可能直接跳过中间阶段。
  - 切段后主要只有后台参数切换，玩家不一定能在屏幕上立刻感觉到“已经进入下一压力段”。
- 当前最容易失真的一段是：
  - Boss 中段刚切入后的承接窗口；如果玩家爆发继续上升，容易出现“看到阶段标签变了，但阶段本身几乎没存在感”。
- 本轮确定的最小切入点是：
  - `最小驻留 / 防连跳`
  - `切段后的短时承接`
  - `不遮挡画面的轻量读数强化`

### 本轮实现
- `src/game/types.ts`
  - `BattlePressurePhaseDefinition` 新增：
    - `minResidenceSec`
    - `entryGuardSec`
    - `entryGuardDamageMultiplier`
    - `entryEscortBurst`
  - `BattleState` 新增：
    - `pressurePhaseElapsedSec`
    - `pressureTransitionSec`
  - `EnemyState` 新增：
    - `guardDamageMultiplier`
- `src/data/battleTemplates.ts`
  - 为 `boss-hunt / boss-lockdown / boss-bastion` 的 phase 补入最小驻留、切段过渡 guard 与即时护卫兑现参数。
  - `getBattleEnemyReadout(...)` 现在支持在切段窗口使用 `转段` 口径。
- `src/systems/RunEngine.ts`
  - `updatePressurePhase(...)` 改为逐段推进：单次更新最多只进入下一段，不再允许同一轮连跳多个 Boss phase。
  - 当前阶段未满足 `minResidenceSec` 时，不推进到下一段。
  - phase 切换时会：
    - 重置阶段驻留计时
    - 打开短时 `pressureTransitionSec`
    - 补一小段过渡 guard
    - 按 phase 参数立即补一批护卫
  - elite / boss 的 guard 倍率从模板层改为运行态可覆盖，便于 phase 切换时做短时承接而不引入新系统。
- `src/scenes/GameScene.ts`
  - Boss/elite 主核在切段窗口会显示轻量脉冲圈。
  - HUD 子读数在切段窗口会显式使用 `转段` 前缀。

### 验证
- `npm run build` 通过。
- 本地 `tsx` 抽样确认：
  - 在直接把 Boss 压到多阈值以下的高 burst 场景下，`boss-hunt / boss-lockdown / boss-bastion` 都只会先进入第一段，不会同轮直接跳到最终段。
  - 待当前 phase 的 `minResidenceSec` 满足后，才会进入下一段。
  - phase 切换时，`guardSec / guardDamageMultiplier / escortCount` 都会按新承接规则变化。
- engine 级全链路抽样确认：
  - `开始 -> 节点推进 -> anomaly -> boss -> 结算` 可跑通
  - 结果口径仍为 `finalNodeType = boss`
  - 新开一局后首战仍从 `battle` 正常进入，相当于 replay 重新起局链路未被破坏
- 浏览器烟测确认：
  - 开始页与战斗页截图正常
  - HUD 未重新变重
  - 无新的 console error

### 剩余风险
- Boss 阶段切换现在更不容易被 burst 直接压成一条线，但当前仍是模板层的软承接，不是完整 Boss 行为分段。
- 如果后续玩家 burst 继续上涨，最终关可能还需要更强的“阶段内行为差异”，而不是继续只加 phase 承接参数。

## [0.9v 早期开发] Boss 阶段压力机制 + anomaly 内容质量
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目已不在恢复期；本轮目标是 `Boss 阶段性压力补强 + anomaly 内容质量打磨`，不是重写系统，不是泛补普通内容。

### 盘点结论
- Boss / elite 当前已有抗 burst 与护卫压力，但主压力来源仍偏模板参数、护卫和通用刷怪节奏。
- 最终 Boss 虽然已经具备独立 carrier，但若没有显式阶段切换，后续仍容易退回“更厚的 elite”。
- anomaly 虽然已经是独立池，但 `relay-splice / route-handoff` 这类条目仍偏普通 route push，容易稀释 anomaly 自身识别感。
- 本轮最需要补的是：阶段压力入口、Boss HUD 读数、以及更像 anomaly 的低频代价型条目。

### 本轮实现
- `src/game/types.ts`
  - 新增轻量 `BattlePressurePhaseDefinition`
  - `BattleState` 新增 `pressurePhaseIndex / pressurePhaseLabel`
- `src/data/battleTemplates.ts`
  - 为 `elite / elite-vice / elite-lockdown / elite-screen` 补入轻量 `pressurePhases`
  - 为 `boss-hunt / boss-lockdown / boss-bastion` 补入两段式压力切换
  - `getBattleEnemyReadout(...)` 现在会带出当前阶段标签
- `src/systems/RunEngine.ts`
  - 新增 `updatePressurePhase(...)`，按 `HP 阈值 / 剩余时间阈值` 推进压力阶段
  - 当前阶段会影响刷怪间隔、场上数量、护卫批次 / 上限 / 刷新节奏、远程射速与主核移动压力
  - anomaly 混搭统计补充覆盖 `null-lens`
- `src/data/events.ts`
  - 下调 `relay-splice / route-handoff` 权重，避免 anomaly 再被普通 route push 主导
  - 新增更像 anomaly 的 `phase-debt / null-lens`
  - 上调 `phase-splitter / carrier-breach / boss-shadow-scan` 的存在感
- `src/scenes/GameScene.ts`
  - HUD 子读数现在会显示当前 `pressurePhaseLabel`

### 验证
- `npm run build` 通过。
- 本地 `tsx` 抽样确认：
  - `boss-lockdown` 会从 `接敌 -> 封位 -> 锁场`
  - `boss-bastion` 会从 `接敌 -> 交火 -> 火线收束`
  - `elite-screen` 会从 `交火 -> 封火`
  - anomaly 抽样中已能命中 `phase-debt / null-lens / phase-splitter / boss-shadow-scan`
- 浏览器烟测确认：
  - 菜单、结果页、replay 重开链路仍正常
  - HUD 会带出战斗子读数，replay 重开后会回到新的首战 HUD
- 当前未补新埋点字段；现有 `battle_template_entered / event_selected / run_finished` 已足够覆盖本轮检查点。

### 剩余风险
- Boss 阶段压力已经不再只靠“更厚 + 护卫”，但自然玩家 burst 再继续上涨后，是否还需要更强的收尾节奏差异，仍要继续观察。
- anomaly 内容质量已经提升，但浏览器自动化自然跑局仍偏容易死在中段；后续仍应结合真实玩家样本看 anomaly 记忆点是否足够稳。

## [测试版阶段] 已确认结论
- 商业化测试版封版检查已完成
- `route_committed / route_matured` 已在自然长局中稳定触发
- 最小展示素材已产出为 GIF
- 测试版结论：已达到可发 itch.io 测试版状态

## [阶段口径修正]
### 项目定位
- 对外：一个能在短局里快速读懂节奏、走出三条不同 build 路线的节点式自动射击 demo
- 内部：一款以短局节点推进为骨架、围绕暴击 / 穿透 / 穿梭三条路线分化的俯视角自动射击原型

### 当前边界
不再作为主线：
- 页面 UI 结构改版
- 更大关卡变化面
- 新系统
- 新战斗模板
- 新节点类型
- 新流派
- 全量正式素材替换
- 正式商业包装页

允许做：
- 核心循环低频观察和极小修正
- 表现层统一与收束
- 最低限度视听补齐
- 商业化测试版文档和埋点
- itch.io 测试版发版准备
- 基于 docs 的项目骨架重建

## [0.9 Round 1] 轻局外闭环最小技术底座
### 结论
- 已先进入轻局外闭环的最小技术底座
- 这是正确顺序，因为它比结构升级 + 内容补量并行更不容易失控

## [0.9 Round 2] 单局结构升级
### 结论
- 本轮补上的最关键缺口是：`后段 -> 最终整备 -> 最终战 -> 结算` 的收束链
- 本轮没有通过“加内容”来偷做结构升级
- 单局结构升级后，下一步最该接的是：三流派 0.9 收口

## [0.9 Round 3] 三流派收口（待继续）
### 目标
- 让暴击 / 穿透 / 穿梭都具备：
  - 启动器
  - 承接段
  - 成型段
  - 终局表现

### 风险提醒
- 不要通过大量加内容来假装做流派收口
- 不要过早进入模板补全、地图补全和正式美术收口

## [当前任务] 代码丢失后的文档驱动重建
### 当前目标
- 基于 docs 重建项目骨架
- 优先恢复核心循环、三条流派、三类节点、三类战斗模板、关键提示、最低限度音效和基础埋点导出

## [内容与可玩性 Round 5] redirect 默认吸引力校准
### 本轮目标
- 不改主流程、不重写 RunEngine、不引入新系统，只校准 redirect / hybrid 内容在真实跑局里的“默认值得拿”程度。
- 优先解决“redirect 已经能出现，但同流派惯性内容仍更容易被拿走”的问题。
- 用多局样本验证 `redirectPickCount` 与 `branchSwitchCount` 是否从长期偏零状态里松动出来。

### 盘点结论
- 代码与最新阶段文档一致：当前问题不是缺 redirect 入口，而是 redirect 真正被选中的吸引力不稳。
- 关键失衡点有两个：
  - mid 升级面板里，同流派 `redirect` sidechannel 仍会从 fallback 池漏出来，和真正的 off-route redirect 抢同一格。
  - `relay-splice / route-handoff` 这类通用 redirect 事件会同时给出当前路线选项，导致“改道事件”被拿去继续顺原路线。
- 埋点还有一处口径问题：
  - 若某次 redirect 同时触发 dominant route 翻转与 matured，原逻辑会漏记 `branch_switch`。

### 本轮修改
- selector：
  - 修正 `contentSelectors` 的 fallback 池，不再让同流派 `redirect` 变体混入 dominant route 的兜底分发。
  - 保留真正 off-route redirect 与 generic hybrid 的 mid redirect window。
- events / nodes：
  - 下调 `relay-splice / route-handoff` 的出现权重，把它们降为次级改道入口。
  - 上调 `crit-reroute-window / pierce-reroute-window / dash-reroute-window` 的 mid 权重。
  - 让 reroute-window 的 off-route 选项从 `+2 route push` 提高到 `+3 route push`，保证“现在转”更容易真的翻过 dominant route。
  - 提高 `round-2-event-reroute`，下调 `round-2-event-handoff`，让 round 2 更偏向“hold vs reroute”的明确窗口。
- metrics：
  - 修正 `branch_switch` 记录时机，不再漏记“同一拍完成 switch + mature”的真实转向。
  - 保留上一轮接入的 `redirectOfferSeenCount / redirectPickCount / redirectPickStage`。

### 验证结果
- `npm run build` 通过。
- Playwright smoke 通过：开始页与战斗页截图正常，控制台无新报错。
- 自然 4 局样本：
  - `branchSwitchNonZeroRuns = 1/4`
  - `averageBranchSwitchCount = 0.25`
  - `hybridPickRuns = 4/4`
  - 多局里 `redirectPickCount` 已不再为 0。
- targeted switch 验证中，重新观察到非零 `branch_switch` 样本，说明 redirect 不再只停留在“看见但不转”。

### 本轮结论
- redirect 默认吸引力已从“能出现但难被拿”推进到“自然样本里开始有人拿，也开始出现非零 branch switch”。
- 但样本规模仍小，且自然转向仍偏向更明确的 late / reroute-window 场景；mid 的高频稳定转向还没有完全站稳。

## [重建 Round 1] 项目骨架与最小可运行版本恢复
### 本轮目标
- 基于现有 docs 重建 Web 端可运行项目骨架
- 优先恢复开始页、GameScene、结算页、节点推进、最小战斗循环、埋点与重开链路
- 不追求旧数值和旧表现 100% 还原，先保证结构正确、可运行、可继续开发

### 文档盘点结果
- 当前最高优先口径来自 `PROJECT_STATUS` 与本文件的“当前任务”段：现阶段是代码丢失后的文档驱动重建，不是继续 0.9 扩功能
- 当前必须恢复的核心模块包括：开始页 / GameScene / 结算页、单局核心循环、节点推进、三流派、三类节点、三类战斗模板、最小 HUD、埋点导出
- `ROADMAP_0_9` 仍然有效，但本轮只把它作为后续方向，不把“三流派 0.9 收口 / 轻局外闭环扩展”当作本轮实现目标

### 已重建模块
- Vite + TypeScript + Phaser Web 项目壳
- `src/scenes/BootScene.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/ResultScene.ts`
- `src/systems/RunEngine.ts`
- `src/systems/MetricsTracker.ts`
- `src/systems/PilotAudio.ts`
- `src/systems/MetaProgression.ts`
- `src/ui/OverlayController.ts`
- `src/data/routes.ts`
- `src/data/nodes.ts`
- `src/data/upgrades.ts`
- `src/data/events.ts`
- `src/data/battleTemplates.ts`

### 已恢复流程
- 开始页 -> 开始试飞 -> 进入首场战斗
- 首场战斗 -> 节点选择 -> 强化 / 事件 / 战斗切换
- 前段 -> 中段 -> 后段 -> 最终整备 -> 最终战 -> 结算
- 结算页 -> 再来一局
- `window.__pilotMetrics`
- `window.__exportPilotMetrics()`
- `localStorage: commercial_pilot_metrics_v1`

### 近似实现部分
- 旧版敌人参数、升级池数值、路线权重与掉落逻辑已丢失，本轮改为保守的最小可运行近似
- 三流派已恢复基础入口：
  - 暴击：暴击率 / 暴击倍率 / 射速承接
  - 穿透：穿透 / 分束 / 清线承接
  - 穿梭：脉冲穿梭 / 规避收益承接
- 轻局外闭环仅恢复为本地 `localStorage` 元数据占位，不视为正式玩法恢复
- 音效仅恢复最低限度程序化提示音，不包含旧资源级音频设计

### 未恢复部分
- 旧项目完整数值平衡
- 0.9 三流派完整收口内容
- 地图 / 模板变体补全
- 正式素材、正式包装页与更深层视听收口
- 完整局外闭环玩法

### 风险点
- 当前战斗与升级内容仍是骨架级近似实现，后续需要继续按文档收口
- 浏览器本地埋点已通，但当前记录会真实反映人工测试等待时间，不可直接拿来当正式样本
- Phaser 单包较大，当前构建有 chunk size warning，但不影响本轮“最小可运行重建”目标

### 下一步建议
- 下一轮优先补三流派的“启动器 -> 承接段 -> 成型段”体验连续性
- 然后补 battle / upgrade / event 的内容复用底座和更稳的数值分布
- 最后再做最小表现层继续收口，而不是先扩新系统

## [重建 Round 2] 主流程完整性检查与链路修复
### 本轮目标
- 检查开始页 -> 进入游戏 -> 单局推进 -> 结算 -> 重开的完整链路
- 检查 battle / upgrade / event 切换稳定性
- 检查埋点写入与导出是否对应真实流程
- 明确哪些部分仍然只是近似实现，不误判为已恢复完成

### 主流程检查结果
- 开始页进入一局稳定，初始化后可以正常进入首场战斗
- battle -> nodeChoice -> upgrade / event -> 下一阶段推进已实际回归验证
- 前段 -> 中段 -> 后段 -> 最终整备 -> 最终战 -> 结算已实际跑通
- 结算后“返回开始页再开一局”链路可用，状态能重新起局
- `window.__pilotMetrics`、`window.__exportPilotMetrics()`、`localStorage` 导出已验证可用

### 关键链路问题
- 节点 / 强化 / 事件面板原先在 `GameScene.update()` 中每帧重渲染，真实点击时存在 DOM 被替换导致交互抖动的问题
- 升级面板在某些阶段会退化成两选一，不满足当前骨架默认的“三选一”结构
- 首局结束后若先回到开始页再开一局，原埋点只记录 `click_start_game` 与 `second_run_start`，缺少 replay 意图标记

### 本轮修复内容
- 给 `GameScene` 增加 HUD / 面板渲染去抖，只在状态实际变化时重绘面板，避免点击时节点卡片被替换
- 调整升级抽取逻辑，优先同路线，再用其余池补满，保证有可选内容时尽量稳定维持三选一
- 补齐“首局结束 -> 返回开始页 -> 再开一局”的 `restart_after_first_run` 埋点，和结果页直接重开保持同一漏斗语义

### 近似实现清单
- 旧数值、敌人强度与模板细节仍是骨架级近似
- 三流派当前只有最小入口与基础承接，不等于完整 0.9 收口
- 事件池内容仍偏少，只验证切换稳定性，不代表事件层已恢复完成
- 埋点当前为本地最小方案，数据结构可用，但还不是正式分析版

### 风险点
- 当前单局可跑通，但中段 / 后段的手感与节奏仍受近似数值影响
- 本地埋点会保留历史 session，测试时需要注意区分本轮数据和旧样本
- 目前没有独立自动化回归脚本，主流程验证仍以构建 + 浏览器实测为主

### 下一步建议
- 下一轮最该接三流派收口，而不是继续扩写埋点或补量
- 但在进入流派收口前，应继续把“近似实现”边界写清，避免把当前骨架误当成完整恢复版

## [重建 Round 3] 三流派收口与局内曲线补齐
### 本轮目标
- 基于当前 docs 进入三流派收口，而不是继续做主流程修补或内容补量
- 盘点暴击 / 穿透 / 穿梭三条路线在“启动 -> 承接 -> 成型 -> 终局表现”上的结构缺口
- 只补关键结构，不靠大量新增强化、事件或敌人去掩盖路线问题

### 三流派状态盘点
- 暴击：
  - 启动器清楚，`聚焦瞄准` 一类入口能快速给出“赌爆点”的方向
  - 承接段原先偏依赖单次暴击，缺少把暴击命中串成稳定节奏的中段承接
  - 成型点存在但感知偏弱，玩家更容易感到“数值变大”而不是“路线站稳”
  - 终局表现原先主要靠单体爆发，缺少收尾时的范围压制与连锁感
- 穿透：
  - 启动器清楚，穿透层数和分束都能迅速指向清线方向
  - 承接段原先过度依赖敌人自然排布，路线连续性不够稳定
  - 成型点不够明确，进入中后段后容易只感觉“子弹更厚”，但不够像完整路线
  - 终局表现成立度一般，缺少从穿透命中自然扩展成面压制的读数
- 穿梭：
  - 启动器清楚，`擦身推进` 能建立“近身换收益”的路线意图
  - 承接段原先最薄弱，穿梭脉冲更像孤立触发，不足以支撑持续生存与反打
  - 成型点不明显，玩家较难感到“我已经进入穿梭节奏”
  - 终局表现不成立，后段常在压力上升时直接断档

### 每条路线当前最关键缺口
- 暴击：缺少把单次暴击转成持续火力节奏的承接结构
- 穿透：缺少从单线穿透自然扩展为扇裂 / 回响清场的连续结构
- 穿梭：缺少“擦身 -> 蓄能 -> 脉冲 -> 获得喘息空间”的完整闭环

### 本轮实际处理内容
- 暴击：
  - 新增暴击过载与连击节奏，让暴击命中会带来短时火力升温
  - 在路线进入承接 / 成型后补上额外射击与近距溅射，使终局表现不再只剩单点放大
- 穿透：
  - 给穿透弹补上命中回响与扇裂扩展，让清线收益不再只看敌人站位
  - 在承接后段加入击破回冷，强化“越打越顺”的路线连续性
- 穿梭：
  - 增加擦身蓄能、脉冲强化、短时推进态与碰撞减伤，把风险收益链真正串起来
  - 穿梭脉冲现在会根据蓄能提升范围、伤害、回复与击退，保证中后段仍有成立的反打窗口

### 近似实现清单更新
- 三流派已从“仅有入口”推进到“具备可辨识局内曲线”，但仍不是完整 0.9 收口版
- 暴击 / 穿透的中后段结构已基本站住，仍缺更细的数值雕刻与更多内容承托
- 穿梭路线已补齐核心闭环，但稳定性仍弱于另外两条路线，后续需要继续校准压力容错
- 事件池、强化池和敌人模板仍保持最小量级，本轮没有借机开启内容补量轮

### 风险点
- 当前路线强度主要依赖结构闭环刚搭起来的最小数值，后续若补内容仍需要重新做整体校准
- 穿梭路线虽然已经形成完整逻辑闭环，但在高压模板里的容错窗口仍较窄
- 当前路线提示仍是最小方案，只承担“帮助玩家读懂方向”的作用，不代表正式表现层已收口

### 下一步建议
- 下一轮优先补内容复用底座，而不是直接大补模板或敌人
- 等三条路线都能复用更稳定的 upgrade / event / battle 承接后，再做少量内容补量

## [重建 Round 4] 内容复用底座强化
### 本轮目标
- 盘点升级池、事件池、节点池、模板池当前的组织方式
- 找出后续补内容时最容易反复改 `RunEngine` 的耦合点
- 只做高价值底座整理，不提前进入内容补量轮

### 内容池 / 模板池复用状态盘点
- 升级池：
  - 定义已经集中在 `src/data/upgrades.ts`
  - 但“怎么抽三选一、什么时候偏向同路线、什么时候保留泛用牌”此前仍写在 `RunEngine`
  - 升级效果此前只支持直接 `modifiers`，一旦想补回复、推进路线或条件权重，就容易继续把逻辑塞回引擎
- 事件池：
  - 定义已经集中在 `src/data/events.ts`
  - 但效果接入此前仍依赖 `modifiers / heal / routeId` 的分散分支
  - `route-calibration` 这类会跟当前主路线联动的事件，原先还需要在 `RunEngine` 里写特判
- 节点池：
  - battle / upgrade / event 的节点定义此前已经独立在 `src/data/nodes.ts`
  - 但按 round 的节点候选仍是分段硬写，文本里的“当前方向 / 任一方向”也和函数拼接耦合
- 模板池：
  - 模板数值已经集中在 `src/data/battleTemplates.ts`
  - 但模板进入后的胜利条件、精英刷出规则、普通敌数量上限此前仍在 `RunEngine` 按模板 id 分支处理

### 关键耦合点
- 升级和事件虽然在 data 层定义，但“如何选择、如何生效、如何动态绑定当前路线”仍压在 `RunEngine`
- 模板虽然有数据表，但模板规则并没有真正数据化，后续一补模板变体就会继续改战斗主循环
- 节点候选虽然不在场景里写死，但 round -> node 仍是大块条件分支，不利于后续少量变体扩展

### 本轮底座整理内容
- 引入共享 `effects` 结构，升级和事件统一通过 `stats / heal / route` 三类效果接入，不再让引擎分别理解 `modifiers`、`heal` 和路线推进字段
- 给升级池和事件池补上最小选择配置：基础权重、回合区间、主路线加权、最终整备加权等，并将抽取逻辑迁移到 `src/data/contentSelectors.ts`
- 将事件里的“跟随当前主路线”处理改为通用的 route reference 解析，不再只为 `route-calibration` 写引擎特判
- 将节点池改为 round blueprint 表驱动，文本中的动态焦点描述也改由节点数据层解析
- 将模板池补成真正可驱动规则的数据：胜利条件、精英刷出规则、普通敌数量上限，并把 battle label / complete check / elite spawn 判断从 `RunEngine` 抽回模板层

### 近似实现清单更新
- 升级池、事件池、节点池、模板池的接入方式已经更适合扩展，但内容量本身仍保持最小规模
- 当前权重与条件是“方便扩展的第一版”，不是最终的正式掉落与分布设计
- 模板池虽然已支持更清楚的规则接入，但敌人种类、模板变体和特殊波次仍未恢复
- 事件效果结构已统一，但完整事件内容仍明显偏少

### 风险点
- 这轮整理的是扩展底座，不代表数值分布已经稳定；后续补内容仍需要继续校准
- 当前共享 `effects` 结构先覆盖了 stats / heal / route 三类高频需求，若以后出现更复杂的独特效果，仍需继续演进
- 浏览器实测链路正常，但由于没有独立自动化回归脚本，回归仍以构建 + Playwright 冒烟为主

### 下一步建议
- 下一轮优先接“少量关卡 / 模板补全”，因为现在补内容已经不必再频繁回改核心逻辑
- 但补量时仍应维持小步快跑，只验证底座是否真的能承接内容，不要一下子铺开整轮扩写

## [重建 Round 5] 少量内容补全与接入验证
### 本轮目标
- 进入少量关卡 / 模板补全，用小规模真实内容验证当前内容底座是否足够支撑后续扩展
- 不继续做底座整理，也不进入表现层收口
- 只补最有代表性的模板变体、事件内容和 follow-up / payoff 强化

### 小规模内容盘点结果
- 模板层：
  - 最值得先补的是精英压制和生存压制各一个小变体
  - 原因是这两类最能验证“模板规则数据化”是否真的成立，又不会伤到当前开局主流程
  - 歼灭继续保持基础主干，暂时不优先动
- 事件层：
  - 当前更缺的是能体现“路线倾向已出现后，事件可以顺着接入”的少量内容
  - 因此优先补一个偏路线的事件和一个偏通用整理的事件，而不是一次性大补路线专属事件池
  - 这两类都应通过现有选择器接入，不需要改 `GameScene`
- 强化层：
  - 当前最值得补的是 starter 之后的 follow-up / payoff
  - starter 本身已够用，真正偏少的是“前段立方向后，中后段还有什么继续接”
  - 这些内容最适合验证升级池是否已经能靠 data + selector 自然扩写

### 本轮实际补充内容
- 模板变体：
  - `survival-rush`：作为后段生存压制的小变体，强化敌潮逼近感
  - `elite-lockdown`：作为最终战精英压制的小变体，验证更早刷精英和更多护卫的接入
- 事件内容：
  - `targeted-telemetry`：偏路线的定向事件，用来验证跟随当前倾向的事件接入
  - `salvage-bay`：偏通用整理的事件，用来验证无路线依赖的补强接入
- 强化内容：
  - `crit-heat`
  - `pierce-ripple`
  - `dash-rethread`
  - 这三张都定位为 follow-up / payoff，用来验证 starter 之后的扩写成本是否真的下降

### 当前内容底座验证结果
- 新事件已通过现有事件池与选择器自然接入，不需要改场景流程
- 新强化已通过现有升级池与选择器自然进入中段三选一，不需要回改 `RunEngine` 的内容判断
- 模板变体已通过节点 blueprint 和模板数据定义接入，说明模板规则数据化已经开始具备实际承载能力
- 本轮验证结论：当前内容底座已经足以承接“小规模补全”

### 近似实现清单更新
- 内容底座已验证可承接少量真实内容，但当前内容总量仍然偏少
- 当前新增内容主要用于验证接入链路，不代表正式内容密度与最终分布已经成立
- 模板变体已开始进入真实流程，但危险度、节奏和数值分布仍只是第一版近似
- 事件池和强化池虽然已更厚一点，但离“完整测试版内容量”仍有明显距离

### 风险点
- 新内容已能接入，但当前权重和数值仍是近似方案，后续仍需继续校准
- 模板变体已接入，但当前敌人种类仍少，模板差异主要由参数和节奏承担
- 目前验证以构建 + 抽样脚本 + Playwright 冒烟为主，尚无独立自动化回归用例

### 下一步建议
- 下一轮最该接“最小表现层收口”，因为现在已经有足够的新内容可以支撑提示层和收尾体感继续统一
- 若继续补内容，也应保持小步，不要在一轮里同时铺模板、事件、强化的大补量

## [重建 Round 6] 内容接入复核与恢复度估计
### 本轮目标
- 复核上一轮“小规模真实内容接入”是否真的成立，而不是只在 data 文件里新增条目
- 对当前项目代码恢复度做一次有依据的估计
- 不重开底座整理，也不提前进入表现层收口

### 小规模内容盘点结果
- 模板层：
  - 当前最值得复核的是后段生存压制和最终战精英压制
  - 上一轮如果直接用新模板替换旧模板，会更像“换皮接线”，不够像真实模板池扩展
  - 因此本轮把重点放在“原模板与变体是否能并存”
- 事件层：
  - 上一轮新增的 `targeted-telemetry` 与 `salvage-bay` 已覆盖“偏路线”与“偏通用”两类验证点
  - 这两类事件接入时不需要再改 `GameScene` 或主流程
- 强化层：
  - 上一轮新增的 `crit-heat`、`pierce-ripple`、`dash-rethread` 已足以验证 follow-up / payoff 接入链
  - 当前更值得复核的是“它们能否自然进入池子”，而不是继续加更多牌

### 本轮实际补充内容
- 将后段 battle 从“固定使用 `survival-rush`”改为“`survival` / `survival-rush` 并存后再抽取”
- 将最终战从“固定使用 `elite-lockdown`”改为“`elite` / `elite-lockdown` 并存后再抽取”
- 保持事件池与强化池不继续扩写，只做接入复核与恢复度估计

### 当前内容底座验证结果
- 抽样脚本已确认：
  - round 3 battle 会在 `survival` / `survival-rush` 之间切换
  - final battle 会在 `elite` / `elite-lockdown` 之间切换
- 这说明模板变体已不再只是“替换旧模板”，而是真正进入了模板池扩展
- 上一轮新增事件与强化的接入结论继续成立：它们能通过现有 selector 自然进入，不需要把逻辑写回 `RunEngine`
- 当前结论：内容底座已经能够承接“小规模真实扩展”，不是只停留在纸面结构

### 代码恢复度估计
- 估计区间：`60%~70%`
- 估计口径：
  - 以“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已达到可继续开发的项目完整度”
- 已恢复得比较实的部分：
  - 开始页 -> 单局推进 -> 结算 -> 重开主流程
  - 三条路线的基础局内曲线
  - 节点 / 升级 / 事件 / 模板的数据层组织
  - 基础埋点与导出
  - 当前少量真实内容接入能力
- 仍明显缺失或仍是近似实现的部分：
  - 旧项目更成熟阶段的完整内容量
  - 正式权重分布与精细数值
  - 更完整的模板变化面与敌人内容
  - 最小表现层收口、正式视听资源与更成熟的打磨状态
- 为什么不估得更高：
  - 当前虽然不只是“刚能跑”，但离旧版本最成熟状态仍有明显距离
  - 内容量、平衡、表现和完整打磨都还没有回来
- 为什么也不估得更低：
  - 当前已经具备真实可继续开发的主流程、流派、内容底座和小规模扩展能力
  - 这已经明显超过“仅恢复骨架”的阶段

### 近似实现清单更新
- 当前项目可以粗略视为“可继续开发的中前段状态”
- 但内容密度、正式分布和成熟打磨仍明显未恢复完成
- 模板池已经能承接小变体并存，但复杂波次与更深层规则仍未恢复

### 风险点
- 若后续补量过快，当前近似权重与数值仍可能暴露节奏失衡
- 模板池已开始具备并存扩展能力，但还没有验证到更复杂的多变体层级
- 当前恢复度估计带主观判断，不应被当作精确量化，只应作为开发阶段判断参考

### 下一步建议
- 下一轮最该接“最小表现层收口”，因为现在内容与模板变化已经足够支撑一轮提示层和关键段收束
- 如果继续补内容，也应维持小步快跑，先做一轮再看是否需要继续扩
## [重建 Round 7] 埋点与结算精度压实
### 本轮目标
- 检查关键埋点是否真实反映一局内的路线推进、收束节点与结束原因
- 修正结算页对 build 进展、结束原因和收尾节点的表达，让它不再只是罗列基础数字
- 对齐埋点导出与结算页口径，确认 replay / restart 不串局

### 埋点 / 结算问题盘点
- `route_hint_time` 原先会在同一路线反复推进时重复记录，不够像“路线提示首次出现”的埋点
- `death_time` 原先会在所有 defeat 时触发，连时间耗尽的失败也会被误记成死亡
- 结算页原先只有路线、时长和胜场，难以看出 build 到了哪一步、这局为什么结束
- 局内 HUD 在非战斗状态下只会显示“某路线倾向已出现”，即使路线已经站稳或成型，也不会同步升格表达
- 导出 JSON 原先只有 `first_run_end` 的汇总式信息，第二局及以后缺少统一的 per-run 收束记录

### 本轮精度修正内容
- 将 `route_hint_time` 改为“每条路线在当前 run 首次出现倾向时只记录一次”，避免同一路线重复记时
- 将 `death_time` 收紧为仅在 `hpDepleted` 时触发，不再把超时失败误记为死亡
- 新增 `run_finished` 事件与 run summary 字段，统一记录：
- `outcome`
- `routeId`
- `buildStage`
- `buildSummary`
- `endingKind`
- `endingReason`
- `finalNodeTitle`
- `durationSec`
- `battleWins`
- `nodesCleared`
- 为 MetricsTracker 增加本局内去重与收束保护，避免 hint / committed / matured 重复写入，也避免同一局重复 finish
- 结算页补上 build 阶段、结束原因、收尾节点和推进节点信息
- 结算对象现在直接由引擎产出统一的 `buildSummary / endingReason / finalNodeTitle`，埋点和结算共同复用同一份收束信息
- 修正局内 HUD 的非战斗状态摘要：
- 仅有倾向时显示“某路线倾向已出现”
- 已站稳时显示“某路线开始站稳”
- 已成型时显示“某路线已经成型”

### 当前内容底座验证结果
- 关键流程没有被这轮精度修正打坏，`npm run build` 继续通过
- 实机回归已确认：
- 开始页文本正常
- 局内提示与节点/强化面板文本正常
- 结算页能直接说明本局 build 与结束原因
- `commercial_pilot_metrics_v1` 中新增 `run_finished`
- replay 后会进入新的 `runIndex`，并保留 `restart_after_first_run` / `second_run_start`
- 当前埋点与结算已经进入“可判断一局发生了什么”的阶段，而不只是“证明主流程跑过了”

### 代码恢复度估计
- 整体恢复度：`63%~72%`
- 估计口径：
- 以“与旧项目最成熟状态相比”的恢复度为主
- 同时参考“当前是否已具备稳定继续开发与判断效果的能力”
- 结构恢复度：`78%~85%`
- 内容恢复度：`48%~58%`
- 表现恢复度：`28%~38%`
- 本轮提高有限但确实有提升：
- 结构和可判断性明显更实了
- 内容量与表现层本身没有大幅增加，所以整体恢复度不会跳升太多

### 近似实现清单更新
- 精细数值、正式权重分布和更完整的内容量仍未恢复
- 结算页已经更可信，但仍是最小结果表达，不等于正式表现层收口
- 埋点已能更准确反映本局收束，但仍是本地最小方案，不是正式分析后台版本

### 风险点
- 当前结算摘要依然以主路线和收尾节点为核心，不会覆盖所有局内细节
- 若后续大量补内容而不继续补埋点字段，新的特殊收束原因仍可能需要再扩展 `run_finished`
- 浏览器本地埋点仍会保留历史 session，分析时需继续按 session / runIndex 区分

### 下一步建议
- 下一轮优先做最小表现层收口，而不是继续补大量内容
- 原因是当前埋点与结算口径已经够准，适合把“读法、提示、收尾感”再统一一轮

## [重建 Round 8] 最小表现层收口
### 本轮目标
- 补齐最低限度音效层级，让点击、升级、命中、暴击、高压和结算不再像同一种提示音
- 统一开始页、局内 HUD、节点面板和结算页的最低限度观感
- 把模板进入、阶段变化、路线站稳、路线成型、收尾等关键提示做出更清楚的层级感

### 表现层问题盘点
- 音效虽然已经存在，但 6 类 cue 听感过于接近，反馈层级不够明显
- 高频 `hit` 会把整体听感打平，`pressure / result` 也不够像关键时刻的提示
- 开始页、局内、结算页能用，但还更像“同一套基础组件”而不是“同一个产品”
- toast 原先全部一个样式，路线站稳、模板进入、高压提示和收尾提示没有层级差
- HUD 已能看懂，但视觉重心偏平，局内读数、路线条和主战场缺少统一的焦点感

### 本轮收口内容
- 重写 `PilotAudio`，补成最小层级化音效：
- `click` 更轻、更短
- `upgrade` 变成上扬双音
- `hit` 做了最小节流，避免高频堆叠
- `crit` 做成更亮的双音强调
- `pressure` 改成更低、更重的压迫提示
- `result` 改成两段式收尾音
- 重写 `OverlayController` 的表现层骨架：
- 开始页、节点面板、结算页加入统一的 surface mark、边框层次和强调色
- route / node / event / upgrade 卡片增加轻量 accent 条和局部高光
- HUD 的路线条加入路线色，结果页补成更完整的收尾区块
- 新增 toast tone 分层：`neutral / accent / route / danger / success`
- 重写 `GameScene` 的非战斗 HUD 摘要与战场底色：
- 非战斗状态现在会区分“倾向已出现 / 路线开始站稳 / 路线已经成型”
- 战场背景加入 dominant route 对应的轻量色调、边框和聚焦区，让局内更少测试占位感
- 清理并统一了开始页、局内、结算页入口文件的玩家可见文本编码

### 代码恢复度估计
- 整体恢复度：`66%~75%`
- 估计口径：
- 仍以“与旧项目最成熟状态相比”的恢复度为主
- 同时参考“当前是否已达到一个不明显像恢复测试版的可玩状态”
- 结构恢复度：`80%~86%`
- 内容恢复度：`48%~58%`
- 表现恢复度：`40%~50%`
- 这轮之后恢复度有提升，但提升有限：
- 提升主要来自表现恢复度和整体完成感
- 内容量、精细平衡和正式包装并没有同步补齐，所以整体不会跳得太高

### 近似实现清单更新
- 音效层现在有最小闭环，但仍不是正式音效设计版
- 视觉层现在更统一，但仍以程序图形和 CSS 收口为主，不等于正式美术替换
- 关键提示已有层级，但仍是“最小表现层收口”，不是最终包装态

### 风险点
- 当前 toast tone 主要依赖已恢复的关键提示文案语义，后续若大改提示文本需要同步校正 tone 规则
- 局内观感明显提升，但敌人种类和战场素材仍少，长期看仍会受内容量限制
- 音效仍是程序化最小方案，若后续要正式对外展示，仍建议继续替换为更完整的资源型方案

### 下一步建议
- 下一轮优先接“精细数值 / 平衡压实”，而不是继续只补少量内容
- 原因是当前结构、内容接入、埋点判断和最小表现层都已站住，接下来更值得把三路线和模板的手感差异压实

## [重建 Round 9] 手动移动、经验升级与公式化数值源接入
### 本轮目标
- 把当前实现从“自动摆动骨架版”推进到“WASD 可控移动”
- 把成长口径改成“战斗击杀掉经验 -> 拾取经验 -> 升级三选一”
- 给升级加入白 / 绿 / 蓝 / 紫 / 金品质权重
- 把敌人血量、速度、出现频率、经验需求、升级品质等数值统一写成公式
- 同步把这些口径回写到 docs

### 文档取舍依据
- 继续以 `PROJECT_STATUS.md` 与本文件最新记录为第一优先
- 用户本轮补充了“WASD 移动、经验升级、品质强化”的核心玩法要求，因此本轮按用户新口径接入
- 但 `NODES_AND_TEMPLATES.md` 仍明确“不是复杂大地图”，所以本轮没有改成完整 Slay the Spire 多层大地图，只保留轻量路线分支
- 同理，精英继续保留为 battle 模板，不新增第四种节点类型

### 现状问题盘点
- 当前角色仍是自动摆动，穿梭流在缺少真实走位时价值被明显削弱
- 成长仍偏“节点触发强化”，不符合“掉经验升级三选一”的核心口径
- 升级没有品质层，公式也没有集中来源
- 敌人血量、速度、刷怪频率和玩家成长存在过多散落常量，不利于后续精细平衡

### 本轮实际接入内容
- 战斗输入：
  - `GameScene` 已接入 `WASD / 方向键`
  - `RunEngine` 的玩家位置改为真实输入驱动，不再自动绕中心摆动
- 经验与升级：
  - 敌人死亡会掉经验球
  - 玩家靠近或吸附后获得经验
  - 经验满足阈值时进入战斗内三选一升级
  - upgrade 节点保留，但改为更稳、更偏高品质的整备升级
- 品质与升级池：
  - 升级加入 `白 / 绿 / 蓝 / 紫 / 金`
  - 升级项切成“通用属性牌 + 三路线特殊强化”
  - 生成时按品质倍率缩放数值，而不是每张牌手写一套固定数值
- 数值公式：
  - 已新增 `NUMERIC_FORMULAS.md`
  - 已把经验需求、敌人血量、敌人速度、敌人出现间隔、品质权重、三路线关键动态公式明确写出

### 当前验证结果
- `npm run build` 已通过
- 浏览器实测已确认：
  - 开始页文案已提示 `WASD`
  - 战斗内能触发经验拾取与等级提升
  - 升级面板会显示品质和实际数值
  - 节点推进、事件、结算主链路未被这轮改坏

### 近似实现清单更新
- 当前“轻分支路线”仍不是正式大地图系统
- 敌人种类仍偏少，模板差异主要靠参数和节奏
- 公式已统一，但只是第一版平衡口径，不等于旧版本成熟数值
- battle 内升级频率、后段经验曲线和终局强度仍需下一轮继续压实

### 风险点
- 现在升级链已经从纯节点强化切到“战斗内升级 + 节点整备”双来源，后续若再改文档口径，需要同步检查 HUD / 结算 / 埋点
- 穿梭流已经重新建立在走位上，后续再调它时要优先看擦身窗口和经验路径，而不是只加伤害
- 品质系统已接入，如果后续继续补牌，需要严格走模板化和公式化，不要重新回到手写散值

### 下一步建议
- 下一轮优先做“精细数值 / 平衡压实”
- 重点看：
  - 开局到中段的升级频率是否过快
  - 穿梭路线在真实走位下的容错是否足够
  - battle / upgrade / event 三种节点的收益曲线是否已经拉开

## [重建 Round 10] 最小表现层收口复核
### 本轮目标
- 在不改主流程、不重写 `RunEngine`、不引入新系统的前提下，补齐最影响完整观感的表现层缺口
- 让开始页、局内 HUD / 面板、结算页更像同一个产品，而不是恢复期的几块可用界面
- 压实提示层级和最小音效闭环，减少“恢复中版本”的测试占位感

### 文档取舍依据
- 最新 `PROJECT_STATUS.md` 与本文件已经说明：仓库当前不再是纯骨架恢复，而是已经接入了公式化成长、战斗内升级和 WASD 操控
- 本轮虽然回到“最小表现层收口”主题，但仍以最新阶段文档和最近开发记录为准，只在表现层边界内继续推进，没有回退到更早阶段口径

### 表现层问题盘点
- 音效层：
  - `hit` 高频触发过于密，容易把升级、压力、结果等关键反馈压平
  - `pressure / result` 虽然存在，但仍不够像关键节点的专属提示
- 图片 / 视觉层：
  - 开始页和结算页已经能用，但开始页仍偏空，产品壳不够完整
  - 局内 HUD 之前更像测试面板堆叠，当前读数和路线读数没有形成统一焦点
  - 战场中的玩家大面积发光圈最像调试占位，容易暴露恢复中质感
- 提示 / 页面层：
  - 节点 / 强化面板辅助文案可读，但仍偏“系统说明口吻”
  - 开始页、局内、结算页的壳体和重点信息布局还不够像同一个产品
  - 路线、阶段、危险、完成提示虽已有 tone，但视觉和听觉的层级还不够一致

### 本轮收口内容
- 开始页：
  - 补入操控、单局、目标三块简短信息卡
  - 补入 `WASD 走位 / 自动射击 / 战斗收经验 / 节点分路推进` 四个轻量信息胶囊
- 局内 HUD / 面板：
  - 改成“当前读数 + 路线读数”两层结构
  - 节点 / 强化面板辅助文案收成更偏玩家读法的表达
  - 路线读数改成单独面板，减少测试监控感
- 结算页：
  - 补入收尾节点、战斗胜场、推进节点、时长四个轻量摘要胶囊
  - 收束说明继续沿用与埋点一致的 build / ending 口径，但观感更完整
- 战场视觉：
  - 去掉最明显的巨大中心发光圈，改成更轻的场地聚焦光感
  - 玩家改为“核心 + 环形描边”而不是大面积填充圈
- 音效层：
  - 下调 `hit` 存在感并拉长冷却
  - 让 `pressure` 更低更重
  - 让 `result` 更像两段式收尾
  - 保持最小音效闭环，不重做完整音频系统

### 当前回归结果
- `npm run build` 通过
- Playwright 实测检查了：
  - 开始页
  - 局内升级 / 节点面板
  - 结算页
- 控制台无新错误
- 玩家可见文本检查通过：
  - 无乱码
  - 无内部设计话术泄露
  - 无明显超框

### 代码恢复度估计
- 整体恢复度：`68%~76%`
- 估计口径：
  - 仍按“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已经达到一个不明显像恢复测试版的可玩状态”
- 结构恢复度：`81%~87%`
- 内容恢复度：`48%~58%`
- 表现恢复度：`52%~62%`
- 本轮提升有限但明确存在：
  - 结构和内容并没有大幅增加，所以整体只小幅上升
  - 提升主要来自表现恢复度和页面 / 提示 / 音效的一致性

### 近似实现清单更新
- 当前视觉统一主要依赖 Phaser 程序图形和 CSS，不等于正式美术资源已恢复
- 音效仍是程序化最小方案，不等于正式资源级音频设计
- 内容量、正式权重分布和精细平衡仍明显落后于旧项目成熟状态

### 风险点
- 现在观感更统一，但战场素材和敌人变化面依旧偏少，长期仍会被内容量限制
- 提示层级已经收紧，后续若改大量中文文案，需要同步复核 tone 分类和页面节奏
- 公式化成长接入后，下一步若不尽快压实平衡，观感提升会被数值波动抵消

### 下一步建议
- 下一轮优先接“精细数值 / 平衡压实”，而不是继续大量补内容
- 原因是当前主流程、内容底座、最小表现层和公式化成长都已经站住，更值得先把升级频率、路线强度和模板压力校准

## [重建 Round 11] 内容扩容与分发优化
### 本轮目标
- 不改主流程、不重写 `RunEngine`、不引入新系统
- 在现有数据驱动结构内补一轮 `nodes / events / upgrades` 内容密度
- 细化 Content Selector 的阶段 / 流派 / build 倾向分发
- 让三流派在前中期更早出现“这局正在往哪走”的可感知差异，并顺手增强 replay 动机

### 文档取舍依据
- 继续以最新 `PROJECT_STATUS.md` 与本文件作为阶段文档基准
- 但本轮执行优先级采用用户本轮新增要求：当前项目不是回到骨架重建，也不是继续扩新系统，而是进入内容与可玩性阶段
- 因此本轮没有按更早的“优先做平衡压实”单线推进，而是在同一边界下把重心前移到内容密度、分发与流派分化
- 更早的 `REBUILD_PLAN.md` 与 `ROADMAP_0_9.md` 仅继续作为背景顺序参考，不作为本轮实现目标

### 改动前盘点
- `upgrades`：20 张
  - 通用 8
  - 每条流派各 4
  - 问题不是完全不够，而是前期 starter 几乎固定，路线一旦出现倾向后，中段承接仍偏少
- `events`：5 个
  - 全部缺少阶段窗口区分
  - 路线相关事件虽然存在，但事件 selector 实际上没有把路线倾向真正传进权重计算
- `nodes`：
  - 模板家族已经扩成 `3 x 3`
  - 但每个 round 的 node blueprint 仍偏少，标题与 offer 结构重复率高
  - 后段单选概率偏高，容易让短局后半段读起来过平
- 结论：
  - 当前最缺的是“内容密度 + 分发质量”
  - 不是新系统，也不是回头重写引擎

### 本轮内容扩容
- 升级新增 6 张，每条流派新增 2 张：
  - 暴击：
    - `crit-primer`
    - `crit-cascade`
  - 穿透：
    - `pierce-rail`
    - `pierce-bloom`
  - 穿梭：
    - `dash-feint`
    - `dash-reentry`
- 这些新增内容的定位：
  - 暴击：更早区分“升温预热”与“爆链收尾”
  - 穿透：更早区分“续链贯穿”与“扇裂铺面”
  - 穿梭：更早区分“贴身换收益”与“稳态净帧 / 回线汲能”
- 事件新增 3 个，全都服务路线节奏或构筑倾向：
  - `crit-heat-bank`
  - `pierce-routing-map`
  - `dash-weave-memory`
- 节点内容新增一轮 blueprint 变体，用来降低同阶段标题和推进节奏重复：
  - 前段：
    - `round-1-battle-flank`
    - `round-1-upgrade-fireline`
    - `round-1-event-probe`
  - 中段：
    - `round-2-battle-screen`
    - `round-2-upgrade-lock`
    - `round-2-event-shift`
  - 后段：
    - `round-3-battle-gauntlet`
    - `round-3-upgrade-anchor`
    - `round-3-event-last-bet`

### Selector / 分发规则调整
- 为内容选择配置增加 `phaseBonuses`
  - 让 starter / bridge / finisher / route event 能更明确地落在前 / 中 / 后期
- 为事件定义增加轻量 `routeAffinity`
  - 让事件 selector 能真正使用 `dominant / crit / pierce / dash` 路线倾向进行分发
  - 修正了之前“事件权重看起来写了路线偏向，但实际没有生效”的问题
- 升级 selector 从“纯三张混抽”改为“轻量结构化发牌”：
  - 未出现 dominant route 时：
    - 继续优先给三路线 starter，但 starter 现在有更多变体，不再固定成同 3 张
  - 已出现 dominant route 但尚未锁定时：
    - 至少给 1 张当前路线牌
    - 再给 1 张通用支撑
    - 最后留 1 个弹性位
  - 已 committed / matured，或进入 `nodePrep` 时：
    - 更高概率给 2 张当前路线牌 + 1 张支撑位
- 节点 offer 也做了两处调整：
  - 扩充每个 round 的 blueprint 数量
  - 降低后段单选概率，提高 2~3 选的出现率，减少后段推进发平
- 最终战候选重新对齐为精英家族内部共存抽取，不再混入生存家族模板

### 本轮验证结果
- 静态 / 抽样验证：
  - 当前 `upgrades` 数量提升到 26
    - 通用 8
    - 每条流派各 6
    - starter 提升到 6
    - payoff 提升到 6
  - 当前 `events` 数量提升到 8
    - `routeAffinity` 分布：
      - none: 3
      - dominant: 2
      - crit / pierce / dash: 各 1
  - 抽样脚本确认：
    - 无 dominant route 的开局 level-up 已不再固定成同 3 张 starter
    - 中段 `crit / pierce / dash` committed 状态下，更容易命中本路线的 bridge / payoff
    - route-specific events 已会在对应 dominant route 下明显增重，off-route 命中接近被压到边缘
    - round 3 的单选比例明显下降，后段 2~3 选更常见
- 浏览器回归：
  - `npm run build` 通过
  - Playwright 实测确认：
    - 开始页文本正常
    - 新 starter / bridge / payoff 升级卡在局内面板正常出现
    - 新节点标题与说明正常出现
    - 完整跑通：开始 -> 战斗 / 升级 / 节点 -> 结果 -> replay
    - `run_finished`、`restart_after_first_run`、`second_run_start` 继续正常写入
    - 控制台无新错误
  - 顺手修了一处小的玩家可见问题：
    - 结果页 / 开始页切场时主动清空上一阶段 toast，避免收尾界面被旧提示遮挡

### 本轮更新文档
- `doc/docs/DEV_ISSUE_LOG.md`
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`

### 代码恢复度估计
- 整体恢复度：`72%~79%`
- 估计口径：
  - 仍以“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已具备更稳定的内容扩写、路线分化与 replay 驱动力”
- 结构恢复度：`82%~88%`
- 内容恢复度：`60%~68%`
- 表现恢复度：`54%~63%`
- 本轮提升主要来自：
  - 内容量更实
  - 内容分发不再只是纸面权重
  - 三流派在前中期的 build 信号更明确

### 风险点
- 当前 replay 动机已经有提升，但仍主要来自路线信号和内容差异，稀有事件 / 高记忆点结算仍偏少
- route-specific events 现在已能被 selector 正确命中，但仍需要下轮继续观察三路线真实胜率和早期锁定速度
- 内容量虽然上来了，但若后续不继续维护分发口径，仍可能被通用牌重新稀释

### 下一步建议
- 下一轮优先做“分发后的低频平衡压实”，不是回头扩新系统
- 重点观察：
  - starter 到 committed 的平均用时是否过快
  - route-specific event 的命中是否已经足够但没有过度锁死
  - 后段 node 2~3 选增加后，是否真的提升 replay 感而不是只增加阅读成本

## [重建 Round 12] 构筑承诺节奏控制
### 本轮目标
- 不改主流程、不重写 `RunEngine`、不引入新系统
- 把上一轮增强后的“方向更清楚，但可能过早 committed”问题重新收平
- 在现有数据驱动结构内把 `starter -> bridge -> committed -> payoff` 的坡度重新拉开
- 低成本补充“首个强承诺时点”和“是否发生转向”的观测字段

### 文档取舍依据
- 继续以最新 `PROJECT_STATUS.md` 与本文件作为阶段基线
- 但本轮优先级采用用户最新指令：当前主问题不是内容量不够，而是构筑锁定速度可能过快
- 因此本轮没有回到“继续补大批内容”或“做新系统”，而是把 selector / route progression / metrics 一起调成更平滑的承诺坡度
- 更早的 `REBUILD_PLAN.md`、上一轮“内容扩容优先”记录只保留为背景，不作为本轮主口径

### 改动前盘点
- 升级 selector：
  - 只要出现 dominant route，就会立刻吃到较高 `dominantRouteBonus`
  - opening hinted 状态下的三选一平均仍会出现约 `1.69` 张路线牌，而且几乎全是 starter
- 路线推进阈值：
  - 旧逻辑是 `count >= 2` 就 committed、`count >= 3` 就 matured
  - 这会和上一轮更强的 starter 分发叠加，导致部分 build 在 opening 内就有较高概率提前锁定
- 事件 selector：
  - mid hinted 状态下，`route-calibration / targeted-telemetry / route-specific event` 很容易扎堆上浮
  - bridge 还没铺平时，payoff 信号已经开始提前出现
- 节点文本与权重：
  - round 2 的部分 upgrade / event blueprint 仍偏“直接锁定”的表达，不利于维持转向弹性

### 本轮实际处理内容
- 选择器口径：
  - 给 `ContentSelectionProfile` 新增轻量 `hintedRouteBonus`
  - 将“已出现 dominant route 但尚未 committed”的权重，与“已经 committed / matured”的权重拆开处理
  - hinted 阶段的升级面板现在改为更稳定的：
    - `1` 张当前路线提示位
    - `1` 张中性 / 过渡位
    - `1` 张侧向 / 转向位
  - committed 阶段仍会偏向当前路线，但保留一个通用 / 弹性位，直到 late / final 才把 payoff 集中上浮
- 升级池调整：
  - 通用 bridge 新增：
    - `generic-vector-buffer`
    - `generic-pressure-bypass`
  - 三路线 soft bridge 新增：
    - `crit-afterglow`
    - `pierce-vector`
    - `dash-slipstream`
  - 这些新增内容都用于在 mid 把路线“扶稳”而不是直接押成 payoff
  - 现有 `bridge + payoff` 牌和 `finisher` 统一后移到 `round >= 3`
  - starter 的 dominant 加权改弱，避免一出方向就继续强喂 starter
- 事件池调整：
  - 新增过渡事件：
    - `signal-soften`
    - `coolant-detour`
  - `signal-soften` 提供“顺着当前读法微调，但不加 route progress”的半中性承接
  - `coolant-detour` 提供纯中性节奏 / 容错缓冲
  - `route-calibration`、`targeted-telemetry` 的 hinted 权重下降，避免 hinted 阶段过快压成 committed
  - 三个 route-specific payoff event 统一后移到 `round >= 3`
- 节点分发调整：
  - round 1 event blueprint 权重下降，减少 opening 过度靠事件拉大路线偏置
  - round 2 新增 `round-2-upgrade-bridge`
  - round 2 既有 `upgrade-lock / event / event-shift` 权重与文案改成“扶稳方向”而不是“直接锁死”
  - round 3 再次降低单选概率，把更多 2~3 选留给后段 payoff 与收尾修正
- 路线推进与埋点：
  - committed 阈值从 `2` 提高到 `3`
  - matured 阈值从 `3` 提高到 `5`
  - 新增：
    - `firstCommitStage`
    - `firstCommitPick`
    - `branchSwitchCount`
  - `route_lock_time` 现在会附带 `phase / pickId`
  - 新增 `branch_switch` 事件，用于记录 dominant route 发生变化的时点与来源

### 本轮验证结果
- 静态 / 抽样验证：
  - 升级总量从 `26 -> 31`
    - generic `8 -> 10`
    - 每条路线 `6 -> 7`
  - opening hinted 状态下：
    - 当前路线位稳定收敛为约 `1` 张 / 次
    - 其余两位更常落在“中性过渡 + 侧向转向”
  - mid hinted 状态下：
    - bridge 已成为主承接内容
    - route payoff 基本退出中段抽样主流
  - late committed 状态下：
    - route-specific payoff event 开始集中上浮
- 浏览器回归：
  - `npm run build` 通过
  - Playwright 实测确认：
    - start -> node / battle / upgrade / event -> result -> replay 全链路可用
    - `crit` 实机 aggressive 选法下，`firstCommitStage` 已从 opening 推迟到 `late`
    - `pierce` aggressive 选法下，`firstCommitStage` 落在 `mid`
    - `dash` aggressive 选法下，`firstCommitStage` 从 opening 推迟到 `mid`
    - 三路线 late / final 仍能稳定看到 payoff 与成型提示
    - replay 继续正常写入 `restart_after_first_run / second_run_start`
  - 定向脚本验证：
    - dominant route 发生变化时，`branch_switch` 会真实写入，并同步累计到 `branchSwitchCount`

### 本轮更新文档
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/CORE_LOOP.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/DEV_ISSUE_LOG.md`

### 代码恢复度估计
- 整体恢复度：`75%~82%`
- 估计口径：
  - 仍以“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已能更稳定地控制 build 坡度、观察承诺时点，并继续做内容迭代”
- 结构恢复度：`83%~89%`
- 内容恢复度：`64%~71%`
- 表现恢复度：`54%~63%`
- 本轮提升主要来自：
  - 路线节奏不再只靠主观感受判断
  - starter / bridge / payoff 的分发更清楚
  - 埋点能更具体地观察“什么时候开始锁、是否发生转向”

### 风险点
- 当前 aggressive 选法下三路线都能在中后段站稳，但 `branchSwitchCount` 的真实样本仍偏少，需要继续观察玩家是否真的会利用转向窗口
- payoff 已后移，若后续继续补 route-specific 内容时不维持这条坡度，仍可能把 committed 再次提前
- 当前验证主要依赖抽样脚本与 Playwright 实机，尚未形成长期自动化分布回归基线

### 下一步建议
- 下一轮优先做“commit pacing 观察后的低频压实”，而不是回头做新系统或继续大补量
- 重点看：
  - mid committed 的平均时点是否已经稳定
  - 三路线转向窗口是否真实被使用
  - late payoff 是否足够爽，但没有重新提前回渗到 mid

## [重建 Round 13] 稀有内容 / replay 驱动强化
### 本轮目标
- 不改主流程、不重写 `RunEngine`、不引入新系统
- 在上一轮承诺节奏控制的基础上，补出一层真正可感知的 rare / replay 内容
- 继续压住 payoff 回渗到 mid 的风险，同时给中后段补更多 hybrid / pivot 动机
- 在已有埋点结构内最小化补充 rare 命中观测，不新建埋点系统

### 文档取舍依据
- 继续以最新 `PROJECT_STATUS.md` 与本文件作为阶段文档基线
- 但本轮优先级采用用户最新要求：当前主问题已从“承诺节奏控制”切到“replay 动机强化 + 稀有内容设计 + payoff 防回渗”
- 因此本轮没有回头做骨架重建，也没有继续大补普通内容，而是把重心放到 rare 层、late 兑现层和转向吸引力
- 更早的 `REBUILD_PLAN.md` / `ROADMAP_0_9.md` 继续只保留为背景顺序参考

### 改动前盘点
- `upgrades`：31 张
  - 通用 10
  - 每条路线 7
  - 已经有 starter / bridge / payoff 坡度，但内容池本身没有显式 rare 层
- `events`：10 个
  - 已有 3 个 route-specific late 事件，但抽样显示它们与 `route-calibration / targeted-telemetry` 的 late 命中频率仍然接近，不够像真正 rare
- `nodes / templates`
  - late / final 已有一定变体，但缺少足够低频的高辨识度模板候选
  - replay 动机仍主要来自路线本身，而不是“这局撞上了不同的 late 记忆点”
- selector 风险
  - `mid hinted` 抽样里 starter 仍偏容易继续占住路线位
  - off-route 弹性位虽然保住了转向空间，但如果不继续约束，容易把 `bridge + payoff` 一起带回中段抽样

### 本轮实际处理内容
- 轻量 rare 元数据
  - 给 `UpgradeArchetype / UpgradeDefinition / EventDefinition / BattleTemplateDefinition` 增加了兼容型 `contentTier`
  - rare 仍然走现有 data-driven selector，不新建系统
- selector 调整
  - `getSelectionWeight` 现在会根据 `contentTier: rare` 叠加阶段倍率
  - rare 在 `opening` 基本压低，在 `mid` 低频出现，在 `late / finalPrep / finalBattle` 才逐步放开
  - `mid hinted` 的路线位改为优先 bridge，再由 generic / pivot 承接，减少 starter 再次刷屏
  - off-route pivot 位现在排除了 `payoff / finisher`，避免侧向位把 payoff 重新带回中段
  - `late committed` 调整为“两张本路 + 一张弹性位”，避免后段路线感被侧向位冲散
- 新增 hybrid / bridge 内容
  - 通用强化：
    - `generic-sideband-cache`
    - `generic-open-loop`
  - 定位：中段与中后段的混搭 / 转向缓冲，不直接推进单一路线 payoff
- 新增 rare / replay 内容
  - rare 强化：
    - `crit-superheat`
    - `pierce-prism`
    - `dash-zero-window`
  - rare 事件：
    - `cross-branch-signal`
    - `blackbox-bargain`
  - 既有 late route-specific 事件：
    - `crit-heat-bank`
    - `pierce-routing-map`
    - `dash-weave-memory`
    - 统一纳入 rare 层，继续保留 late 偏置
  - rare 模板变体：
    - `survival-crossfire`
    - `elite-vice`
  - late 节点变体：
    - `round-3-battle-crossfire`
    - `round-3-event-blackbox`

### 本轮验证结果
- 静态 / 抽样验证
  - `upgrades`：`31 -> 36`
    - rare payoff 新增 3
    - hybrid / bridge 通用强化新增 2
  - `events`：`10 -> 12`
    - rare 事件层现在包含 5 项（含 2 个新 rare 事件与 3 个 late route-specific rare 事件）
  - `battle templates`：`9 -> 11`
    - rare 模板 `survival-crossfire / elite-vice` 已接入 late / final 候选池
  - 抽样结果：
    - `mid hinted` 的路线位已从 starter 为主改成 bridge 为主
    - late route-specific rare 事件命中率已明显低于 `route-calibration / targeted-telemetry`
    - round 3 rare battle 模板 `survival-crossfire` 可出现但保持低频
    - final battle rare 模板 `elite-vice` 可出现但保持低频
- 浏览器回归
  - `npm run build` 通过
  - Playwright 实测确认：
    - start -> node / battle / upgrade / event -> result -> replay 全链路可用
    - crit / pierce 跑局中已实机命中 rare payoff 强化
    - replay 继续正常写入 `restart_after_first_run / second_run_start`
    - `branch_switch` 与 `branchSwitchCount` 已通过定向实机验证，`crit -> pierce` 转向可正常记录
    - 控制台无新错误
- 埋点补充
  - 不新增独立 rare 事件类型
  - 继续沿用现有 `battle_template_entered / battle_template_completed / event_selected / upgrade_selected`
  - 当命中 rare 内容时，在 payload 中附带 `contentTier: rare`

### 本轮更新文档
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/DEV_ISSUE_LOG.md`

### 代码恢复度估计
- 整体恢复度：`79%~84%`
- 估计口径：
  - 仍以“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已具备更明确的 replay 钩子、late rare 记忆点和不易回渗的 payoff 边界”
- 结构恢复度：`84%~89%`
- 内容恢复度：`69%~76%`
- 表现恢复度：`55%~64%`
- 本轮提升主要来自：
  - rare / replay 层终于从“只有升级品质稀有度”推进到“内容本身存在低频记忆点”
  - late payoff 与 late rare 变体的边界更清楚
  - hybrid / pivot 内容开始真正服务转向样本，而不只是保留理论空间

### 风险点
- `branchSwitchCount` 已验证可用，但自然跑局里的真实转向样本仍不算高，后续还需要继续观察玩家是否真的愿意为了 rare / hybrid 内容改变路线
- rare 层已经接入，但若下轮继续大补普通 route-specific 内容而不维持 rare / late / hybrid 的比例，replay 动机仍会被常规内容重新淹没
- rare 模板已经可出现，但当前 battle 家族仍然有限，后续需要继续观察这些 rare 记忆点是否足够强，还是只变成了“多一个名字”

### 下一步建议
- 下一轮优先做“rare / replay 命中后的低频压实”，不是回头做新系统或普通内容泛补
- 重点看：
  - rare 事件和 rare 模板的真实命中率是否已经足够低频、但足够被记住
  - `branchSwitchCount` 是否随着 hybrid / pivot 内容增加而自然抬升
  - late rare payoff 是否足够爽，但没有重新把 payoff 压回 mid

## [重建 Round 14] 内容池比例边界维护 + hybrid / redirect 补强
### 本轮目标
- 不改主流程、不重写 `RunEngine`、不引入新系统
- 继续守住 `starter -> bridge -> committed -> payoff` 坡度，同时避免普通 `route-specific` 内容重新淹没 rare / hybrid / late payoff
- 让中段的弹性位更多落在真正能转向的 `hybrid / redirect` 内容上，而不是普通 off-route starter
- 用一轮自然样本 + 一轮定向样本验证 `branchSwitchCount`、rare 命中和 late payoff 感知

### 文档取舍依据
- 继续以最新 `PROJECT_STATUS.md` 与本文件作为阶段文档基线
- 本轮优先级采用用户最新要求：`比例边界维护 > hybrid / redirect 补强 > 实跑样本验证`
- 因此本轮没有回头补普通内容量，也没有引入新埋点系统，只在现有 data-driven 结构与现有埋点上做轻量强化

### 改动前盘点
- 静态数量：
  - `upgrades`：36
  - `events`：12
  - `templates`：11
- 结构比例：
  - `upgrades` 里仍有 21 条 `route-specific`，`hybrid` 只有 2 条，rare 只有 3 条
  - `events` 虽然已有 rare 层，但 mid 里仍偏少真正的 redirect 机会
- 抽样结果：
  - `mid hinted` / `mid committed` 的 upgrade 三选一里，普通 off-route starter / bridge 仍会挤占弹性位
  - late 里 rare / late payoff 已经存在，但普通 route-specific 仍可能把它们的感知压薄
  - 自然跑局里的 `branchSwitchCount` 仍容易保持为 0

### 本轮实际处理内容
- selector / 比例边界：
  - 调整 `Content Selector`，让 mid 的弹性位优先给 `hybrid / redirect`
  - 不再优先把普通 off-route starter 当作“转向空间”
  - late / final 的 flex 位改为让 generic hybrid 与 late generic payoff 同池竞争，避免 rare late payoff 变成固定第三张
- 新增 upgrade：
  - generic:
    - `generic-crossfeed`
    - `generic-terminal-weave`
  - redirect:
    - `crit-sidechannel`
    - `pierce-sidechannel`
    - `dash-sidechannel`
- 新增 event：
  - `route-handoff`
  - `mirror-cache`
- 节点分发：
  - 新增 `round-2-event-handoff`
  - 下调 `round-2-upgrade-lock`
  - 上调 `round-2-event-shift`
  - 上调 `round-3-event-blackbox`
  - 小幅下调 `round-3-event-last-bet`
- 现有内容调权：
  - route starter 与普通 bridge 的 `offRouteMultiplier` 普遍下调，减少 mid 被普通 off-route 路线牌挤满
  - `route-calibration / targeted-telemetry` 的 late 权重下调，避免 late 继续被普通 route-specific event 占住
  - `cross-branch-signal / blackbox-bargain` 的 late 感知略上提
- redirect 力度：
  - `route-handoff` 以及 sidechannel / cross-branch 一类 redirect 内容，路线推进从“只够并列”补到“有机会真正改写 dominant route”
- 埋点轻量补充：
  - 在现有 `run_finished` 汇总里新增：
    - `rareSeenCount`
    - `hybridPickCount`
    - `latePayoffSeenCount`
  - 不新增新事件类型，只复用已有 `battle_template_entered / event_selected / upgrade_selected`

### 本轮验证结果
- 静态 / 抽样验证：
  - `upgrades`：`36 -> 41`
  - `events`：`12 -> 14`
  - `mid hinted` 的 upgrade 抽样中：
    - `route-specific` 不再占掉 2/3 的常规位置
    - `hybrid + redirect` 已提升为接近 `generic neutral` 同级的常见弹性位
  - `round 2` 节点抽样中：
    - `round-2-event-shift`
    - `round-2-event-handoff`
    - 已明显比此前更常作为 mid 事件窗口出现
- 浏览器验证：
  - `npm run build` 通过
  - Playwright smoke：
    - 开始页、战斗页截图正常
    - 控制台无新错误
  - 自然样本（4 runs）：
    - rare 命中已出现
    - `hybridPickCount` 稳定非零
    - `latePayoffSeenCount` 稳定非零
    - replay 正常
    - 但 `branchSwitchCount` 自然样本仍偏低，说明默认吸引力还不够稳
  - 定向 switch-seeking 样本（3 runs）：
    - 已实机出现 `crit -> pierce` 的 `branch_switch`
    - 触发来源为 `event:route-handoff:route-handoff-pierce`
    - 说明 redirect 内容已经具备“真实改道”能力，不再只是纸面可转

### 本轮更新文档
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/DEV_ISSUE_LOG.md`

### 代码恢复度估计
- 整体恢复度：`82%~86%`
- 估计口径：
  - 仍以“与旧项目最成熟状态相比”的恢复度为主
  - 同时参考“当前是否已守住比例边界、是否已具备更真实的 redirect 内容与 replay 观测”
- 结构恢复度：`85%~89%`
- 内容恢复度：`73%~79%`
- 表现恢复度：`55%~64%`
- 本轮提升主要来自：
  - mid 弹性位不再主要被普通 off-route 内容伪装占满
  - rare / hybrid / late payoff 的存在感更清楚
  - redirect 内容已经能在真实运行里触发 dominant route 改写

### 风险点
- 自然跑局里的 `branchSwitchCount` 仍不算高，说明 redirect 机会虽然已能成立，但默认吸引力还不够稳
- 若后续继续大补普通 route-specific 内容而不维持这轮的 selector 边界，rare / hybrid / late payoff 很快会再次被稀释
- `generic-terminal-weave` 一类 late flexible payoff 还需要继续观察命中率，避免变成“写进池里但实感不强”

### 下一步建议
- 下一轮优先做“redirect 吸引力压实”，不是继续铺普通路线内容
- 重点看：
  - `branchSwitchCount` 在自然样本里能否稳定抬升到非零
  - `route-handoff / sidechannel / cross-branch` 的真实点击率是否足够高
  - late flexible payoff 与 late route payoff 是否都能被记住，而不是彼此冲掉

## [重建 Round 15] 设计基线澄清 + 偏离审计入口补档
### 本轮目标
- 把 2026-04-05 用户最新补充的玩法设计整理成一份可直接作为后续对齐依据的文档基线
- 不改主流程、不重写 `RunEngine`、不直接改系统实现
- 先把“目标设计口径”和“当前实现口径”拆开，避免后续 Codex 继续按旧文档误判

### 文档取舍依据
- 当前仓库内已有文档大多记录“当前实现口径”，但用户本轮补充的是更高优先级的“目标设计口径”
- 因此本轮不删除旧文档，而是新增高优先级设计基线文档，并在核心文档中显式挂出优先级说明
- 如旧文档与用户新口径冲突，后续应以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md` 与本文件最新记录为准

### 本轮归纳出的用户设计基线
- 操作层：
  - 战斗参考《土豆兄弟》
  - `WASD` 移动
  - 自动攻击
- 成长层：
  - 敌人掉经验
  - 升级后进入三选一强化
  - 强化分通用属性强化与三流派特殊强化
  - 强化品质为白 / 绿 / 蓝 / 紫 / 金
  - 高品质随关卡推进提升出现概率
  - 每个强化都应有价值公式，高价值强化倾向更高品质
  - 三流派特殊强化只从绿开始出现
  - 每个强化单局只允许被选择一次
- 地图层：
  - 参考《杀戮尖塔 2》的地图推进，但保持轻量
  - 并非每次都给多个分支
  - 末尾必须有 Boss 关收尾
  - 目标关卡类型为：`boss / battle / upgrade / anomaly`
- 战斗层：
  - `battle` 至少覆盖普通关 / 精英关 / 生存关
  - 生存关最后 `10s` 需要有平滑增压
  - 精英关需要体现反向移动与护卫挡前
- 敌人层：
  - 普通怪
  - 厚血慢速大体型怪
  - 高速脆皮怪
  - 远程怪
  - 这四类都需要玩家可感知地区分开

### 对当前实现的关键偏离盘点
- 节点类型：
  - 当前 `src/game/types.ts` 里的 `NodeType` 仍是 `battle / upgrade / event`
  - 与目标 `boss / battle / upgrade / anomaly` 口径存在差异
- 最终关：
  - 当前最终收尾仍主要以 `finalBattle -> battle template` 近似
  - 尚未形成明确的 Boss 关设计口径
- 强化唯一性：
  - 当前 `src/data/upgrades.ts` 中仍有大量 `repeatable: true`
  - 与“每个强化单局只选一次”的设计口径冲突
- 特殊强化品质下限：
  - 当前 route upgrade 的 roll 逻辑仍需要继续检查是否会落入白品
  - 与“特殊强化从绿开始”存在潜在冲突
- 敌人族群：
  - 当前实现更偏 `regular / escort / elite`
  - 还未明确落成四类基础小怪
- 精英行为：
  - 当前已有 `frontline / screened / kiting / summoner`
  - 但仍需继续审计是否稳定满足“反向移动 + 小怪挡前”的设计读数

### 本轮更新文档
- `doc/docs/DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/CORE_LOOP.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/NUMERIC_FORMULAS.md`
- `doc/docs/DEV_ISSUE_LOG.md`

### 当前结论
- 这轮主要补的是“设计基线”和“偏离审计入口”，不是代码实现量
- 文档层面已把“当前实现口径”和“目标设计口径”拆开
- 后续再让 Codex 推进时，应先做一次 design alignment audit，再决定改代码还是继续补文档

### 下一步建议
- 下一轮优先让 Codex 基于新基线做一次对齐审计，重点检查：
  - `NodeType / final battle / anomaly` 是否需要数据层先行重命名或补结构
  - 强化唯一性与特殊强化最低品质是否已偏离设计
  - 四类基础小怪与远程怪是否需要先补数据定义
  - 精英行为是否只是“近似”，还是已经足够接近目标读数

## [重建 Round 16] design alignment audit + 低风险规则纠偏
### 本轮目标
- 按 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 对当前实现做一次逐项审计
- 只修正文档口径和低风险数据层问题，不擅自重做结构
- 把“已符合 / 近似符合 / 明显偏离”固化进文档，避免后续继续沿旧口径漂移

### 审计范围
- 玩家操作与自动攻击
- 击杀掉经验 -> 拾取 -> 升级三选一
- 强化品质五档、品质权重与价值公式
- 三流派特殊强化最低品质
- 强化单局唯一性
- 轻量地图推进与节点类型
- 最终战、异常关、battle 三家族模板
- 生存关压力增长、精英行为、基础敌人族群
- 现有埋点结构是否受本轮低风险修正影响

### 审计结论
- 已符合：
  - 玩家操作保持 `WASD` 主移动 + 自动攻击，方向键只是额外兼容。
  - 击杀掉经验 -> 吸附 / 拾取 -> 升级三选一链路完整可跑。
  - 品质五档、品质权重与 `upgradeValueScore` 公式已存在。
  - `battle` 家族已经覆盖普通 / 精英 / 生存三类模板。
- 近似符合：
  - 地图推进已经是轻量 STS 风格，但仍建立在当前 `battle / upgrade / event` 节点口径上。
  - 最终战已稳定作为整局收尾，但目前仍是 final battle 模板近似，不是独立 Boss 关语义。
  - `event / rare event` 已能承接一部分异常感，但还不是玩家可感知的 `anomaly` 关。
  - 精英模板已有 `frontline / screened / kiting / summoner` 行为近似“反向移动 + 护卫挡前”，但读数还不是硬约束。
  - 生存关压力会随时间平滑增加，但没有单独落成“最后 10 秒显式增压”规则。
- 明显偏离：
  - `NodeType` 仍是 `battle / upgrade / event`，未对齐目标 `boss / battle / upgrade / anomaly`。
  - 当前最终收尾仍没有独立 Boss 关数据语义。
  - 敌人族群仍是 `regular / escort / elite`，未形成四类明确基础小怪口径。
  - 当前没有独立远程敌种与玩家可读的远程压迫层。

### 本轮直接修正
- 升级唯一性：
  - `contentSelectors` 发牌时改为统一按 `selectedUpgradeIds` 去重
  - `RunEngine` 记录已选强化时统一按 `sourceId` 单次写入
  - 结果是：同一个强化单局只允许被拿一次，不再因 `repeatable` 元数据重复出现
- 三流派特殊强化最低品质：
  - route 强化在发牌时若掷出白品，会被上抬到绿品
  - 结果是：三流派特殊强化现在满足“从绿开始出现”的最新设计基线
- 文档同步：
  - `PROJECT_STATUS.md`、`CORE_LOOP.md`、`NODES_AND_TEMPLATES.md`、`NUMERIC_FORMULAS.md` 同步补记了审计结论和当前实现边界

### 本轮刻意不直接硬改的偏离
- `NodeType` 扩到 `boss / anomaly`
- 最终战升级为独立 Boss 关语义
- 四类基础小怪与远程敌人补齐
- 生存关最后 `10s` 的显式增压规则
- 原因：
  - 以上都已经越过“低风险数据层校正”的范围，开始涉及节点结构、敌人语义或战斗系统读数层
  - 本轮优先目标是先把方向审计清楚并校正明显低风险偏离，避免一边审计一边把结构级改动混进来

### 验证结论
- 代码层面：
  - 升级唯一性现在由 selector 与 runtime 双重约束
  - route 强化最低绿品在发牌阶段已落地
- 埋点层面：
  - 未新增埋点字段
  - 现有 `window.__pilotMetrics`、导出链路和已接入的 redirect / branch 指标不受本轮规则校正影响

### 下一步建议
- 下一轮优先做结构级偏离的“最小下一步方案”，而不是直接硬重构：
  - 先定义 `boss / anomaly` 的数据层口径，再决定是否扩 `NodeType`
  - 先补四类基础小怪的数据语义，再决定是否补远程弹道
  - 先把生存关最后 `10s` 的显式压强曲线写入公式文档，再决定是否改 battle pressure 实现
## [内容与可玩性阶段 / Round 17] 结构语义最小落地
### 来源口径
- 本轮按 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 作为最高优先级口径。
- 当旧文档或代码仍停留在 `battle / upgrade / event`、`regular / escort / elite` 时，以新基线要求的 `boss / battle / upgrade / anomaly` 与四类基础敌人语义为准。

### 审计结论
- 已符合：
  - `WASD + 自动攻击`
  - 击杀掉经验 -> 拾取 -> 升级三选一
  - 品质五档与数值公式
  - `battle` 家族覆盖普通 / 精英 / 生存
- 近似符合：
  - 最终战原本是 final battle 模板近似
  - anomaly 原本由 event / rare event 近似
  - 精英已具备拉扯和护卫掩护的近似行为
- 明显偏离且本轮已修正：
  - `NodeType` 现已落为 `battle / upgrade / anomaly / boss`
  - 最终节点现在是显式 `boss`
  - 基础敌人已拆为 `standard / brute / skirmisher / ranged`
  - `battle_template_entered` / `run_finished` 已能记录 `nodeType / finalNodeType`

### 本轮修改
- 节点语义：
  - `nodes.ts` 将原事件节点改为 `anomaly`
  - 最终节点改为 `boss`
  - Boss 节点标题和描述在数据构建时显式覆盖为 Boss 口径
- 运行层：
  - `RunEngine` 现支持 `boss` 走战斗流、`anomaly` 走事件流
  - Battle state 增加 `encounterType`
  - 最终结果新增 `finalNodeType`
- 敌人语义：
  - 新增 `enemyArchetypes.ts`
  - `battleTemplates` 增加 `regularArchetypes / escortArchetypes`
  - 基础敌人现在按 archetype 混编出场
  - `ranged` 怪拥有最小保距移动与敌方弹道
  - 渲染层为 `brute / skirmisher / ranged` 提供了最小可见差异
- 埋点：
  - `battle_template_entered.payload.nodeType`
  - `run_finished.payload.finalNodeType`

### 仍保留的近似实现
- Boss 关仍复用 elite-family 模板承压，没有独立 Boss 机制树。
- anomaly 节点仍复用现有 event 数据与事件面板，不是独立 anomaly 结算系统。
- 生存关最后 10 秒显式增压尚未拆成独立规则段。

### 验证
- `npm run build` 通过。
- 浏览器实跑已验证：
  - 开始 -> 节点推进 -> 强化 / 异常 -> 最终 Boss -> 结算 -> replay 全链路可跑通。
  - 节点面板已出现 `异常` 与 `Boss` 标签。
  - `battle_template_entered` 和 `run_finished` 已导出 `nodeType / finalNodeType`。
  - 战斗截图已能看到大体型敌人与方形远程敌人的最小可见差异。
- 现阶段主要剩余风险：
  - 四类基础敌人的“行为辨识度”已经入场，但还未像完整版本那样被更强的 AI 与专属表现进一步拉开。

### 恢复度估计
- 整体恢复度：`88%~90%`
- 本轮提升主要来自“结构语义止漂移”，不是内容量增加。

## [恢复尾段 / Round 18] boss / anomaly 承载边界最小落地
### 来源口径
- 本轮按 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 作为最高优先级口径。
- 目标不是继续补普通内容，而是把 `boss / anomaly` 从“节点命名已对齐”推进到“数据层承载边界已落地”。

### 改动前审计结论
- `boss` 已落地到：
  - `NodeType`
  - 最终节点标题 / 结果页 / `run_finished.finalNodeType`
  - `battle_template_entered.payload.nodeType`
- `boss` 仍近似复用：
  - 最终节点仍直接抽 `elite / elite-lockdown / elite-screen` 一类模板 ID
  - 结构上还没有真正独立出 Boss 模板承载入口
- `anomaly` 已落地到：
  - `NodeType`
  - 节点卡与 UI 标签
  - 节点记录与埋点口径
- `anomaly` 仍近似复用：
  - 运行时仍直接走普通 `rollEvent()` 路径
  - 内容定义层没有显式的 anomaly 内容池语义

### 本轮实际落地
- boss 承载边界：
  - `BattleTemplateId` 新增：
    - `boss-hunt`
    - `boss-lockdown`
    - `boss-bastion`
  - `battleTemplates` 为以上模板新增显式 `encounterType: 'boss'`
  - 最终节点 blueprint 改为只从 Boss 模板池抽取，不再直接使用普通 elite-family 模板 ID
  - `RunEngine` 进入战斗时会优先读取模板级 `encounterType`，Boss HUD 标签与埋点继续保持一致
- anomaly 承载边界：
  - `EventDefinition` 新增轻量元数据 `contentKind?: 'event' | 'anomaly'`
  - redirect / reroute / rare 黑匣一类异常内容改为显式 `contentKind: 'anomaly'`
  - `rollEventDefinition(state, contentKind)` 现在支持按内容语义分流
  - anomaly 节点改为只从 anomaly 内容池抽取，而不是继续无差别复用整个 `EVENT_CATALOG`
  - 事件面板标题改为 `异常 · ...`，把玩家可见语义也一并对齐
- 埋点补充：
  - `battle_template_entered.payload.encounterType`
  - `event_selected.payload.contentKind`
  - 继续保留已有 `nodeType / finalNodeType`

### 本轮仍保留的近似实现
- Boss 仍复用现有 elite 风格胜利条件与大部分战斗机制，本轮只切开模板承载边界，没有继续做独立 Boss 系统。
- anomaly 仍复用现有事件面板与效果结算流，本轮只切开内容池与选择路径，没有继续做独立 anomaly 子系统。
- 生存关最后 `10s` 的显式增压规则仍未拆成独立公式段。

### 验证
- `npm run build` 通过。
- 浏览器实跑验证：
  - 异常面板已显示 `异常 · 高压试飞`
  - 多局保守样本中，`event_selected.payload.contentKind = anomaly` 已实际出现
  - Boss 实跑样本中，`battle_template_entered` 已记录：
    - `templateId = boss-hunt`
    - `nodeType = boss`
    - `encounterType = boss`
  - `run_finished.payload.finalNodeType = boss` 已在胜利样本中导出
  - 结果页重开后，`replay` 已再次确认可进入下一局

### 本轮结论
- `boss / anomaly` 已从“文档语义 + 节点语义”推进到“最小承载边界已实现”。
- 当前项目已基本完成恢复尾段的结构收口；后续若进入 0.9v 开发，可以沿 Boss 模板池和 anomaly 内容池继续补内容，而不必再回到旧 `elite/event` 口径上扩写。

## [0.9v 第一轮 / Round 19] boss / anomaly 首批专属内容扩写
### 来源口径
- 本轮以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为最高优先级口径。
- 当前阶段已从“恢复旧结构”切到 `0.9v 内容与可玩性开发`；本轮目标不是泛补普通内容，而是沿 `boss / anomaly` 新载体补第一批专属内容并稳住边界。

### 改动前盘点结论
- `boss` 语义已经在节点、模板池、埋点里切开，但实际内容入口还偏薄：
  - 最终节点仍会被统一显示成泛 `最终 Boss`
  - 容易让具体 Boss 模板重新退回成“只是更强的 elite 变体”
- `anomaly` 语义已经在节点、selector、UI、埋点里切开，但专属内容感还不够稳：
  - 异常节点蓝图标题仍偏泛
  - anomaly 仍容易被理解成“event 里的特殊分支”
- 因此本轮切入点确定为：
  - 先让 Boss 以具体 Boss 节点内容进入流程
  - 再给 anomaly 补第一批只沿 anomaly lane 扩写的节点 / 事件内容

### 本轮实际修改
- Boss 专属内容：
  - 最终节点从单一 `final-boss` 泛蓝图，改为三条具体 Boss 蓝图：
    - `追猎主核`
    - `锁域主核`
    - `屏卫主核`
  - Boss HUD 标签、进入提示、结果页收尾节点现在都会沿具体 Boss 名称显示，不再被统一抹平成一个泛 Boss 标题。
- anomaly 专属内容：
  - 新增 anomaly 专属事件：
    - `相位裂缝`
    - `载体失真`
    - `Boss 阴影扫描`
  - 新增 anomaly 节点蓝图：
    - mid：`相位裂缝`
    - late：`Boss 阴影`
  - anomaly selector 侧补了显式 anomaly catalog，后续异常内容继续沿 anomaly lane 扩写，不再依赖合并事件池上的临时过滤。
- 轻量流程 / 埋点跟进：
  - `RunEngine` 的 Boss 战标签改为优先显示具体 Boss 节点名。
  - `battle.label`、进入提示、战斗完成提示继续沿具体 Boss 节点名工作。
  - anomaly 新事件 `phase-splitter / carrier-breach` 也接入了现有 hybrid 统计判定。

### 仍刻意保留的复用
- Boss 仍复用 battle 结算和大部分既有承压规则。
- anomaly 仍复用 event 面板和 effect 结算。
- 本轮重点是“内容站位正确”，不是扩写新的 Boss / anomaly 子系统。

### 验证
- `npm run build` 通过。
- 浏览器实跑通过：
  - 已实测出现 anomaly 专属事件 `相位裂缝` 与 `Boss 阴影扫描`
  - 已实测出现具体 Boss 节点 `锁域主核`
  - 已实测跑通 `开始 -> anomaly -> boss -> 结算 -> replay`
  - `battle_template_entered.payload.encounterType = boss`
  - `run_finished.payload.finalNodeType = boss`
  - `event_selected.payload.contentKind = anomaly`
- 无新增浏览器 console error。

### 本轮结论
- `boss / anomaly` 不再只是“结构边界已切开”，而是已经开始承接第一批真正站在新载体上的 0.9v 内容。
- 之后继续做 0.9v 内容扩写时，应优先沿这些新载体继续补内容，而不是重新回到旧 `elite / event` 语义。

## [0.9v 早期 / Round 20] 战斗层 0.9 化起步 + Boss/anomaly 边界固化
### 来源口径
- 本轮继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为最高优先级口径。
- 当用户提示里的“可能仍未落地”与当前代码不一致时，以实际代码审计结果为准：
  - `boss / anomaly` 载体已经存在。
  - 四类基础敌人 archetype 也已经存在。
- 因此本轮切入点不是重复补语义骨架，而是补 0.9v 战斗读数与边界稳定性。

### 改动前盘点结论
- 已符合：
  - `NodeType` 已是 `battle / upgrade / anomaly / boss`。
  - `standard / brute / skirmisher / ranged` 已进入数据层与运行层。
  - `regular / escort / elite` 已是职责层语义，不再承担基础敌种分类。
  - `boss / anomaly` 已有独立 node / template / content lane 与既有埋点口径。
- 仍偏弱的点：
  - battle HUD 仍主要显示模板名，玩家需要靠经验自己读出“这关到底是什么敌群压力”。
  - 模板之间虽然已经接入不同 archetype 权重，但 ownership 还不够强，容易再次被理解成“参数不同的同类战斗”。
  - 结果页虽已能记录 `finalNodeType`，但视觉上还没有把 `Boss · 节点名` 明确压实到收尾标签里。
  - 远程怪虽然已存在，但缺少更直接的屏幕提示来帮助玩家快速读出其威胁。
- 本轮切入点确定为：
  - 用现有模板字段直接生成战斗读数，不引入新系统。
  - 进一步拉开模板对四类敌人的归属感。
  - 在 HUD / 结果页 / 实跑验证中继续稳住 `boss / anomaly` 新边界。

### 本轮实际修改
- battle template：
  - 进一步调整 `regularArchetypes / escortArchetypes` 权重，让不同模板更像自己的模板，而不是轻微参数偏移。
  - 重点强化了：
    - `elimination-pincer` 的 `skirmisher` 侧压感
    - `elimination-sweep / survival-gauntlet` 的 `brute` 推进感
    - `elite-screen / survival-crossfire / boss-bastion` 的 `ranged` 火线与遮线感
    - `elite-lockdown / boss-lockdown` 的 `skirmisher + escort` 封位感
    - `boss-hunt` 的 `brute + frontline` 正面顶压感
- 模板读数：
  - 在 `battleTemplates` 中新增轻量 helper，从现有 `regularArchetypes / escortArchetypes / spawnRule / eliteRule.behavior` 直接推导：
    - `普通战 / 精英战 / 生存战 / Boss载体`
    - `敌群 / 节奏 / 护卫 / 主核` 摘要
  - 这层表达没有引入新系统，只是把已有模板语义真正显示出来。
- HUD / 结果页：
  - 局内 HUD 顶部现在会显示 `encounter label + battle label`。
  - 局内 HUD 同时会显示模板读数摘要，帮助玩家直接读出当前敌群组合。
  - 结果页收尾 pill 现在会显示 `节点类型 + 节点标题`，例如 `Boss · 锁域主核`。
- 战斗可见差异：
  - 敌方弹道新增拖尾。
  - `ranged` 敌人新增外圈和即将开火时的瞄线提示。
  - `brute` 与 `skirmisher` 的屏幕标记进一步加强，帮助快速识别厚体与高速单位。

### 本轮未做的深改
- 没有重写 RunEngine。
- 没有把 Boss 扩成独立机制树。
- 没有把 anomaly 扩成独立事件子系统。
- 没有重做整套敌人 AI。
- 原因：
  - 当前主问题是读数不足，不是底层载体缺失。
  - 这轮最合理的是把现有数据真正“读出来”，而不是再次扩大系统面。

### 验证
- `npm run build` 通过。
- 浏览器实跑通过，且无新增 console error：
  - 菜单 -> battle -> anomaly -> final prep -> boss -> result -> replay 全链路通过。
  - anomaly 面板已实测出现。
  - Boss 节点已实测出现 `锁域主核`。
  - Boss 战 HUD 已出现 `Boss载体` 前缀和模板读数摘要。
  - 结果页已显示 `收尾节点 Boss · 锁域主核`。
  - 导出指标继续保留：
    - `battle_template_entered.payload.encounterType = boss`
    - `battle_template_entered.payload.nodeType = boss`
    - `event_selected.payload.contentKind = anomaly`
    - `run_finished.payload.finalNodeType = boss`
- 本轮没有新增 metrics 字段；继续复用现有结构即可完成边界验证。

### 当前最大风险
- 四类基础敌人已经进入模板读数与最小可见层，但“行为辨识度”仍主要依赖轻量移动规则与视觉标记。
- 如果后续 0.9v 常规开发继续大量补 battle 内容，却不持续维护 archetype ownership 与 HUD/结果页口径，Boss 与四类敌人的读数仍可能再次被稀释回“旧 battle / elite 近似”。

## [0.9v 常规开发 / Round 21] 升级池修正、异常独立池与战斗读数补强
### 来源口径
- 本轮继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为最高优先级口径。
- 当前阶段保持为 `0.9v 常规开发`，不回退到恢复骨架，也不转向泛补普通内容。

### 改动前盘点结论
- 普通升级三选一仍沿用了更偏路线承诺的 selector 思路，实跑里可能出现 `3 / 3` 都是路线强化的面板，读数会被流派 buff 抢走。
- anomaly 虽然已有独立载体，但路线选项仍内联在 `events.ts` 中，后续继续扩写时容易再次混回普通升级/普通事件口径。
- 顶部 HUD 与战斗中 toast 视觉重量偏大，容易遮挡战斗区；玩家可见面板也仍有机会通过原始描述字段露出内部设计语气。
- Boss / elite 过于容易被 burst 秒杀，主要是模板压力与抗爆发承接不足，而不是单纯缺内容。

### 本轮实际修改
- 普通升级池：
  - `levelUp` 现在使用独立发牌逻辑，不再复用 `nodePrep` 的路线倾斜发牌。
  - 结构固定为 `2 个通用槽 + 1 个弹性槽`，因此普通升级三选一里最多只会出现 `1` 个路线强化。
  - 通用槽优先从 `generic stabilizer / bridge` 主池发牌；路线槽只走 lower-weight route window，流派 buff 出现率明确低于一般属性强化。
- anomaly 独立池：
  - 新增 `src/data/anomalyRoutePools.ts`，把 anomaly 专属路线选项从 `events.ts` 中拆出。
  - `risky-protocol / relay-splice / route-handoff / *-reroute-window / cross-branch-signal` 现在统一从 anomaly route pool 取路线项。
  - 普通升级池不再接触 anomaly route 项，anomaly 路线内容的 ownership 继续留在 anomaly lane。
- 玩家可见文本：
  - 节点面板、副标题、事件面板说明、异常面板说明、升级说明改为面向玩家的功能性文案。
  - 节点卡与异常选项不再直出原始 blueprint / event 描述，改用基于内容效果生成的简洁说明。
  - 补清了几条仍留在数据层的旧设计语气描述，避免之后从别的入口重新泄露。
- HUD / 战斗提示：
  - 顶部 HUD 压成更轻的 top rail，保留 `战况 / 等级经验 / HP / 阶段节点 / 路线读数`。
  - 战斗中、升级中、事件中、节点选择中不再弹出普通 toast；进入战斗时会主动清掉旧 toast。
  - 升级面板、节点面板、异常面板卡片尺寸与间距同步缩小，减少遮挡。
- 战斗读色：
  - 经验球改为绿色表现。
  - 敌方投射物改为红色表现，并补了更清楚的拖尾。
- Boss / elite 强度：
  - 模板参数上调了 `enemyHp / enemyDamage / pressureMultiplier / regularEnemyCap / eliteRule.hpMultiplier` 等关键压力参数。
  - 同时补入最小抗 burst 机制：`guardSec + guardDamageMultiplier`。
  - 精英 / Boss 入场后的短时间内会削减所受子弹伤害，避免继续被瞬秒，但仍复用现有 battle 胜利条件与主流程。

### 数据结构变更
- `BattleTemplateDefinition.eliteRule` 新增：
  - `guardSec?: number`
  - `guardDamageMultiplier?: number`
- `EnemyState` 新增：
  - `guardSec: number`
- 新增 anomaly 路线内容承载文件：
  - `src/data/anomalyRoutePools.ts`
- 本轮没有新增 metrics 字段，继续复用现有导出口径。

### 验证
- `npm run build` 通过。
- selector 抽样验证通过：
  - 普通 `levelUp` 的 `maxRoute = 1`
  - 代表性状态下 `avgRoute` 约为 `0.10 ~ 0.24`
  - `avgGeneric` 约为 `2.76 ~ 2.90`
- anomaly route pool 抽样验证通过：
  - anomaly 路线选项来自独立 anomaly pool
  - 抽样命中 `18` 个 route option id
- 浏览器与截图验证通过：
  - HUD 明显缩小，不再大面积遮挡战斗区
  - 升级面板已观测到 `2 通用 + 1 路线` 的典型发牌
  - anomaly 面板改为玩家向说明，不再直出设计语气
  - 经验球已为绿色，敌方子弹已为红色
- 战斗提示验证通过：
  - sampled combat 中 `maxToast = 0`，战斗态不再堆提示横幅
- 压力快照验证通过：
  - `elite` guarded burst effective hp 约 `1062`
  - `boss-hunt / boss-lockdown / boss-bastion` guarded burst effective hp 约 `3447 ~ 3950`
  - 本轮采用的是“公式 / 模板参数调整 + 最小机制”组合，而不是单纯堆血

### 当前风险
- 普通升级池现在更干净，但 route 窗口也明显更克制；后续要继续观察自然跑局里路线信号是否仍然足够清楚。
- Boss / elite 的 guard 只是轻量抗 burst 承接，不是完整阶段机制；如果后续继续推高玩家 burst，上层压力表达还需要再补一层更明确的阶段读数。

## [0.9v 读数 / 压力校准] Boss phase 专属压力签名落地
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是 `Boss phase 专属压力签名落地 + final battle 身份进一步稳定`，不是重写系统，也不是继续靠堆血修 Boss。

### 盘点结论
- 当前 Boss 的 `pressurePhases` 已经存在，`behaviorOverride` 也已经落到了运行层，因此“有没有 phase”“phase 是否有行为身份”都不再是主问题。
- 剩余的真实缺口是：
  - phase 之间虽然已有行为身份，但仍主要建立在旧 `frontline / screened / kiting / summoner` 行为谱系的变体上。
  - 玩家能感觉到在转段，但还不容易用一句话说出“这一段到底在干什么”。
  - 如果后续 burst 与机动继续上涨，`boss-lockdown / 封位`、`boss-bastion / 交火`、`boss-hunt / 逼近` 这几段最容易再次失真回“更厚的 elite”。
- 本轮确定的最小切入点是：
  - 给 `pressurePhases` 增加一层轻量 signature carrier
  - 复用现有护卫刷新与敌方投射物系统兑现短时 signature
  - 同步补最小 HUD / metrics 观测，验证 signature 是否真的成立

### 本轮实现
- `src/game/types.ts`
  - `BattlePressurePhaseDefinition` 新增：
    - `signatureLabel`
    - `signatureDurationSec`
    - `signaturePulseIntervalSec`
    - `signatureEscortBurst`
    - `signatureVolleyCount`
  - `BattleState` 新增：
    - `pressureSignatureLabel`
    - `pressureSignatureSec`
    - `pressureSignaturePulseSec`
- `src/data/battleTemplates.ts`
  - 为 Boss phase 补入第一批专属 pressure signature：
    - `boss-hunt / close-in -> 逼近压线`
    - `boss-lockdown / pin-down -> 护卫封位`
    - `boss-bastion / crossfire -> 火线齐射`
  - `getBattleEnemyReadout(...)` 现在会在 signature 激活时补上 `压迫 {signatureLabel}`。
- `src/systems/RunEngine.ts`
  - 新增 `activatePressureSignature(...) / updatePressureSignature(...) / firePressureVolley(...)`。
  - phase 进入后会开启短时 signature window，并按 `signaturePulseIntervalSec` 脉冲兑现：
    - 护卫 burst
    - 或齐射 volley
  - 远程怪与齐射当前共用现有敌方投射物生成逻辑，没有引入新的弹幕系统。
- `src/systems/MetricsTracker.ts`
  - 新增：
    - `recordBossPhaseEntered(...)`
    - `recordBossPhaseDuration(...)`
    - `recordBossSignatureSeen(...)`
- `src/scenes/GameScene.ts`
  - Boss signature 激活时，主核会出现一层轻量外圈。
  - HUD 子读数会同步显示当前 signature，帮助玩家在不增加大 UI 遮挡的前提下确认 phase 已进入专属压力段。

### 验证
- `npm run build` 通过。
- 本地抽样脚本验证通过：
  - `boss-hunt` 已命中 `逼近压线`
  - `boss-lockdown` 已命中 `护卫封位`
  - `boss-bastion` 已命中 `火线齐射`
  - 三个 Boss 都已实际记录：
    - `boss_phase_entered`
    - `boss_phase_duration`
    - `boss_signature_seen`
- 浏览器全链路验证通过：
  - `开始 -> 节点推进 -> anomaly -> boss -> 结算 -> replay` 可跑通
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `battleHudSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - 导出指标继续保留：
    - `run_finished.payload.finalNodeType = boss`

### 当前风险
- Boss phase 的 signature 已经成立，但当前仍建立在：
  - 现有护卫刷新
  - 现有敌方投射物
  - 现有行为谱系
  之上，不是独立 Boss pattern 系统。
- 如果后续玩家 burst 与机动继续上涨，下一轮更可能需要补“phase 内空间压迫 / 节奏模式”的更强签名，而不是继续沿旧行为谱系微调参数。

## [0.9v 读数 / 压力校准] Boss phase 内空间压迫 / 节奏模式强化
### 本轮口径
- 若文档与代码冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准。
- 当前项目仍处于 `0.9v` 的“读数 / 压力校准阶段”；本轮目标是 `Boss phase 内空间压迫 / 节奏模式强化`，不是重写系统，也不是继续堆血。

### 盘点结论
- 当前 Boss phase 的主要压力来源分别是：
  - `boss-hunt`
    - `接敌`：frontline 顶压 + brute 主群 + guard
    - `逼近`：screened + preferredDistance 收紧 + 护卫脉冲
    - `收束`：frontline + 更快刷怪 + 更高 escort cap
  - `boss-lockdown`
    - `接敌`：kiting + skirmisher/ranged 牵制
    - `封位`：screened + escort 批次提升 + ranged 射速收紧
    - `锁场`：frontline + 更快 spawn + 更高远程压迫
  - `boss-bastion`
    - `接敌`：screened + ranged/escort 火线
    - `交火`：summoner + escort 增量 + ranged 射速提升
    - `火线收束`：kiting + 更高 projectile speed + 更快射击
- 当前最薄弱的点是：
  - phase 身份已经存在，但 phase 内持续模式还不够稳。
  - `boss-hunt / 逼近`、`boss-lockdown / 封位`、`boss-bastion / 交火` 之前仍主要靠：
    - 护卫刷新
    - 敌方弹道
    - 旧行为谱系变体
    - 参数加压
    叠出来，而不是一个玩家能稳定读出的压迫模式。
- 本轮确定的切入点是：
  - 保留已有 `signature window` 做切段确认
  - 再给 `pressurePhases` 增加持续型 `pattern pulse`
  - 用边缘来波 / 交叉齐射把 phase 内模式做实

### 本轮实现
- `src/game/types.ts`
  - `BattlePressurePhaseDefinition` 新增：
    - `patternLabel`
    - `patternMode`
    - `patternPulseIntervalSec`
    - `patternEscortBurst`
    - `patternEscortArchetype`
    - `patternVolleyCount`
    - `patternVolleySpreadRad`
    - `patternVolleyShotsPerShooter`
  - `BattleState` 新增：
    - `pressurePatternLabel`
    - `pressurePatternMode`
    - `pressurePatternPulseSec`
    - `pressurePatternFlashSec`
- `src/data/battleTemplates.ts`
  - 为三套 Boss 补入持续型 pattern：
    - `boss-hunt / close-in -> 纵压驱进(laneCrush)`
    - `boss-lockdown / pin-down -> 侧翼夹封(sideClamp)`
    - `boss-bastion / crossfire -> 交叉火线(crossfireWave)`
  - HUD 子读数会额外显示 `模式 {patternLabel}`。
- `src/systems/RunEngine.ts`
  - 新增 `activatePressurePattern(...) / updatePressurePattern(...) / executePressurePattern(...)`。
  - `laneCrush / sideClamp` 会从 arena 边缘补入定向 escort 波。
  - `crossfireWave` 会按固定周期触发 spread volley。
  - `signature` 继续负责 phase enter 的短时确认；`pattern` 负责 phase 内持续模式。
- `src/scenes/GameScene.ts`
  - 新增轻量 pattern overlay：
    - `sideClamp`：侧边压迫条
    - `laneCrush`：上下压迫条
    - `crossfireWave`：交叉火线提示
  - Boss 主核在 pattern pulse 时会出现额外外圈闪动，帮助确认节奏波到来。
- `src/systems/MetricsTracker.ts`
  - 新增：
    - `recordBossPhasePatternSeen(...)`
    - `recordBossPhasePatternDuration(...)`

### 验证
- `npm run build` 通过。
- 本地 `tsx` pattern 抽样确认：
  - `boss-hunt / 逼近 / 纵压驱进`
    - `escortGain = 2`
    - `pulseCount = 3`
  - `boss-lockdown / 封位 / 侧翼夹封`
    - `escortGain = 4`
    - `pulseCount = 2`
  - `boss-bastion / 交火 / 交叉火线`
    - `projectileGain = 10`
    - `pulseCount = 3`
- 浏览器全链路验证通过：
  - `开始 -> 节点推进 -> anomaly -> boss -> 结算 -> replay` 可跑通
  - `anomalyPanelSeen = true`
  - `bossNodeSeen = true`
  - `bossBattleSeen = true`
  - `battleHudSeen = true`
  - `replayStarted = true`
  - `consoleErrors = []`
  - 导出 summary 中已能看到：
    - `boss_phase_pattern_duration`
    - `run_finished.payload.finalNodeType = boss`

### 当前风险
- Boss phase 内模式已经比上轮稳定，但当前仍主要复用：
  - 护卫刷新
  - 敌方投射物
  - 既有行为谱系
- 如果后续玩家 burst 与机动继续上涨，下一步更可能需要补的是更明确的场地安全区/危险区雕刻，而不是继续加血或加护卫数量。
## [2026-04-08 / 0.9v 封版检查] HUD / 流程 / 难度曲线阻断项修复
### 本轮口径
- 若文档与代码、旧阶段记录与当前任务冲突，继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md + 本轮最新用户口径` 为准。
- 本轮不扩内容、不重做系统，目标是修掉封版前直接影响验收体验的阻断项。

### 盘点结论
- HUD 主问题不是缺字段，而是信息组织松散：
  - 顶部空白过大
  - HP / XP 仍偏文本读数
  - 当前在干什么、离 Boss 还有多远、当前目标是什么，没有被压成一眼能懂的结构
- 流程主问题不是主循环断裂，而是推进感表达不够直观：
  - 开局读数容易像“还没开始”
  - 节点推进容易被读成“点完几下就直接进 Boss”
  - Boss 临近感与最终整备的承接还不够像验收版
- 难度曲线主问题是：
  - opening / late 普通 battle 压力偏低
  - Boss 开场的护卫 / 刷怪 / 起手承压抬得过急
  - `boss-bastion` 普通 build 容易死在远程后段前半，导致 `fireline` 样本偏少
- Boss 认知主问题是：
  - 玩家不一定第一时间知道当前目标是什么
  - 不一定知道场上哪个单位才是 Boss

### 本轮修改
- HUD / 面板
  - `OverlayHudSnapshot` 扩成更完整的 HUD 快照，补上 HP/XP 比例、流程标签、阶段轨、目标卡等字段。
  - `OverlayController.showHud(...)` 重排为：
    - 状态栏
    - HP / XP 数字 + 进度条
    - 流程进度卡
    - 当前目标卡
    - 路线状态条
  - 节点 / 强化 / 异常面板统一接入流程进度块，减少“只是继续点一下”的临时感。
- 流程可理解性
  - 开局流程读数改为从 `推进 1 / 5` 开始，不再出现 `推进 0 / 5`。
  - 流程文案改成直接告诉玩家“离 Boss 还剩几站”或“再推进 1 站就进 Boss”。
  - 最终整备与最终战节点描述继续强调“下一步会直接进入 Boss / 本局结算由这一战决定”。
- Boss 身份 / 目标
  - Boss 战目标卡明确写出：
    - `Boss 目标`
    - `击败场上首领`
    - `盯住场上的大体型首领与金色血条，击破即可过关`
  - Boss 本体在战场内增加更显眼的金色血条与箭头标记。
  - Boss 战状态副标题补充“金色血条与箭头标记就是 Boss”这一层说明。
- 难度曲线
  - opening 普通战模板：
    - `elimination / elimination-pincer / elimination-sweep`
    - 温和上调基础压力，主要通过刷新节奏、敌群容量与 pressureMultiplier 微调完成。
  - late 普通战模板：
    - `survival / survival-rush / survival-gauntlet`
    - 温和上调持续压力，避免后段仍像无战感过渡。
  - Boss 开场：
    - `boss-hunt / boss-lockdown / boss-bastion`
    - 轻量回收开场 regular cap、escort batch / max、guard 时长与伤害倍率
    - 起手仍保留 Boss 身份，但不再那么断崖式压上来
  - `boss-bastion`
    - 轻量前移 `crossfire / fireline` 的触发窗口
    - 目的是让普通 build 更常活到并读到远程后段，而不是靠堆血拖时长
- 数据驱动边界
  - 所有调整继续落在 `template / node / HUD snapshot` 层，没有改主流程，也没有重写 `RunEngine` 主结构。

### 验证
- 构建
  - `npm run build` 通过。
- Playwright / 浏览器回归
  - 使用干净预览端口 `http://127.0.0.1:4174` 复检，避免旧预览进程缓存旧构建。
  - 开局 HUD 读数确认：
    - `推进 1 / 5 · 离 Boss 还剩 4 站`
    - `耐久 110 / 110`
    - `等级 Lv.1 0 / 29`
    - `当前目标：击破敌群`
  - 全链路 smoke：
    - `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 可跑通
    - `consoleErrors = []`
    - 结果页已显示更完整的收尾信息与 replay 入口
- `boss-bastion / fireline` 自然样本复检
  - `normal`
    - `bossBastionRuns = 10`
    - `crossfireSeenRuns = 7`
    - `firelineSeenRuns = 2`
    - 普通样本里的 `fireline` 自然覆盖率较上一轮有抬升
  - `highBurst`
    - `bossBastionRuns = 2`
    - `firelineSeenRuns = 1`
  - `highMobility`
    - `bossBastionRuns = 5`
    - `firelineSeenRuns = 5`
  - 说明本轮“缓 Boss 开场 + 轻量前移远程后段”没有把高机动样本打坏，也让普通样本更容易碰到远程收束段。

### 本轮结论
- 项目仍处于 `0.9v 封版检查阶段`，但这轮已经把最影响验收体验的一批阻断项往“清楚、顺、能懂、能验证”推进了一大步。
- 当前残余最大风险继续收敛在：
  - 普通 build 下 `boss-bastion / fireline` 仍不是高频样本
  - 最终关远程后段仍需继续监控，避免重新掉回“前段成立、收束偏薄”
