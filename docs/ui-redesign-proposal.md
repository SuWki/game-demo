# UI重设计方案

## 问题修复

### ✅ 结果页面错位修复
**问题**: 小屏幕下（<980px）结果页面布局错位
**修复**: 在 `src/style.css:3751` 的媒体查询中添加：
```css
.commercial-result-aside {
  width: 100%;
  max-width: 600px;
  justify-self: center;
}

.commercial-result-stack {
  grid-template-columns: 1fr;
}
```

---

## 开始页面重设计

### 当前问题
- 过于商业化/企业风格
- 缺乏游戏感和动态感
- 视觉层次不够清晰

### 新设计方案：太空战斗风格

#### 视觉主题
- **风格**: 赛博朋克 + 太空战斗 + 全息投影
- **色调**: 深蓝/青色主色调，橙色/红色点缀
- **动效**: 扫描线、粒子、光晕、脉冲

#### 布局结构
```
┌─────────────────────────────────────────┐
│  [扫描线动画]                            │
│                                         │
│  ╔═══════════════════════════════╗      │
│  ║   PROJECT ORBITAL             ║      │
│  ║   轨道计划                     ║      │
│  ╚═══════════════════════════════╝      │
│                                         │
│  [全息飞船投影 - 旋转动画]               │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ ▶ 开始作战                   │        │
│  │   WASD移动 空格冲刺          │        │
│  └─────────────────────────────┘        │
│                                         │
│  统计: 出击 12 次 | 胜利 5 次            │
│                                         │
│  [设置] [记录]                          │
└─────────────────────────────────────────┘
```

#### 关键元素

**1. 标题区域**
- 大标题: "PROJECT ORBITAL" 
- 副标题: "轨道计划 - 自主战斗无人机系统"
- 字体: 等宽字体，带扫描线效果
- 颜色: 青色 (#00d4ff) 发光效果

**2. 中心视觉**
- 3D飞船模型（或2D精灵）
- 缓慢旋转（360度/30秒）
- 周围环绕3个轨道环
- 粒子效果：小光点沿轨道移动

**3. 主按钮**
- 大号"开始作战"按钮
- 悬停时：边框发光 + 轻微放大
- 点击时：脉冲扩散效果
- 下方显示操作提示

**4. 统计信息**
- 半透明面板
- 图标 + 数字
- 悬停显示详细信息

**5. 背景**
- 深色星空渐变
- 缓慢移动的星点
- 远处的行星剪影

---

## 结束页面重设计

### 当前问题
- 信息过载，卡片太多
- 缺乏胜利/失败的情感表达
- 数据展示不够直观

### 新设计方案：战斗报告风格

#### 胜利页面
```
┌─────────────────────────────────────────┐
│  ╔═══════════════════════════════╗      │
│  ║  ✓ 任务完成                    ║      │
│  ║    MISSION COMPLETE            ║      │
│  ╚═══════════════════════════════╝      │
│                                         │
│  [金色粒子爆发动画]                      │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ 存活时间: 12:34              │        │
│  │ 击杀数: 156                  │        │
│  │ 路线: 暴击流派 (已成型)       │        │
│  └─────────────────────────────┘        │
│                                         │
│  [升级时间轴 - 横向滚动]                 │
│                                         │
│  ▶ 再来一局    返回机库                  │
└─────────────────────────────────────────┘
```

#### 失败页面
```
┌─────────────────────────────────────────┐
│  ╔═══════════════════════════════╗      │
│  ║  ✗ 任务失败                    ║      │
│  ║    MISSION FAILED              ║      │
│  ╚═══════════════════════════════╝      │
│                                         │
│  [红色裂纹扩散动画]                      │
│                                         │
│  失败原因: 耐久归零                      │
│  存活时间: 08:12                        │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ 最高伤害: 234                │        │
│  │ 击杀数: 89                   │        │
│  │ 路线进度: 穿透流派 (已出倾向) │        │
│  └─────────────────────────────┘        │
│                                         │
│  ▶ 重新开始    返回机库                  │
└─────────────────────────────────────────┘
```

#### 关键改进

**1. 情感化设计**
- 胜利：金色 + 上升光柱 + 胜利音效
- 失败：红色 + 裂纹效果 + 低沉音效

**2. 简化信息层级**
- 核心数据（3-4项）大字号显示
- 次要数据折叠或小字号
- 移除不重要的统计

**3. 升级回顾**
- 时间轴形式展示所有升级
- 图标 + 名称
- 悬停显示详情
- 按路线颜色分类

**4. 快速操作**
- 大号"再来一局"按钮
- 快捷键提示（R重开，ESC返回）

---

## 地图背景重设计

### 当前问题
- 背景过于简单
- 缺乏深度感
- 与游戏主题不符

### 生成提示词

#### Midjourney/Stable Diffusion 提示词

**基础背景（深空环境）**
```
deep space battlefield background, dark blue nebula, distant stars, 
sci-fi space station debris floating, metallic fragments, 
top-down view, game background, seamless tileable texture,
dark atmosphere, cyberpunk color palette (cyan, orange, purple),
high contrast, 4K resolution, digital art style,
--ar 16:9 --style raw --v 6
```

**战斗区域地板（近景）**
```
futuristic space station floor tiles, hexagonal metal panels,
glowing cyan circuit lines, worn industrial texture,
top-down orthographic view, game tileable texture,
dark metallic surface with subtle scratches and wear,
holographic grid overlay, sci-fi game asset,
seamless pattern, 2048x2048px, PBR ready,
--tile --style raw --v 6
```

**装饰元素（中景）**
```
floating space debris, broken satellite parts, energy crystals,
glowing cyan and orange accents, holographic warning signs,
top-down game sprites, sci-fi props collection,
transparent PNG, game asset pack, clean edges,
cyberpunk industrial style, 512x512px each,
--style raw --v 6
```

**粒子效果素材**
```
glowing particle effects, energy sparks, star dust,
cyan and orange light trails, explosion fragments,
transparent background, sprite sheet, game VFX assets,
various sizes (16px to 128px), clean alpha channel,
sci-fi game effects pack,
--style raw --v 6
```

### 实现建议

**分层结构**
1. **背景层（最远）**: 深空星云，缓慢滚动
2. **中景层**: 浮动碎片，中速移动
3. **地板层**: 金属地板纹理，静态
4. **装饰层**: 光效、扫描线，快速闪烁
5. **前景层**: 粒子效果，动态生成

**性能优化**
- 背景使用大图平铺（2048x2048）
- 碎片使用对象池复用
- 粒子数量限制在200个以内
- 使用GPU加速的Shader效果

**色彩方案**
- 主色：深蓝 (#0a1428) → 深紫 (#1a0e2e)
- 强调色：青色 (#00d4ff)、橙色 (#ff8844)
- 危险色：红色 (#ff4444)

---

## 实现优先级

### P0 - 立即修复
- [x] 结果页面错位修复

### P1 - 短期优化（1-2天）
- [ ] 开始页面重设计
  - [ ] 更新HTML结构
  - [ ] 重写CSS样式
  - [ ] 添加动画效果
- [ ] 结束页面简化
  - [ ] 精简信息卡片
  - [ ] 添加胜利/失败动画
  - [ ] 优化按钮布局

### P2 - 中期优化（3-5天）
- [ ] 地图背景资源生成
  - [ ] 使用AI生成基础素材
  - [ ] 在Photoshop中调整和优化
  - [ ] 导出为游戏资源
- [ ] 背景系统实现
  - [ ] 多层滚动视差
  - [ ] 粒子系统
  - [ ] 动态光效

---

## 技术实现要点

### 开始页面动画
```typescript
// 在 MainMenuScene.create() 中添加
this.add.particles(640, 360, 'star', {
  speed: { min: 20, max: 50 },
  scale: { start: 1, end: 0 },
  alpha: { start: 0.8, end: 0 },
  lifespan: 3000,
  frequency: 100,
  blendMode: 'ADD'
});

// 飞船旋转动画
this.tweens.add({
  targets: shipSprite,
  angle: 360,
  duration: 30000,
  repeat: -1,
  ease: 'Linear'
});
```

### 结束页面动画
```typescript
// 胜利特效
if (result.outcome === 'victory') {
  this.cameras.main.flash(500, 255, 215, 0, false);
  this.add.particles(640, 360, 'particle', {
    speed: { min: 100, max: 300 },
    scale: { start: 1, end: 0 },
    tint: 0xffd700,
    lifespan: 1000,
    quantity: 50
  });
}

// 失败特效
if (result.outcome === 'defeat') {
  this.cameras.main.shake(300, 0.01);
  // 添加裂纹效果
}
```

---

## 参考风格

- **游戏**: Hades（结束页面）、FTL（开始页面）、Risk of Rain 2（统计展示）
- **UI风格**: 赛博朋克2077、星际争霸2、质量效应
- **动画**: 全息投影、扫描线、粒子爆发

---

**更新时间**: 2026-05-06  
**状态**: 方案待确认
