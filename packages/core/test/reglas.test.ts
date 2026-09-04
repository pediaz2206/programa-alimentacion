import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluarReglas, frase, gruposComidos, gruposDeOpcion, respeta,
  type ComidaDelDia,
} from '../src/reglas.ts';
import type { MealOption, NutritionPlan } from '../src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.pablo.json', 'utf8')) as NutritionPlan;

const opcionCon = (id: string, grupos: string[]): MealOption => ({
  id, name: id, slotIds: ['cena'],
  ingredients: grupos.map((groupId) => ({ item: groupId, groupId })),
});

/** Un almuerzo registrado como desvio, declarando los grupos que tuvo. */
const desvio = (slotId: string, grupos: string[]): ComidaDelDia => ({
  slotId,
  optionId: null,
  porciones: Object.fromEntries(grupos.map((g) => [g, 'algo'])),
});

test('el plan declara las cuatro reglas verificables', () => {
  assert.deepEqual(
    (plan.reglas ?? []).map((r) => r.id),
    ['grasas-una-vez', 'hidrato-cena', 'frutas-dia', 'libres-espaciadas'],
  );
});

test('cada regla conserva la redaccion de la nutricionista', () => {
  for (const regla of plan.reglas ?? []) {
    assert.ok(
      (plan.guidelines ?? []).includes(regla.texto),
      `la regla ${regla.id} deberia citar una indicacion del plan`,
    );
  }
});

// --- de que esta hecha una comida ---

test('gruposComidos lee el desvio por grupo', () => {
  const grupos = gruposComidos(plan, desvio('almuerzo', ['hidratos', 'proteinas']));
  assert.deepEqual([...grupos!].sort(), ['hidratos', 'proteinas']);
});

test('gruposComidos ignora los grupos que se marcaron como no comidos', () => {
  const grupos = gruposComidos(plan, {
    slotId: 'almuerzo', optionId: null,
    porciones: { hidratos: null, proteinas: 'Pescado' },
  });
  assert.deepEqual([...grupos!], ['proteinas']);
});

test('gruposComidos resuelve una opcion del plan por sus ingredientes', () => {
  const opcion = plan.options.find((o) => o.id === 'am-omelette-pollo')!;
  const grupos = gruposComidos(plan, { slotId: 'almuerzo', optionId: opcion.id });
  assert.ok(grupos!.has('proteinas'));
  assert.ok(grupos!.has('hidratos'), 'el choclo es hidrato');
});

test('una comida libre sin detalle es desconocida, no vacia', () => {
  // Importa la diferencia: sobre lo desconocido no se dispara ninguna regla.
  assert.equal(gruposComidos(plan, { slotId: 'almuerzo', esLibre: true }), null);
});

test('gruposDeOpcion descarta los ingredientes de alacena', () => {
  const opcion: MealOption = {
    id: 'x', name: 'x', slotIds: ['cena'],
    ingredients: [
      { item: 'Pollo', groupId: 'proteinas' },
      { item: 'Aceite de oliva', groupId: 'grasas', staple: true },
    ],
  };
  assert.deepEqual([...gruposDeOpcion(opcion)], ['proteinas']);
});

// --- regla 3: el hidrato del almuerzo cierra el de la cena ---

test('si el almuerzo trajo hidrato, la cena lo cierra', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('almuerzo', ['hidratos'])], 'cena');
  assert.equal(cerrados.length, 1);
  assert.equal(cerrados[0]?.groupId, 'hidratos');
  assert.equal(cerrados[0]?.reglaId, 'hidrato-cena');
  assert.match(cerrados[0]!.motivo, /Almuerzo/i);
});

test('si el almuerzo no trajo hidrato, la cena queda libre', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('almuerzo', ['proteinas'])], 'cena');
  assert.deepEqual(cerrados.filter((c) => c.reglaId === 'hidrato-cena'), []);
});

test('la regla del hidrato no aplica al almuerzo mismo', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('desayuno', ['hidratos'])], 'almuerzo');
  assert.deepEqual(cerrados.filter((c) => c.reglaId === 'hidrato-cena'), []);
});

test('un almuerzo libre sin detalle no cierra la cena', () => {
  // No sabemos que comio: suponerlo seria peor que callarse.
  const { cerrados } = evaluarReglas(plan, [{ slotId: 'almuerzo', esLibre: true }], 'cena');
  assert.deepEqual(cerrados.filter((c) => c.reglaId === 'hidrato-cena'), []);
});

// --- regla 2: la grasa, una vez al dia ---

test('la grasa usada en el desayuno cierra el grupo en la merienda', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('desayuno', ['grasas'])], 'merienda');
  const grasa = cerrados.find((c) => c.reglaId === 'grasas-una-vez');
  assert.ok(grasa);
  assert.match(grasa!.motivo, /desayuno/i);
});

test('la comida en curso no se cierra a si misma', () => {
  // Editar un registro ya hecho no tiene que hacerlo chocar con su propia regla.
  const { cerrados } = evaluarReglas(plan, [desvio('merienda', ['grasas'])], 'merienda');
  assert.deepEqual(cerrados.filter((c) => c.reglaId === 'grasas-una-vez'), []);
});

// --- regla 4: las frutas del dia ---

test('sin frutas registradas faltan las dos', () => {
  const { pendientes } = evaluarReglas(plan, [desvio('almuerzo', ['proteinas'])], 'merienda');
  const fruta = pendientes.find((p) => p.reglaId === 'frutas-dia');
  assert.equal(fruta?.faltan, 2);
});

test('con una fruta ya comida falta una', () => {
  const { pendientes } = evaluarReglas(plan, [desvio('desayuno', ['frutas'])], 'merienda');
  assert.equal(pendientes.find((p) => p.reglaId === 'frutas-dia')?.faltan, 1);
});

test('cubierto el minimo, la fruta deja de figurar como pendiente', () => {
  const comidas = [desvio('desayuno', ['frutas']), desvio('almuerzo', ['frutas'])];
  const { pendientes } = evaluarReglas(plan, comidas, 'merienda');
  assert.deepEqual(pendientes.filter((p) => p.reglaId === 'frutas-dia'), []);
});

// --- regla 8: las comidas del 20% no se amontonan ---

test('una segunda comida libre el mismo dia avisa', () => {
  const { avisos } = evaluarReglas(plan, [{ slotId: 'almuerzo', esLibre: true }], 'cena');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0]?.reglaId, 'libres-espaciadas');
});

test('la primera comida libre del dia no avisa', () => {
  const { avisos } = evaluarReglas(plan, [desvio('almuerzo', ['proteinas'])], 'cena');
  assert.deepEqual(avisos, []);
});

// --- lo que se hace con el resultado ---

test('respeta descarta las opciones que traen un grupo cerrado', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('almuerzo', ['hidratos'])], 'cena');
  assert.equal(respeta(opcionCon('con-arroz', ['hidratos', 'proteinas']), cerrados), false);
  assert.equal(respeta(opcionCon('solo-proteina', ['proteinas', 'vegetales']), cerrados), true);
});

test('sin reglas activas toda opcion respeta', () => {
  assert.equal(respeta(opcionCon('cualquiera', ['hidratos']), []), true);
});

test('la frase dice que paso y que hacer, en ese orden', () => {
  const { cerrados } = evaluarReglas(plan, [desvio('almuerzo', ['hidratos'])], 'cena');
  assert.equal(frase(plan, cerrados[0]!), 'Almuerzo ya trajo hidratos. Esta comida va sin hidratos.');
});

test('un plan sin reglas declaradas no rompe ni inventa', () => {
  const sinReglas = { ...plan, reglas: undefined };
  assert.deepEqual(
    evaluarReglas(sinReglas, [desvio('almuerzo', ['hidratos'])], 'cena'),
    { cerrados: [], pendientes: [], avisos: [] },
  );
});

// --- la agenda completa: de lo registrado a lo que se sugiere ---

import { buildDaySchedule } from '../src/schedule.ts';
import type { UserConfig } from '../src/types.ts';

const config = JSON.parse(readFileSync('data/config.pablo.json', 'utf8')) as UserConfig;
const martes = new Date(2026, 8, 8); // 2026-09-08

function cena(comidas: ComidaDelDia[]) {
  return buildDaySchedule(plan, config, martes, comidas)
    .find((e) => e.kind === 'meal' && e.slotId === 'cena')!;
}

test('temprano en el dia el minimo de frutas no molesta', () => {
  // A la primera comida le sobran oportunidades para cubrirlo: avisar ahi
  // seria ruido. La regla se guarda el aviso para cuando el dia se ajuste.
  const agenda = buildDaySchedule(plan, config, martes, []);
  const primera = agenda.find((e) => e.kind === 'meal')!;
  assert.equal(primera.reglas, undefined);
});

test('sobre el final del dia el minimo de frutas si aparece', () => {
  const pendiente = cena([]).reglas?.pendientes.find((p) => p.reglaId === 'frutas-dia');
  assert.equal(pendiente?.faltan, 2);
});

test('con hidrato en el almuerzo, la cena lo dice y cita el plan', () => {
  const e = cena([desvio('almuerzo', ['hidratos', 'proteinas'])]);
  const cerrado = e.reglas?.cerrados.find((c) => c.reglaId === 'hidrato-cena');
  assert.ok(cerrado, 'la cena deberia traer el hidrato cerrado');
  assert.equal(
    cerrado!.texto,
    'Si en el almuerzo predominó el carbohidrato, en la cena evitar agregarlo.',
  );
});

test('la primera sugerencia de la cena deja de traer hidrato', () => {
  const sinRegla = cena([]).suggestions ?? [];
  const conRegla = cena([desvio('almuerzo', ['hidratos'])]).suggestions ?? [];

  assert.ok(sinRegla.length > 0 && conRegla.length > 0);
  assert.equal(
    respeta(conRegla[0]!, cena([desvio('almuerzo', ['hidratos'])]).reglas!.cerrados),
    true,
    `"${conRegla[0]!.name}" no deberia traer hidratos`,
  );
});

test('las sugerencias que igual incumplen no desaparecen, quedan al final', () => {
  // Vaciar la pantalla seria peor que mostrar la opcion con su aviso.
  const e = cena([desvio('almuerzo', ['hidratos'])]);
  assert.ok((e.suggestions ?? []).length > 0);
});

test('las reglas no se comen los avisos de la ventana de ayuno', () => {
  // La cena de Pablo arranca justo al cierre: ese aviso, que trae su propio
  // boton de arreglo, tiene que seguir estando con las reglas activas.
  const e = cena([desvio('almuerzo', ['hidratos'])]);
  assert.equal(e.warnings?.length, 1);
  assert.match(e.warnings![0]!, /ventana cierra/);
});

test('la agenda con y sin comidas coincide en horarios', () => {
  // Las reglas cambian que se sugiere, nunca cuando se come.
  const a = buildDaySchedule(plan, config, martes).map((e) => `${e.kind}@${e.time}`);
  const b = buildDaySchedule(plan, config, martes, [desvio('almuerzo', ['hidratos'])])
    .map((e) => `${e.kind}@${e.time}`);
  assert.deepEqual(a, b);
});
