# Gitee Pages 部署指南

## 快速部署步骤

### 1. 访问你的 Gitee 仓库

打开浏览器访问：https://gitee.com/suwki/auto-shooter-demo

### 2. 进入 Pages 设置

1. 在仓库页面顶部菜单，点击 **服务**
2. 在下拉菜单中选择 **Gitee Pages**

### 3. 配置 Pages

在 Gitee Pages 设置页面：

| 设置项 | 值 |
|--------|-----|
| **部署分支** | `codex-dev` |
| **部署目录** | `config-editor/dist` |
| **强制 HTTPS** | ✅ 勾选 |

点击 **更新** 按钮开始部署。

### 4. 等待部署完成

- 首次部署可能需要 1-3 分钟
- 部署状态会显示在页面上
- 完成后会显示访问地址

### 5. 访问你的配置编辑器

部署完成后，访问地址：
```
https://suwki.gitee.io/auto-shooter-demo/
```

---

## 验证部署

访问上述网址后，你应该能看到：

1. ✅ 配置编辑器主页面
2. ✅ 拖拽上传区域
3. ✅ 导入文件、导出 JSON/Excel、验证配置等按钮
4. ✅ 暗色主题的表格编辑器

### 测试流程

1. 将 `test-upgrades.xlsx` 文件拖拽到上传区域
2. 等待数据加载完成
3. 点击"验证配置"查看验证结果
4. 编辑任意单元格
5. 点击"导出 JSON"下载文件

---

## 更新部署

每次修改代码后，需要重新部署：

```bash
# 1. 重新构建
cd config-editor
npm run build

# 2. 提交更改
cd ..
git add config-editor/dist/
git commit -m "update: 更新配置编辑器"

# 3. 推送到 Gitee
git push origin codex-dev
```

然后在 Gitee Pages 页面点击 **更新** 按钮重新部署。

---

## 常见问题

### Q: 页面显示 404？
A: 检查部署目录是否正确填写为 `config-editor/dist`

### Q: 页面空白？
A: 检查 `vite.config.js` 中的 `base` 配置是否为 `/auto-shooter-demo/config-editor/`

### Q: 文件加载失败？
A: 确保已运行 `npm run build` 并且 `dist/` 目录存在

### Q: 如何自定义域名？
A: 在 Gitee Pages 设置中添加自定义域名，并配置 DNS

---

## 部署检查清单

- [ ] 代码已推送到 `codex-dev` 分支
- [ ] `config-editor/dist/` 目录存在且包含 `index.html`
- [ ] Gitee Pages 部署分支设置为 `codex-dev`
- [ ] 部署目录设置为 `config-editor/dist`
- [ ] 强制 HTTPS 已勾选
- [ ] 可以通过网址访问
- [ ] 拖拽上传功能正常
- [ ] 验证功能正常
- [ ] 导出功能正常

---

## 项目结构

```
auto-shooter-demo/
├── config-editor/          # 配置编辑器
│   ├── dist/               # 构建输出（部署到此目录）
│   │   ├── index.html
│   │   └── assets/
│   ├── src/
│   └── package.json
├── public/data/            # 游戏配置数据
├── src/                    # 游戏源代码
└── tools/                  # 工具脚本
```

---

## 联系方式

如有问题，请通过以下方式联系：
- Gitee Issues: https://gitee.com/suwki/auto-shooter-demo/issues
- Email: suwki@example.com
