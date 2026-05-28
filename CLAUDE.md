# Claude Code 规则

## 文档生成规则

**所有生成的文档必须放在项目的 `/doc` 文件夹下，禁止在 `.claude` 文件夹中生成文档。**

- 计划文件、设计文档、分析报告等一律存放到 `e:/codex/auto-shooter-demo/doc/` 目录
- 使用 `.claude/memory/` 仅存储用户记忆（user/feedback/project/reference类型）
- 如果需要在计划模式下生成文档，指定路径时必须以项目doc目录为根

## 记忆使用规则

- 使用 `.claude/memory/` 存储用户偏好、反馈和项目上下文
- 记忆文件类型：user、feedback、project、reference
- 代码模式、架构决策等应存入项目代码或doc文档，而非记忆系统
