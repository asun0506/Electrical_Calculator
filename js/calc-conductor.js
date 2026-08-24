/**
 * 计算器 2：导体沿长度方向电阻
 *
 * R = ρ · L / A
 *   ρ —— 导体电阻率（Ω·m，20°C），带温度修正
 *   L —— 导体长度（m）
 *   A —— 截面积（m²），矩形截面 A = 宽 × 高
 *
 * 支持单导体计算，以及多导体串联 / 并联 / 混联（分支）组合：
 *   表达式引用段 R1..Rn（对应各段电阻），运算符：
 *     +   串联（求和）
 *     //  并联（1/Σ(1/R)）
 *     ( ) 分组
 *   也可直接输入固定电阻值（Ω）参与组合。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  let rowSeq = 0;

  // 常用导体材料：ρ20（Ω·m），α（温度系数 /°C）
  const MATERIALS = {
    copper: { name: '铜 Cu（退火）', rho: 1.72e-8, alpha: 0.00393 },
    copper_hard: { name: '铜 Cu（硬拉）', rho: 1.77e-8, alpha: 0.00393 },
    aluminum: { name: '铝 Al', rho: 2.82e-8, alpha: 0.00403 },
    silver: { name: '银 Ag', rho: 1.59e-8, alpha: 0.0038 },
    gold: { name: '金 Au', rho: 2.44e-8, alpha: 0.0034 },
    iron: { name: '铁 Fe', rho: 9.71e-8, alpha: 0.005 },
    brass: { name: '黄铜（60Cu40Zn）', rho: 6.5e-8, alpha: 0.0015 },
    tin: { name: '锡 Sn', rho: 1.1e-7, alpha: 0.0042 },
    steel: { name: '钢（低碳）', rho: 1.4e-7, alpha: 0.005 },
  };

  /** 表达式分词：数字 → number；运算符 + ( ) → 字符串；// 并联；R<i> → 'Ri' */
  function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '+' || c === '(' || c === ')') { tokens.push(c); i++; continue; }
      if (c === '/' && str[i + 1] === '/') { tokens.push('//'); i += 2; continue; }
      const num = str.slice(i).match(/^\d+(\.\d+)?/);
      if (num) { tokens.push(parseFloat(num[0])); i += num[0].length; continue; }
      const ref = str.slice(i).match(/^R\s*(\d+)/i);
      if (ref) { tokens.push('R' + parseInt(ref[1], 10)); i += ref[0].length; continue; }
      throw new Error('无法识别的字符「' + c + '」');
    }
    return tokens;
  }

  /** 递归下降求值表达式（+ 与 // 同级、左结合；括号优先） */
  function evalExpr(tokens, Rmap) {
    let pos = 0;
    function parseTerm() {
      const tok = tokens[pos];
      if (tok === '(') {
        pos++;
        const v = parseExpr();
        if (tokens[pos] !== ')') throw new Error('缺少右括号 )');
        pos++;
        return v;
      }
      if (typeof tok === 'number') { pos++; return tok; }
      if (typeof tok === 'string' && /^R\d+$/.test(tok)) {
        pos++;
        const idx = parseInt(tok.slice(1), 10);
        if (!(idx in Rmap)) throw new Error('段 R' + idx + ' 未定义（仅有 ' + Object.keys(Rmap).length + ' 段）');
        return Rmap[idx];
      }
      throw new Error('表达式错误（' + tok + ' 附近）');
    }
    function parseExpr() {
      let val = parseTerm();
      while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '//')) {
        const op = tokens[pos++];
        const rhs = parseTerm();
        if (op === '+') val = val + rhs;        // 串联
        else val = (val * rhs) / (val + rhs);    // 并联 1/Σ(1/R)
      }
      return val;
    }
    const v = parseExpr();
    if (pos !== tokens.length) throw new Error('表达式存在多余内容');
    return v;
  }

  T.register({
    id: 'conductor',
    title: '导体电阻',
    icon: '🧪',
    group: '电气计算',
    desc: '选择导体材质，输入长度与矩形截面长宽，计算导体电阻；并支持多导体串联/并联/混联组合。',

    render(host) {
      const opts = Object.keys(MATERIALS)
        .map((k) => `<option value="${k}">${MATERIALS[k].name}</option>`)
        .join('');

      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>导体参数</h3>
          <div class="grid cols-3">
            <div class="field"><label>导体材质</label><select id="cd-mat">${opts}</select></div>
            <div class="field"><label>长度 <span class="hint">L</span></label>
              <div class="input-row"><input id="cd-len" type="number" value="1000" min="0" step="any"><span class="unit">mm</span></div></div>
            <div class="field"><label>工作温度 <span class="hint">T</span></label>
              <div class="input-row"><input id="cd-temp" type="number" value="20" step="any"><span class="unit">°C</span></div></div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>矩形截面尺寸</h3>
          <div class="grid cols-3">
            <div class="field"><label>宽度 <span class="hint">w</span></label>
              <div class="input-row"><input id="cd-w" type="number" value="5" min="0" step="any"><span class="unit">mm</span></div></div>
            <div class="field"><label>高度（厚度）<span class="hint">h</span></label>
              <div class="input-row"><input id="cd-h" type="number" value="1" min="0" step="any"><span class="unit">mm</span></div></div>
            <div class="field"><label>并联芯数 <span class="hint">n（1 表示单根）</span></label>
              <div class="input-row"><input id="cd-n" type="number" value="1" min="1" step="1"><span class="unit">根</span></div></div>
          </div>
          <div class="note" id="cd-cross-note"></div>
          <div class="btn-row">
            <button class="btn btn-primary" id="cd-calc">计算电阻</button>
          </div>
        </div>

        <div class="panel" id="cd-result" style="display:none"></div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>多导体串联 / 并联 / 混联组合</h3>
          <div class="field">
            <label>组合表达式 <span class="hint">R1..Rn 引用导体段；+ 串联、// 并联、() 分组；可直接输入电阻值(Ω)</span></label>
            <div class="input-row"><input id="cd-expr" type="text" value="R1 + R2" spellcheck="false"></div>
          </div>
          <div class="btn-row">
            <button class="btn btn-ghost btn-sm" id="cd-ser">全串联</button>
            <button class="btn btn-ghost btn-sm" id="cd-par">全并联</button>
          </div>
          <p style="margin:12px 0 6px;color:var(--text-muted);font-size:13px">导体段（按顺序编号 R1, R2, …）：</p>
          <div class="comb-head">
            <span>段</span><span>材质</span><span>长度 (mm)</span><span>宽 (mm)</span><span>高 (mm)</span><span>温度 (°C)</span><span></span>
          </div>
          <div id="cd-rows"></div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="cd-add">＋ 添加导体段</button>
          </div>
          <div class="note" style="margin-top:12px">示例：<code class="formula-line">R1 + (R2 // R3)</code> 表示 R1 与（R2 并联 R3）串联。可混入固定阻值，如 <code class="formula-line">R1 + 5.6</code>。</div>
        </div>

        <div class="panel" id="cd-comb-result" style="display:none"></div>
      `;

      // 单导体实时提示
      const updateCross = () => {
        const w = ElUtil.parseNum(document.getElementById('cd-w').value);
        const h = ElUtil.parseNum(document.getElementById('cd-h').value);
        const mat = MATERIALS[document.getElementById('cd-mat').value];
        const note = document.getElementById('cd-cross-note');
        if (w != null && h != null) {
          note.innerHTML = `截面积 A = ${ElUtil.fmtExact(w)} × ${ElUtil.fmtExact(h)} = <b>${ElUtil.fmtExact(w * h)} mm²</b>。20°C 时 ${mat.name} 电阻率 ρ = ${mat.rho.toExponential(2)} Ω·m。`;
        } else {
          note.innerHTML = '请输入截面宽与高。';
        }
      };
      ['cd-w', 'cd-h', 'cd-mat'].forEach((id) => document.getElementById(id).addEventListener('input', updateCross));
      document.getElementById('cd-calc').addEventListener('click', calc);
      updateCross();
      calc();

      // 多导体组合
      addCombRow('copper', 500, 5, 1, 20);
      addCombRow('aluminum', 800, 5, 1, 20);
      document.getElementById('cd-add').addEventListener('click', () => addCombRow('copper', 100, 5, 1, 20));
      document.getElementById('cd-expr').addEventListener('input', calcComb);
      document.getElementById('cd-ser').addEventListener('click', () => {
        document.getElementById('cd-expr').value = allExpr('+');
        calcComb();
      });
      document.getElementById('cd-par').addEventListener('click', () => {
        document.getElementById('cd-expr').value = allExpr('//');
        calcComb();
      });
      calcComb();
    },
  });

  /** 新增一个导体段行（带段编号 R1, R2, …） */
  function addCombRow(mat, len, w, h, temp) {
    const rows = document.getElementById('cd-rows');
    const div = document.createElement('div');
    div.className = 'bd-row comb-row';
    div.dataset.row = rowSeq++;
    const opts = Object.keys(MATERIALS)
      .map((k) => `<option value="${k}" ${k === mat ? 'selected' : ''}>${MATERIALS[k].name}</option>`)
      .join('');
    div.innerHTML = `
      <span class="cbm-idx">R${rows.children.length + 1}</span>
      <select class="cbm-mat">${opts}</select>
      <input type="number" class="cbm-len" value="${len}" min="0" step="any">
      <input type="number" class="cbm-w" value="${w}" min="0" step="any">
      <input type="number" class="cbm-h" value="${h}" min="0" step="any">
      <input type="number" class="cbm-temp" value="${temp}" step="any">
      <button class="row-del" type="button" title="删除该段">✕</button>
    `;
    div.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', calcComb));
    div.querySelector('.row-del').addEventListener('click', () => {
      if (rows.children.length > 1) { div.remove(); renumberRows(); calcComb(); }
      else div.querySelector('.cbm-len').value = '';
    });
    rows.appendChild(div);
  }

  function renumberRows() {
    const rows = document.querySelectorAll('#cd-rows .comb-row');
    rows.forEach((row, i) => { row.querySelector('.cbm-idx').textContent = 'R' + (i + 1); });
  }

  /** 生成全串联 / 全并联表达式 */
  function allExpr(op) {
    const n = document.querySelectorAll('#cd-rows .comb-row').length;
    return Array.from({ length: n }, (_, i) => 'R' + (i + 1)).join(' ' + op + ' ');
  }

  /** 计算多导体混联组合总电阻（表达式） */
  function calcComb() {
    const E = window.ElUtil;
    const expr = document.getElementById('cd-expr').value;
    const rows = document.querySelectorAll('#cd-rows .comb-row');
    const box = document.getElementById('cd-comb-result');

    const Rmap = {};
    let valid = 0;
    rows.forEach((row, idx) => {
      const mat = MATERIALS[row.querySelector('.cbm-mat').value];
      const Lmm = E.parseNum(row.querySelector('.cbm-len').value);
      const w = E.parseNum(row.querySelector('.cbm-w').value);
      const h = E.parseNum(row.querySelector('.cbm-h').value);
      const temp = E.parseNum(row.querySelector('.cbm-temp').value);
      if (Lmm == null || w == null || h == null || temp == null) return;
      if (Lmm <= 0 || w <= 0 || h <= 0) return;
      const rhoT = mat.rho * (1 + mat.alpha * (temp - 20));
      const R = (rhoT * (Lmm / 1000)) / ((w * h) / 1e6);
      Rmap[idx + 1] = R;
      valid++;
    });

    if (!valid) {
      box.innerHTML = `<div class="status-banner warn">请至少填写一个完整的导体段（材质/长度/宽/高/温度）。</div>`;
      box.style.display = 'block';
      return;
    }

    let totalR;
    try {
      totalR = evalExpr(tokenize(expr), Rmap);
    } catch (err) {
      box.innerHTML = `<div class="status-banner err">表达式错误：${err.message}</div>`;
      box.style.display = 'block';
      return;
    }

    const table = `
      <table class="param-table">
        <tr><th>段</th><th>材质</th><th>长度 (mm)</th><th>截面 (mm²)</th><th>温度 (°C)</th><th>电阻 Ri (Ω)</th></tr>
        ${Object.keys(Rmap).map((k) => `<tr><td>R${k}</td><td>${rows[Number(k) - 1] ? MATERIALS[rows[Number(k) - 1].querySelector('.cbm-mat').value].name : ''}</td><td></td><td></td><td></td><td>${E.fmt(Rmap[k])}</td></tr>`).join('')}
      </table>`;

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>多导体组合结果（表达式：<code class="formula-line" style="display:inline">${E.escapeHtml(expr)}</code>）</h3>
      ${table}
      <div class="result-grid" style="margin-top:12px">
        <div class="result-card"><div class="k">组合总电阻 R</div>
          <div class="v">${E.fmt(totalR)}<small> Ω</small></div></div>
        <div class="result-card"><div class="k">总电导 G = 1/R</div>
          <div class="v">${E.fmt(1 / totalR)}<small> S</small></div></div>
      </div>
      <div class="status-banner ok">${E.escapeHtml(expr)} = <b>${E.fmt(totalR)} Ω</b></div>
    `;
    box.style.display = 'block';
  }

  function calc() {
    const E = window.ElUtil;
    const matKey = document.getElementById('cd-mat').value;
    const mat = MATERIALS[matKey];
    const Lmm = E.parseNum(document.getElementById('cd-len').value);
    const Tdeg = E.parseNum(document.getElementById('cd-temp').value);
    const w = E.parseNum(document.getElementById('cd-w').value);
    const h = E.parseNum(document.getElementById('cd-h').value);
    const n = E.parseNum(document.getElementById('cd-n').value);

    const resultBox = document.getElementById('cd-result');
    const bad = (msg) => {
      resultBox.innerHTML = `<div class="status-banner err">${msg}</div>`;
      resultBox.style.display = 'block';
    };

    if (Lmm == null || Tdeg == null || w == null || h == null || n == null) return bad('请填写所有必填项。');
    if (Lmm <= 0 || w <= 0 || h <= 0 || n <= 0) return bad('长度、宽、高、芯数必须大于 0。');

    const L = Lmm / 1000;
    const A = (w * h) / 1e6;
    const rho20 = mat.rho;
    const rhoT = rho20 * (1 + mat.alpha * (Tdeg - 20));
    const R_single = (rhoT * L) / A;
    const R = R_single / n;
    const G = 1 / R;

    resultBox.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>计算结果</h3>
      <div class="result-grid">
        <div class="result-card"><div class="k">截面积 A</div>
          <div class="v">${E.fmtExact(w * h)}<small> mm²</small></div></div>
        <div class="result-card"><div class="k">${E.fmtExact(Tdeg)}°C 电阻率 ρ</div>
          <div class="v">${rhoT.toExponential(2)}<small> Ω·m</small></div></div>
        <div class="result-card"><div class="k">单根电阻（n=1）</div>
          <div class="v">${E.fmt(R_single)}<small> Ω</small></div></div>
        <div class="result-card"><div class="k">${n === 1 ? '导体电阻' : n + ' 根并联电阻'}</div>
          <div class="v">${E.fmt(R)}<small> Ω</small></div></div>
        <div class="result-card"><div class="k">${n === 1 ? '电导 G' : n + ' 根并联电导'}</div>
          <div class="v">${E.fmt(G)}<small> S</small></div></div>
      </div>
      <div class="note">
        <strong>公式：</strong>R = ρ × L ÷ A = ${rhoT.toExponential(2)} Ω·m × ${E.fmtExact(L)} m ÷ ${E.fmtExact(A, 6)} m²
        ${n > 1 ? ' ÷ ' + n + '（并联）' : ''} ≈ <b>${E.fmt(R)} Ω</b>。
        温度为 20°C 时 ρ = ${rho20.toExponential(2)} Ω·m（${mat.name}）。
      </div>
    `;
    resultBox.style.display = 'block';
  }
})();
