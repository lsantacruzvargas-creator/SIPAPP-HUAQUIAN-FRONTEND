import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import ModalEmpresa from "./ModalEmpresa";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";

const FORM_VACIO = {
  numeroOT: "",
  fechaRecibida: "",
  codigoSap: "",
  empresa: "",
  planta: "",
  titulo: "",
  condicion: "",
  encargado: "",
  encargado2: "",
  numeroGuiaEmision: "",
  numeroGuiaRemision: "",
  fechaSalida: "",
  protocolo: "",
  observaciones: "",
};

export default function ModalNuevaOT({ onClose, onCreada }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [empresas, setEmpresas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [nuevaEmpresaOpen, setNuevaEmpresaOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargarEmpresas = () =>
    fetchAuth("/empresas").then((res) => res.ok && res.json().then(setEmpresas));

  useEffect(() => {
    fetchAuth("/ordenes-trabajo/siguiente-numero-ot").then((r) =>
      r.ok && r.json().then((d) => setForm((f) => ({ ...f, numeroOT: d.siguiente })))
    );
    cargarEmpresas();
    fetchAuth("/personal/lista?todos=true").then((r) => r.ok && r.json().then(setPersonal));
  }, []);

  const empresaSel = empresas.find((e) => e._id === form.empresa);
  const plantaSel = empresaSel?.plantas?.find((p) => p.nombre === form.planta);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    if (!form.numeroOT.trim()) return setError("El N° de Orden de Trabajo es obligatorio.");
    if (!form.titulo.trim()) return setError("La descripción es obligatoria.");
    setGuardando(true);
    setError("");

    const body = {
      numeroOT: form.numeroOT,
      fechaRecibida: form.fechaRecibida || null,
      codigoSap: form.codigoSap,
      empresa: form.empresa || undefined,
      planta: form.planta,
      contactoNombre: plantaSel?.contactoNombre || "",
      contactoTelefono: plantaSel?.contactoTelefono || "",
      titulo: form.titulo,
      condicion: form.condicion,
      encargado: form.encargado,
      encargado2: form.encargado2,
      numeroGuiaEmision: form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      fechaSalida: form.fechaSalida || null,
      protocolo: form.protocolo,
      observaciones: form.observaciones,
    };
    if (!body.empresa) delete body.empresa;

    const res = await fetchAuth("/ordenes-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const nueva = await res.json();
      onCreada?.(nueva);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.mensaje || "Error al crear la Orden de Trabajo");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Crear Orden de Trabajo</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° Orden de Trabajo</label>
              <input name="numeroOT" value={form.numeroOT} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha de ingreso</label>
              <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
              <input name="codigoSap" value={form.codigoSap} onChange={handleChange} className={INP} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cliente</label>
              <div className="flex gap-2">
                <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                  <option value="">Seleccionar empresa…</option>
                  {empresas.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNuevaEmpresaOpen(true)}
                  className="shrink-0 text-xs border border-gray-300 px-3 rounded-lg hover:bg-gray-50 transition"
                >
                  + Nueva
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Planta</label>
              {empresaSel?.plantas?.length > 0 ? (
                <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                  <option value="">Seleccionar planta…</option>
                  {empresaSel.plantas.map((p, i) => (
                    <option key={i} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              ) : (
                <input name="planta" value={form.planta} onChange={handleChange} className={INP} placeholder="Planta" />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Persona de contacto</label>
              <p className={`${INP} bg-gray-50 text-gray-500`}>
                {plantaSel ? `${plantaSel.contactoNombre} — ${plantaSel.contactoTelefono || "—"}` : "Selecciona una planta"}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
            <input name="titulo" value={form.titulo} onChange={handleChange} className={INP} placeholder="Descripción del trabajo" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Condición</label>
              <input name="condicion" value={form.condicion} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado</label>
              <select name="encargado" value={form.encargado} onChange={handleChange} className={INP}>
                <option value="">Sin asignar</option>
                {personal.map((p) => (
                  <option key={p._id} value={p.nombre}>{p.nombre}{!p.activo ? " (inactivo)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado 2</label>
              <select name="encargado2" value={form.encargado2} onChange={handleChange} className={INP}>
                <option value="">Sin asignar</option>
                {personal.map((p) => (
                  <option key={p._id} value={p.nombre}>{p.nombre}{!p.activo ? " (inactivo)" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Guía de llegada</label>
              <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Guía de salida</label>
              <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
              <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Protocolo</label>
            <input name="protocolo" value={form.protocolo} onChange={handleChange} className={INP} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
            <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={3} className={`${INP} resize-none`} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium"
          >
            {guardando ? "Creando…" : "Crear Orden de Trabajo"}
          </button>
        </div>
      </div>

      {nuevaEmpresaOpen && (
        <ModalEmpresa
          onClose={() => setNuevaEmpresaOpen(false)}
          onGuardada={async (nueva) => {
            await cargarEmpresas();
            setForm((f) => ({ ...f, empresa: nueva._id }));
            setNuevaEmpresaOpen(false);
          }}
        />
      )}
    </div>
  );
}
