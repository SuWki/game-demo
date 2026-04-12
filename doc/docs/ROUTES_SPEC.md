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

## 2026-04-11 1.0 第一阶段第 6 轮：残余漂移压缩 / committed 稳定成型
### 当前取舍
- 本轮不再继续加大 high-memory closeout，也不再把重点放在“redirect 入口够不够多”，而是继续压：
  - ordinary sample 的 committed retention
  - dominant route 在 mid-late 的持续承接
  - `crit -> unformed`
  - `pierce -> dash/hinted`
- 因此本轮继续沿现有 upgrade / anomaly / node / selector carrier 做保守扩写，不引入新系统。

### committed retention 当前口径
- `crit`
  - ordinary sample 里应更稳定地读成“续热 -> 压线 -> 爆点兑现”。
  - 本轮新增 committed retention carrier：
    - `压线留焰`
    - `压线余焰`
  - 它们的职责不是制造更亮的爆点，而是让 `crit` 不再轻易掉回 `unformed / 只剩高伤标签`。
- `pierce`
  - ordinary sample 里应更稳定地读成“拆线 -> 扩面 -> 清账回收”。
  - 本轮新增 committed retention carrier：
    - `拆账铺面`
    - `拆账余缝`
  - 它们的职责不是继续堆穿透数值，而是把“拆开、铺开、收回来”的中后段读法站稳。
- `dash`
  - 继续读成“换位 -> 回摆 -> 反打 -> 回线追回”。
  - 本轮只轻量补入：
    - `回线留窗`
  - 目标是维持 `dash` 的稳定承接，而不是让它继续吸走 `crit / pierce` 的 ordinary sample。

### soft closeout / hybrid / bossEcho / redirect 边界补充
- `soft closeout / committed retention`
  - 本轮负责 ordinary sample 的中后段承接稳压。
  - 它们要让 dominant route 在没撞 strongest late carrier 时也不至于散掉。
- `hybrid`
  - 本轮继续负责“为什么这局尾段会这样接下去”的解释。
  - `压线余焰 / 拆账余缝` 更偏 retain，而不是把 mixed closeout 再做成一次高记忆点爆闪。
- `bossEcho`
  - 继续负责 Boss 前预读和尾段提前分岔。
  - 本轮新增 `尾段预录`，只补一层“当前打法最容易散掉的那一拍先漏出来”的 support，不替代 Boss 调参，也不让 bossEcho 常态化。
- `redirect`
  - 现有 `借焰续拍 / 借层回收 / 借位追回` 已足够承担 follow-through。
  - 由于 round6 的主问题是 ordinary sample 噪音过高，本轮没有继续扩 redirect 新入口，而是转为压低 committed / hinted ordinary sample 里的 redirect 抢味。

### 当前仍保留的近似实现
- docs 已明确 ordinary sample 里的 dominant route 需要被持续承接，但没有要求用新系统硬锁路线；因此本轮仍只做 carrier 与 selector 校准。
- 这意味着：
  - `crit` 现在更难掉回 `unformed`
  - `pierce` 更难漂到 `dash/hinted`
  - 但少数 run 仍可能停在“已经 hinted / 刚开始站稳”，而不是稳定一路推到 matured
- 因此本轮解决的是 residual drift 压缩，不是宣布 committed retention 已完全收口。

## 2026-04-12 1.0 第一阶段第 8 轮候选签收复检：commit timing 前推 / continuity 验收
### 当前取舍
- 当前仍按 round8 候选签收处理，而不是 round9。最新阶段文档尚未落盘更晚轮次，因此仍以 round8 的 continuity / commit timing 收口为准。
- 若旧摘要与当前 docs 冲突，本节开始统一以后续顺序覆盖：
  - 最新阶段文档
  - 最新 [PROJECT_STATUS.md](./PROJECT_STATUS.md)
  - 最新 [DEV_ISSUE_LOG.md](./DEV_ISSUE_LOG.md)
  - [ROADMAP_1_0.md](./ROADMAP_1_0.md)
  - [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md)

### route 侧本轮实现
- `pierce`
  - 不再把问题解释回 starter 漂移或 late closeout，而是直接前推 `starter -> bridge -> committed`
  - 本轮继续补的是：
    - `pierce-core / pierce-rail / pierce-seamline`
    - `pierce-fan / pierce-relay-spine / pierce-seamkeep`
    - `pierce-ledger-hold / pierce-seam-anchor`
  - 目标不是更早硬锁，而是让 ordinary sample 里“starter 先成立，再由 bridge / hold 自然站到 committed”更稳定
- `crit`
  - 只做极轻量 bridge surfacing 保护，不把本轮重新变成 `crit` 专项轮
  - 当前 residual 不再是 off-route reroute，而是自然 rerun 里仍可能在死亡前停在 `crit hinted`

### 最新验证结论
- 浏览器 route-flow rerun 中：
  - `pierce`
    - 当前样本为 `routeId = pierce / buildStage = matured`
    - `firstCommitStage = mid`
    - `firstCommitPick = upgrade:pierce-seamkeep`
    - 未再复现 `pierce -> dash hinted`
  - `crit`
    - 当前样本仍可能以 `routeId = crit / buildStage = hinted / firstCommitStage = null` 结束
    - 但没有重新被带去别路线；当前更像“commit 机会数不足”，不是 route continuity 被抢走
- 因此本轮 route 侧更接近签收，但 full signoff 仍未完成：
  - `pierce commit timing` 已明显前推
  - `crit` 的自然 rerun 仍有 hinted 结束样本
  - 真正挡住 round8 签收的主因已经回到 `boss-bastion / fireline`

## 2026-04-12 1.0 第一阶段第 8 轮候选：opening-to-mid continuity 收口 / no-focus starter 漂移清扫
### 当前取舍
- 本轮不再继续补 high-memory closeout，也不再扩 redirect / bossEcho 新入口，而是继续把残余问题收窄到：
  - no-focus opening starter 的 first beat continuity
  - hinted dominant route 在 mid 的 bridge surfacing
  - `pierce` 是否还会自然漂成 `dash hinted`
- 因此本轮继续沿现有 upgrade / anomaly / node / selector carrier 做保护性清扫，不引入新系统。

### opening-to-mid continuity 当前口径
- `crit`
  - 本轮目标不是更早锁死，而是让 opening starter 后的第二拍更容易接到本线 bridge。
  - 因此：
    - `续热点火 / 余热描边` 这类 bridge 更偏“续热 + 压线 + 少量续航”
    - hinted early-mid 的 `levelUp` 可以更积极地把 `crit` bridge 浮上来
    - 但 `redirect hold` 仍保留，且不能把 `crit` 再次拖成 off-route committed
- `pierce`
  - 本轮目标不是靠 redirect 把它拉回正轨，而是让 no-focus opening 更容易先看到 `pierce` starter。
  - 因此：
    - `拆线起幅 / 拆缝续程 / 拆线定幅` 继续承担 opening-to-mid continuity
    - `levelUp` 在 no-focus opening 可以更容易出现 `pierce` starter，但 mid no-focus 不会被写成强制 committed
    - 若当前 rerun 仍在 finalBattle 才 commit，应优先视为 commit timing 残余，而不是重新视为 `dash hinted` 漂移
- `dash`
  - 继续保持“换位 / 回摆 / 反打 / 回线追回”的既有口径。
  - 本轮不因为压 `crit / pierce` 漂移而反向削弱 `dash`，也不把本轮重新做成穿梭专项轮。

### redirect / hold / nodePrep 边界补充
- `redirect`
  - 仍主要负责 mid 的“现在转得过去”。
  - 但 current-line `hold` 继续优先承担“先把当前线稳住一拍”。
- `levelUp`
  - 仍保持 `2 通用 + 1 flex`。
  - opening 的 no-focus flex 可以更积极承担 route starter emergence。
  - mid 的 no-focus flex 继续保守，避免把 ordinary sample 直接推成硬锁路线。
- `nodePrep`
  - 继续保持 `2 通用 + 1 flex`。
  - hinted ordinary sample 更偏 dominant bridge / soft-hold。
  - `finalPrep` 继续压住 redirect 噪音，不重新掉回分叉池。

### 当前结论
- 当前 rerun 中：
  - `crit` 已不再掉回 hinted / off-route，当前样本回到 `matured`
  - `pierce` 已不再落到 `dash hinted`，当前样本回到 `committed`
- 但 `pierce` 的 commit timing 仍可能偏晚，说明本轮更像“先把第一拍站出来”，而不是已经完全把中段成线时间前推到位。

## 2026-04-11 1.0 第一阶段第 7 轮：自然 rerun 收口 / 残余漂移定向清扫
### 当前取舍
- 本轮不再继续补 high-memory closeout，也不再扩 redirect / bossEcho 新入口，而是继续把 residual drift 收窄到：
  - early-mid ordinary sample 的 route continuity
  - `crit` hinted 阶段被过早改道拉散
  - `pierce` 在 no-focus opening / mid 里拿不到稳定 starter / bridge 承接
- 因此本轮继续沿现有 upgrade / anomaly / node / selector carrier 做保护性清扫，不引入新系统。

### early-mid continuity 当前口径
- `crit`
  - round7 的目标不是再给更亮的爆点，而是让 `crit` 在 hinted 阶段更容易先把当前线站住，再决定要不要改道。
  - 因此：
    - `reroute-window` 仍保留，但 hinted 阶段不应再比 current-line hold 更强
    - `hold` 选项现在应更像“继续压当前火力”，而不是纯数值缓冲
    - `压线留焰 / 压线余焰` 继续承担 early-mid continuity，而不是把问题拖到 late payoff
- `pierce`
  - round7 的目标不是再补更多晚段清账，而是让 `pierce` 在 ordinary sample 的 opening-to-mid 更容易先站出“拆线 -> 扩面 -> 清账回收”的起手。
  - 因此：
    - `拆账铺面 / 拆账余缝` 的职责继续前移到 mid committed-hold
    - opening / mid 的 node route-fit 可以继续轻量偏向 `pierce`，帮助它先拿到 starter / bridge 承接
    - 若 natural rerun 仍漂向 `dash hinted`，优先把它视为 no-focus starter continuity 噪音，而不是重新把责任推回 late closeout
- `dash`
  - 本轮继续保持“换位 / 回摆 / 反打 / 回线追回”的既有口径。
  - 但不因为补强 `crit / pierce` 而反向把穿梭做弱，也不把本轮重新做成 dash 专项轮。

### redirect / hybrid / bossEcho 边界补充
- `redirect`
  - 仍主要负责 mid 的“现在转得过去”。
  - 但 round7 明确要求：如果玩家选的是 `hold`，它应该是“稳住当前路线的一拍”，而不是只换一口纯缓冲。
  - off-route redirect 仍应保留真实改道价值，但不应在 hinted ordinary sample 里一拍抢走整条线。
- `hybrid`
  - 继续承担 support / follow-through，不回到本轮主线。
  - `压线余焰 / 拆账余缝` 这类 anomaly 现在更像 continuity support，而不是新一轮 mixed closeout 扩写。
- `bossEcho`
  - round7 不继续扩 bossEcho 内容量。
  - 它仍只承担 Boss 前预读与尾段 support，不替代 ordinary sample 的 early-mid continuity。

## 2026-04-11 1.0 第一阶段第 5 轮：玩法差异稳读 / 低命中样本补洞
### 当前取舍
- 本轮不再主要追问“有没有更亮的 high-memory closeout”，而是追问：
  - 没撞 route-specific bossEcho / strongest late carrier 时，committed 后还能不能稳定读出差异
  - redirect 转完以后，普通样本里是不是真的更像另一种玩法结果
  - hybrid / bossEcho 能不能在 ordinary sample 里承担解释，而不只是命中时加分
- 因此本轮继续沿现有 upgrade / anomaly / node carrier 补 ordinary sample 承接，不引入新系统。

### committed 后的 ordinary-sample 读法
- `crit`
  - 即使没撞 strongest closeout，也应继续读成“续热 -> 压线 -> 爆点兑现”，而不只是纯高伤标签。
  - 新增 ordinary-sample carrier：
    - `续热压线`
    - `热区余拍`
    - `热区续压`
  - redirect follow-through：
    - `借焰续拍`
- `pierce`
  - 即使没撞 rare payoff，也应继续读成“拆线 -> 扩面 -> 清账回收”，而不只是通用穿透增伤。
  - 新增 ordinary-sample carrier：
    - `拆线归账`
    - `拆线余账`
    - `拆线回收`
  - redirect follow-through：
    - `借层回收`
- `dash`
  - 即使没撞 strongest closeout，也应继续读成“换位 -> 回摆 -> 反打 -> 回线追回”，而不只是高机动生存。
  - 新增 ordinary-sample carrier：
    - `回摆取窗`
    - `回线余拍`
    - `回摆追回`
  - redirect follow-through：
    - `借位追回`

### closeout / bossEcho / hybrid / redirect 边界补充
- `closeout`
  - 继续负责 strongest late / final 的显性收束。
  - 但本轮明确补入一层 soft closeout，让 ordinary sample 不再只靠 strongest carrier 才成立。
- `bossEcho`
  - 继续负责 Boss 前预读与尾段分岔。
  - 本轮轻量新增 `迁火预录`，职责是给 ordinary sample 补一层晚段预读，不是把 bossEcho 常态化，更不是替代 Boss 调参。
- `hybrid`
  - 继续负责 mixed closeout 的理由与尾段并轨解释。
  - 本轮新增 `热区余拍 / 拆线余账 / 回线余拍`，让 hybrid 不只在高记忆点局里成立，也能补普通样本的尾段读法。
- `redirect`
  - 仍主要站在 mid，职责仍是“现在改向不亏”。
  - 但文档现已允许少量 follow-through 承接，让转向后的结果更像新路线，而不是只给一次 off-route 标签。

### 当前仍保留的近似实现
- docs 已明确普通样本里 committed 后也应读出差异，但没有要求用新系统强行锁出三种读法；因此本轮仍只靠 carrier 与轻量 selector 校准。
- 若某局同时没撞到 strong late carrier、route-specific bossEcho 与合适的 soft carrier，它仍可能被读成“主路线已分化，但玩法差异读得不够满”。
- 因此本轮解决的是 ordinary sample 稳读，不是宣布 residual drift 已完全消失。

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
