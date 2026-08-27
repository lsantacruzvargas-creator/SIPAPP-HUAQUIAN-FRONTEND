import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import ModalSeleccionarTipoInforme from "./ModalSeleccionarTipoInforme";
import FormInformeTecnico from "./FormInformeTecnico";
import VistaInformeTecnico from "./VistaInformeTecnico";
import ModalRequerimiento from "./ModalRequerimiento";
import TablaServiciosExternos from "./TablaServiciosExternos";
import { Chip, BotonAnular, BotonCerrarCadena, BotonDesanular, BannerAnulado, bloqueadoPorCadenaCerrada } from "./detalleShared";

const CATEGORIAS_SERVICIO = ["SOPORTE", "DEVOLUCION", "DIAGNOSTICO", "GARANTIA", "MANTENIMIENTO", "REPARACION", "PRESTAMO", "SUMINISTRO", "MANTENIMIENTO EN PLANTA"];

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 w-full transition";

const ESTADOS = ["pendiente", "en progreso", "completado", "entregado"];

const colorEstado = (e, activo) => {
  if (!activo) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (e === "entregado")  return "bg-teal-600 text-white";
  if (e === "completado") return "bg-green-600 text-white";
  if (e === "en progreso") return "bg-blue-600 text-white";
  return "bg-amber-500 text-white";
};

// Vista de detalle dedicada a una sub-OT — a propósito NO reutiliza el
// formulario completo de DetalleOrdenTrabajo.jsx: cliente/planta/N° OT/guía
// de llegada/etc. ya están fijados por el padre al crearla, así que
// mostrarlos de nuevo en un form editable es puro ruido repetido. Acá solo
// se edita lo propio de la sub-tarea; el contexto heredado se muestra en una
// franja de solo lectura, con un link para saltar al padre si hace falta.
export default function DetalleSubOT({ orden: inicial, onClose, onGuardada, onNavegar }) {
  const [ot, setOt] = useState(inicial);
  const [form, setForm] = useState({
    titulo:               inicial.titulo               || "",
    descripcion:           inicial.descripcion           || "",
    micLinea:               inicial.micLinea               || "",
    backup:                 inicial.backup                 || "",
    categorizacionTaller:  inicial.categorizacionTaller  || "",
    personalAsignado:      inicial.personalAsignado?._id || inicial.personalAsignado || "",
    estado:                 inicial.estado                 || "pendiente",
    entregadoPor:           inicial.entregadoPor           || "",
    fechaEntrega: inicial.fechaEntrega
      ? new Date(inicial.fechaEntrega).toISOString().split("T")[0] : "",
    numeroGuiaRemision:    inicial.numeroGuiaRemision    || "",
    observaciones:          inicial.observaciones          || "",
    irreparable:            inicial.irreparable            || false,
    encargado:              inicial.encargado              || "",
    encargado2:             inicial.encargado2             || "",
  });
  const rolActual = getUsuario()?.rol;
  const puedeEditarCampos = ["admin", "supervisor", "planner"].includes(rolActual);
  // Anular un documento queda reservado a Admin y Jefatura — Facturación ya
  // no puede. Desanular y cerrar/abrir la cadena a mano son exclusivos de admin.
  const puedeAnular = ["admin", "jefatura"].includes(rolActual);
  const esAdmin = rolActual === "admin";
  const puedeAprobarInforme = ["admin", "jefatura", "planner"].includes(rolActual);
  const esTecnico = ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(rolActual);
  // Tabla de Servicios Externos: la ven todos los roles menos técnico.
  const puedeVerServicios = !esTecnico;
  const cadenaCerrada = bloqueadoPorCadenaCerrada(ot.estadoCadena, rolActual);
  // Estado (Encargado Intervención) y Progreso (Encargado Prueba) — mismo
  // criterio que DetalleOrdenTrabajo.jsx: cards independientes del fieldset,
  // editables por el técnico cuyo nombre coincide con encargado/encargado2.
  const nombreActual = getUsuario()?.nombre;
  const coincideNombre = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const puedeEditarEstado = puedeEditarCampos || (esTecnico && coincideNombre(ot.encargado2, nombreActual));
  const puedeEditarEstadoPrueba = puedeEditarCampos || (esTecnico && coincideNombre(ot.encargado, nombreActual));
  const [usuarios, setUsuarios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [informes, setInformes] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]);
  const [crearRequerimientoOpen, setCrearRequerimientoOpen] = useState(false);
  const [servicios, setServicios] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [seleccionarTipoOpen, setSeleccionarTipoOpen] = useState(false);
  const [tipoElegido, setTipoElegido] = useState(null);
  const [verInforme, setVerInforme] = useState(null);
  const [editandoInforme, setEditandoInforme] = useState(null);

  const cargarRelaciones = () => {
    fetchAuth(`/informes-tecnicos?ordenTrabajo=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(infs => setInformes(infs || []));
    fetchAuth(`/requerimientos?ordenTrabajo=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(reqs => setRequerimientos(reqs || []));
    if (puedeVerServicios) {
      fetchAuth(`/servicios-externos?ordenTrabajo=${ot._id}`)
        .then(r => r.ok && r.json())
        .then(servs => setServicios(servs || []));
    }
  };

  useEffect(() => {
    fetchAuth("/personal/lista?todos=true").then(r => r.ok && r.json().then(u => setUsuarios(u || [])));
    // Encargado Prueba / Encargado Intervención se eligen entre los
    // usuarios con login y rol "tecnico" (distinto de "Personal asignado")
    // — ver Fase 13.
    fetchAuth("/usuarios/lista").then(r => r.ok && r.json()).then(u => setTecnicos((u || []).filter(x => ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(x.rol))));
    cargarRelaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ot._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const guardar = async () => {
    setGuardando(true); setError("");
    const body = { ...form };
    if (!body.personalAsignado) delete body.personalAsignado;
    if (!body.fechaEntrega) delete body.fechaEntrega;

    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al guardar los cambios.");
    }
    setGuardando(false);
  };

  // Cambian de inmediato (sin pasar por "Guardar cambios", que técnico no
  // puede usar) — no llaman `onGuardada` a propósito: ese callback cierra el
  // modal entero, y marcar un estado no debería sacar al usuario de la vista.
  const cambiarEstado = async (nuevo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      setForm((f) => ({ ...f, estado: actualizada.estado }));
    }
  };

  const cambiarEstadoPrueba = async (nuevo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/estado-prueba`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estadoPrueba: nuevo }),
    });
    if (res.ok) setOt(await res.json());
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al anular el documento.");
    }
  };

  const desanular = async () => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/desanular`, { method: "PATCH" });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al desanular el documento.");
    }
  };

  const toggleCerrarCadena = async (cerrado) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/cerrar-cadena`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cerrado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al cerrar/abrir la cadena.");
    }
  };

  const toggleAprobarInforme = async (informeId, actual) => {
    const res = await fetchAuth(`/informes-tecnicos/${informeId}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobado: !actual }),
    });
    if (res.ok) cargarRelaciones();
  };

  const padre = ot.ordenPadre;

  // `ot.ordenPadre` viene liviano del backend (select: "codigo numeroOT",
  // solo para el breadcrumb) — navegar con eso tal cual monta el detalle del
  // padre con un `orden` incompleto y su form aparece vacío. Se busca el
  // documento completo antes de navegar (mismo patrón "traer todo y buscar
  // por id" que ya usa cargarRelaciones en el resto de la app).
  const irAlPadre = async () => {
    if (!padre) return;
    const r = await fetchAuth("/ordenes-trabajo");
    const lista = r.ok ? await r.json() : [];
    const padreCompleto = lista.find(o => o._id === padre._id);
    onNavegar?.({ tipo: "ot", data: padreCompleto || padre });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
              <span className="group-hover:-translate-x-0.5 transition">←</span> Órdenes de Trabajo
            </button>
            <span className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Sub-Orden</p>
              <h1 className="text-lg font-bold font-mono leading-tight">{ot.numeroOT || ot.codigo}</h1>
              {padre && (
                <button type="button" onClick={irAlPadre}
                  className="text-xs font-normal text-white/70 hover:text-white leading-tight underline underline-offset-2">
                  Sub-OT de {padre.numeroOT || padre.codigo} — ver OT padre
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Estado</p>
              <Chip className="mt-0.5 bg-white/20 text-white">{ot.estado}</Chip>
              {ot.informesAprobados && (
                <Chip className="mt-1 bg-teal-400/30 text-white block">Informes aprobados</Chip>
              )}
              {ot.irreparable && <Chip className="mt-1 bg-red-500/40 text-white block">Irreparable</Chip>}
            </div>
            {!ot.anulado && !cadenaCerrada && puedeAnular && <BotonAnular onAnular={anular} />}
            {esAdmin && ot.anulado && <BotonDesanular onDesanular={desanular} />}
            {esAdmin && <BotonCerrarCadena cerrado={cadenaCerrada} onToggle={toggleCerrarCadena} />}
            {!ot.anulado && !cadenaCerrada && puedeEditarCampos && (
              <button onClick={guardar} disabled={guardando}
                className="bg-white text-violet-700 text-sm px-5 py-2 rounded-lg hover:bg-violet-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Franja de contexto heredado del padre — solo lectura */}
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-3 flex flex-wrap gap-x-8 gap-y-1 text-xs">
          <span><span className="text-gray-400">Cliente:</span> <span className="text-gray-700">{ot.empresa?.razonSocial || "—"}</span></span>
          <span><span className="text-gray-400">Planta:</span> <span className="text-gray-700">{ot.planta || "—"}</span></span>
          <span><span className="text-gray-400">Fecha de ingreso:</span> <span className="text-gray-700">{ot.fechaRecibida ? new Date(ot.fechaRecibida).toLocaleDateString("es-PE") : "—"}</span></span>
          <span><span className="text-gray-400">Guía de llegada:</span> <span className="text-gray-700">{ot.numeroGuiaEmision || "—"}</span></span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Progreso (Encargado Prueba) y Estado (Encargado Intervención) —
              cards independientes del fieldset principal. */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Progreso — Encargado Prueba{ot.encargado && <span className="normal-case font-normal text-gray-400"> ({ot.encargado})</span>}
            </p>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button key={e} type="button" disabled={!puedeEditarEstadoPrueba}
                  onClick={() => cambiarEstadoPrueba(e)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition disabled:opacity-60 disabled:cursor-not-allowed ${colorEstado(e, ot.estadoPrueba === e)}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado — Encargado Intervención{ot.encargado2 && <span className="normal-case font-normal text-gray-400"> ({ot.encargado2})</span>}
            </p>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button key={e} type="button" disabled={!puedeEditarEstado}
                  onClick={() => cambiarEstado(e)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition disabled:opacity-60 disabled:cursor-not-allowed ${colorEstado(e, ot.estado === e)}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Datos editables — solo lo propio de la sub-tarea */}
          <fieldset disabled={ot.anulado || cadenaCerrada || !puedeEditarCampos} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-violet-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la sub-orden</h2>
            </div>

            {ot.anulado && (
              <BannerAnulado motivo={ot.motivoAnulacion} por={ot.anuladoPor} fecha={ot.fechaAnulacion} />
            )}

            {!ot.anulado && cadenaCerrada && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                La cadena de este documento está cerrada (factura pagada) — de solo lectura. Solo Jefatura puede editarlo.
              </p>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Título</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} placeholder="Título de la sub-tarea" className={INP} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
                rows={2} className={`${INP} resize-none`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">MIC/Línea</label>
                <input name="micLinea" value={form.micLinea} onChange={handleChange} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Backup</label>
                <input name="backup" value={form.backup} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Categorización de servicio</label>
                <select name="categorizacionTaller" value={form.categorizacionTaller} onChange={handleChange} className={INP}>
                  <option value="">Sin categorizar</option>
                  {CATEGORIAS_SERVICIO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Personal asignado</label>
                <select name="personalAsignado" value={form.personalAsignado} onChange={handleChange} className={INP}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => (
                    <option key={u._id} value={u._id}>{u.nombre}{!u.activo ? " (inactivo)" : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado Prueba</label>
                <select name="encargado" value={form.encargado} onChange={handleChange} className={INP}>
                  <option value="">Sin asignar</option>
                  {tecnicos.filter(t => t.rol === "tecnico_prueba").map(t => (
                    <option key={t._id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado Intervención</label>
                <select name="encargado2" value={form.encargado2} onChange={handleChange} className={INP}>
                  <option value="">Sin asignar</option>
                  {tecnicos.filter(t => t.rol === "tecnico_intervencion").map(t => (
                    <option key={t._id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Entregado por</label>
                <input name="entregadoPor" value={form.entregadoPor} onChange={handleChange} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
                <input type="date" name="fechaEntrega" value={form.fechaEntrega} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Guía de salida</label>
              <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={INP} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
                rows={3} className={`${INP} resize-none`} />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.irreparable}
                onChange={(e) => setForm({ ...form, irreparable: e.target.checked })} />
              Irreparable
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones — todos los informes de ESTA sub-OT, cada uno como su
              propia tarjeta clickeable (antes solo se mostraba el más
              reciente y el resto quedaba inaccesible tras un "+N
              anterior(es)" puramente informativo — bug corregido). */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-teal-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Informes Técnicos {informes.length > 0 && `(${informes.length})`}
              </h2>
            </div>

            {informes.length > 0 ? (
              <div className="space-y-2">
                {informes.map(inf => (
                  <div key={inf._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:border-teal-200 transition space-y-2">
                    <button type="button" onClick={() => setVerInforme(inf)} className="w-full text-left">
                      <p className="font-mono text-xs text-teal-600">{inf.codigo}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{inf.tipo}</p>
                      {inf.fechaHoraGuardado && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(inf.fechaHoraGuardado).toLocaleDateString("es-PE")}
                        </p>
                      )}
                    </button>
                    {puedeAprobarInforme ? (
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none pt-2 border-t border-gray-50">
                        <input type="checkbox" checked={!!inf.aprobado}
                          onChange={() => toggleAprobarInforme(inf._id, inf.aprobado)} />
                        <span className={inf.aprobado ? "text-teal-600 font-medium" : "text-gray-400"}>
                          {inf.aprobado ? "Aprobado" : "Pendiente de aprobación"}
                        </span>
                      </label>
                    ) : (
                      <p className={`text-xs pt-2 border-t border-gray-50 ${inf.aprobado ? "text-teal-600 font-medium" : "text-gray-400"}`}>
                        {inf.aprobado ? "Aprobado" : "Pendiente de aprobación"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">Sin informes</p>
              </div>
            )}
            {!ot.anulado && (
              <button type="button" onClick={() => setSeleccionarTipoOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 underline">
                + Crear informe
              </button>
            )}
          </section>
        </div>

        {/* Requerimientos de Material — propios de esta sub-OT */}
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-orange-500" />
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Requerimientos de Material ({requerimientos.length})
                </h2>
              </div>
              {!ot.anulado && (
                <button type="button" onClick={() => setCrearRequerimientoOpen(true)}
                  className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-medium">
                  + Nuevo requerimiento
                </button>
              )}
            </div>

            {requerimientos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin requerimientos de material</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2 pr-3">Solicitado por</th>
                      <th className="text-left py-2 pr-3">Ítems</th>
                      <th className="text-left py-2 pr-3">Estado</th>
                      <th className="text-left py-2 pr-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {requerimientos.map(req => {
                      const pendientes = req.items.filter(it => it.estado === "pendiente").length;
                      return (
                        <tr key={req._id}>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-700">{req.codigo}</td>
                          <td className="py-2 pr-3 text-gray-600">{req.solicitadoPor}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            {req.items.map((it, i) => (
                              <span key={i} className="block text-xs">
                                {it.esSolicitudCompra ? `${it.categoriaNombre} (compra)` : it.material?.nombre} — {it.cantidad}
                              </span>
                            ))}
                          </td>
                          <td className="py-2 pr-3">
                            <Chip className={pendientes > 0 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                              {pendientes > 0 ? `${pendientes} pendiente(s)` : "Completado"}
                            </Chip>
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString("es-PE") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {puedeVerServicios && (
          <TablaServiciosExternos ot={ot} servicios={servicios}
            puedeEditar={puedeEditarCampos} onCambio={cargarRelaciones} />
        )}
      </div>

      {crearRequerimientoOpen && (
        <ModalRequerimiento
          ot={ot}
          onClose={() => setCrearRequerimientoOpen(false)}
          onCreado={() => { setCrearRequerimientoOpen(false); cargarRelaciones(); }}
        />
      )}

      {seleccionarTipoOpen && (
        <ModalSeleccionarTipoInforme
          onSeleccionar={(tipo) => { setSeleccionarTipoOpen(false); setTipoElegido(tipo); }}
          onClose={() => setSeleccionarTipoOpen(false)}
        />
      )}

      {tipoElegido && (
        <FormInformeTecnico
          ordenTrabajo={ot}
          tipo={tipoElegido}
          onClose={() => setTipoElegido(null)}
          onGuardado={(informe) => { setTipoElegido(null); cargarRelaciones(); setVerInforme(informe); }}
        />
      )}

      {verInforme && (
        <VistaInformeTecnico
          informe={verInforme}
          ordenTrabajo={ot}
          onClose={() => setVerInforme(null)}
          onModificar={
            (verInforme.aprobado ? puedeAprobarInforme : puedeEditarCampos) && !verInforme.anulado
              ? () => { setEditandoInforme(verInforme); setVerInforme(null); }
              : undefined
          }
        />
      )}

      {editandoInforme && (
        <FormInformeTecnico
          ordenTrabajo={ot}
          tipo={editandoInforme.tipo}
          informeExistente={editandoInforme}
          onClose={() => setEditandoInforme(null)}
          onGuardado={(informe) => { setEditandoInforme(null); cargarRelaciones(); setVerInforme(informe); }}
        />
      )}
    </div>
  );
}
