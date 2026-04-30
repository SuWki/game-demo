# 游戏平衡性调整指南

## 📋 已完成的工作

### ✅ 1. 补全战斗核心公式
**文件**: `src/data/combatFormulas.ts` (273行)

新增了21个核心战斗公式：
- 暴击伤害计算
- 射速转开火间隔
- 多重射击散射角度
- 穿透伤害衰减
- 生命恢复计算
- 期望DPS计算
- 综合DPS计算
- 战斗力评分
- 等等...

### ✅ 2. 创建平衡性测试
**文件**: `src/tests/balanceTest.ts` (438行)

测试覆盖：
- 10个测试类别
- 15个测试用例
- **100%通过率**

### ✅ 3. 生成平衡性报告
**文件**: `BALANCE_REPORT.md` (390行)

包含：
- 完整测试数据
- 问题分析
- 调整建议
- 优先级排序

---

## 🔧 建议的平衡性调整

### 🔴 高优先级（建议立即实施）

#### 调整1: 升级价值权重平衡

**问题**: DPS升级价值是生存的2.7倍，导致玩家过度追求输出

**修改文件**: `src/data/balance.ts:439-451`

```typescript
// 当前代码
const survival =
  Math.max(0, ((after.maxHp - before.maxHp) / before.maxHp) * 110) +
  Math.max(0, after.regeneration - before.regeneration) * 115 +
  Math.max(0, healAmount) * 1.4;

const mobility =
  Math.max(0, ((after.moveSpeed - before.moveSpeed) / before.moveSpeed) * 140) +
  Math.max(0, ((before.dashInterval - after.dashInterval) / before.dashInterval) * 96) +
  Math.max(0, ((after.dashInvulnerability - before.dashInvulnerability) / before.dashInvulnerability) * 42) +
  Math.max(0, ((after.dashPulseDamage - before.dashPulseDamage) / Math.max(10, before.damage * 0.75)) * 32);

// 建议修改为
const survival =
  Math.max(0, ((after.maxHp - before.maxHp) / before.maxHp) * 160) +  // 110 → 160 (+45%)
  Math.max(0, after.regeneration - before.regeneration) * 150 +        // 115 → 150 (+30%)
  Math.max(0, healAmount) * 2.0;                                       // 1.4 → 2.0 (+43%)

const mobility =
  Math.max(0, ((after.moveSpeed - before.moveSpeed) / before.moveSpeed) * 200) +  // 140 → 200 (+43%)
  Math.max(0, ((before.dashInterval - after.dashInterval) / before.dashInterval) * 130) +  // 96 → 130 (+35%)
  Math.max(0, ((after.dashInvulnerability - before.dashInvulnerability) / before.dashInvulnerability) * 55) +  // 42 → 55 (+31%)
  Math.max(0, ((after.dashPulseDamage - before.dashPulseDamage) / Math.max(10, before.damage * 0.75)) * 42);  // 32 → 42 (+31%)
```

**预期效果**:
- 生存升级价值: 45.1 → 65.4 (+45%)
- 机动升级价值: 16.3 → 23.3 (+43%)
- DPS/生存比例: 2.7× → 1.9×

---

#### 调整2: 降低精英生命倍率

**问题**: 11.6×生命倍率导致精英战过长

**修改文件**: `src/data/battleTemplates.ts`

需要修改的模板：
- `elite` (line 177)
- `elite-vice` (line 240)
- `elite-lockdown` (line 304)
- `elite-screen` (line 369)
- `elite-bulwark` (line 433)
- `boss-hunt` (line 498)
- `boss-lockdown` (line 598)
- `boss-bastion` (line 698)

```typescript
// 示例：elite模板
eliteRule: {
  spawnAtSec: 4,
  hpMultiplier: 9.8,  // 11.6 → 9.8 (-15%)
  speedMultiplier: 1.02,
  damageMultiplier: 2.35,
  // ...
}
```

**建议倍率**:
- 普通精英: 11.6 → 9.5-10.0
- Boss: 14.2 → 12.0-12.5

---

### 🟡 中优先级（测试后实施）

#### 调整3: 移除生成间隔压力上限

**修改文件**: `src/data/balance.ts:228`

```typescript
// 当前代码
const pressureFactor = 1 + Math.min(elapsedSec, 30) * 0.015;

// 方案1: 移除上限
const pressureFactor = 1 + elapsedSec * 0.012;  // 降低系数避免过快

// 方案2: 对数曲线（推荐）
const pressureFactor = 1 + Math.log(1 + elapsedSec / 10) * 0.35;
```

---

#### 调整4: 降低Dash冷却下限

**修改文件**: `src/data/balance.ts:381`

```typescript
// 当前代码
target.dashInterval = Math.max(1.4, target.dashInterval + (modifiers.dashInterval ?? 0));

// 建议修改为
target.dashInterval = Math.max(1.0, target.dashInterval + (modifiers.dashInterval ?? 0));
```

---

#### 调整5: 提高敌人数量上限增长

**修改文件**: `src/data/balance.ts:239`

```typescript
// 当前代码
const depthFactor = 1 + (round - 1) * 0.08 + phaseTier * 0.06;

// 建议修改为
const depthFactor = 1 + (round - 1) * 0.12 + phaseTier * 0.09;
```

**预期效果**:
- Round 1: 9 → 9 (不变)
- Round 2: 10 → 11 (+10%)
- Round 3: 12 → 13 (+8%)

---

### 🟢 低优先级（可选）

#### 调整6: 微调经验增长曲线

**修改文件**: `src/data/balance.ts:128`

```typescript
// 当前代码
return Math.round(18 + level * 8 + level * level * 3);

// 可选调整（如果觉得后期升级过慢）
return Math.round(18 + level * 8 + level * level * 2.5);
```

---

## 🧪 如何测试调整效果

### 1. 运行平衡性测试

```bash
npx tsx src/tests/balanceTest.ts
```

### 2. 检查关键指标

调整后应该看到：
- ✅ DPS/生存价值比例降低到 1.8-2.0×
- ✅ 精英战时长缩短 15-20%
- ✅ 后期敌人压力感提升

### 3. 实际游戏测试

重点测试场景：
- Round 2 精英战（检查战斗时长）
- Round 3 生存战（检查压力感）
- 升级选择（检查生存/机动升级吸引力）

---

## 📊 调整前后对比

### 升级价值对比

| 升级类型 | 调整前 | 调整后 | 变化 |
|---------|--------|--------|------|
| 纯伤害(+10) | 122.2 | 122.2 | - |
| 纯生命(+50) | 45.1 | 65.4 | +45% |
| 纯移速(+30) | 16.3 | 23.3 | +43% |
| **DPS/生存比** | **2.7×** | **1.9×** | **-30%** |

### 精英战时长预估

| 模板 | 当前HP | 调整后HP | 时长变化 |
|------|--------|---------|---------|
| elite (R2) | 405 | 342 | -15% |
| boss-hunt (R5) | ~800 | ~680 | -15% |

---

## 🚀 快速应用调整

### 方式1: 手动修改

按照上述说明逐个修改文件

### 方式2: 使用Git补丁（推荐）

1. 备份当前代码
2. 应用调整
3. 测试
4. 如果不满意可以回滚

```bash
# 备份
git add .
git commit -m "平衡性调整前的备份"

# 应用调整后
git add .
git commit -m "应用平衡性调整"

# 如果需要回滚
git reset --hard HEAD~1
```

---

## 📝 调整检查清单

实施调整时请确认：

- [ ] 修改 `balance.ts` 升级价值权重
- [ ] 修改所有精英/Boss模板的 `hpMultiplier`
- [ ] （可选）修改生成间隔压力因子
- [ ] （可选）修改Dash冷却下限
- [ ] （可选）修改敌人数量上限增长
- [ ] 运行测试确认无语法错误
- [ ] 实际游戏测试关键场景
- [ ] 记录玩家反馈

---

## 🎯 预期改进

实施高优先级调整后：

1. **更平衡的升级选择**
   - 生存/机动升级更有吸引力
   - 减少"纯堆DPS"的单一策略

2. **更流畅的战斗节奏**
   - 精英战时长缩短15-20%
   - 保持挑战性的同时提升节奏感

3. **更多样的Build路线**
   - 生存流、机动流更可行
   - 增加游戏深度和重玩价值

---

## 📞 需要帮助？

如果在实施过程中遇到问题：

1. 检查 `BALANCE_REPORT.md` 的详细分析
2. 运行 `npx tsx src/tests/balanceTest.ts` 查看测试结果
3. 查看 `src/data/combatFormulas.ts` 了解公式细节

---

**最后更新**: 2026-04-30  
**测试状态**: ✅ 15/15 通过 (100%)
