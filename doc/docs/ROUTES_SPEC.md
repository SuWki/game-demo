# 三条流派系统说明

## 流派总览
当前项目只保留三条主要流派：
1. 暴击流（crit）
2. 穿透流（pierce）
3. 穿梭流（dash / weave）

这三条都必须满足：
- 能玩
- 能分化
- 能成型
- 能在真实整局里成立

### 当前操作前提
- 战斗内已经切到 `WASD / 方向键移动 + 自动射击`
- 因此三条路线都以“玩家主动走位”作为默认前提
- 尤其穿梭流，不再允许建立在自动摆动上

## 暴击流
### 当前状态
- 最健康
- 最成熟
- 不再是当前最薄的一条
- 当前前中期分化已加强，允许在开局通过不同 starter 更早出现“预热 / 爆点”两种读法

### 体验特征
- 前段更容易看出倾向
- 有明显的爆发 / 连击节奏
- 但不能再在 opening 第二拍过早锁方向
- 当前中段优先通过 starter -> bridge -> committed 的平滑坡度去分叉，late 再把“连发升温 / 爆伤收尾”兑现出来
- 当前后段允许用少量 rare payoff 把“爆发记忆点”再拉高，但必须继续留在 late / final
- 当前也允许通过低频 `redirect` 侧频内容把 build 临时掰向暴击，但它只应该作为 mid 的改道机会，不应盖过暴击本身的升温闭环

## 穿透流
### 当前状态
- 已经从“开始分叉”推进到“能看出两种走法”
- 已可退出第一优先，转入稳定性观察
- 如果以后回到单流派打磨，它是最可能重新接棒的一条
- 当前前中期分化已加强，开局不再只靠同一张 starter 指向贯穿路线

### 已有关键分叉
- 续链增程：贯穿链型
- 裂轨扇裂：清线 / 打面型
- 当前中段强化与事件会先给 bridge 型承接，再沿着这两种走法给出更明确的 committed / payoff 信号
- 当前后段允许用少量 rare payoff 把“打穿 / 铺面”的高记忆点拉开，但不能回流到 mid
- 当前也允许通过低频 `redirect` 侧轨内容把 build 从他路拉向贯穿，但这类内容必须是“真实改道窗口”，不能退化成普通 off-route starter

## 穿梭流
### 当前状态
- 两条主线已在真实整局中成立
- 可以正式退出第一优先
- 进入稳定性观察
- 当前前中期分化已加强，开局可更早区分“贴身换收益”与“稳住净帧”的进入读法

### 两条主线
1. 擦身收益线
2. 无伤滚雪球线

### 代表牌
- 擦身续拍
- 净帧循环
- weave_anchor
- weave_rethread

### 当前结论
- 擦身线整局成立
- 无伤线整局成立且更稳
- 后段 generic 回退只剩尾端小问题

### 当前补充约束
- 穿梭流必须依赖真实走位收益成立
- 其关键体验链为：擦身蓄能 -> 脉冲反打 -> 获得喘息 -> 再次换位
- 如果后续再调数值，优先看擦身半径、脉冲伤害、脉冲回复和减伤窗口，不要退回自动位移方案
- 当前中段内容应先把“贴身蓄能”与“稳态净帧”两种 bridge 读法拉开，late 再把两类 payoff 区分开，而不是只堆通用生存数值
- 当前中后段也允许通过少量 hybrid / pivot 内容保留转向诱惑，但不能让它压过穿梭路线本身的走位闭环
- 当前也允许通过低频 `redirect` 穿梭侧频把 build 从别路拉向换位反打，但它必须主要出现在 mid，并且不能把穿梭重新做成单纯的数值逃生线

## 2026-04-05 redirect / hybrid 口径补充
- `crit-sidechannel / pierce-sidechannel / dash-sidechannel` 的最新口径是：它们属于“真 redirect upgrade”，主要职责是作为 off-route 改道窗口，而不是继续充当当前主路线的普通 bridge 填充物。
- mid 阶段更推荐的 redirect 事件形态是：
  - `reroute-window`：`hold` + 2 个 off-route 选项
  - 目标是让玩家明确评估“现在转是否值得”，而不是在 redirect 事件里继续顺手点当前路线
- `relay-splice / route-handoff` 仍保留，但现在是次级入口：
  - 用于保留少量不可预测性
  - 不再作为 mid redirect 的主要承接方式
- redirect 承接的最新取舍原则：
  - upgrade redirect：强调“现在拿不亏”
  - reroute-window：强调“现在转得过去”
  - late payoff：继续留在 late / final，不前移到 mid 伪造转向价值

## 2026-04-09 1.0 第一阶段第 2 轮：构筑承接补充
### 当前 build 层次
- 本轮默认按以下层次继续收口：
  - `starter`
  - `committed`
  - `payoff`
  - `hybrid / redirect`
- 目标不是把三条流派做成更早锁死，而是让：
  - 前段更容易读到 starter
  - mid 更容易出现 committed 或 redirect 判断
  - late / final 更自然看到 payoff 与混搭收束

### upgrade 分发边界
- 当前三选一统一遵守：
  - 最多 `1` 张路线强化
  - 路线强化出现率低于通用强化
  - 路线强化从 `uncommon` 起跳
  - 同一个 `sourceId` 单局不重复出现
- 这意味着 upgrade 节点不再通过两三张 route 卡把 build 提前锁死；它们的价值更多来自：
  - 更高的品质
  - 更清楚的 bridge / redirect / payoff 承接

### redirect / hybrid 当前站位
- mid 的 upgrade / anomaly 仍是 redirect 的主要承接窗口。
- late 的 redirect 会保留，但更多承担：
  - 补救路径
  - 混搭转接
  - 收束前的再判断
- `finalPrep` 当前继续压住 redirect 专项卡，避免最终整备把路线再度打散。

### 本轮新增 route 向 upgrade 承接
- 暴击：
  - `火迹预压`
  - `冠火收束`
  - `借火切入`
- 穿透：
  - `并轨穿脊`
  - `裂层清账`
  - `借线破层`
- 穿梭：
  - `侧返蓄窗`
  - `残影回切`
  - `偏帧切入`
- 它们的职责切分是：
  - `bridge`：让 hinted / committed 更清楚
  - `payoff`：把 late / final 的兑现拉开
  - `redirect`：让 off-route 改道更像主动判断，而不是普通副路线填充
