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
2026-04-01
- Re-read `doc/docs` and kept `PROJECT_STATUS.md` plus the latest `DEV_ISSUE_LOG.md` as the priority stage source, with `ROADMAP_0_9.md` only as ordering reference.
- Tightened metrics accuracy for rebuilt runs:
- `route_hint_time` is now recorded once per route per run.
- `death_time` now only fires on HP depletion, not all defeats.
- added `run_finished` with `buildStage`, `buildSummary`, `endingKind`, `endingReason`, `finalNodeTitle`, `battleWins`, and `nodesCleared`.
- Enriched run results so the result screen and exported metrics share the same closure summary fields.
- Updated the non-battle HUD summary so it distinguishes hinted / committed / matured route states instead of always saying only “route hint appeared”.
- Rewrote `src/ui/OverlayController.ts` cleanly in UTF-8 while preserving the current product wording and adding result-summary detail.
- `npm run build` passes.
- Browser smoke check via Playwright on `http://127.0.0.1:4173` confirmed:
- start page text is clean
- in-run HUD and choice panels are clean
- result page shows route/build/ending alignment
- `commercial_pilot_metrics_v1` now exports `run_finished`
- replay records `restart_after_first_run` and starts a clean `runIndex: 2`
- Current recovery estimate after this round:
- overall `63%~72%`
- structure `78%~85%`
- content `48%~58%`
- presentation `28%~38%`
2026-04-01
- Re-read `doc/docs` again for the presentation pass and kept `PROJECT_STATUS.md` plus the latest `DEV_ISSUE_LOG.md` as the stage source of truth.
- Confirmed from docs that this round should stay in “minimal presentation closeout”, not a UI redesign and not a content-expansion pass.
- Rebuilt the low-level presentation layer in a minimal, low-risk way:
- rewrote `OverlayController` cleanly in UTF-8 and added consistent menu / HUD / panel / result styling hooks
- added toast tones for neutral / accent / route / danger / success
- upgraded `PilotAudio` from single-beep cues to layered cue profiles with cooldown control
- refreshed `GameScene` HUD summaries and battle backdrop so route hint / lock / mature states read more clearly
- cleaned menu / result scene user-facing toast text
- `npm run build` passes after the presentation changes.
- Playwright smoke check on `http://127.0.0.1:4173` confirmed:
- start page text is clean
- in-run node / upgrade panels are clean
- route hint -> route committed -> route matured wording is consistent in HUD
- result page now feels visually closer to the same product and stays text-clean
- browser console had 0 errors
- Current recovery estimate after this round:
- overall `66%~75%`
- structure `80%~86%`
- content `48%~58%`
- presentation `40%~50%`
2026-04-02
- Re-read all docs in `doc/docs` and kept `PROJECT_STATUS.md` plus the latest `DEV_ISSUE_LOG.md` as the source-of-truth stage docs.
- The user expanded the gameplay contract this round: manual movement, XP orb pickup, in-battle level-up choices, rarity tiers, and explicit numeric formulas.
- Kept the latest-doc boundary that the project should stay in short-run node progression instead of becoming a full multi-floor Slay the Spire map.
- Added the first formula-driven pass for:
- WASD / arrow-key movement
- enemy XP orb drops and magnet pickup
- in-battle level-up choices
- rarity-based upgrade rolls
- generic stat upgrades plus route-special upgrades
- HUD and panel updates now show level, XP, rarity badges, and clearer route/build reading.
- Added `doc/docs/NUMERIC_FORMULAS.md` and updated the related docs so the new formulas and lightweight-map tradeoff are written down.
- `npm run build` passes.
- Playwright smoke check on `http://127.0.0.1:4173` confirmed:
- menu text now mentions `WASD`
- battle reaches in-run level-up panels
- upgrade cards show rarity and rolled values
- console reported 0 errors
TODO
- Re-check pacing next round: XP gain appears somewhat fast in the first two battles.
- Consider adding a small non-player-facing debug state hook if future browser verification needs exact movement / XP assertions.
2026-04-02
- Re-read `doc/docs` again and kept the newest `PROJECT_STATUS.md` plus latest `DEV_ISSUE_LOG.md` as the stage source of truth.
- Noted a phase mismatch: the repo is already past the earlier “presentation pass only” snapshot because formula-driven progression landed in the last round, but this turn stayed presentation-only on top of that state.
- Presentation closeout work stayed inside the allowed boundary:
- refined `OverlayController` for a fuller menu shell, stronger HUD hierarchy, cleaner panel helper text, and richer result chips
- refreshed `style.css` so menu / HUD / panels / result share the same shell and tone more clearly
- rebalanced `PilotAudio` so `hit` no longer flattens the whole mix and `pressure / result` read as distinct cues
- softened the battle backdrop and player glow in `GameScene` to reduce debug-placeholder feeling
- Updated docs for current stage and presentation-state tracking:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/PRESENTATION_LAYER.md`
- `doc/docs/LAUNCH_ASSET_CHECKLIST.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- Browser QA via Playwright confirmed:
- start page text is clean and more product-like
- in-run prompt/HUD/upgrade panel are clean
- result page shares the same shell and stays text-clean
- browser console had 0 errors
- Current recovery estimate after this round:
- overall `68%~76%`
- structure `81%~87%`
- content `48%~58%`
- presentation `52%~62%`
- Temporary QA helper: `output/playwright/result-flow-smoke.js` was used to drive a full run to the result screen and should not be committed.
2026-04-04
- Re-read all files under `doc/docs`, plus `progress.md`, and treated the newest `PROJECT_STATUS.md` + latest `DEV_ISSUE_LOG.md` as the doc baseline.
- For this round, used the user's latest brief as the most recent development directive on top of that baseline: stay inside the current rebuilt project and focus on content density, selector distribution, route divergence, and replay motivation instead of returning to skeleton rebuild or new systems.
- Quantified the current data state before editing:
- upgrades: 20 total (`generic` 8, each route 4); opening no-route level-up was still fixed to the same 3 starter cards every run.
- events: 5 total, all effectively always-on by round window; event selector was not actually using route-sensitive weighting because event definitions did not pass route affinity into selection weight calculation.
- nodes: template families already expanded, but round offers still repeated labels heavily and late-round single-offer probability was too high.
- Started this round on branch `codex/content-density-pass`.
- In-progress implementation:
- added phase-aware selection bonuses and lightweight event route affinity support in the content schema / selector.
- started a selector pass to guarantee stronger early route signals and more route-leaning offers once a direction is hinted or committed.
- started a content pass with additional route-specific events, more starter / bridge / payoff upgrades per route, and more node offer blueprints per stage.
- Completed implementation:
- upgrades expanded from 20 -> 26, with each route now at 6 cards and alternative starters added for all three routes.
- events expanded from 5 -> 8, including 3 route-specific events (`crit-heat-bank`, `pierce-routing-map`, `dash-weave-memory`).
- node blueprints expanded across opening / mid / late to reduce repeated offer titles and give each stage more node-text variety.
- selector changes landed:
- `ContentSelectionProfile` now supports `phaseBonuses`.
- `EventDefinition` now supports lightweight `routeAffinity`.
- upgrade selection now uses a light structured deal: no-route = route starters, hinted = route + support + flex, committed / nodePrep = more route-leaning offers.
- event selection now truly respects dominant / committed route affinity instead of ignoring route-sensitive weights.
- late node offers now have lower single-offer probability, and final battle candidates were realigned to the elite family pool.
- Small UX fix: `OverlayController` now clears stale toasts when returning to menu or showing the result screen so the closure UI is not covered by old combat tips.
- Verification completed:
- `npm run build` passes after the selector/content pass.
- local sampling confirmed stronger early route signals and better route-specific event weighting.
- Playwright smoke verified:
- start -> battle / upgrade / node / event -> result -> replay still works
- crit full-run result exports `run_finished` and replay still records `restart_after_first_run` / `second_run_start`
- early route signal screenshots were captured for dash and pierce starters
- no new browser console errors were observed
- Docs updated:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`

2026-06-05
- 本轮开始把路线推进提示收口到 HUD 左侧路线 chip 附近，短提示由路线阶段推进和关键路线牌激活共同驱动。
- 结果页现在会带上按节点编号排列的异常推进复盘，重点让 crit / pierce 能直接看出“第几节点把路推到了哪一层”。
- 还在做浏览器验证，接下来要确认提示不吵、pierce 战斗证据足够清楚、结果页不再只给概念化描述。

2026-06-05
- 继续收口玩家可见文本：结果页主文案改成三段式复盘，去掉主屏重复的 replay prompt，避免 summary / route / build 互相复读。
- 把明显的系统味、技术味和指导味文案一起换掉了，包括菜单副标题、异常面板标签、节点卡说明、部分目标提示、结局标签和结算回顾标题。
- 已把“结算/复盘文本不要重复、不要像系统说明、不要用指导口吻”的规则补进 `doc/10_设计文档/玩家可见文本规范.md`。
- 接下来要跑 build + 浏览器 smoke，确认主屏、详情页和异常选择页的文本都统一到同一套语气。

TODO
- Before commit, exclude `output/playwright/content-density-pass/*` helper scripts and screenshots from staging.
- If there is a next round, observe whether route-specific events are now common enough in real runs without locking builds too early.

2026-06-06
- 本轮目标切到“stable smoke 的双路线样板闭环”，不回到平衡调参，也没有再扩一套并行 QA 入口。
- QA-only 入口仍然沿用 `window.__pilotQaSmoke` / `pilot-qa-smoke-scenario`，只是在 `QaSmokeScenarioConfig` 上加了 `anomalyRole`，用于稳定命中真实异常样本，不影响正式玩家流程。
- 为了让 pierce 也能和 crit 一样完整验收，本轮补了两层内容：
- `route-handoff` 的 route pool 方向件元信息，便于异常页和结果页把“补方向”说准。
- `pierce-reroute-window-breakthrough` 这个穿透质变样板，用来稳定证明“拆线 -> 打穿”的异常转折。
- `RunEngine` 的 QA smoke 结果页现在会按 `direction -> core -> transform` 优先复盘，不再只挑“首个 / 主转折 / 最后一个”，这样结果页详情能稳定看出哪一下是钉方向、哪一下是拧核心、哪一下是改打法。
- `tools/qa-stable-smoke.mjs` 现在默认一趟跑 `crit + pierce` 两条路线，输出 6 张关键截图：
- `crit-anomaly.png`
- `crit-battle-route-moment.png`
- `crit-result-detail.png`
- `pierce-anomaly.png`
- `pierce-battle-route-moment.png`
- `pierce-result-detail.png`
- smoke 摘要补了最小对账字段：`routeId`、`stage`、`anomalyRole`、`routeMomentText`、`pageSegment`，另外带上了 `anomalyTripletByRoute` 方便以后直接核对 direction/core/transform 样本。
- 额外修了一处真实 UI 问题：`OverlayController.showHud()` 进入战斗时会主动收掉旧 panel，避免 anomaly 面板残留在 battle 截图里。
- 验证结果：
- `npm run build` 通过。
- 本地 preview 跑在 `http://127.0.0.1:4175/game-demo/`。
- `output/qa/stable-smoke-dual-route-20260606/final-pass/summary.json` 中：
  - `failed404Urls: []`
  - `consoleErrors: []`
  - `consoleWarns: []`
  - `crit / pierce` 的 anomaly、battle route moment、result detail 都稳定命中。
2026-04-04
- Re-read all docs, `DEV_ISSUE_LOG`, current content data, selector config, route definitions, rare-related config, and metrics before editing.
- This round follows the latest user brief on top of the docs baseline: replay motivation + rare content + payoff anti-bleed, not skeleton rebuild and not new systems.
- Added a lightweight rare layer through compatible metadata instead of a new system:
- `contentTier: 'rare'` now exists on upgrades / events / battle templates and is respected by selector weighting.
- Added 2 hybrid bridge generics, 3 route rare payoffs, 2 new rare events, 2 rare battle templates, and 2 late rare node blueprints.
- Selector updates:
- rare content is suppressed in opening, low-frequency in mid, and opened mainly in late/final
- hinted route now prefers bridge over repeating starter
- off-route pivot slots no longer leak payoff / finisher cards back into mid
- late committed now deals two in-route cards plus one flex slot
- Verification completed:
- `npm run build` passes
- static sampling confirms rare templates/events are low-frequency but reachable
- Playwright full-flow runs for crit / pierce / dash remain stable
- rare content appeared in real runs and existing metrics kept replay / branch switch working
- a dedicated branch-switch browser run confirmed `branch_switch` and `branchSwitchCount` still record correctly
TODO
- Do not commit `output/playwright/rare-replay/*`, `output/web-game/*`, `progress.md`, or other local QA artifacts.
- If there is a next round, compare natural-run rare hit rates and branch-switch frequency against real player-like choices instead of only route-biased QA runs.

2026-06-09
- Current round is staying on the crit bridge line only.
- Connected crit passive timing back through `RouteManager` so the focus lock is no longer decremented twice.
- Added a small crit bridge hold extension on focused hits so the single-target pressure window survives long enough to feel like a real bridge.
- Next: build + smoke, then capture crit bridge/payoff and pierce regression screenshots.
2026-06-09
- Current P0 follow-up: lengthened crit focus / chain / burst windows in `RunEngine.ts` and extended `boss-lockdown` signature durations in `battleTemplates.ts`.
- Validation so far: `npm run build` passes; stable smoke still passes for crit / pierce / boss; a natural crit-directed run now reaches committed crit route state; a directed boss battle sample still shows the signature phase clearly.
- TODO: keep watching whether crit payoff is now leaning on real battle conditions more than QA shaping, and avoid widening the change into a new balance pass.
2026-06-09
- Current validation set is now split cleanly: `output/qa/stable-smoke-current` holds the QA regression shots, `output/qa/natural-crit-directed-1` holds the real crit-route run, and `output/qa/real-battle-current` holds the curated real boss / crit evidence shots.
- The current read is that the sample is better, but crit payoff still relies on route choice more than a completely generic natural fight, so keep the change small and do not broaden into a balance pass.

2026-06-10
- Rechecked the current dash branch after the split pass and did not find a compile-level breakage.
- Smoothed a few dash short-hint / stage strings so the wording stays consistent across route data, battle narration, and result copy.
- Updated `doc/30_持续优化/当前阶段开发总表.md` so `P0-2：dash 主线补齐` now matches the active branch direction again.
- `npm run build` still passes after the wording/doc收口.
2026-04-04
- Re-read docs, current selector/data/metrics, and used the latest user brief on top of `PROJECT_STATUS.md` + latest `DEV_ISSUE_LOG.md`.
- This round stayed on `codex` and focused on content-pool ratio boundaries, hybrid/redirect reinforcement, and validation.
- Implemented:
- selector flex slots now prefer `hybrid / redirect` over ordinary off-route starters
- added `generic-crossfeed`, `generic-terminal-weave`
- added redirect upgrades `crit-sidechannel`, `pierce-sidechannel`, `dash-sidechannel`
- added events `route-handoff`, `mirror-cache`
- updated node distribution with `round-2-event-handoff`, higher `round-2-event-shift`, stronger `round-3-event-blackbox`, lower `round-2-upgrade-lock`
- added lightweight run-summary counters: `rareSeenCount`, `hybridPickCount`, `latePayoffSeenCount`
- Verification:
- `npm run build` passes
- static sampling shows mid flex slots now land on hybrid/redirect much more often
- Playwright smoke shows menu/battle visuals are clean and console has 0 errors
- natural 4-run sample: rare/hybrid/late-payoff appear, replay works, but `branchSwitchCount` still stayed low
- targeted switch-seeking sample: `crit -> pierce` branch switch now triggers via `route-handoff`
- Docs updated:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/DEV_ISSUE_LOG.md`

TODO
- Keep `progress.md` and everything under `output/` out of the commit.
- If there is a next round, focus on raising natural `branchSwitchCount` without letting ordinary route-specific content reclaim the mid flex slots.
2026-04-05
- Re-read the required baseline docs for the current round and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth over older status wording.
- Confirmed the repo is still on `codex/boss-phase-burst-guard`; current user-approved workflow is to keep working on the active `codex/` branch rather than spawning unrelated extra branches.
- Completed the previously interrupted Boss phase signature pass:
- `BattlePressurePhaseDefinition` now carries lightweight signature fields (`signatureLabel`, duration, pulse cadence, escort/volley payload).
- `BattleState` now tracks active signature window state for HUD/render timing.
- Boss templates now map signatures as:
- `boss-hunt.close-in -> 逼近压线`
- `boss-lockdown.pin-down -> 护卫封位`
- `boss-bastion.crossfire -> 火线齐射`
- `RunEngine` now activates signature windows on phase enter, pulses escort bursts / ranged volleys during the window, and records boss phase/signature metrics.
- `MetricsTracker` now exposes `recordBossPhaseEntered`, `recordBossPhaseDuration`, and `recordBossSignatureSeen`.
- `GameScene` HUD/readout now includes active signature text and the boss render adds a subtle extra ring during the signature window.
- Synced docs for this round:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/NUMERIC_FORMULAS.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- Validation rerun after doc sync:
- `npm run build` passes.
- `npx tsx output/qa/boss-phase-signatures.mts` confirms all three boss templates hit their intended signature and emit signature/phase metrics.
- `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` reran successfully; refreshed screenshots/summary under `output/playwright/battle-layer-0.9v/`.
- Visually checked fresh `boss-battle.png` and `result.png`; HUD is still compressed, result still shows `Boss · 追猎主核`.
- The skill-provided `web_game_playwright_client.js` could not be executed directly because its external skill-path ESM import could not resolve `playwright` from that location in this environment; used the repo's existing Playwright flow plus screenshot inspection as fallback.

TODO
- Before commit, keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- Commit this round on `codex/boss-phase-burst-guard` with the Boss phase signature message, then report doc precedence, validation, committed files, and remaining risk in the final reply.
2026-04-06
2026-04-07
- Re-read the required docs again for this round and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth over older stage wording.
- This round stayed in `0.9v 内容扩写与结构分层` and shifted the mainline to `三流派 0.9 收口`, with `boss-bastion / fireline` kept as regression monitoring only.
- Implemented route closeout through existing data-driven layers only:
- added route payoff upgrades `crit-redline`, `pierce-echo`, `dash-counterline`
- moved `crit-heat-bank`, `pierce-routing-map`, `dash-weave-memory` from ordinary event semantics into the anomaly lane and strengthened their route-specific options
- added lightweight `routeBonuses` to node blueprint weights so opening / mid / late battle carriers and final boss blueprints now lean toward route-fit outcomes without hard-locking
- updated boss node descriptions so route-to-boss closure reads more clearly in player-facing text
- Updated docs:
- `doc/docs/DEV_ISSUE_LOG.md`
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- Validation completed:
- `npm run build` passes
- static sampling confirms route-fit battle/boss carrier bias and route-specific anomaly visibility
- `npx tsx output/qa/boss-pocket-natural-runs.mts` shows no obvious regression to `boss-bastion / fireline`; normal build still low-frequency, as expected
- `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes, and the latest `boss-battle.png`, `result.png`, and `panel-17.png` were visually checked with no new text overflow or乱码

TODO
- Keep `progress.md`, `output/`, and `tools/` out of the commit.
- If there is a next round, validate route closeout quality with more natural-run samples rather than only static selector sampling, especially for `pierce -> boss-bastion` and `dash -> boss-lockdown`.
- Continued on `codex/boss-phase-burst-guard` for the new round, still treating `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- Workspace sanity-check before changes:
  - no staged leftovers or half-executed git state remained
  - only expected local artifacts were still outside commits: `progress.md`, `output/`, `tools/`
- Landed a second layer on top of boss phase signatures: persistent boss phase patterns.
- New carrier fields added:
  - `patternLabel`
  - `patternMode`
  - `patternPulseIntervalSec`
  - `patternEscortBurst`
  - `patternEscortArchetype`
  - `patternVolleyCount`
  - `patternVolleySpreadRad`
  - `patternVolleyShotsPerShooter`
- Runtime now separates:
  - `signature window` = short phase-switch confirmation
  - `pattern pulse` = sustained phase-internal space/tempo behavior
- Current boss phase patterns:
  - `boss-hunt.close-in -> 纵压驱进 (laneCrush)`
  - `boss-lockdown.pin-down -> 侧翼夹封 (sideClamp)`
  - `boss-bastion.crossfire -> 交叉火线 (crossfireWave)`
- `RunEngine` changes:
  - added persistent pattern state on `BattleState`
  - added phase-pattern activation / ticking / pulse execution
  - laneCrush and sideClamp now spawn edge-entry escort waves
  - crossfireWave now fires spread volleys on a fixed cadence
  - added low-cost metrics hooks for `boss_phase_pattern_seen` / `boss_phase_pattern_duration`
- `GameScene` changes:
  - HUD subtext now includes `模式 {patternLabel}`
  - battle rendering now adds lightweight arena overlays for sideClamp / laneCrush / crossfireWave
  - boss ring gets a brief extra flash on each pattern pulse
- Docs synced:
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`
  - `doc/docs/METRICS_SPEC.md`
  - `doc/docs/DEV_ISSUE_LOG.md`
- Validation rerun:
  - `npm run build` passes
  - `npx tsx output/qa/boss-phase-patterns.mts` confirms:
    - hunt close-in pattern pulses + escort gain
    - lockdown pin-down pattern pulses + escort gain
    - bastion crossfire pattern pulses + projectile gain
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes again
  - refreshed summary confirms:
    - anomaly panel seen
    - boss node seen
    - boss battle seen
    - replay restart works
    - console errors remain empty
    - `boss_phase_pattern_duration` now appears in exported summary events
- Visual check:
  - re-opened latest `boss-battle.png` and `result.png`
  - HUD remains compressed
  - result still shows `Boss · 锁域主核`

TODO
- Before commit, keep `progress.md`, `output/`, and `tools/` out of staging.
- Commit only this round's source/doc files with the boss phase pattern message.
- Re-read all stage docs plus current selector/content/metrics state, and kept the newest project-stage brief + latest `PROJECT_STATUS.md` / `DEV_ISSUE_LOG.md` as the source of truth.
- This round stayed on `codex` and focused on redirect default attractiveness, not new systems and not broad content flooding.
- Key findings before edits:
- real off-route redirect offers were now surfacing, but same-route `redirect` sidechannels could still leak into fallback upgrade slots and steal the choice.
- `relay-splice / route-handoff` were still too often serving as "continue current route" events instead of true reroute windows.
- `branchSwitchCount` could undercount a real switch when the same pick also caused the new route to mature.
- Implementation landed:
- `src/data/contentSelectors.ts`: removed dominant-route redirect entries from the fallback weighted pool so same-route sidechannels stop competing with true off-route redirect windows.
- `src/data/events.ts`: lowered generic relay/handoff redirect-event weights, raised route-specific reroute-window weights, and increased reroute-window off-route route push to make successful switches more decisive.
- `src/data/nodes.ts`: shifted round-2 event emphasis toward `round-2-event-reroute` and away from `round-2-event-handoff`.
- `src/systems/RunEngine.ts`: fixed `branch_switch` tracking so switch+ mature on the same pick still counts as a real branch switch.
- Updated docs:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- `doc/docs/METRICS_SPEC.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- Verification:
- `npm run build` passes after the selector/event/metrics pass.
- Playwright smoke (`output/playwright/ratio-boundaries/smoke/*`) still shows clean menu/battle visuals and 0 console errors.
- latest natural 4-run sample now shows:
- `branchSwitchNonZeroRuns = 1/4`
- `averageBranchSwitchCount = 0.25`
- redirect picks are no longer stuck at zero; multiple runs now record non-zero `redirectPickCount`.
- targeted switch validation also continues to surface non-zero branch-switch examples.
TODO
- Do not commit `progress.md` or anything under `output/`.
- If there is a next round, focus on making mid-stage redirect windows produce more consistent branch switches without letting relay/handoff or ordinary route-specific bridge content reclaim the pool.
2026-04-05
- Re-read the new baseline docs requested by the user first:
- `doc/docs/DESIGN_ALIGNMENT_BASELINE_2026-04-05.md`
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/CORE_LOOP.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/NUMERIC_FORMULAS.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- Used `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth when docs/code conflicted.
- Design alignment audit findings before code changes:
- already aligned: `WASD + auto attack`, kill -> XP pickup -> level-up 3-choice, rarity tiers/weights/value formulas, battle family coverage (`normal / elite / survival`)
- approximate only: light STS-style map progression, final battle as a high-pressure battle-template approximation, anomaly as rare-event approximation, elite behavior close to “kite/screen” but not a strict target read
- clearly drifted: `NodeType` still `battle / upgrade / event`, no distinct boss/anomaly semantics, enemy taxonomy still `regular / escort / elite`, no real ranged species
- Low-risk fixes landed:
- `src/data/contentSelectors.ts`
- upgrade offers now always de-dupe by `selectedUpgradeIds`
- route upgrades now clamp rolled rarity from `common` up to `uncommon`
- `src/systems/RunEngine.ts`
- chosen upgrades now only write `sourceId` once per run into `selectedUpgrades`
- Docs updated for the audit + low-risk corrections:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/CORE_LOOP.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
- `doc/docs/NUMERIC_FORMULAS.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- Verification:
- `npm run build` passes
- Standard Playwright smoke via the copied `web_game_playwright_client` succeeded after switching the temporary script to system Chrome
- Full browser flow in `output/playwright/design-alignment-audit/` now reaches menu -> upgrades/nodes/events -> result -> replay with 0 console errors
- Full smoke summary confirms:
- `routeCommonSeen = false` in sampled route offers
- result and replay were both reached
- `run_finished` / replay metrics still export normally

TODO
- Do not commit `progress.md`, `output/`, or temporary Playwright helper scripts under those folders.
- If there is a next round, turn the structural audit items into a minimal follow-up plan instead of mixing them into another content/data pass.
2026-04-05
- Follow-up round completed on top of the audit baseline: landed minimal semantics for `boss / anomaly` nodes and split base enemy semantics into `standard / brute / skirmisher / ranged` without rewriting the main loop.
- Code changes:
  - `NodeType` now includes `boss` and `anomaly`; final node is explicit `boss`; anomaly nodes still reuse event resolution under the hood.
  - `RunEngine` now routes `boss` through battle flow and `anomaly` through event flow, carries `finalNodeType`, and records `nodeType` on `battle_template_entered`.
  - Added archetyped enemy data plus lightweight ranged enemy shots; `regular / escort / elite` now act as combat roles rather than base enemy taxonomy.
  - Updated battle rendering to show at least minimal visual distinction for brute and ranged enemies.
- Docs updated:
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/CORE_LOOP.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`
  - `doc/docs/METRICS_SPEC.md`
  - `doc/docs/DEV_ISSUE_LOG.md`
- Verification:
  - `npm run build` passes.
  - Playwright smoke confirms anomaly and boss node labels appear in panels and metrics export now includes `battle_template_entered.payload.nodeType` plus `run_finished.payload.finalNodeType`.
  - Screenshots under `output/playwright/semantic-alignment/` show explicit Boss HUD labeling and visible bulky / ranged enemy silhouettes, though the internal battle state still is not exposed for richer automated archetype assertions.
TODO
- Do not commit `progress.md` or anything under `output/`.
- If there is a next round, consider a tiny non-player-facing QA hook for battle state inspection so enemy archetype coverage can be asserted without relying only on screenshots.
2026-04-05
- Re-read the requested baseline docs again and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- This round focused on the final recovery-stage closeout before 0.9v: land the `boss / anomaly` carrier boundaries without rewriting the main loop or RunEngine.
- Implementation landed:
  - added explicit boss template carriers: `boss-hunt`, `boss-lockdown`, `boss-bastion`
  - final node now only draws from the boss template pool instead of directly reusing elite-family template IDs
  - added lightweight `contentKind: 'event' | 'anomaly'` metadata on event definitions
  - anomaly nodes now roll only from anomaly-tagged content instead of the whole event catalog
  - metrics now export `battle_template_entered.payload.encounterType` and `event_selected.payload.contentKind`
  - anomaly panel title now renders as `异常 · ...`
- Verification completed:
  - `npm run build` passes
  - browser multi-run sample hit both `event_selected.payload.contentKind = anomaly` and `battle_template_entered.payload.encounterType = boss`
  - victory sample exported `run_finished.payload.finalNodeType = boss`
  - replay from result screen was rechecked and starts a fresh run
TODO
- Do not commit `progress.md` or anything under `output/`.
- If there is a next round, continue 0.9v work on top of the new boss template pool and anomaly content lane instead of expanding content back into the old elite/event carriers.
2026-04-05
- Re-read the requested baseline docs again and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- This round is the first 0.9v content pass on top of the new carriers, not another recovery pass.
- Implementation landed:
  - `src/data/nodes.ts`
    - added anomaly node blueprints `相位裂缝` and `Boss 阴影`
    - replaced the generic `final-boss` blueprint with explicit boss node carriers:
      - `追猎主核`
      - `锁域主核`
      - `屏卫主核`
    - removed the generic boss title/description override in `buildNode` so boss content can surface as specific carriers
  - `src/data/events.ts`
    - added anomaly-only events `phase-splitter`, `carrier-breach`, `boss-shadow-scan`
    - exported explicit `STANDARD_EVENT_CATALOG` / `ANOMALY_EVENT_CATALOG` and `getEventCatalogByKind`
  - `src/data/contentSelectors.ts`
    - anomaly rolls now use the explicit anomaly catalog helper instead of ad hoc filtering
  - `src/systems/RunEngine.ts`
    - boss battle labels now prefer the concrete boss node title
    - boss entry/completion toasts now follow the concrete boss carrier name
    - anomaly hybrid metrics coverage extended to `phase-splitter` and `carrier-breach`
- Docs updated:
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/CORE_LOOP.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/METRICS_SPEC.md`
  - `doc/docs/DEV_ISSUE_LOG.md`
- Verification:
  - `npm run build` passes
  - Playwright CLI run under `output/playwright/boss-anomaly-0.9v/` confirmed:
    - anomaly panels can hit `相位裂缝` and `Boss 阴影扫描`
    - final boss node can land as `锁域主核`
    - `battle_template_entered.payload.encounterType = boss`
    - `run_finished.payload.finalNodeType = boss`
    - replay restart still works
    - browser console had no new errors
TODO
- Do not commit `progress.md`.
- Do not commit `output/`, including `output/playwright/boss-anomaly-0.9v/*`.
2026-04-05
- Re-read the requested baseline docs and current code again for the 0.9v battle-layer pass, using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- Important audit result for this turn:
  - `boss / anomaly` carriers are already landed in code.
  - four base enemy archetypes are already landed in code.
  - the real gap is battle readability / template ownership / carrier stability, not missing semantics.
- Code changes landed:
  - `src/data/battleTemplates.ts`
    - sharpened archetype weights across elimination / elite / survival / boss template families
    - added lightweight helpers to derive encounter labels and enemy-readout summaries from existing template data
  - `src/scenes/GameScene.ts`
    - HUD now prefixes battle text with `普通战 / 精英战 / 生存战 / Boss载体`
    - HUD now shows derived `敌群 / 节奏 / 护卫 / 主核` readout text
    - enemy projectile trails plus stronger brute / skirmisher / ranged markers landed
  - `src/ui/OverlayController.ts`
    - HUD now renders the battle readout subtext
    - result pill now shows `节点类型 + 节点标题`, e.g. `Boss · 锁域主核`
  - `src/style.css`
    - added styling for the new HUD subtext
- Verification:
  - `npm run build` passes.
  - Browser smoke via copied Playwright client on system Chrome now captures real page screenshots instead of black canvas grabs.
  - Full browser flow under `output/playwright/battle-layer-0.9v/` confirmed:
    - anomaly panel seen
    - concrete boss node seen
    - boss battle metrics seen
    - result screen shows `收尾节点 Boss · 锁域主核`
    - replay restarts successfully
    - console errors remain empty
TODO
- Do not commit `progress.md`.
- Do not commit anything under `output/`, including temporary Playwright helpers copied there for Chrome-based local QA.
2026-04-05
- Continued this 0.9v round on `codex` using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- Landed before handoff:
  - split ordinary `levelUp` rolls away from `nodePrep` logic so normal upgrade panels now deal `2 generic + 1 flex`, capping route offers at `<= 1`
  - added `src/data/anomalyRoutePools.ts` and moved anomaly route options out of inline event definitions
  - cleaned player-facing overlay copy by replacing raw blueprint/event descriptions with generated summaries
  - compressed the top HUD and suppressed ordinary battle/choice toasts
  - changed XP orbs to green and enemy projectiles to red
  - raised elite/boss pressure with both template tuning and a lightweight `guardSec + guardDamageMultiplier` anti-burst window
- Extra cleanup in this pass:
  - sanitized lingering source descriptions in `src/data/nodes.ts` / `src/data/events.ts`
  - updated docs: `DEV_ISSUE_LOG.md`, `PROJECT_STATUS.md`, `NODES_AND_TEMPLATES.md`, `NUMERIC_FORMULAS.md`
- Validation already on hand:
  - `npm run build` passed before doc sync
  - sampled ordinary level-up rolls showed `maxRoute = 1`
  - anomaly route options were sampled from the dedicated anomaly pool
  - combat screenshot checks showed smaller HUD, green XP, red enemy bullets
  - sampled combat showed `maxToast = 0`
  - pressure snapshots showed elite/boss guarded burst EHP increasing substantially
TODO
- Re-run `npm run build` after the final text cleanup.
- Run `git status --short --branch`.
- Stage only this round's source/doc files.
- Keep `progress.md` and everything under `output/` out of the commit.
2026-04-06
- Continued on `codex/boss-phase-burst-guard` with the new brief, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- Landed the first half of this round's code change:
  - `BattlePressurePhaseDefinition` now supports lightweight `behaviorOverride`.
  - boss phase configs now assign explicit phase identities instead of relying only on soft pressure tuning:
    - `boss-hunt`: `逼近 -> screened`, `收束 -> frontline`
    - `boss-lockdown`: `封位 -> screened`, `锁场 -> frontline`
    - `boss-bastion`: `交火 -> summoner`, `火线收束 -> kiting`
  - `RunEngine.updateEliteEnemy()` now resolves active elite behavior from the current pressure phase instead of always using the template base behavior.
  - battle HUD enemy readout now follows the active phase behavior instead of always printing the template's base elite behavior.
- Next:
 - run `npm run build`
  - run a lightweight TypeScript sampling script to confirm active behavior changes across boss phases
  - sync docs and commit only round-relevant files
2026-04-06
- Verification completed for the boss phase behavior-identity round:
  - `npm run build` passed.
  - `tsx` helper sampling confirmed current active behavior chains:
    - `boss-hunt`: `接敌(frontline) -> 逼近(screened) -> 收束(frontline)`
    - `boss-lockdown`: `接敌(kiting) -> 封位(screened) -> 锁场(frontline)`
    - `boss-bastion`: `接敌(screened) -> 交火(summoner) -> 火线收束(kiting)`
  - engine-level full-chain sample reached `anomaly -> boss -> result` and captured boss phase samples for `boss-bastion`.
  - browser full-flow smoke via `output/playwright/battle-layer-0.9v/full-flow.mjs` confirmed:
    - anomaly panel seen
    - boss node seen
    - boss battle seen
    - HUD battle readout seen
    - replay restart works
    - console error count stayed `0`
- Docs synced:
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`
- Local commit completed on `codex/boss-phase-burst-guard`:
  - `f718e04`
  - `feat: strengthen boss phase behavior identity`
TODO
- Keep `progress.md`, `output/`, and `tools/` out of future staging unless explicitly requested.
- If there is a next round, the most likely follow-up is phase-specific pressure signatures beyond the reused `frontline / screened / kiting / summoner` palette.
2026-04-06
- Continued the new round on `codex/boss-phase-burst-guard`, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- Added lightweight boss phase-signature scaffolding:
  - `BattlePressurePhaseDefinition` now supports signature metadata.
  - `BattleState` now tracks active signature label, remaining window, and pulse timer.
- Wired runtime support for short signature windows on top of existing pressure phases:
  - escort-pulse signatures can reuse `spawnPhaseEscortBurst`
  - volley signatures can reuse enemy projectile firing without introducing a new boss system
- Current content config focus:
  - `boss-hunt.close-in` => escort-based `逼近压线`
  - `boss-lockdown.pin-down` => escort-based `护卫封位`
  - `boss-bastion.crossfire` => volley-based `火线齐射`
- Added low-cost boss observability hooks in metrics:
  - `boss_phase_entered`
  - `boss_phase_duration`
  - `boss_signature_seen`
- HUD battle subtext now includes active signature text and the boss ring gets a subtle extra signature pulse while a signature window is active.
TODO
- Run `npm run build`.
- Run a lightweight sampling script to confirm signature windows actually trigger and produce escort / volley pressure.
- Re-run browser full-flow smoke after the sample passes.
- Update docs and stage only round-relevant files; keep `progress.md`, `output/`, and `tools/` out of commit.
2026-04-06
- Continued the boss space-pressure round on `codex/boss-phase-burst-guard`, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- Landed runtime wiring for explicit safe-window space carving on top of existing boss phase patterns:
  - `BattleState` safe-window fields are now initialized in battle entry.
  - `laneCrush` now opens a vertical safe corridor and fires wall shots from top/bottom outside the corridor.
  - `sideClamp` now opens a horizontal safe corridor and fires wall shots from left/right outside the corridor.
  - `GameScene` overlay now shades danger zones outside the current safe corridor and lightly highlights the safe window.
  - HUD subtext now appends `安全窗 纵向/横向` while a safe window is active.
- Low-cost observability added:
  - `MetricsTracker.recordBossSafeWindowSeen(...)`
  - kept `boss_phase_pattern_seen / boss_phase_pattern_duration` as the equivalent space-pattern seen/duration metrics instead of duplicating names.
- Temporary QA helper added under `output/qa/`:
  - `boss-space-windows.mts`
- Next:
  - run `npm run build`
  - run the new safe-window QA script plus the existing browser full-flow smoke
  - inspect fresh screenshots
  - sync docs and commit only source/doc files
2026-04-06
- Validation completed for the boss safe-window / space-carving round:
  - `npm run build` passed.
  - `npx tsx output/qa/boss-space-windows.mts` confirmed:
    - `boss-hunt / 纵压驱进` opens a vertical safe corridor in normal / highBurst / highMobility samples.
    - `boss-lockdown / 侧翼夹封` opens a horizontal safe corridor in normal / highBurst / highMobility samples.
    - high-mobility samples still show large player-to-safe-window offsets, so the corridor is not glued to the player.
    - `boss-bastion / 交叉火线` intentionally remains rhythm-only with no safe-window carrier.
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passed again.
  - Refreshed browser summary still shows:
    - `anomalyPanelSeen = true`
    - `bossNodeSeen = true`
    - `bossBattleSeen = true`
    - `battleHudSeen = true`
    - `replayStarted = true`
    - `consoleErrors = []`
- Docs synced for this round:
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`
  - `doc/docs/METRICS_SPEC.md`
  - `doc/docs/DEV_ISSUE_LOG.md`
- Still keep out of commit:
  - `progress.md`
  - everything under `output/`
  - everything under `tools/`
2026-04-06
- Continued the remote-phase round on `codex/boss-phase-burst-guard`, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- Landed a ranged safe-pocket layer for `boss-bastion / crossfire` without introducing a new system:
  - `PressureSafeWindowAxis` now supports `pocket`.
  - `BattlePressurePhaseDefinition` now supports `patternSafeWindowSecondarySize`.
  - `BattleState` now tracks pocket secondary center/span.
  - `crossfireWave` now opens a moving pocket, spawns four-edge pressure shots around it, and keeps a lighter volley so the phase still reads as ranged fireline pressure rather than a corridor clone.
- Tuned the first remote pocket pass so the pocket stays readable for ordinary builds:
  - template values now use `patternSafeWindowSize = 184`, `patternSafeWindowSecondarySize = 126`, `patternSafeWindowLingerSec = 1.16`, `patternWallShotCount = 5`, `patternPulseIntervalSec = 1.52`, `patternVolleyCount = 1`.
  - pocket center now follows anchor-first movement instead of hugging the player.
- Updated docs for this round:
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`
  - `doc/docs/METRICS_SPEC.md`
- Validation completed:
  - `npm run build`
  - `npx tsx output/qa/boss-space-windows.mts`
  - extra inline `tsx` player-style samples for `normal / highBurst / highMobility` confirmed `boss-bastion` now exposes `axis = pocket` and pocket centers migrate across the arena.
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs`
  - visually checked fresh `boss-battle.png` and `result.png`; HUD stayed compressed and result wording remained clean.
TODO
- Run `git status`, stage only source/doc files for this round, and keep `progress.md`, `output/`, and `tools/` out of the commit.
- In the final reply, call out that remote-phase telemetry still reuses `boss_phase_pattern_seen / boss_phase_pattern_duration / boss_safe_window_seen` rather than adding a new `boss_safe_pocket_seen` family.
2026-04-06
- Continued on `codex/boss-phase-burst-guard` for the pocket-transition round, still treating `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- Current implementation focus:
  - keep the existing `pressurePhases + pattern pulse + pocket` carrier
  - add lightweight `patternPocketShiftModes`
  - let `boss-bastion` use different pocket transition flavors across `crossfire / fireline` instead of one fixed anchor loop
- Code landed:
  - `PressurePocketShiftModeId` plus per-phase `patternPocketShiftModes`
  - `BattleState.pressureSafeWindowShiftType` and per-phase `pressurePocketShiftSeen`
  - `crossfire` now alternates `sweep / centerReset`
  - `fireline` now becomes a second ranged pocket phase with `edgeBounce / centerReset`
  - pocket size / linger / player-blend now vary lightly by shift type
  - HUD readout now shows `安全袋` plus a short shift hint
  - `boss_safe_window_seen(axis = pocket)` now carries optional `shiftType`
- Validation completed:
  - `npm run build` passed
  - `npx tsx output/qa/boss-space-windows.mts` still passes for `boss-hunt / boss-lockdown`
  - added local-only `output/qa/boss-pocket-shifts.mts` for `boss-bastion` shift validation; do not commit it
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passed again
  - screenshots rechecked: HUD/result remain clean; this run hit `boss-hunt`, so boss-bastion shift validation still relies mainly on runtime QA samples
TODO
- Update docs for pocket transition richness, formulas, and metrics reuse.
- Before commit, keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
2026-04-07
- Continued on `codex/boss-phase-burst-guard`, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- This round's actual blocker turned out to be QA integrity, not just template timing:
  - the old `output/qa/boss-pocket-natural-runs.mts` was freezing in `upgradeChoice` during boss-battle level-ups and falsely reporting `outcome: ongoing`
  - it also sampled a cold-start boss sandbox rather than a fuller natural-build flow
- Rewrote `output/qa/boss-pocket-natural-runs.mts` as a local-only natural-build harness:
  - handles `battle / nodeChoice / upgradeChoice / eventChoice / result`
  - reduced sample step from `100ms` to `50ms`
  - uses natural build progression to final prep, then locks final validation to `boss-bastion` so the 1/3 boss-pool randomness does not starve bastion samples
- Production tuning landed in `src/data/battleTemplates.ts` for `boss-bastion / fireline`:
  - `patternPulseIntervalSec: 1.18 -> 1.08`
  - `triggerHpRatio: 0.35 -> 0.48`
  - `triggerRemainingSec: 10 -> 15`
  - `minResidenceSec: 4.8 -> 4.2`
- Verification after the final tune:
  - `npm run build` passes
  - `npx tsx output/qa/boss-space-windows.mts` still passes
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` now shows:
    - highBurst: `bossBastionRuns=9`, `crossfireSeenRuns=9`, `firelineSeenRuns=2`, `firelineDecisionRuns=1`
    - highMobility: `bossBastionRuns=5`, `crossfireSeenRuns=5`, `firelineSeenRuns=1`, `firelineDecisionRuns=1`
    - normal: `bossBastionRuns=8`, `crossfireSeenRuns=4`, `firelineSeenRuns=0`
  - browser full flow passes again after restarting preview:
    - anomaly -> boss -> result -> replay
    - console errors remain empty
    - latest `boss-battle.png` / `result.png` still look clean
- Docs synced:
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NUMERIC_FORMULAS.md`

TODO
- Before commit, keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- In final report, be explicit that:
  - source of truth stayed `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md`
  - no new formal metrics were added this round
  - natural-build validation now supports high burst / high mobility fireline sightings, but normal-build fireline frequency is still the biggest remaining risk
2026-04-07
- Continued on `codex/boss-phase-burst-guard`, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- This round pivoted away from single-point Boss pocket tuning and into `0.9v` full-run completeness:
  - focus = `opening / mid / late / finalPrep / boss / result / replay` closure
  - plus first-pass audio coverage on top of the existing `PilotAudio`
- Landed:
  - `AudioCue` now includes `confirm / start / anomaly / boss / victory / defeat`
  - `PilotAudio` got first-pass profiles for those cues without adding a new audio system
  - `RunEngine` now differentiates anomaly confirm, boss entry / phase transition, victory / defeat, and phase-advance handoff audio
  - `MainMenuScene / ResultScene / GameScene` now wire `start / confirm / anomaly / result`
  - `OverlayController` node panels now explain `opening / mid / late / finalPrep / finalBattle` instead of always saying only `选择下一站`
  - `src/data/nodes.ts` now gives `round 2 / round 3` richer `2~3`-choice distributions and slightly higher anomaly exposure
  - `doc/docs/CORE_LOOP.md` top summary updated from old `event` wording to current `anomaly -> final prep -> boss -> replay`
- Verification:
  - `npm run build` passes
  - inline `tsx` node sampling shows:
    - round 2 => `1/2/3` choices = `66 / 329 / 405` out of `800`, `anomalyOffers = 636`
    - round 3 => `1/2/3` choices = `104 / 372 / 324` out of `800`, `anomalyOffers = 452`
  - browser full flow via `output/playwright/battle-layer-0.9v/full-flow.mjs` passes again:
    - anomaly panel seen
    - boss node seen
    - boss battle seen
    - replay restart works
    - console errors remain empty
    - refreshed `boss-battle.png` / `result.png` checked manually
- Docs synced this round:
  - `doc/docs/CORE_LOOP.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/DEV_ISSUE_LOG.md`

TODO
- Before commit, keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- In final report, call out that:
  - the branch stayed `codex/boss-phase-burst-guard`
  - no new metrics fields were added this round
  - the biggest remaining risk is still remote Boss late-phase natural coverage in ordinary builds, not missing full-run structure
2026-04-07
- Continued on `codex/boss-phase-burst-guard` for the next brief, still using `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as source of truth.
- This round moved from flow completeness into `0.9v` content expansion and structure layering:
  - anomaly depth expansion
  - battle template family layering
  - ordinary-build `boss-bastion / fireline` kept as regression-monitor only
- Landed:
  - `EventDefinition.anomalyClass` with `routeWindow / distortion / hybrid / bossEcho`
  - anomaly selector weighting by class and phase
  - new anomaly events:
    - `断层竞价`
    - `幽栅并轨`
    - `终端税`
  - downweighted more tool-like anomaly reroute entries
  - added node blueprints:
    - `厚线突围`
    - `拖场绞锁`
    - `尾段突压`
  - surfaced blueprint descriptions directly in node cards
  - refined elimination / elite / survival template stats and archetype mixes to sharpen roles
  - fixed stale `黑匣异常` title corruption in `nodes.ts`
- Validation:
  - `npm run build` passes
  - anomaly sampling shows `phase-splitter / ghost-mesh / faultline-auction` now lead mid/late anomaly taste more often than the old reroute helpers
  - node sampling confirms:
    - opening exposes `厚线突围`
    - mid exposes `拖场绞锁` and real `elite-vice`
    - late exposes `尾段突压` with `survival-rush`
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` still shows:
    - normal `crossfireSeenRuns = 3`, `firelineSeenRuns = 0`
    - highBurst `firelineSeenRuns = 1`
    - highMobility `firelineSeenRuns = 1`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes
  - manually checked:
    - `panel-11.png`
    - `panel-12.png`
    - `panel-15.png`
    - `panel-16.png`
    - `boss-battle.png`
    - `result.png`
    all looked clean with no visible overflow or text corruption

TODO
- Before commit, keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- In final report, explicitly call out:
  - anomaly now has class-based depth weighting instead of only raw per-event weights
  - `elite-vice` now has a real node carrier
  - ordinary-build `fireline` still remains the biggest regression monitor, but it was not re-opened as the main task this round
2026-04-08
- Re-read the required docs and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md` as the source of truth.
- This round narrowed to normal-build regression calibration for `boss-bastion / fireline`; stayed on `codex/boss-phase-burst-guard`.
- Findings before edit:
  - normal samples were not mainly missing `fireline` because the timer was too late
  - many ordinary boss fights ended inside `接敌 / 交火`, so a pure `triggerRemainingSec` front-load did not help enough
  - the safer fix path was `HP handoff + shorter crossfire residence + light fireline entry confirmation`
- Production change landed in `src/data/battleTemplates.ts`:
  - `crossfire`: `triggerHpRatio 0.72 -> 0.78`, `minResidenceSec 4.4 -> 3.4`
  - `fireline`: added signature entry (`压边迁火`, `2.8s`, `1.02s`, `2 volleys`)
  - `fireline`: `triggerHpRatio 0.48 -> 0.62`, `patternSafeWindowLingerSec 0.98 -> 1.02`
  - kept `triggerRemainingSec = 15` to avoid turning the late ranged closeout into a pure timer-frontload
- Validation:
  - `npm run build` passes
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` now shows:
    - normal: `crossfireSeenRuns 4`, `firelineSeenRuns 1`
    - highBurst: `firelineSeenRuns 1`
    - highMobility: `firelineSeenRuns 3`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes
  - visually checked fresh `boss-battle.png` and `result.png`; no obvious new overflow or readability regression
- Docs updated:
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/NUMERIC_FORMULAS.md`

TODO
- Keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- In final report, call out that no new dedicated fireline metrics were added because existing boss phase/signature/pattern/safe-window metrics already cover the observation need.
2026-04-08
- Continued on top of the existing acceptance-polish pass without reopening content expansion or a Boss-special feature pass.
- Code polish already landed in:
  - `src/game/types.ts`
  - `src/systems/RunEngine.ts`
  - `src/scenes/GameScene.ts`
  - `src/ui/OverlayController.ts`
  - `src/style.css`
- This pass finished the doc sync and closeout:
  - added a fresh top entry to `doc/docs/DEV_ISSUE_LOG.md` for the full-run closure / text-HUD / result-page polish round
  - updated `doc/docs/PROJECT_STATUS.md` so the top focus now reads as `0.9v 验收前修边 + 全流程闭环一致性 + Boss 远程后段回归监控`
  - added a short acceptance-polish supplement section in `PROJECT_STATUS.md`
- Revalidation on the current working tree:
  - `npm run build` passes
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes again
  - visually checked refreshed `boss-battle.png`, `result.png`, `replay.png`
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` still reports:
    - normal: `crossfireSeenRuns 4`, `firelineSeenRuns 1`, `firelineDecisionRuns 1`
    - highBurst: `firelineSeenRuns 1`
    - highMobility: `firelineSeenRuns 3`
- Acceptance-polish conclusion:
  - no visible text corruption or obvious overflow in the refreshed screenshots
  - early HUD route noise is lower (`未站稳` chip instead of three zero chips)
  - result / replay closure is meaningfully stronger via route trace + replay prompt
  - `boss-bastion / fireline` remains the main residual freeze-check monitor, but this pass did not regress it
  - found one more acceptance-polish gap after screenshot review: boss/HUD readouts still exposed `Boss载体 / 主核 / 准备交火`
  - applied a small follow-up polish in `src/data/battleTemplates.ts` and `src/data/nodes.ts` to rename those visible terms toward `Boss战 / 首领 / 交战在即`
  - verified on a fresh preview port (`127.0.0.1:4174`) that current-runtime panel text now shows the cleaned wording (for example `偏首领正压`)

TODO
- Before commit, stage only:
  - `src/game/types.ts`
  - `src/systems/RunEngine.ts`
  - `src/scenes/GameScene.ts`
  - `src/ui/OverlayController.ts`
  - `src/style.css`
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
- Keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- Suggested commit message for this round:
  - `chore: polish full run flow before 0.9v freeze`
2026-04-08
- Re-read all docs under `doc/docs/` again and kept `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md + latest user freeze-check brief` as the source of truth for this round.
- Freeze-check conclusion before code edit:
  - full run remains structurally stable
  - normal-build `boss-bastion / fireline` is still the main residual monitor, but there was no obvious regression
  - the highest-value remaining UX rough edge was the final-prep / final-boss node objective card still reading too generically as `选择下一站`
- Landed one low-risk product-facing polish in `src/scenes/GameScene.ts`:
  - final-prep node choice now reads `进入最终整备`
  - final-boss node choice now reads `确认最终战`
  - this keeps flow clarity tighter without changing systems or balance
- Revalidation after the text-flow polish:
  - `npm run build` passes
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` still reports:
    - normal: `bossBastionRuns=10`, `crossfireSeenRuns=7`, `firelineSeenRuns=2`
    - highBurst: `firelineSeenRuns=1`
    - highMobility: `firelineSeenRuns=5`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes
  - manually rechecked updated `panel-14` / `panel-16` screenshots and confirmed the new objective labels are visible
- For final reporting:
  - mention that the browser summary's `bossBattleSeen=false` is a QA-script matcher lag, not a gameplay regression; the same summary still shows `battle_template_entered(encounterType=boss)` and the screenshots/metrics confirm boss battle entry.
  - keep `progress.md`, `output/`, and `tools/` out of commit.
2026-04-08
- Re-read all docs under `doc/docs/`, plus `progress.md`, and treated `DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md + latest user brief` as source of truth for this round.
- This round temporarily rolled the project back from freeze sign-off to `0.9v 封版前阻断项修复` because real runtime feedback showed a new blocker: the game was effectively silent to players.
- Audio audit conclusion before editing:
  - the repo already had `PilotAudio` and cue wiring in scenes / `RunEngine`
  - there were no audio asset files
  - there was no BGM path at all
  - the existing cue layer was only very short procedural pings, so even though code paths existed, the runtime experience still read as “no sound”
  - unlock timing was also brittle: first cues could be missed while the `AudioContext` was still resuming
- Implemented the blocker fix without adding a big new system:
  - expanded `src/systems/PilotAudio.ts` into a minimal procedural audio layer with separate `music / sfx / master` gains
  - added lightweight BGM modes for `menu / battle / boss / result`
  - added pending-cue replay after `AudioContext.resume()` so the first user-facing cue is not lost
  - exposed `window.__pilotAudioDebug()` in `src/main.ts` for runtime verification
  - added first-interaction audio unlock on global `pointerdown / keydown`
  - updated `MainMenuScene`, `GameScene`, and `ResultScene` to set music mode and unlock before UI playback
- Validation completed:
  - `npm run build` passes
  - `output/playwright/audio-blocker-check/menu-audio-summary.json`
    - `currentMusicMode=menu`
    - `peakRms=0.01144`
    - `scheduledMusicSteps=6`
  - `output/playwright/audio-blocker-check/battle-live-audio-summary.json`
    - `currentMusicMode=battle`
    - `peakRms=0.01025`
    - `cueCounts.start=1`
    - `cueCounts.pressure=1`
    - `cueCounts.hit=2`
  - `output/playwright/audio-blocker-check/fullflow-audio-summary.json`
    - `metrics.bossEvents[0].payload.encounterType=boss`
    - `resultAudio.cueCounts.boss=2`
    - `exportAudio.cueCounts.click=1`
    - `replayAudio.cueCounts.start=2`
    - `replayStarted=true`
    - `consoleErrors=[]`
- Current judgment after the fix:
  - the audio blocker is closed
  - the project can return to `0.9v freeze sign-off / 0.9v 可封版状态`
  - the main remaining explicit residual risk is still normal-build `boss-bastion / fireline`

TODO
- Before commit, stage only:
  - `src/main.ts`
  - `src/scenes/MainMenuScene.ts`
  - `src/scenes/GameScene.ts`
  - `src/scenes/ResultScene.ts`
  - `src/systems/PilotAudio.ts`
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/FREEZE_SIGNOFF_0_9V.md`
- Keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- Suggested commit message:
  - `fix: unblock 0.9v freeze with working audio`
2026-04-09
- Re-read all docs under `doc/docs/`, including `FREEZE_SIGNOFF_0_9V.md`, plus `progress.md`, and treated `latest stage docs + freeze sign-off + latest DEV_ISSUE_LOG + latest user brief` as source of truth.
- This round moves the project into `1.0 第一轮开发`, explicitly keeping `0.9v 可封版状态` as the frozen baseline rather than reopening freeze polishing.
- Early gap audit before code edits:
  - anomaly pool is thick enough in raw count, but still skews too much toward `routeWindow` in opening/mid samples and only has one `bossEcho`
  - battle template families are readable but still thin in raw variety: only `3` opening battles, `4` elite-family templates, `4` survival-family templates, `3` boss families
  - nodes and upgrades still have visible phase identity, but the first 1.0 pass should add more carrier density and replay-facing variation without touching the main loop
  - normal-build `boss-bastion / fireline` remains a regression monitor only, not this round's mainline task

TODO
- Add a first 1.0 expansion pass focused on:
  - deeper anomaly classes, especially more `distortion / hybrid / bossEcho`
  - more opening / elite / survival template variants plus node blueprints to carry them
  - first extra batch of upgrades and boss-adjacent content without introducing new systems
- Re-run build + natural boss monitor + browser full-flow after the content pass.
- Keep `progress.md`, `output/`, and `tools/` out of the commit.
2026-04-09
- Completed the first 1.0 content expansion pass on top of the frozen 0.9v baseline.
- Validation rerun after the content pass and doc sync:
  - `npm run build` passes
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` shows no obvious regression:
    - normal: `bossBastionRuns=7`, `crossfireSeenRuns=3`, `firelineSeenRuns=1`, `firelineDecisionRuns=1`
    - highBurst: `firelineSeenRuns=1`
    - highMobility: `firelineSeenRuns=2`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes
  - refreshed screenshots confirm anomaly panel, final boss node, result page, and replay remain clean
  - `summary.bossBattleSeen=false` is still a matcher lag in the QA script; metrics confirm `battle_template_entered(encounterType=boss)` and `boss_safe_window_seen(phaseId=fireline)`
- Docs synced for the 1.0 stage:
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/ROADMAP_1_0.md` (new)

TODO
- Before commit, stage only:
  - `src/data/battleTemplates.ts`
  - `src/data/contentSelectors.ts`
  - `src/data/events.ts`
  - `src/data/nodes.ts`
  - `src/data/upgrades.ts`
  - `src/game/types.ts`
  - `src/systems/RunEngine.ts`
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/ROADMAP_1_0.md`
- Keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- Suggested commit message:
  - `feat: start 1.0 content expansion pass one`
2026-04-09
- Re-read current 1.0-stage docs again and kept `latest user brief + DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md + ROADMAP_1_0.md` as source of truth for the mid-phase route / upgrade pass.
- This round focused on `node / upgrade / route / selector` structure instead of reopening Boss tuning:
  - fixed `excludeFromFinalPrep` so it now excludes only `finalPrep`, not all `nodePrep`
  - structured `nodePrep` into `2 generic + 1 flex`
  - added generic / crit / pierce / dash bridge, redirect, and late-payoff upgrades
  - added mid / late node carriers for reroute, anomaly pivot, and payoff windows
  - extended telemetry for upgrade-offer rarity/value buckets, route offer hits, anomaly visibility, and branch-switch phase counts
- Revalidation after the route / upgrade pass:
  - `npm run build` passes
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` still shows no obvious boss regression:
    - normal: `bossBastionRuns=7`, `crossfireSeenRuns=3`, `firelineSeenRuns=1`
    - highBurst: `bossBastionRuns=13`, `firelineSeenRuns=6`
    - highMobility: `bossBastionRuns=8`, `firelineSeenRuns=3`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes
  - manually rechecked fresh `output/playwright/battle-layer-0.9v/result.png` and `panel-16.png`; text and panel layout look correct

TODO
- Stage only the route / upgrade / telemetry / docs files for this round.
- Do not commit `progress.md`, anything under `output/`, or anything under `tools/`.
- Suggested commit message:
  - `feat: add route and upgrade content batch for 1.0 phase 1`
2026-04-10
- Re-read the current 1.0-stage docs and kept `latest user brief + DESIGN_ALIGNMENT_BASELINE_2026-04-05.md + latest DEV_ISSUE_LOG.md + ROADMAP_1_0.md` as source of truth.
- This round stayed in `1.0 第一阶段` and shifted the mainline from structural carry to `构筑分化 / replay 动机补厚`:
  - added generic hybrid / rare late-payoff upgrades and one extra redirect upgrade per route
  - added replay-grade anomaly content for `hybrid` and `bossEcho`
  - added node carriers `并轨整备 / 稀有读数 / 并线残响`
  - added lightweight replay/event history so result prompts can react to rare payoff / hybrid / redirect / bossEcho exposure
  - extended run summary with `rarePayoffPickCount` and `bossEchoSeenCount`
- Validation completed:
  - `npm run build` passes
  - static content counts now show `upgrades=73`, `anomaly=28`, `hybrid anomaly=7`, `bossEcho anomaly=5`
  - late sampling shows replay-grade hybrid / bossEcho anomaly now lands in natural late pools
  - `npx tsx output/qa/boss-pocket-natural-runs.mts` shows no obvious regression:
    - normal: `bossBastionRuns=9`, `crossfireSeenRuns=5`, `firelineSeenRuns=1`
    - highBurst: `firelineSeenRuns=2`
    - highMobility: `firelineSeenRuns=1`
  - `npm exec --yes --package=playwright -- node output/playwright/battle-layer-0.9v/full-flow.mjs` passes after restarting preview
  - manually checked fresh `result.png`, `panel-14.png`, `panel-40.png`, and `replay.png`

TODO
- Stage only:
  - `src/data/contentSelectors.ts`
  - `src/data/events.ts`
  - `src/data/nodes.ts`
  - `src/data/upgrades.ts`
  - `src/game/types.ts`
  - `src/systems/MetricsTracker.ts`
  - `src/systems/RunEngine.ts`
  - `doc/docs/DEV_ISSUE_LOG.md`
  - `doc/docs/METRICS_SPEC.md`
  - `doc/docs/NODES_AND_TEMPLATES.md`
  - `doc/docs/PROJECT_STATUS.md`
  - `doc/docs/ROUTES_SPEC.md`
- Keep `progress.md`, everything under `output/`, and everything under `tools/` out of staging.
- Suggested commit message:
  - `feat: expand replay and route payoff content for 1.0 phase 1`
2026-04-12
- Re-read latest phase docs and confirmed repo is still at 1.0 phase 1 / round7 docs, so this work was treated as round8 candidate with doc precedence: latest stage docs -> latest PROJECT_STATUS -> latest DEV_ISSUE_LOG.
- Implemented round8 continuity pass on branch `codex/opening-mid-continuity-round8`:
- strengthened opening-mid route surfacing in `src/data/contentSelectors.ts` without breaking `2 generic + 1 flex`
- added / tuned continuity carriers in `src/data/upgrades.ts`, `src/data/events.ts`, `src/data/nodes.ts`
- reran static selector sampling, Playwright route-flow rerun, and boss-pocket natural runs.
- Current verification snapshot:
- route-flow now reaches `crit -> matured` and `pierce -> committed` with `branchSwitchCount = 0`
- opening screenshots show current-line starter surfaced for `crit` and `pierce`
- boss monitor still regressed versus round7 baseline, especially normal `firelineSeenRuns = 0 / 24`
- Updated docs:
- `doc/docs/PROJECT_STATUS.md`
- `doc/docs/DEV_ISSUE_LOG.md`
- `doc/docs/ROUTES_SPEC.md`
- `doc/docs/NODES_AND_TEMPLATES.md`
TODO
- Before or after commit, recheck staged diff for docs wording around round8 candidate / boss risk so we do not overstate closure.
- Keep `progress.md`, `output/`, `tools/`, and `doc/skills/` out of the commit.
2026-04-13
- Continued the in-game UI pass on `codex-dev` with the user’s latest direction: less webpage, more Brotato-like HUD / choice tray, and much less descriptive text.
- Kept the existing logic structure and only pushed the presentation layer:
- tightened `src/style.css` so HUD blocks are harder-edged, more compact, and bottom-sheet framing stays gone
- compressed choice cards into shorter, flatter in-game option cards with stronger panel-type color separation
- cooled `src/scenes/GameScene.ts` terrain colors so the arena reads closer to a game field than a web backdrop
- Validation:
- `npm run build` passes
- refreshed browser screenshots under `output/playwright/ui-refresh-check/`
- checked `battle-brotato-pass.png` and `panel-brotato-pass-v2.png`; HUD is now smaller, route tray is no longer a big black page block, and card text is visibly shorter
TODO
- If the next pass continues this direction, prioritize compacting `OverlayController` markup itself so HUD/status wording can be shortened at the source instead of relying mainly on CSS suppression.
- Keep `progress.md`, `output/`, `tools/`, and `doc/skills/` out of the commit.
2026-04-13
- Pushed the same UI pass further after user feedback that it still looked like black web panels:
- changed battle HUD from boxed cards toward thin game ribbons in `src/ui/OverlayController.ts` + `src/style.css`
- reduced solid fills further so HUD and choice cards read as in-game overlays instead of page modules
- removed the battle viewport frame in `src/scenes/GameScene.ts` and added a lighter field grid to make the arena feel like a play space instead of an embedded page
- refreshed screenshots after rebuild:
- `output/playwright/ui-refresh-check/battle-game-style-v2.png`
- `output/playwright/ui-refresh-check/panel-game-style-v2.png`
- latest pass also hides extra ribbon helper text so top-center / top-right stay short
TODO
- Next visual pass should directly simplify `OverlayController` panel/card wording and then move on to full stage-map visualization, referencing Slay the Spire-style map readability while keeping this more arcade HUD style in combat.
2026-04-13
- Broadened the UI pass beyond battle HUD:
- restyled start / result shells in `src/style.css` so they read more like full-screen game overlays than centered web cards
- tightened the right-side menu stats into smaller HUD-like strips and kept the choice tray / cards aligned with the same in-game visual language
- verified `npm run build` still passes
- refreshed screenshots for menu + panel:
- `output/playwright/ui-refresh-check/menu-ui-pass-v3.png`
- `output/playwright/ui-refresh-check/panel-ui-pass-v2.png`
TODO
- Result screen styling was updated through shared CSS, but a fresh full result visual check should be rerun with a faster deterministic path before committing this UI batch.
2026-04-13
- Shifted from UI polish to combat-feel polish on top of the current `codex-dev` worktree.
- High-value battle pass landed in:
- `src/game/types.ts`
- `src/systems/RunEngine.ts`
- `src/scenes/GameScene.ts`
- `src/systems/PilotAudio.ts`
- Changes focused on moment-to-moment feel rather than new systems:
- added transient combat feedback state for hit / spawn / recovery / impact / shake
- regular, elite, dash, pickup, and kill events now spawn visual combat pulses instead of only changing numbers
- enemy contact no longer silently consumes enemies; contact now deals damage, bounces the enemy off, and keeps pressure on the player
- player shots now render with trails, enemy/projectile readability is stronger, and player state reads more clearly via impact / recovery / crit / dash rings
- added extra combat cues for `dash`, `kill`, and `pickup`, and strengthened the ordinary `hit` cue
- Validation:
- `npm run build` passes
- local preview launched on `http://127.0.0.1:4175`
- battle screenshots checked:
- `output/playwright/battle-feel-pass/battle-opening.png`
- `output/playwright/battle-feel-pass/battle-mid.png`
- custom full-flow Playwright smoke on `4175` reached result + replay with `consoleErrors = []`
- `output/playwright/battle-feel-pass/full-flow/summary.json` -> `resultSeen: true`, `replaySeen: true`
- audio debug snapshot during battle showed active music plus combat cues (`start`, `pressure`, `hit`, `kill`)
TODO
- If the next combat pass continues, prioritize gameplay-side pressure and pacing, not another UI-only polish round.
- Best next targets:
- make ordinary battles escalate faster without overfilling the screen
- differentiate crit / pierce / dash combat feel more directly in live battle, not only in picks/results
- keep `progress.md`, `output/`, `tools/`, and `doc/skills/` out of any commit unless explicitly requested.
2026-04-13
- Follow-up combat pass focused on pacing and in-battle readability rather than just extra VFX.
- Landed:
- ordinary battle low-pressure refill in `RunEngine.spawnEnemies()` so opening/mid fights spend less time in empty lull states
- stronger spawn-wave tempo response when multiple enemies enter together
- `pierce` echo now throws clearer chain pulses so the line-clearing read shows up in combat, not only in route text
- ranged enemies now telegraph lock pressure more clearly on the player, including a visible player-side warning reticle
- added a light `pierce` lane read around the player shell so route identity is easier to spot during live play
- Validation:
- `npm run build` passes
- restarted preview on `http://127.0.0.1:4175`
- checked refreshed screenshots:
- `output/playwright/battle-feel-pass/round2/battle-opening.png`
- `output/playwright/battle-feel-pass/round2/battle-pressure.png`
- reran full-flow smoke: `output/playwright/battle-feel-pass/full-flow-round2/summary.json`
- result + replay still reached, `consoleErrors = []`
TODO
- Next combat pass should likely stop adding pure feedback and start tuning encounter pacing / enemy cadence per template so each battle family feels less samey.
2026-04-14
- Combat pass round3 shifted from general feedback polish to live battle identity.
- Landed in `src/game/types.ts`, `src/systems/RunEngine.ts`, and `src/scenes/GameScene.ts`:
- ordinary encounter pacing is now pattern-aware, with faster refill / burst support for flank-heavy, lane-heavy, and ranged-heavy templates instead of one shared refill rhythm
- regular spawns now lightly preserve each template's pressure identity by nudging `skirmisher / brute / ranged` presence when a template would otherwise flatten into generic fodder
- player auto-fire now reads route intent in combat:
- `crit` prefers damaged / elite cash-out targets and gains a stronger cadence refund inside overdrive
- `pierce` prefers line-through targets and keeps straighter, longer live shots
- `dash` prefers close or movement-aligned threats and keeps its counter-hit pressure active during drive
- live combat visuals now echo those decisions:
- ordinary battle families get subtle field-shape overlays (`pincers`, horizontal lanes, vertical lanes, surround)
- player aim / route cues are clearer for `crit`, `pierce`, and `dash`
- bullet trails now tint by live route focus instead of all reading the same
- Validation:
- `npm run build` passes
- fresh preview verified on `http://127.0.0.1:4178`
- screenshots checked:
- `output/playwright/battle-feel-pass/round3/battle-opening.png`
- `output/playwright/battle-feel-pass/round3/battle-pressure.png`
- `output/playwright/battle-feel-pass/round3/full-flow/battle.png`
- `output/playwright/battle-feel-pass/round3/full-flow/result.png`
- custom full-flow smoke on `4178` reached result + replay with `consoleErrors = []`
- `output/playwright/battle-feel-pass/round3/full-flow/summary.json` -> `resultSeen: true`, `replaySeen: true`
TODO
- If the next pass continues combat polish, the best follow-up is enemy-side micro-behavior personality per archetype family, not more HUD work.
- If route feel still needs another lift after real play, consider small damage-window / kill-confirm tuning for `crit` and more chase-convert timing for `dash`, but avoid adding new systems.
2026-04-14
- Combat pass round5 focused on making ordinary battle families pressure the player in more distinct ways instead of only looking different.
- Landed in `src/systems/RunEngine.ts` and `src/scenes/GameScene.ts`:
- ordinary template support floors are now stronger:
  - `pincer` fights hold onto at least a light skirmisher presence
  - vertical-lane ranged fights keep crossline pressure more reliably
  - horizontal-lane brute fights keep shove pressure more reliably
- enemy micro-behavior is now more template-aware:
  - standard enemies in `pincer / lanes` align with the current clamp or lane instead of flattening back into generic chase
  - brutes in horizontal lane battles now read more like marching line-breakers with a shove rhythm
  - skirmishers in pincer-heavy battles now cut around the player from their side and re-enter more aggressively
  - ranged enemies in lane-heavy fights hold their lane more clearly and fire slightly bracketed shots, so `crossline / sieve` pressure reads less random
- battle overlays now animate their flow:
  - pincer fights show side-collapse pulses
  - vertical lanes show moving crossline lane markers
  - horizontal lanes show marching shove markers
- Validation:
- `npm run build` passes
- preview verified on `http://127.0.0.1:4179`
- the skill-provided Playwright client was attempted first but still failed in this environment because its browser bundle is missing; used the repo's working `npm exec --package=playwright` fallback again
- captured fresh artifacts:
  - `output/playwright/battle-feel-pass/round5/battle-opening.png`
  - `output/playwright/battle-feel-pass/round5/battle-pressure.png`
  - `output/playwright/battle-feel-pass/round5/full-flow/summary.json`
- full-flow smoke still reaches result + replay with `consoleErrors = []`
TODO
- Next combat pass should likely tune danger fairness and payoff clarity inside the now-stronger template identities:
  - check whether vertical-lane ranged volleys feel readable rather than cheap
  - check whether horizontal brute shove rhythm is strong enough to notice without becoming oppressive
  - consider a small `crit` kill-confirm bump or `dash` chase-convert timing bump only if live play still feels flat after the template-pressure pass
2026-04-14
- Combat pass round6 focused on two thin but high-value battle-feel gaps:
  - danger should read earlier and more precisely, especially for ranged lane pressure
  - route payoff should connect more directly from shot -> kill -> next shot
- Landed in `src/systems/RunEngine.ts` and `src/scenes/GameScene.ts`:
- live combat payoff tuning:
  - `crit` now leans harder into kill-confirm rhythm when the target is already low or elite, with a little more cadence carry and overdrive extension on finish
  - `pierce` gets a slight extra reward when it already found a strong lane, so line-clearing shots read more deliberate
  - `dash` now converts moving chase lines into tighter, faster retaliation fire and carries momentum harder through kills
- readability / fairness tuning:
  - ranged enemies now telegraph a projected impact point instead of only drawing a line to the player's current body
  - low-HP enemies get a lightweight execute bracket during `crit` focus, so cash-out reads more intentional
  - forward-aligned chase targets get a faint pursuit line during `dash` focus, so retaliation windows read less accidental
- Validation:
- `npm run build` passes
- preview verified on `http://127.0.0.1:4180`
- fresh browser artifacts:
  - `output/playwright/battle-feel-pass/round6/battle-opening.png`
  - `output/playwright/battle-feel-pass/round6/battle-pressure.png`
  - `output/playwright/battle-feel-pass/round6/full-flow/summary.json`
- full-flow smoke still reaches result + replay with `consoleErrors = []`
TODO
- Next combat pass should probably stop widening systems and instead tune the remaining feel balance inside these cues:
  - if ranged projected-impact markers are still too subtle in real play, increase contrast slightly rather than adding text
  - if `crit` now feels good on finish but still flat between confirms, consider only a very small mid-chain visual/sound lift
  - if `dash` chase-convert is visible enough, the next best target may be enemy death / pickup / recovery pacing rather than more route-specific markup
2026-04-14
- Combat pass round8 shifted from pure hit/hurt into `开火反馈 + 近失压迫`.
- Landed in `src/game/types.ts`, `src/systems/RunEngine.ts`, and `src/scenes/GameScene.ts`:
- player shots now carry a lightweight muzzle flash / recoil state instead of only spawning bullets
- enemy projectiles now trigger a short near-miss warning ring when they scrape past the player without actually hitting
- player body render now leans back slightly during recoil, and muzzle flash reads in aim direction instead of all fire reading the same
- Validation:
- `npm run build` passes
- preview verified on `http://127.0.0.1:4181`
- fresh browser artifacts:
- `output/playwright/battle-feel-pass/round8/battle-muzzle.png`
- `output/playwright/battle-feel-pass/round8/battle-nearmiss.png`
- `output/playwright/battle-feel-pass/round8/full-flow/battle-pressure.png`
- `output/playwright/battle-feel-pass/round8/full-flow/summary.json`
- full-flow smoke still reaches result + replay with `consoleErrors = []`
TODO
- Next combat pass should likely stay in feel polish, but move from `shot / near-miss readability` to `kill conversion / enemy death timing / pickup magnet cadence`
- If this still feels too soft in hand, the next best low-risk layer is route-specific firing audio contour, not more HUD markup

2026-04-14
- Continued battle feel pass: shifted arena palette cooler, strengthened route-field energy, added brighter bullet tracers, enemy hit sparks, and stronger player route flourish rendering in src/scenes/GameScene.ts.
- Build rerun pending, then browser screenshot verification for battle opening / pressure / panel readability.

- Validation after the new battle render pass:
  -
pm run build passed.
  - Preview on http://127.0.0.1:4182 passed full-flow browser smoke with
esultSeen: true,
eplaySeen: true, consoleErrors: [].
  - Reviewed fresh screenshots under output/playwright/battle-feel-pass/round9/full-flow-v2/; battlefield now reads cooler and more energetic, and the command-tray style from the interrupted CSS pass remains stable.


2026-04-14
- Core-loop / combat pass shifted to reward-chain polish instead of only hit feedback.
- In src/systems/RunEngine.ts: kills now burst XP into multi-shard drops, pickups accelerate harder, nearby XP gets chain-vacuum nudges, and pickups feed a tiny cadence carry.
- In src/scenes/GameScene.ts: XP orbs now render motion trails and short magnet links so pickup flow is readable on screen.
- In src/systems/PilotAudio.ts: kill / pickup cues were lifted to better match the stronger reward chain.
- Synced /doc truth docs for current handoff, risks, targets, priorities, and added doc/30_�����Ż�/��������/2026-04-14_����ѭ����ս���ر�����ĥ.md.
- Next step: rerun build + browser smoke and inspect whether the pickup chase loop really reads better in combat.


2026-04-15
- Continued combat polish on codex-dev with a fairness + route-feel pass.
- Added short enemy recovery windows after ranged fire / player collision, with supporting render cues.
- Added crit punish cadence and pierce line-clear reinforcement through bullet hit counts and better echo target alignment.
- Validation: npm run build passed; Playwright full-flow at output/playwright/battle-feel-pass/round12/full-flow/summary.json -> resultSeen=true, replaySeen=true, consoleErrors=[].
- Docs synced under doc/00_接手入口, doc/10_设计文档, doc/30_持续优化.
TODO
- Next combat pass should focus on enemy micro-behavior personality and fairness, not UI expansion or new systems.
- Keep progress.md, output/, tools/, and unrelated doc migration files out of the commit.


2026-04-15
- Continued combat/core-loop polish on codex-dev with a flow-surge + enemy-personality pass.
- tempoPulse now lightly boosts chase/reposition feel and kill/pickup events now nudge ordinary battle spawn flow so runs drop into fewer empty lulls.
- enemy recovery windows now resolve with clearer archetype-specific behavior: standard peel, brute re-shoulder, skirmisher flare-out, ranged reset.
- Validation: npm run build passed; Playwright full-flow at output/playwright/battle-feel-pass/round13/full-flow/summary.json -> resultSeen=true, replaySeen=true, consoleErrors=[].
- Visual checks: output/playwright/battle-feel-pass/round13/pressure-check/battle-opening.png and battle-mid.png.
TODO
- Next pass should focus on elite pressure identity and route-specific mini-highs inside live combat, not UI or new systems.
- Keep progress.md, output/, tools/, and unrelated doc migration files out of the commit.

2026-04-15
- Continued combat/core-loop polish on codex-dev with an elite escort-handoff + crack-window pass.
- In src/systems/RunEngine.ts, elite pulses now sync nearby escorts, escort spawns bias into clearer screen shapes, elite resolve cracks nearby escorts into short recovery windows, and crit/pierce get more reliable live payoff around those windows.
- In src/scenes/GameScene.ts, added a lightweight elite-escort field overlay so shield formation and crack timing are easier to read on screen.
- Validation: npm run build passed; output/playwright/battle-feel-pass/round15/full-flow/summary.json -> resultSeen=true, replaySeen=true, consoleErrors=[]; visual checks passed for output/playwright/battle-feel-pass/round15/general-check/battle-opening.png and battle-pressure.png.
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of the commit.
- Elite-specific natural-sample screenshot signoff is still pending; next pass should continue validating elite readability without opening a new system/UI round.
2026-04-15
- Continued the same combat/core-loop mainline on codex-dev with an elite crack-chase follow-through pass.
- In src/systems/RunEngine.ts, escort spawn shapes were widened, crack windows now peel escorts aside/back and briefly hold ranged escorts, and target selection now biases the elite body during real crack windows.
- In src/scenes/GameScene.ts, added a clearer breach wedge for elite recovery plus a tiny `getBattleDebugSnapshot()` QA hook; src/main.ts now exposes it as `window.__pilotBattleDebug()`.
- Docs synced under doc/00_接手入口, doc/10_设计文档, doc/30_持续优化, plus a new recap in doc/30_持续优化/开发复盘/2026-04-15_精英裂口追击与验证补强.md.
- Validation:
  - npm run build passed after the crack-chase and QA-hook changes.
  - Playwright full-flow at output/playwright/battle-feel-pass/round16/full-flow/summary.json -> resultSeen=true, replaySeen=true, consoleErrors=[].
  - Targeted elite rerun can now reliably hit elite samples at output/playwright/battle-feel-pass/round16/elite-check/summary.json -> eliteRouteChosen=true, eliteBattleSeen=true, but exact crack-frame screenshot capture is still timing-sensitive.
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of the commit.
- Next pass should keep narrowing elite crack-window signoff instead of switching to map work, Boss work, or a new system/theme round.

2026-04-15
- Continued combat/core-loop polish on codex-dev with a direct-feel pass instead of a new system pass.
- Landed in `src/game/types.ts`, `src/systems/RunEngine.ts`, `src/scenes/GameScene.ts`, and `src/systems/PilotAudio.ts`:
  - added new combat cues `shoot / hurt / enemyShot / nearMiss`
  - raised overall music+sfx energy slightly so battle no longer feels half-muted
  - player movement now has lightweight velocity carry, opening burst, and turn burst instead of pure flat translation
  - encounter backdrops now differ more clearly between ordinary / elite / survival patterns
  - enemy projectile spawn and player motion trails now read more strongly in live play
- Validation:
  - `npm run build` passed
  - `output/playwright/battle-feel-pass/round16/full-flow/summary.json` still shows `resultSeen=true`, `replaySeen=true`, `consoleErrors=[]`
  - `output/playwright/battle-feel-pass/round16/elite-check/summary.json` still shows `eliteRouteChosen=true`, `eliteBattleSeen=true`
  - `window.__pilotAudioDebug()` snapshot during battle showed `currentMusicMode='battle'` and real cue counts including `shoot`
- Docs synced:
  - `doc/00_�������/��ǰ���ӿ�.md`
  - `doc/10_����ĵ�/ս�����������.md`
  - `doc/30_�����Ż�/��ǰ���������ȼ�.md`
  - `doc/30_�����Ż�/��������/2026-04-15_ս��ֱ���ָв�ǿ.md`
TODO
- Before commit, keep `progress.md`, `output/`, `tools/`, and unrelated doc migration files out of staging.
- Next pass should continue on hit-confirm / hurt-confirm / battle-family feel, not map visualization or new systems.
2026-04-15
- UI weight pass for the user's light-game reference landed on codex-dev.
- Rewrote src/ui/OverlayController.ts with shorter copy and lighter menu / HUD / route-choice / upgrade-choice / result markup.
- Replaced src/style.css heavy dark panel language with warm low-weight in-world overlays; route and upgrade panels now read more distinctly.
- Updated src/main.ts backgroundColor so menu/result no longer sit on a dark empty canvas.
- Validation: npm run build passed; preview at http://127.0.0.1:4173; Playwright full-flow rerun reached result + replay with consoleErrors=[].
- Visual checks passed for output/playwright/battle-feel-pass/round16/full-flow/menu.png, panel-28.png, battle-opening.png, result.png.
TODO
- If the user still wants the UI lighter, next pass should reduce tray height and further compress the result callout, not reintroduce dark cards.
- Keep progress.md, output/, tools/, and unrelated doc migration files out of any commit.
2026-04-15
- Continued combat polish on codex-dev with a hit-confirm / hurt-direction / kill-flow pass instead of opening a new system/theme round.
- Landed in `src/game/types.ts`, `src/systems/RunEngine.ts`, `src/scenes/GameScene.ts`, and `src/systems/PilotAudio.ts`:
  - `BattleState` and `RunEngine` now track kill-flow chain timing plus explicit player damage / near-miss angles.
  - `GameScene` now renders kill-flow surge pips, stronger incoming-hit chevrons, and lighter near-miss direction chevrons around the player shell.
  - `updateShooting()` now lightly carries kill-flow into muzzle pulse / recoil / shake so kill-to-next-shot rhythm reads better.
  - `PilotAudio` slightly raised battle energy and separated `enemyShot` vs `nearMiss` more clearly while lifting `hit / hurt / kill`.
- Validation:
  - `npm run build` passed.
  - `output/playwright/battle-feel-pass/round17/full-flow/summary.json` -> `resultSeen=true`, `replaySeen=true`, `consoleErrors=[]`.
  - `output/playwright/battle-feel-pass/round17/audio-debug.json` confirmed `currentMusicMode='battle'` with real cue counts during combat.
  - Visual checks: `output/playwright/battle-feel-pass/round17/full-flow/battle-opening.png`, `output/playwright/battle-feel-pass/round17/pressure-idle-check/battle-idle-pressure.png`, `output/playwright/battle-feel-pass/round17/result.png`.
TODO
- Before commit, keep `progress.md`, `output/`, `tools/`, and unrelated doc migration files out of staging.
- If the next pass continues combat polish, prioritize natural-sample readability of the new direction cues and kill-flow rollout rather than switching back to UI/map/Boss work.
2026-04-16
- Continued the UI simplification pass on `codex-dev` after the interrupted session, without reopening map work or new systems.
- Rebuilt `src/ui/OverlayController.ts` so the battle HUD is now plain in-world text: left only HP/XP and thin bars, center only `波次 x / y`, right only short objective text.
- Reworked `src/style.css` into a darker game-overlay style and updated `src/main.ts` backgroundColor so menu/result no longer sit on a page-like light shell.
- Validation: `npm run build` passed; preview verified on `http://127.0.0.1:4185`; Playwright full flow under `output/playwright/ui-minimal-pass/round18/summary.json` -> `resultSeen=true`, `replaySeen=true`, `consoleErrors=[]`.
- Visual checks passed for `menu.png`, `battle-opening.png`, `panel-12.png`, `panel-17.png`, and `result.png`.
TODO
- Keep `progress.md`, `output/`, `tools/`, and unrelated doc migration files out of staging.
- If the next pass returns to gameplay, stay on combat/core-loop polish rather than reopening heavy UI shells or map visualization.
2026-04-16
- Continued the combat-feel pass on codex-dev without reopening map visualization, new systems, or a Boss-only round.
- Tightened ordinary battle reward-chain continuity in src/systems/RunEngine.ts by extending killFlow carry, making XP magnet / chain vacuum more aggressive during streaks, and pushing pickup -> next-pressure pacing harder.
- Tightened elite crack follow-through by boosting elite-body target priority during recovery, delaying escort refill slightly after cracks, and adding generic crack follow-through carry for fire / move / tempo.
- Added small readability overlays in src/scenes/GameScene.ts for XP flow links and elite chase guide chevrons.
- Validation this round:
pm run build passed; Playwright full flow reached result; elite quick-check confirmed eliteSeen = true and crackSeen = true.
- Residual risk: the old replay detector in output/playwright/.../full-flow/summary.json still reports
eplaySeen = false, but the captured
eplay.png shows battle restarted correctly, so the script heuristic needs cleanup later.
2026-04-16
- Continued gameplay polish on codex-dev with a regular-enemy pressure pass instead of reopening map work, new systems, or a Boss-only round.
- In src/systems/RunEngine.ts, regular enemies now use small pressure-beat helpers so standard / brute / skirmisher / ranged read more differently during opening and mid battle.
- Opening intent now leans on existing spawnFlashSec / pressurePulseSec / tacticCooldownSec instead of a new combat system: pack pushes, brute front-load, skirmisher cut-ins, and ranged screen-up all surface earlier.
- In src/scenes/GameScene.ts, added lighter in-world family intent cues so each enemy family telegraphs its next beat more clearly without adding UI boxes.
- Validation this round:
pm run build passed; Playwright full-flow reached result with consoleErrors=[]; ordinary pressure screenshot looked good; elite natural recheck was inconclusive and should stay a monitoring item.
- Residual risk: output/playwright/battle-feel-pass/round20/elite-quick-check/summary.json did not reliably hit crackSeen, so elite natural-sample stability still needs follow-up rather than signoff.

2026-04-16
- Continued the same combat/core-loop line on codex-dev with an ordinary-battle defeat-handoff pass instead of reopening map work, Boss work, or new systems.
- In src/systems/RunEngine.ts, regular enemy deaths now create small family-specific battlefield follow-through: standard / skirmisher deaths can hand pressure to nearby regulars, while brute / ranged deaths can open a short local gap via recovery / delay on nearby regulars.
- Validation: npm run build passed; output/playwright/battle-feel-pass/round20/full-flow/summary.json -> resultSeen=true, consoleErrors=[]; output/playwright/battle-feel-pass/round20/elite-quick-check/summary.json again missed elite samples, so elite natural stability remains monitoring only.
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of staging.
- If the next pass continues combat polish, keep sharpening live mini-highs and elite natural-sample stability instead of switching to map work or a new system/theme round.

2026-04-16
- Re-read the latest battle handoff docs and code before editing.
- Confirmed the current top gap is elite crack-window readability and payoff, not ordinary battle baseline.
- Added lightweight elite crack window state, stronger elite target bias, escort crack flash, and extended in-world chase guidance.
- Validation: npm run build passed; round20 full-flow passed; round20 elite quick check still missed a natural elite sample; targeted round21 elite rerun confirmed elite battle, crack window, and escort crack states.
- Keep progress.md/output/doc migration artifacts out of commit.
2026-04-17
- Continued the interrupted UI game-feel pass on `codex-dev` instead of reopening map work or new gameplay systems.
- In `src/ui/OverlayController.ts`:
  - rebuilt menu / result into lighter in-world state overlays
  - shortened HUD objective wording to compact reads like `目标: 强化 / 选路 / 处理`
  - reworked node / upgrade / event panels into tray entries instead of modal cards
- In `src/style.css`:
  - replaced the remaining card-heavy panel language with clipped, low-weight tactical strips
  - added faint screen glyph / corner line treatment so menu and result no longer read like plain pages
  - reduced node / anomaly panel tag weight and clamped descriptions to one line to cut explanatory noise
- In `src/main.ts`:
  - aligned Phaser background color with the new darker in-world shell
- Validation:
  - `npm run build` passed
  - preview rechecked at `http://127.0.0.1:4187`
  - reran `output/playwright/battle-feel-pass/round20/full-flow.mjs`
  - fresh `summary.json` shows `resultSeen=true`, `consoleErrors=[]`; `replaySeen=false` is still the stale detector heuristic, but the new `replay.png` confirms restart did happen
  - visually checked `menu.png`, `panel-4.png`, `panel-10.png`, `panel-11.png`, `panel-15.png`, and `result.png`
TODO
- Stage only `src/main.ts`, `src/style.css`, `src/ui/OverlayController.ts`, and the single new recap doc file for this UI pass.
- Keep `progress.md`, `output/`, `tools/`, and unrelated doc migration files out of the commit.
- If the user still wants the UI更像游戏，下一刀优先继续减托盘 tag 数量和文案长度，不要重开新页面系统。
2026-04-18
- Continued the combat-feel pass on codex-dev with a tighter hit-confirm / hurt-confirm / audio-punch layer instead of opening a new system.
- In src/systems/PilotAudio.ts: raised battle music presence slightly, lifted overall SFX output, reduced over-pumping from frequent shot ducking, and added low-end impact thumps plus small cue variation for dash / hit / hurt / kill / crit / pickup / pressure.
- In src/systems/RunEngine.ts: fixed the projectile-hurt pulse indentation issue, slightly hardened critical / elite hitstop, strengthened kill-confirm recoil carry, and made enemy impact pulses read a bit sharper.
- In src/scenes/GameScene.ts: added harder enemy hit slashes, stronger directional player-damage wedges, and a clearer impact wash so hurt feedback reads faster without adding UI.
TODO
- Re-run build + browser smoke and inspect whether the new hurt wedge / hit slash reads punchy enough without becoming noisy.
- Keep progress.md, output/, tools/, and unrelated doc migration files out of staging.
- Validation complete for the new round:
  - npm run build passed.
  - Preview served at http://127.0.0.1:4194.
  - Full-flow browser smoke at output/playwright/battle-feel-pass/round23/summary.json -> resultSeen=true, replaySeen=false (same stale detector pattern), consoleErrors=[].
  - output/playwright/battle-feel-pass/round23/audio-debug.json confirmed active combat cues including shoot / hit / kill / enemyShot / nearMiss / hurt / pressure.
  - Reviewed output/playwright/battle-feel-pass/round23/damage-check/battle-damage.png and the new impact layer reads harder without adding HUD clutter.
- Added a matching recap doc at doc/30_�����Ż�/��������/2026-04-18_ս����Ч������ܻ�������ǿ.md.
TODO
- If the next pass stays on combat feel, prioritize natural-sample hurt readability and ordinary-family live pressure personality before opening any new theme.
2026-04-18
- Scoped boss bugfix pass on codex-dev after interruption; no new systems or content theme changes.
- Fixed boss-bastion pressure by reducing ranged escort weight, shrinking add cap/max, widening crossfire/fireline safe pockets, slowing pulse cadence, and softening phase-only escort/ranged multipliers.
- Pressure-pattern projectiles now respect active safe windows; crossfireWave volleys also inherit safe-window protection.
- Contact damage and enemy-projectile damage now both finalize defeat immediately when HP reaches 0.
- Validation:
  - npm run build passed.
  - npx tsx output/qa/boss-space-windows.mts passed.
  - npx tsx output/qa/boss-pocket-natural-runs.mts -> normal crossfireSeenRuns=5/24, firelineSeenRuns=4/24.
  - direct tsx logic check confirmed safe-window-tagged projectiles do not damage inside pocket, and both projectile/contact damage end the run immediately at 0 HP.
  - browser smoke rerun completed with consoleErrors=[]; generic full-flow did not naturally reach boss, so boss correctness for this pass relies mainly on the QA scripts above.
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of staging.
- If the next pass stays on boss feel, verify by fresh hands-on play whether ordinary add pressure still needs a tiny follow-up, but do not reopen a Boss-only round without new evidence.
2026-04-18
- New task focus: choice panel layout cleanup + anomaly meaning pass.
- Landed centered two-choice layout, fuller anomaly cards, and implicit route-support on anomaly options.
- Verified with npm run build and round20 Playwright full-flow / family-check.
- Do not stage progress.md, output/, tools/, or old doc/docs migration noise.
2026-04-18
- Continued gameplay polish on codex-dev with a pickup follow-through / ordinary battle reward-chain pass instead of opening a new system or Boss round.
- In src/systems/RunEngine.ts:
  - added lightweight `pickupFlow` / `pickupLead` battle state
  - orb pickups now reinforce move/turn/fire carry more clearly
  - ordinary battle pickups lightly surface a next follow-through target through existing regular-pressure helpers
- In src/scenes/GameScene.ts:
  - added in-world pickup chase wedges, chain pips, and short guide lines toward the current follow-through target
- Validation:
  - npm run build passed
  - output/playwright/battle-feel-pass/round20/full-flow/summary.json -> resultSeen=true, consoleErrors=[]
  - output/playwright/battle-feel-pass/round20/family-check/summary.json -> resultSeen=true, consoleErrors=[]
  - replaySeen=false remains the stale selector heuristic; replay.png still shows restart
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of staging.
- If the next pass stays on combat/core-loop, keep validating whether pickup follow-through helps ordinary samples read cleaner without making the field noisy.
2026-04-18
- Continued gameplay polish on codex-dev with an ordinary-battle mini-high + enemy-family personality pass.
- In src/systems/RunEngine.ts:
  - ordinary auto-targeting now leans harder into `pickupLead` / `pickupFlow`
  - hits on the current follow-through target now carry more move/fire/tempo payoff
  - standard / brute / skirmisher / ranged react more differently during ordinary surge windows
- In src/scenes/GameScene.ts:
  - added short archetype-shaped markers for the current follow-through target so the target's response reads faster in combat
- Validation:
  - npm run build passed
  - output/playwright/battle-feel-pass/round20/full-flow/summary.json -> resultSeen=true, consoleErrors=[]
  - output/playwright/battle-feel-pass/round20/family-check/summary.json -> resultSeen=true, consoleErrors=[]
  - replaySeen=false remains the stale selector heuristic; replay still restarts correctly
TODO
- Keep progress.md, output/, tools/, and unrelated doc migration files out of staging.
- If the next pass stays on gameplay, keep pushing natural live mini-high stability and elite natural-sample readability before opening any new theme.
2026-04-19
- Continued on `codex-dev` without opening a new theme; kept the mainline in `1.0 第一阶段` core combat polish.
- Landed a low-risk elite follow-through pass:
  - elite crack window now lightly suppresses lingering enemy projectiles inside the breach corridor
  - elite breach hits now also hold a bit of `playerRecovery` read so the chase window reads more clearly
  - `GameScene` now fades/tints breach-corridor enemy projectiles to show the fireline thinning in-world
- Added elite sample observability to `window.__pilotBattleDebug()`:
  - `enemyProjectileCount`
  - `breachProjectileCount`
  - `breachSuppressionRatio`
- Validation this round:
  - `npm run build` passed
  - `node output/playwright/battle-feel-pass/round20/full-flow.mjs` passed (`resultSeen = true`, `consoleErrors = []`)
  - `node output/playwright/battle-feel-pass/round20/family-check.mjs` passed (`resultSeen = true`, `consoleErrors = []`)
  - visually checked `output/playwright/battle-feel-pass/round20/full-flow/battle-pressure.png`
- Local-only QA note:
  - `output/playwright/battle-feel-pass/round20/elite-targeted-check-fixed.mjs` was adjusted as a temporary helper only and must stay out of the commit.
  - targeted elite validation is still script-noisy; the new debug fields are the main handoff for stabilizing it next round.
TODO
- Keep `progress.md`, `output/`, `tools/`, and unrelated doc migration files out of staging.
- Next best step is to use the new elite debug snapshot fields to stabilize a reliable elite natural/targeted verification path before pushing elite signoff further.
2026-04-20
- Completed the requested audio/art landing pass on top of the current `1.0 第一阶段` combat-polish branch.
- Code changes are in `src/scenes/GameScene.ts`, `src/systems/PilotAudio.ts`, `src/ui/OverlayController.ts`, and `src/style.css`.
- Visual polish covered clearer enemy family / elite / boss silhouettes, stronger pickup + projectile readability, safe-window brackets, and a steadier `pierce` rail signature.
- Audio polish covered lightweight combat cue context (`routeFocus / encounter / intensity`) and clearer separation for `shoot / hit / kill / pickup / hurt / nearMiss / pressure / enemyShot`.
- Validation completed with `npm run build`, `node output/playwright/battle-feel-pass/round20/full-flow.mjs`, `node output/playwright/battle-feel-pass/round20/family-check.mjs`, and `output/playwright/battle-feel-pass/round20/audio-polish-check/summary.json`.
- Skill-client note: `web_game_playwright_client.js` ran with a local Chrome path, but its canvas captures were black in this environment, so signoff still relies on the repo's battle-feel scripts and screenshot review.
TODO
- If the next pass stays on presentation/combat feel, prioritize `dash` route signature and elite/boss high-pressure readability before opening any new theme or audio system.2026-04-22
- User asked for a more Brotato-like pass on the start screen, result screen, and choice panels.
- Collected public reference pages first, then translated the structure into this project instead of copying Brotato literally.
- Implemented a UI refresh in:
- `src/ui/OverlayController.ts`
- `src/style.css`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/ResultScene.ts`
- Start screen now uses a large left title block, stronger CTA, route chips, and a compact right-side summary stack.
- Choice panels now use thicker rounded dark cards with clearer type / rarity tags and bullet-like effect lines.
- Result screen now uses a heavier closure card, compact run stats, and a stronger replay CTA.
- Verification:
- `npm run build` passes.
- Local browser screenshots captured with Playwright-compatible automation using local Chrome executable:
  - `output/playwright/ui-brotato-refresh/menu.png`
  - `output/playwright/ui-brotato-refresh/panel.png`
  - `output/playwright/ui-brotato-refresh/result.png`
- Follow-up if needed: tighten panel top spacing and push the cards slightly higher/lower depending on how close we want to stay to Brotato's exact feel.
2026-04-22
- User rejected the dark/boxed pass and supplied explicit page references plus fixed doc rules for start screen, result screen, HUD, and choice UI.
- Updated the new UI rules/docs first so implementation now follows:
  - centered title + stacked buttons on the menu
  - center result board + exactly two bottom buttons on the result screen
  - battle HUD only keeps top-left HP/EXP bars, top-center wave + mode, and the in-world player HP bar
  - choice overlays only keep one title and four boxes
- Rebuilt `src/ui/OverlayController.ts` around those fixed rules instead of continuing the previous tray/side-panel structure.
- Added a new lighter game-like CSS layer in `src/style.css`:
  - bright menu backdrop with centered chunky buttons
  - light result board with bottom action buttons
  - simplified four-card choice layout
  - stripped-down HUD layout
- Updated `src/scenes/ResultScene.ts` to remove the third export action from the result page.
- Updated `src/scenes/GameScene.ts` so:
  - HUD mode text reads as gameplay mode words like `���� / ���� / ��Ӣ / Bossս`
  - the player now renders with a small overhead HP bar
- Validation:
  - `npm run build` passes
  - browser screenshots captured at:
    - `output/playwright/ui-doc-reset/menu.png`
    - `output/playwright/ui-doc-reset/battle.png`
    - `output/playwright/ui-doc-reset/panel.png`
    - `output/playwright/ui-doc-reset/result.png`
  - `output/playwright/ui-doc-reset/summary.json` shows `consoleErrors=[]`

TODO
- If the user wants another pass, keep the same fixed page structure and only tune:
  - menu background illustration detail
  - result board decoration density
  - choice-card spacing / size / decoration
- Do not reintroduce dark boxed side panels, HUD right-side objective blocks, or a third result button.

2026-04-26
- Continued the codex-dev maintenance pass after the full-loop polish round and kept the work inside the existing product shape.
- Tightened upgrade rarity spread in `src/data/upgrades.ts` with rarity-aware quantization and a wider cap for count-based stats so the same archetype no longer collapses into the same level values as often.
- Reduced battle rendering cost in `src/scenes/GameScene.ts` by widening terrain tiles, thinning pebble strokes, and softening camera shake so hit feedback reads as impact instead of hitching.
- Removed the visible XP pickup trail line and trimmed the pickup-follow-through line work.
- Verified with `npm run build`, `npx tsx` upgrade sampling, and browser screenshots captured from the local preview server.

2026-05-01
- Followed the web-game iteration loop for the player 15-point feedback pass.
- Confirmed the only available runtime image assets are currently player core, standard enemy, and XP orb; all three are already connected in the runtime.
- Tightened gameplay feel issues in code: movement no longer uses impact-freeze simulationDt, dash route gets a baseline pulse once the route has appeared, regen/dash heal/pierce cap/pierce echo/pierce refund were reduced, boss safe zones now protect inside and punish outside more clearly, and boss ranged density/wall shots were reduced again.
- Updated player-facing wording from old dash/冲刺 terms to 穿梭 wording and kept HP/EXP integer display.
- Verified with npm run build, full-flow QA, and boss-bastion directed QA.

2026-05-07
- 完成路线特化关卡设计文档（ROUTE_SPECIFIC_ENCOUNTERS_DESIGN.md）
  - 为Crit/Pierce/Dash三条路线设计专属精英关和Boss关
  - 3个精英关：蓄势压制(elite-pressure-hold)、感染压制(elite-contagion)、夹道压制(elite-gauntlet)
  - 3个Boss关：处决首领(boss-executioner)、要塞首领(boss-fortress)、猎杀首领(boss-predator)
  - 包含完整的TypeScript配置、节点蓝图、实现步骤、平衡性分析和测试要点
  - 设计目标：充分检验每个流派的核心机制（Crit爆发节奏、Pierce印记传播、Dash动量维持）
- 整理核心循环改进文档（CORE_LOOP_IMPROVEMENT.md）
  - 记录已完成的连杀奖励机制、升级能力变化显示、路线特色击杀奖励
  - 记录Crit/Pierce/Dash路线独特被动的实现状态
- 整理3C改进建议文档（3C_IMPROVEMENT.md）
- 新增持续优化文档目录（doc/30_持续优化/）
  - 实机测试记录和问题清单
  - 素材管理指南和检查报告
  - 护卫AI优化方案
  - 求职版本开发排期
- 新增UI设计文档（docs/ui-redesign-proposal.md、docs/visual-optimization-progress.md）
- 新增工具脚本（tools/fix-route-upgrades.mjs/py）
- 更新测试截图（output/qa/boss-directed-v2/、output/qa/current-version/）
- 提交并推送到远程codex-dev分支（commit 27d26a0）

TODO
- 按照ROUTE_SPECIFIC_ENCOUNTERS_DESIGN.md实现6个新关卡模板
- 更新src/game/types.ts添加新的BattleTemplateId
- 更新src/data/battleTemplates.ts添加6个完整配置
- 更新src/data/nodes.ts添加节点蓝图
- 测试验证新关卡的平衡性和体验
2026-05-10
- 修复一次中途引入的开始游戏阻断：HUD 倒计时改从战斗模板读取 winCondition，npm run build 与 full-flow QA 均通过。
- 本轮 P0 体验修复已覆盖：升级全屏白闪改玩家周围柔光、levelUpReady 独立提示音、HUD 顶部去掉设计说明行、奖励强化卡加“通关奖励”、精英/Boss 血条标签、穿梭文案移除“不需要按键”、路线牌同一张不可重复选择。
- 修复精英护卫不出现的根因：护卫计数只统计 role === 'escort'，不再让普通怪占用护卫名额。
- Boss 行为回调：主 Boss 模板更偏 screened/kiting，并在 updateEliteEnemy 加入近距离反顶人后撤，避免 Boss 贴脸堵住玩家进安全区。
- 验证：npm run build 通过；qa-current-version 通过 consoleErrors=[] resultSeen=true；路线审计硬违规 0 / 超预算 0；boss-hunt 定向 QA 通过并采到安全区数据。
TODO
- 用户需要实机确认：升级柔光是否不刺眼、奖励强化提示是否清楚、精英/Boss 标签是否可读、Boss 是否仍有贴脸顶人情况、护卫恢复后精英压力是否合适。

2026-05-18
- 流派强化机制改造：将暴击流、穿透流、穿梭流所有 type: 'route' 进度效果改为 type: 'stats' 机制属性
- 新增机制属性：critOverdriveCritBonus、critSplashRadius、flawDurationBonus、critOverdriveDurationBonus、pierceEchoDamageBonus、crackSpreadRadius、pierceCooldownRefundBonus、dashChargeSpeed、dashCounterDamageBonus、dashGrazeRadiusBonus
- 重写 ROUTE_DESCRIPTION_OVERRIDES：64张路线牌描述全部改为纯机制描述，不再提及属性数值
- 文本规范实施：
  - "窗口"统一改为"时间"（无伤窗口→无伤时间）
  - "短窗"统一改为"短时机"（短窗爆发→短时机爆发）
  - "反击窗口"→"反击时机"
  - 简化过长描述："贯穿裂纹目标后...（对精英/Boss有倍率限制）"→"裂纹扩散范围强化"
- 创建文本规范文档 doc/10_设计文档/玩家可见文本规范.md
- 更新设计基线与约束文档，添加文本规范引用
- 创建本轮复盘 doc/30_持续优化/开发复盘/2026-05-18_流派强化文本规范实施.md
- 验证：npm run build 通过

TODO
- 用户需要实机确认：各流派强化是否正常触发、机制描述是否易懂、数值平衡是否合理
2026-05-29
- Self-test report: output/qa/selftest-20260529/summary.json
- 6 autoplay runs; clear rate 0/6; avg duration 56.63s; avg nodes selected 2.17; avg upgrades chosen 7.
- All runs ended unformed; routeId never locked; avg route-upgrade offers 2.67 and picks 1.0 per run.
- Mid/late battle nodes remain the main fail points.
- Preview also logs repeated 404s for /data/*.json under the /game-demo/ base path.

2026-05-29 balance pass
- Fixed ConfigLoader JSON fetch base handling for /game-demo/ by resolving data URLs from document.baseURI / BASE_URL.
- Route upgrades now apply real route progress again; starter route cards provide a stronger first signal; instant-heal upgrade effects are preserved at runtime.
- Early/mid level-up selectors now surface starter route cards in the first 2-3 panels and bias follow-up offers toward the first hinted route.
- Reduced early battle-only pacing pressure in node selection and lowered difficulty / selection weight on the repeated mid-late fail nodes.
- Softened elite-pressure-hold, elite-contagion, elite-gauntlet, survival-rush, and survival-gauntlet density / escort pressure.
- Raised rare+ payoff separation with stronger rarity multipliers / baselines and lower value-bucket thresholds.
- Added browser QA runner: tools/qa-selftest-balance-pass.mjs
- Validation:
  - npm run build passed.
  - Local preview verified at http://127.0.0.1:4188/game-demo/
  - New report: output/qa/selftest-balance-pass/summary.json
  - 404s cleared: consoleErrors=[] and failedUrlCounts={}
  - 6 runs: clear rate 1/6, avg duration 101.08s, avg nodes selected 4.0, avg upgrades chosen 11.5
  - buildStage distribution: matured 6/6
  - routeId distribution: crit 3 / pierce 2 / dash 1
  - Failures are no longer concentrated in the same two mid-pressure nodes; samples spread across multiple late battles and boss endpoints.
- Next step if another pass is needed:
  - route lock is now reliable but overtuned for autoplay, so the next pass should trim early follow-up route bias and keep more runs in hinted/committed before matured.
2026-05-29
- Added tools/qa-smart-natural-fullrun.mjs: full-run smart QA script combining route-aware choice logic and live battle steering from __pilotBattleDebug.
- Smart script sample (6 runs, 720-step cap): bossReached 4/6, matured 3/6, routeId formed in 4/6, avg nodesCleared 3.0, but clears still 0 and boss fights remain lethal.
- Current regression signal versus older natural runs: simple natural-long now yields only 2/10 formed runs and 0/10 boss reaches, so route reinforcement and midgame/boss survivability both regressed.

## 2026-05-29 ·�߳����ݴ� + Boss �ο���������
- ���ּ�����������·��/�ڵ�/ģ��ϵͳ���ص��µ�����Ȼ�ű���δ���߷��գ���ѹ�� Boss ����ģ��Ĺ���ѹ����
- �������Ҫ������
  - `src/systems/RunEngine.ts`
    - ·���ƽ���Ϊ�����������ۺ�ͬ·�߽��Ⱥ��ٽ��㣬����ͬһ����� route effect ������ж�ʱ��ʧ���߻��ᡣ
    - `matured` ��ֵ�� 5 ���� 4�����ſ��� committed ��� matured �ж�������
  - `src/data/contentSelectors.ts`
    - ǰ�ж��õ� 2~3 ��ͬ·���ƺ����ͬ·�ߺ�������Ȩ�ز���һ��ѹ�� off-route��
    - �� hinted �׶λ����ر� redirect/hybrid ���ţ�������·���������͡�
  - `src/data/upgrades.ts`
    - route �� payoff/finisher Ҳǿ�Ʋ���·�߽��� effect���á��õ�ͬ·�߹ؼ��ơ����ȶ�ת����ʵ���ߡ�
  - `src/data/nodes.ts`
    - round 1~2 ������� upgrade �ڵ�Ȩ�ء���ѹ anomaly �͹����ѹ battle��
    - �µ� mid/late �����ѹ�ڵ�� difficultyScale��Boss �ڵ� difficultyScale ͳһ���䡣
  - `src/data/battleTemplates.ts`
    - �µ� `elite-pressure-hold` / `elite-contagion` / `elite-gauntlet`��
    - �µ� `survival-rush` / `survival-gauntlet` / `survival-sieve`��
    - �µ� `boss-executioner` / `boss-fortress` / `boss-predator` �ı����;á�ˢ���ܶȡ��������� phase ѹ����
- ������֤��`npm run build` ͨ����
- Ԥ����֤��`http://127.0.0.1:4201/game-demo/`
- �½����
  - ����Ȼ�ز⣺`output/qa/retest-natural-long-boss-pass-20260529/summary.json`
    - 10 �� 1 ͨ�أ�2 �ֵ� Boss��
    - `buildStage`: matured 10/10��
    - `routeId`: crit 4 / dash 4 / pierce 2��
    - ƽ����ʱ 65.76s��ƽ��ս��ʤ�� 3.2��ƽ����ڵ� 3.3��
    - 404 ȫ����ʧ��
    - ʧ�ܽڵ��ѷ�ɢ�� `�������� / �������� / ����׷�� / ����в� / �ذ�׷�� / ����ѹ�� / ��ɱ����`�������Ǵ���δ���ߺ���ͬһ�жε㡣
  - ���������ز⣺`output/qa/smart-natural-fullrun-boss-pass-20260529/summary.json`
    - 6 �� 2 ͨ�أ�4 �ֵ� Boss��
    - �� 1 �� `committed` ͨ�ء�1 �� `matured` ͨ�ء�1 �� `matured` Boss ʧ�ܡ�
    - ʧ���Ѹ߶�ѹ���� Boss��`Ҫ������` ��ͨ��ʣ����ҪӲ���� `��������`��
- ���ۣ������Ѿ��ﵽ������Ȼ���ٴ��� unformed�����ܽű��п���֤���������������Ŀ�ꡣ��һ����ü���ѹ���� `boss-executioner`������� late �� `����׷�� / ��������`��
2026-05-30
- Continued the late-game收口 pass on top of the current rebuild and kept the work inside the existing `src/data/*` + `src/systems/RunEngine.ts` layer.
- This round focused on:
  - boss safe-window readability and blocker clearance in `RunEngine`
  - late round-3 battle nodes (`生存压制`, `筛火求生`, `夹道求生`, `爆点追收`, `回线反压` etc.)
  - boss templates for `boss-lockdown`, `boss-bastion`, `boss-predator`, `boss-fortress`, and a light touch on `boss-executioner`
  - a small round-2 reduction on `蓄势压制 / 夹道压制 / 脉冲压线`
- Validation after the final rollback / settle pass:
  - `npm run build` passes
  - `PILOT_QA_RUNS=5 node tools/qa-smart-natural-fullrun.mjs` -> wins 2/5, bossReachedRuns 5/5, timedOutRuns 1, failed404Urls=[]
  - `PILOT_QA_RUNS=5 node tools/qa-natural-long-retest.mjs` -> wins 0/5, bossReachedRuns 2/5, failed404Urls=[]
- QA text采集 remained clean; `/data/*.json` 404s stayed cleared.
- Remaining hot spots:
  - natural flow still tends to die before or inside `筛火求生 / 夹道压制`
  - smart flow can still time out on `boss-predator / boss-executioner` style long fights
- Next best follow-up, if needed:
  - do a very small boss HP / escort pressure trim only for `boss-predator` and `boss-executioner`
  - if natural still stalls, shave a little more from `round-2-battle-dash-gauntlet` and `round-3-battle-sieve`
2026-05-30
- Fifth round收口 pass in progress: widened boss safe-window linger / grace, reduced phase-switch re-clamp pressure, and trimmed boss-executioner / boss-predator final-phase pressure.
- Also lowered round-2-battle-dash-gauntlet and round-3-battle-sieve pressure a little more, plus slight final-boss node scale trims for the two stubborn end bosses.
- Next: run npm run build, then PILOT_QA_RUNS=5 node tools/qa-smart-natural-fullrun.mjs and PILOT_QA_RUNS=5 node tools/qa-natural-long-retest.mjs to verify boss wins recover without losing boss reach.
## 2026-06-06 异常节点质变感 + 局内发力证据

- 异常节点页面补上了更明确的三分法锚点，真实选项现在会直接露出“方向件 / 核心件 / 质变件 / 收尾件”。
- 异常选中后会立刻给一次路线转折提示，不再只是记录拿了哪张，而是直接告诉玩家这一下在“补方向 / 拧核心 / 改打法 / 接收尾”。
- `crit` 战斗内补强了预热到收口的短反馈：预热、爆点接上、收口就绪会更稳定出现在 HUD / route moment。
- `pierce` 战斗内补强了找线到打穿的短反馈：挂裂纹、接第二段、打穿整列会更稳定出现在 HUD / route moment。
- 结果页异常复盘改成更明确地描述“这一下改变了什么”，尤其会区分钉方向、拧主轴、直接改打法、接收尾。
- 本轮未触碰 `src/data/nodes.ts`、`src/data/battleTemplates.ts` 以及强度平衡；只做异常节点表达和局内证据补强。

## 2026-06-06 稳定验收入口

- 新增 QA-only 的 smoke 场景入口，不改正式玩家流程；入口只用于稳定命中升级面板、异常节点、route moment 战斗片段和结果页详情。
- `__pilotQaSmoke()` / `runQaSmokeScenario()` 现在支持受控切到 `upgrade / anomaly / battle / result` 四段页面，避免继续依赖自然流程随机命中。
- 新增 `tools/qa-stable-smoke.mjs`，一次执行即可稳定产出：
  - 首页
  - 一次升级选择
  - 一次异常节点
  - 一次已触发 route moment 的战斗片段
  - 结果页主屏
  - 结果页详情页
- 这条链路当前默认走 `crit`，可以切到 `pierce`；它只服务 QA / smoke，不参与正式平衡和普通玩家流程。

## 2026-06-07 payoff 样板收口

- stable smoke 继续沿用既有 QA-only 入口，没有新增正式玩家可见的调试流程；本轮只在现有 smoke 参数上补了 `battleLevel`，用于稳定区分 `bridge` 和 `payoff` 两级战斗样板。
- `crit` 的异常三分法样板收紧到同一张真实异常页 `暴击转折窗`，现在可以在一次真实异常面板里连续看到 `方向件 / 核心件 / 质变件`。
- `RunEngine` 的 QA battle 样板现在支持 payoff 命中：进入战斗前先用既有 QA 路线收口辅助把路线推到更接近兑现态，再注入更强的 `crit / pierce` 路线状态，保证 payoff 截图不再只停在 bridge 级。
- 结果页异常复盘继续只做小修，transform 现在会明确写成：
  - `crit`：直接把暴击推到收口兑现态
  - `pierce`：直接把穿透推到打穿兑现态
- `tools/qa-stable-smoke.mjs` 的 summary 补了最小对账字段 `stageLevel`，用于标记当前截图是 `bridge` 还是 `payoff`。
- 验证结果：
  - `npm run build` 通过
  - 预览地址：`http://127.0.0.1:4177/game-demo/`
  - `output/qa/stable-smoke-payoff-20260607/final/summary.json` 中 `failed404Urls: []`
  - `consoleErrors: []`
  - `consoleWarns: []`
  - `crit / pierce` 两条路线都稳定覆盖了 `anomaly / battleBridge / battlePayoff / resultDetail`

## 2026-06-07 pierce 样板收紧

- 本轮没有扩 stable smoke 基建，也没有碰 `nodes.ts` / `battleTemplates.ts`；只把 `pierce` 的样板展示层补到和 `crit` 更接近的完成度。
- `src/data/events.ts` 给 `pierce-reroute-window` 补上了真实的 `direction` 选项 `pierce-reroute-window-direction`，现在 `pierce` 的 `direction / core / transform` 也能落在同一张真实异常页里。
- `src/systems/RunEngine.ts` 的 QA anomaly 样板排序改成：如果同一事件里存在 `direction / core / transform`，就把这组三分法稳定排到前面，避免 `pierce` 再被混到别的转向选项后面。
- `tools/qa-stable-smoke.mjs` 的 `pierce` triplet 映射切到同一张 `pierce-reroute-window`，summary 继续沿用已有的 `stageLevel / routeId / anomalyRole / pageSegment` 最小对账字段，没有新增新的 QA 入口。
- 验证结果：
  - `npm run build` 通过
  - 预览地址：`http://127.0.0.1:4178/game-demo/`
  - `output/qa/stable-smoke-pierce-tighten-20260607/final/summary.json`
  - `failed404Urls: []`
  - `consoleErrors: []`
  - `consoleWarns: []`
  - `crit / pierce` 两条路线继续稳定覆盖 `anomaly / battlePayoff / resultDetail`
  - `pierce` 结果页复盘现在能稳定读到：第 1 节点钉方向，第 2 节点补核心，第 3 节点直接推到 `打穿兑现态`

## 2026-06-07 stable smoke 玩家语言收口

- 本轮没有碰 `E:\codex\auto-shooter-demo\src\data\nodes.ts`、`E:\codex\auto-shooter-demo\src\data\battleTemplates.ts`，也没有扩 stable smoke 基建；只清理 `crit / pierce` 样板链里残留的设计口吻。
- `E:\codex\auto-shooter-demo\src\data\events.ts` 把 `crit-reroute-window` / `pierce-reroute-window` 的异常页标签和收益代价改成玩家语言，去掉了 `方向件 / 核心件 / 质变件` 这一类抽象叫法。
- `E:\codex\auto-shooter-demo\src\systems\RunEngine.ts` 把 battle payoff 的 `route moment`、异常转折提示、结果摘要里的角色标签统一成“先打顺 / 火力更重 / 直接压上 / 补最后一下”这一组说法。
- `E:\codex\auto-shooter-demo\src\ui\OverlayController.ts` 清掉了结果页里“钉方向 / 补核心 / 收口兑现态”这类残留口吻，结果复盘现在直接写这一手让战斗发生了什么。
- `E:\codex\auto-shooter-demo\doc\10_设计文档\玩家可见文本规范.md` 追加了硬规则：stable smoke / QA 页面也算玩家可见文本，不能因为是样板链路就保留内部设计语言。

## 2026-06-08 全局玩家可见文本清扫

- 这轮没有回到平衡、路线掉落或 stable smoke 基建，只把范围从 QA 样板链扩到正式玩家会看到的整套页面。
- `E:\codex\auto-shooter-demo\src\ui\OverlayController.ts` 统一清掉首页菜单、暂停页、节点页、升级页、异常页、结果页主屏和详情页里的说明腔 / 表头味，把 `当前关卡 / 选择规则 / 当前机体 / 当前目标 / 升级历程 / 过去的对照` 这类后台口吻改成更像游戏内自然说话的版本。
- `E:\codex\auto-shooter-demo\src\scenes\GameScene.ts` 把 HUD 状态、战斗目标和升级提示改成同一套玩家语言，避免战斗内继续冒出“当前目标 / 进入最终整备”这种系统说明句式。
- `E:\codex\auto-shooter-demo\src\scenes\MainMenuScene.ts` 把首页音量面板和复制提示也收进同一口径，避免菜单还停在工具面板语气。
- `E:\codex\auto-shooter-demo\src\data\events.ts`、`E:\codex\auto-shooter-demo\src\data\upgrades.ts`、`E:\codex\auto-shooter-demo\src\data\nodes.ts`、`E:\codex\auto-shooter-demo\src\data\anomalyRoutePools.ts`、`E:\codex\auto-shooter-demo\src\data\battleTemplates.ts` 继续压掉节点名、异常选项名、强化名和战斗标题里残留的设计词，让普通页面不再只有 stable smoke 那 6 张样板图是干净的。
- `E:\codex\auto-shooter-demo\src\systems\RunEngine.ts` 补齐阶段提示和兜底路线名的玩家语言，避免页面里出现一套自然说法、系统层吐出另一套硬标签。
- `E:\codex\auto-shooter-demo\doc\10_设计文档\玩家可见文本规范.md` 新增“表头味 / 面板说明味 / 后台字段味”硬规则，明确首页、暂停页、按钮、tooltip、QA 页面都按同一标准执行。
- 验证结果：
  - `npm run build` 通过
  - 实页审查覆盖：首页、暂停页、节点选择、普通升级、普通异常、结果页主屏、结果页详情
- `E:\codex\auto-shooter-demo\output\qa\ui-copy-audit-20260608\final\summary.json`
- `failed404Urls: []`
- `consoleErrors: []`
- `consoleWarns: []`

2026-06-09
- 本轮把 crit payoff、pierce payoff 和 Boss signature 的敌人侧证据收紧了，stable smoke 现在能稳定截到 boss 名场面截图。
- QA-only 预置只改了 smoke 入口里的摆位和标记，没有碰正式战斗流程。
- 后续如果还有回归，优先只修 smoke 抓帧，不回到全局提示词或平衡轮。
2026-06-09
- 本轮继续把真实流程往前推了一小步：`RunEngine.ts` 里把 crit 的焦点保持和连击承接再托了一点，`boss-lockdown` 只做了更早一点的签名触发和更稳一点的停留。
- 验证分两条线跑：一条是手动 QA smoke 截 `crit / pierce / result`，一条是 real-battle-current 和 boss-directed-v2 的现成实战图；当前结论是 real crit / real boss 证据都还成立，但自然全流程 boss 仍偏定向样本。
2026-06-10
- 这轮把路由推进逻辑的分拆收口了一次：`src/systems/route/RouteProgression.ts` 作为路由阶段推进与阶段文案的单一源头，`RunEngine.ts` 只保留接线；`RouteManager` 也只保留被动计时更新，不再对外暴露 passives getters。
- 删除了空壳的 `src/systems/progression/RouteProgression.ts`，避免同名文件继续让拆分边界看起来像重复实现。
- 验证结果：`npm run build` 通过，stable smoke 仍稳定覆盖首页、升级页、crit / pierce 异常与战斗段落、Boss signature、结果页详情，`failed404Urls: []`，`consoleErrors: []`，`consoleWarns: []`。
2026-06-10
- 继续收 `dash` 主线补齐：`RouteProgression.ts`、`DashSystem.ts`、`upgrades.ts`、`events.ts`、`OverlayController.ts` 的阶段口径已经统一到 `贴近 / 回打 / 收人`，旧的 `贴上去 / 回切 / 脉冲命中` 说法已从源头模块里清掉。
- `RunEngine.ts` 这轮只留了必要接线和 QA smoke 入口同步，`dash` 相关的 battle / anomaly / result 样板也已经能稳定跑通。
- 当前判断还是 `dash` 进行中，没有切到下一项 P0；下一步重点继续看真实战斗里的 starter / bridge / payoff 是否已经立住。
2026-06-10
- 这轮继续把 `dash` 往真实战斗里推了一刀：`DashRoutePassive` 现在会收束连续窗口和残影寿命，`DashSystem` 会把连段后的残影和命中结果写到真实战场里，`GameScene` 也把这些残影画出来了。
- 源头模块里把 `dash` 的可见口径继续收成 `贴近 / 回打 / 收人`，连注释里的旧回切说法也顺手清掉了，避免拆分后又冒出两套话术。
- 现有验证里，`stable smoke` 仍然通过，真实战斗 / 自然 fullrun 也已经能看到 `dash` 的 committed 结果和贴身回打样本，不再只靠 smoke 样板成立。
- 当前下一步还是继续看 `dash` 的 starter / bridge / payoff 能不能再往前推，重点盯真实战斗里的 finisher 还差多少。
2026-06-10
- 按当前验收口径，`dash` 主线已经可以收口：它已经从 QA 样板闭环走到真实战斗样本和 natural fullrun 样本，不再是“能演示但还没成立”。
- 这条线当前最值钱的成果是结构没有回退，`DashRoutePassive` / `DashSystem` / `RouteProgression` 继续做源头，`RunEngine` 没有重新塞回 dash 主逻辑。
- 残留问题已经缩到 `finisher` 偏弱，这一项后续只做顺手回归，不再继续作为最高优先级专项。
- 当前主线从 `P0-2：dash 主线补齐` 切到 `P0-3：内容层完整度`，下一步重点是补 `nodes / events / upgrades / battleTemplates / contentSelectors` 的自然流程差异和内容厚度。

### 2026-06-11
- 本轮把内容层真正接到运行时了：`public/data/battleTemplates.json`、`public/data/upgrades.json` 和 `public/data/balance.json` 都已同步导出，不再只停留在 `src/` 源码。
- `npm run export:data` 被补进固定验证流程，因为 `ConfigLoader` 运行时优先读 `public/data/*.json`，只跑 build 会漏掉这类内容层改动。
- `npm run build` 通过，`npm run qa:stable-smoke` 也继续通过，`failed404Urls: []`、`consoleErrors: []`、`consoleWarns: []`。
- 真实对局里已经能命中 `针线压场` 这类新节点，但自然 fullrun 目前还不是稳定命中新内容，说明内容层差异已经进了真流程，但出现率还可以再抬。
- 下一步建议继续推 `P0-3：内容层完整度`，优先把新节点在自然流程里的命中率再提高一点，再继续补 `测试与验证手册.md` 的流程口径。

### 2026-06-11
- 这轮继续把内容层往自然流程里推了一档：`contentSelectors` 的阶段偏置和 `nodes / events / upgrades` 的阶段权重又收紧了一次。
- `npm run export:data -> npm run build -> npm run qa:stable-smoke -> natural fullrun` 现在已经写进固定验证顺序，避免只看 `src/` 变更。
- 稳定 smoke 仍然干净；单局自然 fullrun 已经能自然跑到 `round-1-event`、`round-2-battle-crit-pressure`、`round-3-battle-dash-soft-closeout`，并给出真实失败局结果页。
- 这一轮说明内容层已经不是只在 QA 样板里成立，但自然 fullrun 还没有到“每局都稳定覆盖多条新内容”的程度，下一步继续盯命中率和阶段分化。

### 2026-06-11 补记
- 这轮顺手把测试流程收成了固定模板：`npm run export:data -> npm run build -> npm run qa:stable-smoke -> node tools/qa-smart-natural-fullrun.mjs`，并明确要求 preview、smoke、natural fullrun 分开终端跑。
- 这轮的实际收益还是内容分发侧，不是系统侧重构；`contentSelectors` 继续按阶段把 opening / mid / late 的内容拉开，`nodes / events / upgrades` 也同步往对应阶段靠拢。
- 目前结论还是一样：stable smoke 已经稳定干净，natural fullrun 也能碰到新内容，但还没到“每局都稳定覆盖多条新内容”的程度，后面继续看自然命中率和阶段分化是否还能再涨一档。

### 2026-06-11 P0-3 内容阶段职责拆分
- 这轮主改动没有塞回 `E:\codex\auto-shooter-demo\src\systems\RunEngine.ts`，而是放在 `E:\codex\auto-shooter-demo\src\data\contentSelectors.ts`、`E:\codex\auto-shooter-demo\src\data\nodes.ts`、`E:\codex\auto-shooter-demo\src\data\events.ts`、`E:\codex\auto-shooter-demo\src\data\upgrades.ts`、`E:\codex\auto-shooter-demo\src\data\battleTemplates.ts` 这些内容层模块里。
- `nodes.ts` 给 opening / mid / late 的节点选择补了明确职责：opening 更容易先看到定方向和补基础的 support 节点，mid 更容易出现 battle + 承接 support，late / finalPrep 更偏收束、押注和 Boss 前整备，而不是继续被 battle 权重一路淹掉。
- `contentSelectors.ts` 现在先按阶段筛事件池，再做路线和权重选择；opening 事件更偏试路和定手感，mid 事件更偏转折和补短板，late / finalPrep 更偏收束和押注。没有 dominant route 时，也只做小幅借用，不再把各阶段内容混成一锅。
- `events.ts` 给一批 mid 向异常补了 `maxRound`，避免它们一路漏到 late；`upgrades.ts` 增加了 opening / mid / late 三张通用阶段牌，让普通强化面板也能在自然流程里看出“现在在考什么”。
- `battleTemplates.ts` 新增了 `elite-relay`（`换手压制`）和 `survival-closehold`（`尾线求生`），目标是补中段承接感和 late 求生/收束感，不是再开一轮平衡专项。
- 运行时数据已经同步到 `E:\codex\auto-shooter-demo\public\data\battleTemplates.json` 和 `E:\codex\auto-shooter-demo\public\data\upgrades.json`；这轮按手册先跑了 `npm run export:data`，避免 `ConfigLoader` 继续读旧 JSON。
- 验证结果：
  - `npm run export:data` 通过
  - `npm run build` 通过
  - 预览实际跑在 `http://127.0.0.1:4174/game-demo/`
  - `E:\codex\auto-shooter-demo\output\qa\stable-smoke-content-phase-20260611\summary.json` 通过，`failed404Urls: []`、`consoleErrors: []`、`consoleWarns: []`
  - `E:\codex\auto-shooter-demo\output\qa\stable-smoke-dash-regression-20260611\summary.json` 继续通过，说明 `dash` 没被这轮内容层改动带坏
  - 自然样本里已经能看到 opening `round-1-event-ripple / round-1-event-probe`、mid `round-2-battle-crit-hold / round-2-event / round-2-upgrade`、late `round-3-battle-crossfire / round-3-upgrade-rareline / final-prep` 这条链，但 late / finalPrep 还不算高频
- 当前判断：这轮不只是“抬一点权重”，而是把阶段职责开始写进内容分发和节点构成里了；但自然 fullrun 的可见收益仍然偏温和，P0-3 还能再做一轮，前提是下一轮继续盯 late / finalPrep 的自然命中率，否则会开始进入边际变薄区间。
