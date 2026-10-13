# T033 Tactical Exploration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 丰富逃生、补给、探索与构筑决策，并使状态易读。

**Architecture:** 固定步系统拥有状态，GameWorld 编排，UI/Renderer 消费冻结快照。沿用现有 Native 执行与当前开发分支，用户已授权自主推进。

**Tech Stack:** JavaScript ES Modules / Canvas / DOM / Vitest / Vite，无新增依赖。

**Spec:** docs/superpowers/specs/2026-10-13-t033-tactical-exploration-design.md

## Global Constraints

两张地图、四武器、五分钟 Boss 终局继续使用；暂停/升级冻结，新局清零；不改变存档格式、不发布站点。首轮值全部配置化。

## Review Focus

- 按住 Shift/R 或数字键不连发，不跨暂停残留。
- 盾完全吸收、部分吸收与冲刺同时发生时不重复扣血。
- 磁铁/终端连续升级不能丢失选择次数。
- 所有终端重复站入与重开不重复奖励或遗留进度。
- 重抽不能扣次数却给完全相同的三选一，接近全满级时禁用。

### Task 1: 冲刺和防护

Files: config/tacticalConfig.js, systems/DashSystem.js, input/InputController.js, entities/Player.js, systems/DamageSystem.js, core/GameWorld.js；tests/tactical-system.test.js。

- [x] 写冲刺 0.18s/4s/3倍、钳制、盾 30 吸收溢出/无敌、输入重复和清除的测试，运行确认失败。
- [x] 实现 DashSystem.update(deltaSeconds, direction, requested) -> boolean（是否替代本步移动），getSnapshot()/reset()；接入 GameWorld 移动阶段与 DamageSystem 防护。
- [x] 运行相关测试并记录。

### Task 2: 补给与终端

Files: systems/SupplySystem.js, systems/ExperienceSystem.js, systems/ExplorationSystem.js, core/GameWorld.js；tests/tactical-progression.test.js。

- [x] 写 shield/magnet、每 15 普通击杀、24上限、三终端连续站入 2.5s/离开清零/6 XP/全收集12 XP及重开测试。
- [x] 实现 collectAll()->number、notifyEnemyDeath(event)、ExplorationSystem.update(dt)/getSnapshot()/reset(mapId)；通过回调产生补给与奖励，GameWorld 结算经验。
- [x] 测试暂停冻结、单次死亡事件和多级队列。

### Task 3: 升级选择

Files: systems/UpgradeSystem.js, core/GameWorld.js, core/Game.js, ui/UIManager.js, index.html；tests/tactical-upgrades.test.js。

- [x] 写重抽提供新候选、次数耗尽/无替代不扣次数、状态限制和重开测试。
- [x] 实现 UpgradeSystem.canReroll()/rerollChoices()；GameWorld.rerollUpgrades()/getUpgradeRerollSnapshot()，Game 转发；接入按钮/R与1/2/3。
- [x] 检查升级键盘焦点环和连续升级行为。

### Task 4: 呈现与交付

Files: rendering/TacticalRenderer.js, rendering/CanvasRenderer.js, rendering/ExpansionRenderer.js, ui/UIManager.js, styles.css, index.html, config/audioConfig.js, docs/*。

- [x] 绘制终端、地图、盾/冲刺；HUD/帮助/结算/道具标签；音效复用合成流程。
- [x] 全量 npm test、npm run build、git diff --check；Chrome/Edge 真实页面验证并截图。
- [x] 独立审查后修复实质问题，更新 SRS/SDD/状态/报告/README；提交当前任务文件。

## Execution ledger

- Preflight: 现有实现为 T032；工作区干净，复用功能分支及已安装依赖。用户明确自主完善，省略重复的审批/工作树提问。

- Task 1: RED 3 项缺失功能断言；实现后相关 4 文件/16 项通过。冲刺方向、护盾溢出及重复输入已覆盖。
- Task 2: RED 3 项补给/探索断言；实现后通过。Ruling：内部通知补充 category，公开死亡事件保持原 schema，避免破坏既有消费者。
- Task 3: RED 3 项重抽规则与 UI 入口断言；实现后通过。道具池从 6 项扩为 8 项，旧权重测试相应更新；焦点末项改为重抽按钮。
- Task 4: Chrome/Edge 受控页面检查与截图完成；独立审查无 Critical/Important，两项 Minor 已处理。终端说明由快照取值；补充边界/静止/连续升级队列测试。最终 npm test = 61 文件/454 项；build = 75 模块、JS gzip38.20kB；diff check通过。
- Ruling：沿用当前功能分支和已安装工具，按用户不询问授权省略重复工作树/审批步骤。测试先于产品代码，最终集中提交便于整包回退；未部署。
- 补充：两种8方向自动控制战局在正常模拟规则下通关，实验室300.03s/391击杀，城区303.27s/402击杀；这不是人工自然试玩，M3/M4手感门禁保持待补。
