---
name: ai-game-dev-pipeline
description: Use when the task is AI-assisted game development in this repo, including tool selection, mechanic prototyping, code generation, concept art planning, audio/voice drafting, trailer planning, or turning a game idea into a shippable workflow.
---

# AI Game Dev Pipeline

Use this skill when the user wants to:

- turn a game idea into a playable prototype
- choose AI tools for code, art, audio, video, or research
- build a vertical slice faster with AI support
- create a practical production workflow instead of a loose tool list

This skill is distilled from the exported 2026 AI toolkit PDF the user provided, but filtered for actual game-development value. A lot of the original PDF is about subscriptions, self-media, or traffic monetization; keep the focus here on building games.

## First Pass

1. Identify the phase before choosing tools:
   - concept
   - prototype
   - production
   - content expansion
   - launch/marketing
2. Respect the actual repo stack.
   - In this repository, do not assume Unity just because the folder is named `unity-learning`.
   - Read the codebase and docs first, then fit the AI workflow to the real stack.
3. For implementation work in this repo, read the current source-of-truth docs first:
   - `doc/00_接手入口/START_HERE.md`
   - `doc/00_接手入口/当前交接卡.md`
   - `doc/20_设计闭环/设计基线与约束.md`
   - `doc/10_设计文档/核心循环设计.md`
   - `doc/10_设计文档/节点与关卡设计.md`
   - `doc/10_设计文档/数值与成长设计.md`

## Tool Routing

Use one primary tool per job. Avoid mixing too many models in the same step.

- Code and system design:
  - Start with `Codex` or `Claude Code`.
  - Use `Gemini` when the input is a long design doc, logs, or large PDFs.
  - Use `DeepSeek` as a low-cost reasoning/coding backup.
- Research and reference gathering:
  - Use `Perplexity` for source-finding and fast research trails.
  - Use `Gemini` or `Kimi` for long-document digestion.
- Concept art and visual direction:
  - Use `Midjourney` for high-fidelity key art and moodboards.
  - Use `LiblibAI` or `Civitai` when the task needs Stable Diffusion style iteration or model browsing.
  - Use `NovelAI` only when the target is clearly anime or stylized 2D.
- Chinese voice and local-market presentation:
  - Use `Fish Audio`.
- Multilingual voice and global-market presentation:
  - Use `ElevenLabs`.
- Temporary BGM and music ideation:
  - Use `Suno`.
- Trailer shots, motion references, and promo prototypes:
  - Use `Kling`, `Runway`, `Sora`, `Veo`, `Jimeng`, or `Vidu`.
  - Treat these as marketing or reference tools, not core gameplay tools.
- API or model access infrastructure:
  - Use `0011.ai` or `Nova AI` when stable API access matters more than official first-party subscriptions.

See `references/tool-shortlist.md` for the detailed shortlist and phase mapping.

## Default Workflow

### 1. Lock the player promise

Write a one-sentence target before generating anything.

Use this shape:

`This game lets [player type] do [core fantasy] through [main verbs], with [failure pressure] and [progression reward].`

Do not start with art generation until this sentence is clear.

### 2. Generate a thin design brief

Ask the coding/design model for:

- core loop
- 3 to 5 verbs
- enemy or obstacle pressure
- progression hooks
- one short run target
- one long-term retention hook

The brief should be short enough that it can still guide implementation decisions.

### 3. Prototype mechanics before polishing assets

For the first playable slice, prioritize:

- movement
- combat or interaction
- win/lose state
- one progression reward
- one readable HUD

Do not spend early time on:

- digital humans
- cinematic trailers
- polished dubbing
- large asset packs
- complex lore dumps

### 4. Pick one visual lane

Generate multiple references, but commit to one direction quickly:

- realistic
- painterly
- anime/cel
- low-poly/stylized
- UI-forward/sci-fi abstract

Once a lane is chosen, keep prompts and reference assets consistent. Do not mix `Midjourney`, `NovelAI`, and random Stable Diffusion models without a style decision.

### 5. Add audio as validation, not decoration

Use audio to test:

- pacing
- readability
- character tone
- market fit

Good defaults:

- `Fish Audio` for Chinese NPC lines or trailer VO
- `ElevenLabs` for multilingual or overseas-facing VO
- `Suno` for temporary menu, battle, and result music drafts

### 6. Build launch assets after the loop is fun

Only after the playable loop feels coherent:

- create trailer boards
- produce promo shots
- generate voice-over variants
- prepare store capsule or social clips

## Prompt Frames

Use these as compact starting points.

### Mechanic Brief

`You are designing a small but shippable game prototype. Generate a minimal playable loop with one core mechanic, one escalation rule, one fail state, one reward loop, and three implementation milestones. Keep the scope small enough for one developer.`

### Implementation Plan

`Convert this game brief into an implementation plan for the current repo. Respect the existing architecture, list the files likely to change, identify risks, and propose the smallest playable milestone first.`

### Art Direction

`Generate 6 visual directions for this game. For each direction, define palette, lighting, silhouette language, camera feel, UI mood, and asset-production difficulty. Recommend one direction for a small team.`

### NPC Voice Draft

`Write short voice lines for this character in a way that is easy to synthesize with AI voice tools. Keep lines clean, natural, and emotion-tagged for neutral, tension, victory, and failure states.`

### Trailer Board

`Turn this game build into a 30-second trailer board with hook, escalation, payoff, on-screen text, shot descriptions, and which shots can be generated or enhanced with AI video tools.`

## Repo-Specific Guardrails

- Keep the current repo's docs and code as the implementation source of truth.
- If the repo is web-based, do not force Unity-style architecture into it.
- If the task is code-facing, use AI to shorten iteration loops, not to replace reading the existing code.
- Track prompts, asset decisions, and naming conventions in docs once they affect the project.
- Prefer reusable source assets over one-off generations that cannot be iterated.

## Priority Rules

When time or budget is limited, favor this order:

1. coding assistant
2. research/document model
3. concept art tool
4. voice tool
5. music tool
6. video/trailer tool

`0011.ai`, `Nova AI`, `Claude Code`, and the PDF's `full-stack AI dev toolkit and core prompt library` are the highest-signal items for actual game development. Most of the media, account, and traffic-growth items are optional.

## When To Ask For The Original Page Again

Ask the user to reopen the original Feishu/Notion page only if the task depends on the PDF's linked sub-resources that were not embedded in the exported text, especially:

- the exact contents of the `full-stack AI dev toolkit and core prompt library`
- the exact contents of the `Claude Code local assistant config guide`
- any hidden link target behind `click here` style text in the PDF

For normal planning, tool selection, and workflow setup, the exported PDF is enough.
