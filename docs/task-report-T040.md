# T040 六武器与完整进化

- Task ID：T040
- 状态：完成（功能及列明验证范围）。
- 规格：docs/superpowers/specs/2026-10-14-t040-six-weapons-design.md
- Git Commit：见本任务交付提交。

## 实现与变更范围

增加冷凝喷射器、最多三架蜂群无人机；弧光线圈进化为末端电爆，磁轨炮进化为限频地面能量带，四种进化配方可见。

StatusEffectSystem 按来源管理强弱减速独立时长，EnemySystem/BossSystem 读取最强倍率；Boss 不冻结。CryoSystem 与 DroneSystem 独立推进，后者最多 24 弹。弧光电爆不递归，磁轨地带最多 2 条、逐敌共享冷却；原磁轨枪口余辉继续跟随武器。世界统一结算伤害/死亡并清理新系统；AdvancedWeaponRenderer 只消费快照。修改范围包括配置、武器/状态系统、世界、机体/攻击渲染、音效、HUD 和相应回归。

## 测试、审查与限制

- 系统用例先缺模块失败；新测试覆盖扇形伤害、最强减速/Boss、无人机数量/弹丸、一次电爆、伤害带冷却/寿命、真实升级、暂停/reset和扫描器条件。
- npm test：72 文件、520 项通过；npm run build：93 模块，JS 188.20 kB / gzip 53.23 kB；diff 检查通过。
- Edge 受控浏览器：3架无人机、1个喷射扇形、1次末端电爆、1条地带、实际减速0.55、伤害279.47184；pageerror 0，截图 output/playwright/t040-edge-six-weapons.png 已检查。夹具结束撤销。
- 扩大候选池后旧测试固定 RNG 范围不再指向原卡，调整选择输入并保留原战斗/reset断言。自然手感和 Chrome 综合验证留 T045。

无新增依赖或公开部署；受控夹具不代表真人自然试玩。下一任务：T041。