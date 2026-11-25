import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import { montoAjustadoItem } from "../utils/cotizacionItems";
import { money, totalSinIgv } from "./detalleShared";
import { r2 } from "../utils/redondeo";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";

// Genera una OC nueva o anexa los ítems elegidos de la cotización a una OC existente: la OC
// crece en partidas, una por cotización. `indices` vacío = cotización sin ítems (importada).
export default function ModalGenerarOC({ cotizacion, indices, onClose, onCreada }) {
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(getUsuario()?.rol);
  const moneda = cotizacion.moneda;
  const items = cotizacion.items || [];
  const elegidos = indices.map((idx) => ({ idx, item: items[idx] })).filter((e) => e.item);
  const sinItemsLibres = items.length > 0 && elegidos.length === 0;
  const monto = items.length === 0 || elegidos.length === items.length
    ? totalSinIgv(cotizacion)
    : r2(elegidos.reduce((s, e) => s + montoAjustadoItem(cotizacion, e.item), 0));

  const [form, setForm] = useState(() => ({
    modo: "nueva",
    numeroOrden: "",
    titulo: elegidos.length === items.length
      ? cotizacion.titulo || ""
      : elegidos.map((e) => e.item.descripcion).filter(Boolean).join(" / "),
    ordenCompra: "",
  }));
  const [destinos, setDestinos] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    fetchAuth(`/ordenes-compra/destinos-anexo?cotizacion=${cotizacion._id}`)
      .then(async (r) => (r.ok ? r.json() : []))
      .then(setDestinos);
  }, [cotizacion._id]);

  const guardar = async () => {
    const anexar = form.modo === "anexar";
    if (sinItemsLibres) return setError("La cotización no tiene ítems libres: todos están en una OC.");
    if (anexar && !form.ordenCompra) return setError("Elige la OC a la que se anexa.");
    if (!anexar && !form.numeroOrden.trim()) return setError("El número de orden de compra es obligatorio.");
    if (!anexar && !form.titulo.trim()) return setError("El título es obligatorio.");
    setGuardando(true);
    setError("");
    const res = await fetchAuth("/ordenes-compra/partidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cotizacion: cotizacion._id,
        indices: elegidos.map((e) => e.idx),
        ...(anexar
          ? { ordenCompra: form.ordenCompra }
          : { numeroOrden: form.numeroOrden.trim(), titulo: form.titulo.trim() }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.mensaje || "No se pudo generar la orden de compra.");
      setGuardando(false);
      return;
    }
    onCreada(data);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-800">Generar Orden de Compra</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {cotizacion.numeroCotizacion || cotizacion.codigo}
              {items.length > 0 && ` · ${elegidos.length} de ${items.length} ítem${items.length !== 1 ? "s" : ""}`}
            </p>
            {elegidos.length > 0 ? (
              <ul className="divide-y divide-gray-200 text-sm">
                {elegidos.map(({ idx, item }) => (
                  <li key={idx} className="flex items-start justify-between gap-3 py-1.5">
                    <span className="text-gray-700"><span className="text-gray-400 mr-1.5">{idx + 1}.</span>{item.descripcion}</span>
                    {puedeVerPrecios && (
                      <span className="text-gray-600 tabular-nums whitespace-nowrap">{money(montoAjustadoItem(cotizacion, item), moneda)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">
                {sinItemsLibres ? "Todos los ítems ya están en una orden de compra." : cotizacion.titulo}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[["nueva", "OC nueva"], ["anexar", "Anexar a OC existente"]].map(([valor, etiqueta]) => (
              <label key={valor}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition ${form.modo === valor ? "border-amber-400 bg-amber-50 text-amber-800 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <input type="radio" name="modo" value={valor} checked={form.modo === valor} onChange={handleChange} className="accent-amber-600" />
                {etiqueta}
              </label>
            ))}
          </div>

          {form.modo === "nueva" ? (
            <>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Número de orden de compra *</label>
                <input name="numeroOrden" value={form.numeroOrden} onChange={handleChange} className={INP} placeholder="Ej. 4500012345" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Título *</label>
                <textarea name="titulo" value={form.titulo} onChange={handleChange} rows={2} className={INP} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">OC de la misma empresa y moneda, vigentes y sin pagar</p>
              {destinos === null && <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>}
              {destinos?.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No hay OC a las que se pueda anexar esta cotización.</p>
              )}
              {(destinos || []).map((d) => (
                <label key={d._id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${form.ordenCompra === d._id ? "border-amber-400 bg-amber-50" : "border-gray-100 hover:bg-gray-50"}`}>
                  <input type="radio" name="ordenCompra" value={d._id} checked={form.ordenCompra === d._id} onChange={handleChange} className="mt-1 accent-amber-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-xs text-amber-700">{d.numeroOrden || d.codigo}</span>
                      {puedeVerPrecios && <span className="text-xs text-gray-500 shrink-0 tabular-nums">{money(d.subtotal, moneda)} sin IGV</span>}
                    </div>
                    <p className="text-sm text-gray-700 truncate">{d.titulo}</p>
                    <p className="text-xs text-gray-400">{d.nPartidas} partida{d.nPartidas !== 1 ? "s" : ""}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {puedeVerPrecios && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {form.modo === "nueva" ? "Monto sin IGV" : "Monto que se suma a la OC, sin IGV"} ({moneda === "USD" ? "US$" : "S/"})
              </label>
              <input value={monto.toFixed(2)} readOnly className={INP_RO} />
              <p className="text-[11px] text-gray-400 mt-1">Se calcula desde la cotización (con su descuento, gastos y utilidad); no se edita.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || sinItemsLibres}
            className="text-sm bg-amber-600 text-white px-5 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Generando…" : form.modo === "nueva" ? "Crear Orden de Compra" : "Anexar a la OC"}
          </button>
        </div>
      </div>
    </div>
  );
}
