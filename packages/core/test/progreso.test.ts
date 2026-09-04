import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lectura, suavizada, tendencia, type Medida } from '../src/progreso.ts';

const m = (fecha: string, pesoKg?: number, cinturaCm?: number): Medida =>
  ({ fecha, ...(pesoKg != null ? { pesoKg } : {}), ...(cinturaCm != null ? { cinturaCm } : {}) });

test('sin mediciones no inventa una tendencia', () => {
  const t = tendencia([]);
  assert.equal(t.direccion, 'sin-datos');
  assert.equal(t.mediciones, 0);
});

test('con pocas mediciones dice cuantas faltan en vez de dibujar una linea', () => {
  const t = tendencia([m('2026-09-01', 80), m('2026-09-08', 79)]);
  assert.equal(t.direccion, 'sin-datos');
  assert.match(t.resumen, /2 mediciones más/);
});

test('a una medicion del minimo lo dice en singular', () => {
  const t = tendencia([m('2026-09-01', 80), m('2026-09-08', 79), m('2026-09-15', 79)]);
  assert.match(t.resumen, /una medición más/);
});

test('compara promedio contra promedio, no el ultimo contra el primero', () => {
  // Si comparara puntas, este caso daria "sube": 80.4 > 80.0.
  const t = tendencia([m('2026-09-01', 80.0), m('2026-09-08', 81.0), m('2026-09-15', 79.0), m('2026-09-22', 80.4)]);
  assert.equal(t.previo, 80.5);
  assert.equal(t.actual, 79.7);
  assert.equal(t.direccion, 'baja');
});

test('una oscilacion chica es ruido, no direccion', () => {
  const t = tendencia([m('2026-09-01', 80), m('2026-09-08', 80.1), m('2026-09-15', 80.1), m('2026-09-22', 80.2)]);
  assert.equal(t.direccion, 'estable');
});

test('la fecha ordena la serie aunque las medidas lleguen desordenadas', () => {
  const desordenadas = [m('2026-09-22', 79), m('2026-09-01', 81), m('2026-09-15', 79.5), m('2026-09-08', 81)];
  const ordenadas = [m('2026-09-01', 81), m('2026-09-08', 81), m('2026-09-15', 79.5), m('2026-09-22', 79)];
  assert.deepEqual(tendencia(desordenadas), tendencia(ordenadas));
});

test('un dia sin peso no rompe la serie de peso', () => {
  // Se puede medir la cintura sin pesarse; esa fila no debe contar como peso.
  const t = tendencia([
    m('2026-09-01', 80), m('2026-09-08', undefined, 92),
    m('2026-09-15', 79.5), m('2026-09-22', 79), m('2026-09-29', 78.8),
  ]);
  assert.equal(t.mediciones, 4);
});

test('la cintura usa su propio umbral de ruido', () => {
  const medidas = [
    m('2026-09-01', undefined, 92), m('2026-09-08', undefined, 92),
    m('2026-09-15', undefined, 91.6), m('2026-09-22', undefined, 91.6),
  ];
  // 0,4 cm de cambio: por debajo del umbral de la cintura (0,5).
  assert.equal(tendencia(medidas, 'cinturaCm').direccion, 'estable');
});

test('el resumen usa coma decimal', () => {
  const t = tendencia([m('2026-09-01', 81), m('2026-09-08', 81), m('2026-09-15', 79.5), m('2026-09-22', 79.5)]);
  assert.match(t.resumen, /1,5 kg/);
});

// --- la lectura combinada, que es el punto de todo esto ---

test('peso quieto con cintura que baja se nombra como recomposicion', () => {
  const medidas = [
    m('2026-09-01', 80, 92), m('2026-09-08', 80.1, 91.5),
    m('2026-09-15', 80, 90.5), m('2026-09-22', 80.1, 90),
  ];
  assert.match(lectura(medidas), /recomposición/i);
});

test('peso que baja con cintura que acompaña no se disfraza de otra cosa', () => {
  const medidas = [
    m('2026-09-01', 82, 94), m('2026-09-08', 81.8, 93.8),
    m('2026-09-15', 80.5, 92), m('2026-09-22', 80.2, 91.8),
  ];
  const l = lectura(medidas);
  assert.match(l, /bajó/);
  assert.match(l, /cintura acompaña/i);
});

test('peso que baja con cintura que sube manda a preguntar, no a concluir', () => {
  const medidas = [
    m('2026-09-01', 82, 90), m('2026-09-08', 81.8, 90.2),
    m('2026-09-15', 80.5, 92), m('2026-09-22', 80.2, 92.2),
  ];
  assert.match(lectura(medidas), /consulta/i);
});

test('sin ninguna medicion la lectura invita a empezar, no reta', () => {
  assert.match(lectura([]), /una vez por semana/);
});

// --- la serie para dibujar ---

test('suavizada devuelve el dato crudo y el promedio movil', () => {
  const s = suavizada([m('2026-09-01', 80), m('2026-09-08', 82), m('2026-09-15', 81)]);
  assert.deepEqual(s.map((p) => p.valor), [80, 82, 81]);
  assert.deepEqual(s.map((p) => p.media), [80, 81, 81]);
});

test('la media arranca desde el primer punto, sin huecos', () => {
  const s = suavizada([m('2026-09-01', 80)]);
  assert.deepEqual(s, [{ fecha: '2026-09-01', valor: 80, media: 80 }]);
});

test('suavizada ignora los dias sin ese campo', () => {
  const s = suavizada([m('2026-09-01', 80), m('2026-09-08', undefined, 92), m('2026-09-15', 79)]);
  assert.deepEqual(s.map((p) => p.fecha), ['2026-09-01', '2026-09-15']);
});
