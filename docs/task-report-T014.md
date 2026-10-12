# T014 交付报告：三类敌人与波次

**日期：** 2026-10-12  
**状态：** 完成；自动化、构建、受控浏览器验证和独立代码审查均通过  
**设计与计划：** `docs/superpowers/specs/2026-10-12-t014-wave-system-design.md`、`docs/superpowers/plans/2026-10-12-t014-wave-system.md`

## 完成范围

- 新增 EN-02 迅捷猎犬和 EN-03 重装机甲；保持 SRS 的生命、速度、接触伤害与经验值。补齐半径 12/22，配置橙色/灰蓝色占位方块。EN-01 原始数据、首秒生成、伤害、追踪与掉落规则保持不变。
- 新增无状态 `WaveSystem`，按 `GameClock` 有效时间返回冻结阶段快照。阶段边界仍是 60/120/180/240/270 秒；间隔、敌种权重集中在 `WAVE_CONFIG` 并按 D-035 作为可调首轮值。
- `SpawnSystem` 按正权重选种，使用所选半径检查地图边界、玩家分离和视口留白；保留每名额最多 16 次取样、普通敌人上限 100、上限时消耗名额不补发，以及升级随机流隔离。
- `GameWorld` 在 PLAYING 步中读取该步末端波次；菜单、暂停、升级选择、玩家死亡冻结和重开沿用单一有效时钟。Boss 类敌人不占普通敌人数，Boss 实体与行为仍归 T015。
- `EnemyRenderer` 已按实体尺寸和配置色呈现三种敌人，不新增波次 UI、依赖或玩法行为。

## 验证结果

- 全量自动化：`npm test`，**38 个测试文件、297 项通过**。包含审查发现的 60/120 秒边界回归：反复累加 `1/60` 秒在第 3600/7200 步准确切档，并断言边界步传给 SpawnSystem 的档位正确。
- 任务定向回归：敌人/生成/波次及战斗、经验、升级集成共 **12 个测试文件、116 项通过**。
- 生产构建：`npm run build` 通过，Vite 转换 **49 个模块**。
- 差异检查：`git diff --check` 通过；无项目依赖安装或新增。
- **浏览器：** Windows Chromium 154。实际页面标题菜单与“开始游戏”进入 HUD 正常。受控页面实例导入真实 WaveSystem、GameWorld、SpawnSystem 和 EnemyRenderer：相位在 0、59.999、60、120、180、240、270 秒分别为 opening、opening、swift-intro、heavy-intro、mixed-pressure、high-pressure、boss-approach；GameWorld 从 59.999 秒运行受控步后真实生成 EN-02（半径 12，`#ff944d`），独立 SpawnSystem 在 120 秒档真实生成 EN-03（半径 22，`#a9bacd`）。真实 Renderer 的 Canvas 像素计数为 EN-01 1024、EN-02 576、EN-03 1936，符合 32×32、24×24、44×44 方块。暂停时有效时钟/波次冻结，reset 回到 opening。浏览器控制台错误 0、警告 0。波次通过受控时钟进入，不能据此声称完成自然五分钟试玩；完整 Boss/战局验收仍归 T015/T016/T020。

## 独立代码审查

- 首轮只读审查范围：`059d0cd..9b92a0b`。无 Critical 或 Important 问题；发现一项 Minor：重复固定步浮点累加使 60/120 秒波次晚一帧切换。
- 修正提交 `58174fd` 为 GameClock 加入补偿求和并在 reset 清零补偿量。新增回归先按原代码复现两处失败，修正后通过；审查确认补偿公式、零步长和重置语义正确。
- `b999dea` 加强边界回归：同时断言边界步交给 SpawnSystem 的阶段和更新后快照一致。复审确认 Minor 已关闭，无剩余生产问题。
- 修复后全量测试 38 文件 / 297 项、生产构建 49 模块和差异检查均通过。

## 需求映射

- SRS §3.4、FR-005：三类敌人的已确认属性和直接追踪 → ENEMY_CONFIG、Enemy、EnemySystem。
- SRS §3.4/§3.9、FR-004：波次敌种/速率、普通敌人上限和生成 → WaveSystem、SpawnSystem、GameWorld。
- SRS §3.5：摄像机逻辑视口、敌人外缘留白、地图内安全生成与视觉差异 → SpawnSystem、EnemyRenderer。
- Boss 在 270 秒的生成/战斗不属于本任务，仍由 T015 接入；本任务的 270 秒及后续高压档供 Boss 阶段敌群使用。

## 交付提交

- `059d0cd` `docs: specify T014 enemy wave system`
- `2b5926f` `feat: add swift and heavy enemy types`
- `8d6cba6` `feat: add effective-time wave profiles`
- `c98968c` `feat: spawn weighted enemy waves`
- `5512846` `feat: connect wave profiles to game world`
- `9b92a0b` `test: verify heavy enemy spawn clearance`
- `58174fd` `fix: preserve exact wave boundaries across fixed steps`
- `b999dea` `test: assert wave profile passed at exact boundary`
- 最终审查和验收记录以单独提交交付。
