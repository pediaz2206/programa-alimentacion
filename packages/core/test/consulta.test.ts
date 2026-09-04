import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumenDeConsulta, type ComidaDeConsulta } from '../src/consulta.ts';
import type { Medida } from '../src/progreso.ts';
import type { NutritionPlan, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
// La config real: 16:8 sin desayuno. El plan declara el slot, ella lo apaga.
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;
const HASTA = '2026-09-28';

/** Un dia completo y prolijo: las tres comidas del plan, proteina en objetivo. */
function diaOk(fecha: string): ComidaDeConsulta[] {
  return ['almuerzo', 'merienda', 'cena'].map((slotId) => ({
    fecha, slotId, proteinGrams: 40, esLibre: false,
  }));
}

function dias(desde: number, cantidad: number): string[] {
  const salida: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(Date.UTC(2026, 8, desde + i));
    salida.push(d.toISOString().slice(0, 10));
  }
  return salida;
}

const mesProlijo = dias(1, 28).flatMap(diaOk);

test('un mes prolijo no genera puntos de atencion', () => {
  // Un resumen donde siempre figura algo no sirve para priorizar nada.
  const r = resumenDeConsulta(plan, config, mesProlijo, [], HASTA);
  assert.deepEqual(r.puntos, []);
});

test('el resumen declara su propio periodo', () => {
  const r = resumenDeConsulta(plan, config, mesProlijo, [], HASTA);
  assert.equal(r.hasta, HASTA);
  assert.equal(r.dias, 28);
  assert.equal(r.adherencia.porcentaje, 100);
});

test('una racha larga sin registros es el punto mas grave', () => {
  const conHueco = mesProlijo.filter((c) => !dias(10, 5).includes(c.fecha));
  const r = resumenDeConsulta(plan, config, conHueco, [], HASTA);
  const p = r.puntos.find((x) => x.id === 'dias-sin-registro');
  assert.equal(p?.severidad, 'alta');
  assert.match(p!.detalle, /5 días seguidos/);
  assert.equal(r.puntos[0]?.id, 'dias-sin-registro', 'lo mas grave va primero');
});

test('dias sueltos sin registro no se dramatizan', () => {
  const sueltos = mesProlijo.filter((c) => !['2026-09-05', '2026-09-14'].includes(c.fecha));
  const p = resumenDeConsulta(plan, config, sueltos, [], HASTA).puntos.find((x) => x.id === 'dias-sin-registro');
  assert.equal(p?.severidad, 'baja');
});

test('una comida que falta la mayoria de los dias se nombra', () => {
  const sinMerienda = mesProlijo.filter((c) => c.slotId !== 'merienda');
  const p = resumenDeConsulta(plan, config, sinMerienda, [], HASTA).puntos.find((x) => x.id === 'falta-merienda');
  assert.ok(p, 'deberia aparecer la merienda');
  assert.match(p!.titulo, /Merienda falta 28 de 28 días/);
});

test('una comida que falta pocas veces no se nombra', () => {
  const casiTodas = mesProlijo.filter(
    (c) => !(c.slotId === 'merienda' && ['2026-09-03', '2026-09-04'].includes(c.fecha)),
  );
  const p = resumenDeConsulta(plan, config, casiTodas, [], HASTA).puntos.find((x) => x.id === 'falta-merienda');
  assert.equal(p, undefined);
});

test('la proteina baja se reporta con cuanto falta por dia', () => {
  const flojo = mesProlijo.map((c) => ({ ...c, proteinGrams: 20 }));
  const p = resumenDeConsulta(plan, config, flojo, [], HASTA).puntos.find((x) => x.id === 'proteina-baja');
  assert.equal(p?.severidad, 'alta');
  assert.match(p!.titulo, /60 g sobre 120 g/);
});

test('una proteina apenas por debajo no dispara nada', () => {
  const casi = mesProlijo.map((c) => ({ ...c, proteinGrams: 38 }));
  const p = resumenDeConsulta(plan, config, casi, [], HASTA).puntos.find((x) => x.id === 'proteina-baja');
  assert.equal(p, undefined);
});

test('dos comidas del 20% el mismo dia se marcan', () => {
  const conLibres = mesProlijo.map((c) =>
    c.fecha === '2026-09-12' && c.slotId !== 'merienda' ? { ...c, esLibre: true } : c);
  const p = resumenDeConsulta(plan, config, conLibres, [], HASTA).puntos.find((x) => x.id === 'libres-amontonadas');
  assert.deepEqual(p?.fechas, ['2026-09-12']);
});

test('una regla incumplida varias veces aparece con su texto', () => {
  // Almuerzo y cena con hidrato el mismo dia, tres dias distintos.
  const conHidratos = mesProlijo.map((c) =>
    ['2026-09-02', '2026-09-03', '2026-09-04'].includes(c.fecha) && c.slotId !== 'merienda'
      ? { ...c, porciones: { hidratos: 'Arroz o avena', proteinas: 'Pollo' } }
      : c);
  const p = resumenDeConsulta(plan, config, conHidratos, [], HASTA).puntos.find((x) => x.id === 'regla-hidrato-cena');
  assert.ok(p, 'deberia detectar el hidrato repetido');
  assert.match(p!.titulo, /Se repitió 3 veces/);
  assert.match(p!.titulo, /en la cena evitar agregarlo/);
});

test('una regla incumplida una sola vez no llega al resumen', () => {
  const unaVez = mesProlijo.map((c) =>
    c.fecha === '2026-09-02' && c.slotId !== 'merienda'
      ? { ...c, porciones: { hidratos: 'Arroz o avena' } }
      : c);
  const p = resumenDeConsulta(plan, config, unaVez, [], HASTA).puntos.find((x) => x.id === 'regla-hidrato-cena');
  assert.equal(p, undefined);
});

test('peso quieto con cintura en baja se nombra para la consulta', () => {
  const medidas: Medida[] = [
    { fecha: '2026-09-01', pesoKg: 80, cinturaCm: 92 },
    { fecha: '2026-09-08', pesoKg: 80.1, cinturaCm: 91.5 },
    { fecha: '2026-09-15', pesoKg: 80, cinturaCm: 90.5 },
    { fecha: '2026-09-22', pesoKg: 80.1, cinturaCm: 90 },
  ];
  const p = resumenDeConsulta(plan, config, mesProlijo, medidas, HASTA).puntos.find((x) => x.id === 'recomposicion');
  assert.ok(p);
});

test('un mes entero sin mover nada se marca', () => {
  const medidas: Medida[] = dias(1, 4).map((fecha) => ({ fecha, pesoKg: 80, cinturaCm: 92 }));
  const p = resumenDeConsulta(plan, config, mesProlijo, medidas, HASTA).puntos.find((x) => x.id === 'sin-cambios');
  assert.equal(p?.severidad, 'media');
});

test('las medidas de fuera del periodo no entran', () => {
  const viejas: Medida[] = [{ fecha: '2026-06-01', pesoKg: 90 }, { fecha: '2026-06-08', pesoKg: 89 }];
  const r = resumenDeConsulta(plan, config, mesProlijo, viejas, HASTA);
  assert.equal(r.peso.mediciones, 0);
});

test('los desvios con nota se listan del mas reciente al mas viejo', () => {
  const conNotas: ComidaDeConsulta[] = [
    ...mesProlijo,
    { fecha: '2026-09-10', slotId: 'cena', nota: 'Milanesa con papas', optionId: null },
    { fecha: '2026-09-20', slotId: 'cena', nota: 'Pizza', optionId: null },
  ];
  const r = resumenDeConsulta(plan, config, conNotas, [], HASTA);
  assert.deepEqual(r.desvios.map((d) => d.nota), ['Pizza', 'Milanesa con papas']);
});

test('una comida del 20% no se lista como desvio', () => {
  // Es parte del plan, no una desviacion: mezclarlas confunde la conversacion.
  const conLibre: ComidaDeConsulta[] = [
    ...mesProlijo,
    { fecha: '2026-09-19', slotId: 'cena', nota: 'Asado', esLibre: true, optionId: null },
  ];
  assert.deepEqual(resumenDeConsulta(plan, config, conLibre, [], HASTA).desvios, []);
});

test('no reclama el desayuno a quien hace ayuno sin desayuno', () => {
  // El plan declara el slot y la config lo apaga. Reclamarlo le diria a la
  // nutricionista que se saltea una comida que ella misma no indico.
  const r = resumenDeConsulta(plan, config, mesProlijo, [], HASTA);
  assert.equal(r.puntos.find((p) => p.id === 'falta-desayuno'), undefined);
});

test('la adherencia se mide contra las comidas que esta persona tiene', () => {
  // Con el desayuno en el denominador, 3 de 3 daria 75% haga lo que haga.
  const r = resumenDeConsulta(plan, config, mesProlijo, [], HASTA);
  assert.equal(r.adherencia.esperadas, 84);
  assert.equal(r.adherencia.porcentaje, 100);
});

test('el presupuesto del 20% se escala al periodo, no a una semana', () => {
  // 4 por semana en 28 dias son 16, no 4: comparar contra 4 diria que se paso
  // cuatro veces alguien que fue prolijo todo el mes.
  const r = resumenDeConsulta(plan, config, mesProlijo, [], HASTA);
  assert.equal(r.libresPresupuesto, 16);
});

test('sin cambios y con adherencia floja no culpa al plan', () => {
  // El plan no llego a probarse: concluir que hay que cambiarlo seria sacar
  // una conclusion que estos datos no sostienen.
  const medioMes = dias(1, 14).flatMap(diaOk);
  const medidas: Medida[] = dias(1, 4).map((fecha) => ({ fecha, pesoKg: 80, cinturaCm: 92 }));
  const p = resumenDeConsulta(plan, config, medioMes, medidas, HASTA)
    .puntos.find((x) => x.id === 'sin-cambios');
  assert.match(p!.detalle, /no llegó a probarse/);
});

test('sin cambios pero con buena adherencia si señala al plan', () => {
  const medidas: Medida[] = dias(1, 4).map((fecha) => ({ fecha, pesoKg: 80, cinturaCm: 92 }));
  const p = resumenDeConsulta(plan, config, mesProlijo, medidas, HASTA)
    .puntos.find((x) => x.id === 'sin-cambios');
  assert.match(p!.detalle, /no movió la aguja/);
});
