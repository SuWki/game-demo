# 游戏配置编辑器 (Game Config Editor)

一个纯前端的游戏配置可视化工具，支持 Excel/CSV 导入导出、在线编辑、实时数据验证、跨表引用检查、数值平衡性分析。

## 功能特性

### 核心功能
- ✅ **拖拽上传** - 支持 Excel (.xlsx, .xls) 和 CSV 文件
- ✅ **在线编辑** - 类似 Excel 的表格编辑体验
- ✅ **数据验证** - 基于 JSON Schema 的完整验证系统
- ✅ **导出功能** - 导出为 JSON 或 Excel 格式
- ✅ **修改对比** - 高亮显示修改过的单元格

### 高级功能
- ✅ **跨表引用检查** - 验证不同配置表之间的引用关系
- ✅ **数值平衡性分析** - 自动分析升级权重、难度曲线
- ✅ **版本历史** - 自动保存最近 10 个版本（localStorage）
- ✅ **预设模板** - 内置配置模板，一键加载
- ✅ **自动识别** - 自动识别配置类型（upgrades/battleTemplates/enemyArchetypes）
- ✅ **纯前端** - 无需后端，可离线使用

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录，可直接部署到任何静态文件服务器。

## 使用方法

### 1. 导入配置表

- 拖拽 Excel/CSV 文件到上传区域
- 或点击"导入文件"按钮选择文件
- 系统会自动识别配置类型

### 2. 编辑数据

- 直接点击单元格进行编辑
- 支持排序、筛选、分页
- 修改过的单元格会高亮显示（黄色背景）
- 支持撤销/重做（Ctrl+Z / Ctrl+Y）

### 3. 验证配置

点击"验证配置"按钮，系统会检查：

#### 基础验证
- 必需字段是否存在（id, name, category 等）
- 数值范围是否合理
- 枚举值是否有效
- 数组格式是否正确

#### 跨表引用验证
- battleTemplates 中的 enemyArchetypes 是否在 enemyArchetypes 表中存在
- upgrades 中的 routeId 是否有效

#### 数值平衡性分析
- 升级 baseWeight 是否过高/过低
- 稀有度与权重是否匹配
- 战斗模板难度曲线是否平滑
- 平均敌人血量/持续时间是否合理

### 4. 导出文件

- **导出 JSON** - 生成游戏可用的 JSON 配置文件
- **导出 Excel** - 生成 Excel 格式文件

### 5. 版本历史

- 点击"历史记录"按钮查看已保存的版本
- 自动保存最近 10 个版本
- 支持版本回滚

### 6. 预设模板

- 点击"加载模板"按钮
- 选择配置类型（upgrades/battleTemplates/enemyArchetypes）
- 一键加载示例数据

## 验证规则详解

### 升级配置 (upgrades)

| 字段 | 验证规则 |
|------|---------|
| id | 必填，只能包含小写字母、数字、横线 |
| name | 必填，不能为空 |
| category | 必填，只能是 `generic` 或 `route` |
| rarity | 可选，只能是 `common/uncommon/rare/epic/legendary` |
| effects | 必填，必须是数组且至少有一个元素 |
| selection.baseWeight | 可选，0-20 之间 |

### 战斗模板 (battleTemplates)

| 字段 | 验证规则 |
|------|---------|
| id | 必填，只能包含小写字母、数字、横线 |
| durationSec | 必填，1-300 秒 |
| enemyHp | 必填，必须大于 0 |
| winCondition.type | 必填，只能是 `kills/elite/survive` |
| spawnRule.pattern | 可选，只能是 `surround/pincers/lanes` |

### 敌人原型 (enemyArchetypes)

| 字段 | 验证规则 |
|------|---------|
| id | 必填，只能包含小写字母、数字、横线 |
| hpMultiplier | 必填，0.1-10 之间 |
| speedMultiplier | 必填，0.1-5 之间 |

## 技术栈

| 技术 | 用途 |
|------|------|
| **Vite** | 构建工具 |
| **SheetJS (xlsx)** | Excel/CSV 解析和导出 |
| **Tabulator** | 表格编辑组件 |
| **Ajv** | JSON Schema 验证 |

## 项目结构

```
config-editor/
├── index.html          # 主页面
├── main.js             # 主逻辑
├── schemas.js          # JSON Schema 验证规则
├── style.css           # 样式
├── vite.config.js      # Vite 配置
└── package.json        # 依赖配置
```

## 扩展验证规则

在 `schemas.js` 中添加新的验证规则：

```javascript
export const customSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string", pattern: "^[a-z0-9-]+$" },
      name: { type: "string", minLength: 1 },
      customField: { type: "number", minimum: 0, maximum: 100 }
    }
  }
};
```

然后在 `schemaMap` 中添加映射：

```javascript
export const schemaMap = {
  upgrades: upgradeSchema,
  battleTemplates: battleTemplateSchema,
  enemyArchetypes: enemyArchetypeSchema,
  custom: customSchema  // 添加新类型
};
```

## 部署

### GitHub Pages

```bash
npm run build
# 将 dist/ 目录推送到 gh-pages 分支
```

### 本地使用

直接双击 `dist/index.html` 即可在浏览器中打开（部分浏览器可能需要本地服务器）。

## 许可证

MIT
