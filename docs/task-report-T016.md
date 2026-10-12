# T016 交付报告：终局胜败、结算与重开

**日期：** 2026-10-12  
**状态：** 完成；自动化、生产构建、受控浏览器验收及独立只读审查通过  
**规格与计划：** `docs/superpowers/specs/2026-10-12-t016-run-settlement-design.md`、`docs/superpowers/plans/2026-10-12-t016-run-settlement.md`

## 交付范围

- `GameStateManager` 新增 `VICTORY`、`DEFEAT` 终态。只有有效 `PLAYING` 可以通过单次结算动作进入终态；终态不能暂停/恢复，通用状态迁移不能直接恢复 `PLAYING`。
- `GameWorld` 在致死固定步完成伤害、死亡结算和有效时钟推进后生成失败快照；玩家存活时，只有有效时间达到 300 秒且 Boss 明确死亡才生成胜利快照。早杀 Boss 会等待 300 秒，300 秒时 Boss 仍存活则继续战斗。
- 玩家死亡先于胜利与新升级选择处理。终局快照冻结 `{ outcome, killCount, elapsedSeconds }`，由真实战局数据生成且在终局冻结。
- 新增胜败结算对话框，显示击杀数和 `MM:SS` 有效存活时间，提供“再来一局”和“返回主菜单”。Tab/Shift+Tab 焦点限制在两个动作内；Esc 不会误退出结算。
- 重开和回菜单都复用既有 `GameWorld` 并先完整 reset，以保持 GameLoop 与系统共享对象引用一致。重置清空玩家/升级/武器、普通敌人与 Boss、投射物、经验晶体、冷却/计时、击杀、玩家死亡冻结和终局快照；事件订阅及运行期音效偏好保留。本地历史成绩由 T019 所有。

## 需求映射

- SRS §3.1 / FR-013：胜败条件、超时后继续战斗、死亡优先、结算数据、重开/回菜单 → `GameWorld` 步末判定、`GameStateManager` 终态、Game/UIManager 受控动作及结算快照。
- FR-014：终局不推进模拟；原暂停和升级冻结继续生效 → GameLoop/状态机更新门禁及测试。
- FR-015 / 结算展示需求：击杀数和存活时间来自同一冻结结果快照 → `getRunResultSnapshot()` 与 UIManager。
- D-037 记录清理决策：复用 GameWorld 后完整 reset，避免替换仍被 GameLoop 和系统持有的共享对象。

## 自动化与构建

- `npm test`：**40 个测试文件、340 项通过**。覆盖合法和非法终态迁移、300 秒前击败 Boss 后等待、Boss 活过 300 秒后击败、边界胜利、同一步死亡优先、胜利压过新升级面板、终局快照冻结/只结算一次、终局模拟冻结、清局快照、完整升级后重开恢复、音效偏好保留及结算 UI/键盘焦点循环。
- `npm run build`：通过，Vite 转换 **52 个模块**。
- `git diff --check`：通过。未新增或安装依赖。

## 受控浏览器验收

- Windows Chromium 154，本地 Vite 页面加载标题菜单后点击“开始游戏”。使用临时、未提交的页面调试入口把有效时钟和 Boss 状态置于确定边界，杀死 Boss 并跨过 300 秒；实际显示 `VICTORY`、标题“任务完成”、击杀 1、存活时间 05:01。点击“再来一局”后结算关闭，HUD 恢复生命 100/100、等级 1、击杀 0、时间从 00:00 重新开始。
- 新局中把现存敌人置于玩家位置并将玩家生命设为 1，让正常接触伤害路径触发死亡。页面进入 `DEFEAT`，标题“任务失败”，显示击杀和 00:15 存活时间；点击“返回主菜单”回到 MENU，清局时钟为 0。
- 浏览器控制台错误 **0**、警告 **0**。终局截图位于忽略的 `.playwright-cli` 本地验收缓存。
- 胜利场景采用受控时钟/实体状态，不等同自然完整五分钟平衡试玩；自然长局、难度与性能记录保留给 T020。
- 临时调试入口已从 `src/main.js` 移除，未提交。

## 独立代码审查

- 初审无 Critical/Important 发现。Minor 指出通用 `transitionTo(PLAYING)` 可从终局绕过 reset。修复提交 `309b495` 禁止终态经通用迁移回到 PLAYING；仅 `Game.restartGame()` 在先执行 `GameWorld.reset()` 后可调用受控 `restartRun()`。
- 增加断言并确认修复前失败、修复后专项 8 项通过。独立复核确认原 Minor 关闭且无回归。

## 提交记录

- `5c50f10` `docs: specify T016 run settlement design`
- `73dc389` `docs: plan T016 run settlement implementation`
- `8f8a50d` `feat: add run victory and defeat states`
- `ae30e5f` `feat: add run result and restart UI`
- `d7720b9` `test: cover clean terminal run restart`
- `64fb1f7` `fix: contain keyboard focus in run results`
- `309b495` `fix: require reset before terminal run restart`
- 最终验收文档与项目状态同步在任务收尾提交中。
