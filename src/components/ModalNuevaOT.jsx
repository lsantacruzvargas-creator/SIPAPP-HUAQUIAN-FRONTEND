import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import SelectorEmpresas from "./SelectorEmpresas";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const CATEGORIAS_SERVICIO = ["SOPORTE", "DEVOLUCION", "DIAGNOSTICO", "GARANTIA", "MANTENIMIENTO", "REPARACION", "PRESTAMO", "SUMINISTRO", "MANTENIMIENTO EN PLANTA"];

const FORM_VACIO = {
  numeroOT: "",
  fechaRecibida: "",
  codigoSap: "",
  empresa: "",
  planta: "",
  personaContacto: "",
  titulo: "",
  condicion: "",
  categorizacionTaller: "",
  micLinea: "",
  backup: "",
  entregadoPor: "",
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
  const [tecnicos, setTecnicos] = useState([]);
  const [empresasOpen, setEmpresasOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busquedaEmpresa, setBusquedaEmpresa] = useState("");
  const [listaEmpresaAbierta, setListaEmpresaAbierta] = useState(false);

  const cargarEmpresas = () =>
    fetchAuth("/empresas").then((res) => res.ok && res.json().then(setEmpresas));

  useEffect(() => {
    fetchAuth("/ordenes-trabajo/siguiente-numero-ot").then((r) =>
      r.ok && r.json().then((d) => setForm((f) => ({ ...f, numeroOT: d.siguiente })))
    );
    cargarEmpresas();
    // Encargado Prueba / Encargado Intervención se eligen entre los
    // usuarios con login y rol "tecnico" (antes salían de Personal, que no
    // tiene ninguna relación real con quién puede loguearse como técnico y
    // que su nombre coincida con el de la OT — ver Fase 13).
    fetchAuth("/usuarios/lista").then((r) => r.ok && r.json()).then((u) => setTecnicos((u || []).filter((x) => ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(x.rol))));
  }, []);

  const empresaSel = empresas.find((e) => e._id === form.empresa);
  const plantaSel = empresaSel?.plantas?.find((p) => p.nombre === form.planta);
  const contactosPlanta = plantaSel?.contactos ?? [];
  const contactoSel = contactosPlanta.find((c) => c.nombre === form.personaContacto);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "", personaContacto: "" } : {}),
      ...(name === "planta" ? { personaContacto: "" } : {}),
    }));
  };

  const qEmpresa = busquedaEmpresa.trim().toLowerCase();
  const empresasFiltradas = (qEmpresa
    ? empresas.filter((e) =>
        [e.razonSocial, e.alias, e.ruc].some((v) => v?.toLowerCase().includes(qEmpresa))
      )
    : empresas
  ).slice(0, 50);

  const seleccionarEmpresa = (e) => {
    setForm((f) => ({ ...f, empresa: e._id, planta: "", personaContacto: "" }));
    setBusquedaEmpresa(e.alias ? `${e.alias} — ${e.razonSocial}` : e.razonSocial);
    setListaEmpresaAbierta(false);
  };

  const cambiarBusquedaEmpresa = (e) => {
    setBusquedaEmpresa(e.target.value);
    setListaEmpresaAbierta(true);
    if (form.empresa) setForm((f) => ({ ...f, empresa: "", planta: "", personaContacto: "" }));
  };

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
      // Si no se eligió una Empresa ya registrada, se manda el texto tal
      // cual se escribió — el backend la busca por razón social (sin
      // importar mayúsculas) y la crea sola si no existe.
      empresaNombre: form.empresa ? undefined : busquedaEmpresa.trim() || undefined,
      planta: form.planta,
      personaContacto: form.personaContacto,
      contactoNombre: contactoSel?.nombre || "",
      contactoTelefono: contactoSel?.telefono || "",
      titulo: form.titulo,
      condicion: form.condicion,
      categorizacionTaller: form.categorizacionTaller || undefined,
      micLinea: form.micLinea,
      backup: form.backup,
      entregadoPor: form.entregadoPor,
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
            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
              <input name="codigoSap" value={form.codigoSap} onChange={handleChange} className={INP} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <label className="text-xs text-gray-500 block mb-1">Cliente</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={busquedaEmpresa}
                    onChange={cambiarBusquedaEmpresa}
                    onFocus={() => setListaEmpresaAbierta(true)}
                    onBlur={() => setListaEmpresaAbierta(false)}
                    placeholder="Escribe el nombre de la empresa…"
                    className={INP}
                    autoComplete="off"
                  />
                  {listaEmpresaAbierta && empresasFiltradas.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {empresasFiltradas.map((e) => (
                        <button type="button" key={e._id}
                          onMouseDown={() => seleccionarEmpresa(e)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition border-b border-gray-50 last:border-0">
                          {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEmpresasOpen(true)}
                  className="shrink-0 text-xs border border-gray-300 px-3 rounded-lg hover:bg-gray-50 transition"
                >
                  Empresas
                </button>
              </div>
              {!form.empresa && busquedaEmpresa.trim() && (
                <p className="text-[11px] text-amber-600 mt-1">Se creará una empresa nueva con este nombre.</p>
              )}
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
              <select name="personaContacto" value={form.personaContacto} onChange={handleChange} className={INP}>
                <option value="">— Sin contacto —</option>
                {contactosPlanta.map((c) => (
                  <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
              {contactoSel && (contactoSel.telefono || contactoSel.correo) && (
                <p className="text-xs text-gray-400 mt-1">
                  {[contactoSel.telefono, contactoSel.correo].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Título OT</label>
            <input name="titulo" value={form.titulo} onChange={handleChange} className={INP} placeholder="Título de la OT" />
          </div>

          <div hidden>
            <label className="text-xs text-gray-500 block mb-1">Condición</label>
            <input name="condicion" value={form.condicion} onChange={handleChange} className={INP} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Categorización de servicio</label>
              <select name="categorizacionTaller" value={form.categorizacionTaller} onChange={handleChange} className={INP}>
                <option value="">Seleccionar categoría…</option>
                {CATEGORIAS_SERVICIO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado Prueba</label>
              <select name="encargado" value={form.encargado} onChange={handleChange} className={INP}>
                <option value="">Sin asignar</option>
                {tecnicos.filter((t) => t.rol === "tecnico_prueba").map((t) => (
                  <option key={t._id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado Intervención</label>
              <select name="encargado2" value={form.encargado2} onChange={handleChange} className={INP}>
                <option value="">Sin asignar</option>
                {tecnicos.filter((t) => t.rol === "tecnico_intervencion").map((t) => (
                  <option key={t._id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">MIC/Línea</label>
              <input name="micLinea" value={form.micLinea} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Backup</label>
              <input name="backup" value={form.backup} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entregado por</label>
              <input name="entregadoPor" value={form.entregadoPor} onChange={handleChange} className={INP} />
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
            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
              <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
            </div>
          </div>

          <div hidden>
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

      {empresasOpen && (
        <SelectorEmpresas
          empresas={empresas}
          onClose={() => setEmpresasOpen(false)}
          onSeleccionar={(e) => {
            seleccionarEmpresa(e);
            setEmpresasOpen(false);
          }}
          onCambio={async (guardada, { esNueva }) => {
            await cargarEmpresas();
            if (esNueva) {
              setForm((f) => ({ ...f, empresa: guardada._id, planta: "" }));
              setBusquedaEmpresa(guardada.alias ? `${guardada.alias} — ${guardada.razonSocial}` : guardada.razonSocial);
            }
          }}
        />
      )}
    </div>
  );
}
