import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comidasPendientes, estadoActual } from '../src/momento.ts';
import { buildDaySchedule } from '../src/schedule.ts';
import { parseTime } from '../src/time.ts';
import type { NutritionPlan, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;
// Almuerzo 13:30, merienda 18:30, cena 21:30; ventana 13:30-21:30.
const eventos = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));
const en = (t: string, registrados: string[] = []) => estadoActual(eventos, parseTime(t), registrados);

test('antes del primer evento muestra lo que viene', () => {
  const m = en('09:00');
  assert.equal(m.tipo, 'proximo');
  assert.equal(m.evento?.time, '12:45');
});

test('antes del aviso de ingredientes todavía no es "preparar"', () => {
  const m = en('12:30');
  assert.equal(m.tipo, 'proximo', 'el aviso es 12:45; a las 12:30 no hay nada que preparar');
  assert.equal(m.evento?.time, '12:45');
  assert.equal(m.faltan, 15);
});

test('dentro de la ventana de preparación muestra los ingredientes', () => {
  const m = en('12:50');
  assert.equal(m.tipo, 'preparar');
  assert.equal(m.evento?.kind, 'prep-check');
  assert.equal(m.evento?.slotId, 'almuerzo');
  assert.equal(m.faltan, 40, 'cuánto falta para comer, no para el aviso');
  assert.ok((m.evento?.checklist?.length ?? 0) > 0);
});

test('registrada la comida, su ventana de preparación deja de aplicar', () => {
  const m = en('12:50', ['almuerzo']);
  assert.equal(m.tipo, 'preparar', 'la comida sigue sin ocurrir: los ingredientes siguen sirviendo');
  assert.equal(m.evento?.slotId, 'almuerzo');
});

test('a la hora de comer pide comer, no muestra lo siguiente', () => {
  const m = en('13:30');
  assert.equal(m.tipo, 'comer-ahora');
  assert.equal(m.evento?.slotId, 'almuerzo');
});

test('sigue siendo hora de comer un rato despues', () => {
  assert.equal(en('14:30').tipo, 'comer-ahora', 'nadie come a la hora exacta');
  assert.equal(en('14:30').evento?.slotId, 'almuerzo');
});

test('registrar la comida libera el momento', () => {
  const m = en('13:35', ['almuerzo']);
  assert.notEqual(m.tipo, 'comer-ahora');
  assert.equal(m.evento?.slotId, 'merienda', 'pasa a ocuparse de lo siguiente');
});

test('una comida vieja sin registrar no secuestra la pantalla', () => {
  // Cuatro horas despues del almuerzo ya no tiene sentido insistir.
  const m = en('17:45');
  assert.notEqual(m.tipo, 'comer-ahora');
});

test('la comida en curso gana sobre cualquier evento futuro', () => {
  const m = en('13:31');
  assert.equal(m.tipo, 'comer-ahora');
  assert.equal(m.evento?.kind, 'meal');
});

test('despues del ultimo evento no inventa nada', () => {
  assert.equal(en('23:30', ['almuerzo', 'merienda', 'cena']).tipo, 'fin-del-dia');
});

test('comidasPendientes descuenta lo ya registrado', () => {
  assert.equal(comidasPendientes(eventos, []).length, 3);
  assert.deepEqual(
    comidasPendientes(eventos, ['almuerzo', 'cena']).map((e) => e.slotId),
    ['merienda'],
  );
});
