# T042 能源枢纽与电网监护者

- Task ID：T042
- 状态：完成（功能及列明验证范围）。
- 规格：docs/superpowers/specs/2026-10-14-t042-energy-hub-design.md
- Git Commit：见本任务交付提交。

## 实现与变更范围

新增第三张能源枢纽地图、三套同步布局、可永久断电的外围终端、中央反应堆补能冲击和两阶段电网监护者；保留中央安全环道及五分钟胜败条件。

energyMapConfig 统一提供每布局地标、终端、电弧、桶、事件锚点与中继。世界独立布局随机流在开局重抽，Game 同步MapRenderer；Exploration完成回调关闭指定区域。Relay支持配置站点和初始0能量，反应堆只冲击不治疗。GridBossSystem复用BossSystem实体/冲锋，额外管理有界电击预警和阶段；所有候选进入既有受伤批处理。切阶段取消旧冲锋、暂禁接触伤害而不重置HP。旧标准存档暂排除能源图，T044分配置记录。范围包含地图/危险/Boss配置、布局接口、世界/控制器、渲染/UI/帮助和回归。

## 测试、审查与限制

- 新用例先缺模块失败；切阶段旧冲锋方向残留用例先失败，再加入cancelAttack后通过。
- npm test：76文件535项通过；npm run build：97模块，JS203.82kB/gzip57.53kB；diff检查通过。
- 布局测试覆盖三套终端与安全环隔离、合法事件锚点、终端关闭、重开重抽、中央补能/不治疗；新Boss测试覆盖生命保留、安全切换/取消旧冲锋、预警/伤害以及270/300胜利条件。
- Edge受控浏览器选择能源图、终端完成并断电、半血进入阶段2且保留899HP/三圈预警，pageerror0；output/playwright/t042-edge-energy-center.png、t042-edge-energy-terminal.png、t042-edge-grid-guardian.png已检查。夹具调整时间/位置并单独演示Boss，不是自然通关。
- 自然地图路线、手感及综合性能留T045。

无新增依赖或公开部署；受控夹具不代表真人自然试玩。下一任务：T043。