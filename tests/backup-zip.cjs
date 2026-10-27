const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, '../js/backup-io.js');
assert.ok(fs.existsSync(file), 'ZIP transport must reject malicious archives before extracting');
const JSZip = require('jszip'), { createBackupIO } = require(file);
const encoder = new TextEncoder();
(async () => {
  const io = createBackupIO({ JSZip }), files = new Map([['manifest.json', encoder.encode('{"id":"a"}')], ['modules/bolt/project.json', encoder.encode('{"value":1}')]]);
  const zip = await io.createZip(files); assert.equal(zip.ok, true);
  const loaded = await io.readZip(zip.value); assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.value.get('modules/bolt/project.json'), encoder.encode('{"value":1}'));
  const unsafe = new JSZip(); unsafe.file('../unsafe.json', 'bad');
  assert.equal((await io.readZip(await unsafe.generateAsync({ type: 'uint8array' }))).ok, false, 'reject raw original traversal path before JSZip sanitizes it');
  const duplicate = new JSZip(); duplicate.file('A.json', 'a'); duplicate.file('a.json', 'b');
  assert.equal((await io.readZip(await duplicate.generateAsync({ type: 'uint8array' }))).ok, false);
  const unicode = new JSZip(); unicode.file('é.json', 'a'); unicode.file('e\u0301.json', 'b');
  assert.equal((await io.readZip(await unicode.generateAsync({ type: 'uint8array' }))).ok, false);
  const symlink = new JSZip(); symlink.file('link', 'target', { unixPermissions: 0o120777 });
  assert.equal((await io.readZip(await symlink.generateAsync({ type: 'uint8array', platform: 'UNIX' }))).ok, false);
  // Tamper central-directory size claims; no large allocations are needed to
  // prove oversized archives are refused before decompression.
  const bytes = Buffer.from(await zip.value.arrayBuffer());
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const bomb = Buffer.from(bytes); bomb.writeUInt32LE(200 * 1024 * 1024 + 1, central + 24);
  assert.equal((await io.readZip(bomb)).ok, false);
  const many = Buffer.from(bytes); many.writeUInt16LE(10001, many.length - 22 + 10); many.writeUInt16LE(10001, many.length - 22 + 8);
  assert.equal((await io.readZip(many)).ok, false);
  assert.equal((await io.readZip({ size: 100 * 1024 * 1024 + 1, arrayBuffer: () => { throw Error('must not allocate'); } })).ok, false);
  const crc = Buffer.from(bytes); crc.writeUInt32LE(12345, central + 16);
  assert.equal((await io.readZip(crc)).ok, false, 'CRC mismatch cannot be accepted');
  console.log('PASS ZIP: portable bytes, raw traversal, case/Unicode collisions, symlinks, early size/count limits and CRC validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
