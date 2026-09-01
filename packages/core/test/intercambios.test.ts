import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeDailyBalance, sumProtein } from '../src/balance.ts';
import { buildDaySchedule, describeFormula } from '../src/schedule.ts';
import { validateConfig, validatePlan } from '../src/validate.ts';
import type { MealOption, NutritionPlan, UserConfig } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;

test('el plan transcrito de los PDF es valido', () => {
  assert.deepEqual(validatePlan(plan), []);
  assert.deepEqual(validateConfig(plan, config), []);
});

test('cada momento con formula referencia grupos que existen', () => {
  const ids = new Set(plan.foodGroups.map((g) => g.id));
  for (const slot of plan.slots) {
    for (const comp of slot.formula ?? []) assert.ok(ids.has(comp.groupId), `${slot.id} -> ${comp.groupId}`);
  }
});

test('describeFormula arma la consigna de la comida', () => {
  const almuerzo = plan.slots.find((s) => s.id === 'almuerzo')!;
  assert.equal(
    describeFormula(plan, almuerzo),
    '1 opción de hidratos + 1 porción (aprox. 200 g) de proteínas + 1/3 del plato de vegetales',
  );
});

test('los momentos sin formula no inventan una', () => {
  const colacion = plan.slots.find((s) => s.id === 'colacion')!;
  assert.equal(describeFormula(plan, colacion), undefined);
});

test('la agenda muestra la formula en vez del metodo del plato', () => {
  const events = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));
  const almuerzo = events.find((e) => e.kind === 'meal' && e.slotId === 'almuerzo');
  assert.match(almuerzo?.body ?? '', /^Armá: 1 opción de hidratos/);
  assert.doesNotMatch(almuerzo?.body ?? '', /Plato:/);
});

test('el desayuno queda fuera de la agenda mientras haya ayuno', () => {
  const events = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));
  assert.equal(events.some((e) => e.slotId === 'desayuno'), false);
});

test('la proteina se acumula en gramos', () => {
  const dos = plan.options.filter((o) => ['am-arroz-atun', 'mer-bowl-yogur'].includes(o.id));
  assert.equal(sumProtein(dos), 54);
});

test('el balance reporta cuanta proteina falta para los 120 g', () => {
  const balance = computeDailyBalance(plan, plan.options.filter((o) => o.id === 'am-pollo-salteado'));
  assert.equal(balance.protein?.target, 120);
  assert.equal(balance.protein?.consumed, 40);
  assert.equal(balance.protein?.remaining, 80);
  assert.ok(balance.advice.some((a) => a.includes('80 g de proteína')));
});

test('sin objetivo proteico el balance no inventa uno', () => {
  const sinObjetivo: NutritionPlan = { ...plan, proteinTargetGrams: undefined };
  assert.equal(computeDailyBalance(sinObjetivo, []).protein, undefined);
});

test('validatePlan rechaza un objetivo proteico invalido', () => {
  assert.ok(validatePlan({ ...plan, proteinTargetGrams: 0 }).some((e) => e.includes('proteinTargetGrams')));
});

test('validatePlan detecta equivalencias con momentos inexistentes', () => {
  const roto: NutritionPlan = {
    ...plan,
    foodGroups: plan.foodGroups.map((g) =>
      g.id === 'hidratos' ? { ...g, exchanges: [{ label: 'Fantasma', slotIds: ['brunch'] }] } : g,
    ),
  };
  assert.ok(validatePlan(roto).some((e) => e.includes('"brunch"')));
});

test('las equivalencias de proteina traen su aporte en gramos', () => {
  const proteinas = plan.foodGroups.find((g) => g.id === 'proteinas')!;
  const atun = proteinas.exchanges?.find((e) => e.label.startsWith('Atún'));
  assert.equal(atun?.proteinGrams, 34);
  assert.ok((proteinas.exchanges ?? []).every((e) => e.proteinGrams != null));
});

test('las ideas cubren todos los momentos del plan', () => {
  for (const slot of plan.slots) {
    const n = plan.options.filter((o: MealOption) => o.slotIds.includes(slot.id)).length;
    assert.ok(n > 0, `${slot.id} se quedo sin ideas`);
  }
});

test('una comida justo en la hora de cierre sigue estando dentro de la ventana', () => {
  const events = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));
  const cena = events.find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.equal(cena?.time, '20:00', 'la config pone la cena justo al cierre');
  assert.equal(cena?.warnings, undefined, 'cerrar la ventana comiendo no es una infracción');
});

test('una comida pasada la hora de cierre si avisa', () => {
  const tarde: UserConfig = {
    ...config,
    slots: config.slots.map((s) => (s.slotId === 'cena' ? { ...s, time: '20:30' } : s)),
  };
  const cena = buildDaySchedule(plan, tarde, new Date('2026-09-02T12:00:00'))
    .find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.match(cena?.warnings?.[0] ?? '', /fuera de la ventana/);
});

test('las sugerencias empujan hacia el objetivo proteico', () => {
  const events = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'));
  const elegidas = events
    .filter((e) => e.kind === 'meal')
    .map((e) => e.suggestions?.[0])
    .filter((o): o is NonNullable<typeof o> => o != null);
  const total = elegidas.reduce((a, o) => a + (o.proteinGrams ?? 0), 0);
  assert.ok(total >= 100, `el día proyectado suma ${total} g de proteína, muy lejos de los 120`);
});
