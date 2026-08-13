import { useState } from "react";
import SelectorCatalogoServicios from "./SelectorCatalogoServicios";
import {
  calcSubtotal, itemVacioServicio,
  descripcionInvalida, cantidadInvalida, precioInvalido, itemInvalido,
} from "../utils/cotizacionItems";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full transition";

// Tabla de Ítems de una Cotización — usada tanto en el modal de detalle
// (DetalleCotizacion.jsx) como en el de creación standalone
// (ModalNuevaCotizacion.jsx). Misma tabla para tipo "venta" y "servicio":
// descripción editable + sub-ítems anidados + catálogo de servicios, y
// (opcionalmente) selección múltiple para "Generar OT".
export default function TablaItemsCotizacion({
  items, onItemsChange,
  tipo, puedeEditar, disabled, intentoGuardar, totalesMostrados,
  seleccionables = false, seleccionados = new Set(), onToggleSeleccion, onGenerarOT, generando = false, onVerOT, onQuitarOT,
}) {
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catalogoTarget, setCatalogoTarget] = useState(null); // null = "+ Agregar ítem de plantilla" (fusiona/crea fila); _key = agregar descripción a esa fila puntual

  // `puedeEditar` es el permiso de rol (admin/asistente); `disabled` es un
  // bloqueo por estado del documento (anulado o enviado) que aplica incluso
  // a quien sí tiene el rol. Los campos/acciones de cada fila deben respetar
  // ambos — antes solo revisaban `puedeEditar`, así que una cotización
  // "enviada" seguía siendo editable ítem por ítem pese al `disabled`.
  const editable = puedeEditar && !disabled;
  const puedeAgregar = editable;

  const handleItem = (key, campo, valor) =>
    onItemsChange(items.map(i => (i._key === key ? { ...i, [campo]: valor } : i)));

  const eliminarItem = (key) => onItemsChange(items.filter(i => i._key !== key));

  const agregarSubItem = (key) =>
    onItemsChange(items.map(i =>
      i._key === key
        ? { ...i, subItems: [...(i.subItems || []), { _subKey: Date.now() + Math.random(), texto: "" }] }
        : i
    ));

  const eliminarSubItem = (key, subKey) =>
    onItemsChange(items.map(i =>
      i._key === key
        ? { ...i, subItems: i.subItems.filter(s => s._subKey !== subKey) }
        : i
    ));

  const handleSubItem = (key, subKey, valor) =>
    onItemsChange(items.map(i =>
      i._key === key
        ? { ...i, subItems: i.subItems.map(s => (s._subKey === subKey ? { ...s, texto: valor } : s)) }
        : i
    ));

  // Si hay una fila puntual como destino (catalogoTarget), el ítem elegido se
  // agrega como descripción de esa fila sin importar su grupo. Si no, se
  // fusiona con la última fila cuando comparte grupo padre, o crea fila nueva.
  const agregarDesdeCatalogo = (grupo, texto) => agregarTextosDesdeCatalogo(grupo, [texto]);

  // Click en el título del grupo (no en un ítem puntual): carga la fila con
  // TODOS los sub-ítems del grupo de una vez, en vez de tener que clickear
  // uno por uno. Misma lógica de fusión/fila nueva/fila destino que un ítem
  // individual — "+ agregar sub ítem" sigue disponible después para sumar
  // más manualmente.
  const agregarGrupoCompleto = (grupo, textos) => agregarTextosDesdeCatalogo(grupo, textos);

  const agregarTextosDesdeCatalogo = (grupo, textos) => {
    const nuevosSubItems = textos.map((texto) => ({ _subKey: Date.now() + Math.random(), texto }));
    if (catalogoTarget) {
      onItemsChange(items.map(it =>
        it._key === catalogoTarget
          ? { ...it, subItems: [...(it.subItems || []), ...nuevosSubItems] }
          : it
      ));
      return;
    }
    const ultimo = items[items.length - 1];
    if (ultimo && ultimo.descripcion === grupo) {
      onItemsChange(items.map((it, i) => (
        i === items.length - 1
          ? { ...it, subItems: [...(it.subItems || []), ...nuevosSubItems] }
          : it
      )));
      return;
    }
    onItemsChange([...items, { ...itemVacioServicio(), descripcion: grupo, subItems: nuevosSubItems }]);
  };

  const abrirCatalogo = (targetKey = null) => {
    setCatalogoTarget(targetKey);
    setCatalogoOpen(true);
  };

  const cerrarCatalogo = () => {
    setCatalogoOpen(false);
    setCatalogoTarget(null);
  };

  const agregarItemManual = () => onItemsChange([...items, itemVacioServicio()]);

  const colsIzquierda = (puedeEditar ? 4 : 3) + (seleccionables ? 1 : 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-sky-500" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            {tipo === "servicio" ? "Ítems / Servicios" : "Ítems"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {seleccionables && seleccionados.size > 0 && (
            <button type="button" onClick={onGenerarOT} disabled={generando}
              className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition font-medium">
              {generando ? "Generando…" : `Generar OT de ${seleccionados.size} ítem${seleccionados.size !== 1 ? "s" : ""}`}
            </button>
          )}
          {puedeAgregar && (
            <button type="button" onClick={agregarItemManual}
              className="border border-sky-200 text-sky-700 text-sm px-4 py-2 rounded-lg hover:bg-sky-50 transition font-medium">
              + Agregar ítem manual
            </button>
          )}
          {puedeAgregar && tipo === "servicio" && (
            <button type="button" onClick={() => abrirCatalogo()}
              className="bg-sky-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-sky-700 transition font-medium">
              + Agregar ítem de plantilla
            </button>
          )}
        </div>
      </div>

      {intentoGuardar && items.some(itemInvalido) && (
        <p className="px-6 pt-3 text-xs text-red-500">
          Hay ítems con campos obligatorios sin completar (descripción, cantidad o precio). Corrígelos antes de guardar — resaltados en rojo.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {seleccionables && <th className="px-3 py-3 w-12 text-center">OT</th>}
              <th className="px-3 py-3 text-center w-12">Item</th>
              <th className="px-3 py-3 text-left">Descripción *</th>
              <th className="px-3 py-3 text-center w-24">Cantidad *</th>
              <th className="px-3 py-3 text-right w-32">Precio unitario *</th>
              <th className="px-3 py-3 text-right w-32">Precio total</th>
              {puedeEditar && <th className="px-3 py-3 w-10"><span className="sr-only">Quitar</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={(puedeEditar ? 6 : 5) + (seleccionables ? 1 : 0)} className="px-4 py-8 text-center text-gray-400">
                  Sin ítems agregados{puedeAgregar
                    ? (tipo === "servicio"
                      ? " — usa “+ Agregar ítem manual” para escribir uno o “+ Agregar ítem de plantilla” para elegir del catálogo de servicios."
                      : " — usa “+ Agregar ítem manual” para escribir uno.")
                    : "."}
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item._key} className="align-top">
                  {seleccionables && (
                    <td className="px-3 py-3 text-center">
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
                          onChange={() => onToggleSeleccion?.(idx)} disabled={disabled}
                          className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400" />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3 text-center text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-3">
                    {editable ? (
                      <input value={item.descripcion}
                        onChange={(e) => handleItem(item._key, "descripcion", e.target.value)}
                        placeholder="Descripción del ítem"
                        className={`w-full font-semibold text-gray-800 text-xs uppercase tracking-wide border border-transparent rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300 focus:border-sky-300 ${intentoGuardar && descripcionInvalida(item) ? "border-red-400 ring-1 ring-red-300" : ""}`} />
                    ) : (
                      <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">{item.descripcion}</p>
                    )}
                    {item.subItems?.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {item.subItems.map(sub => (
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
                      <div className="mt-1.5 flex items-center gap-3">
                        <button type="button" onClick={() => agregarSubItem(item._key)}
                          className="text-xs text-gray-400 hover:text-sky-600 transition">
                          + agregar sub ítem
                        </button>
                        {tipo === "servicio" && (
                          <button type="button" onClick={() => abrirCatalogo(item._key)}
                            className="text-xs text-gray-400 hover:text-sky-600 transition">
                            + elegir del catálogo
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="0" step="1" value={item.cantidad} disabled={!editable}
                      onChange={(e) => handleItem(item._key, "cantidad", parseFloat(e.target.value) || 0)}
                      className={`w-full text-center ${editable ? INP : "bg-transparent border-transparent text-sm px-2 py-1"} ${intentoGuardar && cantidadInvalida(item) ? "border-red-400 ring-1 ring-red-300" : ""}`} />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="0" step="0.01" value={item.precio} disabled={!editable}
                      onChange={(e) => handleItem(item._key, "precio", parseFloat(e.target.value) || 0)}
                      className={`w-full text-right ${editable ? INP : "bg-transparent border-transparent text-sm px-2 py-1"} ${intentoGuardar && precioInvalido(item) ? "border-red-400 ring-1 ring-red-300" : ""}`} />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700 tabular-nums">
                    {calcSubtotal(item).toFixed(2)}
                  </td>
                  {puedeEditar && (
                    <td className="px-3 py-3 text-center">
                      {editable && (
                        <button type="button" onClick={() => eliminarItem(item._key)}
                          className="text-red-400 hover:text-red-600">✕</button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={colsIzquierda} className="px-4 py-2 text-right text-xs text-gray-500">Subtotal</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{totalesMostrados.subtotal.toFixed(2)}</td>
                {puedeEditar && <td />}
              </tr>
              <tr>
                <td colSpan={colsIzquierda} className="px-4 py-2 text-right text-xs text-gray-500">IGV 18%</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{totalesMostrados.igv.toFixed(2)}</td>
                {puedeEditar && <td />}
              </tr>
              <tr>
                <td colSpan={colsIzquierda} className="px-4 py-2 text-right text-sm font-semibold text-gray-800">Total</td>
                <td className="px-3 py-2 text-right font-bold text-gray-900 text-base tabular-nums">{totalesMostrados.total.toFixed(2)}</td>
                {puedeEditar && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {catalogoOpen && (
        <SelectorCatalogoServicios
          onSeleccionar={agregarDesdeCatalogo}
          onSeleccionarGrupo={agregarGrupoCompleto}
          onClose={cerrarCatalogo}
        />
      )}
    </div>
  );
}
