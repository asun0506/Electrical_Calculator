/**
 * 计算器 11：塑料卡扣工程计算（Bayer《Snap-Fit Joints for Plastics》+ BASF Snap-Fit Design Manual）
 *
 * 卡扣类型：悬臂（直悬臂 / L 型 / U 型 Case1 / U 型 Case2）、扭转、环形。
 *
 * 直悬臂（含 BASF 短梁/安装壁柔度修正 Q）：
 *   ε = y·h/(ky·l²·Q)，σ = Es·ε，P = b·h²·Es·ε/(6l)
 *   ymax = min(εallow, σallow/Es)·ky·l²·Q/h
 *   Q 按 L/h 对 1~5、2T、5T 七种结构曲线插值，或手动输入覆盖。
 *
 * L / U 型（路径柔度公式，不叠加 Q，尺寸沿中性层路径）：
 *   I = b·h³/12，curve = L1(2πL1+8R)+πR²
 *   L 型：      A = 4L1³+3R·curve+12L2(L1+R)²，        ε = 6(L1+R)hY/A，P = 12EsIY/A
 *   U 型 Case1: A = 6L1³+9R·curve+6L2(3L1²-3L1L2+L2²)， ε = 9(L1+R)hY/A，P = 18EsIY/A
 *   U 型 Case2: A = 4L1³+2L3³+3R·curve，                ε = 3(L1+R)hY/A，P = 6EsIY/A
 *   ymax = min(εallow, σallow/Es)·A/[Cε·(L1+R)·h]
 *
 * 扭转：γpm≈1.35εpm，φpm=γpm·l/r，P·l₁=γ·G·Ip·n/r
 * 环形：XN 模型，P=y·d·Es·X·位置系数
 * 装配修正：W = P×(μ+tanα)/(1−μ·tanα)
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;

  // 材料库：允许短期应变(%)、割线模量 Es(MPa)、摩擦系数 μ
  const MATERIALS = {
    'PC（Makrolon，非增强）': { strain: 4, es: 1815, mu: 0.6 },
    'PC/ABS（Bayblend）': { strain: 2.5, es: 1900, mu: 0.6 },
    'PC 共混物（Makroblend）': { strain: 3.5, es: 1800, mu: 0.6 },
    'PC GF10': { strain: 2.2, es: 3000, mu: 0.6 },
    'PC GF20': { strain: 2, es: 4200, mu: 0.6 },
  };
  // 直悬臂设计：挠度系数 ky
  const DESIGNS = {
    constant: { name: '等截面悬臂', ky: 2 / 3, tip: '根部厚度 h，全长不变' },
    thickness: { name: '厚度渐缩至 1/2', ky: 1 / 0.92, tip: '文档推荐：变形能力提高约 60%' },
    width: { name: '宽度渐缩至 1/4', ky: 1 / 1.17, tip: '厚度不变，宽度线性渐缩' },
  };
  // 悬臂子模型
  const BEAMS = {
    straight: '直悬臂',
    lshape: 'L 型卡扣',
    ucase1: 'U 型 · Case 1',
    ucase2: 'U 型 · Case 2',
  };
  // BASF Q 系数曲线（L/h → Q）
  const QTABLES = {
    '1': [[1.5, 1.6], [2, 1.35], [3, 1.18], [4, 1.10], [5, 1.07], [7, 1.03], [11, 1]],
    '2': [[1.5, 2.1], [2, 1.7], [3, 1.4], [4, 1.28], [5, 1.22], [7, 1.14], [11, 1.05]],
    '3': [[1.5, 2.3], [2, 1.85], [3, 1.5], [4, 1.35], [5, 1.29], [7, 1.2], [11, 1.1]],
    '4': [[1.5, 6.4], [2, 4.5], [3, 2.8], [4, 2.25], [5, 2.07], [7, 1.72], [11, 1.4]],
    '5': [[1.5, 7.8], [2, 5.8], [3, 3.1], [3.57, 2.7], [4, 2.45], [5, 2.05], [7, 1.72], [11, 1.5]],
    '2T': [[2, 1.6], [3, 1.38], [4, 1.29], [5, 1.24], [7, 1.17], [11, 1.1]],
    '5T': [[2, 3.5], [3, 2.5], [4, 2.1], [5, 1.8], [7, 1.5], [11, 1.3]],
  };
  const QLABELS = {
    '1': '1 · 实心厚壁上的直立梁',
    '2': '2 · 薄壁上的直立梁',
    '3': '3 · 薄板边缘附近直立梁',
    '4': '4 · 薄板开槽根部梁',
    '5': '5 · 与薄板同平面的悬臂梁',
    '2T': '2T · 厚度渐缩梁（直立）',
    '5T': '5T · 厚度渐缩梁（平面）',
  };
  const QCOLORS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#f59e0b', '#db2777', '#64748b'];

  function friction(mu, a) {
    const t = Math.tan(a * Math.PI / 180);
    return (mu + t) / (1 - mu * t);
  }
  function interpQ(p, x) {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[p.length - 1][0]) return p[p.length - 1][1];
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        const a = p[i - 1], b = p[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return p[p.length - 1][1];
  }

  T.register({
    id: 'snapfit',
    refreshDraft: calc,
    title: '塑料卡扣',
    icon: '🧩',
    group: '机械尺寸',
    desc: '基于 Snap-Fit Joints for Plastics + BASF Design Manual：直悬臂/L型/U型/扭转/环形卡扣，含 Q 柔度修正与应变应力双限值校核。',

    render(host) {
      const matOpts = Object.keys(MATERIALS).map((k) => `<option value="${E.escapeHtml(k)}">${k}</option>`).join('')
        + '<option value="__custom">＋ 自定义材料</option>';
      const designBtns = Object.entries(DESIGNS).map(([k, x]) =>
        `<button class="choice-btn ${k === 'thickness' ? 'selected' : ''}" data-design="${k}"><strong>${x.name}</strong><small>${x.tip}</small></button>`
      ).join('');
      const qOpts = Object.keys(QTABLES).map((k) => `<option value="${k}">${QLABELS[k]}</option>`).join('');

      host.innerHTML = `
        <div class="panel" style="background:var(--info-soft);border-color:#bae6fd">
          <div class="doc-link">
            <span class="doc-icon">DOC</span>
            <span>使用前请阅读设计文档，了解各参数（臂长/厚度/倒扣/导入角/Q 系数/L1/L2/R 等）的含义与取值方法：</span>
            <a href="docs/Plastic_Snap_fit_design.pdf" target="_blank" rel="noopener">Snap-Fit Joints for Plastics（打开/下载）</a>
            <span>·</span>
            <a href="docs/Snap-Fit Design Manual.pdf" target="_blank" rel="noopener">BASF Snap-Fit Design Manual（打开/下载）</a>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>材料与工况</h3>
          <div class="grid cols-2">
            <div class="field"><label>材料</label><select id="sf-mat">${matOpts}</select></div>
            <div class="field"><label>装拆工况</label><select id="sf-usage">
              <option value="single">一次装配（100%）</option>
              <option value="repeat">反复装拆（60%）</option>
            </select></div>
          </div>
          <div class="note" style="margin-top:12px">允许短期应变 <b id="sf-allowed">—</b> · Es 与摩擦系数可按具体牌号实测值覆盖</div>
          <div id="sf-custom" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">
            <h4 style="margin:0 0 10px;font-size:14px">自定义材料参数</h4>
            <div class="grid cols-4">
              <div class="field"><label>材料名称</label><div class="input-row"><input id="sf-cus-name" type="text" placeholder="自定义材料名称"></div></div>
              <div class="field"><label>允许短期应变</label><div class="input-row"><input id="sf-cus-strain" type="number" value="2.5" min="0" step="any"><span class="unit">%</span></div></div>
              <div class="field"><label>割线模量 Es</label><div class="input-row"><input id="sf-cus-es" type="number" value="4830" min="0" step="any"><span class="unit">MPa</span></div></div>
              <div class="field"><label>摩擦系数 μ</label><div class="input-row"><input id="sf-cus-mu" type="number" value="0.3" min="0" step="any"></div></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>卡扣类型与尺寸</h3>
          <div class="kind-tabs">
            <button class="kind-tab active" data-kind="cantilever">悬臂卡扣</button>
            <button class="kind-tab" data-kind="torsion">扭转卡扣</button>
            <button class="kind-tab" data-kind="annular">环形卡扣</button>
          </div>

          <!-- 悬臂：四种子模型 -->
          <div id="sf-cantilever">
            <div class="beam-tabs">
              ${Object.keys(BEAMS).map((k) => `<button class="kind-tab ${k === 'straight' ? 'active' : ''}" data-beam="${k}">${BEAMS[k]}</button>`).join('')}
            </div>

            <!-- 直悬臂 -->
            <div id="sf-cant-straight">
              <div class="choice">${designBtns}</div>
              <div class="grid cols-4">
                <div class="field"><label>臂长 l</label><div class="input-row"><input id="sf-l" type="number" value="15" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>根部宽度 b</label><div class="input-row"><input id="sf-b" type="number" value="6" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>根部厚度 h</label><div class="input-row"><input id="sf-h" type="number" value="3" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>实际倒扣 y</label><div class="input-row"><input id="sf-y" type="number" value="2.4" min="0" step="any"><span class="unit">mm</span></div></div>
              </div>
              <h3 class="panel-title" style="margin-top:16px"><span class="dot"></span>短梁与安装壁挠度修正</h3>
              <div class="grid cols-2">
                <div class="field"><label>Q 系数结构类型</label><select id="sf-qcfg">${qOpts}</select></div>
                <div class="field"><label>Q 取值方式</label><select id="sf-qmode">
                  <option value="auto">按 L/h 曲线插值</option>
                  <option value="manual">手动输入</option>
                </select></div>
                <div class="field"><label>挠度放大系数 Q</label><div class="input-row"><input id="sf-q" type="number" value="1" min="0" step="any"></div></div>
                <div class="field"><label>许用根部应力 σallow</label><div class="input-row"><input id="sf-stresslimit" type="number" value="72.6" min="0" step="any"><span class="unit">MPa</span></div></div>
              </div>
              <div class="note">当前长厚比 L/h = <b id="sf-aspect">—</b>。Q 曲线主要修正短梁安装壁柔度；L/h &gt; 10 时通常趋近传统梁模型。</div>
            </div>

            <!-- L / U 型 -->
            <div id="sf-cant-lu" style="display:none">
              <div class="grid cols-4">
                <div class="field"><label>第一直臂 L1</label><div class="input-row"><input id="sf-l1" type="number" value="12.7" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>第二直臂/开槽 L2</label><div class="input-row"><input id="sf-l2" type="number" value="24.2316" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field" id="sf-l3-wrap" style="display:none"><label>末端直臂 L3</label><div class="input-row"><input id="sf-l3" type="number" value="6.9342" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>中性层弯曲半径 R</label><div class="input-row"><input id="sf-bendr" type="number" value="3.048" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>截面宽度 b</label><div class="input-row"><input id="sf-lu-b" type="number" value="6" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>截面厚度 h</label><div class="input-row"><input id="sf-lu-h" type="number" value="3" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>实际倒扣 y</label><div class="input-row"><input id="sf-lu-y" type="number" value="2" min="0" step="any"><span class="unit">mm</span></div></div>
                <div class="field"><label>许用根部应力 σallow</label><div class="input-row"><input id="sf-lu-stresslimit" type="number" value="72.6" min="0" step="any"><span class="unit">MPa</span></div></div>
              </div>
              <div class="note">尺寸沿卡扣<b>中性层路径</b>定义，R 为弯曲段中性层半径。L/U 模型按文档 V-2～V-4 等截面公式计算，<b>不叠加直梁 Q 系数</b>。</div>
            </div>
          </div>

          <!-- 扭转 -->
          <div id="sf-torsion" style="display:none">
            <div class="grid cols-3">
              <div class="field"><label>扭杆长度 l</label><div class="input-row"><input id="sf-barl" type="number" value="20" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>扭杆半径 r</label><div class="input-row"><input id="sf-barr" type="number" value="2" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>摇臂长度 l₁</label><div class="input-row"><input id="sf-lever" type="number" value="15" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>所需位移 y</label><div class="input-row"><input id="sf-y2" type="number" value="2.4" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>扭杆数量</label><div class="input-row"><input id="sf-bars" type="number" value="2" min="1" step="1"><span class="unit">根</span></div></div>
            </div>
          </div>

          <!-- 环形 -->
          <div id="sf-annular" style="display:none">
            <div class="grid cols-4">
              <div class="field"><label>接合直径 d</label><div class="input-row"><input id="sf-d" type="number" value="200" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>外筒外径 d₀</label><div class="input-row"><input id="sf-d0" type="number" value="205" min="0" step="any"><span class="unit">mm</span></div></div>
              <div class="field"><label>单个零件变形 y</label><div class="input-row"><input id="sf-anny" type="number" value="1" min="0" step="any"><span class="unit">mm</span></div></div>
            </div>
            <div class="range-row">
              <label>沟槽位置修正系数 <strong id="sf-loc-val">1.0×</strong></label>
              <input type="range" id="sf-loc" min="1" max="3" step="0.1" value="1">
              <small>靠近端部 1×；远离端部试验建议最高取 3×</small>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>材料与装配修正</h3>
          <div class="grid cols-4">
            <div class="field"><label>割线模量 Es</label><div class="input-row"><input id="sf-es" type="number" value="1815" min="0" step="any"><span class="unit">MPa</span></div></div>
            <div class="field"><label>摩擦系数 μ</label><div class="input-row"><input id="sf-mu" type="number" value="0.6" min="0" step="any"></div></div>
            <div class="field"><label>导入角 α</label><div class="input-row"><input id="sf-angle" type="number" value="30" min="0" step="any"><span class="unit">°</span></div></div>
            <div class="field"><label>泊松比 ν <span class="hint">扭转/环形用</span></label><div class="input-row"><input id="sf-nu" type="number" value="0.35" min="0" step="any"></div></div>
          </div>
        </div>

        <div class="panel" id="sf-result"></div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>参考图（BASF Snap-Fit Design Manual）</h3>
          <details open>
            <summary>展开 / 收起参考图</summary>
            <div class="ref-block">
              <div class="ref-title">Q 系数曲线（L/h – Q，Figure IV-1/IV-2）</div>
              <div class="ref-scroll"><img class="ref-img" src="img/snapfit-q-figure.png" alt="Q 系数曲线"></div>
            </div>
            <div class="ref-block">
              <div class="ref-title">卡扣应变 / 装配力参考图（Dry As Molded / ASME）</div>
              <div class="ref-scroll"><img class="ref-img" src="img/snapfit-strain-force.png" alt="卡扣应变与装配力参考图"></div>
            </div>
            <div class="ref-block">
              <div class="ref-title">卡扣安装结构与尺寸示意</div>
              <div class="ref-scroll"><img class="ref-img" src="img/snapfit-structures.png" alt="卡扣安装结构示意"></div>
            </div>
          </details>
        </div>
      `;

      // 材料选择 → 自动填充 Es / μ / 许用应力（两处）
      document.getElementById('sf-mat').addEventListener('change', () => {
        const mat = document.getElementById('sf-mat').value;
        const customPanel = document.getElementById('sf-custom');
        if (mat === '__custom') {
          customPanel.style.display = 'block';
          document.getElementById('sf-es').value = document.getElementById('sf-cus-es').value || 4830;
          document.getElementById('sf-mu').value = document.getElementById('sf-cus-mu').value || 0.3;
        } else {
          customPanel.style.display = 'none';
          const m = MATERIALS[mat];
          document.getElementById('sf-es').value = m.es;
          document.getElementById('sf-mu').value = m.mu;
          const sl = (m.es * m.strain / 100).toFixed(2);
          document.getElementById('sf-stresslimit').value = sl;
          document.getElementById('sf-lu-stresslimit').value = sl;
        }
        calc();
      });

      ['sf-cus-strain', 'sf-cus-es', 'sf-cus-mu'].forEach((id) => {
        document.getElementById(id).addEventListener('input', () => {
          if (document.getElementById('sf-mat').value === '__custom') {
            document.getElementById('sf-es').value = document.getElementById('sf-cus-es').value;
            document.getElementById('sf-mu').value = document.getElementById('sf-cus-mu').value;
          }
          calc();
        });
      });

      // 卡扣类型 tab
      document.querySelectorAll('.kind-tab[data-kind]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.kind-tab[data-kind]').forEach((x) => x.classList.remove('active'));
          btn.classList.add('active');
          const k = btn.dataset.kind;
          ['cantilever', 'torsion', 'annular'].forEach((id) => {
            document.getElementById('sf-' + id).style.display = id === k ? 'block' : 'none';
          });
          calc();
        });
      });

      // 悬臂子模型 tab（直/L/U）
      document.querySelectorAll('.kind-tab[data-beam]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.kind-tab[data-beam]').forEach((x) => x.classList.remove('active'));
          btn.classList.add('active');
          const bm = btn.dataset.beam;
          document.getElementById('sf-cant-straight').style.display = bm === 'straight' ? 'block' : 'none';
          document.getElementById('sf-cant-lu').style.display = bm === 'straight' ? 'none' : 'block';
          document.getElementById('sf-l3-wrap').style.display = bm === 'ucase2' ? 'block' : 'none';
          calc();
        });
      });

      // 直悬臂设计方式（厚度渐缩→2T，其他→2）
      document.querySelectorAll('.choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.choice-btn').forEach((x) => x.classList.remove('selected'));
          btn.classList.add('selected');
          document.getElementById('sf-qcfg').value = btn.dataset.design === 'thickness' ? '2T' : '2';
          calc();
        });
      });

      document.getElementById('sf-loc').addEventListener('input', () => {
        document.getElementById('sf-loc-val').textContent = Number(document.getElementById('sf-loc').value).toFixed(1) + '×';
        calc();
      });

      ['sf-mat', 'sf-usage', 'sf-l', 'sf-b', 'sf-h', 'sf-y', 'sf-qcfg', 'sf-qmode', 'sf-q', 'sf-stresslimit',
       'sf-l1', 'sf-l2', 'sf-l3', 'sf-bendr', 'sf-lu-b', 'sf-lu-h', 'sf-lu-y', 'sf-lu-stresslimit',
       'sf-barl', 'sf-barr', 'sf-lever', 'sf-y2', 'sf-bars', 'sf-d', 'sf-d0', 'sf-anny',
       'sf-es', 'sf-mu', 'sf-angle', 'sf-nu']
        .forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('input', calc);
        });

      calc();
    },
  });

  function calc() {
    const E = window.ElUtil;
    const kind = document.querySelector('.kind-tab[data-kind].active').dataset.kind;
    const material = document.getElementById('sf-mat').value;
    const usage = document.getElementById('sf-usage').value;
    let m;
    if (material === '__custom') {
      m = {
        strain: E.parseNum(document.getElementById('sf-cus-strain').value) || 0,
        es: E.parseNum(document.getElementById('sf-es').value) || 0,
        mu: E.parseNum(document.getElementById('sf-mu').value) || 0,
      };
    } else {
      m = MATERIALS[material];
    }
    const es = E.parseNum(document.getElementById('sf-es').value) || m.es;
    const mu = E.parseNum(document.getElementById('sf-mu').value) || m.mu;
    const angle = E.parseNum(document.getElementById('sf-angle').value) || 0;
    const nu = E.parseNum(document.getElementById('sf-nu').value) || 0.35;

    const allowed = m.strain * (usage === 'repeat' ? 0.6 : 1); // %
    const epsDec = allowed / 100;
    const ff = friction(mu, angle);
    document.getElementById('sf-allowed').textContent = allowed.toFixed(2) + '%';

    const box = document.getElementById('sf-result');
    const bad = (msg) => {
      box.innerHTML = `<div class="status-banner err">${msg}</div>`;
      return;
    };

    let r;
    if (kind === 'cantilever') {
      const beamModel = document.querySelector('.kind-tab[data-beam].active').dataset.beam;
      const controlEps = Math.min(epsDec, (document.getElementById('sf-stresslimit').value || 0) / es);

      if (beamModel === 'straight') {
        const design = document.querySelector('.choice-btn.selected').dataset.design;
        const ky = DESIGNS[design].ky;
        const l = E.parseNum(document.getElementById('sf-l').value);
        const b = E.parseNum(document.getElementById('sf-b').value);
        const h = E.parseNum(document.getElementById('sf-h').value);
        const y = E.parseNum(document.getElementById('sf-y').value);
        const qcfg = document.getElementById('sf-qcfg').value;
        const qmode = document.getElementById('sf-qmode').value;
        const stressLimit = E.parseNum(document.getElementById('sf-stresslimit').value) || 0;
        if (![l, b, h, y].every((v) => v != null && v > 0)) return bad('请填写直悬臂尺寸（l/b/h/y 均 > 0）。');

        const aspect = l / h;
        let q;
        if (qmode === 'auto') {
          q = interpQ(QTABLES[qcfg], aspect);
          document.getElementById('sf-q').value = q.toFixed(3);
          document.getElementById('sf-q').disabled = true;
        } else {
          document.getElementById('sf-q').disabled = false;
          q = E.parseNum(document.getElementById('sf-q').value) || 1;
        }
        document.getElementById('sf-aspect').textContent = aspect.toFixed(2);

        const strainPct = y * h / (ky * l * l * q) * 100;
        const stress = es * strainPct / 100;
        const force = b * h * h * es * (strainPct / 100) / (6 * l);
        const allowable = ky * controlEps * l * l * q / h;

        const qChart = T.lineChart({
          width: 760, height: 400,
          title: `BASF Q 系数曲线（当前 L/h=${fmtN(aspect, 2)}，Q=${fmtN(q, 2)}）`,
          x: { label: '长厚比 L/h' },
          y: { label: 'Q 挠度放大系数' },
          series: Object.keys(QTABLES).map((k, i) => ({ name: k, color: QCOLORS[i % QCOLORS.length], points: QTABLES[k] })),
          vLines: [{ x: aspect, color: '#dc2626', label: '当前 L/h', dashed: true }],
          scatter: [{ color: '#dc2626', points: [[aspect, q]] }],
        });

        r = {
          strain: strainPct, stress, q, aspect, allowable, force, W: force * ff, ff,
          status: strainPct <= allowed && stress <= stressLimit,
          chartHtml: `<div class="normal-chart-wrap">${qChart}</div>`,
          formula: [
            `ε = y·h/(${ky.toFixed(3)}·l²·Q) = ${fmtN(strainPct, 3)}%`,
            `σ = Es·ε = ${fmtN(stress, 1)} MPa`,
            `ymax = min(εallow, σallow/Es)·${ky.toFixed(3)}·l²·Q/h = ${fmtN(allowable, 2)} mm`,
            `P = b·h²·σ/(6l) = ${fmtN(force, 1)} N`,
          ],
        };
      } else {
        const l1 = E.parseNum(document.getElementById('sf-l1').value);
        const l2 = E.parseNum(document.getElementById('sf-l2').value);
        const l3 = E.parseNum(document.getElementById('sf-l3').value);
        const R = E.parseNum(document.getElementById('sf-bendr').value);
        const b = E.parseNum(document.getElementById('sf-lu-b').value);
        const h = E.parseNum(document.getElementById('sf-lu-h').value);
        const y = E.parseNum(document.getElementById('sf-lu-y').value);
        const stressLimit = E.parseNum(document.getElementById('sf-lu-stresslimit').value) || 0;
        if (![l1, l2, R, b, h, y].every((v) => v != null && v > 0)) return bad('请填写 L/U 型尺寸（L1/L2/R/b/h/y 均 > 0）。');

        const I = b * h * h * h / 12;
        const curve = l1 * (2 * Math.PI * l1 + 8 * R) + Math.PI * R * R;
        let A, Ceps, Cp, label;
        if (beamModel === 'lshape') {
          A = 4 * l1 ** 3 + 3 * R * curve + 12 * l2 * (l1 + R) ** 2;
          Ceps = 6; Cp = 12; label = 'L 型';
        } else if (beamModel === 'ucase1') {
          A = 6 * l1 ** 3 + 9 * R * curve + 6 * l2 * (3 * l1 * l1 - 3 * l1 * l2 + l2 * l2);
          Ceps = 9; Cp = 18; label = 'U 型 Case 1';
        } else {
          if (l3 == null || l3 <= 0) return bad('U 型 Case 2 需填写末端直臂 L3。');
          A = 4 * l1 ** 3 + 2 * l3 ** 3 + 3 * R * curve;
          Ceps = 3; Cp = 6; label = 'U 型 Case 2';
        }

        const strainFactor = Ceps * (l1 + R);
        const strainDec = y * h * strainFactor / A;
        const strainPct = strainDec * 100;
        const stress = es * strainDec;
        const force = y * Cp * es * I / A;
        const allowable = controlEps * A / (h * strainFactor);
        const aspect = l1 / h;

        r = {
          strain: strainPct, stress, q: 1, aspect, allowable, force, W: force * ff, ff,
          status: strainDec <= epsDec && stress <= stressLimit,
          chartHtml: '',
          formula: [
            `A = ${label} 柔度项 = ${fmtN(A, 1)}`,
            `ε = ${Ceps}·(L1+R)·h·y/A = ${fmtN(strainPct, 3)}%`,
            `σ = Es·ε = ${fmtN(stress, 1)} MPa`,
            `ymax = min(εallow, σallow/Es)·A/[${Ceps}·(L1+R)·h] = ${fmtN(allowable, 2)} mm`,
            `P = ${Cp}·Es·I·y/A = ${fmtN(force, 1)} N，I=b·h³/12=${fmtN(I, 3)} mm⁴`,
          ],
        };
      }
    } else if (kind === 'torsion') {
      const l = E.parseNum(document.getElementById('sf-barl').value);
      const rodR = E.parseNum(document.getElementById('sf-barr').value);
      const lever = E.parseNum(document.getElementById('sf-lever').value);
      const y = E.parseNum(document.getElementById('sf-y2').value);
      const bars = E.parseNum(document.getElementById('sf-bars').value);
      if (![l, rodR, lever, y].every((v) => v != null && v > 0) || bars < 1) return bad('请填写扭转卡扣尺寸（l/r/l₁/y 均 > 0，数量 ≥ 1）。');
      const gamma = 1.35 * epsDec;
      const phi = gamma * l / rodR;
      const allowable = lever * Math.sin(phi);
      const G = es / (2 * (1 + nu));
      const Ip = Math.PI * Math.pow(rodR, 4) / 2;
      const force = gamma * G * Ip * bars / (rodR * lever);
      r = { strain: gamma * 100, allowable, force, W: force * ff, ff, status: y <= allowable, chartHtml: '', formula: [
        `γpm ≈ 1.35·εpm = ${fmtN(gamma * 100, 3)}%`,
        `φpm = γpm·l/r = ${fmtN(phi, 3)} rad`,
        `P·l₁ = γ·G·Ip·n/r → P = ${fmtN(force, 1)} N`,
      ] };
    } else {
      const d = E.parseNum(document.getElementById('sf-d').value);
      const d0 = E.parseNum(document.getElementById('sf-d0').value);
      const y = E.parseNum(document.getElementById('sf-anny').value);
      const loc = E.parseNum(document.getElementById('sf-loc').value);
      if (![d, d0, y].every((v) => v != null && v > 0)) return bad('请填写环形卡扣尺寸（d/d₀/y 均 > 0）。');
      const q = d0 / d;
      const X = 0.62 * Math.sqrt((q - 1) / (q + 1)) / (((q * q + 1) / (q * q - 1)) + nu);
      const strainPct = y / d * 100;
      const force = y * d * es * X * loc;
      const allowable = epsDec * d;
      r = { strain: strainPct, allowable, force, W: force * ff, ff, status: strainPct <= allowed, X, chartHtml: '', formula: [
        `ε = y/d = ${fmtN(strainPct, 3)}%`,
        `P = y·d·Es·X·位置系数 = ${fmtN(force, 1)} N`,
        `X = ${fmtN(X, 6)}`,
      ] };
    }

    const verdictCls = r.status ? 'ok' : 'err';
    const verdictTxt = r.status ? '校核通过' : '超出允许值';
    const strainLabel = kind === 'torsion' ? '最大剪应变 γpm' : '计算应变 ε';
    const statusText = kind === 'torsion'
      ? `所需位移 y = ${fmtN(3 * 0 + (document.getElementById('sf-y2').value || 0), 2)} mm ${r.status ? '≤' : '>'} 允许位移 ${fmtN(r.allowable, 2)} mm`
      : `${strainLabel} = ${fmtN(r.strain, 3)}% ${r.status ? '≤' : '>'} 允许应变 ${fmtN(allowed, 2)}%`;

    let stressCard = '';
    if (kind === 'cantilever') {
      const beamModel = document.querySelector('.kind-tab[data-beam].active').dataset.beam;
      const sl = beamModel === 'straight'
        ? document.getElementById('sf-stresslimit').value
        : document.getElementById('sf-lu-stresslimit').value;
      stressCard = `<div class="result-card"><div class="k">根部最大弯曲应力 σ</div>
        <div class="v">${fmtN(r.stress, 1)}<small> MPa</small></div>
        <div class="k" style="margin-top:6px">许用 ${fmtN(3 * 0 + (sl || 0), 1)} MPa${beamModel === 'straight' ? ` · Q=${fmtN(r.q, 2)}` : ''} · L/h=${fmtN(r.aspect, 2)}</div></div>`;
    }

    box.innerHTML = `
      <div class="status-banner ${verdictCls}"><b>${verdictTxt}</b>　${statusText}</div>
      <div class="result-grid">
        <div class="result-card"><div class="k">装配力 W</div><div class="v">${fmtN(r.W, 1)}<small> N</small></div></div>
        <div class="result-card"><div class="k">拨动力 P</div><div class="v">${fmtN(r.force, 1)}<small> N</small></div></div>
        <div class="result-card"><div class="k">双限值允许变形</div><div class="v">${fmtN(r.allowable)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">${strainLabel}</div><div class="v">${fmtN(r.strain, 3)}<small> %</small></div></div>
        ${stressCard}
      </div>
      ${r.chartHtml || ''}
      <div class="note"><strong>本次计算链：</strong>
        ${r.formula.map((f) => `<code class="formula-line">${f}</code>`).join('')}
        <code class="formula-line">W = P·(μ + tanα)/(1 − μ·tanα) = ${fmtN(r.force, 1)} × ${fmtN(ff, 3)} = ${fmtN(r.W, 1)} N</code>
      </div>
    `;
  }

  function fmtN(v, d) {
    return Number.isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—';
  }
})();
