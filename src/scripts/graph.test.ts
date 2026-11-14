import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildKeyframes, cameraAt, constellationCenter, layoutStars } from './graph.ts';

const stars = [
  { constellation: 0, brightness: 3, color: '#fff' },
  { constellation: 1, brightness: 1, color: '#fff' },
  { constellation: 0, brightness: 2, color: '#fff' },
];

test('cada estrella queda cerca del centro de su constelación', () => {
  const positions = layoutStars(stars, 2);
  stars.forEach((s, i) => {
    assert.ok(positions[i].distanceTo(constellationCenter(s.constellation, 2)) < 3);
  });
});

test('el cielo es determinista: mismo contenido, mismas posiciones', () => {
  assert.deepEqual(layoutStars(stars, 2), layoutStars(stars, 2));
});

test('el recorrido tiene vista general más una parada por constelación', () => {
  const frames = buildKeyframes([constellationCenter(0, 2), constellationCenter(1, 2)]);
  assert.equal(frames.length, 3);
  assert.deepEqual(cameraAt(0, frames).pos.toArray(), [0, 0, 16]);
  assert.ok(cameraAt(1, frames).look.distanceTo(constellationCenter(1, 2)) < 1e-9);
  assert.ok(cameraAt(9, frames).look.distanceTo(constellationCenter(1, 2)) < 1e-9);
  assert.deepEqual(cameraAt(-1, frames).pos.toArray(), [0, 0, 16]);
});

test('el desplazamiento es entero en la vista general y menor de cerca', () => {
  const frames = buildKeyframes([constellationCenter(0, 1)]);
  assert.equal(cameraAt(0, frames, -5).pos.x, -5);
  const near = cameraAt(1, frames, -5).look.x - frames[1].look.x;
  assert.ok(near < 0 && near > -5);
});

test('sin constelaciones la cámara se queda en la vista general', () => {
  assert.deepEqual(cameraAt(0.5, buildKeyframes([])).pos.toArray(), [0, 0, 16]);
});
