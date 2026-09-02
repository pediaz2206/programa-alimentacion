import { detalleDe, reemplazosDe, type Ingredient, type NutritionPlan } from '@pa/core';

/**
 * "No tengo pollo, ¿con qué lo reemplazo?"
 *
 * La respuesta ya estaba en la app, dos pantallas más allá: había que abrir
 * Plan, buscar el grupo y desplegarlo. Acá está donde se toma la decisión,
 * parado frente a la heladera.
 */
export function Reemplazos({ plan, ingrediente, slotId, onCerrar }: {
  plan: NutritionPlan;
  ingrediente: Ingredient;
  slotId: string | undefined;
  onCerrar: () => void;
}) {
  const r = reemplazosDe(plan, ingrediente.groupId, slotId);

  if (!r) {
    return (
      <div className="reemplazos">
        <p className="nota">
          {ingrediente.item} no está asociado a ningún grupo del plan, así que no
          puedo decirte con qué cambiarlo.
        </p>
        <button className="boton" onClick={onCerrar}>Cerrar</button>
      </div>
    );
  }

  return (
    <div className="reemplazos">
      <p className="nota">
        En lugar de <b>{ingrediente.item}</b>, cualquiera de estas cuenta como{' '}
        {r.grupo.toLowerCase()} según tu plan:
      </p>
      <ul className="eq-lista">
        {r.opciones
          .filter((ex) => ex.label.toLowerCase() !== ingrediente.item.toLowerCase())
          .map((ex) => (
            <li key={ex.label}>
              <span>{ex.label}</span>
              <span className="eq-cant mono">{detalleDe(ex)}</span>
            </li>
          ))}
      </ul>
      <button className="boton" onClick={onCerrar}>Cerrar</button>
    </div>
  );
}
