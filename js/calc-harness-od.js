/**
 * 计算器 12：线束外径快速估算
 *
 * 依据线种/线径的绝缘导线外径（min/max）与数量，按面积等效估算线束外径，并叠加胶带厚度：
 *   总面积min = Σ(数量 × d_min²)，总面积max = Σ(数量 × d_max²)
 *   线束外径 Dmin = √(总面积min) + 2·T，Dmax = √(总面积max) + 2·T
 *   （T 为胶带/缠绕厚度）
 *
 * 数据来源：线束外径快速估算表（FLRY-A / FLRY-B / AVS / AVS f）。
 * 底部波纹管/护套规格表用于按估算外径推荐选型。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  let rowSeq = 0;

  // 线种库：线径 → 绝缘导线外径 [min, max]（mm）
  const WIRES = {
    'FLRY-A': { '0.35': [1.1, 1.2] },
    'FLRY-B': {
      '0.35': [1.2, 1.4], '0.5': [1.4, 1.6], '0.75': [1.7, 1.9], '1': [1.9, 2.1],
      '1.5': [2.1, 2.4], '2': [2.5, 2.8], '2.5': [2.7, 3.0], '3': [2.9, 3.2],
      '4': [3.4, 3.7], '6': [4.0, 4.3], '10': [5.4, 6.0], '16': [7.3, 7.9], '25': [8.6, 9.4],
    },
    AVS: {
      '0.3': [1.8, 1.9], '0.5': [2.0, 2.1], '0.85': [2.2, 2.3], '1.25': [2.5, 2.6],
      '2': [2.9, 3.1], '3': [3.6, 3.8], '5': [4.4, 4.6],
    },
    'AVS f': {
      '0.5f': [2.0, 2.1], '0.75f': [2.2, 2.3], '1.25f': [2.5, 2.6], '2f': [2.9, 3.1],
    },
  };

  // 波纹管/护套规格：公称直径 → [内径标称, 外径, 壁厚]（mm）
  const CONDUIT = [
    { nom: 3, id: 3, od: 5.3, wall: 0.15 },
    { nom: 5, id: 5, od: 7.1, wall: 0.15 },
    { nom: 6, id: 6, od: 9.2, wall: 0.15 },
    { nom: 7, id: 7, od: 10.0, wall: 0.15 },
    { nom: 8, id: 8, od: 11.0, wall: 0.20 },
    { nom: 10, id: 10, od: 12.6, wall: 0.25 },
    { nom: 12, id: 12, od: 15.6, wall: 0.30 },
    { nom: 13, id: 13, od: 16.0, wall: 0.30 },
    { nom: 14, id: 14, od: 18.0, wall: 0.30 },
    { nom: 15, id: 15, od: 18.6, wall: 0.40 },
    { nom: 17, id: 17, od: 20.8, wall: 0.40 },
    { nom: 19, id: 19, od: 23.6, wall: 0.40 },
    { nom: 22, id: 22, od: 25.3, wall: 0.40 },
    { nom: 23, id: 23, od: 27.3, wall: 0.40 },
    { nom: 26, id: 26, od: 30.9, wall: 0.40 },
    { nom: 29, id: 29, od: 33.6, wall: 0.40 },
    { nom: 34, id: 34, od: 39.8, wall: 0.40 },
    { nom: 37, id: 37, od: 42.3, wall: 0.40 },
    { nom: 50, id: 50, od: 55.3, wall: 0.40 },
  ];

  T.register({
    id: 'harness-od',
    captureDraft: (host) => ({ rows: Array.from(host.querySelectorAll('#hw-rows .bd-row')).map((row) => ({ type: row.querySelector('.hw-type').value, size: row.querySelector('.hw-size').value })) }),
    restoreDraft(saved, host) { host.querySelector('#hw-rows').innerHTML = ''; saved.rows.forEach((row) => addRow(WIRES[row.type] ? row.type : 'FLRY-B', row.size, 1)); },
    refreshDraft(host) { host.querySelectorAll('#hw-rows .bd-row').forEach(updateOd); calc(); },
    title: '线束外径估算',
    icon: '🧵',
    group: '电气计算',
    desc: '选择线种/线径并填数量，按面积等效估算线束外径（叠加胶带厚度），并推荐波纹管/护套规格。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>线束组成</h3>
          <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">选择线种与线径（自动带出绝缘外径 min/max），填写数量。</p>
          <div class="hw-head">
            <span>线种</span><span>线径</span><span>数量(根)</span><span>导线外径 min~max</span><span></span>
          </div>
          <div id="hw-rows"></div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="hw-add">＋ 添加线</button>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>胶带 / 缠绕</h3>
          <div class="grid cols-2">
            <div class="field"><label>胶带厚度 <span class="hint">T（包裹在外的缠绕/胶带）</span></label>
              <div class="input-row"><input id="hw-tape" type="number" value="0.14" min="0" step="any"><span class="unit">mm</span></div></div>
          </div>
          <div class="note" style="margin-top:12px">线束外径 = √(Σ 数量×导线外径²) + 2×T</div>
        </div>

        <div class="panel" id="hw-result" style="display:none"></div>
      `;

      // 预置示例
      addRow('FLRY-B', '0.5', 4);
      addRow('FLRY-B', '1', 2);

      document.getElementById('hw-add').addEventListener('click', () => addRow('FLRY-B', '0.5', 1));
      document.getElementById('hw-tape').addEventListener('input', calc);
      calc();
    },
  });

  function addRow(type, size, qty) {
    const rows = document.getElementById('hw-rows');
    const div = document.createElement('div');
    div.className = 'bd-row';
    div.dataset.row = rowSeq++;

    div.innerHTML = `
      <select class="hw-type">${typeOptions(type)}</select>
      <select class="hw-size">${sizeOptions(type, size)}</select>
      <input type="number" class="hw-qty" value="${qty == null ? '' : qty}" min="0" step="1" placeholder="数量">
      <span class="hw-od"></span>
      <button class="row-del" type="button" title="删除该行">✕</button>
    `;

    const typeSel = div.querySelector('.hw-type');
    const sizeSel = div.querySelector('.hw-size');

    typeSel.addEventListener('change', () => {
      sizeSel.innerHTML = sizeOptions(typeSel.value, null);
      updateOd(div);
      calc();
    });
    sizeSel.addEventListener('change', () => { updateOd(div); calc(); });
    div.querySelector('.hw-qty').addEventListener('input', calc);
    div.querySelector('.row-del').addEventListener('click', () => {
      if (rows.children.length > 1) { div.remove(); calc(); }
      else div.querySelector('.hw-qty').value = '';
    });

    rows.appendChild(div);
    updateOd(div);
  }

  function typeOptions(sel) {
    return Object.keys(WIRES).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k}</option>`).join('');
  }
  function sizeOptions(type, sel) {
    return Object.keys(WIRES[type]).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} mm²</option>`).join('');
  }
  function updateOd(row) {
    const t = row.querySelector('.hw-type').value;
    const s = row.querySelector('.hw-size').value;
    const [mn, mx] = WIRES[t][s] || [0, 0];
    row.querySelector('.hw-od').textContent = mn + ' ~ ' + mx + ' mm';
  }

  function calc() {
    const E = window.ElUtil;
    const tape = E.parseNum(document.getElementById('hw-tape').value) || 0;
    const rows = document.querySelectorAll('#hw-rows .bd-row');
    const box = document.getElementById('hw-result');

    let areaMin = 0, areaMax = 0, totalQty = 0;
    rows.forEach((row) => {
      const t = row.querySelector('.hw-type').value;
      const s = row.querySelector('.hw-size').value;
      const qty = E.parseNum(row.querySelector('.hw-qty').value);
      if (qty == null || qty <= 0) return;
      const [mn, mx] = WIRES[t][s] || [0, 0];
      areaMin += qty * mn * mn;
      areaMax += qty * mx * mx;
      totalQty += qty;
    });

    const Dmin = Math.sqrt(areaMin) + 2 * tape;
    const Dmax = Math.sqrt(areaMax) + 2 * tape;

    // 波纹管/护套推荐：内径标称 ≥ 估算外径max 的最小规格
    const rec = CONDUIT.find((c) => c.id >= Dmax);

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>线束外径估算结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">总面积（min）</div><div class="v">${E.fmt(areaMin)}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">总面积（max）</div><div class="v">${E.fmt(areaMax)}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">线束外径 D（min）</div><div class="v">${E.fmt(Dmin)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">线束外径 D（max）</div><div class="v">${E.fmt(Dmax)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">导线总数量</div><div class="v">${totalQty}<small> 根</small></div></div>
      </div>
      ${rec ? `
      <div class="status-banner ok"><b>波纹管 / 护套推荐：</b>公称直径 <b>${rec.nom} mm</b>（内径 ${rec.id}mm、外径 ${rec.od}mm、壁厚 ≥${rec.wall}mm），内径标称 ${rec.id}mm ≥ 估算外径 ${E.fmt(Dmax)}mm。</div>` : `
      <div class="status-banner err">估算外径 ${E.fmt(Dmax)}mm 超出波纹管规格表范围（最大内径 50mm），请考虑更大护套或分组。`}
      <div class="note">
        <strong>说明：</strong>D = √(Σ 数量×导线外径²) + 2×T = √(${E.fmt(areaMax)}) + 2×${E.fmtExact(tape)} = <b>${E.fmt(Dmax)} mm（max）</b>。
        估算基于面积等效，实际成束会有间隙，正式选型建议再留余量。
      </div>
    `;
    box.style.display = 'block';
  }
})();
