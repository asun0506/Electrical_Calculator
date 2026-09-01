/**
 * 计算器 13：汇流排（Busbar）瞬态温升计算
 *
 * 与《汇流排温升计算模型_公式校正版.xls》第三个 Sheet「温升计算」完全一致的算法：
 *   R = ρ·L/(w·t)，S = 2(w+t)·L，m = w·t·L·密度
 *   Tₙ = Tₙ₋₁ + [Iₙ²·R − h·S·(Tₙ₋₁ − Tamb)] ·Δt /(m·Cp)
 *
 * 关键逻辑（对齐表格）：
 *   - 内部时间步长 Δt 可在界面设置（对应 Sheet2「内部时间步长」），示例 0.1 s，复现原表用 1 s。
 *   - 从 Map 首个时间点起以 Δt 固定步长逐拍递推；电流保持规则：同一电流从该时间点保持到下一条数据生效
 *     （I_eff(t) = 最后一个 t_i ≤ t 的输入点电流）。
 *   - 可计算步数 N = ceil(Map 时间跨度 / Δt)，覆盖整个输入时间范围。
 *     （注：旧表“每行固定推进 1 秒”的 floor(输入结束时间) 只在 Δt=1 s 时成立；
 *       0.1 s 采样的满时长输入必须除以 Δt，否则只算到十分之一。）
 *   - 温度取上一采样时刻 Tₙ₋₁。
 * 未计接触/焊接电阻、端部导热、辐射及电阻温度系数。
 *
 * 材料：纯铜 / 纯铝 / 自定义（可调电阻率 ρ、比热容 Cp、密度）。
 * 环境与递推参数：对流换热系数 h、环境温度、初始温度、内部时间步长 均可调整（全部 Sheet2 参数）。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  const MATS = {
    copper: { name: '纯铜 Cu', rho: 1.78e-8, C: 394, dens: 8900 },
    aluminum: { name: '纯铝 Al', rho: 2.83e-8, C: 879, dens: 2700 },
  };

  const CURRENT_DENSITY = { copper: 5, aluminum: 3.9 };
  const WIRE_SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
  const METRIC_EQUIVALENTS = [0.05, 0.08, 0.14, 0.22, 0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

  /** 解析电流–时间文本：[[t,I],...]，按 t 排序 */
  function parseData(text) {
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
      const t = E.parseNum(parts[0]);
      const I = E.parseNum(parts[1]);
      if (t != null && I != null) pts.push([t, I]);
    });
    pts.sort((a, b) => a[0] - b[0]);
    return pts;
  }

  function awgLabel(gauge) {
    return gauge === -3 ? '4/0' : gauge === -2 ? '3/0' : gauge === -1 ? '2/0' : gauge === 0 ? '1/0' : String(gauge);
  }

  function nearestMetric(area) {
    return METRIC_EQUIVALENTS.reduce((best, item) => Math.abs(item - area) < Math.abs(best - area) ? item : best, METRIC_EQUIVALENTS[0]);
  }

  function awgRows() {
    const rows = [];
    for (let gauge = -3; gauge <= 30; gauge += 1) {
      const diameterMm = 0.005 * Math.pow(92, (36 - gauge) / 39) * 25.4;
      const areaMm2 = Math.PI * diameterMm * diameterMm / 4;
      const copperOhmPerKm = 17.241 / areaMm2;
      rows.push(`<tr><td><b>${awgLabel(gauge)}</b></td><td>${diameterMm.toFixed(3)}</td><td>${areaMm2 >= 10 ? areaMm2.toFixed(2) : areaMm2.toFixed(3)}</td><td>${copperOhmPerKm.toFixed(copperOhmPerKm >= 10 ? 2 : 3)}</td><td>${nearestMetric(areaMm2)}</td></tr>`);
    }
    return rows.join('');
  }

  function downsample(pts, maxN) {
    if (!pts || pts.length <= maxN) return pts;
    const out = [];
    for (let i = 0; i < maxN; i++) out.push(pts[Math.floor(i * (pts.length - 1) / (maxN - 1))]);
    return out;
  }

  function wireRecommendation(minArea) {
    const size = WIRE_SIZES.find((item) => item >= minArea);
    return size == null
      ? { label: '> 300 mm²', note: '需采用并联导体或专用大截面规格' }
      : { label: `${size} mm²`, note: '向上取常见公制规格' };
  }

  function currentMetrics(pts) {
    const duration = pts[pts.length - 1][0] - pts[0][0];
    let intI2 = 0, intI = 0, peak = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const dt = pts[k + 1][0] - pts[k][0];
      const i1 = pts[k][1], i2 = pts[k + 1][1];
      intI2 += ((i1 * i1 + i2 * i2) / 2) * dt;
      intI += ((i1 + i2) / 2) * dt;
      peak = Math.max(peak, Math.abs(i1), Math.abs(i2));
    }
    return { duration, rms: Math.sqrt(intI2 / duration), average: intI / duration, peak };
  }

  function readLegacyRmsMap() {
    const drafts = window.CalculatorDrafts;
    if (!drafts || drafts.read('busbar-temp')) return null;
    const legacy = drafts.read('rms-current');
    const saved = legacy && Array.isArray(legacy.form)
      ? legacy.form.find((item) => item.id === 'rc-ta')
      : null;
    return saved && String(saved.value || '').trim() ? String(saved.value) : null;
  }

  window.BusbarTempMath = Object.freeze({ parseData, currentMetrics, wireRecommendation });

  T.register({
    id: 'busbar-temp',
    refreshDraft: calc,
    title: 'RMS 电流 / 线径 / 汇流排温升',
    icon: '🌡️',
    group: '电气计算',
    desc: '一份电流–时间 Map 同时计算 RMS、适用线径与汇流排瞬态温升，并分别绘制电流和温度曲线。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>1. 电流–时间 Map（Excel 批量粘贴）</h3>
          <div class="paste-box" style="display:block">
            <div class="paste-actions">
              <span class="paste-hint">从 Excel 复制两列（第一列<b>时间 t (s)</b>、第二列<b>电流 I (A)</b>）粘贴。时间必须严格递增。RMS / 平均电流按相邻点线性连接并采用梯形积分；温升递推按阶梯保持，即某点电流保持到下一点生效。</span>
              <button class="btn btn-ghost" id="bb-load-sample" type="button" style="padding:4px 10px;font-size:12px;margin-top:6px">载入表格示例数据（复现 600s=63.15°C）</button>
            </div>
            <textarea class="paste-ta" id="bb-ta" rows="5">0\t223
6000\t223</textarea>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>2. 汇流排参数（Sheet2）</h3>
          <div class="grid cols-4">
            <div class="field">
              <label>材料</label>
              <select id="bb-mat">
                <option value="aluminum">纯铝 Al</option>
                <option value="copper">纯铜 Cu</option>
                <option value="custom">＋ 自定义</option>
              </select>
            </div>
            <div class="field"><label>截面宽度 w</label><div class="input-row"><input id="bb-w" type="number" value="24" min="0" step="any"><span class="unit">mm</span></div></div>
            <div class="field"><label>截面厚度 t</label><div class="input-row"><input id="bb-h" type="number" value="3" min="0" step="any"><span class="unit">mm</span></div></div>
            <div class="field"><label>过流长度 L</label><div class="input-row"><input id="bb-len" type="number" value="144" min="0" step="any"><span class="unit">mm</span></div></div>
          </div>
          <div id="bb-custom" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">
            <h4 style="margin:0 0 10px;font-size:14px">自定义材料参数</h4>
            <div class="grid cols-3">
              <div class="field"><label>电阻率 ρ</label><div class="input-row"><input id="bb-rho" type="number" value="2.2e-8" min="0" step="any"><span class="unit">Ω·m</span></div></div>
              <div class="field"><label>比热容 Cp</label><div class="input-row"><input id="bb-c" type="number" value="500" min="0" step="any"><span class="unit">J/(kg·K)</span></div></div>
              <div class="field"><label>密度</label><div class="input-row"><input id="bb-dens" type="number" value="5000" min="0" step="any"><span class="unit">kg/m³</span></div></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>3. 环境、递推与线径推荐参数</h3>
          <div class="grid cols-4">
            <div class="field"><label>对流换热系数 h</label><div class="input-row"><input id="bb-hc" type="number" value="9" min="0" step="any"><span class="unit">W/(m²·K)</span></div></div>
            <div class="field"><label>环境温度 Tamb</label><div class="input-row"><input id="bb-tamb" type="number" value="50" step="any"><span class="unit">°C</span></div></div>
            <div class="field"><label>初始温度 T0</label><div class="input-row"><input id="bb-t0" type="number" value="50" step="any"><span class="unit">°C</span></div></div>
            <div class="field"><label>内部时间步长 Δt</label><div class="input-row"><input id="bb-dt" type="number" value="0.1" min="0.0001" step="any"><span class="unit">s</span></div></div>
          </div>
          <div class="grid cols-2" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">
            <div class="field"><label>铜导线持续载流密度 J<sub>Cu</sub></label><div class="input-row"><input id="bb-j-cu" type="number" value="${CURRENT_DENSITY.copper}" min="0.01" step="any"><span class="unit">A/mm²</span></div></div>
            <div class="field"><label>铝导线持续载流密度 J<sub>Al</sub></label><div class="input-row"><input id="bb-j-al" type="number" value="${CURRENT_DENSITY.aluminum}" min="0.01" step="any"><span class="unit">A/mm²</span></div></div>
          </div>
          <div class="note" style="margin-top:12px">h 取值参考：无绝缘层、塑料壳体内部、自然冷却取 7~10；大面积绝缘层取 5~9；距箱体/电芯近可取大；长度长可取小。<b>内部时间步长 Δt</b> 与表格 Sheet2 一致（示例 0.1 s，复现原表用 1 s）；计算覆盖整个 Map：可计算步数 N = ceil(Map 时间跨度 / Δt)。</div>
          <div class="btn-row">
            <button class="btn btn-primary" id="bb-calc">计算 RMS、线径与温升</button>
          </div>
        </div>

        <div class="panel" id="bb-result" style="display:none"></div>

        <details class="panel">
          <summary style="cursor:pointer;font-weight:700">AWG 线规换算对照表</summary>
          <p style="margin:12px 0;color:var(--text-muted);font-size:13px">按实心圆导体 AWG 几何定义换算；直流电阻按 20 °C 退火铜电阻率估算。绞线外径、镀层、温度与结构会使实际值不同，请以线缆规格书为准。</p>
          <div style="overflow:auto"><table class="param-table" style="min-width:720px"><thead><tr><th>AWG</th><th>导体直径/mm</th><th>截面积/mm²</th><th>铜导体电阻/Ω·km⁻¹</th><th>邻近公制截面积/mm²</th></tr></thead><tbody>${awgRows()}</tbody></table></div>
          <div class="note">换算关系：d(in)=0.005×92<sup>(36-AWG)/39</sup>，A=πd²/4。4/0、3/0、2/0、1/0 分别按 AWG -3、-2、-1、0 计算。</div>
        </details>
      `;

      const legacyMap = readLegacyRmsMap();
      if (legacyMap) {
        document.getElementById('bb-ta').value = legacyMap;
        const hint = document.getElementById('bb-ta').closest('.panel').querySelector('.paste-hint');
        if (hint) hint.insertAdjacentHTML('beforeend', '<br><b>已自动带入原“RMS 电流 / 线径估算”模块的上次 Map。</b>');
      }

      document.getElementById('bb-mat').addEventListener('change', () => {
        document.getElementById('bb-custom').style.display =
          document.getElementById('bb-mat').value === 'custom' ? 'block' : 'none';
        calc();
      });
      ['bb-ta', 'bb-w', 'bb-h', 'bb-len', 'bb-rho', 'bb-c', 'bb-dens', 'bb-hc', 'bb-tamb', 'bb-t0', 'bb-dt', 'bb-j-cu', 'bb-j-al', 'bb-mat']
        .forEach((id) => {
          const el = document.getElementById(id);
          el.addEventListener('input', calc);
        });
      document.getElementById('bb-calc').addEventListener('click', calc);
      const loadBtn = document.getElementById('bb-load-sample');
      if (loadBtn) {
        loadBtn.addEventListener('click', () => {
          const ta = document.getElementById('bb-ta');
          if (window.BUSBAR_SAMPLE_DATA) {
            ta.value = window.BUSBAR_SAMPLE_DATA;
            // 同步 Sheet2 参数（材料/尺寸/h/Tamb/T0/Δt）
            document.getElementById('bb-mat').value = 'aluminum';
            document.getElementById('bb-w').value = 24;
            document.getElementById('bb-h').value = 3;
            document.getElementById('bb-len').value = 144;
            document.getElementById('bb-hc').value = 9;
            document.getElementById('bb-tamb').value = 50;
            document.getElementById('bb-t0').value = 50;
            document.getElementById('bb-dt').value = 0.1;
            document.getElementById('bb-custom').style.display = 'none';
            calc();
          } else {
            ta.value = '示例数据文件未加载（js/busbar-sample-data.js）';
          }
        });
      }
      calc();
    },
  });

  function calc() {
    const E = window.ElUtil;
    const box = document.getElementById('bb-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };

    const matKey = document.getElementById('bb-mat').value;
    let rho, C, dens, matName;
    if (matKey === 'custom') {
      rho = E.parseNum(document.getElementById('bb-rho').value);
      C = E.parseNum(document.getElementById('bb-c').value);
      dens = E.parseNum(document.getElementById('bb-dens').value);
      matName = '自定义材料';
    } else {
      const m = MATS[matKey];
      rho = m.rho; C = m.C; dens = m.dens; matName = m.name;
    }
    if (!rho || !C || !dens || rho <= 0 || C <= 0 || dens <= 0) return bad('自定义材料需填写电阻率、比热容、密度。');

    const wmm = E.parseNum(document.getElementById('bb-w').value);
    const tmm = E.parseNum(document.getElementById('bb-h').value);
    const Lmm = E.parseNum(document.getElementById('bb-len').value);
    const hc = E.parseNum(document.getElementById('bb-hc').value);
    const Tamb = E.parseNum(document.getElementById('bb-tamb').value);
    const T0 = E.parseNum(document.getElementById('bb-t0').value);
    const dt = E.parseNum(document.getElementById('bb-dt').value);
    const jCu = E.parseNum(document.getElementById('bb-j-cu').value);
    const jAl = E.parseNum(document.getElementById('bb-j-al').value);
    if (![wmm, tmm, Lmm, hc, Tamb, T0, dt, jCu, jAl].every((v) => v != null)) return bad('请填写所有参数。');
    if (wmm <= 0 || tmm <= 0 || Lmm <= 0 || hc <= 0 || dt <= 0 || jCu <= 0 || jAl <= 0) return bad('截面宽/厚、长度、换热系数、内部步长及载流密度须 > 0。');

    const pts = parseData(document.getElementById('bb-ta').value);
    if (pts.length < 2) return bad('解析到的电流–时间数据点不足 2 个。');
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] <= pts[i - 1][0]) return bad(`第 ${i + 1} 个时间点未严格递增。`);
    }

    // 几何与材料（SI）
    const w = wmm / 1000, t = tmm / 1000, L = Lmm / 1000;
    const area = w * t;                    // m²
    const surface = 2 * (w + t) * L;       // m²，不计两端面
    const mass = area * L * dens;          // kg
    const R = rho * L / area;              // Ω
    const mCp = mass * C;                  // J/K

    // 可计算步数 N = ceil(Map 时间跨度 / Δt)，覆盖整个输入时间范围
    // （旧表“每行固定推进 1 秒”的 floor(输入结束时间) 只在 Δt=1s 时成立；
    //   对 0.1s 采样的满时长输入，必须除以 Δt 才能算满全程）
    const tMin = pts[0][0];
    const tMax = pts[pts.length - 1][0];
    const mapDuration = tMax - tMin;
    if (mapDuration <= 0) return bad('电流 Map 的时间跨度必须大于 0。');
    const N = Math.max(1, Math.ceil(mapDuration / dt));
    const tEnd = tMin + N * dt;            // 可计算结束时间

    // 与 Sheet3 一致的固定步长递推
    const points = [];
    let Tcur = T0;
    const I0 = pts[0][1];
    const joule0 = I0 * I0 * R;
    const conv0 = hc * surface * (T0 - Tamb);
    points.push({
      time: tMin, current: I0, temperature: Tcur, rise: Tcur - Tamb,
      joule: joule0, conv: conv0, net: joule0 - conv0, step: 0,
    });
    // 用指针推进的电流查找（输入点数大时避免 O(N²) 全表扫描）
    let ptr = 0;
    for (let k = 1; k <= N; k++) {
      const tNow = tMin + k * dt;
      while (ptr + 1 < pts.length && pts[ptr + 1][0] <= tNow + 1e-12) ptr++;
      const I = pts[ptr][1];
      const joule = I * I * R;
      const conv = hc * surface * (Tcur - Tamb);
      const net = joule - conv;
      Tcur += net * dt / mCp;
      points.push({
        time: tNow, current: I, temperature: Tcur, rise: Tcur - Tamb,
        joule: joule, conv: conv, net: net, step: dt,
      });
    }

    // 汇总
    let tMaxT = T0, tAt = tMin;
    points.forEach((p) => { if (p.temperature > tMaxT) { tMaxT = p.temperature; tAt = p.time; } });
    const riseMax = tMaxT - Tamb;
    const tFinal = points[points.length - 1].temperature;

    // RMS / 平均值按 Map 相邻点线性连接并作梯形积分；分母使用实际时间跨度。
    const metrics = currentMetrics(pts);
    const I_rms = metrics.rms;
    const I_avg = metrics.average;
    const peak = metrics.peak;
    const minCu = I_rms / jCu;
    const minAl = I_rms / jAl;
    const recCu = wireRecommendation(minCu);
    const recAl = wireRecommendation(minAl);
    const Tsteady = Tamb + I_rms * I_rms * R / (hc * surface);

    const currentChart = T.lineChart({
      width: 780, height: 360,
      title: `电流–时间曲线（${pts.length} 个 Map 点）`,
      x: { label: '时间 t', unit: 's' },
      y: { label: '电流 I', unit: 'A' },
      series: [{ name: '输入电流 I(t)', color: '#2563eb', points: downsample(pts, 1000) }],
      hLines: [{ y: I_avg, color: '#16a34a', label: `平均电流 ${E.fmt(I_avg)} A`, dashed: true }],
    });

    const temperatureChart = T.lineChart({
      width: 780, height: 420,
      title: `汇流排温升曲线（${matName}，I_rms=${E.fmt(I_rms)} A）`,
      x: { label: '时间 t', unit: 's' },
      y: { label: '温度 T', unit: '°C' },
      series: [{ name: '温度 T(t)', color: '#dc2626', points: points.map((p) => [p.time, p.temperature]) }],
      hLines: [
        { y: Tamb, color: '#64748b', label: `环境温度 ${E.fmt(Tamb)}°C` },
        { y: Tsteady, color: '#16a34a', label: `稳态参考 ${E.fmt(Tsteady)}°C`, dashed: true },
      ],
    });

    // 明细表（与 Sheet3 列一致）；行数过多时等间隔抽样避免卡顿
    const maxRows = 4000;
    const stride = Math.max(1, Math.ceil(points.length / maxRows));
    let detailRows = '';
    for (let k = 0; k < points.length; k += stride) {
      const p = points[k];
      detailRows += `<tr><td>${E.fmt(p.time)}</td><td>${E.fmt(p.current)}</td><td>${E.fmt(p.temperature)}</td><td>${E.fmt(p.rise)}</td><td>${E.fmt(p.joule)}</td><td>${E.fmt(p.conv)}</td><td>${E.fmt(p.net)}</td><td>${E.fmt(p.step)}</td></tr>`;
    }
    // 保证末尾行一定在内
    const last = points[points.length - 1];
    if ((points.length - 1) % stride !== 0) {
      detailRows += `<tr><td>${E.fmt(last.time)}</td><td>${E.fmt(last.current)}</td><td>${E.fmt(last.temperature)}</td><td>${E.fmt(last.rise)}</td><td>${E.fmt(last.joule)}</td><td>${E.fmt(last.conv)}</td><td>${E.fmt(last.net)}</td><td>${E.fmt(last.step)}</td></tr>`;
    }

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>综合计算结果</h3>
      <h4 style="margin:4px 0 10px">电流 Map 指标</h4>
      <div class="result-grid">
        <div class="result-card"><div class="k">RMS 有效电流</div><div class="v">${E.fmt(I_rms)}<small> A</small></div></div>
        <div class="result-card"><div class="k">平均电流</div><div class="v">${E.fmt(I_avg)}<small> A</small></div></div>
        <div class="result-card"><div class="k">峰值电流 |I|<sub>max</sub></div><div class="v">${E.fmt(peak)}<small> A</small></div></div>
        <div class="result-card"><div class="k">Map 时间跨度</div><div class="v">${E.fmt(mapDuration)}<small> s</small></div></div>
      </div>
      <h4 style="margin:16px 0 10px">适用线径推荐</h4>
      <div class="result-grid">
        <div class="result-card"><div class="k">铜导线最小截面积（${E.fmt(jCu)} A/mm²）</div><div class="v">${E.fmt(minCu)}<small> mm²</small></div><div class="k" style="margin-top:6px">推荐 ${recCu.label} · ${recCu.note}</div></div>
        <div class="result-card"><div class="k">铝导线最小截面积（${E.fmt(jAl)} A/mm²）</div><div class="v">${E.fmt(minAl)}<small> mm²</small></div><div class="k" style="margin-top:6px">推荐 ${recAl.label} · ${recAl.note}</div></div>
        <div class="result-card"><div class="k">当前汇流排截面积</div><div class="v">${E.fmt(wmm * tmm)}<small> mm²</small></div><div class="k" style="margin-top:6px">RMS 电流密度 ${E.fmt(I_rms / (wmm * tmm))} A/mm²</div></div>
      </div>
      <div class="note" style="margin-top:12px">线径推荐是基于 RMS 热效应与所填持续载流密度的工程初选。正式选型还需按线缆标准、绝缘温度等级、敷设方式、环境温度、电压降、短路热稳定和端子适配校核。</div>
      <div class="normal-chart-wrap">${currentChart}</div>
      <h4 style="margin:16px 0 10px">汇流排温升指标</h4>
      <div class="result-grid">
        <div class="result-card"><div class="k">最高温度</div><div class="v">${E.fmt(tMaxT)}<small> °C @ ${E.fmt(tAt)}s</small></div></div>
        <div class="result-card"><div class="k">最大温升（相对环境）</div><div class="v">${E.fmt(riseMax)}<small> K</small></div></div>
        <div class="result-card"><div class="k">末段温度</div><div class="v">${E.fmt(tFinal)}<small> °C @ ${E.fmt(last.time)}s</small></div></div>
        <div class="result-card"><div class="k">可计算结束时间</div><div class="v">${E.fmt(tEnd)}<small> s（${N} 步 × Δt ${E.fmt(dt)} s）</small></div></div>
        <div class="result-card"><div class="k">汇流排电阻 R</div><div class="v">${E.fmt(R * 1e6)}<small> μΩ</small></div></div>
        <div class="result-card"><div class="k">稳态参考（RMS）</div><div class="v">${E.fmt(Tsteady)}<small> °C</small></div></div>
      </div>
      <div class="note" style="margin-top:12px">
        <strong>派生参数（Sheet2）：</strong>截面积 A = ${E.fmt(area)} m² ｜ 散热面积 S = ${E.fmt(surface)} m² ｜ 质量 m = ${E.fmt(mass)} kg ｜ 电阻 R = ${E.fmt(R)} Ω ｜ Map 范围 = ${E.fmt(tMin)} ~ ${E.fmt(tMax)} s ｜ 可计算结束时间 = ${E.fmt(tEnd)} s。
      </div>
      <div class="normal-chart-wrap">${temperatureChart}</div>
      <div class="note">
        <strong>说明（与表格第三个 Sheet「温升计算」一致）：</strong>
        固定内部步长 Δt = ${E.fmt(dt)} s 逐拍递推，温度取上一采样时刻：Tₙ = Tₙ₋₁ + [Iₙ²·R − h·S·(Tₙ₋₁−Tamb)]·Δt/(m·Cp)。
        电流保持规则：同一电流从该时间点保持到下一条数据生效。可计算步数 N = ceil(Map 时间跨度 / Δt) = ${N}，可计算结束时间 = ${E.fmt(tEnd)} s。
        共 ${points.length} 个计算点${stride > 1 ? `，明细表按步长 ${stride} 抽样显示` : ''}。
        未计接触/焊接电阻、端部导热、辐射及电阻温度系数。
      </div>
      <div class="normal-chart-wrap">
        <h4 style="margin:0 0 8px;font-size:14px">递推明细（时间 / 生效电流 / 温度 / 温升 / 焦耳热 / 对流散热 / 净热功率 / 时间步长）</h4>
        <div style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:8px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead style="position:sticky;top:0;background:var(--bg);">
              <tr>
                <th style="padding:4px 8px;text-align:left">时间(s)</th>
                <th style="padding:4px 8px;text-align:right">电流(A)</th>
                <th style="padding:4px 8px;text-align:right">温度(℃)</th>
                <th style="padding:4px 8px;text-align:right">温升(K)</th>
                <th style="padding:4px 8px;text-align:right">焦耳热(W)</th>
                <th style="padding:4px 8px;text-align:right">对流(W)</th>
                <th style="padding:4px 8px;text-align:right">净热(W)</th>
                <th style="padding:4px 8px;text-align:right">步长(s)</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>
        </div>
      </div>
    `;
    box.style.display = 'block';
  }
})();
