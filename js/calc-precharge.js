/**
 * 计算器 3：车辆电驱系统 预充回路计算
 *
 * 上电前需通过预充电阻给母线电容充电，避免主接触器闭合瞬间的浪涌电流。
 * RC 充电模型：
 *   Vc(t) = V · (1 − e^(−t/τ))，τ = R·C
 *   达到目标比例 f 所需时间：t = −R·C·ln(1−f)
 *   给定时间反求电阻：R = t / (C·(−ln(1−f)))
 *   峰值电流：I_peak = V / R
 *   电阻耗能：E = ½·C·V²
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;

  T.register({
    id: 'precharge',
    refreshDraft: calc,
    title: '预充回路匹配',
    icon: '🔋',
    group: '电气计算',
    desc: '根据电驱系统母线电容、母线电压与预充时间需求，计算预充电阻、时间常数与峰值电流，并校核已有电阻。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>系统与需求参数</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>母线电容 <span class="hint">C（支撑电容 + 电机电容等）</span></label>
              <div class="input-row">
                <input id="pc-cap" type="number" value="1500" min="0" step="any">
                <span class="unit">µF</span>
              </div>
            </div>
            <div class="field">
              <label>母线电压 <span class="hint">V（预充目标电压）</span></label>
              <div class="input-row">
                <input id="pc-v" type="number" value="400" min="0" step="any">
                <span class="unit">V</span>
              </div>
            </div>
            <div class="field">
              <label>目标预充电压比例 <span class="hint">f（达到母线电压的百分比）</span></label>
              <div class="input-row">
                <input id="pc-f" type="number" value="95" min="1" max="99.9" step="any">
                <span class="unit">%</span>
              </div>
            </div>
            <div class="field">
              <label>期望预充时间 <span class="hint">t</span></label>
              <div class="input-row">
                <input id="pc-t" type="number" value="500" min="0" step="any">
                <span class="unit">ms</span>
              </div>
            </div>
            <div class="field">
              <label>预充次数 <span class="hint">N（多次校核）</span></label>
              <div class="input-row">
                <input id="pc-n" type="number" value="1" min="1" step="1">
                <span class="unit">次</span>
              </div>
            </div>
            <div class="field">
              <label>预充间隔 <span class="hint">Δt（两次预充之间）</span></label>
              <div class="input-row">
                <input id="pc-gap" type="number" value="0" min="0" step="any">
                <span class="unit">s</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>校核已有预充电阻（可选）</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>预充电阻阻值 <span class="hint">R（留空则按上方需求计算）</span></label>
              <div class="input-row">
                <input id="pc-r" type="number" min="0" step="any" placeholder="留空自动计算">
                <span class="unit">Ω</span>
              </div>
            </div>
            <div class="field">
              <label>预充电阻功率额定 <span class="hint">P 额定（可选，用于校核）</span></label>
              <div class="input-row">
                <input id="pc-p" type="number" min="0" step="any" placeholder="留空跳过">
                <span class="unit">W</span>
              </div>
            </div>
            <div class="field">
              <label>脉冲能量耐受 <span class="hint">E 脉冲（可选，匹配单次预充能量）</span></label>
              <div class="input-row">
                <input id="pc-e" type="number" min="0" step="any" placeholder="留空跳过">
                <span class="unit">J</span>
              </div>
            </div>
          </div>
          <div class="note" style="margin-top:14px">
            校核原则：电阻的<b>脉冲能量耐受 E 脉冲</b>须大于<b>单次预充能量 E = ½·C·V²</b>，否则预充瞬间电阻可能烧毁。
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="pc-calc">计算预充回路</button>
          </div>
        </div>

        <div class="panel" id="pc-result" style="display:none"></div>
      `;

      document.getElementById('pc-calc').addEventListener('click', calc);
      calc();
    },
  });

  function calc() {
    const E = window.ElUtil;
    const capU = E.parseNum(document.getElementById('pc-cap').value); // µF
    const V = E.parseNum(document.getElementById('pc-v').value);
    const fPct = E.parseNum(document.getElementById('pc-f').value);
    const tMs = E.parseNum(document.getElementById('pc-t').value);
    const Rgiven = E.parseNum(document.getElementById('pc-r').value);
    const Pgiven = E.parseNum(document.getElementById('pc-p').value);
    const Epulse = E.parseNum(document.getElementById('pc-e').value);
    const n = E.parseNum(document.getElementById('pc-n').value);
    const gap = E.parseNum(document.getElementById('pc-gap').value);

    const box = document.getElementById('pc-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };

    if (capU == null || V == null || fPct == null || tMs == null) return bad('请填写母线电容、母线电压、目标比例与预充时间。');
    if (capU <= 0 || V <= 0 || tMs <= 0) return bad('母线电容、母线电压、预充时间必须大于 0。');
    if (fPct <= 0 || fPct >= 100) return bad('目标电压比例需在 0～100% 之间（不含边界）。');
    if (n == null || n < 1) return bad('预充次数至少为 1 次。');
    if (gap == null || gap < 0) return bad('预充间隔不能为负。');
    const N = Math.floor(n);
    const Gap = gap || 0;

    const C = capU * 1e-6; // F
    const f = fPct / 100;
    const ln = -Math.log(1 - f); // 无量纲
    const t = tMs / 1000; // s
    const Rneed = t / (C * ln); // Ω，需求电阻

    // 时间常数（按需求电阻）
    const tauNeed = Rneed * C;

    // 若给定了已有电阻，用其反算实际时间
    let R = Rneed;
    let tActual = t;
    let tActualMs = tMs;
    if (Rgiven != null && Rgiven > 0) {
      R = Rgiven;
      // t = R·C·ln，其中 ln = −ln(1−f) > 0，故实际预充时间为正
      tActual = R * C * ln;
      tActualMs = tActual * 1000;
    }

    const tau = R * C;
    const Ipeak = V / R;
    const Eres = 0.5 * C * V * V; // J，单次预充电阻吸收的能量
    const tChg = Math.min(tActual, t); // s，单次实际充电时间（保守取较短）
    const Pavg = Eres / tChg; // W，单次预充期间平均功率

    // 多次预充校核
    const E_total = N * Eres; // J，N 次总能量
    const T_total = N * tChg + (N - 1) * Gap; // s，从第 1 次开始到第 N 次预充结束的总周期
    const P_multi = T_total > 0 ? E_total / T_total : Eres / tChg; // W，多次平均功率（按总周期分摊）
    const duty = T_total > 0 ? (N * tChg) / T_total : 1; // 预充占空比（0~1）

    // 校核：峰值电流是否过大（浪涌限制）
    let peakStatus, peakClass;
    if (Ipeak > 100) {
      peakClass = 'warn';
      peakStatus = `峰值电流 ${E.fmt(Ipeak)} A 较大，可能产生明显浪涌与电磁干扰，建议增大预充电阻或分级预充。`;
    } else {
      peakClass = 'ok';
      peakStatus = `峰值电流 ${E.fmt(Ipeak)} A 在可控范围，预充浪涌较小。`;
    }

    // 校核：已有电阻是否满足时间要求
    let timeStatus, timeClass;
    if (Rgiven != null && Rgiven > 0) {
      const ratio = tActualMs / tMs;
      if (ratio <= 1.1) {
        timeClass = 'ok';
        timeStatus = `已有电阻 ${E.fmt(R)} Ω 的实际预充时间 ${E.fmt(tActualMs)} ms，满足 ≤ ${E.fmt(tMs)} ms 的需求。`;
      } else {
        timeClass = 'err';
        timeStatus = `已有电阻 ${E.fmt(R)} Ω 的实际预充时间 ${E.fmt(tActualMs)} ms，超出期望 ${E.fmt(tMs)} ms。建议减小预充电阻或延长预充窗口。`;
      }
    }

    // 功率校核
    let powerStatus, powerClass = 'info';
    if (Pgiven != null && Pgiven > 0) {
      if (Pavg > Pgiven) {
        powerClass = 'err';
        powerStatus = `平均功率 ${E.fmt(Pavg)} W 超过电阻额定功率 ${E.fmt(Pgiven)} W，电阻会过热，需选更大功率或关注脉冲耐量（I²t / 单次能量 E=${E.fmt(Eres)} J）。`;
      } else {
        powerClass = 'ok';
        powerStatus = `平均功率 ${E.fmt(Pavg)} W 低于电阻额定功率 ${E.fmt(Pgiven)} W。注意电阻多为脉冲型，应同时校核单次能量 ${E.fmt(Eres)} J 是否在其脉冲曲线范围内。`;
      }
    }

    // 脉冲能量校核：单次预充能量 E = ½·C·V² 须 ≤ 电阻脉冲能量耐受
    let pulseStatus, pulseClass = 'info';
    if (Epulse != null && Epulse > 0) {
      if (Eres > Epulse) {
        pulseClass = 'err';
        pulseStatus = `单次预充能量 ${E.fmt(Eres)} J 超过电阻脉冲能量耐受 ${E.fmt(Epulse)} J，预充瞬间电阻可能烧毁。需选用脉冲耐受 ≥ ${E.fmt(Eres)} J 的电阻，或减小电容/电压。`;
      } else {
        pulseClass = 'ok';
        pulseStatus = `单次预充能量 ${E.fmt(Eres)} J ≤ 电阻脉冲能量耐受 ${E.fmt(Epulse)} J，脉冲校核通过（耐受 / 能量 = ${E.fmt(Epulse / Eres)} 倍）。`;
      }
    }

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>计算结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">${Rgiven != null && Rgiven > 0 ? '所用预充电阻 R' : '所需预充电阻 R'}</div>
          <div class="v">${E.fmt(R)}<small> Ω</small></div></div>
        <div class="result-card"><div class="k">时间常数 τ = R·C</div>
          <div class="v">${E.fmt(tau)}<small> s</small></div></div>
        <div class="result-card"><div class="k">实际预充时间 t</div>
          <div class="v">${E.fmt(tActualMs)}<small> ms</small></div></div>
        <div class="result-card"><div class="k">峰值电流 I_peak = V/R</div>
          <div class="v">${E.fmt(Ipeak)}<small> A</small></div></div>
        <div class="result-card"><div class="k">单次吸收能量 E</div>
          <div class="v">${E.fmt(Eres)}<small> J</small></div></div>
        <div class="result-card"><div class="k">单次平均功率 P = E/t</div>
          <div class="v">${E.fmt(Pavg)}<small> W</small></div></div>
        <div class="result-card"><div class="k">${N} 次总能量</div>
          <div class="v">${E.fmt(E_total)}<small> J</small></div></div>
        <div class="result-card"><div class="k">${N} 次平均功率（含间隔）</div>
          <div class="v">${E.fmt(P_multi)}<small> W</small></div></div>
        <div class="result-card"><div class="k">预充占空比</div>
          <div class="v">${E.fmt(duty * 100)}<small> %</small></div></div>
      </div>
      <div class="status-banner ${peakClass}">${peakStatus}</div>
      ${timeStatus ? `<div class="status-banner ${timeClass}">${timeStatus}</div>` : ''}
      ${powerStatus ? `<div class="status-banner ${powerClass}">${powerStatus}</div>` : ''}
      ${pulseStatus ? `<div class="status-banner ${pulseClass}">${pulseStatus}</div>` : ''}
      <div class="status-banner ${N > 1 ? 'info' : 'ok'}">
        ${N > 1
          ? `<b>多次预充校核：</b>${N} 次预充，每次间隔 ${E.fmtExact(Gap)} s。单次充电 ${E.fmtExact(tChg)} s，总周期 ${E.fmtExact(T_total)} s，总能量 ${E.fmt(E_total)} J。${N} 次平均功率 <b>${E.fmt(P_multi)} W</b>（占空比 ${E.fmt(duty * 100)}%）。选型时应以该平均功率校核电阻持续散热能力。`
          : `<b>单次预充：</b>平均功率 ${E.fmt(Pavg)} W。如需反复上电，请填写预充次数与间隔进行多次校核。`}
      </div>
      <div class="note">
        <strong>设计要点：</strong>
        <ul>
          <li>按需求计算：R = t ÷ (C × (−ln(1−f))) = ${E.fmtExact(tMs)}ms ÷ (${E.fmtExact(capU)}µF × ${ln.toFixed(3)}) ≈ <b>${E.fmt(Rneed)} Ω</b>；</li>
          <li>预充到 ${E.fmtExact(fPct)}%（f=${E.fmtExact(f)}）需 ${ln.toFixed(3)} 个时间常数 τ；达到 63.2% 需 1τ，95% 需 3τ，99% 需 4.6τ；</li>
          <li>预充完成后，主接触器两端压差需低于继电器/接触器允许值（通常 &lt; 10~20V）方可闭合；</li>
          <li>选型时同时校核电阻的 <b>脉冲耐量（I²t / 单次能量）</b> 与 <b>持续功率</b>，防止预充瞬间烧毁。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
