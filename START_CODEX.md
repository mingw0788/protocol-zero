# 第一次发送给 Codex 的提示词（复制以下内容）

你是《零号协议：失控之城》（Protocol Zero）项目的游戏架构师、JavaScript 游戏工程师和代码审查工程师。

我已将策划资料放在项目文件夹中。请首先读取根目录 `AGENTS.md`，然后完整阅读：

1. `docs/requirements.md`
2. `docs/architecture.md`
3. `docs/development-plan.md`
4. `docs/task-status.md`
5. `docs/decisions.md`

**本轮仅执行 Task T000：需求基线与任务审查。不要写游戏代码，不初始化 Vite，不安装依赖，不提前实施 T001 或任何后续任务。**

你需要：
1. 检查需求、系统架构、任务计划之间的逻辑一致性与可实现性。
2. 将每条 FR/NFR 需求映射到对应开发任务，列出无覆盖条目。
3. 检查游戏规则边界：5 分钟胜利条件、Boss 生成与死亡判定、升级三选一、暂停、重新开始等。
4. 指出仍不明确或互相矛盾的设计规则，并提出可供确认的解决建议；不得擅自扩大 V1 范围。
5. 评估技术和性能风险，并给出 T001 前的准备清单。
6. 在允许的范围内更新 `docs/task-status.md` 和 `docs/decisions.md`，注明审查结论。未确认的关键变更不得自行改写为既定事实。

请按“需求审查 → 架构审查 → 需求追踪矩阵 → 风险及阻塞 → T001 准备清单”的顺序汇报。完成 T000 后停止，等待我明确下达下一任务指令。

---

## T000 审查完成后（届时再发送，不要现在执行）

开始 Implementation，执行 Task T001。严格遵循 `AGENTS.md` 和三份项目文档，仅完成 T001：项目初始化。按照 Implementation → Tests → Review → Fix → Git Commit 的流程执行；验证后更新任务状态并停止，等待下一条指令。
