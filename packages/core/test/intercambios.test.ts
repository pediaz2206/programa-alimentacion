import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeDailyBalance, sumProtein } from '../src/balance.ts';
import { freeMealSummary } from '../src/libres.ts';
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
  assert.equal(cena?.time, '21:30', 'la config pone la cena justo al cierre');
  assert.doesNotMatch(
    (cena?.warnings ?? []).join(' '),
    /cae fuera de la ventana/,
    'cerrar la ventana comiendo no es una infracción',
  );
});

test('una comida pasada la hora de cierre si avisa', () => {
  const tarde: UserConfig = {
    ...config,
    slots: config.slots.map((s) => (s.slotId === 'cena' ? { ...s, time: '22:30' } : s)),
  };
  const cena = buildDaySchedule(plan, tarde, new Date('2026-09-02T12:00:00'))
    .find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.match(cena?.warnings?.[0] ?? '', /cae fuera de la ventana/);
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

test('avisa cuando una comida arranca demasiado cerca del cierre de la ventana', () => {
  const cena = buildDaySchedule(plan, config, new Date('2026-09-02T12:00:00'))
    .find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.equal(cena?.time, '21:30');
  assert.match(cena?.warnings?.[0] ?? '', /vas a terminar de comer fuera de la ventana/);
});

test('con margen suficiente no avisa nada (cena 20:30, cierre 21:30)', () => {
  const holgado: UserConfig = {
    ...config,
    slots: config.slots.map((s) => (s.slotId === 'cena' ? { ...s, time: '20:30' } : s)),
  };
  const cena = buildDaySchedule(plan, holgado, new Date('2026-09-02T12:00:00'))
    .find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.equal(cena?.warnings, undefined);
});

test('el presupuesto de comidas del 20% sale del plan', () => {
  const resumen = freeMealSummary(plan, config);
  assert.equal(resumen.perWeek, 4);
  assert.equal(resumen.totalPerWeek, 21);
  assert.equal(resumen.planned.length, 3);
  assert.equal(resumen.unassigned, 1, 'queda una libre sin ubicar');
  assert.equal(resumen.overBudget, 0);
});

test('avisa si se asignan más comidas del 20% que las permitidas', () => {
  const pasado: UserConfig = {
    ...config,
    freeMeals: [
      { weekday: 6, slotId: 'almuerzo' }, { weekday: 6, slotId: 'cena' },
      { weekday: 0, slotId: 'almuerzo' }, { weekday: 0, slotId: 'cena' },
      { weekday: 5, slotId: 'cena' },
    ],
  };
  const resumen = freeMealSummary(plan, pasado);
  assert.equal(resumen.overBudget, 1);
  assert.ok(resumen.warnings.some((w) => w.includes('permite 4')));
});

test('avisa si se amontonan en un mismo día', () => {
  const amontonadas: UserConfig = {
    ...config,
    freeMeals: [
      { weekday: 6, slotId: 'almuerzo' }, { weekday: 6, slotId: 'merienda' }, { weekday: 6, slotId: 'cena' },
    ],
  };
  const resumen = freeMealSummary(plan, amontonadas);
  assert.ok(resumen.warnings.some((w) => w.includes('sábado') && w.includes('no juntar más de 2')));
});

test('la comida del 20% no propone platos del plan', () => {
  const sabado = new Date('2026-09-05T12:00:00');
  assert.equal(sabado.getDay(), 6);
  const cena = buildDaySchedule(plan, config, sabado).find((e) => e.kind === 'meal' && e.slotId === 'cena');
  assert.equal(cena?.freeMeal, true);
  assert.deepEqual(cena?.suggestions, []);
  assert.match(cena?.body ?? '', /Comida del 20%/);
});

test('un día normal no tiene comidas libres', () => {
  const miercoles = new Date('2026-09-02T12:00:00');
  const comidas = buildDaySchedule(plan, config, miercoles).filter((e) => e.kind === 'meal');
  assert.ok(comidas.every((e) => !e.freeMeal));
});

test('validateConfig rechaza comidas del 20% en momentos inexistentes', () => {
  const roto: UserConfig = { ...config, freeMeals: [{ weekday: 6, slotId: 'brunch' }] };
  assert.ok(validateConfig(plan, roto).some((e) => e.includes('brunch')));
});
