# GPT Image生成素材对接文档

**目标用户**: GPT-4 with image generation (DALL-E)  
**用途**: 批量生成游戏视觉素材  
**交付格式**: PNG图片（透明背景）  
**项目**: 节点式自动射击游戏（太空射击、Roguelike）

---

## 📋 任务总览

需要生成 **17个游戏素材**，分为3个优先级：
- **P0 高优先级**: 10个（敌人3个 + Boss 2个 + 击中特效5个）
- **P1 中优先级**: 4个（弹道尾迹3个 + 充能光环1个）
- **P2 低优先级**: 3个（屏幕闪光3个）

## 2026-05-05 Codex 落地状态

**落地原则**：本项目运行时已经使用 `public/assets/preview-runtime/visual/*.svg` 作为预览素材管线，因此本轮没有强行按本文原始建议生成 PNG，而是按既有几何科幻 SVG 风格补齐缺口。所有新素材都使用透明背景，避免再次出现黑色背景图层。

**已生成并放入项目**：
- P0：`enemy-brute.svg`、`enemy-skirmisher.svg`、`enemy-ranged.svg`、`boss-hunt-main.svg`、`boss-lockdown-main.svg`、`fx-hit-normal.svg`、`fx-hit-crit.svg`、`fx-hit-pierce.svg`、`fx-hit-dash.svg`、`fx-explosion-small.svg`
- P1：`fx-trail-crit.svg`、`fx-trail-pierce.svg`、`fx-trail-dash.svg`、`fx-charge-glow.svg`
- P2：`fx-screen-flash-white.svg`、`fx-screen-flash-red.svg`、`fx-screen-flash-gold.svg`

**已接入运行时**：
- `src/scenes/BootScene.ts`：预加载全部 17 个新 SVG。
- `src/scenes/GameScene.ts`：实际接入三类普通敌、两类 Boss、路线弹道尾迹、命中特效、低血爆裂提示和玩家短时充能光环。
- 屏幕闪光素材本轮仅预加载保留，不直接铺满战斗画面，避免影响 Boss 安全区、弹幕和敌我识别。

**后续验收重点**：
- 实机确认所有新素材无黑底、无多余文字、无安全区遮挡。
- 实机确认 `pierce` 蓝色裂纹和 `crit / dash` 命中特效是否比原程序化特效更好读。
- 如果素材造成遮挡，优先调透明度和尺寸，不恢复玩家周围常驻线条或大字提示。

**自动验证**：`npm run build`、`node tools/qa-runtime-preview-assets.mjs`、`node tools/qa-current-version.mjs` 已通过，当前无 console error。

---

## 🎨 统一风格要求

### 核心视觉风格
所有素材必须遵循以下风格：

```
Style Guidelines:
- Geometric, angular design language (多边形、六边形为主)
- Sci-fi space shooter aesthetic (科幻太空射击风格)
- Dark background (#0b0c24 to #1a0e16) (深色背景)
- Glowing outlines and energy effects (发光轮廓和能量效果)
- Top-down perspective (俯视视角)
- Clean vector-style suitable for game sprites (清晰的矢量风格)
- High contrast between elements (高对比度)
- Gradient fills (linear or radial) (渐变填充)
- Soft glow/bloom effects (柔和光晕效果)
```

### 配色规范

**敌对单位**:
- 主色: 深红橙色 (#ff5b49, #6b1224)
- 高光: 暖橙色 (#ffd58a, #ffbd66)
- 描边: 橙黄色 (#ff7b4c)

**精英/Boss单位**:
- 主色: 紫色系 (#d36cff, #3d176e) 或 深红色 (#ff493f, #6b1224)
- 高光: 亮紫/橙色 (#fff1ff, #ffd58a)

**友方/能量效果**:
- 青蓝色: #50d7ff, #6ee7ff, #11609a
- 白色高光: #f7fbff, #ffffff

**路线特征色**:
- 暴击(Crit): 橙色 (#ffcb74, #ff8c6a)
- 穿透(Pierce): 蓝色 (#8fd8ff, #50d7ff)
- 冲刺(Dash): 绿色 (#8cffdf, #7ae7ac)

---

## 📦 P0 高优先级素材（10个）

### 批次1: 敌人类型（3个）

#### 1. enemy-brute.svg
**文件名**: `enemy-brute.svg` 或 `enemy-brute.png`

**提示词**:
```
A top-down view game sprite of a heavy armored enemy unit for a space shooter game. Geometric design with thick, bulky hexagonal body shape. Large and imposing silhouette, wider than tall. Color scheme: dark red-orange gradient (#ff5b49 to #6b1224) with warm orange accents (#ffd58a). Thick glowing outline (5-6px) in orange-yellow (#ffbd66). Heavy armor plating details with angular segments. Central dark core with subtle glow effect. Symmetrical design, facing upward. Sci-fi mechanical aesthetic with sharp edges. Dark background (#0b0c24). Clean vector-style illustration suitable for SVG conversion. 256x256 pixels, centered composition. Transparent background.
```

**规格**:
- 尺寸: 256x256px
- 格式: PNG (透明背景)
- 特征: 六边形、厚重、体型最大

---

#### 2. enemy-skirmisher.svg
**文件名**: `enemy-skirmisher.svg` 或 `enemy-skirmisher.png`

**提示词**:
```
A top-down view game sprite of a fast agile enemy unit for a space shooter game. Sleek triangular/arrow-shaped body design, sharp and aerodynamic. Smaller and nimble silhouette, elongated forward-pointing shape. Color scheme: bright red-pink gradient (#ff5b49 to #ff2f3d) with cyan-blue accents (#50d7ff). Thin glowing outline (3-4px) in light blue (#6ee7ff). Streamlined hull with minimal details, speed-focused aesthetic. Small central energy core with bright glow. Asymmetric wing-like protrusions or fins. Facing upward, dynamic forward-leaning posture. Sci-fi fighter jet aesthetic with smooth curves. Dark background (#0b0c24). Clean vector-style illustration suitable for SVG conversion. 256x256 pixels, centered composition. Transparent background.
```

**规格**:
- 尺寸: 256x256px
- 格式: PNG (透明背景)
- 特征: 三角形、流线型、体型最小

---

#### 3. enemy-ranged.svg
**文件名**: `enemy-ranged.svg` 或 `enemy-ranged.png`

**提示词**:
```
A top-down view game sprite of a ranged artillery enemy unit for a space shooter game. Rectangular/square-based body with rounded corners, stable platform design. Medium size, balanced proportions with weapon emplacements visible. Color scheme: deep red gradient (#ff5b49 to #6b1224) with purple accents (#d36cff). Medium glowing outline (4-5px) in orange (#ffbd66). Weapon turrets or cannons protruding from sides or top. Central targeting sensor or radar dish. Symmetrical design with technical details like vents or panels. Facing upward, stationary artillery platform aesthetic. Sci-fi military bunker/turret aesthetic with angular geometry. Dark background (#0b0c24). Clean vector-style illustration suitable for SVG conversion. 256x256 pixels, centered composition. Transparent background.
```

**规格**:
- 尺寸: 256x256px
- 格式: PNG (透明背景)
- 特征: 矩形、炮台、有明显武器

---

### 批次2: Boss类型（2个）

#### 4. boss-hunt-main.svg
**文件名**: `boss-hunt-main.svg` 或 `boss-hunt-main.png`

**提示词**:
```
A top-down view game sprite of a hunter-type boss enemy for a space shooter game. Large predatory design with aggressive forward-swept wings or claws. Asymmetric, dynamic composition suggesting motion and aggression. Color scheme: dark red to crimson gradient (#ff493f to #6b1224) with bright orange highlights (#ffd58a). Thick glowing outline (6-8px) in hot orange (#ff7b4c). Multiple weapon pods or blade-like protrusions. Large central eye or sensor array with intense glow. Organic-mechanical hybrid aesthetic, beast-like silhouette. Facing upward, menacing predator posture. Sci-fi alien hunter aesthetic with sharp talons and energy trails. Dark background (#0b0c24). Clean vector-style illustration suitable for SVG conversion. 256x256 pixels, centered composition, larger and more complex than regular enemies. Transparent background.
```

**规格**:
- 尺寸: 256x256px
- 格式: PNG (透明背景)
- 特征: 掠食者、前掠翼、不对称、比普通敌人大1.5倍

---

#### 5. boss-lockdown-main.svg
**文件名**: `boss-lockdown-main.svg` 或 `boss-lockdown-main.png`

**提示词**:
```
A top-down view game sprite of a lockdown-type boss enemy for a space shooter game. Large fortress-like design with defensive barriers and shield generators. Symmetrical octagonal or circular core with extending barrier arms. Color scheme: dark purple to blue gradient (#3d176e to #11609a) with cyan energy fields (#50d7ff). Thick glowing outline (6-8px) in bright cyan (#6ee7ff). Multiple shield emitter nodes around the perimeter. Central command core with layered defensive plating. Geometric patterns suggesting energy barriers or force fields. Facing upward, stationary fortress aesthetic. Sci-fi defensive station aesthetic with angular shields and energy grids. Dark background (#0b0c24). Clean vector-style illustration suitable for SVG conversion. 256x256 pixels, centered composition, larger and more complex than regular enemies. Transparent background.
```

**规格**:
- 尺寸: 256x256px
- 格式: PNG (透明背景)
- 特征: 堡垒、八边形、护盾发生器、对称

---

### 批次3: 击中特效（5个）

#### 6. fx-hit-normal.svg
**文件名**: `fx-hit-normal.svg` 或 `fx-hit-normal.png`

**提示词**:
```
A game VFX sprite for a normal hit impact effect in a space shooter. Simple white energy burst with radial rays. Circular explosion shape with 6-8 short spikes radiating outward. Color scheme: bright white core (#ffffff) fading to light blue edges (#e0f5ff). Soft glow effect around the burst. Geometric, clean design. Dark transparent background. Suitable for overlay blending. 64x64 pixels, centered. Simple and readable at small size. Vector-style illustration. Transparent background.
```

**规格**:
- 尺寸: 64x64px
- 格式: PNG (透明背景)
- 用途: 普通击中特效

---

#### 7. fx-hit-crit.svg
**文件名**: `fx-hit-crit.svg` 或 `fx-hit-crit.png`

**提示词**:
```
A game VFX sprite for a critical hit impact effect in a space shooter. Large orange energy explosion with cross-shaped rays. Four prominent spikes forming a plus/cross pattern. Color scheme: bright orange core (#ffcb74) to deep orange edges (#ff8c6a). Intense glow effect. Additional smaller diagonal rays between main spikes. Geometric, sharp design suggesting high damage. Dark transparent background. Suitable for overlay blending. 128x128 pixels, centered. Bold and impactful. Vector-style illustration. Transparent background.
```

**规格**:
- 尺寸: 128x128px
- 格式: PNG (透明背景)
- 用途: 暴击击中特效

---

#### 8. fx-hit-pierce.svg
**文件名**: `fx-hit-pierce.svg` 或 `fx-hit-pierce.png`

**提示词**:
```
A game VFX sprite for a pierce hit impact effect in a space shooter. Blue energy crack/fracture pattern spreading outward. Jagged lightning-like lines radiating from center. Color scheme: bright cyan core (#8fd8ff) to deep blue edges (#50d7ff). Crystalline fracture aesthetic. 4-6 irregular crack lines. Geometric but organic-looking. Dark transparent background. Suitable for overlay blending. 96x96 pixels, centered. Sharp and penetrating visual. Vector-style illustration. Transparent background.
```

**规格**:
- 尺寸: 96x96px
- 格式: PNG (透明背景)
- 用途: 穿透击中特效

---

#### 9. fx-hit-dash.svg
**文件名**: `fx-hit-dash.svg` 或 `fx-hit-dash.png`

**提示词**:
```
A game VFX sprite for a dash/pulse hit impact effect in a space shooter. Green energy ripple/wave expanding outward. Circular wave pattern with 2-3 concentric rings. Color scheme: bright green core (#8cffdf) to teal edges (#7ae7ac). Smooth, flowing aesthetic suggesting motion. Soft glow between rings. Geometric circular design. Dark transparent background. Suitable for overlay blending. 96x96 pixels, centered. Dynamic and flowing visual. Vector-style illustration. Transparent background.
```

**规格**:
- 尺寸: 96x96px
- 格式: PNG (透明背景)
- 用途: 冲刺击中特效

---

#### 10. fx-explosion-small.svg
**文件名**: `fx-explosion-small.svg` 或 `fx-explosion-small.png`

**提示词**:
```
A game VFX sprite for a small explosion effect in a space shooter. Red-orange energy burst with irregular shape. Asymmetric explosion with 5-7 flame-like protrusions. Color scheme: bright orange-yellow core (#ffd58a) to deep red edges (#ff5b49). Energetic, chaotic shape. Small debris particles around edges. Geometric but organic explosion aesthetic. Dark transparent background. Suitable for overlay blending. 128x128 pixels, centered. Quick, punchy explosion for enemy death. Vector-style illustration. Transparent background.
```

**规格**:
- 尺寸: 128x128px
- 格式: PNG (透明背景)
- 用途: 普通敌人击杀爆炸

---

## 📦 P1 中优先级素材（4个）

### 批次4: 弹道尾迹（3个）

#### 11. fx-trail-crit.svg
**文件名**: `fx-trail-crit.svg` 或 `fx-trail-crit.png`

**提示词**:
```
A game VFX sprite for a critical hit bullet trail particle in a space shooter. Small orange spark/ember particle. Teardrop or diamond shape with soft edges. Color scheme: bright orange (#ffcb74) fading to transparent. Soft glow effect. Very simple, minimal design. Dark transparent background. Suitable for overlay blending and particle systems. 32x32 pixels, centered. Designed to be spawned in multiples along bullet path. Vector-style illustration. Transparent background with alpha gradient.
```

**规格**:
- 尺寸: 32x32px
- 格式: PNG (透明背景，带alpha渐变)
- 用途: 暴击子弹尾迹粒子

---

#### 12. fx-trail-pierce.svg
**文件名**: `fx-trail-pierce.svg` 或 `fx-trail-pierce.png`

**提示词**:
```
A game VFX sprite for a pierce bullet trail particle in a space shooter. Small blue energy streak particle. Elongated oval or dash shape with soft edges. Color scheme: bright cyan (#8fd8ff) fading to transparent. Soft glow effect. Very simple, minimal design. Dark transparent background. Suitable for overlay blending and particle systems. 32x32 pixels, centered. Designed to be spawned in multiples along bullet path. Vector-style illustration. Transparent background with alpha gradient.
```

**规格**:
- 尺寸: 32x32px
- 格式: PNG (透明背景，带alpha渐变)
- 用途: 穿透子弹尾迹粒子

---

#### 13. fx-trail-dash.svg
**文件名**: `fx-trail-dash.svg` 或 `fx-trail-dash.png`

**提示词**:
```
A game VFX sprite for a dash bullet trail particle in a space shooter. Small green energy wisp particle. Circular or soft blob shape with very soft edges. Color scheme: bright green (#8cffdf) fading to transparent. Soft glow effect. Very simple, minimal design. Dark transparent background. Suitable for overlay blending and particle systems. 32x32 pixels, centered. Designed to be spawned in multiples along bullet path. Vector-style illustration. Transparent background with alpha gradient.
```

**规格**:
- 尺寸: 32x32px
- 格式: PNG (透明背景，带alpha渐变)
- 用途: 冲刺子弹尾迹粒子

---

### 批次5: 充能光环（1个）

#### 14. fx-charge-glow.svg
**文件名**: `fx-charge-glow.svg` 或 `fx-charge-glow.png`

**提示词**:
```
A game VFX sprite for a charge/power-up glow ring effect in a space shooter. Circular energy ring with soft inner and outer edges. Thin ring shape (donut/torus). Color scheme: bright white-cyan (#e0f5ff) with soft glow. Very soft, diffuse edges for overlay blending. Geometric perfect circle. Dark transparent background. Suitable for overlay blending around bullets or units. 64x64 pixels, centered. Designed to pulse/scale in animation. Vector-style illustration. Transparent background with strong alpha gradient.
```

**规格**:
- 尺寸: 64x64px
- 格式: PNG (透明背景，强alpha渐变)
- 用途: 充能状态光环

---

## 📦 P2 低优先级素材（3个）

### 批次6: 屏幕闪光（3个）

#### 15. fx-screen-flash-white.png
**文件名**: `fx-screen-flash-white.png`

**提示词**:
```
A full-screen flash overlay texture for a game screen effect. Pure white (#ffffff) in the center, fading to transparent at edges. Radial gradient from center to edges. Very soft, diffuse gradient. No hard edges. Suitable for additive blending over game screen. 960x540 pixels (16:9 aspect ratio). Designed to flash briefly on screen for impact feedback. Simple gradient texture, no details or patterns. Transparent PNG with alpha channel.
```

**规格**:
- 尺寸: 960x540px (全屏)
- 格式: PNG (透明背景，径向渐变)
- 用途: 白色屏幕闪光（暴击击杀）

---

#### 16. fx-screen-flash-red.png
**文件名**: `fx-screen-flash-red.png`

**提示词**:
```
A full-screen flash overlay texture for a game screen effect. Bright red (#ff6b6b) in the center, fading to transparent at edges. Radial gradient from center to edges. Very soft, diffuse gradient. No hard edges. Suitable for additive blending over game screen. 960x540 pixels (16:9 aspect ratio). Designed to flash briefly on screen for damage feedback. Simple gradient texture, no details or patterns. Transparent PNG with alpha channel.
```

**规格**:
- 尺寸: 960x540px (全屏)
- 格式: PNG (透明背景，径向渐变)
- 用途: 红色屏幕闪光（玩家受伤）

---

#### 17. fx-screen-flash-gold.png
**文件名**: `fx-screen-flash-gold.png`

**提示词**:
```
A full-screen flash overlay texture for a game screen effect. Bright gold-yellow (#ffd774) in the center, fading to transparent at edges. Radial gradient from center to edges. Very soft, diffuse gradient. No hard edges. Suitable for additive blending over game screen. 960x540 pixels (16:9 aspect ratio). Designed to flash briefly on screen for victory feedback. Simple gradient texture, no details or patterns. Transparent PNG with alpha channel.
```

**规格**:
- 尺寸: 960x540px (全屏)
- 格式: PNG (透明背景，径向渐变)
- 用途: 金色屏幕闪光（Boss击败）

---

## 📋 生成清单（用于核对）

### P0 高优先级（10个）
- [ ] enemy-brute.png (256x256)
- [ ] enemy-skirmisher.png (256x256)
- [ ] enemy-ranged.png (256x256)
- [ ] boss-hunt-main.png (256x256)
- [ ] boss-lockdown-main.png (256x256)
- [ ] fx-hit-normal.png (64x64)
- [ ] fx-hit-crit.png (128x128)
- [ ] fx-hit-pierce.png (96x96)
- [ ] fx-hit-dash.png (96x96)
- [ ] fx-explosion-small.png (128x128)

### P1 中优先级（4个）
- [ ] fx-trail-crit.png (32x32)
- [ ] fx-trail-pierce.png (32x32)
- [ ] fx-trail-dash.png (32x32)
- [ ] fx-charge-glow.png (64x64)

### P2 低优先级（3个）
- [ ] fx-screen-flash-white.png (960x540)
- [ ] fx-screen-flash-red.png (960x540)
- [ ] fx-screen-flash-gold.png (960x540)

---

## 📦 交付要求

### 文件格式
- **格式**: PNG
- **背景**: 透明（alpha通道）
- **色彩模式**: RGBA
- **位深度**: 32位

### 命名规范
- 严格按照上述文件名命名
- 小写字母 + 连字符
- 扩展名 `.png`

### 尺寸规范
- 严格按照指定尺寸生成
- 图形居中对齐
- 留出适当边距（不要贴边）

### 质量要求
- 清晰的轮廓
- 适当的发光效果
- 与现有素材风格一致
- 适合游戏内叠加渲染

---

## 🎯 批量生成建议

### 方式1: 按批次生成（推荐）
1. **批次1**: 敌人类型（3个）- 最重要
2. **批次2**: Boss类型（2个）- 最重要
3. **批次3**: 击中特效（5个）- 最重要
4. **批次4**: 弹道尾迹（3个）- 次要
5. **批次5**: 充能光环（1个）- 次要
6. **批次6**: 屏幕闪光（3个）- 可选

### 方式2: 按优先级生成
1. **P0**: 先生成全部10个高优先级素材
2. **P1**: 再生成4个中优先级素材
3. **P2**: 最后生成3个低优先级素材（可选）

---

## ✅ 质量检查清单

生成后请检查：
- [ ] 文件名完全匹配规范
- [ ] 尺寸正确
- [ ] 背景透明
- [ ] 图形居中
- [ ] 颜色符合规范
- [ ] 风格与现有素材协调
- [ ] 轮廓清晰
- [ ] 发光效果适当

---

## 📮 交付方式

生成完成后，请提供：
1. **所有PNG文件**（按命名规范）
2. **生成数量统计**（P0: X个, P1: X个, P2: X个）
3. **任何需要说明的特殊情况**

---

## 🔄 迭代说明

如果某个素材不满意，可以：
1. 调整提示词中的细节描述
2. 生成多个版本供选择
3. 标注版本号（如 `enemy-brute-v2.png`）

---

**文档版本**: v1.0  
**创建日期**: 2026-05-05  
**目标引擎**: GPT-4 with DALL-E  
**项目**: 节点式自动射击游戏
