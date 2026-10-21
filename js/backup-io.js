/* User-authorized directory snapshots and bounded ZIP transport. No mirror/deletion. */
(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./workspace-core.js'), require('./backup-format.js'));
  else window.ElectricalBackupIO = factory(window.ElectricalWorkspaceCore, window.ElectricalBackupFormat);
})(function (C, F) {
  'use strict';
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  function zipIndex(bytes) {
    if (bytes.length > F.LIMITS.compressed || bytes.length < 22) throw new Error('ZIP 文件大小无效或超过 100 MiB');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (end >= Math.max(0, bytes.length - 65557) && (view.getUint32(end, true) !== 0x06054b50 || end + 22 + view.getUint16(end + 20, true) !== bytes.length)) end -= 1;
    if (end < Math.max(0, bytes.length - 65557)) throw new Error('ZIP 目录缺失');
    const count = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || count > F.LIMITS.files || offset + centralSize !== end || offset === 0xffffffff || centralSize === 0xffffffff) throw new Error('ZIP 分卷、ZIP64 或文件数量不支持');
    const entries = [], names = new Set(); let position = offset, total = 0;
    for (let index = 0; index < count; index += 1) {
      if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw new Error('ZIP 文件目录损坏');
      const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true), crc = view.getUint32(position + 16, true);
      const compressed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true);
      const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true);
      const attrs = view.getUint32(position + 38, true), local = view.getUint32(position + 42, true), next = position + 46 + nameLength + extraLength + commentLength;
      if (next > end || flags & 1 || ![0, 8].includes(method) || view.getUint16(position + 34, true)) throw new Error('ZIP 加密或格式不支持');
      const name = utf8.decode(bytes.subarray(position + 46, position + 46 + nameLength)), directory = name.endsWith('/');
      const normalized = (directory ? name.slice(0, -1) : name).normalize('NFC').toLowerCase(), type = (attrs >>> 16) & 0xf000;
      if (!F.safeRelativePath(directory ? name.slice(0, -1) : name) || names.has(normalized) || ![0, 0x4000, 0x8000].includes(type) || directory && size !== 0 || !directory && (type === 0x4000 || attrs & 0x10)) throw new Error('ZIP 路径、链接或目录类型无效');
      names.add(normalized); total += size;
      if (total > F.LIMITS.total || size > F.LIMITS.total) throw new Error('ZIP 解压总大小超过 200 MiB');
      if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) throw new Error('ZIP 本地文件头损坏');
      const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true), dataStart = local + 30 + localNameLength + localExtraLength;
      if (dataStart + compressed > offset || view.getUint16(local + 8, true) !== method || utf8.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw new Error('ZIP 文件头和目录不一致');
      entries.push({ name, directory, size, crc }); position = next;
    }
    if (position !== end) throw new Error('ZIP 目录长度无效');
    return entries;
  }
  function createBackupIO(environment = {}) {
    let directory = null, permission = 'prompt';
    const handles = environment.handleStore || environment.ElectricalStorage?.openObjectStore({ database: 'electrical-toolkit-backup-settings', version: 1, store: 'settings', keyPath: 'id' });
    const ready = handles ? handles.getAll().then(result => { if (result.ok) directory = result.value.find(item => item.id === 'backup-directory')?.handle || null; }) : Promise.resolve();
    async function chooseDirectory() {
      try {
        if (typeof environment.showDirectoryPicker !== 'function') throw new Error('当前浏览器不支持目录授权，请下载 ZIP 备份');
        const selected = await environment.showDirectoryPicker({ mode: 'readwrite', id: 'electrical-workspace-backups' });
        await ready; directory = selected; permission = await selected.queryPermission({ mode: 'readwrite' });
        if (handles) await handles.put({ id: 'backup-directory', handle: selected });
        return C.ok({ name: selected.name });
      } catch (error) { return C.fail(error.message, 'directory'); }
    }
    async function authorized(mode) {
      await ready;
      if (!directory) throw new Error('请先选择备份目录');
      permission = await directory.queryPermission({ mode });
      if (permission !== 'granted') permission = await directory.requestPermission({ mode });
      if (permission !== 'granted') throw new Error('目录授权已失效或被拒绝，请重新授权或下载 ZIP');
    }
    async function fileHandle(root, path, create) {
      const parts = path.split('/'); let folder = root;
      for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create });
      return folder.getFileHandle(parts.at(-1), { create });
    }
    async function writeDirectory(files, snapshotId, { signal, onProgress } = {}) {
      let createdRoot = null, completionStarted = false;
      try {
        if (!C.idValid(snapshotId)) throw new Error('快照身份无效');
        F.checkFileMap(files);
        if (!files.has('manifest.json') || !files.has('complete.json')) throw new Error('不能写入未完成的备份包');
        await authorized('readwrite');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        let name = stamp + '__' + snapshotId, root;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          try { await directory.getDirectoryHandle(name); name = stamp + '__' + snapshotId + '-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)); }
          catch (error) { if (error.name !== 'NotFoundError') throw error; root = await directory.getDirectoryHandle(name, { create: true }); break; }
        }
        if (!root) throw new Error('无法创建独立备份目录');
        createdRoot = root;
        const paths = [...files.keys()].filter(path => !['manifest.json', 'complete.json'].includes(path)).sort().concat(['manifest.json', 'complete.json']);
        let done = 0;
        for (const path of paths) {
          if (signal?.aborted) throw new Error('备份已取消，之前完整备份不受影响');
          if (path === 'complete.json') completionStarted = true;
          const bytes = files.get(path), handle = await fileHandle(root, path, true), writable = await handle.createWritable();
          try { await writable.write(bytes); await writable.close(); }
          catch (error) { if (writable.abort) await writable.abort().catch(() => {}); throw error; }
          const read = new Uint8Array(await (await handle.getFile()).arrayBuffer());
          if (read.byteLength !== bytes.byteLength || await F.digest(read) !== await F.digest(bytes)) throw new Error('磁盘文件读回校验失败：' + path);
          done += 1; onProgress?.({ done, total: paths.length });
        }
        return C.ok({ directoryName: name });
      } catch (error) {
        if (completionStarted && createdRoot) {
          try { await createdRoot.removeEntry('complete.json'); }
          catch (cleanupError) { return C.fail(error.message + '；本次目录完成标记清理失败，请勿将此目录作为成功备份：' + cleanupError.message, 'directory'); }
        }
        return C.fail(error.message, 'directory');
      }
    }
    async function readDirectory(root) {
      try {
        if (!root) {
          if (!environment.showDirectoryPicker) throw new Error('当前环境不支持读取目录，请导入 ZIP');
          root = await environment.showDirectoryPicker({ mode: 'read', id: 'electrical-workspace-restore' });
        }
        const files = new Map(); let total = 0, visited = 0;
        async function walk(folder, prefix = '') {
          for await (const handle of folder.values()) {
            visited += 1;
            if (visited > F.LIMITS.files * 2) throw new Error('备份目录条目数量超过限制');
            const path = prefix + handle.name;
            if (!F.safeRelativePath(path)) throw new Error('目录含不安全文件名');
            if (handle.kind === 'directory') await walk(handle, path + '/');
            else if (handle.kind === 'file') {
              const file = await handle.getFile(); total += file.size;
              if (total > F.LIMITS.total || files.size >= F.LIMITS.files) throw new Error('备份目录大小或文件数量超过限制');
              files.set(path, new Uint8Array(await file.arrayBuffer()));
            } else throw new Error('目录条目类型无效');
          }
        }
        await walk(root); F.checkFileMap(files); return C.ok(files);
      } catch (error) { return C.fail(error.message, 'directory'); }
    }
    async function createZip(files) {
      try {
        F.checkFileMap(files);
        const JSZip = environment.JSZip;
        if (!JSZip) throw new Error('离线 ZIP 组件未加载');
        const zip = new JSZip(); files.forEach((bytes, path) => zip.file(path, bytes, { createFolders: false }));
        const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
        if (bytes.length > F.LIMITS.compressed) throw new Error('ZIP 超过 100 MiB，请拆分项目备份');
        return C.ok(new Blob([bytes], { type: 'application/zip' }));
      } catch (error) { return C.fail(error.message, 'zip'); }
    }
    async function readZip(blob) {
      try {
        if (blob.size > F.LIMITS.compressed) throw new Error('ZIP 超过 100 MiB');
        const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(await blob.arrayBuffer());
        const entries = zipIndex(bytes);
        if (!environment.JSZip) throw new Error('离线 ZIP 组件未加载');
        const zip = await environment.JSZip.loadAsync(bytes), files = new Map(); let total = 0;
        for (const entry of entries.filter(item => !item.directory)) {
          const file = zip.file(entry.name);
          if (!file || file.unsafeOriginalName && file.unsafeOriginalName !== entry.name) throw new Error('ZIP 原始路径无效');
          const extracted = await new Promise((resolve, reject) => {
            const chunks = []; let length = 0, crc = 0xffffffff;
            const stream = file.internalStream('uint8array');
            stream.on('data', chunk => {
              length += chunk.length;
              if (length > entry.size || total + length > F.LIMITS.total) { stream.pause(); reject(new Error('ZIP 实际解压大小超过声明或限制')); return; }
              for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
              chunks.push(chunk);
            }).on('error', reject).on('end', () => {
              if (length !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) { reject(new Error('ZIP 长度或 CRC 校验失败')); return; }
              const output = new Uint8Array(length); let offset = 0;
              chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; }); resolve(output);
            }).resume();
          });
          total += extracted.length; files.set(entry.name, extracted);
        }
        F.checkFileMap(files); return C.ok(files);
      } catch (error) { return C.fail(error.message, 'zip'); }
    }
    return { ready, chooseDirectory, directoryStatus: () => ({ supported: typeof environment.showDirectoryPicker === 'function', name: directory?.name || '', permission }), writeDirectory, readDirectory, createZip, readZip };
  }
  return Object.freeze({ createBackupIO });
});
