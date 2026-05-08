# 文档勘误说明

**发现时间**: 2026-05-08  
**状态**: ❌ 已过时 - 基于错误前提

---

## 说明

本文档最初错误地假设游戏存在"按空格键冲刺"的手动输入机制。经过代码审查确认，**游戏中的冲刺（Dash）是自动触发的**，并非通过空格键或其他按键手动触发。

### 实际游戏机制

- **移动控制**: WASD / 方向键
- **射击**: 自动（无需按键）
- **冲刺（Dash脉冲）**: 自动触发，基于以下条件：
  - Dash路线升级后获得脉冲伤害能力
  - 脉冲有冷却时间（`dashCooldownSec`）
  - 冷却结束后自动释放脉冲伤害
  - 不需要玩家手动按键

### 代码验证

**GameScene.ts 输入绑定**（仅WASD和方向键）：
```typescript
this.moveKeys = this.input.keyboard!.addKeys({
  up: Phaser.Input.Keyboard.KeyCodes.W,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,
}) as GameScene['moveKeys'];
this.arrowKeys = this.input.keyboard!.createCursorKeys();
```

**RunEngine.ts 冲刺触发逻辑**（自动触发）：
```typescript
battle.dashCooldownSec -= dt;
if ((this.state.stats.dashPulseDamage <= 0 && this.state.routeCounts.dash <= 0) || battle.dashCooldownSec > 0) {
  return;
}
// 自动触发冲刺脉冲...
```

---

## 原始文档内容（已作废）

以下内容基于错误前提，仅作存档：

<details>
<summary>点击查看已作废内容</summary>

## 🐛 Bug 1: 空格冲刺功能完全不可用

### 问题描述
用户按空格键没有任何反应，冲刺功能完全无法使用。

### 根本原因（错误）
1. PlayerInputState 接口缺少 dash 字段
2. GameScene 没有监听空格键
3. RunEngine 没有处理冲刺输入

### 修复方案（不适用）
添加空格键监听和冲刺输入处理...

</details>

---

## 正确的设计方向

如果需要优化冲刺体验，应关注：

1. **冲刺触发提示**: 让玩家知道冲刺何时会触发
2. **冷却进度可视化**: 显示冲刺冷却状态
3. **冲刺效果反馈**: 冲刺触发时的视觉和音效反馈

详见: [game-experience-optimization-plan.md](game-experience-optimization-plan.md)
