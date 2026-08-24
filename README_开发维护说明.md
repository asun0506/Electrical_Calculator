# 本地综合计算器开发维护说明

本工具是无后端、无构建步骤的静态 HTML 项目，可直接编辑后刷新浏览器验证。

## 入口与模块机制

- 网站入口：`index.html`
- 兼容入口：`Electrical_Calculator.html`（自动跳转至 `index.html`）
- 公共样式：`css/styles.css`
- 注册与导航框架：`js/app.js`
- 每个 `js/calc-*.js` 文件是独立子计算器，通过 `ElectricalToolkit.register()` 注册。
- 汽车零件估价模块：`js/calc-part-estimator.js`
- 估价底库：`js/estimator-data.js`
- Excel 离线导出组件：`js/vendor/xlsx.min.js`
- 估价底表参考：`docs/超级估价模板_工序组合扩充版.xlsx`

## 修改估价底库

`js/estimator-data.js` 暴露只读基础数据 `window.PART_ESTIMATOR_DATA`，其中包含：

- `materials`：原材料
- `processes`：工序
- `packaging`：包装
- `processTemplates`：标准工艺路线模板

网页中对单价、数量、工时、折旧、人工、良率等参数的修改只会写入项目数据，不会回写底库。

## 数据兼容与离线使用

- 项目存储键：`electrical_toolkit_part_estimator_v1`
- JSON 数据结构版本：`schemaVersion: 1`
- 所有依赖、底库和样式均为相对路径，禁止改成网络 CDN，否则会破坏纯离线使用。
- 如新增子计算器，在入口 HTML 中加入对应脚本标签即可；脚本加载顺序也是同一分组内的导航显示顺序。

## 发布检查

1. 保证 HTML 引用的 CSS、JS、图片、文档均存在。
2. 用浏览器直接以 `file://` 打开入口 HTML。
3. 验证所有导航项能切换。
4. 验证估价模块的材料/工序/包材添加、模板载入、拖拽排序、清空确认、JSON/Excel 导入导出。
5. 打包时保留完整目录结构和第三方许可证。

## 网页发布

本项目可通过 GitHub 与 Cloudflare Pages 自动发布，配置和日常流程见 `发布维护说明.md`。

## v1.3 工程化调整

- 框架会拒绝重复的计算器 ID，避免导航和模块路由相互覆盖。
- 单个模块渲染异常时显示局部错误信息，不再使整个工作区空白。
- 浏览器会记住上次打开的子计算器。
- 汽车零件估价导入时会补齐缺失字段和明细行 ID；成本计算会限制负数、利用率、回收折价率和良率的有效范围。
- 全站采用低圆角、低阴影、深蓝灰工程主题；导航使用本地单色线性 SVG 图标，不依赖彩色 Emoji、网络字体或在线图标库。
- v1.3.1 起，“继电器 / 保险丝匹配”归入“电气计算”，“塑料件估价”模块已移除。
