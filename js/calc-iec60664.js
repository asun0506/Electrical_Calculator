/**
 * 计算器 8：IEC 60664-1 电气间隙 / 爬电距离
 *
 * 输入：系统（对地）工作电压、海拔、污染等级、材料组别。
 *
 * 输出：
 *  1. 额定冲击耐受电压 U_imp = ceil((2·U + 1000) × 1.414)（V，向上取整）
 *  2. 电气间隙（mm）= 表 F.2（Case A 非均匀场，按 U_imp × 污染等级）× 海拔修正系数
 *  3. 爬电距离（mm）= 表 F.5（按工作电压 + 污染等级 + 材料组别）
 *
 * 材料组别按相对漏电起痕指数 CTI：I≥600；II 400~600；IIIa 175~400；IIIb 100~175。
 * 表 F.5 中 PD2 材料组 III、PD3 材料组 IIIb 直接采用标准列；IIIa 在 PD3 按 IIIb 列取值。
 * 数据依据 IEC 60664-1 表 F.2 / F.5（Case A）与海拔系数，查表一律向上取整到最近档位。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  // 表 F.2 —— 电气间隙（mm），Case A 非均匀场，按额定冲击耐受电压(kV) × 污染等级
  const GAP_A = {
    0.33: { PD1: 0.01, PD2: 0.2, PD3: 0.8 },
    0.4: { PD1: 0.02, PD2: 0.2, PD3: 0.8 },
    0.5: { PD1: 0.04, PD2: 0.2, PD3: 0.8 },
    0.6: { PD1: 0.06, PD2: 0.2, PD3: 0.8 },
    0.8: { PD1: 0.10, PD2: 0.2, PD3: 0.8 },
    1: { PD1: 0.15, PD2: 0.2, PD3: 0.8 },
    1.2: { PD1: 0.25, PD2: 0.25, PD3: 0.8 },
    1.5: { PD1: 0.5, PD2: 0.5, PD3: 0.8 },
    2: { PD1: 1, PD2: 1, PD3: 1 },
    2.5: { PD1: 1.5, PD2: 1.5, PD3: 1.5 },
    3: { PD1: 2, PD2: 2, PD3: 2 },
    4: { PD1: 3, PD2: 3, PD3: 3 },
    5: { PD1: 4, PD2: 4, PD3: 4 },
    6: { PD1: 5.5, PD2: 5.5, PD3: 5.5 },
    8: { PD1: 8, PD2: 8, PD3: 8 },
    10: { PD1: 11, PD2: 11, PD3: 11 },
    12: { PD1: 14, PD2: 14, PD3: 14 },
    15: { PD1: 18, PD2: 18, PD3: 18 },
    20: { PD1: 25, PD2: 25, PD3: 25 },
    25: { PD1: 33, PD2: 33, PD3: 33 },
    30: { PD1: 40, PD2: 40, PD3: 40 },
    40: { PD1: 60, PD2: 60, PD3: 60 },
    50: { PD1: 75, PD2: 75, PD3: 75 },
    60: { PD1: 90, PD2: 90, PD3: 90 },
    80: { PD1: 130, PD2: 130, PD3: 130 },
    100: { PD1: 170, PD2: 170, PD3: 170 },
  };

  // 海拔修正系数（2000m 基准）
  const ALT = [
    [2000, 1.00], [3000, 1.14], [4000, 1.29], [5000, 1.48], [6000, 1.70],
    [7000, 1.95], [8000, 2.25], [9000, 2.62], [10000, 3.02],
  ];

  // 表 F.5 —— 爬电距离（mm），按工作电压档位 × 污染等级 × 材料组别（IEC 60664-1 准确数据）
  const CREEP = {
    10: { PD1: 0.08, PD2: { I: 0.4, II: 0.4, III: 0.4 }, PD3: { I: 1, II: 1, IIIb: 1 } },
    12.5: { PD1: 0.09, PD2: { I: 0.42, II: 0.42, III: 0.42 }, PD3: { I: 1.05, II: 1.05, IIIb: 1.05 } },
    16: { PD1: 0.1, PD2: { I: 0.45, II: 0.45, III: 0.45 }, PD3: { I: 1.1, II: 1.1, IIIb: 1.1 } },
    20: { PD1: 0.11, PD2: { I: 0.48, II: 0.48, III: 0.48 }, PD3: { I: 1.2, II: 1.2, IIIb: 1.2 } },
    25: { PD1: 0.125, PD2: { I: 0.5, II: 0.5, III: 0.5 }, PD3: { I: 1.25, II: 1.25, IIIb: 1.25 } },
    32: { PD1: 0.14, PD2: { I: 0.53, II: 0.53, III: 0.53 }, PD3: { I: 1.3, II: 1.3, IIIb: 1.3 } },
    40: { PD1: 0.16, PD2: { I: 0.56, II: 0.8, III: 1.1 }, PD3: { I: 1.4, II: 1.6, IIIb: 1.8 } },
    50: { PD1: 0.18, PD2: { I: 0.6, II: 0.85, III: 1.2 }, PD3: { I: 1.5, II: 1.7, IIIb: 1.9 } },
    63: { PD1: 0.2, PD2: { I: 0.63, II: 0.9, III: 1.25 }, PD3: { I: 1.6, II: 1.8, IIIb: 2 } },
    80: { PD1: 0.22, PD2: { I: 0.67, II: 0.95, III: 1.3 }, PD3: { I: 1.7, II: 1.9, IIIb: 2.1 } },
    100: { PD1: 0.25, PD2: { I: 0.71, II: 1, III: 1.4 }, PD3: { I: 1.8, II: 2, IIIb: 2.2 } },
    125: { PD1: 0.28, PD2: { I: 0.75, II: 1.05, III: 1.5 }, PD3: { I: 1.9, II: 2.1, IIIb: 2.4 } },
    160: { PD1: 0.32, PD2: { I: 0.8, II: 1.1, III: 1.6 }, PD3: { I: 2, II: 2.2, IIIb: 2.5 } },
    200: { PD1: 0.42, PD2: { I: 1, II: 1.4, III: 2 }, PD3: { I: 2.5, II: 2.8, IIIb: 3.2 } },
    250: { PD1: 0.56, PD2: { I: 1.25, II: 1.8, III: 2.5 }, PD3: { I: 3.2, II: 3.6, IIIb: 4 } },
    320: { PD1: 0.75, PD2: { I: 1.6, II: 2.2, III: 3.2 }, PD3: { I: 4, II: 4.5, IIIb: 5 } },
    400: { PD1: 1, PD2: { I: 2, II: 2.8, III: 4 }, PD3: { I: 5, II: 5.6, IIIb: 6.3 } },
    500: { PD1: 1.3, PD2: { I: 2.5, II: 3.6, III: 5 }, PD3: { I: 6.3, II: 7.1, IIIb: 8 } },
    630: { PD1: 1.8, PD2: { I: 3.2, II: 4.5, III: 6.3 }, PD3: { I: 8, II: 9, IIIb: 10 } },
    800: { PD1: 2.4, PD2: { I: 4, II: 5.6, III: 8 }, PD3: { I: 10, II: 11, IIIb: 12.5 } },
    1000: { PD1: 3.2, PD2: { I: 5, II: 7.1, III: 10 }, PD3: { I: 12.5, II: 14, IIIb: 16 } },
    1250: { PD1: 4.2, PD2: { I: 6.3, II: 9, III: 12.5 }, PD3: { I: 16, II: 18, IIIb: 20 } },
    1600: { PD1: 5.6, PD2: { I: 8, II: 11, III: 16 }, PD3: { I: 20, II: 22, IIIb: 25 } },
    2000: { PD1: 7.5, PD2: { I: 10, II: 14, III: 20 }, PD3: { I: 25, II: 28, IIIb: 32 } },
    2500: { PD1: 10, PD2: { I: 12.5, II: 18, III: 25 }, PD3: { I: 32, II: 36, IIIb: 40 } },
    3200: { PD1: 12.5, PD2: { I: 16, II: 22, III: 32 }, PD3: { I: 40, II: 45, IIIb: 50 } },
  };

  // 材料组别 → 表 F.5 列名（PD2 有 III 列、PD3 有 IIIb 列；IIIa 在 PD3 按 IIIb 列取值）
  const MG_COL = {
    PD2: { I: 'I', II: 'II', IIIa: 'III', IIIb: 'III' },
    PD3: { I: 'I', II: 'II', IIIa: 'IIIb', IIIb: 'IIIb' },
  };

  const MATGRP_LABEL = {
    I: '材料组别 I（CTI ≥ 600）',
    II: '材料组别 II（400 ≤ CTI < 600）',
    IIIa: '材料组别 IIIa（175 ≤ CTI < 400）',
    IIIb: '材料组别 IIIb（100 ≤ CTI < 175）',
  };

  /** 升序对象表找第一个 key >= 目标值的档位，返回 { level, val } */
  function lookupRow(table, key) {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      if (key <= k) return { level: k, val: table[k] };
    }
    const last = keys[keys.length - 1];
    return { level: last, val: table[last] };
  }

  /** 升序数组表找第一个 key >= 目标值的档位，返回其值（用于海拔系数） */
  function lookupGe(table, key) {
    for (let i = 0; i < table.length; i++) {
      if (key <= table[i][0]) return table[i][1];
    }
    return table[table.length - 1][1];
  }

  // 供系统级三级校核模块复用同一套标准数据与查表逻辑。
  window.IEC60664Core = Object.freeze({
    calculate(input) {
      const U = E.parseNum(input.voltage);
      const alt = E.parseNum(input.altitude);
      const pd = String(input.pollution || '2');
      const mg = input.material || 'IIIa';
      if (U == null || U <= 0 || alt == null || alt < 0 || !['1', '2', '3'].includes(pd) || !MATGRP_LABEL[mg]) {
        return { valid: false, error: '请填写有效的工作电压、海拔、污染等级和材料组别。' };
      }
      if (U > 3200) return { valid: false, error: '工作电压超过当前表 F.5 数据范围（3200 V），需按适用标准人工确认。' };
      const impulseV = Math.ceil((2 * U + 1000) * 1.414);
      const impulseKV = impulseV / 1000;
      const gapRow = lookupRow(GAP_A, impulseKV);
      const gapBase = gapRow.val['PD' + pd];
      const altitudeFactor = lookupGe(ALT, Math.max(alt, 2000));
      const clearance = gapBase * altitudeFactor;
      const creepRow = lookupRow(CREEP, U);
      const creepage = pd === '1'
        ? creepRow.val.PD1
        : creepRow.val['PD' + pd][MG_COL['PD' + pd][mg]];
      return {
        valid: true, voltage: U, altitude: alt, pollution: pd, material: mg,
        impulseV, impulseKV, gapLevel: gapRow.level, gapBase, altitudeFactor,
        clearance, creepLevel: creepRow.level, creepage,
        pollutionLabel: '污染等级 ' + pd,
        materialLabel: MATGRP_LABEL[mg],
      };
    },
    materialLabels: MATGRP_LABEL,
  });

  T.register({
    id: 'iec60664',
    title: '电气间隙/爬电距离',
    icon: '⚡',
    group: '电气计算',
    desc: '按 IEC 60664-1 输入系统电压、海拔、污染等级与材料组别，查询电气间隙与爬电距离标准。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>系统与绝缘参数</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>系统（对地）工作电压 <span class="hint">U，RMS</span></label>
              <div class="input-row">
                <input id="iec-u" type="number" value="230" min="0" step="any">
                <span class="unit">V</span>
              </div>
            </div>
            <div class="field">
              <label>海拔 <span class="hint">电气间隙修正</span></label>
              <div class="input-row">
                <input id="iec-alt" type="number" value="2000" min="0" step="any">
                <span class="unit">m</span>
              </div>
            </div>
            <div class="field">
              <label>污染等级</label>
              <select id="iec-pd">
                <option value="1">污染等级 1（干燥无污染）</option>
                <option value="2">污染等级 2（仅非导电性污染）</option>
                <option value="3" selected>污染等级 3（导电性污染）</option>
              </select>
            </div>
            <div class="field">
              <label>材料组别</label>
              <select id="iec-mg">
                <option value="I">I（CTI ≥ 600）</option>
                <option value="II">II（400 ≤ CTI < 600）</option>
                <option value="IIIa">IIIa（175 ≤ CTI < 400）</option>
                <option value="IIIb">IIIb（100 ≤ CTI < 175）</option>
              </select>
            </div>
          </div>
          <div class="note" style="margin-top:14px">
            额定冲击耐受电压按 <b>U_imp = ceil((2·U + 1000) × 1.414)</b> 计算（U 为对地工作电压 V，向上取整到整数伏特）；电气间隙采用表 F.2 <b>Case A（非均匀场）</b>，并按污染等级取值。
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="iec-calc">查询绝缘距离标准</button>
          </div>
        </div>

        <div class="panel" id="iec-result" style="display:none"></div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>标准参考图表（IEC 60664-1）</h3>
          <details open>
            <summary>展开 / 收起标准参考图表</summary>
            <div class="ref-block">
              <div class="ref-title">表 F.2 — 电气间隙（按额定冲击耐受电压，海拔 ≤ 2000 m）</div>
              <div class="ref-scroll"><img class="ref-img" src="img/iec60664-f2.png" alt="表 F.2 电气间隙"></div>
            </div>
            <div class="ref-block">
              <div class="ref-title">表 F.5 — 爬电距离（按工作电压 × 污染等级 × 材料组别）</div>
              <div class="ref-scroll"><img class="ref-img" src="img/iec60664-f5.png" alt="表 F.5 爬电距离"></div>
            </div>
            <div class="ref-block">
              <div class="ref-title">海拔修正系数</div>
              <div class="ref-scroll"><img class="ref-img" src="img/iec60664-alt.png" alt="海拔修正系数"></div>
            </div>
          </details>
        </div>
      `;

      document.getElementById('iec-calc').addEventListener('click', calc);
      document.getElementById('iec-alt').addEventListener('input', calc);
      calc();
    },
  });

  function calc() {
    const U = E.parseNum(document.getElementById('iec-u').value);
    const alt = E.parseNum(document.getElementById('iec-alt').value);
    const pd = document.getElementById('iec-pd').value;
    const mg = document.getElementById('iec-mg').value;

    const box = document.getElementById('iec-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };
    if (U == null || alt == null || U <= 0) return bad('请填写有效的工作电压（>0）与海拔（≥0）。');
    if (alt < 0) return bad('海拔不能为负。');

    // 1) 额定冲击耐受电压：U_imp = ceil((2U+1000)×1.414)，V，向上取整到整数伏特
    const U_imp_v = Math.ceil((2 * U + 1000) * 1.414);
    const U_imp_kV = U_imp_v / 1000;

    // 2) 电气间隙：表 F.2 Case A × 污染等级，再 × 海拔系数（向上取整到档位）
    const gapRow = lookupRow(GAP_A, U_imp_kV);
    const gapBase = gapRow.val['PD' + pd];
    const altFactor = lookupGe(ALT, Math.max(alt, 2000));
    const gap = gapBase * altFactor;
    const gapLevel = gapRow.level;

    // 3) 爬电距离：表 F.5 × 污染等级 × 材料组别（向上取整到档位）
    const creepRow = lookupRow(CREEP, U);
    let creep;
    if (pd === '1') creep = creepRow.val.PD1;
    else creep = creepRow.val['PD' + pd][MG_COL['PD' + pd][mg]];
    const creepLevel = creepRow.level;

    const pdLabel = '污染等级 ' + pd;
    const mgLabel = MATGRP_LABEL[mg];

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>IEC 60664-1 绝缘距离标准</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">U_imp = ceil((2U+1000)×1.414)</div>
          <div class="v">${E.fmtExact(U_imp_kV)}<small> kV（${U_imp_v} V）</small></div></div>
        <div class="result-card"><div class="k">电气间隙（${gapLevel}kV 档 · ${pdLabel} × 海拔 ${E.fmt(alt)}m）</div>
          <div class="v">${E.fmtExact(gap)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">爬电距离（按 ${creepLevel}V 档）</div>
          <div class="v">${E.fmtExact(creep)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">海拔修正系数</div>
          <div class="v">${E.fmtExact(altFactor)}<small> ×</small></div></div>
      </div>
      <div class="status-banner info">
        <b>结果：</b>电气间隙 = 表F.2 <b>${gapLevel}kV 档</b>（${pdLabel}）基准 ${E.fmtExact(gapBase)} mm × 海拔系数 ${E.fmtExact(altFactor)} = <b>${E.fmtExact(gap)} mm</b>；
        爬电距离（按 <b>${creepLevel}V 档</b> · ${pdLabel} · ${mgLabel}）=<b>${E.fmtExact(creep)} mm</b>。
        查表一律<b>向上取整</b>到大于或等于输入电压的最近档位。
      </div>
      <div class="note">
        <strong>说明：</strong>
        <ul>
          <li>电气间隙取决于<b>额定冲击耐受电压 U_imp</b> 与<b>海拔</b>，采用表 F.2 <b>Case A（非均匀场）</b>并按污染等级取值；≤2000m 基准，更高海拔按系数放大。</li>
          <li>爬电距离取决于<b>工作电压</b>、<b>污染等级</b>与<b>材料组别</b>；污染越重、材料组别越差，所需爬电距离越大。表 F.5 中 PD2 按材料组 I/II/III，PD3 按材料组 I/II/IIIb（IIIa 在 PD3 按 IIIb 列取值）。</li>
          <li>数据依据 IEC 60664-1 表 F.2（Case A）/表 F.5 与海拔系数；绝缘类型（基本/加强）与均匀场（Case B）等场景需按标准再作调整。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
