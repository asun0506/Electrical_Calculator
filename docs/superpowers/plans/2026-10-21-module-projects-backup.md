# 功能内多项目与本地备份 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各计算/校核/文档功能内部支持命名项目与隔离续做，整个浏览器工作区支持分层目录/ZIP 快照备份、校验、选择性恢复和回退。

**Architecture:** 保留现有经典脚本和模块注册方式，将功能项目、公共用户数据与旧草稿迁移收敛到独立工作区存储，通过明确的模块适配器管理初始化、捕获、校验和恢复。备份编解码不依赖 DOM，目录与 ZIP 共用一种快照格式；恢复先预检、暂存和创建恢复点，再提交一次工作区变更。

**Tech Stack:** 原生 JavaScript / HTML / CSS，IndexedDB + localStorage 应急副本，现有本地 JSZip，Web Crypto SHA-256，Node assert、Playwright。无新增产品运行依赖或构建步骤。

**Spec:** [2026-10-21-module-projects-backup-design.md](../specs/2026-10-21-module-projects-backup-design.md)

## Global Constraints

- 全局不增加业务项目，不改变现有单侧功能导航，不建立跨模块同名项目关联。
- 仍为纯静态、离线优先应用，无后端、账号、云同步或新增构建要求。
- 首版不做双向自动同步、后台自动覆盖本地文件、跨模块参数联动、工程参数自动纠错。
- 不更改既有计算方法，不恢复旧 K 算法。此次不自动升产品版本或推送 GitHub。
- 名称最多 120 个字符；空白名称不接受；名称可以重复，身份只依赖稳定 ID。
- 材料库、标准库、工程公式页保持查询页身份，不强加业务项目选择器；仍参与全量备份。
- 压缩文件 100 MiB、解压总量 200 MiB、最多 10000 文件、单 JSON 10 MiB；附件还受模块现有上限约束。
- 默认以副本恢复，新建项目 ID；替换必须明确选择目标、二次确认并先持久化恢复点。
- ZIP 发起下载不代表磁盘已写入；目录快照只有读回校验通过并写完完成标记才算成功。
- 保留现有 `.serena/project.yml` 修改；不纳入任务提交。执行阶段按 using-git-worktrees 建立隔离环境，不删除旧工作树。

## Review Focus

1. 多次快速切换、图片读取尚未完成：旧回调不得写入新项目，用户新编辑不能消失；任务 3、4 测试。
2. localStorage 与 IndexedDB 出现同 revision 不同内容：不能用时间或遍历顺序静默选赢者；任务 1、2 测试冲突提示与隔离保留。
3. Windows 重名、保留名、Unicode 规范化、ZIP 原始路径被库清理：不能覆盖目录或绕过路径检查；任务 5、6 测试。
4. 无障碍键盘操作和取消恢复：关闭弹窗后回到触发按钮，取消不能更改任何数据；任务 3、8 测试。
5. 备份后或恢复点后继续编辑：状态不得谎称最新已备份，回退不得直接覆盖后续编辑；任务 7、8 测试。

## 文件与职责

| 文件 | 职责 |
| --- | --- |
| 新增 `js/workspace-core.js` | 纯数据结构、项目操作、revision、恢复预案和校验，CommonJS/浏览器双入口 |
| 新增 `js/workspace-store.js` | IndexedDB 原子提交、localStorage 回退、启动协调、恢复点和冲突可见性 |
| 新增 `js/project-adapters.js` | 模块适配登记与公共数据白名单；不收集整站任意存储键 |
| 新增 `js/project-controller.js` | 当前编辑会话、可等待保存、项目切换、异步会话令牌 |
| 新增 `js/project-ui.js` | 功能内工具栏、项目管理弹窗和单项目导入/导出 |
| 新增 `js/backup-format.js` | 清单、SHA-256、资源拆分重建、安全路径及快照预检 |
| 新增 `js/backup-io.js` | 授权目录、目录读写与读回验证、ZIP 边界 |
| 新增 `js/backup-ui.js` | 备份状态、恢复预览、选择、确认、恢复点回退 |
| 修改 `js/app.js`、`js/drafts.js`、`js/storage.js` | 框架生命周期、兼容草稿 API、存储能力，不混入备份文件格式 |
| 修改 `js/calc-*.js` | 仅当前入口加载的模块适配默认/校验、异步隔离和报告标识 |
| 修改 `index.html`、`css/styles.css` | 显式装配、导航备份入口、工具栏/弹窗和打印隐藏 |
| 新增 `tests/workspace-*.cjs`、`tests/projects-*.cjs`、`tests/backup-*.cjs` | 纯函数、故障存储、模块隔离、完整备份与恢复回归 |
| 修改 `scripts/run-tests.cjs`、README、交接、CHANGELOG | 纳入验证和交付说明 |

## 共用接口契约

- `Result<T> = {ok:true,value:T} | {ok:false,error:{code,message}}`，业务可预期错误不空 catch，不返回伪成功。
- `DraftPayload = {form:Array, model:JSON|null, tabs:Array, details:Array}`，业务模型 schema 保留在 model 内。
- `ProjectRecord = {id,moduleId,name,createdAt,updatedAt,revision,appVersion,adapterVersion,payload}`。
- `WorkspaceState = {schemaVersion:1,id:'workspace',revision,commitId,projects:Array,active:Object,queries:Object,shared:Object,preserved:Array,migrations:Object}`。
- `Snapshot = {formatVersion:1,id,createdAt,appVersion,workspaceRevision,projects,queries,shared,preserved,browserUnsaved:boolean}`。
- ID/时钟通过工厂选项注入以便可重复测试；workspace revision 每次成功可见提交递增，单项目 revision 修改时递增，冲突以 expected revision 检查。

### Task 1: 可验证的项目工作区与原子持久化

**Files:** 新增 `js/workspace-core.js`、`js/workspace-store.js`、`tests/workspace-core.cjs`、`tests/workspace-store.cjs`；修改 `js/storage.js`、`scripts/run-tests.cjs`。

**Interfaces:**
- core：`createWorkspace()`、`validateWorkspace(value)`、`createProject(state,{moduleId,name,payload,appVersion,adapterVersion},{id,now})`、`updateProject(state,id,payload,expectedRevision,now)`、`renameProject(state,id,name,now)`、`removeProject(state,id)`；返回新状态，输入不变。
- store：`createWorkspaceStore(environment)` 返回 `ready:Promise<Result<WorkspaceState>>`、`read():WorkspaceState`、`commit(next,expectedRevision):Promise<Result<WorkspaceState>>`、`createRecoveryPoint(scope):Promise<Result<{id}>>`、`listRecoveryPoints()`、`readRecoveryPoint(id)`。

- [ ] 写 core 失败测试：`project_names_and_identity` 断言名称空/121 字符被拒绝、120 字符和同名允许；`isolated_payloads` 断言创建/复制深脱离；`revision_conflict` 断言旧 revision 修改失败；`cannot_remove_last_project` 断言不删除其他模块。
- [ ] 写 store 失败测试：`no_success_without_durable_write`，两个通道失败返回 false；`idb_success_local_quota`，大记录 IDB 成功可用；`atomic_batch_and_recovery_point`，写中断后旧工作区可读；`equal_revision_divergence`，两副本不一致需保留冲突记录而非自动覆盖。
- [ ] 运行 `node tests/workspace-core.cjs`、`node tests/workspace-store.cjs`，确认因缺失接口而失败。
- [ ] 实现 core 数据校验与纯操作。store 新建 `electrical-toolkit-workspaces` v1、对象仓库 `records`（keyPath `id`），workspace 整体为一条原子记录；事务内读取旧 revision 后再 put。恢复点为独立不可变记录，不嵌套进下一恢复点。
- [ ] localStorage 回退以唯一 commitId 数据键和单次 head 指针切换提交；先完整写入/验证数据，再改指针，保留上个成功 head。优先 IDB；协调两个来源时不以墙钟时间决定冲突。用浏览器锁与 revision 检查串行化写入，无法安全处理并发时拒绝覆盖并提供导出，不伪装具备事务保证。
- [ ] 运行上述两测试并加入 unit 组，断言全部 PASS；暂存本任务明确文件并提交 `feat: add isolated project workspace persistence`。

### Task 2: 旧数据迁移、查询状态和公共材料

**Files:** 新增 `js/project-adapters.js`、`tests/workspace-migration.cjs`；修改 `js/drafts.js`、`js/calc-materials.js`、`js/calc-part-estimator.js`、`js/calc-iec60664-system.js`、`js/calc-busbar-temp.js`、`scripts/run-tests.cjs`。

**Interfaces:**
- `ElectricalProjectAdapters.register(moduleId,adapter)`、`get(moduleId)`、`migrateLegacy({workspace,legacyDrafts,legacyValues,adapters}):Result<WorkspaceState>`。
- Adapter：`version:number`、`mode:'project'|'query'`、`initialize(host):void`、`validate(payload):Result<DraftPayload>`、`capture(host):DraftPayload`、`restore(payload,host):void`；模块可附加 `dispose()` 与 `reportName(name)`。
- 公共材料提供 `captureShared():JSON`、`validateShared(value):Result<JSON>`、`restoreShared(value):void`，只改变用户覆盖/新增和内存缓存，不改内置底库。
- `CalculatorDrafts.read(id)` 兼容返回活动项目/查询的 payload；旧草稿读取另暴露 `readLegacy(id)`，旧格式数据库不删除。

- [ ] 写 `legacy_migration_is_idempotent`，二次启动不重复创建；`singleton_differs_from_draft`，有效统一草稿与不同单例各保留一份；`failed_commit_keeps_legacy`，未成功持久化不写完成标记。
- [ ] 写 `future_or_invalid_legacy_is_preserved`，损坏内容、旧 K 模型隔离并可备份；`legacy_rms_routes_to_busbar`；`shared_materials_roundtrip`，新增/覆盖和编辑查询草稿均保留，恢复更新内存。
- [ ] 运行 `node tests/workspace-migration.cjs` 确认失败，再实现迁移；公共键白名单含 `matdb_override`、`matdb_custom`、活动模块显示设置和已核实历史业务键，不遍历输出无关站点键。
- [ ] 估价/IEC 在项目管理激活时停止业务编辑写单例旧键，保留独立运行旧路径；迁移时只读旧键。数据身份和版本校验不能仅依赖 normalize 后的结果。
- [ ] 运行迁移和已有 `node tests/storage.cjs`，新测试 PASS，旧存储契约仍通过；提交 `feat: preserve legacy drafts in module projects`。

### Task 3: 保存、切换与工具栏生命周期

**Files:** 新增 `js/project-controller.js`、`js/project-ui.js`、`tests/projects-browser.cjs`；修改 `js/app.js`、`index.html`、`css/styles.css`、`scripts/run-tests.cjs`。

**Interfaces:**
- controller：`open(moduleId,projectId?):Promise<Result<void>>`、`flush():Promise<Result<ProjectRecord>>`、`newProject(name)`、`copyProject(name)`、`renameProject(name)`、`deleteProject(id)`、`captureWorkspace():Promise<Result<Snapshot>>`。
- controller：`session():{moduleId,projectId,token}`、`isCurrent(token):boolean`；旧异步回调不得操作不匹配会话。
- `ElectricalToolkit.open(id)` 返回可等待 Promise；`ElectricalToolkit.flush()` 为统一入口，兼容调用方忽略返回值的普通导航点击。
- UI `mountProjectToolbar(container,controller)`、`dispose()`；保持 `.draft-toolbar [role=status]` 现有选择器兼容，不将工具栏自身表单计入业务 payload。

- [ ] 写 `save_before_project_or_module_switch`、`failed_save_blocks_switch`、`failed_restore_keeps_source`、`rapid_switch_latest_request`、`rename_copy_delete`、`keyboard_dialog_cancel_focus`；断言用户输入和原 active 指针不被失败操作改变。
- [ ] 运行 `node tests/projects-browser.cjs` 确认失败；实现可等待保存、切换排队和会话令牌。状态变化依据实际持久结果；切换前验证目标，在必要时回滚 UI；关闭旧观察器、定时器和弹窗。
- [ ] 新建使用适配器默认入口，复制深复制；query 模式不显示项目栏；reset 只作用当前项目并确认。对话框需 label、键盘取消、焦点约束与关闭焦点恢复，小屏换行不增加第二侧栏。
- [ ] `index.html` 按 storage→drafts→workspace→adapter/controller/UI、模块注册、load 恢复就绪的实际依赖装配，不让初始化抢在注册前执行。新增 UI 打印时隐藏。
- [ ] 运行 `node tests/projects-browser.cjs` 和 `node tests/drafts-and-report.cjs`。现有故障测试中“失败仍允许任意模块切换”的断言按已批准的阻止切换规则明确调整，不删除故障覆盖。加入 browser 组并提交 `feat: add per-module project switching`。

### Task 4: 全部模块默认模型、验证、异步编辑与报告适配

**Files:** 修改 `js/calc-relay-fuse.js`、`js/calc-conductor.js`、`js/calc-precharge.js`、`js/calc-bend-radius.js`、`js/calc-tolerance.js`、`js/calc-bolt-suite.js`、`js/calc-iec60664-system.js`、`js/calc-o-ring.js`、`js/calc-snapfit.js`、`js/calc-harness-od.js`、`js/calc-busbar-temp.js`、`js/calc-materials.js`、`js/calc-engineering-formulas.js`、`js/calc-standards-library.js`、`js/calc-part-estimator.js`、`js/calc-dvpr.js`、`js/calc-schematic.js`、`js/calc-dfmea.js`、`js/calc-sor-generator.js`、`js/project-adapters.js`、`js/app.js`；新增 `tests/projects-all-modules.cjs`。

**Interfaces:** 消费任务 2 Adapter 与任务 3 session 契约；每个模块明确登记 initialize/validate/capture/restore。简单固定表单复用受限验证，动态 model 必须业务校验。`ElUtil.projectFilename(baseName)` 为下载名追加活动功能项目名，不变更内容和扩展名。

- [ ] 写逐模块矩阵 `A_edit_B_default_A_restore_reload`：16 个 project 模块均测试；3 个 query 模块测试查询续做及无业务项目选择器。每个默认项目与干净浏览器同模块默认捕获值比较，排除随机 ID/日期后相等，不用编辑后的状态推导默认值。
- [ ] 增加 `model_not_lost_on_copy`、`dynamic_rows_and_units`、`old_async_attachment_cannot_enter_new_project`、`schematic_undo_is_project_local`、`report_file_identifies_current_project`。覆盖原理图 Pin/颜色/线径标签、螺栓附图、SOR/DVP 附件、DFMEA 行、估价工序、IEC 尺寸链和 RMS 图表名称。
- [ ] 运行 `node tests/projects-all-modules.cjs` 确认失败，随后逐模块实现：固定表单重建默认 DOM；动态状态先重置闭包/撤销栈再渲染；读取文件回调捕获 session token；所有项目导入在 validate 成功前不改变 live state。
- [ ] 对报告文件名统一调用项目名助手；打印页已有报告标题保留并显示活动功能项目标识，不在所有文本中盲目替换。数据 schema 保留原定义，不复活旧 K 算法。
- [ ] 运行矩阵及 `node tests/formula-regression.cjs`、`node tests/import-safety-browser.cjs`、`node tests/english-reports.cjs`，全部 PASS 后提交 `feat: adapt all calculators to independent projects`。

### Task 5: 安全、可搬移的快照文件格式

**Files:** 新增 `js/backup-format.js`、`tests/backup-format.cjs`；修改 `js/safety.js`、`scripts/run-tests.cjs`。

**Interfaces:** `ElectricalBackupFormat`（CommonJS 同导出）提供 `pack(snapshot,{digest,modules}):Promise<Result<{files:Map<string,Uint8Array>,manifest}>>`、`inspect(files,{digest,adapters}):Promise<Result<Inspection>>`、`safeRelativePath(path):boolean`。
- `Inspection = {manifest,validProjects,invalidProjects,queries,shared,preserved,warnings}`；清单/完成标记损坏是整体失败，独立项目损坏可作为 invalidProjects 展示但不可写入。
- `digest(bytes):Promise<string>` 使用 SHA-256 小写十六进制，浏览器用 Web Crypto、测试用 node:crypto；API 不存在时明确错误不换弱摘要。

- [ ] 写 `sha256_manifest_and_complete`、`attachment_dedup_and_roundtrip`、`truncated_and_changed_bytes`、`future_format_rejected`，断言恢复 payload 的 Data URL/文件内容与原值等价。
- [ ] 写 `reject_path_variants`：`../x`、`C:/x`、UNC、反斜杠、`.` 段、空段、重复路径、大小写/Unicode 规范化冲突；`windows_safe_names_keep_identity` 覆盖 CON、尾空格/点、同名项目。
- [ ] 运行 `node tests/backup-format.cjs` 确认失败，再实现 manifest.json、modules、shared、preserved、complete.json。资源只拆明确附件/图片字段，通过模块适配引用还原，不扫描任意字符串当文件路径。
- [ ] 外层清单、项目、公共数据逐个执行受限 JSON + 业务校验；未知模块保留隔离条目并警告，不作为有效项目加载。limits 固定为设计值，项目/清单/附件各自计算 UTF-8 和字节数。
- [ ] 运行格式测试及 `node tests/safety.cjs`，加入 unit 组并提交 `feat: define verified workspace backup snapshots`。

### Task 6: 目录映射、ZIP 与单项目文件传输

**Files:** 新增 `js/backup-io.js`、`tests/backup-io.cjs`、`tests/backup-zip.cjs`；修改 `js/project-ui.js`、`index.html`、`scripts/run-tests.cjs`。

**Interfaces:** `createBackupIO(environment)` 返回 `chooseDirectory():Promise<Result<{name}>>`、`directoryStatus()`、`writeDirectory(files,snapshotId):Promise<Result<{directoryName}>>`、`readDirectory(handle):Promise<Result<Map>>`、`createZip(files):Promise<Result<Blob>>`、`readZip(blob):Promise<Result<Map>>`。目录句柄单独存于 IDB 的设置记录，不导出进快照。
- 单项目导入/导出使用同一快照格式的 ZIP，只有当前模块一个项目；已有模块原生 JSON 续做入口保留，不把裸 JSON 改成假 ZIP。UI 标清“项目备份包”。

- [ ] 写 `permission_denied_or_revoked`、`write_or_close_fails_no_complete`、`readback_mismatch_no_complete`、`existing_snapshot_uses_new_id`、`old_directories_unchanged`。内存目录替身检查实际调用顺序、失败后无完成标记。
- [ ] 写 ZIP 测试：100 MiB 压缩大小、200 MiB 解压总量、10000 文件边界和超限；检查 JSZip 保留的原始输入路径，不能只检查库已清洗的路径；拒绝 symlink/目录伪装、重复条目与 CRC 错误。解压逐文件、累计计数，必要时主动中止而非先全量展开后才查限额。
- [ ] 运行 `node tests/backup-io.cjs`、`node tests/backup-zip.cjs` 确认失败。实现目录授权和 readwrite 权限复核；每次新子目录中数据写入→读回核验→manifest→最后 complete，不递归删失败目录。
- [ ] ZIP 使用已有本地 JSZip；移至需要的公共依赖位置且 SOR 继续正常；下载文案为“备份包已生成，请确认文件已保存”。目录不支持/权限失败始终有独立 ZIP 按钮。
- [ ] 运行两测试，加入 unit 组，提交 `feat: add local folder and zip backup transport`。

### Task 7: 全量备份控制与真实状态

**Files:** 新增 `js/backup-ui.js`、`tests/backup-browser.cjs`；修改 `js/project-controller.js`、`js/app.js`、`index.html`、`css/styles.css`、`scripts/run-tests.cjs`。

**Interfaces:** `ElectricalBackupUI.mount({controller,store,format,io,adapters})`；`captureWorkspace()` 在捕获当前编辑后返回冻结 Snapshot，包含尚未打开模块的已存项目和公共数据；失败 Result 不伪装空工作区。

- [ ] 写 `all_projects_including_unopened_modules`、`shared_query_and_preserved_data`、`unsaved_memory_export_after_storage_failure`、`edits_during_backup_remain_dirty`、`zip_download_not_disk_success`；注入延迟 digest/目录写入，在备份中间继续编辑并断言快照版本固定。
- [ ] 运行 `node tests/backup-browser.cjs` 确认失败，再实现导航入口和弹窗、目录状态、进度/取消、最后完整快照时间。捕获失败禁止完成状态，持久化失败但能完整捕获时附 browserUnsaved 警告并允许备份。
- [ ] 所有未打开模块已有数据直接来自 workspace，不通过循环 render 改变用户工作状态。成功后比较冻结 revision 与当前 revision；ZIP 下载不改成已验证磁盘备份状态。
- [ ] 运行备份 browser 测试，加入 browser 组，提交 `feat: add full workspace backup controls`。

### Task 8: 选择性恢复、替换事务和恢复点回退

**Files:** 修改 `js/workspace-core.js`、`js/workspace-store.js`、`js/backup-ui.js`、`js/project-controller.js`；新增 `tests/workspace-recovery.cjs`、`tests/backup-recovery-browser.cjs`；修改 `scripts/run-tests.cjs`。

**Interfaces:** core `planRestore(state,inspection,{projectIds,includeShared:false,mode:'copy'|'replace',targets},clock):Result<{next,affected}>`；store `restore(plan,expectedRevision):Promise<Result<{state,recoveryPointId}>>`、`rollback(pointId,expectedRevision):Promise<Result<WorkspaceState>>`。
- replace 的恢复点与工作区提交置于同一 IDB 事务；localStorage 路径先持久化恢复点和新 generation、再切换 head。失败保留旧 head，恢复后不能一部分项目先可见。回退时若 affected 项目在恢复后已变更，禁止直接覆盖，提供恢复点另存副本。

- [ ] 写 `copy_is_default_and_ids_new`、`replace_requires_mapping`、`cancel_has_no_writes`、`partial_restore_keeps_unselected_projects`、`public_data_opt_in`；不同功能同名不串目标。
- [ ] 写 `recovery_point_failure_blocks_replace`、`batch_failure_is_atomic`、`rollback_keeps_later_edits`、`bad_project_can_be_explicitly_skipped`、`future_version_no_mutation`、`restored_algorithm_version_requires_check`。
- [ ] 运行 `node tests/workspace-recovery.cjs`、`node tests/backup-recovery-browser.cjs` 确认失败，再实现预览选择、明确替换目标和二次确认、损坏项提示、恢复点列表与回退按钮。成功提交后刷新公共材料缓存、重挂当前编辑并按现有算法重算。
- [ ] 目录恢复支持选择一个快照；ZIP 同格式解析，单项目包限制当前功能或提示导航但不静默落入错模块。只还原有效受支持内容，未选/不存在于备份的项目不删除。
- [ ] 运行两测试，加进对应组并提交 `feat: restore verified backups with recovery points`。

### Task 9: 完整回归、真实目录核验与交付说明

**Files:** 修改 `README.md`、`README_AI开发交接.md`、`CHANGELOG.md`；必要时调整 `tests/drafts-and-report.cjs`、`tests/storage.cjs`、`scripts/run-tests.cjs` 的兼容断言；新增 `docs/workspace-backup-validation.md`。

**Interfaces:** 不新增运行接口；本任务按设计文档逐项验收，说明真实通过、失败与未验证项。

- [ ] 运行 `pnpm test:syntax`、`pnpm test:unit`、`pnpm test:browser`，逐条记录退出状态。旧公式 golden values 不随新实现重算更新；报告语义、原理图交互和离线字体都须保留。
- [ ] 在真实受支持浏览器执行：file:// 打开→两个功能各两项目→图片附件→选目录→备份→检查磁盘层级/完成文件→新浏览器工作区恢复→继续编辑；另测权限取消、重开后权限、缺附件/破坏摘要不覆盖正常项目。实际授权需要用户操作时明确列为待人工验证，不用内存模拟通过冒充真实权限通过。
- [ ] 检查窄屏与打印：无重复侧栏、工具栏不遮挡计算区、备份/项目弹窗键盘可操作，报告隐藏管理控件。浏览器控制台没有新增异常，离线不产生网络依赖。
- [ ] 更新说明：功能项目彼此独立、浏览器自动保存/目录备份/ZIP 下载三种状态区别、何时需要授权、备份内容/不含下载报告、受支持限制、选择性恢复和恢复点回退。CHANGELOG 放未发布节，不改 v2.1.1 产品版本。
- [ ] `git diff --check`，检查只包含任务文件、无用户私有项目/附件/本地目录句柄入库；提交 `docs: document module projects and backup recovery`。按 verification-before-completion 提供测试证据和真实目录核验情况，未经新指示不推送 GitHub。

## 自查与交接

设计 1–3 节由任务 3、4、7 覆盖；存储/生命周期和迁移由任务 1–4 覆盖；备份格式与失败处理由任务 5–7 覆盖；恢复与安全边界由任务 5、6、8 覆盖；完整验收由任务 9 覆盖。Review Focus 五项均已分配具体测试，无占位项。

本计划待用户审阅后执行。建议本会话原生执行：9 个任务依赖同一套存储、会话和模块适配接口，连续实现可降低上下文切换成本；如用户选择子代理执行，则使用相应逐任务实现/独立审查流程。
