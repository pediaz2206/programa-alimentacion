---
title: "En Punto — Roles profesionales y vistas por rol"
status: draft
created: 2026-09-09
updated: 2026-09-09
---

# En Punto — Roles profesionales y vistas por rol

## Contexto

En Punto convierte el plan de una nutricionista en recordatorios accionables: avisa a
la hora de cada comida con opciones concretas, pasa la lista de ingredientes antes
para poder chequear la heladera, aplica las reglas del plan sobre lo que ya se comió
y registra lo que efectivamente se comió, con foto.

Hoy funciona para una persona y su nutricionista. Se suma un socio entrenador
personal, y con él la intención de vender el producto. Eso trae dos cambios que no
son de pantalla sino de modelo: **hay un rol nuevo con otro trabajo**, y **hay
terceros**, con lo que los datos dejan de ser propios.

El socio, sobre el problema que resuelve: *"sin dudas que sirve, es una solución ante
el problema de saber qué comer, cómo comerlo, qué se reemplaza con qué y ayudar a las
personas"*.

## El problema de este épico

Un solo permiso profesional habilita todo: ver el seguimiento y publicar el plan de
alimentación. Eso rompe por tres lados distintos.

**Incumbencia.** Prescribir alimentación es del nutricionista. Un entrenador que
publica planes de comida pone el riesgo profesional del lado de quien opera la app.

**Foco.** Nutricionista y entrenador no miran lo mismo. Ella mira si la persona está
asimilando el plan; él mira si comida más ejercicio están produciendo un cambio en el
cuerpo. Mostrarles la misma pantalla obliga a los dos a filtrar mentalmente lo que no
les sirve.

**Prueba.** No hay forma de recorrer la app como otro rol. Las cuentas de prueba
existen pero no pueden iniciar sesión, porque la app entra solo por Google. Sin eso no
se puede mostrar el producto ni recibir feedback.

## Objetivo

Que un profesional entre a En Punto, vea lo que su rol necesita ver, y que el
producto sepa qué puede y qué no puede hacer cada uno.

**Terminado cuando** el socio entra con un acceso de prueba, recorre las tres vistas
con sus indicadores propios y puede devolver feedback por su cuenta.

## Usuarios

### UJ-1 — Pablo registra el almuerzo y la app le contesta

Pablo hace recomposición corporal, ayuno 16:8 sin desayuno. A las 12:45 le llega el
aviso: almuerzo en 45 minutos, y la lista de lo que necesita. No tiene arroz; toca
"no tengo", elige lentejas de la tabla de su nutricionista y la comida en pantalla
cambia. Come, saca la foto, registra. A las 21:00, cuando abre la cena, la app le
dice *"Almuerzo ya trajo hidratos. Esta comida va sin hidratos"*, citando la
indicación de ella, y le propone primero las opciones que cumplen.

**Ya funciona.** Es la línea de base que los roles nuevos no deben romper.

### UJ-2 — Nadia prepara la consulta del jueves

Nadia es nutricionista y sigue a doce personas. El jueves ve a Pablo. Abre En Punto
diez minutos antes, entra en su ficha y lee lo que tiene que preguntar: cuatro días
sin ningún registro seguidos, la proteína promedio 20 g por debajo del objetivo, y
tres veces la misma regla incumplida. No abre WhatsApp ni scrollea fotos. Entra a la
consulta sabiendo por dónde empezar.

**Existe hoy** como resumen de consulta. Lo que falta es que sea *su* vista y no una
genérica.

### UJ-3 — Ernesto revisa si el trabajo está rindiendo

Ernesto entrena a Pablo tres veces por semana. Cada dos semanas le mide pliegues al
final de la sesión y los carga desde el teléfono. Abre En Punto y no le interesa qué
comió el martes: quiere saber si el mes sirvió. Ve que el peso se movió medio kilo
—nada— pero que la cintura bajó dos centímetros y el brazo subió uno. Eso es
recomposición, y sin las tres medidas juntas no se ve. Ve además que la adherencia
fue del 82%: el plan se siguió, así que el cambio es atribuible.

Nota que Pablo entrena en ayunas los martes y se descompone. Deja una propuesta para
Nadia: mover la colación. Nadia la aprueba y la versión nueva del plan sale firmada
por ella.

**No existe.** Es el corazón de este épico.

## Requisitos funcionales

### A. Roles y matrícula

- **FR-1** Un perfil puede tener cero, uno o varios roles profesionales
  (`nutricionista`, `entrenador`). Ser profesional no impide ser paciente: cualquiera
  es paciente de sí mismo.
- **FR-2** Al declararse profesional, la persona registra número de matrícula y
  jurisdicción. El dato es obligatorio para el rol, no para la cuenta.
- **FR-3** Cada matrícula tiene un estado de verificación (`sin verificar`,
  `verificada`, `rechazada`). Se guarda quién y cuándo la verificó.
- **FR-4** El estado de verificación es visible para los pacientes vinculados a ese
  profesional. Un paciente tiene derecho a saber si quien lo sigue fue verificado.
- **FR-5** La verificación inicial es manual, hecha por el equipo. No hace falta
  integración con ningún registro para cerrar este épico.

### B. Vínculos y consentimiento

- **FR-6** Un vínculo declara con qué rol se creó. Una persona puede tener a la vez
  nutricionista y entrenador, y son dos vínculos distintos.
- **FR-7** El consentimiento es por vínculo, no por persona: aceptar a la
  nutricionista no acepta al entrenador.
- **FR-8** El paciente puede revocar cualquier vínculo en cualquier momento, sin
  pedir permiso y con efecto inmediato sobre todo lo compartido, fotos incluidas.
- **FR-9** El paciente ve, en un solo lugar, quién tiene acceso a sus datos, con qué
  rol, desde cuándo y con qué estado de matrícula.

### C. Qué puede hacer cada rol

- **FR-10** Solo el rol `nutricionista` puede publicar una versión del plan de
  alimentación.
- **FR-11** El rol `entrenador` puede crear una **propuesta** de cambio de plan: un
  plan completo más una nota que explica por qué.
- **FR-12** Una propuesta no rige. No la ve la app del paciente ni la agenda ni las
  notificaciones hasta que se aprueba.
- **FR-13** La nutricionista vinculada aprueba o descarta una propuesta, con una
  respuesta opcional. Al aprobarse se publica una versión firmada por ella.
- **FR-14** Ambos roles pueden invitar pacientes y registrar mediciones corporales.
- **FR-15** Ningún rol profesional puede registrar comidas por el paciente. Lo que
  comió lo dice quien comió.

### D. La vista de la nutricionista — ¿está asimilando el plan?

- **FR-16** Su ficha de paciente responde una pregunta: si la persona está siguiendo
  el plan y dónde se le complica. Indicadores: adherencia, proteína promedio contra
  objetivo, comidas del 20% usadas, reglas del plan incumplidas y con qué frecuencia,
  desvíos con lo que comió realmente, y días sin ningún registro.
- **FR-17** Los indicadores se presentan ordenados por cuánto cambian la
  conversación, no por categoría. Lo que no llama la atención no aparece.
- **FR-18** Puede publicar, versionar y comparar versiones del plan.

### E. La vista del entrenador — ¿está funcionando?

- **FR-19** Su ficha de paciente responde otra pregunta: si el trabajo está
  produciendo un cambio en el cuerpo. Indicadores: tendencia de composición corporal,
  tendencia de peso, y el cruce entre adherencia y cambio.
- **FR-20** El cruce adherencia × cambio se presenta como una lectura, no como dos
  números sueltos:
  - adherencia alta y sin cambio → el plan se siguió y no alcanzó; conviene revisarlo
  - adherencia baja y sin cambio → el plan no llegó a probarse
  - adherencia alta con cambio → seguir así
  - adherencia baja con cambio → hay algo más operando; conviene entenderlo
- **FR-21** Ve la adherencia y el peso, pero no el detalle de cada comida. Lo que
  necesita para su trabajo, no todo lo que hay. [ASSUMPTION] Confirmar con el socio:
  puede que quiera ver los desvíos para entender el rendimiento en la sesión.
- **FR-22** Puede registrar mediciones corporales del paciente y dejar propuestas.
  No carga rutinas ni entrenamientos: eso es otro producto y otro épico.

### F. Composición corporal

- **FR-23** El sistema acepta tres fuentes y guarda cuál se usó: pliegues cutáneos,
  bioimpedancia y circunferencias (cintura, cadera, brazo, muslo).
- **FR-24** Ninguna es obligatoria. La pantalla muestra lo que haya y dice qué falta
  para poder mostrar más.
- **FR-25** Nunca se compara una medición contra la anterior: se comparan promedios
  de períodos. Peso y bioimpedancia oscilan por hidratación, sal y hora del día.
- **FR-26** Cuando no alcanza para hablar de tendencia, se dice cuántas mediciones
  faltan, en lugar de dibujar una línea sobre tres puntos.
- **FR-27** El registro guarda de dónde salió cada número y quién lo cargó. Un
  pliegue medido por el entrenador y una balanza de casa no tienen la misma
  confiabilidad, y quien lee la tendencia tiene que poder saberlo.

### G. Acceso de prueba

- **FR-28** Existe un acceso por email y contraseña, adicional al ingreso con Google,
  que emite una sesión real: mismas políticas, mismos permisos, sin ningún camino que
  saltee la autenticación.
- **FR-29** Ese acceso se muestra solo cuando el despliegue lo habilita
  explícitamente. Por defecto está apagado.
- **FR-30** Las cuentas de prueba están marcadas como tales y solo se vinculan entre
  ellas: aunque alguien entre, no alcanza datos de ninguna persona real.
- **FR-31** Las credenciales de prueba se generan al azar y se muestran una sola vez,
  al sembrarlas. No viven en el repositorio.

## Requisitos no funcionales

- **NFR-1 Privacidad por defecto.** Ningún dato de salud se comparte sin un vínculo
  activo, no revocado y consentido. Verificado con pruebas de permisos, no por
  inspección.
- **NFR-2 La revocación es inmediata.** Al revocar, el acceso se corta en la misma
  petición, incluidas las fotos ya subidas.
- **NFR-3 Sin autoridad inventada.** La app no produce indicaciones nutricionales
  propias: aplica las reglas que declaró la nutricionista y cita su texto. Cuando no
  alcanza para afirmar algo, lo dice.
- **NFR-4 Coherencia entre pantalla y notificación.** El motor es puro y
  determinista; pantalla y cron calculan con el mismo código.
- **NFR-5 Funciona sin señal.** Registrar una comida no puede depender de la
  conexión.
- **NFR-6 iPhone primero.** El uso real es en la calle, con una mano.
- **NFR-7 Trazabilidad clínica.** Toda versión de plan publicada queda con autor y
  fecha, y los registros apuntan a la versión vigente ese día.

## Métricas de éxito

Del épico, medibles con el socio adentro:

- Recorre las tres vistas sin que nadie le explique cómo.
- Identifica correctamente, mirando la vista de entrenador, si el plan de un paciente
  sembrado está funcionando.
- Deja al menos una propuesta que Nadia aprueba, de punta a punta.

**Contra-métricas** — si esto pasa, algo salió mal:

- Un profesional ve datos de alguien que no consintió. Es falla, no incidencia.
- El entrenador termina pidiendo la vista completa de la nutricionista: sería señal de
  que separamos mal.
- El acceso de prueba queda habilitado en producción.
- Registrar una comida tarda más que antes por los cambios de este épico.

## Fuera de alcance

- **Módulo de entrenamiento** (rutinas, ejercicios, series, registro de sesiones). Es
  un producto entero adentro de este; primero se valida el rol.
- **Monetización.** [ASSUMPTION] Sin definir quién paga. No frena este épico, pero hay
  que resolverlo antes de la primera venta.
- **Verificación automática de matrícula** contra un registro oficial.
- **Mensajería entre profesional y paciente.** La propuesta de cambio de plan cubre el
  caso concreto que motivaba el WhatsApp.

## Riesgos y preguntas abiertas

1. **Dos nutricionistas sobre el mismo paciente.** Hoy gana la última publicación,
   auditado pero sin guardas. ¿Se bloquea, se avisa, o se acepta mostrando quién
   publicó qué?
2. **Cuánto del plan de comidas ve el entrenador.** Ver el plan completo es razonable
   para proponer sobre él, pero es información de salud. FR-21 asume el corte
   restrictivo; confirmar con el socio.
3. **Baja de un profesional.** Si una nutricionista deja el equipo, sus planes
   publicados siguen rigiendo. ¿Quién los hereda?
4. **Confiabilidad desigual de las fuentes de composición.** FR-27 guarda el origen,
   pero falta decidir si la pantalla mezcla fuentes en una misma curva o las separa.
5. **Responsabilidad profesional.** Con terceros pagando, hace falta definir qué dice
   la app sobre su propio alcance y qué acepta el profesional al publicar un plan.
