# 游戏系统架构设计说明书（SDD）

| 元数据 | 内容 |
|---|---|
| 文档编号 | PZ-SDD-001 |
| 项目 | Protocol Zero / 零号协议：失控之城 |
| 版本 | 1.0 |
| 依赖 | `docs/requirements.md` PZ-SRS-001 |
| 状态 | T000 审查完成；T002 主循环、时钟、三态状态机和最小 GameWorld 已实现 |

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
Startup + Config + Asset Loader
       |
Game [GameLoop, GameClock, GameStateManager, GameWorld]
       |
+------+---------+-------------+-----------+
| PlayerSystem   | EnemySystem  | BossSystem|
| SpawnSystem    | WeaponSystem | DamageSys |
| ProjectileSys  | CollisionSys | ExpSys    |
| UpgradeSystem  | WaveSystem   | Cleanups  |
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
- 加载配置、像素素材、音频（可降级）。
- 初始化输入、游戏控制器与事件系统。
- 准备异常兜底（资源加载失败、浏览器不支持相关能力）。

### 2.2 核心层

- `Game`：单次应用生命周期、控制器装配、状态切换入口。
- `GameLoop`：以 `requestAnimationFrame` 驱动画面，用固定时间步长推进模拟。
- `GameClock`：战局有效时间，与网页真实时间分离。
- `GameStateManager`：管理 BOOT、MENU、PLAYING、LEVEL_UP、PAUSED、VICTORY、DEFEAT。
- `GameWorld`：当前局实体集合、战局状态及一次性事件标记。

### 2.3 战斗与成长系统

- 玩家移动；敌人 AI；波次生成；Boss 行为；武器攻击；投射物；碰撞；伤害；经验；升级；清理。
- 状态更新由统一的游戏模拟循环调度。
- 系统之间通过有限公共接口或结构化事件交互，避免到处修改对方的内部字段。

### 2.4 表现与服务层

- `CanvasRenderer` 按图层绘制地图 → 敌人 → 掉落物 → 子弹 → 玩家 → 特效。
- `Camera` 世界/屏幕坐标转换、居中跟随、地图边界约束。
- `UIManager` 管理主菜单、HUD、暂停、升级、结算 UI。
- `AudioManager` 管理事件音效、背景音乐、静音与音量。
- `StorageService` 读取/保存本地成绩和设置；失败时自动回退默认值。

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
├── public/
│   ├── sprites/
│   ├── tiles/
│   ├── audio/
│   └── ui/
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── Game.js
│   │   ├── GameLoop.js
│   │   ├── GameClock.js
│   │   ├── GameStateManager.js
│   │   └── GameWorld.js
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── Boss.js
│   │   ├── Projectile.js
│   │   └── ExperienceOrb.js
│   ├── systems/
│   │   ├── PlayerSystem.js
│   │   ├── EnemySystem.js
│   │   ├── SpawnSystem.js
│   │   ├── WeaponSystem.js
│   │   ├── CollisionSystem.js
│   │   ├── DamageSystem.js
│   │   ├── ExperienceSystem.js
│   │   ├── UpgradeSystem.js
│   │   └── WaveSystem.js
│   ├── weapons/
│   │   ├── PulseGun.js
│   │   └── OrbitalBlade.js
│   ├── rendering/
│   │   ├── CanvasRenderer.js
│   │   ├── Camera.js
│   │   └── ParticleSystem.js
│   ├── ui/
│   │   ├── UIManager.js
│   │   └── screens/
│   ├── services/
│   │   ├── AudioManager.js
│   │   ├── StorageService.js
│   │   └── ResourceManager.js
│   ├── config/
│   │   ├── gameConfig.js
│   │   ├── playerConfig.js
│   │   ├── enemyConfig.js
│   │   ├── weaponConfig.js
│   │   ├── upgradeConfig.js
│   │   └── waveConfig.js
│   └── utils/
├── tests/
│   ├── unit/
│   └── integration/
├── index.html
└── package.json
```

**注意：** 上面是按任务逐步建立的目标目录；当前已建立 T001 工程骨架和 T002 `src/core/` 基础模块，其余模块在对应任务中按需创建，不要求提前建立空文件。

## 4. 状态机与游戏生命周期

```text
BOOT --> MENU --> PLAYING --> LEVEL_UP --> PLAYING
                   |  ^          |
                   v  |          +-- 选择升级完成 --> PLAYING
                 PAUSED
                   |
                   +---- 继续 --> PLAYING
PLAYING --> VICTORY
PLAYING --> DEFEAT
VICTORY/DEFEAT --> MENU or NEW PLAYING
```

| 状态 | 更新模拟 | 接受移动 | UI 行为 |
|---|---|---|---|
| BOOT | 否 | 否 | 资源加载 |
| MENU | 否 | 否 | 开始、设置、帮助 |
| PLAYING | 是 | 是 | HUD / Esc 可暂停 |
| PAUSED | 否 | 否 | 继续、退出 |
| LEVEL_UP | 否 | 否 | 选择合法升级；Esc 不跳过 |
| VICTORY | 否 | 否 | 结算、重来、返回 |
| DEFEAT | 否 | 否 | 结算、重来、返回 |

T002 按任务范围先实现 `MENU`、`PLAYING`、`PAUSED` 三态；`LEVEL_UP`、`VICTORY`、`DEFEAT` 将由对应升级与结算任务接入。

约束：状态迁移应由单一管理器协调，不允许多个系统各自把游戏标记“结束”。死亡检查与胜利检查采用固定优先级：**死亡优先**。

## 5. 固定步长和更新时序

### 5.1 模拟时间

- 用 `requestAnimationFrame` 触发绘制。
- 采用固定模拟时间步长，设计值 `1/60 秒`；帧率变化时不会按渲染次数计算移动。
- 每帧最多执行 5 个固定模拟步（最多补算 `5/60` 秒）；超过上限时丢弃整步积压，仅保留不足一个固定步的余量，避免长时间卡顿后追赶墙钟时间。
- 窗口失焦或标签页隐藏时自动切入 `PAUSED`；恢复焦点不自动继续。进入或离开暂停状态时清空 accumulator，并重置上一帧时间戳，避免恢复后“瞬移”和集中生成事件。
- `GameClock` 只在 `PLAYING` 推进；武器冷却、Boss 计时、无敌倒计时等均基于逻辑时间。

### 5.2 每个模拟步的处理顺序（建议）

1. 收集当前输入并计算移动方向；
2. 更新玩家移动，施加地图边界；
3. 更新战斗时钟和波次状态；
4. 更新敌人追踪与 Boss 行为；
5. 更新武器目标搜索和冷却；
6. 更新投射物位置和生命期；
7. 运行碰撞检测，收集伤害事件；
8. 统一处理伤害、击杀及死亡标记；
9. 生成经验晶体并检查拾取；
10. 判断升级进入 LEVEL_UP；
11. 统一判断死亡/胜利并执行合法状态迁移；
12. 批量清理已失效对象。

**关键：** 当步骤 10 进入 `LEVEL_UP` 时，本次模拟完成已产生的事件结算，但不能继续执行下一模拟步。被暂停的攻击和敌人不能在升级面板后偷偷更新。出现同一模拟步内玩家与 Boss 均死亡时，步骤 11 先检查玩家死亡。

## 6. 核心数据设计

### 6.1 Player

```text
id, x, y, radius, hp, maxHp, moveSpeed,
level, exp, invulnerabilityRemaining,
weaponStates, upgradeLevels, alive
```

由 PlayerSystem 管理运动，DamageSystem 负责受伤与生命钳制，ExperienceSystem 负责经验。

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

### 6.4 ExperienceOrb

```text
id, x, y, expValue, pickupRadius, active
```

不能在掉落对象中直接实现等级界面或修改 DOM。

### 6.5 运行状态与配置

- 基础配置（玩家、武器、敌人、波次）只读共享。
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
- `SpawnSystem` 在普通敌人活跃数 `< 100` 时尝试视口外合法位置，失败时可延后生成，不得生成到玩家身上。
- 不要把敌人数量与游戏渲染帧数直接绑定。
- Boss 在 `GameClock >= 270s` 且 `bossSpawned = false` 时仅生成一次。
- Boss 冲锋：普通移动 → 预警（至少 0.7s）→ 冲锋 → 恢复 → 循环。危险方向/区域必须可辨识。
- 完成时间 `>= 300s` 且 `bossDefeated` 才允许胜利。

## 9. 地图与摄像机

- 世界逻辑尺寸 2400 × 1350，参考视口 1280 × 720。
- 地图碰撞按世界坐标和实体半径计算。
- Canvas 绘制将世界坐标换算为屏幕坐标；相机的实际屏幕位置可以插值以减少视觉抖动。
- 使用像素化贴图或最近邻放大，避免被浏览器模糊插值。
- 按真实设备 DPR 管理 Canvas 缩放，避免 CSS 尺寸与绘制尺寸不一致。
- 纯装饰图层不阻止运动；复杂障碍寻路推迟至后续版本。

## 10. 碰撞、特效和性能约束

| 碰撞对象 | 方法 | 处理 |
|---|---|---|
| 玩家/敌人 | 圆形碰撞 | 按受伤无敌时间扣血 |
| 子弹/敌人 | 圆形碰撞 | 生成伤害事件，命中后处理子弹 |
| 轨道刃/敌人 | 圆形碰撞 | 独立每目标命中冷却 |
| 玩家/经验晶体 | 距离/半径 | 拾取经验，晶体失效 |
| 玩家/地图边界 | 半径约束 | 修正玩家位置 |

第一版可使用朴素碰撞检测。在高敌人数性能不达标时通过分析引入空间网格、对象池、视口外不绘制和生命周期管理，不提前为不存在的负载过度设计。

每帧必须清理已销毁子弹、死亡敌人、过期特效及拾取晶体。粒子效果须配置最大数量与寿命。性能数据必须实测，不可假称已经达到 60 FPS。

## 11. UI 通信与资源

**调用示例（概念流程）：** 战斗中获取经验 → ExperienceSystem 判断等级提升 → 申请 `LEVEL_UP` → UIManager 展示卡片 → 玩家选择 → UpgradeSystem 验证并应用 → 返回 `PLAYING`。

UI 不直接绕过升级系统修改玩家属性。菜单与 HUD 显示采用游戏状态快照或只读访问接口。

音效：用户交互后再启动音频上下文；资源缺失则静音降级，不阻断游戏。

本地储存建议带数据版本字段，仅保存最高击杀、最佳通关时间和音量偏好，不保存战局中途状态。读取失败使用安全默认值。

## 12. 测试设计

### 12.1 单元测试

- 向量归一化、世界/屏幕变换、圆形碰撞阈值。
- 生命值钳制、无敌时间、死亡幂等性。
- 经验阈值、多次连续升级、升级候选过滤/去重/满级。
- 自动目标选择及独立轨道刃命中冷却。
- 状态迁移、暂停时间冻结、胜败优先级、重开状态隔离。

### 12.2 集成测试

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
- 当前实现状态以 `docs/task-status.md` 为准。T002 只交付循环、时钟和 MENU/PLAYING/PAUSED 状态基础；玩家、地图、战斗、UI 等功能仍按开发计划逐项实现。
