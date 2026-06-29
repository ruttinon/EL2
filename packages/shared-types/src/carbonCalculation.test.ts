import assert from 'node:assert/strict';
import { computeCarbonSummary, selectCarbonDeviceIds } from './carbonCalculation.js';
import { computeCarbonBreakdown } from './carbonBreakdown.js';
import { inferTagEnergyRole } from './tagEnergyMapping.js';

function runTests() {
  const mainMeter = {
    id: 'main',
    name: 'Main incomer',
    energyMappingJson: JSON.stringify({
      role: 'site_main',
      source: 'grid',
      loadCategory: 'total_site',
      includeInCarbon: true,
      viewerVisible: true,
    }),
  };
  const subMeter = {
    id: 'sub',
    name: 'HVAC sub',
    energyMappingJson: JSON.stringify({
      role: 'sub_meter',
      source: '',
      loadCategory: 'hvac',
      includeInCarbon: false,
      viewerVisible: true,
    }),
  };

  const selection = selectCarbonDeviceIds([mainMeter, subMeter]);
  assert.equal(selection.strategy, 'site_main');
  assert.deepEqual([...selection.ids], ['main']);

  const summary = computeCarbonSummary({
    emissionFactorKgPerKwh: 0.5,
    netMetering: false,
    devices: [mainMeter, subMeter],
    tags: [
      {
        id: 't1',
        deviceId: 'main',
        name: 'Energy_Imp',
        unit: 'kWh',
        energyTagRole: 'import_kwh',
        currentValue: 100,
      },
      {
        id: 't2',
        deviceId: 'sub',
        name: 'Energy_Imp',
        unit: 'kWh',
        energyTagRole: 'import_kwh',
        currentValue: 40,
      },
    ],
  });

  assert.equal(summary.kWhQualified, 100, 'sub-meter must not double-count when main exists');
  assert.equal(summary.carbonKg, 50);
  assert.equal(summary.strategy, 'site_main');

  const netSummary = computeCarbonSummary({
    emissionFactorKgPerKwh: 0.45,
    netMetering: true,
    devices: [mainMeter],
    tags: [
      { id: 'i', deviceId: 'main', name: 'Import', unit: 'kWh', energyTagRole: 'import_kwh', currentValue: 120 },
      { id: 'e', deviceId: 'main', name: 'Export', unit: 'kWh', energyTagRole: 'export_kwh', currentValue: 30 },
    ],
  });
  assert.equal(netSummary.kWhQualified, 90);

  assert.equal(inferTagEnergyRole('TOTAL Active Energy +', 'kWh'), 'import_kwh');
  assert.equal(inferTagEnergyRole('TOTAL Active Energy -', 'kWh'), 'export_kwh');

  const breakdown = computeCarbonBreakdown(
    [
      mainMeter,
      {
        id: 'sub',
        name: 'HVAC sub',
        energyMappingJson: JSON.stringify({
          role: 'sub_meter',
          source: 'grid',
          loadCategory: 'hvac',
          includeInCarbon: false,
          viewerVisible: true,
        }),
      },
    ],
    [
      { deviceId: 'main', deviceName: 'Main', role: 'site_main', importKwh: 100, exportKwh: 0, netKwh: 0, qualifiedKwh: 100 },
      { deviceId: 'sub', deviceName: 'HVAC', role: 'sub_meter', importKwh: 40, exportKwh: 0, netKwh: 0, qualifiedKwh: 40 },
    ],
    0.5,
    'loadCategory',
    'site_main',
  );
  assert.equal(breakdown.items.length, 1);
  assert.equal(breakdown.items[0]?.key, 'hvac');
  assert.equal(breakdown.items[0]?.kWh, 40);

  console.log('carbonCalculation tests passed');
}

runTests();
