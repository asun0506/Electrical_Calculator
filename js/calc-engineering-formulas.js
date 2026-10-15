/**
 * 常见工程计算公式查询
 * 纯离线静态资料：数学、力学、电学、热学四个子页面。
 */
(function () {
  'use strict';

  const T = window.ElectricalToolkit;
  let activePage = 'math';

  const typesetEquation=source=>window.ElectricalMath.render(source);

  function sourceNote(label, url) {
    return `<p class="ef-source">参考教材并重绘：<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></p>`;
  }

  function formulaCard(title, equations, symbols, note = '', visual = '') {
    return `<article class="ef-card" data-search="${title} ${equations.join(' ')} ${symbols.join(' ')} ${note}"><h4>${title}</h4><div class="ef-equations">${equations.map((item) => `<div>${typesetEquation(item)}</div>`).join('')}</div><ul class="ef-symbols">${symbols.map((item) => `<li>${item}</li>`).join('')}</ul>${note ? `<p class="ef-note">${note}</p>` : ''}${visual}</article>`;
  }

  function section(title, description, cards, extra = '') {
    return `<section class="ef-section"><header><h3>${title}</h3>${description ? `<p>${description}</p>` : ''}</header><div class="ef-grid">${cards.join('')}</div>${extra}</section>`;
  }

  function calculusDiagram() {
    return `<div class="ef-diagram"><h4>定积分与黎曼和示意</h4><svg viewBox="0 0 760 300" role="img" aria-label="用矩形面积逼近曲线下的定积分"><defs><marker id="efCalcArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs><line x1="65" y1="245" x2="720" y2="245" stroke="#475569" marker-end="url(#efCalcArrow)"/><line x1="65" y1="245" x2="65" y2="30" stroke="#475569" marker-end="url(#efCalcArrow)"/><path d="M80 220 C150 205 210 160 270 175 C340 195 390 80 470 95 C555 110 585 55 690 45" fill="none" stroke="#2563eb" stroke-width="4"/><g fill="#93c5fd" fill-opacity=".48" stroke="#2563eb"><rect x="135" y="199" width="55" height="46"/><rect x="190" y="173" width="55" height="72"/><rect x="245" y="169" width="55" height="76"/><rect x="300" y="176" width="55" height="69"/><rect x="355" y="133" width="55" height="112"/><rect x="410" y="92" width="55" height="153"/><rect x="465" y="95" width="55" height="150"/><rect x="520" y="107" width="55" height="138"/><rect x="575" y="78" width="55" height="167"/></g><text x="360" y="285">x</text><text x="25" y="42">f(x)</text><text x="128" y="264">a</text><text x="628" y="264">b</text><line x1="135" y1="255" x2="190" y2="255" stroke="#b45309"/><text x="143" y="280">Δx</text><text x="470" y="65">y=f(x)</text><text x="275" y="225">Σ f(xᵢ*)Δx → ∫ f(x)dx</text></svg>${sourceNote('OpenStax Calculus Volume 2 · 定积分', 'https://openstax.org/books/calculus-volume-2/pages/1-2-the-definite-integral')}</div>`;
  }

  function beamDiagram() {
    return `<div class="ef-diagram"><h4>简支梁中点载荷、弯矩与挠度符号</h4><svg viewBox="0 0 760 300" role="img" aria-label="简支梁中点集中载荷示意"><defs><marker id="efBeamArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs><line x1="100" y1="110" x2="660" y2="110" stroke="#173b5e" stroke-width="12"/><path d="M100 120 l-22 35 h44 z M660 120 l-22 35 h44 z" fill="#cbd5e1" stroke="#475569"/><line x1="380" y1="30" x2="380" y2="90" stroke="#dc2626" stroke-width="3" marker-end="url(#efBeamArrow)"/><text x="394" y="55">P</text><path d="M100 112 Q380 245 660 112" fill="none" stroke="#2563eb" stroke-width="4" stroke-dasharray="8 5"/><line x1="100" y1="180" x2="660" y2="180" stroke="#94a3b8"/><line x1="100" y1="173" x2="100" y2="188" stroke="#475569"/><line x1="660" y1="173" x2="660" y2="188" stroke="#475569"/><text x="370" y="205">L</text><line x1="380" y1="110" x2="380" y2="225" stroke="#b45309" stroke-dasharray="5 4"/><text x="393" y="238">δmax</text><path d="M105 270 Q380 210 655 270" fill="none" stroke="#7c3aed" stroke-width="3"/><text x="105" y="292">M(x)</text><text x="530" y="260">中点 Mmax=PL/4</text></svg><p>图中 P 为集中力，L 为跨度，M(x) 为截面弯矩，δ<sub>max</sub> 为最大挠度。对等截面 Euler–Bernoulli 梁，中点载荷时 δ<sub>max</sub>=PL³/(48EI)。</p>${sourceNote('MIT OpenCourseWare · Beam Bending', 'https://ocw.mit.edu/courses/2-001-mechanics-materials-i-fall-2006/resources/lec18/')}</div>`;
  }

  function rcDiagram() {
    return `<div class="ef-diagram"><h4>RC 充电回路与时间常数</h4><svg viewBox="0 0 760 310" role="img" aria-label="RC充电回路和电容电压指数曲线"><defs><marker id="efRcArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs><g fill="none" stroke="#173b5e" stroke-width="3"><line x1="60" y1="72" x2="130" y2="72"/><path d="M130 72 l12 -18 l24 36 l24 -36 l24 36 l24 -18"/><line x1="238" y1="72" x2="310" y2="72"/><line x1="310" y1="48" x2="310" y2="96"/><line x1="330" y1="48" x2="330" y2="96"/><path d="M330 72 H375 V210 H60 V72"/><line x1="83" y1="135" x2="83" y2="185"/><line x1="100" y1="146" x2="100" y2="174"/></g><line x1="110" y1="44" x2="205" y2="44" stroke="#dc2626" stroke-width="2" marker-end="url(#efRcArrow)"/><text x="145" y="33">i(t)</text><text x="175" y="114">R</text><text x="300" y="120">C</text><text x="45" y="165">U</text><text x="335" y="60">uC(t)</text><g transform="translate(420,25)"><line x1="0" y1="230" x2="300" y2="230" stroke="#475569"/><line x1="0" y1="230" x2="0" y2="10" stroke="#475569"/><line x1="0" y1="60" x2="290" y2="60" stroke="#94a3b8" stroke-dasharray="5 4"/><path d="M0 230 C45 125 90 82 145 67 C205 53 250 60 290 60" fill="none" stroke="#2563eb" stroke-width="4"/><line x1="72" y1="230" x2="72" y2="122" stroke="#b45309" stroke-dasharray="5 4"/><text x="65" y="251">τ</text><text x="8" y="52">U∞</text><text x="80" y="118">63.2%</text><text x="250" y="88">uC(t)</text><text x="286" y="251">t</text></g></svg><p>零初值充电时，u<sub>C</sub>(t)=U(1-e<sup>-t/RC</sup>)；当 t=τ=RC 时，u<sub>C</sub>约为稳态值的 63.2%。</p>${sourceNote('OpenStax University Physics Volume 2 · RC Circuits', 'https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits')}</div>`;
  }

  function thermalResistanceDiagram() {
    return `<div class="ef-diagram"><h4>平壁导热与对流热阻网络</h4><svg viewBox="0 0 760 300" role="img" aria-label="含两侧对流的平壁导热热阻网络"><defs><marker id="efHeatArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs><rect x="260" y="35" width="170" height="180" fill="#dbeafe" stroke="#2563eb" stroke-width="3"/><line x1="150" y1="125" x2="250" y2="125" stroke="#dc2626" stroke-width="4" marker-end="url(#efHeatArrow)"/><line x1="440" y1="125" x2="550" y2="125" stroke="#dc2626" stroke-width="4" marker-end="url(#efHeatArrow)"/><text x="175" y="108">Q̇</text><text x="485" y="108">Q̇</text><text x="292" y="95">k, L, A</text><text x="80" y="70">T∞,1</text><text x="145" y="155">h1</text><text x="450" y="155">h2</text><text x="580" y="70">T∞,2</text><text x="258" y="235">Ts,1</text><text x="400" y="235">Ts,2</text><line x1="80" y1="270" x2="675" y2="270" stroke="#475569"/><circle cx="100" cy="270" r="7" fill="#173b5e"/><circle cx="250" cy="270" r="7" fill="#173b5e"/><circle cx="440" cy="270" r="7" fill="#173b5e"/><circle cx="650" cy="270" r="7" fill="#173b5e"/><path d="M107 270 l10 -13 l20 26 l20 -26 l20 26 l20 -26 l20 13" fill="none" stroke="#b45309" stroke-width="2"/><path d="M257 270 l13 -13 l25 26 l25 -26 l25 26 l25 -26 l25 26 l25 -13" fill="none" stroke="#b45309" stroke-width="2"/><path d="M447 270 l16 -13 l32 26 l32 -26 l32 26 l32 -26 l32 13" fill="none" stroke="#b45309" stroke-width="2"/><text x="125" y="248">1/(h1A)</text><text x="310" y="248">L/(kA)</text><text x="510" y="248">1/(h2A)</text></svg><p>稳态一维传热时，Q̇=(T<sub>∞,1</sub>-T<sub>∞,2</sub>)/[1/(h<sub>1</sub>A)+L/(kA)+1/(h<sub>2</sub>A)]。图中热流方向与温度降方向一致。</p>${sourceNote('MIT OpenCourseWare · Introduction to Heat Transfer 公式表', 'https://ocw.mit.edu/courses/2-051-introduction-to-heat-transfer-fall-2015/resources/mit2_051f15_eqnsheet_q2_v3/')}</div>`;
  }

  function mathPage() {
    const calculus = [
      formulaCard('导数基本规则', [
        String.raw`(c)'=0,\qquad (x^n)'=nx^{n-1}`,
        String.raw`(u\pm v)'=u'\pm v',\qquad (uv)'=u'v+uv'`,
        String.raw`\left(\frac uv\right)'=\frac{u'v-uv'}{v^2}`,
        String.raw`\frac{dy}{dx}=\frac{dy}{du}\frac{du}{dx}`
      ], ['c：常数；n：实数指数。', 'u、v：x 的可导函数；x、u、v 的单位按具体问题确定。', '导数单位=因变量单位/自变量单位。']),
      formulaCard('常见函数导数', [
        String.raw`(e^x)'=e^x,\qquad(a^x)'=a^x\ln a`,
        String.raw`(\ln x)'=\frac1x,\qquad(\log_a x)'=\frac1{x\ln a}`,
        String.raw`(\sin x)'=\cos x,\quad(\cos x)'=-\sin x`,
        String.raw`(\tan x)'=\sec^2 x`,
        String.raw`(\arcsin x)'=\frac1{\sqrt{1-x^2}},\quad(\arctan x)'=\frac1{1+x^2}`
      ], ['x：函数自变量，单位由实际问题决定；作为指数、对数或三角函数自变量时应无量纲。', 'a：指数或对数函数的底数，正常数且 a≠1，无量纲。', '三角函数中 x：角度/rad（弧度）。']),
      formulaCard('常见不定积分', [
        String.raw`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C,\quad n\ne-1`,
        String.raw`\int\frac{dx}{x}=\ln|x|+C,\qquad\int e^x\,dx=e^x+C`,
        String.raw`\int\sin x\,dx=-\cos x+C`,
        String.raw`\int\cos x\,dx=\sin x+C`,
        String.raw`\int\frac{dx}{1+x^2}=\arctan x+C`,
        String.raw`\int\frac{dx}{\sqrt{1-x^2}}=\arcsin x+C`
      ], ['x：积分变量，单位由实际问题决定；出现于对数或三角函数时应无量纲。', 'n：幂指数，无量纲；C：不定积分常数，单位与积分结果相同。', '积分结果单位=被积函数单位×积分变量单位。']),
      formulaCard('定积分与微积分基本定理', [
        String.raw`F(x)=\int_a^x f(t)\,dt\quad\Rightarrow\quad F'(x)=f(x)`,
        String.raw`\int_a^b f(x)\,dx=F(b)-F(a)`,
        String.raw`\int u\,dv=uv-\int v\,du`,
        String.raw`\int f(g(x))g'(x)\,dx=\int f(u)\,du`
      ], ['a、b：积分上下限；t、u：积分变量。', 'F：f 的一个原函数。']),
      formulaCard('多变量微积分', [
        String.raw`df=\sum_i\frac{\partial f}{\partial x_i}\,dx_i`,
        String.raw`\nabla f=\begin{bmatrix}\frac{\partial f}{\partial x}&\frac{\partial f}{\partial y}&\frac{\partial f}{\partial z}\end{bmatrix}`,
        String.raw`\nabla\cdot\mathbf F=\frac{\partial F_x}{\partial x}+\frac{\partial F_y}{\partial y}+\frac{\partial F_z}{\partial z}`,
        String.raw`\nabla\times\mathbf F=\begin{vmatrix}\mathbf i&\mathbf j&\mathbf k\\\frac{\partial}{\partial x}&\frac{\partial}{\partial y}&\frac{\partial}{\partial z}\\F_x&F_y&F_z\end{vmatrix}`
      ], ['f：标量场；F：向量场。', '∇f 的单位为 f 单位/空间坐标单位。']),
    ];
    const taylor = [
      formulaCard('泰勒与麦克劳林展开', [
        String.raw`f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)(x-a)^n}{n!}`,
        String.raw`e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots`,
        String.raw`\sin x=x-\frac{x^3}{3!}+\frac{x^5}{5!}-\cdots`,
        String.raw`\cos x=1-\frac{x^2}{2!}+\frac{x^4}{4!}-\cdots`,
        String.raw`\ln(1+x)=x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots,\quad |x|<1`,
        String.raw`(1+x)^\alpha=1+\alpha x+\frac{\alpha(\alpha-1)x^2}{2!}+\cdots,\quad |x|<1`
      ], ['a：展开点；f<sup>(n)</sup>(a)：n 阶导数。', 'n!：阶乘；x：无量纲变量（带量纲量应先归一化）。'], '有限阶计算需保留余项并检查收敛范围。'),
      formulaCard('一阶与二阶工程近似', [
        String.raw`f(x+\Delta x)\approx f(x)+f'(x)\Delta x`,
        String.raw`f(x+\Delta x)\approx f(x)+f'(x)\Delta x+\frac12f''(x)(\Delta x)^2`,
        String.raw`\Delta f\approx\sum_i\frac{\partial f}{\partial x_i}\Delta x_i`
      ], ['Δx、Δx<sub>i</sub>：小扰动；Δf：响应变化。', '一阶敏感度 ∂f/∂x<sub>i</sub> 的单位=f 单位/x<sub>i</sub> 单位。']),
    ];
    const algebra = [
      formulaCard('矩阵运算', [
        String.raw`(AB)_{ij}=\sum_k a_{ik}b_{kj}`,
        String.raw`(AB)^{\mathsf T}=B^{\mathsf T}A^{\mathsf T},\quad(AB)^{-1}=B^{-1}A^{-1}`,
        String.raw`A^{-1}=\frac1{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}`
      ], ['A、B：矩阵；T：转置；-1：逆矩阵。', 'det(A)=ad-bc，只有 det(A)≠0 时逆矩阵存在。']),
      formulaCard('线性方程、特征值与最小二乘', [
        String.raw`Ax=b\quad\Rightarrow\quad x=A^{-1}b\quad(\det A\ne0)`,
        String.raw`\det(A-\lambda I)=0,\qquad Av=\lambda v`,
        String.raw`\hat x=(A^{\mathsf T}A)^{-1}A^{\mathsf T}b`,
        String.raw`A^{\mathsf T}A\hat x=A^{\mathsf T}b`
      ], ['x：未知向量；b：观测/载荷向量。', 'λ：特征值；v：特征向量；I：单位矩阵。', '最小二乘中 A<sup>T</sup>A 病态时优先使用 QR 或 SVD。']),
      formulaCard('行列式、迹与二次型', [
        String.raw`\det(AB)=\det(A)\det(B)`,
        String.raw`\operatorname{tr}(A)=\sum_i a_{ii},\quad\operatorname{tr}(AB)=\operatorname{tr}(BA)`,
        String.raw`q=x^{\mathsf T}Ax`,
        String.raw`x^{\mathsf T}Ax>0\quad(\forall x\ne0)`
      ], ['det：行列式；tr：迹。', '正定矩阵常对应能量、刚度或协方差逆矩阵。']),
    ];
    const statistics = [
      formulaCard('均值、方差与标准差', [
        String.raw`\mu=\operatorname E(X),\quad\sigma^2=\operatorname E[(X-\mu)^2]`,
        String.raw`\bar x=\frac1n\sum_{i=1}^n x_i`,
        String.raw`s^2=\frac{\sum_{i=1}^n(x_i-\bar x)^2}{n-1},\quad s=\sqrt{s^2}`,
        String.raw`\operatorname{SE}(\bar x)=\frac{s}{\sqrt n}`
      ], ['n：样本数；μ、σ：总体均值与标准差。', 'x̄、s：样本均值与标准差；单位与 X 相同，方差单位为 X 单位的平方。']),
      formulaCard('协方差与相关系数', [
        String.raw`\operatorname{cov}(X,Y)=\operatorname E[(X-\mu_X)(Y-\mu_Y)]`,
        String.raw`s_{xy}=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{n-1}`,
        String.raw`r=\frac{s_{xy}}{s_xs_y}`
      ], ['cov：协方差，单位=X 单位×Y 单位。', 'r：无量纲，范围 [-1,1]；相关不代表因果。']),
      formulaCard('常用置信区间', [
        String.raw`\mu\in\bar x\pm z_{1-\alpha/2}\frac{\sigma}{\sqrt n}`,
        String.raw`\mu\in\bar x\pm t_{1-\alpha/2,n-1}\frac{s}{\sqrt n}`,
        String.raw`p\in\hat p\pm z_{1-\alpha/2}\sqrt{\frac{\hat p(1-\hat p)}n}`,
        String.raw`\sigma^2\in\left(\frac{(n-1)s^2}{\chi^2_{1-\alpha/2}},\frac{(n-1)s^2}{\chi^2_{\alpha/2}}\right)`
      ], ['1-α：置信水平，常用 90%、95%、99%。', 'z、t、χ²：相应分布分位数；p̂：样本比例。'], '小样本比例、极端比例或非正态数据应采用更合适的精确/稳健区间。'),
      formulaCard('假设检验统计量', [
        String.raw`z=\frac{\bar x-\mu_0}{\sigma/\sqrt n}`,
        String.raw`t=\frac{\bar x-\mu_0}{s/\sqrt n},\quad df=n-1`,
        String.raw`t_{\mathrm{Welch}}=\frac{\bar x_1-\bar x_2}{\sqrt{s_1^2/n_1+s_2^2/n_2}}`,
        String.raw`\chi^2=\frac{(n-1)s^2}{\sigma_0^2},\qquad F=\frac{s_1^2}{s_2^2}`
      ], ['μ<sub>0</sub>、σ<sub>0</sub>：原假设参数。', 'df：自由度；p 值≤显著性水平 α 时拒绝 H<sub>0</sub>。'], '报告检验结果时同时给出效应量、置信区间、样本量与前提条件。'),
      formulaCard('线性回归与显著性', [
        String.raw`y=\beta_0+\beta_1x+\varepsilon`,
        String.raw`b_1=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{\sum_i(x_i-\bar x)^2}`,
        String.raw`b_0=\bar y-b_1\bar x`,
        String.raw`R^2=1-\frac{\mathrm{SSE}}{\mathrm{SST}},\quad t=\frac{b_1}{\operatorname{SE}(b_1)}`,
        String.raw`F=\frac{\mathrm{SSR}/k}{\mathrm{SSE}/(n-k-1)}`
      ], ['β：总体回归系数；b：样本估计。', 'SST=总平方和，SSR=回归平方和，SSE=残差平方和。', 'k：自变量数量；ε：随机误差。'], '应检查残差独立性、线性、同方差性、正态性及高影响点；高 R² 不等于模型有效。'),
    ];
    return section('微积分常用公式', '导数、积分与多变量场运算。', calculus, calculusDiagram())
      + section('泰勒展开与近似', '适用于局部线性化、误差传播和数值近似。', taylor)
      + section('线性代数', '矩阵、特征问题和最小二乘。', algebra)
      + section('概率统计、置信区间与检验', '统计公式需结合抽样方式、分布前提和样本量使用。', statistics);
  }

  function stressStrainDiagram() {
    return `<div class="ef-diagram"><h4>典型低碳钢工程应力-应变曲线（示意）</h4><svg viewBox="0 0 760 330" role="img" aria-label="典型低碳钢应力应变曲线"><defs><marker id="efArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs><line x1="70" y1="280" x2="710" y2="280" stroke="#475569" marker-end="url(#efArrow)"/><line x1="70" y1="280" x2="70" y2="35" stroke="#475569" marker-end="url(#efArrow)"/><text x="690" y="310">应变 ε</text><text x="18" y="45">应力 σ</text><path d="M70 280 L190 105 L225 92 L245 115 L330 118 C430 110 520 75 590 62 C625 60 650 85 670 145" fill="none" stroke="#2563eb" stroke-width="4"/><line x1="190" y1="105" x2="190" y2="280" stroke="#94a3b8" stroke-dasharray="5 5"/><line x1="590" y1="62" x2="590" y2="280" stroke="#94a3b8" stroke-dasharray="5 5"/><line x1="670" y1="145" x2="670" y2="280" stroke="#94a3b8" stroke-dasharray="5 5"/><text x="105" y="165">线弹性区</text><text x="198" y="77">上屈服</text><text x="240" y="139">屈服平台</text><text x="390" y="95">应变强化</text><text x="555" y="45">抗拉强度 Rm</text><text x="625" y="132">颈缩</text><text x="651" y="170">断裂</text><text x="95" y="250">斜率 E</text></svg><p>工程应力 σ=F/A<sub>0</sub>，工程应变 ε=ΔL/L<sub>0</sub>。弹性区斜率为杨氏模量 E；屈服后发生塑性变形，达到抗拉强度后出现颈缩并最终断裂。脆性材料通常没有明显屈服平台。曲线位置取决于材料、热处理、温度和应变速率。</p></div>`;
  }

  function phaseDiagrams() {
    return `<div class="ef-diagram-grid"><div class="ef-diagram"><h4>Cu-Zn 黄铜平衡相图（工程示意）</h4><svg viewBox="0 0 650 360" role="img" aria-label="铜锌黄铜相图示意"><line x1="65" y1="305" x2="610" y2="305" stroke="#475569"/><line x1="65" y1="305" x2="65" y2="35" stroke="#475569"/><text x="535" y="340">Zn 质量分数 / %</text><text x="10" y="45">温度 / °C</text><path d="M65 65 C150 80 220 95 300 125 C390 160 470 185 610 210" fill="none" stroke="#dc2626" stroke-width="3"/><path d="M65 90 C145 110 205 135 265 165 C350 205 450 235 610 255" fill="none" stroke="#f59e0b" stroke-width="3"/><path d="M260 165 C270 205 270 250 278 305" fill="none" stroke="#2563eb" stroke-width="3"/><path d="M405 215 C410 250 420 275 430 305" fill="none" stroke="#7c3aed" stroke-width="3"/><text x="145" y="210">α</text><text x="285" y="240">α+β</text><text x="420" y="270">β</text><text x="360" y="95">液相 L</text><text x="180" y="115">L+α</text><text x="430" y="185">L+β</text><text x="85" y="325">0</text><text x="260" y="325">≈35</text><text x="420" y="325">≈50</text><text x="585" y="325">100</text></svg><p>低锌 α 黄铜为 FCC 固溶体，塑性和冷加工性好；α+β 黄铜强度较高、热加工性较好；更高锌含量会出现 β 及更复杂相。边界随温度和成分变化，本图仅用于理解相区，选材与热处理必须查对应材料标准和权威相图。</p></div><div class="ef-diagram"><h4>Fe-Fe₃C 铁碳相图（工程示意）</h4><svg viewBox="0 0 650 360" role="img" aria-label="铁碳相图示意"><line x1="65" y1="305" x2="610" y2="305" stroke="#475569"/><line x1="65" y1="305" x2="65" y2="35" stroke="#475569"/><text x="500" y="340">C 质量分数 / %</text><text x="10" y="45">温度 / °C</text><path d="M65 55 L95 80 L125 115 L175 135 L420 150 L610 105" fill="none" stroke="#dc2626" stroke-width="3"/><path d="M65 105 L125 115 L175 200 L420 150 L610 220" fill="none" stroke="#f59e0b" stroke-width="3"/><line x1="65" y1="235" x2="610" y2="235" stroke="#2563eb" stroke-width="2"/><line x1="130" y1="235" x2="130" y2="305" stroke="#94a3b8" stroke-dasharray="5 4"/><line x1="420" y1="150" x2="420" y2="305" stroke="#94a3b8" stroke-dasharray="5 4"/><text x="72" y="225">727 °C</text><text x="105" y="325">0.76</text><text x="394" y="325">4.3</text><text x="585" y="325">6.67</text><text x="270" y="85">液相 L</text><text x="185" y="170">γ 奥氏体</text><text x="80" y="270">α+Fe₃C</text><text x="275" y="270">珠光体/渗碳体区</text><text x="430" y="140">1147 °C 共晶</text></svg><p>关键点：约 0.76%C、727 °C 为共析反应 γ→α+Fe₃C；4.3%C、1147 °C 为共晶反应 L→γ+Fe₃C；6.67%C 对应 Fe₃C。实际钢铁还受合金元素与冷却速度影响，连续冷却组织需结合 CCT/TTT 图判断。</p></div></div>`;
  }

  function mechanicsPage() {
    const statics = [
      formulaCard('牛顿定律与静力平衡', [
        String.raw`\mathbf F=m\mathbf a,\qquad\sum\mathbf F=0\ \text{(静力平衡)}`,
        String.raw`\mathbf M=\mathbf r\times\mathbf F,\quad\sum\mathbf M=0\ \text{(静力平衡)}`,
        String.raw`G=mg`
      ], ['F、G：力/N；m：质量/kg；a、g：加速度/m·s⁻²。', 'M：力矩/N·m；r：力臂向量/m。']),
      formulaCard('功、能量、功率与冲量', [
        String.raw`W=\int\mathbf F\cdot d\mathbf s,\quad E_k=\frac12mv^2`,
        String.raw`E_p=mgh,\qquad E_s=\frac12kx^2`,
        String.raw`P=\frac{dW}{dt}=\mathbf F\cdot\mathbf v`,
        String.raw`\mathbf J=\int\mathbf F\,dt=\Delta(m\mathbf v)`
      ], ['W：力沿路径所做的功/J；E<sub>k</sub>：动能/J；E<sub>p</sub>：重力势能/J；E<sub>s</sub>：弹性势能/J。', 'P：做功速率/W；v：速度/m·s⁻¹；h：相对基准面高度/m；x：弹簧伸缩量/m。', 'F：作用力/N；s：位移/m；k：弹簧刚度/N·m⁻¹；J：冲量/N·s。']),
      formulaCard('圆周运动与转动', [
        String.raw`a_n=\frac{v^2}{r}=\omega^2r`,
        String.raw`\sum M=I\alpha`,
        String.raw`E_r=\frac12I\omega^2,\qquad L=I\omega`
      ], ['r：半径/m；ω：角速度/rad·s⁻¹；α：角加速度/rad·s⁻²。', 'I：质量转动惯量/kg·m²；L：角动量/kg·m²·s⁻¹。']),
      formulaCard('单自由度振动', [
        String.raw`\omega_n=\sqrt{\frac km},\qquad f_n=\frac{\omega_n}{2\pi}`,
        String.raw`c_c=2\sqrt{km},\qquad\zeta=\frac c{c_c}`,
        String.raw`\omega_d=\omega_n\sqrt{1-\zeta^2}`
      ], ['k：系统等效刚度/N·m⁻¹；m：系统等效质量/kg；c：粘性阻尼系数/N·s·m⁻¹。', 'ω<sub>n</sub>：无阻尼固有圆频率/rad·s⁻¹；f<sub>n</sub>：固有频率/Hz；ω<sub>d</sub>：有阻尼圆频率/rad·s⁻¹。', 'c<sub>c</sub>：临界阻尼系数/N·s·m⁻¹；ζ：阻尼比，无量纲。']),
    ];
    const strength = [
      formulaCard('应力、应变与胡克定律', [
        String.raw`\sigma=\frac FA,\quad\tau=\frac VA`,
        String.raw`\varepsilon=\frac{\Delta L}L,\quad\gamma\approx\frac{\Delta x}h`,
        String.raw`\sigma=E\varepsilon,\qquad\tau=G\gamma`,
        String.raw`G=\frac E{2(1+\nu)},\qquad K=\frac E{3(1-2\nu)}`
      ], ['σ：正应力/Pa；τ：剪应力/Pa；E：杨氏模量/Pa；G：剪切模量/Pa；K：体积模量/Pa。', 'ε：正应变，无量纲；γ：剪应变/rad（小变形时数值无量纲）；ν：泊松比，无量纲。', 'F：轴向力/N；V：剪力/N；A：承载截面积/m²或mm²；ΔL：长度变化量/m；L：原始标距/m。', 'ν=-ε<sub>横</sub>/ε<sub>纵</sub>。']),
      formulaCard('轴向变形与热应变', [
        String.raw`\delta=\frac{FL}{EA}`,
        String.raw`\varepsilon_{\mathrm{th}}=\alpha\Delta T,\qquad\delta_{\mathrm{th}}=\alpha L\Delta T`,
        String.raw`\sigma_{\mathrm{th}}=E\alpha\Delta T`
      ], ['δ、L：长度/m或mm；F：N；A：m²或mm²。', 'α：线膨胀系数/K⁻¹；ΔT：K或°C温差。'], '组合载荷可在线弹性范围内使用叠加原理。'),
      formulaCard('弯曲、弯矩与曲率', [
        String.raw`\sigma=\frac{My}I=\frac MW`,
        String.raw`\frac1\rho=\frac M{EI}`,
        String.raw`\frac{dV}{dx}=-w,\qquad\frac{dM}{dx}=V`,
        String.raw`EI\frac{d^2y}{dx^2}=M(x)`
      ], ['M：弯矩/N·m；V：剪力/N；w：分布载荷/N·m⁻¹。', 'I：截面二次矩/m⁴或mm⁴；W=I/c：截面模量/m³或mm³。', 'ρ：曲率半径；y：挠度。']),
      formulaCard('扭转', [
        String.raw`\tau=\frac{T\rho}J,\qquad\tau_{\max}=\frac{Tr}J`,
        String.raw`\varphi=\frac{TL}{GJ}`,
        String.raw`J_{\mathrm{solid}}=\frac{\pi d^4}{32},\quad J_{\mathrm{hollow}}=\frac{\pi(D^4-d^4)}{32}`
      ], ['T：扭矩/N·m；ρ、r、d、D：m或mm。', 'J：极惯性矩/m⁴或mm⁴；φ：rad。']),
      formulaCard('组合应力与强度判据', [
        String.raw`\sigma_{1,2}=\frac{\sigma_x+\sigma_y}{2}\pm\sqrt{\left(\frac{\sigma_x-\sigma_y}{2}\right)^2+\tau_{xy}^2}`,
        String.raw`\sigma_v=\sqrt{\sigma_1^2+\sigma_2^2+\sigma_3^2-\sigma_1\sigma_2-\sigma_2\sigma_3-\sigma_3\sigma_1}`,
        String.raw`n=\frac{\text{材料许用强度}}{\text{计算等效应力}}`
      ], ['σ<sub>1,2,3</sub>：主应力/Pa；τ<sub>xy</sub>：剪应力/Pa。', 'σ<sub>v</sub>：von Mises 等效应力/Pa；n：无量纲。']),
      formulaCard('疲劳 Goodman 关系', [
        String.raw`\frac{\sigma_a}{S_e}+\frac{\sigma_m}{S_{ut}}\leq\frac1n`,
        String.raw`\sigma_a=\frac{\sigma_{\max}-\sigma_{\min}}2`,
        String.raw`\sigma_m=\frac{\sigma_{\max}+\sigma_{\min}}2`
      ], ['σ<sub>a</sub>：应力幅；σ<sub>m</sub>：平均应力。', 'S<sub>e</sub>：修正疲劳极限；S<sub>ut</sub>：抗拉强度；单位均为 Pa/MPa。', 'n：目标安全系数。'], '实际疲劳设计还需考虑表面、尺寸、缺口、可靠度、温度、腐蚀和载荷谱。'),
    ];
    const sections = [
      formulaCard('常用截面二次矩', [
        String.raw`\text{矩形：}\quad I=\frac{bh^3}{12},\quad W=\frac{bh^2}6`,
        String.raw`\text{实心圆：}\quad I=\frac{\pi d^4}{64},\quad W=\frac{\pi d^3}{32}`,
        String.raw`\text{空心圆：}\quad I=\frac{\pi(D^4-d^4)}{64}`,
        String.raw`I=I_c+Ad^2`
      ], ['b：矩形截面宽度/m或mm；h：矩形沿弯曲方向的高度/m或mm；d、D：内外圆直径/m或mm。', 'I：截面对中性轴的二次矩/m⁴或mm⁴；W：抗弯截面模量/m³或mm³。', 'I<sub>c</sub>：截面对形心轴的二次矩；A：截面积；d（平行轴定理）：形心轴到目标轴的距离。']),
      formulaCard('梁挠度常用结果', [
        String.raw`\text{悬臂梁端部力：}\quad\delta_{\max}=\frac{PL^3}{3EI},\quad\theta_{\text{端}}=\frac{PL^2}{2EI}`,
        String.raw`\text{悬臂梁均布载荷：}\quad\delta_{\max}=\frac{wL^4}{8EI}`,
        String.raw`\text{简支梁中点力：}\quad\delta_{\max}=\frac{PL^3}{48EI}`,
        String.raw`\text{简支梁均布载荷：}\quad\delta_{\max}=\frac{5wL^4}{384EI}`
      ], ['P：集中力/N；w：均布载荷/N·m⁻¹；L：跨度/m。', 'δ：挠度/m；θ：转角/rad；E：Pa；I：m⁴。'], '公式基于小挠度、线弹性、Euler-Bernoulli 梁和恒定截面。'),
      formulaCard('欧拉压杆稳定', [
        String.raw`P_{\mathrm{cr}}=\frac{\pi^2EI}{(KL)^2}`,
        String.raw`\sigma_{\mathrm{cr}}=\frac{\pi^2E}{(KL/r)^2}`,
        String.raw`r=\sqrt{\frac IA}`
      ], ['K：有效长度系数；两端铰支 1、固定-自由 2、固定-铰支约0.7、两端固定0.5。', 'L：杆长；r：回转半径；KL/r：长细比。'], '只适用于细长、理想直杆的弹性屈曲；实际需考虑初弯曲、偏心和材料非线性。'),
    ];
    return section('基础力学与振动', '静力、动力、能量和单自由度振动。', statics)
      + section('材料力学与强度', '应力应变、泊松比、弯曲、扭转、疲劳。', strength, stressStrainDiagram())
      + section('截面、挠度与稳定', '常见截面惯性矩、梁挠度和压杆屈曲。', sections, beamDiagram())
      + section('材料相图参考', '相图用于理解平衡相区；具体材料必须查标准、材料牌号与热处理资料。', [], phaseDiagrams());
  }

  function electricalPage() {
    const dc = [
      formulaCard('电阻定律与温度修正', [
        String.raw`R=\frac{\rho L}A,\qquad G=\frac1R`,
        String.raw`R(T)=R_0[1+\alpha(T-T_0)]`,
        String.raw`R_{\mathrm{eq}}=\sum_iR_i,\qquad\frac1{R_{\mathrm{eq}}}=\sum_i\frac1{R_i}`
      ], ['R：导体电阻/Ω；G：电导/S；ρ：材料电阻率/Ω·m。', 'L：电流路径长度/m；A：导体有效截面积/m²；R<sub>eq</sub>：组合后等效电阻/Ω。', 'α：电阻温度系数/K⁻¹；T：工作温度/°C或K；T<sub>0</sub>：参考温度/°C或K。']),
      formulaCard('欧姆、功率与电能', [
        String.raw`U=IR`,
        String.raw`P=UI=I^2R=\frac{U^2}R`,
        String.raw`W=\int P\,dt,\qquad W=Pt\ \text{(恒功率)}`,
        String.raw`Q=I^2Rt`
      ], ['U：元件两端电压/V；I：通过元件的电流/A；R：电阻/Ω。', 'P：瞬时或平均电功率/W；W：电能/J（工程中常用 Wh或kWh）；Q：电阻产生的焦耳热/J。', 't：通电时间/s，用 Wh 计算时可用 h。']),
      formulaCard('基尔霍夫定律', [
        String.raw`\sum I=0\quad\text{(流入等于流出)}`,
        String.raw`\sum U=0`,
        String.raw`Gv=i,\qquad Zi=u`
      ], ['I：支路电流/A；U：支路电压/V。', 'G：节点电导矩阵/S；Z：阻抗矩阵/Ω。']),
      formulaCard('分压、分流与等效源', [
        String.raw`U_k=U\frac{R_k}{\sum R}`,
        String.raw`I_1=I\frac{R_2}{R_1+R_2}`,
        String.raw`I_n=\frac{U_{\mathrm{th}}}{R_{\mathrm{th}}}`,
        String.raw`R_L=R_{\mathrm{th}}\quad\text{(直流最大功率)}`
      ], ['U<sub>th</sub>：开路电压/V；R<sub>th</sub>：独立源置零后的端口电阻/Ω。', 'I<sub>n</sub>：短路电流/A；R<sub>L</sub>：负载/Ω。']),
    ];
    const cap = [
      formulaCard('电容基本关系', [
        String.raw`Q=CU,\qquad i=C\frac{du}{dt}`,
        String.raw`W_C=\frac12CU^2=\frac{Q^2}{2C}`,
        String.raw`C_{\mathrm{eq}}=\sum C,\qquad\frac1{C_{\mathrm{eq}}}=\sum\frac1C`
      ], ['C：电容量/F；Q：电荷量/C（库仑）；U：电容两端电压/V。', 'i：流入电容正端的电流/A；du/dt：电容电压变化率/V·s⁻¹。', 'W<sub>C</sub>：电容储存的电场能量/J；C<sub>eq</sub>：等效电容/F。']),
      formulaCard('RC 一阶瞬态', [
        String.raw`\tau=RC`,
        String.raw`u_C(t)=U_\infty+(U_0-U_\infty)e^{-t/\tau}`,
        String.raw`u_C=U(1-e^{-t/(RC)}),\quad i=\frac UR e^{-t/(RC)}`,
        String.raw`u_C=U_0e^{-t/(RC)}\quad\text{(放电)}`
      ], ['τ：RC 回路时间常数/s；t：由开关动作起算的时间/s。', 'R：电容看入的等效电阻/Ω；C：等效电容/F；u<sub>C</sub>(t)：时刻 t 的电容电压/V。', 'U<sub>0</sub>：电容初始电压/V；U<sub>∞</sub>：长时间后稳态电压/V；i：充放电电流/A。', '电容电压不能突变：u<sub>C</sub>(0⁺)=u<sub>C</sub>(0⁻)。']),
    ];
    const ind = [
      formulaCard('电感基本关系', [
        String.raw`u=L\frac{di}{dt},\qquad\lambda=Li`,
        String.raw`W_L=\frac12LI^2`,
        String.raw`L_{\mathrm{eq}}=\sum L,\qquad\frac1{L_{\mathrm{eq}}}=\sum\frac1L`
      ], ['L：电感量/H；u：电感两端电压/V；i、I：电感电流/A。', 'di/dt：电感电流变化率/A·s⁻¹；λ：线圈磁链/Wb·turn。', 'W<sub>L</sub>：电感储存的磁场能量/J；L<sub>eq</sub>：等效电感/H。', '电感电流不能突变：i<sub>L</sub>(0⁺)=i<sub>L</sub>(0⁻)。']),
      formulaCard('RL 一阶瞬态', [
        String.raw`\tau=\frac LR`,
        String.raw`i(t)=\frac UR(1-e^{-tR/L})`,
        String.raw`i(t)=I_0e^{-tR/L}\quad\text{(自然响应)}`,
        String.raw`u_L=L\frac{di}{dt}`
      ], ['τ：RL 回路时间常数/s；t：由开关动作起算的时间/s。', 'L：回路等效电感/H；R：电感回路等效电阻/Ω；U：施加的直流电压/V。', 'i(t)：时刻 t 的电感电流/A；I<sub>0</sub>：开关动作前的初始电流/A；u<sub>L</sub>：电感两端电压/V。'], '感性回路断开会产生高压，应评估续流二极管、TVS、RC 吸收或主动钳位。'),
      formulaCard('互感与理想变压器', [
        String.raw`u_1=L_1\frac{di_1}{dt}\pm M\frac{di_2}{dt}`,
        String.raw`k=\frac M{\sqrt{L_1L_2}}`,
        String.raw`\frac{U_1}{U_2}=\frac{N_1}{N_2}=\frac{I_2}{I_1}`,
        String.raw`Z'=\left(\frac{N_1}{N_2}\right)^2Z`
      ], ['M、L：H；k：0～1，无量纲。', 'N：匝数；U：V；I：A；Z：Ω。']),
    ];
    const ac = [
      formulaCard('正弦量、RMS 与阻抗', [
        String.raw`u(t)=\hat U\sin(\omega t+\varphi),\quad U_{\mathrm{rms}}=\frac{\hat U}{\sqrt2}`,
        String.raw`Z_R=R,\quad Z_L=j\omega L,\quad Z_C=\frac1{j\omega C}`,
        String.raw`\dot U=Z\dot I`
      ], ['Û：峰值/V；U<sub>rms</sub>：有效值/V；ω=2πf/rad·s⁻¹。', 'j=√-1；Z：复阻抗/Ω；φ：相位/rad或°。']),
      formulaCard('交流功率与功率因数', [
        String.raw`S=UI^*=P+jQ`,
        String.raw`P=UI\cos\varphi,\quad Q=UI\sin\varphi`,
        String.raw`|S|=UI,\qquad\mathrm{PF}=\frac P{|S|}=\cos\varphi`
      ], ['单相公式中 U、I 为 RMS；P：W；Q：var；S：VA。', 'φ：电压与电流相角；I*：电流相量共轭。']),
      formulaCard('三相平衡系统', [
        String.raw`P=\sqrt3\,U_LI_L\cos\varphi`,
        String.raw`Q=\sqrt3\,U_LI_L\sin\varphi,\quad S=\sqrt3\,U_LI_L`,
        String.raw`\text{星形：}\quad U_L=\sqrt3\,U_{\mathrm{ph}},\quad I_L=I_{\mathrm{ph}}`,
        String.raw`\text{三角形：}\quad U_L=U_{\mathrm{ph}},\quad I_L=\sqrt3\,I_{\mathrm{ph}}`
      ], ['U<sub>L</sub>、I<sub>L</sub>：线电压/V、线电流/A。', 'U<sub>ph</sub>、I<sub>ph</sub>：相电压/V、相电流/A。']),
      formulaCard('RLC 二阶与谐振', [
        String.raw`\omega_0=\frac1{\sqrt{LC}},\quad f_0=\frac{\omega_0}{2\pi}`,
        String.raw`\alpha=\frac R{2L},\qquad\zeta=\frac\alpha{\omega_0}`,
        String.raw`Q=\frac{\omega_0L}R=\frac1{\omega_0CR}`,
        String.raw`\Delta f\approx\frac{f_0}Q`
      ], ['ω<sub>0</sub>：rad/s；f<sub>0</sub>、Δf：Hz。', 'R：Ω；L：H；C：F；Q、ζ：无量纲。']),
    ];
    const field = [
      formulaCard('电磁感应与磁路', [
        String.raw`e=-N\frac{d\Phi}{dt}`,
        String.raw`\Phi=\int\mathbf B\cdot d\mathbf A,\quad\Phi=BA\cos\theta\ \text{(均匀场)}`,
        String.raw`\mathcal F=NI,\quad\mathcal R=\frac l{\mu A},\quad\Phi=\frac{\mathcal F}{\mathcal R}`,
        String.raw`w_m=\frac{B^2}{2\mu}`
      ], ['e：V；N：匝数；Φ：Wb；B：T；A：m²。', 'ℱ：A·turn；ℛ：A·turn/Wb；μ：H/m；l：m。']),
      formulaCard('电场、电介质与位移电流', [
        String.raw`F=\frac{q_1q_2}{4\pi\varepsilon r^2}`,
        String.raw`E=\frac Fq,\quad D=\varepsilon E,\quad\oint\mathbf D\cdot d\mathbf A=Q_{\mathrm{free}}`,
        String.raw`C=\frac{\varepsilon A}d`,
        String.raw`J_d=\frac{\partial D}{\partial t}`
      ], ['F：N；q、Q：C；r、d：m；E：V/m；D：C/m²。', 'ε：F/m；J<sub>d</sub>：A/m²。']),
      formulaCard('短路与故障等效', [
        String.raw`I_{\mathrm{sc}}=\frac{U_{\mathrm{oc}}}{R_{\mathrm{eq}}}`,
        String.raw`I_k=\frac{U_{\mathrm{ph}}}{|Z_{\mathrm{th}}|}`,
        String.raw`i_p=\kappa\sqrt2\,I_k`,
        String.raw`I^2t=\int i^2\,dt`
      ], ['U<sub>oc</sub>：开路电压/V；R<sub>eq</sub>：等效内阻/Ω。', 'Z<sub>th</sub>：故障点戴维南阻抗/Ω；κ：与 X/R 比有关。', 'I²t：A²·s，用于保险丝及导体短时热校核。'], '实际短路电流受电源动态、电弧、控制保护和阻抗随温度变化影响。'),
    ];
    return section('直流电路基础', '电阻、基尔霍夫、功率及等效源。', dc)
      + section('电容与 RC 瞬态', '电容储能和一阶电路。', cap, rcDiagram())
      + section('电感、RL 瞬态与变压器', '电感电流连续性和关断过压尤其重要。', ind)
      + section('交流、三相与 RLC', '相量和功率公式默认稳态正弦条件。', ac)
      + section('电磁场与故障', '磁路、电场及短路工程公式。', field);
  }

  function thermalPage() {
    const thermo = [
      formulaCard('理想气体与状态方程', [
        String.raw`pV=mRT,\qquad pv=RT`,
        String.raw`R=\frac{R_u}M`,
        String.raw`\gamma=\frac{c_p}{c_v},\qquad c_p-c_v=R`
      ], ['p：气体绝对压力/Pa；V：气体总体积/m³；m：气体质量/kg；v：比体积/m³·kg⁻¹。', 'T：绝对温度/K；R：该气体的比气体常数/J·kg⁻¹·K⁻¹；R<sub>u</sub>：通用气体常数，8.314 J·mol⁻¹·K⁻¹。', 'M：气体摩尔质量/kg·mol⁻¹；c<sub>p</sub>、c<sub>v</sub>：定压、定容比热容/J·kg⁻¹·K⁻¹；γ：比热比，无量纲。']),
      formulaCard('热力学第一定律', [
        String.raw`\Delta U=Q-W\quad\text{(闭口系统)}`,
        String.raw`q-w_s=(h_2-h_1)+\frac{V_2^2-V_1^2}2+g(z_2-z_1)`,
        String.raw`h=u+pv`
      ], ['U、Q、W：J；单位质量量 u、q、w、h：J/kg。', 'w<sub>s</sub>：轴功/J·kg⁻¹；V：m/s；z：m。', '符号约定：Q 输入系统为正，W 系统对外做功为正。']),
      formulaCard('熵与第二定律', [
        String.raw`dS\geq\frac{\delta Q}T,\quad dS=\frac{\delta Q_{\mathrm{rev}}}T\ \text{(可逆)}`,
        String.raw`S_{\mathrm{gen}}\geq0`,
        String.raw`\Delta s=c_p\ln\frac{T_2}{T_1}-R\ln\frac{p_2}{p_1}`
      ], ['S：J/K；s：J·kg⁻¹·K⁻¹；T：K。', 'S<sub>gen</sub>：熵产，等于0为可逆过程。']),
      formulaCard('等熵理想气体关系', [
        String.raw`pV^\gamma=\mathrm{const},\qquad TV^{\gamma-1}=\mathrm{const}`,
        String.raw`\frac{T_2}{T_1}=\left(\frac{p_2}{p_1}\right)^{(\gamma-1)/\gamma}`
      ], ['γ：比热比；p：绝对压力；T：绝对温度/K。'], '只适用于定比热理想气体的可逆绝热过程。'),
      formulaCard('循环效率与制冷性能', [
        String.raw`\eta=\frac{W_{\mathrm{net}}}{Q_{\mathrm{in}}}=1-\frac{Q_{\mathrm{out}}}{Q_{\mathrm{in}}}`,
        String.raw`\eta_C=1-\frac{T_L}{T_H}`,
        String.raw`\mathrm{COP}_R=\frac{Q_L}W,\quad\mathrm{COP}_{\mathrm{HP}}=\frac{Q_H}W=\mathrm{COP}_R+1`
      ], ['η、COP：无量纲；Q、W：J或W（同一时间基准）。', 'T<sub>H</sub>、T<sub>L</sub>：高低温热源绝对温度/K。']),
    ];
    const conduction = [
      formulaCard('傅里叶导热与平壁热阻', [
        String.raw`q''=-k\frac{dT}{dx}`,
        String.raw`\dot Q=\frac{kA(T_1-T_2)}L=\frac{\Delta T}{R_{\mathrm{th}}}`,
        String.raw`R_{\mathrm{cond}}=\frac L{kA}`
      ], ['q″：单位面积热流率/W·m⁻²；Q̇：通过平壁的总热流率/W；k：材料导热系数/W·m⁻¹·K⁻¹。', 'T：局部温度/K或°C；x：沿导热方向的坐标/m；dT/dx：温度梯度/K·m⁻¹。', 'A：垂直热流的面积/m²；L：平壁厚度/m；R<sub>th</sub>：热阻/K·W⁻¹；ΔT：两端温差/K或°C。']),
      formulaCard('圆筒与球壳导热', [
        String.raw`R_{\mathrm{cyl}}=\frac{\ln(r_2/r_1)}{2\pi kL}`,
        String.raw`R_{\mathrm{sph}}=\frac{1/r_1-1/r_2}{4\pi k}`,
        String.raw`\dot Q=\frac{\Delta T}{\sum R_{\mathrm{th},i}}`
      ], ['r<sub>1</sub>、r<sub>2</sub>：内外半径/m；L：圆筒长度/m。', 'R<sub>th</sub>：K/W；k：W·m⁻¹·K⁻¹。']),
      formulaCard('接触热阻与等效导热', [
        String.raw`R_c=\frac{\Delta T}{\dot Q}=\frac1{h_cA}`,
        String.raw`R_{\mathrm{eq}}=\sum_iR_i\quad\text{(串联)}`,
        String.raw`\frac1{R_{\mathrm{eq}}}=\sum_i\frac1{R_i}\quad\text{(并联)}`
      ], ['h<sub>c</sub>：接触导热系数/W·m⁻²·K⁻¹。', '接触热阻受压力、粗糙度、界面材料与氧化层影响。']),
    ];
    const convection = [
      formulaCard('牛顿冷却定律', [
        String.raw`\dot Q=hA(T_s-T_\infty)`,
        String.raw`R_{\mathrm{conv}}=\frac1{hA}`
      ], ['h：对流换热系数/W·m⁻²·K⁻¹；A：m²。', 'T<sub>s</sub>：表面温度；T<sub>∞</sub>：主流温度。']),
      formulaCard('无量纲数与关联式', [
        String.raw`\mathrm{Re}=\frac{\rho VL}\mu=\frac{VL}\nu`,
        String.raw`\mathrm{Pr}=\frac{c_p\mu}k=\frac\nu\alpha`,
        String.raw`\mathrm{Nu}=\frac{hL}k,\quad\mathrm{Gr}=\frac{g\beta\Delta T L^3}{\nu^2}`,
        String.raw`\mathrm{Ra}=\mathrm{Gr}\,\mathrm{Pr}`
      ], ['Re：惯性/黏性；Pr：动量/热扩散；Nu：对流/导热；Ra：自然对流强度。', 'ρ：kg/m³；V：m/s；μ：Pa·s；ν：m²/s；α：热扩散率/m²·s⁻¹。'], '关联式必须匹配几何、边界条件、流态和适用 Re/Pr 范围。'),
      formulaCard('管内流动常用关联', [
        String.raw`\mathrm{Nu}=3.66\quad\text{(层流充分发展、恒壁温)}`,
        String.raw`\mathrm{Nu}=0.023\,\mathrm{Re}^{0.8}\mathrm{Pr}^n`,
        String.raw`n\approx0.4\ \text{(加热)},\quad n\approx0.3\ \text{(冷却)}`
      ], ['特征长度为管内径 D；h=Nu·k/D。', '常用适用范围：光滑圆管、充分发展湍流，Re≳10⁴，约0.7&lt;Pr&lt;160。']),
    ];
    const radiation = [
      formulaCard('热辐射', [
        String.raw`E_b=\sigma T^4`,
        String.raw`\dot Q=\varepsilon\sigma A(T_s^4-T_{\mathrm{sur}}^4)`,
        String.raw`h_r=\varepsilon\sigma(T_s+T_{\mathrm{sur}})(T_s^2+T_{\mathrm{sur}}^2)`
      ], ['E<sub>b</sub>：黑体辐射出射度/W·m⁻²；σ：Stefan–Boltzmann 常数，5.670374419×10⁻⁸ W·m⁻²·K⁻⁴。', 'ε：表面发射率，0～1，无量纲；A：辐射表面积/m²；Q̇：净辐射热流率/W。', 'T<sub>s</sub>：表面绝对温度/K；T<sub>sur</sub>：大环境绝对温度/K；h<sub>r</sub>：线性化辐射换热系数/W·m⁻²·K⁻¹。']),
      formulaCard('两灰表面辐射换热', [
        String.raw`\dot Q_{12}=\frac{\sigma(T_1^4-T_2^4)}{\dfrac{1-\varepsilon_1}{A_1\varepsilon_1}+\dfrac1{A_1F_{12}}+\dfrac{1-\varepsilon_2}{A_2\varepsilon_2}}`,
        String.raw`A_1F_{12}=A_2F_{21},\qquad\sum_jF_{ij}=1`
      ], ['F<sub>12</sub>：从表面1到2的视角系数，无量纲。', 'A：m²；ε：发射率；T：K。']),
    ];
    const transient = [
      formulaCard('集中参数瞬态导热', [
        String.raw`\mathrm{Bi}=\frac{hL_c}k,\quad\mathrm{Bi}<0.1\ \text{(集中参数近似)}`,
        String.raw`\frac{T-T_\infty}{T_i-T_\infty}=\exp\left(-\frac{hAt}{\rho c_pV}\right)`,
        String.raw`\tau_{\mathrm{th}}=\frac{\rho c_pV}{hA}=C_{\mathrm{th}}R_{\mathrm{th}}`
      ], ['Bi：Biot数；L<sub>c</sub>=V/A：m。', 'ρ：kg/m³；c<sub>p</sub>：J·kg⁻¹·K⁻¹；t、τ：s。', 'C<sub>th</sub>=ρc<sub>p</sub>V：J/K。']),
      formulaCard('热扩散与 Fourier 数', [
        String.raw`\alpha=\frac k{\rho c_p}`,
        String.raw`\mathrm{Fo}=\frac{\alpha t}{L^2}`,
        String.raw`\frac{\partial T}{\partial t}=\alpha\frac{\partial^2T}{\partial x^2}`
      ], ['α：m²/s；Fo：无量纲；L：特征长度/m。', '非集中参数问题需结合边界条件使用解析图表或数值求解。']),
      formulaCard('显热、潜热与混合', [
        String.raw`Q=mc_p\Delta T`,
        String.raw`Q=mL_h`,
        String.raw`\sum m_{\mathrm{in}}h_{\mathrm{in}}=\sum m_{\mathrm{out}}h_{\mathrm{out}}`
      ], ['Q：J；m：kg；c<sub>p</sub>：J·kg⁻¹·K⁻¹。', 'L<sub>h</sub>：相变潜热/J·kg⁻¹；h：比焓/J·kg⁻¹。']),
    ];
    const exchanger = [
      formulaCard('换热器 LMTD 法', [
        String.raw`\dot Q=UA\Delta T_{\mathrm{lm}}`,
        String.raw`\Delta T_{\mathrm{lm}}=\frac{\Delta T_1-\Delta T_2}{\ln(\Delta T_1/\Delta T_2)}`,
        String.raw`\frac1{UA}=\frac1{h_hA_h}+R_{\mathrm{wall}}+R_{\mathrm{fouling}}+\frac1{h_cA_c}`
      ], ['U：总传热系数/W·m⁻²·K⁻¹；A：m²。', 'ΔT<sub>1,2</sub>：两端温差/K；Q̇：W。']),
      formulaCard('ε-NTU 法', [
        String.raw`C_{h,c}=\dot m c_p,\quad C_{\min}=\min(C_h,C_c)`,
        String.raw`\mathrm{NTU}=\frac{UA}{C_{\min}},\quad C_r=\frac{C_{\min}}{C_{\max}}`,
        String.raw`\varepsilon=\frac{\dot Q}{C_{\min}(T_{h,\mathrm{in}}-T_{c,\mathrm{in}})}`
      ], ['C：热容量率/W·K⁻¹；ṁ：kg/s；NTU、C<sub>r</sub>、ε：无量纲。', 'ε(NTU,C<sub>r</sub>) 关系取决于并流、逆流或交叉流结构。']),
      formulaCard('肋片效率', [
        String.raw`\eta_f=\frac{\tanh(mL)}{mL}\quad\text{(直等截面、绝热端近似)}`,
        String.raw`m=\sqrt{\frac{hP}{kA_c}}`,
        String.raw`\dot Q_f=\eta_fhA_f(T_b-T_\infty)`
      ], ['P：肋片周长/m；A<sub>c</sub>：截面积/m²；A<sub>f</sub>：肋片面积/m²。', 'm：m⁻¹；η<sub>f</sub>：无量纲。']),
    ];
    return section('工程热力学', '状态方程、能量、熵及循环性能。', thermo)
      + section('导热与热阻网络', '所有热阻必须使用一致的热流面积和单位。', conduction, thermalResistanceDiagram())
      + section('对流换热', '换热系数通常来自试验或适用的无量纲关联式。', convection)
      + section('辐射换热', '辐射温度必须使用绝对温度 K。', radiation)
      + section('瞬态、热容与相变', '用于温升、冷却和热时间常数估算。', transient)
      + section('换热器与肋片', 'LMTD、ε-NTU 与扩展表面常用公式。', exchanger);
  }

  const PAGES = { math: { label: '数学', render: mathPage }, mechanics: { label: '力学', render: mechanicsPage }, electrical: { label: '电学', render: electricalPage }, thermal: { label: '热学', render: thermalPage } };

  function moduleStyle() {
    return `.ef-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center}.ef-tabs{display:flex;gap:7px;flex-wrap:wrap}.ef-tab{border:1px solid #aebdca;background:#fff;color:#173b5e;padding:9px 18px;border-radius:4px;font-weight:700;cursor:pointer}.ef-tab.active{background:#173b5e;color:#fff;border-color:#173b5e}.ef-search{min-width:280px}.ef-intro{border-left:4px solid #b7791f}.ef-intro h3,.ef-intro p{margin:4px 0}.ef-section{margin:0 0 24px}.ef-section>header{margin-bottom:10px;border-bottom:2px solid #8fa2b4;padding-bottom:7px}.ef-section>header h3,.ef-section>header p{margin:3px 0}.ef-section>header p{color:var(--text-muted);font-size:13px}.ef-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ef-card{min-width:0;border:1px solid #c7d2dc;background:#fff;padding:14px;break-inside:avoid}.ef-card h4{margin:0 0 9px;color:#173b5e}.ef-equations{display:grid;gap:9px;background:#f5f8fa;border-left:3px solid #2563eb;padding:12px 14px;font-family:'Cambria Math','Times New Roman',serif;font-size:17px;line-height:1.85;overflow-wrap:anywhere}.ef-symbols{margin:10px 0 0;padding-left:19px;color:#34485b;font-size:12px;line-height:1.6}.ef-note{margin:9px 0 0;padding:8px 10px;background:#fff8e6;color:#694c14;font-size:12px}.ef-diagram,.ef-diagram-grid{margin-top:13px}.ef-diagram{border:1px solid #c7d2dc;background:#fff;padding:14px}.ef-diagram h4{margin:0 0 8px}.ef-diagram svg{display:block;width:100%;max-height:360px}.ef-diagram p{font-size:12px;line-height:1.6;color:#42576a}.ef-source{margin-top:7px!important;color:#5b6f82!important}.ef-source a{color:#1d4ed8}.ef-diagram-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ef-empty{padding:30px;text-align:center;color:var(--text-muted)}@media(max-width:900px){.ef-toolbar{align-items:stretch;flex-direction:column}.ef-search{min-width:0;width:100%}.ef-grid,.ef-diagram-grid{grid-template-columns:1fr}}`;
  }

  function renderContent(host) {
    const content = host.querySelector('#ef-content');
    content.innerHTML = PAGES[activePage].render();
    host.querySelectorAll('.ef-tab').forEach((button) => button.classList.toggle('active', button.dataset.page === activePage));
    filterCards(host);
  }

  function filterCards(host) {
    const query = (host.querySelector('#ef-search')?.value || '').trim().toLowerCase();
    host.querySelectorAll('.ef-card').forEach((card) => { card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query); });
    host.querySelectorAll('.ef-section').forEach((item) => {
      const cards = Array.from(item.querySelectorAll('.ef-card'));
      const diagrams = item.querySelector('.ef-diagram,.ef-diagram-grid');
      item.hidden = Boolean(query) && cards.length > 0 && cards.every((card) => card.hidden) && !item.textContent.toLowerCase().includes(query);
      if (!cards.length && diagrams) item.hidden = Boolean(query) && !item.textContent.toLowerCase().includes(query);
    });
  }

  T.register({
    id: 'engineering-formulas',
    resetDraft(host) { activePage = 'math'; renderContent(host); },
    refreshDraft: filterCards,
    title: '常见工程计算公式',
    icon: 'Σ',
    group: '工程参考',
    desc: '按数学、力学、电学、热学分类查询常用公式、符号含义与工程单位。',
    render(host) {
      host.innerHTML = `<style>${moduleStyle()}</style><section class="panel ef-intro"><h3>工程公式速查</h3><p>公式用于方案计算和交叉检查；材料参数、适用边界、标准系数及安全裕量仍应以项目标准和试验数据为准。</p></section><section class="panel ef-toolbar"><div class="ef-tabs">${Object.entries(PAGES).map(([key, page]) => `<button type="button" class="ef-tab" data-page="${key}">${page.label}</button>`).join('')}</div><input id="ef-search" class="ef-search" type="search" placeholder="在当前子页面搜索公式或符号"></section><div id="ef-content"></div>`;
      host.querySelectorAll('.ef-tab').forEach((button) => button.addEventListener('click', () => { activePage = button.dataset.page; host.querySelector('#ef-search').value = ''; renderContent(host); }));
      host.querySelector('#ef-search').addEventListener('input', () => filterCards(host));
      renderContent(host);
    },
  });
})();
