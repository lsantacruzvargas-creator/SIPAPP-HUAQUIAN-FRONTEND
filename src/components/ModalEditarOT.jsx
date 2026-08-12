import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { INP } from "../utils/cotizacionItems";

const PRIORIDADES = ["alta", "media", "baja"];
const ESTADOS = ["pendiente", "en progreso", "completado", "entregado"];

const colorPrioridad = (p, activa) => {
  if (!activa) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (p === "alta") return "bg-red-500 text-white";
  if (p === "media") return "bg-amber-400 text-white";
  return "bg-green-500 text-white";
};

const colorEstado = (e, activo) => {
  if (!activo) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (e === "entregado")  return "bg-teal-600 text-white";
  if (e === "completado") return "bg-green-600 text-white";
  if (e === "en progreso") return "bg-blue-600 text-white";
  return "bg-amber-500 text-white";
};

export default function ModalEditarOT({ orden, onClose, onGuardada }) {
  const [form, setForm] = useState({
    titulo: orden.titulo || "",
    descripcion: orden.descripcion || "",
    prioridad: orden.prioridad || "media",
    estado: orden.estado || "pendiente",
    fechaEntrega: orden.fechaEntrega
      ? new Date(orden.fechaEntrega).toISOString().split("T")[0]
      : "",
    personalAsignado: orden.personalAsignado?._id || "",
    fechaRecibida: orden.fechaRecibida
      ? new Date(orden.fechaRecibida).toISOString().split("T")[0]
      : "",
    numeroOT: orden.numeroOT || "",
    numeroGuiaEmision: orden.numeroGuiaEmision || "",
    numeroGuiaRemision: orden.numeroGuiaRemision || "",
  });
  const [usuarios, setUsuarios] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetchAuth("/personal/lista").then((r) => r.ok && r.json().then(setUsuarios));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    const body = { ...form };
    if (!body.personalAsignado) delete body.personalAsignado;
    if (!body.fechaEntrega) delete body.fechaEntrega;
    if (!body.fechaRecibida) delete body.fechaRecibida;

    const res = await fetchAuth(`/ordenes-trabajo/${orden._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const actualizada = await res.json();
      onGuardada(actualizada);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Modificar Orden de Trabajo</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título</label>
            <input name="titulo" value={form.titulo} onChange={handleChange} className={`w-full ${INP}`} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">N° OT</label>
            <input name="numeroOT" value={form.numeroOT} onChange={handleChange} placeholder="—" className={`w-full ${INP}`} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha recibida</label>
            <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={`w-full ${INP}`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
              <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} placeholder="—" className={`w-full ${INP}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de salida</label>
              <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={`w-full ${INP}`} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
              className={`w-full ${INP} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Prioridad</label>
              <div className="flex gap-1.5">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, prioridad: p })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorPrioridad(p, form.prioridad === p)}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
              <input type="date" name="fechaEntrega" value={form.fechaEntrega} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Estado</label>
            <div className="flex gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm({ ...form, estado: e })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorEstado(e, form.estado === e)}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Personal asignado</label>
            <select name="personalAsignado" value={form.personalAsignado} onChange={handleChange} className={`w-full ${INP}`}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u._id} value={u._id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
