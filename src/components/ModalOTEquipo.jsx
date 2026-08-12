import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { INP, INP_RO } from "../utils/cotizacionItems";

const PRIORIDADES = ["alta", "media", "baja"];

const colorPrioridad = (p, activa) => {
  if (!activa) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (p === "alta")  return "bg-red-500 text-white";
  if (p === "media") return "bg-amber-400 text-white";
  return "bg-green-500 text-white";
};

export default function ModalOTEquipo({ ingreso, onClose, onCreada }) {
  const empresa = ingreso.empresa;

  const [form, setForm] = useState({
    titulo:           `${ingreso.tipoEquipo}${ingreso.marca ? " " + ingreso.marca : ""}${ingreso.modelo ? " " + ingreso.modelo : ""}`,
    descripcion:      ingreso.descripcionProblema || "",
    prioridad:        "media",
    fechaEntrega:     "",
    personalAsignado: "",
  });
  const [personal, setPersonal]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    fetchAuth("/personal/lista").then((r) => r.ok && r.json().then(setPersonal));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    if (!form.titulo.trim()) { setError("El título es obligatorio."); return; }
    setGuardando(true);
    setError("");
    const body = {
      ingresoEquipo:    ingreso._id,
      titulo:           form.titulo,
      descripcion:      form.descripcion,
      prioridad:        form.prioridad,
      fechaEntrega:     form.fechaEntrega || null,
      personalAsignado: form.personalAsignado || undefined,
    };
    if (empresa?._id) body.empresa = empresa._id;
    if (!body.personalAsignado) delete body.personalAsignado;

    const res = await fetchAuth("/ordenes-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onCreada(await res.json());
    } else {
      setError("Error al crear la orden de trabajo.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Nueva Orden de Trabajo</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{ingreso.codigo}</p>
          </div>
          <button type="button" onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">

          {/* Info equipo */}
          <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Ingreso de equipo · <span className="font-mono">{ingreso.codigo}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo de equipo</label>
                <input value={ingreso.tipoEquipo} disabled className={`w-full ${INP_RO}`} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Marca / Modelo</label>
                <input
                  value={[ingreso.marca, ingreso.modelo].filter(Boolean).join(" / ") || "—"}
                  disabled className={`w-full ${INP_RO}`}
                />
              </div>
             
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Características eléctricas</label>
                  <input value={ingreso.caracteristicasElectricas} disabled className={`w-full ${INP_RO}`} />
                </div>
              



              {empresa && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cliente</label>
                    <input value={empresa.razonSocial} disabled className={`w-full ${INP_RO}`} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">RUC</label>
                    <input value={empresa.ruc || "—"} disabled className={`w-full ${INP_RO}`} />
                  </div>
                </>
              )}
              
              {ingreso.planta && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Planta</label>
                  <input value={ingreso.planta} disabled className={`w-full ${INP_RO}`} />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Fecha de ingreso</label>
                <input
                  value={ingreso.fechaIngreso ? new Date(ingreso.fechaIngreso).toLocaleDateString("es-PE") : "—"}
                  disabled className={`w-full ${INP_RO}`}
                />
              </div>
              
              {ingreso.accesorios && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Accesorios</label>
                  <input value={ingreso.accesorios} disabled className={`w-full ${INP_RO}`} />
                </div>
              )}
              {ingreso.descripcionProblema && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Descripción del problema</label>
                  <textarea value={ingreso.descripcionProblema} disabled rows={2}
                    className={`w-full ${INP_RO} resize-none`} />
                </div>
              )}
              {ingreso.numeroGuiaEmision && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">N° guía de emisión</label>
                  <input value={ingreso.numeroGuiaEmision} disabled className={`w-full ${INP_RO} font-mono`} />
                </div>
              )}
              {ingreso.garantia && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Garantía</label>
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                    En garantía
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título de la OT</label>
            <input name="titulo" value={form.titulo} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Título de la orden" />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción del trabajo</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
              rows={3} className={`w-full ${INP} resize-none`}
              placeholder="Detalle del trabajo a realizar…" />
          </div>

          {/* Prioridad + Fecha + Personal */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Prioridad</label>
              <div className="flex gap-1.5">
                {PRIORIDADES.map((p) => (
                  <button key={p} type="button"
                    onClick={() => setForm({ ...form, prioridad: p })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorPrioridad(p, form.prioridad === p)}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
              <input type="date" name="fechaEntrega" value={form.fechaEntrega}
                onChange={handleChange} className={`w-full ${INP}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Personal asignado</label>
              <select name="personalAsignado" value={form.personalAsignado}
                onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Sin asignar</option>
                {personal.map((p) => (
                  <option key={p._id} value={p._id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !form.titulo}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Creando…" : "Crear Orden de Trabajo"}
          </button>
        </div>
      </div>
    </div>
  );
}
