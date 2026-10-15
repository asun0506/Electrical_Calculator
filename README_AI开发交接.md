# 电气工程师计算器：完整开发与 AI 协作交接

更新日期：2026-10-16。运行版本：v2.1.1（`index.html` 与 `package.json`）；在 v2.1.0 基线 `14febf3` 上汇总螺栓 Excel V3、四位有效数字与全离线 LaTeX 排版，详见 [CHANGELOG.md](CHANGELOG.md)。本文覆盖整个项目，不只是原理图；开发、架构和发布说明统一在此维护。实际提交与部署状态以 Git 记录及 Cloudflare 部署结果为准。

## 1. 接手前先知道这些

这是纯静态、离线优先的工程工具，使用原生 HTML/CSS/JavaScript，计算、编辑、保存和导出均在浏览器端执行。没有业务后端、账号系统、云端项目数据库或构建产物。用户双击 `index.html` 就能运行；旧入口 `Electrical_Calculator.html` 仅跳转到它。

Node.js、pnpm、Playwright 和开发依赖用于验证，不是用户运行条件。Python 脚本用于从受控模板或工作簿再生成底库，也不参与日常页面运行。不要把开发依赖误放入浏览器脚本，或为了新增模块改成依赖服务器才能启动的项目。

代码托管：[asun0506/Electrical_Calculator](https://github.com/asun0506/Electrical_Calculator)。既定发布方案是 GitHub `main` + Cloudflare Pages。推送成功只能证明代码已到 GitHub，不能替代 Cloudflare 部署成功和线上验证。

建议首次接手顺序：本文 → `index.html` → `js/app.js` → 目标模块及其数据文件 → 对应测试。不要为了一个局部问题先阅读所有大型底库或历史对话。

## 2. 目录和依赖地图

| 路径 | 职责与维护边界 |
| --- | --- |
| `index.html` | 唯一实际入口；用经典 `<script>` 显式装配依赖和模块，装配顺序也是运行依赖顺序 |
| `Electrical_Calculator.html` | 旧入口兼容跳转；不是另一套应用 |
| `css/styles.css` | 公共工程主题、表单、表格、导航、报告相关样式；部分复杂模块还有内部样式 |
| `js/app.js` | 注册、导航、模块切换、错误隔离、草稿生命周期；暴露 `ElectricalToolkit` 和 `ElUtil` |
| `js/safety.js` | HTML 转义、文件名、JSON 和图片输入边界；浏览器与 CommonJS 可共用 |
| `js/storage.js` | localStorage/IndexedDB 门面、可见错误、旧键读取迁移；浏览器与 CommonJS 可共用 |
| `js/drafts.js` | 每模块草稿、表单及模型快照、IndexedDB 与应急副本 |
| `js/chart.js` | 本地 SVG 图表 |
| `js/report-language.js` | 报告中固定模板文字的语言转换，不翻译插入的用户数据 |
| `js/calc-*.js` | 各模块 UI、业务计算、交互及导出；当前是否启用由入口决定 |
| `js/*-data.js`、`js/*-requirements.js` | 静态材料、估价、标准、DV、DFMEA、SOR 模板及需求底库 |
| `js/part-design-data.js` | 零件设计专题题录、产品类别和设计校核模板；同时供标准库及DVP使用 |
| `js/dvpr-merge.js` | DVP 同义项目合并纯函数；保留来源、不同条件、人工编辑与附件 |
| `js/rlc-core.js` | 直段电感、低频R/L网络等效、直流短路响应及电容储能的纯函数 |
| `js/schematic/` | 原理图模型、几何、路由纯函数层 |
| `js/vendor/` | 离线 XLSX、JSZip、docx-preview 与许可说明；不要手改压缩库 |
| `scripts/` | 测试调度、SOR 模板生成、内部 DV 数据生成 |
| `tests/` | 纯函数、存储、公式、导入安全、浏览器交互、报告与兼容性验证 |
| `tests/fixtures/formula-cases.json` | 公式回归输入和独立核验的预期结果 |
| `docs/` | 模板资产，以及 `superpowers/specs/`、`superpowers/plans/` 历史设计和实施计划 |
| `output/`、`tmp/` | 可能含已跟踪的样例/测试产物；不能把目录全部当成可随意清理的临时目录 |
| `package.json`、`pnpm-lock.yaml` | 开发依赖和可重复安装；不是前端构建配置 |

核心装配：安全 → 存储 → 框架 → 报告语言 → 草稿 → 图表 → 计算模块。数据文件应在使用它的模块前加载；IEC 基础查询在系统校核前；原理图是 model → geometry → routing → UI。XLSX、JSZip、docx-preview 的具体位置见入口。

## 3. 全部当前功能模块

以下 19 个模块是当前入口实际注册的导航功能。旧文件仍在目录不代表有独立导航入口。

| ID | 功能 | 首要源码/数据 | 接手重点 |
| --- | --- | --- | --- |
| `relay-fuse` | 电池包等效内阻、最大外短电流、继电器/保险丝保护曲线配合 | `js/calc-relay-fuse.js` | 多电阻段尺寸/定值、数量串并联、组合表达式、曲线和人工校核分析；JSON 与中英文 PDF |
| `conductor` | 电池包RLC校核（保留原电阻模块ID） | `js/calc-conductor.js`、`js/rlc-core.js` | 电阻网络/限值、直段电感及手动覆盖、RL短路响应、Y/寄生电容与接触路径能量；JSON schema 3兼容旧项目，中英文报告 |
| `precharge` | 预充电阻、时间常数、峰值电流及现有电阻校核 | `js/calc-precharge.js` | RC 模型、时间/目标比例输入、单位与边界 |
| `bend-radius` | 导线/线束折弯半径 | `js/calc-bend-radius.js` | 动态行、线束尺寸与系数；恢复草稿时重建行 |
| `tolerance` | 尺寸链、公差计算 | `js/calc-tolerance.js` | 增减环、正负方向、公差合成；不要与 IEC 层级校核的独立模型混用 |
| `bolt` | 螺栓扭矩 / 界面综合校核 | `js/calc-bolt-suite.js`、`js/bolt-torque-core.js` | 仅 Excel V3 摩擦/螺距方法；LaTeX 逐步过程，四位有效数字显示、完整精度计算；项目 schema 3，旧 K 算法/工程不迁移；图片、JSON、中英文 A4 报告 |
| `iec60664` | 电气间隙/爬电距离系统校核 | `js/calc-iec60664.js`、`js/calc-iec60664-system.js` | 标准数据内核 + 电芯/模组/PACK 层级；尺寸、图片、尺寸链、JSON、Word `.doc` 与 PDF |
| `oring` | O 形圈密封尺寸 | `js/calc-o-ring.js` | 密封尺寸及压缩/填充相关计算，输入有效性 |
| `snapfit` | 塑料卡扣 | `js/calc-snapfit.js` | 几何、材料与变形/受力条件，公式适用范围 |
| `harness-od` | 线束外径 | `js/calc-harness-od.js` | 导线类型、规格、数量、动态行与外径估算 |
| `busbar-temp` | RMS 电流、线径和汇流排瞬态温升整合 | `js/calc-busbar-temp.js`、`js/busbar-sample-data.js` | 同一电流–时间 Map、RMS/平均/峰值、Cu/Al 线径、温升、AWG；旧 RMS 草稿兼容 |
| `materials` | 材料数据库及用户编辑 | `js/calc-materials.js`、`js/materials-data.js` | 只读底库 + 用户覆盖/新增数据；筛选、编辑、中英文 Excel；重置查询不应删除用户材料 |
| `engineering-formulas` | 常见工程公式知识页 | `js/calc-engineering-formulas.js` | 数学、力学、电学、热学分页面，符号/单位/适用说明和相图示意 |
| `standards-library` | 动力电池与车辆电气标准库 | `js/calc-standards-library.js`、`js/standards-data.js`、`js/standards-dvpr-supplement.js` | 题录、摘要、标签、状态、组合筛选、历史版本和官方入口；包括 LV/USCAR |
| `part-estimator` | 汽车零件模块化估价 | `js/calc-part-estimator.js`、`js/estimator-data.js` | 项目/零件、材料/工序/包材、模板与排序；JSON/Excel、成本边界、历史数据归一化 |
| `dvpr` | DVP&R 验证计划、报告与零件设计指南 | `js/calc-dvpr.js`、`js/dvpr-data.js`、`js/dvpr-internal-data.js`、`js/part-design-data.js` | 产品/标准分类折叠、38类产品设计指南与关联验证项、附件、JSON、Excel/PDF；区分内部 DV 底库与公开标准来源 |
| `schematic` | 电气原理图生成器 | `js/calc-schematic.js`、`js/schematic/*.js` | 组件、连接器、器件、Pin、线路/分支、SVG/PDF/JSON；详见第 7 节 |
| `dfmea` | DFMEA 生成器 | `js/calc-dfmea.js`、`js/dfmea-data.js`、`js/dfmea-requirements.js`、`js/dfmea-template-data.js` | 系统与部件两级，子零件分析整合在部件行，筛选/编辑与原 Excel 模板导出 |
| `sor-generator` | SOR 原版 Word 模板生成器 | `js/calc-sor-generator.js`、`js/sor-template-data.js` | 模板字段、动态表格、图片/附件、JSON、保留原 OOXML 的 DOCX、A4 打印预览 |

`js/calc-rms-current.js` 是保留的旧模块文件，当前入口不加载。旧 `js/calc-bolt.js` 及综合模块的 K 算法已经按用户要求删除，不要恢复。`iec60664` 是有意的特例：基础模块先注册，系统模块通过 `replace: true` 替换导航呈现。

### 电气与机械计算的业务边界

- 导体与电池包电阻：温度修正后的电阻率参与 `R = ρ(T)L/A`，数量串联为 `nR`、并联为 `R/n`；复杂组合表达式要继续保持受限解析，不能引入 `eval`。理想外短电流为 `U/R`，零/负/无效电阻不能成为有效结果。
- 保护配合的厂家曲线和人工分析保留原始语义；不要恢复已移除的“自动匹配结论”，或把理想外短电流当成完整瞬态短路仿真。
- 预充：`τ = RC`，目标比例 `f` 的时间为 `-RC ln(1-f)`；`f = 1` 不是有限时间可达的有效输入。换算 µF、ms 等显示单位后再计算。
- RMS 整合页按 Map 的真实时间跨度积分，不假定首个时间为 0；重复时间、非有效数据、线径向上取整及零电流冷却需要保留既有行为。电流–时间曲线参考线显示 RMS 有效电流，平均电流仅保留在综合结果中；电流/温升图表名称可自定义并随通用表单草稿保存，留空使用默认名称。
- IEC 的每条尺寸链独立选择 `rss3`、`rss4`、`rss6` 或 `worst`；缺省 `rss3`，最小尺寸使用当前选中的公差。轮廓度/位置度与普通尺寸公差的折算规则不同，不能简单统一。三级校核项目 schema 为 1。
- 材料、密封、线束、卡扣、螺栓和估价的公式/经验参数各有适用条件。变更应给出单位、依据、边界和独立预期结果；不得只用新实现反推测试答案。
- 估价中的价格、用量、利用率、回收折价率和良率保留有效范围约束；金额与材料原始数据不因报告语言切换而改变。

## 4. 框架与扩展方式

全局 `ElectricalToolkit.register({ id, title, group, desc, render, ... })` 注册模块。`id` 必须唯一，`render(host)` 必须存在；重复 ID 默认报错。注册顺序和分组决定导航展示。只有明确替换旧呈现时才能使用 `replace: true`。

`ElectricalToolkit.get(id)` 查找模块，`list()` 返回注册表副本，`active()` 返回当前模块，`open(id)` 负责切换。当前页一次只渲染一个模块，因此每模块独立 DOM ID 是现有设计；不要在别的模块宿主外找控件或残留事件。

切换前框架保存并解绑旧草稿，清空内容，渲染新模块，恢复草稿并绑定后续保存；单模块渲染错误有局部提示。`load` 等待草稿缓存就绪再恢复上次打开的模块，历史 `rms-current` ID 映射到整合页。

新增模块的最小步骤：

1. 在 `js/` 新建经典脚本/IIFE 模块，注册稳定 ID；使用现有工程主题和明确的单位。
2. 在 `index.html` 中将所需数据/库放在模块前；若新增导航图标，可补充 `js/app.js` 的 `MODULE_ICONS`。
3. 简单固定表单可使用框架通用草稿；动态模型、图片和附件必须定义适当草稿钩子。
4. 按风险验证正常值、边界、旧草稿/JSON、切换/刷新及导出；新增测试加入 `scripts/run-tests.cjs` 对应组。
5. 更新本文模块表及用户说明。不把“文件已新增”误认为“已装配启用”。

不要把全局文档监听器反复绑定且永不清理；模块重渲染会替换 DOM，必须考虑重绑、委托、弹窗关闭和旧宿主失效。UI 状态不是业务模型，导出也不能依赖暂时浮窗中的未同步值。

## 5. 草稿、项目保存和兼容性

每模块草稿包包含 `form`、`model`、`tabs`、`details`。钩子签名：

| 钩子 | 含义 |
| --- | --- |
| `captureDraft(host)` | 返回可 JSON 序列化的模型；不要返回 DOM、循环引用或活的异步可变对象 |
| `restoreDraft(saved, host)` | 恢复模型并重建动态 UI；框架随后还会应用通用表单/界面状态 |
| `refreshDraft(host)` | 恢复后重算或刷新派生显示 |
| `resetDraft(host)` | 恢复当前模块默认模型；不要删除其他模块数据 |

草稿数据库为 IndexedDB `electrical-toolkit-drafts`、对象仓库 `drafts`；localStorage 应急键前缀为 `electrical_toolkit_draft_v1:`。记录时间戳单调递增，写入前脱离活模型。至少一种持久化成功才报告保存成功；失败需要明确提示并允许 JSON 备份。

导航状态键为 `electrical_toolkit_active_calculator_v1`。IEC、材料覆盖/新增、估价项目还可能有独立历史持久化；修改前先搜索目标模块存储键、`readWithLegacy` 和归一化路径，不要只改公共草稿。

`ElectricalStorage` 提供 `readText/writeText`、`readJson/writeJson`、`remove`、`keys`、`readWithLegacy`、`openObjectStore`。读写结果采用 `ok/value/error` 等字段，错误区分 quota、malformed、invalid、unavailable、migration。调用方必须处理失败，不能用空 catch 伪装成功。

用户数据属于当前浏览器和来源；本地文件、不同网站域名、不同浏览器间不自动同步。协同开发共享的是代码，不是用户工程数据。JSON 导出才是明确可搬移的工程备份。

字段扩展优先采取兼容默认值并由 `normalize` 补齐。不要无必要更换存储键、ID 或 schema；升级时保留旧字段和引用迁移测试。导入过程必须先完整解析/校验，再赋值和渲染；失败时保持当前工程不变。文件导入 schema 与草稿容器版本是不同概念。

## 6. 输入安全、底库和导出

用户名称、备注、JSON、表格粘贴及模板字段都属于不可信输入。使用 `ElectricalSafety.escapeHtml` 或 `ElUtil.escapeHtml` 插入 HTML/SVG；纯文字优先 `textContent`。JSON 使用 `ElectricalSafety.parseJson` 的大小、深度、数组及模块结构验证，禁止原型污染字段。公共默认 JSON 限制是 10 MiB、图片是 6 MiB；具体模块/路径可能有自己的限制，应核对实际调用。

图片校验接受受支持的栅格 Data URL，并验证 Base64/大小；不能因字符串以 `data:image/` 开头就允许任意内容。下载文件名使用 `safeFilename`。新增字段必须同步导入校验、归一化、草稿、JSON 和导出。

静态材料/工艺/验证底库与用户改动分开；修改底库时说明来源、单位、版本和适用条件。标准库保存题录及摘要，不复制受版权保护的标准正文。现有状态复核日期不能当作今天的最新标准状态；更新状态时核查发布机构受控信息，并保留历史版本语义。

导出约定：

- Excel 使用本地 XLSX 库；保留数字类型、合并单元格、表头、排序和原模板语义。DFMEA 模板与两级结构要一起维护。
- SOR 用 JSZip 修改嵌入 DOCX 的 OOXML，保留原样式、页眉页脚和媒体；`docx-preview` 是打印预览，不替代正式 Word 生成。目录占位字段 `f012`–`f018` 保持模板的目录更新流程。
- IEC 的 Word `.doc` 是既有报告路线，不可把扩展名改为 `.docx` 就声称是 OOXML。
- PDF 多数由浏览器打印页面/报告生成；检查纸张、分页、附图、颜色与图例。关闭“打印背景图形”时关键信息仍应可辨。
- 英文报告只翻译固定模板文字；用户名称、分析、图片、数值、原数据不全局替换。相关实现位于 `js/report-language.js` 和目标模块。

生成底库的脚本不是日常运行命令：`scripts/build_sor_template.py` 需要输入 DOCX 与 `lxml`；`scripts/build-dvpr-internal-data.py` 需要输入工作簿与 `openpyxl`。拿不到原始受控文件时不要编造或重建原始模板；先阅读脚本的参数及输出路径再执行。

估价底库 `window.PART_ESTIMATOR_DATA` 含 `materials / processes / packaging / processTemplates`，来源参考 `docs/超级估价模板_工序组合扩充版.xlsx`。页面单价、工时、折旧、人工、良率等调整仅写项目，不回写底库。新增模块继续使用独立 DOM ID 与本地工程主题，不引入 CDN、在线字体或构建依赖。

## 7. 原理图专题：模型和交互约定

原理图核心通过经典脚本暴露 `window.ElectricalSchematic.model/geometry/routing`，也可 CommonJS 导入供 Node 测试。UI 位于 `js/calc-schematic.js`。纯函数层接收显式状态；模型工厂使用显式 ID 源、时钟和可选网格元数据，避免隐藏的 DOM/全局项目依赖。

| 层 | 关键职责 |
| --- | --- |
| `model.js` | 工厂、常量、demo、normalize、历史 schema 迁移；当前 schema 为 11 |
| `geometry.js` | 纸张、旋转、组件最小尺寸、Pin 坐标/偏移、端点、网格、标题/记录框和图例位置 |
| `routing.js` | 正交路径、分支、跨线桥、标签位置、路径拆分、中间点绑定/同步、关联路径移动与中间点删除 |
| `calc-schematic.js` | 工作区、事件、浮窗、状态提交、SVG、打印、JSON 校验、撤销及 UI 同步 |

项目顶层是 `{schemaVersion, meta, components, connections, revisions}`。组件包括普通部件、独立 `device`、`junction`，连接器有 side/placed/pins，Pin 有 no/definition/function/offset 与可选双绞配对字段。内嵌器件位于组件 `devices`，不要与独立 device 组件混淆。

线路使用稳定 `id`、`from`、`targets[]`、`type/gauge/net/function`；每个 target 有稳定 ID、to 和 waypoints。端点引用形式为 `pin:<pinId>` 或 `device:<deviceId>:<portIndex>`。双绞线还使用 `pairFrom`、target 的 `pairTo`；线路类型包含 hv、hv-sense、lv、can、hvil、power12、ground。

分支关系由 `parentWireId/parentTargetId/parentJunctionId` 表达，waypoint 的 `junctionId` 绑定中间点。分支并非主线路的复制；编辑和删除要保持端点、父子关系、路径、双绞配对一致。旧 schema 的中间点模型有迁移逻辑，不能绕过 normalize。

已实现、必须保留的行为：

1. 单击线条打开属性浮窗，可编辑线路/线径/网络名/功能，与工作区同步；删除按钮需二次确认。
2. 线径可空，空值不显示“未填写”。`gaugeLabelPosition` 可为 start/end/both，缺省 start；多终点及双绞线应正确处理标签，空线径仍保留其他标签布局。
3. 单击双绞线打开浮窗，在浮窗内按按钮交换同一双绞对两条线的颜色顺序，保存 `colorOrderSwapped`。不能把单击直接变成颜色交换；绘制采用项目已实现的跨两线符号，本文不宣称经过标准认证。
4. 图例说明可编辑，`meta.legendLabels` 保存覆盖；允许空说明，并支持下方一行 `legendNote` 自定义备注。
5. 标题/更改记录框可移动和调整尺寸；字段为 titleBlockX/Y/W/H、revisionBlockX/Y/W/H。普通空部件最低宽 5 个网格、高 2 个网格，但实际 Pin/器件内容会抬高最小尺寸；独立器件/中间点另有最小尺寸。
6. 部件名放不下可在外侧下方显示；全局部件/Pin 字号分别由 `componentNameFontSize` 与 `pinNameFontSize` 控制。
7. 普通部件和独立器件的 Pin 可选中后沿当前显示边调整：左右边用上下键，上下边用左右键；普通步长为网格，Shift 为 1 单位。保存 Pin `offset`，经过旋转后按显示边约束；连线端点与导出同步移动。这是 Pin 位置调整，不是仅移动文字。
8. 单击中间点打开名称/颜色/X/Y 属性浮窗，工作区、浮窗、拖动、键盘移动双向同步。
9. 删除中间点需确认、可撤销；`routing.removeJunction` 返回新状态及删除线路数量。保留主线路，多终点主线只移除指向已删中间点的 target；移除关联支线/后代，并清理指向被删节点的其他线路引用，不能留下悬空 Pin 或误删整条主线。
10. 线路工作区留更多空间给起终点；中间点分支属性与对应连接行并排，不恢复为额外一行宽表单。

`draw()` 会处理组件尺寸、中间点绑定/waypoint 同步和 SVG 重绘。重绘替换 SVG 节点，应保留滚动和必要的选择状态。pointerdown 的默认行为抑制可能导致原生 click 不触发；已有“点击未拖动”的 pointerup 路径用于打开中间点浮窗，修改事件时必须覆盖点击与拖动两种情形。

撤销依赖规范化状态快照与去重，最多保留 60 条。DOM 选择、交互中状态、浮窗状态不等于项目模型；改动后检查保存、刷新、JSON 往返、SVG/PDF 与撤销都保留业务结果。

## 8. 测试与本地接手命令

从仓库根目录执行。开发使用支持当前依赖的现代 Node.js 和 pnpm；项目没有在 package.json 中锁定 Node/pnpm 版本，遇到差异应记录实际版本，不要声称仓库已经规定某个版本。

```sh
pnpm install --frozen-lockfile
pnpm test:syntax
pnpm test:unit
pnpm test:browser
# 全部组（syntax + unit + browser）
pnpm test
```

测试调度真相来源是 `scripts/run-tests.cjs`。语法检查跳过 vendor、node_modules、.git、.worktrees、output、tmp。没有应用 build 命令，不要把 `pnpm build` 当成必须步骤。

公式回归夹具 `tests/fixtures/formula-cases.json` 为 schema 1，每例记录 module、inputs、expected、absoluteTolerance、source、caseType；无效输入记录验证类别和提示片段。测试先独立复算，再以 file:// 打开页面验证，选择器集中在测试 adapters。可用 `node tests/formula-regression.cjs precharge` 只测预充页面，但夹具契约与独立复算仍检查全部案例。

既有显示精度容差：三位小数 0.0005、导体六位小数 0.0000005、公差四位小数 0.00005；夹具独立复算另按 1e-8。新增案例注明独立公式或标准表来源，不抄页面答案、不扩大容差掩盖差异。模型基线包括预充全充能量 CV²/2、汇流排恒流热平衡与零电流冷却、IEC 本地 F.2/F.5/海拔表及向上取档约定；不是产品认证。

多数浏览器测试默认使用 Windows Chrome：`C:\Program Files\Google\Chrome\Application\chrome.exe`，支持 `CHROME_PATH`；多数测试支持 `PLAYWRIGHT_MODULE` 指向替代模块路径。公式测试可使用 Playwright 自带 Chromium，需要时执行 `pnpm exec playwright install chromium`。

PowerShell 指定浏览器示例：

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm test:browser
```

跨平台注意：`tests/dfmea-browser.cjs` 当前仍硬编码 Windows Chrome 路径，并不读取 CHROME_PATH。因此 Linux/macOS 助手不能仅设置环境变量就声称全量浏览器测试可运行；应记录限制或单独提交测试启动适配，不应在文档任务中偷偷修改业务代码。file:// 测试验证离线运行，不能只测 HTTP 服务。

| 改动领域 | 对应验证入口 |
| --- | --- |
| 安全与导入边界 | `tests/safety.cjs`、`tests/import-safety-browser.cjs`，后者使用共享 helpers |
| 存储、迁移和大附件 | `tests/storage.cjs`、`tests/drafts-and-report.cjs` |
| 计算公式 | `tests/formula-regression.cjs`、`tests/fixtures/formula-cases.json`，22 个独立核验案例；新增公式需扩展适当案例 |
| 电池包RLC | `tests/rlc-core.cjs`、`tests/rlc-browser.cjs`；另保留原conductor公式、报告及导入测试 |
| RMS/线径/温升 | `tests/busbar-merged.cjs`、`tests/busbar-chart-browser.cjs`（RMS 参考线、名称及草稿）与公式回归 |
| 螺栓综合与打印 | `tests/bolt-torque-core.cjs`、`tests/bolt-torque-browser.cjs`、`tests/bolt-suite.cjs`、`tests/bolt-print-layout.cjs` |
| LaTeX 与工程公式 | `js/math-render.js`、`css/math.css`、本地 `js/vendor/katex/`；`tests/math-render.cjs`、`tests/math-browser.cjs` 验证四位有效数字、安全渲染、全部 63 张公式卡和离线字体 |
| 标准库 | `tests/standards-data.cjs`、`tests/standards-library.cjs` |
| DVP&R | `tests/dvpr-browser.cjs`、`tests/dvpr-internal-database.cjs`、`tests/dvpr-design-guide.cjs`、`tests/part-design-data.cjs`、`tests/dvpr-merge.cjs`、`tests/dvpr-merge-browser.cjs` |
| DFMEA | `tests/dfmea.cjs`、`tests/dfmea-browser.cjs` |
| 英文报告 | `tests/english-reports.cjs` |
| 原理图纯模型/几何/路由 | `tests/schematic-core.cjs` |
| 原理图全流程与布局 | `tests/schematic-browser.cjs`、`tests/schematic-layout.cjs`、`tests/schematic-print-layout.cjs` |
| 原理图线条、图例、双绞颜色/标签 | `tests/schematic-wire-editor.cjs` |
| 原理图 Pin 与中间点、主线保护 | `tests/schematic-node-editor.cjs` |
| 测试调度范围 | `tests/test-runner.cjs` |

测试不等于完整工程认证；未在上表单列的模块也需要按实际改动做人工输入/单位/边界验证。报告改动应查看导出的布局，而不是只确认下载成功。

浏览器测试会生成/覆盖 `output/pdf/`、`tmp/pdfs/` 和 QA 图片，部分已被 Git 跟踪。测试前记录 `git status`，测试后只清理确认由本次测试生成的具体文件；保留已有用户改动，不使用目录级删除或 `git reset --hard`。

## 9. 多 AI 在 GitHub 协同开发

建议采用任务分支 + Pull Request。每个助手独立 clone/worktree，不共享同一个正在修改的工作目录；分支名可用 `codex/<任务名>` 或团队约定前缀。main 代表准备发布的共同基线。

每个任务在 Issue/PR 中写明：用户目标、验收行为、负责文件、数据兼容范围、公式/标准依据、测试结果与未验证限制。任务拆分优先按模块，公共文件 `index.html`、`js/app.js`、`css/styles.css`、公共安全/存储、测试调度和锁文件应协调一个负责人，减少多人同时覆盖。

协作流程：

1. 查看 `git status`、当前分支及最新 main；不把已有用户改动并入自己的提交。
2. 从最新基线建立任务分支。远端 PR 方式优先；直接推送 main 只在用户/团队明确采用该流程时执行。
3. 只修改任务所需模块；接口、字段、存储/导出格式改变时通知受影响任务并更新本文。
4. 完成适当验证；行为或数据变更需回归保护，公式和公共机制改动需要更广泛验证。纯文档改动核对路径、事实、命令和差异即可。
5. PR 说明问题、最终行为、验证及限制；处理审查反馈后集成，合并前核对最新 main 的冲突与关联变更。
6. 发布后核对 Cloudflare 部署和关键功能，不能将本地绿色测试当作线上已验证。

接手助手的完成说明至少包含：修改文件/功能、兼容性影响、执行过且实际通过的验证、提交/PR、是否已推送/部署。没有运行的测试不要写“通过”；不能使用本地未发布分支作为另一个助手的默认基线。

不可提交账号令牌、真实客户工程、私人附件或机器专属路径配置。第三方依赖许可保留在 `js/vendor/THIRD_PARTY_NOTICES.txt` 和相关许可证中；仓库 `private: true` 只是 npm 禁止发布标志，不表示 GitHub 仓库/网页中的底库是保密的。

## 10. 发布、历史文档和当前接手状态

既定 Cloudflare Pages 配置：Production branch `main`，Framework preset None，Build command 留空，Build output directory `.`，Root directory 仓库根目录。所有页面资源使用相对路径；改动 JS/CSS 时核对入口缓存版本参数及线上实际资源更新。新增目录发布前核查是否含不应公开的数据。

此配置为既定发布方案；仓库没有 `.github/` 工作流，本文没有核验 Cloudflare 账号实时设置或部署日志。若团队增加 CI，建议分别运行语法、unit、browser，并显式解决上述浏览器路径适配。

日常发布：本地修改 → 检查差异与敏感数据 → 运行适当测试 → 按获授权的分支/PR 流程提交并推送 → 查看 Cloudflare 部署结果 → 在正式网址复查导航、计算、图片及导入导出。首次连接仓库时使用上面的无构建配置。推送不等于已经部署成功。

打包或发布前保留完整目录结构与第三方许可证，核对入口引用资源存在，并验证 file:// 离线运行和所有导航。估价改动额外检查材料/工序/包材、模板、拖拽排序、清空确认与 JSON/Excel 往返。发布文件都可被访问者读取，不能包含密码、令牌、私人附件或机密底库。

产品版本更新时同步 `package.json`、`index.html`、README 和本文，并在 CHANGELOG 添加日期、功能及兼容性说明。资源缓存版本与 JSON schema 各有独立语义，不机械改为产品版本；版本标签更新本身不迁移存储键或重置草稿。2.1.1 螺栓模块单独规定旧 K 工程不迁移，详见该模块说明。pnpm 锁文件记录依赖而非根产品版本，依赖不变无需重写锁文件。

出现上线问题可在 Cloudflare 部署记录回退，代码侧通过有审查的修复或 revert 保持一致；不强推重写共享主分支。

已有文档：

- [螺栓扭矩校核模型说明](docs/螺栓扭矩校核模型说明.md)：用户 Excel 公式/单元格、默认参数、判定边界、原表差异、旧模型兼容和测试。

- [电池包RLC模型说明](docs/电池包RLC校核模型说明.md)：电感依据、网络/短路模型、单位、Y/寄生电容和单故障储能范围。

- [零件标准与设计指南维护说明](docs/零件标准与设计指南维护说明.md)：2026-10-13专题来源、适用范围、共享模型和DVP联动。

- [README](README.md)：使用、备份与文档入口，已合并原本地使用说明。
- [修改日志](CHANGELOG.md)：统一版本记录，保留原开发维护和早期架构审查的有效历史内容。
- 本文：唯一当前开发/架构/发布总说明；原四份重复说明已合并移除。历史 specs/plans 中的旧文件路径及 v2.0.0 是当时设计记录，不作为当前文档链接或修改依据。
- [基础加固设计](docs/superpowers/specs/2026-09-18-foundation-hardening-design.md)与[实施计划](docs/superpowers/plans/2026-09-18-foundation-hardening.md)：五项基础加固的背景及验收，不代表计划文件中的每句话都是当前代码。
- [原理图编辑设计](docs/superpowers/specs/2026-09-21-schematic-editing-design.md)与[实施计划](docs/superpowers/plans/2026-09-21-schematic-editing.md)：前一轮编辑功能设计；后续线径标签和 Pin/中间点改进见当前源码和测试。

v2.1.0 基线 `14febf3` 已包含 RMS 图表、标准/设计指南、DVP 去重、电池包 RLC 及文档整理；此前 `45f3e63`、`b7e8faf` 已完成 Pin/中间点编辑及主线保护。v2.1.1 汇总 Excel V3 螺栓校核、旧 K 算法移除、四位有效数字与离线 LaTeX 排版，详见修改日志。是否提交/推送以实际 Git 状态为准，不因文档写有版本号就视为线上已部署。接手不需要重做已完成的五项基础加固。

快速交给新助手的提示词：

> 请先阅读仓库根目录 README_AI开发交接.md，再查看 index.html 的当前装配和目标模块/测试。保持 file:// 离线运行、旧草稿/JSON 兼容、用户输入与报告原始数据。按任务分支和 PR 协作，保留已有改动。实施指定 Issue 后说明实际验证结果与发布状态，并同步受影响的文档。
