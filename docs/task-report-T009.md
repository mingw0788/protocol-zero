# T009 交付报告：经验晶体掉落与拾取

## 执行状态

- **Task ID：** T009
- **状态：** 实现、自动化验证、生产构建、浏览器验收和独立代码审查已完成。
- **范围：** 完成正经验死亡掉落、存活玩家接触拾取、晶体有效战局寿命、真实 HUD 经验更新、重开清理和占位绘制；未实现升级阈值或升级界面，也未启动 T010。

## 实现内容

- 新增冻结经验晶体配置：接触拾取半径 12 世界像素、寿命 120 个有效战局秒、绘制尺寸 8×8、颜色 `#ffbf47`。实体校验非空 ID、有限坐标及正有限经验、半径和寿命。
- `ExperienceSystem` 在构造时订阅一次 T008 的冻结死亡快照。正经验掉落在死亡位置创建一枚晶体，零经验不创建；经验快照只读，不保留敌人引用。
- 存活玩家与晶体的中心距离不超过“玩家半径 + 晶体拾取半径”时拾取，无磁吸；奖励先失活晶体再增加经验，避免重复结算。死亡玩家不拾取。寿命按有效模拟时间递减，到期静默清理；同一步到期边界先检查拾取。
- `GameWorld` 让 `experienceCrystals` 数组保持稳定引用，并按死亡结算/敌人清理 → 晶体拾取及过期 → 战局时钟的顺序更新。重开原位清空晶体、保留死亡订阅，晶体 ID 不复用。HUD 继续只读玩家快照中的 `exp`，没有加入 T010 升级逻辑。
- 新增只读晶体 renderer 并接入 Canvas，绘制顺序为地图 → 晶体 → 弹丸 → 敌人 → 玩家；支持逻辑视口裁剪、离屏剔除，不改写实体。

## 变更文件

- **实现：** `src/config/experienceCrystalConfig.js`、`src/entities/ExperienceCrystal.js`、`src/systems/ExperienceSystem.js`、`src/core/GameWorld.js`、`src/rendering/ExperienceCrystalRenderer.js`、`src/rendering/CanvasRenderer.js`、`src/core/Game.js`。
- **测试：** 新增 `tests/experience-crystal.test.js`、`tests/experience-system.test.js`、`tests/experience-crystal-renderer.test.js`；更新 `tests/pulse-gun-world.test.js`、`tests/game-world-hud.test.js`、`tests/enemy-renderer.test.js`。
- **文档：** T009 批准规格、实施计划、本报告和 `docs/task-status.md`。

## 自动化测试与构建

- `npm test -- tests/experience-crystal.test.js`：12 项通过。
- `npm test -- tests/experience-system.test.js`：10 项通过。
- `npm test -- tests/pulse-gun-world.test.js tests/game-world-hud.test.js tests/enemy-world.test.js tests/player-damage-world.test.js`：29 项通过。
- `npm test -- tests/experience-crystal-renderer.test.js tests/enemy-renderer.test.js tests/projectile-renderer.test.js`：8 项通过。
- 最终 `npm test`：**28 个测试文件、182 项通过**。
- 最终 `npm run build`：通过，Vite 转换 37 个模块。
- 未安装依赖、未改动依赖清单。浏览器操作使用本机已有的 Playwright CLI 缓存。

## 浏览器验收

**环境：** Windows Microsoft Edge 152.0.4191.53，本地 Vite 页面，通过 Playwright CLI 自动化操作。以下记录是自动化浏览器验收，不是人工手工试玩。

- 从标题菜单开始战局并移动 ZERO。HUD 记录到存活时间 00:15、生命 90、经验 1、击杀 9；暂停截图中能看到多个琥珀色经验晶体：`output/playwright/t009-drop-paused.png`。
- 恢复战局后静止观察 1 秒：存活时间从 00:15 到 00:16，生命从 90 降至 80，经验保持 1；截图可见玩家附近仍有未拾取晶体，证明战局在继续而远离的晶体没有增加经验：`output/playwright/t009-stationary-observation.png`。
- 在另一段恢复后的移动过程中，HUD 经验由 1 增至 2，符合接触拾取增加经验的行为。自动化操作持续移动，故不把该场景描述为逐帧隔离的单晶体测试；精确相切、一次奖励及范围外边界由自动化单元/集成测试覆盖。
- 暂停后通过“返回主菜单”并确认，再次从标题菜单开始。新局 HUD 为生命 100、经验 0、等级 1、击杀 0，画面未见旧局晶体：`output/playwright/t009-reset-run.png`。
- 最终浏览器控制台错误 0、警告 0。

## 代码审查与未验证范围

- 独立只读审查覆盖 T009 分支代码变更（基线 `3468daa` 至实现提交 `25e4216`），对照获批规格、计划和执行记录检查掉落、拾取/寿命、reset、HUD 和渲染集成；**未发现可操作问题**，没有审查修复项。
- 本任务未测 Chrome 稳定版、完整五分钟战局及高密度实体性能；这些仍由 T020/T021 的平台回归、长局和性能验收负责。
- 晶体目前使用 8×8 方块占位；正式素材、拾取动画与特效留给 T017。等级仍为初始值，升级规则属于 T010。

## Git 提交

- `d1a7116`：T009 设计规格与同步文档。
- `22ca90b`：T009 实施计划。
- `0ace74a`：经验晶体配置与实体。
- `93fb01c`：经验掉落、拾取和寿命系统。
- `751d4aa`：GameWorld、HUD 和重开集成。
- `25e4216`：晶体渲染与 Canvas 接线。
- 本报告、状态表和计划验收勾选由后续 T009 文档提交记录。

## 后续任务

T009 验收完成后停止。按任务依赖建议下一步为 T010 经验等级；等待用户明确指令，不自动执行。
