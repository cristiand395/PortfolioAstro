import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HIGHLIGHT, STEP_COUNT, poseAt, poses } from './metodo.ts';

test('hay una forma por paso del riel y 27 piezas en cada una', () => {
  const shapes = poses();
  assert.equal(shapes.length, STEP_COUNT);
  shapes.forEach((shape) => assert.equal(shape.length, 27));
});

test('el nudo es determinista: misma escena en cada visita', () => {
  assert.deepEqual(poses()[0], poses()[0]);
});

test('el progreso 0 es el nudo y el 1 la pieza terminada', () => {
  const [knot, , , , done] = poses();
  assert.deepEqual(poseAt(0), knot);
  assert.deepEqual(poseAt(1), done);
  assert.deepEqual(poseAt(-3), knot);
  assert.deepEqual(poseAt(9), done);
});

test('en el paso medir la pieza destacada corona la barra más alta', () => {
  const bars = poses()[3];
  const top = Math.max(...bars.map((p) => p.pos[1]));
  assert.equal(bars[HIGHLIGHT].pos[1], top);
});

test('en el último paso la pieza destacada queda arriba', () => {
  assert.ok(poses()[4][HIGHLIGHT].pos[1] > 0.9);
});
