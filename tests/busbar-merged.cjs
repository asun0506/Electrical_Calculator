const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let registered;
const context = {
  console,
  window: null,
  ElectricalToolkit: {
    register(calc) { registered = calc; },
  },
  ElUtil: {
    parseNum(value) {
      const text = String(value ?? '').replace(/,/g, '').trim();
      if (!text) return null;
      const number = Number(text);
      return Number.isFinite(number) ? number : null;
    },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'calc-busbar-temp.js'), 'utf8'), context);

assert.equal(registered.id, 'busbar-temp');
assert.match(registered.title, /RMS.*线径.*汇流排温升/);

const math = context.BusbarTempMath;
const points = math.parseData('time\tcurrent\n10\t0\n11\t10\n12\t10');
const metrics = math.currentMetrics(points);
assert.equal(metrics.duration, 2, 'uses actual map duration instead of assuming a zero start');
assert.ok(Math.abs(metrics.rms - Math.sqrt(75)) < 1e-12, 'RMS trapezoidal integration');
assert.equal(metrics.average, 7.5, 'average-current trapezoidal integration');
assert.equal(metrics.peak, 10);
assert.equal(math.wireRecommendation(9.9).label, '10 mm²');
assert.match(math.wireRecommendation(301).label, /> 300/);

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.doesNotMatch(index, /src="js\/calc-rms-current\.js/, 'legacy standalone RMS module is no longer loaded');
assert.match(index, /src="js\/calc-busbar-temp\.js\?v=4\.0"/);

console.log('PASS merged RMS / wire size / busbar temperature module');
