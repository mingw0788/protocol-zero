# T007 玩家受伤与碰撞 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为玩家与感染体接触加入圆形碰撞、单次接触伤害、0.6 秒无敌、每局一次死亡通知和死亡后的战局冻结。

**Architecture:** 新增纯检测职责的 `CollisionSystem` 和管理玩家受伤状态的 `DamageSystem`，由 `GameWorld` 按已批准顺序编排。玩家状态与 HUD 继续共用真实数据；死亡事件供 T016 接入，T007 不扩展状态机或 UI。

**Tech Stack:** 原生 JavaScript ES Modules、Vitest、Vite、HTML Canvas 2D；不增加运行时或测试依赖。

**Spec:** `docs/superpowers/specs/2026-10-11-t007-player-damage-design.md`

## Global Constraints

- 沿用每秒 60 步的固定模拟步；暂停、菜单和失焦自动暂停期间不推进无敌计时或战局。
- 玩家最大/初始生命为 100，玩家半径为 16 世界像素，EN-01 接触伤害为 10，无敌时间为 0.6 秒。
- 同一步多敌人接触时只造成最大的一笔接触伤害；不相加，不依数组顺序变化。
- 碰撞只触发伤害；不阻挡或推开实体，不增加击退、治疗、护盾、受击特效、死亡 UI 或新敌人类型。
- 致死步完成时钟与模拟步计数后同步发出一次死亡通知；后续步冻结，重置恢复本局状态并保留订阅关系。
- 不修改已确认玩法；不安装依赖；不修改 `GameStateManager`、`Game` 或 UI。

## Review Focus

- 恰好相切与略微分离、不同半径及运行中无效几何：`tests/collision-system.test.js` 验证边界判定、纯检测和无效输入报错。
- 空接触、零伤害、非法接触伤害及多敌人同时接触：`tests/damage-system.test.js` 验证不污染生命、取最大值、不累加且与顺序无关。
- 连续接触、计时恰好到达 0.6 秒边界、无敌期间不刷新及非法 delta：`tests/damage-system.test.js` 验证计时和扣血边界。
- 菜单/暂停/失焦与本步移动后的碰撞：`tests/player-damage-world.test.js` 联合既有 `tests/game-loop.test.js` 验证有效时间和系统顺序。
- 致死步事件时序、重复死亡、取消订阅、复活重开与输入清理：`tests/player-damage-world.test.js` 验证事件只发一次、payload 不可变、冻结及重置语义。

---

### Task 1: 圆形接触检测

**Files:**
- Create: `src/systems/CollisionSystem.js`
- Create: `tests/collision-system.test.js`

**Interfaces:**
- Consumes: `{ player: { x, y, radius }, enemies: Enemy[] }`；坐标必须有限，半径必须为正有限数。
- Produces: `new CollisionSystem({ player, enemies })`；`getPlayerContacts(): Enemy[]` 返回当前重叠且 `alive === true`、`hp > 0` 的敌人，不修改实体或数组。
- 缺少玩家或敌人数组抛 `TypeError`；构造时及每次查询时检查玩家和存活敌人的当前坐标/半径，非有限坐标、非正或非有限半径抛 `RangeError`。

- [x] **Step 1: 写接触检测失败测试**

  在 `tests/collision-system.test.js` 新增并分别断言：
  - `detects_tangent_circles_but_not_a_gap`：中心距等于半径和时返回该敌人；距离再增加 `0.01` 时返回空数组。
  - `uses_current_world_positions_and_both_radii`：不同玩家/敌人半径以世界坐标计算；移动敌人后再次查询按新坐标返回结果。
  - `excludes_dead_enemies_and_does_not_mutate_entities`：排除 `alive === false` 或 `hp <= 0` 的敌人，并比较调用前后的实体字段不变。
  - `rejects_missing_dependencies_and_invalid_geometry`：缺引用为 `TypeError`；初始无效几何和构造后将存活敌人坐标改为 `NaN` 再查询，均抛 `RangeError`。

- [x] **Step 2: 运行测试确认 RED**

  Run: `npm test -- tests/collision-system.test.js`

  Expected: FAIL，Vitest 报告缺少 `CollisionSystem.js` 或缺少 `CollisionSystem` 导出。

- [x] **Step 3: 实现 `CollisionSystem`**

  在 `src/systems/CollisionSystem.js` 实现构造校验与 `getPlayerContacts()`。对每个当前有效实体用 `dx * dx + dy * dy <= (player.radius + enemy.radius) ** 2` 判重叠；只读当前引用，不缓存坐标，不写回实体。

- [x] **Step 4: 运行单测和敌人回归**

  Run: `npm test -- tests/collision-system.test.js tests/enemy.test.js tests/enemy-world.test.js`

  Expected: 新碰撞测试及 T006 敌人测试全部 PASS。

- [x] **Step 5: 提交碰撞子任务**

  ```bash
  git add src/systems/CollisionSystem.js tests/collision-system.test.js
  git commit -m "feat: add player enemy collision detection"
  ```

### Task 2: 玩家生命与伤害系统

**Files:**
- Modify: `src/config/playerConfig.js`
- Modify: `src/entities/Player.js`
- Create: `src/systems/DamageSystem.js`
- Modify: `tests/player.test.js`
- Create: `tests/damage-system.test.js`

**Interfaces:**
- Consumes: `Player` 的 `hp`、`maxHp`、`alive` 和 `invulnerabilityRemaining`；联系人为含有限非负 `contactDamage` 的敌人对象数组。
- Produces: `PLAYER_CONFIG.invulnerabilitySeconds === 0.6`；新玩家 `alive === true`、`invulnerabilityRemaining === 0`；重置时恢复 `hp === maxHp`、存活且无敌余量为 0。
- Produces: `new DamageSystem({ player, invulnerabilitySeconds = PLAYER_CONFIG.invulnerabilitySeconds })`、`update(deltaSeconds): void`、`applyContactDamage(contacts): { damaged: boolean, killed: boolean, damage: number }`。计时存于对应 Player 实例；伤害钳制生命到 `[0, maxHp]`。

- [x] **Step 1: 写玩家状态与伤害系统失败测试**

  在 `tests/player.test.js` 增加 `tracks_alive_and_invulnerability_per_player_and_resets_them`，验证新建两个玩家的状态相互独立，并在篡改 `hp`、`alive` 与无敌余量后由 `reset()` 恢复。

  在 `tests/damage-system.test.js` 新增并分别断言：
  - `applies_one_contact_damage_and_clamps_hp_at_zero`：伤害 10 令 100 HP 变为 90 且 HP 不超过 maxHp；从 5 HP 受 10 伤害后为 0 且只转为死亡一次。
  - `ignores_empty_zero_damage_and_invulnerable_contacts`：空数组、最高伤害 0 和无敌期命中不扣血；无敌期间再次命中不重置计时。
  - `uses_the_maximum_contact_damage_once_independent_of_order`：`[10, 20]` 与 `[20, 10]` 都只扣 20，不扣 30。
  - `allows_damage_at_the_exact_invulnerability_boundary`：受击后累计 `update(0.6)`，持续接触可再次造成伤害。
  - `rejects_invalid_durations_deltas_contacts_and_damage_values`：无敌时长非正/非有限、delta 负值/非有限、contacts 非数组及 contactDamage 负值/非有限时按规格抛错。

- [x] **Step 2: 运行测试确认 RED**

  Run: `npm test -- tests/player.test.js tests/damage-system.test.js`

  Expected: 新增状态断言失败且 `DamageSystem.js` 无法导入；既有玩家移动测试仍可加载。

- [x] **Step 3: 实现配置、玩家状态与 `DamageSystem`**

  在 `PLAYER_CONFIG` 增加唯一无敌时长常量 `0.6`；在玩家每局状态初始化中设置 `alive` 与计时字段。`DamageSystem.update()` 将剩余时间递减并钳制到 0；有效受击取最高 `contactDamage` 一次、扣血钳制到 `[0, maxHp]`、重置无敌时间，并只在 HP 首次到 0 时返回 `killed: true`。伤害对象的非有限或负数值必须快速报错，不能把 NaN 写入玩家状态。

- [x] **Step 4: 运行单测和玩家回归**

  Run: `npm test -- tests/damage-system.test.js tests/player.test.js tests/player-integration.test.js`

  Expected: 伤害、生命重置、T004 玩家移动和 T005 玩家状态测试全部 PASS。

- [x] **Step 5: 提交玩家伤害子任务**

  ```bash
  git add src/config/playerConfig.js src/entities/Player.js src/systems/DamageSystem.js tests/player.test.js tests/damage-system.test.js
  git commit -m "feat: add player contact damage and invulnerability"
  ```

### Task 3: GameWorld 编排、死亡通知与重置

**Files:**
- Modify: `src/systems/PlayerSystem.js`
- Modify: `src/core/GameWorld.js`
- Create: `tests/player-damage-world.test.js`
- Modify: `tests/game-world-hud.test.js`

**Interfaces:**
- Consumes: Task 1 的 `CollisionSystem.getPlayerContacts()`；Task 2 的 `DamageSystem.update()` 与 `applyContactDamage()`。
- Produces: `PlayerSystem.clearInput(): void` 封装可选输入控制器的 `clear()`。
- Produces: `GameWorld.subscribePlayerDeath(listener): () => void`；同步发送冻结 payload `{ elapsedSeconds }`，其中时间包含致死固定步。取消订阅阻止该监听器之后收到通知。

- [x] **Step 1: 写世界集成失败测试**

  在 `tests/player-damage-world.test.js` 新增并分别断言：
  - `damages_after_player_and_enemy_have_moved`：玩家向右移动前与敌人相隔 35 世界像素、两半径各 16；一个 `1/60` 步内两者移动后发生接触，HP 降至 90。
  - `updates_contact_damage_only_while_playing`：MENU 和 PAUSED 调用返回 `false`，生命及无敌余量不变；恢复 PLAYING 后余量继续递减。沿用 `tests/game-loop.test.js` 的失焦自动暂停用例验证隐藏/失焦不补算。
  - `updates_hud_from_real_player_health`：受击后 `getHudSnapshot().health.current` 与 Player HP 一致。
  - `completes_the_lethal_tick_before_synchronously_notifying_once`：事件回调中可观察到 HP 为 0、时钟与 `simulationSteps` 已计入致死步，payload `elapsedSeconds` 相同且被冻结；继续调用 update 不再推进时钟、模拟步、敌人或生成系统。
  - `clears_input_and_stays_frozen_after_resume_until_reset`：致死时清输入；死亡局面暂停再恢复仍冻结；`reset()` 恢复生命和存活，保留原订阅；向清空后的敌人数组重新加入重叠敌人后，新一局再通知一次。
  - `supports_unsubscribe_and_rejects_non_function_listeners`：非函数注册抛 `TypeError`；取消后不再收到事件；死亡后新注册监听器不收到历史事件。

  在 `tests/game-world-hud.test.js` 增加断言，验证死亡前后 HUD 快照仅反映真实 HP 且仍不可变。

- [x] **Step 2: 运行测试确认 RED**

  Run: `npm test -- tests/player-damage-world.test.js tests/game-world-hud.test.js`

  Expected: 新集成测试因缺少 GameWorld 系统编排、订阅 API 与 `PlayerSystem.clearInput()` 失败；原 HUD 用例可运行。

- [x] **Step 3: 实现 PlayerSystem 与 GameWorld 集成**

  `GameWorld.update(deltaSeconds)` 先拒绝非 PLAYING 或本局已冻结的步；有效步按顺序递减无敌计时、更新玩家与 Camera、清理敌人、更新生成、推进敌人、检测接触并结算伤害，最后推进时钟和模拟步。首次致死后清输入、锁定本局并同步通知监听器。`reset()` 清除死亡锁并保留订阅集合；不改状态机、游戏外壳或 UI。

- [x] **Step 4: 运行集成和相关回归**

  Run: `npm test -- tests/player-damage-world.test.js tests/game-world-hud.test.js tests/game-loop.test.js tests/input-controller.test.js tests/enemy-world.test.js`

  Expected: 新集成测试及 T002、T004–T006 对时钟、输入、敌人和 HUD 的回归全部 PASS。

- [x] **Step 5: 提交世界集成子任务**

  ```bash
  git add src/systems/PlayerSystem.js src/core/GameWorld.js tests/player-damage-world.test.js tests/game-world-hud.test.js
  git commit -m "feat: integrate player damage and death freeze"
  ```

### Task 4: 全量验证、文档同步与 T007 交付

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/decisions.md`
- Modify: `docs/task-status.md`
- Modify: `docs/superpowers/specs/2026-10-11-t007-player-damage-design.md`
- Modify: `docs/superpowers/plans/2026-10-12-t007-player-damage.md`
- Create: `docs/task-report-T007.md`

**Interfaces:**
- Consumes: 三个实现子任务及各测试结果。
- Produces: 与代码一致的架构说明、获批规则记录、完成状态、可审计任务报告及最终 T007 提交；不提前标记未验收任务为完成。

- [x] **Step 1: 执行完整自动化测试与生产构建**

  Run: `npm test`

  Expected: 全部测试文件与测试用例 PASS。

  Run: `npm run build`

  Expected: Vite 生产构建成功；不新增或安装依赖。

- [x] **Step 2: 执行浏览器场景验收**

  在本地 Vite 页面使用 Chromium：从标题菜单开始，等待接触并确认 HUD 生命扣减、连续接触期间约 0.6 秒才再次扣血、生命归零后画面/战局冻结；死亡后通过 Esc 暂停、确认返回菜单并重开，确认 HUD 恢复 100 且控制台无新增错误。记录实际操作和结果；未完成的 Chrome/Edge 兼容或压力测量标为未验证。

- [x] **Step 3: 同步架构、决策、状态和报告**

  将 CollisionSystem/DamageSystem 职责、GameWorld 更新时序与死亡订阅契约写入 `docs/architecture.md`；在 `docs/decisions.md` 记录同步接触取最大伤害、致死步完成后冻结及每局一次事件语义；在状态表登记 T007 的实际测试/浏览器结果与提交哈希。创建符合 `AGENTS.md` 统一格式的 `docs/task-report-T007.md`。保持 SRS 的既有玩法文字不变；计划复核所有勾选项与执行证据，规格状态保留用户已通过标记。

- [x] **Step 4: 完成独立代码审查并修复阻断项**

  逐项对照本规格和 `Review Focus` 检查碰撞边界、计时顺序、玩家/敌人状态隔离、死亡事件幂等与重置、范围外改动。发现 Critical/Important 问题先修复并重跑受影响测试、全量测试和构建；无阻断项时记录审查结论，不把未测浏览器/压力场景写成通过。

- [x] **Step 5: 提交交付文档并复核工作树**

  ```bash
  git add docs/architecture.md docs/decisions.md docs/task-status.md docs/superpowers/specs/2026-10-11-t007-player-damage-design.md docs/superpowers/plans/2026-10-12-t007-player-damage.md docs/task-report-T007.md
  git commit -m "docs: record T007 verification and delivery"
  git status --short
  ```

  Expected: 文档提交成功，工作树干净；最终状态只将已完成并有证据的 T007 标为完成，然后停止等待下一项指令。

## Plan Self-Review

- **规格覆盖：** 碰撞纯检测、生命与无敌、并发最大伤害、固定步时序、暂停/失焦冻结、死亡事件、输入清理、重置保留订阅、真实 HUD、非目标约束及交付验证均分配到上述任务。
- **步骤粒度：** 每个实现单元先写具名失败测试，再单独运行、实现、验证、提交；最终验收、文档、审查与提交各有独立检查结果。
- **接口一致性：** `PlayerSystem.clearInput()`、`DamageSystem` 方法名/结果字段、`CollisionSystem.getPlayerContacts()` 及 `GameWorld.subscribePlayerDeath()` 在文件图、集成测试和实现步骤中保持一致。
- **Review Focus：** 五类高风险输入/生命周期均在对应单测或集成测试中有明确用例。
- **比例：** 计划包含四个交付单元，前三个分别有独立测试周期；末项仅处理验证和文档，不展开无关重构或新玩法。
