# 视觉反馈规则

## 核心原则

**禁止在玩家角色位置绘制任何装饰性圈/环/脉冲/闪光图层。**

所有战斗反馈应放在 **敌人受击特效** 或 **HUD 界面** 上，而非角色模型周围。

## 规则列表

1. **禁止绘制"升级闪光"**：升级拾取、等级提升、里程碑达成时，不在玩家位置绘制任何圆圈/脉冲/光环。
2. **禁止绘制"流派阶段升级"视觉**：流派达到 hinted/committed/matured 时，不在玩家位置或屏幕中心绘制路线色脉冲圈或全屏闪光。
3. **禁止绘制常驻"路线色光环"**：不在玩家脚下或身体周围绘制任何路线色（橙/蓝/绿）椭圆发光或光环。
4. **禁止绘制"Build成型闪光"**：不因 buildReadyFlash 等效果在屏幕任何位置绘制圈/环/脉冲。

## 允许的视觉反馈

- 敌人受击特效（暴击爆炸、穿透冲击波、闪电链等）
- 玩家受伤红色闪屏
- 低血量时 HUD 警告（而非角色周围画圈）
- 子弹轨迹和命中效果
- 文字提示（toast/tip系统）

## 历史删除记录（防止复现）

| 功能 | 文件 | 删除时间 |
|---|---|---|
| `renderUpgradeFlash()` — 升级时角色位置画3个嵌套圈 | `src/scenes/GameScene.ts` | 2026-05-28 |
| `renderBuildReadyFlash()` — 全屏路线色闪光+圈+十字线 | `src/scenes/GameScene.ts` | 2026-05-28 |
| `triggerStageUpgradeVisual()` — 流派阶段升级时角色位置画路线色脉冲圈 | `src/systems/RunEngine.ts` | 2026-05-28 |
| 玩家脚下路线色发光椭圆 | `src/scenes/GameScene.ts` | 2026-05-28 |
| `upgradeFlashSec` 状态字段及全部相关逻辑 | `src/systems/RunEngine.ts` + `src/game/types.ts` | 2026-05-28 |
| `buildReadyFlash` 视觉效果类型 | `src/game/types.ts` + `src/systems/RunEngine.ts` | 2026-05-28 |

**注意**：`renderUpgradeFlash` 和 `renderBuildReadyFlash` 历史上曾被删除后又因重构复现。任何新的视觉反馈系统在合并前必须确认不违反以上规则。
