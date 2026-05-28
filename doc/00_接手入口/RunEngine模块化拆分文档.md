# RunEngine 模块化拆分 - 接手文档

> 创建日期：2026-05-27
> 说明：本文档说明 RunEngine.ts 模块化拆分的结构和各文件职责

---

## 目录结构

```
src/systems/
├── RunEngine.ts              # 主引擎类（原9633行，正在逐步精简）
├── BattleHelpers.ts          # 旧的辅助函数文件（将被移除）
└── battle/                   # 新模块目录
    ├── index.ts              # 模块统一导出
    ├── helpers.ts            # 战斗辅助函数（生成、移动计算）
    └── buildSystem.ts        # Build系统函数（路线、阶段计算）
```

---

## 各文件职责

### 1. RunEngine.ts

**位置**：`src/systems/RunEngine.ts`

**职责**：
- 游戏主引擎类，协调所有游戏系统
- 维护游戏状态（RunState, BattleState）
- 处理游戏主循环（tick方法）
- 调用各辅助模块的函数

**当前状态**：
- 原约9633行，正在逐步拆分中
- 已从该文件迁移出护卫生成计算、敌人移动计算等方法
- 剩余核心方法：敌人更新、子弹碰撞、Build阶段判定等

**依赖关系**：
```typescript
// 从battle模块导入
import {
  calculateEscortBatch,
  calculateEscortMax,
  calculateEscortRespawnSec,
} from './battle/helpers';
```

---

### 2. battle/index.ts

**位置**：`src/systems/battle/index.ts`

**职责**：
- battle模块的统一导出文件
- 集中导出所有辅助函数，方便外部导入

**导出内容**：
```typescript
export * from './helpers';      // 战斗辅助函数
export * from './buildSystem';  // Build系统函数
```

**使用方式**：
```typescript
// 外部模块通过统一入口导入
import { calculateEscortBatch, getDominantRoute } from './battle';
```

---

### 3. battle/helpers.ts

**位置**：`src/systems/battle/helpers.ts`

**职责**：
- 战斗相关的纯辅助函数
- 不包含状态，只进行计算
- 可被单元测试直接调用

**包含的函数**：

#### 敌人生成计算
- `calculateAdaptiveSpawnBurstCount()` - 计算自适应生成批次数量
- `calculateRefillWindow()` - 计算敌人补充窗口时间

#### 护卫生成计算
- `calculateEscortBatch()` - 计算护卫生成批次（基础值+压力阶段加成）
- `calculateEscortMax()` - 计算护卫最大数量（基础值+压力阶段加成）
- `calculateEscortRespawnSec()` - 计算护卫生成间隔（基础值×压力阶段乘数）

#### 位置计算
- `getPatternEscortSpawnPosition()` - 根据模式计算护卫生成位置
  - 支持模式：'laneCrush'（车道压制）、'sideClamp'（侧翼夹封）、'crossfireWave'（交叉火线）

#### 敌人移动计算
- `calculateStandardEnemyMovement()` - 标准敌人移动逻辑（带模式判断）
- `calculateBruteEnemyMovement()` - 厚血怪移动逻辑（直接冲向玩家）
- `calculateSkirmisherEnemyMovement()` - 高速怪移动逻辑（侧面包围）
- `calculateRangedEnemyMovement()` - 远程怪移动逻辑（保持距离）

**类型定义**：
- `PressurePhase` - 压力阶段配置接口
- `ViewportBounds` - 视口边界接口
- `EnemyMovementContext` - 敌人移动上下文

---

### 4. battle/buildSystem.ts

**位置**：`src/systems/battle/buildSystem.ts`

**职责**：
- Build系统相关的纯辅助函数
- 处理路线判定、阶段计算、Build总结等
- 不包含UI逻辑，只进行数据计算

**包含的函数**：

#### 路线判定
- `getDominantRoute(routeCounts)` - 获取主导路线（计数最高的路线）
- `calculateBuildStage(routeCounts, committedRoute, maturedRoute)` - 计算当前Build阶段
- `calculateRouteBuildStage(routeId, ...)` - 计算特定路线的Build阶段
- `getResultRoute(routeCounts, ...)` - 获取结果路线（按优先级）

#### Build阶段信息
- `getBuildStageLabel(buildStage)` - 获取阶段标签文本
- `getBuildSummary(routeId, buildStage, routeNameMap)` - 获取Build总结文本

#### 路线工具函数
- `isHybridTagged(tags)` - 检查是否为混合标签
- `isRedirectUpgradePick(choiceRouteId, dominantRoute)` - 检查是否为重定向选择

**常量**：
- `ROUTE_COMMIT_THRESHOLD = 3` - 路线站稳阈值
- `ROUTE_MATURE_THRESHOLD = 5` - 路线成型阈值

---

## 迁移进度

### 已完成迁移 ✅

1. **护卫生成计算**
   - `getEliteEscortBatch()` → `calculateEscortBatch()`
   - `getEliteEscortMax()` → `calculateEscortMax()`
   - `getEliteEscortRespawnSec()` → `calculateEscortRespawnSec()`

2. **Build系统函数**（已整合到RunEngine）
   - `getDominantRoute()` → `getDominantRoute()` from `battle/buildSystem.ts`
   - `getBuildStage()` → `calculateBuildStage()` from `battle/buildSystem.ts`
   - `getResultRoute()` → `getResultRoute()` from `battle/buildSystem.ts`

3. **敌人移动计算**（已创建，待整合）
   - `updateStandardEnemy()` → `calculateStandardEnemyMovement()`
   - `updateBruteEnemy()` → `calculateBruteEnemyMovement()`
   - `updateSkirmisherEnemy()` → `calculateSkirmisherEnemyMovement()`
   - `updateRangedEnemy()` → `calculateRangedEnemyMovement()`

### 待迁移 ⏳

1. **视觉效果函数**
   - `kickBattleShake()` - 屏幕震动
   - `createCrackMark()` - 创建裂纹
   - `updateCrackMarks()` - 更新裂纹
   - `createVisualEffect()` - 创建视觉特效

2. **敌人AI方法**（需要更复杂的重构）
   - `updateStandardEnemy()` - 包含锚点逻辑、群体行为等复杂逻辑
   - `updateBruteEnemy()` - 相对简单，可以迁移
   - `updateSkirmisherEnemy()` - 可以迁移
   - `updateRangedEnemy()` - 可以迁移

3. **战斗计算**
   - `updateBullets()` - 子弹更新
   - `checkBulletEnemyCollision()` - 碰撞检测
   - `calculateDamage()` - 伤害计算

---

## 设计原则

### 1. 纯函数优先
- 辅助函数应该是纯函数，不修改外部状态
- 输入参数明确，输出结果可预测
- 便于单元测试

### 2. 类型安全
- 所有函数都有明确的类型标注
- 使用接口定义复杂的参数类型
- 避免使用 `any`

### 3. 单一职责
- 每个函数只做一件事
- 复杂逻辑拆分为多个小函数
- 函数命名清晰表达其功能

### 4. 向后兼容
- 保持现有API的兼容性
- 新模块通过导入方式使用
- 逐步替换旧代码，不一次性删除

---

## 使用示例

### 导入辅助函数
```typescript
import {
  calculateEscortBatch,
  calculateEscortMax,
} from './battle/helpers';

// 在RunEngine中使用
const batch = calculateEscortBatch(
  template.eliteRule?.escortBatch ?? 0,
  phase as PressurePhase | null
);
```

### 导入Build系统函数
```typescript
import {
  getDominantRoute,
  calculateBuildStage,
} from './battle/buildSystem';

// 使用
const dominant = getDominantRoute(this.state.routeCounts);
const stage = calculateBuildStage(
  this.state.routeCounts,
  this.state.committedRoute,
  this.state.maturedRoute
);
```

---

## 注意事项

1. **常量冲突**：RunEngine.ts中已定义 `ROUTE_COMMIT_THRESHOLD` 和 `ROUTE_MATURE_THRESHOLD`，在导入时避免重复导入

2. **类型兼容**：`PressurePhase` 类型需要与 `BattlePressurePhaseDefinition` 兼容

3. **测试策略**：新添加的辅助函数可以单独测试，不需要启动完整游戏引擎

4. **渐进式迁移**：不要一次性迁移所有方法，保持每次构建成功后再继续

---

## 后续计划

1. 将敌人移动方法整合到RunEngine中
2. 将Build系统方法整合到RunEngine中
3. 创建视觉效果辅助模块
4. 逐步精简RunEngine.ts的行数
5. 为所有辅助函数添加单元测试

---

*文档最后更新：2026-05-27*
