import assert from 'node:assert/strict';
import {
  snapValue,
  snapPoint,
  snapDepthZ,
  DEFAULT_GRID_SIZE,
} from './snapGrid.js';
import { computeWallSegment } from './wallGeometry.js';
import { autoGlbEquipmentPorts } from '../ports.js';
import {
  boundsFromPoints,
  buildRoomFromCorners,
  buildRoomFromPolygon,
  polygonPointsString,
  validateRoomCorners,
  ROOM_CORNER_COUNT,
  MIN_ROOM_CORNERS,
} from './roomBuilder.js';
import { findClosedWallLoops, buildRoomFromWallLoop } from './wallLoop.js';
import { snapPointToWall } from './wallSnap.js';
import { parseGltfPortNodeName, portsFromGltfNodeSamples } from '../gltfPorts.js';
import { validateFormulaSyntax } from '../objectLogic.js';
import { formatClockDisplay } from '../ClockObject.js';
import { pathMidpoint, formatFeedLabel } from '../sld.js';

function runTests() {
  assert.equal(snapValue(23, DEFAULT_GRID_SIZE, true), 20);
  assert.equal(snapValue(31, DEFAULT_GRID_SIZE, true), 40);
  assert.equal(snapValue(31, DEFAULT_GRID_SIZE, false), 31);
  assert.deepEqual(snapPoint({ x: 23, y: 47 }, DEFAULT_GRID_SIZE, true), { x: 20, y: 40 });
  assert.equal(snapDepthZ(35, true), 40);
  assert.equal(snapDepthZ(35, false), 35);

  const wall = computeWallSegment({ x: 0, y: 0 }, { x: 100, y: 0 });
  assert.equal(wall.len, 100);
  assert.equal(wall.angleDeg, 0);
  assert.equal(wall.wallThickness, 16);

  const corners = [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 300 },
    { x: 100, y: 300 },
  ];
  assert.equal(validateRoomCorners(corners), null);
  const poly = polygonPointsString(corners);
  assert.ok(poly.includes('100,100'));
  const bounds = boundsFromPoints(corners);
  assert.equal(bounds.width, 300);
  assert.equal(bounds.height, 200);

  const room = buildRoomFromCorners(corners);
  assert.equal(room.walls.length, ROOM_CORNER_COUNT);
  assert.equal(room.bounds.width, 300);

  const tri = buildRoomFromPolygon([
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 100, y: 150 },
  ]);
  assert.equal(tri.walls.length, 3);

  const loopSegments = [
    { start: { x: 100, y: 100 }, end: { x: 400, y: 100 } },
    { start: { x: 400, y: 100 }, end: { x: 400, y: 300 } },
    { start: { x: 400, y: 300 }, end: { x: 100, y: 300 } },
    { start: { x: 100, y: 300 }, end: { x: 100, y: 100 } },
  ];
  const loops = findClosedWallLoops(loopSegments);
  assert.ok(loops.length >= 1);
  const fromWalls = buildRoomFromWallLoop(loopSegments);
  assert.ok(fromWalls && fromWalls.bounds.width === 300);

  const wallSnap = snapPointToWall({ x: 250, y: 95 }, loopSegments);
  assert.ok(wallSnap && wallSnap.distance <= 24);

  const gltfPorts = portsFromGltfNodeSamples([
    { name: 'port_out_top', x: 0.5, y: 0 },
    { name: 'socket_in_feed', x: 0.1, y: 0.5 },
  ]);
  assert.equal(gltfPorts.length, 2);
  assert.equal(parseGltfPortNodeName('port_out_top').kind, 'out');

  assert.equal(MIN_ROOM_CORNERS, 3);

  let threw = false;
  try {
    buildRoomFromCorners(corners.slice(0, 2));
  } catch {
    threw = true;
  }
  assert.equal(threw, true);

  assert.ok(autoGlbEquipmentPorts().includes('out-top'));

  assert.equal(validateFormulaSyntax('A + B', ['t1', 't2']).ok, true);
  assert.equal(validateFormulaSyntax('A + Z', ['t1']).ok, false);
  const clock = formatClockDisplay(new Date('2026-06-19T14:30:00Z'), 'utc', '24h', true);
  assert.ok(clock.time.includes('14') || clock.time.includes('30'));

  const mid = pathMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  assert.equal(mid.x, 50);
  assert.equal(formatFeedLabel('Feed A', { value: 12.5, unit: 'kW' }), 'Feed A: 12.5 kW');

  console.log('sceneBuilder.test.ts: all passed');
}

runTests();
