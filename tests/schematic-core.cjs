const assert = require('node:assert/strict');
const model = require('../js/schematic/model.js');
const geometry = require('../js/schematic/geometry.js');
const routing = require('../js/schematic/routing.js');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function context() {
  let sequence = 0;
  return { id: prefix => `${prefix}_${++sequence}`, clock: () => new Date('2026-09-18T12:00:00Z') };
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Catch lost historical defaults, user text, and accidental input mutation.
const historical = freeze({ meta: { title: 'Legacy Ω', notes: '<b>user text</b>' }, components: [{ id: 'old', name: '保留 <b> user text', customText: 'unknown' }] });
const normalized = model.normalize(historical, context());
assert.equal(normalized.schemaVersion, 11);
assert.equal(normalized.meta.title, 'Legacy Ω');
assert.equal(normalized.meta.notes, '<b>user text</b>');
assert.equal(normalized.meta.date, '2026-09-18');
assert.equal(normalized.meta.sheetSize, 'A3');
assert.equal(normalized.meta.gridSize, 10);
assert.deepEqual(normalized.components[0], { id: 'old', name: '保留 <b> user text', customText: 'unknown', symbolType: undefined, value: '', rotation: 0, color: '', connectors: [], devices: [] });
assert.deepEqual(normalized.connections, []);
assert.deepEqual(normalized.revisions, []);
const defaults = model.normalize({ components: [{}], connections: [{ from: 'pin:old', to: 'pin:new', type: 'hv-drive' }] }, context());
assert.equal(defaults.components[0].id, 'cmp_1');
assert.equal(defaults.connections[0].type, 'hv');
assert.equal(defaults.connections[0].targets[0].to, 'pin:new');
assert.deepEqual(defaults.connections[0].targets[0].waypoints, []);
assert.equal(model.createDemo(context()).meta.date, '2026-09-18');
assert.equal(model.rotationValue(-90), 270);
// New drawing settings must normalize without changing legacy JSON shape.
const enriched = model.normalize({
  meta: { legendNote: '<tag>\nsecond', componentNameFontSize: 99, pinNameFontSize: 2, titleBlockX: 300, revisionBlockW: 500 },
  components: [], connections: [{ id: 'can-1', type: 'can', colorOrderSwapped: true, targets: [] }]
}, context());
assert.equal(enriched.meta.legendNote, '<tag> second');
assert.equal(enriched.meta.componentNameFontSize, 32);
assert.equal(enriched.meta.pinNameFontSize, 6);
assert.equal(enriched.meta.titleBlockX, 300);
assert.equal(enriched.meta.revisionBlockW, 500);
assert.equal(enriched.connections[0].colorOrderSwapped, true);
const labelSettings = model.normalize({ components: [], connections: [
  { id: 'legacy-label', type: 'lv', gauge: '0.75 mm²', targets: [] },
  { id: 'end-label', type: 'lv', gaugeLabelPosition: 'end', targets: [] },
  { id: 'invalid-label', type: 'lv', gaugeLabelPosition: 'elsewhere', targets: [] },
] }, context());
assert.equal(Object.hasOwn(labelSettings.connections[0], 'gaugeLabelPosition'), false, 'legacy wire keeps its default shape');
assert.equal(labelSettings.connections[1].gaugeLabelPosition, 'end');
assert.equal(Object.hasOwn(labelSettings.connections[2], 'gaugeLabelPosition'), false, 'unknown label position falls back to start');
assert.equal(Object.hasOwn(model.normalize({ components: [] }, context()).meta, 'legendNote'), false);
const legacyFrames = model.createDemo(context());
assert.deepEqual(geometry.drawingFrame(legacyFrames, 'title'), { x: 1040, y: 818, w: 342, h: 64 });
assert.deepEqual(geometry.drawingFrame(legacyFrames, 'revision'), { x: 1040, y: 24, w: 342, h: 54 });
const customFrames = model.normalize({ meta: { titleBlockX: 1390, titleBlockY: 880, titleBlockW: 100, titleBlockH: 20 }, components: [], revisions: Array.from({ length: 4 }, () => ({ version: 'V1' })) }, context());
const boundedTitle = geometry.drawingFrame(customFrames, 'title');
assert.ok(boundedTitle.w >= 280 && boundedTitle.h >= 64);
assert.ok(boundedTitle.x + boundedTitle.w <= 1388 && boundedTitle.y + boundedTitle.h <= 888);
assert.ok(geometry.drawingFrame(customFrames, 'revision').h >= 90);

// Catch coordinate/side rotation, pin spacing and grid regressions.
for (const [angle, expected] of [[0, { x: 20, y: 10, side: 'right' }], [90, { x: 10, y: 20, side: 'bottom' }], [180, { x: 0, y: 10, side: 'left' }], [270, { x: 10, y: 0, side: 'top' }]]) {
  assert.deepEqual(geometry.rotatePoint({ x: 20, y: 10, side: 'right' }, 10, 10, angle), expected);
}
const state = freeze({ meta: { snapToGrid: true, gridSize: 10, sheetSize: 'A3' }, components: [{ id: 'part', type: 'component', x: 100, y: 100, w: 200, h: 100, devices: [], connectors: ['left', 'right', 'top', 'bottom'].map(side => ({ id: side, side, pins: [{ id: side }] })) }], connections: [] });
assert.deepEqual(geometry.endpointPositions(state), { 'pin:left': { x: 100, y: 170, side: 'left' }, 'pin:right': { x: 300, y: 170, side: 'right' }, 'pin:top': { x: 200, y: 100, side: 'top' }, 'pin:bottom': { x: 200, y: 200, side: 'bottom' } });
assert.deepEqual(geometry.componentMinimumSize(state.components[0]), { w: 50, h: 40 });
assert.equal(geometry.snapCoordinate(state, 26), 30);
assert.equal(geometry.snapCoordinate(state, 26, true), 26);
const small = freeze({ ...state, components: [{ ...state.components[0], x: 2700, w: 20, h: 20 }] });
const sized = geometry.sizeProject(small);
assert.equal(small.components[0].w, 20);
assert.equal(sized.components[0].w, 50);
assert.equal(sized.components[0].h, 40);
assert.equal(sized.meta.sheetSize, 'A1');
const oldPositions = geometry.capturePinPositions(state, state.components[0]);
const expanded = model.clone(state.components[0]);
expanded.connectors[0].pins.push({ id: 'new', no: '2' });
const stabilized = geometry.stabilizePinsAfterChange(state, freeze(expanded), oldPositions, [expanded.connectors[0].pins[1]]);
assert.equal(geometry.connectorPosition(state, stabilized, stabilized.connectors[0], stabilized.connectors[0].pins[0]).y, 170);
assert.ok(Math.abs(geometry.connectorPosition(state, stabilized, stabilized.connectors[0], stabilized.connectors[0].pins[1]).y - 170) >= 30);

// Literal routes characterized against the original calculator, including a
// reversed/obstructed endpoint case. This router does not avoid component boxes.
const horizontal = [{ x: 100, y: 100, side: 'right' }, { x: 300, y: 100, side: 'left' }];
for (const [a, b, expected] of [
  [...horizontal, [{ x: 100, y: 100 }, { x: 300, y: 100 }]],
  [{ x: 100, y: 100, side: 'bottom' }, { x: 100, y: 300, side: 'top' }, [{ x: 100, y: 100 }, { x: 100, y: 300 }]],
  [{ x: 300, y: 100, side: 'right' }, { x: 100, y: 300, side: 'left' }, [{ x: 300, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 300 }, { x: 100, y: 300 }]],
]) assert.deepEqual(routing.routeBranch(state, a, b, 0, 1, 0), expected);
const waypoints = freeze([{ x: 180, y: 160, junctionId: 'node' }, { x: 220, y: 160 }]);
const manual = routing.routeBranch(state, ...horizontal, 0, 1, 0, 0, waypoints);
assert.ok(manual.some(p => p.x === 180 && p.y === 160 && p.junctionId === 'node'));
assert.ok(manual.every((p, i) => !i || p.x === manual[i - 1].x || p.y === manual[i - 1].y));

// Interior crossings bridge; a junction explicitly splits segments and connects.
const crossing = [{ id: 'h', index: 0, route: [{ x: 0, y: 50 }, { x: 100, y: 50 }] }, { id: 'v', index: 1, route: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }];
assert.deepEqual(routing.findCrossings(crossing).get('v').get(0), [{ x: 50, y: 50 }]);
crossing[0].route.splice(1, 0, { x: 50, y: 50, junctionId: 'node' });
assert.equal(routing.findCrossings(crossing).get('v').size, 0);
assert.equal(routing.findCrossings(crossing).get('h').size, 0);

// All three classic scripts must load without DOM, storage, timers or a clock.
const sandbox = {};
for (const name of ['document', 'host', 'localStorage', 'Date']) Object.defineProperty(sandbox, name, { get() { throw new Error(`Unexpected ambient ${name}`); } });
vm.createContext(sandbox);
for (const name of ['model', 'geometry', 'routing']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/schematic', `${name}.js`), 'utf8'), sandbox);
assert.equal(sandbox.ElectricalSchematic.model.rotationValue(450), 90);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.ElectricalSchematic.geometry.endpointPositions(state))), geometry.endpointPositions(state));
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.ElectricalSchematic.routing.routeBranch(state, ...horizontal, 0, 1, 0))), [{ x: 100, y: 100 }, { x: 300, y: 100 }]);

// Preserve paired-junction topology and make edits without mutating a frozen input.
const drawing = freeze(model.normalize(model.createDemo(context()), context()));
const branches = routing.buildBranches(drawing, geometry.endpointPositions(drawing));
assert.equal(branches.length, 6);
assert.equal(branches.filter(branch => branch.label).length, 6);
const paired = branches.find(branch => branch.wire.id === 'w4');
assert.ok(paired.pairRoute.length >= 2);
const point = routing.branchMidpoint(drawing, paired);
const split = routing.splitBranchAt(drawing, paired, point, context());
assert.equal(drawing.components.length, 4);
assert.equal(split.state.components.length, 5);
const child = split.state.connections.find(wire => wire.parentWireId === 'w4');
assert.equal(child.parentTargetId, 't4');
assert.equal(child.parentJunctionId, split.junctionId);
const placementParent = model.clone(drawing);
placementParent.connections.find(wire => wire.id === 'w4').gaugeLabelPosition = 'end';
const placementBranch = routing.buildBranches(placementParent, geometry.endpointPositions(placementParent)).find(item => item.wire.id === 'w4');
const placementSplit = routing.splitBranchAt(placementParent, placementBranch, routing.branchMidpoint(placementParent, placementBranch), context());
assert.equal(placementSplit.state.connections.find(wire => wire.parentWireId === 'w4').gaugeLabelPosition, 'end', 'junction child retains its parent gauge placement');
assert.equal(child.targets[0].to, '');
assert.equal(child.targets[0].pairTo, '');
assert.ok(child.pairFrom);
const originalTarget = split.state.connections.find(wire => wire.id === 'w4').targets[0];
assert.equal(originalTarget.to, 'pin:p_lv_canh');
assert.ok(originalTarget.waypoints.some(p => p.junctionId === split.junctionId));
const junction = split.state.components.find(c => c.id === split.junctionId);
junction.x += 30;
const synchronized = routing.syncJunctionWaypoints(freeze(split.state));
const update = synchronized.find(item => item.wireId === 'w4');
assert.equal(update.waypoints.find(p => p.junctionId === split.junctionId).x, junction.x);
assert.notEqual(originalTarget.waypoints.find(p => p.junctionId === split.junctionId).x, junction.x);
const unbound = model.clone(split.state);
unbound.connections.find(w => w.id === 'w4').targets[0].waypoints = [];
assert.ok(routing.ensureJunctionBindings(freeze(unbound)).find(item => item.wireId === 'w4').waypoints.some(p => p.junctionId === split.junctionId));
const snapshots = routing.prepareAttachedRoutes(drawing, drawing.components[1]);
assert.ok(snapshots.length > 0);
const moved = routing.moveAttachedRoutes(freeze(snapshots), 20, 30, drawing.components[1]);
assert.equal(moved[0].waypoints[0].x, snapshots[0].points[0].x + 20);
assert.equal(moved[0].waypoints[0].y, snapshots[0].points[0].y + 30);
assert.equal(routing.labelPlacement(drawing, freeze(branches)).filter(branch => branch.label).length, 6);
assert.equal(routing.wireText({ net: 'SIG', gauge: '', function: 'Sense' }), 'SIG · Sense', 'an omitted gauge must not render a missing-gauge warning');

const branchFor = (wire, id, endpoint) => ({ id: `${wire.id}:${id}`, wire, route: [{ x: 100, y: 300 }, { x: endpoint, y: 300 }] });
const labelState = { meta: { sheetSize: 'A3' }, components: [], connections: [] };
const legacyWire = { id: 'wire-label', net: 'SIG', gauge: '0.75 mm²', function: 'Sense' };
const legacyLabel = routing.labelPlacement(labelState, [branchFor(legacyWire, 'one', 500)])[0];
assert.equal(legacyLabel.label.text, 'SIG · 0.75 mm² · Sense', 'legacy start label remains unchanged');
assert.equal(legacyLabel.endGaugeLabel, undefined);
const endWire = { ...legacyWire, gaugeLabelPosition: 'end' };
const endBranches = routing.labelPlacement(labelState, [branchFor(endWire, 'one', 500), branchFor(endWire, 'two', 750)]);
assert.equal(endBranches[0].label.text, 'SIG · Sense', 'moving gauge keeps net and function at the source');
assert.equal(endBranches[1].label, undefined, 'multi-target wire keeps just one source label');
assert.deepEqual(endBranches.map(branch => branch.endGaugeLabel?.text), ['0.75 mm²', '0.75 mm²'], 'each target receives its own gauge');
assert.ok(endBranches[0].endGaugeLabel.x > endBranches[0].label.x + 100, 'end label is closer to the target than the source');
const verticalEnd = routing.labelPlacement(labelState, [{ id: 'vertical', wire: endWire, route: [{ x: 500, y: 100 }, { x: 500, y: 600 }] }])[0];
assert.ok(verticalEnd.endGaugeLabel.y > 500, 'vertical end label remains near a downward destination');
const bothWire = { ...legacyWire, gaugeLabelPosition: 'both' };
const bothLabels = routing.labelPlacement(labelState, [branchFor(bothWire, 'one', 500), branchFor(bothWire, 'two', 750)]);
assert.equal(bothLabels[0].label.text, 'SIG · 0.75 mm² · Sense');
assert.equal(bothLabels.filter(branch => branch.endGaugeLabel).length, 2);
const emptyGaugeLabels = routing.labelPlacement(labelState, [branchFor({ ...endWire, gauge: '' }, 'one', 500)]);
assert.equal(emptyGaugeLabels[0].endGaugeLabel, undefined, 'empty gauge has no end marker');

const emptyPart = { type: 'component', connectors: [], devices: [] };
assert.deepEqual(geometry.componentMinimumSize(emptyPart, 10), { w: 50, h: 20 });
assert.deepEqual(geometry.componentMinimumSize(emptyPart, 5), { w: 25, h: 10 });
assert.deepEqual(geometry.componentMinimumSize(emptyPart, 20), { w: 100, h: 40 });
const pinnedPart = { ...emptyPart, x: 100, y: 100, w: 50, h: 40, connectors: [{ side: 'left', placed: true, pins: [{ id: 'compact-pin' }] }] };
const pinnedMinimum = geometry.componentMinimumSize(pinnedPart, 10);
assert.ok(pinnedMinimum.h >= 40, 'placed pins reserve enough vertical space');
const pinAt = geometry.connectorPosition({ meta: { gridSize: 10, snapToGrid: true } }, pinnedPart, pinnedPart.connectors[0], pinnedPart.connectors[0].pins[0]);
assert.ok(pinAt.y >= pinnedPart.y + 10 && pinAt.y <= pinnedPart.y + pinnedPart.h - 10, 'pin stays within a compact component edge');

console.log('PASS schematic pure model, geometry and routing characterization');
