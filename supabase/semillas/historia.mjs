/**
 * La historia de un paciente de prueba: comidas, desvios y mediciones.
 *
 * Determinista a proposito. Sembrar dos veces tiene que dar exactamente lo
 * mismo, porque si no, un bug que aparece con ciertos datos no se puede
 * reproducir, y "a mi me funciona" pasa a ser cierto por casualidad.
 *
 * La historia no es prolija: tiene huecos, desvios y reglas incumplidas. Una
 * semilla perfecta prueba la mitad de la app —el resumen de consulta con datos
 * perfectos no dice nada— y no se parece a nadie.
 */

/** Un generador barato y estable: mismo `semilla`, misma secuencia. */
function azar(semilla) {
  let s = 0;
  for (const c of semilla) s = (s * 31 + c.charCodeAt(0)) | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const iso = (d) => d.toISOString().slice(0, 10);

/** Los dias del rango, del mas viejo al mas nuevo. */
export function dias(hasta, cantidad) {
  const fin = new Date(`${hasta}T00:00:00Z`);
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(fin);
    d.setUTCDate(d.getUTCDate() - (cantidad - 1 - i));
    return iso(d);
  });
}

/**
 * Genera comidas y mediciones para un paciente.
 *
 * `perfil` decide que tan parecida a la vida real es la historia:
 *   'completa' — un mes con huecos, desvios y reglas incumplidas.
 *   'corta'    — pocos dias, sin material suficiente para una tendencia.
 *   'ninguna'  — nada. Sirve para probar los estados vacios, que casi nunca
 *                se prueban y son los que peor se ven.
 */
export function historiaDe(plan, config, { slug, historia, dias: cantidad }, hasta) {
  if (historia === 'ninguna') return { comidas: [], medidas: [] };

  const r = azar(slug);
  const fechas = dias(hasta, cantidad);
  const slots = config.slots.filter((s) => s.enabled !== false).map((s) => s.slotId);
  const opciones = plan.options;
  const gruposDe = (o) => [...new Set(o.ingredients.map((i) => i.groupId).filter(Boolean))];

  const comidas = [];
  const medidas = [];

  // Un silencio de varios dias seguidos: es el punto que mas cambia una
  // consulta y hay que poder verlo en la pantalla, no solo en un test.
  const silencioDesde = historia === 'completa' ? Math.floor(cantidad * 0.4) : -1;
  const silencioHasta = silencioDesde + 3;

  fechas.forEach((fecha, dia) => {
    // El peso va antes del silencio a proposito: se puede dejar de anotar
    // comidas y seguir pesandose, y ese caso —el que mas se parece a alguien
    // que se desanima— tiene que quedar representado. Ademas, si el silencio
    // se comiera una medicion, quedarian tres y no alcanzan para una
    // tendencia: la pantalla de progreso quedaria sin nada que mostrar.
    if (dia % 5 === 0) {
      medidas.push({
        fecha,
        pesoKg: Number((82 - dia * 0.045 + (r() - 0.5) * 0.9).toFixed(1)),
        cinturaCm: Number((94 - dia * 0.08 + (r() - 0.5) * 0.6).toFixed(1)),
      });
    }

    if (dia >= silencioDesde && dia <= silencioHasta) return;

    for (const slotId of slots) {
      // Alguna comida se saltea: nadie registra el 100%.
      if (r() < 0.12) continue;

      const delSlot = opciones.filter((o) => o.slotIds.includes(slotId));
      const opcion = delSlot[Math.floor(r() * delSlot.length)];
      const esLibre = historia === 'completa' && r() < 0.05;

      if (esLibre) {
        comidas.push({ fecha, slotId, optionId: null, porciones: null, proteinGrams: 0, esLibre: true, nota: null });
        continue;
      }

      // Uno de cada cinco registros es un desvio descrito a mano, que es como
      // se registra en la vida real cuando la comida no sale del plan.
      if (r() < 0.2) {
        const desvio = DESVIOS[Math.floor(r() * DESVIOS.length)];
        comidas.push({
          fecha, slotId, optionId: null,
          porciones: desvio.porciones,
          proteinGrams: desvio.proteina,
          esLibre: false,
          nota: desvio.nota,
        });
        continue;
      }

      if (!opcion) continue;
      comidas.push({
        fecha, slotId,
        optionId: opcion.id,
        porciones: null,
        proteinGrams: opcion.proteinGrams ?? Math.round(18 + r() * 22),
        esLibre: false,
        nota: null,
        grupos: gruposDe(opcion),
      });
    }
  });

  return { comidas, medidas };
}

/**
 * Desvios reales, escritos como los escribiria alguien.
 *
 * Varios repiten carbohidrato en almuerzo y cena a proposito: sin eso, el
 * resumen de consulta nunca muestra una regla incumplida y esa parte de la
 * pantalla queda sin probar.
 */
const DESVIOS = [
  { nota: 'Tarta de verdura (Masa de tarta, Espinaca, Cebolla, Queso)', proteina: 18,
    porciones: { carbohidratos: 'Masa de tarta', vegetales: 'Espinaca, Cebolla', proteinas: 'Queso' } },
  { nota: 'Milanesa con puré', proteina: 30,
    porciones: { proteinas: 'Milanesa', carbohidratos: 'Puré de papa' } },
  { nota: 'Ensalada de atún', proteina: 26,
    porciones: { proteinas: 'Atún', vegetales: 'Lechuga, Tomate' } },
  { nota: 'Fideos con salsa', proteina: 12,
    porciones: { carbohidratos: 'Fideos', vegetales: 'Salsa de tomate' } },
  { nota: 'Sándwich de pollo', proteina: 28,
    porciones: { carbohidratos: 'Pan integral', proteinas: 'Pollo', vegetales: 'Lechuga' } },
  { nota: 'Yogur con granola y banana', proteina: 14,
    porciones: { proteinas: 'Yogur', carbohidratos: 'Granola', frutas: 'Banana' } },
];
