# 项目当前状态

> 若与 [DESIGN_ALIGNMENT_BASELINE_2026-04-05.md](./DESIGN_ALIGNMENT_BASELINE_2026-04-05.md) 冲突，后续设计校准与偏离审计以该文件和最新 `DEV_ISSUE_LOG.md` 为准。

## 项目定位
这是一个 Web 端的极简自动战斗 Roguelite / 自动射击 demo。

### 当前一句话定位（对外版）
一个能在短局里快速读懂节奏、走出三条不同 build 路线的节点式自动射击 demo。

### 当前一句话定位（内部版）
一款以短局节点推进为骨架、围绕暴击 / 穿透 / 穿梭三条路线分化的俯视角自动射击原型，当前重点是验证短局循环是否足够清楚、顺手、可复玩。

## 阶段演化
- 核心循环成立
- 三条主要流派可玩
- 进入收束前的内容加厚阶段（已完成）
- 随后转入商业化测试版准备（已完成大半）
- 商业化测试版封版检查阶段（已完成）
- 当前进入：代码丢失后的文档驱动重建阶段
- 公式化成长与战斗内升级接入（已完成）
- 最小表现层收口第一轮（已完成）
- 当前执行焦点：1.0 第一阶段第 6 轮：残余漂移压缩 / committed 稳定成型，重点压 ordinary sample 的 committed retention 漂移，继续保持 0.9v freeze 基线稳定

## 已确认的测试版结论
- `route_committed / route_matured` 已在自然长局中稳定触发
- 最小展示素材已产出为 GIF
- 测试版结论已达到“可发 itch.io 测试版”的状态

## 当前 0.9 路线（仍然有效）
- 单局结构升级
- 三流派 0.9 收口
- 轻局外闭环
- 内容复用底座
- 最小表现层收口

## 当前最大风险
- 当前主要问题已进一步收窄为：ordinary sample 里的 dominant route 虽能被读到，但少数 run 仍会停在 `hinted / 刚站稳`，残余漂移还没有被完全压平
- `boss-bastion / fireline` 本轮回归未见明显恶化，但 normal / highBurst / highMobility 仍有抽样波动，继续作为 freeze sign-off 之后的观察项 / 监控项保留，而不是重新拉回阻断封版项

## 2026-04-11 1.0 第一阶段第 6 轮
- 当前阶段判断继续保持在：`1.0 第一阶段`，且比第 5 轮更适合定义为“残余漂移压缩 / committed 稳定成型轮”。
- 取舍依据继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准；如与第 4 / 5 轮摘要冲突，以本节覆盖。
- 本轮主线不再主要追问“玩法差异能不能读出来”，而是继续收窄到：
  - ordinary sample 的 committed retention
  - `crit -> unformed`
  - `pierce -> dash/hinted`
  - mid-late dominant route 承接稳定性
- 当前最新进展：
  - upgrade 池新增：
    - `压线留焰`
    - `拆账铺面`
    - `回线留窗`
  - anomaly 池新增：
    - `压线余焰`
    - `拆账余缝`
    - `尾段预录`
  - node 侧新增：
    - `压线续热`
    - `拆屏挂账`
    - `定势整备`
  - selector 仅做 ordinary-sample 的保护性校准：
    - committed late `levelUp` dominant route offer 由约 `0.23 / 0.28` 提到 `0.37 / 0.38`
    - mid hinted `nodePrep` dominant route offer 由约 `0.40 / 0.38` 提到 `0.60 / 0.58`
    - mid hinted `nodePrep` off-route redirect 由约 `0.46 / 0.48` 压到 `0.30 / 0.31`
- 当前结论：
  - 项目主问题已经从“普通样本读法不够稳”进一步收窄成“committed retention 仍有残余漂移”。
  - 静态抽样显示 dominant-route continuity 已明显改善，但浏览器自然 route-flow rerun 仍能抽到更散的 ordinary sample。
  - 最新全量 route-flow rerun 中，`crit` 被早期 reroute-window 带偏到 `dash committed`，`pierce` 则在 mid 提前结束为 `unformed`；这说明 residual drift 还没有被完全压平。
  - 定向 crit rerun 仍可推进到 `crit committed`，因此 round6 更像“压缩漂移但尚未完全收口”，而不是已经彻底解决 ordinary-sample 稳读。
- Boss 监控项最新回归：
  - `normal`
    - `bossBastionRuns = 6`
    - `crossfireSeenRuns = 4`
    - `firelineSeenRuns = 1`
  - `highBurst`
    - `bossBastionRuns = 8`
    - `crossfireSeenRuns = 8`
    - `firelineSeenRuns = 2`
  - `highMobility`
    - `bossBastionRuns = 7`
    - `crossfireSeenRuns = 7`
    - `firelineSeenRuns = 4`
  - 结论：
    - 未见新的明显恶化
    - `fireline` 仍然不是 normal 样本里的高频承接
    - 本轮仍不是 Boss 专项轮

## 2026-04-11 1.0 第一阶段第 5 轮
- 当前阶段判断继续保持在：`1.0 第一阶段`，且比第 4 轮更适合定义为“玩法差异稳读 / 低命中样本补洞轮”。
- 取舍依据继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准；如与更早仍停在第 3 / 4 轮的摘要冲突，以最新阶段口径覆盖。
- 本轮主线不再是继续追求更多 high-memory 命中，而是把 ordinary sample 里“没撞 strong late carrier / route-specific bossEcho 也能读出 committed 后玩法差异”的承接补齐。
- 当前最新进展：
  - upgrade 池新增 ordinary-sample soft closeout 与 redirect follow-through：
    - `续热压线 / 拆线归账 / 回摆取窗`
    - `借焰续拍 / 借层回收 / 借位追回`
  - anomaly 池新增 route-specific hybrid soft closeout：
    - `热区余拍 / 拆线余账 / 回线余拍`
  - 轻量补入 `迁火预录`，把 `fireline` 的 ordinary sample 预读补成更自然的 late support，而不是 Boss 专项调参。
  - node 侧新增 late soft-closeout battle carrier：
    - `热区续压 / 拆线回收 / 回摆追回`
  - selector 仅对 `nodePrep` 做小幅 route-fit 倾斜，目标是提高普通样本稳读，不是抬高 rare / bossEcho 常态命中。
- 当前结论：
  - 项目主问题已经从“内容不够多”转向“普通样本里的读法不够稳”。
  - committed 之后三流派在 ordinary sample 里的 mid-late 读法已比第 4 轮更稳定，但“构筑差异已经存在、玩法差异还没完全读出来”的残余漂移没有清零；ordinary-sample rerun 里仍出现 `crit -> unformed`、`pierce -> dash/hinted`。
  - `crit / pierce / dash` 现在更容易分别读成“续热兑现 / 拆线回收 / 回摆追回”，而不是同一种 build 只换标签。
- Boss 监控项最新回归：
  - `normal`
    - `bossBastionRuns = 11`
    - `crossfireSeenRuns = 3`
    - `firelineSeenRuns = 2`
  - `highBurst`
    - `bossBastionRuns = 12`
    - `crossfireSeenRuns = 11`
    - `firelineSeenRuns = 4`
  - `highMobility`
    - `bossBastionRuns = 6`
    - `crossfireSeenRuns = 6`
    - `firelineSeenRuns = 4`
  - 结论：
    - normal 固定样本相较第 4 轮 `0 / 8` 已回升
    - highBurst / highMobility 未见明显崩坏，但仍有样本波动，暂不把它写成完全收口
    - 本轮仍不是 Boss 专项轮

## 2026-04-11 1.0 第一阶段第 4 轮
- 当前阶段判断继续保持在：`1.0 第一阶段`，但比上一轮更适合定义为“高记忆点 run 分化 / 收束显性化轮”。
- 取舍依据继续以：
  - 最新用户 brief
  - `ROADMAP_1_0.md`
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  为准；如与更早仍停在 `1.0 第一阶段第 2 / 3 轮` 的摘要冲突，以最新阶段口径覆盖。
- 本轮主线不是再补 replay 外壳，也不是回到 selector / telemetry 主导，而是继续沿现有数据载体补：
  - route-specific closeout
  - high-memory bossEcho / hybrid anomaly
  - 能承担转折点 / 偏航点 / 收束点的 node carrier
  - generic late-payoff / mixed closeout
- 当前最新进展：
  - upgrade 池新增 `尾流归并 / 余响备压 / 灼链追爆 / 裂幕归账 / 回线追拍`，把 generic late-payoff 与三流派 closeout 承接再往后段推一截。
  - anomaly 池新增 `错拍并账 / 侧频并轨 / 灼冠预读 / 裂屏预账 / 回线窥影`，让 `hybrid / bossEcho` 更稳定承担“尾段为什么会这样收”的解释。
  - node 侧新增：
    - 中段：`转折校准 / 偏航试拍`
    - 后段 battle：`爆点追收 / 裂面清账 / 回线反压`
    - 后段整备 / anomaly：`终拍定稿 / 旁路归并 / 首领侧录 / 终段偏航`
  - 当前没有新增系统层，也没有重写 `RunEngine`；selector / telemetry 也没有被重新做成主线。
- 当前结论：
  - committed 之后三流派的中后段读法已比上一轮更像不同玩法结果，而不只是不同标签。
  - 但“构筑差异已经存在、玩法差异还没完全读出来”的残余漂移仍未彻底消失；当 run 没有吃到 late carrier 或 Boss 前预读时，少数样本仍会偏像“同一路线 + 少量内容差异”。
  - 本轮更像把 closeout 载体补足，而不是彻底解决所有玩法读法问题。
- Boss 监控项最新回归：
  - `highBurst / highMobility` 下 `fireline` 仍可见，未见明显崩掉。
  - 但固定样本里的 `normal` 场景当前回到 `bossBastionRuns = 8, firelineSeenRuns = 0`，相较上一轮的 `1 / 9` 有轻微回落。
  - 这一项暂记为“监控项轻微恶化风险”，本轮不回拉成 Boss 专项调参轮，但后续轮次需要继续盯。

## 2026-04-10 1.0 第一阶段第 3 轮
- 当前阶段判断继续前推为：`1.0 第一阶段` 中的“构筑分化 / replay 动机补厚轮”。
- 取舍依据继续以：
  - 最新用户 brief
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  - `ROADMAP_1_0.md`
  为准；如与更早仍停在 `0.9v freeze sign-off` 或 `1.0 第一阶段第 2 轮` 的摘要冲突，以最新口径覆盖。
- 本轮主线不再是继续补骨架，而是把现有承载继续推向：
  - rare payoff
  - hybrid
  - redirect
  - late payoff
  - replay 动机
- 当前最新进展：
  - upgrade 池新增一批 generic hybrid / rare late-payoff 以及每条路线各 1 张新的 redirect 承载，mid 改道与 late 低频收束都更厚。
  - anomaly 池新增 `并轨超调 / 影缝并联 / 口袋回读 / 首领并线`，把 `hybrid / bossEcho` 从“有入口”继续推向“更能改变这局走势”。
  - node 侧新增 `并轨整备 / 稀有读数 / 并线残响`，让中段混搭与后段低频收束更容易拥有自然载体。
  - replay prompt 不再只看是否碰过 anomaly，而会开始读入 rare payoff / hybrid / redirect / bossEcho 的实际命中。
  - telemetry 在现有 run summary 上补了：
    - `rarePayoffPickCount`
    - `bossEchoSeenCount`
- 当前更适合继续做：
  - 继续补 route / anomaly / node 的高记忆点内容
  - 继续拉开中后段 run 与 run 之间的读法差异
  - 继续轻量回归验证 `boss-bastion / fireline`
- 当前最大风险保持不变：
  - 普通 build 下 `boss-bastion / fireline` 仍是低频样本
  - 本轮内容扩写没有把它明显做坏，但它仍然是 1.0 期间需要持续监控的残余风险

## 2026-04-08 0.9v 音频阻断项修复
- 本轮先按最新真实运行反馈，临时把阶段判断回退为：`0.9v 封版前阻断项修复`。
- 回退原因不是文档口径变化，而是发现了新的真实 blocker：
  - 游戏内实际听不到持续可感知的声音
  - 没有实际可听见的 BGM
  - 现有 `PilotAudio` 只有极短的程序化提示音，难以支撑“玩家实际能听见”的封版判断
- 本轮修复后，音频阻断项已关闭：
  - 开始页可在首次用户交互后解锁并听见基础 BGM
  - 局内可听见战斗 BGM 与关键战斗反馈
  - Boss 进入 / 结果页 / replay / 导出等关键节点已有明确音频反馈
  - 浏览器自动播放限制已按“首次 `pointerdown / keydown` 解锁 + 恢复后补播排队 cue”处理
- 因此当前阶段判断恢复为：
  - 项目重新回到 `0.9v freeze sign-off`
  - 项目重新回到 `0.9v 可封版状态`
  - 当前最大的显式残余风险仍是 `boss-bastion / fireline`，不再是音频

## 2026-04-08 0.9v freeze sign-off
- 当前阶段判断更新为：项目已进入 `0.9v freeze sign-off`，并可正式定义为 `0.9v 可封版状态`。
- 取舍依据继续以：
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  - 本轮 freeze sign-off 口径
  为准；如与更早阶段描述冲突，以最新阶段口径覆盖旧表述。
- 本轮明确确认：
  - 主流程 `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 已达到可封版状态
  - 三流派、anomaly 独立感、Boss / anomaly / template ownership 已达到可验收状态
  - HUD / 文案 / 音效 / 结果页 / replay 当前没有剩余 blocker
  - 当前没有必须修掉才能封版的阻断项
- 本轮显式登记的残余风险只有一项：
  - 普通 build 下 `boss-bastion / fireline` 仍是低频样本
  - 最终关远程后段仍存在“前段成立、收束偏薄”的残余风险
  - 该风险当前属于后续版本观察项 / 监控项，而不是阻断封版项
- 因此当前更适合继续做：
  - 冻结版本签收记录
  - 残余风险留档
  - 后续版本监控准备
  而不是继续重开新开发轮

## 2026-04-08 0.9v 封版检查更新
- 当前阶段判断更新为：项目已从“验收前修边”进入“封版检查 + 可封版判断”。
- 这轮重点不再是继续扩内容，而是：
  - 全流程回归
  - 残余风险监控
  - 验收清单收口
  - 只处理小范围高收益修正
- 本轮确认的最新进展：
  - `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 全链路继续稳定可跑通。
  - 三流派、anomaly 独立感、Boss / anomaly / template ownership 在当前回归里都没有明显回退。
  - `boss-bastion / crossfire` 在普通样本中的可见度已稳定在 `7 / 10`。
  - `boss-bastion / fireline` 在普通样本中的自然可见度维持在 `2 / 10`，比此前更稳，但仍然不是高频样本。
  - 最终整备 / 最终战节点的目标卡已从泛化的“选择下一站”收口到更直接的：
    - `进入最终整备`
    - `确认最终战`
- 当前更适合继续做：
  - 最终封版清单复核
  - 普通 build 下 `fireline` 的持续回归监控
  - 封版前一次集中式 freeze sign-off
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍是当前唯一还需要持续盯住的残余风险点。
  - 该风险已经从“0 -> 1”推进到“低频但可见”，下一步更适合继续监控而不是重开 Boss 专项深挖。
  - 因此项目当前已经接近 `0.9v 可封版状态`，但还应把 `fireline` 覆盖率保留为封版结论里的显式注记。

## 2026-04-08 0.9v 验收前修边更新
- 当前阶段判断更新为：项目已从“内容扩写与结构分层主线”切到“验收前修边主线”。
- 这不意味着项目已经完全封版，而是说明当前主线收益最高的工作已经从“继续扩写内容”转成：
  - 普通 build 回归校准
  - 最终关单点风险修正
  - 全链路可跑通与 readable 验收
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 的普通样本可见度继续抬升，当前自然样本为 `4 / 8`。
  - `boss-bastion / fireline` 在普通样本中已从 `0 / 8` 抬到 `1 / 8`，说明远程后段不再只由高 burst / 高机动样本承接。
  - `fireline` 现在补上了自己的轻量进段确认，但仍继续复用既有 `signature + pattern + pocket` carrier，没有引入新的 Boss 系统层。
- 当前更适合继续做：
  - 普通 build 的自然样本复检
  - 结果页 / replay / Boss 收尾读数的验收前复查
  - 持续维护 Boss / anomaly / template ownership 边界
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍然不是高频样本，最终关远程后段仍需继续监控。
  - 如果后续再回到“只前置时间阈值”或“只堆血拖长战斗”，容易破坏已经成立的高 burst / 高机动样本和最终关层次。

## 2026-04-08 0.9v 验收前修边补充
- 本轮重点不再是扩内容，也不再是继续深挖 Boss 新机制，而是把 `start -> node -> battle / upgrade / anomaly -> boss -> result -> replay` 的验收前闭环修顺。
- 当前已补上的关键修边包括：
  - 结果页补入本局路线 trace，能更直观看到“这一局怎么走完”
  - 结果页补入 replay prompt，让胜负后的“再来一局”更像完整收束，而不只是按钮
  - HUD 路线条移除前段常驻的三枚 `0` 计数，占位改成更轻的 `未站稳`
  - 玩家可见的 Boss / 首领相关文案去掉 `主核 / Boss载体 / 准备交火` 这类偏设计口吻，统一收回更自然的验收态表述
- 本轮验证确认：
  - 全链路仍可稳定跑通
  - 玩家可见文本没有新增乱码或内部设计术语泄露
  - HUD / 结果页的修边没有把 `boss-bastion / fireline` 做坏，普通 / 高 burst / 高机动样本均未见明显回退
- 当前阶段判断更接近：
  - 项目已具备进入 `0.9v 封版检查阶段` 的条件
  - 但仍应把普通 build 下 `boss-bastion / fireline` 的自然覆盖率继续作为封版前残余监控项，而不是宣布风险清零

## 2026-04-07 0.9v 三流派收口更新
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“内容扩写与结构分层阶段”。
- 本轮主线已从 anomaly / template 单点扩写切到：
  - 暴击 / 穿透 / 穿梭三流派的 `0.9` 收口
  - 路线与 anomaly / battle template / boss 收尾关系澄清
  - `boss-bastion / fireline` 普通 build 覆盖率继续回归监控
- 当前最新进展：
  - 三流派各自补入了一张更像中后段承接的 route payoff：
    - `热区压缩`
    - `贯层回响`
    - `回切反打`
  - `热区记录 / 裂轨图谱 / 穿梭记忆` 已从普通 `event` 口径并回 anomaly lane，不再只是 route 奖励分发。
  - opening / mid / late 的 battle carrier 与 final boss 收尾入口，现在已开始按主路线做轻量 route-fit 倾向：
    - `crit` 更偏 `追猎主核`
    - `pierce` 更偏 `屏卫主核`
    - `dash` 更偏 `锁域主核`
  - 这层倾向当前仍是“轻量偏置”，不是硬锁单一路线。
- 当前更适合继续做：
  - 三流派在自然 run 中的 payoff 兑现样本验证
  - anomaly 与路线关系的第二轮深挖
  - template family 在路线 closeout 后的自然 run 读数复检
  - `boss-bastion / fireline` 普通 build 覆盖率继续观察
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍偏少见
  - route-fit 现在已经存在，但后续如果继续补大量泛用内容，不守住 route carrier 倾向，三流派仍可能重新掉回“能玩但不够像三条路”
  - route payoff anomaly 已回到 anomaly lane，但异常池后续若再次被普通路线奖励内容挤占，anomaly 识别感仍可能被稀释

## 2026-04-07 0.9v 内容扩写与结构分层更新
- 当前阶段判断更新为：项目已从 `0.9v` 的“读数 / 压力校准阶段”切到“内容扩写与结构分层阶段”。
- 本轮主线不再继续深挖单点 Boss pocket，而是转入：
  - anomaly 深度扩写
  - battle template 家族分层强化
  - 整局内容密度与阶段层次拉开
- 当前最新进展：
  - anomaly 现在新增了 `anomalyClass` 轻量口径，能够把 `routeWindow / distortion / hybrid / bossEcho` 区分开。
  - 新增 anomaly 内容：`断层竞价`、`幽栅并轨`、`终端税`。
  - 一批更工具化的 anomaly 已降权为支持层入口，不再主导 anomaly 主味道。
  - opening / mid / late 新增了更明确的 battle 承载点：
    - `厚线突围`
    - `拖场绞锁`
    - `尾段突压`
  - `elite-vice` 已真正进入中段节点候选，不再只是数据层孤立 rare 模板。
  - 节点卡和 anomaly 面板现在会显示更具体的玩家向描述，不再把不同内容都压成同一种占位说明。
- 当前更适合继续做：
  - anomaly 池的第二轮深度扩写
  - template family 的自然 run 样本验证
  - 三流派在新内容密度下的收束节奏校准
  - `boss-bastion / fireline` 普通 build 覆盖率继续监控
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 的自然覆盖率仍偏低
  - anomaly 虽然已经更像 anomaly，但 route-window 内容后续若回涨过多，仍可能再次稀释异常识别感
  - template layering 已经拉开第一轮，但后续如果只补参数，不继续维护节点分发与读数口径，仍可能重新掉回“同模板不同档位”

## 2026-04-07 0.9v 流程完整度推进更新
- 当前阶段判断更新为：项目已开始从 `0.9v` 的“读数 / 压力校准阶段”切入“流程完整度推进阶段”。
- 本轮不再继续深挖单点 Boss pocket，而是优先把一整局的前段 / 中段 / 后段 / final prep / boss / 结算 / replay 承接收口。
- 当前最新进展：
  - `opening / mid / late / finalPrep / finalBattle` 的节点面板说明已按阶段重写，不再只是泛“选择下一站”。
  - `round 2 / round 3` 的节点出牌现在更稳定给出 `2~3` 选，并提高 anomaly 露出率，让整局更像一条完整 run，而不是零散 panel 串联。
  - `PilotAudio` 已补齐 `start / confirm / anomaly / boss / victory / defeat / result` 首轮 cue，并接到开始、节点确认、异常、Boss、胜负与结果页。
  - `CORE_LOOP.md` 顶部摘要已经同步改回 `battle / upgrade / anomaly -> final prep -> boss -> 结算 -> replay` 的最新口径。
- 当前更适合继续做：
  - 自然 run 的整局节奏样本验证
  - 基础音效的第二轮去噪与素材替换准备
  - 普通 build 下 `boss-bastion / fireline` 覆盖率继续观察
- 当前最大风险更新为：
  - 远程 Boss 后段的普通 build 覆盖率仍然是最大未收口点
  - 当前音效仍属于“基础反馈闭环”，不是最终音频表现层
  - 如果后续内容扩写只顾局部，不继续维护整局承接，流程完整感仍会再次被稀释

## 2026-04-07 0.9v 远程 pocket 自然成立性校准
- 当前阶段判断继续保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 当前焦点已从“pocket 是否存在”进一步推进到“自然 build 样本里，pocket 转场决策是否足够常见”。
- 当前最新进展：
  - `boss-bastion / fireline` 已不再只依赖 targeted probe 证明成立
  - 在自然 build + 指定 `boss-bastion` 收尾样本里：
    - `highBurst` 已能看到 `fireline`
    - `highMobility` 已能看到 `fireline`
    - 两者都已出现 `edgeBounce + centerReset`，并出现真实转场决策窗口
  - `crossfire` 继续稳定承担远程前段主味道，没有被本轮校准抹平
- 当前更适合继续做：
  - 普通 build 下的 `fireline` 覆盖率校准
  - `crossfire -> fireline` 的轻量承接优化
  - battle readability 与 Boss / elite / final battle ownership 边界维护
- 当前最大风险更新为：
  - `fireline` 的自然成立性已经比上轮更稳，但普通 build 下仍偏少
  - 如果后续高 burst / 高机动继续上涨，而普通样本覆盖率又补不上，最终关远程后段仍可能再次被读回“交火段成立、收束段偏薄”
  - 因此下一步更需要的是普通样本覆盖率与自然承接校准，而不是继续堆血、堆怪或引入新系统

## 2026-04-06 0.9v Boss phase 行为身份更新
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不是再补“有没有 phase”，而是补“phase 是否已经有行为身份”。
- 当前 Boss 的阶段行为口径现已更新为：
  - `boss-hunt`：`接敌(frontline) -> 逼近(screened) -> 收束(frontline)`
  - `boss-lockdown`：`接敌(kiting) -> 封位(screened) -> 锁场(frontline)`
  - `boss-bastion`：`接敌(screened) -> 交火(summoner) -> 火线收束(kiting)`
- 当前实现里，`updateEliteEnemy(...)` 已不再固定读取模板基准行为；Boss 主核会按当前 phase 的行为身份真正切换移动方式。
- HUD 战况子读数也会同步显示当前主核行为口径，因此 phase 差异不再只停留在后台参数层。
- 当前阶段的主要剩余风险更新为：
  - Boss 的阶段行为差异虽然已经落到运行层，但仍复用旧的 `frontline / screened / kiting / summoner` 行为谱系。
  - 如果后续玩家 burst 或机动继续上涨，最终关仍可能需要更明确的 phase 专属压力兑现，而不只是继续沿旧行为谱系微调。

## 2026-04-05 0.9v 读数 / 压力校准更新
- 当前阶段判断更新为：项目已进入 `0.9v` 早期常规开发中的“读数 / 压力校准阶段”。
- 本轮源头口径明确为：`DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md`。
- 本轮新增的稳定实现：
  - `boss / elite` 模板已补入轻量 `pressurePhases`，压力不再只靠高血、护卫和通用刷怪加速成立。
  - 最终 Boss 现在会通过 `HP 阈值 / 剩余时间阈值` 进入不同压力段，HUD 会显示当前阶段读数。
  - `anomaly` 池继续保持独立于普通 event 池，并额外补入“代价 / 扭曲 / 混搭”导向的 anomaly 条目，避免再次退化成普通 route push。
  - 过于普通 event 化的 `relay-splice / route-handoff` 已降到次级 anomaly 入口，不再主导 anomaly 识别感。
- 当前阶段的主要剩余风险：
  - Boss 阶段压力已经有了结构入口，但自然玩家 burst 继续上涨后，是否还需要第二轮节奏雕刻，仍要靠真实跑局样本验证。
  - anomaly 的内容质量已经比前一轮更像 anomaly，但自然浏览器自动化样本仍偏容易死在中段，后续还需要继续结合真实玩家样本看记忆点是否足够稳。

## 2026-04-05 更新
- 最新阶段口径保持不变：项目仍处于“内容与可玩性阶段”，本轮不做骨架重建、不做新系统扩展。
- 本轮执行焦点改为：`redirect 默认吸引力校准 > hybrid 承接强化 > 多局样本验证`。
- 当前确认的最新进展：
  - mid 阶段真正的 off-route redirect 升级窗口已不再被同流派 `redirect` 变体挤占。
  - `relay-splice / route-handoff` 下调为次级改道入口，带 `hold` 选项的 reroute-window 事件被前置为更主要的主动转向窗口。
  - 自然跑局样本里 `redirectPickCount` 已不再长期为 0，`branchSwitchCount` 也重新出现了非零样本。
  - 新增的 redirect 观测字段 `redirectOfferSeenCount / redirectPickCount / redirectPickStage` 已接入并通过导出链路保留。
- 当前最大风险更新为：
  - 自然样本里的主动转向仍然偏少，虽然已不再是纯 0，但主要还集中在 mid-late / late 的明确窗口，mid 的稳定转向样本仍不足。
  - `relay-splice` 这类通用改道事件仍可能在部分跑局里被顺手拿来“顺当前路线”，说明 redirect 吸引力问题已从“看不到”转成“看到后是否真愿意翻主路线”。
  - `branchSwitchCount` 已修正为不会漏记“同一拍完成 switch + mature”的情况，但样本规模仍小，后续还需要继续观察真实分布。
- 同日新增用户设计基线文档 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`，后续需要重点审计：
  - 关卡类型是否应从当前 `battle / upgrade / event` 继续对齐到 `boss / battle / upgrade / anomaly`
  - 最终战是否仍只是 battle 模板近似
  - 强化唯一性、特殊强化最低品质、四类基础小怪是否已被当前实现偏离

## 2026-04-05 设计对齐审计补充
- 本轮已按 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 对当前实现做了一次 design alignment audit。
- 审计后确认的已符合项：
  - 玩家操作仍是 `WASD` 主移动 + 自动攻击；方向键目前只是附加兼容输入。
  - 击杀掉经验 -> 拾取 / 吸附 -> 升级三选一链路已成立。
  - 品质五档、品质权重与升级价值公式已存在。
  - `battle` 家族已覆盖普通 / 精英 / 生存三类模板。
- 审计后确认的近似项：
  - 地图推进是轻量 STS2 风格分支，但仍基于当前 `battle / upgrade / event` 节点口径。
  - 最终战会稳定收尾于 final battle，但仍是高压 `battle template` 近似，不是独立 Boss 关语义。
  - 异常关目前更接近低频 event / rare event，而不是玩家可感知的独立 `anomaly` 关。
  - 精英行为已有 `frontline / screened / kiting / summoner`，但只是接近“反向移动 + 护卫挡前”的读数。
- 审计后确认的明显偏离项：
  - `NodeType` 仍未扩到 `boss / battle / upgrade / anomaly`。
  - 基础敌人仍以 `regular / escort / elite` 组织，尚未形成四类明确基础小怪口径。
  - 当前没有真正独立的远程敌种与弹道体系。
- 本轮已直接修正的低风险问题：
  - 升级选择器与运行态现已按 `sourceId` 执行单局唯一，不再因 `repeatable` 元数据重复发放已拿过的强化。
  - 三流派 route 强化现已显式设定最低品质为绿，不再从白品池滚出。
- 仍刻意留到下一轮的结构问题：
  - `NodeType` 对齐、Boss 关独立语义、`anomaly` 玩家可感知化。
  - 四类基础小怪与远程怪数据层落地。
  - 生存关最后 `10s` 的显式增压规则。

## 当前边界
### 不再作为主线的内容
- 页面 UI 结构改版
- 更大关卡变化面
- 新系统
- 新战斗模板
- 新节点类型
- 新流派
- 全量正式素材替换
- 正式商业包装页

### 当前允许做的内容
- 节点候选数量与分布规则修正
- `nodes / events / upgrades` 内容批次扩容
- Content Selector 的阶段 / 流派 / build 倾向权重细化
- battle / elite / survival 模板变种补强
- 精英行为变体的数据化扩展
- 构筑导向与 replay 动机增强
- 低频稀有事件 / 低频模板变体 / 后段 rare payoff 内容补充
- 中后段 hybrid / pivot 内容补充
- redirect 机会与内容池比例边界维护
- 压力增长公式与升级价值公式压实
- 商业化测试版文档、埋点与公式口径维护
## 2026-04-05 结构语义最小落地补记
- 当前主循环仍处于“内容与可玩性阶段”，但节点与敌人语义已经开始按最新设计基线收口。
- 节点语义现已显式落到 `battle / upgrade / anomaly / boss`。
- 最终收尾节点现为显式 `boss`；结果页、节点记录与埋点导出会同步记录 `boss` 口径。
- `boss` 现已拥有独立的 Boss 模板承载入口；最终节点只会从 `boss-hunt / boss-lockdown / boss-bastion` 模板池抽取，不再直接落回 elite-family 模板 ID。
- `anomaly` 已是显式节点类型；当前异常节点只会从带 `contentKind: anomaly` 的内容池抽取，并在面板标题与埋点里继续保持 `anomaly` 口径。
- 基础敌人数据层现已拆为 `standard / brute / skirmisher / ranged` 四类；`regular / escort / elite` 保留为战斗角色语义。
- 仍保留的近似实现：
  - Boss 仍复用现有 elite 风格胜利条件与大部分战斗机制，没有独立 Boss 机制树。
  - anomaly 仍复用现有事件面板与效果结算流，不是独立 anomaly 子系统。
  - 生存关“最后 10 秒显式增压”还没有拆成单独公式段，只保留原有平滑压力增长。

## 2026-04-05 0.9v Boss / Anomaly 首批内容补记
- 当前阶段判断更新为：恢复收口已完成，项目可以按 `0.9v 内容与可玩性开发` 继续推进。
- 本轮不再补“恢复语义”，而是沿已经切开的 `boss / anomaly` 新载体补第一批专属内容。
- Boss 侧新增的首批专属承载：
  - 最终节点不再统一显示成泛 `最终 Boss`，而是会明确落成 `追猎主核 / 锁域主核 / 屏卫主核` 三个 Boss 节点入口。
  - Boss HUD / 进入提示 / 结果页收尾节点会继续沿具体 Boss 名称工作，避免后续内容再次退回“更强 elite”口径。
- anomaly 侧新增的首批专属内容：
  - 新增 anomaly 专属事件：`相位裂缝`、`载体失真`、`Boss 阴影扫描`。
  - mid / late 节点池新增 anomaly 节点蓝图：`相位裂缝`、`Boss 阴影`，让异常节点本身也更像独立内容线，而不是普通 event 占位符。
  - anomaly 内容分发现在显式走独立 anomaly catalog，而不是继续从合并事件池临时过滤。
- 仍保留的复用边界：
  - Boss 仍复用 battle 结算与大部分现有承压规则，本轮没有继续扩 Boss 专属系统。
  - anomaly 仍复用 event 面板与 effect 结算，本轮重点是把内容站位与内容入口立住。

## 2026-04-05 0.9v 战斗层读数补记
- 本轮不再处理“是否已有四类基础敌人 / 是否已有 boss-anomaly 载体”这类恢复期问题；这些语义已在代码中成立，当前重点转为 0.9v 战斗读数强化。
- 当前战斗层的最新判断是：
  - `regular / escort / elite` 继续保留为战斗职责层语义。
  - `standard / brute / skirmisher / ranged` 才是基础敌人 archetype 语义。
  - `boss / anomaly` 载体继续保留独立 node / template / content lane，但底层仍复用既有 battle / event 结算。
- battle 模板本轮进一步拉开 archetype ownership：
  - `elimination / elimination-pincer` 更强调 `standard + skirmisher` 的前段快压与侧压。
  - `elimination-sweep / survival-gauntlet` 更强调 `brute` 的厚体推进。
  - `elite-screen / survival-crossfire / boss-bastion` 更强调 `ranged` 火线与护卫遮线。
  - `elite-lockdown / boss-lockdown` 更强调 `skirmisher + escort` 的封位与反拉压迫。
- HUD 现会直接显示：
  - encounter 口径，例如 `普通战 / 精英战 / 生存战 / Boss载体`
  - 模板读数摘要，例如 `敌群 / 节奏 / 护卫 / 主核行为`
- 结果页收尾节点现会显式显示 `节点类型 + 节点标题`，例如 `Boss · 锁域主核`，避免 0.9v 常规开发时再次被旧 `elite` 语义稀释。
- 本轮仍刻意不做的深改：
  - 不新增独立 Boss AI 树。
  - 不新增 anomaly 子系统。
  - 不重写战斗主流程或 RunEngine。

## 2026-04-05 0.9v 战斗读数与升级池修正补记
- 当前项目维持在 `0.9v 常规开发阶段`，本轮优先级不是补普通内容量，而是修正战斗读数、压缩交互遮挡、稳住 Boss/anomaly ownership。
- 普通升级三选一现已从普通节点整备 selector 中切开，改为独立 `levelUp` 发牌逻辑：
  - 结构为 `2 个通用强化 + 1 个弹性槽`
  - 普通升级中最多只出现 `1` 个路线强化
  - 流派 buff 的出现率低于一般属性强化，一般属性强化重新回到升级池主干
- anomaly 路线强化现已从普通事件/升级口径中拆出，独立收纳到 anomaly route pool；后续 anomaly 路线内容应继续沿 anomaly lane 扩写，而不是反向污染普通升级池。
- 玩家可见 UI 本轮继续去设计语气：
  - 节点卡、异常面板、升级面板、HUD 提示优先显示功能性说明
  - 不再把内部设计性 blueprint / event 描述直接泄露给玩家
- 战斗可读性本轮重点修正为：
  - 顶部 HUD 压缩为更轻的 top rail
  - 战斗中常规 toast / 横幅抑制
  - 经验球绿色、敌方子弹红色
  - Boss / elite 增加最小抗 burst 承接，避免继续被瞬秒
- 当前最大风险更新为：
  - 普通升级读数已经更健康，但 route 信号也更克制；后续要继续观察自然跑局里是否会出现“过于通用化”的反向稀释。
  - Boss / elite 当前主要靠模板参数和 guard 窗口稳住强度，还不是完整的阶段机制体验。

## 2026-04-06 0.9v Boss 抗 burst 切段补记
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮源头口径继续以 `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + 最新 DEV_ISSUE_LOG.md` 为准，不回退到恢复期，也不提前进入纯内容堆量。
- 本轮确认的问题不是“Boss 没有阶段”，而是“已有 `pressurePhases` 在高 burst 下仍可能被压平”：
  - 同一轮检查里连续跨过多个阈值时，阶段可能被连跳。
  - 切段后主要只有后台参数变化，玩家不一定能稳定感到进入了新段。
- 本轮已落地的强化：
  - Boss phase 现在新增最小驻留时间，避免刚切段就被下一段阈值立刻吞掉。
  - Boss phase 切换时会补一小段过渡 guard 与一次即时护卫兑现，让“转段”不是只存在于参数层。
  - HUD 子读数会在切段瞬间使用 `转段` 口径，战场上也会出现轻量脉冲圈提示，帮助玩家感知最终关进入新压力段。
- 当前仍保留的边界：
  - 这轮仍然没有做硬锁血或独立 Boss 系统。
  - Boss 仍复用 battle 主流程，当前做的是“模板层切段稳定化”，不是重写最终关机制树。
- 当前主要剩余风险更新为：
  - Boss 切段现在更不容易被高 burst 直接压成一条直线，但如果后续玩家爆发继续上升，最终关仍可能需要更强的“阶段内行为差异”，而不只是模板层承接。

## 2026-04-06 0.9v Boss phase 专属压力签名更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“是否有 phase”或“phase 是否有行为身份”，而是补“phase 是否已经拥有可感知的专属压力签名”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in`：补入 `逼近压线`，以短时护卫脉冲把“压线逼近”从后台参数变成可见压力段。
  - `boss-lockdown / pin-down`：补入 `护卫封位`，以更短周期的护卫补位把封位段和普通 `screened` 变体拉开。
  - `boss-bastion / crossfire`：补入 `火线齐射`，用短窗齐射把“交火段”做成更明确的远程压制期。
- 当前实现里，Boss phase 除了复用已有 `frontline / screened / kiting / summoner` 行为谱系外，还会在 phase enter 后触发独立 signature window；HUD 读数与主核外圈也会同步显示该 signature。
- 当前阶段的主要剩余风险更新为：
  - phase signature 已经落地，但仍复用现有护卫刷新与敌方弹道系统，不是独立 Boss 行为树。
  - 如果后续玩家 burst 与机动继续上涨，下一轮更可能需要补“phase 内空间压迫/节奏模式”的更强签名，而不是继续调血量。

## 2026-04-06 0.9v Boss phase 内空间压迫 / 节奏模式更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“是否有 signature”，而是补“phase 内是否已经有稳定的压迫模式”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in`：补入 `纵压驱进`，通过上/下沿的压进波把“逼近段”变成更明确的纵向挤压期。
  - `boss-lockdown / pin-down`：补入 `侧翼夹封`，通过左右侧的封位波把“封位段”变成更明确的侧向走位压缩期。
  - `boss-bastion / crossfire`：补入 `交叉火线`，通过固定周期的交叉齐射把“交火段”变成更稳定的节奏压制期。
- 当前实现里，Boss phase 现在分成两层：
  - `signature window`：负责切段确认
  - `pattern pulse`：负责 phase 内持续的空间压迫 / 节奏模式
- 当前阶段的主要剩余风险更新为：
  - phase 内模式已经落地，但仍建立在现有护卫刷新、敌方投射物与旧行为谱系之上，不是独立 Boss pattern 系统。
  - 如果后续玩家 burst 与机动继续上涨，下一轮更可能需要补的是更强的空间占位 / 安全区雕刻，而不是继续增加血量。

## 2026-04-06 0.9v Boss phase 场地空间雕刻更新
- 当前阶段判断继续保持为：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮不再补“有没有 pattern”，而是补“phase 内危险区 / 安全窗是否已经真正成立”。
- 当前 Boss phase 的最新推进为：
  - `boss-hunt / close-in / 纵压驱进`
    - 现在会打开一条纵向安全走廊
    - 走廊外由上/下沿壁射与厚体 escort 波共同压缩
  - `boss-lockdown / pin-down / 侧翼夹封`
    - 现在会打开一条横向安全走廊
    - 走廊外由左/右侧壁射与高速 escort 波共同封边
  - `boss-bastion / crossfire / 交叉火线`
    - 继续保留为节奏压制型 phase，不额外扩成安全窗系统
- 当前实现里，Boss phase 现在已经分成三层：
  - `signature window`：确认切段
  - `pattern pulse`：维持 phase 内模式
  - `safe / danger carving`：把 laneCrush / sideClamp 进一步落成玩家可读的空间结构
- 当前阶段的主要剩余风险更新为：
  - 安全窗雕刻目前只落在 `boss-hunt / boss-lockdown` 两个 phase 上，`boss-bastion` 仍主要依赖节奏火线成立。
  - 如果后续高 burst / 高机动构筑继续上涨，下一步更可能需要的是：
    - 继续验证真实玩家样本下的空间读数是否稳定
    - 或为 `crossfire` 一类远程 phase 补更明确的空间口袋
    而不是继续加血或加怪。
## 2026-04-06 远程 phase 状态补充
- 当前阶段判断保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 已从“节奏火线”推进到“远程空间口袋”。
  - 远程 phase 现在可以在场地内形成短时安全袋与四周危险区，而不再只靠齐射和护卫节奏成立。
  - 远程 pocket 继续复用现有 `pressurePhases / pattern pulse / safe-window` carrier，没有引入新的 Boss 系统层。
- 当前更适合继续做：
  - 远程 pocket 的真实玩家样本验证
  - pocket 转场模式与路径多样性维护
  - battle readability 与 Boss / elite / final battle ownership 边界维护
- 当前最大风险更新为：
  - `crossfire` 已经有稳定空间口袋，但 pocket 迁移仍属于轻量模板级实现；如果后续高 burst / 高机动进一步上升，仍要继续观察“玩家是否还需要真实转场决策”，而不是继续加血或堆投射物。
## 2026-04-06 远程 pocket 转场补充
- 当前阶段判断继续保持不变：项目仍处于 `0.9v` 的“读数 / 压力校准阶段”。
- 本轮确认的最新进展：
  - `boss-bastion / crossfire` 已经不再只有单一 pocket 迁移味道，现已能在 `横切 / 回心` 之间切换。
  - `boss-bastion / fireline` 也已接入更短窗的 pocket carrier，当前会以 `压边迁火` 的方式承接后段。
  - 远程 Boss 的 pocket 迁移现在已经开始具备 phase 差异，而不只是同一套锚点循环。
- 当前更适合继续做：
  - 继续观察自然样本里 `fireline` 的 pocket 进入率
  - 补 pocket 转场路径与预判窗口的多样性
  - 持续维护 Boss / elite / final battle ownership 边界
- 当前最大风险更新为：
  - `crossfire / fireline` 已经拉开第一层 pocket shift 差异，但自然 run 中 `fireline` 仍偏后段；若后续高 burst / 高机动再上升，还要继续看“玩家是否真的需要转场决策”，而不是只在 targeted probe 中成立。
## 2026-04-08 0.9v 封版检查阻断项修复更新
- 当前阶段判断继续收敛为：项目仍处于 `0.9v 封版检查阶段`，本轮定义为“封版检查中的阻断项修复”，不是恢复期，也不是内容扩写轮。
- 本轮修复的核心阻断项是：
  - HUD 顶部信息过空、血量与经验值读数不省力
  - 整局推进结构不够直观，容易读成“点几下就突然到 Boss”
  - 普通战斗压力偏低、Boss 开场压力断崖式抬升
  - Boss 身份、Boss 战目标与通关条件不够直白
- 当前已完成的关键收口：
  - HUD 改为更紧凑的状态条 + 血量条 + 经验条 + 推进轨 + 目标卡结构
  - 开局与流程读数改为从 `推进 1 / 5` 开始，且会明确显示“离 Boss 还剩几站”
  - Boss 战 HUD 会明确写出 `Boss 目标 / 击败场上首领`，并在战场内用金色血条与箭头标记锁定 Boss 本体
  - 普通 battle 模板压力已做温和上调，Boss 开场护卫/刷怪/起手承压已做轻量回收，难度曲线比此前更连续
  - `boss-bastion / fireline` 继续保留为残余风险监控项，但本轮轻量校准后，普通样本里的自然出现率已有抬升
- 当前更适合继续做：
  - 封版前全链路复检
  - 玩家可见文案 / HUD / 结果页一致性复查
  - 普通 build 下最终关远程后段的持续监控
- 当前最大风险更新为：
  - 普通 build 下 `boss-bastion / fireline` 仍不是高频样本，最终关远程后段依然有“前段成立、收束偏薄”的残余风险
  - Boss 认知层已经明显变清楚，但封版前仍需要继续盯一次真实整局样本，确认玩家不会再把最终战误读成“更厚的精英战”
## 2026-04-09 1.0 第一轮开发启动
- 当前阶段正式切到 `1.0 第一轮开发`。
- `FREEZE_SIGNOFF_0_9V.md` 继续作为稳定底座；本轮不回退做 0.9v 大修，只在它之上扩内容厚度与重玩性。
- 当前 1.0 第一轮主线优先级：
  - anomaly 深度
  - battle template 家族扩写
  - 第一批 nodes / upgrades / 事件 / Boss 内容补量
  - replay 动机增强
- 本轮已落地的首批扩写包括：
  - anomaly 新增 `冷启偏折 / 裂谱合拍 / 屏卫预读 / 首领残响`
  - battle template 新增 `火线歼灭 / 壁垒压制 / 筛火求生`
  - 节点新增 `火线试压 / 冷启裂口 / 壁垒拆解 / 欠账裂纹 / 筛火求生 / 首领残响 / Boss 预整备`
  - 升级新增一批通用桥接、路线桥接与 late rare payoff
  - replay prompt 会在异常曝光不足时直接提示“下局去看另一类低频内容”
- 当前最大的显式残余风险保持不变：普通 build 下 `boss-bastion / fireline` 仍然是低频样本；该问题在 1.0 中继续作为监控项，而不是本轮主线任务。

## 2026-04-09 1.0 第一阶段第 2 轮推进
- 当前阶段判断继续前推为：项目已进入 `1.0 第一阶段中段推进期`。
- 最新取舍依据更新为：
  - 最新用户 brief
  - `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
  - 最新 `DEV_ISSUE_LOG.md`
  - `ROADMAP_1_0.md`
- 如与较早仍停在 `0.9v freeze sign-off` 的表述冲突，以以上更新口径覆盖旧阶段摘要。
- 本轮主线从“补第一批 anomaly / template 内容量”切到：
  - `node / upgrade / route / selector` 承接加厚
  - `starter -> committed -> payoff -> hybrid / redirect` 层次补强
  - telemetry / docs 同步收口
- 本轮新的结构结论：
  - 普通 `levelUp` 继续维持 `2 个通用槽 + 1 个弹性槽`，最多 `1` 张路线强化。
  - `nodePrep` 现在也收口为“`2` 张通用强化 + `1` 张弹性槽”的结构化发牌，不再让 upgrade 节点通过多张路线牌过早锁流派。
  - `redirect / hybrid` 的主要承接窗口进一步回到 mid / late 的 upgrade 节点与 anomaly 节点，而不是让它们在 final prep 乱入。
  - `excludeFromFinalPrep` 的实际口径现已收回到“只屏蔽 `finalPrep`”，不再误伤整段 `nodePrep`。
- 本轮回归结论：
  - `nodePrep` 在无主路线的 late 样本里不再出现空面板。
  - 中段 hinted / committed 样本里，路线强化平均仍低于通用强化，且 redirect / hybrid 已进入可见区间。
  - `boss-bastion / fireline` 监控项在最新自然样本里未见明显恶化：
    - `normal`: `bossBastionRuns = 7`, `firelineSeenRuns = 1`
    - `highBurst`: `bossBastionRuns = 13`, `firelineSeenRuns = 6`
    - `highMobility`: `bossBastionRuns = 8`, `firelineSeenRuns = 3`
