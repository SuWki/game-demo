# 音效与美术文档审阅 + 开发 GPT 提示词

## 文档目的

这份文档做两件事：

1. 审阅当前“音效设计文档”和“美术设计文档”，判断哪些结论合理、哪些地方超前或不够可落地。
2. 给开发 GPT 一份可直接执行的提示词，让它基于当前代码做开发优化，而不是只停留在概念层。

## 审阅范围

本次主要对照以下文档与实现：

- `doc/10_设计文档/美术资产与画面设计规范.md`
- `doc/10_设计文档/音频与音效设计.md`
- `doc/10_设计文档/音频资产清单与制作规范.md`
- `doc/10_设计文档/音频接线与实现规范.md`
- `src/scenes/GameScene.ts`
- `src/systems/PilotAudio.ts`
- `src/game/types.ts`
- `src/ui/OverlayController.ts`
- `src/style.css`

## 一、哪些地方合理

### 美术文档合理的地方

#### 1. 画面母设与当前技术实现匹配

- 文档把项目定义为“低照度战术终端感”是合理的。
- 当前实现本身就是 `Phaser.Graphics + HUD + CSS 面板` 的程序化组合，而不是高资产角色驱动项目。
- `src/style.css` 和 `src/scenes/GameScene.ts` 已经在使用深底、功能色、细线、环、楔形、安全窗、危险遮罩这一套语言。

#### 2. “先保识别，再补质感”是正确优先级

- 当前战斗信息密度高，读局主要依赖轮廓、颜色和运动方向。
- `GameScene` 里大量反馈都靠几何图形直接生成，所以“轮廓优先于纹理”贴合现状。

#### 3. 敌人四家族与 Boss 三模板的职责拆分是对的

- 常规敌人四类 `standard / brute / skirmisher / ranged` 与当前数据层一致，见 [enemyArchetypes.ts](/E:/codex/unity-learning/src/data/enemyArchetypes.ts:3)。
- Boss 三模板 `boss-hunt / boss-lockdown / boss-bastion` 与当前战斗模板一致，见 [types.ts](/E:/codex/unity-learning/src/game/types.ts:8)。

#### 4. 页面图形资产优先级合理

- 文档没有要求先做大插画或大背景海报，而是优先开始页 / 结果页锚点、面板卡片和战斗对象。
- 这符合当前 [OverlayController.ts](/E:/codex/unity-learning/src/ui/OverlayController.ts:52) 和 [style.css](/E:/codex/unity-learning/src/style.css:1) 的真实结构。

### 音频文档合理的地方

#### 1. 音频方向和当前骨架匹配

- 文档把当前项目定义为“反馈闭环优先”，而不是“环境氛围优先”，这是对的。
- 当前 `PilotAudio` 本质上就是程序音骨架，用于保证状态音乐、关键 cue 和 ducking 可跑通，见 [PilotAudio.ts](/E:/codex/unity-learning/src/systems/PilotAudio.ts:1)。

#### 2. `menu / battle / boss / result` 四状态拆分合理

- 文档用四种音乐状态管理单局流程，这和现有代码完全一致。
- 切换点已经在 [MainMenuScene.ts](/E:/codex/unity-learning/src/scenes/MainMenuScene.ts:9)、[GameScene.ts](/E:/codex/unity-learning/src/scenes/GameScene.ts:79)、[ResultScene.ts](/E:/codex/unity-learning/src/scenes/ResultScene.ts:9) 里落地。

#### 3. cue 分层和 ducking 思路合理

- 文档强调 `hurt / nearMiss / pressure` 要高于普通花火，这和现有 `applyCueDuck` 基本一致，见 [PilotAudio.ts](/E:/codex/unity-learning/src/systems/PilotAudio.ts:603)。
- `shoot / hit / kill / pickup / enemyShot / nearMiss / relay*` 的语义划分和现有 `AudioCue` 一致，见 [types.ts](/E:/codex/unity-learning/src/game/types.ts:24)。

#### 4. 不鼓励大音频系统重构是正确判断

- 当前 `PilotAudio` 已经覆盖音乐、SFX、meter、snapshot、ducking 和 cue 轮替。
- 原型期确实不适合为了音频再引入复杂 middleware。

## 二、哪些地方不合理或不够可落地

### 美术文档的问题

#### 1. 缺少“怎么落到代码”的实施层

- 美术文档定义了方向、对象和优先级，但没有明确告诉开发应该继续走“纯程序化增强”还是“半程序化 + 可替换资源”的混合方案。
- 当前 `GameScene` 绝大多数视觉对象仍是即时绘制，不存在一个可直接替换成 sprite atlas 的资源管线。

结论：

- 开发优化应先做“可替换的渲染层边界”和“统一视觉 token / helper”，而不是先接大量图片资源。

#### 2. 对 `pierce` 的场内存在感描述偏理想化

- 文档把三条路线的美术人格写得完整，这是对的。
- 但当前实装里，持续高光更明显的是 `crit` 和 `dash`，`pierce` 的场内签名虽然存在于子弹和部分轨迹，但没有同等级的持续场上反馈。
- 参见 [GameScene.ts](/E:/codex/unity-learning/src/scenes/GameScene.ts:3072)。

结论：

- 开发 GPT 不应假设三条路线的场内读感已经平衡，应把“补齐 `pierce` 可见度”列成明确任务。

#### 3. 没有把“哪些必须保留程序化”写清楚

- 文档提到程序化兼容，但没有明确哪些对象当前就应该继续保留为程序化。

当前建议继续程序化的对象：

- 压力安全窗
- 危险遮罩
- 裂口楔形
- 威胁方向提示
- 大部分战斗底纹

原因：

- 这些对象和实时战斗状态强耦合，强行资源化会显著增加开发负担。

### 音频文档的问题

#### 1. 文档已经写到“正式资产层”，但当前实现还没有资源接入层

- `音频与音效设计.md` 和 `音频资产清单与制作规范.md` 已经写到大量正式资产 ID、批次和变体。
- 但当前 `PilotAudio` 还是纯程序音合成，没有外部音频资源 manifest、buffer 管理或 cue-to-asset 映射层。

结论：

- 第一阶段不是先导入一堆素材，而是先在 `PilotAudio` 外再抽一层“cue profile / asset-backed profile 可替换机制”。

#### 2. 文档里有一部分 cue 设计超前于当前事件层

- 文档提到 `elite_crack_open`、`elite_crack_follow`、`boss_phase_shift`、`boss_fireline_sweep`、`boss_safe_window_open` 等结构事件。
- 这些作为设计方向是合理的，但当前 `AudioCue` 里没有对应定义，事件广播层也没有稳定拆出这些语义。
- 见 [types.ts](/E:/codex/unity-learning/src/game/types.ts:24)。

结论：

- 如果要扩新声音，必须先补事件出口，而不是只在 `PilotAudio` 里空写 profile。

#### 3. 路线专属音频设计对 `pierce` 同样略超前

- 文档为 `crit / pierce / dash` 都写了专项包。
- 但当前真实音频里最强的是通用 cue + `crit` / `dash` 高光语境，`pierce` 仍缺少显著的稳定签名。

结论：

- 第一轮应该先在不扩系统的前提下给 `pierce` 补最小可感知差异，而不是直接拆出大量 `pierce_*` 新 cue。

#### 4. 文档缺少“开发先后顺序”的硬约束

- 文档虽然写了 P0 / P1 / P2，但还不够像开发任务。
- 对开发 GPT 来说，最危险的是它会同时做：新 cue、新系统、资源接入、混音调优、事件扩写。

结论：

- 真正的开发顺序应该是：
  1. 稳当前 cue 差异。
  2. 给资源替换留接口。
  3. 只补少量高收益事件。
  4. 最后再考虑外部资产接入。

## 三、给开发 GPT 的开发判断

### 可以直接开发优化的部分

- 强化已有 cue 的听感差异
- 强化已有程序战斗表现的轮廓与层级
- 统一视觉 token 与渲染辅助方法
- 为后续资产替换预留稳定接口
- 补齐 `pierce` 在战斗中的持续签名

### 不应该现在就做的部分

- 一次性引入大量正式美术资源
- 一次性引入完整外部音频资源系统
- 为每个结构事件都扩新 cue
- 重写 `RunEngine -> GameScene -> PilotAudio` 主链
- 为了音效或美术单独开大系统

## 四、给开发 GPT 的可直接提示词

下面这段可以直接交给开发 GPT：

---

你现在接手的是本项目“音效与美术落地优化”任务。你的目标不是重写系统，也不是做一套全新资源前台，而是在当前 Phaser + TypeScript 原型上，把现有音效与画面表现做得更贴近设计文档，同时保持原型的可读性、可维护性和可验证性。

开始前必须先阅读：

1. `doc/40_AI协作/UI_美术_音频协作对接文档.md`
2. `doc/40_AI协作/音效与美术文档审阅_开发GPT提示词.md`
3. `doc/10_设计文档/美术资产与画面设计规范.md`
4. `doc/10_设计文档/音频与音效设计.md`
5. `doc/10_设计文档/音频资产清单与制作规范.md`
6. `doc/10_设计文档/音频接线与实现规范.md`
7. `src/scenes/GameScene.ts`
8. `src/systems/PilotAudio.ts`
9. `src/game/types.ts`
10. `src/ui/OverlayController.ts`
11. `src/style.css`

你必须先理解以下事实，再开始改代码：

- 当前项目是程序化表现优先的原型，不是高资产内容型项目。
- 当前音频骨架已经可用，不能为了“正式化”直接重写成大系统。
- 当前画面母设是正确的，但实施层还不够稳定，尤其缺少渲染边界和统一 token。
- 当前三条路线在文档里被描述得比较完整，但代码里的实战高光更偏 `crit` 和 `dash`，`pierce` 需要补可感知的持续签名。

你的开发目标分成四块：

### 1. 先做画面层优化，不引入大资源系统

请优先优化 `GameScene.ts` 的程序化表现，把以下东西做得更稳定、更可读：

- 玩家、四类常规敌人、精英、Boss 的轮廓差异
- 玩家子弹、敌方投射物、XP 球的区分度
- 危险区、压力圈、裂口楔形、安全窗的层级
- `pierce` 路线在战斗中的持续签名

要求：

- 优先抽视觉 helper、颜色 token、重复绘制逻辑，不要把 `GameScene.ts` 堆得更重。
- 能保留程序化的对象继续程序化，不要强行资源化。
- 保持 960x540 视口下中场读局优先。

### 2. 再做音频层优化，但只在现有骨架上增强

请优先优化 `PilotAudio.ts` 和相关接线，使已有 cue 差异更清楚：

- `shoot / hit / kill / pickup / hurt / nearMiss / enemyShot / pressure`
- `relayStandard / relaySkirmisher / relayBrute / relayRanged`
- `menu / battle / boss / result`

要求：

- 不要重写四状态音乐体系。
- 不要先引入复杂外部音频资源系统。
- 可以抽 cue profile、变体策略、轻量 route tint 或上下文差异，但必须保持现有 `AudioCue` 语义稳定。
- 先把“能听清差异”做好，再考虑“能不能导入正式素材”。

### 3. 只补最少量高收益扩展，不要贪多

如果你判断必须扩新事件或接口，只允许优先考虑以下少量高收益目标：

- 为 `pierce` 补更明确的实战高光表现
- 为精英裂口或 Boss 阶段变化补 1 到 2 个最值得新增的触发点
- 为后续音频资源替换预留最小可行接口

不要做：

- 一次性扩一整套新 cue
- 一次性导入完整素材清单
- 一次性改动大量战斗事件层

### 4. 交付时必须给出验证方式

你完成后必须同时给出：

- 改了哪些代码文件
- 为什么这些改动比文档更贴近当前实现
- 哪些文档点被落实了
- 哪些文档点仍然是二期事项
- 你如何验证画面和声音没有把读局做坏

验证至少包括：

- `npm run build`
- 一次完整菜单 -> 战斗 -> 结果页流程验证
- 对 `crit / pierce / dash` 的主观差异检查
- 对 `hurt / nearMiss / pressure` 的可分辨性检查

你的实现原则：

- 先补齐“现在就该更清楚”的东西
- 不要为了完成度引入超出原型边界的系统
- 不要把文档里的正式资产理想态直接当成当前必须一次做完的工程目标
- 所有优化都必须服务读局、路线辨识和 Boss 收尾

---

## 五、给你的结论

一句话总结这次审阅：

- 美术文档方向基本正确，主要问题是“落地接口和程序化边界写得不够细”。
- 音频文档方向也对，但有一部分已经写到正式资产和二期 cue 设计，明显快于当前实现承载。

所以真正适合开发 GPT 的任务，不是“把文档全部实现”，而是：

- 把当前实现先收紧
- 把高收益差异先做出来
- 给二期正式化留下干净接口

这才是对当前项目最稳的开发优化路径。
