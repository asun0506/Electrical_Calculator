const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, '../js/backup-io.js');
assert.ok(fs.existsSync(file), 'backup IO must safely map a workspace snapshot to a local directory');
const { createBackupIO } = require(file);
const F = require('../js/backup-format.js'), C = require('../js/workspace-core.js');
const encoder = new TextEncoder();
class Directory {
  constructor(name, options = {}) { this.name = name; this.kind = 'directory'; this.children = new Map(); this.options = options; }
  async queryPermission() { return this.options.permission || 'granted'; }
  async requestPermission() { return this.options.permission || 'granted'; }
  async getDirectoryHandle(name, options = {}) {
    if (this.children.has(name)) { const found = this.children.get(name); if (found.kind !== 'directory') throw Error('not a directory'); return found; }
    if (!options.create) throw Object.assign(Error('missing'), { name: 'NotFoundError' });
    const child = new Directory(name, this.options); this.children.set(name, child); return child;
  }
  async getFileHandle(name, options = {}) {
    if (this.children.has(name)) return this.children.get(name);
    if (!options.create) throw Object.assign(Error('missing'), { name: 'NotFoundError' });
    const settings = this.options, child = { name, kind: 'file', bytes: new Uint8Array(),
      async createWritable() { return { write: async bytes => { if (settings.failWrite) throw Error('disk full'); child.bytes = bytes.slice(); }, close: async () => { if (settings.failClose || settings.failCompleteClose && name === 'complete.json') throw Error('close failed'); } }; },
      async getFile() { const bytes = settings.corrupt && name !== 'complete.json' ? new Uint8Array([0]) : child.bytes; return new Blob([bytes]); },
    }; this.children.set(name, child); return child;
  }
  async *values() { yield* this.children.values(); }
  async removeEntry(name) { this.children.delete(name); }
}
(async () => {
  const root = new Directory('backup');
  const io = createBackupIO({ showDirectoryPicker: async () => root });
  assert.equal((await io.chooseDirectory()).ok, true);
  const snapshot = { formatVersion: 1, id: 'backup-1', createdAt: '2026-10-22T00:00:00Z', appVersion: '2.1.1', workspaceRevision: 0, projects: [], queries: {}, shared: {}, preserved: [], browserUnsaved: false };
  const files = (await F.pack(snapshot)).value.files;
  const first = await io.writeDirectory(files, 'backup-1'); assert.equal(first.ok, true);
  const second = await io.writeDirectory(files, 'backup-1'); assert.equal(second.ok, true);
  assert.notEqual(first.value.directoryName, second.value.directoryName);
  assert.equal(root.children.size, 2, 'old backups are never replaced');
  const loaded = await io.readDirectory(root.children.get(first.value.directoryName));
  assert.equal(loaded.ok, true); assert.equal((await F.inspect(loaded.value)).ok, true);
  for (const setting of ['failWrite', 'failClose', 'corrupt', 'failCompleteClose']) {
    const faulty = new Directory(setting, { [setting]: true }), transport = createBackupIO({ showDirectoryPicker: async () => faulty });
    await transport.chooseDirectory();
    assert.equal((await transport.writeDirectory(files, setting)).ok, false);
    for (const child of faulty.children.values()) assert.equal(child.children.has('complete.json'), false, `${setting}: no completion marker for partial backup`);
  }
  root.options.permission = 'denied';
  assert.equal((await io.writeDirectory(files, 'revoked')).ok, false);
  assert.equal((await createBackupIO({ showDirectoryPicker: async () => { throw Error('permission denied'); } }).chooseDirectory()).ok, false);
  assert.equal((await createBackupIO({}).chooseDirectory()).ok, false);
  console.log('PASS backup IO: directory layers/readback, unique snapshots, no completion on failed write/close/corruption, denied and revoked permission');
})().catch(error => { console.error(error); process.exitCode = 1; });
