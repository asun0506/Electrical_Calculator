/**
 * 计算器 5：尺寸链公差分析（极值法 + 统计法）
 *
 * 输入尺寸链各环节：名义尺寸、公差、方向（增环 / 减环）。
 * 闭环名义尺寸 = Σ增环 − Σ减环。
 *
 * 极值法（最坏情况 / 算术叠加）：
 *   累积公差 T_wc = Σ |公差|
 *   最大值 = 名义 + T_wc，最小值 = 名义 − T_wc
 *
 * 统计法（RSS 均方根，假设各环独立正态且 ±3σ = 公差）：
 *   累积公差 T_rss = √(Σ 公差²)
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  let rowSeq = 0;

  // 误差函数 erf（Abramowitz & Stegun 7.1.26 近似），供标准正态 CDF 使用
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  // 标准正态分布 CDF Φ(z)
  function normCdf(z) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
  }

  T.register({
    id: 'tolerance',
    title: '公差分析',
    icon: '📏',
    group: '机械尺寸',
    desc: '输入尺寸链各环节的名义尺寸、公差与增/减环方向，进行极值法（最坏情况）与 RSS 统计法公差累积分析。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>尺寸链环节</h3>
          <div class="chain-row" style="grid-template-columns:1fr 1fr 1fr 1fr auto">
            <div class="col-label">名称</div>
            <div class="col-label">名义尺寸 (mm)</div>
            <div class="col-label">公差 ± (mm)</div>
            <div class="col-label">方向</div>
            <div></div>
          </div>
          <div id="tc-rows"></div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="tc-add">+ 添加环节</button>
            <button class="btn btn-primary" id="tc-calc">开始公差分析</button>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>闭环设计公差（匹配与超差校核）</h3>
          <div class="grid cols-2">
            <div class="field">
              <label>闭环设计公差 <span class="hint">T 设计，设计允许的闭环公差 ±</span></label>
              <div class="input-row">
                <input id="tc-tol-design" type="number" value="0.18" min="0" step="any">
                <span class="unit">mm</span>
              </div>
            </div>
          </div>
          <div class="note">
            输入设计允许的闭环公差，程序将其与<b>计算累积公差</b>（极值法 T 极值 / RSS 统计法 T 统计）匹配，
            并按 RSS 正态分布（σ = T 统计 / 3）计算<b>超差概率</b>，同时绘制公差带分布图。
          </div>
        </div>

        <div class="panel" id="tc-result" style="display:none"></div>
      `;

      // 预置一个示例尺寸链
      addRow('A', 100, 0.1, '+');
      addRow('B', 20, 0.05, '-');
      addRow('C', 15, 0.02, '-');

      document.getElementById('tc-add').addEventListener('click', () => addRow('', '', '', '+'));
      document.getElementById('tc-calc').addEventListener('click', calc);
      document.getElementById('tc-tol-design').addEventListener('input', calc);
      calc();
    },
  });

  function addRow(name, nom, tol, dir) {
    const rows = document.getElementById('tc-rows');
    const div = document.createElement('div');
    div.className = 'chain-row';
    div.dataset.row = rowSeq++;
    div.innerHTML = `
      <input type="text" class="tc-name" value="${ElUtil.escapeHtml(name)}" placeholder="环节名称">
      <input type="number" class="tc-nom" value="${nom}" step="any" placeholder="名义">
      <input type="number" class="tc-tol" value="${tol}" min="0" step="any" placeholder="公差">
      <select class="tc-dir">
        <option value="+" ${dir === '+' ? 'selected' : ''}>增环（正）</option>
        <option value="-" ${dir === '-' ? 'selected' : ''}>减环（负）</option>
      </select>
      <button class="row-del" title="删除该环节">✕</button>
    `;
    div.querySelector('.row-del').addEventListener('click', () => {
      if (rows.children.length <= 1) {
        // 至少保留一行
        div.querySelector('.tc-nom').value = '';
        div.querySelector('.tc-tol').value = '';
        return;
      }
      div.remove();
      calc();
    });
    rows.appendChild(div);
  }

  function calc() {
    const E = window.ElUtil;
    const rows = document.querySelectorAll('#tc-rows .chain-row');
    const box = document.getElementById('tc-result');

    let nomSum = 0;
    let tolSum = 0;
    let tolRss = 0;
    let validCount = 0;
    const entries = [];

    rows.forEach((row) => {
      const name = row.querySelector('.tc-name').value.trim();
      const nom = E.parseNum(row.querySelector('.tc-nom').value);
      const tol = E.parseNum(row.querySelector('.tc-tol').value);
      const dir = row.querySelector('.tc-dir').value === '+' ? 1 : -1;

      if (nom == null || tol == null) return; // 跳过空行
      if (!Number.isFinite(nom) || !Number.isFinite(tol) || tol < 0) return;

      validCount++;
      nomSum += dir * nom;
      tolSum += tol;
      tolRss += tol * tol;
      entries.push({ name, nom, tol, dir });
    });

    if (validCount === 0) {
      box.innerHTML = `<div class="status-banner warn">请至少填写一个完整的尺寸环节（名称、名义尺寸、公差）。</div>`;
      box.style.display = 'block';
      return;
    }

    const tolRssRoot = Math.sqrt(tolRss);
    const nomTxt = E.fmtExact(nomSum);

    // 闭环设计公差匹配 + 超差概率（RSS 正态分布，σ = T统计/3）
    const tolDesign = E.parseNum(document.getElementById('tc-tol-design').value);
    const sigmaRss = tolRssRoot / 3;
    let Pout = null, zVal = null, tolStatus = '', tolClass = '', tolHtml = '';
    if (tolDesign != null && tolDesign > 0) {
      zVal = tolDesign / sigmaRss;
      Pout = 2 * (1 - normCdf(zVal));
      if (tolDesign >= tolSum) {
        tolClass = 'ok';
        tolStatus = `设计公差 ±${E.fmtExact(tolDesign)} mm ≥ 极值累积公差 ±${E.fmtExact(tolSum)} mm，同时满足极值法与 RSS，超差概率极低（${E.fmt(Pout * 100)}%）。`;
      } else if (tolDesign >= tolRssRoot) {
        tolClass = 'warn';
        tolStatus = `设计公差 ±${E.fmtExact(tolDesign)} mm 介于 RSS（±${E.fmtExact(tolRssRoot)}）与极值（±${E.fmtExact(tolSum)}）之间：统计上满足，超差概率 ${E.fmt(Pout * 100)}%，但不能保证 100% 互换。`;
      } else {
        tolClass = 'err';
        tolStatus = `设计公差 ±${E.fmtExact(tolDesign)} mm 小于 RSS 累积公差 ±${E.fmtExact(tolRssRoot)} mm，超差概率 ${E.fmt(Pout * 100)}%，需放宽设计公差或收紧环节公差。`;
      }
      tolHtml = `
        <div class="result-grid" style="margin-top:16px">
          <div class="result-card"><div class="k">闭环设计公差</div>
            <div class="v">±${E.fmtExact(tolDesign)}<small> mm</small></div></div>
          <div class="result-card"><div class="k">闭环 σ = T统计/3</div>
            <div class="v">${E.fmt(sigmaRss)}<small> mm</small></div></div>
          <div class="result-card"><div class="k">z = T设计/σ</div>
            <div class="v">${E.fmtExact(zVal)}<small> σ</small></div></div>
          <div class="result-card"><div class="k">超差概率 P(|x−μ|>T设计)</div>
            <div class="v">${E.fmt(Pout * 100)}<small> %</small></div></div>
        </div>
        <div class="status-banner ${tolClass}">${tolStatus}</div>
        <div class="normal-chart-wrap">${T.normalChart({
          title: `闭环公差带分布（设计公差 ±${E.fmtExact(tolDesign)} mm）`,
          mean: nomSum,
          sigma: sigmaRss,
          tol: tolDesign,
          width: 720,
          height: 320,
          note: `σ = T统计/3 = ${E.fmt(sigmaRss)} mm，设计公差 ±${E.fmtExact(tolDesign)} mm。绿色带为合格区，红色带为超差区；超差概率 ${E.fmt(Pout * 100)}%。`,
        })}</div>
      `;
    }

    // 生成明细表
    let table = '';
    if (entries.length) {
      table = `
        <table class="param-table">
          <tr><th>名称</th><th>名义 (mm)</th><th>公差 ± (mm)</th><th>方向</th></tr>
          ${entries.map((e) => `
            <tr>
              <td>${E.escapeHtml(e.name || '环节')}</td>
              <td>${E.fmtExact(e.nom)}</td>
              <td>±${E.fmtExact(e.tol)}</td>
              <td>${e.dir > 0 ? '增环' : '减环'}</td>
            </tr>`).join('')}
          <tr style="font-weight:600;background:#f8fafc">
            <td>Σ 合计</td><td>${nomTxt}</td>
            <td>±${E.fmtExact(tolSum)}（极值）/ ±${E.fmtExact(tolRssRoot)}（RSS）</td>
            <td>—</td>
          </tr>
        </table>`;
    }

    box.innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>公差分析结果</h3>
      ${table}
      <div class="result-grid" style="margin-top:16px">
        <div class="result-card"><div class="k">闭环名义尺寸</div>
          <div class="v">${nomTxt}<small> mm</small></div></div>
        <div class="result-card"><div class="k">极值法累积公差（最坏情况）</div>
          <div class="v">±${E.fmtExact(tolSum)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">RSS 统计累积公差</div>
          <div class="v">±${E.fmtExact(tolRssRoot)}<small> mm</small></div></div>
      </div>
      <div class="status-banner ok">
        <b>极值法（最坏情况）：</b>${nomTxt} ± ${E.fmtExact(tolSum)} mm
        （范围 ${E.fmtExact(nomSum - tolSum)} ~ ${E.fmtExact(nomSum + tolSum)} mm），保证 100% 合格，但公差较保守。
      </div>
      <div class="status-banner info">
        <b>RSS 统计法：</b>${nomTxt} ± ${E.fmtExact(tolRssRoot)} mm
        （范围 ${E.fmtExact(nomSum - tolRssRoot)} ~ ${E.fmtExact(nomSum + tolRssRoot)} mm），假设各环独立且正态分布，装配不良率约 0.27%（±3σ），更经济。
      </div>
      ${tolHtml}
      <div class="note">
        <strong>选用建议：</strong>
        <ul>
          <li><b>极值法</b>适合环节数少、要求 100% 互换、或各环波动可能同向叠加的场合；</li>
          <li><b>RSS 法</b>适合环节较多、各环独立随机的场合，可放宽公差降低成本，但需以统计过程能力（Cp/Cpk）为前提；</li>
          <li>环节越多，RSS 相对极值法的累积公差越小，效果越明显（本链 ${entries.length} 环：极值 ±${E.fmtExact(tolSum)} → RSS ±${E.fmtExact(tolRssRoot)}）。</li>
        </ul>
      </div>
    `;
    box.style.display = 'block';
  }
})();
