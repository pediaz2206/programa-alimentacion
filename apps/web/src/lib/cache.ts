import type { NutritionPlan, UserConfig } from '@pa/core';
import type { Registro } from './registro.ts';

/**
 * Copia local de lo ultimo que se supo del servidor.
 *
 * La app se consulta parada frente a la heladera y a veces sin senal. Abrir y
 * ver un error en vez del plan del dia es el peor momento posible para fallar.
 *
 * Todo se guarda por usuario: cambiar de cuenta no puede mostrar datos de otra
 * persona, y menos datos de salud.
 */

export interface Cacheado {
  plan: NutritionPlan;
  config: UserConfig;
  planId: string | null;
  planVersionId: string | null;
  guardadoEn: number;
}

/** Una escritura que no se pudo mandar y hay que reintentar. */
export type Pendiente =
  | { tipo: 'guardar'; registro: Registro; planVersionId: string | null }
  | { tipo: 'borrar'; fecha: string; slotId: string };

const clave = (uid: string, que: string) => `en-punto:${que}:${uid}`;

function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    // Cuota llena o modo privado. Se pierde la copia local, no la sesion.
    return false;
  }
}

export function guardarDatos(uid: string, datos: Omit<Cacheado, 'guardadoEn'>): void {
  escribir(clave(uid, 'datos'), { ...datos, guardadoEn: Date.now() });
}

export function leerDatos(uid: string): Cacheado | null {
  return leer<Cacheado>(clave(uid, 'datos'));
}

export function guardarRegistros(uid: string, registros: Registro[]): void {
  // Las fotos ya subidas se leen con URLs firmadas que vencen: guardarlas no
  // sirve de nada y ocupa la cuota que necesitan las pendientes.
  escribir(clave(uid, 'registros'), registros.map(sinFotoRemota));
}

export function leerRegistros(uid: string): Registro[] {
  return leer<Registro[]>(clave(uid, 'registros')) ?? [];
}

function sinFotoRemota(r: Registro): Registro {
  if (r.foto && !r.foto.startsWith('data:')) {
    const { foto: _descartada, ...resto } = r;
    return resto;
  }
  return r;
}

export function leerCola(uid: string): Pendiente[] {
  return leer<Pendiente[]>(clave(uid, 'cola')) ?? [];
}

export function encolar(uid: string, pendiente: Pendiente): boolean {
  const cola = leerCola(uid);
  // Una sola pendiente por comida: reintentar la ultima version, no todas.
  const filtrada = cola.filter((p) => !mismaComida(p, pendiente));
  filtrada.push(pendiente);
  return escribir(clave(uid, 'cola'), filtrada);
}

export function vaciarCola(uid: string): void {
  escribir(clave(uid, 'cola'), []);
}

function mismaComida(a: Pendiente, b: Pendiente): boolean {
  const id = (p: Pendiente) =>
    p.tipo === 'guardar' ? `${p.registro.fecha}:${p.registro.slotId}` : `${p.fecha}:${p.slotId}`;
  return id(a) === id(b);
}
