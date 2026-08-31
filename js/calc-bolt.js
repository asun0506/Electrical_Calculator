/**
 * 计算器 7：螺栓扭矩与屈服校核
 *
 * 扭矩法预紧（VDI 2230 简化）：
 *   F_pre = T / (K·d)            单颗螺栓预紧力（T 拧紧力矩，K 扭矩系数，d 公称直径）
 *   σ_pre = F_pre / A_s          预紧应力（A_s 应力截面积）
 *   工作载荷（含冲击）：F_eff = F_load·(1 + a/g)，每颗 F_work = F_eff / n
 *   螺栓总应力：σ_bolt = (F_pre + F_work) / A_s
 *   校核螺栓：σ_bolt < Rp0.2（螺栓屈服强度）
 *   校核界面：σ_pre < σ_yield,iface（预紧面/接触面屈服应力，按预紧应力保守校核）
 *
 * 注：界面承压实际为 F_pre/接触面积，接触面积通常 ≥ A_s，故用 σ_pre 校核偏保守。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const g = 9.81;

  // 常用公制螺栓：公称直径 d(mm) 与应力截面积 A_s(mm²)
  const BOLTS = {
    M3: { d: 3, As: 5.03 }, M4: { d: 4, As: 8.78 }, M5: { d: 5, As: 14.2 },
    M6: { d: 6, As: 20.1 }, M8: { d: 8, As: 36.6 }, M10: { d: 10, As: 58.0 },
    M12: { d: 12, As: 84.3 }, M16: { d: 16, As: 157 }, M20: { d: 20, As: 245 },
  };

  // 螺栓材质等级：屈服强度 Rp0.2、抗拉强度 Rm（MPa）
  const MATS = {
    '304': { name: '304 不锈钢（A2-70）', Rp: 450, Rm: 700 },
    '8.8': { name: '8.8 级', Rp: 640, Rm: 800 },
    '10.9': { name: '10.9 级', Rp: 940, Rm: 1040 },
    '12.9': { name: '12.9 级', Rp: 1100, Rm: 1220 },
  };

  // 扭矩系数 K
  const KOPTS = { lub: 0.15, dry: 0.2, custom: null };

  T.register({
    id: 'bolt',
    refreshDraft: calc,
    title: '螺栓扭矩校核',
    icon: '🔩',
    group: '机械尺寸',
    desc: '输入螺栓规格/材质、数量、拧紧力矩、载荷与冲击加速度、预紧面屈服应力，校核螺栓与连接界面使用过程是否屈服。',

    render(host) {
      const boltOpts = Object.keys(BOLTS).map((k) => `<option value="${k}">M${BOLTS[k].d}（A_s=${BOLTS[k].As} mm²）</option>`).join('');
      const matOpts = Object.keys(MATS).map((k) => `<option value="${k}">${MATS[k].name}（Rp0.2=${MATS[k].Rp} MPa）</option>`).join('');

      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>螺栓与连接参数</h3>
          <div class="grid cols-3">
            <div class="field">
              <label>公称直径 <span class="hint">螺纹规格</span></label>
              <select id="bt-size">${boltOpts}</select>
            </div>
            <div class="field">
              <label>材质 / 性能等级</label>
              <select id="bt-mat">${matOpts}</select>
            </div>
            <div class="field">
              <label>螺栓数量 <span class="hint">n</span></label>
              <div class="input-row">
                <input id="bt-n" type="number" value="4" min="1" step="1">
                <span class="unit">颗</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>预紧与载荷</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>拧紧力矩 <span class="hint">T</span></label>
              <div class="input-row">
                <input id="bt-t" type="number" value="25" min="0" step="any">
                <span class="unit">N·m</span>
              </div>
            </div>
            <div class="field">
              <label>扭矩系数 <span class="hint">K</span></label>
              <select id="bt-k">
                <option value="dry">干摩擦（K≈0.20）</option>
                <option value="lub">涂油 / 润滑（K≈0.15）</option>
                <option value="custom">自定</option>
              </select>
              <div class="input-row" id="bt-k-custom-wrap" style="display:none;margin-top:8px">
                <input id="bt-k-custom" type="number" value="0.2" min="0" step="any">
              </div>
            </div>
            <div class="field">
              <label>载荷大小 <span class="hint">F_load（轴向工作载荷）</span></label>
              <div class="input-row">
                <input id="bt-load" type="number" value="5000" min="0" step="any">
                <span class="unit">N</span>
              </div>
            </div>
            <div class="field">
              <label>冲击加速度 <span class="hint">a（0 表示无冲击）</span></label>
              <div class="input-row">
                <input id="bt-a" type="number" value="10" min="0" step="any">
                <span class="unit">m/s²</span>
              </div>
            </div>
            <div class="field">
              <label>拧紧公差 <span class="hint">拧紧力矩上偏差</span></label>
              <div class="input-row">
                <input id="bt-tol" type="number" value="12.5" min="0" step="any">
                <span class="unit">%</span>
              </div>
            </div>
            <div class="field">
              <label>综合工况系数 <span class="hint">工作载荷放大系数</span></label>
              <div class="input-row">
                <input id="bt-cond" type="number" value="1.3" min="0" step="any">
              </div>
            </div>
            <div class="field">
              <label>震动衰减系数 <span class="hint">振动载荷放大系数</span></label>
              <div class="input-row">
                <input id="bt-vib" type="number" value="1.6" min="0" step="any">
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>界面（接触面）参数</h3>
          <div class="grid cols-3">
            <div class="field">
              <label>界面内径 <span class="hint">D_in（螺栓孔 / 孔径）</span></label>
              <div class="input-row">
                <input id="bt-di" type="number" value="9" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>界面外径 <span class="hint">D_out（垫圈 / 接触面外径）</span></label>
              <div class="input-row">
                <input id="bt-do" type="number" value="16" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
            <div class="field">
              <label>界面屈服应力 <span class="hint">接触面 / 垫片承压屈服</span></label>
              <div class="input-row">
                <input id="bt-yield" type="number" value="300" min="0" step="any">
                <span class="unit">MPa</span>
              </div>
            </div>
          </div>
          <div class="note" style="margin-top:14px">
            接触面积按<b>环形垫圈面</b> A = π/4·(D_out² − D_in²) 计算；界面承压应力 σ = n·F_bolt / A，
            校核其是否低于界面屈服应力，防止界面被<b>压溃</b>。
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="bt-calc">校核螺栓与界面</button>
          </div>
        </div>

        <div class="panel" id="bt-result" style="display:none"></div>
      `;

      document.getElementById('bt-k').addEventListener('change', () => {
        document.getElementById('bt-k-custom-wrap').style.display =
          document.getElementById('bt-k').value === 'custom' ? 'flex' : 'none';
      });
      document.getElementById('bt-calc').addEventListener('click', calc);
      calc();
    },
  });

  function calc() {
    const size = BOLTS[document.getElementById('bt-size').value];
    const mat = MATS[document.getElementById('bt-mat').value];
    const n = E.parseNum(document.getElementById('bt-n').value);
    const T = E.parseNum(document.getElementById('bt-t').value);
    const Ksel = document.getElementById('bt-k').value;
    const K = Ksel === 'custom' ? E.parseNum(document.getElementById('bt-k-custom').value) : KOPTS[Ksel];
    const Fload = E.parseNum(document.getElementById('bt-load').value);
    const a = E.parseNum(document.getElementById('bt-a').value);
    const tolPct = E.parseNum(document.getElementById('bt-tol').value);
    const cond = E.parseNum(document.getElementById('bt-cond').value);
    const vib = E.parseNum(document.getElementById('bt-vib').value);
    const Di = E.parseNum(document.getElementById('bt-di').value);
    const Do = E.parseNum(document.getElementById('bt-do').value);
    const yieldIface = E.parseNum(document.getElementById('bt-yield').value);

    const box = document.getElementById('bt-result');
    const bad = (m) => {
      box.innerHTML = `<div class="status-banner err">${m}</div>`;
      box.style.display = 'block';
    };
    if (n == null || T == null || K == null || K <= 0 || Fload == null || a == null || yieldIface == null) {
      return bad('请完整填写所有参数。');
    }
    if (n < 1 || T <= 0 || yieldIface <= 0) return bad('数量 ≥ 1、拧紧力矩 > 0、界面屈服应力 > 0。');
    if (tolPct == null || tolPct < 0 || cond == null || cond <= 0 || vib == null || vib <= 0) {
      return bad('拧紧公差 ≥ 0，综合工况系数与震动衰减系数 > 0。');
    }
    if (Di == null || Do == null || Do <= Di) return bad('界面内径 ≥ 0，且界面外径必须大于内径。');

    const d = size.d;
    const As = size.As;
    const d_m = d / 1000; // m

    // 拧紧力矩（含拧紧公差上偏差）+ 扭矩法预紧力
    const Tmax = T * (1 + tolPct / 100);
    const Fpre = Tmax / (K * d_m); // N，单颗最大预紧力
    const sigmaPre = Fpre / As; // MPa

    // 工作载荷：冲击 × 综合工况 × 震动衰减
    const shock = 1 + a / g;
    const loadFactor = shock * cond * vib;
    const Feff = Fload * loadFactor;
    const Fwork = Feff / n; // N，每颗
    const Fbolt = Fpre + Fwork; // N，单颗螺栓轴向力（预紧 + 工作）
    const sigmaBolt = Fbolt / As; // MPa

    // 界面压溃：每个螺栓各自独立的界面，按单颗螺栓压紧力校核
    const Acontact = Math.PI / 4 * (Do * Do - Di * Di); // mm²，单颗螺栓环形接触面积
    const sigmaContact = Fbolt / Acontact; // MPa，单颗螺栓界面承压应力

    // 校核
    const boltSF = mat.Rp / sigmaBolt;
    const ifaceSF = yieldIface / sigmaContact;
    const boltOK = sigmaBolt < mat.Rp;
    const ifaceOK = sigmaContact < yieldIface;

    let boltClass, ifaceClass, overall;
    boltClass = boltOK ? 'ok' : 'err';
    ifaceClass = ifaceOK ? 'ok' : 'err';
    if (boltOK && ifaceOK) overall = { cls: 'ok', txt: '校核通过：螺栓与连接界面均未屈服。' };
    else overall = { cls: 'err', txt: '校核未通过：存在屈服风险，请降低拧紧力矩或增大规格/数量。' };

    // 建议拧紧力矩（按 75% 保证屈服力）
    const Fallow = 0.75 * mat.Rp * As;
    const Tallow = K * d_m * Fallow; // N·m

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>校核结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">最大拧紧力矩（含公差 ${E.fmtExact(tolPct)}%）</div>
          <div class="v">${E.fmt(Tmax)}<small> N·m</small></div></div>
        <div class="result-card"><div class="k">预紧力 F_pre = T_max/(K·d)</div>
          <div class="v">${E.fmt(Fpre)}<small> N/颗</small></div></div>
        <div class="result-card"><div class="k">预紧应力 σ_pre = F_pre/A_s</div>
          <div class="v">${E.fmt(sigmaPre)}<small> MPa</small></div></div>
        <div class="result-card"><div class="k">载荷综合系数 (1+a/g)×工况×震动</div>
          <div class="v">${E.fmtExact(loadFactor)}<small> ×</small></div></div>
        <div class="result-card"><div class="k">单颗螺栓轴向力 F_bolt</div>
          <div class="v">${E.fmt(Fbolt)}<small> N</small></div></div>
        <div class="result-card"><div class="k">螺栓总应力 σ_bolt</div>
          <div class="v">${E.fmt(sigmaBolt)}<small> MPa</small></div></div>
        <div class="result-card"><div class="k">螺栓屈服强度 Rp0.2</div>
          <div class="v">${mat.Rp}<small> MPa（${mat.name}）</small></div></div>
        <div class="result-card"><div class="k">单颗界面接触面积 A=π/4(D_out²−D_in²)</div>
          <div class="v">${E.fmt(Acontact)}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">界面承压应力 σ_contact=F_bolt/A</div>
          <div class="v">${E.fmt(sigmaContact)}<small> MPa</small></div></div>
      </div>
      <div class="status-banner ${boltClass}">
        <b>螺栓屈服校核：</b>σ_bolt = ${E.fmt(sigmaBolt)} MPa ${boltOK ? '&lt;' : '≥'} Rp0.2 = ${mat.Rp} MPa，
        安全系数 = ${E.fmtExact(boltSF)}${boltOK ? '，螺栓未屈服。' : '，螺栓已屈服！'}
      </div>
      <div class="status-banner ${ifaceClass}">
        <b>界面压溃校核（单颗螺栓界面）：</b>σ_contact = ${E.fmt(sigmaContact)} MPa ${ifaceOK ? '&lt;' : '≥'} 界面屈服应力 = ${E.fmt(yieldIface)} MPa，
        安全系数 = ${E.fmtExact(ifaceSF)}${ifaceOK ? '，界面未压溃。' : '，界面已被压溃！'}
      </div>
      <div class="status-banner ${overall.cls}">${overall.txt}</div>
      <div class="note">
        <strong>参考：</strong>建议拧紧力矩（预紧到 75% 屈服力）≈ <b>${E.fmt(Tallow)} N·m</b>；
        当前 ${E.fmt(T)} N·m（含公差后 ${E.fmt(Tmax)} N·m）对应预紧率 ${E.fmtExact(sigmaPre / mat.Rp * 100)}%。<br>
        <strong>假设：</strong>扭矩法预紧 K=${E.fmtExact(K)}，拧紧公差 ${E.fmtExact(tolPct)}%；工作载荷乘以冲击 ${E.fmtExact(shock)} × 综合工况 ${E.fmtExact(cond)} × 震动衰减 ${E.fmtExact(vib)} = ${E.fmtExact(loadFactor)}。<b>界面压溃按每个螺栓独立界面</b>（环形面积 A=π/4(D_out²−D_in²)）以单颗螺栓压紧力 F_bolt 校核。工作载荷假设均分且螺栓不承受弯矩/剪切。正式设计请结合夹持刚度分配与 VDI 2230。
      </div>
    `;
    box.style.display = 'block';
  }
})();
