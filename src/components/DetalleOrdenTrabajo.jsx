import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import ModalOrdenCompra from "./ModalOrdenCompra";
import ModalCrearCotizacion from "./ModalCrearCotizacion";
import ModalEmpresa from "./ModalEmpresa";
import ModalSeleccionarTipoInforme from "./ModalSeleccionarTipoInforme";
import FormInformeTecnico from "./FormInformeTecnico";
import VistaInformeTecnico from "./VistaInformeTecnico";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgePago, badgeOT, money, BotonAnular, BannerAnulado,
} from "./detalleShared";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full transition";
const RO  = "bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 w-full";

const ESTADOS = ["pendiente", "en progreso", "completado", "entregado"];

const colorEstado = (e, activo) => {
  if (!activo) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (e === "entregado")  return "bg-teal-600 text-white";
  if (e === "completado") return "bg-green-600 text-white";
  if (e === "en progreso") return "bg-blue-600 text-white";
  return "bg-amber-500 text-white";
};

export default function DetalleOrdenTrabajo({ orden: inicial, onClose, onGuardada, onNavegar }) {
  const [ot, setOt] = useState(inicial);
  const [form, setForm] = useState({
    numeroOT:           inicial.numeroOT           || "",
    fechaRecibida: inicial.fechaRecibida
      ? new Date(inicial.fechaRecibida).toISOString().split("T")[0] : "",
    codigoSap:          inicial.codigoSap          || "",
    empresa:            inicial.empresa?._id       || "",
    planta:             inicial.planta             || "",
    contactoNombre:     inicial.contactoNombre      || "",
    titulo:             inicial.titulo             || "",
    condicion:          inicial.condicion          || "",
    encargado:          inicial.encargado          || "",
    encargado2:         inicial.encargado2          || "",
    numeroGuiaEmision:  inicial.numeroGuiaEmision  || "",
    numeroGuiaRemision: inicial.numeroGuiaRemision || "",
    fechaSalida: inicial.fechaSalida
      ? new Date(inicial.fechaSalida).toISOString().split("T")[0] : "",
    protocolo:          inicial.protocolo          || "",
    observaciones:      inicial.observaciones      || "",
    estado:             inicial.estado             || "pendiente",
  });
  const rolActual = getUsuario()?.rol;
  // Supervisor edita los campos de la OT y los Informes Técnicos, pero no
  // puede anularla (eso queda solo para admin/asistente). Igual que técnico,
  // supervisor no ve el resto de la cadena (Cotización/OC/Factura).
  const puedeEditarCampos = ["admin", "asistente", "supervisor"].includes(rolActual);
  const puedeAnular = ["admin", "asistente"].includes(rolActual);
  const esVistaLimitada = ["tecnico", "supervisor"].includes(rolActual);
  const [usuarios, setUsuarios]   = useState([]);
  const [empresas, setEmpresas]   = useState([]);
  const [nuevaEmpresaOpen, setNuevaEmpresaOpen] = useState(false);
  const [cot, setCot]             = useState(ot.cotizacion || null);
  const [oc, setOc]               = useState(null);
  const [factura, setFactura]     = useState(null);
  const [informes, setInformes]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [crearOCOpen, setCrearOCOpen] = useState(false);
  const [crearCotOpen, setCrearCotOpen] = useState(false);
  const [seleccionarTipoOpen, setSeleccionarTipoOpen] = useState(false);
  const [tipoElegido, setTipoElegido] = useState(null);
  const [verInforme, setVerInforme] = useState(null);
  const [editandoInforme, setEditandoInforme] = useState(null);

  const cargarRelaciones = () => {
    Promise.all([
      fetchAuth("/cotizaciones").then(r => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then(r => r.ok ? r.json() : []),
      fetchAuth("/facturas").then(r => r.ok ? r.json() : []),
    ]).then(([cots, ocs, facts]) => {
      const cotId = ot.cotizacion?._id || ot.cotizacion;
      const cotResuelta =
        (cotId && cots.find(c => c._id === cotId)) ||
        (ot.numeroDocumento != null && cots.find(c => c.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setCot(cotResuelta);

      const ocResuelta =
        (cotResuelta && ocs.find(o => (o.cotizacion?._id || o.cotizacion) === cotResuelta._id)) ||
        (ot.numeroDocumento != null && ocs.find(o => o.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setOc(ocResuelta);

      const factResuelta =
        (ocResuelta && facts.find(f => (f.ordenCompra?._id || f.ordenCompra) === ocResuelta._id)) ||
        (ot.numeroDocumento != null && facts.find(f => f.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setFactura(factResuelta);
    });

    fetchAuth(`/informes-tecnicos?ordenTrabajo=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(infs => setInformes(infs || []));
  };

  const cargarEmpresas = () =>
    fetchAuth("/empresas").then((res) => res.ok && res.json().then(setEmpresas));

  useEffect(() => {
    fetchAuth("/personal/lista?todos=true").then(r => r.ok && r.json().then(u => setUsuarios(u || [])));
    cargarEmpresas();
    cargarRelaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ot._id]);

  const empresaSel = empresas.find(e => e._id === form.empresa);
  const plantasEmpresa = empresaSel?.plantas ?? [];
  const plantaSel = plantasEmpresa.find(p => p.nombre === form.planta);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const guardar = async () => {
    setGuardando(true); setError("");
    const body = {
      ...form,
      contactoNombre: plantaSel?.contactoNombre || "",
      contactoTelefono: plantaSel?.contactoTelefono || "",
    };
    if (!body.empresa) delete body.empresa;
    if (!body.fechaRecibida) delete body.fechaRecibida;
    if (!body.fechaSalida) delete body.fechaSalida;

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

  const ie     = ot.ingresoEquipo;
  const ultimo = informes[0];

  const pasos = [
    { tipo: "cotizacion", activo: !!cot,              codigo: cot?.codigo },
    { tipo: "ot",         activo: true,               codigo: ot.codigo },
    { tipo: "informe",    activo: informes.length > 0, codigo: informes.length > 1 ? `${informes.length} informes` : informes[0]?.codigo },
    { tipo: "oc",         activo: !!oc,               codigo: oc?.codigo },
    { tipo: "factura",    activo: !!factura,          codigo: factura?.codigo },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
              <span className="group-hover:-translate-x-0.5 transition">←</span> Órdenes de Trabajo
            </button>
            <span className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Orden de Trabajo</p>
              <h1 className="text-lg font-bold font-mono leading-tight">
                {form.numeroOT || ot.codigo}
              </h1>
              <p className="text-xs font-normal text-white/60 leading-tight">
                {ot.codigo}{ot.numeroDocumento != null && ` · Doc. N° ${ot.numeroDocumento}`}
              </p>
              {ot.empresa && <p className="text-xs text-white/80 leading-tight">{ot.empresa.razonSocial}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Estado</p>
              <Chip className="mt-0.5 bg-white/20 text-white">{ot.estado}</Chip>
            </div>
            {!ot.anulado && puedeAnular && <BotonAnular onAnular={anular} />}
            {!ot.anulado && puedeEditarCampos && (
              <button onClick={guardar} disabled={guardando}
                className="bg-white text-indigo-700 text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stepper de flujo */}
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 py-5">
          <FlujoNegocio pasos={pasos} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Datos editables */}
          <fieldset disabled={ot.anulado || !puedeEditarCampos} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la orden de trabajo</h2>
            </div>

            {ot.anulado && (
              <BannerAnulado motivo={ot.motivoAnulacion} por={ot.anuladoPor} fecha={ot.fechaAnulacion} />
            )}

            {/* Ingreso de equipo (solo lectura) */}
            {ie && (
              <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Ingreso de equipo · <span className="font-mono">{ie.codigo}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Tipo de equipo</p>
                    <input value={ie.tipoEquipo || "—"} disabled className={RO} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Marca / Modelo</p>
                    <input value={[ie.marca, ie.modelo].filter(Boolean).join(" / ") || "—"} disabled className={RO} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° OT</label>
                <input name="numeroOT" value={form.numeroOT} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de ingreso</label>
                <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
                <input name="codigoSap" value={form.codigoSap} onChange={handleChange} placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <div className="flex gap-2">
                  <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                    <option value="">Seleccionar empresa…</option>
                    {empresas.map(e => (
                      <option key={e._id} value={e._id}>
                        {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setNuevaEmpresaOpen(true)}
                    className="shrink-0 text-xs border border-gray-300 px-3 rounded-lg hover:bg-gray-50 transition">
                    + Nueva
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Planta</label>
                {plantasEmpresa.length > 0 ? (
                  <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                    <option value="">Seleccionar planta…</option>
                    {plantasEmpresa.map((p, i) => (
                      <option key={i} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <input name="planta" value={form.planta} onChange={handleChange} placeholder="Planta" className={INP} />
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} placeholder="Descripción del trabajo" className={INP} />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Condición</label>
                <input name="condicion" value={form.condicion} onChange={handleChange} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado</label>
                <select name="encargado" value={form.encargado} onChange={handleChange} className={INP}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => (
                    <option key={u._id} value={u.nombre}>{u.nombre}{!u.activo ? " (inactivo)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado 2</label>
                <select name="encargado2" value={form.encargado2} onChange={handleChange} className={INP}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => (
                    <option key={u._id} value={u.nombre}>{u.nombre}{!u.activo ? " (inactivo)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Persona de contacto</label>
                <p className={`${INP} bg-gray-50 text-gray-500`}>
                  {plantaSel ? `${plantaSel.contactoNombre} — ${plantaSel.contactoTelefono || "—"}` : "Selecciona una planta"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Guía de llegada</label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Guía de salida</label>
                <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={INP} />
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
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
                rows={3} className={`${INP} resize-none`} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2">Estado</label>
              <div className="flex gap-2">
                {ESTADOS.map(e => (
                  <button key={e} type="button" onClick={() => setForm({ ...form, estado: e })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition ${colorEstado(e, form.estado === e)}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-violet-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            {!esVistaLimitada && (
              <TarjetaRelacion tipo="cotizacion" codigo={cot?.codigo} numero={cot?.numeroCotizacion} vacio={!cot}
                onClick={cot ? () => onNavegar?.({ tipo: "cotizacion", data: cot }) : undefined}
                onCrear={!cot && !ot.anulado ? () => setCrearCotOpen(true) : undefined} crearLabel="Cotización">
                <p className="text-sm text-gray-700 line-clamp-2">{cot?.titulo}</p>
                {cot?.total > 0 && <p className="text-xs text-gray-500">{money(cot.total)}</p>}
              </TarjetaRelacion>
            )}

            <TarjetaRelacion tipo="ot" codigo={ot.codigo} numero={ot.numeroOT} actual>
              {ot.estado && <Chip className={badgeOT(ot.estado)}>{ot.estado}</Chip>}
            </TarjetaRelacion>

            <TarjetaRelacion
              tipo="informe"
              codigo={ultimo?.codigo}
              numero={informes.length > 1 ? `${informes.length} informes` : undefined}
              vacio={informes.length === 0}
              onClick={ultimo ? () => setVerInforme(ultimo) : undefined}
              onCrear={!ot.anulado ? () => setSeleccionarTipoOpen(true) : undefined}
              crearLabel="informe">
              {ultimo?.fechaHoraGuardado && (
                <p className="text-xs text-gray-500">
                  Último: {new Date(ultimo.fechaHoraGuardado).toLocaleDateString("es-PE")}
                </p>
              )}
            </TarjetaRelacion>

            {!esVistaLimitada && (
              <>
                <TarjetaRelacion tipo="oc" codigo={oc?.codigo} numero={oc?.numeroOrden} vacio={!oc}
                  onClick={oc ? () => onNavegar?.({ tipo: "oc", data: oc, extra: factura }) : undefined}
                  onCrear={!oc && cot && !ot.anulado ? () => setCrearOCOpen(true) : undefined} crearLabel="OC">
                  {oc?.monto > 0 && <p className="text-xs text-gray-500">{money(oc.monto)}</p>}
                </TarjetaRelacion>

                <TarjetaRelacion tipo="factura" codigo={factura?.codigo} numero={factura?.numeroFactura} vacio={!factura}
                  onClick={factura ? () => onNavegar?.({ tipo: "factura", data: factura }) : undefined}>
                  {(factura?.totalAPagar || factura?.total) > 0 && (
                    <p className="text-xs text-gray-500">{money(factura.totalAPagar ?? factura.total)}</p>
                  )}
                  {factura?.estadoPago && <Chip className={badgePago(factura.estadoPago)}>{factura.estadoPago}</Chip>}
                </TarjetaRelacion>
              </>
            )}
          </section>
        </div>
      </div>

      {crearOCOpen && cot && (
        <ModalOrdenCompra
          cotizacion={cot}
          onClose={() => setCrearOCOpen(false)}
          onCreada={() => { setCrearOCOpen(false); cargarRelaciones(); }}
        />
      )}

      {crearCotOpen && (
        <ModalCrearCotizacion
          orden={ot}
          onClose={() => setCrearCotOpen(false)}
          onCreada={(nueva) => { setCrearCotOpen(false); onNavegar?.({ tipo: "cotizacion", data: nueva }); }}
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
          onModificar={puedeEditarCampos && !verInforme.anulado ? () => { setEditandoInforme(verInforme); setVerInforme(null); } : undefined}
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

      {nuevaEmpresaOpen && (
        <ModalEmpresa
          onClose={() => setNuevaEmpresaOpen(false)}
          onGuardada={async (nueva) => {
            await cargarEmpresas();
            setForm(f => ({ ...f, empresa: nueva._id }));
            setNuevaEmpresaOpen(false);
          }}
        />
      )}
    </div>
  );
}
