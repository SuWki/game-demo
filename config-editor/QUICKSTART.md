# 游戏配置编辑器 - 快速启动指南

## 一键启动

```bash
# 进入配置编辑器目录
cd config-editor

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

浏览器会自动打开 http://localhost:3000

## 测试流程

### 1. 启动编辑器

```bash
cd config-editor
npm run dev
```

### 2. 导入测试数据

将以下测试文件拖拽到编辑器的上传区域：

- `test-upgrades.xlsx` - 升级配置（包含有效和无效数据）
- `test-battleTemplates.xlsx` - 战斗模板
- `test-enemyArchetypes.xlsx` - 敌人原型

### 3. 测试功能

#### 编辑功能
- 点击任意单元格进行修改
- 修改过的单元格会显示黄色背景
- 按 Ctrl+Z 撤销修改

#### 验证功能
1. 点击"验证配置"按钮
2. 查看验证结果：
   - ✅ 绿色 = 验证通过
   - ❌ 红色 = 错误（必须修复）
   - ⚠️ 黄色 = 警告（建议修复）

#### 导出功能
- 点击"导出 JSON" - 生成游戏可用的 JSON 文件
- 点击"导出 Excel" - 生成 Excel 文件

#### 历史记录
- 点击"历史记录"查看已保存的版本
- 输入编号可回滚到指定版本

#### 预设模板
- 点击"加载模板"
- 选择配置类型（1/2/3）
- 一键加载示例数据

## 验证测试

### 测试有效数据

导入 `test-battleTemplates.xlsx` 或 `test-enemyArchetypes.xlsx`，点击验证应该显示：
```
✅ 所有验证通过！
```

### 测试无效数据

导入 `test-upgrades.xlsx`，点击验证应该显示：
```
❌ 验证失败（3 个错误，2 个警告）

❌ 第 3 行: name 不能为空
❌ 第 3 行: category 无效
❌ 第 3 行: rarity 无效
⚠️ 第 3 行: baseWeight 为 25，过高
⚠️ 第 3 行: damage 为负数
```

## 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录，可以：
- 直接双击 `dist/index.html` 在浏览器中打开
- 部署到 GitHub Pages
- 部署到任何静态文件服务器

## 常见问题

### Q: 浏览器没有自动打开？
A: 手动访问 http://localhost:3000

### Q: 拖拽文件没反应？
A: 确保文件是 .xlsx、.xls 或 .csv 格式

### Q: 验证结果不准确？
A: 确保导入的是正确的配置类型（系统会自动识别）

### Q: 如何添加自定义验证规则？
A: 编辑 `schemas.js` 文件，添加新的验证规则

## 项目结构

```
config-editor/
├── index.html              # 主页面
├── main.js                 # 主逻辑
├── schemas.js              # JSON Schema 验证规则
├── style.css               # 样式
├── vite.config.js          # Vite 配置
├── package.json            # 依赖配置
├── generate-test-data.mjs  # 测试数据生成脚本
├── test-upgrades.xlsx      # 测试数据（升级）
├── test-battleTemplates.xlsx  # 测试数据（战斗模板）
└── test-enemyArchetypes.xlsx  # 测试数据（敌人原型）
```

## 下一步

- [ ] 添加更多配置类型的验证规则
- [ ] 实现配置表之间的关联编辑
- [ ] 添加数据可视化图表
- [ ] 支持批量导入多个配置表

## 技术支持

如有问题，请查看：
- `README.md` - 完整文档
- `schemas.js` - 验证规则定义
- 浏览器控制台 - 查看日志和错误信息
