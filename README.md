# 零号协议：失控之城 | Protocol Zero

> **项目阶段：T009 基础战斗与经验拾取完成；T010 经验等级正在实现，升级选择界面由 T011 实现。**
> **目标：** 使用 HTML5、CSS3、JavaScript、Canvas 2D 与 Vite，制作可在 Windows Chrome / Edge 浏览器运行的原创赛博朋克像素风 2D Roguelite 割草生存游戏。

## 本地运行

需要 Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` 和 npm 11.13.0。页面先显示标题主菜单，点击“开始游戏”进入场景；使用 WASD 或方向键移动 ZERO，Esc 暂停/继续。暂停后返回主菜单需要确认，并清理本局进度。

HUD 从真实状态读取生命、经验、等级、有效存活时间、击杀和装备。当前已有敌人追踪、脉冲枪、接触伤害和经验晶体；升级选择、完整波次、Boss、结算、音频播放和持久化仍按 T010–T021 实现。

```sh
npm ci
npm run dev
```

在终端显示的本地地址打开页面。检查测试和生产构建：

```sh
npm test
npm run build
```

生产文件输出到 `dist/`，可由静态网页托管服务提供。

Codex 应打开整个 `protocol-zero` 文件夹，以便读取根目录的 `AGENTS.md`。T000 文档审查已完成；后续每次只执行用户明确指定的一个任务。

## 文件说明

| 路径 | 用途 |
|---|---|
| `AGENTS.md` | Codex 的项目常驻规则、工作范围、质量门禁 |
| `START_CODEX.md` | 第一次与 Codex 对话时的可复制提示词 |
| `docs/requirements.md` | 游戏需求规格说明书 SRS；做什么，怎样算通过 |
| `docs/architecture.md` | 系统架构设计 SDD；采用什么技术和模块边界 |
| `docs/development-plan.md` | T000—T021 共 22 项开发任务、前置依赖及验收标准 |
| `docs/task-status.md` | 任务完成情况、里程碑检查表、变更记录入口 |
| `docs/decisions.md` | 关键设计决策和待确认事项 |
| `docs/review-report-T000.md` | T000 需求、架构、任务依赖审查及 T001 准备清单 |
| `docs/task-report-T005.md` | T005 实现、自动化与浏览器证据、审查及交付限制 |
| `src/`、`tests/` | 应用入口、页面样式和工程烟雾测试 |
| `src/core/` | Game、固定步长循环、有效游戏时钟、三态状态机和最小战局容器 |
| `src/config/`、`src/rendering/` | 地图和逻辑视口配置、Canvas DPR 适配、摄像机与网格地图绘制 |
| `src/entities/`、`src/input/`、`src/systems/` | ZERO 玩家实体、键盘输入和固定步长玩家更新 |
| `src/ui/` | DOM 主菜单、帮助、HUD、暂停与返回确认；只读取状态快照 |

## V1 目标

- 单人、桌面浏览器、5 分钟生存挑战
- 1 名玩家角色、1 张地图、3 种普通敌人、2 种武器、6 类升级和 1 名 Boss
- 战斗自动攻击，击杀掉落经验，升级三选一
- 4 分 30 秒出现 Boss；玩家存活至 5 分钟且 Boss 死亡后胜利
- 主菜单、暂停、失败/胜利结算；基础音效、最高记录保存

**V1 不实现：** 联机、账号、后端、商业 API、超载协议、随机地图、复杂剧情、多角色、多地图。超载协议及技能进化保留至后续版本。

## 文档优先级与变更

`docs/requirements.md` 为功能范围的基线，`docs/architecture.md` 为工程设计基线，`docs/development-plan.md` 为实施顺序。若有冲突，**停止冲突部分实施，先提出问题并确认**，不得静默覆盖。每项任务完成后更新 `docs/task-status.md`。

## 开发纪律

`Implementation → Tests → Review → Fix → Git Commit → Next Task`。

**注意：** T005 已交付带菜单、暂停与 HUD 的移动原型；敌人、攻击、经验成长等功能仍按开发计划逐项实施和验证。
