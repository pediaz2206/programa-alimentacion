import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planificarCompras, porGrupo } from '../src/compras.ts';
import type { NutritionPlan, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;
const miercoles = new Date('2026-09-02T12:00:00');

test('planifica todas las comidas de los días pedidos', () => {
  const p = planificarCompras(plan, config, miercoles, 3);
  // Almuerzo, merienda y cena por día; desayuno y colación están desactivados.
  assert.equal(p.comidas.length, 9);
  assert.equal(p.dias, 3);
});

test('la lista consolida ingredientes repetidos entre días', () => {
  const p = planificarCompras(plan, config, miercoles, 7);
  const nombres = p.items.map((i) => i.item);
  assert.equal(new Set(nombres).size, nombres.length, 'no puede haber un ítem dos veces');
  assert.ok(p.items.length > 0);
});

test('cada ítem dice en qué comidas se usa', () => {
  const p = planificarCompras(plan, config, miercoles, 3);
  for (const item of p.items) {
    assert.ok(item.usedIn.length > 0, `${item.item} no dice de dónde sale`);
  }
});

test('no se compra para las comidas del 20%', () => {
  // El sábado tiene almuerzo y cena marcados como libres.
  const sabado = new Date('2026-09-05T12:00:00');
  const p = planificarCompras(plan, config, sabado, 1);
  assert.equal(p.libres, 2);
  assert.equal(p.comidas.length, 1, 'solo queda la merienda');
});

test('los básicos de alacena no van a la lista', () => {
  const p = planificarCompras(plan, config, miercoles, 7);
  assert.equal(p.items.some((i) => i.item === 'Sal'), false);
  assert.equal(p.items.some((i) => i.item.startsWith('Aceite')), false);
});

test('agrupa por grupo de alimento, en el orden del plan', () => {
  const p = planificarCompras(plan, config, miercoles, 5);
  const grupos = porGrupo(plan, p.items);
  assert.ok(grupos.length > 1);
  const ids = grupos.map((g) => g.groupId);
  const esperado = plan.foodGroups.map((g) => g.id).filter((id) => ids.includes(id));
  assert.deepEqual(ids.filter((id) => id !== 'otros'), esperado);
});

test('lo que no tiene grupo cae en "Otros", al final', () => {
  const p = planificarCompras(plan, config, miercoles, 7);
  const grupos = porGrupo(plan, p.items);
  const otros = grupos.find((g) => g.groupId === 'otros');
  if (otros) {
    assert.equal(grupos[grupos.length - 1]?.groupId, 'otros');
    assert.ok(otros.items.length > 0);
  }
});

test('más días nunca dan menos ingredientes', () => {
  const tres = planificarCompras(plan, config, miercoles, 3);
  const siete = planificarCompras(plan, config, miercoles, 7);
  assert.ok(siete.items.length >= tres.items.length);
  assert.ok(siete.comidas.length > tres.comidas.length);
});

test('cero días da una lista vacía y no rompe', () => {
  const p = planificarCompras(plan, config, miercoles, 0);
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.comidas, []);
});
