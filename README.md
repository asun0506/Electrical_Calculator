# 电气工程师计算器

纯静态、离线优先的电气与机械工程工具，包含 19 个计算、知识库及工程文档模块。无需后端或构建步骤，双击 `index.html` 即可使用；`Electrical_Calculator.html` 为兼容跳转入口。

## 开发接手

其他 AI 助手与开发者请先阅读 **[完整开发与 AI 协作交接文档](README_AI开发交接.md)**。其中包含全部模块地图、计算与数据约定、保存和导出机制、原理图架构、测试命令、多 AI GitHub 协作与发布流程。

- [本地使用说明](README_本地使用说明.txt)
- [开发维护与历史版本说明](README_开发维护说明.md)
- [网页发布维护说明](发布维护说明.md)

用户运行不需要 Node.js；开发验证使用 `pnpm install --frozen-lockfile` 与 `pnpm test`。浏览器测试有 Windows Chrome 路径条件，跨平台接手请查看交接文档的测试章节。

数据保存在用户自己的浏览器中，请通过模块的 JSON 导出功能备份和迁移工程。既定网页发布方式为 GitHub `main` + Cloudflare Pages。
