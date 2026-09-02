import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

/**
 * El vinculo entre quien come y su nutricionista.
 *
 * Aceptar y revocar son actos del paciente, siempre. La profesional invita;
 * no se auto-concede acceso.
 */

export type EstadoVinculo = 'pending' | 'active' | 'revoked';

export interface Vinculo {
  id: string;
  estado: EstadoVinculo;
  /** Nombre o email de la otra parte. */
  contraparte: string;
  desde: string | null;
}

function db(sesion: Session | null) {
  if (!supabase || !sesion) throw new Error('Hace falta iniciar sesión.');
  return supabase;
}

/** Ata las invitaciones dirigidas al email de quien entra. */
export async function reclamarInvitaciones(sesion: Session | null): Promise<number> {
  if (!supabase || !sesion) return 0;
  const { data } = await supabase.rpc('reclamar_invitaciones');
  return typeof data === 'number' ? data : 0;
}

export async function esProfesional(sesion: Session | null): Promise<boolean> {
  if (!supabase || !sesion) return false;
  const { data } = await supabase
    .from('profiles').select('is_professional').eq('id', sesion.user.id).maybeSingle();
  return Boolean(data?.['is_professional']);
}

/** Se declara profesional. Es un permiso extra, no un rol excluyente. */
export async function declararseProfesional(sesion: Session | null, valor: boolean): Promise<void> {
  const cliente = db(sesion);
  const { error } = await cliente.from('profiles').upsert(
    { id: sesion!.user.id, is_professional: valor },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/** Los vínculos donde el usuario es el paciente. */
export async function misVinculos(sesion: Session | null): Promise<Vinculo[]> {
  const cliente = db(sesion);
  const { data, error } = await cliente
    .from('care_relationships')
    .select('id, status, accepted_at, professional_id, profiles!care_relationships_professional_id_fkey(display_name)')
    .eq('patient_id', sesion!.user.id)
    .neq('status', 'revoked');
  if (error) throw error;

  return (data ?? []).map((v) => ({
    id: v['id'] as string,
    estado: v['status'] as EstadoVinculo,
    contraparte: nombreDe(v['profiles']) ?? 'Tu nutricionista',
    desde: (v['accepted_at'] as string | null) ?? null,
  }));
}

/**
 * Aceptar incluye el consentimiento explicito, con fecha. Sin eso el esquema
 * no concede acceso aunque el vinculo figure activo: son datos de salud.
 */
export async function aceptarVinculo(sesion: Session | null, id: string): Promise<void> {
  const cliente = db(sesion);
  const ahora = new Date().toISOString();
  const { error } = await cliente.from('care_relationships').update({
    status: 'active', accepted_at: ahora, consent_granted_at: ahora, consent_version: 'v1',
  }).eq('id', id);
  if (error) throw error;
}

export async function revocarVinculo(sesion: Session | null, id: string): Promise<void> {
  const cliente = db(sesion);
  const { error } = await cliente.from('care_relationships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function invitarPaciente(sesion: Session | null, email: string): Promise<void> {
  const cliente = db(sesion);
  const { error } = await cliente.from('care_relationships').insert({
    professional_id: sesion!.user.id,
    patient_email: email.trim().toLowerCase(),
    status: 'pending',
  });
  if (error) {
    // El indice unico es la forma correcta de evitar duplicados; el mensaje
    // crudo de Postgres no le dice nada a nadie.
    throw new Error(error.code === '23505' ? 'Ya invitaste a esa persona.' : error.message);
  }
}

function nombreDe(perfil: unknown): string | null {
  if (Array.isArray(perfil)) return nombreDe(perfil[0]);
  if (perfil && typeof perfil === 'object' && 'display_name' in perfil) {
    const n = (perfil as { display_name: unknown }).display_name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}
