const assert = require('node:assert/strict');
const cases = require('./fixtures/formula-cases.json');

assert.equal(cases.schemaVersion, 1);
for (const id of ['relay-fuse', 'conductor', 'precharge', 'busbar-temp', 'iec60664', 'bolt', 'tolerance']) {
  const selected = cases.cases.filter((item) => item.module === id);
  for (const caseType of ['nominal', 'boundary', 'invalid']) {
    assert.ok(selected.some((item) => item.caseType === caseType), `${id}: ${caseType} case`);
  }
}

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ids = new Set();
for (const item of cases.cases) {
  assert.ok(item.id && !ids.has(item.id), `unique case ID: ${item.id}`);
  ids.add(item.id);
  assert.ok(item.inputs && typeof item.inputs === 'object', `${item.id}: inputs`);
  assert.ok(item.source && typeof item.source === 'string', `${item.id}: independent source`);
  assert.ok(['nominal', 'boundary', 'invalid'].includes(item.caseType), `${item.id}: case type`);
  if (item.caseType === 'invalid') {
    assert.ok(['error', 'warning'].includes(item.expected.validationCategory), `${item.id}: validation category`);
    assert.ok(item.expected.messageFragment, `${item.id}: visible validation message`);
    assert.deepEqual(item.absoluteTolerance, {}, `${item.id}: no numeric invalid expectation`);
  } else {
    assert.ok(Object.keys(item.expected).length, `${item.id}: expected values`);
    assert.deepEqual(Object.keys(item.absoluteTolerance).sort(), Object.keys(item.expected).sort(), `${item.id}: tolerance keys`);
    for (const [key, value] of Object.entries(item.expected)) {
      assert.ok(Number.isFinite(value), `${item.id}/${key}: expected finite number`);
      assert.ok(Number.isFinite(item.absoluteTolerance[key]) && item.absoluteTolerance[key] >= 0, `${item.id}/${key}: tolerance`);
    }
  }
}

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: finite result`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
}

// Independent checks never call application globals or load its calculation code.
// These cases catch unit conversion, wrong signs, wrong lookup rows, and lost validation.
function independentlyCalculate(item) {
  const i = item.inputs;
  switch (item.module) {
    case 'relay-fuse':
      return { shortCircuitCurrentA: i.voltageV * 1000 / i.directResistanceMohm };
    case 'conductor': {
      // Bundled material constants; use mm-based resistivity (Ohm mm2 / m).
      assert.equal(i.material, 'copper');
      const singleMohm = .0172 * (1 + .00393 * (i.temperatureC - 20)) * i.lengthMm / (i.widthMm * i.heightMm);
      return { resistanceMohm: singleMohm * (i.quantityRelation === 'parallel' ? 1 / i.quantity : i.quantity) };
    }
    case 'precharge': {
      const chargeLog = Math.log(100 / (100 - i.targetPercent));
      const resistanceOhm = i.timeMs * 1000 / (i.capacitanceUf * chargeLog);
      return { resistanceOhm, peakCurrentA: i.voltageV / resistanceOhm, storedEnergyJ: i.capacitanceUf * i.voltageV ** 2 / 2e6 };
    }
    case 'busbar-temp': {
      // Closed-form constant-current solution of the documented Euler model,
      // rather than copying the application's time-step loop.
      const currents = i.currentPoints.map((point) => point[1]);
      assert.ok(currents.every((current) => current === currents[0]), 'closed form requires constant current');
      const area = i.widthMm * i.thicknessMm / 1e6;
      const length = i.lengthMm / 1000;
      const resistance = i.resistivityOhmM * length / area;
      const heatCapacity = i.specificHeatJkgK * i.densityKgm3 * area * length;
      const conductance = i.heatTransferWm2K * 2 * (i.widthMm + i.thicknessMm) / 1000 * length;
      const steadyTemperatureC = i.ambientC + currents[0] ** 2 * resistance / conductance;
      const duration = i.currentPoints.at(-1)[0] - i.currentPoints[0][0];
      const finalTemperatureC = steadyTemperatureC + (i.initialC - steadyTemperatureC) * (1 - conductance * i.stepS / heatCapacity) ** Math.ceil(duration / i.stepS);
      return { rmsCurrentA: Math.abs(currents[0]), averageCurrentA: currents[0], resistanceMicroOhm: resistance * 1e6, finalTemperatureC, steadyTemperatureC };
    }
    case 'iec60664': {
      // Rows independently transcribed from the three bundled reference PNGs.
      // Deliberately restricted to the tested PD2/III column and voltage region.
      assert.equal(i.pollution, '2');
      assert.equal(i.material, 'IIIa');
      assert.ok(i.voltageV > 200 && i.voltageV <= 320 && i.altitudeM <= 4000);
      const impulseKV = Math.ceil((2 * i.voltageV + 1000) * 1.414) / 1000;
      assert.ok(impulseKV > 2 && impulseKV <= 2.5);
      const altitudeFactor = [[2000, 1], [3000, 1.14], [4000, 1.29]].find(([limit]) => i.altitudeM <= limit)[1];
      const creepageMm = [[250, 2.5], [320, 3.2]].find(([limit]) => i.voltageV <= limit)[1];
      return { impulseKV, clearanceMm: 1.5 * altitudeFactor, creepageMm, altitudeFactor };
    }
    case 'bolt': {
      assert.equal(i.size, 'M8');
      assert.equal(i.material, '10.9');
      assert.equal(i.kMode, 'dry');
      const maxTorqueNm = i.torque * (1 + i.torqueTolerance / 100);
      const preloadN = maxTorqueNm * 1000 / (.2 * 8);
      const force = preloadN + i.load / i.quantity * (1 + i.acceleration / 9.81) * i.conditionFactor * i.vibrationFactor;
      return { maxTorqueNm, preloadN, boltStressMpa: force / 36.6, contactStressMpa: 4 * force / (Math.PI * (i.outerDiameter ** 2 - i.innerDiameter ** 2)), allowableTorqueNm: .2 * .008 * .75 * 940 * 36.6 };
    }
    case 'tolerance':
      return {
        nominalMm: i.nominalsMm.reduce((sum, n, index) => sum + n * i.signs[index], 0),
        worstToleranceMm: i.tolerancesMm.reduce((sum, n) => sum + Math.abs(n), 0),
        rssToleranceMm: Math.hypot(...i.tolerancesMm),
      };
    default: throw new Error(`${item.module}/${item.id}: independent calculation missing`);
  }
}

for (const item of cases.cases.filter((item) => item.caseType !== 'invalid')) {
  const checked = independentlyCalculate(item);
  for (const [key, expected] of Object.entries(item.expected)) {
    close(checked[key], expected, 1e-8, `${item.module}/${item.id}/${key}: independent fixture check`);
  }
}

// All DOM selectors and module-specific UI interactions live here, never in JSON.
const adapters = {
  tolerance: {
    result: '#tc-result',
    outputs: { nominalMm: '闭环名义尺寸', worstToleranceMm: '极值法累积公差', rssToleranceMm: 'RSS 统计累积公差' },
    async fill(page, i) {
      const rows = page.locator('#tc-rows .chain-row');
      while (await rows.count() > i.nominalsMm.length) await rows.last().locator('.row-del').click();
      while (await rows.count() < i.nominalsMm.length) await page.locator('#tc-add').click();
      for (let index = 0; index < i.nominalsMm.length; index += 1) {
        await rows.nth(index).locator('.tc-nom').fill(String(i.nominalsMm[index]));
        await rows.nth(index).locator('.tc-tol').fill(String(i.tolerancesMm[index]));
        await rows.nth(index).locator('.tc-dir').selectOption(i.signs[index] === 1 ? '+' : '-');
      }
      await page.locator('#tc-tol-design').fill('');
      await page.locator('#tc-calc').click();
    },
  },
  bolt: {
    result: '.bt-result', cards: '.bt-results > div', label: 'span', value: 'b',
    outputs: { maxTorqueNm: '最大扭矩', preloadN: '单颗预紧力', boltStressMpa: '螺栓总应力', contactStressMpa: '界面承压应力', allowableTorqueNm: '75%屈服参考扭矩' },
    async fill(page, i) {
      // Current bolt suite calculates on input, without a calculation button.
      for (const [key, value] of Object.entries(i)) await setControl(page, `[data-joint-field="${key}"]`, value);
    },
  },
  iec60664: {
    result: '[data-level-panel="0"]',
    outputs: { impulseKV: '额定冲击耐受电压', clearanceMm: '最小电气间隙', creepageMm: '最小爬电距离', altitudeFactor: '海拔修正系数' },
    async fill(page, i) {
      const fields = { voltageV: 'voltage', altitudeM: 'altitude', pollution: 'pollution', material: 'material' };
      for (const [key, field] of Object.entries(fields)) {
        const selector = `[data-level="0"][data-level-field="${field}"]`;
        await setControl(page, selector, i[key]);
        // This module commits/re-renders on change; it has no calculation button.
        await page.locator(selector).dispatchEvent('change');
      }
    },
  },
  'busbar-temp': {
    result: '#bb-result',
    outputs: { rmsCurrentA: 'RMS 有效电流', averageCurrentA: /^平均电流$/, resistanceMicroOhm: '汇流排电阻 R', finalTemperatureC: '末段温度', steadyTemperatureC: '稳态参考（RMS）' },
    async fill(page, i) {
      await setControl(page, '#bb-mat', i.material);
      const controls = { resistivityOhmM: '#bb-rho', specificHeatJkgK: '#bb-c', densityKgm3: '#bb-dens', widthMm: '#bb-w', thicknessMm: '#bb-h', lengthMm: '#bb-len', heatTransferWm2K: '#bb-hc', ambientC: '#bb-tamb', initialC: '#bb-t0', stepS: '#bb-dt' };
      for (const [key, selector] of Object.entries(controls)) await setControl(page, selector, i[key]);
      await setControl(page, '#bb-ta', i.currentPoints.map((point) => point.join('\t')).join('\n'));
      await page.locator('#bb-calc').click();
    },
  },
  precharge: {
    result: '#pc-result',
    outputs: { resistanceOhm: '所需预充电阻', peakCurrentA: '峰值电流', storedEnergyJ: '单次吸收能量' },
    async fill(page, i) {
      const controls = { capacitanceUf: '#pc-cap', voltageV: '#pc-v', targetPercent: '#pc-f', timeMs: '#pc-t' };
      for (const [key, selector] of Object.entries(controls)) await setControl(page, selector, i[key]);
      await page.locator('#pc-calc').click();
    },
  },
  conductor: {
    result: '#cdResult',
    outputs: { resistanceMohm: '组合总电阻' },
    async fill(page, i) {
      await setControl(page, '#cdDisplayUnit', 'mohm');
      for (const [key, value] of Object.entries(i)) await setControl(page, `#cdRows [data-field="${key}"]`, value);
      await page.locator('#cdAllSeries').click();
    },
  },
  'relay-fuse': {
    result: '#rf-battery-result',
    outputs: { shortCircuitCurrentA: '最大外短电流' },
    async fill(page, i) {
      await setControl(page, '#rf-pack-mode', 'direct');
      await setControl(page, '#rf-direct-unit', 'mohm');
      await setControl(page, '#rf-pack-voltage', i.voltageV);
      await setControl(page, '#rf-direct-resistance', i.directResistanceMohm);
      await page.locator('#cc-gen').click();
    },
  },
};

async function setControl(page, selector, value) {
  const control = page.locator(selector);
  if (await control.evaluate((element) => element.tagName === 'SELECT')) await control.selectOption(String(value));
  else await control.fill(String(value));
}

async function readNumber(locator) {
  const content = (await locator.innerText()).replace(/[,，]/g, '').trim();
  // Units are ignored; preserve signs/exponents and the formatter's k/M/G prefix.
  const match = content.match(/^[±\s]*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)(?:\s+([kMG])(?=\s|$))?/i);
  assert.ok(match, `numeric result card: ${content}`);
  return Number(match[1]) * ({ k: 1e3, M: 1e6, G: 1e9 }[match[2]] || 1);
}

async function verifyCase(page, item) {
  const adapter = adapters[item.module];
  assert.ok(adapter, `${item.module}/${item.id}: adapter not implemented`);
  await adapter.fill(page, item.inputs);
  const result = page.locator(adapter.result);
  assert.ok(await result.isVisible(), `${item.id}: visible result`);
  if (item.caseType === 'invalid') {
    const categoryClass = { error: 'err', warning: 'warn' }[item.expected.validationCategory];
    const message = result.locator(`.status-banner.${categoryClass}`).filter({ hasText: item.expected.messageFragment });
    assert.equal(await message.count(), 1, `${item.id}: ${item.expected.validationCategory} / ${item.expected.messageFragment}`);
    assert.ok(await message.isVisible(), `${item.id}: visible validation`);
    assert.equal(await result.locator(adapter.cards || '.result-card').count(), 0, `${item.id}: no stale numeric results`);
    return;
  }
  for (const [key, expected] of Object.entries(item.expected)) {
    const card = result.locator(adapter.cards || '.result-card').filter({ has: page.locator(adapter.label || '.k', { hasText: adapter.outputs[key] }) });
    assert.equal(await card.count(), 1, `${item.id}/${key}: unique result card`);
    close(await readNumber(card.locator(adapter.value || '.v')), expected, item.absoluteTolerance[key], `${item.module}/${item.id}/${key}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--allow-file-access-from-files'] });
  try {
    const selected = process.argv[2] ? cases.cases.filter((item) => item.module === process.argv[2]) : cases.cases;
    assert.ok(selected.length, `unknown module: ${process.argv[2]}`);
    for (const item of selected) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await context.route(/^https?:\/\//, (route) => route.abort());
        await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
        await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
        await page.evaluate((id) => window.ElectricalToolkit.open(id), item.module);
        await verifyCase(page, item);
        assert.deepEqual(errors, [], `${item.id}: no page errors`);
        console.log(`PASS ${item.module}/${item.id} (${item.caseType})`);
      } catch (error) {
        throw new Error(`${item.module}/${item.id}: ${error.message}`, { cause: error });
      } finally { await context.close(); }
    }
    console.log(`PASS formula regression: ${selected.length} independently checked cases under file://`);
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
