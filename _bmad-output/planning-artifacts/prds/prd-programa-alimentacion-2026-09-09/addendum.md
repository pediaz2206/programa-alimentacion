# Addendum — decisiones técnicas y alternativas descartadas

Lo que se decidió durante el descubrimiento y no pertenece al PRD, porque es cómo y
no qué. Insumo directo para `bmad-architecture`.

## Acceso de prueba: por qué no es un bypass

**Descartado:** una sesión falsa, un usuario de mentira, o cualquier camino que
saltee la autenticación cuando una bandera está encendida.

Razón: es código que puede quedar encendido en producción, y en una app de salud eso
termina en acceso sin credenciales a datos de terceros. El riesgo no es que se
active por error una vez, es que existe para siempre en el binario.

**Elegido:** las cuentas sembradas ya viven en Supabase Auth. Se les asigna
contraseña por la API de administración y se agrega un formulario de email más
contraseña. Supabase emite un JWT real y RLS aplica idéntico. No es saltear el login:
es una segunda puerta con la misma cerradura.

**Riesgo residual, asumido:** Supabase Auth es por proyecto, no por despliegue. Esas
cuentas pueden entrar también a producción con esa contraseña. Se mitiga con que la
contraseña la genera la semilla al azar y se muestra una sola vez, y con que las
cuentas de prueba solo están vinculadas entre ellas (FR-30). El formulario, además,
solo se renderiza con `VITE_LOGIN_PRUEBA` encendida, que se pone en un despliegue de
vista previa y no en producción.

## Cambios de esquema previstos

Detalle en `docs/roles.md`. Resumen:

- `profiles.is_professional` (booleano) pasa a `roles text[]`. Un booleano no puede
  representar "las dos cosas". Migración: `true` → `{nutricionista}`, que es lo que
  esas cuentas son hoy.
- `profiles` suma matrícula, jurisdicción, estado de verificación, verificada_por y
  verificada_en.
- `care_relationships` suma `rol`, porque el vínculo con la nutricionista y el
  vínculo con el entrenador tienen permisos distintos.
- `has_care_access(patient)` se parte en dos: sigue existiendo para leer, y aparece
  `puede_prescribir(patient)` restringida al rol nutricionista, que gobierna la
  escritura de `plans` y `plan_versions`.
- Tabla nueva `plan_proposals`: un plan completo más nota y estado. Al aprobarse se
  inserta una `plan_versions` con autoría de quien aprueba.
- Tabla nueva de composición corporal, o extensión de `body_measurements`, con
  columna de origen (`pliegues` | `bioimpedancia` | `circunferencias`) y de quién
  cargó el dato.

## Composición corporal: por qué promedios y no puntas

El peso oscila un kilo o más por sal, agua y hora del día, y la bioimpedancia todavía
más. Comparar la medición de hoy contra la de la semana pasada convierte ruido en
conclusión, y es la forma más rápida de abandonar un plan que estaba funcionando.

El módulo `packages/core/src/progreso.ts` ya compara promedio de la mitad reciente
contra promedio de la mitad anterior, y se niega a hablar de tendencia con menos de
cuatro mediciones. La extensión a tres fuentes conserva ese criterio.

Umbrales vigentes: 0,3 kg para peso y 0,5 cm para cintura. Por debajo de eso la
diferencia es ruido y se reporta como "se mantiene". Falta definir el umbral para
porcentaje de grasa por pliegues y por bioimpedancia, que no son comparables entre sí.

## Sobre mezclar fuentes en una misma curva

Pendiente (pregunta abierta 4 del PRD). Una serie que mezcla pliegues medidos por el
entrenador con lecturas de una balanza de casa produce saltos que parecen cambios
corporales y son cambios de instrumento. Las dos salidas razonables son una curva por
fuente, o una curva con la fuente marcada en cada punto. Se decide en arquitectura,
con FR-27 ya garantizando que el dato de origen está guardado.

## Alcance del entrenador: cómo quedó la enmienda

La decisión original (2026-09-08) fue que el entrenador por ahora solo consume. Al
elegir pliegues como fuente de composición, esa decisión choca: medir pliegues es
escribir.

Se enmendó en lo mínimo: el entrenador registra mediciones corporales, y sigue sin
cargar rutinas ni entrenamientos. Lo que aquella decisión protegía era no meterse con
el módulo de entrenamiento, que es un producto aparte; una medición corporal no lo es.
