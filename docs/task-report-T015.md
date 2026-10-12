# T015 交付报告：机械暴君 T-01

**日期：** 2026-10-12  
**状态：** 自动化、生产构建与受控浏览器验收完成；独立只读审查待完成  
**设计与计划：** `docs/superpowers/specs/2026-10-12-t015-boss-system-design.md`、`docs/superpowers/plans/2026-10-12-t015-boss-system.md`

## 完成范围

- 新增集中冻结配置 `BOSS_CONFIG` 和 `BossSystem`。Boss 在有效步末时钟达到 270 秒时只生成一次；选择合法安全且尽可能远离玩家/视口的地图角点，不消费普通敌人或升级随机流。
- Boss 作为 `category: 'boss'` 的 Enemy 加入共享敌人数组。BossSystem 独占 Boss 追踪和攻击状态，EnemySystem 跳过 Boss；接触伤害、脉冲枪、轨道刃、统一击杀结算和敌人绘制均复用已有管线。
- 实现追踪、首次 2 秒等待、0.8 秒定向预警、420 世界像素/秒最多冲锋 0.6 秒、0.8 秒恢复及之后每 3.2 秒循环。方向和地图内预计终点在预警开始时锁定；固定步倒计时对完整配置时长使用浮点容差，避免累积误差添加额外一帧。
- GameWorld 提供冻结 Boss 快照，保留已击败 Boss 快照但不重生；死亡只计一次且 `expDrop: 0` 不生成晶体。重开清空 Boss 状态并允许新一局到 270 秒后重新生成一次。
- 新增 BossRenderer，将半透明预警通道裁剪在逻辑视口并绘制在 Boss 本体下方；新增可访问名称、当前/最大生命和语义进度条，仅在 Boss 存活且 PLAYING 时显示。
- T015 不添加胜利/失败状态和结算流程，保留给 T016。占位方块、通道与血条属于逻辑/信息层验收，正式像素美术与动画归 T017。

## 需求映射

- SRS §3.1/§3.4、FR-012：270 秒单次生成、1800 HP、追踪与蓄力冲锋、至少 0.7 秒可辨识预警、独立血条、可被击败且无经验掉落 → `BOSS_CONFIG`、`BossSystem`、共享 `Enemy` / `GameWorld` 战斗管线、`BossRenderer` 和 `UIManager`。
- SRS §3.1、FR-013：300 秒且 Boss 已死才胜利、继续战斗及死亡优先 → 未在 T015 实现，交给 T016。
- SRS §3.1/§3.2、FR-014：暂停、升级选择、玩家死亡冻结及重开复位 → GameWorld/BossSystem 有效模拟步和 reset。
- NFR-005/006/010：职责分离、集中可调参数、危险区域可读 → 独立 BossSystem、冻结快照、BossRenderer、可访问 Boss HUD。

## 自动化与构建

- `npm test`：**40 个测试文件、328 项通过**。新增测试覆盖配置校验、269.999/270 秒边界、确定性安全生成、行为阶段/冷却/地图边界、BossSystem 独占移动、真实脉冲枪与轨道刃命中、单次死亡/零经验、暂停/LEVEL_UP/死亡冻结、重开、随机流隔离、预警绘制与 HUD 生命周期。
- `npm run build`：通过，Vite 转换 **52 个模块**。
- `git diff --check`：通过。
- 未安装或新增依赖。

## 受控浏览器验收

- Windows Chromium 154，Vite 本地页实际加载，标题菜单可开局。为了不等待自然五分钟，受控页面把有效战局时钟设置为 269.999 秒；此时 Boss 快照为空。推进一个固定步后 Boss 出现，再将其置于玩家附近以观察真实战斗。
- 推进 120 个固定步后 Boss 进入 `telegraph`；实际脉冲枪命中将 HP 从 **1800 降至 1740**，HUD 同步显示 `1740 / 1800`。Canvas 截图显示 HUD、红色预警通道、Boss 方块和玩家对象；预警通道位于 Boss 本体下层。
- Esc 暂停后 Boss 血条隐藏、暂停面板显示；继续后 Boss 血条恢复。通过暂停菜单确认返回后，状态回到 MENU、Boss 快照为 `null`、有效时间为 0。
- 浏览器控制台错误 **0**、警告 **0**。
- 上述是受控时钟和实体位置的场景验证，不等同于自然运行完整五分钟战局，也未代替 T016/T020 的整局平衡、胜败及压力验证。验收使用的临时页面调试访问代码已移除，未纳入提交。

## 独立代码审查

- 状态：独立只读审查尚待执行；审查范围将覆盖 T015 从设计/计划到当前实现与本报告的变更。
- 最终结论与 Critical/Important/Minor 处理记录将在审查后补充。

## 已知限制与后续

- 1800 HP 为 SRS 固定值，其余 Boss 战斗数值是 D-036 首轮可调配置；胜负耗时及 Boss 与玩家升级的平衡需完整战局记录后，由 T020 评估。
- Boss 和特效仍使用基础 Canvas 方块/通道占位，T017 负责原创素材和动画。
- Boss 到场并不直接结束游戏；300 秒胜利、玩家死亡优先、结算数据和重新开始/回菜单由 T016 接入。

## T015 提交记录

- `18de7bb` `docs: specify T015 boss system design`
- `82c1103` `docs: plan T015 boss implementation`
- `7cc9800` `feat: add one-time boss spawn system`
- `f6b860b` `feat: add boss charge telegraph cycle`
- `c0f919c` `feat: integrate boss into combat world`
- `4b21e92` `feat: show boss telegraph and health bar`
- 最终验收提交与独立审查结论待追加。
