import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraAt, ringPosition } from './graph.ts';

test('la fase 0 queda arriba del anillo', () => {
  const p = ringPosition(0, 7);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.equal(p.y, 4);
});

test('la cámara empieza en la vista general y acaba en la última', () => {
  assert.deepEqual(cameraAt(0).pos.toArray(), [0, 0, 13]);
  assert.deepEqual(cameraAt(-1).pos.toArray(), [0, 0, 13]);
  assert.deepEqual(cameraAt(1).pos.toArray(), [-3.5, -2, 11]);
  assert.deepEqual(cameraAt(5).pos.toArray(), [-3.5, -2, 11]);
});

test('a mitad del recorrido la cámara está en el nodo activo', () => {
  assert.deepEqual(cameraAt(0.5).look.toArray(), [0, 4, 0]);
});

test('el desplazamiento solo afecta a la vista general', () => {
  assert.equal(cameraAt(0, -4).pos.x, -4);
  assert.equal(cameraAt(0.5, -4).pos.x, 1.8);
});
