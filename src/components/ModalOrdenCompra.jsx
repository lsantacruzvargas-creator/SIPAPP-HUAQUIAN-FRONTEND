import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  return { subtotal: s, igv, total: Math.round((s + igv) * 100) / 100 };
}

export default function ModalOrdenCompra({ cotizacion, onClose, onCreada }) {
  const [monto, setMonto]               = useState(cotizacion.total ?? 0);
  const [numeroOrden, setNumeroOrden] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [exito, setExito]         = useState(null);
  const emp = cotizacion.empresa;

  const guardar = async () => {
    if (!numeroOrden.trim()) return setError("El número de orden de compra es obligatorio.");
    if (!monto || Number(monto) <= 0) return setError("El monto es obligatorio.");
    setGuardando(true);
    setError("");
    const calc = calcular(Number(monto) / 1.18); // Guardamos el subtotal sin IGV
    const res = await fetchAuth("/ordenes-compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cotizacion:    cotizacion._id,
        empresa:       emp?._id,
        titulo:        cotizacion.titulo,
        numeroOrden:   numeroOrden || undefined,
        monto:         calc.subtotal,
        ...calc,
        planta:             cotizacion.planta,
        encargado:          cotizacion.encargado,
        numeroGuiaEmision:  cotizacion.numeroGuiaEmision,
        numeroGuiaRemision: cotizacion.numeroGuiaRemision,
        codigoSap:          cotizacion.codigoSap,
        fechaSalida:        cotizacion.fechaSalida,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setExito(data.codigo);
      setTimeout(() => onCreada(data), 1800);
      // No se reactiva `guardando`: el botón queda deshabilitado durante el
      // mensaje de éxito, evitando una segunda creación por doble click.
    } else {
      setError("Error al crear la orden de compra.");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nueva Orden de Compra</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos de la cotización</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Código</label>
                <input value={cotizacion.codigo} disabled className={INP_RO} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <input value={cotizacion.tipo} disabled className={INP_RO} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Título</label>
              <input value={cotizacion.titulo} disabled className={INP_RO} />
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

          <div>
            <label className="text-xs text-gray-500 block mb-1">Número de orden de compra</label>
            <input
              type="text"
              value={numeroOrden}
              onChange={(e) => setNumeroOrden(e.target.value)}
              className={INP}
              placeholder="Ej. OC-2024-001"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Monto (S/)</label>
            <input
              type="number"
              value={Number(monto/1.18).toFixed(2)}
              onChange={(e) => setMonto(e.target.value)}
              className={INP}
              min="0"
              step="0.1"
            />
          </div>

          {exito && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Orden <strong>{exito}</strong> creada exitosamente.
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Creando…" : "Crear Orden de Compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
