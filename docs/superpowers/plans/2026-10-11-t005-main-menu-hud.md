# T005 主菜单与基础 HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 用真实游戏状态快照交付标题菜单、操作说明、运行期声音开关、基础 HUD 和可安全暂停/返回菜单的原型。

**Architecture:** GameStateManager 继续唯一管理状态迁移；GameWorld 汇总 Player、GameClock 和本局击杀数据为不可修改的 HUD 快照。独立 UIManager 通过语义化 DOM 呈现视图、转发操作，并由 Game 在同一帧循环中提供快照。

**Tech Stack:** 原生 JavaScript ES Modules、HTML5、CSS3、Canvas 2D、Vite、现有 Vitest。

**Spec:** `docs/superpowers/specs/2026-10-11-t005-menu-hud-design.md`

## Global Constraints

- 目标平台为 Windows 桌面 Chrome / Edge。
- 使用原生 JavaScript、HTML/CSS、Canvas 2D；不引入 UI 框架或 DOM 测试依赖。
- 游戏模拟和有效时间仅在 PLAYING 推进；MENU 与 PAUSED 完全冻结。
- 玩家初始生命为 100/100、等级 1、经验 0、装备脉冲枪。
- UI 只读取不可修改的状态快照，不修改玩家、击杀或时钟数据。
- T005 声音开关仅保存页面运行期偏好；音频输出与持久化分别留给 T018、T019。
- 不新增、删改或重新解释已确认的游戏玩法。

## Review Focus

1. **菜单中快速双击开始**：只允许 MENU 开局，进入 PLAYING 后重复调用不能重置本局。验证归属 Task 1。
2. **暂停后取消返回**：必须仍处于 PAUSED，时钟和本局数据不重置。验证归属 Task 2。
3. **确认返回后立即重新开始**：计时、玩家属性、装备与击杀恢复初值，随后新局可正常开始。验证归属 Task 1、Task 2。
4. **Esc 在 MENU、重复按键或其他不可暂停状态**：不能误开始、跳过状态或因长按而暂停后立刻恢复。验证归属 Task 1、Task 2。
5. **调用方修改 HUD 快照**：不得污染 Player、GameClock、武器状态或本局计数。验证归属 Task 1。

---

### Task 1: 建立玩家 HUD 数据、快照与菜单状态操作

**Files:**
- Modify: `src/config/playerConfig.js`
- Modify: `src/entities/Player.js`
- Modify: `src/core/GameWorld.js`
- Modify: `src/core/GameStateManager.js`
- Modify: `src/core/Game.js`
- Modify: `tests/player.test.js`
- Create: `tests/game-world-hud.test.js`
- Create: `tests/game-actions.test.js`
- Modify: `tests/game-loop.test.js`

**Interfaces:**
- Consumes: 当前 Player、GameClock、GameWorld、GameStateManager 与 GameLoop。
- Produces:
  - `GameWorld.getHudSnapshot()` 返回冻结的 `{ health: { current, max }, experience, level, weaponIds, killCount, elapsedSeconds }`。
  - `GameWorld.recordKill()` 增加本局击杀计数并返回更新后计数；调用时机和敌人死亡幂等性由 T008 保证。
  - `GameStateManager.returnToMenu()` 只允许从 PAUSED 迁移到 MENU。
  - `Game.getHudSnapshot()`、`Game.togglePause()`、`Game.returnToMenu()`。
  - `Game.startGame()` 只在 MENU 有效；开始新局前清理本局，其他状态调用不得重置。

- [x] **Step 1: 为玩家起始数据与重置写失败测试**

在 `tests/player.test.js` 增加断言：新玩家生命为 100/100、等级为 1、经验为 0，并且只装备 ID 为 `pulse-gun` 的武器；移动后修改各战局字段再调用 `reset()`，字段及位置全部恢复初值，修改某个玩家的装备状态不改变其他玩家或全局配置。

- [x] **Step 2: 运行玩家测试确认新增断言失败**

Run: `npm test -- tests/player.test.js`
Expected: 新字段或重置断言失败；现有移动测试继续通过。

- [x] **Step 3: 添加玩家配置字段与每局状态**

在 `src/config/playerConfig.js` 集中增加最大生命 100、初始等级 1、初始经验 0、初始武器 ID `pulse-gun`。在 `Player` 中实例化独立 `weaponStates`，并新增 `hp`、`maxHp`、`level`、`exp`；扩展 `reset()` 恢复位置和这些战局字段，不改变移动属性。

- [x] **Step 4: 验证玩家状态测试通过**

Run: `npm test -- tests/player.test.js`
Expected: 新旧玩家测试全部通过。

- [x] **Step 5: 为 HUD 快照、本局击杀和重置写失败测试**

创建 `tests/game-world-hud.test.js`，验证快照初始值、时钟推进后秒数变化、`recordKill()` 增长计数、`reset()` 重置所有本局数据；同时验证快照对象、嵌套生命对象及武器 ID 数组不可修改，且修改尝试不影响游戏实体。

- [x] **Step 6: 运行 HUD 快照测试确认失败**

Run: `npm test -- tests/game-world-hud.test.js`
Expected: 因快照与击杀接口尚不存在而失败。

- [x] **Step 7: 实现 GameWorld 快照与本局计数**

在 `GameWorld` 中维护私有击杀计数，通过 getter 提供只读值；新增 `recordKill()`、`getHudSnapshot()`；快照使用新建并冻结的对象、嵌套对象和 ID 数组。`reset()` 同步清零击杀、时钟、玩家状态与模拟步数。

- [x] **Step 8: 验证 HUD 快照测试通过**

Run: `npm test -- tests/game-world-hud.test.js`
Expected: 所有初始值、变化、重置与防修改断言通过。

- [x] **Step 9: 为状态迁移及 Game 操作写失败测试**

创建 `tests/game-actions.test.js` 并修改 `tests/game-loop.test.js`：验证 PAUSED → MENU 合法且其他来源拒绝；Game 只从 MENU 开始并先重置；活动局再次开始不会重置；`togglePause()` 仅切换 PLAYING/PAUSED；确认返回前只能从 PAUSED 执行 reset 后迁移 MENU。Game 测试注入可控的 request/cancelAnimationFrame，不启动真实循环。

- [x] **Step 10: 运行状态与 Game 操作测试确认失败**

Run: `npm test -- tests/game-actions.test.js tests/game-loop.test.js`
Expected: 新增迁移与 Game 操作断言失败，既有循环测试通过。

- [x] **Step 11: 实现受限状态操作并验证**

在状态表加入 PAUSED → MENU 和 `returnToMenu()`。在 Game 中实现 `getHudSnapshot()`、受状态校验的 `togglePause()`、只允许 MENU 开始的 `startGame()` 和只允许 PAUSED 返回菜单的 `returnToMenu()`；不直接暴露 UI 对 GameWorld 的重置权限。

Run: `npm test -- tests/game-actions.test.js tests/game-loop.test.js`
Expected: 新增和既有状态/时间测试全部通过。

- [x] **Step 12: 提交 Task 1**

Run:

~~~powershell
git add src/config/playerConfig.js src/entities/Player.js src/core/GameWorld.js src/core/GameStateManager.js src/core/Game.js tests/player.test.js tests/game-world-hud.test.js tests/game-actions.test.js tests/game-loop.test.js
git commit -m "feat: add T005 HUD state interfaces"
~~~

Expected: 提交仅包含玩家数据、HUD 快照、状态操作及对应测试。

### Task 2: 建立 DOM 菜单、HUD、暂停 UI 与应用接线

**Files:**
- Create: `src/ui/UIManager.js`
- Modify: `src/core/Game.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `src/styles.css`
- Create: `tests/ui-manager.test.js`
- Modify: `tests/bootstrap.test.js`

**Interfaces:**
- Consumes: Task 1 的 Game 操作与 HUD 快照接口。
- Produces: `new UIManager({ root, game, windowTarget })`；`start()`、`stop()`、`renderSnapshot(snapshot, currentState)`。
- UI 绑定静态且具唯一 ID 的语义化控件；所需节点缺失时抛出描述性错误。
- Game 使用 `attachUIManager(manager)` 接受满足 `start/stop/renderSnapshot` 的展示端口；游戏帧循环在 Canvas 绘制后传入最新快照和当前状态。

- [x] **Step 1: 为 DOM 结构和启动入口写失败测试**

在 `tests/bootstrap.test.js` 验证 `index.html` 具有 Canvas、UI 容器、主菜单、帮助、HUD、暂停视图及返回确认对话框的必需节点，且模块入口仍为 `src/main.js`。启动后保持 MENU 的行为通过 Game 与 UI 集成测试验证，不断言入口代码的具体写法。

- [x] **Step 2: 运行入口测试确认新断言失败**

Run: `npm test -- tests/bootstrap.test.js`
Expected: 新 UI 节点断言失败，原 Canvas/入口断言通过。

- [x] **Step 3: 添加可访问的静态 UI 结构**

在 `index.html` 的 `#app` 中保留 Canvas 并加入独立 UI 层；增加主菜单标题、开始/帮助/声音按钮、操作说明、战斗 HUD 字段、暂停继续/返回按钮和页内确认对话框。为按钮、状态和进度提供可访问名称；菜单初始可见，帮助/HUD/暂停/对话框初始隐藏。

- [x] **Step 4: 验证静态入口测试通过**

Run: `npm test -- tests/bootstrap.test.js`
Expected: Canvas 和全部必需 UI 节点均可在页面源中找到。

- [x] **Step 5: 为 UI 行为建立轻量 DOM 测试替身**

在 `tests/ui-manager.test.js` 创建仅覆盖本任务所需 API 的 FakeElement 与 FakeRoot：查询节点、hidden/textContent/属性、事件注册与移除、点击分发、原生 dialog 的 showModal/close。测试替身只用于 Vitest，不进入产品代码或依赖列表。

- [x] **Step 6: 编写 UIManager 的失败行为测试**

验证初始菜单与非活动界面可见性；开始/帮助/声音按钮行为；Esc 只在 PLAYING/PAUSED 生效且忽略重复 keydown；对话框期间 Esc 只取消确认且保持 PAUSED；取消返回保持 PAUSED；确认返回调用 Game.returnToMenu；HUD 映射生命、经验、等级、时间、击杀及武器；同值快照不重复写 DOM；`stop()` 移除事件与订阅；缺失必需控件时报可读错误。

- [x] **Step 7: 运行 UIManager 测试确认失败**

Run: `npm test -- tests/ui-manager.test.js`
Expected: UIManager 尚不存在，新增测试失败。

- [x] **Step 8: 实现 UIManager 状态呈现与事件生命周期**

创建 `src/ui/UIManager.js`。订阅 GameStateManager；绑定上述按钮、Escape、dialog 确认/取消；Escape 仅对 PLAYING/PAUSED 请求 `game.togglePause()` 并忽略 `event.repeat`；声音开关调用 `game.toggleSound()` 并更新状态标签/`aria-pressed`。快照文本仅在值变化时更新；时间格式为 `MM:SS`，生命进度为 hp/maxHp。所有注册项在 `stop()` 解除，`start()`/`stop()` 可重复调用而不重复绑定。

- [x] **Step 9: 验证 UIManager 单元测试通过**

Run: `npm test -- tests/ui-manager.test.js`
Expected: UI 状态、控件行为、快照映射和清理测试全部通过。

- [x] **Step 10: 接入 UIManager 与同帧快照呈现**

在 `Game` 增加 `attachUIManager(manager)` 并检查所需方法；`start()` 按序启动输入、渲染器、UI 和循环，`stop()` 解除相同组件。GameLoop 每帧先绘制 Canvas，再调用 `renderSnapshot(world.getHudSnapshot(), stateManager.currentState)`。在 `main.js` 校验 `#app` 与 Canvas 后创建 Game、UIManager 并接线；页面启动后只停留在 MENU。UI 构造默认声音偏好为开启，提供 Game 的 `soundEnabled`/`toggleSound()`，不访问 localStorage 或创建 AudioContext。

- [x] **Step 11: 添加样式并验证界面尺寸与焦点**

在 `src/styles.css` 将 `#app` 设为 UI 覆盖层定位容器；菜单、帮助、HUD、暂停与确认对话框沿用深蓝/青蓝基调，提供清晰键盘焦点、文字对比度和窄视口换行；Canvas 保持原有像素绘制与等比缩放规则，HUD 不覆盖画面中心。

- [x] **Step 12: 运行 Task 2 自动化测试**

Run: `npm test -- tests/ui-manager.test.js tests/bootstrap.test.js tests/game-actions.test.js`
Expected: 所有 UI 与状态集成单元测试通过。

### Task 3: 全量验证、浏览器检查、文档记录与交付

**Files:**
- Modify: `docs/task-status.md`
- Modify: `docs/architecture.md`
- Modify: `docs/decisions.md`
- Modify: `README.md`、`docs/requirements.md`、`docs/development-plan.md`（仅同步实现状态）
- Create: `docs/task-report-T005.md`（验收证据、审查边界和提交记录）

**Interfaces:**
- Consumes: Task 1/2 已通过测试的菜单、状态、数据和 UI 接口。
- Produces: T005 验收证据、更新后的任务状态/架构记录和一个最终任务提交。

- [x] **Step 1: 运行完整自动化测试**

Run: `npm test`
Expected: 全部既有与新增 Vitest 测试通过。

- [x] **Step 2: 运行生产构建**

Run: `npm run build`
Expected: Vite 生产构建成功，无缺失入口、语法错误或资源错误。

- [x] **Step 3: 浏览器验证用户流程**

在可用的 Windows 桌面 Chrome 或 Edge 中启动 Vite 页面并检查：启动先显示主菜单且有效时间不增长；操作说明开关；声音开关状态变化；开始后 WASD/方向键可移动；HUD 初值真实显示；时间随 PLAYING 增长；Esc 暂停后时间与移动冻结，再次 Esc 恢复；返回菜单确认取消后仍暂停且数据保留；确认后回到菜单并重置数据；再次开始正常运行；浏览器失焦后自动显示暂停界面。记录真实浏览器与结果；环境不支持时如实标记未验证。

- [x] **Step 4: 按 Review Focus 审查并修复**

核对快速双击开局、菜单外 Esc/重复键、返回取消/确认、本局重置、快照防修改、UI 监听清理、窄视口样式、Console 错误与现有 T002 失焦行为。修复阻断问题并重跑对应测试。

- [x] **Step 5: 更新架构与任务记录**

将 `docs/architecture.md` 状态更新为 T000–T005，并记录只读 HUD 快照和 UIManager 职责/接线。将 `docs/task-status.md` 中 T005 标为完成，仅在自动化与浏览器结果有真实证据时填写，并增加日期、测试摘要和提交记录。将本次已批准的 T005 菜单/运行期声音偏好设计记入 `docs/decisions.md` 的 T005 记录，不改写已确认玩法。

- [x] **Step 6: 复核差异并提交 T005**

Run:

~~~powershell
git diff --check
git status --short
git add src index.html tests docs/task-status.md docs/architecture.md docs/decisions.md
git commit -m "feat: implement T005 main menu and HUD"
git status --short --branch
~~~

Expected: 差异无空白错误；仅 T005 文件进入提交；工作区干净；T005 状态和提交哈希与真实验证一致。
