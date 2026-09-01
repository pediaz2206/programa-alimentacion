import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDaySchedule, resolveSlots, upcomingEvents } from '../src/schedule.ts';
import { parseTime } from '../src/time.ts';
import { config, plan } from './fixtures.ts';
import type { UserConfig } from '../src/types.ts';

const martes = new Date('2026-09-01T12:00:00');

test('genera un aviso de ingredientes y una comida por cada momento activo', () => {
  const events = buildDaySchedule(plan, config, martes);
  assert.equal(events.filter((e) => e.kind === 'meal').length, 3);
  assert.equal(events.filter((e) => e.kind === 'prep-check').length, 3);
});

test('el aviso de ingredientes cae el lead antes de la comida', () => {
  const events = buildDaySchedule(plan, config, martes);
  const prep = events.find((e) => e.kind === 'prep-check' && e.slotId === 'almuerzo');
  assert.equal(prep?.time, '12:30');
  assert.ok(prep?.checklist?.some((i) => i.item === 'Pollo' || i.item === 'Merluza'));
});

test('el checklist no incluye los basicos de alacena', () => {
  const events = buildDaySchedule(plan, config, martes);
  const prep = events.find((e) => e.kind === 'prep-check' && e.slotId === 'desayuno');
  assert.deepEqual(prep?.checklist?.map((i) => i.item), ['Avena']);
});

test('los eventos salen ordenados por hora', () => {
  const events = buildDaySchedule(plan, config, martes);
  const minutes = events.map((e) => e.minutes);
  assert.deepEqual(minutes, [...minutes].sort((a, b) => a - b));
});

test('un momento deshabilitado desaparece de la agenda', () => {
  const sinDesayuno: UserConfig = { ...config, slots: [{ slotId: 'desayuno', enabled: false }] };
  const events = buildDaySchedule(plan, sinDesayuno, martes);
  assert.equal(events.some((e) => e.slotId === 'desayuno'), false);
});

test('los momentos se filtran por dia de la semana', () => {
  const soloLunes: UserConfig = { ...config, slots: [{ slotId: 'almuerzo', weekdays: [1] }] };
  assert.equal(
    buildDaySchedule(plan, soloLunes, martes).some((e) => e.slotId === 'almuerzo'),
    false,
    'el martes no deberia aparecer el almuerzo',
  );
  const lunes = new Date('2026-08-31T12:00:00');
  assert.ok(buildDaySchedule(plan, soloLunes, lunes).some((e) => e.slotId === 'almuerzo'));
});

test('la hora configurada pisa la del plan', () => {
  const tarde: UserConfig = { ...config, slots: [{ slotId: 'almuerzo', time: '14:15' }] };
  const meal = buildDaySchedule(plan, tarde, martes).find(
    (e) => e.kind === 'meal' && e.slotId === 'almuerzo',
  );
  assert.equal(meal?.time, '14:15');
});

test('el ayuno agrega apertura, aviso de cierre y cierre', () => {
  const conAyuno: UserConfig = {
    ...config,
    fasting: { enabled: true, eatingWindowStart: '12:00', eatingWindowHours: 8, closingWarningMinutes: 60 },
  };
  const events = buildDaySchedule(plan, conAyuno, martes);
  assert.equal(events.find((e) => e.kind === 'fast-end')?.time, '12:00');
  assert.equal(events.find((e) => e.kind === 'fast-closing')?.time, '19:00');
  assert.equal(events.find((e) => e.kind === 'fast-start')?.time, '20:00');
});

test('avisa cuando una comida cae fuera de la ventana de alimentacion', () => {
  const conAyuno: UserConfig = {
    ...config,
    fasting: { enabled: true, eatingWindowStart: '12:00', eatingWindowHours: 8 },
  };
  const events = buildDaySchedule(plan, conAyuno, martes);
  const desayuno = events.find((e) => e.kind === 'meal' && e.slotId === 'desayuno');
  const almuerzo = events.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo');
  const cena = events.find((e) => e.kind === 'meal' && e.slotId === 'cena');

  assert.match(desayuno?.warnings?.[0] ?? '', /fuera de la ventana/, 'el desayuno a las 08:00 esta fuera');
  assert.equal(almuerzo?.warnings, undefined);
  assert.match(cena?.warnings?.[0] ?? '', /fuera de la ventana/, 'la cena a las 21:00 esta fuera');
});

test('el almuerzo y la cena no proponen el mismo plato principal', () => {
  const events = buildDaySchedule(plan, config, martes);
  const almuerzo = events.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo');
  const cena = events.find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.notEqual(almuerzo?.suggestions?.[0]?.id, cena?.suggestions?.[0]?.id);
});

test('los tags excluidos nunca se sugieren', () => {
  const sinCerdo: UserConfig = { ...config, excludeTags: ['cerdo'], optionsPerSuggestion: 10 };
  const events = buildDaySchedule(plan, sinCerdo, martes);
  const ids = events.flatMap((e) => e.suggestions ?? []).map((o) => o.id);
  assert.equal(ids.includes('cerdo'), false);
});

test('el metodo del plato solo aparece donde el plan lo declara', () => {
  const events = buildDaySchedule(plan, config, martes);
  const almuerzo = events.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo');
  const desayuno = events.find((e) => e.kind === 'meal' && e.slotId === 'desayuno');
  assert.match(almuerzo?.body ?? '', /Plato:/);
  assert.doesNotMatch(desayuno?.body ?? '', /Plato:/);
});

test('la agenda es deterministica: dos corridas del mismo dia son identicas', () => {
  assert.deepEqual(buildDaySchedule(plan, config, martes), buildDaySchedule(plan, config, martes));
});

test('la sugerencia rota entre dias', () => {
  const dias = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map(
    (d) => buildDaySchedule(plan, config, new Date(`${d}T12:00:00`))
      .find((e) => e.kind === 'meal' && e.slotId === 'almuerzo')?.suggestions?.[0]?.id,
  );
  assert.ok(new Set(dias).size > 1, `siempre sugirio lo mismo: ${dias.join(',')}`);
});

test('el aviso de ingredientes y la comida coinciden en la sugerencia', () => {
  const events = buildDaySchedule(plan, config, martes);
  for (const slotId of ['desayuno', 'almuerzo', 'cena']) {
    const prep = events.find((e) => e.kind === 'prep-check' && e.slotId === slotId);
    const meal = events.find((e) => e.kind === 'meal' && e.slotId === slotId);
    assert.equal(prep?.suggestions?.[0]?.id, meal?.suggestions?.[0]?.id, slotId);
  }
});

test('resolveSlots devuelve los momentos ordenados por hora', () => {
  const resolved = resolveSlots(plan, config, martes);
  assert.deepEqual(resolved.map((r) => r.slot.id), ['desayuno', 'almuerzo', 'cena']);
});

test('upcomingEvents filtra lo que ya paso', () => {
  const events = buildDaySchedule(plan, config, martes);
  const pending = upcomingEvents(events, parseTime('14:00'));
  assert.ok(pending.every((e) => e.minutes >= 840));
  assert.ok(pending.length < events.length);
});
