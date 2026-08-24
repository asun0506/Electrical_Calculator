/**
 * 计算器 1：继电器 / 保险丝 保护配合（数据点表格 → 时间–电流曲线）
 *
 * 两个能力：
 *  A. 数据点曲线表：用户为多条曲线（熔断器、继电器/接触器、电芯、工作/热极限……）
 *     各输入多组 (电流 I / A, 时间 t / s) 数据点，根据这些点在同一双对数图中生成曲线；
 *  B. 快速自动匹配：输入继电器与保险丝额定电流及负载电流，按裕量规则给结论，
 *     并可一键把按额定电流估算的参考熔断/耐受曲线填入数据表作为起点。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  const PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
  let curveSeq = 0;

  T.register({
    id: 'relay-fuse',
    title: '继电器 / 保险丝匹配',
    icon: '🔌',
    group: '电气计算',
    desc: '在表格中输入各设备的多组 (电流, 时间) 数据点，生成保护配合时间–电流曲线；也可按继电器/保险丝额定电流快速匹配。',

    render(host) {
      host.innerHTML = `
        <!-- 数据点表格 -->
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>① 数据点曲线表</h3>
          <p style="margin:0 0 6px;color:var(--text-muted);font-size:13px">
            为每个设备输入多组数据点 <b>(电流 I / A, 动作时间 t / s)</b>，同一条曲线请给 ≥ 2 个点。
          </p>

          <div class="sc-input">
            <label>电池包最大短路电流 <span class="hint">（单一值 → 生成 X=A 竖直参考线）</span></label>
            <div class="input-row">
              <input id="cc-sc" type="number" value="2000" min="0" step="any">
              <span class="unit">A</span>
            </div>
          </div>

          <div id="cc-curves"></div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="cc-add-curve">＋ 添加曲线</button>
            <button class="btn btn-primary" id="cc-gen">生成图表</button>
          </div>
          <div class="io-row">
            <button class="btn btn-ghost btn-sm" id="cc-export" type="button">↑ 导出当前校核</button>
            <button class="btn btn-ghost btn-sm" id="cc-import" type="button">↓ 导入校核文件</button>
            <input type="file" id="cc-file" accept=".json,application/json" style="display:none">
            <span class="io-hint">导出为 JSON 文件保存本次校核，下次可导入继续修改</span>
          </div>
        </div>

        <!-- 图表 -->
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>② 保护配合曲线（时间–电流）</h3>
          <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px">
            所有曲线绘制于同一双对数图中。曲线越低代表动作越快、越先脱扣。留空则自动适配数据范围。
          </p>
          <div class="chart-title-input">
            <label>图表名称</label>
            <input id="cc-title" type="text" placeholder="输入图表标题（显示在图表上方）" value="保护配合曲线（时间–电流）">
          </div>
          <div class="range-bar">
            <div class="range-item">
              <label>X 电流范围 (A)</label>
              <input id="cc-xmin" type="number" step="any" placeholder="自动">
              <span class="range-sep">～</span>
              <input id="cc-xmax" type="number" step="any" placeholder="自动">
            </div>
            <div class="range-item">
              <label>Y 时间范围 (s)</label>
              <input id="cc-ymin" type="number" step="any" placeholder="自动">
              <span class="range-sep">～</span>
              <input id="cc-ymax" type="number" step="any" placeholder="自动">
            </div>
            <button class="btn btn-ghost btn-sm" id="cc-reset-range" type="button">重置为自动</button>
          </div>
          <div id="cc-chart"></div>
        </div>

        <!-- 快速自动匹配 -->
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>③ 快速自动匹配（按额定电流）</h3>
          <div class="grid cols-3">
            <div class="field">
              <label>继电器触点额定电流 <span class="hint">In_relay</span></label>
              <div class="input-row">
                <input id="rf-relay-in" type="number" value="30" min="0" step="any">
                <span class="unit">A</span>
              </div>
            </div>
            <div class="field">
              <label>保险丝额定电流 <span class="hint">In_fuse</span></label>
              <div class="input-row">
                <input id="rf-fuse-in" type="number" value="20" min="0" step="any">
                <span class="unit">A</span>
              </div>
            </div>
            <div class="field">
              <label>正常负载电流 <span class="hint">I_load</span></label>
              <div class="input-row">
                <input id="rf-load" type="number" value="12" min="0" step="any">
                <span class="unit">A</span>
              </div>
            </div>
          </div>
          <div class="grid cols-2" style="margin-top:16px">
            <div class="field">
              <label>保险丝熔断特性</label>
              <select id="rf-fuse-type">
                <option value="slow">慢断（延时型）</option>
                <option value="fast">快断（速断型）</option>
              </select>
            </div>
            <div class="field">
              <label>负载类型</label>
              <select id="rf-load-type">
                <option value="resistive">阻性负载</option>
                <option value="motor">电机 / 感性负载</option>
                <option value="capacitive">容性负载</option>
                <option value="inrush">高浪涌</option>
              </select>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="rf-to-table">估算参考曲线 → 填入数据表</button>
            <button class="btn btn-primary" id="rf-calc">开始匹配（数值结论）</button>
          </div>
          <div class="note" style="margin-top:14px">
            仅填额定电流时，程序用工程近似（I²t 恒定）估算参考曲线并填入上方数据表；更准确请直接在上方表格录入厂家实测数据点。
          </div>
        </div>

        <div class="panel" id="rf-result" style="display:none"></div>
      `;

      // 预置示例曲线：继电器触点 / 保险丝 / 线束发烟 / 电芯热失控
      addCurve('继电器触点 30A', PALETTE[1], [[30, 1], [60, 0.25], [90, 0.11], [120, 0.0625], [300, 0.01]]);
      addCurve('保险丝 慢断 20A', PALETTE[0], [[20, 1], [40, 0.25], [60, 0.11], [100, 0.04], [200, 0.01]]);
      addCurve('线束发烟 2.5mm²', PALETTE[2], [[15, 100], [25, 30], [40, 10], [60, 4], [100, 1.2], [200, 0.3]]);
      addCurve('电芯热失控', PALETTE[3], [[80, 600], [120, 300], [200, 120], [300, 50], [500, 18], [800, 8]]);

      document.getElementById('cc-add-curve').addEventListener('click', () => {
        addCurve('曲线 ' + (curveSeq), nextColor());
      });
      document.getElementById('cc-sc').addEventListener('input', renderChart);
      document.getElementById('cc-gen').addEventListener('click', renderChart);
      ['cc-xmin', 'cc-xmax', 'cc-ymin', 'cc-ymax'].forEach((id) =>
        document.getElementById(id).addEventListener('input', renderChart)
      );
      document.getElementById('cc-reset-range').addEventListener('click', () => {
        ['cc-xmin', 'cc-xmax', 'cc-ymin', 'cc-ymax'].forEach((id) => (document.getElementById(id).value = ''));
        renderChart();
      });
      document.getElementById('cc-title').addEventListener('input', renderChart);
      document.getElementById('cc-export').addEventListener('click', exportData);
      document.getElementById('cc-import').addEventListener('click', () => document.getElementById('cc-file').click());
      document.getElementById('cc-file').addEventListener('change', (e) => {
        importData(e.target.files && e.target.files[0]);
        e.target.value = '';
      });
      document.getElementById('rf-to-table').addEventListener('click', fillReferenceToTable);
      document.getElementById('rf-calc').addEventListener('click', matchVerdict);
      document.getElementById('rf-load-type').addEventListener('change', matchVerdict);

      renderChart();
      matchVerdict();
    },
  });

  let colorIdx = 2;
  function nextColor() { return PALETTE[colorIdx++ % PALETTE.length]; }

  /** 新增一条曲线块 */
  function addCurve(name, color, points) {
    const wrap = document.getElementById('cc-curves');
    const div = document.createElement('div');
    div.className = 'curve-block';
    div.dataset.seq = curveSeq++;

    const paletteOpts = PALETTE.map((c) => `<option value="${c}" ${c === color ? 'selected' : ''} style="background:${c}">${c}</option>`).join('');

    div.innerHTML = `
      <div class="curve-head">
        <input type="text" class="cc-name" value="${E.escapeHtml(name)}" placeholder="设备 / 曲线名称">
        <select class="cc-color">${paletteOpts}</select>
        <span class="curve-point-count">0 点</span>
        <button class="btn btn-ghost btn-sm btn-add-pt" type="button" title="手动添加一个数据点">＋ 点</button>
        <button class="btn btn-ghost btn-sm btn-paste" type="button" title="从 Excel 复制两列数据直接粘贴">批量粘贴</button>
        <button class="btn btn-ghost btn-sm btn-del" type="button" title="删除该曲线">删除</button>
      </div>
      <div class="curve-points"></div>
      <div class="paste-box" style="display:none">
        <div class="paste-actions">
          <span class="paste-hint">从 Excel 选中两列（电流 I / 时间 t）复制，粘贴到下方，点"导入"即可。支持制表符 / 逗号分隔，每行一个点，首行表头自动忽略。</span>
          <button class="btn btn-ghost btn-sm" data-mode="overwrite" type="button">导入（覆盖）</button>
          <button class="btn btn-ghost btn-sm" data-mode="append" type="button">导入（追加）</button>
        </div>
        <textarea class="paste-ta" rows="5" placeholder="示例（从 Excel 复制两列粘贴）：&#10;20&#9;1&#10;40&#9;0.25&#10;100&#9;0.04"></textarea>
      </div>
    `;

    const pointsBox = div.querySelector('.curve-points');
    (points || []).forEach(([I, t]) => addPoint(pointsBox, I, t));
    if (!points || !points.length) addPoint(pointsBox, 10, 1);

    div.querySelector('.btn-add-pt').addEventListener('click', () => addPoint(pointsBox, '', ''));
    div.querySelector('.btn-paste').addEventListener('click', () => {
      const box = div.querySelector('.paste-box');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
    div.querySelector('.btn-del').addEventListener('click', () => {
      const others = wrap.querySelectorAll('.curve-block');
      if (others.length > 1) { div.remove(); renderChart(); }
      else div.querySelector('.cc-name').value = '';
    });
    div.querySelectorAll('.paste-box .btn').forEach((b) => {
      b.addEventListener('click', () => {
        const pts = parsePasted(div.querySelector('.paste-ta').value);
        if (!pts.length) return;
        if (b.dataset.mode === 'overwrite') pointsBox.innerHTML = '';
        pts.forEach(([I, t]) => addPoint(pointsBox, I, t));
        div.querySelector('.paste-ta').value = '';
        renderChart();
      });
    });

    wrap.appendChild(div);
  }

  /** 解析从 Excel / CSV 复制的两列文本为数据点数组 [[I,t],...]，自动忽略非数值表头行 */
  function parsePasted(text) {
    const pts = [];
    String(text).split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s) return;
      let parts;
      if (s.indexOf('\t') !== -1) parts = s.split('\t');
      else if (/[,，;；]/.test(s)) parts = s.split(/[,，;；]/);
      else parts = s.split(/\s+/);
      parts = parts.map((p) => p.trim()).filter((p) => p !== '');
      if (parts.length < 2) return;
      const I = E.parseNum(parts[0]);
      const t = E.parseNum(parts[1]);
      if (I != null && t != null && I > 0 && t > 0) pts.push([I, t]);
    });
    return pts;
  }

  /** 新增一个数据点行 (I, t) */
  function addPoint(pointsBox, I, t) {
    const row = document.createElement('div');
    row.className = 'pt-row';
    row.innerHTML = `
      <input type="number" class="pt-i" value="${I === '' ? '' : E.fmtExact(I)}" placeholder="电流 I (A)" step="any" min="0">
      <input type="number" class="pt-t" value="${t === '' ? '' : E.fmtExact(t)}" placeholder="时间 t (s)" step="any" min="0">
      <button class="pt-del" type="button" title="删除该点">✕</button>
    `;
    row.querySelector('.pt-del').addEventListener('click', () => {
      if (pointsBox.children.length > 1) row.remove();
      else { row.querySelector('.pt-i').value = ''; row.querySelector('.pt-t').value = ''; }
      updateCount(pointsBox);
    });
    pointsBox.appendChild(row);
    updateCount(pointsBox);
  }

  function updateCount(pointsBox) {
    const block = pointsBox.closest('.curve-block');
    const n = pointsBox.querySelectorAll('.pt-row').length;
    const cnt = block.querySelector('.curve-point-count');
    if (cnt) cnt.textContent = n + ' 点';
  }

  /** 收集所有曲线与数据点 */
  function collectCurves() {
    const out = [];
    document.querySelectorAll('#cc-curves .curve-block').forEach((block) => {
      const name = block.querySelector('.cc-name').value.trim();
      const color = block.querySelector('.cc-color').value;
      const points = [];
      block.querySelectorAll('.pt-row').forEach((row) => {
        const I = E.parseNum(row.querySelector('.pt-i').value);
        const t = E.parseNum(row.querySelector('.pt-t').value);
        if (I != null && t != null && I > 0 && t > 0) points.push([I, t]);
      });
      out.push({ name: name || '未命名曲线', color, points });
    });
    return out;
  }

  /** 依据所有数据点生成图表 */
  function renderChart() {
    const curves = collectCurves();
    const chart = document.getElementById('cc-chart');
    const valid = curves.filter((c) => c.points.length >= 1);

    if (!valid.length) {
      chart.innerHTML = '<div class="empty-tip">请在上方表格为至少一条曲线输入数据点。</div>';
      return;
    }

    // 电池包最大短路电流（单一值 → X=A 竖直线）
    const sc = E.parseNum(document.getElementById('cc-sc').value);
    const scValid = sc != null && sc > 0;

    // 计算坐标范围（覆盖所有点 + 短路电流线 + 留边）
    let minX = Infinity, maxX = 0, minT = Infinity, maxT = 0;
    valid.forEach((c) => c.points.forEach(([I, t]) => {
      minX = Math.min(minX, I); maxX = Math.max(maxX, I);
      minT = Math.min(minT, t); maxT = Math.max(maxT, t);
    }));
    if (scValid) maxX = Math.max(maxX, sc);
    if (minX === maxX) { maxX = minX * 10; }
    if (minT === maxT) { maxT = minT * 100; }
    const xMinAuto = Math.pow(10, Math.floor(Math.log10(minX)) - 0.5);
    const xMaxAuto = Math.pow(10, Math.ceil(Math.log10(maxX)) + 0.2);
    const yMinAuto = Math.pow(10, Math.floor(Math.log10(minT)) - 0.3);
    const yMaxAuto = Math.pow(10, Math.ceil(Math.log10(maxT)) + 0.3);

    // 用户自定义范围（留空用自动；填反自动交换）
    const rU = {
      xmin: E.parseNum(document.getElementById('cc-xmin').value),
      xmax: E.parseNum(document.getElementById('cc-xmax').value),
      ymin: E.parseNum(document.getElementById('cc-ymin').value),
      ymax: E.parseNum(document.getElementById('cc-ymax').value),
    };
    const pick = (a, auto) => (a != null && a > 0 ? a : auto);
    let xMin = pick(rU.xmin, xMinAuto), xMax = pick(rU.xmax, xMaxAuto);
    let yMin = pick(rU.ymin, yMinAuto), yMax = pick(rU.ymax, yMaxAuto);
    if (xMin >= xMax) { const t = xMin; xMin = xMax; xMax = t; }
    if (yMin >= yMax) { const t = yMin; yMin = yMax; yMax = t; }

    const series = valid.map((c) => ({
      name: `${c.name}（${c.points.length} 点）`,
      color: c.color,
      points: c.points,
    }));

    // 电池包最大短路电流竖直线
    const vLines = [];
    if (scValid) {
      vLines.push({ x: sc, color: '#64748b', label: '电池包最大短路电流 ' + E.fmt(sc) + 'A', dash: true });
    }

    chart.innerHTML = T.chart({
      width: 780,
      height: 460,
      title: document.getElementById('cc-title').value.trim() || undefined,
      x: { min: xMin, max: xMax, label: '电流 I', unit: 'A' },
      y: { min: yMin, max: yMax, label: '时间 t', unit: 's' },
      series,
      vLines,
      note: `
        <strong>说明：</strong>图中曲线由你输入的数据点连线而成（对数刻度）。曲线越低，动作越快、越先脱扣。
        灰色竖线为<b>电池包最大短路电流</b>（X = ${scValid ? E.fmt(sc) + 'A' : '未设置'}）。
        同一故障电流下，应保证<b>下级设备（如保险丝）曲线位于上级设备（如接触器）曲线之下</b>，且各保护曲线应在电芯热失控、线束发烟曲线之上，实现选择性保护。
        两点之间为线性对数插值，更精确请录入更多数据点。X/Y 轴范围可在上方自定义，留空自动。
      `,
    });
  }

  /** 按额定电流估算参考曲线并填入数据表 */
  function fillReferenceToTable() {
    const relayIn = E.parseNum(document.getElementById('rf-relay-in').value);
    const fuseIn = E.parseNum(document.getElementById('rf-fuse-in').value);
    const fuseType = document.getElementById('rf-fuse-type').value;
    if (relayIn == null || fuseIn == null || relayIn <= 0 || fuseIn <= 0) {
      document.getElementById('cc-chart').innerHTML =
        '<div class="status-banner err">请先输入有效的继电器与保险丝额定电流。</div>';
      return;
    }

    const FUSE_ANCHOR = { slow: 1, fast: 0.005 }; // 2×In 处熔断时间(s)
    const Kfuse = FUSE_ANCHOR[fuseType] * Math.pow(2 * fuseIn, 2);
    const Krelay = 1 * Math.pow(2 * relayIn, 2);

    const sample = (start, K, n) => {
      const end = Math.max(1000, start * 10);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const I = start * Math.pow(end / start, i / n);
        pts.push([I, K / (I * I)]);
      }
      return pts;
    };

    const wrap = document.getElementById('cc-curves');
    wrap.innerHTML = '';
    colorIdx = 2;
    addCurve('保险丝 ' + (fuseType === 'slow' ? '慢断' : '快断') + ' ' + E.fmtExact(fuseIn) + 'A', PALETTE[0], sample(fuseIn, Kfuse, 14));
    addCurve('继电器触点 ' + E.fmtExact(relayIn) + 'A', PALETTE[1], sample(relayIn, Krelay, 14));

    renderChart();
  }

  /** 快速自动匹配的数值结论 */
  function matchVerdict() {
    const relayIn = E.parseNum(document.getElementById('rf-relay-in').value);
    const fuseIn = E.parseNum(document.getElementById('rf-fuse-in').value);
    const load = E.parseNum(document.getElementById('rf-load').value);
    const fuseType = document.getElementById('rf-fuse-type').value;
    const loadType = document.getElementById('rf-load-type').value;

    const resultBox = document.getElementById('rf-result');
    if (relayIn == null || fuseIn == null || load == null || relayIn <= 0 || fuseIn <= 0) {
      resultBox.innerHTML = `<div class="status-banner err">请输入有效的额定电流与负载电流数值。</div>`;
      resultBox.style.display = 'block';
      return;
    }

    const checks = [];
    const okList = [], warnList = [], errList = [];

    const marginTable = {
      resistive: { min: 1.10, note: '阻性负载浪涌小，裕量可取下限' },
      motor: { min: 1.25, note: '电机启动电流大，需一定裕量' },
      capacitive: { min: 1.50, note: '容性负载上电浪涌大，裕量宜取大' },
      inrush: { min: 1.50, note: '高浪涌负载，建议选用慢断保险丝' },
    };
    const mt = marginTable[loadType] || marginTable.resistive;

    const fuseLoadRatio = fuseIn / load;
    const fuseRelayRatio = fuseIn / relayIn;
    const relayLoadRatio = relayIn / load;

    if (fuseIn < load) {
      errList.push('保险丝额定电流（' + E.fmt(fuseIn) + ' A）小于负载电流（' + E.fmt(load) + ' A），正常工作时可能误熔断。');
    } else if (fuseIn < load * mt.min) {
      warnList.push('保险丝对负载电流的裕量偏小（比值 ' + fuseLoadRatio.toFixed(2) + '，推荐 ≥ ' + mt.min + '）。' + mt.note + '。');
    } else {
      okList.push('保险丝额定电流 ' + E.fmt(fuseIn) + ' A ≥ 负载电流 ' + E.fmt(load) + ' A × ' + mt.min + '，正常不会误熔断。');
    }

    if (fuseIn > relayIn) {
      errList.push('保险丝额定电流（' + E.fmt(fuseIn) + ' A）大于继电器触点额定电流（' + E.fmt(relayIn) + ' A），故障时触点会先于保险丝损坏。');
    } else if (fuseIn === relayIn) {
      warnList.push('保险丝与继电器额定电流相同（' + E.fmt(fuseIn) + ' A），处于临界，建议保险丝略低于继电器。');
    } else {
      okList.push('保险丝额定电流 ' + E.fmt(fuseIn) + ' A ≤ 继电器触点额定电流 ' + E.fmt(relayIn) + ' A，故障时保险丝先断，可保护触点。');
    }

    if (relayIn < load) {
      errList.push('继电器触点额定电流（' + E.fmt(relayIn) + ' A）小于负载电流（' + E.fmt(load) + ' A），触点无法长期承载。');
    } else if (relayIn < load * mt.min) {
      warnList.push('继电器触点对负载的裕量偏小（比值 ' + relayLoadRatio.toFixed(2) + '，推荐 ≥ ' + mt.min + '）。' + mt.note + '。');
    } else {
      okList.push('继电器触点额定电流 ' + E.fmt(relayIn) + ' A ≥ 负载电流 ' + E.fmt(load) + ' A × ' + mt.min + '，触点承载安全。');
    }

    if (loadType === 'inrush' && fuseType === 'fast') {
      warnList.push('高浪涌负载搭配快断保险丝，可能在正常上电瞬间误熔断，建议改用慢断。');
    }

    let status, statusClass;
    if (errList.length) { status = '匹配不协调：存在保护缺陷，请修正'; statusClass = 'err'; }
    else if (warnList.length) { status = '匹配基本成立，但存在裕量问题'; statusClass = 'warn'; }
    else { status = '匹配协调：继电器、保险丝、负载三者关系合理'; statusClass = 'ok'; }

    const sections = (list, tag) =>
      list.length ? `<div class="status-banner ${tag}">${list.map((s) => '• ' + s).join('<br>')}</div>` : '';

    resultBox.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>匹配结论</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">继电器 / 保险丝 电流比</div>
          <div class="v">${E.fmt(fuseRelayRatio)}<small> In_fuse:In_relay</small></div></div>
        <div class="result-card"><div class="k">保险丝 / 负载 电流比</div>
          <div class="v">${E.fmt(fuseLoadRatio)}<small> In_fuse:I_load</small></div></div>
        <div class="result-card"><div class="k">继电器 / 负载 电流比</div>
          <div class="v">${E.fmt(relayLoadRatio)}<small> In_relay:I_load</small></div></div>
      </div>
      <div class="status-banner ${statusClass}">${status}</div>
      ${sections(errList, 'err')}
      ${sections(warnList, 'warn')}
      ${sections(okList, 'ok')}
    `;
    resultBox.style.display = 'block';
  }

  /** 收集当前页全部校核数据 */
  function collectAll() {
    return {
      version: 1,
      type: 'relay-fuse',
      savedAt: new Date().toISOString(),
      curves: collectCurves(),
      title: document.getElementById('cc-title').value,
      shortCircuit: E.parseNum(document.getElementById('cc-sc').value),
      autoMatch: {
        relayIn: E.parseNum(document.getElementById('rf-relay-in').value),
        fuseIn: E.parseNum(document.getElementById('rf-fuse-in').value),
        load: E.parseNum(document.getElementById('rf-load').value),
        fuseType: document.getElementById('rf-fuse-type').value,
        loadType: document.getElementById('rf-load-type').value,
      },
      range: {
        xmin: document.getElementById('cc-xmin').value,
        xmax: document.getElementById('cc-xmax').value,
        ymin: document.getElementById('cc-ymin').value,
        ymax: document.getElementById('cc-ymax').value,
      },
    };
  }

  /** 导出：下载 JSON 文件 */
  function exportData() {
    const data = collectAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    a.href = url;
    a.download = `保护配合校核_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 导入：将文件数据恢复到页面并重绘 */
  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || data.type !== 'relay-fuse') {
          alert('不是有效的保护配合校核文件（type 不匹配）。');
          return;
        }
        applyAll(data);
      } catch (err) {
        alert('导入失败：文件格式不正确。');
      }
    };
    reader.readAsText(file);
  }

  /** 把数据应用到页面 */
  function applyAll(data) {
    // 重建曲线
    const wrap = document.getElementById('cc-curves');
    wrap.innerHTML = '';
    colorIdx = 0;
    const curves = (data.curves && data.curves.length) ? data.curves : [{ name: '曲线 1', color: PALETTE[0], points: [] }];
    curves.forEach((c) => addCurve(c.name, c.color, c.points || []));

    // 图表名称
    if (data.title != null) document.getElementById('cc-title').value = data.title;

    // 短路电流
    if (data.shortCircuit != null) document.getElementById('cc-sc').value = data.shortCircuit;

    // 自动匹配参数
    const am = data.autoMatch || {};
    if (am.relayIn != null) document.getElementById('rf-relay-in').value = am.relayIn;
    if (am.fuseIn != null) document.getElementById('rf-fuse-in').value = am.fuseIn;
    if (am.load != null) document.getElementById('rf-load').value = am.load;
    if (am.fuseType) document.getElementById('rf-fuse-type').value = am.fuseType;
    if (am.loadType) document.getElementById('rf-load-type').value = am.loadType;

    // 坐标范围
    const r = data.range || {};
    document.getElementById('cc-xmin').value = r.xmin || '';
    document.getElementById('cc-xmax').value = r.xmax || '';
    document.getElementById('cc-ymin').value = r.ymin || '';
    document.getElementById('cc-ymax').value = r.ymax || '';

    renderChart();
    matchVerdict();
  }
})();
