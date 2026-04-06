# 测试版埋点规格

## 方案说明
- 当前版本采用本地最小方案，不接后端。
- 埋点写入浏览器 `localStorage`，键名为 `commercial_pilot_metrics_v1`。
- 页面内同时暴露 `window.__pilotMetrics` 与 `window.__exportPilotMetrics()`，便于测试时直接导出 JSON。

## 漏斗埋点
- session_start
- click_start_game
- first_run_start
- first_run_end
- restart_after_first_run
- second_run_start

## 单局过程数据
- first_upgrade_time
- first_route_hint_time
- route_hint_time
- route_lock_time
- build_mature_time
- death_time
- run_duration
- first_commit_stage
- first_commit_pick
- branch_switch_count
- rareSeenCount
- hybridPickCount
- latePayoffSeenCount

## 节点与模板数据
- node_selected
- battle_template_entered
- battle_template_completed
- event_selected
- upgrade_selected
- branch_switch
- `battle_template_entered / battle_template_completed / event_selected / upgrade_selected`
- 当命中的内容属于低频 rare 层时，payload 现会附带 `contentTier: rare`

## 流派数据
- route_committed
- route_matured
- crit_selected_count
- pierce_selected_count
- dash_selected_count

## 导出方式（已确认接入）
- `window.__pilotMetrics`
- `window.__exportPilotMetrics()`
- `localStorage` key: `commercial_pilot_metrics_v1`

## 已知关键代码位置（来自最后一次项目状态）
### 最低限度音效主要文件
- `src/systems/PilotAudio.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/GameScene.ts`

### 埋点导出方式
- `window.__pilotMetrics`
- `window.__exportPilotMetrics()`
- `localStorage: commercial_pilot_metrics_v1`
## 重建阶段补充
- `death_time` 仅在 `hpDepleted` 时触发，不再覆盖所有 defeat
- 新增 `run_finished`
- 用于统一记录每一局的收束信息，字段包括：
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
- `firstCommitStage`
- `firstCommitPick`
- `branchSwitchCount`
- `rareSeenCount`
- `hybridPickCount`
- `latePayoffSeenCount`
- `route_hint_time` 现按“每条路线在当前 run 首次出现倾向”记录一次，避免同一路线重复记时
- `route_lock_time` 现会附带触发时的 `phase` 与 `pickId`
- `branch_switch` 用于记录 dominant route 在同一 run 内发生变化的时点与来源
- 低频 rare 内容不新增单独埋点事件，继续沿用现有 `battle_template_entered / event_selected / upgrade_selected`，并在 payload 中附带 `contentTier`
- 轻量补充的 replay 观测继续复用现有事件结构：
  - `rareSeenCount`：当前 run 内命中的 rare battle / rare event / rare upgrade 次数
  - `hybridPickCount`：当前 run 内命中的 hybrid / redirect 选择次数
  - `latePayoffSeenCount`：当前 run 内 late / final 阶段命中的 rare 或 payoff 兑现次数

## 2026-04-05 补充
- redirect 吸引力观测新增三个轻量字段，继续沿用当前 run summary 结构，不新建独立埋点系统：
  - `redirectOfferSeenCount`：当前 run 内出现过多少次真正的 off-route redirect 报价窗口
  - `redirectPickCount`：当前 run 内玩家实际拿了多少次 redirect 选项
  - `redirectPickStage`：当前 run 第一次 redirect pick 发生在哪个阶段
- 相关事件继续沿用现有事件流：
  - `redirect_offer_seen`
  - `redirect_pick`
- 2026-04-05 起，`branch_switch` 口径修正为：
  - 如果某次 pick 同时触发 dominant route 翻转与 matured，也必须记录为一次真实 branch switch
  - 仅当 run 在该次 pick 之前就已经 `matured`，才抑制后续 branch switch 计数
## 2026-04-05 Semantics Alignment Addendum
- `node_selected.payload.nodeType` 现在可能为：
  - `battle`
  - `upgrade`
  - `anomaly`
  - `boss`
- `battle_template_entered.payload.nodeType` 会记录该战斗来自普通 `battle` 还是最终 `boss` 节点。
- `battle_template_entered.payload.encounterType` 会继续记录模板承载语义是普通 `battle` 还是 `boss`，避免最终关重新退化成普通 elite 模板口径。
- `event_selected.payload.contentKind` 会记录本次事件内容来自普通 `event` 还是 `anomaly` 内容池。
- `run_finished.payload.finalNodeType` 会记录本局最终收束/失败时所在节点语义，避免只剩 `finalNodeTitle` 而丢失结构语义。

## 2026-04-05 0.9v Boss / Anomaly 内容解释补充
- 当前没有新增埋点字段，但已有字段的解释边界更明确了：
  - `battle_template_entered.payload.title` 现在会直接落成具体 Boss 节点名，例如 `锁域主核`、`屏卫主核`，不再只剩泛 final-boss 标题。
  - `event_selected.payload.contentKind = anomaly` 现在不仅表示“异常 lane 被命中”，也可能对应 anomaly 专属事件批次，例如 `相位裂缝`、`载体失真`、`Boss 阴影扫描`。
- 这轮仍复用现有 battle / event / run_finished 事件结构，没有新建 Boss 或 anomaly 专属埋点系统。

## 2026-04-06 Boss Phase Signature Observability Addendum
- 本轮在现有 metrics tracker 上补了三个轻量观测事件，不新建独立埋点系统：
  - `boss_phase_entered`
  - `boss_phase_duration`
  - `boss_signature_seen`

### 事件说明
- `boss_phase_entered`
  - 触发时机：Boss 进入一个新的 `pressurePhase`
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
- `boss_phase_duration`
  - 触发时机：
    - Boss 从当前 phase 切到下一段时
    - 或 Boss 战在当前 phase 结束时
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
    - `durationSec`
- `boss_signature_seen`
  - 触发时机：带 signature 的 Boss phase 被激活时
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
    - `signatureLabel`
    - `durationSec`

### 口径说明
- `boss_signature_seen.durationSec` 当前记录的是“本次 signature window 的配置时长 / 激活时长”，不是事后回算的真实屏幕停留时长。
- 这组观测只会在 `encounterType = boss` 时发出，elite 轻量 phase 不共享这组事件。
- 导出链路继续沿用：
  - `window.__pilotMetrics`
  - `window.__exportPilotMetrics()`
  - `localStorage: commercial_pilot_metrics_v1`

## 2026-04-06 Boss Phase Pattern Observability Addendum
- 本轮继续沿用现有 metrics tracker，补了两个低成本 pattern 观测事件：
  - `boss_phase_pattern_seen`
  - `boss_phase_pattern_duration`

### 事件说明
- `boss_phase_pattern_seen`
  - 触发时机：Boss 进入一个声明了 `patternLabel` 的 `pressurePhase`
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
    - `patternLabel`
- `boss_phase_pattern_duration`
  - 触发时机：
    - Boss 从当前 pattern phase 切到下一段时
    - 或 Boss 战在当前 pattern phase 内结束时
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
    - `patternLabel`
    - `durationSec`

### 为什么没有补 `boss_space_pressure_window`
- 当前每个 pattern pulse 都可能是低频重复事件；如果直接逐 pulse 落事件，导出噪音会明显上升。
- 本轮先保守保留：
  - `pattern seen`
  - `pattern duration`
  这两层等价观测，用来判断 phase 模式是否真正存在。

## 2026-04-06 Boss Safe Window Observability Addendum
- 本轮继续沿用现有 metrics tracker，只补了一条低成本安全窗观测：
  - `boss_safe_window_seen`

### 事件说明
- `boss_safe_window_seen`
  - 触发时机：Boss phase 第一次打开安全窗时
  - payload：
    - `templateId`
    - `phaseId`
    - `phaseLabel`
    - `patternLabel`
    - `axis`
    - `span`
    - `durationSec`

### 当前取舍
- 没有新增：
  - `boss_space_pattern_seen`
  - `boss_pressure_mode_duration`
- 原因是当前已有：
  - `boss_phase_pattern_seen`
  - `boss_phase_pattern_duration`
  已足够等价表达“空间模式已出现 / 持续了多久”。
- 本轮只额外补 `boss_safe_window_seen`，用于确认：
  - 某个 phase 是否真的进入了“安全窗 / 危险区雕刻”层
  - 而不是仍停留在纯护卫波或纯火线 pattern。
## 2026-04-06 远程 phase 观测补充
- 本轮没有新增独立的 `boss_remote_phase_seen / boss_safe_pocket_seen / boss_phase_escape_window_used` 事件族。
- 取舍原因：
  - 当前已有 `boss_phase_pattern_seen / boss_phase_pattern_duration`
  - 当前已有 `boss_safe_window_seen`
  - 这三层已经足够低成本地判断“远程 phase 是否出现”“空间口袋是否出现”“模式持续了多久”
  - 如果继续拆新事件族，容易把远程 pulse 观测做成高噪音埋点

### `boss_safe_window_seen`
- `payload.axis` 当前允许：
  - `vertical`
  - `horizontal`
  - `pocket`
- 当 `axis = pocket` 时，payload 允许附带：
  - `secondarySpan`
- 这意味着：
  - `boss-hunt / close-in` 与 `boss-lockdown / pin-down` 继续记录走廊型安全窗
  - `boss-bastion / crossfire` 现在会以 `axis = pocket` 记录远程空间口袋

### 等价观测口径
- `boss_phase_pattern_seen`
  - 等价回答“远程 Boss phase 是否真正进入了 pattern”
- `boss_phase_pattern_duration`
  - 等价回答“该远程 pattern 持续了多久”
- `boss_safe_window_seen(axis = pocket)`
  - 等价回答“远程空间口袋是否真的被打开”
- `boss_phase_escape_window_used`
  - 本轮继续不进正式埋点
  - 若需要判断玩家是否真的用了 pocket，优先继续采用 QA 样本脚本观察，而不是先把 action 级埋点塞进正式导出
