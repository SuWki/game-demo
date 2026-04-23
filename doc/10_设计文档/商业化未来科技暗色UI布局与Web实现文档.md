# 商业化未来科技暗色 UI 布局与 Web 实现文档

## 文档目的

这份文档用于把“商业化未来科技暗色 UI 方案”进一步拆成可交付给美术和开发的布局说明。

它解决三件事：

1. 美术知道每个页面应该画什么、怎么排版、交付哪些状态。
2. UI GPT 可以基于这里直接生成更接近产品稿的设计图。
3. 开发 GPT 可以按 DOM + CSS + Phaser 叠层方式实现，不需要重写游戏主流程。

配套阅读：

- `doc/10_设计文档/商业化未来科技暗色UI设计方案.md`
- `doc/40_AI协作/商业化未来科技暗色UI_提示词.md`

## 总体实现方式

## 技术层级

推荐继续使用：

- Phaser 负责战场、角色、敌人、弹道、经验球、场内反馈
- DOM 负责开始页、HUD、选择面板、强化面板、事件面板、结算页
- CSS variables 负责全局视觉 token
- CSS animation 负责轻量扫描、流光、淡入和 hover

不要把所有 UI 画进 Canvas。

原因：

- 文本、按钮、卡片、响应式布局用 DOM 更清晰
- Phaser 只保留实时战斗对象和场内短反馈
- 美术稿也更容易被前端拆成组件

## 页面层级

从底到顶：

1. `game-canvas`：Phaser 战场
2. `field-effects`：场内危险区、裂口、目标引导
3. `hud-layer`：生命、经验、波次、目标
4. `toast-layer`：短提示
5. `panel-layer`：节点、强化、事件、最终整备
6. `screen-layer`：开始页、结算页、暂停页

开发落地时可以用一个根 DOM：

```html
<div id="game-root">
  <canvas id="game-canvas"></canvas>
  <div id="ui-root">
    <div class="hud-layer"></div>
    <div class="toast-layer"></div>
    <div class="panel-layer"></div>
    <div class="screen-layer"></div>
  </div>
</div>
```

## 全局设计 token

建议 CSS variables：

```css
:root {
  --ui-bg-main: #090d12;
  --ui-bg-panel: rgba(14, 22, 32, 0.88);
  --ui-bg-panel-soft: rgba(18, 30, 44, 0.72);
  --ui-line-soft: rgba(170, 204, 228, 0.14);
  --ui-line-strong: rgba(111, 231, 255, 0.42);
  --ui-text-main: rgba(238, 248, 255, 0.96);
  --ui-text-sub: rgba(205, 224, 238, 0.72);
  --ui-text-dim: rgba(190, 211, 225, 0.48);
  --ui-cyan: #6fe7ff;
  --ui-blue: #44c8ff;
  --ui-danger: #ff7b57;
  --ui-success: #6ee7a8;
  --ui-gold: #ffc96b;
  --ui-anomaly: #a98cff;
  --route-crit: #ff8b6b;
  --route-pierce: #62d9ff;
  --route-dash: #8df7a6;
}
```

## 美术交付规格

美术优先输出：

- 主稿：`1920 x 1080`
- 小屏参考：`1280 x 720`
- 移动适配草图：`390 x 844`

必须交付的页面：

1. 开始页
2. 局内 HUD
3. 节点选择面板
4. 强化三选一面板
5. 事件 / 异常面板
6. 结算页

每个页面至少交付：

- 静态默认态
- hover / selected / disabled 中至少一种状态说明
- 关键尺寸标注
- 色值与字体层级

## 开始页布局

画布：`1920 x 1080`

布局：

- 左侧主信息区：`x 96 / y 560 / w 660 / h 360`
- 右侧视觉锚点：中心约 `x 1380 / y 520`
- 主视觉直径：`520 ~ 620`
- 背景保留暗色战术网格

左侧内容：

1. 英文眉标
2. 中文主标题
3. 一句玩法副标题
4. 输入提示或版本状态
5. 主按钮 `开始作战`
6. 次按钮 `战斗记录` / `设置`

美术重点：

- 主按钮要有商业游戏的启动感
- 右侧主视觉不要压过标题
- 页面整体不能像网页 landing page

## 局内 HUD 布局

画布：`1920 x 1080`

区域：

- 左上生命 / 经验：`x 40 / y 32 / w 360 / h 92`
- 上中阶段胶囊：`x 810 / y 28 / w 300 / h 54`
- 右上目标模块：`x 1440 / y 32 / w 420 / h 72`
- Toast：`x 710 / y 96 / w 500 / h 48`

中部战场保护区：

- 屏幕中心 `60%` 不放常驻大型 UI
- 下中区域不放常驻面板

HUD 视觉要求：

- 细、薄、准
- 生命和经验条必须一眼可扫
- 目标模块要比普通信息更亮一点
- 低血状态允许边缘危险光，但不能遮住战场

## 节点选择面板布局

位置：

- 底部浮层
- 面板整体：`x 300 / y 710 / w 1320 / h 270`
- 卡片数量：1 到 3 张都要适配

三卡状态：

- 单卡：`w 360 / h 174`
- 间距：`24`
- 卡组居中

卡片内容：

1. 节点类型标签
2. 标题
3. 一句说明
4. 收益 / 风险短标签

美术要给出：

- battle 卡
- upgrade 卡
- event 卡
- hover 态
- selected 态

## 强化三选一面板布局

这是本次特别补充的重点。

## 设计目标

玩家在选择强化时必须看到自己当前属性，才能判断三张卡哪一张更值。

因此强化界面不是单纯三张卡，而是：

**当前属性快照 + 三选一强化卡组**

## 桌面端布局

画布：`1920 x 1080`

整体浮层：

- `x 250 / y 640 / w 1420 / h 360`

左侧当前属性模块：

- `x 280 / y 690 / w 320 / h 250`

右侧强化卡组：

- `x 640 / y 690 / w 960 / h 250`

三张强化卡：

- 单卡 `w 300 / h 230`
- 卡间距 `30`

## 当前属性模块

标题：

- `当前机体`

核心属性列表：

- 伤害
- 射速
- 弹速
- 暴击率
- 暴击伤害
- 穿透
- 多重射击
- 生命
- 移速
- 路线倾向

展示规则：

- 分两列紧凑排布
- 每项为 `名称 + 当前值`
- 当前卡会影响的属性要轻微发光
- 不显示公式
- 不显示内部变量名
- 不做 RPG 长属性表

示例视觉：

```text
当前机体

伤害      14
射速      1.35/s
弹速      520
暴击      18%
爆伤      165%
穿透      2
多重      +1
生命      86/110
移速      245
倾向      穿透
```

## 强化卡

每张卡内容：

1. 品质角标
2. 强化名称
3. 一句核心效果
4. 影响属性标签
5. 路线或通用标签

当玩家 hover 某张卡：

- 卡片边框抬亮
- 当前属性模块中对应属性同步高亮
- 如果开发成本允许，可显示 `+X` 的预览值

如果暂时不做 hover 联动：

- 至少在卡片上清楚标出影响属性
- 属性面板保持静态

## 小屏布局

小屏时：

- 当前属性模块压缩成横向芯片栏
- 放在三张卡上方
- 只显示 6 个关键属性
- 可加一个 `详情` 小按钮，但第一版可不做展开

优先显示：

- 伤害
- 射速
- 暴击
- 穿透
- 生命
- 移速

## 事件 / 异常面板布局

整体与强化面板同构，但左侧属性模块替换为风险摘要。

左侧：

- 当前状态 / 风险提示
- 本事件可能影响路线、生命或下场战斗

右侧：

- 2 到 3 个选择卡

视觉：

- 更深底
- 紫色 / 橙红强调
- 边线可有轻微断裂

## 结算页布局

画布：`1920 x 1080`

与开始页同构：

- 左侧战报区：`x 96 / y 500 / w 720 / h 430`
- 右侧结算视觉：中心约 `x 1380 / y 520`

内容：

1. 英文眉标
2. 中文结果标题
3. 本局摘要
4. 四个核心统计 chips
5. 主按钮 `再来一局`
6. 次按钮 `返回开始页`
7. 次按钮 `查看记录`

结果页不能变成大表格。

## Web 开发实现建议

## 组件拆分

建议开发拆成：

- `MainMenuView`
- `HudView`
- `ToastView`
- `NodeChoicePanel`
- `UpgradeChoicePanel`
- `CurrentStatsPanel`
- `EventChoicePanel`
- `ResultView`

如果当前项目暂时没有组件框架，也可以在 `OverlayController.ts` 里按方法拆分：

- `renderMainMenu`
- `renderHud`
- `renderNodePanel`
- `renderUpgradePanel`
- `renderCurrentStatsPanel`
- `renderEventPanel`
- `renderResult`

## 当前属性数据接口

开发侧需要从当前 run state 中整理出 UI 可读属性。

建议输出结构：

```ts
type UiStatRow = {
  id: string;
  label: string;
  value: string;
  highlight?: boolean;
};
```

强化卡 hover 时可以传入：

```ts
type UpgradePreview = {
  affectedStats: string[];
};
```

第一版可只做静态当前属性，不做预览加成。

## CSS 类命名建议

```css
.ui-shell
.ui-screen
.ui-panel
.ui-panel--choice
.ui-panel--upgrade
.ui-card
.ui-card--battle
.ui-card--upgrade
.ui-card--event
.ui-card--selected
.ui-stat-panel
.ui-stat-row
.ui-stat-row--highlight
.ui-chip
.ui-button
.ui-button--primary
.ui-button--secondary
```

## 动效建议

- 页面进入：`opacity + translateY`，时长 `220ms`
- 卡片 hover：边线抬亮 + 轻微上移 `2px`
- 主按钮：慢速边线扫描
- 属性高亮：短促 cyan glow，不做跳动
- 结算页：右侧环形视觉轻收束

## 美术交付清单

美术需要交付：

1. 开始页高保真图
2. 局内 HUD 高保真图
3. 节点选择面板高保真图
4. 强化三选一面板高保真图，必须包含当前属性模块
5. 事件 / 异常面板高保真图
6. 结算页高保真图
7. 色板与字体说明
8. 按钮默认 / hover / active 状态
9. 卡片默认 / hover / selected 状态
10. 当前属性模块默认 / 高亮状态

## 开发验收标准

第一版开发完成后至少满足：

- 开始页和结算页视觉同构
- 局内 HUD 不遮挡主战场
- 强化选择时能看到当前属性
- 选择卡片层级清晰
- 玩家可见文本无乱码
- `1366 x 768` 与 `1920 x 1080` 下都不明显超框
- `npm run build` 通过
- 菜单 -> 战斗 -> 强化选择 -> 结算流程可跑通

## 当前优先级建议

第一轮落地顺序：

1. 强化选择界面补当前属性模块
2. 开始页与结算页同构重做
3. HUD 薄化与战术化
4. 节点 / 事件 / 强化面板统一
5. 细节动效与小屏适配

原因：

- 当前属性模块直接影响三选一决策质量
- 开始页和结算页决定第一眼和最后一眼
- HUD 与面板统一决定战斗过程中的产品感
