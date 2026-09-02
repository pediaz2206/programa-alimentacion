import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ajusteDeVentana, aplicarAjuste } from '../src/ventana.ts';
import { buildDaySchedule } from '../src/schedule.ts';
import type { NutritionPlan, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;

const conCena = (hora: string): UserConfig => ({
  ...config,
  slots: config.slots.map((s) => (s.slotId === 'cena' ? { ...s, time: hora } : s)),
});

test('la config del repo no necesita ajuste... salvo por el margen de la cena', () => {
  // Almuerzo 13:30 y cena 21:30 con ventana de 8 h: la cena empieza justo al
  // cierre, así que no entra entera.
  const a = ajusteDeVentana(plan, config);
  assert.notEqual(a.tipo, 'ok');
});

test('una cena adelantada entra sin tocar nada', () => {
  assert.deepEqual(ajusteDeVentana(plan, conCena('20:30')), { tipo: 'ok' });
});

test('mover la cena una hora más tarde propone correr la ventana', () => {
  const a = ajusteDeVentana(plan, conCena('22:30'));
  assert.equal(a.tipo, 'ampliar', 'de 13:30 a 23:00 no entra en 8 h');
  if (a.tipo !== 'ampliar') return;
  assert.equal(a.inicio, '13:30');
  assert.equal(a.horas, 9.5);
  assert.match(a.descripcion, /14,5 h de ayuno/, 'decimal con coma, no con punto');
});

test('si entra en la duración actual solo se corre el inicio', () => {
  // Almuerzo 15:00 y cena 22:00: 7,5 h de punta a punta, entran en las 8 h.
  // Pero la ventana actual cierra 21:30, así que hay que correrla, no ampliarla.
  const corrida: UserConfig = {
    ...config,
    slots: config.slots.map((s) =>
      s.slotId === 'almuerzo' ? { ...s, time: '15:00' }
        : s.slotId === 'cena' ? { ...s, time: '22:00' } : s),
  };
  const a = ajusteDeVentana(plan, corrida);
  assert.equal(a.tipo, 'mover', 'alcanza con correr el inicio');
  if (a.tipo !== 'mover') return;
  assert.equal(a.inicio, '15:00');
  assert.equal(a.cierre, '23:00');
});

test('una comida que empieza dentro pero termina afuera cuenta como fuera', () => {
  // La cena justo en el cierre: empieza dentro, se come afuera.
  const a = ajusteDeVentana(plan, conCena('21:30'));
  assert.notEqual(a.tipo, 'ok');
});

test('sin ayuno activo nunca hay nada que ajustar', () => {
  const sinAyuno: UserConfig = { ...config, fasting: { ...config.fasting!, enabled: false } };
  assert.deepEqual(ajusteDeVentana(plan, sinAyuno), { tipo: 'ok' });
});

test('aplicar el ajuste hace desaparecer los avisos', () => {
  const rota = conCena('22:30');
  const antes = buildDaySchedule(plan, rota, new Date('2026-09-02T12:00:00'));
  assert.ok(antes.some((e) => (e.warnings ?? []).length > 0), 'debería haber avisos antes');

  const arreglada = aplicarAjuste(rota, ajusteDeVentana(plan, rota));
  const despues = buildDaySchedule(plan, arreglada, new Date('2026-09-02T12:00:00'));
  assert.deepEqual(
    despues.flatMap((e) => e.warnings ?? []),
    [],
    'después de aplicar el ajuste no debería quedar ninguno',
  );
});

test('aplicar sobre una config sin problemas no la cambia', () => {
  const buena = conCena('20:30');
  assert.equal(aplicarAjuste(buena, ajusteDeVentana(plan, buena)), buena);
});
