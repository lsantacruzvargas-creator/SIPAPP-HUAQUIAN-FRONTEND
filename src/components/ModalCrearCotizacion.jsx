import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  return { subtotal: s, igv, total: Math.round((s + igv) * 100) / 100 };
}

export default function ModalCrearCotizacion({ orden, onClose, onCreada }) {
  const emp = orden.empresa;
  const [numeroCotizacion, setNumeroCotizacion] = useState("");
  const [tipo, setTipo] = useState("venta");
  const [subtotal, setSubtotal] = useState(orden.subtotal > 0 ? String(orden.subtotal) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth("/cotizaciones/siguiente-numero-cotizacion").then(r =>
      r.ok && r.json().then(d => setNumeroCotizacion(d.siguiente))
    );
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const body = {
      numeroDocumento: orden.numeroDocumento,
      empresa:         emp?._id,
      titulo:          orden.titulo,
      numeroCotizacion,
      tipo,
      planta:             orden.planta,
      encargado:          orden.encargado,
      numeroGuiaEmision:  orden.numeroGuiaEmision,
      numeroGuiaRemision: orden.numeroGuiaRemision,
      codigoSap:          orden.codigoSap,
      fechaSalida:        orden.fechaSalida,
      ...calcular(subtotal),
    };
    if (!body.empresa) delete body.empresa;
    if (orden.fechaRecibida) body.fechaRecibida = orden.fechaRecibida;

    const res = await fetchAuth("/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const nueva = await res.json();
      await fetchAuth(`/ordenes-trabajo/${orden._id}/vincular-cotizacion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizacion: nueva._id }),
      });
      onCreada(nueva);
      // No se reactiva `guardando`: el botón queda deshabilitado hasta que
      // el padre cierre el modal, evitando una segunda creación por doble click.
    } else {
      setError("Error al crear la cotización.");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nueva Cotización</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos de la orden de trabajo</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Título</label>
              <input value={orden.titulo} disabled className={INP_RO} />
            </div>
            {emp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Empresa</label>
                  <input value={emp.razonSocial} disabled className={INP_RO} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">RUC</label>
                  <input value={emp.ruc || "—"} disabled className={INP_RO} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° Cotización</label>
              <input
                type="text"
                value={numeroCotizacion}
                onChange={(e) => setNumeroCotizacion(e.target.value)}
                className={INP}
                placeholder="Ej. COT-2026-001"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INP}>
                <option value="venta">Venta</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Subtotal sin IGV (S/)</label>
            <input
              type="number"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              className={INP}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-sky-600 text-white px-5 py-2 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Creando…" : "Crear Cotización"}
          </button>
        </div>
      </div>
    </div>
  );
}
