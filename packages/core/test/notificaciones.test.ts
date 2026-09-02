import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claveEvento, eventsDue, notificacionDe } from '../src/notificaciones.ts';
import { buildDaySchedule } from '../src/schedule.ts';
import { parseTime } from '../src/time.ts';
import type { NutritionPlan, ScheduledEvent, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;
const eventos = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));

const en = (t: string): ScheduledEvent[] => eventsDue(eventos, parseTime(t), parseTime(t) + 5);

test('devuelve los eventos que caen en la ventana del cron', () => {
  const vencidos = eventsDue(eventos, parseTime('12:40'), parseTime('12:50'));
  assert.deepEqual(vencidos.map((e) => e.time), ['12:45']);
});

test('no reenvia el evento del borde inferior', () => {
  // 12:45 ya se mando en la corrida que termino a las 12:45.
  const vencidos = eventsDue(eventos, parseTime('12:45'), parseTime('12:50'));
  assert.equal(vencidos.some((e) => e.time === '12:45'), false);
});

test('incluye el evento del borde superior', () => {
  const vencidos = eventsDue(eventos, parseTime('12:40'), parseTime('12:45'));
  assert.deepEqual(vencidos.map((e) => e.time), ['12:45']);
});

test('una ventana vacia no devuelve nada', () => {
  assert.deepEqual(eventsDue(eventos, parseTime('12:45'), parseTime('12:45')), []);
});

test('la ventana soporta cruzar la medianoche', () => {
  const nocturno: ScheduledEvent[] = [
    { kind: 'meal', time: '23:58', minutes: parseTime('23:58'), title: 'Antes', body: '' },
    { kind: 'meal', time: '00:03', minutes: parseTime('00:03'), title: 'Después', body: '' },
    { kind: 'meal', time: '00:30', minutes: parseTime('00:30'), title: 'Lejos', body: '' },
  ];
  const vencidos = eventsDue(nocturno, parseTime('23:57'), parseTime('00:05'));
  assert.deepEqual(vencidos.map((e) => e.title), ['Antes', 'Después']);
});

test('el aviso de ingredientes lleva la lista en el cuerpo', () => {
  const prep = eventos.find((e) => e.kind === 'prep-check' && e.slotId === 'cena')!;
  const n = notificacionDe(prep);
  assert.match(n.cuerpo, /^¿Tenés todo\?/);
  assert.ok(n.cuerpo.length > 20, 'una notificación sin contenido no sirve de nada');
});

test('el recordatorio de comida lleva las opciones concretas', () => {
  const comida = eventos.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo')!;
  const n = notificacionDe(comida);
  assert.equal(n.titulo, comida.title);
  assert.ok(n.cuerpo.includes('·'), `sin opciones: ${n.cuerpo}`);
});

test('la comida del 20% no propone platos', () => {
  const sabado = buildDaySchedule(plan, config, new Date('2026-09-05T12:00:00'));
  const libre = sabado.find((e) => e.kind === 'meal' && e.freeMeal)!;
  assert.match(notificacionDe(libre).cuerpo, /20%/);
});

test('la clave del evento es estable y distingue momentos', () => {
  const a = eventos.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo')!;
  const b = eventos.find((e) => e.kind === 'meal' && e.slotId === 'cena')!;
  assert.equal(claveEvento(a), claveEvento(a));
  assert.notEqual(claveEvento(a), claveEvento(b));
});

test('cada evento del día genera una notificación con título y cuerpo', () => {
  for (const e of eventos) {
    const n = notificacionDe(e);
    assert.ok(n.titulo.length > 0, `sin título: ${e.kind}`);
    assert.ok(n.cuerpo.length > 0, `sin cuerpo: ${e.kind}`);
  }
});

test('en un día entero, cada evento se notifica exactamente una vez', () => {
  // Simula el cron corriendo cada 5 minutos durante 24 h.
  const vistos: string[] = [];
  for (let m = 0; m < 1440; m += 5) {
    for (const e of eventsDue(eventos, m, m + 5)) vistos.push(claveEvento(e));
  }
  assert.equal(vistos.length, eventos.length, 'se perdió o se duplicó algún evento');
  assert.equal(new Set(vistos).size, eventos.length);
  assert.ok(en('12:40').length >= 0);
});
