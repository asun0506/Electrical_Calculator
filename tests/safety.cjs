const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const safety = require('../js/safety.js');

assert.equal(safety.escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
assert.equal(safety.escapeHtml(null), '');
assert.equal(safety.safeFilename('PACK:A/B*?'), 'PACK_A_B__');
assert.equal(safety.safeFilename('../CON. '), '.._CON');
assert.equal(safety.safeFilename('CON'), '_CON');
assert.equal(safety.safeFilename(''), 'download');
assert.deepEqual(safety.parseJson('{"rows":[1,2]}', {
  maxBytes: 64, maxDepth: 3, maxArrayLength: 5,
  validate: value => safety.isPlainObject(value) && Array.isArray(value.rows),
}), { rows: [1, 2] });
assert.throws(() => safety.parseJson('{"a":{"b":{"c":{"d":1}}}}', { maxBytes: 128, maxDepth: 3 }), /层级/);
assert.throws(() => safety.parseJson('{"rows":[1,2,3]}', { maxBytes: 128, maxArrayLength: 2 }), /条目/);
assert.throws(() => safety.parseJson('"中文"', { maxBytes: 7 }), /大小/);
assert.throws(() => safety.parseJson('{'), /JSON/);
assert.throws(() => safety.parseJson('[]', { validate: safety.isPlainObject }), /格式/);
assert.throws(() => safety.parseJson('{"__proto__":{"polluted":true}}'), /字段/);
assert.equal(safety.isPlainObject([]), false);
assert.equal(safety.isPlainObject(null), false);
assert.equal(safety.isPlainObject(new Date()), false);
assert.throws(() => safety.validateImageDataUrl('data:text/html;base64,PGgxPg=='), /图片类型/);
assert.throws(() => safety.validateImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), /图片类型/);
assert.throws(() => safety.validateImageDataUrl('data:image/png;base64,!!!!'), /格式/);
assert.throws(() => safety.validateImageDataUrl('data:image/png;base64,iVBORw0KGgo=', { maxBytes: 7 }), /大小/);
assert.match(safety.validateImageDataUrl('data:image/png;base64,iVBORw0KGgo=', { maxBytes: 8 }), /^data:image\/png/);
for (const mime of ['jpeg', 'webp', 'gif']) assert.equal(safety.validateImageDataUrl(`data:image/${mime};base64,YQ==`), `data:image/${mime};base64,YQ==`);
const atImageLimit = 'data:image/png;base64,' + Buffer.alloc(6 * 1024 * 1024).toString('base64');
assert.equal(safety.validateImageDataUrl(atImageLimit), atImageLimit);
assert.throws(() => safety.validateImageDataUrl('data:image/png;base64,' + Buffer.alloc(6 * 1024 * 1024 + 1).toString('base64')), /大小/);
const browser = { TextEncoder, window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../js/safety.js'), 'utf8'), browser);
assert.equal(browser.window.ElectricalSafety.escapeHtml("&'"), '&amp;&#39;');
assert.throws(() => browser.window.ElectricalSafety.parseJson('"中文"', { maxBytes: 7 }), /大小/);
console.log('PASS shared safety utilities');
