# 界面按键音效_开发GPT对接文档

## 文档目的

这份文档给开发 GPT 使用，用来说明当前项目里“所有界面、按钮、调试控件”的 UI 音效接线口径。

它不是新的音频总设计，也不要求重写 `PilotAudio`。本轮目标是：

- 让所有玩家可点击的正式界面按钮都有声音反馈。
- 让调试面板控件也有基础声音反馈，方便开发验证。
- 保持现有 `AudioCue` 语义，不为了 UI 按钮新增大量 cue。
- 让后续开发知道新增按钮时应该接什么声音。

## 当前实现原则

### 1. 不新开 UI 音频系统

当前继续使用：

- `services.audio.unlock()`
- `services.audio.play(cue)`
- `PilotAudio` 里的现有 cue profile

不要为了按钮音效新增单独的 DOM 音频播放器，也不要绕开 `services.audio`。

### 2. 按钮声音只表达“交互语义”

UI 按钮音效不负责替代玩法反馈。

推荐语义如下：

| 交互类型 | 推荐 cue | 含义 |
| --- | --- | --- |
| 普通点击、返回、切换、下拉、勾选 | `click` | 轻交互 |
| 选择下一节点、确认普通事件 | `confirm` | 决策生效 |
| 开始一局、再来一局 | `start` | 单局启动 |
| 升级奖励出现或确认升级 | `upgrade` | 奖励兑现 |
| 异常事件出现或确认异常选项 | `anomaly` | 异常语义 |
| 结果页进入 | `result` | 单局封口 |

### 3. 面板打开音和按钮确认音可以共存

当前项目里有两类 UI 声音：

- 面板出现时的提示音：
  - 节点选择面板：`click`
  - 升级面板：`upgrade` 或 `confirm`
  - 异常/事件面板：`anomaly` 或 `confirm`
- 玩家点击选项时的确认音：
  - 节点选项：`confirm`
  - 升级选项：`upgrade` 或 `confirm`
  - 异常选项：`anomaly`
  - 普通事件选项：`confirm`

这两者不要混成一类。面板出现告诉玩家“现在轮到选择了”，按钮确认告诉玩家“这个选择生效了”。

## 当前已覆盖的界面与按钮

### 开始页

文件：`src/scenes/MainMenuScene.ts`

| 按钮 | 当前 cue | 说明 |
| --- | --- | --- |
| `开始作战` | `start` | 解锁音频，开始单局 |
| `战斗记录` | `click` | 普通局外操作 |

### 局内节点选择

文件：`src/scenes/GameScene.ts`

| 事件 | 当前 cue | 说明 |
| --- | --- | --- |
| 节点选择面板出现 | `click` | 提醒进入选择状态 |
| 点击任一节点卡 | `confirm` | 当前节点选择生效 |

### 局内升级选择

文件：`src/scenes/GameScene.ts`

| 事件 | 当前 cue | 说明 |
| --- | --- | --- |
| 升级面板出现，来源为升级 | `upgrade` | 奖励出现 |
| 升级面板出现，来源为整备 | `confirm` | 阶段决策 |
| 点击任一升级卡，来源为升级 | `upgrade` | 升级选择生效 |
| 点击任一升级卡，来源为整备 | `confirm` | 整备选择生效 |

### 局内事件与异常选择

文件：`src/scenes/GameScene.ts`

| 事件 | 当前 cue | 说明 |
| --- | --- | --- |
| 普通事件面板出现 | `confirm` | 事件选择状态 |
| 异常事件面板出现 | `anomaly` | 异常接入 |
| 点击普通事件选项 | `confirm` | 普通事件选择生效 |
| 点击异常事件选项 | `anomaly` | 异常处理生效 |

### 结果页

文件：`src/scenes/ResultScene.ts`

| 按钮 / 事件 | 当前 cue | 说明 |
| --- | --- | --- |
| 结果页进入 | `result` | 单局封口 |
| `再来一局` | `start` | 新单局启动 |
| `返回机库` | `click` | 返回开始页 |

### 调试面板

文件：`src/ui/BattleDebugPanel.ts`

调试面板不是正式玩家界面，但它也是可交互 UI，所以本轮补了基础音效。

| 控件 | 当前 cue | 说明 |
| --- | --- | --- |
| `Time scale` 滑杆 | `click` | 带节流，避免拖动时过密 |
| 勾选框 | `click` | 普通配置切换 |
| 模板下拉 | `click` | 普通配置切换 |
| 阶段下拉 | `click` | 普通配置切换 |
| `Restart selected battle` | `confirm` | 调试战斗重启 |
| `F3` 开关调试面板 | `click` | 快捷键 UI 切换 |
| `F4` 暂停/恢复 | `click` | 快捷键 UI 切换 |

## 当前代码改动点

### `src/scenes/GameScene.ts`

当前负责三类 UI 音效：

1. 正式局内面板出现音。
2. 正式局内选项确认音。
3. 调试面板快捷键和调试控件声音转发。

新增或确认的关键点：

- `services.debugPanel.bind(...)` 里传入 `onUiSound`，由调试面板把 UI 声音请求转回 `services.audio.play(cue)`。
- 升级选项点击时补 `upgrade / confirm`。
- 事件选项点击时补 `anomaly / confirm`。
- `F3 / F4` 快捷键补 `click`。

### `src/ui/BattleDebugPanel.ts`

当前负责调试面板内部控件的 UI 声音请求。

新增或确认的关键点：

- `BattleDebugPanelBindings` 增加 `onUiSound?: (cue: AudioCue) => void`。
- 滑杆、勾选、下拉、重启按钮都会调用 `playUiSound(...)`。
- `playUiSound(...)` 内部带简单 cooldown，避免滑杆输入时连续刷太多 `click`。

## 新增按钮时的接线规则

后续如果开发 GPT 新增 UI 按钮，请按下面规则判断：

1. 如果是普通 UI 操作：
   - 使用 `click`
2. 如果会推进选择或进入下一步：
   - 使用 `confirm`
3. 如果会开始或重开一局：
   - 使用 `start`
4. 如果是升级、奖励、构筑强化生效：
   - 使用 `upgrade`
5. 如果是异常事件或风险选择：
   - 使用 `anomaly`
6. 如果是结果页落地：
   - 使用 `result`

不要新增 `AudioCue`，除非满足 `音频接线与实现规范.md` 里的新增 cue 判断标准。

## 验收清单

开发 GPT 每次改 UI 后至少检查：

- 开始页两个按钮都有声音。
- 节点选择卡点击有确认音。
- 升级选择卡点击有确认音，不只是在面板出现时有声音。
- 异常和普通事件点击有不同语义音。
- 结果页重开和返回机库有不同语义音。
- 调试面板控件有基础声音，但滑杆不会疯狂连发。
- `window.__pilotAudioDebug().cueCounts` 中能看到对应 cue 计数增长。
- 不存在为了按钮音效绕开 `services.audio` 的直接 Web Audio 调用。

## 给开发 GPT 的提示词

如果要让开发 GPT 接手后续 UI 音效维护，可以直接使用下面这段：

> 你现在负责维护本项目的 UI 按键音效。请先阅读 `doc/40_AI协作/界面按键音效_开发GPT对接文档.md`、`doc/10_设计文档/音频接线与实现规范.md` 和 `src/systems/PilotAudio.ts`。新增或修改任何 UI 按钮时，必须按交互语义调用现有 `services.audio.play(cue)`，不要新增独立音频系统。正式界面按钮需要完整覆盖，调试面板控件至少保留基础 `click / confirm` 反馈。完成后运行构建，并检查 `window.__pilotAudioDebug().cueCounts` 能记录对应 cue。
