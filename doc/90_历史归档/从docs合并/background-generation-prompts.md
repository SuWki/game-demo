# 地图背景资源生成提示词

## Codex 落地修正版（2026-05-07）

这份文档原本更像“通用 AI 出图提示词合集”，可以作为灵感参考，但不能直接照搬到当前项目。当前项目的战斗核心是弹幕读局、Boss 安全区、XP 拾取和三路线命中特效，因此背景资源必须遵守以下落地约束。

### 当前项目适配结论

1. 不建议直接使用 4K、PBR、高对比、电影光照类背景图。
   - 原因：这类图会抢走玩家、敌弹、安全区和路线命中特效的注意力。
   - 当前项目更需要“低干扰氛围层”，不是完整场景插画。

2. 优先使用 SVG 或透明 PNG，避免黑色背景图层。
   - SVG 可以和现有 `public/assets/preview-runtime/visual/` 管线保持一致。
   - 所有装饰层必须透明背景；只有真正作为最远景底图时才允许极暗底色。

3. 路线颜色必须与当前项目一致。
   - 暴击 `crit`：橙 / 金橙，偏爆闪与破绽。
   - 穿透 `pierce`：蓝 / 青，偏裂纹、贯穿、清线。
   - 穿梭 `dash`：绿 / 青绿，偏脉冲、相位、回切。
   - 不再使用“暴击红、Dash 橙”的旧映射，避免和危险/Boss 警告色混淆。

4. 背景不能解释玩法，玩法信息必须留给战斗层。
   - 背景可以提供方向感和场景氛围。
   - 不允许用背景大面积光束、全屏红层、强扫描线去表达路线触发。
   - Boss 安全区、敌弹、区外惩罚和命中特效的可读性优先级永远高于背景美术。

### 本轮实际生成并接入的背景资产

已改为项目内可直接使用的低干扰 SVG 资产：

1. `public/assets/preview-runtime/visual/bg-space-nebula.svg`
   - 远景深空星云氛围层，透明底，仅提供淡蓝紫雾与星点。

2. `public/assets/preview-runtime/visual/bg-floor-hex-tile.svg`
   - 160x160 六边形地面贴片，低亮度蓝线，用作普通战斗地面节奏。

3. `public/assets/preview-runtime/visual/bg-floor-holo-tile.svg`
   - 160x160 全息地面贴片，低亮度青绿网格，用于少量变化。

4. `public/assets/preview-runtime/visual/bg-debris-decal.svg`
   - 384x384 战斗痕迹 / 碎片透明贴花，用于打破地面重复感。

5. `public/assets/preview-runtime/visual/bg-boss-danger.svg`
   - Boss 危险氛围层，低透明红橙警戒，不直接遮挡安全区。

6. `public/assets/preview-runtime/visual/bg-boss-core.svg`
   - Boss 能量核心氛围层，低透明青紫核心，用于 `boss-lockdown` 等更偏封锁感的战斗。

### 后续生成规则

后续所有背景类素材必须先回答三个问题，再进入生成或接入：

1. 它是否会降低敌弹、XP 球、Boss 安全区、玩家血条的可读性？
2. 它是否能透明叠加，或以低透明度作为远景存在？
3. 它是否与当前项目的路线色、Boss 危险色和 UI 色保持一致？

如果任一答案是否定，先改提示词或降低资产使用强度，不直接接入项目。

## 使用说明
以下提示词适用于 Midjourney、Stable Diffusion、DALL-E 3 等AI图像生成工具。
建议使用 Midjourney v6 或 Stable Diffusion XL 以获得最佳效果。

---

## 1. 深空背景层（最远景）

### 提示词 A - 深蓝星云
```
deep space nebula background, dark blue and purple gradient,
distant stars scattered across, cosmic dust clouds,
space station debris silhouettes in far distance,
top-down perspective for game background,
seamless tileable texture, dark atmosphere,
color palette: deep blue (#0a1428), dark purple (#1a0e2e), cyan accents (#00d4ff),
high contrast, cinematic lighting, 4K resolution,
digital art, game asset, sci-fi space environment,
--ar 16:9 --tile --style raw --v 6
```

### 提示词 B - 战场废墟远景
```
destroyed space station ruins floating in deep space,
broken metal structures, shattered solar panels,
distant planet with rings in background,
dark blue nebula atmosphere, scattered starlight,
top-down orthographic view, game background layer,
seamless pattern, cyberpunk industrial aesthetic,
color grading: cold blue tones with warm orange highlights,
4K texture, tileable, game-ready asset,
--ar 16:9 --tile --style raw --v 6
```

---

## 2. 金属地板纹理（近景地面）

### 提示词 A - 六边形面板
```
futuristic hexagonal metal floor tiles, industrial sci-fi texture,
glowing cyan circuit lines between panels, worn metallic surface,
scratches and battle damage, holographic grid overlay,
top-down orthographic view, seamless tileable pattern,
dark gunmetal gray base (#2a3440), cyan glow (#00d4ff),
PBR texture with normal map details, 2048x2048 resolution,
game asset, space station floor, high detail,
--tile --style raw --v 6
```

### 提示词 B - 工业格栅地板
```
industrial metal grating floor texture, sci-fi space station,
diamond plate pattern with glowing energy conduits underneath,
worn steel surface, oil stains, laser burn marks,
top-down view, seamless tileable game texture,
dark metallic colors with cyan and orange accent lights,
high resolution 2048x2048, PBR ready, game asset,
--tile --style raw --v 6
```

### 提示词 C - 全息投影地板
```
holographic projection floor panels, transparent glass tiles,
glowing circuit patterns underneath, digital grid lines,
futuristic clean aesthetic with subtle wear,
top-down orthographic view, seamless pattern,
dark base with bright cyan (#00d4ff) and orange (#ff8844) lights,
sci-fi game environment, 2048x2048 texture,
--tile --style raw --v 6
```

---

## 3. 中景装饰元素（浮动物体）

### 提示词 A - 太空碎片集合
```
floating space debris collection, broken satellite parts,
shattered metal fragments, damaged solar panels,
energy crystal shards glowing cyan and orange,
various sizes from small to large, transparent PNG sprites,
top-down view, game asset pack, clean edges with alpha channel,
cyberpunk industrial style, detailed textures,
individual objects 128x128 to 512x512 pixels,
sci-fi game props, sprite sheet layout,
--style raw --v 6
```

### 提示词 B - 能量晶体和警告标志
```
glowing energy crystals and holographic warning signs,
cyan and orange crystal formations, floating hazard markers,
caution holograms, energy field generators,
top-down game sprites, transparent background PNG,
clean vector-like edges, game asset collection,
cyberpunk sci-fi aesthetic, various sizes,
sprite sheet format, 512x512px each element,
--style raw --v 6
```

### 提示词 C - 战斗痕迹装饰
```
battle damage decals, laser burn marks, explosion craters,
energy weapon scorch patterns, bullet holes in metal,
glowing molten edges, sparking electrical damage,
top-down view, transparent PNG overlays,
game decal assets, various sizes and shapes,
cyberpunk war-torn aesthetic, 256x256 to 512x512px,
--style raw --v 6
```

---

## 4. 粒子效果素材（动态元素）

### 提示词 A - 能量火花粒子
```
glowing particle effects sprite sheet, energy sparks and embers,
cyan and orange light particles, star dust trails,
various shapes: dots, streaks, bursts, halos,
transparent background, clean alpha channel,
sizes from 16px to 128px, game VFX sprite sheet,
sci-fi energy effects, bright glowing cores with soft falloff,
organized grid layout, 2048x2048 sprite atlas,
--style raw --v 6
```

### 提示词 B - 爆炸碎片粒子
```
explosion fragment particles, metal shrapnel sprites,
glowing debris chunks, energy shockwave rings,
various explosion stages, transparent PNG,
game VFX sprite sheet, particle system assets,
orange and cyan energy colors, motion blur effects,
16px to 256px sizes, organized sprite atlas,
--style raw --v 6
```

### 提示词 C - 光迹和轨迹效果
```
light trail effects, energy beam streaks, dash afterimages,
glowing motion trails in cyan and orange,
various lengths and curves, transparent background,
game VFX assets, sprite sheet format,
soft glow with bright core, additive blending ready,
32px to 512px lengths, organized layout,
--style raw --v 6
```

---

## 5. 环境光效（氛围层）

### 提示词 A - 扫描线和全息效果
```
holographic scan line effects, digital grid overlays,
glowing circuit patterns, data stream visualizations,
transparent PNG overlays, various densities,
cyan (#00d4ff) glowing lines on transparent background,
game UI overlay assets, screen effects,
1920x1080 resolution, tileable patterns,
--style raw --v 6
```

### 提示词 B - 光晕和光束
```
volumetric light beams, god rays, spotlight cones,
glowing halos and lens flares, energy field effects,
transparent PNG with additive blending,
cyan and orange light colors, soft gradients,
game lighting effects, various sizes and intensities,
512x512 to 1024x1024 pixels,
--style raw --v 6
```

---

## 6. Boss战特殊背景

### 提示词 A - 危险区域背景
```
intense boss battle arena background,
red warning lights, emergency klaxons visual effect,
damaged space station interior, sparking electrical systems,
top-down view, dramatic lighting, high contrast,
dark red (#2e0a0a) and orange (#ff4444) danger atmosphere,
seamless tileable, 4K resolution, game background,
--ar 16:9 --tile --style raw --v 6
```

### 提示词 B - 能量核心环境
```
massive energy core reactor background,
glowing cyan energy rings, pulsing power conduits,
futuristic technology architecture, holographic displays,
top-down perspective, epic scale, dramatic lighting,
cyan (#00d4ff) and purple (#8844ff) energy colors,
seamless pattern, 4K game background, boss arena,
--ar 16:9 --tile --style raw --v 6
```

---

## 色彩方案参考

### 主色调
- **深蓝背景**: #0a1428
- **深紫背景**: #1a0e2e
- **金属灰**: #2a3440

### 强调色
- **青色光效**: #00d4ff (主要UI和能量)
- **橙色光效**: #ff8844 (Dash和爆炸)
- **红色警告**: #ff4444 (危险和失败)
- **金色胜利**: #ffd700 (胜利和奖励)

### 路线特定色
- **暴击路线**: #ff4466 (红色)
- **穿透路线**: #44ddff (青色)
- **Dash路线**: #ff8844 (橙色)

---

## 后期处理建议

### Photoshop/GIMP 调整
1. **对比度增强**: 提高20-30%以增强视觉冲击
2. **色阶调整**: 压暗暗部，提亮高光
3. **锐化**: 适度锐化以增强细节
4. **色彩平衡**: 偏向冷色调（蓝/青）
5. **添加噪点**: 1-2%噪点增加质感

### 导出设置
- **格式**: PNG-24 (带Alpha通道)
- **分辨率**:
  - 背景层: 2048x2048 或 4096x2048
  - 装饰元素: 512x512
  - 粒子效果: 256x256 或更小
- **压缩**: 使用 TinyPNG 或 pngquant 压缩
- **命名规范**:
  - `bg_space_nebula_01.png`
  - `floor_hexagon_metal_01.png`
  - `debris_satellite_part_01.png`
  - `particle_spark_cyan_01.png`

---

## 实现优先级

### P0 - 立即需要
1. 深空背景 (提示词 1A)
2. 金属地板 (提示词 2A)
3. 基础粒子 (提示词 4A)

### P1 - 短期补充
4. 浮动碎片 (提示词 3A)
5. 光效素材 (提示词 5A)
6. 额外地板变体 (提示词 2B, 2C)

### P2 - 长期优化
7. Boss战背景 (提示词 6A, 6B)
8. 完整粒子库 (提示词 4B, 4C)
9. 环境装饰 (提示词 3B, 3C)

---

## 测试建议

生成资源后，在游戏中测试：
1. **可读性**: 确保玩家和敌人清晰可见
2. **对比度**: 背景不应过于抢眼
3. **性能**: 监控帧率，必要时降低分辨率
4. **平铺效果**: 检查接缝是否明显
5. **色彩一致性**: 与UI和特效颜色协调

---

**生成时间**: 2026-05-07
**适用工具**: Midjourney v6, Stable Diffusion XL, DALL-E 3
**目标分辨率**: 1920x1080 游戏窗口
