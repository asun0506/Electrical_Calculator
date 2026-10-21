/* One portable format for directory and ZIP backups. Hashes detect damage, not trust. */
(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./workspace-core.js'), require('./safety.js'));
  else window.ElectricalBackupFormat = factory(window.ElectricalWorkspaceCore, window.ElectricalSafety);
})(function (C, S) {
  'use strict';
  const LIMITS = Object.freeze({ compressed: 100 * 1024 * 1024, total: 200 * 1024 * 1024, files: 10000, json: 10 * 1024 * 1024 });
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  const canonical = path => path.normalize('NFC').toLowerCase();
  function safeRelativePath(path) {
    return typeof path === 'string' && !!path && path.length <= 1024 && !/[\\:\x00-\x1f\x7f]/.test(path)
      && !path.startsWith('/') && path.split('/').every(part => !!part && !['.', '..'].includes(part) && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
  }
  async function digest(bytes) {
    if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持 SHA-256 校验，请使用支持的浏览器');
    const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function dataBytes(url) {
    const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(url);
    if (!match || match[2].length % 4) throw new Error('附件 Data URL 无效');
    if (/^image\//i.test(match[1])) S.validateImageDataUrl(url);
    const binary = atob(match[2]);
    return { mime: match[1], bytes: Uint8Array.from(binary, char => char.charCodeAt(0)) };
  }
  function toDataUrl(bytes, mime) {
    if (!/^[\w.+/-]+$/.test(mime)) throw new Error('附件 MIME 无效');
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return 'data:' + mime + ';base64,' + btoa(binary);
  }
  function parse(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > LIMITS.json) throw new Error('JSON 文件大小超过 10 MiB');
    return S.parseJson(decoder.decode(bytes), { maxBytes: LIMITS.json, maxDepth: 40, maxArrayLength: 10000 });
  }
  function checkFileMap(files) {
    if (!(files instanceof Map) || files.size > LIMITS.files) throw new Error('备份文件数量超过限制');
    const paths = new Set(); let total = 0;
    for (const [path, bytes] of files) {
      const key = canonical(path);
      if (!safeRelativePath(path) || paths.has(key)) throw new Error('备份路径不安全或存在重名冲突：' + path);
      if (!(bytes instanceof Uint8Array)) throw new Error('备份文件内容无效');
      paths.add(key); total += bytes.byteLength;
      if (total > LIMITS.total) throw new Error('备份展开总大小超过 200 MiB');
    }
  }
  async function pack(snapshot, options = {}) {
    try {
      const hash = options.digest || digest;
      if (!C.validJSON(snapshot) || snapshot.formatVersion !== 1 || !C.idValid(snapshot.id) || !C.dateValid(snapshot.createdAt) || !Number.isSafeInteger(snapshot.workspaceRevision) || !Array.isArray(snapshot.projects) || !snapshot.projects.every(C.validateProject)
        || new Set(snapshot.projects.map(item => item.id)).size !== snapshot.projects.length || !snapshot.queries || !snapshot.shared || !Array.isArray(snapshot.preserved)) throw new Error('快照无效或备份版本不支持');
      const files = new Map(), manifest = { formatVersion: 1, snapshot: { id: snapshot.id, createdAt: snapshot.createdAt, appVersion: snapshot.appVersion, workspaceRevision: snapshot.workspaceRevision, browserUnsaved: !!snapshot.browserUnsaved }, files: [], projects: [], queries: [], shared: [], preserved: [] };
      async function put(path, bytes) {
        if (!safeRelativePath(path) || files.has(path)) throw new Error('备份路径重复或无效');
        files.set(path, bytes); manifest.files.push({ path, byteLength: bytes.byteLength, sha256: await hash(bytes) });
      }
      async function json(path, value) {
        const bytes = encoder.encode(JSON.stringify(value));
        if (bytes.byteLength > LIMITS.json) throw new Error(path + ' 超过单 JSON 10 MiB 限制，请拆分项目');
        await put(path, bytes);
      }
      for (const project of snapshot.projects) {
        const folder = `modules/${S.safeFilename(options.modules?.[project.moduleId] || project.moduleId)}__${project.moduleId}/${S.safeFilename(project.name)}__${project.id}`;
        const value = C.clone(project), knownUrls = new Map(), resources = [];
        async function split(node, key = '') {
          if (typeof node === 'string' && ['dataUrl', 'image'].includes(key) && /^data:/i.test(node)) {
            const { mime, bytes } = dataBytes(node), checksum = await hash(bytes);
            const path = folder + '/attachments/' + checksum + '.bin';
            if (!files.has(path)) await put(path, bytes);
            if (!resources.includes(path)) resources.push(path);
            const reference = { $backupResource: path, mime };
            knownUrls.set(node, reference); return reference;
          }
          if (Array.isArray(node)) return Promise.all(node.map(item => split(item)));
          if (node && typeof node === 'object') {
            const result = {};
            for (const [childKey, item] of Object.entries(node)) result[childKey] = await split(item, childKey);
            return result;
          }
          return node;
        }
        value.payload.model = await split(value.payload.model);
        value.payload.form.forEach(item => { if (knownUrls.has(item.value)) item.value = C.clone(knownUrls.get(item.value)); });
        const path = folder + '/project.json'; await json(path, value);
        manifest.projects.push({ id: project.id, moduleId: project.moduleId, name: project.name, path, resources, adapterVersion: project.adapterVersion, appVersion: project.appVersion });
      }
      for (const [moduleId, payload] of Object.entries(snapshot.queries)) {
        if (!C.idValid(moduleId) || !C.validatePayload(payload).ok) throw new Error('查询草稿无效');
        const path = `queries/${moduleId}.json`; await json(path, payload); manifest.queries.push({ moduleId, path });
      }
      for (const [kind, value] of Object.entries(snapshot.shared)) {
        if (!C.idValid(kind)) throw new Error('公共数据标识无效');
        const path = `shared/${kind}.json`; await json(path, value); manifest.shared.push({ kind, path });
      }
      for (const [index, value] of snapshot.preserved.entries()) {
        const path = `preserved/legacy-${index}.json`; await json(path, value); manifest.preserved.push({ path });
      }
      const manifestBytes = encoder.encode(JSON.stringify(manifest));
      if (manifestBytes.length > LIMITS.json) throw new Error('备份清单过大');
      files.set('manifest.json', manifestBytes);
      files.set('complete.json', encoder.encode(JSON.stringify({ formatVersion: 1, id: snapshot.id, manifestSha256: await hash(manifestBytes) })));
      checkFileMap(files);
      return C.ok({ files, manifest });
    } catch (error) { return C.fail(error.message, 'backup-format'); }
  }
  async function inspect(files, options = {}) {
    try {
      checkFileMap(files);
      const hash = options.digest || digest;
      if (!files.has('complete.json') || !files.has('manifest.json')) throw new Error('备份未完成或缺少清单');
      const complete = parse(files.get('complete.json')), manifest = parse(files.get('manifest.json'));
      if (complete.formatVersion !== 1 || manifest.formatVersion !== 1) throw new Error('备份版本不支持');
      if (await hash(files.get('manifest.json')) !== complete.manifestSha256 || complete.id !== manifest.snapshot?.id) throw new Error('备份清单校验失败');
      if (!C.idValid(manifest.snapshot.id) || !C.dateValid(manifest.snapshot.createdAt) || !Number.isSafeInteger(manifest.snapshot.workspaceRevision)
        || !['files', 'projects', 'queries', 'shared', 'preserved'].every(key => Array.isArray(manifest[key]))) throw new Error('备份清单结构无效');
      const listed = new Map(), damaged = new Set();
      for (const item of manifest.files) {
        if (!safeRelativePath(item.path) || ['manifest.json', 'complete.json'].includes(item.path) || listed.has(canonical(item.path)) || !Number.isSafeInteger(item.byteLength) || item.byteLength < 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('清单文件引用无效');
        listed.set(canonical(item.path), item);
        const bytes = files.get(item.path);
        if (!bytes || bytes.byteLength !== item.byteLength || await hash(bytes) !== item.sha256) damaged.add(item.path);
      }
      if ([...files.keys()].some(path => !['manifest.json', 'complete.json'].includes(path) && !listed.has(canonical(path)))) throw new Error('备份含清单外文件');
      const readJson = path => {
        if (!safeRelativePath(path) || !listed.has(canonical(path)) || damaged.has(path)) throw new Error('文件缺失或校验失败：' + path);
        return parse(files.get(path));
      };
      const result = { manifest, validProjects: [], invalidProjects: [], queries: {}, shared: {}, preserved: [], warnings: [] }, projectIds = new Set();
      for (const entry of manifest.projects) {
        if (!C.idValid(entry.id) || !C.idValid(entry.moduleId) || projectIds.has(entry.id)) throw new Error('项目身份重复或无效');
        projectIds.add(entry.id);
        try {
          const folder = entry.path.slice(0, entry.path.lastIndexOf('/'));
          if (!entry.path.startsWith('modules/') || !entry.path.endsWith('/project.json') || !Array.isArray(entry.resources) || !entry.resources.every(path => safeRelativePath(path) && path.startsWith(folder + '/attachments/') && listed.has(canonical(path)) && !damaged.has(path))) throw new Error('项目附件缺失或引用无效');
          const project = readJson(entry.path);
          function rebuild(node) {
            if (node && typeof node === 'object' && '$backupResource' in node) {
              if (Object.keys(node).length !== 2 || !entry.resources.includes(node.$backupResource) || damaged.has(node.$backupResource)) throw new Error('附件引用无效');
              const url = toDataUrl(files.get(node.$backupResource), node.mime);
              if (/^data:image\//i.test(url)) S.validateImageDataUrl(url);
              return url;
            }
            if (Array.isArray(node)) return node.map(rebuild);
            if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, rebuild(value)]));
            return node;
          }
          project.payload = rebuild(project.payload);
          if (!C.validateProject(project) || project.id !== entry.id || project.moduleId !== entry.moduleId || project.adapterVersion !== entry.adapterVersion) throw new Error('项目身份或模型无效');
          const adapter = options.adapters?.get(project.moduleId);
          if (!adapter) throw new Error('当前工具没有此功能，保留隔离项目');
          if (project.adapterVersion > adapter.version) throw new Error('项目来自较新功能版本，不能直接恢复');
          const checked = adapter.validate(project.payload);
          if (!checked.ok) throw new Error(checked.error.message);
          result.validProjects.push(project);
        } catch (error) { result.invalidProjects.push({ id: entry.id, moduleId: entry.moduleId, name: entry.name, reason: error.message }); }
      }
      for (const item of manifest.queries) {
        if (!C.idValid(item.moduleId) || Object.hasOwn(result.queries, item.moduleId)) throw new Error('查询身份重复或无效');
        const payload = readJson(item.path), adapter = options.adapters?.get(item.moduleId);
        if (!adapter || !adapter.validate(payload).ok) throw new Error('查询草稿校验失败：' + item.moduleId);
        result.queries[item.moduleId] = payload;
      }
      for (const item of manifest.shared) {
        if (!['materials', 'preferences'].includes(item.kind) || Object.hasOwn(result.shared, item.kind)) throw new Error('公共数据类型重复或不支持');
        const value = readJson(item.path);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('公共数据结构无效');
        if (item.kind === 'materials' && (!value.overrides || !value.customs || typeof value.overrides !== 'object' || typeof value.customs !== 'object' || Array.isArray(value.customs) || Array.isArray(value.overrides))) throw new Error('材料库数据无效');
        result.shared[item.kind] = value;
      }
      for (const item of manifest.preserved) result.preserved.push(readJson(item.path));
      return C.ok(result);
    } catch (error) { return C.fail(error.message, 'backup-format'); }
  }
  return Object.freeze({ pack, inspect, digest, safeRelativePath, checkFileMap, LIMITS });
});
