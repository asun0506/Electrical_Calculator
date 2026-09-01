/** 动力电池、换电、电气架构及连接器标准索引。 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const DATA = window.ELECTRICAL_STANDARD_LIBRARY;
  let hostRef;
  let state = { query:'', topic:'全部', system:'全部', history:false, view:'cards' };

  function esc(value) { return E.escapeHtml(value == null ? '' : String(value)); }
  function unique(key) { return [...new Set(DATA.records.map((item) => item[key]))]; }
  function searchable(item) { return [item.no,item.system,item.topic,item.level,item.title,item.summary,...item.focus].join(' ').toLowerCase(); }
  function results() {
    const q = state.query.trim().toLowerCase();
    return DATA.records.filter((item) => (state.history || item.status !== '已废止')
      && (state.topic === '全部' || item.topic === state.topic)
      && (state.system === '全部' || item.system === state.system)
      && (!q || searchable(item).includes(q)));
  }
  function options(items, selected) { return items.map((item) => `<option${item === selected ? ' selected' : ''}>${esc(item)}</option>`).join(''); }
  function sourceName(system) {
    return system === 'GB' ? '国家标准全文公开系统'
      : system === 'ISO' ? 'ISO官网'
        : system === 'IEC' ? 'IEC Webstore'
          : system === 'LV' ? 'LV/OEM版本索引'
            : system === 'USCAR' ? 'USCAR EWCAP官网'
              : 'UNECE官网';
  }
  function card(item) {
    return `<article class="sl-card" data-no="${esc(item.no)}"><div class="sl-card-top"><div><span class="sl-system sl-${item.system.toLowerCase()}">${esc(item.system)}</span><span class="sl-topic">${esc(item.topic)}</span></div><span class="sl-status${item.status === '已废止' ? ' old' : ''}">${esc(item.status)}</span></div>
      <h3>${esc(item.no)}</h3><h4>${esc(item.title)}</h4><p class="sl-level">适用层级：${esc(item.level)}</p><p class="sl-summary">${esc(item.summary)}</p>
      <div class="sl-tags">${item.focus.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
      <div class="sl-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(item.no)}">复制标准号</button><a class="btn btn-ghost btn-sm" href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">${sourceName(item.system)} ↗</a></div></article>`;
  }
  function row(item) {
    return `<tr><td><span class="sl-system sl-${item.system.toLowerCase()}">${esc(item.system)}</span></td><td><b>${esc(item.no)}</b><small>${esc(item.status)}</small></td><td>${esc(item.topic)}</td><td><b>${esc(item.title)}</b><small>${esc(item.level)}</small></td><td>${esc(item.summary)}</td><td><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">官网检索 ↗</a></td></tr>`;
  }
  function renderResults() {
    const list = results();
    const count = hostRef.querySelector('#slCount');
    count.textContent = `显示 ${list.length} / ${DATA.records.length} 项`;
    const box = hostRef.querySelector('#slResults');
    if (!list.length) { box.innerHTML = '<div class="empty-tip">没有匹配的标准，请减少筛选条件或尝试标准号关键词。</div>'; return; }
    box.innerHTML = state.view === 'table'
      ? `<div class="sl-table-wrap"><table class="param-table sl-table"><thead><tr><th>体系</th><th>标准号</th><th>主题</th><th>名称 / 层级</th><th>工程摘要</th><th>来源</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`
      : `<div class="sl-grid">${list.map(card).join('')}</div>`;
  }
  function render(host) {
    hostRef = host;
    host.innerHTML = `<style>${styles()}</style>
      <section class="panel sl-intro"><div><span class="sl-eyebrow">STANDARD NAVIGATOR · OFFLINE INDEX</span><h3>动力电池与车辆电气标准库</h3><p>收录标准题录、适用层级和工程摘要，不复制标准正文。标准状态复核至 <b>${esc(DATA.verifiedAt)}</b>；立项、定版或认证前请在发布机构官网再次核验。</p></div><div class="sl-stat"><strong>${DATA.records.filter((item) => item.status !== '已废止').length}</strong><span>项现行/已发布标准</span></div></section>
      <section class="panel sl-guide"><h3>如何使用这份索引</h3><div><p><b>电芯/电池包选型：</b>先看性能与安全，再叠加运输、整车和目标市场法规。</p><p><b>换电设计：</b>同时检查车辆、电池箱、连接器、锁止机构、换电站和通信边界。</p><p><b>高压架构：</b>把电安全、绝缘配合、功能安全、EMC和环境可靠性分开建需求矩阵。</p><p><b>连接器选型：</b>区分车载/充电、HV/LV、配合/非配合状态，并确认温升、IP、寿命和互锁条件。</p><p><b>德国LV体系：</b>LV 214/215是联合供货规范基础，正式定版必须取得目标OEM当前企业版、试验矩阵及偏差清单。</p><p><b>北美USCAR体系：</b>USCAR-2是通用验证基础，再按压接、高压、RF/同轴、USB或焊接工艺叠加专项规范及最新修订信。</p></div></section>
      <section class="panel sl-filter"><div class="sl-search"><label for="slQuery">搜索标准号、名称、摘要或关键词</label><input id="slQuery" value="${esc(state.query)}" placeholder="例如：38031、换电、热扩散、连接器、ISO 6469"></div>
        <label>主题<select id="slTopic">${options(['全部',...unique('topic')], state.topic)}</select></label>
        <label>体系<select id="slSystem">${options(['全部',...unique('system')], state.system)}</select></label>
        <label class="sl-check"><input type="checkbox" id="slHistory"${state.history ? ' checked' : ''}> 显示历史/废止版本</label>
        <div class="sl-view" role="group" aria-label="显示方式"><button type="button" class="btn btn-sm${state.view === 'cards' ? ' active' : ''}" data-view="cards">卡片</button><button type="button" class="btn btn-sm${state.view === 'table' ? ' active' : ''}" data-view="table">表格</button></div>
      </section>
      <div class="sl-result-head"><strong id="slCount"></strong><button type="button" class="btn btn-ghost btn-sm" id="slClear">清除筛选</button></div><section id="slResults"></section>
      <section class="panel sl-disclaimer"><h3>使用边界</h3><ul><li>摘要用于快速定位，不构成标准解释、认证意见或合规结论。</li><li>“现行”只表示本库复核时发布机构显示的状态；标准、修订案、法规实施日期可能继续变化。</li><li>GB为国家标准；ISO/IEC为国际标准；UNECE R和GTR属于车辆法规/全球技术法规体系；LV和USCAR属于汽车产业/OEM联合规范，并非欧洲法规或美国联邦法规。</li><li>LV规范往往由各OEM转化为企业标准，USCAR规范也存在受控规格、修订信和接口图纸；合同/SOR指定版本优先。</li><li>若产品标准对电气间隙、IP、EMC等已有专门规定，通常优先执行产品标准及合同要求。</li></ul></section>`;
    host.querySelector('#slQuery').addEventListener('input', (e) => { state.query = e.target.value; renderResults(); });
    host.querySelector('#slTopic').addEventListener('change', (e) => { state.topic = e.target.value; renderResults(); });
    host.querySelector('#slSystem').addEventListener('change', (e) => { state.system = e.target.value; renderResults(); });
    host.querySelector('#slHistory').addEventListener('change', (e) => { state.history = e.target.checked; renderResults(); });
    host.querySelector('#slClear').addEventListener('click', () => { state = { query:'', topic:'全部', system:'全部', history:false, view:state.view }; render(host); });
    if (!host.dataset.slBound) {
      host.dataset.slBound = '1';
      host.addEventListener('click', async (event) => {
        const view = event.target.closest('[data-view]');
        if (view) { state.view = view.dataset.view; render(host); return; }
        const copy = event.target.closest('[data-copy]');
        if (!copy) return;
        try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = '已复制'; setTimeout(() => { if (copy.isConnected) copy.textContent = '复制标准号'; }, 1200); }
        catch (error) { window.prompt('复制标准号：', copy.dataset.copy); }
      });
    }
    renderResults();
  }
  function styles() { return `
    .sl-intro{display:flex;justify-content:space-between;gap:24px;align-items:center;background:linear-gradient(135deg,#fff 55%,#eef6ff)}.sl-intro h3{font-size:25px;margin:4px 0}.sl-intro p{margin:0;max-width:850px;color:var(--text-muted)}.sl-eyebrow{font-size:11px;letter-spacing:.14em;color:#9a6400;font-weight:800}.sl-stat{min-width:170px;text-align:center;border-left:1px solid var(--border)}.sl-stat strong{display:block;font-size:36px;color:#173b5e;line-height:1}.sl-stat span{font-size:12px;color:var(--text-muted)}
    .sl-guide{margin-top:14px}.sl-guide h3{margin:0 0 8px}.sl-guide>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 24px}.sl-guide p{margin:0;font-size:13px;color:#475569}
    .sl-filter{position:sticky;top:8px;z-index:3;margin-top:14px;display:grid;grid-template-columns:minmax(280px,2fr) 180px 150px auto auto;gap:12px;align-items:end;box-shadow:0 5px 18px rgba(15,23,42,.08)}.sl-filter label,.sl-search{display:grid;gap:5px;font-size:12px;font-weight:700}.sl-check{display:flex!important;align-items:center;padding-bottom:10px;white-space:nowrap}.sl-check input{width:auto}.sl-view{display:flex;gap:5px;padding-bottom:2px}.sl-view .active{background:#173b5e;color:#fff;border-color:#173b5e}
    .sl-result-head{display:flex;justify-content:space-between;align-items:center;margin:14px 2px 8px;color:#475569}.sl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sl-card{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:16px;box-shadow:var(--shadow);display:flex;flex-direction:column}.sl-card-top{display:flex;justify-content:space-between}.sl-system,.sl-topic,.sl-status{display:inline-block;font-size:10px;font-weight:800;border-radius:999px;padding:2px 7px;margin-right:5px}.sl-system{color:#fff;background:#173b5e}.sl-iso{background:#0f766e}.sl-iec{background:#7c3aed}.sl-unece{background:#9a6400}.sl-lv{background:#475569}.sl-uscar{background:#b91c1c}.sl-topic{background:#e8eef5;color:#274159}.sl-status{color:#08775a;background:#ecfdf5}.sl-status.old{color:#9f281f;background:#fff0ee}.sl-card h3{font-family:var(--mono);font-size:18px;margin:12px 0 2px;color:#173b5e}.sl-card h4{font-size:15px;margin:0 0 6px}.sl-level{font-size:11px;color:#64748b;margin:0 0 8px}.sl-summary{font-size:13px;color:#334155;margin:0 0 10px;flex:1}.sl-tags{display:flex;flex-wrap:wrap;gap:5px}.sl-tags span{font-size:10px;border:1px solid #cbd5e1;padding:2px 6px;background:#f8fafc}.sl-card-actions{display:flex;gap:7px;margin-top:13px;flex-wrap:wrap}.sl-card-actions a{text-decoration:none}
    .sl-table-wrap{overflow:auto;background:#fff;border:1px solid #cbd5e1}.sl-table{min-width:1150px;margin:0}.sl-table th:nth-child(1){width:70px}.sl-table th:nth-child(2){width:165px}.sl-table th:nth-child(3){width:100px}.sl-table th:nth-child(4){width:230px}.sl-table th:nth-child(6){width:100px}.sl-table td{vertical-align:top;font-size:12px}.sl-table small{display:block;color:#64748b}.sl-table a{color:#1d4ed8;text-decoration:none}.sl-disclaimer{margin-top:16px;border-left:4px solid #b7791f;background:#fffbeb}.sl-disclaimer h3{margin:0}.sl-disclaimer ul{margin:7px 0 0;padding-left:21px;font-size:12px;color:#574112}
    @media(max-width:1050px){.sl-filter{position:static;grid-template-columns:1fr 1fr}.sl-search{grid-column:1/-1}.sl-grid{grid-template-columns:1fr}}@media(max-width:650px){.sl-intro{align-items:flex-start;flex-direction:column}.sl-stat{border-left:0;text-align:left}.sl-guide>div,.sl-filter{grid-template-columns:1fr}.sl-check{padding:0}}
  `; }

  T.register({ id:'standards-library', title:'动力电池与电气标准库', icon:'📚', group:'工程知识库',
    desc:'检索动力电池、换电、电气架构及高低压连接器相关GB、ISO、IEC、UNECE、LV和USCAR规范题录与工程摘要。',
    captureDraft: () => ({ ...state }), restoreDraft(saved) { state = { ...state, ...saved }; render(hostRef); },
    resetDraft() { state = { query:'', topic:'全部', system:'全部', history:false, view:'cards' }; render(hostRef); },
    render(host) { render(host); },
  });
})();
