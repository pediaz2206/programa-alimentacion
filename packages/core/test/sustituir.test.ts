import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  detalleDe, equivalenciasDe, gruposDe, proteinaDeDesvio, reemplazosDe, resumenDeDesvio,
} from '../src/sustituir.ts';
import type { NutritionPlan } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const almuerzo = plan.slots.find((s) => s.id === 'almuerzo')!;
const merienda = plan.slots.find((s) => s.id === 'merienda')!;

test('las equivalencias de proteína son las del plan, no una tabla genérica', () => {
  const opciones = equivalenciasDe(plan, 'proteinas');
  const etiquetas = opciones.map((o) => o.label);
  assert.ok(etiquetas.includes('Atún al natural'));
  assert.ok(etiquetas.includes('Soja texturizada'));
  assert.ok(opciones.every((o) => o.proteinGrams != null));
});

test('las de hidratos dependen del momento del día', () => {
  const enAlmuerzo = equivalenciasDe(plan, 'hidratos', 'almuerzo').map((o) => o.label);
  const enMerienda = equivalenciasDe(plan, 'hidratos', 'merienda').map((o) => o.label);
  assert.ok(enAlmuerzo.includes('Arroz o avena'));
  assert.ok(!enAlmuerzo.includes('Tostadas de arroz'), 'eso es de merienda');
  assert.ok(enMerienda.includes('Pan integral'));
  assert.ok(!enMerienda.includes('Papa chica'));
});

test('sin momento, se ven todas las del grupo', () => {
  assert.ok(equivalenciasDe(plan, 'hidratos').length
    > equivalenciasDe(plan, 'hidratos', 'almuerzo').length);
});

test('reemplazar busca por grupo, no por nombre del ingrediente', () => {
  // "No tengo pollo" -> el pollo es proteína -> qué más cuenta como proteína.
  const r = reemplazosDe(plan, 'proteinas', 'cena');
  assert.ok(r);
  assert.equal(r.grupo, 'Proteínas');
  assert.ok(r.opciones.some((o) => o.label === 'Pescado'));
});

test('un ingrediente sin grupo no tiene reemplazo que ofrecer', () => {
  assert.equal(reemplazosDe(plan, undefined), null);
  assert.equal(reemplazosDe(plan, 'inexistente'), null);
});

test('los grupos esperados salen de la fórmula del momento', () => {
  assert.deepEqual(gruposDe(plan, almuerzo), ['hidratos', 'proteinas', 'vegetales']);
  assert.deepEqual(gruposDe(plan, merienda), ['hidratos', 'proteinas', 'frutas', 'grasas']);
});

test('la proteína de un desvío sale de las equivalencias elegidas', () => {
  // Un asado: carne vacuna, sin hidratos, con ensalada.
  const desvio = { proteinas: 'Carne vacuna magra', hidratos: null, vegetales: 'Vegetales crudos' };
  assert.equal(proteinaDeDesvio(plan, desvio), 22);
});

test('lo no cubierto no suma proteína', () => {
  assert.equal(proteinaDeDesvio(plan, { proteinas: null, hidratos: null }), 0);
});

test('una equivalencia inventada no rompe el cálculo', () => {
  assert.equal(proteinaDeDesvio(plan, { proteinas: 'Pizza' }), 0);
});

test('el resumen nombra lo que faltó, que es lo accionable', () => {
  const texto = resumenDeDesvio(plan, almuerzo, {
    proteinas: 'Carne vacuna magra', hidratos: null, vegetales: 'Vegetales crudos',
  });
  assert.match(texto, /Cubrió/);
  assert.match(texto, /faltó hidratos/);
});

test('si no cubrió nada, lo dice sin rodeos', () => {
  const texto = resumenDeDesvio(plan, almuerzo, { proteinas: null, hidratos: null, vegetales: null });
  assert.match(texto, /^No cubrió/);
  assert.match(texto, /hidratos, proteínas y vegetales/, 'enumera en castellano');
});

test('si cubrió todo, no inventa una falta', () => {
  const texto = resumenDeDesvio(plan, almuerzo, {
    hidratos: 'Papa chica', proteinas: 'Pescado', vegetales: 'Vegetales cocidos',
  });
  assert.doesNotMatch(texto, /faltó|No cubrió/);
});

test('el detalle de una equivalencia se lee como en el plan', () => {
  const atun = equivalenciasDe(plan, 'proteinas').find((o) => o.label === 'Atún al natural')!;
  assert.equal(detalleDe(atun), '1 lata · 34 g de proteína');
  const papa = equivalenciasDe(plan, 'hidratos', 'almuerzo').find((o) => o.label === 'Papa chica')!;
  assert.equal(detalleDe(papa), '120 g en crudo');
});

// --- elegir el reemplazo, no solo mirarlo ---

import { porcionesDeChecklist, textoDeCambios } from '../src/sustituir.ts';
import type { Ingredient } from '../src/types.ts';

const checklist: Ingredient[] = [
  { item: 'Arroz', qty: 70, unit: 'g', groupId: 'hidratos' },
  { item: 'Pollo', qty: 150, unit: 'g', groupId: 'proteinas' },
  { item: 'Tomate', groupId: 'vegetales' },
  { item: 'Lechuga', groupId: 'vegetales' },
];

const lentejas = { label: 'Lentejas, arvejas, porotos o garbanzos', qty: 70, unit: 'g en crudo' };

test('sin cambios, las porciones son las de la comida tal cual', () => {
  assert.deepEqual(porcionesDeChecklist(checklist, {}), {
    hidratos: 'Arroz', proteinas: 'Pollo', vegetales: 'Tomate, Lechuga',
  });
});

test('el reemplazo elegido reemplaza en las porciones', () => {
  const p = porcionesDeChecklist(checklist, { 0: lentejas });
  assert.equal(p['hidratos'], 'Lentejas, arvejas, porotos o garbanzos');
  assert.equal(p['proteinas'], 'Pollo', 'lo que no se cambió queda igual');
});

test('cambiar uno de dos del mismo grupo conserva al otro', () => {
  const p = porcionesDeChecklist(checklist, { 2: { label: 'Zanahoria' } });
  assert.equal(p['vegetales'], 'Zanahoria, Lechuga');
});

test('un ingrediente sin grupo no aporta porciones', () => {
  assert.deepEqual(porcionesDeChecklist([{ item: 'Sal' }], {}), {});
});

test('los cambios se cuentan en una frase que se lee sola', () => {
  assert.equal(
    textoDeCambios(checklist, { 0: lentejas }),
    'Cambié Arroz por lentejas, arvejas, porotos o garbanzos.',
  );
});

test('varios cambios entran en la misma frase', () => {
  const t = textoDeCambios(checklist, { 0: lentejas, 1: { label: 'Pescado' } });
  assert.match(t, /Arroz por lentejas/);
  assert.match(t, /Pollo por pescado/);
});

test('sin cambios no hay frase que agregar', () => {
  assert.equal(textoDeCambios(checklist, {}), '');
});

test('un indice que ya no existe no rompe la frase', () => {
  // La comida sugerida puede cambiar entre que se elige y se registra.
  assert.equal(textoDeCambios(checklist, { 9: lentejas }), '');
});
