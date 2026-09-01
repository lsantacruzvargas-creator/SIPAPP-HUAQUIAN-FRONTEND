import { useState } from "react";
import TablaScroll from "./TablaScroll";
import SelectorCatalogoServicios from "./SelectorCatalogoServicios";
import {
  GRUPOS_GLORIA, itemVacioGloria, calcSubtotalGloria, UNIDADES,
  descripcionInvalida,
} from "../utils/cotizacionItems";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full transition";
const INP_RO = "bg-transparent border-transparent text-sm px-2 py-1";

const ACENTOS = {
  detalle_servicio: "bg-sky-500",
  materiales: "bg-emerald-500",
  mano_obra: "bg-amber-500",
  maquinaria_equipos: "bg-violet-500",
  seguridad_salud: "bg-red-500",
};

// Tabla de Ítems exclusiva del formato Gloria (RUC 20100190797) — 5 grupos
// fijos que van acumulando sub-ítems, en vez de la lista plana de
// TablaItemsCotizacion.jsx. Mano de obra cobra personas × horas × tarifa por
// hora (no cantidad × precio unitario) — ver cotizacionItems.js
// `calcSubtotalGloria`. Los grupos Mano de obra/Maquinaria y equipos/
// Seguridad y salud no son obligatorios de llenar, pero igual se muestran
// (cabecera + fila TOTAL) aunque queden vacíos, para que el PDF exportado
// coincida con el formato real que exige Gloria.
export default function TablaItemsCotizacionGloria({
  items, onItemsChange, puedeEditar, disabled, puedeVerPrecios = true,
  seleccionables = false, seleccionados = new Set(), onToggleSeleccion, onGenerarOT, generando = false, onVerOT, onQuitarOT,
}) {
  const editable = puedeEditar && !disabled;
  // Qué grupo (clave de GRUPOS_GLORIA) recibe lo elegido en el catálogo —
  // "grupo" acá es el de la cotización (Materiales, Mano de Obra, etc.), no
  // el "grupo" propio del catálogo de servicios (categorías de texto libre,
  // ver SelectorCatalogoServicios.jsx), que son dos taxonomías distintas.
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catalogoGrupo, setCatalogoGrupo] = useState(null);

  const handleItem = (key, campo, valor) =>
    onItemsChange(items.map((i) => (i._key === key ? { ...i, [campo]: valor } : i)));

  const eliminarItem = (key) => onItemsChange(items.filter((i) => i._key !== key));

  const agregarItem = (grupo) => onItemsChange([...items, itemVacioGloria(grupo)]);

  const agregarSubItem = (key) =>
    onItemsChange(items.map((i) =>
      i._key === key
        ? { ...i, subItems: [...(i.subItems || []), { _subKey: Date.now() + Math.random(), texto: "" }] }
        : i
    ));
  const eliminarSubItem = (key, subKey) =>
    onItemsChange(items.map((i) =>
      i._key === key ? { ...i, subItems: i.subItems.filter((s) => s._subKey !== subKey) } : i
    ));
  const handleSubItem = (key, subKey, valor) =>
    onItemsChange(items.map((i) =>
      i._key === key
        ? { ...i, subItems: i.subItems.map((s) => (s._subKey === subKey ? { ...s, texto: valor } : s)) }
        : i
    ));

  const abrirCatalogo = (grupo) => { setCatalogoGrupo(grupo); setCatalogoOpen(true); };
  const cerrarCatalogo = () => { setCatalogoOpen(false); setCatalogoGrupo(null); };
  // Un ítem puntual del catálogo se agrega tal cual, como un ítem propio del
  // grupo (descripción = ese texto). El GRUPO completo del catálogo, en
  // cambio, entra como UN solo ítem (descripción = nombre del grupo del
  // catálogo) con sus textos como sub-ítems debajo — no un ítem por texto,
  // mismo criterio que ya usa TablaItemsCotizacion.jsx para el flujo genérico.
  const agregarDesdeCatalogo = (_catGrupo, texto) =>
    onItemsChange([...items, { ...itemVacioGloria(catalogoGrupo), descripcion: texto }]);
  const agregarGrupoDesdeCatalogo = (catGrupo, textos) => {
    const nuevosSubItems = textos.map((texto) => ({ _subKey: Date.now() + Math.random(), texto }));
    onItemsChange([...items, { ...itemVacioGloria(catalogoGrupo), descripcion: catGrupo, subItems: nuevosSubItems }]);
  };

  const subtotalTotal = items.reduce((acc, i) => acc + calcSubtotalGloria(i), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Ítems (formato Gloria)</h2>
        {seleccionables && seleccionados.size > 0 && (
          <button type="button" onClick={onGenerarOT} disabled={generando}
            className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition font-medium">
            {generando ? "Generando…" : `Generar OT de ${seleccionados.size} ítem${seleccionados.size !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {GRUPOS_GLORIA.map((grupo) => {
          // Índice global (dentro del array `items` completo, no solo del
          // grupo) — el backend identifica el ítem por posición en la lista
          // completa (ver /cotizaciones/:id/items/:index/generar-ot).
          const itemsGrupo = items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.grupo === grupo.clave);
          const esManoObra = grupo.columnas === "mano_obra";
          const subtotalGrupo = itemsGrupo.reduce((acc, { item }) => acc + calcSubtotalGloria(item), 0);

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
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => agregarItem(grupo.clave)}
                      className="border border-sky-200 text-sky-700 text-xs px-3 py-1.5 rounded-lg hover:bg-sky-50 transition font-medium">
                      + Agregar
                    </button>
                    <button type="button" onClick={() => abrirCatalogo(grupo.clave)}
                      className="bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-sky-700 transition font-medium">
                      + Elegir del catálogo
                    </button>
                  </div>
                )}
              </div>

              <TablaScroll className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      {seleccionables && <th className="px-3 py-2 w-12 text-center">OT</th>}
                      <th className="px-3 py-2 text-left">Descripción</th>
                      {esManoObra ? (
                        <>
                          <th className="px-3 py-2 text-center w-24">N° Personas</th>
                          <th className="px-3 py-2 text-center w-24">N° Horas</th>
                          {puedeVerPrecios && <th className="px-3 py-2 text-right w-28">S/. por hora</th>}
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-center w-20">Unidad</th>
                          <th className="px-3 py-2 text-center w-20">Cant.</th>
                          {puedeVerPrecios && <th className="px-3 py-2 text-right w-28">P. Unit.</th>}
                        </>
                      )}
                      {puedeVerPrecios && <th className="px-3 py-2 text-right w-28">Total</th>}
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
                              <input value={item.descripcion}
                                onChange={(e) => handleItem(item._key, "descripcion", e.target.value)}
                                placeholder="Descripción"
                                className={`w-full border border-transparent rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300 focus:border-sky-300 ${descripcionInvalida(item) ? "border-red-200" : ""}`} />
                            ) : (
                              <p className="text-gray-700">{item.descripcion}</p>
                            )}
                            {item.subItems?.length > 0 && (
                              <ul className="mt-1.5 space-y-1">
                                {item.subItems.map((sub) => (
                                  <li key={sub._subKey} className="flex items-start gap-1.5 text-xs text-gray-600">
                                    <span className="text-sky-400 shrink-0">•</span>
                                    {editable ? (
                                      <>
                                        <input value={sub.texto}
                                          onChange={(e) => handleSubItem(item._key, sub._subKey, e.target.value)}
                                          className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-300" />
                                        <button type="button" onClick={() => eliminarSubItem(item._key, sub._subKey)}
                                          className="text-gray-300 hover:text-red-500 shrink-0">✕</button>
                                      </>
                                    ) : (
                                      <span className="flex-1">{sub.texto}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {editable && (
                              <button type="button" onClick={() => agregarSubItem(item._key)}
                                className="mt-1.5 text-xs text-gray-400 hover:text-sky-600 transition">
                                + agregar sub ítem
                              </button>
                            )}
                          </td>
                          {esManoObra ? (
                            <>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="1" value={item.personas} disabled={!editable}
                                  onChange={(e) => handleItem(item._key, "personas", parseFloat(e.target.value) || 0)}
                                  className={`w-full text-center ${editable ? INP : INP_RO}`} />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="0.5" value={item.horas} disabled={!editable}
                                  onChange={(e) => handleItem(item._key, "horas", parseFloat(e.target.value) || 0)}
                                  className={`w-full text-center ${editable ? INP : INP_RO}`} />
                              </td>
                              {puedeVerPrecios && (
                                <td className="px-3 py-2">
                                  <input type="number" min="0" step="0.01" value={item.tarifaHora} disabled={!editable}
                                    onChange={(e) => handleItem(item._key, "tarifaHora", parseFloat(e.target.value) || 0)}
                                    className={`w-full text-right ${editable ? INP : INP_RO}`} />
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2">
                                <select value={item.unidad || "und"} disabled={!editable}
                                  onChange={(e) => handleItem(item._key, "unidad", e.target.value)}
                                  className={`w-full text-center ${editable ? INP : INP_RO}`}>
                                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="1" value={item.cantidad} disabled={!editable}
                                  onChange={(e) => handleItem(item._key, "cantidad", parseFloat(e.target.value) || 0)}
                                  className={`w-full text-center ${editable ? INP : INP_RO}`} />
                              </td>
                              {puedeVerPrecios && (
                                <td className="px-3 py-2">
                                  <input type="number" min="0" step="0.01" value={item.precio} disabled={!editable}
                                    onChange={(e) => handleItem(item._key, "precio", parseFloat(e.target.value) || 0)}
                                    className={`w-full text-right ${editable ? INP : INP_RO}`} />
                                </td>
                              )}
                            </>
                          )}
                          {puedeVerPrecios && (
                            <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                              {calcSubtotalGloria(item).toFixed(2)}
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

      {catalogoOpen && (
        <SelectorCatalogoServicios
          onSeleccionar={agregarDesdeCatalogo}
          onSeleccionarGrupo={agregarGrupoDesdeCatalogo}
          onClose={cerrarCatalogo}
        />
      )}
    </div>
  );
}
