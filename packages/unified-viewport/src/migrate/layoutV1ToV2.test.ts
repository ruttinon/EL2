import assert from 'node:assert/strict';
import { layoutV1ToV2, splitObjectsByUnifiedLayer } from './layoutV1ToV2';

const v1 = {
  version: 1 as const,
  objects: [
    { id: '1', type: 'value', x: 0, y: 0, width: 10, height: 10 },
    { id: '2', type: 'wall', x: 0, y: 0, width: 100, height: 16 },
  ],
};

const v2 = layoutV1ToV2(v1);
assert.equal(v2.version, 2);
assert.equal(v2.defaultCamera, 'flat');
const split = splitObjectsByUnifiedLayer(v2.objects);
assert.equal(split.world.length, 1);
assert.equal(split.hud.length, 1);
console.log('layoutV1ToV2.test ok');
