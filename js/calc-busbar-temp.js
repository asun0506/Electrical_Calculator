/**
 * 计算器 13：汇流排（Busbar）瞬态温升计算
 *
 * 与《汇流排温升计算模型_公式校正版.xls》第三个 Sheet「温升计算」完全一致的算法：
 *   R = ρ·L/(w·t)，S = 2(w+t)·L，m = w·t·L·密度
 *   Tₙ = Tₙ₋₁ + [Iₙ²·R − h·S·(Tₙ₋₁ − Tamb)] ·Δt /(m·Cp)
 *
 * 关键逻辑（对齐表格）：
 *   - 内部时间步长 Δt 可在界面设置（对应 Sheet2「内部时间步长」），示例 0.1 s，复现原表用 1 s。
 *   - 从 t=0 起以 Δt 固定步长逐拍递推；电流保持规则：同一电流从该时间点保持到下一条数据生效
 *     （I_eff(t) = 最后一个 t_i ≤ t 的输入点电流）。
 *   - 可计算步数 N = ceil(输入结束时间 / Δt)，可计算结束时间 = N·Δt，覆盖整个输入时间范围。
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

  T.register({
    id: 'busbar-temp',
    refreshDraft: calc,
    title: '汇流排温升',
    icon: '🌡️',
    group: '电气计算',
    desc: '与《汇流排温升计算模型_公式校正版》第三个 Sheet「温升计算」完全一致的算法：内部步长 Δt 固定递推、电流保持规则、可调全部 Sheet2 参数。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>电流–时间数据（Excel 批量粘贴）</h3>
          <div class="paste-box" style="display:block">
            <div class="paste-actions">
              <span class="paste-hint">从 Excel 复制两列（第一列<b>时间 t (s)</b>、第二列<b>电流 I (A)</b>）粘贴。时间必须递增；同一电流从该时间点保持到下一条数据生效。以内部步长 Δt 固定步进递推，温度取上一采样时刻 Tₙ₋₁。</span>
              <button class="btn btn-ghost" id="bb-load-sample" type="button" style="padding:4px 10px;font-size:12px;margin-top:6px">载入表格示例数据（复现 600s=63.15°C）</button>
            </div>
            <textarea class="paste-ta" id="bb-ta" rows="5">0\t223
6000\t223</textarea>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>汇流排参数（Sheet2）</h3>
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
          <h3 class="panel-title"><span class="dot"></span>环境与递推参数（Sheet2）</h3>
          <div class="grid cols-4">
            <div class="field"><label>对流换热系数 h</label><div class="input-row"><input id="bb-hc" type="number" value="9" min="0" step="any"><span class="unit">W/(m²·K)</span></div></div>
            <div class="field"><label>环境温度 Tamb</label><div class="input-row"><input id="bb-tamb" type="number" value="50" step="any"><span class="unit">°C</span></div></div>
            <div class="field"><label>初始温度 T0</label><div class="input-row"><input id="bb-t0" type="number" value="50" step="any"><span class="unit">°C</span></div></div>
            <div class="field"><label>内部时间步长 Δt</label><div class="input-row"><input id="bb-dt" type="number" value="0.1" min="0.0001" step="any"><span class="unit">s</span></div></div>
          </div>
          <div class="note" style="margin-top:12px">h 取值参考：无绝缘层、塑料壳体内部、自然冷却取 7~10；大面积绝缘层取 5~9；距箱体/电芯近可取大；长度长可取小。<b>内部时间步长 Δt</b> 与表格 Sheet2 一致（示例 0.1 s，复现原表用 1 s）；计算覆盖整个输入时间范围：可计算步数 N = ceil(输入结束时间 / Δt)。</div>
          <div class="btn-row">
            <button class="btn btn-primary" id="bb-calc">计算温升</button>
          </div>
        </div>

        <div class="panel" id="bb-result" style="display:none"></div>
      `;

      document.getElementById('bb-mat').addEventListener('change', () => {
        document.getElementById('bb-custom').style.display =
          document.getElementById('bb-mat').value === 'custom' ? 'block' : 'none';
        calc();
      });
      ['bb-ta', 'bb-w', 'bb-h', 'bb-len', 'bb-rho', 'bb-c', 'bb-dens', 'bb-hc', 'bb-tamb', 'bb-t0', 'bb-dt', 'bb-mat']
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
    if (![wmm, tmm, Lmm, hc, Tamb, T0, dt].every((v) => v != null)) return bad('请填写所有参数。');
    if (wmm <= 0 || tmm <= 0 || Lmm <= 0 || hc <= 0 || dt <= 0) return bad('截面宽/厚、长度、换热系数、内部步长须 > 0。');

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

    // 可计算步数 N = ceil(输入结束时间 / Δt)，覆盖整个输入时间范围
    // （旧表“每行固定推进 1 秒”的 floor(输入结束时间) 只在 Δt=1s 时成立；
    //   对 0.1s 采样的满时长输入，必须除以 Δt 才能算满全程）
    const tMax = pts[pts.length - 1][0];
    const N = Math.max(1, Math.ceil(tMax / dt));
    const tEnd = N * dt;                   // 可计算结束时间

    // 与 Sheet3 一致的固定步长递推
    const points = [];
    let Tcur = T0;
    const I0 = pts[0][1];
    const joule0 = I0 * I0 * R;
    const conv0 = hc * surface * (T0 - Tamb);
    points.push({
      time: 0, current: I0, temperature: Tcur, rise: Tcur - Tamb,
      joule: joule0, conv: conv0, net: joule0 - conv0, step: 0,
    });
    // 用指针推进的电流查找（输入点数大时避免 O(N²) 全表扫描）
    let ptr = 0;
    for (let k = 1; k <= N; k++) {
      const tNow = k * dt;
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
    let tMaxT = T0, tAt = 0;
    points.forEach((p) => { if (p.temperature > tMaxT) { tMaxT = p.temperature; tAt = p.time; } });
    const riseMax = tMaxT - Tamb;
    const tFinal = points[points.length - 1].temperature;

    // 稳态参考（用 RMS 电流，按输入数据梯形积分）
    let intI2 = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const dtt = pts[k + 1][0] - pts[k][0];
      const i1 = pts[k][1], i2 = pts[k + 1][1];
      intI2 += ((i1 * i1 + i2 * i2) / 2) * dtt;
    }
    const I_rms = tMax > 0 ? Math.sqrt(intI2 / tMax) : 0;
    const Tsteady = Tamb + I_rms * I_rms * R / (hc * surface);

    const chart = T.lineChart({
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
      <h3 class="panel-title"><span class="dot"></span>温升计算结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">最高温度</div><div class="v">${E.fmt(tMaxT)}<small> °C @ ${E.fmt(tAt)}s</small></div></div>
        <div class="result-card"><div class="k">最大温升（相对环境）</div><div class="v">${E.fmt(riseMax)}<small> K</small></div></div>
        <div class="result-card"><div class="k">末段温度</div><div class="v">${E.fmt(tFinal)}<small> °C @ ${E.fmt(last.time)}s</small></div></div>
        <div class="result-card"><div class="k">可计算结束时间</div><div class="v">${E.fmt(tEnd)}<small> s（${N} 步 × Δt ${E.fmt(dt)} s）</small></div></div>
        <div class="result-card"><div class="k">汇流排电阻 R</div><div class="v">${E.fmt(R * 1e6)}<small> μΩ</small></div></div>
        <div class="result-card"><div class="k">稳态参考（RMS）</div><div class="v">${E.fmt(Tsteady)}<small> °C</small></div></div>
      </div>
      <div class="note" style="margin-top:12px">
        <strong>派生参数（Sheet2）：</strong>截面积 A = ${E.fmt(area)} m² ｜ 散热面积 S = ${E.fmt(surface)} m² ｜ 质量 m = ${E.fmt(mass)} kg ｜ 电阻 R = ${E.fmt(R)} Ω ｜ 输入结束时间 = ${E.fmt(tMax)} s ｜ 可计算结束时间 = ${E.fmt(tEnd)} s。
      </div>
      <div class="normal-chart-wrap">${chart}</div>
      <div class="note">
        <strong>说明（与表格第三个 Sheet「温升计算」一致）：</strong>
        固定内部步长 Δt = ${E.fmt(dt)} s 逐拍递推，温度取上一采样时刻：Tₙ = Tₙ₋₁ + [Iₙ²·R − h·S·(Tₙ₋₁−Tamb)]·Δt/(m·Cp)。
        电流保持规则：同一电流从该时间点保持到下一条数据生效。可计算步数 N = ceil(输入结束时间 / Δt) = ${N}，可计算结束时间 = ${E.fmt(tEnd)} s。
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
