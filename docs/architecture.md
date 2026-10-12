# 游戏系统架构设计说明书（SDD）

| 元数据 | 内容 |
|---|---|
| 文档编号 | PZ-SDD-001 |
| 项目 | Protocol Zero / 零号协议：失控之城 |
| 版本 | 1.0 |
| 依赖 | `docs/requirements.md` PZ-SRS-001 |
| 状态 | T000–T011 已完成；T012 实现六类升级实际效果 |

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
- `GameWorld`：当前局实体集合、战局时序及一次性事件标记；T007 编排接触碰撞/伤害，并发布每局一次的玩家死亡事件。
- `InputController`：收集 WASD/方向键输入；失焦、隐藏标签页或离开 PLAYING 时清除按键状态。
- `PlayerSystem`：在固定模拟步中读取移动向量并更新玩家实体。

### 2.3 战斗与成长系统

- 玩家移动；敌人 AI（T006 起使用独立 Enemy/EnemySystem）；波次生成；Boss 行为；武器攻击；投射物；碰撞；伤害；经验掉落/拾取；升级；清理。
- 状态更新由统一的游戏模拟循环调度。
- 系统之间通过有限公共接口或结构化事件交互，避免到处修改对方的内部字段。

### 2.4 表现与服务层

- `CanvasRenderer` 按图层绘制地图 → 经验晶体 → 子弹 → 敌人 → 玩家 → 特效；展示层只读战局实体。
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
│   ├── input/
│   │   └── InputController.js
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── Boss.js
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
│   │   └── WaveSystem.js
│   ├── weapons/
│   │   ├── PulseGun.js
│   │   └── OrbitalBlade.js
│   ├── rendering/
│   │   ├── CanvasRenderer.js
│   │   ├── Camera.js
│   │   ├── MapRenderer.js
│   │   ├── PlayerRenderer.js
│   │   ├── EnemyRenderer.js
│   │   ├── ProjectileRenderer.js
│   │   ├── ExperienceCrystalRenderer.js
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
│   │   ├── worldConfig.js
│   │   ├── playerConfig.js
│   │   ├── enemyConfig.js
│   │   ├── weaponConfig.js
│   │   ├── experienceConfig.js
│   │   ├── upgradeConfig.js
│   │   └── waveConfig.js
│   └── utils/
├── tests/
│   ├── unit/
│   └── integration/
├── index.html
└── package.json
```

**注意：** 上面是按任务逐步建立的目标目录；当前已建立 T001 工程骨架、T002 `src/core/`、T003 `src/config/` 和 `src/rendering/`、T004 `src/entities/`、`src/input/` 与 `src/systems/`、T005 `src/ui/UIManager.js` 中的实际模块。其余模块在对应任务中按需创建，不要求提前建立空文件。

## 4. 状态机与游戏生命周期

```text
BOOT --> MENU --> PLAYING --> LEVEL_UP --> PLAYING
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
| BOOT | 否 | 否 | 资源加载 |
| MENU | 否 | 否 | 开始、设置、帮助 |
| PLAYING | 是 | 是 | HUD / Esc 可暂停 |
| PAUSED | 否 | 否 | 继续、退出 |
| LEVEL_UP | 否 | 否 | 选择合法升级；Esc 不跳过 |
| VICTORY | 否 | 否 | 结算、重来、返回 |
| DEFEAT | 否 | 否 | 结算、重来、返回 |

T002 按任务范围先实现 `MENU`、`PLAYING`、`PAUSED` 三态；T005 加入 PAUSED → MENU，首次加载保持 MENU，开始新局和确认返回均先清理本局。取消返回确认保持 PAUSED；Esc 只切换 PLAYING/PAUSED，并忽略重复 keydown。T010 接入 `PLAYING → LEVEL_UP → PLAYING` 受控迁移；T011 提供选择界面。`VICTORY`、`DEFEAT` 仍由 T016 接入。

约束：状态迁移应由单一管理器协调，不允许多个系统各自把游戏标记“结束”。死亡检查与胜利检查采用固定优先级：**死亡优先**。

## 5. 固定步长和更新时序

### 5.1 模拟时间

- 用 `requestAnimationFrame` 触发绘制。
- 采用固定模拟时间步长，设计值 `1/60 秒`；帧率变化时不会按渲染次数计算移动。
- 每帧最多执行 5 个固定模拟步（最多补算 `5/60` 秒）；超过上限时丢弃整步积压，仅保留不足一个固定步的余量，避免长时间卡顿后追赶墙钟时间。
- 窗口失焦或标签页隐藏时自动切入 `PAUSED`；恢复焦点不自动继续。进入或离开暂停状态时清空 accumulator，并重置上一帧时间戳，避免恢复后“瞬移”和集中生成事件。
- `GameClock` 只在 `PLAYING` 推进；武器冷却、Boss 计时、无敌倒计时等均基于逻辑时间。

### 5.2 T007–T010 固定模拟步顺序

每个有效 `PLAYING` 步按以下顺序处理：

1. 若状态不是 `PLAYING` 或本局已死亡冻结，返回未更新；
2. `DamageSystem.update(deltaSeconds)` 递减玩家无敌余量并钳制到 0；
3. `PlayerSystem` 更新玩家，随后 Camera 跟随；
4. 结算已有敌人死亡并清理失效敌人；`SpawnSystem` 更新生成，`EnemySystem` 推进存活敌人；
5. `CollisionSystem` 检测圆形接触，`DamageSystem` 对最高一笔接触伤害结算一次；
6. `WeaponSystem` 发射弹丸，`ProjectileSystem` 推进弹丸并结算命中；
7. `GameWorld` 在敌人清理前结算本步死亡并同步发布死亡快照；
8. `ExperienceSystem` 更新晶体、拾取与寿命；只有存活玩家能拾取。有效模拟步内刚产生且已与玩家重叠的晶体可在本步拾取；
9. `LevelSystem` 根据本步拾取后的当前等级经验余量，扣除已满足阈值、递增等级并为每次升级建立待选项；
10. 推进 `GameClock` 和模拟步计数，确保触发等级或致死的固定步计入完整时间；
11. 若本步令玩家死亡，清除移动输入、锁定本局冻结并同步发布冻结 payload `{ elapsedSeconds }`；
12. 若本步新增待选升级且玩家存活，从 `PLAYING` 转入 `LEVEL_UP`。此后 GameLoop 停止本帧后续补算步并清空 accumulator。

菜单、暂停、升级选择和失焦自动暂停不推进战局寿命。T007 的死亡冻结不改变 `GameStateManager` 状态；当前仍为 `PLAYING`，正式 `DEFEAT` 转换由 T016 消费死亡事件接入。系统顺序须保持：T007 接触伤害、T008 投射物死亡通知、T009 晶体拾取、T010 阈值结算均在本步时钟推进前完成；时钟推进后先处理玩家死亡，再在玩家存活时进入 `LEVEL_UP`。冻结生效后不再更新任何系统。

## 6. 核心数据设计

### 6.1 Player

```text
id, x, y, radius, hp, maxHp, moveSpeed,
level, exp, invulnerabilityRemaining,
weaponStates, upgradeLevels, alive
```

由 PlayerSystem 管理运动，DamageSystem 负责受伤与生命钳制，ExperienceSystem 负责拾取并增加经验，LevelSystem 负责当前等级余量、阈值换算、等级递增和待选队列。

T005 已建立 `hp/maxHp`、`level`、`exp` 和独立的 `weaponStates` 运行数据，初值为 100/100、1、0 和 `pulse-gun`。T007 增加每局独立的 `alive`（初始 `true`）和 `invulnerabilityRemaining`（初始 0）；`Player.reset()` 恢复生命、存活状态、无敌余量和位置。`player.exp` 始终表示当前等级的余量；T010 的 LevelSystem 按 `6 + 4 × (level − 1)` 消费阈值，每跨一级增加一个待选升级。Player 保存等级与余量，LevelSystem 不修改全局配置。

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

**调用示例（概念流程）：** 战斗中获取经验 → ExperienceSystem 增加经验 → LevelSystem 结算阈值并申请 `LEVEL_UP` → UIManager 展示卡片 → 玩家选择 → UpgradeSystem 验证并应用 → 消费一项待选升级 → 队列清空后返回 `PLAYING`。

UI 不直接绕过升级系统修改玩家属性。菜单与 HUD 显示采用游戏状态快照或只读访问接口。

### 11.1 T005 已实现的菜单与 HUD 合约

- `GameWorld.getHudSnapshot()` 汇总真实 Player、GameClock 和本局击杀数，返回 `{ health: { current, max }, experience, level, pendingLevelUps, weaponIds, killCount, elapsedSeconds }`。快照、生命对象、武器 ID 数组均新建并冻结，不泄露实体引用。
- `GameWorld.recordKill()` 提供本局击杀累加入口；T008 负责在真实死亡结算时只调用一次。`GameWorld.reset()` 清理时钟、玩家、输入、击杀和模拟步数。
- `Game` 通过 `getHudSnapshot()` 提供读取，使用受状态约束的 `startGame/togglePause/returnToMenu` 接受界面操作。重复开始不能重置活动局。
- `UIManager` 管理 DOM 菜单、帮助、基础 HUD、暂停和原生返回确认对话框。开始/停止负责订阅及事件绑定/解除，不直接修改世界或玩家。
- `Game.attachUIManager()` 在应用启动前连接展示端口。每帧 Canvas 绘制后传入最新快照；状态迁移时同步切换界面和焦点。仅展示值变化时写入 DOM。
- HUD 只在 PLAYING 显示；经验数值表示当前等级余量，T010 的待选数通过只读快照提供给后续升级界面。主菜单、暂停和升级选择时不推进有效时间。
- `Game.soundEnabled` 默认开启，`toggleSound()` 更新本次页面运行期偏好，返回菜单保留偏好；T005 不创建音频上下文或写入存储。T018 接入音效，T019 接入持久化。

### 11.2 T006 敌人子系统

- `Enemy` 使用 EN-01 配置创建独立生命、速度、碰撞半径、接触伤害及经验数据；实例变化不得修改配置。
- `GameWorld` 通过注入的 Camera 获取真实逻辑视口；Camera 由 `Game` 创建并与 `CanvasRenderer` 共用，核心层不反向导入渲染模块。
- `SpawnSystem` 用有效模拟时间累计 1 秒生成名额，从视口四周视界外按可用边长度抽样；合法位置不足时跳过该名额，最大 16 次取样，禁止无界循环。生成服从 100 只普通敌人的活跃数量上限。
- `EnemySystem` 每步先在线性遍历中清理失效实体，再让存活敌人对玩家做归一化恒速追踪；最大 100 只使用朴素逐个更新。
- Camera 视口为玩家跟随相机现有的 `1280 × 720` 逻辑尺寸；生成留白、速度、半径及频率均配置化。波次曲线由 T014 替换基础常量。
- `EnemyRenderer` 只读普通敌人数组，在地图与玩家之间绘制 SRS 红色占位方块并裁剪于逻辑视口。

### 11.3 T007 玩家接触伤害与死亡事件

- `CollisionSystem` 只读当前玩家与敌人引用，按世界坐标与圆形半径检测重叠；只返回 `alive === true` 且 `hp > 0` 的接触敌人，不修改实体或阻挡移动。
- `DamageSystem` 从 `PLAYER_CONFIG.invulnerabilitySeconds` 读取 0.6 秒无敌时长；无敌时间按有效模拟步递减。多个敌人同一步接触时只应用最大 `contactDamage`，不相加、不受数组顺序影响。
- 接触伤害将玩家生命钳制到 `[0, maxHp]`；有效受击重置无敌时间。HP 首次归零时 `alive` 转为 `false`。
- 致死步先完成时钟和模拟步计数，再清空输入、冻结战局并同步触发 `GameWorld.subscribePlayerDeath(listener)`。事件 payload 为冻结对象 `{ elapsedSeconds }`；订阅函数返回取消订阅方法，注册不重放历史事件。
- `GameWorld.reset()` 恢复玩家数据、清理敌人和死亡冻结锁，但保留订阅关系，以供同一 `Game` 生命周期重开后继续接收下一局事件。T007 不增加 `DEFEAT` 状态或死亡 UI；现有 HUD 从真实 Player 状态读到 0，T016 接入正式结算。

### 11.4 T009 经验晶体子系统

- `ExperienceSystem` 在 `GameWorld` 构造时只注册一次 `subscribeEnemyDeath` 监听；依赖 T008 的 `deathProcessed` 保证单次死亡通知，不在每次重开时重复订阅或重放事件。
- 系统将冻结死亡快照复制成独立 `ExperienceCrystal`；`expDrop > 0` 时生成一枚，晶体位置和经验值分别取快照 `x/y` 与 `expDrop`。敌人清理不影响掉落。
- `GameWorld.experienceCrystals` 与系统共享同一数组。更新时执行圆形拾取、120 秒寿命递减和原位清理，避免替换共享数组引用；拾取先置 `active = false` 再增加 `player.exp`。
- 重置使旧晶体失效并清空数组，保留死亡事件订阅；晶体 ID 在 ExperienceSystem 生命周期内递增，避免跨局复用。
- T009 仅拾取并增加经验；T010 的 LevelSystem 处理阈值、等级和连续升级队列，并在待选数大于零时转入冻结的 `LEVEL_UP`。T011 展示合法选项并逐项消费队列。
- `ExperienceCrystalRenderer` 只读活动晶体，在逻辑视口内绘制琥珀色 8×8 占位方块。图层顺序为地图 → 晶体 → 弹丸 → 敌人 → 玩家；正式晶体素材留给 T017。

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
- T011 只记录升级等级和实现满血恢复；实际属性及脉冲枪修正由 T012 接入，轨道刃攻击由 T013 接入。

### 11.7 后续音效与本地存储

音效：用户交互后再启动音频上下文；资源缺失则静音降级，不阻断游戏。

本地储存建议带数据版本字段，仅保存最高击杀、最佳通关时间和音量偏好，不保存战局中途状态。读取失败使用安全默认值。

## 12. 测试设计

### 12.1 单元测试

- 向量归一化、世界/屏幕变换、圆形碰撞阈值。
- 圆形恰好相切/略微分离、不同半径、失效敌人过滤与检测纯度。
- 生命值钳制、无敌时间边界、多敌人取最大伤害和死亡幂等性。
- 经验阈值、多次连续升级、升级候选过滤/去重/满级。
- 自动目标选择及独立轨道刃命中冷却。
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
- 当前实现状态以 `docs/task-status.md` 为准。T005 已交付菜单、基础 HUD 和暂停/返回操作；敌人、战斗、成长、结算、音效与存储仍按开发计划逐项实现。
