/* Offline reference samples, not design allowables. Values retain their test basis.
 * Reviewed 2026-10-26. Manufacturer-authored archived sheets are identified explicitly.
 * This catalogue never changes user overrides or fills unreported properties by inference.
 */
(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else window.MaterialReferences = factory();
})(function () {
  'use strict';
  const v = (value, method, quantity, condition = '23 °C', bound = '') => ({ value, method, quantity, condition, bound });
  const records = [
    { id: 'basf-g4fc', materials: ['PBT+GF20'], maker: 'BASF', grade: 'Ultradur B 4300 G4 FC',
      url: 'https://download.basf.com/p1/8a8082587fd4b608017fd6588cc357e0/en/ULTRADUR%25C2%25AE_B4300_G4_FC_AQUA_BLACK_15136',
      values: { E: v(7000, 'ISO 527-1/-2', 'tensile-modulus'), Rm: v(118, 'ISO 527-1/-2', 'break-stress'), elong: v(3.5, 'ISO 527-1/-2', 'break-strain'), dens: v(1.45, 'ISO 1183', 'density'), melt: v(223, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), lambda: v(0.25, 'DIN 52612-1', 'thermal-conductivity'), Cp: v(1150, 'not stated', 'specific-heat') } },
    { id: 'basf-g4hs', materials: ['PBT+GF20'], maker: 'BASF', grade: 'Ultradur B 4300 G4 High Speed',
      url: 'https://download.basf.com/p1/8a8081c57fd4b609017fd6507a972288/en/ULTRADUR%3Csup%3E%C2%AE%3Csup%3E_B4300_G4_HIGH_SPEED_Product_Data_Sheet_Asia_PacificEurope_English.pdf',
      values: { E: v(7000, 'ISO 527-1/-2', 'tensile-modulus'), Rm: v(115, 'ISO 527-1/-2', 'break-stress'), elong: v(3.3, 'ISO 527-1/-2', 'break-strain'), dens: v(1.45, 'ISO 1183', 'density'), melt: v(223, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), rho_v: v(1e14, 'IEC 62631-3-1', 'volume-resistivity'), Ed: v(37, 'IEC 60243-1', 'electric-strength', '23 °C; K20/K20; 1 mm') } },
    { id: 'mocom-abs20', materials: ['PBT+ABS+GF20'], maker: 'MOCOM', grade: 'ALTECH PBT+ABS A 2020/620 GF 20 UV', archived: true,
      url: 'https://hongrunplastics.com/public/uploads/images/20250721/MOCOM%20PBT+ABS%20ALTECH%20PBT+ABS%20A%202020_620%20GF%2020%20UV%20zh.pdf',
      values: { E: v(6200, 'ISO 527', 'tensile-modulus', 'conditioning / temperature not stated'), Rm: v(75, 'ISO 527', 'break-stress', 'conditioning / temperature not stated'), elong: v(2, 'ISO 527', 'break-strain', 'conditioning / temperature not stated'), dens: v(1.33, 'ISO 1183', 'density', 'temperature not stated'), melt: v(226, 'ISO 11357', 'melting-temperature', 'DSC') } },
    { id: 'lg-abs20', materials: ['PBT+ABS+GF20'], maker: 'LG Chem', grade: 'LUMAX GP5200B (2014-07-01)', archived: true,
      url: 'https://plastore.it/cgi2018/file818/1568_pbt-abs%20lumax%20gp5200b.pdf',
      values: { Rm: v(93.163175, 'ASTM D638', 'break-stress', '23 °C; 50% RH / 48 h; 3.2 mm; 5 mm/min; 950 kgf/cm² × 0.0980665'), elong: v(2.5, 'ASTM D638', 'break-strain', '23 °C; 50% RH / 48 h; 3.2 mm; 5 mm/min'), dens: v(1.35, 'ASTM D792', 'density', '23 °C; 50% RH / 48 h'), melt: v(223, 'ASTM D3418', 'melting-temperature', 'DSC') } },
    { id: 'basf-g6', materials: ['PBT+GF30'], maker: 'BASF', grade: 'Ultradur B 4300 G6',
      url: 'https://download.basf.com/p1/8a8082587fd4b608017fd63bf4f35b9c/en/ULTRADUR%25C2%25AE_B4300_G6',
      values: { E: v(9800, 'ISO 527-1/-2', 'tensile-modulus'), Rm: v(140, 'ISO 527-1/-2', 'break-stress'), elong: v(3, 'ISO 527-1/-2', 'break-strain'), dens: v(1.53, 'ISO 1183', 'density'), melt: v(223, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), lambda: v(0.27, 'DIN 52612-1', 'thermal-conductivity'), Cp: v(1050, 'not stated', 'specific-heat') } },
    { id: 'basf-b4520', materials: ['PBT'], maker: 'BASF', grade: 'Ultradur B 4520',
      url: 'https://download.basf.com/p1/8a8081c57fd4b609017fd62e21255407/en/ULTRADUR%3Csup%3E%C2%AE%3Csup%3E_B4520_Product_Data_Sheet_Asia_PacificEurope_English.pdf',
      values: { E: v(2400, 'ISO 527-1/-2', 'tensile-modulus'), dens: v(1.3, 'ISO 1183', 'density'), melt: v(223, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), elong: v(50, 'ISO 527-1/-2', 'nominal-break-strain', '23 °C; 50 mm/min', '>') } },
    { id: 'basf-a3k', materials: ['PA66'], maker: 'BASF', grade: 'Ultramid A3K',
      url: 'https://download.basf.com/p1/8a8082587fd4b608017fd64108ab6d3b/en/ULTRAMID%C2%AE_A3K',
      values: { E: v(3000, 'ISO 527-1/-2', 'tensile-modulus', '23 °C; dry'), dens: v(1.13, 'ISO 1183', 'density'), melt: v(260, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), elong: v(30, 'ISO 527-1/-2', 'nominal-break-strain', '23 °C; dry; 50 mm/min') } },
    { id: 'basf-b3eg6', materials: ['PA6+GF30'], maker: 'BASF', grade: 'Ultramid B3EG6',
      url: 'https://download.basf.com/p1/8a8081c57fd4b609017fd640cfa907fa/en/ULTRAMID%25C2%25AE_B3EG6',
      values: { E: v(9500, 'ISO 527-1/-2', 'tensile-modulus', '23 °C; dry'), Rm: v(185, 'ISO 527-1/-2', 'break-stress', '23 °C; dry'), elong: v(3.5, 'ISO 527-1/-2', 'break-strain', '23 °C; dry'), dens: v(1.36, 'ISO 1183', 'density'), melt: v(220, 'ISO 11357-1/-3', 'melting-temperature', 'DSC') } },
    { id: 'basf-b3eg6-cond', materials: ['PA6+GF30'], maker: 'BASF', grade: 'Ultramid B3EG6 (cond.)',
      url: 'https://download.basf.com/p1/8a8081c57fd4b609017fd640cfa907fa/en/ULTRAMID%25C2%25AE_B3EG6',
      values: { E: v(6200, 'ISO 527-1/-2', 'tensile-modulus', '23 °C; conditioned'), Rm: v(115, 'ISO 527-1/-2', 'break-stress', '23 °C; conditioned'), elong: v(8, 'ISO 527-1/-2', 'break-strain', '23 °C; conditioned') } },
    { id: 'basf-a3eg6', materials: ['PA66+GF30'], maker: 'BASF', grade: 'Ultramid A3EG6',
      url: 'https://download.basf.com/p1/8a8082587fd4b608017fd6587a9757d9/en/ULTRAMID%3Csup%3E%C2%AE%3Csup%3E_A3EG6_Product_Data_Sheet_Asia_PacificEurope_English.pdf',
      values: { E: v(10000, 'ISO 527-1/-2', 'tensile-modulus', '23 °C; dry'), Rm: v(190, 'ISO 527-1/-2', 'break-stress', '23 °C; dry'), elong: v(3, 'ISO 527-1/-2', 'break-strain', '23 °C; dry'), dens: v(1.36, 'ISO 1183', 'density'), melt: v(260, 'ISO 11357-1/-3', 'melting-temperature', 'DSC') } },
    { id: 'covestro-2405', materials: ['PC'], maker: 'Covestro', grade: 'Makrolon 2405',
      url: 'https://solutions.covestro.com/en/products/makrolon/makrolon-2405_000000000000945088',
      values: { E: v(2400, 'ISO 527-1,-2', 'tensile-modulus', '23 °C; 50% RH; 1 mm/min'), Rm: v(65, 'ISO 527-1,-2', 'break-stress', '23 °C; 50% RH; 50 mm/min'), elong: v(125, 'ISO 527-1,-2', 'break-strain', '23 °C; 50% RH; 50 mm/min'), dens: v(1.2, 'ISO 1183-1', 'density'), lambda: v(0.2, 'ISO 8302', 'thermal-conductivity', '23 °C; 50% RH; through-plane'), rho_v: v(1e14, 'IEC 62631-3-1', 'volume-resistivity', '23 °C; 50% RH'), Ed: v(34, 'IEC 60243-1', 'electric-strength', '23 °C; 50% RH; 1 mm') } },
    { id: 'outokumpu-304', materials: ['Fe-SUS304'], maker: 'Outokumpu', grade: 'Core 304/4301',
      url: 'https://www.outokumpu.com/en/products/product-ranges/-/media/files/products/core/outokumpu-core-range-datasheet.pdf',
      values: { E: v(200000, 'EN 10088-1 Table 7', 'tensile-modulus', '20 °C'), dens: v(7.9, 'EN 10088-1 Table 7', 'density', '20 °C'), lambda: v(15, 'EN 10088-1 Table 7', 'thermal-conductivity', '20 °C'), Cp: v(500, 'EN 10088-1 Table 7', 'specific-heat', '20 °C'), rho_e: v(7.3e-7, 'EN 10088-1 Table 7', 'electrical-resistivity', '20 °C; 0.73 Ω·mm²/m × 10⁻⁶') } },
    { id: 'hydro-6061', materials: ['Al-6061-T6'], maker: 'Hydro', grade: '6061-T6/T6511 extrusion',
      url: 'https://www.hydro.com/globalassets/01-products--services/extruded-profiles/americas/ena-resources/alloy-data-sheets/hydro_2019_data_sheet_6061.pdf',
      values: { Rm: v(260, 'Hydro extrusion limits', 'ultimate-stress', 'T6/T6511; extrusion', '≥'), elong: v(8, 'Hydro extrusion limits', 'break-strain', 'T6/T6511; wall ≤ 6.30 mm', '≥'), lambda: v(167, 'Hydro datasheet', 'thermal-conductivity', '25 °C'), IACS: v(43, 'Hydro datasheet', 'IACS', '20 °C') } },
    { id: 'basf-b3s', materials: ['PA6'], maker: 'BASF', grade: 'Ultramid B3S (dry)',
      url: 'https://download.basf.com/p1/8a8081c57fd4b609017fd636717a3e69/en/ULTRAMID%253Csup%253E%25C2%25AE%253Csup%253E_B3S_Product_Data_Sheet_Asia_PacificEurope_English.pdf%3Fview',
      values: { E: v(3500, 'ISO 527-1/-2', 'tensile-modulus', '23 °C; dry'), elong: v(10, 'ISO 527-1/-2', 'nominal-break-strain', '23 °C; dry; 50 mm/min'), dens: v(1.13, 'ISO 1183', 'density'), melt: v(220, 'ISO 11357-1/-3', 'melting-temperature', 'DSC'), lambda: v(0.33, 'DIN 52612-1', 'thermal-conductivity'), Cp: v(1700, 'not stated', 'specific-heat'), rho_v: v(1e13, 'IEC 62631-3-1', 'volume-resistivity', '23 °C; dry') } },
    { id: 'ineos-gp22', materials: ['ABS'], maker: 'INEOS Styrolution', grade: 'Terluran GP-22',
      url: 'https://www.ineos-styrolution.com/Product/Terluran_Terluran-GP-22_SKU300600120827_lang_de_DE.html',
      values: { E: v(2300, 'ISO 527', 'tensile-modulus'), elong: v(10, 'ISO 527', 'nominal-break-strain'), dens: v(1.04, 'ISO 1183', 'density'), lambda: v(0.17, 'ISO 22007-4', 'thermal-conductivity'), rho_v: v(1e13, 'IEC 62631-3-1', 'volume-resistivity', '23 °C', '>') } },
    { id: 'rohm-8n', materials: ['PMMA'], maker: 'Röhm', grade: 'PLEXIGLAS Edgelight 8N LD12',
      url: 'https://www.plexiglas-polymers.com/en/plexiglas-edgelight?file=files%2Fassets%2F04-molding_compounds%2Fplexiglas-polymers%2Fdownloads%2Fen%2Fproduct-information%2FPLEXIGLAS+Edgelight%2FPLEXIGLAS_Edgelight_8N_LD12_ISO_E.pdf',
      values: { E: v(3300, 'ISO 527', 'tensile-modulus', '23 °C; 1 mm/min'), Rm: v(77, 'ISO 527', 'break-stress', '23 °C; 5 mm/min'), elong: v(5.5, 'ISO 527', 'break-strain', '23 °C; 5 mm/min') } },
    { id: 'borealis-hj120ub', materials: ['PP'], maker: 'Borealis', grade: 'HJ120UB (2022-02-08)',
      url: 'https://www.borealisgroup.com/storage/Datasheets/hj120ub/HJ120UB-PDS-REG_EUROPE-EN-V3-PDS-EUR-43852-10059044.pdf',
      values: { Rm: v(35, 'ISO 527-2', 'tensile-strength', '23 °C; 50% RH / ≥96 h; 50 mm/min; yield/break not specified'), dens: v(0.905, 'ISO 1183', 'density') } },
    { id: 'chemours-7ax', materials: ['PTFE'], maker: 'Chemours', grade: 'Teflon PTFE 7A X',
      url: 'https://www.teflon.com/en/-/media/files/teflon/teflon-ptfe-resins-product-info.pdf',
      values: { Rm: v(48.3, 'manufacturer product guide', 'tensile-strength', 'granular moulding powder; specimen method in guide footnotes'), elong: v(375, 'manufacturer product guide', 'break-strain', 'granular moulding powder; specimen method in guide footnotes'), dens: v(2.16, 'manufacturer product guide', 'standard-specific-gravity', 'standard sintered specimen; not bulk density') } },
    { id: 'basf-tpu1185', materials: ['TPU'], maker: 'BASF', grade: 'Elastollan 1185 A 10HFFR000 (FR variant)',
      url: 'https://download.basf.com/p1/8a8081ec96f843480197313c427d046a/en/Elastollan%25C2%25AE_E_1185_A_10HFFR000',
      values: { Rm: v(23, 'DIN 53504-S2', 'tensile-strength', '23 ±2 °C; 50 ±6% RH; extruded plaques'), elong: v(580, 'DIN 53504-S2', 'break-strain', '23 ±2 °C; 50 ±6% RH; extruded plaques'), dens: v(1.42, 'DIN EN ISO 1183-1-A', 'density') } },
    { id: 'aurubis-cuetp', materials: ['T2紫铜'], maker: 'Aurubis', grade: 'Cu-ETP / CW004A (comparison, not a T2 certificate)',
      url: 'https://www.aurubis.de/aurubis-com/dam/jcr%3A46190e64-c82a-4f86-b990-a0870243bbe8/PNA%20211_Cu-ETP_C11000-E.N-%5BRP%5D.pdf',
      values: { E: v(127000, 'Aurubis EN_2024_06', 'tensile-modulus', 'Cu-ETP strip, comparison only'), dens: v(8.9, 'Aurubis EN_2024_06', 'density', 'Cu-ETP strip'), lambda: v(390, 'Aurubis EN_2024_06', 'thermal-conductivity', 'Cu-ETP strip'), Cp: v(394, 'Aurubis EN_2024_06', 'specific-heat', '20 °C; 0.394 kJ/kgK × 1000'), melt: v(1083, 'Aurubis EN_2024_06', 'melting-temperature', 'Cu-ETP strip'), cond: v(58, 'Aurubis EN_2024_06', 'conductivity', 'soft temper', '≥'), IACS: v(100, 'Aurubis EN_2024_06', 'IACS', 'soft temper', '≥') } },
    { id: 'vdm-ni200', materials: ['Ni6'], maker: 'VDM Metals', grade: 'Nickel 200 (comparison, not a Ni6 certificate)',
      url: 'https://www.vdm-metals.com/fileadmin/user_upload/Downloads/Data_Sheets/Data_Sheet_VDM_Nickel_200_201.pdf',
      values: { E: v(205000, 'VDM March 2022 Table 3a', 'tensile-modulus', '20 °C; Ni200 comparison'), Cp: v(456, 'VDM March 2022 Table 3a', 'specific-heat', '20 °C'), rho_e: v(9e-8, 'VDM March 2022 Table 3a', 'electrical-resistivity', '20 °C; 9 μΩ·cm × 10⁻⁸'), lambda: v(71, 'VDM March 2022 Table 3b', 'thermal-conductivity', '20 °C; Ni200') } },
  ];
  const defaults = {
    'PBT+GF20': { E: 'basf-g4fc', Rm: 'basf-g4fc', elong: 'basf-g4fc', dens: 'basf-g4fc', melt: 'basf-g4fc', lambda: 'basf-g4fc', Cp: 'basf-g4fc' },
    'PBT+ABS+GF20': { E: 'mocom-abs20', Rm: 'mocom-abs20', elong: 'mocom-abs20', dens: 'mocom-abs20', melt: 'mocom-abs20' },
    'PBT+GF30': { Rm: 'basf-g6', elong: 'basf-g6' },
  };
  const notes = {
    E: ['拉伸模量不等于弯曲模量；注明温度、调湿和纤维方向。', 'Tensile and flexural moduli are not interchangeable; check temperature, conditioning and fibre direction.'],
    nu: ['多数 TDS 不公开泊松比；玻纤复合材料不能当作各向同性常数。', 'Poisson ratio is often unreported; fibre composites are anisotropic.'],
    dens: ['已换算为 g/cm³；不把堆积密度作为材料密度。', 'Converted to g/cm³; bulk pellet density is not material density.'],
    G: ['不得将弯曲模量当作剪切模量；由 E、ν 推算仅适用于各向同性近似。', 'Do not substitute flexural modulus; E/2(1+nu) applies only to an isotropic approximation.'],
    Rp02: ['Rp0.2 与塑料拉伸屈服应力不是同一试验定义；无屈服点时不填造。', '0.2% proof stress differs from polymer yield stress; do not invent a yield point.'],
    Rm: ['抗拉峰值、断裂应力和屈服应力分别列明，不互相冒充。', 'Ultimate, break and yield stresses are distinct quantities.'],
    shear: ['需确认剪切试验方法；不能用抗拉强度的固定比例代替实测。', 'Verify the shear test; a fixed fraction of tensile strength is not measured shear strength.'],
    elong: ['区分断裂应变与标称断裂应变；保留 >、≥ 及试样条件。', 'Distinguish break strain from nominal break strain; retain bounds and specimen conditions.'],
    lambda: ['注明温度与方向；导热填料配方不能套用普通树脂值。', 'Check temperature/direction; thermally filled compounds need their own data.'],
    Cp: ['统一 J/(kg·K)；J/(g·K) 数值应乘 1000。', 'Use J/(kg·K); multiply J/(g·K) by 1000.'],
    melt: ['熔融、Tg、Vicat、HDT 和分解温度不同；本栏不是长期许用温度。', 'Melting, Tg, Vicat, HDT and decomposition are distinct; not a service-temperature limit.'],
    rho_e: ['统一 Ω·m；金属温度系数和电阻率参考温度需一致。', 'Use ohm-m; match reference temperature and temperature coefficient.'],
    rho_v: ['统一 Ω·m；Ω·cm 数值乘 0.01，不能与表面电阻混用。', 'Use ohm-m; multiply ohm-cm by 0.01; surface resistance is different.'],
    cond: ['统一 MS/m；仅在同温度、同方向下与 ρ 互为倒数。', 'Use MS/m; reciprocal resistivity requires the same temperature and direction.'],
    IACS: ['百分数以 20 °C 标准退火铜为基准，不代表铜含量。', 'Percent relative to standard annealed copper at 20 C, not copper content.'],
    Ed: ['介电强度依赖厚度、电极和升压方式，不是允许工作场强。', 'Dielectric strength depends on thickness/electrodes/ramp; not an allowable operating field.'],
  };
  const quantities = {
    'tensile-modulus': ['拉伸模量', 'Tensile modulus'], 'break-stress': ['断裂应力', 'Stress at break'], 'tensile-strength': ['拉伸强度（原表口径）', 'Tensile strength (sheet definition)'],
    'ultimate-stress': ['抗拉强度', 'Ultimate tensile strength'], 'break-strain': ['断裂应变', 'Strain at break'],
    'nominal-break-strain': ['标称断裂应变', 'Nominal strain at break'], 'density': ['材料密度', 'Density'],
    'melting-temperature': ['熔融温度', 'Melting temperature'], 'thermal-conductivity': ['导热系数', 'Thermal conductivity'],
    'specific-heat': ['比热容', 'Specific heat'], 'volume-resistivity': ['体积电阻率', 'Volume resistivity'],
    'electric-strength': ['介电强度', 'Dielectric strength'], 'electrical-resistivity': ['电阻率', 'Electrical resistivity'], 'conductivity': ['电导率', 'Conductivity'], 'standard-specific-gravity': ['标准试样比重', 'Standard specific gravity'], IACS: ['IACS', 'IACS'],
  };
  function lookup(name, key) {
    const samples = records.filter(record => record.materials.includes(name) && record.values[key]).map(record => ({ ...record, ...record.values[key] }));
    const groups = [];
    for (const sample of samples) {
      const basis = [sample.method, sample.quantity, sample.condition, sample.bound].join('|');
      let group = groups.find(item => item.basis === basis);
      if (!group) { group = { basis, method: sample.method, quantity: sample.quantity, condition: sample.condition, bound: sample.bound, min: sample.value, max: sample.value, count: 0 }; groups.push(group); }
      group.min = Math.min(group.min, sample.value); group.max = Math.max(group.max, sample.value); group.count++;
    }
    return { samples, groups };
  }
  function defaultSource(name, key) { return records.find(record => record.id === defaults[name]?.[key]) || null; }
  function note(name, key, lang = 'zh') {
    const en = lang === 'en';
    const special = name === 'FPC' ? (en ? ' PI/Cu laminate: layup, copper thickness, direction and adhesive must be specified; substrate data are not laminate data.' : ' FPC 是 PI/Cu 层叠复合体，须明确层叠、铜厚、方向及胶层；不能套用纯 PI 的数据。')
      : name === '三聚氰胺泡棉' ? (en ? ' Foam tension and compression are different; the historical curve is a compression illustration.' : ' 泡棉拉伸与压缩不同；现有曲线仅为压缩示意，不据此推导拉伸强度/断裂延伸率。') : '';
    return (notes[key]?.[en ? 1 : 0] || '') + special;
  }
  return Object.freeze({ records, defaults, lookup, defaultSource, note, quantity: (id, lang = 'zh') => quantities[id]?.[lang === 'en' ? 1 : 0] || id, checkedAt: '2026-10-26' });
});
