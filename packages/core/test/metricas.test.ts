import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adherencia, librasUsadas, proteinaPromedio, racha, ultimosDias,
  type ComidaRegistrada,
} from '../src/metricas.ts';
import type { NutritionPlan } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;

const r = (fecha: string, slotId: string, prot = 40, libre = false): ComidaRegistrada =>
  ({ fecha, slotId, proteinGrams: prot, esLibre: libre });

test('ultimosDias devuelve el rango en orden', () => {
  assert.deepEqual(ultimosDias('2026-09-03', 3), ['2026-09-01', '2026-09-02', '2026-09-03']);
});

test('ultimosDias cruza el cambio de mes', () => {
  assert.deepEqual(ultimosDias('2026-09-02', 3), ['2026-08-31', '2026-09-01', '2026-09-02']);
});

test('adherencia cuenta registradas sobre esperadas', () => {
  const dias = ultimosDias('2026-09-03', 3);
  const registros = [r('2026-09-01', 'almuerzo'), r('2026-09-01', 'cena'), r('2026-09-03', 'almuerzo')];
  const a = adherencia(registros, 3, dias);
  assert.equal(a.registradas, 3);
  assert.equal(a.esperadas, 9);
  assert.equal(a.porcentaje, 33);
});

test('adherencia ignora lo que cae fuera del rango', () => {
  const dias = ultimosDias('2026-09-03', 2);
  const a = adherencia([r('2026-08-01', 'almuerzo')], 3, dias);
  assert.equal(a.registradas, 0);
});

test('adherencia sin días no divide por cero', () => {
  assert.equal(adherencia([], 3, []).porcentaje, 0);
});

test('racha cuenta días seguidos hacia atrás', () => {
  const registros = [r('2026-09-03', 'almuerzo'), r('2026-09-02', 'cena'), r('2026-09-01', 'almuerzo')];
  assert.equal(racha(registros, '2026-09-03'), 3);
});

test('racha se corta en el primer día vacío', () => {
  const registros = [r('2026-09-03', 'almuerzo'), r('2026-09-01', 'almuerzo')];
  assert.equal(racha(registros, '2026-09-03'), 1);
});

test('un día de hoy todavía vacío no rompe la racha', () => {
  // A las nueve de la mañana no hay nada registrado; decirle a alguien que
  // perdió la racha por eso es maltratarlo.
  const registros = [r('2026-09-02', 'cena'), r('2026-09-01', 'almuerzo')];
  assert.equal(racha(registros, '2026-09-03'), 2);
});

test('sin registros la racha es cero', () => {
  assert.equal(racha([], '2026-09-03'), 0);
});

test('la proteína promedia por día registrado, no por día del rango', () => {
  const dias = ultimosDias('2026-09-03', 3);
  // Dos días con 120 g cada uno; el tercero sin registro no debe diluir.
  const registros = [
    r('2026-09-02', 'almuerzo', 60), r('2026-09-02', 'cena', 60),
    r('2026-09-03', 'almuerzo', 60), r('2026-09-03', 'cena', 60),
  ];
  const p = proteinaPromedio(plan, registros, dias);
  assert.equal(p.promedio, 120);
  assert.equal(p.diasConRegistro, 2);
  assert.equal(p.objetivo, 120);
});

test('sin registros la proteína promedio es cero y no NaN', () => {
  const p = proteinaPromedio(plan, [], ultimosDias('2026-09-03', 7));
  assert.equal(p.promedio, 0);
  assert.equal(p.diasConRegistro, 0);
});

test('las comidas del 20% se cuentan y se detecta si se amontonaron', () => {
  const dias = ultimosDias('2026-09-06', 7);
  const registros = [
    r('2026-09-05', 'almuerzo', 0, true),
    r('2026-09-05', 'cena', 0, true),
    r('2026-09-06', 'almuerzo', 0, true),
    r('2026-09-06', 'cena', 40, false),
  ];
  const l = librasUsadas(registros, dias);
  assert.equal(l.usadas, 3);
  assert.deepEqual(l.diasConMasDeUna, ['2026-09-05']);
});
