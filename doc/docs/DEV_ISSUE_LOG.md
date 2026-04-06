# DEV ISSUE LOG
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
