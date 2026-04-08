# 1.0 内容扩写路线图
> 若与旧阶段文档冲突，以最新用户 brief、[FREEZE_SIGNOFF_0_9V.md](./FREEZE_SIGNOFF_0_9V.md)、[DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 与最新 [DEV_ISSUE_LOG.md](./DEV_ISSUE_LOG.md) 为准。

## 阶段基线
- `0.9v` 已进入可封版状态，并作为 `1.0` 的冻结底座保留。
- `1.0` 第一轮的目标不是重做系统，而是在现有稳定骨架上增加内容密度、差异化体验与 replay 动机。
- 当前仍需持续监控的残余风险只有一类：
  - 普通 build 下 `boss-bastion / fireline` 仍然是低频样本
  - 该问题属于后续观察项，不作为本轮主线

## 第一轮优先级
1. anomaly 深度
2. battle template 家族扩写
3. nodes / upgrades / 事件 / Boss 内容第一批补量
4. replay 动机增强
5. 维持 `0.9v freeze` 基线不回退

## 第一轮实现原则
- 不改主流程
- 不重写 `RunEngine`
- 不引入新系统
- 优先通过现有 `template / rule / selector / family / blueprint / nodes / upgrades` 数据结构扩写
- 不把本轮重新做成 Boss pocket / fireline 专项优化轮
- 不让 `Boss / anomaly / template ownership` 回退

## 第一轮已落地内容
### anomaly
- 新增：
  - `冷启偏折`
  - `裂谱合拍`
  - `屏卫预读`
  - `首领残响`
- 调整方向：
  - 降低 opening / mid 对 `routeWindow` 的依赖
  - 提高 `distortion / hybrid / bossEcho` 在 mid / late / finalPrep 的存在感

### battle template
- 新增：
  - `elimination-crossline / 火线歼灭`
  - `elite-bulwark / 壁垒压制`
  - `survival-sieve / 筛火求生`
- 目标：
  - opening 更早读到远程火线
  - mid 更明确读到拆屏护卫
  - late 更明确读到漏火线与回线求生

### nodes / upgrades / replay
- 新增节点载体：
  - `火线试压`
  - `冷启裂口`
  - `壁垒拆解`
  - `欠账裂纹`
  - `筛火求生`
  - `首领残响`
  - `Boss 预整备`
- 新增升级批次：
  - 通用桥接：`视界缓存`、`终端护幕`
  - 暴击：`灼迹导火`、`余烬爆点`
  - 穿透：`切层折返`、`裂面回响`
  - 穿梭：`相位蓄返`、`回切留影`
- replay 动机强化：
  - 当一局 anomaly 暴露过少时，result prompt 会直接提醒玩家去看另一类低频内容

## 后续建议
- 继续加厚 anomaly 的高记忆点内容，特别是 `bossEcho` 与更复杂的低频代价/收益结构
- 继续扩 battle template 家族变体，让前段 / 中段 / 后段拥有更厚的自然样本池
- 继续补第二批 nodes / upgrades / Boss 内容，但保持数据驱动与 ownership 边界
- 继续做轻量回归，确认 HUD / 文案 / 音效 / result / replay 不因为扩内容而回退

## 监控项
- 普通 build 下 `boss-bastion / fireline` 的自然覆盖率
- 最终关远程后段是否重新出现“前段成立、收束偏薄”的迹象
- anomaly 是否会因为后续 routeWindow 内容回涨而重新失去独立感
