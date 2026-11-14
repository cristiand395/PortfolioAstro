import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duration } from './duracion.ts';

test('puesto actual: años completos hasta hoy', () => {
  assert.deepEqual(duration('2022-06', undefined, new Date(2026, 10, 14)), { n: 4, unit: 'years' });
});

test('puesto cerrado de menos de un año: meses, contando inicio y fin', () => {
  assert.deepEqual(duration('2021-08', '2022-05'), { n: 10, unit: 'months' });
  assert.deepEqual(duration('2020-10', '2021-07'), { n: 10, unit: 'months' });
});

test('justo doce meses ya cuenta como un año', () => {
  assert.deepEqual(duration('2021-01', '2021-12'), { n: 1, unit: 'years' });
});

test('mismo mes de inicio y fin es un mes', () => {
  assert.deepEqual(duration('2024-03', '2024-03'), { n: 1, unit: 'months' });
});
