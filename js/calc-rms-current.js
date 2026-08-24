/**
 * 计算器 6：RMS 电流与导线截面积
 *
 * 从电流–时间曲线数据点计算有效（RMS）平均电流，并按载流量密度
 * 推荐铜 / 铝导线的最小截面积与标准规格。
 *
 * 输入仅支持从 Excel 批量粘贴（时间 t / 电流 I 两列），不逐点输入、不逐条展示，
 * 大数据量时只显示解析摘要与计算结果。
 *
 * 数值方法（梯形积分）：
 *   ∫I²dt ≈ Σ (Iₖ² + Iₖ₊₁²)/2 · Δtₖ
 *   ∫Idt  ≈ Σ (Iₖ + Iₖ₊₁)/2 · Δtₖ
 *   I_rms = √(∫I²dt / T)，I_avg = ∫Idt / T，I_peak = max|I|
 *
 * 载流量密度（工程经验值，持续发热校核，正式设计按标准与敷设方式）：
 *   铜 J = 5 A/mm²，铝 J = 3.9 A/mm²
 *   最小截面积 A = I_rms / J，向上取到标准规格。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  // 载流量密度 A/mm²（持续，工程经验）
  const DENSITY = { copper: 5, aluminum: 3.9 };
  // 标准导线截面积（mm²，IEC 60228 常见规格）
  const SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

  // 当前解析得到的电流-时间数据点（内存态，不逐条渲染到 DOM）
  let currentPts = [];

  T.register({
    id: 'rms-current',
    title: 'RMS 电流 / 导线',
    icon: '🔀',
    group: '电气计算',
    desc: '粘贴电流–时间曲线数据，计算 RMS 有效电流，并推荐铜/铝导线最小截面积与标准规格。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>电流–时间数据（Excel 批量粘贴）</h3>
          <div class="paste-box" style="display:block">
            <div class="paste-actions">
              <span class="paste-hint">从 Excel 复制两列（第一列<b>时间 t (s)</b>、第二列<b>电流 I (A)</b>）粘贴到下方。支持制表符 / 逗号 / 空格分隔，每行一个点，首行表头自动忽略。数据点可很多，不会逐条展示。</span>
            </div>
            <textarea class="paste-ta" id="rc-ta" rows="6">0\t0
1\t10
2\t10
3\t5
4\t0</textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="rc-calc">解析并计算 RMS 与截面积</button>
          </div>
        </div>

        <div class="panel" id="rc-result" style="display:none"></div>
      `;

      document.getElementById('rc-calc').addEventListener('click', parseAndCalc);
      parseAndCalc();
    },
  });

  /** 解析文本为 [[t,I],...]，忽略表头与空行，返回按 t 排序 */
  function parseRc(text) {
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

  function parseAndCalc() {
    const text = document.getElementById('rc-ta').value;
    currentPts = parseRc(text);
    calc();
  }

  /** 均匀降采样到 maxN 点，用于绘制大数据量曲线（不改变计算精度） */
  function downsample(pts, maxN) {
    if (!pts || pts.length <= maxN) return pts;
    const out = [];
    for (let i = 0; i < maxN; i++) {
      out.push(pts[Math.floor(i * (pts.length - 1) / (maxN - 1))]);
    }
    return out;
  }

  function calc() {
    const box = document.getElementById('rc-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };

    if (currentPts.length < 2) return bad('解析到的有效数据点不足 2 个，请从 Excel 复制时间/电流两列后粘贴。');

    // 校验时间严格递增
    for (let i = 1; i < currentPts.length; i++) {
      if (currentPts[i][0] <= currentPts[i - 1][0]) {
        return bad('时间 t 必须严格递增（不能重复或倒序），且各点按时间排列。请检查数据。');
      }
    }

    const Ttotal = currentPts[currentPts.length - 1][0] - currentPts[0][0];
    if (Ttotal <= 0) return bad('时间跨度必须大于 0。');

    // 梯形积分
    let intI2 = 0, intI = 0, peak = 0;
    for (let k = 0; k < currentPts.length - 1; k++) {
      const dt = currentPts[k + 1][0] - currentPts[k][0];
      const i1 = currentPts[k][1], i2 = currentPts[k + 1][1];
      intI2 += ((i1 * i1 + i2 * i2) / 2) * dt;
      intI += ((i1 + i2) / 2) * dt;
      peak = Math.max(peak, Math.abs(i1), Math.abs(i2));
    }

    const I_rms = Math.sqrt(intI2 / Ttotal);
    const I_avg = intI / Ttotal;

    const A_cu = I_rms / DENSITY.copper;
    const A_al = I_rms / DENSITY.aluminum;
    const rec_cu = SIZES.find((s) => s >= A_cu) || SIZES[SIZES.length - 1];
    const rec_al = SIZES.find((s) => s >= A_al) || SIZES[SIZES.length - 1];

    // 图表：电流–时间曲线 + 平均电流水平线（大数据点降采样绘图）
    const chart = T.lineChart({
      width: 720,
      height: 360,
      title: `电流–时间曲线（${currentPts.length} 个数据点）`,
      x: { label: '时间 t', unit: 's' },
      y: { label: '电流 I', unit: 'A' },
      series: [{ name: '电流 I(t)', color: '#2563eb', points: downsample(currentPts, 1000) }],
      hLines: [{ y: I_avg, color: '#16a34a', label: `平均电流 I_avg = ${E.fmt(I_avg)} A`, dashed: true }],
    });

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>计算结果</h3>
      <div class="status-banner info">
        已解析 <b>${currentPts.length}</b> 个数据点，时间范围 ${E.fmt(currentPts[0][0])} ~ ${E.fmt(currentPts[currentPts.length - 1][0])} s（数据点不逐条展示）。
      </div>
      <div class="normal-chart-wrap">${chart}</div>
      <div class="result-grid">
        <div class="result-card"><div class="k">RMS 有效电流 I_rms</div>
          <div class="v">${E.fmt(I_rms)}<small> A</small></div></div>
        <div class="result-card"><div class="k">平均电流 I_avg</div>
          <div class="v">${E.fmt(I_avg)}<small> A</small></div></div>
        <div class="result-card"><div class="k">峰值电流 I_peak</div>
          <div class="v">${E.fmt(peak)}<small> A</small></div></div>
        <div class="result-card"><div class="k">数据时长 T</div>
          <div class="v">${E.fmt(Ttotal)}<small> s</small></div></div>
      </div>
      <div class="result-grid">
        <div class="result-card"><div class="k">铜导线最小截面积</div>
          <div class="v">${E.fmt(A_cu)}<small> mm²</small></div>
          <div class="k" style="margin-top:6px">推荐标准规格</div>
          <div class="v" style="font-size:16px">${rec_cu}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">铝导线最小截面积</div>
          <div class="v">${E.fmt(A_al)}<small> mm²</small></div>
          <div class="k" style="margin-top:6px">推荐标准规格</div>
          <div class="v" style="font-size:16px">${rec_al}<small> mm²</small></div></div>
      </div>
      <div class="status-banner ok">
        <b>推荐：</b>铜线 <b>${rec_cu} mm²</b>（按载流量 ${E.fmt(A_cu, 3)} mm² 向上取整）／铝线 <b>${rec_al} mm²</b>。
        RMS 电流 ${E.fmt(I_rms)} A 用于发热校核（热效应与 I² 成正比），故用 RMS 计算截面积。
      </div>
      <div class="note">
        <strong>说明：</strong>
        <ul>
          <li>载流量密度假设铜 5 A/mm²、铝 3.9 A/mm²（持续、一般散热）；正式设计请按导线标准载流量表、敷设方式与环境温度确定；</li>
          <li>若需校核<b>电压降</b>或<b>温升</b>，可在"导体电阻"计算器输入材质与截面积后结合长度计算；</li>
          <li>本页只给出发热校核所需的最小截面积，机械强度、短路热稳定、电压降等需另行校核。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
