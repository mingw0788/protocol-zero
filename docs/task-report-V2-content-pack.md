# T022–T028 · V2 城区补给内容包交付报告

**日期：** 2026-10-13  
**分支：** `codex/v2-city-content-pack`  
**规格：** `docs/superpowers/specs/2026-10-13-v2-city-supply-content-design.md`（用户逐节通过）  
**计划：** `docs/superpowers/plans/2026-10-13-v2-city-supply-content.md`

## 任务状态

- Task ID：T022–T028（V2 扩展任务组）
- 执行状态：实现与本地任务级验收完成。M3/M4 的自然升级组合比较和整局人工试玩仍未完成，不以本轮浏览器自动化代替。
- 玩法来源：严格依照用户批准规格。没有改动 V1 既有敌种、Boss、五分钟条件、玩家操作、存档 schema 或已有升级效果。

## 实现内容

- T022：增加实验室/东城区地图注册表、主菜单选图和城市道路绘制；两图沿用既有世界边界。
- T023：城区 45/135/225 秒站点、半径/蓄能/过期、物资胶囊、过载电池、E 诱饵、扫描器及独立随机流；暂停/升级/结算冻结并在 reset 清理。
- T024–T026：增加弧光线圈与磁轨炮，UP-07/08 合法解锁和强化、共享伤害、过载攻击频率、一次射击内目标去重及现有击杀/经验结算接线。
- T027：增加站点、进度、方向提示、三类胶囊、诱饵区域、两种武器光束、区域/道具 HUD、地图名称和帮助说明。
- T028：全量回归、生产构建、Chrome 本地浏览器检查、文档任务映射与独立代码审查。

## 需求到任务映射

| 用户批准需求 | 任务 | 代码/验证 |
|---|---|---|
| 两张地图与菜单路线选择 | T022 | mapConfig、Game/GameWorld、MapRenderer、UIManager；地图选择测试 |
| 补给计划、站内停留、物品寿命 | T023 | SupplySystem；时间/距离/冻结/过期测试 |
| 电池、诱饵、扫描器和 E 输入 | T023 | SupplySystem、InputController、EnemySystem、ExperienceSystem；输入及世界集成测试 |
| 弧光线圈和磁轨炮 | T024–T026 | ArcCoilSystem/RailgunSystem/weaponTargeting；伤害、目标、射线、跳链与冷却测试 |
| UP-07/08 和共享结算 | T024–T026 | upgradeConfig、UpgradeEffectSystem、GameWorld；合法卡片、解锁、单次击杀/经验集成测试 |
| Canvas、HUD、帮助、窄屏 | T027 | ExpansionRenderer、CanvasRenderer、UIManager、index/styles；renderer/UI 自动测试与浏览器检查 |
| 完整回归及交付记录 | T028 | 本报告及项目追踪文档 |

## 变更文件

- `src/config/mapConfig.js`、`supplyConfig.js`、`expansionWeaponConfig.js`、`upgradeConfig.js`
- `src/systems/SupplySystem.js`、`ArcCoilSystem.js`、`RailgunSystem.js`、`weaponTargeting.js` 及相关输入/伤害/经验/升级系统
- `src/core/Game.js`、`GameWorld.js`；`src/rendering/MapRenderer.js`、`CanvasRenderer.js`、`ExpansionRenderer.js`
- `src/ui/UIManager.js`、`src/styles.css`、`index.html`
- 自动化测试覆盖地图、补给、输入、两武器、世界接线、渲染和 UI；升级基准用例更新为八张候选卡。
- README 及 `docs/requirements.md`、`architecture.md`、`development-plan.md`、`task-status.md`、`decisions.md`。

## 自动化验证

- `npm test`：56 个测试文件、418 项通过。
- `npm run build`：成功，Vite 转换 68 个模块。
- `git diff --check`：通过。
- 不需要也没有新增依赖。

## 本地 Chrome 浏览器验证

- Playwright 打开 Vite 本地页面；初始主菜单、地图选单和开始按钮可见。
- 从菜单选择 east-city 并开始，看到正确地图名、初始 HUD、E 诱饵空槽；截图 `output/playwright/v2-city-playing.png`。
- 按 Esc 后进入暂停面板，再按 Esc 恢复；可见运行 HUD 与状态切换正常。
- 将浏览器窗口调整至 390×844，区域 HUD、战斗网格和控制仍在画布范围内；截图 `output/playwright/v2-city-narrow.png`。
- Playwright 收集的 Console Error 数为 0。
- 截图期间为短时真实运行；未等待 45 秒触发补给，也未声称通过整局自然战斗、道具拾取或新武器自然升级。相关精确效果由可重复自动化/受控 Game 集成测试验证。
- 本轮只检查 Chromium/Chrome 本地开发服务器；没有本地生产预览、Edge、新版线上站点、OS 级失焦、手工整局或整帧 FPS 验证。

## 代码审查与风险

- 独立只读审查复现 1 个 P2 胶囊显示缺陷：renderer 将过载电池类型写成 `battery`，但真实类型为 `overclock`。已统一样式键，并把 renderer 回归夹具改为真实值；修复后定向测试通过。其余新武器死亡结算/生命周期审查未发现明确可复现问题。
- 新实体受现有供给事件频率、单个站点、扫描器三层、单诱饵以及最多 3/5 武器命中配置约束；武器表现按短寿命线段保存。
- 配置数值属于规格批准的可调首轮值，当前无完整自然战局平衡结论。增加两张升级卡会稀释现有候选，须通过既有 M3 多组合自然试玩门禁进一步判断。
- 公开托管页面仍是已发布 V1.0.0；本地 V2 分支不代表已经发布。

## Git 提交

- `78b1df4` `feat: add T022 city map selection and V2 specification`
- `7997885` `feat: implement T023 city supplies and active decoys`
- `4b79461` `feat: add arc coil and railgun with upgrade integration`
- `73b103a` `feat: display city supplies and expansion weapon effects`
- 胶囊图标审查修复和回归测试由最终提交记录。
- 规格同步、任务状态和交付报告也由最终文档提交记录。

## 尚存验收项

- M3：自然实战中比较至少两种升级组合及新旧武器实际体验。
- M4：从菜单开始完整自然进行到胜利或失败，记录实际体验。
- 该 V2 本地分支未发布；既有 `v1.0.0` 标签/公开站点未改动。

下一步建议：在 Chrome/Edge 上进行可记录的自然战局平衡验收；有结论后再考虑调整已批准规格中的首轮平衡参数及安排 V2 发布。
