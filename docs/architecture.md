# 游戏系统架构设计说明书（SDD）

| 元数据 | 内容 |
|---|---|
| 文档编号 | PZ-SDD-001 |
| 项目 | Protocol Zero / 零号协议：失控之城 |
| 版本 | 1.0 |
| 依赖 | `docs/requirements.md` PZ-SRS-001 |
| 状态 | T000–T021 任务级交付已完成；V1.0.0 静态版已发布；M3/M4 人工玩法门禁待补，整体验收状态见 `docs/task-status.md` 与 `docs/gameplay-acceptance-follow-up.md` |

## 1. 架构目标与选型

设计一款**浏览器单机、模块化、易测试、能增量扩展**的 2D 俯视角割草游戏。V1 优先小而清晰的架构，不为未来大型特性过度设计。

| 技术 | 具体职责 | 选择原因 |
|---|---|---|
| HTML5/CSS3 | 菜单、升级弹窗、HUD、结算 | DOM 适合文字与按钮交互 |
| JavaScript ES Modules | 所有战局逻辑、系统与配置 | 原生、足够轻量 |
| Canvas 2D | 地图、玩家、敌人、投射物和粒子渲染 | 高频对象绘制可控 |
| Vite | 开发服务器、构建与静态资源管理 | 零后端、轻量启动 |
| Vitest | 数学、状态、升级、伤害等自动化测试 | 与 JS 工程契合 |
| Web Audio API | 事件音效与音量控制 | 无需外部 API |
| localStorage | 本地最佳成绩与音效偏好 | V1 无需服务器 |
| Git | 版本控制、任务粒度提交 | 可追踪、可回滚 |

**明确不选：** Unity（V1 开发成本高）、React 渲染战斗帧（无必要）、大型 ECS 框架、服务端和数据库服务。未来仅当工程发展需要时重新评估。

## 2. 分层设计

```text
Browser / Input
       |
Startup + Config + Optional Resource Fallbacks
       |
Game [GameLoop, GameClock, GameStateManager, GameWorld]
       |
+------+---------+-------------+-----------+
| PlayerSystem   | EnemySystem  | BossSystem|
| SpawnSystem    | WeaponSystem | DamageSys |
| ProjectileSys  | CollisionSys | ExpSys    |
| UpgradeSystem  | UpgradeEffectSystem | WaveSystem |
| Cleanups       |             |           |
+------+---------+-------------+-----------+
       |
Immutable/Read-only Game State Snapshot for Presentation
       |
CanvasRenderer + Camera | HTML/CSS UI | AudioManager
       |
        LocalStorage / Config (side services)
```

**原则：** 逻辑层决定生死、伤害与经验；展示层读取状态并绘制，不把 DOM 变化当作战局数据。异步资源加载不可使模拟同时触发半初始化状态。

### 2.1 入口与基础设施

- 初始化应用、准备 Canvas 和 HTML UI 容器。
- 加载配置；像素图案以内嵌矩阵提供，音频资源失败时可降级。
- 初始化输入、游戏控制器与事件系统。
- 准备异常兜底（资源加载失败、浏览器不支持相关能力）。

### 2.2 核心层

- `Game`：单次应用生命周期、控制器装配、状态切换入口。
- `GameLoop`：以 `requestAnimationFrame` 驱动画面，用固定时间步长推进模拟。
- `GameClock`：战局有效时间，与网页真实时间分离。
- `GameStateManager`：管理 MENU、PLAYING、LEVEL_UP、PAUSED、VICTORY、DEFEAT；入口初始化失败由 `main.js` 的错误兜底呈现，不设 BOOT 游戏状态。
- `GameWorld`：当前局实体集合、战局时序及一次性事件标记；T007 编排接触碰撞/伤害，并发布每局一次的玩家死亡事件。
- `InputController`：收集 WASD/方向键输入；失焦、隐藏标签页或离开 PLAYING 时清除按键状态。
- `PlayerSystem`：在固定模拟步中读取移动向量并更新玩家实体。

### 2.3 战斗与成长系统

- 玩家移动；敌人 AI（T006 起使用独立 Enemy/EnemySystem）；波次生成；Boss 行为；武器攻击；投射物；碰撞；伤害；经验掉落/拾取；升级；清理。
- 状态更新由统一的游戏模拟循环调度。
- 系统之间通过有限公共接口或结构化事件交互，避免到处修改对方的内部字段。

### 2.4 表现与服务层

- `CanvasRenderer` 按图层绘制地图 → 经验晶体 → 子弹 → 粒子 → Boss → 普通敌人 → 轨道刃 → 玩家；展示层只读战局实体。
- `Camera` 世界/屏幕坐标转换、居中跟随、地图边界约束。
- `UIManager` 管理主菜单、HUD、暂停、升级、结算 UI。
- `AudioManager` 在用户操作后惰性创建 Web Audio，管理合成事件音效、静音与音量；V1 不含背景音乐（D-015）。
- `LocalProgressSystem` / `LocalProgressStore` 读取和保存版本化本地成绩与音效设置；异常时使用安全默认值，写入失败不会阻止运行。

## 3. 目标目录结构

> T001 按需建立，**不要在 T000 提前创建游戏代码**，也不要为了凑目录创建几十个空文件。

```text
protocol-zero/
├── AGENTS.md
├── START_CODEX.md
├── README.md
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── development-plan.md
│   ├── task-status.md
│   └── decisions.md
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── Game.js
│   │   ├── GameLoop.js
│   │   ├── GameClock.js
│   │   ├── GameStateManager.js
│   │   ├── GameWorld.js
│   │   └── createRandomStream.js
│   ├── input/
│   │   └── InputController.js
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── Projectile.js
│   │   └── ExperienceCrystal.js
│   ├── systems/
│   │   ├── PlayerSystem.js
│   │   ├── EnemySystem.js
│   │   ├── SpawnSystem.js
│   │   ├── WeaponSystem.js
│   │   ├── ProjectileSystem.js
│   │   ├── EnemyDamageSystem.js
│   │   ├── CollisionSystem.js
│   │   ├── DamageSystem.js
│   │   ├── ExperienceSystem.js
│   │   ├── UpgradeSystem.js
│   │   ├── UpgradeEffectSystem.js
│   │   ├── WaveSystem.js
│   │   ├── OrbitalBladeSystem.js
│   │   ├── BossSystem.js
│   │   ├── ParticleSystem.js
│   │   └── LocalProgressSystem.js
│   ├── rendering/
│   │   ├── CanvasRenderer.js
│   │   ├── Camera.js
│   │   ├── MapRenderer.js
│   │   ├── PlayerRenderer.js
│   │   ├── EnemyRenderer.js
│   │   ├── ProjectileRenderer.js
│   │   ├── ExperienceCrystalRenderer.js
│   │   ├── OrbitalBladeRenderer.js
│   │   ├── BossRenderer.js
│   │   ├── ParticleRenderer.js
│   │   └── spritePatterns.js
│   ├── ui/
│   │   └── UIManager.js
│   ├── audio/
│   │   └── AudioManager.js
│   ├── persistence/
│   │   └── LocalProgressStore.js
│   ├── config/
│   │   ├── worldConfig.js
│   │   ├── playerConfig.js
│   │   ├── enemyConfig.js
│   │   ├── weaponConfig.js
│   │   ├── experienceCrystalConfig.js
│   │   ├── levelConfig.js
│   │   ├── orbitalBladeConfig.js
│   │   ├── bossConfig.js
│   │   ├── audioConfig.js
│   │   ├── particleConfig.js
│   │   ├── upgradeConfig.js
│   │   ├── upgradeEffectConfig.js
│   │   └── waveConfig.js
│   └── styles.css
├── tests/ (Vitest unit/integration files)
├── index.html
└── package.json
```

**注意：** 上图依据 T001–T020 当前已实现源码目录同步；目录仅列实际存在的源码，不要求为未规划功能预建空文件。测试由根目录 `tests/` 按模块拆分。

## 4. 状态机与游戏生命周期

```text
MENU --> PLAYING --> LEVEL_UP --> PLAYING
                   |  ^          |
                   v  |          +-- 选择升级完成 --> PLAYING
                 PAUSED
                   |
                   +---- 继续 --> PLAYING
                   +---- 确认返回并清理本局 --> MENU
PLAYING --> VICTORY
PLAYING --> DEFEAT
VICTORY/DEFEAT --> MENU or NEW PLAYING
```

| 状态 | 更新模拟 | 接受移动 | UI 行为 |
|---|---|---|---|
| MENU | 否 | 否 | 开始、设置、帮助 |
| PLAYING | 是 | 是 | HUD / Esc 可暂停 |
| PAUSED | 否 | 否 | 继续、退出 |
| LEVEL_UP | 否 | 否 | 选择合法升级；Esc 不跳过 |
| VICTORY | 否 | 否 | 结算、重来、返回 |
| DEFEAT | 否 | 否 | 结算、重来、返回 |

T002 按任务范围先实现 `MENU`、`PLAYING`、`PAUSED` 三态；T005 加入 PAUSED → MENU，首次加载保持 MENU，开始新局和确认返回均先清理本局。取消返回确认保持 PAUSED；Esc 只切换 PLAYING/PAUSED，并忽略重复 keydown。T010 接入 `PLAYING → LEVEL_UP → PLAYING` 受控迁移；T011 提供选择界面。T016 接入 `VICTORY`、`DEFEAT`：有效进行中的 GameWorld 固定步末按死亡优先判定；胜败结果冻结，通用迁移不能从终态直返 PLAYING，Game.restartGame 必须先 reset 再走受控重开。

约束：状态迁移应由单一管理器协调，不允许多个系统各自把游戏标记“结束”。死亡检查与胜利检查采用固定优先级：**死亡优先**。

## 5. 固定步长和更新时序

### 5.1 模拟时间

- 用 `requestAnimationFrame` 触发绘制。
- 采用固定模拟时间步长，设计值 `1/60 秒`；帧率变化时不会按渲染次数计算移动。
- 每帧最多执行 5 个固定模拟步（最多补算 `5/60` 秒）；超过上限时丢弃整步积压，仅保留不足一个固定步的余量，避免长时间卡顿后追赶墙钟时间。
- `GameClock` 使用补偿求和累计有效时间，减少反复累加 `1/60` 秒造成 60/120 秒波次边界晚一帧的问题。
- 窗口失焦或标签页隐藏时自动切入 `PAUSED`；恢复焦点不自动继续。进入或离开暂停状态时清空 accumulator，并重置上一帧时间戳，避免恢复后“瞬移”和集中生成事件。
- `GameClock` 只在 `PLAYING` 推进；武器冷却、Boss 计时、无敌倒计时等均基于逻辑时间。

### 5.2 T007–T016 固定模拟步顺序

每个有效 `PLAYING` 步按以下顺序处理：

1. 若状态不是 `PLAYING` 或本局已死亡冻结，返回未更新；
2. `DamageSystem.update(deltaSeconds)` 递减玩家无敌余量并钳制到 0；
3. `PlayerSystem` 更新玩家，随后 Camera 跟随；
4. 结算已有敌人死亡并清理失效敌人；`SpawnSystem` 更新普通敌人生成，`BossSystem` 按 `clock.elapsedSeconds + deltaSeconds` 判断单次到场并更新 Boss，`EnemySystem` 只推进普通敌人；
5. `CollisionSystem` 检测圆形接触，`DamageSystem` 对最高一笔接触伤害结算一次；
6. `WeaponSystem` 发射弹丸，`ProjectileSystem` 推进弹丸并结算命中；
7. `GameWorld` 在敌人清理前结算本步死亡并同步发布死亡快照；
8. `ExperienceSystem` 更新晶体、拾取与寿命；只有存活玩家能拾取。有效模拟步内刚产生且已与玩家重叠的晶体可在本步拾取；
9. `LevelSystem` 根据本步拾取后的当前等级经验余量，扣除已满足阈值、递增等级并为每次升级建立待选项；
10. 推进 `GameClock` 和模拟步计数，确保触发等级或致死的固定步计入完整时间；
11. 若本步令玩家死亡，清除移动输入、锁定本局冻结并同步发布冻结 payload `{ elapsedSeconds }`；
12. 玩家死亡则先建立失败快照并转入 `DEFEAT`；否则当有效时间达到 300 秒且 Boss 已死亡时建立胜利快照并转入 `VICTORY`；
13. 仅当战局仍处于 `PLAYING` 且本步新增待选升级时转入 `LEVEL_UP`。此后 GameLoop 停止本帧后续补算步并清空 accumulator。

菜单、暂停、升级选择、胜败结算和失焦自动暂停不推进战局寿命。系统顺序须保持：T007 接触伤害、T008 投射物死亡通知、T009 晶体拾取、T010 阈值结算均在本步时钟推进前完成；时钟推进后先处理玩家死亡，再处理存活玩家的胜利，只有战局仍进行时才进入 `LEVEL_UP`。致死步计入结算时间且死亡优先；终态冻结生效后不再更新任何系统。

T015 将 `BossSystem` 插入玩家/Camera 更新后、普通敌人更新前；Boss 的生成、追踪/攻击状态与波次读取均使用同一个有效步末时钟。普通敌人初始死亡清理发生在生成前；击中造成的 Boss 死亡和普通敌人死亡仍由步末统一结算。T016 在该时序之上，步末时钟推进之后消费胜败条件，死亡优先于胜利。

## 6. 核心数据设计

### 6.1 Player

```text
id, x, y, radius, hp, maxHp, baseMoveSpeed, moveSpeed,
level, exp, invulnerabilityRemaining,
weaponStates, upgradeLevels, alive
```

由 PlayerSystem 管理运动，DamageSystem 负责受伤与生命钳制，ExperienceSystem 负责拾取并增加经验，LevelSystem 负责当前等级余量、阈值换算、等级递增和待选队列。

T005 已建立 `hp/maxHp`、`level`、`exp` 和独立的 `weaponStates` 运行数据，初值为 100/100、1、0 和 `pulse-gun`。T007 增加每局独立的 `alive`（初始 `true`）和 `invulnerabilityRemaining`（初始 0）；T012 保存构造时的 `baseMoveSpeed`，速度升级始终以此基值派生当前速度。`Player.reset()` 恢复基础速度、生命、存活状态、无敌余量和位置。`player.exp` 始终表示当前等级的余量；T010 的 LevelSystem 按 `6 + 4 × (level − 1)` 消费阈值，每跨一级增加一个待选升级。Player 保存等级与余量，LevelSystem 不修改全局配置。

### 6.2 Enemy / Boss

```text
id, typeId, x, y, radius, hp, maxHp, speed,
contactDamage, expDrop, aiState, alive, deathProcessed
```

Boss 在此基础上增加：`phase`（V1 固定单阶段）、技能状态、技能冷却、预警剩余时间、冲锋方向、是否已完成死亡结算。

### 6.3 Projectile

```text
id, ownerId, weaponId, x, y, vx, vy,
radius, damage, remainingLife, active
```

投射物按配置处理命中后的销毁/穿透，不重复命中同一目标（除非明确设计允许）。

### 6.4 ExperienceCrystal

```text
id, x, y, expValue, pickupRadius, remainingLifetime, active
```

每个正 `expDrop` 死亡事件在原坐标产生一个经验晶体；零经验敌人不产生晶体。存活玩家与晶体的中心距不超过 `player.radius + pickupRadius` 时拾取。T009 首轮 `pickupRadius` 为 12 世界像素，寿命为 120 个有效模拟秒。晶体生命周期由 ExperienceSystem 管理，不能直接实现升级界面或修改 DOM。

### 6.5 运行状态与配置

- 基础配置（玩家、武器、敌人、晶体和波次）只读共享。
- 战局运行时状态（实体生命、临时升级、攻击冷却）每局新建。
- 对象死亡使用统一事件或统一收尾函数，保证击杀和掉落只执行一次。
- ID 用于识别实体；跨场景/重开时需避免旧对象引用继续生效。

## 7. 武器与升级扩展设计

### 7.1 WeaponSystem

定义共享接口和规则：获取属性 → 选择目标 → 检查冷却 → 触发攻击 → 传递伤害事件。

- 脉冲枪：目标为射程内最近有效敌人；按冷却发射弹丸。
- 轨道刃：随时间环绕玩家；与敌人接触时受单目标命中冷却约束。
- 武器实例独立持有攻击状态；全局配置不可被升级逻辑改写。

### 7.2 升级池

配置形式应包含：`id, name, description, maxLevel, eligibility, effect`，以及可能的等级数值曲线。候选选择逻辑只返回合法项。

- 当前级数满级 ⇒ 不进入候选。
- 候选同一次抽样不重复。
- 合法升级不足三项 ⇒ 显示剩余项。
- 全部升级满级 ⇒ 只提供生命恢复保底项。
- 通过纯逻辑函数计算加成和升级影响，便于单测。
- 固定并文档化“百分比增益叠加”顺序，初期推荐按基础值乘以 `(1 + n × 每级百分比)`；不在多个模块出现不同公式。此为技术建议，T000 可以审核后确认。

## 8. 敌人生成与 Boss

- `WaveSystem` 根据**有效战局秒数**提供怪物比例和生成速率配置。
- `SpawnSystem` 在普通敌人活跃数 `< 100` 时按当前波次尝试视口外合法位置，使用所选敌种半径验证视口留白、地图范围和玩家分离；名额达到后即消耗，取样失败不积压重试。
- 不要把敌人数量与游戏渲染帧数直接绑定。
- Boss 在 `GameClock >= 270s` 且 `bossSpawned = false` 时仅生成一次。
- `BossSystem` 独占 Boss 移动与攻击状态；Boss 以 `category: 'boss'` 加入共享 `GameWorld.enemies`，复用接触伤害、两种武器、死亡结算与普通敌人绘制。`EnemySystem` 跳过 Boss，Boss 不计入 100 只普通敌人上限；生成确定性选择合法、安全的最远角点，不消费敌人/升级随机流。
- D-036 首轮值集中在 `BOSS_CONFIG`：1800 HP、半径 44、追踪速度 60、接触伤害 20、首次延迟 2 秒、0.8 秒预警、420 速度/0.6 秒冲锋、0.8 秒恢复和 3.2 秒循环冷却。除 SRS 固定值外均为可调初值。
- Boss 冲锋：追踪 → 预警 → 固定方向冲锋 → 恢复 → 循环；预警满足 SRS 至少 0.7 秒。冻结快照提供实体、阶段、方向和地图边界内终点；Canvas 在敌人本体前绘制裁剪于视口的半透明通道。
- Boss 经验掉落为 0，既有 GameWorld 死亡结算只计一次；BossSystem 保留被击败快照，不会在同一局重生。`GameWorld.reset()` 清除 Boss 引用、攻击相位和单次生成标记。
- 完成时间 `>= 300s` 且 `bossDefeated` 才允许胜利。

## 9. 地图与摄像机

- 世界逻辑尺寸 2400 × 1350，参考视口 1280 × 720。
- 地图碰撞按世界坐标和实体半径计算。
- Canvas 绘制将世界坐标换算为屏幕坐标；相机的实际屏幕位置可以插值以减少视觉抖动。
- 使用像素化贴图或最近邻放大，避免被浏览器模糊插值。
- 按真实设备 DPR 管理 Canvas 缩放，避免 CSS 尺寸与绘制尺寸不一致。
- 逻辑视口固定为 1280 × 720；Canvas 后备位图按 CSS 尺寸 × DPR 设置，绘制使用统一比例并居中留边。Camera 坐标使用逻辑视口单位，不混入 DPR 或 CSS 像素。
- 纯装饰图层不阻止运动；复杂障碍寻路推迟至后续版本。

## 10. 碰撞、特效和性能约束

| 碰撞对象 | 方法 | 处理 |
|---|---|---|
| 玩家/敌人 | 圆形碰撞 | 按受伤无敌时间扣血 |
| 子弹/敌人 | 圆形碰撞 | 生成伤害事件，命中后处理子弹 |
| 轨道刃/敌人 | 圆形碰撞 | 独立每目标命中冷却 |
| 玩家/经验晶体 | 圆形相交，`距离 ≤ player.radius + pickupRadius` | 存活玩家加经验，晶体先失效再清理 |
| 玩家/地图边界 | 半径约束 | 修正玩家位置 |

第一版可使用朴素碰撞检测。在高敌人数性能不达标时通过分析引入空间网格、对象池、视口外不绘制和生命周期管理，不提前为不存在的负载过度设计。

每帧必须清理已销毁子弹、死亡敌人、过期经验晶体及特效。经验晶体按有效模拟时间在 120 秒后过期；粒子效果须配置最大数量与寿命。性能数据必须实测，不可假称已经达到 60 FPS。

## 11. UI 通信与资源

**调用示例（概念流程）：** 战斗中获取经验 → ExperienceSystem 增加经验 → LevelSystem 结算阈值并申请 `LEVEL_UP` → UIManager 展示卡片 → 玩家选择 → UpgradeSystem 验证并记录等级 → UpgradeEffectSystem 应用玩家属性并生成只读效果快照 → 消费一项待选升级 → 队列清空后返回 `PLAYING`。

UI 不直接绕过升级系统修改玩家属性。菜单与 HUD 显示采用游戏状态快照或只读访问接口。

### 11.1 T005 已实现的菜单与 HUD 合约

- `GameWorld.getHudSnapshot()` 汇总真实 Player、GameClock 和本局击杀数，返回 `{ health: { current, max }, experience, level, pendingLevelUps, weaponIds, killCount, elapsedSeconds }`。快照、生命对象、武器 ID 数组均新建并冻结，不泄露实体引用。
- `GameWorld.recordKill()` 提供本局击杀累加入口；T008 负责在真实死亡结算时只调用一次。`GameWorld.reset()` 清理时钟、玩家、输入、击杀和模拟步数。
- `Game` 通过 `getHudSnapshot()` 提供读取，使用受状态约束的 `startGame/togglePause/returnToMenu` 接受界面操作。重复开始不能重置活动局。
- `UIManager` 管理 DOM 菜单、帮助、基础 HUD、暂停和原生返回确认对话框。开始/停止负责订阅及事件绑定/解除，不直接修改世界或玩家。
- `Game.attachUIManager()` 在应用启动前连接展示端口。每帧 Canvas 绘制后传入最新快照；状态迁移时同步切换界面和焦点。仅展示值变化时写入 DOM。
- HUD 只在 PLAYING 显示；经验数值表示当前等级余量，T010 的待选数通过只读快照提供给后续升级界面。主菜单、暂停和升级选择时不推进有效时间。
- `Game.soundEnabled` 默认开启，`toggleSound()` 与 `setSoundVolume()` 更新本次页面运行期偏好，重开和返回菜单保留；T018 在显式用户交互后创建音频上下文，T019 接入持久化。音频不可用时不影响战局。

### 11.2 T006 敌人子系统

- `Enemy` 使用 EN-01 配置创建独立生命、速度、碰撞半径、接触伤害及经验数据；实例变化不得修改配置。
- `GameWorld` 通过注入的 Camera 获取真实逻辑视口；Camera 由 `Game` 创建并与 `CanvasRenderer` 共用，核心层不反向导入渲染模块。
- `SpawnSystem` 读取 `WaveSystem` 的有效战局快照，以当前波次间隔累计生成名额并按敌种权重选择；使用具体敌人半径，从视口四周视界外按可用边长度抽样。EN-01 第一名额仍在第 1 秒产生；合法位置不足时跳过名额，最大 16 次取样。只统计 `category === 'normal'` 的活跃实体，普通敌人不超过 100 只。
- `EnemySystem` 每步先在线性遍历中清理失效实体，再让存活敌人对玩家做归一化恒速追踪；最大 100 只使用朴素逐个更新。
- Camera 视口为玩家跟随相机现有的 `1280 × 720` 逻辑尺寸；生成留白、速度、半径及频率均配置化。T014 的 `WaveSystem` 按 `GameClock` 有效秒数提供生成间隔和敌种权重。
- `EnemyRenderer` 只读普通敌人数组，在地图与玩家之间按实体半径和配置色绘制 EN-01/02/03 区分剪影的像素矩阵并裁剪于逻辑视口；未知类型使用中性图案。Boss 由 BossRenderer 单独绘制，避免普通敌人层重复覆盖。

### 11.3 T007 玩家接触伤害与死亡事件

- `CollisionSystem` 只读当前玩家与敌人引用，按世界坐标与圆形半径检测重叠；只返回 `alive === true` 且 `hp > 0` 的接触敌人，不修改实体或阻挡移动。
- `DamageSystem` 从 `PLAYER_CONFIG.invulnerabilitySeconds` 读取 0.6 秒无敌时长；无敌时间按有效模拟步递减。多个敌人同一步接触时只应用最大 `contactDamage`，不相加、不受数组顺序影响。
- 接触伤害将玩家生命钳制到 `[0, maxHp]`；有效受击重置无敌时间。HP 首次归零时 `alive` 转为 `false`。
- 致死步先完成时钟和模拟步计数，再清空输入、冻结战局并同步触发 `GameWorld.subscribePlayerDeath(listener)`。事件 payload 为冻结对象 `{ elapsedSeconds }`；订阅函数返回取消订阅方法，注册不重放历史事件。
- `GameWorld.reset()` 恢复玩家数据、清理敌人和死亡冻结锁，但保留订阅关系，以供同一 `Game` 生命周期重开后继续接收下一局事件。T007 不增加 `DEFEAT` 状态或死亡 UI；T016 在致死固定步收尾后接入正式结算。

### 11.4 T009 经验晶体子系统

- `ExperienceSystem` 在 `GameWorld` 构造时只注册一次 `subscribeEnemyDeath` 监听；依赖 T008 的 `deathProcessed` 保证单次死亡通知，不在每次重开时重复订阅或重放事件。
- 系统将冻结死亡快照复制成独立 `ExperienceCrystal`；`expDrop > 0` 时生成一枚，晶体位置和经验值分别取快照 `x/y` 与 `expDrop`。敌人清理不影响掉落。
- `GameWorld.experienceCrystals` 与系统共享同一数组。更新时执行圆形拾取、120 秒寿命递减和原位清理，避免替换共享数组引用；拾取先置 `active = false` 再增加 `player.exp`。
- 重置使旧晶体失效并清空数组，保留死亡事件订阅；晶体 ID 在 ExperienceSystem 生命周期内递增，避免跨局复用。
- T009 仅拾取并增加经验；T010 的 LevelSystem 处理阈值、等级和连续升级队列，并在待选数大于零时转入冻结的 `LEVEL_UP`。T011 展示合法选项并逐项消费队列。
- `ExperienceCrystalRenderer` 只读活动晶体，在逻辑视口内绘制琥珀色像素菱形与高光；拾取尺寸和判定不变。T017 绘制顺序为地图 → 晶体 → 弹丸 → 粒子 → Boss 警告/本体 → 普通敌人 → 轨道刃 → 玩家。

### 11.5 T010 等级与待选升级队列

- `LevelSystem` 读取真实 Player 的 `level/exp`；阈值为 `6 + 4 × (level − 1)`，每次满足阈值都扣除余量、递增等级并新增一个待选计数。
- 阈值使用精确整数累计和对数步数查找；Number 安全整数范围之外的阈值或结算结果快速原子拒绝，不构成玩法等级上限。
- `GameWorld` 在经验拾取后结算所有新跨越等级，完成当前固定步时钟/步数推进后进入 `LEVEL_UP`；模拟冻结直至 T011 的合法选择逐项消费待选计数。
- `GameStateManager` 只允许 `PLAYING → LEVEL_UP` 和待选全部完成后的 `LEVEL_UP → PLAYING`；普通暂停、继续或返回菜单动作不能绕过待选升级。
- `GameWorld.reset()` 在 `LEVEL_UP` 中先拒绝且不改动队列/状态；有效重置时清空待选计数，Player 回到等级 1、经验 0。HUD 快照提供 `pendingLevelUps` 数值，不暴露 LevelSystem 内部状态。

### 11.6 T011 升级候选与选择面板

- 冻结的 `UPGRADE_CONFIG` 是六类升级名称、描述和等级上限的唯一配置来源；每局 `UpgradeSystem` 持有等级与候选快照，并使用与敌人生成独立的随机源。
- 进入 `LEVEL_UP` 前先准备冻结候选；按 D-030 从当前未满级项中等权、无放回选择最多三项，候选不足三项时只展示合法项。全部满级后提供不增等级、不提高生命上限的满血恢复兜底。
- `GameWorld` 校验候选选择并每次消费一个 T010 待选升级；队列未空时同步准备下一组并保持模拟冻结，队列清空后回到 `PLAYING`。有效重开清除升级等级与候选。
- `Game` 只读暴露候选并转发选择动作；UIManager 根据只读快照填充固定 DOM 卡片，不在渲染帧重抽候选或直接修改游戏状态。
- `LEVEL_UP` 面板使用模态对话框语义和 `aria-live` 剩余次数提示；鼠标、Enter/Space 激活卡片即提交，Tab 焦点限制于可见选项，Escape 不得关闭或消费待选队列（D-031）。
- T011 负责候选、等级与满级治疗兜底；六类实际效果及脉冲枪修正由 T012 接入，轨道刃攻击仍归 T013。

### 11.7 T012 升级效果与属性快照

- 冻结的 `UPGRADE_EFFECT_CONFIG` 集中保存六类升级效果参数；`UpgradeEffectSystem` 根据 `UpgradeSystem` 等级快照派生冻结的 `{ damageMultiplier, pulseGunFireRateMultiplier, pulseGunProjectileCount, moveSpeedMultiplier, orbitalBladeLevel }`，不修改共享基础配置。
- 百分比效果统一使用 D-032 的 `base × (1 + perLevelBonus × level)`，保留内部数值精度。UP-01 的伤害倍率供全部武器共用；T012 的 WeaponSystem 消费伤害、射速和弹丸数量倍率。
- UP-02 只改变下一次脉冲枪发射后的冷却间隔；当前正在递减的冷却仍是绝对剩余秒数。弹丸在创建时保存伤害，之后的升级不会改变在途弹丸。
- UP-03 用配置中的 12 度相邻间隔围绕最近目标方向对称排列弹丸（D-033），总数为 1 加升级等级，最多三枚。
- UP-05 按 `Player.baseMoveSpeed × moveSpeedMultiplier` 计算当前速度，不逐级累乘；UP-06 每级增加 20 最大生命和最多 20 当前生命，并钳制在新上限内。
- UP-04 只通过 `orbitalBladeLevel` 暴露等级；T012 不装备或攻击轨道刃。`GameWorld.getUpgradeEffectSnapshot()` 向后续武器系统提供冻结快照。
- `GameWorld` 只对成功选择应用一次效果；有效重开先恢复 Player 基础属性并清零 UpgradeSystem 等级，因此后续快照回到中性值。非法选择不得改变等级、玩家数值或待选队列。

### 11.8 T018 音效与 T019 本地存储

T018 `AudioManager` 在显式用户交互时惰性创建/恢复 Web Audio `AudioContext`，通过 oscillator 和 gain 合成短事件音；不下载素材。未支持/创建失败/恢复失败时静音降级，不阻断模拟。GameWorld 以冻结 `{ type }` 通知实际射击、受伤、死亡、击杀、升级选择和胜败；Game 只注册一个转发监听，stop 时解除并释放上下文。音量通过主 GainNode 管理，静音不清除音量值；单声部最多 8 个同时音声部，超出时丢弃新声音。

T019 用版本化 schema 仅保存最高击杀、最佳胜利时间和音量/静音偏好，不保存战局中途状态；字段、JSON、版本或 Storage API 无效时恢复安全默认值，写入失败只影响跨刷新持久性。

### 11.9 T013 轨道刃系统

- 冻结的 `ORBITAL_BLADE_CONFIG` 集中保存碰撞半径、等级 1 基础伤害、每级强化增量、轨道半径、旋转速度、逐敌冷却和占位颜色；D-034 的值是可调首轮平衡参数。系统构造时复制并冻结配置，以私有字段保存并通过无 setter 的只读访问器暴露；调用方不能替换已校验的运行配置，也不会修改共享基础武器配置。
- `OrbitalBladeSystem` 持有轨道角度和 `Map<enemyId, remainingCooldownSeconds>`，消费只读升级效果 `{ orbitalBladeLevel, damageMultiplier }`。等级 0 不活动；等级 1–5 使伤害按 `(12 + 4 × (level − 1)) × damageMultiplier` 计算，轨道半径按 `48 + 8 × (level − 1)` 计算。每个有效模拟步推进 `2π rad/s`，接触条件为中心距不超过 `bladeRadius + enemy.radius`。
- 碰撞使用 `EnemyDamageSystem.applyDamage()`；系统不直接结算击杀或经验。`GameWorld` 在 `ProjectileSystem` 后更新轨道刃，再调用原有 `#settleEnemyDeaths()`，因此两种武器同一步击杀仍走唯一幂等收尾。
- 命中冷却以有效 PLAYING 时间逐敌递减，清除死亡或不存在实体的键；暂停、LEVEL_UP、MENU 和玩家死亡冻结均不调用更新。重置清空角度/冷却/最近活动等级，保留配置。
- `GameWorld.getOrbitalBladeSnapshot()` 将 UpgradeSystem 当前 UP-04 等级交给只读 `getSnapshot(level)`，让升级选择后的画面即时同步；系统内部的角度和冷却只由固定模拟步更新。冻结快照不泄露实体引用。
- Canvas 在普通敌人上层、玩家下层绘制活动紫色像素菱形与亮核；Renderer 只做一次世界到屏幕转换并裁切于逻辑视口。
- `getHudSnapshot().weaponIds` 在 Player 的已有武器状态上派生一个 UP-04 装备 ID，不占用脉冲枪冷却状态；UI 文本和装饰图标都只读该快照，重开后仅显示脉冲枪。

### 11.10 T014 波次与三类普通敌人

- `ENEMY_CONFIG` 为 EN-01/02/03 提供冻结配置。SRS 已确认的生命、速度、接触伤害和经验数据不变；D-035 的 EN-02 半径 12、EN-03 半径 22 和占位色是集中可调值。`Enemy.category` 仅允许 `normal`/`boss`，旧配置缺省为 `normal`。
- `WaveSystem` 是无状态有效时间查询；`getSnapshot(elapsedSeconds)` 返回冻结的 `{ phaseId, startSeconds, endSeconds, spawnIntervalSeconds, enemyWeights }`，不读浏览器时间、不另行累计时钟。区间左闭右开，最后一档在 270 秒后持续。
- `GameWorld` 每个 PLAYING 固定步按 `clock.elapsedSeconds + deltaSeconds` 取该步末端波次快照并交给 SpawnSystem；GameClock 对重复固定步使用补偿求和，60/120 秒边界由 3600/7200 步回归锁定。菜单、暂停、升级选择、玩家死亡冻结与重开继续遵守 GameClock/状态机约束。`getWaveSnapshot()` 只读当前 GameClock 所属阶段。
- D-035 的生成间隔为 1.00/0.90/0.80/0.65/0.55 秒；对应阶段边界是 0/60/120/180/240/270 秒，敌种权重集中在 `WAVE_CONFIG`。速率切换保留分数秒余量；达到 100 只普通敌人时消耗生成名额，不排队补发。
- SpawnSystem 按正权重从冻结配置中抽选普通敌种。地图合法性、玩家安全距离均使用所选类型半径，视口外缘留白为 32 世界像素；沿用最多 16 次有界取样。Boss 类实体不占普通敌人数量上限，且不允许进入普通波次权重池。
- EN-02/EN-03 复用既有 EnemySystem 恒速追踪、EnemyDamageSystem、死亡结算、经验掉落和 EnemyRenderer；Renderer 按实体半径/颜色呈现差异。无波次 HUD；Boss、完整终局和性能压力分别由 T015/T016/T020 负责。

### 11.11 T015 Boss 快照、预警与 HUD

- GameWorld 使用共享敌人数组、Player、Camera、World 与可注入配置创建 `BossSystem`。仅 PLAYING 固定步调用 `update(deltaSeconds, clock.elapsedSeconds + deltaSeconds)`；reset 清空 Boss/相位/单次生成标志并保留 GameWorld 订阅。
- Boss 复用 Enemy HP、接触碰撞、EnemyDamageSystem、脉冲枪、轨道刃及死亡结算；`expDrop: 0` 不产生晶体。Boss 不占普通敌人数量上限，也不进入普通波次池。
- `getBossSnapshot()` 返回冻结实体值和预警几何，不暴露 Boss 实体。CanvasRenderer 将快照交给 BossRenderer；预警期按 Boss 位置和地图内 `chargeEnd` 绘制通道，位于敌人本体之前。
- Game 每帧把快照传给 UIManager；语义区显示 Boss 名称、当前/最大生命和 `<progress>`。仅在 Boss 已出现、存活且处于 PLAYING 时显示；未出现、死亡、PAUSED、LEVEL_UP、MENU 均隐藏。
- T015 不新增胜败状态或结算 UI；300 秒胜利条件、死亡优先级、终局数据及结算重开由 T016 实现。

### 11.12 T016 胜败结算与安全重开

- `GameWorld` 每个有效固定步先完成伤害、敌人死亡/击杀、经验阈值、时钟推进，再按顺序检查死亡和胜利。致死步先建立 `DEFEAT` 快照；存活时只有 `elapsedSeconds >= 300` 且 Boss 快照明确为死亡才建立 `VICTORY`。300 秒后 Boss 存活继续战斗；早于 300 秒击败 Boss 则等待边界。
- 终局快照冻结 `{ outcome, killCount, elapsedSeconds }`，来自世界真实状态；结果状态不运行模拟。胜利优先于同一步刚产生的升级选择，死亡优先于胜利。
- `GameStateManager.finishRun()` 只允许有效 `PLAYING` 进入一个终态。通用 `transitionTo()` 拒绝终态返回 `PLAYING`；Game.restartGame 先调用 `GameWorld.reset()` 清除本局，再使用专用 restartRun 迁移。
- GameWorld 复用既有实例是为了保持 GameLoop 和系统共享引用有效；其 reset 重置玩家/升级/武器/Boss/敌人/弹丸/晶体/时钟/击杀/终局状态并保留事件订阅。音效偏好及 T019 的持久化历史数据不归 run reset 所有。
- UIManager 只读终局快照，在胜败面板显示击杀数与按 MM:SS 向下取整的有效存活时间。面板键盘焦点限于“再来一局”和“返回主菜单”；两项动作均经过 Game 校验和清理。

### 11.13 T017 视觉矩阵、固定步动画与粒子反馈

- `spritePatterns.js` 提供冻结的代码像素矩阵；渲染器按角色/敌种 ID 选择矩阵并用最近邻绘制，未知类型使用中性回退。无需外部图像资源加载。
- Player/Enemy 的步态、呼吸、受击闪烁和 Boss 警告只读取有效模拟时间或现有无敌状态，不写回实体位置、碰撞体、攻击或伤害数据。MapRenderer 固定绘制装饰刻线，不创建碰撞区域。
- `ParticleSystem` 只订阅现有敌人死亡事件及真实玩家受伤结果；粒子方向确定性生成，配置经过校验并复制冻结；最大活动数 320，寿命 0.45 秒。玩家终局粒子在建立时预先分散，满足终局模拟冻结时的可见反馈。
- GameWorld 仅在 PLAYING 固定步更新粒子，快照冻结且不暴露内部实体；暂停、升级选择及终局不推进效果，重开清空。粒子绘制于 Boss/普通敌人/轨道刃/玩家之下，不对每发弹丸或每次轨道刃接触生成效果。
- DOM UI 沿用原语义结构，CSS 加强焦点、对比与窄视口布局；640×360 的胜败面板操作按钮不被裁掉。所有视觉改动不改变 SRS 玩法数值。

### 11.14 T018 合成事件音效

- `AudioManager` 配置只包含冻结的事件音调参数；用户手势之前不创建音频上下文，菜单“开始游戏”及启用音效均调用 unlock。缺少 API 或 Web Audio 抛错时所有事件音安全静默。
- GameWorld 仅在有效逻辑事件处发出冻结声音类型：`pulse-fire`、`enemy-death`、`player-hit`、`player-death`、`upgrade`、`victory`、`defeat`。致死音与正式失败音可分别表达事件，事件幂等沿用世界死亡和终局结算规则。
- 主音量范围 0–1；UI 显示 0–100%。静音只把主增益置零，保留选定音量。最多八个仍活动的 oscillator；自然结束后释放声部，超上限静默丢弃新事件。
- 不播放背景音乐：V1 SRS 只要求基础音效。音效设置由 T019 持久化；重开不影响用户的当前音量/静音偏好。

### 11.15 T019 版本化本地进度

- `LocalProgressStore` 单独负责 `protocol-zero.save` JSON 的读取/校验/写入；版本为 1，规范化字段是 `{ version, highestKillCount, bestVictorySeconds, soundEnabled, soundVolume }`。返回值冻结，不暴露 Storage 实例或可变存档对象。
- localStorage 缺失、访问器/方法抛错、JSON 损坏、未知版本或字段不合法时安全返回 `0/null/true/0.65` 默认。写入返回成功标记；失败不使 Game 初始化、设置操作或模拟异常。
- `LocalProgressSystem` 在 Game 构造时加载一次。它从已接受的 `VICTORY/DEFEAT` 结算快照更新最高击杀；只有 victory 以较低 `elapsedSeconds` 刷新最佳通关时间 (D-016)。任何中间战局状态都不写入。
- 音效静音和音量变化即时更新存档。GameWorld reset/重开不重置本机历史；主菜单只读进度快照显示最高击杀和最佳通关时间。

## 12. 测试设计

### 12.1 单元测试

- 向量归一化、世界/屏幕变换、圆形碰撞阈值。
- 圆形恰好相切/略微分离、不同半径、失效敌人过滤与检测纯度。
- 生命值钳制、无敌时间边界、多敌人取最大伤害和死亡幂等性。
- 经验阈值、多次连续升级、升级候选过滤/去重/满级。
- 自动目标选择、轨道刃逐敌命中冷却与精确冷却边界。
- 波次 60/120/180/240/270 秒边界、正权重抽样、不同敌人体型生成合法性与 100 普通敌人上限。
- 状态迁移、暂停时间冻结、胜败优先级、重开状态隔离。

### 12.2 集成测试

- 玩家/敌人移动后碰撞、真实 HUD 生命、致死步计时、输入清理、暂停冻结、订阅取消与重置后事件重放。
- 生成 → 追踪 → 被武器击杀 → 掉落 → 拾取 → 升级 → 属性变化。
- 波次时间线、Boss 270 秒出现且仅出现一次、300 秒胜利边界。
- 玩家死亡优先于同一次模拟中的胜利。

### 12.3 浏览器测试

- Chrome、Edge 均能开始/暂停/重开、正常渲染、保持输入状态正确。
- 执行一局至少五分钟实际游戏（如 Boss 未被击败则继续）。
- 修改窗口尺寸、切换标签页、刷新和清空存档。
- 累积 100 个普通敌人的压力场景，记录 FPS、主线程耗时和潜在内存增长。

## 13. 发布与兼容

T021 必须运行构建并在部署后的静态页面上验证，不可只在 Vite 开发服务器中通过。静态托管平台选择由部署条件决定（例如 GitHub Pages），不依赖服务端 API。所有第三方资产需确认来源与使用许可。

## 14. 质量边界

- 核心规则由单一配置和系统管理，禁止到处散落重复常量。
- 系统之间保持单向依赖、避免循环导入。
- 测试缺失必须明确写“未验证”。
- 每个任务修改仅对应既定需求；需求变更先更新文档和记录。
- 当前实现状态以 `docs/task-status.md` 为准。T000–T021 均已完成：T005–T019 交付菜单、HUD、战斗、成长、武器、波次、Boss、胜败结算、代码像素视觉、基础事件音效和版本化本机进度；T020 完成回归与性能边界测量；T021 完成公开静态发布及托管页面验收。自然完整通关、真实 OS 级后台标签切换和整帧 FPS 仍按任务报告标记为未验证或已知限制。

## 15. V2 城区补给内容架构增量

- `mapConfig` 提供只读地图注册表；GameWorld 以菜单锁定所选配置，现有 Camera/坐标和敌人系统沿用相同 2400×1350 世界边界。城区绘制由 MapRenderer 处理，碰撞/寻路规则不变。
- SupplySystem 独立拥有站点时间线、道具实体、诱饵、临时射速和扫描器层数；使用隔离随机流。冻结快照由 GameWorld 组合到扩展快照，Canvas 扩展绘制，UIManager 只读显示。
- E 输入采用单次按下事件，固定步中玩家移动后部署/拾取；敌人 AI 可询问供给系统是否提供普通敌人诱饵目标，Boss 行为不变。
- ArcCoilSystem / RailgunSystem 各自持有冷却和有界短时光束；通过 EnemyDamageSystem 造成伤害，GameWorld 仍统一结算死亡、击杀与经验。UP-07/08 等级经 UpgradeEffectSystem 快照提供，UP-01 对所有武器生效，UP-02 仍限脉冲枪。
- CanvasRenderer 保留原渲染参数，在末尾接收可选扩展快照；DOM HUD 控件为可选查询，以兼容既有无扩展数据的消费者。
- V2 不更改 localStorage schema、关卡长度、地图边界、世界实体上限或应用状态机；重开清除 SupplySystem 与两新武器的战局状态，地图选择仅在页面运行期间保留。
- T029 视觉/音频反馈仍归表现层：MapRenderer 绘制静态、确定性的非碰撞城区与实验室陈设；PlayerRenderer 根据玩家武器状态显示模块，不影响战斗状态；EnemyDamageSystem 仅发出已接受命中的只读通知，GameWorld 按模拟时间节流后转为 `weapon-hit` 语义声音事件，AudioManager 继续负责短音合成与总声部上限。

增量规格与验收见 `docs/superpowers/specs/2026-10-13-v2-city-supply-content-design.md`；T022–T028 实施任务见对应计划及 `docs/task-report-V2-content-pack.md`。

### T030 武器显示朝向修复

WeaponSystem 与 RailgunSystem 在真实开火时写入所属 weaponState.aimAngle；PlayerRenderer 只读最近开火方向，未开火时回退角色朝向。Player.reset 重建武器状态；扩展武器 reset 清除 aimAngle。表现状态不参与选靶或伤害结算。

### T031 战斗反馈与中继站

RelaySystem 持有配置驱动的三个站点，GameWorld 在玩家移动后、敌人死亡收尾前推进。区域冲击经 EnemyDamageSystem 和既有死亡事件结算；切换地图设置启用状态，重开清空站点进度。扩展快照包含冻结站点及玩家位置，渲染器与 HUD 只读。

有效伤害设置 hitFlashRemaining，真实开火设置 fireFlashRemaining，均在 PLAYING 固定步衰减；Boss 快照转发闪光状态。AudioManager 对声部维护优先级与包络引用，在容量耗尽时仅抢占较低优先级节点并释放；声音失败不阻断模拟。MapRenderer 对重复陈设做视口剔除。
