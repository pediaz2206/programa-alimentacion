import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMinutes, formatTime, humanizeMinutes, isWithinWindow, minutesUntil, parseTime } from '../src/time.ts';

test('parseTime y formatTime son inversos', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('13:30'), 810);
  assert.equal(formatTime(810), '13:30');
  assert.equal(formatTime(1440), '00:00');
});

test('parseTime rechaza horas invalidas', () => {
  assert.throws(() => parseTime('25:00'), /Hora invalida/);
  assert.throws(() => parseTime('7:00'), /Hora invalida/);
});

test('addMinutes envuelve la medianoche', () => {
  assert.equal(addMinutes('23:30', 45), '00:15');
  assert.equal(addMinutes('00:15', -30), '23:45');
});

test('la ventana de alimentacion soporta cruzar la medianoche', () => {
  const start = parseTime('20:00');
  const eightHours = 8 * 60;
  assert.equal(isWithinWindow(parseTime('21:00'), start, eightHours), true);
  assert.equal(isWithinWindow(parseTime('02:00'), start, eightHours), true);
  assert.equal(isWithinWindow(parseTime('19:59'), start, eightHours), false);
  assert.equal(isWithinWindow(parseTime('04:00'), start, eightHours), false, '04:00 es el limite exclusivo');
});

test('ventana 16:8 clasica', () => {
  const start = parseTime('12:00');
  assert.equal(isWithinWindow(parseTime('08:00'), start, 480), false);
  assert.equal(isWithinWindow(parseTime('19:59'), start, 480), true);
  assert.equal(isWithinWindow(parseTime('20:00'), start, 480), false);
});

test('minutesUntil avanza en el tiempo', () => {
  assert.equal(minutesUntil(parseTime('23:00'), parseTime('01:00')), 120);
  assert.equal(minutesUntil(parseTime('12:00'), parseTime('12:00')), 0);
});

test('humanizeMinutes', () => {
  assert.equal(humanizeMinutes(45), '45 min');
  assert.equal(humanizeMinutes(60), '1 h');
  assert.equal(humanizeMinutes(90), '1 h 30 min');
});
