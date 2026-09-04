import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizar, porcionesDe, proteinaDe, reconocer, vocabularioDe,
  type IngredienteSuelto,
} from '../src/vocabulario.ts';
import type { NutritionPlan } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;

test('normalizar saca acentos, mayusculas y puntuacion', () => {
  assert.equal(normalizar('  Morrón, rojo!  '), 'morron rojo');
});

test('el vocabulario sale del plan y no se repite', () => {
  const v = vocabularioDe(plan);
  const claves = v.map((t) => t.clave);
  assert.equal(new Set(claves).size, claves.length);
  assert.ok(v.length > 40, `esperaba un diccionario util, hay ${v.length}`);
});

test('las equivalencias ganan sobre los ingredientes sueltos', () => {
  // Vienen con cantidad y proteína; un ingrediente suelto no.
  const t = vocabularioDe(plan).find((x) => x.clave === 'pechuga de pollo');
  assert.ok(t?.ex, 'pechuga de pollo deberia traer su equivalencia');
});

// --- el plato que Pablo iba a almorzar ---

test('reconoce los ingredientes de una tarta de verdura', () => {
  assert.equal(reconocer(plan, 'espinaca')?.groupId, 'vegetales');
  assert.equal(reconocer(plan, 'cebolla')?.groupId, 'vegetales');
  assert.equal(reconocer(plan, 'morrón')?.groupId, 'vegetales');
  assert.equal(reconocer(plan, 'queso port salut')?.groupId, 'proteinas');
});

test('lo que ni el plan ni las excepciones nombran no se adivina', () => {
  // Preferible pedirle el grupo una vez que inventarlo y ensuciar el historial.
  assert.equal(reconocer(plan, 'gelatina de frambuesa'), null);
  assert.equal(reconocer(plan, 'salsa golf casera'), null);
});

test('sin acentos encuentra lo mismo', () => {
  assert.equal(reconocer(plan, 'morron')?.groupId, 'vegetales');
  assert.equal(reconocer(plan, 'atun al natural')?.groupId, 'proteinas');
});

test('una coincidencia exacta se marca como tal', () => {
  assert.equal(reconocer(plan, 'Espinaca')?.confianza, 'exacta');
});

test('una coincidencia parcial se marca como parcial', () => {
  const r = reconocer(plan, 'arroz integral');
  assert.equal(r?.groupId, 'hidratos');
  assert.equal(r?.confianza, 'parcial');
});

test('gana el termino mas especifico, no el primero', () => {
  // "queso port salut" contiene "queso": tiene que ganar el largo.
  assert.equal(reconocer(plan, 'queso port salut')?.segun, 'Queso port salut');
});

test('una palabra en comun alcanza cuando no hay nada mejor', () => {
  assert.equal(reconocer(plan, 'zanahoria hervida')?.groupId, 'vegetales');
});

test('el texto vacio no reconoce nada', () => {
  assert.equal(reconocer(plan, '   '), null);
});

test('una palabra que solo es relleno no arrastra una coincidencia', () => {
  // "integral" sola no distingue pan de harina de fideos: no alcanza.
  assert.equal(reconocer(plan, 'integral'), null);
});

// --- de ingredientes a lo que el resto de la app entiende ---

test('los ingredientes se traducen al mapa de porciones', () => {
  const tarta: IngredienteSuelto[] = [
    { texto: 'Espinaca', groupId: 'vegetales' },
    { texto: 'Masa de tarta', groupId: 'hidratos' },
    { texto: 'Queso port salut', groupId: 'proteinas' },
  ];
  assert.deepEqual(porcionesDe(tarta), {
    vegetales: 'Espinaca',
    hidratos: 'Masa de tarta',
    proteinas: 'Queso port salut',
  });
});

test('dos ingredientes del mismo grupo se listan juntos', () => {
  // La tarta lleva espinaca Y cebolla: quedarse con una pierde medio plato.
  const p = porcionesDe([
    { texto: 'Espinaca', groupId: 'vegetales' },
    { texto: 'Cebolla', groupId: 'vegetales' },
    { texto: 'Morrón', groupId: 'vegetales' },
  ]);
  assert.equal(p['vegetales'], 'Espinaca, Cebolla, Morrón');
});

test('un ingrediente sin grupo no entra en las porciones', () => {
  const p = porcionesDe([
    { texto: 'Sal', groupId: null },
    { texto: 'Espinaca', groupId: 'vegetales' },
  ]);
  assert.deepEqual(p, { vegetales: 'Espinaca' });
});

test('la proteina sale de las equivalencias reconocidas, no de una tabla inventada', () => {
  const ex = reconocer(plan, 'queso port salut')!.ex!;
  const total = proteinaDe([{ texto: 'Queso port salut', groupId: 'proteinas', ex }]);
  assert.equal(total, ex.proteinGrams);
  assert.ok(total > 0);
});

test('un ingrediente al que le sacaron el grupo deja de sumar proteina', () => {
  const ex = reconocer(plan, 'queso port salut')!.ex!;
  assert.equal(proteinaDe([{ texto: 'Queso', groupId: null, ex }]), 0);
});

// --- el bug que la lista de excepciones destapo ---

test('una palabra no coincide por estar adentro de otra', () => {
  // "sal" estaba dentro de "queso port salut" y "mate" dentro de "tomates
  // cherry": la app decia que la sal era proteina y el mate, vegetal.
  const sal = reconocer(plan, 'sal');
  assert.notEqual(sal?.segun, 'Queso port salut');
  const mate = reconocer(plan, 'mate');
  assert.notEqual(mate?.segun, 'Tomates cherry');
});

test('la coincidencia por palabras enteras sigue funcionando', () => {
  assert.equal(reconocer(plan, 'queso port salut')?.groupId, 'proteinas');
  assert.equal(reconocer(plan, 'pan lactal')?.groupId, 'hidratos');
});

// --- las notas del plan tambien son vocabulario ---

test('los cortes que enumera una nota se reconocen', () => {
  // "Carne vacuna magra" trae "nalga, peceto, cuadril, bola de lomo, lomo".
  for (const corte of ['nalga', 'peceto', 'cuadril', 'bola de lomo']) {
    assert.equal(reconocer(plan, corte)?.groupId, 'proteinas', `${corte} deberia ser proteina`);
  }
});

test('las notas que son indicaciones y no alimentos no entran al diccionario', () => {
  assert.equal(reconocer(plan, 'cucharadas'), null);
  assert.equal(reconocer(plan, 'discos'), null);
});

// --- las excepciones ---

test('lo que no ocupa lugar se distingue de lo desconocido', () => {
  // Dos "null" distintos: uno es "sé que no cuenta", el otro "no sé qué es".
  const agua = reconocer(plan, 'agua');
  assert.equal(agua?.groupId, null);
  assert.notEqual(agua, null, 'el agua tiene que reconocerse');
  assert.equal(reconocer(plan, 'gelatina de frambuesa'), null);
});

test('una bebida vegetal no pasa por proteina', () => {
  const r = reconocer(plan, 'leche de almendras');
  assert.equal(r?.groupId, null);
  assert.match(r!.nota!, /no equivale a una porción de proteína/i);
});

test('el dulce de leche no es lacteo a los ojos del plan', () => {
  assert.equal(reconocer(plan, 'dulce de leche')?.groupId, null);
});

test('la leche sola sigue siendo proteina', () => {
  // La excepción corrige los homónimos, no tapa el término original.
  assert.equal(reconocer(plan, 'leche')?.groupId, 'proteinas');
});

test('la comida de todos los dias cae en su grupo predominante', () => {
  assert.equal(reconocer(plan, 'milanesa')?.groupId, 'proteinas');
  assert.equal(reconocer(plan, 'pizza')?.groupId, 'hidratos');
  assert.equal(reconocer(plan, 'masa de tarta')?.groupId, 'hidratos');
  assert.equal(reconocer(plan, 'ensalada')?.groupId, 'vegetales');
  assert.equal(reconocer(plan, 'nueces')?.groupId, 'grasas');
  assert.equal(reconocer(plan, 'uvas')?.groupId, 'frutas');
});

test('una excepcion avisa cuando el plato tiene mas de un grupo', () => {
  assert.match(reconocer(plan, 'milanesa')!.nota!, /rebozado/);
});

test('las excepciones del plan le ganan a las de la app', () => {
  // Quien escribió el plan sabe más que una lista general.
  const conSuyas = {
    ...plan,
    excepciones: [{ termino: 'milanesa', groupId: 'hidratos', nota: 'Acá la contamos así.' }],
  };
  assert.equal(reconocer(conSuyas, 'milanesa')?.groupId, 'hidratos');
});

test('una excepcion no le gana a una coincidencia exacta del plan', () => {
  // El plan nombra "Palta" en grasas; ninguna excepción debe pisarlo.
  assert.equal(reconocer(plan, 'palta')?.groupId, 'grasas');
});

test('lo que no cuenta no aporta porciones ni proteina', () => {
  const p = porcionesDe([
    { texto: 'Agua', groupId: null, conocido: true },
    { texto: 'Espinaca', groupId: 'vegetales' },
  ]);
  assert.deepEqual(p, { vegetales: 'Espinaca' });
});
