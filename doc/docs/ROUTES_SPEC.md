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

## 2026-04-10 1.0 第一阶段第 3 轮：构筑分化 / replay 动机补厚
### 当前取舍
- 本轮不再回到“补 starter / 骨架承接”，而是继续加厚：
  - `hybrid`
  - `redirect`
  - `rare payoff`
  - `late payoff`
  - replay 动机
- 目标不是单纯把数值做大，而是让 run 与 run 之间更容易读成不同打法结果。

### route 中后段分化口径
- `crit`
  - committed 之后应更明显读成“升温后爆点兑现”而不是单纯高伤。
  - 新增 `借爆并焰` 这类 redirect 入口，用来让别路 build 临时切向暴击尾段，但不替代暴击本身的升温闭环。
- `pierce`
  - committed 之后应更明显读成“清线 / 穿线 / 扩面 / 回响收束”。
  - 新增 `借层并轨` 这类 redirect 入口，强调“现在改向穿透不亏”，而不是只给普通副路线 starter。
- `dash`
  - committed 之后应更明显读成“换位 / 回摆 / 反打 / 回线收束”。
  - 新增 `借窗回返` 这类 redirect 入口，让转向穿梭更像走位打法变化，而不是单纯的数值逃生。

### generic replay 内容口径
- generic late-payoff 现在继续允许承载：
  - 混搭收束
  - 稀有尾段补厚
  - 不同 run 之间的 replay 差异
- 但它们仍然必须遵守：
  - 不提前回流到 mid 伪造 payoff
  - 不破坏“三选一最多 1 张路线强化”
  - 不把 late 收尾重新做回纯数值堆高

### anomaly / route 关系补充
- `hybrid` anomaly 本轮继续承担：
  - 并轨试错
  - 中后段混搭
  - “这局为什么和上一局不一样”的低频解释
- `bossEcho` anomaly 本轮继续承担：
  - Boss 前的预读
  - 尾段收束方式的提前分岔
  - replay 层面的高记忆点
- 它们都不应退回普通 event 的泛补给语义。

## 2026-04-11 1.0 第一阶段第 4 轮：高记忆点 closeout / 收束显性化
### 当前取舍
- 本轮不再主要回答“有没有 hybrid / redirect / rare payoff 入口”，而是回答：
  - committed 之后为什么越玩越不像彼此
  - 这一局为什么会这样收
  - redirect / hybrid 转完以后为什么更像另一种玩法结果
- 因此本轮继续沿现有 upgrade / anomaly / node 载体补 closeout，不引入新系统。

### committed 后的 closeout 口径
- `crit`
  - 现在继续按“续热 -> 爆点 -> 首领前短窗预读”收束。
  - 新增 closeout 承接：
    - `灼链追爆`
    - `灼冠预读`
    - `爆点追收`
  - 目标是让后段更容易读成“把升温一路顶成爆点兑现”。
- `pierce`
  - 现在继续按“拆线 -> 扩面 -> 清账回收”收束。
  - 新增 closeout 承接：
    - `裂幕归账`
    - `裂屏预账`
    - `裂面清账`
  - 目标是让后段更容易读成“清线后把贯穿收益收回来”，而不是只剩高伤。
- `dash`
  - 现在继续按“换位 -> 回摆 -> 反打追收”收束。
  - 新增 closeout 承接：
    - `回线追拍`
    - `回线窥影`
    - `回线反压`
  - 目标是让后段更容易读成“靠回线与反打把尾段追回来”，而不是单纯苟活。

### redirect / hybrid / bossEcho 边界补充
- redirect 仍然主要站在 mid：
  - 负责“现在改向不亏”
  - 不负责替代 late closeout 本身
- hybrid 现在更明确承担：
  - 尾段并轨试错
  - mixed closeout 的理由
  - “为什么这一局不是纯单路线”的解释
- bossEcho 现在更明确承担：
  - Boss 前读法外泄
  - route-specific closeout 的提前分岔
  - 收束显性化，而不是 Boss 专项调参

### 当前仍保留的近似实现
- docs 已经写清 committed 后该怎么读，但内容量仍不是“无论哪局都一定读得出来”。
- 如果某局没有撞到 late carrier、route-specific bossEcho 或 high-memory anomaly，它仍可能被读成“主路线已经有了，但玩法差异只读出一半”。
- 因此本轮是把 closeout 载体补齐，不是宣布玩法读法问题已经完全解决。
