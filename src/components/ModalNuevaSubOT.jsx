import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { INP } from "../utils/cotizacionItems";

const ESTADOS = ["pendiente", "en progreso", "completado", "entregado"];
const CATEGORIAS_TALLER = ["REPARACION", "MANTENIMIENTO PREVENTIVO", "MANTENIMIENTO CORRECTIVO", "GARANTIA"];

const colorEstado = (e, activo) => {
  if (!activo) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (e === "entregado")  return "bg-teal-600 text-white";
  if (e === "completado") return "bg-green-600 text-white";
  if (e === "en progreso") return "bg-blue-600 text-white";
  return "bg-amber-500 text-white";
};

export default function ModalNuevaSubOT({ padre, onClose, onCreada }) {
  const [form, setForm] = useState({
    titulo: "", descripcion: "",
    // MIC/Línea, Backup y Entregado por se heredan del padre por defecto —
    // el técnico puede sobrescribirlos antes de crear si esta sub-OT difiere.
    micLinea: padre.micLinea || "", backup: padre.backup || "", categorizacionTaller: "MANTENIMIENTO PREVENTIVO",
    personalAsignado: "", estado: "pendiente", observaciones: "", entregadoPor: padre.entregadoPor || "",
    fechaEntrega: "", numeroGuiaRemision: "",
    // Encargado Prueba / Encargado Intervención heredan del padre por
    // defecto — cada sub-OT puede tener su propio par de técnicos si la
    // sub-tarea lo requiere.
    encargado: padre.encargado || "", encargado2: padre.encargado2 || "",
  });
  const [usuarios, setUsuarios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth("/personal/lista").then((r) => r.ok && r.json().then(setUsuarios));
    // Encargado Prueba / Encargado Intervención se eligen entre los
    // usuarios con login y rol "tecnico" (distinto de "Personal asignado",
    // que sigue siendo del catálogo de Personal) — ver Fase 13.
    fetchAuth("/usuarios/lista").then((r) => r.ok && r.json()).then((u) => setTecnicos((u || []).filter((x) => ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(x.rol))));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    if (!form.titulo.trim()) return setError("El título es obligatorio.");
    if (!form.categorizacionTaller) return setError("La categorización en taller es obligatoria.");
    setError(""); setGuardando(true);

    const body = { ...form };
    if (!body.personalAsignado) delete body.personalAsignado;
    if (!body.fechaEntrega) delete body.fechaEntrega;

    const res = await fetchAuth(`/ordenes-trabajo/${padre._id}/sub-ot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onCreada(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.mensaje || "No se pudo crear la Sub-OT.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Nueva Sub-OT</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Sub-OT de {padre.numeroOT || padre.codigo}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título *</label>
            <input name="titulo" value={form.titulo} onChange={handleChange}
              placeholder="Título de la sub-tarea" className={`w-full ${INP}`} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
              rows={2} className={`w-full ${INP} resize-none`} placeholder="Detalle del trabajo…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">MIC/Línea</label>
              <input name="micLinea" value={form.micLinea} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Backup</label>
              <input name="backup" value={form.backup} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Categorización en taller *</label>
              <select name="categorizacionTaller" value={form.categorizacionTaller} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Seleccionar categoría…</option>
                {CATEGORIAS_TALLER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Personal asignado</label>
              <select name="personalAsignado" value={form.personalAsignado} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Sin asignar</option>
                {usuarios.map((u) => <option key={u._id} value={u._id}>{u.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado Prueba</label>
              <select name="encargado" value={form.encargado} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Sin asignar</option>
                {tecnicos.filter((t) => t.rol === "tecnico_prueba").map((t) => <option key={t._id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado Intervención</label>
              <select name="encargado2" value={form.encargado2} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Sin asignar</option>
                {tecnicos.filter((t) => t.rol === "tecnico_intervencion").map((t) => <option key={t._id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Estado</label>
            <div className="flex gap-2">
              {ESTADOS.map((e) => (
                <button key={e} type="button" onClick={() => setForm({ ...form, estado: e })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorEstado(e, form.estado === e)}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entregado por</label>
              <input name="entregadoPor" value={form.entregadoPor} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
              <input type="date" name="fechaEntrega" value={form.fechaEntrega} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
          </div>

          <div hidden>
            <label className="text-xs text-gray-500 block mb-1">Guía de salida</label>
            <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange}
              placeholder="—" className={`w-full ${INP}`} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
            <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
              rows={2} className={`w-full ${INP} resize-none`} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Creando…" : "Crear Sub-OT"}
          </button>
        </div>
      </div>
    </div>
  );
}
