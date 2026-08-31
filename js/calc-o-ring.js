/**
 * 计算器 9：密封（O 形圈）设计校核
 *
 * 输入密封槽宽/高及公差、密封圈线径与横截面积及公差，计算：
 *   压缩率 = (d − H) / d × 100%     （d 密封圈线径，H 槽高/槽深）
 *   填充率 = A / (W × H) × 100%     （A 密封圈横截面积，W×H 槽截面积）
 *
 * 考虑公差，输出最大/最小压缩率与填充率，并与设计参考范围比较判断是否合理。
 * 参考范围（静态 O 形圈）：压缩率约 15%~25%；填充率约 60%~85%（须 < 100%）。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  T.register({
    id: 'oring',
    refreshDraft: calc,
    title: '密封校核',
    icon: '⭕',
    group: '机械尺寸',
    desc: '输入密封槽宽/高及公差、密封圈线径与横截面积及公差，计算最大/最小压缩率与填充率，判断密封设计是否合理。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>密封槽尺寸</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>密封槽宽 <span class="hint">W</span></label>
              <div class="input-row">
                <input id="or-w" type="number" value="3.0" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>槽宽公差 <span class="hint">±</span></label>
              <div class="input-row">
                <input id="or-dw" type="number" value="0.1" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>密封槽高（槽深）<span class="hint">H</span></label>
              <div class="input-row">
                <input id="or-h" type="number" value="1.4" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>槽高公差 <span class="hint">±</span></label>
              <div class="input-row">
                <input id="or-dh" type="number" value="0.05" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>密封圈尺寸</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>密封圈线径 <span class="hint">d（截面直径）</span></label>
              <div class="input-row">
                <input id="or-d" type="number" value="1.8" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>线径公差 <span class="hint">±</span></label>
              <div class="input-row">
                <input id="or-dd" type="number" value="0.05" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>横截面积 <span class="hint">A（圆截面默认 π/4·d²）</span></label>
              <div class="input-row">
                <input id="or-a" type="number" value="2.54" min="0" step="any">
                <span class="unit">mm²</span>
              </div>
            </div>
            <div class="field">
              <label>面积公差 <span class="hint">±</span></label>
              <div class="input-row">
                <input id="or-da" type="number" value="0.1" min="0" step="any">
                <span class="unit">mm²</span>
              </div>
            </div>
          </div>
          <div class="note" style="margin-top:14px">横截面积默认按圆截面 A = π/4·d² 估算，若实际截面非圆请手动修改面积值。</div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>设计参考范围</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>目标压缩率范围 <span class="hint">min ~ max</span></label>
              <div class="input-row">
                <input id="or-crmin" type="number" value="15" min="0" step="any">
                <span class="unit">%</span>
                <input id="or-crmax" type="number" value="25" min="0" step="any" style="border-left:1px solid var(--border);border-radius:0">
                <span class="unit">%</span>
              </div>
            </div>
            <div class="field">
              <label>目标填充率范围 <span class="hint">min ~ max</span></label>
              <div class="input-row">
                <input id="or-fmin" type="number" value="60" min="0" step="any">
                <span class="unit">%</span>
                <input id="or-fmax" type="number" value="85" min="0" step="any" style="border-left:1px solid var(--border);border-radius:0">
                <span class="unit">%</span>
              </div>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="or-calc">校核密封设计</button>
          </div>
        </div>

        <div class="panel" id="or-result" style="display:none"></div>
      `;

      // 线径变化时自动更新横截面积（仅当面积未手动改时）
      document.getElementById('or-d').addEventListener('input', () => {
        const d = E.parseNum(document.getElementById('or-d').value);
        if (d != null && d > 0) {
          document.getElementById('or-a').value = (Math.PI / 4 * d * d).toFixed(4);
        }
      });
      document.getElementById('or-calc').addEventListener('click', calc);
      calc();
    },
  });

  function calc() {
    const W = E.parseNum(document.getElementById('or-w').value);
    const dW = E.parseNum(document.getElementById('or-dw').value);
    const H = E.parseNum(document.getElementById('or-h').value);
    const dH = E.parseNum(document.getElementById('or-dh').value);
    const d = E.parseNum(document.getElementById('or-d').value);
    const dd = E.parseNum(document.getElementById('or-dd').value);
    const A = E.parseNum(document.getElementById('or-a').value);
    const dA = E.parseNum(document.getElementById('or-da').value);
    const crMin = E.parseNum(document.getElementById('or-crmin').value);
    const crMax = E.parseNum(document.getElementById('or-crmax').value);
    const fMin = E.parseNum(document.getElementById('or-fmin').value);
    const fMax = E.parseNum(document.getElementById('or-fmax').value);

    const box = document.getElementById('or-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };
    const nums = [W, dW, H, dH, d, dd, A, dA, crMin, crMax, fMin, fMax];
    if (nums.some((v) => v == null)) return bad('请填写所有必填参数。');
    if (W <= 0 || H <= 0 || d <= 0 || A <= 0 || dW < 0 || dH < 0 || dd < 0 || dA < 0) {
      return bad('槽宽/槽高/线径/面积须 > 0，各公差须 ≥ 0。');
    }
    if (crMax <= crMin || fMax <= fMin) return bad('目标范围需满足 max > min。');

    // 尺寸范围
    const Wmin = W - dW, Wmax = W + dW;
    const Hmin = H - dH, Hmax = H + dH;
    const dmin = d - dd, dmax = d + dd;
    const Amin = A - dA, Amax = A + dA;

    // 压缩率 = (d−H)/d；最大用 d 最大、H 最小；最小用 d 最小、H 最大
    const crMaxV = (dmax - Hmin) / dmax * 100;
    const crMinV = (dmin - Hmax) / dmin * 100;
    // 填充率 = A/(W·H)；最大用 A 最大、W/H 最小；最小用 A 最小、W/H 最大
    const fillMaxV = Amax / (Wmin * Hmin) * 100;
    const fillMinV = Amin / (Wmax * Hmax) * 100;

    // 判断
    const crOkMax = crMaxV <= crMax, crOkMin = crMinV >= crMin;
    const fillOkMax = fillMaxV <= fMax, fillOkMin = fillMinV >= fMin;
    const crOK = crOkMax && crOkMin;
    const fillOK = fillOkMax && fillOkMin;

    const crMsgs = [];
    if (!crOkMax) crMsgs.push(`压缩率上限 ${E.fmt(crMaxV)}% 超过目标 ${E.fmt(crMax)}%，可能过度压缩（挤压应力过大/寿命下降）。`);
    if (!crOkMin) crMsgs.push(`压缩率下限 ${E.fmt(crMinV)}% 低于目标 ${E.fmt(crMin)}%，可能压缩不足（密封不严）。`);
    if (crOK) crMsgs.push('压缩率在设计参考范围内，合理。');

    const fillMsgs = [];
    if (!fillOkMax) fillMsgs.push(`填充率上限 ${E.fmt(fillMaxV)}% 超过目标 ${E.fmt(fMax)}%${fillMaxV >= 100 ? '（已达/超过 100%，槽内容纳不下，装配困难）' : '，偏挤'}。`);
    if (!fillOkMin) fillMsgs.push(`填充率下限 ${E.fmt(fillMinV)}% 低于目标 ${E.fmt(fMin)}%，填充不足（可能无法有效密封）。`);
    if (fillOK) fillMsgs.push('填充率在设计参考范围内，合理。');

    const overallOK = crOK && fillOK;
    const overallClass = overallOK ? 'ok' : 'warn';

    const crSection = `<div class="status-banner ${crOK ? 'ok' : 'warn'}"><b>压缩率校核：</b>${crMsgs.join(' ')}</div>`;
    const fillSection = `<div class="status-banner ${fillOK ? 'ok' : 'warn'}"><b>填充率校核：</b>${fillMsgs.join(' ')}</div>`;

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>密封校核结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">压缩率范围（min ~ max）</div>
          <div class="v">${E.fmt(crMinV)}<small>% ~ </small>${E.fmt(crMaxV)}<small>%</small></div></div>
        <div class="result-card"><div class="k">填充率范围（min ~ max）</div>
          <div class="v">${E.fmt(fillMinV)}<small>% ~ </small>${E.fmt(fillMaxV)}<small>%</small></div></div>
        <div class="result-card"><div class="k">槽截面积 W×H</div>
          <div class="v">${E.fmt(W * H)}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">密封圈横截面积 A</div>
          <div class="v">${E.fmt(A)}<small> mm²</small></div></div>
      </div>
      ${crSection}
      ${fillSection}
      <div class="status-banner ${overallClass}">${overallOK ? '密封设计合理：压缩率与填充率均在目标范围内。' : '密封设计存在风险：请结合建议调整槽尺寸或密封圈规格。'}</div>
      <div class="note">
        <strong>说明：</strong>
        <ul>
          <li>压缩率 = (d−H)/d：反映密封圈被压缩程度，标准静态 O 形圈通常取 15%~25%，动态/旋转取更小；</li>
          <li>填充率 = A/(W·H)：反映密封圈在槽内被挤压填充的比例，通常 60%~85%，须 < 100%（否则槽内容纳不下）；</li>
          <li>本页按尺寸公差给出最大/最小包络，覆盖制造偏差；具体建议结合工况（介质、压力、温度）与厂商手册。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
