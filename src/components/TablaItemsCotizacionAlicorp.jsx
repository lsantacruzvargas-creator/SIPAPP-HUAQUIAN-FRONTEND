import TablaScroll from "./TablaScroll";
import {
  GRUPOS_ALICORP, itemVacioAlicorp, calcSubtotal, UNIDADES,
  descripcionInvalida,
} from "../utils/cotizacionItems";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full transition";
const INP_RO = "bg-transparent border-transparent text-sm px-2 py-1";

const ACENTOS = {
  materiales: "bg-emerald-500",
  materiales_consumibles: "bg-teal-500",
  servicios: "bg-sky-500",
  mano_obra_alicorp: "bg-amber-500",
  equipo_herramienta: "bg-violet-500",
};

// Tabla de Ítems exclusiva del formato Alicorp (RUC 20100055237) — 5 grupos
// fijos, todos con las mismas columnas (a diferencia de Gloria, acá Mano de
// Obra no tiene un formato especial: cantidad × precio unitario para los 5).
// Orden de columnas Unidad/Precio Unitario/Cantidad respeta el orden real de
// la plantilla (cotizacion-alicorp.xlsx) — el precio va ANTES que la cantidad.
export default function TablaItemsCotizacionAlicorp({
  items, onItemsChange, puedeEditar, disabled, puedeVerPrecios = true,
  seleccionables = false, seleccionados = new Set(), onToggleSeleccion, onGenerarOT, generando = false, onVerOT, onQuitarOT,
}) {
  const editable = puedeEditar && !disabled;

  const handleItem = (key, campo, valor) =>
    onItemsChange(items.map((i) => (i._key === key ? { ...i, [campo]: valor } : i)));

  const eliminarItem = (key) => onItemsChange(items.filter((i) => i._key !== key));

  const agregarItem = (grupo) => onItemsChange([...items, itemVacioAlicorp(grupo)]);

  const subtotalTotal = items.reduce((acc, i) => acc + calcSubtotal(i), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Ítems (formato Alicorp)</h2>
        {seleccionables && seleccionados.size > 0 && (
          <button type="button" onClick={onGenerarOT} disabled={generando}
            className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition font-medium">
            {generando ? "Generando…" : `Generar OT de ${seleccionados.size} ítem${seleccionados.size !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {GRUPOS_ALICORP.map((grupo) => {
          // Índice global (dentro del array `items` completo, no solo del
          // grupo) — el backend identifica el ítem por posición en la lista
          // completa (ver /cotizaciones/:id/items/:index/generar-ot).
          const itemsGrupo = items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.grupo === grupo.clave);
          const subtotalGrupo = itemsGrupo.reduce((acc, { item }) => acc + calcSubtotal(item), 0);

          return (
            <div key={grupo.clave} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-5 rounded-full ${ACENTOS[grupo.clave]}`} />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    {grupo.numero}. {grupo.label}
                  </h3>
                </div>
                {editable && (
                  <button type="button" onClick={() => agregarItem(grupo.clave)}
                    className="border border-sky-200 text-sky-700 text-xs px-3 py-1.5 rounded-lg hover:bg-sky-50 transition font-medium">
                    + Agregar
                  </button>
                )}
              </div>

              <TablaScroll className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      {seleccionables && <th className="px-3 py-2 w-12 text-center">OT</th>}
                      <th className="px-3 py-2 text-left">{grupo.label}</th>
                      <th className="px-3 py-2 text-center w-20">Unidad</th>
                      {puedeVerPrecios && <th className="px-3 py-2 text-right w-28">Precio Unitario</th>}
                      <th className="px-3 py-2 text-center w-20">Cantidad</th>
                      {puedeVerPrecios && <th className="px-3 py-2 text-right w-28">Parcial</th>}
                      {editable && <th className="px-3 py-2 w-10"><span className="sr-only">Quitar</span></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemsGrupo.length === 0 ? (
                      <tr>
                        <td colSpan={(seleccionables ? 1 : 0) + 3 + (puedeVerPrecios ? 2 : 0) + (editable ? 1 : 0)} className="px-3 py-4 text-center text-gray-400 text-xs">
                          Sin ítems{editable ? " — usa “+ Agregar” para sumar uno." : "."}
                        </td>
                      </tr>
                    ) : (
                      itemsGrupo.map(({ item, idx }) => (
                        <tr key={item._key}>
                          {seleccionables && (
                            <td className="px-3 py-2 text-center">
                              {item.otGenerada ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button type="button" onClick={() => onVerOT?.(item.otGenerada)}
                                    className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition whitespace-nowrap">
                                    {item.otGenerada.numeroOT || item.otGenerada.codigo}
                                  </button>
                                  {editable && onQuitarOT && (
                                    <button type="button" title="Quitar OT (no se anula, queda sin cotización)"
                                      onClick={() => {
                                        if (window.confirm("¿Quitar el vínculo con esta OT? La OT no se anula, solo queda sin cotización asociada.")) {
                                          onQuitarOT(idx);
                                        }
                                      }}
                                      className="text-gray-300 hover:text-red-500 text-sm leading-none transition">
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <input type="checkbox" checked={seleccionados.has(idx)}
                                  onChange={() => onToggleSeleccion?.(idx)} disabled={generando}
                                  className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400" />
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {editable ? (
                              <textarea value={item.descripcion} rows={1}
                                onChange={(e) => handleItem(item._key, "descripcion", e.target.value)}
                                placeholder="Descripción"
                                className={`w-full border border-transparent rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300 focus:border-sky-300 resize-y ${descripcionInvalida(item) ? "border-red-200" : ""}`} />
                            ) : (
                              <p className="text-gray-700 whitespace-pre-line">{item.descripcion}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select value={item.unidad || "und"} disabled={!editable}
                              onChange={(e) => handleItem(item._key, "unidad", e.target.value)}
                              className={`w-full text-center ${editable ? INP : INP_RO}`}>
                              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          {puedeVerPrecios && (
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01" value={item.precio} disabled={!editable}
                                onChange={(e) => handleItem(item._key, "precio", parseFloat(e.target.value) || 0)}
                                className={`w-full text-right ${editable ? INP : INP_RO}`} />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="1" value={item.cantidad} disabled={!editable}
                              onChange={(e) => handleItem(item._key, "cantidad", parseFloat(e.target.value) || 0)}
                              className={`w-full text-center ${editable ? INP : INP_RO}`} />
                          </td>
                          {puedeVerPrecios && (
                            <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                              {calcSubtotal(item).toFixed(2)}
                            </td>
                          )}
                          {editable && (
                            <td className="px-3 py-2 text-center">
                              <button type="button" onClick={() => eliminarItem(item._key)}
                                className="text-red-400 hover:text-red-600">✕</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {puedeVerPrecios && (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={(seleccionables ? 1 : 0) + 3} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">TOTAL</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900 tabular-nums">{subtotalGrupo.toFixed(2)}</td>
                        {editable && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </TablaScroll>
            </div>
          );
        })}
      </div>

      {puedeVerPrecios && (
        <div className="px-6 py-4 border-t-2 border-gray-200 bg-gray-50 flex justify-end">
          <p className="text-sm font-semibold text-gray-700">
            Sub-total (los 5 grupos): <span className="font-bold text-gray-900 tabular-nums">{subtotalTotal.toFixed(2)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
