# T006 交付报告：基础敌人系统

## 执行状态

实现、验证和独立审查已完成；T006 相关最终提交待完成，当前尚未标记验收完成。

## 实现内容

- 新增 EN-01 集中配置：生命 30、速度 80 世界像素/秒、半径 16、接触伤害 10、经验 1、红色占位色；生成间隔 1 秒、视口外缘留白 32、普通敌人上限 100、每个名额最多 16 次位置尝试。
- 新增独立 `Enemy` 实体、恒速追踪与失效清理系统。清理不会记击杀或经验，也不会提前标记死亡结算。
- 新增可注入随机源的视口外生成系统。生成点完整位于地图内、满足视口间距和玩家分离要求；没有合法位置时有界跳过；满额及失败名额不积欠账。
- `GameWorld` 注入 `Game` 创建的 Camera，并与 CanvasRenderer 共用。敌人只在 PLAYING 更新；重置原位清空实体并清生成余量，保留单个世界生命周期内的递增 ID。
- 新增红色敌人占位绘制与视口裁剪，渲染顺序为地图、敌人、玩家。
- 未实现接触伤害、玩家死亡、攻击、击杀结算、经验掉落、其他敌人、波次或 Boss；这些仍归后续任务。

## 主要变更文件

- 新增：`src/config/enemyConfig.js`、`src/entities/Enemy.js`、`src/systems/EnemySystem.js`、`src/systems/SpawnSystem.js`、`src/rendering/EnemyRenderer.js`。
- 集成：`src/core/Game.js`、`src/core/GameWorld.js`、`src/rendering/CanvasRenderer.js`；现有 GameWorld 测试改为显式注入 Camera。
- 测试：新增 `tests/enemy.test.js`、`tests/spawn-system.test.js`、`tests/enemy-world.test.js`、`tests/enemy-renderer.test.js`。
- 文档：SRS、SDD、设计决策 D-023、任务状态、获批规格、实施计划与本报告。

## 自动化测试与构建

- 基线：`npm test`，11 个测试文件、48 项通过。
- TDD 中先运行新增测试观察到因实现模块缺失/未集成导致失败，再实现至通过。
- 最终 `npm test`：15 个测试文件、80 项通过。
- `npm run build`：成功，Vite 转换 25 个模块并生成生产构建。
- 未安装依赖或增加第三方包。

## 浏览器验证

- 使用本机 Vite 页面与 Playwright Chromium 检查标题菜单、开始、Canvas 敌人绘制、按住 D 后移动和追踪、暂停、确认返回菜单及重开。
- 暂停 1.2 秒期间 Canvas 像素哈希保持一致；暂停期间有效时钟和实体不推进。单元测试另覆盖暂停后剩余生成间隔恢复、重开清空实体且 ID 不复用。
- 最终浏览器会话控制台为 0 错误、0 警告。另一次测试专用 `getImageData` 读取触发了 Chromium 的 `willReadFrequently` 性能提示；这是诊断读取提示，清洁会话未出现应用错误或警告。
- 未做 Chrome 与 Edge 双浏览器验收、人工系统 Alt-Tab 验收或 FPS/长局压力测量；按计划留给 T020 与兼容验收。

## 代码审查与修复

独立只读审查未发现 Critical 或 Important 问题。唯一 Minor 是实施计划中的文档交付项未勾选，已据实勾选；没有源码修复项。审查者确认生成边界、时间余量、上限、追踪、暂停/重开、模块依赖、绘制和测试均符合获批范围。

## 未解决风险

- 基础每秒生成节奏是获批首轮配置，最终压力曲线由 T014 接入，数值可在后续试玩中调优。
- 尚未实测 100 只敌人的目标帧率或长时间内存表现；不声称已达到 60 FPS。
- T006 没有战斗结算，敌人靠近/重叠目前不会伤害玩家，必须由 T007 实现。

## Git Commit

最终 T006 代码/文档提交待完成。

## 下一个任务建议

T006 验收完成后由用户决定是否启动 T007 玩家受伤与死亡；本次不执行 T007。
