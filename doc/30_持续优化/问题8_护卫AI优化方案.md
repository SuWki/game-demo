# 问题#8: Boss和精英护卫AI优化方案

## 问题描述
护卫敌人不智能，容易让Boss和精英直接成靶子被打死。

## 根本原因分析

### 当前护卫AI行为
1. **使用通用原型AI**：护卫通过`updateArchetypeEnemy()`使用标准/brute/skirmisher/ranged的通用移动逻辑
2. **被动跟随**：通过`frontlineAnchor`机制站在Boss"肩膀位置"（侧后方），而非主动拦截
3. **破绽窗口反向行为**：`stabilizeEliteCrackEscort()`在Boss破绽期让护卫"剥离"（peel away），反而远离玩家

### 代码位置
- **护卫更新入口**：`RunEngine.ts:4524-4527`
  ```typescript
  if (!enemy.elite && enemy.role === 'escort' && battle.eliteAlive && battle.eliteCrackWindowSec > 0) {
    this.stabilizeEliteCrackEscort(battle, enemy);
  }
  this.updateArchetypeEnemy(enemy, battle, dt);
  ```

- **通用移动逻辑**：`RunEngine.ts:4678-4856` (updateStandardEnemy)
  - 行4691-4695: 查找frontlineAnchor（精英或brute）
  - 行4742-4783: 站在锚点"肩膀位置"，而非拦截位置

- **破绽期剥离逻辑**：`RunEngine.ts:7738-7781` (stabilizeEliteCrackEscort)
  - 行7770-7780: 计算垂直于"Boss→玩家"方向的正交向量，让护卫横向移动

### 玩家目标选择惩罚
- **行6878-6880**：当护卫距离Boss≤236时，降低玩家瞄准优先级
  ```typescript
  } else if (enemy.role === 'escort' && eliteLinkDistance <= 236) {
    score -= 18 + activeEliteRecovery * 24 + crackEscortGap * 12 + eliteCrackRatio * 32;
  }
  ```
- **问题**：这个惩罚假设护卫会主动拦截，但实际护卫只是被动跟随

## 优化方案

### 方案A：增强护卫拦截行为（推荐）
**目标**：让护卫主动站在Boss和玩家之间，形成"人墙"

**实现**：
1. 在`updateStandardEnemy`等原型AI中添加护卫专属逻辑
2. 计算"Boss→玩家"连线上的拦截位置
3. 护卫优先移动到拦截位置，而非"肩膀位置"
4. 保持一定距离避免重叠（根据护卫数量分散）

**伪代码**：
```typescript
// 在 updateStandardEnemy 开头添加
if (enemy.role === 'escort' && battle.eliteAlive) {
  const eliteEnemy = this.getEliteEnemy(battle);
  if (eliteEnemy) {
    // 计算Boss→玩家方向
    const bossToPlayerDx = battle.playerX - eliteEnemy.x;
    const bossToPlayerDy = battle.playerY - eliteEnemy.y;
    const bossToPlayerDist = Math.max(1, Math.hypot(bossToPlayerDx, bossToPlayerDy));
    const dirX = bossToPlayerDx / bossToPlayerDist;
    const dirY = bossToPlayerDy / bossToPlayerDist;
    
    // 拦截位置：Boss前方60-90单位
    const interceptDistance = 70 + (enemy.id % 3) * 10; // 分散站位
    const interceptX = eliteEnemy.x + dirX * interceptDistance;
    const interceptY = eliteEnemy.y + dirY * interceptDistance;
    
    // 横向偏移避免重叠
    const orthoX = -dirY;
    const orthoY = dirX;
    const lateralOffset = ((enemy.id % 3) - 1) * 25; // -25, 0, +25
    const targetX = interceptX + orthoX * lateralOffset;
    const targetY = interceptY + orthoY * lateralOffset;
    
    // 移动到拦截位置
    const toDx = targetX - enemy.x;
    const toDy = targetY - enemy.y;
    const toDist = Math.max(1, Math.hypot(toDx, toDy));
    
    // 如果距离拦截位置较远，优先移动到位
    if (toDist > 20) {
      moveX = (toDx / toDist) * 1.2; // 高优先级权重
      moveY = (toDy / toDist) * 1.2;
    } else {
      // 到位后微调+面向玩家
      moveX = dirX * 0.3 + (toDx / toDist) * 0.2;
      moveY = dirY * 0.3 + (toDy / toDist) * 0.2;
    }
    
    // 跳过后续通用逻辑，直接应用移动
    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier = toDist > 20 ? 1.3 : 0.8; // 远距离加速，到位后减速
    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_WIDTH + 36);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_HEIGHT + 36);
    return; // 提前返回，不执行通用AI
  }
}
```

**优点**：
- 护卫会主动拦截玩家接近Boss
- 形成明确的"保护圈"，玩家需要先清理护卫
- 符合"护卫"的语义和玩家预期

**缺点**：
- 需要在每个原型AI函数中添加相同逻辑（standard/brute/skirmisher/ranged）
- 可能让Boss战过于困难（需要测试平衡）

### 方案B：修改破绽期剥离逻辑
**目标**：Boss破绽期护卫不剥离，而是更积极地拦截

**实现**：
修改`stabilizeEliteCrackEscort`（行7738-7781），将"横向剥离"改为"前压拦截"

**伪代码**：
```typescript
// 将行7770-7780的横向剥离逻辑改为：
const playerDx = battle.playerX - eliteEnemy.x;
const playerDy = battle.playerY - eliteEnemy.y;
const playerDistance = Math.max(1, Math.hypot(playerDx, playerDy));
const toPlayerX = playerDx / playerDistance;
const toPlayerY = playerDy / playerDistance;

// 向玩家方向前压，而非横向剥离
escort.hitOffsetX = clamp(escort.hitOffsetX + toPlayerX * (2.4 + crackRatio * 5.2), -16, 16);
escort.hitOffsetY = clamp(escort.hitOffsetY + toPlayerY * (2.4 + crackRatio * 5.2), -16, 16);
```

**优点**：
- 改动最小，只修改一个函数
- 破绽期护卫更积极保护Boss

**缺点**：
- 只影响破绽期，平时护卫仍然被动
- 治标不治本

### 方案C：创建专属护卫AI函数
**目标**：护卫完全独立的AI逻辑，不使用通用原型AI

**实现**：
1. 创建`updateEscortEnemy()`函数
2. 在`updateEnemies`中判断`role === 'escort'`时调用专属函数
3. 实现完整的护卫行为：拦截、跟随、协同

**优点**：
- 最灵活，可以实现复杂的护卫行为
- 不影响通用原型AI

**缺点**：
- 工作量最大
- 需要重新实现移动、攻击、协同等所有逻辑

## 推荐实施方案

**第一阶段（Week 1）**：方案A - 增强拦截行为
- 在`updateStandardEnemy`和`updateBruteEnemy`开头添加护卫拦截逻辑
- 测试3局Boss战，验证护卫是否有效保护Boss
- 如果Boss战过难，调整拦截距离（60→80）或护卫数量

**第二阶段（Week 3 Boss战收尾）**：方案B - 优化破绽期行为
- 修改`stabilizeEliteCrackEscort`，破绽期护卫前压而非剥离
- 测试破绽窗口的挑战性和可读性

**可选（如果Week 1测试效果不佳）**：方案C - 专属AI
- 创建`updateEscortEnemy()`，实现完整护卫行为
- 需要额外2-3天开发时间

## 测试验收标准
1. **拦截有效性**：护卫能站在Boss和玩家之间，玩家需要绕过或击杀护卫
2. **不成靶子**：Boss不会因为护卫站位不当而直接暴露
3. **挑战性平衡**：Boss战有挑战但不过分困难，护卫清理有策略空间
4. **视觉可读性**：玩家能清楚看到护卫的"保护圈"

## 相关代码位置
- `RunEngine.ts:4524-4527` - 护卫更新入口
- `RunEngine.ts:4678-4856` - updateStandardEnemy
- `RunEngine.ts:4858-5048` - updateBruteEnemy
- `RunEngine.ts:5050-5242` - updateSkirmisherEnemy
- `RunEngine.ts:5244-5486` - updateRangedEnemy
- `RunEngine.ts:7738-7781` - stabilizeEliteCrackEscort
- `RunEngine.ts:6878-6880` - 护卫目标选择惩罚
