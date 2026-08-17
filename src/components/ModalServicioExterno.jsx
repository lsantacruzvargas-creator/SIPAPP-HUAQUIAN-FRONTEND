import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-full transition";

export default function ModalServicioExterno({ ot, onClose, onCreado }) {
  const [form, setForm] = useState({ rucProveedor: "", nombreProveedor: "", tipoTrabajo: "", cantidad: "1", costo: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    if (!form.nombreProveedor.trim()) return setError("El nombre/razón social del proveedor es obligatorio.");
    if (!form.tipoTrabajo.trim()) return setError("El tipo de trabajo es obligatorio.");
    if (!form.cantidad || Number(form.cantidad) <= 0) return setError("Ingresa una cantidad válida.");
    setGuardando(true);
    setError("");

    const res = await fetchAuth("/servicios-externos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordenTrabajo: ot._id,
        rucProveedor: form.rucProveedor.trim(),
        nombreProveedor: form.nombreProveedor.trim(),
        tipoTrabajo: form.tipoTrabajo.trim(),
        cantidad: Number(form.cantidad),
        costo: form.costo ? Number(form.costo) : 0,
      }),
    });

    if (res.ok) {
      onCreado(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.mensaje || "No se pudo registrar el servicio.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Nuevo Servicio Externo</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{ot.numeroOT || ot.codigo}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">RUC del proveedor</label>
            <input name="rucProveedor" value={form.rucProveedor} onChange={handleChange}
              maxLength={11} placeholder="Opcional" className={INP} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre / Razón social *</label>
            <input name="nombreProveedor" value={form.nombreProveedor} onChange={handleChange} className={INP} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de trabajo *</label>
            <input name="tipoTrabajo" value={form.tipoTrabajo} onChange={handleChange}
              placeholder="Ej: Rebobinado, transporte, torneado…" className={INP} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cantidad *</label>
              <input type="number" min="0.01" step="any" name="cantidad" value={form.cantidad} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Costo (S/)</label>
              <input type="number" min="0" step="0.01" name="costo" value={form.costo} onChange={handleChange}
                placeholder="Opcional" className={INP} />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="text-sm bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Agregar servicio"}
          </button>
        </div>
      </div>
    </div>
  );
}
