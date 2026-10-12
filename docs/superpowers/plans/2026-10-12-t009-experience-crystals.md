# T009 经验晶体掉落与拾取实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成敌人死亡掉落经验晶体、存活玩家接触拾取、HUD 显示真实经验的 T009 闭环。

**Architecture:** `ExperienceSystem` 只订阅一次 T008 的冻结死亡通知，持有与 `GameWorld` 共享的晶体数组，管理拾取和有效战局寿命。`GameWorld` 在死亡结算清理后、战局时钟推进前更新经验系统；独立只读 Canvas renderer 绘制占位晶体。

**Tech Stack:** 原生 JavaScript ES modules、Canvas 2D、Vitest 5、Vite 8；不增加依赖。

**Spec:** `docs/superpowers/specs/2026-10-12-t009-experience-crystals-design.md`

## Global Constraints

- 只实现 SRS FR-008 的掉落、拾取和 HUD 经验数据更新；不实现等级阈值、升级状态或升级 UI。
- 每个 `expDrop > 0` 的冻结 T008 死亡通知只生成一枚同值晶体；`expDrop === 0` 不生成。
- 接触条件为 `distance <= player.radius + pickupRadius`；`pickupRadius` 首轮值为 12 世界像素；无磁吸。
- 晶体有效寿命为 120 个有效战局秒；暂停、菜单及玩家死亡冻结期间不推进寿命。寿命边界同一步先检查拾取，再过期清理。
- `EXPERIENCE_CRYSTAL_CONFIG` 集中提供 `pickupRadius: 12`、`lifetimeSeconds: 120`、`renderSize: 8` 和琥珀色 `color`；占位绘制为 8×8 方块。
- 共享晶体数组原位清理；重开清空晶体但保留死亡事件订阅，晶体 ID 在系统生命周期内持续递增。
- 固定模拟步顺序保持为 T008 死亡结算与清理 → T009 拾取/过期 → 战局时钟；已死亡玩家不拾取。
- 不安装依赖；正式素材和拾取特效留给 T017，高密度性能测量留给 T020。

## Review Focus

- 非空 ID、有限坐标及正有限经验/半径/寿命：实体拒绝非法字段，经验系统拒绝非法半径/寿命配置；由 Task 1、2 的参数测试覆盖。
- 非有限、负数和零 `deltaSeconds`：负数/非有限输入抛 `RangeError`，零步长不改变晶体、寿命或经验；由 Task 2 覆盖。
- 拾取边界相切、刚好在范围外及重复更新：仅包含边界的第一次接触奖励经验；由 Task 2、3 覆盖。
- 玩家死亡或晶体恰好到期：死亡玩家不拾取；寿命边界处的存活玩家优先拾取；由 Task 2、3 覆盖。
- 暂停、死亡冻结、reset 与订阅生命周期交错：暂停/冻结不推进寿命；reset 后不重放旧通知、仍可接收新局掉落且不替换数组；由 Task 3 覆盖。
- 部分越界与完全离屏晶体：部分内容受逻辑视口裁剪，完全离屏实体跳过且渲染不改写实体；由 Task 4 覆盖。

---

### Task 1: 经验晶体配置与实体

**Files:**
- Create: `src/config/experienceCrystalConfig.js`
- Create: `src/entities/ExperienceCrystal.js`
- Create: `tests/experience-crystal.test.js`

**Interfaces:**
- Produces: 冻结 `EXPERIENCE_CRYSTAL_CONFIG = { pickupRadius: 12, lifetimeSeconds: 120, renderSize: 8, color: '#ffbf47' }`。
- Produces: `new ExperienceCrystal({ id, x, y, expValue, pickupRadius = EXPERIENCE_CRYSTAL_CONFIG.pickupRadius, lifetimeSeconds = EXPERIENCE_CRYSTAL_CONFIG.lifetimeSeconds })`；实例字段为 `id`, `x`, `y`, `expValue`, `pickupRadius`, `remainingLifetime`, `active`。ID 必须为非空字符串；坐标有限；经验、半径、寿命为正有限数。

- [x] **Step 1: 写配置和实体校验测试**

在 `tests/experience-crystal.test.js` 添加 `uses the approved frozen crystal defaults`、`copies valid crystal data and starts active`、`rejects invalid identity geometry value and lifetime`。断言配置冻结且值精确；实体默认半径为 12、剩余寿命为 120、`active === true`；分别覆盖空 ID、非有限坐标、非正/非有限经验、半径和寿命。

- [x] **Step 2: 运行定向测试确认失败**

Run: `npm test -- tests/experience-crystal.test.js`

Expected: 配置和实体模块尚不存在，测试失败。

- [x] **Step 3: 实现集中配置与经验晶体实体**

在 `experienceCrystalConfig.js` 导出冻结配置；在 `ExperienceCrystal` 构造器校验输入并保存独立运行态字段。`remainingLifetime` 初始化为 `lifetimeSeconds`，不保存敌人引用、不访问 DOM。

- [x] **Step 4: 验证配置与实体测试通过**

Run: `npm test -- tests/experience-crystal.test.js`

Expected: 配置、合法实例和所有非法输入断言通过。

- [x] **Step 5: Commit**

```bash
git add src/config/experienceCrystalConfig.js src/entities/ExperienceCrystal.js tests/experience-crystal.test.js
git commit -m "feat: add experience crystal model"
```

### Task 2: 死亡掉落、接触拾取与晶体寿命

**Files:**
- Create: `src/systems/ExperienceSystem.js`
- Create: `tests/experience-system.test.js`

**Interfaces:**
- Consumes: Task 1 的 `ExperienceCrystal` / `EXPERIENCE_CRYSTAL_CONFIG`；T008 冻结 `{ enemyId, typeId, x, y, expDrop }` 通知。
- Produces: `new ExperienceSystem({ crystals, player, subscribeEnemyDeath, config = EXPERIENCE_CRYSTAL_CONFIG })`；构造时调用 `subscribeEnemyDeath(listener)` 一次。`update(deltaSeconds) -> void` 校验非负有限步长、存活玩家接触拾取、按有效模拟秒递减寿命，并原位移除失效实体。`reset() -> void` 标记旧实体失效并清空同一数组，不取消订阅或重置递增 ID。

- [x] **Step 1: 写死亡事件订阅和掉落测试**

在 `tests/experience-system.test.js` 建立可触发通知的 fake death source，并添加 `creates one crystal from a positive frozen death snapshot`、`ignores zero experience drops`、`subscribes once and keeps the listener across reset`、`rejects invalid pickup and lifetime configuration`、`requires a crystal array player and death subscription source`。断言复制坐标和值、不修改冻结快照、零经验不建晶体；reset 后不会回放历史事件，后续通知仍产生新晶体且 ID 不复用；非正或非有限的 `pickupRadius` / `lifetimeSeconds` 配置在构造时抛出 `RangeError`，缺少运行依赖时抛出 `TypeError`。

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/experience-system.test.js`

Expected: `ExperienceSystem` 模块不存在，测试失败。

- [x] **Step 3: 实现订阅、死亡掉落、配置校验与 reset**

实现构造依赖及正有限 `pickupRadius` / `lifetimeSeconds` 配置校验；构造时只注册一次监听器。死亡监听器只读取冻结快照字段；对正 `expDrop` 创建唯一 `experience-crystal-N` ID 并追加到共享数组，对零值不创建。实现 `reset()`：先使旧实体失效，再原位清空数组，保留监听器和递增 ID。

- [x] **Step 4: 验证死亡掉落测试通过**

Run: `npm test -- tests/experience-system.test.js`

Expected: 正经验掉落、零经验忽略、单次订阅与 reset 后继续监听通过。

- [x] **Step 5: 写接触、重复奖励、到期和步长测试**

补充 `picks up at tangency only once`、`does not pick up outside radius or for a dead player`、`picks up before expiring at the exact lifetime boundary`、`expires silently after active lifetime`、`validates delta and leaves state unchanged for zero`。验证相切包含边界，范围外距离取和半径再加一个微小正值；负数/NaN/Infinity 抛 `RangeError`，零步长不变更任何字段。

- [x] **Step 6: 运行新增测试确认失败**

Run: `npm test -- tests/experience-system.test.js`

Expected: 新增更新/拾取/寿命断言失败。

- [x] **Step 7: 实现拾取与寿命推进**

`update` 对正步长先检查活动晶体与存活玩家的圆形接触；拾取时先置 `active = false` 再增加 `player.exp`。随后递减未拾取晶体寿命，归零时静默失效；同一步先拾取再过期。清理用原数组原位删除。死亡玩家跳过接触但有效步仍按相同模拟时间推进寿命；零步长直接返回。

- [x] **Step 8: 验证经验系统单测通过**

Run: `npm test -- tests/experience-system.test.js`

Expected: 所有订阅、掉落、边界拾取、一次性奖励、寿命和 delta 测试通过。

- [x] **Step 9: Commit**

```bash
git add src/systems/ExperienceSystem.js tests/experience-system.test.js
git commit -m "feat: add experience crystal pickup system"
```

### Task 3: GameWorld 接线、HUD 闭环与重开安全

**Files:**
- Modify: `src/core/GameWorld.js`
- Modify: `tests/pulse-gun-world.test.js`
- Modify: `tests/game-world-hud.test.js`

**Interfaces:**
- Consumes: Task 2 的 `ExperienceSystem`；现有 `subscribeEnemyDeath(listener)`、Player 的 `exp` 和只读 HUD 快照。
- Produces: 稳定引用的 `world.experienceCrystals` 与 `world.experienceSystem`；GameWorld 在最终死亡结算/敌人清理之后、`clock.advance(deltaSeconds)` 之前调用一次 `experienceSystem.update(deltaSeconds)`；`reset()` 清空晶体但保留系统订阅。

- [x] **Step 1: 写掉落到 HUD 的 GameWorld 闭环测试**

在 `tests/pulse-gun-world.test.js` 添加 `drops a positive exp crystal before cleanup and awards it through the HUD snapshot` 和 `does not create a crystal for a zero-exp death`。以生成间隔 100 秒的 GameWorld 放置死亡 EN-01 于玩家拾取范围外，推进一个固定步，断言通知后清理、晶体死亡坐标和值正确、经验仍为 0；将玩家放到相切边界再推进一步，断言晶体移除、`player.exp === 1` 且 `getHudSnapshot().experience === 1`。零经验敌人死亡不掉落。

- [x] **Step 2: 运行集成测试确认失败**

Run: `npm test -- tests/pulse-gun-world.test.js tests/game-world-hud.test.js`

Expected: GameWorld 无晶体数组/系统接线，新增断言失败。

- [x] **Step 3: 写暂停、死亡冻结、reset 和订阅生命周期测试**

添加测试确认：同一死亡只生成一次晶体；暂停期间调用 `world.update()` 不减少 `remainingLifetime`；致死步后后续更新不再推进晶体寿命；`world.reset()` 先将旧晶体标记失效再原位清空同一数组、HUD 经验恢复 0、不回放旧通知，重开后新死亡仍能掉落且晶体 ID 不复用。

- [x] **Step 4: 接入 GameWorld 系统顺序和重置**

构造时建立 `experienceCrystals = []` 并创建单一 ExperienceSystem，使用 `listener => this.subscribeEnemyDeath(listener)` 适配当前死亡事件接口。固定步中在第二次 `#settleEnemyDeaths()` 与 `enemySystem.cleanup()` 之后更新经验系统，再推进时钟。`reset()` 调用系统 reset；不得替换共享数组或重新订阅。HUD 沿用现有 `player.exp` 快照字段。

- [x] **Step 5: 验证 GameWorld、HUD 与既有战斗时序**

Run: `npm test -- tests/pulse-gun-world.test.js tests/game-world-hud.test.js tests/enemy-world.test.js tests/player-damage-world.test.js`

Expected: T009 集成与既有击杀、伤害、重开和 HUD 测试全部通过。

- [x] **Step 6: Commit**

```bash
git add src/core/GameWorld.js tests/pulse-gun-world.test.js tests/game-world-hud.test.js
git commit -m "feat: integrate experience drops into game world"
```

### Task 4: 晶体只读绘制与 Canvas 图层接线

**Files:**
- Create: `src/rendering/ExperienceCrystalRenderer.js`
- Modify: `src/rendering/CanvasRenderer.js`
- Modify: `src/core/Game.js`
- Create: `tests/experience-crystal-renderer.test.js`
- Modify: `tests/enemy-renderer.test.js`

**Interfaces:**
- Consumes: Task 3 的 `world.experienceCrystals`、`EXPERIENCE_CRYSTAL_CONFIG` 与 Camera `worldToScreen()` / 逻辑视口。
- Produces: `ExperienceCrystalRenderer.render(context, camera, crystals)`；`CanvasRenderer.render(player = null, enemies = [], projectiles = [], experienceCrystals = [])`；Game 每帧传第四个数组。绘制顺序：地图 → 晶体 → 弹丸 → 敌人 → 玩家。

- [ ] **Step 1: 写只读绘制、裁剪和图层测试**

在 `tests/experience-crystal-renderer.test.js` 添加 `draws active crystals in camera coordinates without mutating them`、`clips partial crystals and culls offscreen or inactive crystals`。断言配置琥珀色方块尺寸 8×8、世界到屏幕转换、失效晶体跳过、完全离屏跳过、部分越界有逻辑视口 clip，绘制前后实体相等。更新 `tests/enemy-renderer.test.js` 的 Canvas 集成断言为 `map → crystals → projectiles → enemies → player`，并验证 Game 传入共享晶体数组。

- [ ] **Step 2: 运行渲染测试确认失败**

Run: `npm test -- tests/experience-crystal-renderer.test.js tests/enemy-renderer.test.js`

Expected: renderer 不存在且 Canvas/Game 没有晶体参数，新增断言失败。

- [ ] **Step 3: 实现 renderer 并接入 Canvas**

沿用 `EnemyRenderer` 的 context/camera/数组校验和 save/clip/restore 模式。绘制只读 `active` 且坐标有限的晶体，以 `renderSize` 居中方形填充 `color`。在 `CanvasRenderer` 注入 renderer、追加第四个兼容参数并按规格排列图层；`Game` 在渲染回调传 `world.experienceCrystals`。

- [ ] **Step 4: 验证渲染与既有图层测试通过**

Run: `npm test -- tests/experience-crystal-renderer.test.js tests/enemy-renderer.test.js tests/projectile-renderer.test.js`

Expected: 晶体像素、只读、裁剪和图层顺序正确，既有弹丸/敌人绘制继续通过。

- [ ] **Step 5: Commit**

```bash
git add src/rendering/ExperienceCrystalRenderer.js src/rendering/CanvasRenderer.js src/core/Game.js tests/experience-crystal-renderer.test.js tests/enemy-renderer.test.js
git commit -m "feat: render experience crystals"
```

### Task 5: 全量验收与 T009 交付记录

**Files:**
- Modify: `docs/task-status.md`
- Create: `docs/task-report-T009.md`

**Interfaces:**
- Consumes: Tasks 1–4 的实现和获批规格。
- Produces: T009 自动测试、构建、浏览器验收、代码审查与剩余风险的真实记录；只有全部范围完成才标记任务完成。

- [ ] **Step 1: 运行完整自动化测试**

Run: `npm test`

Expected: 全部 Vitest 测试通过；失败先定位、修复并完整重跑。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 生产构建退出码为 0；不安装依赖。

- [ ] **Step 3: 浏览器验收掉落、拾取、暂停与重开**

使用项目现有 Chromium 浏览器验证流程打开游戏：从标题菜单开始，观察脉冲枪击杀 EN-01 后原地生成单枚琥珀色方块；移动 ZERO 接触后方块消失、HUD 经验加 1，远离时经验不变；暂停/恢复后仍可拾取；返回菜单并开始新局后旧晶体不再显示。记录实际浏览器版本、操作结果及控制台错误/警告；没有实际完成的步骤标为未验证。

- [ ] **Step 4: 完成独立代码审查并修复阻断问题**

按规格逐项核对死亡快照、单次掉落、相切拾取、TTL/暂停、死亡冻结、原数组清理、订阅跨 reset、HUD 只读和 Canvas 图层。修复阻断或重要问题后重跑受影响测试；性能压力结论留待 T020。

- [ ] **Step 5: 更新任务状态和交付报告**

在 `docs/task-status.md` 记录准确测试/构建/浏览器/审查结果和提交号，并创建 `docs/task-report-T009.md`，说明实现范围、验证记录、未验证环境和后续 T010/T017/T020 边界。未完成项标为部分完成，不伪造证据。

- [ ] **Step 6: 检查交付差异并提交**

Run: `git diff --check`

Expected: 无空白错误；核对 `git status --short --branch` 与提交统计，只提交 T009 交付文件。

```bash
git add docs/task-status.md docs/task-report-T009.md
git commit -m "docs: record T009 experience crystal acceptance"
```

## 计划自审

- **规格覆盖：** 死亡事件/零经验、圆形接触、一次奖励、寿命边界、有效时间、暂停和死亡冻结、reset/订阅、HUD、只读 Canvas、图层与浏览器验收均有对应任务。
- **接口一致性：** 系统持有 `crystals` 与 Player 的共享引用；GameWorld 以闭包适配既有 `subscribeEnemyDeath`；CanvasRenderer 保留前三个参数并新增第四参数。
- **范围：** 不实现升级逻辑、晶体吸附/合并、美术动画、对象池或空间索引。
- **边界覆盖：** Review Focus 的每类输入或状态均在相应 Task 中列出测试。
