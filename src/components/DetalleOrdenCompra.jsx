import { Fragment, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth, getUsuario, mensajeError } from "../utils/fetchAuth";
import { formatearFecha, aInputFecha } from "../utils/fecha";
import { estadoComprobanteClase } from "../utils/catalogosSunat";
import ModalDetalleGuia from "./ModalDetalleGuia";
import ConfirmacionAccion from "./ConfirmacionAccion";
import {
  FlujoNegocio, TarjetaRelacion, Chip, CeldaFacturaPartida,
  badgePago, badgeGeneral, money, totalSinIgv, BotonAnular, BotonDesanular, BannerAnulado, bloqueadoPorPago, MensajeError,
} from "./detalleShared";
import { r2, r0 } from "../utils/redondeo";
import { montoAjustadoItem, lineasConsolidadas } from "../utils/cotizacionItems";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full transition";
const codigoDeGuia = (g) => `${g.serie}-${String(g.correlativo).padStart(4, "0")}`;

function calcular(sub) {
  const s = r2(Number(sub)) || 0;
  const igv = r2(s * 0.18);
  const total = r2((s + igv));
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? r0(total * 0.12) : 0;
  return { igv, total, detraccion, totalAPagar: r2((total - detraccion)) };
}

export default function DetalleOrdenCompra({ orden, onClose, onGuardada, facturaVinculada, onNavegar }) {
  const subtotalInicial = orden.subtotal ?? orden.monto ?? 0;

  const [form, setForm] = useState({
    numeroOrden:   orden.numeroOrden   || "",
    empresa:       orden.empresa?._id  || "",
    titulo:        orden.titulo        || "",
    subtotal:      subtotalInicial > 0 ? String(subtotalInicial) : "",
    descripcion:   orden.descripcion   || "",
    encargado:     orden.encargado     || "",
    planta:        orden.planta        || "",
    numeroGuiaEmision:  orden.numeroGuiaEmision  || "",
    numeroGuiaRemision: orden.numeroGuiaRemision || "",
    codigoSap:          orden.codigoSap          || "",
    fechaSalida: orden.fechaSalida
      ? aInputFecha(orden.fechaSalida) : "",
  });
  const [calc, setCalc]           = useState(calcular(subtotalInicial));
  const [empresas, setEmpresas]   = useState([]);
  const [ot, setOt]               = useState(null);
  const [informes, setInformes]   = useState([]);
  const [gres, setGres]           = useState([]);
  const [guiaDetalle, setGuiaDetalle] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [cargandoFactura, setCargandoFactura] = useState(false);
  const [cargandoCot, setCargandoCot] = useState(false);
  const navigate = useNavigate();
  const [ordenActual, setOrdenActual] = useState(orden);
  const consolidada = lineasConsolidadas(ordenActual).length > 0;
  const [guardandoConfirmacion, setGuardandoConfirmacion] = useState("");
  const [todasOTs, setTodasOTs] = useState([]);
  const [cotizacionesPartidas, setCotizacionesPartidas] = useState({});
  const [errorCotizaciones, setErrorCotizaciones] = useState(false);
  const [partidaExpandida, setPartidaExpandida] = useState(null);
  const [partidaADesvincular, setPartidaADesvincular] = useState(null);
  const [desvinculando, setDesvinculando] = useState(false);
  const [errorDesvincular, setErrorDesvincular] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [confirmandoPagada, setConfirmandoPagada] = useState(false);
  const [guardandoPagada, setGuardandoPagada] = useState(false);
  const [errorPagada, setErrorPagada] = useState("");
  const rolActual = getUsuario()?.rol;
  const puedeEditar = ["admin", "asistente", "facturacion", "jefatura"].includes(rolActual);
  // Anular un documento queda reservado a Admin y Jefatura — Facturación ya
  // no puede. Desanular y marcar la OC como pagada a mano son exclusivos de admin.
  const puedeAnular = ["admin", "jefatura"].includes(rolActual);
  const esAdmin = rolActual === "admin";
  const bloqueada = bloqueadoPorPago(ordenActual, rolActual);
  const estadoFact = ordenActual.estadoFacturacion;
  const puedeConfirmarHesActa = ["admin", "asistente", "facturacion", "jefatura"].includes(rolActual);
  // Montos/cálculos exclusivos de admin/jefatura/facturación — mismo criterio
  // que ListaOrdenesCompra.jsx y que precios de Cotización (Fase 16). Antes
  // era una lista de bloqueo (solo excluía asistente/coordinadora) que
  // dejaba pasar a planner y otros roles por error.
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(rolActual);
  // Generar factura es libre (ya no exige confirmar HES/Acta antes) — Admin,
  // Facturación y Jefatura pueden (mismo gate en el backend, POST /facturas
  // puedeCrear en routes/facturas.js; Admin sumado a pedido explícito del
  // usuario, 2026-09-04, revierte la exclusión de la Fase 15).
  const puedeCrearFacturaRol = ["admin", "facturacion", "jefatura"].includes(rolActual);
  // Mismo set de roles que ve el card de GRE en DetalleOrdenTrabajo.jsx.
  const puedeGenerarGRE = ["admin", "asistente", "facturacion", "almacenero", "jefatura", "planner", "coordinadora"].includes(rolActual);
  const exigeHes  = !!ordenActual.empresa?.requiereHes;
  const exigeActa = !!ordenActual.empresa?.requiereActaConformidad;

  const confirmarHesActa = async (campo, valor) => {
    setGuardandoConfirmacion(campo);
    const res = await fetchAuth(`/ordenes-compra/${orden._id}/confirmaciones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    });
    if (res.ok) {
      // No se usa `onGuardada` acá a propósito: ese callback cierra el modal
      // (ver DetalleDocumento.jsx `cerrarGuardando`), y marcar un checkbox no
      // debería sacar al usuario de la vista — solo se actualiza el estado
      // local; la lista se refresca sola al cerrar (mismo patrón que ya usa
      // el resto del detalle).
      setOrdenActual(await res.json());
    }
    setGuardandoConfirmacion("");
  };

  const abrirFactura = async (f) => {
    if (!f || cargandoFactura) return;
    setCargandoFactura(true);
    const res = await fetchAuth("/facturas");
    const lista = res.ok ? await res.json() : [];
    const full = lista.find(x => x._id === f._id) || f;
    setCargandoFactura(false);
    onNavegar?.({ tipo: "factura", data: full });
  };

  // `orden.cotizacion` viene de un populate() acotado (solo trae codigo,
  // numeroCotizacion, titulo, total, tipo, aprobado, enviado, informeEnviado
  // — ver Backend/src/routes/ordenesCompra.js) — pasarlo tal cual a
  // DetalleCotizacion dejaba el resto de sus ~25 campos (empresa, planta,
  // items, moneda, etc.) en blanco. Mismo fix que `abrirFactura`.
  const abrirCotizacion = async () => {
    if (!cot || cargandoCot) return;
    setCargandoCot(true);
    const res = await fetchAuth("/cotizaciones");
    const lista = res.ok ? await res.json() : [];
    const full = lista.find(c => c._id === cot._id) || cot;
    setCargandoCot(false);
    onNavegar?.({ tipo: "cotizacion", data: full });
  };

  // Emitir Factura desde una OC: lleva a la página completa de Emitir CPE con
  // emisor/receptor/ítems precargados desde las partidas elegidas y sus
  // cotizaciones. Una OC sin partidas (legado) se factura entera: `partidas` vacío.
  const facturarPartidas = (ids) => {
    const idsCot = new Set(partidas.filter(p => ids.includes(p._id)).map(idCotDe));
    const cotizaciones = Object.fromEntries(Object.entries(cotizacionesPartidas).filter(([id]) => idsCot.has(id)));
    navigate("/facturacion-electronica/emitir", {
      state: { prellenarDesdeOC: { oc: ordenActual, partidas: ids, cotizaciones } },
    });
  };

  // Misma navegación que DetalleOrdenTrabajo.jsx (la OC no tiene sub-OTs, así
  // que siempre va directo a la página de emisión con un solo ítem prellenado).
  const crearGREDesdeOC = () => {
    if (!ot) return;
    navigate("/facturacion-electronica/guias/emitir", {
      state: {
        prellenarGRE: {
          items: [{ descripcion: ot.titulo, cantidad: 1, unidad: "NIU" }],
          destinatario: ot.empresa
            ? { schemeID: "6", numDoc: ot.empresa.ruc || "", nombre: ot.empresa.razonSocial || "" }
            : undefined,
          ordenesTrabajo: [ot._id],
        },
      },
    });
  };

  const cargarOTeInformes = () => {
    const cotId = orden.cotizacion?._id || orden.cotizacion;
    fetchAuth("/ordenes-trabajo").then(r => r.ok && r.json()).then(ots => {
      setTodasOTs(ots || []);
      if (!cotId || !ots) return;
      const found = ots.find(o => (o.cotizacion?._id || o.cotizacion) === cotId);
      setOt(found || null);
      if (found) {
        fetchAuth(`/informes?ordenTrabajo=${found._id}`)
          .then(r => r.ok && r.json())
          .then(infs => setInformes(infs || []));
        if (puedeGenerarGRE) {
          fetchAuth(`/guias?ordenesTrabajo=${found._id}&estado=ACEPTADO&limit=1000`)
            .then(r => r.ok && r.json())
            .then(data => setGres(data?.ok ? data.data : []));
        }
      }
    });
  };

  useEffect(() => {
    const idsCot = new Set((orden.partidas || []).map(p => p.cotizacion?._id || p.cotizacion));
    Promise.all([
      fetchAuth("/empresas").then(r => r.ok ? r.json() : []),
      idsCot.size ? fetchAuth("/cotizaciones").then(r => r.ok ? r.json() : null).catch(() => null) : [],
    ]).then(([emps, cots]) => {
      setEmpresas(emps || []);
      if (!cots) return setErrorCotizaciones(true);
      setCotizacionesPartidas(Object.fromEntries(cots.filter(c => idsCot.has(c._id)).map(c => [c._id, c])));
    });
    cargarOTeInformes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantasEmpresa = empresas.find(e => e._id === form.empresa)?.plantas ?? [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal") setCalc(calcular(value));
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const guardar = async () => {
    setGuardando(true); setError("");
    const payload = {
      numeroOrden:   form.numeroOrden,
      titulo:        form.titulo    || "por definir",
      subtotal:      Number(form.subtotal) || 0,
      igv:           calc.igv,
      total:         calc.total,
      monto:         Number(form.subtotal) || 0,
      descripcion:   form.descripcion,
      encargado:     form.encargado,
      planta:        form.planta,
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      codigoSap:          form.codigoSap,
      fechaSalida:        form.fechaSalida || null,
    };
    if (form.empresa) payload.empresa = form.empresa;
    // Ocultos en una OC consolidada: no se reenvían para no pisar los de la cotización de origen.
    if (consolidada) {
      ["titulo", "encargado", "planta", "numeroGuiaEmision", "numeroGuiaRemision", "codigoSap", "fechaSalida"]
        .forEach((k) => delete payload[k]);
    }

    try {
      const res = await fetchAuth(`/ordenes-compra/${orden._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { onGuardada(await res.json()); }
      else { setError(await mensajeError(res, "Error al guardar los cambios.")); }
    } catch {
      setError("No se pudo conectar con el servidor. Tus cambios siguen en pantalla: inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/ordenes-compra/${orden._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) { onGuardada(await res.json()); }
    else { return mensajeError(res, "Error al anular el documento."); }
  };

  const desanular = async () => {
    const res = await fetchAuth(`/ordenes-compra/${orden._id}/desanular`, { method: "PATCH" });
    if (res.ok) { onGuardada(await res.json()); }
    else { return mensajeError(res, "Error al desanular el documento."); }
  };

  const marcarPagada = async () => {
    setGuardandoPagada(true);
    setErrorPagada("");
    try {
      const res = await fetchAuth(`/ordenes-compra/${orden._id}/pagada-manual`, {
        method: "PATCH",
        body: JSON.stringify({ pagada: !ordenActual.pagadaManual }),
      });
      if (!res.ok) return setErrorPagada(await mensajeError(res, "No se pudo cambiar el estado de pago de la OC."));
      aplicarOrden(await res.json());
      setConfirmandoPagada(false);
    } catch {
      setErrorPagada("No se pudo conectar con el servidor.");
    } finally {
      setGuardandoPagada(false);
    }
  };

  const cot     = orden.cotizacion;

  // Una partida por cotización (ver routes/ordenesCompra.js); sus ítems son los de la cotización con `partidaOC` igual a su _id.
  const cotId = cot?._id || cot;
  const partidas = ordenActual.partidas || [];
  const idCotDe = (p) => p.cotizacion?._id || p.cotizacion;
  const estadoPartida = (p) => estadoFact?.partidas?.find(e => String(e._id) === String(p._id));
  const sinFacturar = (p) => estadoPartida(p)?.estado === "sin facturar";
  // Facturas vigentes de la OC (una puede cubrir varias partidas). Una OC sin partidas (legado) no
  // trae el detalle por partida: se usa la factura que encontró la lista.
  const facturas = partidas.length
    ? [...new Map((estadoFact?.partidas || []).filter(e => e.factura).map(e => [e.factura._id, e.factura])).values()]
    : (facturaVinculada && !facturaVinculada.anulado ? [facturaVinculada] : []);
  const factura = facturas.length === 1 ? facturas[0] : null;
  const facturadas = (estadoFact?.partidas || []).filter(e => e.estado === "facturada" || e.estado === "pagada").length;
  const puedeFacturar = puedeCrearFacturaRol && !ordenActual.anulado && !bloqueada;
  const seleccionables = puedeFacturar ? partidas.filter(sinFacturar) : [];
  const toggleSeleccion = (id) => setSeleccionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  // La partida de origen no se desvincula si es la única de esa cotización: se anula la OC.
  const puedeDesvincular = (p) => puedeEditar && !orden.anulado && !bloqueada && sinFacturar(p)
    && (idCotDe(p) !== cotId || partidas.filter(x => idCotDe(x) === cotId).length > 1);
  const hayColumnaDesvincular = partidas.some(puedeDesvincular);
  const hayCheck = seleccionables.length > 0;
  const itemsDePartida = (p) => (cotizacionesPartidas[idCotDe(p)]?.items || [])
    .map((item, idx) => ({ item, idx }))
    .filter(e => e.item.partidaOC && String(e.item.partidaOC) === String(p._id));
  const otsDeCotizacion = (id) => todasOTs
    .filter(o => !o.ordenPadre && (o.cotizacion?._id || o.cotizacion) === id)
    .map(o => o.numeroOT || o.codigo);
  const aplicarOrden = (nueva) => {
    setOrdenActual(nueva);
    setSeleccionadas([]);
    setForm(prev => ({ ...prev, subtotal: String(nueva.subtotal ?? 0) }));
    setCalc(calcular(nueva.subtotal ?? 0));
  };
  const confirmarDesvincular = async () => {
    setDesvinculando(true);
    setErrorDesvincular("");
    const res = await fetchAuth(`/ordenes-compra/${orden._id}/partidas/${partidaADesvincular._id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDesvinculando(false);
    if (!res.ok) return setErrorDesvincular(data.mensaje || "No se pudo desvincular la partida.");
    setPartidaADesvincular(null);
    setPartidaExpandida(null);
    aplicarOrden(data);
  };
  const ultimo  = informes[informes.length - 1];

  const pasos = [
    { tipo: "cotizacion", activo: !!cot,             codigo: cot?.codigo },
    { tipo: "ot",         activo: !!ot,              codigo: ot?.codigo },
    { tipo: "informe",    activo: informes.length>0, codigo: ultimo?.codigo || (informes.length ? `${informes.length} av.` : "") },
    { tipo: "oc",         activo: true,              codigo: orden.codigo },
    { tipo: "factura",    activo: facturas.length > 0, codigo: facturas.length > 1 ? `${facturas.length} fact.` : factura?.codigo },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onClose}
                className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
                <span className="group-hover:-translate-x-0.5 transition">←</span> Órdenes de Compra
              </button>
              <span className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Orden de Compra</p>
                <h1 className="text-lg font-bold font-mono leading-tight">
                  {form.numeroOrden || orden.codigo}
                </h1>
                <p className="text-xs font-normal text-white/60 leading-tight">
                  {orden.codigo}{orden.numeroDocumento != null && ` · Doc. N° ${orden.numeroDocumento}`}
                </p>
                {orden.empresa && <p className="text-xs text-white/80 leading-tight">{orden.empresa.razonSocial}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                {puedeVerPrecios && (
                  <>
                    <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total sin IGV</p>
                    <p className="text-lg font-bold leading-tight">{money(totalSinIgv(ordenActual), cot?.moneda)}</p>
                  </>
                )}
                {estadoFact?.estado && (
                  <Chip className="mt-0.5 bg-white/20 text-white">
                    {estadoFact.estado}{partidas.length > 0 && ` ${facturadas}/${partidas.length}`}
                    {ordenActual.pagadaManual && " (manual)"}
                  </Chip>
                )}
              </div>
              {!orden.anulado && !bloqueada && puedeAnular && <BotonAnular onAnular={anular} />}
              {esAdmin && orden.anulado && <BotonDesanular onDesanular={desanular} />}
              {esAdmin && !ordenActual.anulado && (
                <button onClick={() => { setErrorPagada(""); setConfirmandoPagada(true); }}
                  className="text-xs text-white/70 hover:text-white underline transition">
                  {ordenActual.pagadaManual ? "Desmarcar pagada" : "Marcar OC como pagada"}
                </button>
              )}
              {!orden.anulado && !bloqueada && puedeEditar && (
                <button onClick={guardar} disabled={guardando}
                  className="bg-white text-blue-700 text-sm px-5 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              )}
            </div>
        </div>
        {(exigeHes || exigeActa) && (
          <div className="bg-blue-800/40 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center gap-6">
              <span className="text-xs text-white/70 uppercase tracking-wide font-semibold">Requisitos de facturación</span>
              {exigeHes && (
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ordenActual.hesConfirmado}
                    disabled={!puedeConfirmarHesActa || ordenActual.anulado || bloqueada || guardandoConfirmacion === "hesConfirmado"}
                    onChange={(e) => confirmarHesActa("hesConfirmado", e.target.checked)}
                    className="w-4 h-4"
                  />
                  HES confirmado
                  {ordenActual.hesConfirmadoPor && (
                    <span className="text-xs text-white/50">— {ordenActual.hesConfirmadoPor}</span>
                  )}
                </label>
              )}
              {exigeActa && (
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ordenActual.actaConformidadConfirmada}
                    disabled={!puedeConfirmarHesActa || ordenActual.anulado || bloqueada || guardandoConfirmacion === "actaConformidadConfirmada"}
                    onChange={(e) => confirmarHesActa("actaConformidadConfirmada", e.target.checked)}
                    className="w-4 h-4"
                  />
                  Acta de Conformidad confirmada
                  {ordenActual.actaConformidadConfirmadaPor && (
                    <span className="text-xs text-white/50">— {ordenActual.actaConformidadConfirmadaPor}</span>
                  )}
                </label>
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
          <fieldset disabled={orden.anulado || bloqueada || !puedeEditar} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la orden</h2>
            </div>

            {orden.anulado && (
              <BannerAnulado motivo={orden.motivoAnulacion} por={orden.anuladoPor} fecha={orden.fechaAnulacion} />
            )}

            {!orden.anulado && bloqueada && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {ordenActual.pagadaManual
                  ? `OC marcada como pagada${ordenActual.pagadaManualPor ? ` por ${ordenActual.pagadaManualPor}` : ""}${ordenActual.pagadaManualFecha ? ` el ${formatearFecha(ordenActual.pagadaManualFecha)}` : ""}`
                  : "OC pagada"} — de solo lectura. Solo Jefatura puede editarla.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de orden</label>
                <input name="numeroOrden" value={form.numeroOrden} onChange={handleChange}
                  placeholder="Ej. OC-2024-001" className={INP} />
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">N° de factura</span>
                <p className="px-3 py-2 text-sm font-mono text-gray-700 bg-gray-50 border border-gray-100 rounded-lg min-h-[38px] break-words">
                  {estadoFact?.numerosFactura || <span className="text-gray-300">—</span>}
                </p>
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

            {/* OC consolidada: estos datos son propios de cada cotización y su OT (se editan allí). */}
            {!consolidada && (<>
            <div className="grid grid-cols-2 gap-4">
              <div>
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

            <div>
              <label className="text-xs text-gray-500 block mb-1">Título / Descripción</label>
              <input name="titulo" value={form.titulo} onChange={handleChange}
                placeholder="Descripción del servicio u obra" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
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
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
                <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
              </div>
            </div>
            </>)}

            {/* Cálculos — ocultos para Administración y Coordinadora, que no ven/editan montos */}
            {puedeVerPrecios && (
              <div className="rounded-xl bg-gradient-to-br from-gray-50 to-blue-50/40 border border-gray-100 p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subtotal sin IGV</label>
                  <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                    disabled
                    step="0.01" min="0" placeholder="0.00" className={`${INP} text-lg font-semibold disabled:bg-gray-50 disabled:text-gray-500`} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">IGV 18%</p>
                    <p className="font-semibold text-gray-700">{calc.igv.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="font-semibold text-gray-700">{calc.total.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Detracción 12%</p>
                    <p className="font-semibold text-gray-700">{calc.detraccion.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                  <span className="text-lg font-bold text-blue-700">{money(calc.totalAPagar, cot?.moneda)}</span>
                </div>
              </div>
            )}

            <MensajeError mensaje={error} />
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            <TarjetaRelacion tipo="cotizacion" codigo={cot?.codigo} numero={cot?.numeroCotizacion} vacio={!cot}
              onClick={cot ? abrirCotizacion : undefined} cargando={cargandoCot}>
              <p className="text-sm text-gray-700 line-clamp-2">{cot?.titulo}</p>
              {puedeVerPrecios && cot?.total > 0 && <p className="text-xs text-gray-500">{money(cot.total, cot.moneda)}</p>}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="ot" codigo={ot?.codigo} numero={ot?.numeroOT} vacio={!ot}
              onClick={ot ? () => onNavegar?.({ tipo: "ot", data: ot }) : undefined}>
              {ot?.estadoGeneral && <Chip className={badgeGeneral(ot.estadoGeneral)}>{ot.estadoGeneral}</Chip>}
              {ot?.personalEncargado?.nombre && (
                <p className="text-xs text-gray-500">Técnico: {ot.personalEncargado.nombre}</p>
              )}
            </TarjetaRelacion>

            {puedeGenerarGRE && ot && (gres.length === 0 ? (
              <TarjetaRelacion tipo="gre" vacio
                onCrear={!orden.anulado ? crearGREDesdeOC : undefined} crearLabel="GRE" />
            ) : (
              <TarjetaRelacion tipo="gre"
                codigo={gres.length === 1 ? codigoDeGuia(gres[0]) : `${gres.length} guías`}
                onClick={gres.length === 1 ? () => setGuiaDetalle(gres[0]) : undefined}>
                {gres.length === 1 ? (
                  <Chip className={estadoComprobanteClase(gres[0].estado)}>{gres[0].estado}</Chip>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {gres.map(g => (
                      <button key={g._id} type="button"
                        onClick={(e) => { e.stopPropagation(); setGuiaDetalle(g); }}
                        className="font-mono text-xs text-purple-700 bg-white rounded-lg px-2 py-0.5 shadow-sm hover:underline">
                        {codigoDeGuia(g)}
                      </button>
                    ))}
                  </div>
                )}
                {!orden.anulado && (
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); crearGREDesdeOC(); }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline mt-0.5">
                    + Crear otra GRE
                  </button>
                )}
              </TarjetaRelacion>
            ))}

            <TarjetaRelacion
              tipo="informe"
              codigo={informes.length ? `${informes.length} avance${informes.length !== 1 ? "s" : ""}` : null}
              vacio={informes.length === 0}>
              {ultimo?.fechaHoraGuardado && (
                <p className="text-xs text-gray-500">
                  Último: {formatearFecha(ultimo.fechaHoraGuardado)}
                </p>
              )}
              {ultimo?.personalEncargado?.nombre && (
                <p className="text-xs text-gray-500">Técnico: {ultimo.personalEncargado.nombre}</p>
              )}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="oc" codigo={orden.codigo} numero={orden.numeroOrden} actual />

            <TarjetaRelacion tipo="factura"
              codigo={facturas.length > 1 ? `${facturas.length} facturas` : factura?.codigo}
              numero={factura?.numeroFactura} vacio={facturas.length === 0}
              onClick={factura ? () => abrirFactura(factura) : undefined} cargando={cargandoFactura}
              onCrear={!partidas.length && puedeFacturar && estadoFact?.estado === "sin facturar" && !estadoFact?.reservada
                ? () => facturarPartidas([]) : undefined}
              crearLabel="Factura">
              {facturas.length === 1 && puedeVerPrecios && (factura.totalAPagar || factura.total) > 0 && (
                <p className="text-xs text-gray-500">{money(factura.totalAPagar || factura.total, factura.moneda ?? cot?.moneda)}</p>
              )}
              {facturas.length === 1 && factura.estadoPago && <Chip className={badgePago(factura.estadoPago)}>{factura.estadoPago}</Chip>}
              {facturas.length > 1 && (
                <ul className="space-y-1">
                  {facturas.map(f => (
                    <li key={f._id}>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); abrirFactura(f); }}
                        className="flex items-center gap-2 w-full text-left hover:underline">
                        <span className="font-mono text-xs text-gray-700">{f.numeroFactura || f.codigo}</span>
                        {puedeVerPrecios && (f.totalAPagar || f.total) > 0 && (
                          <span className="text-xs text-gray-500 tabular-nums">{money(f.totalAPagar || f.total, f.moneda ?? cot?.moneda)}</span>
                        )}
                        <Chip className={badgePago(f.estadoPago)}>{f.estadoPago || "sin pago"}</Chip>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaRelacion>
          </section>
        </div>

        {partidas.length > 0 && (
          <div className="max-w-6xl mx-auto px-8 pb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <span className="w-1.5 h-5 rounded-full bg-sky-500" />
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Partidas</h2>
                <span className="text-xs text-gray-400">({partidas.length})</span>
                {hayCheck && (
                  <button type="button" onClick={() => facturarPartidas(seleccionadas)} disabled={!seleccionadas.length}
                    className="ml-auto bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium">
                    Facturar seleccionadas ({seleccionadas.length})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      {hayCheck && (
                        <th className="px-3 py-3 w-10 text-center">
                          <input type="checkbox" aria-label="Seleccionar todas las partidas sin facturar"
                            checked={seleccionadas.length === seleccionables.length}
                            onChange={(e) => setSeleccionadas(e.target.checked ? seleccionables.map(p => p._id) : [])}
                            className="w-4 h-4" />
                        </th>
                      )}
                      <th className="px-3 py-3 text-center w-16">Pos.</th>
                      <th className="px-3 py-3 text-left w-36">N° cotización</th>
                      <th className="px-3 py-3 text-left w-36">N° OT</th>
                      <th className="px-3 py-3 text-left">Título</th>
                      <th className="px-3 py-3 text-left w-28">Ítems</th>
                      {puedeVerPrecios && <th className="px-3 py-3 text-right w-40">Total sin IGV</th>}
                      <th className="px-3 py-3 text-left w-48">Factura</th>
                      {hayColumnaDesvincular && <th className="px-3 py-3 w-10"><span className="sr-only">Desvincular</span></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partidas.map((p, idx) => {
                      const id = idCotDe(p);
                      const cotP = cotizacionesPartidas[id];
                      const itemsP = itemsDePartida(p);
                      const abierta = partidaExpandida === p._id;
                      return (
                        <Fragment key={p._id}>
                          <tr className={`align-top ${seleccionadas.includes(p._id) ? "bg-blue-50/50" : ""}`}>
                            {hayCheck && (
                              <td className="px-3 py-3 text-center">
                                {seleccionables.includes(p) && (
                                  <input type="checkbox" aria-label={`Seleccionar partida ${idx + 1}`}
                                    checked={seleccionadas.includes(p._id)} onChange={() => toggleSeleccion(p._id)}
                                    className="w-4 h-4" />
                                )}
                              </td>
                            )}
                            <td className="px-3 py-3 text-center text-gray-500 font-mono text-xs whitespace-nowrap">{idx + 1}/{partidas.length}</td>
                            <td className="px-3 py-3 font-mono text-sm text-sky-700 whitespace-nowrap">
                              {p.cotizacion?.numeroCotizacion || p.cotizacion?.codigo || "—"}
                              {id === cotId && partidas.length > 1 && (
                                <span className="ml-2 font-sans text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 uppercase">Origen</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono text-sm text-gray-600">{otsDeCotizacion(id).join(", ") || "—"}</td>
                            <td className="px-3 py-3 font-semibold text-gray-800 text-xs uppercase tracking-wide">{p.titulo}</td>
                            <td className="px-3 py-3">
                              <button type="button" onClick={() => setPartidaExpandida(abierta ? null : p._id)}
                                aria-expanded={abierta}
                                className="text-xs text-sky-700 hover:text-sky-900 underline whitespace-nowrap">
                                {cotP ? `${itemsP.length} ítem${itemsP.length !== 1 ? "s" : ""}` : "Ver ítems"} {abierta ? "▴" : "▾"}
                              </button>
                            </td>
                            {puedeVerPrecios && (
                              <td className="px-3 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{money(p.subtotal, cot?.moneda)}</td>
                            )}
                            <td className="px-3 py-3"><CeldaFacturaPartida estado={estadoPartida(p)} /></td>
                            {hayColumnaDesvincular && (
                              <td className="px-3 py-3 text-center">
                                {puedeDesvincular(p) && (
                                  <button type="button" title="Desvincular partida" aria-label="Desvincular partida"
                                    onClick={() => { setErrorDesvincular(""); setPartidaADesvincular(p); }}
                                    className="text-gray-300 hover:text-red-500 transition">✕</button>
                                )}
                              </td>
                            )}
                          </tr>
                          {abierta && (
                            <tr className="bg-gray-50/60">
                              <td colSpan={hayCheck ? 2 : 1} />
                              <td colSpan={5 + (puedeVerPrecios ? 1 : 0) + (hayColumnaDesvincular ? 1 : 0)} className="px-3 py-3">
                                {!cotP ? (
                                  <p className={`text-xs ${errorCotizaciones ? "text-red-500" : "text-gray-400"}`}>
                                    {errorCotizaciones ? "No se pudieron cargar los ítems." : "Cargando ítems…"}
                                  </p>
                                ) : itemsP.length === 0 ? (
                                  <p className="text-xs text-gray-500">La partida cubre la cotización completa (no tiene ítems individuales).</p>
                                ) : (
                                  <ul className="divide-y divide-gray-200 text-sm">
                                    {itemsP.map(({ item, idx: iIdx }) => (
                                      <li key={iIdx} className="flex items-start justify-between gap-4 py-1.5">
                                        <span className="text-gray-700 min-w-0">
                                          <span className="text-gray-400 mr-1.5">{iIdx + 1}.</span>{item.descripcion}
                                        </span>
                                        <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap shrink-0">
                                          {item.cantidad} {item.unidad}
                                          {puedeVerPrecios && <span className="ml-3 text-sm text-gray-700">{money(montoAjustadoItem(cotP, item), cot?.moneda)}</span>}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  {puedeVerPrecios && (
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={hayCheck ? 6 : 5} className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total sin IGV de la OC</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">{money(ordenActual.subtotal, cot?.moneda)}</td>
                        <td />
                        {hayColumnaDesvincular && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {guiaDetalle && (
        <ModalDetalleGuia guia={guiaDetalle} onClose={() => setGuiaDetalle(null)} />
      )}
      {confirmandoPagada && (
        <ConfirmacionAccion
          mensaje={ordenActual.pagadaManual
            ? "¿Desmarcar esta OC como pagada? Vuelve al estado que dan sus facturas y deja de estar bloqueada si no están todas pagadas."
            : "¿Marcar esta OC como pagada? Todas sus partidas cuentan como pagadas: la OC y lo que hereda el pago (ítems de cotización, OT e informes) quedan de solo lectura. Se puede desmarcar después."}
          textoConfirmar={ordenActual.pagadaManual ? "Desmarcar pagada" : "Marcar como pagada"}
          procesando={guardandoPagada} error={errorPagada}
          onCancelar={() => setConfirmandoPagada(false)} onConfirmar={marcarPagada} />
      )}
      {partidaADesvincular && (
        <ConfirmacionAccion
          mensaje={`¿Desvincular la partida de la cotización ${partidaADesvincular.cotizacion?.numeroCotizacion || partidaADesvincular.cotizacion?.codigo || ""}? Sus ítems quedan libres para otra OC y salen del monto de esta OC.`}
          textoConfirmar="Desvincular" procesando={desvinculando} error={errorDesvincular}
          onCancelar={() => setPartidaADesvincular(null)} onConfirmar={confirmarDesvincular} />
      )}
    </div>
  );
}
