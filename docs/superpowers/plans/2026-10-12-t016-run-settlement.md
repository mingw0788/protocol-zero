# T016 实施计划：终局胜败、结算与重开

> 目标是按 T016 规格完成胜败状态和回流，不触及 T017 美术、T018 音频、T019 持久化。

## 全局约束

- SRS §3.1 和 D-009 为规则权威：300 秒且 Boss 死亡才胜；300 秒 Boss 存活则继续；玩家 HP <= 0 失败且死亡优先。
- 仅以有效固定步时间判定；暂停、升级和终局不更新战局。
- 终局快照为 `{ outcome, killCount, elapsedSeconds }` 的冻结数据；该步时钟推进结束后记值。
- 不安装依赖，不改变已确认玩法；所有重开清理使用同一 GameWorld 持有关系。

## Task 1：终态模型与战局判定

- 修改 GameStateManager：增加 VICTORY / DEFEAT 和受控单向结算迁移；终态不能暂停、继续或再次结算。
- 修改 GameWorld：固定步末在时钟推进后先判玩家死亡，再判时间 >=300 且 Boss 已死亡；终态快照只建立一次；优先于 LEVEL_UP。
- 测试：状态迁移、早杀等待、300 秒边界、超时后击败、死亡优先、升级冲突、单次结算、终态更新冻结、终态快照冻结、重置清快照。
- 先写失败测试运行，再实现；聚焦测试通过后提交 `feat: add run victory and defeat states`。

## Task 2：Game 动作与终局 UI

- Game 增加终局快照读取、从终态重开和终态返回菜单动作；所有动作先校验当前状态。
- index.html 增加胜负结算面板；UIManager 只读快照显示标题/击杀/存活时间，接线按钮和键盘焦点；游戏渲染状态切换时显示/隐藏。
- 测试：有效/无效动作、按钮/焦点/快照/结果格式、菜单与终局可见性、清除上次状态。
- 按 TDD 聚焦验证并提交 `feat: add run result and restart UI`。

## Task 3：重开隔离、文档和交付验收

- 验证玩家等级/属性/血量、升级、脉冲枪与轨道刃、敌人/Boss/弹丸/经验、计时/击杀/死亡冻结/终局标记清空；运行期音效偏好、事件订阅保持；再次开始正常。
- 对齐 architecture / requirements / development-plan / decisions / task-status，写 `docs/task-report-T016.md` 和本计划状态。
- `npm test`、`npm run build`、`git diff --check`；浏览器受控场景覆盖边界胜利、失败、再来一局、返回菜单和控制台。
- 按代码审查技能获得独立只读审查，修正 Critical/Important 及可复现 Minor 后复验；交付提交 `docs: record T016 run settlement acceptance`。

## 需求映射

- FR-013 / SRS §3.1：Task 1 的胜败条件、死亡优先；Task 2 的结算、重开/回菜单。
- FR-014：Task 1 的终态无模拟更新，T002/T005/T011 既有冻结规则保持。
- FR-015：Task 2 结算读取真实击杀/存活时间快照。
- SRS §3.1 清局要求：Task 3 验证既有 reset 覆盖所有已建系统。

## 共享接口预检

- Task 1 产出 GameStateManager 终态和 GameWorld 冻结结果；Task 2 读取它们并只通过 Game 动作变更状态，接口保持单向。
- Task 2 的按钮动作调用 Game 的结果动作，不直接操作 GameWorld 或状态管理器。
- Task 3 不更改前两项运行时接口，仅验证 reset 并更新文档。
