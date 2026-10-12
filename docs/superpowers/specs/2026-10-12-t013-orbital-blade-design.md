# T013 轨道刃系统设计规格

**日期：** 2026-10-12
**状态：** 已按规格实施并验收（2026-10-12）
**任务：** T013 — 轨道刃解锁与武器协作

## 目标与边界

首次选择 UP-04 后，ZERO 解锁一把绕自身旋转的轨道刃。它在近距离接触敌人时造成伤害；同一个目标按独立冷却限制受击频率。再次选择 UP-04 增强伤害与覆盖半径。轨道刃与脉冲枪同时运行，二者共享 UP-01 伤害倍率，但保持各自攻击状态和基础配置。

本任务不改变六类升级的效果、候选规则、敌人生命/速度/碰撞、脉冲枪、玩家移动速度或关卡节奏；不增加第二把轨道刃、磁吸、穿透、武器进化、粒子或音效。T017 负责正式美术。本任务使用清楚可见的几何占位图形。

## 参数与计算

SRS 将轨道刃攻击定义为近距离旋转接触武器、UP-04 重复选择提高伤害和覆盖半径、每目标具有独立命中冷却，但没有给出首轮数值。T013 采用以下集中且可调的首轮值：

| 配置 | 首轮值 | 含义 |
|---|---:|---|
| `bladeRadius` | 8 世界像素 | 碰撞与占位图形半径 |
| `baseDamage` | 12 | UP-04 1 级每次有效命中的基础伤害 |
| `damagePerUpgradeLevel` | 4 | UP-04 每多一级增加的每次伤害；5 级为 28 |
| `baseOrbitRadius` | 48 世界像素 | UP-04 1 级旋转轨迹半径 |
| `orbitRadiusPerUpgradeLevel` | 8 世界像素 | UP-04 每多一级增加的覆盖半径；5 级为 80 |
| `rotationRadiansPerSecond` | `2π` | 每秒一周 |
| `hitCooldownSeconds` | 0.75 秒 | 同一敌人两次受击的最短有效战局间隔 |
| `color` | `#d66dff` | 占位渲染颜色，T017 可替换 |

UP-04 等级 0 时武器不活动。等级 `L` 为 1–5 时：

- 命中伤害为 `(12 + 4 × (L − 1)) × damageMultiplier`。
- 覆盖半径为 `48 + 8 × (L − 1)`。
- 接触距离为 `bladeRadius + enemy.radius`，等于边界时命中。
- 轨道刃位置为 `player + orbitRadius × (cos(angle), sin(angle))`；固定模拟步以 `2π rad/s` 推进角度并环绕至 `[0, 2π)`。

这些是平衡首轮值，不升级为不可调的产品基线；如后续试玩需要调优，只改集中配置并保留测试证据。

## 职责与接口

### `OrbitalBladeSystem`

- 构造依赖共享 `player`、`enemies` 数组、共享 `EnemyDamageSystem` 和冻结默认 `ORBITAL_BLADE_CONFIG`。
- `update({ deltaSeconds, upgradeEffects })` 校验非负有限步长、UP-04 整数等级范围 0–5、正有限 `damageMultiplier`。仅在 `GameWorld` 的 PLAYING 固定步中调用。
- 保有当前角度和 `Map<enemyId, remainingCooldownSeconds>`。冷却只随有效 PLAYING 步递减；暂停、LEVEL_UP、MENU、死亡冻结不调用更新。死敌或已移除敌人的冷却项被清理。
- 每步将活动刃放置在圆轨道当前角度，对每个存活且生命大于零的敌人做圆形接触检测。接触且该 ID 无剩余冷却时，调用共享 `EnemyDamageSystem.applyDamage(enemy, damage)` 一次并设置该敌人冷却。此处不自行发放击杀、经验或死亡事件，由 GameWorld 既有结算统一执行。
- `getSnapshot(level = lastSimulatedLevel)` 返回新建冻结对象 `{ active, level, playerX, playerY, x, y, radius, orbitRadius, angleRadians, color }`；显式等级仅用于只读即时展示，不改变模拟角度、冷却或缓存。不暴露内部 Map 或可变实体。未解锁时 `active:false`，没有有效碰撞位置。`GameWorld` 向此接口传入 `UpgradeSystem` 当前 UP-04 等级，保证刚完成升级选择的画面立即同步。
- `reset()` 将角度归零、清除所有逐敌冷却，并把最近渲染状态恢复为锁定/中性倍率，保证重开与主菜单帧不会残绘旧武器；不改配置、玩家属性、武器系统或任何订阅。

配置构造时复制并冻结，且拒绝任一必需正数参数为非有限或非正值；颜色须为非空字符串。

### `GameWorld`

- 创建 `OrbitalBladeSystem` 并注入既有 Player、敌人共享数组和 `EnemyDamageSystem`。
- 每个 PLAYING 步的顺序是：脉冲枪发射 → `ProjectileSystem` 命中 → `OrbitalBladeSystem` 更新/命中 → 既有 `#settleEnemyDeaths()` 和敌人清理。两个武器造成的死亡因此都只结算一次，死亡快照仍由同一个既有路径发出。
- 在更新武器后、死亡冻结与升级状态切换前，快照读取仍来自升级系统；`getHudSnapshot().weaponIds` 保留 Player 的实际武器状态，并在 UP-04 等级大于零时加入且仅加入一个 `orbital-blade`。正常重开后等级回零，HUD 隐藏轨道刃。
- `getOrbitalBladeSnapshot()` 只读转发冻结渲染快照。重置清理轨道刃角度/冷却。
- T013 不更改伤害结算的同步顺序、经验订阅、LEVEL_UP 冻结、玩家死亡冻结或已确认的 reset 规则。

### 显示

- `OrbitalBladeRenderer` 仅消费冻结快照，在地图、经验晶体、弹丸和敌人之后、玩家之前绘制活动刃；使用可辨识的紫色旋转菱形占位，不修改模拟状态。
- `CanvasRenderer` 接受可选轨道刃快照，保持已有调用兼容；`Game` 每帧提供 `GameWorld.getOrbitalBladeSnapshot()`。
- HUD 的冻结 `weaponIds` 是装备状态唯一来源；`UIManager` 显示“脉冲枪 / 轨道刃”，并以装饰性小菱形图标标明轨道刃已解锁。升级 UP-04 前只显示脉冲枪，重开后清除轨道刃标签与图标。图标对辅助技术隐藏，武器名称保留可读文本。

## 验收行为

1. 初始快照没有轨道刃；UP-04 第一次选择后，快照与 HUD 均显示一把轨道刃且第一等级伤害/半径正确。
2. UP-04 后续选择按配置提高伤害和轨道半径；UP-01 倍率同时影响脉冲枪与轨道刃；无共享配置污染。
3. 轨道刃可以击中敌人并经 GameWorld 既有路径只发出一次死亡/击杀/经验事件。
4. 同一目标的 HP 不会每模拟帧递减；在冷却不足时第二次接触不伤害，达到 0.75 秒后可再次伤害；不同敌人互不共享冷却。
5. 脉冲枪与轨道刃同时存在；暂停、升级选择与玩家死亡时角度、冷却和敌人 HP 冻结。
6. 重开移除武器 HUD 标记、角度和逐敌冷却，并依旧只装备脉冲枪。
7. Canvas 占位图形只在活动且可见时绘制，不对现有图层顺序造成反转；HUD 文本和图标随快照同步。

## 验证范围

- 系统单元：锁定等级/角度/位置、旋转速度、圆形边界、首击、每目标冷却、不同目标隔离、死亡与实体移除清理、冷却复用、错误参数、冻结快照、配置隔离和 reset。
- GameWorld 集成：真实 UP-04 候选选择/应用、UP-01 共用倍率、同步死亡事件/经验、武器共存、冻结和重开。
- Renderer/HUD：Canvas 图层顺序与只读 snapshot，未解锁/已解锁/重开显示。
- 运行全量 Vitest、Vite 生产构建和差异空白检查；在可用浏览器中验证开局、武器占位图、HUD 状态及升级后的轨道刃攻击。浏览器未能自然或直接进入升级时，记录为未验证而不声称通过。

## 需求映射

- SRS §3.7、FR-011：解锁、绕行、接触伤害、逐目标冷却 → `OrbitalBladeSystem` 与 `GameWorld`。
- SRS §3.8 UP-01/UP-04、FR-010：伤害共用倍率、UP-04 首次解锁和重复强化 → `UpgradeEffectSystem` 快照消费、GameWorld/HUD 集成。
- FR-015：武器装备状态 → 只读 HUD snapshot、UI 文本/图标与 reset 回归。
- T013 开发计划步骤及验收全部由单元、集成、Renderer/UI 和浏览器检查覆盖。

## 技术风险

- 轨道碰撞只对固定 1/60 秒步更新；在该步长和本配置下，刃的每步弧长约 8.38 世界像素，低于刃/EN-01 的合并碰撞直径，目标不会因角度采样而漏过。GameWorld 在 T002 的固定步循环内调用此系统；不得改成变帧长更新。
- 每步逐个检查最多 100 个普通敌人，时间复杂度 O(N)，与 SDD 朴素碰撞基线一致。T020 继续压测。
- 玩家与轨道刃位置是世界坐标；Renderer 做唯一一次 camera 转换，避免两次偏移。
