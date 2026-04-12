# Git Branch Workflow

## 固定分支

项目后续只保留以下 3 个本地开发分支：

- `master`
- `codex`
- `codex-dev`

不再继续新开 `codex/*` 主题分支。

## 分支职责

- `master`
  只由用户手动合并，不由 Codex 直接合并或改写。
- `codex`
  作为当前可保留的集成分支，经过本地验证后需要同步到这里。
- `codex-dev`
  作为日常开发分支使用。

## 提交规则

- 日常开发默认在 `codex-dev` 上继续，不再额外新开功能分支。
- `codex-dev` 相对 `codex` 只允许保留 1 个待同步开发提交。
- 当该提交完成验证并确认保留后，再把同一提交同步到 `codex`。
- 同步完成后，`codex-dev` 应再次与 `codex` 对齐，避免长期累积多提交差异。

## 合并规则

- `master` 只接受用户手动合并。
- Codex 不直接把开发内容合并到 `master`。
- 若后续需要继续开发，应先确认 `codex` 与 `codex-dev` 的相对位置，再从 `codex-dev` 开始下一轮。

## 当前执行约定

- 本次整理后，仓库本地分支目标状态为：`master / codex / codex-dev`。
- 旧的 `codex/*` 历史工作分支可删除，避免后续继续分叉。
