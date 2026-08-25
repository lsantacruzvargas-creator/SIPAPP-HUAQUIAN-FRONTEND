import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import { exportarCotizacionPdf } from "../utils/cotizacionPdf";
import { calcSubtotal, itemDesdeDb, itemInvalido } from "../utils/cotizacionItems";
import ModalCrearOT from "./ModalCrearOT";
import ModalOrdenCompra from "./ModalOrdenCompra";
import BuscadorOrdenTrabajo from "./BuscadorOrdenTrabajo";
import TablaItemsCotizacion from "./TablaItemsCotizacion";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgePago, badgeOT, money, BotonAnular, BannerAnulado, bloqueadoPorCadenaCerrada,
} from "./detalleShared";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full transition";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  return { subtotal: s, igv, total: Math.round((s + igv) * 100) / 100 };
}

export default function DetalleCotizacion({ cotizacion: inicial, onClose, onGuardada, onNavegar }) {
  const [cot, setCot] = useState(inicial);
  const subtotalInicial = inicial.subtotal ?? 0;
  const [form, setForm] = useState({
    subtotal: subtotalInicial > 0 ? String(subtotalInicial) : "",
    empresa: inicial.empresa?._id || "",
    tipo: inicial.tipo || "venta",
    moneda: inicial.moneda || "PEN",
    condicionPago: inicial.condicionPago || "",
    plazoEntrega: inicial.plazoEntrega || "",
    lugarEntrega: inicial.lugarEntrega || "",
    validezOferta: inicial.validezOferta || "",
    fecha: inicial.fecha ? new Date(inicial.fecha).toISOString().split("T")[0] : "",
    fechaRecibida: inicial.fechaRecibida ? new Date(inicial.fechaRecibida).toISOString().split("T")[0] : "",
    titulo: inicial.titulo || "",
    numeroCotizacion: inicial.numeroCotizacion || "",
    atencion: inicial.atencion || "",
    encargado: inicial.encargado || "",
    planta: inicial.planta || "",
    numeroGuiaEmision: inicial.numeroGuiaEmision || "",
    numeroGuiaRemision: inicial.numeroGuiaRemision || "",
    codigoSap: inicial.codigoSap || "",
    fechaSalida: inicial.fechaSalida ? new Date(inicial.fechaSalida).toISOString().split("T")[0] : "",
    asesorComercial: inicial.asesorComercial || "",
    numeroCelular: inicial.numeroCelular || "",
    numeroSolicitudPedido: inicial.numeroSolicitudPedido || "",
    numeroPeticionOferta: inicial.numeroPeticionOferta || "",
    tiempoGarantia: inicial.tiempoGarantia || "",
    area: inicial.area || "",
    omAviso: inicial.omAviso || "",
    numeroGuia: inicial.numeroGuia || "",
    jefeSupervisorSolicitante: inicial.jefeSupervisorSolicitante || "",
    compradorResponsable: inicial.compradorResponsable || "",
  });
  const [calc, setCalc] = useState(() => calcular(subtotalInicial));
  const [items, setItems] = useState(() => (inicial.items || []).map(itemDesdeDb));
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [ots, setOts] = useState([]);
  const [informes, setInformes] = useState([]);
  const [oc, setOc] = useState(null);
  const [factura, setFactura] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [crearOTOpen, setCrearOTOpen] = useState(false);
  const [crearOCOpen, setCrearOCOpen] = useState(false);
  const [buscadorOTOpen, setBuscadorOTOpen] = useState(false);
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [generandoOT, setGenerandoOT] = useState(false);
  const rolActual = getUsuario()?.rol;
  const puedeEditar = ["admin", "asistente", "facturacion", "jefatura"].includes(rolActual);
  // Anular un documento queda reservado a Admin, Facturación y Jefatura.
  const puedeAnular = ["admin", "facturacion", "jefatura"].includes(rolActual);
  // Precios: información sensible, solo Admin/Facturación/Jefatura los ven —
  // ni Asistente ni Planner, aunque puedan editar/ver el resto de la cotización.
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(rolActual);
  const puedeAprobar = ["admin", "jefatura"].includes(rolActual);
  const puedeEnviar = ["admin", "asistente"].includes(rolActual);
  const puedeConfirmarInformeEnviado = ["admin", "asistente", "facturacion", "jefatura"].includes(rolActual);
  // Asistente solo puede enviar cotizaciones ya aprobadas — Admin conserva
  // la potestad de enviar sin esperar la aprobación (ver mismo criterio en
  // el backend, PATCH /cotizaciones/:id/enviar).
  const bloqueadoPorAprobacion = rolActual === "asistente" && !cot.aprobado;
  // A diferencia de la aprobación, aquí SÍ se bloquea a todos los roles
  // (incluido Admin): el informe no puede confirmarse como enviado antes
  // de que la cotización misma se haya enviado.
  const bloqueadoPorInforme = !cot.enviado;
  const cadenaCerrada = bloqueadoPorCadenaCerrada(cot.estadoCadena, rolActual);

  const cargarRelaciones = () => {
    Promise.all([
      fetchAuth("/ordenes-trabajo").then(r => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then(r => r.ok ? r.json() : []),
      fetchAuth("/facturas").then(r => r.ok ? r.json() : []),
    ]).then(([otsData, ocs, facts]) => {
      const otsFound = otsData.filter(o => (o.cotizacion?._id || o.cotizacion) === cot._id);
      setOts(otsFound);
      const ocFound = ocs.find(o => (o.cotizacion?._id || o.cotizacion) === cot._id) || null;
      setOc(ocFound);
      // La factura de la cadena comparte numeroDocumento; si no, se resuelve por la OC.
      const factFound =
        (cot.numeroDocumento != null && facts.find(f => f.numeroDocumento === cot.numeroDocumento)) ||
        (ocFound && facts.find(f => (f.ordenCompra?._id || f.ordenCompra) === ocFound._id)) ||
        null;
      setFactura(factFound);
      if (otsFound.length > 0) {
        Promise.all(
          otsFound.map(o => fetchAuth(`/informes?ordenTrabajo=${o._id}`).then(r => r.ok ? r.json() : []))
        ).then(listas => setInformes(listas.flat()));
      } else {
        setInformes([]);
      }
    });
  };

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(emps => setEmpresas(emps || []));
    cargarRelaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cot._id]);

  const empresaSel = empresas.find(e => e._id === form.empresa);
  const plantasEmpresa = empresaSel?.plantas ?? [];
  const plantaSel = plantasEmpresa.find(p => p.nombre === form.planta);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal") setCalc(calcular(value));
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const toggleSeleccion = (idx) => setSeleccionados(prev => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  // Genera una OT por cada ítem seleccionado (uno a la vez, en secuencia).
  // Primero persiste los cambios pendientes: el backend identifica el ítem
  // por índice dentro de `cotizacion.items`, así que ese orden debe coincidir
  // exactamente con lo ya guardado antes de generar OT por índice.
  const generarOTSeleccionados = async () => {
    setGenerandoOT(true);
    const guardada = await guardarCotizacion();
    if (!guardada) { setGenerandoOT(false); return; }
    const indices = [...seleccionados].sort((a, b) => a - b);
    let ultimaCot = guardada;
    for (const idx of indices) {
      const res = await fetchAuth(`/cotizaciones/${ultimaCot._id}/items/${idx}/generar-ot`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        ultimaCot = data.cotizacion;
      }
    }
    setCot(ultimaCot);
    setItems((ultimaCot.items || []).map(itemDesdeDb));
    setSeleccionados(new Set());
    setGenerandoOT(false);
    cargarRelaciones();
  };

  // Desvincula la OT ya generada de un ítem — la OT sigue existiendo, solo
  // queda sin cotización asociada (ver Backend/src/routes/cotizaciones.js).
  const quitarOT = async (idx) => {
    const res = await fetchAuth(`/cotizaciones/${cot._id}/items/${idx}/quitar-ot`, { method: "PATCH" });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      setItems((actualizada.items || []).map(itemDesdeDb));
      cargarRelaciones();
    }
  };

  const subtotalItems = parseFloat(items.reduce((acc, i) => acc + calcSubtotal(i), 0).toFixed(2));
  const usarTotalesDeItems = items.length > 0;
  const totalesMostrados = usarTotalesDeItems ? calcular(subtotalItems) : calc;

  // Arma el objeto para el PDF con lo que hay en pantalla ahora mismo, sin
  // depender de que se haya guardado antes (Guardar cambios cierra el modal).
  const datosParaPdf = () => ({
    ...cot,
    empresa: empresaSel || cot.empresa,
    tipo: form.tipo,
    numeroCotizacion: form.numeroCotizacion,
    atencion: form.atencion,
    fecha: form.fecha,
    titulo: form.titulo,
    condicionPago: form.condicionPago,
    plazoEntrega: form.plazoEntrega,
    lugarEntrega: form.lugarEntrega,
    validezOferta: form.validezOferta,
    moneda: form.moneda,
    subtotal: totalesMostrados.subtotal,
    igv: totalesMostrados.igv,
    total: totalesMostrados.total,
    asesorComercial: form.asesorComercial,
    numeroCelular: form.numeroCelular,
    numeroSolicitudPedido: form.numeroSolicitudPedido,
    numeroPeticionOferta: form.numeroPeticionOferta,
    tiempoGarantia: form.tiempoGarantia,
    area: form.area,
    omAviso: form.omAviso,
    numeroGuia: form.numeroGuia,
    jefeSupervisorSolicitante: form.jefeSupervisorSolicitante,
    compradorResponsable: form.compradorResponsable,
    items: items.map(i => ({
      descripcion: i.descripcion,
      unidad: i.unidad || "und",
      cantidad: i.cantidad,
      precio: i.precio,
      moneda: i.moneda,
      subtotal: calcSubtotal(i),
      subItems: (i.subItems || []).map(s => s.texto).filter(Boolean),
    })),
  });

  // Guarda el estado actual y devuelve la cotización guardada (o null si
  // falló), sin notificar al padre ni cerrar el modal — usado tanto por
  // "Guardar cambios" (a través de `persistir`) como por "Generar OT", ya
  // que esta última necesita que los índices de `items` coincidan
  // exactamente con lo persistido en el backend antes de generar OT por
  // índice, pero debe seguir generando las OT en el mismo modal abierto.
  const guardarCotizacion = async () => {
    setIntentoGuardar(true);
    if (items.some(itemInvalido)) {
      setError("Hay ítems con campos obligatorios sin completar (descripción, cantidad o precio). Corrígelos antes de guardar — resaltados en rojo.");
      return null;
    }
    setError("");
    const payload = {
      tipo: form.tipo,
      condicionPago: form.condicionPago,
      titulo: form.titulo || "por definir",
      numeroCotizacion: form.numeroCotizacion,
      atencion: form.atencion,
      encargado: form.encargado,
      planta: form.planta,
      plazoEntrega: form.plazoEntrega,
      lugarEntrega: form.lugarEntrega,
      validezOferta: form.validezOferta,
      moneda: form.moneda,
      subtotal: totalesMostrados.subtotal,
      igv: totalesMostrados.igv,
      total: totalesMostrados.total,
      numeroGuiaEmision: form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      codigoSap: form.codigoSap,
      fechaSalida: form.fechaSalida || null,
      asesorComercial: form.asesorComercial,
      numeroCelular: form.numeroCelular,
      numeroSolicitudPedido: form.numeroSolicitudPedido,
      numeroPeticionOferta: form.numeroPeticionOferta,
      tiempoGarantia: form.tiempoGarantia,
      area: form.area,
      omAviso: form.omAviso,
      numeroGuia: form.numeroGuia,
      jefeSupervisorSolicitante: form.jefeSupervisorSolicitante,
      compradorResponsable: form.compradorResponsable,
      items: items.map(i => {
        const it = {
          descripcion: i.descripcion,
          unidad: i.unidad || "und",
          cantidad: i.cantidad,
          precio: i.precio,
          moneda: i.moneda,
          subtotal: calcSubtotal(i),
        };
        if (i.fechaEntrega) it.fechaEntrega = i.fechaEntrega;
        if (i.subItems?.length > 0) it.subItems = i.subItems.map(s => s.texto).filter(Boolean);
        return it;
      }),
    };
    if (form.empresa) payload.empresa = form.empresa;
    if (form.fecha) payload.fecha = form.fecha;
    if (form.fechaRecibida) payload.fechaRecibida = form.fechaRecibida;

    const res = await fetchAuth(`/cotizaciones/${cot._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      setItems((actualizada.items || []).map(itemDesdeDb));
      setIntentoGuardar(false);
      return actualizada;
    }
    setError("Error al guardar los cambios.");
    return null;
  };

  // Guardado explícito del botón "Guardar cambios": además de persistir,
  // notifica al padre y cierra el modal (comportamiento esperado solo aquí).
  const persistir = async () => {
    const actualizada = await guardarCotizacion();
    if (actualizada) onGuardada?.(actualizada);
    return actualizada;
  };

  const guardar = async () => {
    setGuardando(true);
    await persistir();
    setGuardando(false);
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/cotizaciones/${cot._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al anular el documento.");
    }
  };

  const toggleAprobar = async () => {
    const res = await fetchAuth(`/cotizaciones/${cot._id}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobado: !cot.aprobado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      onGuardada?.(actualizada);
    }
  };

  const toggleEnviar = async () => {
    const res = await fetchAuth(`/cotizaciones/${cot._id}/enviar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enviado: !cot.enviado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      onGuardada?.(actualizada);
    }
  };

  const toggleInformeEnviado = async () => {
    const res = await fetchAuth(`/cotizaciones/${cot._id}/informe-enviado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ informeEnviado: !cot.informeEnviado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      onGuardada?.(actualizada);
    }
  };

  const ultimo = informes[informes.length - 1];

  const pasos = [
    { tipo: "cotizacion", activo: true, codigo: cot.codigo },
    { tipo: "ot", activo: ots.length > 0, codigo: ots.length > 1 ? `${ots.length} OTs` : ots[0]?.codigo },
    { tipo: "informe", activo: informes.length > 0, codigo: informes.length ? `${informes.length} av.` : "" },
    { tipo: "oc", activo: !!oc, codigo: oc?.codigo },
    { tipo: "factura", activo: !!factura, codigo: factura?.codigo },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-sky-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
              <span className="group-hover:-translate-x-0.5 transition">←</span> Cotizaciones
            </button>
            <span className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Cotización</p>
              <h1 className="text-lg font-bold font-mono leading-tight">
                {form.numeroCotizacion || cot.codigo}
              </h1>
              <p className="text-xs font-normal text-white/60 leading-tight">
                {cot.codigo}{cot.numeroDocumento != null && ` · Doc. N° ${cot.numeroDocumento}`}
              </p>
              {cot.empresa && <p className="text-xs text-white/80 leading-tight">{cot.empresa.razonSocial}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              {puedeVerPrecios && (
                <>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total</p>
                  <p className="text-lg font-bold leading-tight">{money(cot.total, cot.moneda)}</p>
                </>
              )}
              <Chip className="mt-0.5 bg-white/20 text-white">{cot.tipo}</Chip>
            </div>
            {rolActual !== "asistente" && (
              <button onClick={() => exportarCotizacionPdf(datosParaPdf())}
                className="bg-white/15 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/25 transition font-medium shrink-0">
                Exportar PDF
              </button>
            )}
            {!cot.anulado && !cadenaCerrada && puedeAnular && <BotonAnular onAnular={anular} />}
            {!cot.anulado && !cot.enviado && !cadenaCerrada && puedeEditar && (
              <button onClick={guardar} disabled={guardando}
                className="bg-white text-sky-700 text-sm px-5 py-2 rounded-lg hover:bg-sky-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
        {!cot.anulado && (
          <div className="bg-sky-800/40 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center gap-6 flex-wrap">
              <span className="text-xs text-white/70 uppercase tracking-wide font-semibold">Estado del documento</span>

              {puedeAprobar ? (
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input type="checkbox" checked={cot.aprobado} onChange={toggleAprobar} className="w-4 h-4" />
                  {cot.aprobado ? "Aprobada" : "Pendiente de aprobación"}
                  {cot.aprobado && cot.aprobadoPor && (
                    <span className="text-xs text-white/50">
                      — {cot.aprobadoPor}{cot.fechaAprobacion && ` · ${new Date(cot.fechaAprobacion).toLocaleDateString("es-PE")}`}
                    </span>
                  )}
                </label>
              ) : (
                <span className="flex items-center gap-2 text-sm text-white">
                  <Chip className={cot.aprobado ? "bg-green-500/40 text-white" : "bg-white/20 text-white"}>
                    {cot.aprobado ? "Aprobada" : "Pendiente"}
                  </Chip>
                  {cot.aprobado && cot.aprobadoPor && (
                    <span className="text-xs text-white/50">
                      {cot.aprobadoPor}{cot.fechaAprobacion && ` · ${new Date(cot.fechaAprobacion).toLocaleDateString("es-PE")}`}
                    </span>
                  )}
                </span>
              )}

              {puedeEnviar ? (
                <label className={`flex items-center gap-2 text-sm text-white select-none ${bloqueadoPorAprobacion && !cot.enviado ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={cot.enviado}
                    disabled={bloqueadoPorAprobacion && !cot.enviado}
                    onChange={toggleEnviar} className="w-4 h-4" />
                  {cot.enviado ? "Enviada" : "No enviada"}
                  {cot.enviado && cot.enviadoPor && (
                    <span className="text-xs text-white/50">
                      — {cot.enviadoPor}{cot.fechaEnvio && ` · ${new Date(cot.fechaEnvio).toLocaleDateString("es-PE")}`}
                    </span>
                  )}
                </label>
              ) : (
                <span className="flex items-center gap-2 text-sm text-white">
                  <Chip className={cot.enviado ? "bg-green-500/40 text-white" : "bg-white/20 text-white"}>
                    {cot.enviado ? "Enviada" : "No enviada"}
                  </Chip>
                </span>
              )}
              {bloqueadoPorAprobacion && !cot.enviado && (
                <span className="text-xs text-amber-200">Debe aprobarse antes de enviar</span>
              )}

              {puedeConfirmarInformeEnviado ? (
                <label className={`flex items-center gap-2 text-sm text-white select-none ${bloqueadoPorInforme && !cot.informeEnviado ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={cot.informeEnviado}
                    disabled={bloqueadoPorInforme && !cot.informeEnviado}
                    onChange={toggleInformeEnviado} className="w-4 h-4" />
                  {cot.informeEnviado ? "Informe enviado" : "Informe no enviado"}
                  {cot.informeEnviado && cot.informeEnviadoPor && (
                    <span className="text-xs text-white/50">
                      — {cot.informeEnviadoPor}{cot.fechaInformeEnviado && ` · ${new Date(cot.fechaInformeEnviado).toLocaleDateString("es-PE")}`}
                    </span>
                  )}
                </label>
              ) : (
                <span className="flex items-center gap-2 text-sm text-white">
                  <Chip className={cot.informeEnviado ? "bg-green-500/40 text-white" : "bg-white/20 text-white"}>
                    {cot.informeEnviado ? "Informe enviado" : "Informe no enviado"}
                  </Chip>
                </span>
              )}
              {bloqueadoPorInforme && !cot.informeEnviado && (
                <span className="text-xs text-amber-200">Debe enviarse antes de confirmar el informe</span>
              )}
            </div>
          </div>
        )}
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
          <fieldset disabled={cot.anulado || cot.enviado || cadenaCerrada || !puedeEditar} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-sky-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la cotización</h2>
            </div>

            {cot.anulado && (
              <BannerAnulado motivo={cot.motivoAnulacion} por={cot.anuladoPor} fecha={cot.fechaAnulacion} />
            )}

            {!cot.anulado && cot.enviado && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Cotización enviada — de solo lectura. {puedeEnviar ? "Desmárcala como enviada (arriba) para poder editarla." : "Solo Admin o Administración pueden retirarla del estado enviado."}
              </p>
            )}

            {!cot.anulado && cadenaCerrada && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                La cadena de este documento está cerrada (factura pagada) — de solo lectura. Solo Jefatura puede editarlo.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Cotización</label>
                <input name="numeroCotizacion" value={form.numeroCotizacion} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                <option value="">— Sin empresa —</option>
                {empresas.map(e => (
                  <option key={e._id} value={e._id}>
                    {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                  </option>
                ))}
              </select>
            </div>


            <div className="grid grid-cols-1 gap-4">
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Encargado</label>
                <input name="encargado" value={form.encargado} onChange={handleChange}
                  placeholder="Nombre del encargado" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Planta</label>
                {plantasEmpresa.length > 0 ? (
                  <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                    <option value="">— Seleccionar planta —</option>
                    {plantasEmpresa.map((p, i) => (
                      <option key={i} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <input name="planta" value={form.planta} onChange={handleChange}
                    placeholder="Planta o sede" className={INP} />
                )}
              </div>
            </div>




            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Atención</label>
                <input name="atencion" value={form.atencion} onChange={handleChange}
                  placeholder="Ej. Área de Compras" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} className={INP}>
                  <option value="venta">Venta</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Asesor comercial</label>
                <input name="asesorComercial" value={form.asesorComercial} onChange={handleChange}
                  placeholder="Nombre del asesor" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Celular</label>
                <input name="numeroCelular" value={form.numeroCelular} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de solicitud de pedido</label>
                <input name="numeroSolicitudPedido" value={form.numeroSolicitudPedido} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de petición de oferta</label>
                <input name="numeroPeticionOferta" value={form.numeroPeticionOferta} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Área</label>
                <input name="area" value={form.area} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Jefe / Supervisor solicitante</label>
                <input name="jefeSupervisorSolicitante" value={form.jefeSupervisorSolicitante} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">OM / Aviso</label>
                <input name="omAviso" value={form.omAviso} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Comprador responsable</label>
                <input name="compradorResponsable" value={form.compradorResponsable} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de guía</label>
                <input name="numeroGuia" value={form.numeroGuia} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Moneda de la cotización</label>
                <select name="moneda" value={form.moneda} onChange={handleChange} className={INP}>
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares (US$)</option>
                </select>
              </div>
            </div>



            {plantaSel?.contactoNombre && (
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Contacto de la planta</p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{plantaSel.contactoNombre}</span>
                  {(plantaSel.contactoTelefono || plantaSel.contactoCorreo) && (
                    <span className="text-gray-500"> — {[plantaSel.contactoTelefono, plantaSel.contactoCorreo].filter(Boolean).join(" · ")}</span>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Título / Descripción</label>
              <input name="titulo" value={form.titulo} onChange={handleChange}
                placeholder="Descripción de la cotización" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Forma de pago</label>
                <input name="condicionPago" value={form.condicionPago} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Fecha recibida</label>
                <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plazo de entrega</label>
                <input name="plazoEntrega" value={form.plazoEntrega} onChange={handleChange}
                  placeholder="Ej. 2 días de recibida su O/C." className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lugar de entrega</label>
                <input name="lugarEntrega" value={form.lugarEntrega} onChange={handleChange}
                  placeholder="Ej. Planta Chilca" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Validez de la oferta</label>
                <input name="validezOferta" value={form.validezOferta} onChange={handleChange}
                  placeholder="Ej. 15 días" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tiempo de garantía</label>
                <input name="tiempoGarantia" value={form.tiempoGarantia} onChange={handleChange}
                  placeholder="Ej. 12 meses" className={INP} />
              </div>
            </div>



            <div className="grid grid-cols-2 gap-4">
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">N° guía de salida</label>
                <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
                <input name="codigoSap" value={form.codigoSap} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
                <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
              </div>
            </div>

            {/* Cálculos — precios, información sensible: oculto sin privilegio */}
            {puedeVerPrecios && (
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-sky-50/40 border border-gray-100 p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Subtotal sin IGV
                  {usarTotalesDeItems && <span className="text-gray-400 font-normal"> (calculado desde Ítems / Servicios)</span>}
                </label>
                {usarTotalesDeItems ? (
                  <p className={`${INP} text-lg font-semibold bg-gray-50 text-gray-700 border-transparent`}>
                    {totalesMostrados.subtotal.toFixed(2)}
                  </p>
                ) : (
                  <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                    step="0.01" min="0" placeholder="0.00" className={`${INP} text-lg font-semibold`} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400">IGV 18%</p>
                  <p className="font-semibold text-gray-700">{totalesMostrados.igv.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">{totalesMostrados.total.toFixed(2)}</p>
                </div>
              </div>
            </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            <TarjetaRelacion tipo="cotizacion" codigo={cot.codigo} numero={cot.numeroCotizacion} actual>
              <p className="text-sm text-gray-600 line-clamp-2">{cot.titulo}</p>
            </TarjetaRelacion>

            {ots.length === 0 ? (
              <TarjetaRelacion tipo="ot" vacio
                onCrear={!cot.anulado && !cot.enviado ? () => setCrearOTOpen(true) : undefined} crearLabel="OT" />
            ) : (
              ots.map(o => (
                <TarjetaRelacion key={o._id} tipo="ot" codigo={o.codigo} numero={o.numeroOT}
                  onClick={() => onNavegar?.({ tipo: "ot", data: o })}>
                  {o.estado && <Chip className={badgeOT(o.estado)}>{o.estado}</Chip>}
                </TarjetaRelacion>
              ))
            )}
            {!cot.anulado && !cot.enviado && (
              <div className="flex items-center gap-3 -mt-2 px-1">
                {ots.length > 0 && (
                  <button type="button" onClick={() => setCrearOTOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline">+ Crear otra OT</button>
                )}
                <button type="button" onClick={() => setBuscadorOTOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline">+ Vincular OT existente</button>
              </div>
            )}

            <TarjetaRelacion
              tipo="informe"
              codigo={informes.length ? `${informes.length} avance${informes.length !== 1 ? "s" : ""}` : null}
              vacio={informes.length === 0}>
              {ultimo?.fechaHoraGuardado && (
                <p className="text-xs text-gray-500">
                  Último: {new Date(ultimo.fechaHoraGuardado).toLocaleDateString("es-PE")}
                </p>
              )}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="oc" codigo={oc?.codigo} numero={oc?.numeroOrden} vacio={!oc}
              onClick={oc ? () => onNavegar?.({ tipo: "oc", data: oc, extra: factura }) : undefined}
              onCrear={!oc && !cot.anulado && cot.aprobado && cot.enviado ? () => setCrearOCOpen(true) : undefined} crearLabel="OC">
              {oc?.monto > 0 && <p className="text-xs text-gray-500">{money(oc.monto)}</p>}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="factura" codigo={factura?.codigo} numero={factura?.numeroFactura} vacio={!factura}
              onClick={factura ? () => onNavegar?.({ tipo: "factura", data: factura }) : undefined}>
              {(factura?.totalAPagar || factura?.total) > 0 && (
                <p className="text-xs text-gray-500">{money(factura.totalAPagar ?? factura.total)}</p>
              )}
              {factura?.estadoPago && <Chip className={badgePago(factura.estadoPago)}>{factura.estadoPago}</Chip>}
            </TarjetaRelacion>
          </section>
        </div>

        {/* Ítems — ancho completo, debajo de Datos + Relaciones */}
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <TablaItemsCotizacion
            items={items}
            onItemsChange={setItems}
            tipo={form.tipo}
            puedeEditar={puedeEditar}
            disabled={cot.anulado || cot.enviado}
            intentoGuardar={intentoGuardar}
            totalesMostrados={totalesMostrados}
            seleccionables={form.tipo === "servicio" && puedeEditar && !cot.anulado && !cot.enviado}
            seleccionados={seleccionados}
            onToggleSeleccion={toggleSeleccion}
            onGenerarOT={generarOTSeleccionados}
            generando={generandoOT}
            onVerOT={(o) => onNavegar?.({ tipo: "ot", data: ots.find(x => x._id === o._id) || o })}
            onQuitarOT={quitarOT}
            puedeVerPrecios={puedeVerPrecios}
          />
        </div>
      </div>

      {crearOTOpen && (
        <ModalCrearOT
          cotizacion={cot}
          onClose={() => setCrearOTOpen(false)}
          onCreada={() => { setCrearOTOpen(false); cargarRelaciones(); }}
        />
      )}

      {buscadorOTOpen && (
        <BuscadorOrdenTrabajo
          onClose={() => setBuscadorOTOpen(false)}
          onSelect={async (orden) => {
            const otraCot = orden.cotizacion && (orden.cotizacion._id || orden.cotizacion) !== cot._id
              ? orden.cotizacion : null;
            if (otraCot) {
              const codigoOtra = otraCot.codigo || "otra cotización";
              if (!window.confirm(`Esta OT ya está vinculada a ${codigoOtra} — ¿deseas reasignarla a esta cotización?`)) return;
            }
            const res = await fetchAuth(`/ordenes-trabajo/${orden._id}/vincular-cotizacion`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cotizacion: cot._id }),
            });
            if (res.ok) {
              setBuscadorOTOpen(false);
              cargarRelaciones();
            }
          }}
        />
      )}

      {crearOCOpen && (
        <ModalOrdenCompra
          cotizacion={cot}
          onClose={() => setCrearOCOpen(false)}
          onCreada={() => { setCrearOCOpen(false); cargarRelaciones(); }}
        />
      )}
    </div>
  );
}
