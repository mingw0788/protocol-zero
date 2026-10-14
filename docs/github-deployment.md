# GitHub 发布说明

## 仓库与访问地址

- 私有源码：<https://github.com/mingw0788/protocol-zero>
- 公开发布产物：<https://github.com/mingw0788/protocol-zero-play>
- GitHub Pages：<https://mingw0788.github.io/protocol-zero-play/>

源码仓库保留项目代码、文档与 Git 历史；公开仓库只包含 `dist/` 中的生产文件、`.nojekyll` 与简短说明。没有上传依赖目录、测试日志、本地存档或源码历史。游戏无需后端。

## 更新方式

1. 在源码目录运行 `npm test`，再运行 `npm run build:github`。
2. 将源码提交推送到私有仓库的 `main`。
3. 在公开发布仓库的独立本地检出中，用最新 `dist/` 替换原有生产文件，保留 `.nojekyll` 与 README，提交到 `main`。确认目标是发布仓库后才清理过期文件，不在源码目录执行清理。
4. GitHub Pages 使用 `main` 分支根目录自动发布；等待 Pages 构建成功。
5. 检查在线页面和脚本/样式均返回成功，再检查开始游戏、技能、暂停和返回菜单。

`build:github` 指定 `/protocol-zero-play/` 路径前缀。仓库改名时必须同步更改此前缀和发布网址。`npm run build` 仍可构建供其他静态站点使用的版本。

## 浏览器存档

GitHub Pages 与原试玩站点的地址不同，浏览器不会自动迁移设置与成绩。需要保留历史成绩时，请在原站点导出档案，再在新站点导入；原 V1 档案兼容性以游戏现有校验为准。

公开站点提供试玩，不等于真人完整战役与主观音频验收已经通过。玩法验收边界继续以 T046 报告为准。
