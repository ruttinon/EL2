import assert from 'node:assert/strict';
import {
  GRAPHIC_LAYOUT_VERSION_V3,
  migrateLayoutToV3,
  migrateObjectToV3,
  syncObjectTransformFields,
} from './layoutV3.js';
import type { GraphicLayout } from './graphics.js';

const layout: GraphicLayout = {
  version: 2,
  objects: [
    {
      id: 'o1',
      type: 'value',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      style: { rotate: 15 },
    },
  ],
};

const v3 = migrateLayoutToV3(layout);
assert.equal(v3.version, GRAPHIC_LAYOUT_VERSION_V3);
assert.ok(v3.objects?.[0]?.transform);
assert.equal(v3.objects?.[0]?.transform?.x, 10);
assert.equal(v3.objects?.[0]?.transform?.rotate, 15);

const synced = syncObjectTransformFields({
  ...v3.objects![0]!,
  transform: { x: 50, y: 60, width: 120, height: 44, rotate: 30 },
});
assert.equal(synced.x, 50);
assert.equal(synced.width, 120);
assert.equal(synced.style?.rotate, 30);

const single = migrateObjectToV3(layout.objects![0]!);
assert.equal(single.transform?.height, 40);

console.log('shared-types layoutV3: all tests passed');
