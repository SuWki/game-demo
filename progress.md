Original prompt: 请先读取 `docs/` 目录下的全部项目文档和最近开发记录，再开始处理；如果文档之间存在阶段口径差异，请以最新阶段文档和最近开发记录为准，并在输出中说明你的取舍依据。

2026-04-01
- 已重新读取 `doc/docs` 全部文档，并以 `PROJECT_STATUS.md` 与最新 `DEV_ISSUE_LOG.md` 作为本轮口径优先级。
- 本轮已切换到“小规模内容接入验证”，目标是用少量真实内容验证当前底座是否足够承接扩展。
- 已补入 2 个模板变体：`survival-rush`、`elite-lockdown`。
- 已补入 2 个事件：`targeted-telemetry`、`salvage-bay`。
- 已补入 3 个 follow-up / payoff 强化：`crit-heat`、`pierce-ripple`、`dash-rethread`。
- `npm run build` 已通过，抽样脚本确认新增内容可被选择器抽到、模板变体已被节点 blueprint 接入。
- Playwright 已实测开始页、新事件面板、新强化面板、结果页，控制台无新错误。
- 本轮补做了一处关键修正：后段 / 最终战模板改为“原模板与变体并存后再抽取”，不再只是用新变体直接替换旧模板。
- 已通过抽样脚本确认：后段会在 `survival` / `survival-rush` 之间切换，最终战会在 `elite` / `elite-lockdown` 之间切换。
- 计划在开发记录中补一次代码恢复度估计，口径按“与旧项目最成熟状态相比，但以当前可继续开发完整度为重要参考”说明。

TODO
- 更新 `doc/docs/DEV_ISSUE_LOG.md`。
- 只提交本轮相关文件并 push 到 `origin/codex`。
