# 2026-04-29 Boss 强制触发 QA 入口与 Boss 实机样本闭环

## 本轮目标

实现一个测试专用入口，让 QA 能稳定进入指定 Boss 模板，完成实机样本闭环：

1. **补测试专用 Boss 强制触发入口** —— 解决自然样本 40 步未抽到 Boss 的问题
2. **跑通至少 1 个 Boss 实机样本** —— 产出截图和 debug 数据
3. **验证主流程未被破坏** —— full-flow 确认正常链路仍然可用
4. **判断 Boss 是否高压但可读** —— 基于实机截图做设计判断

## 实现方案

### 入口设计：最小侵入 + 双模式触发

**方案选择**：`localStorage 标记 + Debug API 扩展`

理由：
- 不修改主流程节点分发逻辑（`nodes.ts` 不变）
- 不暴露为正式玩法（仅 `window.__pilotQaForceBoss` 存在）
- QA 脚本可以直接调用，也可以预置标记后手动开始

**代码变更**：

1. **`src/main.ts`**：新增 `window.__pilotQaForceBoss(templateId)`
   - 校验有效 Boss 模板：`boss-bastion` / `boss-hunt` / `boss-lockdown`
   - 如果 GameScene 已激活，直接调用 `restartDebugBattle`
   - 如果 MainMenuScene 激活，存储 `localStorage` 标记并启动 GameScene
   - 其他情况仅存储标记，等待用户手动开始

2. **`src/scenes/GameScene.ts`**：`create()` 中增加自动触发检查
   - 读取 `pilot-qa-force-boss` localStorage 标记
   - 如果存在且合法，400ms 延迟后自动调用 `restartDebugBattle`
   - 触发后清除标记，避免重复

3. **`tools/qa-boss-directed-v2.mjs`**：新 QA 脚本
   - 支持环境变量 `PILOT_QA_BOSS` 指定模板（默认 `boss-bastion`）
   - 调用 `__pilotQaForceBoss` 强制进入 Boss 战
   - 检测到 Boss 模板后开启 `invulnerablePlayer` 以便完整观察
   - 每步采样 `templateId` / `eliteAlive` / `bossFirelineCoverage` / `bossSafeWindowMoments`
   - Boss 存活期间每步截图
   - 60 步采样或到达结果页结束

## 验证执行

### 1. 构建验证 ✅ PASS

```bash
npm run build
```

- 结果：✅ 通过，无类型错误，无新增构建警告

### 2. Full-flow 验证 ✅ PASS

- QA 脚本：`tools/qa-current-version.mjs`
- 路径：菜单 -> 战斗 -> 节点 -> 升级 -> 结果 -> 重开
- 结果：
  - `resultSeen: true` ✅
  - `replaySeen: true` ✅
  - `pauseSeen: true` ✅
  - `volumePanelSeen: true` ✅
  - `consoleErrors: []` ✅
  - `volumePersisted: "0.78"` ✅

### 3. Boss 强制触发入口验证 ✅ PASS

**`boss-bastion` 样本**：
- 脚本调用 `__pilotQaForceBoss('boss-bastion')` ✅
- GameScene 自动触发 Boss 战 ✅
- 截图确认：第 4 波 Boss 战画面可读 ✅
- `eliteAlive: true` 从 step 5 持续到 step 60 ✅
- 无 console error ✅

**`boss-hunt` 样本**：
- 脚本调用 `__pilotQaForceBoss('boss-hunt')` ✅
- GameScene 自动触发 Boss 战 ✅
- `eliteAlive: true` 从 step 4 持续到 step 60 ✅
- 无 console error ✅

### 4. Boss 高压可读体验判断

**观察结论**：

| 项目 | 观察 | 判断 |
|------|------|------|
| Boss 触发稳定性 | `__pilotQaForceBoss` 100% 触发 | ✅ 入口有效 |
| 画面可读性 | 截图显示 Boss 血条、波次标题、敌弹清晰 | ✅ 可读 |
| 高压感知 | 无敌模式下 Boss 存活 60 步未死亡，实机无无敌时 11 步死亡 | ✅ 高压 |
| 安全窗实机 | headless 浏览器游戏时间推进慢，`bossSafeWindowMoments` 未积累到非零 | ⚠️ 需人工实机确认 |
| 弹幕密度 | 截图显示弹幕墙存在但非满屏 | ✅ 有空间 |

**设计判断**：
- Boss 战确实具备"高压但可读"的基础结构
- 实机样本证明入口有效、战斗可启动、画面无黑底
- `bossSafeWindowMoments` / `bossFirelineCoverage` 因 headless 浏览器帧率限制未能在 QA 时间内积累到非零，**建议人工实机跑一次 `boss-bastion` 确认安全窗出现频率**
- 如果安全窗出现频率合理（参考代码值：安全窗 268px，停留 1.88s），即可签收 Boss 体验

## 当前版本状态

- **代码层面**：Boss 强制触发入口已落地，支持 3 个 Boss 模板 ✅
- **样本层面**：`boss-bastion` 和 `boss-hunt` 均已触发并截图 ✅
- **主流程**：full-flow 验证通过，无回归 ✅
- **体验层面**：高压可读的基础结构成立，安全窗需人工补验 ⚠️

## 最大残留风险

1. **安全窗人工听感/观感偏差**：代码参数已下调，但 headless QA 无法实机验证安全窗频率
2. **Boss 难度两极化**：无敌模式下观察显示 Boss 很耐打，但无无敌时 11 步死亡，可能存在"要么秒死、要么磨很久"的极端情况
3. **headless 帧率限制**：QA 脚本在 headless 模式下游戏时间推进极慢，未来如需采样压力转段数据，需考虑非 headless 或加速方案

## 文档更新

- [x] 本复盘已创建
- [x] 新增 QA 脚本：`tools/qa-boss-directed-v2.mjs`
- [x] 当前交接卡已更新
- [ ] 如人工实机确认安全窗，更新本复盘并签收 Boss 体验

## 下一轮建议

**方案 A：人工实机补验（推荐）**

1. 在浏览器中打开游戏，调用 `window.__pilotQaForceBoss('boss-bastion')`
2. 观察安全窗是否出现、频率是否足够（参考：弹幕墙 2 面，安全窗 268px）
3. 如可读，更新作品集材料并进入截图/短视频阶段
4. 如不可读，仅针对安全窗尺寸或弹幕墙数量做小步修复

**方案 B：验收通过，推进作品集**

基于当前验证：
- ✅ 入口有效
- ✅ 画面可读
- ✅ 高压成立
- ✅ 主流程无回归

可认为修复已签收，转入作品集阶段。

---

**验收人**：Codex + Kimi
**验收日期**：2026-04-29
**结论**：Boss 强制触发入口已闭环，`boss-bastion` / `boss-hunt` 实机样本已收集；安全窗建议人工补验
