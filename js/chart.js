/**
 * 通用双对数（log-log）折线图渲染器 —— 纯 SVG，无外部依赖。
 *
 * 专为"时间-电流"这类宽量程工程曲线设计：X / Y 均按对数刻度。
 * 通过 ElectricalToolkit.chart(logLogChartConfig) 调用，返回 SVG 字符串。
 *
 * 配置项：
 * {
 *   width, height,            // 画布尺寸（px），默认 720 x 420
 *   margin: {t,r,b,l},        // 内边距
 *   x: { min, max, label, unit, ticks:[...] },   // min/max 为数值，自动做 log10
 *   y: { min, max, label, unit, ticks:[...] },
 *   series: [                 // 曲线列表
 *     { name, color, points:[[x,y],...], dashed?, fill? }
 *   ],
 *   vLines: [{ x, color, label, dash }],   // 竖直参考线（如负载电流）
 *   hLines: [{ y, color, label, dash }],   // 水平参考线
 *   note,                    // 图下方小注（HTML）
 * }
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;

  // HTML 转义（T.chart 与 T.normalChart 共用）
  function escapeH(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 生成对数坐标下的一组"好看"刻度值（1,2,5,10,...）
  function niceTicks(min, max) {
    const lo = Math.floor(Math.log10(min));
    const hi = Math.ceil(Math.log10(max));
    const out = [];
    for (let e = lo; e <= hi; e++) {
      [1, 2, 5, 10].forEach((m) => {
        const v = m * Math.pow(10, e);
        if (v >= min && v <= max) out.push(v);
      });
    }
    return out;
  }

  function fmtTick(v) {
    if (v >= 1) {
      return String(+v.toPrecision(3)).replace(/\.0+$/, '');
    }
    return v.toExponential(1).replace('.0', '');
  }

  T.chart = function (cfg) {
    const W = cfg.width || 720;
    const H = cfg.height || 420;
    const m = Object.assign({ t: 30, r: 20, b: 46, l: 62 }, cfg.margin);

    const plotW = W - m.l - m.r;
    const plotH = H - m.t - m.b;

    const xMin = Math.log10(cfg.x.min);
    const xMax = Math.log10(cfg.x.max);
    const yMin = Math.log10(cfg.y.min);
    const yMax = Math.log10(cfg.y.max);

    const px = (v) => m.l + (Math.log10(v) - xMin) / (xMax - xMin) * plotW;
    const py = (v) => m.t + (yMax - Math.log10(v)) / (yMax - yMin) * plotH;

    const xTicks = cfg.x.ticks || niceTicks(cfg.x.min, cfg.x.max);
    const yTicks = cfg.y.ticks || niceTicks(cfg.y.min, cfg.y.max);

    let svg = '';

    // 网格与坐标轴刻度
    xTicks.forEach((t) => {
      const X = px(t);
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t}" x2="${X.toFixed(1)}" y2="${m.t + plotH}" stroke="#eef2f7" stroke-width="1"/>`;
      svg += `<text x="${X.toFixed(1)}" y="${m.t + plotH + 18}" text-anchor="middle" font-size="11" fill="#94a3b8">${fmtTick(t)}</text>`;
    });
    yTicks.forEach((t) => {
      const Y = py(t);
      svg += `<line x1="${m.l}" y1="${Y.toFixed(1)}" x2="${m.l + plotW}" y2="${Y.toFixed(1)}" stroke="#eef2f7" stroke-width="1"/>`;
      svg += `<text x="${m.l - 8}" y="${(Y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#94a3b8">${fmtTick(t)}</text>`;
    });

    // 边框
    svg += `<rect x="${m.l}" y="${m.t}" width="${plotW}" height="${plotH}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;

    // 坐标轴标签
    if (cfg.x.label) {
      svg += `<text x="${m.l + plotW / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#475569" font-weight="600">${cfg.x.label}${cfg.x.unit ? '（' + cfg.x.unit + '）' : ''}</text>`;
    }
    if (cfg.y.label) {
      svg += `<text x="14" y="${m.t + plotH / 2}" text-anchor="middle" font-size="12" fill="#475569" font-weight="600" transform="rotate(-90 14 ${m.t + plotH / 2})">${cfg.y.label}${cfg.y.unit ? '（' + cfg.y.unit + '）' : ''}</text>`;
    }

    // 竖直参考线
    (cfg.vLines || []).forEach((v) => {
      if (v.x <= 0) return;
      const X = px(v.x);
      const color = v.color || '#f59e0b';
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t}" x2="${X.toFixed(1)}" y2="${m.t + plotH}" stroke="${color}" stroke-width="1.4" ${v.dash ? `stroke-dasharray="5 4"` : ''}/>`;
      if (v.label) {
        svg += `<text x="${X.toFixed(1)}" y="${m.t + 12}" text-anchor="middle" font-size="11" fill="${color}" font-weight="600">${v.label}</text>`;
      }
    });

    // 水平参考线
    (cfg.hLines || []).forEach((v) => {
      if (v.y <= 0) return;
      const Y = py(v.y);
      const color = v.color || '#f59e0b';
      svg += `<line x1="${m.l}" y1="${Y.toFixed(1)}" x2="${m.l + plotW}" y2="${Y.toFixed(1)}" stroke="${color}" stroke-width="1.4" ${v.dash ? `stroke-dasharray="5 4"` : ''}/>`;
      if (v.label) {
        svg += `<text x="${m.l + plotW - 6}" y="${(Y - 5).toFixed(1)}" text-anchor="end" font-size="11" fill="${color}" font-weight="600">${v.label}</text>`;
      }
    });

    // 坐标 clamp 到绘图区，避免超出范围的点把线画出框外
    const clampX = (x) => Math.max(m.l, Math.min(m.l + plotW, x));
    const clampY = (y) => Math.max(m.t, Math.min(m.t + plotH, y));

    // 曲线
    (cfg.series || []).forEach((s) => {
      const pts = s.points.filter((p) => p[0] > 0 && p[1] > 0)
        .map((p) => `${clampX(px(p[0])).toFixed(1)},${clampY(py(p[1])).toFixed(1)}`)
        .join(' ');
      if (!pts) return;
      const dash = s.dashed ? ' stroke-dasharray="6 4"' : '';
      svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${dash} ${s.opacity ? `opacity="${s.opacity}"` : ''}/>`;
      if (s.fill) {
        // 填充曲线与图框底部之间的区域（例如"安全区"）
        const area = pts + ` ${px(cfg.x.max).toFixed(1)},${m.t + plotH} ${px(cfg.x.min).toFixed(1)},${m.t + plotH}`;
        svg += `<polygon points="${area}" fill="${s.fill}" fill-opacity="0.15"/>`;
      }
    });

    // 散点（数据点圆点标记，仅当需要时显示；坐标超出范围则跳过）
    (cfg.scatter || []).forEach((s) => {
      (s.points || []).forEach((p) => {
        if (!(p[0] > 0 && p[1] > 0)) return;
        if (p[0] < cfg.x.min || p[0] > cfg.x.max || p[1] < cfg.y.min || p[1] > cfg.y.max) return;
        svg += `<circle cx="${px(p[0]).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="4" fill="#fff" stroke="${s.color}" stroke-width="2.2"/>`;
      });
    });

    // 图例：用 HTML 渲染在图表下方（CSS 网格每行2个、自动换行），与 SVG 图完全分离，避免重叠
    const legendItems = (cfg.series || []).map((s) => ({ color: s.color, name: s.name, dashed: s.dashed }))
      .concat((cfg.vLines || []).map((v) => ({ color: v.color || '#f59e0b', name: v.label || '', dashed: v.dash })))
      .filter((li) => li.name);
    let legendHtml = '';
    if (legendItems.length) {
      legendHtml = '<div class="chart-legend">' + legendItems.map((li) => {
        const swatch = li.dashed
          ? `background:repeating-linear-gradient(90deg, ${li.color} 0 6px, #fff 6px 10px)`
          : `background:${li.color}`;
        return `<div class="chart-legend-item"><span class="legend-swatch" style="${swatch}"></span><span class="legend-name">${escapeH(li.name)}</span></div>`;
      }).join('') + '</div>';
    }

    let out = '';
    if (cfg.title) out += `<div class="chart-title">${escapeH(cfg.title)}</div>`;
    out += `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    out += legendHtml;
    if (cfg.note) out += `<div class="note">${cfg.note}</div>`;
    return out;
  };

  /** 线性坐标刻度（1/2/5 × 10^k） */
  function linearTicks(min, max) {
    const span = max - min;
    if (span <= 0) return [min];
    const raw = span / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = n < 1.5 ? mag : n < 3.5 ? 2 * mag : n < 7.5 ? 5 * mag : 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
      out.push(parseFloat(v.toPrecision(6)));
    }
    return out;
  }

  /**
   * 正态分布公差带图（线性坐标，纯 SVG）。
   * cfg: { mean, sigma, tol, width, height, title, note, tolLabel }
   *  - mean：闭环名义尺寸；sigma：闭环标准差（通常 = T_rss/3）
   *  - tol：设计允许的闭环公差（±tol）；绿色带=合格区，红色带=超差区
   */
  T.normalChart = function (cfg) {
    const W = cfg.width || 720;
    const H = cfg.height || 320;
    const m = Object.assign({ t: 26, r: 24, b: 40, l: 60 }, cfg.margin);
    const plotW = W - m.l - m.r;
    const plotH = H - m.t - m.b;

    const mean = cfg.mean;
    const sigma = cfg.sigma > 0 ? cfg.sigma : 1;
    const tol = cfg.tol > 0 ? cfg.tol : sigma * 3;

    const span = Math.max(4 * sigma, tol * 1.15, sigma);
    const xmin = mean - span;
    const xmax = mean + span;
    const peak = 1 / (sigma * Math.sqrt(2 * Math.PI));
    const ymax = peak * 1.12;

    const px = (v) => m.l + (v - xmin) / (xmax - xmin) * plotW;
    const py = (v) => m.t + (ymax - v) / ymax * plotH;
    const dens = (x) => Math.exp(-((x - mean) * (x - mean)) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

    let svg = '';
    const tolL = px(mean - tol);
    const tolR = px(mean + tol);

    // 公差带：±tol 内绿、之外红
    svg += `<rect x="${tolL.toFixed(1)}" y="${m.t}" width="${(tolR - tolL).toFixed(1)}" height="${plotH}" fill="#dcfce7" fill-opacity="0.5"/>`;
    svg += `<rect x="${m.l}" y="${m.t}" width="${(tolL - m.l).toFixed(1)}" height="${plotH}" fill="#fecaca" fill-opacity="0.4"/>`;
    svg += `<rect x="${tolR.toFixed(1)}" y="${m.t}" width="${(m.l + plotW - tolR).toFixed(1)}" height="${plotH}" fill="#fecaca" fill-opacity="0.4"/>`;

    // 正态曲线
    const nPts = 160;
    let pts = '';
    for (let i = 0; i <= nPts; i++) {
      const x = xmin + (xmax - xmin) * i / nPts;
      pts += px(x).toFixed(1) + ',' + py(dens(x)).toFixed(1) + ' ';
    }
    svg += `<polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linejoin="round"/>`;

    // 参考线：μ、±σ、±3σ、±tol
    const cX = px(mean);
    svg += `<line x1="${cX.toFixed(1)}" y1="${m.t}" x2="${cX.toFixed(1)}" y2="${m.t + plotH}" stroke="#64748b" stroke-width="1.2"/>`;
    svg += `<text x="${cX.toFixed(1)}" y="${m.t + 12}" text-anchor="middle" font-size="11" fill="#64748b">μ 名义</text>`;
    [-1, 1].forEach((k) =>
      svg += `<line x1="${px(mean + k * sigma).toFixed(1)}" y1="${m.t}" x2="${px(mean + k * sigma).toFixed(1)}" y2="${m.t + plotH}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`);
    [-3, 3].forEach((k) =>
      svg += `<line x1="${px(mean + k * sigma).toFixed(1)}" y1="${m.t}" x2="${px(mean + k * sigma).toFixed(1)}" y2="${m.t + plotH}" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="6 4"/>`);
    [tolL, tolR].forEach((X) =>
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t}" x2="${X.toFixed(1)}" y2="${m.t + plotH}" stroke="#16a34a" stroke-width="1.8"/>`);
    svg += `<text x="${tolL.toFixed(1)}" y="${m.t + plotH - 6}" text-anchor="middle" font-size="11" fill="#16a34a">−tol${cfg.tolLabel || ''}</text>`;
    svg += `<text x="${tolR.toFixed(1)}" y="${m.t + plotH - 6}" text-anchor="middle" font-size="11" fill="#16a34a">+tol</text>`;

    // X 轴与刻度
    svg += `<line x1="${m.l}" y1="${m.t + plotH}" x2="${m.l + plotW}" y2="${m.t + plotH}" stroke="#cbd5e1"/>`;
    linearTicks(xmin, xmax).forEach((t) => {
      const X = px(t);
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t + plotH}" x2="${X.toFixed(1)}" y2="${m.t + plotH + 4}" stroke="#94a3b8"/>`;
      svg += `<text x="${X.toFixed(1)}" y="${m.t + plotH + 18}" text-anchor="middle" font-size="11" fill="#94a3b8">${parseFloat(t.toFixed(3))}</text>`;
    });
    // Y 轴
    svg += `<line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + plotH}" stroke="#cbd5e1"/>`;
    svg += `<text x="${m.l - 8}" y="${m.t + 4}" text-anchor="end" font-size="11" fill="#94a3b8">密度</text>`;

    let out = '';
    if (cfg.title) out += `<div class="chart-title">${escapeH(cfg.title)}</div>`;
    out += `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    if (cfg.note) out += `<div class="note">${cfg.note}</div>`;
    return out;
  };

  /**
   * 通用线性折线图（线性坐标，纯 SVG）。
   * cfg: { width, height, title, note,
   *        x:{label,unit}, y:{label,unit},
   *        series:[{name,color,points:[[x,y],...],dashed?}],
   *        hLines:[{y,color,label}] }   // 水平参考线（如平均电流）
   * 坐标范围自动覆盖所有曲线点与水平线并留边。
   */
  T.lineChart = function (cfg) {
    const W = cfg.width || 720;
    const H = cfg.height || 360;
    const m = Object.assign({ t: 34, r: 24, b: 46, l: 64 }, cfg.margin);
    const plotW = W - m.l - m.r;
    const plotH = H - m.t - m.b;

    // 范围
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    (cfg.series || []).forEach((s) => (s.points || []).forEach((p) => {
      if (p[0] < xmin) xmin = p[0];
      if (p[0] > xmax) xmax = p[0];
      if (p[1] < ymin) ymin = p[1];
      if (p[1] > ymax) ymax = p[1];
    }));
    (cfg.hLines || []).forEach((h) => {
      if (h.y < ymin) ymin = h.y;
      if (h.y > ymax) ymax = h.y;
    });
    (cfg.vLines || []).forEach((v) => {
      if (v.x < xmin) xmin = v.x;
      if (v.x > xmax) xmax = v.x;
    });
    (cfg.scatter || []).forEach((s) => (s.points || []).forEach((p) => {
      if (p[0] < xmin) xmin = p[0];
      if (p[0] > xmax) xmax = p[0];
      if (p[1] < ymin) ymin = p[1];
      if (p[1] > ymax) ymax = p[1];
    }));
    if (!Number.isFinite(xmin)) { xmin = 0; xmax = 1; }
    if (xmin === xmax) xmax = xmin + 1;
    if (!Number.isFinite(ymin)) { ymin = 0; ymax = 1; }
    if (ymin === ymax) ymax = ymin + 1;
    const xpad = (xmax - xmin) * 0.05;
    const ypad = (ymax - ymin) * 0.08;
    xmin -= xpad; xmax += xpad; ymin -= ypad; ymax += ypad;

    const px = (v) => m.l + (v - xmin) / (xmax - xmin) * plotW;
    const py = (v) => m.t + (ymax - v) / (ymax - ymin) * plotH;
    const clampX = (x) => Math.max(m.l, Math.min(m.l + plotW, x));
    const clampY = (y) => Math.max(m.t, Math.min(m.t + plotH, y));

    let svg = '';

    // 网格与刻度
    linearTicks(xmin, xmax).forEach((t) => {
      const X = px(t);
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t}" x2="${X.toFixed(1)}" y2="${m.t + plotH}" stroke="#eef2f7"/>`;
      svg += `<text x="${X.toFixed(1)}" y="${m.t + plotH + 18}" text-anchor="middle" font-size="11" fill="#94a3b8">${parseFloat(t.toPrecision(5))}</text>`;
    });
    linearTicks(ymin, ymax).forEach((t) => {
      const Y = py(t);
      svg += `<line x1="${m.l}" y1="${Y.toFixed(1)}" x2="${m.l + plotW}" y2="${Y.toFixed(1)}" stroke="#eef2f7"/>`;
      svg += `<text x="${m.l - 8}" y="${(Y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#94a3b8">${parseFloat(t.toPrecision(5))}</text>`;
    });
    svg += `<rect x="${m.l}" y="${m.t}" width="${plotW}" height="${plotH}" fill="none" stroke="#e2e8f0"/>`;

    // 水平参考线
    (cfg.hLines || []).forEach((h) => {
      const Y = py(h.y);
      const color = h.color || '#16a34a';
      svg += `<line x1="${m.l}" y1="${Y.toFixed(1)}" x2="${m.l + plotW}" y2="${Y.toFixed(1)}" stroke="${color}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      if (h.label) svg += `<text x="${m.l + plotW - 6}" y="${(Y - 6).toFixed(1)}" text-anchor="end" font-size="11" fill="${color}" font-weight="600">${h.label}</text>`;
    });

    // 曲线
    (cfg.series || []).forEach((s) => {
      const pts = (s.points || []).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => `${clampX(px(p[0])).toFixed(1)},${clampY(py(p[1])).toFixed(1)}`)
        .join(' ');
      if (!pts) return;
      svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    });

    // 竖直参考线
    (cfg.vLines || []).forEach((v) => {
      const X = px(v.x);
      const color = v.color || '#f59e0b';
      svg += `<line x1="${X.toFixed(1)}" y1="${m.t}" x2="${X.toFixed(1)}" y2="${m.t + plotH}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
      if (v.label) svg += `<text x="${X.toFixed(1)}" y="${m.t + 12}" text-anchor="middle" font-size="11" fill="${color}" font-weight="600">${v.label}</text>`;
    });

    // 散点（工作点标记）
    (cfg.scatter || []).forEach((s) => {
      (s.points || []).forEach((p) => {
        if (!(p[0] > 0 && p[1] > 0)) return;
        if (p[0] < xmin || p[0] > xmax || p[1] < ymin || p[1] > ymax) return;
        svg += `<circle cx="${px(p[0]).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="5" fill="${s.color || '#dc2626'}" stroke="#fff" stroke-width="1.5"/>`;
      });
    });

    // 坐标轴标签
    if (cfg.x && cfg.x.label) {
      svg += `<text x="${m.l + plotW / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="#475569" font-weight="600">${cfg.x.label}${cfg.x.unit ? '（' + cfg.x.unit + '）' : ''}</text>`;
    }
    if (cfg.y && cfg.y.label) {
      svg += `<text x="14" y="${m.t + plotH / 2}" text-anchor="middle" font-size="12" fill="#475569" font-weight="600" transform="rotate(-90 14 ${m.t + plotH / 2})">${cfg.y.label}${cfg.y.unit ? '（' + cfg.y.unit + '）' : ''}</text>`;
    }

    // HTML 图例（底部，每行2个）
    const legendItems = (cfg.series || []).map((s) => ({ color: s.color, name: s.name, dashed: s.dashed }))
      .concat((cfg.hLines || []).map((h) => ({ color: h.color || '#16a34a', name: h.label || '', dashed: true })))
      .concat((cfg.vLines || []).map((v) => ({ color: v.color || '#f59e0b', name: v.label || '', dashed: true })))
      .filter((li) => li.name);
    let legendHtml = '';
    if (legendItems.length) {
      legendHtml = '<div class="chart-legend">' + legendItems.map((li) => {
        const swatch = li.dashed
          ? `background:repeating-linear-gradient(90deg, ${li.color} 0 6px, #fff 6px 10px)`
          : `background:${li.color}`;
        return `<div class="chart-legend-item"><span class="legend-swatch" style="${swatch}"></span><span class="legend-name">${escapeH(li.name)}</span></div>`;
      }).join('') + '</div>';
    }

    let out = '';
    if (cfg.title) out += `<div class="chart-title">${escapeH(cfg.title)}</div>`;
    out += `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    out += legendHtml;
    if (cfg.note) out += `<div class="note">${cfg.note}</div>`;
    return out;
  };
})();
