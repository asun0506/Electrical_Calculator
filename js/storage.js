/* Dependency-free browser persistence. Result objects keep failures visible to callers. */
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ElectricalStorage = api.createStorage(window);
})(function () {
  'use strict';
  const ERROR_CODES = Object.freeze({ QUOTA: 'quota', MALFORMED: 'malformed', INVALID: 'invalid', UNAVAILABLE: 'unavailable', MIGRATION: 'migration' });
  const errorFor = (cause, code) => ({
    code: code || (cause?.name === 'QuotaExceededError' ? ERROR_CODES.QUOTA : ERROR_CODES.UNAVAILABLE),
    message: cause?.message || 'Browser storage is unavailable',
  });
  const success = () => ({ ok: true, error: null });

  function createStorage(environment) {
    environment = environment || {};
    function readText(key, options = {}) {
      try {
        const value = environment.localStorage.getItem(key);
        return { ok: true, value: value === null ? (options.defaultValue ?? null) : value, source: value === null ? null : key, error: null };
      } catch (cause) {
        return { ok: false, value: options.defaultValue ?? null, source: null, error: errorFor(cause) };
      }
    }
    function writeText(key, value) {
      try { environment.localStorage.setItem(key, value); return success(); }
      catch (cause) { return { ok: false, error: errorFor(cause) }; }
    }
    function readJson(key, options = {}) {
      const result = readText(key);
      if (!result.ok || result.source === null) return { ...result, value: options.defaultValue ?? null };
      let value;
      try { value = JSON.parse(result.value); }
      catch (cause) { return { ...result, ok: false, value: options.defaultValue ?? null, error: errorFor(cause, ERROR_CODES.MALFORMED) }; }
      try {
        if (options.validate && !options.validate(value)) throw new Error('Stored value failed validation');
      } catch (cause) { return { ...result, ok: false, value: options.defaultValue ?? null, error: errorFor(cause, ERROR_CODES.INVALID) }; }
      return { ...result, value };
    }
    function writeJson(key, value) {
      let text;
      try {
        text = JSON.stringify(value);
        if (text === undefined) throw new Error('Value cannot be serialized as JSON');
      } catch (cause) { return { ok: false, error: errorFor(cause, ERROR_CODES.INVALID) }; }
      return writeText(key, text);
    }
    function remove(key) {
      try { environment.localStorage.removeItem(key); return success(); }
      catch (cause) { return { ok: false, error: errorFor(cause) }; }
    }
    function keys(prefix = '') {
      try {
        const local = environment.localStorage;
        const value = [];
        for (let index = 0; index < local.length; index += 1) {
          const key = local.key(index);
          if (typeof key === 'string' && key.startsWith(prefix)) value.push(key);
        }
        return { ...success(), value };
      } catch (cause) { return { ok: false, value: [], error: errorFor(cause) }; }
    }
    function readWithLegacy(currentKey, legacyKeys, options = {}) {
      const current = readJson(currentKey, options);
      if (current.ok && current.source !== null) return current;
      let failure = current;
      for (const key of legacyKeys) {
        if (key === currentKey) continue;
        const legacy = readJson(key, options);
        if (!legacy.ok) { failure = legacy; continue; }
        if (legacy.source === null) continue;
        // Never modify or remove the legacy copy, including when the new write fails.
        const written = writeJson(currentKey, legacy.value);
        return written.ok ? legacy : { ...legacy, ok: false, error: errorFor(written.error, ERROR_CODES.MIGRATION) };
      }
      return failure;
    }
    function openObjectStore({ database, version, store, keyPath }) {
      let db = null;
      let settled = false;
      const ready = new Promise(resolve => {
        const finish = result => { if (!settled) { settled = true; resolve(result); } };
        try {
          const request = environment.indexedDB.open(database, version);
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath });
          };
          request.onerror = () => finish({ ok: false, error: errorFor(request.error) });
          request.onblocked = () => finish({ ok: false, error: errorFor(new Error('Database upgrade is blocked; close other tabs and retry')) });
          request.onsuccess = () => {
            if (settled) { request.result.close(); return; }
            db = request.result;
            db.onversionchange = () => { db.close(); db = null; };
            finish(success());
          };
        } catch (cause) { finish({ ok: false, error: errorFor(cause) }); }
      });
      async function transact(method, value) {
        const opened = await ready;
        if (!opened.ok) return opened;
        try {
          if (!db) throw new Error('Database connection is unavailable; reload and retry');
          return await new Promise(resolve => {
            const transaction = db.transaction(store, method === 'getAll' ? 'readonly' : 'readwrite');
            let request;
            transaction.oncomplete = () => resolve(method === 'getAll' ? { ...success(), value: request.result } : success());
            transaction.onerror = transaction.onabort = () => resolve({ ok: false, error: errorFor(transaction.error || request?.error) });
            request = transaction.objectStore(store)[method](...(method === 'getAll' ? [] : [value]));
          });
        } catch (cause) { return { ok: false, error: errorFor(cause) }; }
      }
      return { ready, getAll: () => transact('getAll'), put: value => transact('put', value), remove: key => transact('delete', key) };
    }
    return { readJson, writeJson, remove, readWithLegacy, openObjectStore, readText, writeText, keys };
  }
  return { createStorage, ERROR_CODES };
});
