# Playwright 浏览器自检报告

日期: 2026-05-28
工具: Playwright Chromium headless
视口: 1280x720
游戏尺寸: 960x540

---

## 测试结果概览

| 类别 | 通过 | 警告 |
|------|------|------|
| 页面加载与基础渲染 | 4 | 1 |
| 主菜单检查 | 6 | 0 |
| 游戏流程检查 | 3 | 1 |
| Debug API 功能检查 | 5 | 0 |
| 数据完整性检查 | 2 | 1 |
| 资源与性能检查 | 4 | 1 |
| 响应式与兼容性检查 | 2 | 0 |
| **总计** | **27** | **5** |

> 0 项失败，27 项通过，5 项警告。

---

## 发现的问题

### 1. [严重] ConfigLoader JSON 数据文件路径错误

**文件**: `src/systems/ConfigLoader.ts:66`
**代码**: `fetch(`/data/${name}.json`)`
**问题**: Vite 配置中 `base: '/game-demo/'`，但 fetch 使用绝对路径 `/data/...`，导致 404。
**影响**: 每次页面加载产生 4 次 404 请求（upgrades.json / battleTemplates.json / enemyArchetypes.json / balance.json）。
**当前兜底**: `getFallback()` 从 TypeScript 源码 import 数据，功能不受影响，但产生大量 console.warn 和网络错误。
**修复建议**: 使用 `import.meta.env.BASE_URL` 拼接路径:

```ts
const base = (import.meta as any).env?.BASE_URL || '/';
const response = await fetch(`${base}data/${name}.json`);
```

### 2. [中等] FPS 约 53，略低于 55 流畅线

**现象**: 在 headless Chrome 环境下测得 FPS 约 53。
**可能原因**: 
- Headless Chrome 的软件渲染性能损耗
- 粒子系统或持续 update 循环开销
- Enemy 实体数量多时的碰撞检测
**建议**: 在真实浏览器(非 headless)中复测；考虑加入 `scene.update()` 中的性能 profiler 埋点。

### 3. [提示] Canvas 尺寸因 Scale.FIT 随视口变化

**现象**: 视口 1280x720 时 canvas 实际渲染尺寸不是 960x540。
**原因**: `Phaser.Scale.FIT` 模式自动缩放适应视口，属于正常行为。
**建议**: 如需要精确控制，可在测试中固定视口比例。

### 4. [提示] window.Phaser 未暴露到全局

**现象**: `Phaser.GAMES` 不可访问（ESM 导入不挂到 window）。
**影响**: 不影响功能。如需从控制台调试，可显式挂载:

```ts
// main.ts 中
(window as any).__PHASER_GAME__ = game;
```

### 5. [提示] 节点地图用 Phaser Canvas 渲染而非 DOM

**现象**: 自检脚本未在 DOM 中找到 `.node-map-layer` 类元素。
**说明**: 节点地图通过 Phaser Graphics API 在 Canvas 上绘制，属于框架选择，非问题。
**建议**: 如后续需要 E2E 测试节点选择，可通过 `__pilotDebug` API 读取当前 runState 来间接验证。

---

## 可复用的 Playwright 自检脚本

以下脚本已创建，可随时运行:

- `scripts/playwright-self-check.mjs` — 综合自检（27 项检查）
- `scripts/comprehensive-check.mjs` — 深层分析（资源路径、API 可用性）
- `scripts/analyze-404.mjs` — 404 资源统计
- `scripts/check-assets.mjs` — 纹理加载验证

运行方式:
```bash
# 先启动 Vite
npx vite --host 0.0.0.0 --port 5174

# 新终端运行自检
node scripts/playwright-self-check.mjs
```

---

## 建议改进项

| 优先级 | 改进项 | 文件 | 工作量 |
|--------|--------|------|--------|
| P0 | ConfigLoader 路径拼接 BASE_URL | `src/systems/ConfigLoader.ts:66` | 5 分钟 |
| P1 | 暴露 game 实例到 window 便于调试 | `src/main.ts` 末尾 | 1 分钟 |
| P2 | 生产环境 JSON 数据预加载 | 考虑构建时内联 JSON | 按需评估 |
| P3 | 添加 FPS 监控 / 性能 profiler | `GameScene.ts` 中 | 按需评估 |
