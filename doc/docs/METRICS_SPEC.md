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

## 节点与模板数据
- node_selected
- battle_template_entered
- battle_template_completed
- event_selected
- upgrade_selected

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
- `route_hint_time` 现按“每条路线在当前 run 首次出现倾向”记录一次，避免同一路线重复记时
