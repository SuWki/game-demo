# 3C改进开发文档

**项目**: Phaser自动射击游戏  
**开始时间**: 2026-05-05  
**目标**: 提升Character、Camera、Control的视觉反馈和操作手感

---

## 📊 开发进度总览

| 优先级 | 功能 | 状态 | 完成时间 |
|--------|------|------|----------|
| P0 | Dash冷却UI指示器 | ✅ 已完成 | 2026-05-05 |
| P0 | 移动拖尾效果 | ✅ 已完成 | 2026-05-05 |
| P0 | 急转弯粒子特效 | ✅ 已完成 | 2026-05-05 |
| P1 | Dash时相机缩放 | ✅ 已完成 | 2026-05-05 |
| P1 | 相机预测偏移 | ✅ 已完成 | 2026-05-05 |
| P1 | 分类震动效果 | ✅ 已完成 | 2026-05-05 |
| P2 | 输入方向可视化 | ⏳ 待开始 | - |
| P2 | 移动启动粒子 | ⏳ 待开始 | - |

---

## 🎯 第一优先级：视觉反馈

### 1. Dash冷却UI指示器

**目标**: 让玩家清楚知道Dash何时可用

**实现方案**:
- 在玩家下方显示冷却进度条
- 颜色: 青色(#00ffff)，透明度0.8
- 尺寸: 40x4像素
- 位置: 玩家下方30像素

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 添加Graphics对象用于绘制进度条
// 每帧根据dashCooldownSec计算进度并渲染
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/scenes/GameScene.ts:3736-3756
// 在玩家血条下方添加Dash冷却指示器
// - 冷却中: 灰色(#4a7a7a)，透明度0.6
// - 已就绪: 青色(#00ffff)，透明度0.9，带呼吸光效
// - 进度条宽度40px，高度4px
// - 位置: 玩家下方32像素
```

**效果**:
- ✅ 实时显示Dash冷却进度
- ✅ 就绪时青色高亮+呼吸光效
- ✅ 仅在有Dash能力时显示

---

### 2. 移动拖尾效果

**目标**: 高速移动时产生残影，增强速度感

**实现方案**:
- 速度阈值: 100以上触发
- 残影颜色: #4488ff，初始透明度0.3
- 动画: 200ms内淡出并缩小至0.5倍
- 频率: 每帧生成（需要节流控制）

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 在render循环中检测速度
// 使用Phaser.Tweens实现淡出动画
// 需要对象池优化性能
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/scenes/GameScene.ts:3724-3743
// 在玩家主体渲染前添加拖尾效果
// - 速度阈值: velocityMagnitude > 100
// - 节流: 每3帧生成一次残影
// - 颜色: Dash流派青色(#00d4ff)，其他蓝色(#4488ff)
// - 动画: 200ms淡出+缩小至0.5倍，Cubic.easeOut缓动
```

**效果**:
- ✅ 高速移动时产生残影轨迹
- ✅ 根据流派动态调整颜色
- ✅ 节流控制避免性能问题
- ✅ 平滑淡出动画

---

### 3. 急转弯粒子特效

**目标**: 方向突变时产生火花效果

**实现方案**:
- 触发条件: turnBurstSec > 0
- 粒子数量: 8个
- 发射角度: 转向角度±30度
- 速度: 50-150
- 生命周期: 300ms

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 监听turnBurstSec状态变化
// 使用Phaser.GameObjects.Particles
// 需要预加载粒子纹理
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/scenes/GameScene.ts:115-116
// 添加状态追踪变量
private trailFrameCounter = 0;
private lastTurnBurstSec = 0;

// 文件: src/scenes/GameScene.ts:3545行附近
// 检测急转弯触发时刻并生成粒子
if (turnBurstRatio > 0.08) {
  if (this.lastTurnBurstSec === 0 && battle.playerTurnBurstSec > 0) {
    const turnAngle = Math.atan2(moveDirY, moveDirX);
    for (let i = 0; i < 8; i++) {
      const angle = turnAngle + (Math.random() - 0.5) * Math.PI / 3;
      const speed = 50 + Math.random() * 100;
      const particle = this.add.circle(bodyX, bodyY, 2, 0xbef7ff, 0.8);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.tweens.add({
        targets: particle,
        x: particle.x + vx * 0.3,
        y: particle.y + vy * 0.3,
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }
  }
}

// 文件: src/scenes/GameScene.ts:3803行之后
// 更新状态追踪
this.lastTurnBurstSec = battle.playerTurnBurstSec;
```

**效果**:
- ✅ 急转弯时生成8个青色粒子
- ✅ 粒子沿转向角度±30度发射
- ✅ 300ms生命周期，淡出并缩小
- ✅ 使用状态追踪避免重复触发

---

## 🎥 第二优先级：相机动态

### 4. Dash时相机缩放

**目标**: Dash瞬间拉远视角，增强冲刺感

**实现方案**:
- 缩放目标: 0.9倍
- 缩放时长: 150ms (Sine.easeOut)
- 恢复时长: 200ms (Sine.easeIn)
- 延迟: 300ms后恢复

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 监听Dash触发事件
// 使用camera.zoomTo()
// 需要防止多次触发冲突
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/scenes/GameScene.ts:115 (添加状态追踪变量)
private lastDashDriveSec = 0;

// 文件: src/scenes/GameScene.ts:3807-3816 (Dash触发检测和相机缩放)
if (this.lastDashDriveSec <= 0 && battle.dashDriveSec > 0) {
  this.cameras.main.zoomTo(0.9, 150, 'Sine.easeOut');
  this.time.delayedCall(300, () => {
    this.cameras.main.zoomTo(1.0, 200, 'Sine.easeIn');
  });
}
this.lastDashDriveSec = battle.dashDriveSec;
```

**效果**:
- ✅ Dash触发时相机缩小至0.9倍（150ms）
- ✅ 300ms后平滑恢复至1.0倍（200ms）
- ✅ 使用Sine缓动函数确保平滑过渡
- ✅ 状态追踪避免重复触发

---

### 5. 相机预测偏移

**目标**: 相机向移动方向偏移，扩大前方视野

**实现方案**:
- 偏移系数: 速度 × 0.15
- 平滑过渡: 使用插值避免抖动
- 最大偏移: 限制在±50像素内

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 在相机更新逻辑中添加lookAhead计算
// 基于playerVx/playerVy
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/scenes/GameScene.ts:1941-1948
// 在getBattleCameraRect方法中添加预测偏移
const speed = Math.sqrt(battle.playerVelocityX ** 2 + battle.playerVelocityY ** 2);
const predictionFactor = 0.15;
const predictionOffsetX = speed > 50 ? battle.playerVelocityX * predictionFactor : 0;
const predictionOffsetY = speed > 50 ? battle.playerVelocityY * predictionFactor : 0;

const baseLeft = clamp(battle.playerX - width * 0.5 + predictionOffsetX, 0, maxLeft);
const baseTop = clamp(battle.playerY - height * 0.5 + predictionOffsetY, 0, maxTop);
```

**效果**:
- ✅ 相机根据移动方向动态偏移
- ✅ 速度阈值50避免静止时抖动
- ✅ 偏移量与速度成正比（系数0.15）
- ✅ clamp确保相机不超出地图边界

---

### 6. 分类震动效果

**目标**: 不同事件产生不同类型的震动

**实现方案**:
- HIT震动: 高频(30Hz)，短时(0.05-0.14s)
- DASH震动: 中频(20Hz)，方向性
- ELITE震动: 低频(10Hz)，长时(0.34s)

**技术细节**:
```typescript
// 文件: src/systems/RunEngine.ts
// 添加ShakeType枚举
// 修改震动算法，根据类型调整频率
```

**状态**: ✅ 已完成

**实现代码**:
```typescript
// 文件: src/game/types.ts:526 (添加频率字段)
cameraShakeFrequency: number;

// 文件: src/systems/RunEngine.ts:6089 (修改震动方法)
private kickBattleShake(battle: BattleState, durationSec: number, strength: number, frequency: number = 11): void {
  battle.cameraShakeFrequency = frequency;
  // ...
}

// 文件: src/scenes/GameScene.ts:1953 (使用动态频率)
const shakeFrequency = battle.cameraShakeFrequency || 11;
const shakePhase = battle.elapsedSec * shakeFrequency + battle.kills * 0.08;

// 不同事件的频率设置:
// - 暴击击杀: 30Hz (高频快速抖动)
// - 普通击杀: 25Hz (中高频)
// - Dash脉冲: 20Hz (中频方向性)
// - 敌人碰撞: 9Hz (低频重击感)
// - 精英生成: 10Hz (低频缓慢摇晃)
// - 弹幕近距: 11Hz (默认频率)
```

**效果**:
- ✅ 暴击时高频震动增强打击感
- ✅ Dash时中频震动配合冲刺动作
- ✅ 受伤时低频震动强调重击
- ✅ 精英生成时低频震动营造压迫感

---

## 🎮 第三优先级：操作手感

### 7. 输入方向可视化

**目标**: 显示当前输入方向

**实现方案**:
- 形状: 三角形指示器
- 位置: 玩家前方25像素
- 颜色: 白色，透明度0.6
- 仅在移动时显示

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 根据输入计算角度
// 使用add.triangle()
// 每帧更新位置和旋转
```

**状态**: ⏳ 待开始

---

### 8. 移动启动粒子

**目标**: 从静止启动时产生尘埃效果

**实现方案**:
- 触发条件: 从静止到移动
- 粒子数量: 12个
- 发射角度: 360度全方向
- 速度: 80
- 生命周期: 400ms

**技术细节**:
```typescript
// 文件: src/scenes/GameScene.ts
// 检测速度从0到>0的变化
// 使用粒子系统
```

**状态**: ⏳ 待开始

---

## 📝 技术注意事项

### 性能优化
- [ ] 所有粒子系统使用对象池
- [ ] 拖尾效果添加节流（每3帧生成一次）
- [ ] 相机效果使用插值避免抖动
- [ ] 添加特效开关配置

### 代码规范
- [ ] 所有魔法数字提取到balance.ts
- [ ] 添加类型定义到types.ts
- [ ] 保持逻辑层(RunEngine)与渲染层(GameScene)分离

### 测试要点
- [ ] 高速移动时帧率稳定
- [ ] 相机效果不引起晕眩
- [ ] Dash连续使用时UI正确
- [ ] 多个震动叠加时表现正常

---

## 🔄 变更日志

### 2026-05-05
- 创建开发文档
- 开始实施第一优先级功能
