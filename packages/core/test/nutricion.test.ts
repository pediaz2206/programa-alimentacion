import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyBalance, remainingPortions, sumPortions } from '../src/balance.ts';
import { buildShoppingList, checklistFor, formatCantidad, pluralizar } from '../src/shopping.ts';
import { describePlate, plateFor } from '../src/plate.ts';
import { validateConfig, validatePlan } from '../src/validate.ts';
import { config, plan } from './fixtures.ts';
import type { MealOption, NutritionPlan, UserConfig } from '../src/types.ts';

const byId = (id: string): MealOption => plan.options.find((o) => o.id === id)!;

test('sumPortions acumula por grupo', () => {
  assert.deepEqual(sumPortions([byId('avena'), byId('pollo')]), { carb: 2, prot: 1, veg: 1 });
});

test('el balance diario dice que falta cubrir', () => {
  const balance = computeDailyBalance(plan, [byId('pollo')]);
  const prot = balance.groups.find((g) => g.groupId === 'prot')!;
  assert.equal(prot.consumed, 1);
  assert.equal(prot.remaining, 1);
  assert.ok(balance.advice.some((a) => a.includes('proteinas')));
});

test('el balance avisa cuando un grupo se pasa del objetivo', () => {
  const balance = computeDailyBalance(plan, [byId('pollo'), byId('pescado'), byId('avena')]);
  assert.ok(balance.advice.some((a) => a.includes('supera el objetivo')));
});

test('dia completo cuando todos los grupos estan cubiertos', () => {
  const balance = computeDailyBalance(plan, [byId('pollo'), byId('pescado')]);
  assert.deepEqual(balance.advice, ['Dia completo: todos los objetivos cubiertos.']);
});

test('remainingPortions alimenta al selector', () => {
  const balance = computeDailyBalance(plan, [byId('pollo')]);
  assert.deepEqual(remainingPortions(balance), { prot: 1, carb: 1, veg: 1 });
});

test('la lista de compras suma cantidades del mismo ingrediente', () => {
  const repetido: MealOption = { ...byId('pollo'), id: 'x', name: 'Otro pollo' };
  const list = buildShoppingList([byId('pollo'), repetido]);
  const pollo = list.find((i) => i.item === 'Pollo')!;
  assert.equal(pollo.qty, 300);
  assert.equal(pollo.unit, 'g');
  assert.deepEqual(pollo.usedIn, ['Pollo con arroz', 'Otro pollo']);
});

test('la lista de compras marca unidades incompatibles en vez de sumar mal', () => {
  const enUnidades: MealOption = {
    id: 'y',
    name: 'Pollo entero',
    slotIds: ['cena'],
    ingredients: [{ item: 'pollo', qty: 1, unit: 'unidad' }],
  };
  const list = buildShoppingList([byId('pollo'), enUnidades]);
  const pollo = list.find((i) => i.item.toLowerCase() === 'pollo')!;
  assert.equal(pollo.mixedUnits, true);
  assert.equal(pollo.qty, undefined);
});

test('la lista de compras ignora los basicos de alacena', () => {
  const list = buildShoppingList([byId('avena')]);
  assert.deepEqual(list.map((i) => i.item), ['Avena']);
});

test('checklistFor deja afuera los staples', () => {
  assert.deepEqual(checklistFor(byId('avena')).map((i) => i.item), ['Avena']);
});

test('describePlate usa fracciones legibles', () => {
  const slot = plan.slots.find((s) => s.id === 'almuerzo')!;
  const plate = plateFor(plan, slot)!;
  assert.equal(describePlate(plate, plan.foodGroups), '1/2 Vegetales · 1/4 Proteinas · 1/4 Carbohidratos');
});

test('el plan de prueba es valido', () => {
  assert.deepEqual(validatePlan(plan), []);
  assert.deepEqual(validateConfig(plan, config), []);
});

test('validatePlan detecta un plato que no suma 1', () => {
  const roto: NutritionPlan = {
    ...plan,
    slots: plan.slots.map((s) =>
      s.id === 'almuerzo' ? { ...s, plateTarget: { veg: 0.5, prot: 0.2 } } : s,
    ),
  };
  assert.ok(validatePlan(roto).some((e) => e.includes('deberian sumar 1')));
});

test('validatePlan detecta referencias a grupos y momentos inexistentes', () => {
  const roto: NutritionPlan = {
    ...plan,
    options: [...plan.options, {
      id: 'fantasma',
      name: 'Fantasma',
      slotIds: ['brunch'],
      portions: { fibra: 1 },
      ingredients: [{ item: 'Algo', groupId: 'fibra' }],
    }],
  };
  const errors = validatePlan(roto);
  assert.ok(errors.some((e) => e.includes('"brunch"')));
  assert.ok(errors.some((e) => e.includes('"fibra"')));
});

test('validatePlan avisa si un momento quedo sin opciones', () => {
  const roto: NutritionPlan = { ...plan, options: plan.options.filter((o) => o.id !== 'avena') };
  assert.ok(validatePlan(roto).some((e) => e.includes('no tiene ninguna opcion cargada')));
});

test('validateConfig rechaza una ventana de ayuno imposible', () => {
  const roto: UserConfig = {
    ...config,
    fasting: { enabled: true, eatingWindowStart: '12:00', eatingWindowHours: 26 },
  };
  assert.ok(validateConfig(plan, roto).some((e) => e.includes('entre 0 y 24 horas')));
});

test('validateConfig rechaza momentos y horas inexistentes', () => {
  const roto: UserConfig = { ...config, slots: [{ slotId: 'brunch' }, { slotId: 'cena', time: '25:00' }] };
  const errors = validateConfig(plan, roto);
  assert.ok(errors.some((e) => e.includes('"brunch"')));
  assert.ok(errors.some((e) => e.includes('25:00')));
});

test('el plan de ejemplo del repo es valido', async () => {
  const { readFileSync } = await import('node:fs');
  const ejemplo = JSON.parse(readFileSync('data/plan.ejemplo.json', 'utf8')) as NutritionPlan;
  const cfg = JSON.parse(readFileSync('data/config.ejemplo.json', 'utf8')) as UserConfig;
  assert.deepEqual(validatePlan(ejemplo), []);
  assert.deepEqual(validateConfig(ejemplo, cfg), []);
});

test('las unidades se pluralizan como en castellano', () => {
  assert.equal(formatCantidad(1, 'unidad'), '1 unidad');
  assert.equal(formatCantidad(14, 'unidad'), '14 unidades');
  assert.equal(formatCantidad(2, 'rebanada'), '2 rebanadas');
  assert.equal(formatCantidad(3, 'taza'), '3 tazas');
});

test('las abreviaturas no se pluralizan: nadie escribe "500 gs"', () => {
  assert.equal(formatCantidad(500, 'g'), '500 g');
  assert.equal(formatCantidad(250, 'ml'), '250 ml');
  assert.equal(formatCantidad(2, 'cda'), '2 cda');
});

test('una unidad compuesta se pluraliza en su primera palabra', () => {
  assert.equal(formatCantidad(2, 'rebanada de pan'), '2 rebanadas de pan');
});

test('si esa primera palabra es una abreviatura, no se pluraliza nada', () => {
  // El plan mide en "g en crudo": "120 gs en crudo" no lo escribe nadie.
  assert.equal(formatCantidad(120, 'g en crudo'), '120 g en crudo');
  assert.equal(formatCantidad(100, 'g cocidos'), '100 g cocidos');
});

test('reglas del plural para consonantes', () => {
  assert.equal(pluralizar('unidad', 2), 'unidades');
  assert.equal(pluralizar('nuez', 2), 'nueces');
  assert.equal(pluralizar('lata', 2), 'latas');
  assert.equal(pluralizar('gajos', 2), 'gajos', 'ya está en plural');
});

test('las cantidades decimales usan coma', () => {
  assert.equal(formatCantidad(0.25, 'unidad'), '0,25 unidades');
  assert.equal(formatCantidad(0.5, ''), '0,5');
});
