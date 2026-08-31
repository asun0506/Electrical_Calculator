/** Per-calculator drafts. IndexedDB holds images/attachments; localStorage is a synchronous recovery copy. */
(function () {
  'use strict';
  const PREFIX = 'electrical_toolkit_draft_v1:';
  const cache = new Map();
  let db = null;
  function newer(record) {
    if (record && typeof record.id === 'string' && record.version === 1 && record.payload
      && (!cache.has(record.id) || record.updatedAt > cache.get(record.id).updatedAt)) cache.set(record.id, record);
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key.startsWith(PREFIX)) { try { newer(JSON.parse(localStorage.getItem(key))); } catch (_) { /* Ignore a damaged recovery copy. */ } }
    }
  } catch (_) { /* Storage availability is reported when writing. */ }

  const ready = new Promise((resolve) => {
    try {
      const request = indexedDB.open('electrical-toolkit-drafts', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
      request.onerror = request.onblocked = () => resolve();
      request.onsuccess = () => {
        db = request.result;
        const read = db.transaction('drafts').objectStore('drafts').getAll();
        read.onsuccess = () => { read.result.forEach(newer); resolve(); };
        read.onerror = () => resolve();
      };
    } catch (_) { resolve(); }
  });

  function write(id, payload) {
    const record = { id, version: 1, updatedAt: Math.max(Date.now(), (cache.get(id)?.updatedAt || 0) + 1), payload };
    // Detach from live module state before an asynchronous IndexedDB write.
    const serialized = JSON.stringify(record);
    cache.set(id, JSON.parse(serialized));
    let synchronous = false;
    try { localStorage.setItem(PREFIX + id, serialized); synchronous = true; } catch (_) { /* Large attachments use IndexedDB. */ }
    if (!db) return Promise.resolve(synchronous);
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put(cache.get(id));
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = transaction.onabort = () => resolve(synchronous);
      } catch (_) { resolve(synchronous); }
    });
  }

  const controls = (host) => Array.from(host.querySelectorAll('input:not([type=file]):not([type=password]),select,textarea'));
  function captureForm(host) {
    return controls(host).map((control, index) => ({ id: control.id, index, value: control.value, checked: control.checked }));
  }
  function applyForm(host, values, notifySelects = false) {
    const existing = controls(host);
    (values || []).forEach((item) => {
      const control = item.id ? host.querySelector('#' + CSS.escape(item.id)) : (notifySelects ? controls(host) : existing)[item.index];
      if (!control) return;
      control.value = item.value;
      if (typeof item.checked === 'boolean') control.checked = item.checked;
      if (notifySelects && control.tagName === 'SELECT') control.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function capture(calc, host) {
    return {
      form: captureForm(host), model: calc.captureDraft ? calc.captureDraft(host) : null,
      tabs: Array.from(host.querySelectorAll('.kind-tab.active,.choice-btn.selected,.ef-tab.active')).map((node) => ({ ...node.dataset })),
      details: Array.from(host.querySelectorAll('details')).map((node, index) => ({ id: node.id, index, open: node.open })),
    };
  }
  function restore(calc, host, saved) {
    if (calc.restoreDraft && saved.model != null) calc.restoreDraft(saved.model, host);
    else applyForm(host, saved.form, true);
    // Replay only known UI switches, never arbitrary saved selectors or commands.
    (saved.tabs || []).forEach((tab) => {
      const node = Array.from(host.querySelectorAll('.kind-tab,.choice-btn,.ef-tab')).find((button) =>
        Object.entries(tab).every(([key, value]) => button.dataset[key] === value));
      if (node) node.click();
    });
    applyForm(host, saved.form);
    (saved.details || []).forEach((item) => {
      const node = item.id ? host.querySelector('#' + CSS.escape(item.id)) : host.querySelectorAll('details')[item.index];
      if (node) node.open = item.open;
    });
    if (calc.refreshDraft) calc.refreshDraft(host);
  }

  window.CalculatorDrafts = { ready, write, capture, restore, captureForm, applyForm,
    read: (id) => cache.has(id) ? JSON.parse(JSON.stringify(cache.get(id).payload)) : null };
})();
