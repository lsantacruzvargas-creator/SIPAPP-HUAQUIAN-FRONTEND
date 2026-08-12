import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { INP, INP_RO } from "../utils/cotizacionItems";

const PRIORIDADES = ["alta", "media", "baja"];

const colorPrioridad = (p, activa) => {
  if (!activa) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (p === "alta") return "bg-red-500 text-white";
  if (p === "media") return "bg-amber-400 text-white";
  return "bg-green-500 text-white";
};

export default function ModalCrearOT({ cotizacion, onClose, onCreada }) {
  const empresa = cotizacion.empresa;

  const [form, setForm] = useState({
    titulo: cotizacion.titulo || "",
    descripcion: "",
    prioridad: "media",
    fechaEntrega: "",
    personalAsignado: "",
  });
  const [usuarios, setUsuarios] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetchAuth("/personal/lista").then((r) => r.ok && r.json().then(setUsuarios));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    const body = {
      cotizacion: cotizacion._id,
      empresa: empresa?._id || undefined,
      titulo: form.titulo,
      descripcion: form.descripcion,
      prioridad: form.prioridad,
      fechaEntrega: form.fechaEntrega || null,
      personalAsignado: form.personalAsignado || undefined,
    };
    if (!body.empresa) delete body.empresa;
    if (!body.personalAsignado) delete body.personalAsignado;
    // "Fecha recibida" (cotización) y "Fecha de ingreso" (OT) son el mismo
    // dato — se replica al crear la OT desde una cotización ya existente.
    if (cotizacion.fechaRecibida) body.fechaRecibida = cotizacion.fechaRecibida;

    const res = await fetchAuth("/ordenes-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const nueva = await res.json();
      onCreada(nueva);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">Nueva Orden de Trabajo</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{cotizacion.codigo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Info cliente (solo lectura) */}
          {empresa && (
            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Empresa</label>
                <input
                  value={empresa.razonSocial}
                  disabled
                  className={`w-full ${INP_RO} text-gray-700`}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">RUC</label>
                <input
                  value={empresa.ruc || ""}
                  disabled
                  className={`w-full ${INP_RO} text-gray-700`}
                />
              </div>
              {empresa.direccion && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Dirección</label>
                  <input
                    value={empresa.direccion}
                    disabled
                    className={`w-full ${INP_RO} text-gray-700`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Título */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título</label>
            <input
              name="titulo"
              value={form.titulo}
              onChange={handleChange}
              required
              className={`w-full ${INP}`}
              placeholder="Título de la orden"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción del trabajo</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
              className={`w-full ${INP} resize-none`}
              placeholder="Detalle del trabajo a realizar…"
            />
          </div>

          {/* Prioridad + Fecha + Personal */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Prioridad</label>
              <div className="flex gap-1.5">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, prioridad: p })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorPrioridad(
                      p,
                      form.prioridad === p
                    )}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
              <input
                type="date"
                name="fechaEntrega"
                value={form.fechaEntrega}
                onChange={handleChange}
                className={`w-full ${INP}`}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Personal asignado</label>
              <select
                name="personalAsignado"
                value={form.personalAsignado}
                onChange={handleChange}
                className={`w-full ${INP}`}
              >
                <option value="">Sin asignar</option>
                {usuarios.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !form.titulo}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium"
          >
            {guardando ? "Creando…" : "Crear Orden de Trabajo"}
          </button>
        </div>
      </div>
    </div>
  );
}
