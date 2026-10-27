# 参与贡献 IssueDock

IssueDock 是一个无后端、零运行时依赖的本地优先工具。贡献应优先保持数据可控、行为可验证和实现简单。

## 开始之前

- 小修复可以直接提交 Pull Request。
- 新功能、数据格式变更或明显改变交互的改动，请先开 Issue 说明使用场景、范围和取舍。
- 不要在 Issue、截图或备份文件里公开真实任务、凭据或其他敏感信息。
- 安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 本地运行

需要 Node.js 22 或更高版本。应用本身不需要安装依赖或编译。

```sh
python -m http.server 4173 --bind 127.0.0.1
```

打开 <http://127.0.0.1:4173>。也可以直接打开 `index.html`，但部分浏览器会对 `file://` 存储施加额外限制。

## 测试门槛

提交前至少运行：

```sh
npm run test:all
```

- `npm test`：检查 JavaScript 语法并运行核心数据、筛选、校验和导出测试。
- `npm run test:browser`：通过本机 Chrome、Edge 或 Chromium 验证真实交互、键盘操作、焦点、无障碍名称、文本安全、存储恢复和响应式布局。
- 浏览器测试会重新生成 `docs/screenshot.png`。若界面没有预期变化，不应提交截图差异。

浏览器不在常见路径时，可设置 `BROWSER_PATH`：

```powershell
$env:BROWSER_PATH = 'C:\path\to\chrome.exe'
npm run test:browser
```

## 设计约束

1. 保持无后端、无遥测、无外部 CDN 和零运行时依赖。
2. 不把用户文本作为 HTML 插入；新增渲染路径必须继续使用安全的 DOM 文本 API。
3. 修改备份格式时保留版本检查、大小限制、字段校验和向后兼容策略。
4. 优先使用平台原生能力，不为小功能引入框架或构建步骤。
5. 交互变化需要同时覆盖鼠标、键盘、焦点和 320px 窄屏。
6. 不制造虚假的使用量、贡献记录、Issue 或 Star；项目质量应来自可复查的实现和测试。

架构和数据契约见 [docs/architecture.md](docs/architecture.md)。

## Pull Request

Pull Request 应说明：

- 要解决的问题和选择该方案的原因；
- 用户可见行为的变化；
- 执行过的测试；
- 数据格式、隐私或兼容性影响；
- 仍然存在的限制。

请保持改动聚焦，避免把无关重构、格式化和功能更新混在同一提交中。维护者可以要求补充测试、拆分提交或更新文档。

## 许可证

提交贡献即表示你同意以项目的 [MIT License](LICENSE) 发布该贡献。
