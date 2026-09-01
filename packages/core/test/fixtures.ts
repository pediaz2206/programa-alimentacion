import type { NutritionPlan, UserConfig } from '../src/types.ts';

export const plan: NutritionPlan = {
  id: 'test',
  name: 'Plan de prueba',
  foodGroups: [
    { id: 'prot', name: 'Proteinas', examples: ['pollo'] },
    { id: 'carb', name: 'Carbohidratos', examples: ['arroz'] },
    { id: 'veg', name: 'Vegetales', examples: ['lechuga'] },
  ],
  plateDefault: { veg: 0.5, prot: 0.25, carb: 0.25 },
  dailyTargets: { prot: 2, carb: 2, veg: 2 },
  slots: [
    { id: 'desayuno', name: 'Desayuno', defaultTime: '08:00', prepLeadMinutes: 15 },
    { id: 'almuerzo', name: 'Almuerzo', defaultTime: '13:00', prepLeadMinutes: 30, usesPlateMethod: true },
    { id: 'cena', name: 'Cena', defaultTime: '21:00', prepLeadMinutes: 30, usesPlateMethod: true },
  ],
  options: [
    {
      id: 'avena',
      name: 'Avena',
      slotIds: ['desayuno'],
      portions: { carb: 1 },
      ingredients: [
        { item: 'Avena', qty: 40, unit: 'g', groupId: 'carb' },
        { item: 'Sal', staple: true },
      ],
    },
    {
      id: 'pollo',
      name: 'Pollo con arroz',
      slotIds: ['almuerzo', 'cena'],
      portions: { prot: 1, carb: 1, veg: 1 },
      ingredients: [
        { item: 'Pollo', qty: 150, unit: 'g', groupId: 'prot' },
        { item: 'Arroz', qty: 60, unit: 'g', groupId: 'carb' },
      ],
    },
    {
      id: 'pescado',
      name: 'Pescado con papa',
      slotIds: ['almuerzo', 'cena'],
      portions: { prot: 1, carb: 1, veg: 1 },
      ingredients: [
        { item: 'Merluza', qty: 180, unit: 'g', groupId: 'prot' },
        { item: 'Papa', qty: 200, unit: 'g', groupId: 'carb' },
      ],
    },
    {
      id: 'cerdo',
      name: 'Cerdo a la plancha',
      slotIds: ['cena'],
      tags: ['cerdo'],
      portions: { prot: 1 },
      ingredients: [{ item: 'Bondiola', qty: 150, unit: 'g', groupId: 'prot' }],
    },
  ],
};

export const config: UserConfig = {
  planId: 'test',
  defaultPrepLeadMinutes: 30,
  optionsPerSuggestion: 2,
  slots: [],
};
