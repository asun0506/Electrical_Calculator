/* Shared, dependency-free boundaries for offline imports and rendered text. */
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ElectricalSafety = api;
})(function () {
  'use strict';
  const JSON_LIMIT = 10 * 1024 * 1024;
  const IMAGE_LIMIT = 6 * 1024 * 1024;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function safeFilename(value) {
    let name = String(value == null ? '' : value).trim().replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '');
    if (!name) return 'download';
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name;
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }

  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8');
    // Older offline browsers: count UTF-8 including replacement of lone surrogates.
    let bytes = 0;
    for (const char of text) { const code = char.codePointAt(0); bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4; }
    return bytes;
  }

  function parseJson(text, options = {}) {
    const { maxBytes = JSON_LIMIT, maxDepth = 32, maxArrayLength = 10000, validate } = options;
    if (typeof text !== 'string') throw new Error('JSON 内容必须是文本');
    if (byteLength(text) > maxBytes) throw new Error('JSON 大小超过允许范围');
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('JSON 格式无效'); }
    const pending = [{ value, depth: 1 }];
    while (pending.length) {
      const entry = pending.pop();
      if (entry.value === null || typeof entry.value !== 'object') continue;
      if (entry.depth > maxDepth) throw new Error('JSON 层级超过允许范围');
      if (Array.isArray(entry.value) && entry.value.length > maxArrayLength) throw new Error('JSON 数组条目超过允许范围');
      for (const key of Object.keys(entry.value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('JSON 包含不安全字段');
        pending.push({ value: entry.value[key], depth: entry.depth + 1 });
      }
    }
    if (validate && !validate(value)) throw new Error('JSON 数据格式不符合要求');
    return value;
  }

  function validateImageDataUrl(value, options = {}) {
    if (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)) throw new Error('不支持的图片类型');
    const payload = value.slice(value.indexOf(',') + 1);
    const decodedBytes = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
    if (decodedBytes > (options.maxBytes ?? IMAGE_LIMIT)) throw new Error('图片大小超过允许范围');
    if (!payload.length || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw new Error('图片 Base64 格式无效');
    return value;
  }

  return Object.freeze({ escapeHtml, safeFilename, parseJson, validateImageDataUrl, isPlainObject });
});
