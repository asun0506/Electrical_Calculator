/**
 * 计算器 4：线束最小折弯半径（支持多种线规组合）
 *
 * 一根线束常由多种规格导线组成。按"面积等效"计算整束等效外径：
 *   单根面积 A_i = π/4·d_i²，总截面积 A = Σ n_i·A_i
 *   等效外径 D = √(4·A/π) = √(Σ n_i·d_i²)
 *   最小折弯半径 R = K · D
 *   K 为弯曲系数，随线束外径增大而增大，且随弯折频繁程度增加。
 *
 * 系数参考常见线束工艺规范（经验值，供初版设计校核）：
 *   D<10mm      K=4
 *   10≤D<20mm   K=6
 *   20≤D<30mm   K=8
 *   D≥30mm      K=10
 *   可动安装 +2，长期反复折弯 +4。
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  let rowSeq = 0;

  function baseK(D) {
    if (D < 10) return 4;
    if (D < 20) return 6;
    if (D < 30) return 8;
    return 10;
  }

  const TYPE_ADD = { fixed: 0, movable: 2, dynamic: 4 };
  const TYPE_LABEL = { fixed: '固定安装', movable: '可动（受拉扯/震动）', dynamic: '长期反复折弯（拖链类）' };

  T.register({
    id: 'bend-radius',
    title: '折弯半径',
    icon: '📐',
    group: '电气计算',
    desc: '输入线束中各种规格导线的外径与数量，按面积等效计算线束外径与最小折弯半径，避免绝缘损坏与断芯。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>线束组成（多种线规）</h3>
          <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">
            每种规格一行：输入该规格导线的<b>外径 d（含绝缘层）</b>和<b>数量 n</b>。程序按面积等效（D=√Σn·d²）算出整束等效外径。
          </p>
          <div class="bd-head">
            <span>外径 d (mm)</span><span>数量 n (根)</span><span></span>
          </div>
          <div id="bd-rows"></div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="bd-add">＋ 添加线规</button>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>应用类型</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>应用类型</label>
              <select id="bd-type">
                <option value="fixed">固定安装</option>
                <option value="movable">可动（受拉扯 / 震动）</option>
                <option value="dynamic">长期反复折弯（拖链）</option>
              </select>
            </div>
            <div class="field" style="justify-content:flex-end">
              <div class="btn-row" style="margin:0">
                <button class="btn btn-primary" id="bd-calc">计算折弯半径</button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel" id="bd-result" style="display:none"></div>
      `;

      // 预置示例：两种规格组合
      addRow(2.5, 4);
      addRow(1.5, 6);

      document.getElementById('bd-add').addEventListener('click', () => addRow('', ''));
      document.getElementById('bd-calc').addEventListener('click', calc);
      document.getElementById('bd-type').addEventListener('change', calc);
      calc();
    },
  });

  function addRow(d, n) {
    const rows = document.getElementById('bd-rows');
    const div = document.createElement('div');
    div.className = 'bd-row';
    div.dataset.row = rowSeq++;
    div.innerHTML = `
      <input type="number" class="bd-d" value="${d === '' ? '' : E.fmtExact(d)}" step="any" min="0" placeholder="外径 d (mm)">
      <input type="number" class="bd-n" value="${n === '' ? '' : n}" step="1" min="1" placeholder="数量 n">
      <button class="row-del" type="button" title="删除该规格">✕</button>
    `;
    div.querySelector('.row-del').addEventListener('click', () => {
      if (rows.children.length > 1) { div.remove(); calc(); }
      else { div.querySelector('.bd-d').value = ''; div.querySelector('.bd-n').value = ''; }
    });
    rows.appendChild(div);
  }

  function calc() {
    const rows = document.querySelectorAll('#bd-rows .bd-row');
    const box = document.getElementById('bd-result');
    const type = document.getElementById('bd-type').value;

    const specs = [];
    let totalN = 0;
    let sumND2 = 0;

    rows.forEach((row) => {
      const d = E.parseNum(row.querySelector('.bd-d').value);
      const n = E.parseNum(row.querySelector('.bd-n').value);
      if (d == null || n == null || d <= 0 || n < 1) return;
      specs.push({ d, n });
      totalN += n;
      sumND2 += n * d * d;
    });

    if (!specs.length) {
      box.innerHTML = `<div class="status-banner warn">请至少输入一种线规的外径与数量。</div>`;
      box.style.display = 'block';
      return;
    }

    // 面积等效外径
    const D = Math.sqrt(sumND2);
    const Kbase = baseK(D);
    const Kadd = TYPE_ADD[type];
    const K = Kbase + Kadd;
    const R = K * D;

    // 单根参考：按面积加权平均线径的单独折弯半径（便于对照）
    const dAvg = D / Math.sqrt(totalN); // 等价于把总根数均匀分摊的平均单根外径
    const R_single = (baseK(dAvg) + Kadd) * dAvg;

    // 明细表
    const table = `
      <table class="param-table">
        <tr><th>外径 d (mm)</th><th>数量 n (根)</th><th>占比面积 n·d² (mm²)</th></tr>
        ${specs.map((s) => `<tr><td>${E.fmtExact(s.d)}</td><td>${s.n}</td><td>${E.fmtExact(s.n * s.d * s.d)}</td></tr>`).join('')}
        <tr style="font-weight:600;background:#f8fafc">
          <td>合计</td><td>${totalN}</td><td>${E.fmtExact(sumND2)}</td>
        </tr>
      </table>`;

    let statusClass = 'ok';
    let statusText = `推荐最小折弯半径 <b>${E.fmt(R)} mm</b>（约 ${E.fmt(R / D)} 倍线束等效外径）。`;
    if (type === 'dynamic') {
      statusText += ' 动态拖链应用对弯曲寿命要求高，建议在此基础上再留 20~30% 余量或选用专用柔性线。';
    }

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>计算结果</h3>
      ${table}
      <div class="result-grid" style="margin-top:16px">
        <div class="result-card"><div class="k">总导线数</div>
          <div class="v">${totalN}<small> 根</small></div></div>
        <div class="result-card"><div class="k">线束等效外径 D=√Σn·d²</div>
          <div class="v">${E.fmt(D)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">弯曲系数 K</div>
          <div class="v">${K}<small>（基准 ${Kbase} + ${TYPE_LABEL[type]} ${Kadd}）</small></div></div>
        <div class="result-card"><div class="k">线束最小折弯半径 R</div>
          <div class="v">${E.fmt(R)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">折弯半径 / 外径 比</div>
          <div class="v">${E.fmt(R / D)}<small> ×</small></div></div>
        <div class="result-card"><div class="k">平均单根参考折弯半径</div>
          <div class="v">${E.fmt(R_single)}<small> mm</small></div></div>
      </div>
      <div class="status-banner ${statusClass}">${statusText}</div>
      <div class="note">
        <strong>说明：</strong>
        <ul>
          <li>R = K × D = ${K} × ${E.fmt(D)} mm = <b>${E.fmt(R)} mm</b>；D = √(${E.fmtExact(sumND2)}) mm（面积等效），${TYPE_LABEL[type]} 附加 K${Kadd}；</li>
          <li>本页为<b>工程经验初版算法</b>。正式设计请参照具体线束/线缆标准（如 SAE J2899、IEC 60228、主机厂线束规范）或线缆厂家额定最小折弯半径；</li>
          <li>若线束含屏蔽层、铠装或非圆形排列，等效外径与系数需相应调整，并避免在固定点处集中折弯。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
