# IssueDock

**把维护工作，理清楚。** 一个轻量、离线、无需账号的项目任务看板。

A small, local-first task board for independent maintainers. No backend, tracking, or runtime dependencies. Chinese interface.

![IssueDock 桌面看板，包含示例任务](docs/screenshot.png)

## 快速开始

下载本仓库，双击 `index.html`，即可在最新版 Chrome、Edge 或 Firefox 中使用。需要启用 JavaScript。点击“添加示例”可以体验看板；示例不会自动写入新用户的数据。

也可使用本机已有的静态服务器，例如 Python 3：

```sh
python -m http.server 4173 --bind 127.0.0.1
```

然后打开 <http://localhost:4173>。无需运行 `npm install`。应用不调用 GitHub API，不会自动同步 GitHub Issues。

## 能做什么

- 新建、编辑和删除任务，记录项目、描述与优先级。
- 按“待处理 / 进行中 / 已完成”整理工作，用下拉框切换状态。
- 按标题、项目、描述搜索，并组合项目和优先级筛选。
- 查看任务总数、进行中数量和完成率。
- 导出 JSON 备份并恢复，或导出按状态分组的 Markdown 清单。
- 响应式布局，支持键盘操作与表单标签；系统字体，无外部 CDN。

## 数据与隐私

数据仅保存在当前浏览器的 `localStorage`，键为 `issuedock.tasks.v1`。应用本身没有网络请求、分析脚本或遥测。任务文本按纯文本显示，不会作为 HTML 执行。

**请定期点击“备份 JSON”。** 浏览器清理、隐私窗口、磁盘故障或卸载浏览器都可能导致数据丢失。数据不会跨设备、浏览器或网址自动同步。通过 `file://` 打开的文件，其存储行为取决于浏览器；移动文件、改用静态服务器或更换端口前，请先备份再恢复。长期使用建议固定在同一个本地服务器地址。

恢复备份会在确认后替换当前全部任务，**不会合并**。最多 1000 项任务，备份最大 1 MiB（1,048,576 字节），总数据超限会拒绝保存。标题限 160 字符、项目 80 字符、描述 5000 字符。备份含任务的明文信息，请自行妥善保管。

读取失败时会暂停保存，避免覆盖无法解析的旧数据。此时请保留原始浏览器存储，并用已确认有效的备份恢复。多个标签页会监听存储更新，但本工具不提供多人协作或并发冲突合并；建议只在一个标签页编辑。

## 开发与测试

测试需要 Node.js 20 或更高版本，使用内置测试运行器，无需安装依赖：

```sh
npm test
```

核心逻辑测试覆盖备份往返、Unicode、组合筛选、重复 ID、非法枚举、容量限制及 Markdown 转义。

若本机已安装 Chrome / Edge / Chromium，也可运行 `npm run test:browser`，验证新增、编辑、状态切换、搜索、持久化、备份恢复、删除与窄屏布局，并生成 `docs/screenshot.png`。脚本自动识别常见 Windows / Linux 路径，其他位置可用环境变量 `BROWSER_PATH` 指定浏览器可执行文件。它使用独立临时浏览器配置，结束后清理，不读取日常浏览器数据。

```text
index.html           页面与任务编辑表单
styles.css           响应式样式
core.js              数据校验、筛选、备份、Markdown 导出
app.js               浏览器交互与本地持久化
tests/core.test.cjs   Node.js 核心逻辑测试
```

## 参与贡献

欢迎在 GitHub Issues 描述问题：浏览器版本、操作步骤、预期与实际结果。请移除备份中的个人或敏感信息。提交 PR 前运行 `npm test`，并在浏览器验证相关操作。

项目处于初始版本。未来可以根据真实反馈讨论到期日、标签和键盘快捷操作；这些功能尚未实现。欢迎小范围、可验证的改进。

## 许可证

[MIT](LICENSE) © 2026 strongnainai。
