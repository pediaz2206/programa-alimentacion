/**
 * Los personajes de prueba.
 *
 * Cada uno existe para cubrir algo concreto que hoy no se puede probar con una
 * sola cuenta. No son "varios usuarios para que haya varios": si sacás uno,
 * queda una celda de la matriz de permisos sin verificar.
 *
 * Ver docs/roles.md para la matriz completa.
 */

/** Todo lo sembrado usa este dominio, que no existe y no recibe correo. */
export const DOMINIO = 'prueba.en-punto.local';

export const email = (slug) => `${slug}@${DOMINIO}`;

export const PACIENTES = [
  {
    slug: 'paciente-a',
    nombre: 'Ana Prueba',
    // El caso feliz y el mas rico: es el que hace que el resumen de consulta
    // tenga algo para decir.
    historia: 'completa',
    dias: 28,
    config: true,
  },
  {
    slug: 'paciente-b',
    nombre: 'Bruno Prueba',
    // Invitado y sin aceptar. Verifica que un vinculo pendiente no filtre nada.
    historia: 'ninguna',
    dias: 0,
    config: true,
  },
  {
    slug: 'paciente-c',
    nombre: 'Carla Prueba',
    // Plan activo pero SIN config. Hoy eso hace que el resumen de consulta no
    // aparezca, y es el primer bug que va a encontrar quien pruebe.
    historia: 'corta',
    dias: 6,
    config: false,
  },
  {
    slug: 'paciente-d',
    nombre: 'Diego Prueba',
    // Vinculo revocado: el corte tiene que ser inmediato y alcanzar tambien a
    // las fotos y las mediciones ya cargadas.
    historia: 'completa',
    dias: 28,
    config: true,
  },
];

export const PROFESIONALES = [
  { slug: 'nutri-1', nombre: 'Nadia Nutri', roles: ['nutricionista'] },
  // Sigue al mismo paciente que nutri-1: es el caso de dos profesionales sobre
  // la misma persona, que hoy se resuelve por ultima publicacion.
  { slug: 'nutri-2', nombre: 'Norma Nutri', roles: ['nutricionista'] },
  { slug: 'entrenador-1', nombre: 'Ernesto Entrena', roles: ['entrenador'] },
  // Las dos formaciones en una cuenta, y ademas paciente de nutri-1: verifica
  // que los roles se acumulan y que ser profesional no impide ser paciente.
  { slug: 'mixto-1', nombre: 'Mia Mixta', roles: ['nutricionista', 'entrenador'] },
];

/**
 * Quien sigue a quien, y en que estado.
 *
 * `consentido: false` con estado activo es el caso que mas veces se olvida
 * probar: el vinculo figura vigente y aun asi no hay acceso.
 */
export const VINCULOS = [
  { profesional: 'nutri-1', paciente: 'paciente-a', rol: 'nutricionista', estado: 'active', consentido: true },
  { profesional: 'nutri-1', paciente: 'paciente-b', rol: 'nutricionista', estado: 'pending', consentido: false },
  { profesional: 'nutri-1', paciente: 'paciente-c', rol: 'nutricionista', estado: 'active', consentido: true },
  { profesional: 'nutri-1', paciente: 'mixto-1', rol: 'nutricionista', estado: 'active', consentido: true },
  { profesional: 'nutri-2', paciente: 'paciente-a', rol: 'nutricionista', estado: 'active', consentido: true },
  { profesional: 'entrenador-1', paciente: 'paciente-a', rol: 'entrenador', estado: 'active', consentido: true },
  // Activo pero sin consentir: no tiene que ver nada.
  { profesional: 'entrenador-1', paciente: 'paciente-c', rol: 'entrenador', estado: 'active', consentido: false },
  { profesional: 'nutri-1', paciente: 'paciente-d', rol: 'nutricionista', estado: 'revoked', consentido: true },
];
