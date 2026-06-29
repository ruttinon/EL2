import assert from 'node:assert/strict';
import {
  getWidgetByObjectType,
  getWidgetDefinition,
  listRegistryWidgets,
  listPaletteWidgets,
  registryPaletteCategories,
  registryToolKey,
} from './registry.js';
import { inferDeviceStatusTag, inferDeviceNumericTag, inferDeviceCommandTag, inferDeviceFlowTag } from './deviceBinding.js';

const widgets = listRegistryWidgets();
assert.equal(widgets.length, 45, 'expected 45 registry widgets');

const palette = listPaletteWidgets();
assert.equal(palette.length, 37, 'expected 37 palette-visible widgets');
assert.ok(!palette.some((w) => w.id === 'viewport3d'));
assert.ok(!palette.some((w) => w.id === 'wall'));
assert.ok(palette.some((w) => w.id === 'panel'));
assert.ok(palette.some((w) => w.id === 'value'));

assert.ok(getWidgetDefinition('panel'));
assert.ok(getWidgetDefinition('viewport3d'));
assert.ok(getWidgetDefinition('iframe'));
assert.equal(getWidgetByObjectType('group')?.inspector.dedicatedInspector, 'group');
assert.equal(getWidgetByObjectType('sprite')?.category, 'effects');

assert.ok(getWidgetDefinition('trend'));
assert.ok(getWidgetDefinition('echart'));
assert.ok(getWidgetDefinition('tagtable'));
assert.ok(getWidgetDefinition('formulavalue'));

assert.equal(getWidgetByObjectType('trend')?.category, 'charts');
assert.equal(getWidgetByObjectType('alarmtable')?.inspector.dedicatedInspector, 'table');

const cats = registryPaletteCategories();
assert.ok(cats.some((c) => c.id === 'charts'));
assert.ok(cats.some((c) => c.id === 'tables'));
assert.ok(!cats.some((c) => c.id === 'effects'));
assert.equal(cats[0]?.id, 'layout');

assert.equal(registryToolKey(getWidgetDefinition('echart')!), 'echart');

const tags = [
  { id: 't_power', name: 'Active_Power_kW', deviceId: 'd1', dataType: 'float' },
  { id: 't_run', name: 'Pump_Running', deviceId: 'd1', dataType: 'bool' },
  { id: 't_cmd', name: 'Start_Cmd', deviceId: 'd1', dataType: 'bool' },
];

assert.equal(inferDeviceStatusTag(tags, 'd1'), 't_run');
assert.equal(inferDeviceNumericTag(tags, 'd1'), 't_power');
assert.equal(inferDeviceCommandTag(tags, 'd1'), 't_cmd');
assert.equal(inferDeviceFlowTag(tags, 'd1'), 't_power');

console.log('widget-registry: all tests passed');
