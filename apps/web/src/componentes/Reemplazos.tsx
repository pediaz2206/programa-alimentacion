import { detalleDe, reemplazosDe, type ExchangeOption, type Ingredient, type NutritionPlan } from '@pa/core';

/**
 * "No tengo pollo, ¿con qué lo reemplazo?"
 *
 * La respuesta ya estaba en la app, dos pantallas más allá: había que abrir
 * Plan, buscar el grupo y desplegarlo. Acá está donde se toma la decisión,
 * parado frente a la heladera.
 */
export function Reemplazos({ plan, ingrediente, slotId, onElegir, onCerrar }: {
  plan: NutritionPlan;
  ingrediente: Ingredient;
  slotId: string | undefined;
  /** Elegir uno cambia la comida en pantalla, no solo informa. */
  onElegir: (ex: ExchangeOption) => void;
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
        En lugar de <b>{ingrediente.item}</b>, tocá la que tengas:
      </p>
      {/*
        * Antes esto era una lista para leer, y quien la leia tenia que hacer el
        * reemplazo de cabeza y acordarse al registrar. Ahora se elige, la
        * comida cambia en pantalla y queda guardado lo que de verdad se uso.
        */}
      <ul className="eq-lista eq-elegible">
        {r.opciones
          .filter((ex) => ex.label.toLowerCase() !== ingrediente.item.toLowerCase())
          .map((ex) => (
            <li key={ex.label}>
              <button className="eq-elegir" onClick={() => onElegir(ex)}>
                <span>{ex.label}</span>
                <span className="eq-cant mono">{detalleDe(ex)}</span>
              </button>
            </li>
          ))}
      </ul>
      <button className="boton" onClick={onCerrar}>Cerrar</button>
    </div>
  );
}
