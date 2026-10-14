# T047 GitHub 部署报告

- Task ID：T047
- 执行状态：完成（2026-10-14，Asia/Shanghai）

## 实现内容

1. 在已登录的用户账号 `mingw0788` 创建私有源码仓库 `protocol-zero`，本地完整 Git 历史推送到远程 `main`。本地开发分支保留，新增 `origin` 指向该仓库。
2. 独立创建公开静态仓库 `protocol-zero-play`，仅上传 `index.html`、两份生产 JS/CSS、`.nojekyll` 和公开 README。没有向公开仓库提交源码、项目文档、开发历史、测试日志或依赖。
3. 增加 `npm run build:github`，指定 `/protocol-zero-play/` 发布路径。没有新增依赖或修改游戏规则。
4. GitHub Pages 使用 `main` 根目录发布，HTTPS 已启用。在线游戏：<https://mingw0788.github.io/protocol-zero-play/>。

## 变更文件

- `package.json`：GitHub 构建命令。
- `README.md`：最新访问地址、仓库地址与发布说明。
- `docs/github-deployment.md`：更新步骤、路径规则和存档迁移说明。
- `docs/task-status.md`、本报告：发布证据。
- 发布仓库：`.nojekyll`、`README.md`、`index.html`、`assets/index-meLer0n1.js`、`assets/index-DlTCjJsw.css`。

## 自动化验证

- `npm test`：83 个文件、583 项通过；2026-10-14 22:13:45 开始，12.24 秒。日志 `output/github-deployment-tests.log`。
- `npm run build:github`：111 模块构建成功；HTML 23.94 kB、CSS 15.32 kB、JS 255.01 kB。HTML 两个资源链接采用正确项目路径。
- GitHub 发布工作流 [38578939239](https://github.com/mingw0788/protocol-zero-play/actions/runs/38578939239)：构建和部署成功。
- Pages API：`status=built`、`https_enforced=true`、发布源 `main:/`。
- 在线首页、JS、CSS 均 HTTP 200；JS 255016 字节，CSS 15320 字节，与本地构建一致。
- 仓库 API 确认源码 `private=true`、默认分支 `main`；公开仓库根目录仅 `.nojekyll`、README、assets、index.html。

## 实际浏览器验证

Chrome 无窗口模式在真实 GitHub Pages 地址操作，未使用战斗状态注入或开发源码路由：

- 1440×900 / 640×360 菜单及开始按钮可用。
- 选择三关战役、困难、BASTION；地图锁定，开局装备栏显示 `BASTION · 困难 · 第 1/3 关`。
- Space 释放角色技能后进入冷却；Esc 暂停，间隔 700 ms 的进度值一致。
- 返回主菜单的确认操作成功；实验室、东城区、能源枢纽分别开局、键盘移动、暂停和返回通过。
- `pageErrors=[]`、`networkFailures=[]`。
- 日志与截图位于忽略目录 `output/playwright/github-deployed-check.log`、`github-deployed-menu.png`、`github-deployed-pause.png`、`github-deployed-small.png`。

## 审查与限制

- 确认公开仓库与源码仓库独立建库，公开提交没有携带开发 Git 历史；不包含凭据。
- 原 Sites 的 V1 地址保留，未覆盖。GitHub Pages 使用不同站点存储，旧站成绩不会自动迁移。
- 本次完成线上基本流程检查；T046 的真人自然完整战役与主观试听门槛仍未通过，本次部署不代替这些验收。
- GitHub 自带 Pages 工作流的运行环境提示没有导致任务失败；游戏运行不依赖服务端 Node。

## Git 提交

- `e43e397`：源码发布配置（基于 `8f374b9` / T046 游戏实现 `8234aa2`）。
- 发布仓库 `691e6fa`：已上线生产游戏文件。
- 本报告与 README 地址更新另行提交到源码仓库；最终哈希由本次交付消息/仓库历史确定。

## 后续建议

后续修改按 GitHub 发布说明重新构建并更新公开产物；当前停止，不额外扩展玩法。
