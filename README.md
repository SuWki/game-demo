# PROJECT ORBITAL / 轨道计划
短局肉鸽自动射击原型。玩家负责走位和路线选择，角色自动攻击，五轮一局，最后由 Boss 收口。

## 30 秒看懂
这是一个短局肉鸽 demo：自动攻击 + 手动走位 + 三条路线成长。每局跑 5 轮，最后打 Boss，能看到 `暴击`、`穿透`、`穿梭` 三种不同成型方向。

## 直达链接
- 在线试玩：<https://suwki.github.io/game-demo/>
- 演示视频：待补充
- 仓库地址：<https://github.com/SuWki/game-demo>

## 项目亮点
- 自动攻击 + 手动走位。
- 五轮短局闭环。
- 三条路线分别偏向 `暴击` / `穿透` / `穿梭`。
- Boss 作为最终收口。
- 有 `qa:stable-smoke` 和 natural fullrun 回归链路。

## 我负责什么 / AI 负责什么
| 我负责 | AI 负责 |
| --- | --- |
| 目标设计、规则取舍、问题判断、验收 | 具体实现、拆分、迭代和修复 |

## 精选截图
### 首页
![首页](public/showcase-assets/home.png)

### 升级页
![升级页](public/showcase-assets/upgrade.png)

### 暴击收口
![crit payoff](public/showcase-assets/crit-payoff.png)

### 穿透收口
![pierce payoff](public/showcase-assets/pierce-payoff.png)

### 穿梭收口
![dash payoff](public/showcase-assets/dash-payoff.png)

### Boss 开场
![Boss signature](public/showcase-assets/boss-signature.png)

### 结果页
![结果页](public/showcase-assets/result-detail.png)

## 最小运行方式
- `npm install`
- `npm run dev`
