# Como cargar los PDF de la nutricionista

El PDF se transcribe **una vez** a un `NutritionPlan` (un JSON). A partir de ahi todo lo
demas se deriva solo. `data/plan.ejemplo.json` es una plantilla completa con datos
inventados: sirve como referencia de formato, no como plan real.

## Que necesito de cada PDF

1. **Grupos de alimentos** — el nombre de cada grupo y sus alimentos de ejemplo. Si el
   PDF los llama distinto ("hidratos" vs "carbohidratos"), va en `aliases`.
2. **El reparto del plato** — que fraccion de cada grupo, y en que comidas aplica.
3. **Los momentos del dia** — desayuno, colaciones, almuerzo, merienda, cena, con el
   horario sugerido si el PDF lo indica.
4. **Las sugerencias de comida** — para cada una: nombre, en que momentos aplica, y los
   ingredientes con cantidades. Sin cantidades igual funciona, pero el checklist previo
   pierde la mitad de la gracia.
5. **Las proporciones diarias** — cuantas porciones de cada grupo hay que cubrir por dia.
   Esto alimenta el "complementar entre comidas".

## Dos detalles que cambian el resultado

- **`staple: true`** en sal, aceite, especias y condimentos. Quedan fuera de la lista de
  compras y del checklist, que es lo que uno espera: nadie quiere que le recuerden que
  necesita sal.
- **`portions`** por opcion es lo que permite calcular el balance del dia y priorizar
  sugerencias. Es la parte mas trabajosa de transcribir y la que mas valor agrega. Si el
  PDF no lo dice explicitamente, se puede estimar (1 porcion de proteina = 1 porcion).

## Verificar la transcripcion

```bash
npm run hoy -- --plan data/mi-plan.json --config data/mi-config.json
```

`validatePlan()` corre primero y avisa de los errores tipicos: un momento sin opciones,
un plato cuyas fracciones no suman 1, una opcion que referencia un grupo inexistente.
Si el comando imprime una agenda coherente, la transcripcion esta bien.

## Mandar los PDF

Pasame los PDF o capturas y los transcribo. Si son varios documentos que se pisan (uno
generado con IA y otro mas puntual de la nutricionista), decime cual manda: el modelo
soporta un solo plan activo, y las excepciones puntuales conviene cargarlas como opciones
adicionales antes que como un segundo plan.
