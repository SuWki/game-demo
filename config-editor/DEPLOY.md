# 部署到 GitHub Pages

## 方法一：使用 gh-pages 分支（推荐）

### 1. 安装 gh-pages 工具

```bash
cd config-editor
npm install --save-dev gh-pages
```

### 2. 修改 package.json

在 `package.json` 中添加：

```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "homepage": "https://<你的用户名>.github.io/<仓库名>/config-editor"
}
```

### 3. 部署

```bash
npm run deploy
```

### 4. 访问

部署完成后，访问：
```
https://<你的用户名>.github.io/<仓库名>/config-editor
```

---

## 方法二：手动部署

### 1. 构建项目

```bash
cd config-editor
npm run build
```

### 2. 创建 gh-pages 分支

```bash
# 在 config-editor 目录下
cd dist
git init
git add .
git commit -m "Deploy to GitHub Pages"
git branch -M gh-pages
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin gh-pages --force
```

### 3. 启用 GitHub Pages

1. 打开 GitHub 仓库页面
2. 进入 Settings → Pages
3. Source 选择 `gh-pages` 分支
4. 点击 Save

### 4. 访问

等待几分钟，访问：
```
https://<你的用户名>.github.io/<仓库名>/
```

---

## 方法三：使用 Vercel/Netlify（最简单）

### Vercel

1. 访问 https://vercel.com
2. 导入你的 GitHub 仓库
3. 设置构建命令：`cd config-editor && npm run build`
4. 设置输出目录：`config-editor/dist`
5. 点击 Deploy

### Netlify

1. 访问 https://netlify.com
2. 拖拽 `config-editor/dist` 文件夹到部署区域
3. 完成！

---

## 验证部署

部署完成后，在浏览器中访问你的 GitHub Pages 网址，应该能看到：

1. ✅ 配置编辑器主页面
2. ✅ 拖拽上传区域
3. ✅ 导入文件按钮
4. ✅ 导出 JSON/Excel 按钮
5. ✅ 验证配置按钮

### 测试流程

1. 将 `test-upgrades.xlsx` 拖拽到上传区域
2. 点击"验证配置"查看验证结果
3. 编辑任意单元格
4. 点击"导出 JSON"下载文件

---

## 常见问题

### Q: 页面显示空白？
A: 检查 `vite.config.js` 中的 `base` 配置是否正确

### Q: 文件加载失败？
A: 确保使用的是相对路径（`base: './'`）

### Q: GitHub Pages 404？
A: 等待几分钟让 GitHub 完成部署

### Q: 如何更新？
A: 重新运行 `npm run deploy` 即可

---

## 自定义域名（可选）

如果你想使用自己的域名：

1. 在 GitHub Pages Settings 中添加自定义域名
2. 在 `dist/` 目录中添加 `CNAME` 文件
3. 配置 DNS 记录

---

## 部署检查清单

- [ ] 运行 `npm run build` 构建成功
- [ ] `dist/` 目录包含 `index.html` 和 `assets/`
- [ ] GitHub Pages 已启用
- [ ] 可以通过网址访问
- [ ] 拖拽上传功能正常
- [ ] 验证功能正常
- [ ] 导出功能正常
