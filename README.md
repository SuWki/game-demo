# 短局节点推进自动射击原型

短局肉鸽自动射击原型 — 手动走位 × 自动攻击 × 三路线成长 × Boss收口。

## 设计理念
五轮短局内，玩家通过节点选择与三选一强化，沿暴击/穿透/穿梭三条路线构建差异化打法，最终由Boss战检验成型质量。核心设计目标：**路线不能一张成型，成型必须有检验**。

## 在线体验
- 试玩：<https://suwki.github.io/game-demo/>
- 仓库：<https://github.com/SuWki/game-demo>

## 系统特色
- **核心循环**：自动攻击 + 手动走位 + 节点选择 + 三选一强化，五轮一局
- **三条路线**：暴击（爆发收口）、穿透（弹道扩散）、穿梭（位移反击），各有独立成型节奏
- **四层阶段**：开始 → 过渡 → 成型 → 检验，控制路线牌不能一张成型
- **关卡差异化**：普通战、精英战、生存战、Boss战各有独立职责
- **异常节点**：distortion / routeWindow / bossEcho / hybrid 四种事件丰富局内变化

## 截图

| 首页 | 升级选择 |
|:---:|:---:|
| ![首页](public/showcase-assets/home.png) | ![升级页](public/showcase-assets/upgrade.png) |

| 暴击收口 | 穿透收口 | 穿梭收口 |
|:---:|:---:|:---:|
| ![暴击](public/showcase-assets/crit-payoff.png) | ![穿透](public/showcase-assets/pierce-payoff.png) | ![穿梭](public/showcase-assets/dash-payoff.png) |

| Boss开场 | 结果页 |
|:---:|:---:|
| ![Boss](public/showcase-assets/boss-signature.png) | ![结果](public/showcase-assets/result-detail.png) |

## 技术栈
- Phaser 3 + TypeScript + Vite
- GitHub Pages 自动部署

## 本地运行
```
npm install
npm run dev
```
