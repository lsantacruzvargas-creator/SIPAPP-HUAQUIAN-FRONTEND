import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth, getUsuario, mensajeError } from "../utils/fetchAuth";
import { formatearFecha, aInputFecha } from "../utils/fecha";
import { generarFacturaPdf } from "../utils/facturaPdf";
import { lineasConsolidadas } from "../utils/cotizacionItems";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgeGeneral, badgePago, money, BotonAnular, BannerAnulado, bloqueadoPorPago, MensajeError,
} from "./detalleShared";
import { r2, r0 } from "../utils/redondeo";
import { fusionarBloqueo } from "../utils/bloqueoPago";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full transition";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";

function calcular(sub, retencionPct = 0) {
  const s = r2(Number(sub)) || 0;
  const igv = r2(s * 0.18);
  const total = r2((s + igv));
  // Con retención del IGV no hay detracción — mismo cálculo que routes/facturas.js.
  const pct = Number(retencionPct) || 0;
  const retencion = pct > 0 ? r2(total * pct / 100) : 0;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = pct > 0 ? 0 : (total >= 701 ? r0(total * 0.12) : 0);
  return { igv, total, detraccion, retencion, totalAPagar: r2((total - detraccion - retencion)) };
}

function BuscadorOC({ onSelect, onClose }) {
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetchAuth("/ordenes-compra").then(r => r.ok && r.json()).then(d => setLista(d || []));
  }, []);
  const filtradas = lista.filter(o => !q ||
    [o.numeroOrden, o.titulo, o.empresa?.razonSocial, o.codigo]
      .some(v => v?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Buscar orden de compra</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="px-4 pt-4">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="N° orden, título o empresa…" className={INP} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtradas.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
            : filtradas.map(o => (
              <button key={o._id} onClick={() => onSelect(o)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-blue-600">{o.codigo}</span>
                  <span className="text-xs text-gray-400">S/ {Number(o.monto ?? 0).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{o.numeroOrden || "Sin número"} — {o.titulo}</p>
                {o.empresa && <p className="text-xs text-gray-400">{o.empresa.razonSocial}</p>}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function DetalleFactura({ factura: inicial, onClose, onGuardada, onNavegar }) {
  const subtotalInicial = inicial.subtotal ?? 0;

  const [form, setForm] = useState({
    numeroFactura:      inicial.numeroFactura      || "",
    fechaCancelacion:   inicial.fechaCancelacion
      ? aInputFecha(inicial.fechaCancelacion) : "",
    empresa:            inicial.empresa?._id       || "",
    subtotal:           subtotalInicial != null ? String(subtotalInicial) : "",
    descripcion:        inicial.descripcion        || "",
    encargado:          inicial.encargado          || "",
    planta:             inicial.planta             || "",
    numeroGuiaEmision:  inicial.numeroGuiaEmision  || "",
    numeroGuiaRemision: inicial.numeroGuiaRemision || "",
    codigoSap:          inicial.codigoSap          || "",
    conformidad:        inicial.conformidad        || "",
    fechaSalida: inicial.fechaSalida
      ? aInputFecha(inicial.fechaSalida) : "",
  });
  const retencionPct = inicial.retencionPorcentaje || 0;
  const [calc, setCalc]           = useState(calcular(subtotalInicial, retencionPct));
  const [ocVinculada, setOC]      = useState(inicial.ordenCompra || null);
  const [empresas, setEmpresas]   = useState([]);
  const [buscadorOC, setBOC]      = useState(false);
  const [cot, setCot]             = useState(inicial.cotizacion || null);
  const [ot, setOt]               = useState(null);
  const [consolidadas, setConsolidadas] = useState([]);
  const [informes, setInformes]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [cargandoOC, setCargandoOC] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  // "jefatura" agregado acá para calzar con el gate real del backend
  // (routes/facturas.js `puedeEditar`) — se había quedado desactualizado.
  const navigate = useNavigate();
  const rolActual = getUsuario()?.rol;
  const puedeEditar = ["admin", "facturacion", "jefatura"].includes(rolActual);
  // Montos de las cards de "Relaciones" (Cotización/OC) — mismo criterio que
  // el resto de vistas de detalle (ver DetalleOrdenTrabajo/DetalleCotizacion/
  // DetalleOrdenCompra.jsx).
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(rolActual);
  const bloqueada = bloqueadoPorPago(inicial, rolActual);
  const cpeAceptado = !!inicial.comprobanteEmitido;

  const abrirOC = async () => {
    if (!ocVinculada || cargandoOC) return;
    setCargandoOC(true);
    const [resOC, resFact] = await Promise.all([
      fetchAuth("/ordenes-compra"),
      fetchAuth("/facturas"),
    ]);
    const listaOC   = resOC.ok   ? await resOC.json()   : [];
    const listaFact = resFact.ok ? await resFact.json() : [];
    const full  = listaOC.find(o => o._id === ocVinculada._id) || ocVinculada;
    const cotId = full.cotizacion?._id || full.cotizacion;
    // Enlace directo (ordenCompra) primero, prefiriendo la que comparte
    // numeroDocumento con la OC; cotizacion queda solo como último respaldo.
    const porOC = listaFact.filter(f => (f.ordenCompra?._id || f.ordenCompra) === full._id);
    const factRelacionada =
      porOC.find(f => f.numeroDocumento === full.numeroDocumento) ||
      porOC[0] ||
      listaFact.find(f => (f.cotizacion?._id || f.cotizacion) === cotId) ||
      inicial;
    setCargandoOC(false);
    onNavegar?.({ tipo: "oc", data: full, extra: factRelacionada });
  };

  const cargarRelaciones = () => {
    const cotId = inicial.cotizacion?._id || inicial.cotizacion;
    const numDoc = inicial.numeroDocumento;
    Promise.all([
      fetchAuth("/cotizaciones").then(r => r.ok && r.json()),
      fetchAuth("/ordenes-trabajo").then(r => r.ok && r.json()),
    ]).then(([cots, ots]) => {
      // La Factura no siempre trae su propia `cotizacion` (p.ej. creada por
      // la cadena vía OC) — se resuelve por numeroDocumento compartido,
      // usando el enlace directo solo como respaldo.
      const cotResuelta =
        (cots && numDoc != null && cots.find(c => c.numeroDocumento === numDoc)) ||
        (cots && cotId && cots.find(c => c._id === cotId)) ||
        null;
      setCot(cotResuelta);

      const otResuelta =
        (ots && numDoc != null && ots.find(o => o.numeroDocumento === numDoc)) ||
        (ots && cotResuelta && ots.find(o => (o.cotizacion?._id || o.cotizacion) === cotResuelta._id)) ||
        null;
      setOt(otResuelta || null);

      // OC consolidada: la factura cubre varias cotizaciones enteras, cada una con su OT.
      const lineas = lineasConsolidadas(ocVinculada);
      if (lineas.length && cots && ots) {
        const partes = lineas.map((l) => {
          const id = l.cotizacion?._id || l.cotizacion;
          return {
            linea: l,
            cot: cots.find(c => c._id === id) || null,
            ots: ots.filter(o => !o.ordenPadre && (o.cotizacion?._id || o.cotizacion) === id),
          };
        });
        setConsolidadas(partes);
        const idsOT = partes.flatMap(p => p.ots.map(o => o._id));
        Promise.all(idsOT.map(id => fetchAuth(`/informes?ordenTrabajo=${id}`).then(r => (r.ok ? r.json() : []))))
          .then(listas => setInformes(listas.flat()));
        return;
      }

      if (otResuelta) {
        fetchAuth(`/informes?ordenTrabajo=${otResuelta._id}`)
          .then(r => r.ok && r.json())
          .then(infs => setInformes(infs || []));
      }
    });
  };

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(emps => setEmpresas(emps || []));
    cargarRelaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantasEmpresa = empresas.find(e => e._id === form.empresa)?.plantas ?? [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal") setCalc(calcular(value, retencionPct));
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const seleccionarOC = (oc) => {
    setOC(oc);
    setBOC(false);
    setForm(prev => {
      const nuevoSub = prev.subtotal || (oc.subtotal > 0 ? String(oc.subtotal) : prev.subtotal);
      if (!prev.subtotal && oc.subtotal > 0) setCalc(calcular(oc.subtotal, retencionPct));
      return {
        ...prev,
        empresa:     prev.empresa     || oc.empresa?._id || "",
        subtotal:    nuevoSub,
        descripcion: prev.descripcion || oc.descripcion  || oc.titulo || "",
        planta:      prev.planta      || oc.planta       || "",
        encargado:   prev.encargado   || oc.encargado    || "",
      };
    });
  };

  const guardar = async () => {
    setError(""); setGuardando(true);
    const payload = {
      numeroFactura:      form.numeroFactura,
      subtotal:           Number(form.subtotal) || 0,
      descripcion:        form.descripcion,
      encargado:          form.encargado,
      planta:             form.planta,
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      codigoSap:          form.codigoSap,
      conformidad:        form.conformidad,
      fechaSalida:        form.fechaSalida || null,
      ordenCompra:        ocVinculada?._id || null,
    };
    if (form.fechaCancelacion) payload.fechaCancelacion = form.fechaCancelacion;
    if (form.empresa)          payload.empresa          = form.empresa;
    if (!payload.ordenCompra)  delete payload.ordenCompra;

    try {
      const res = await fetchAuth(`/facturas/${inicial._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { onGuardada(await res.json()); }
      else { setError(await mensajeError(res, "No se pudo guardar los cambios.")); }
    } catch {
      setError("No se pudo conectar con el servidor. Tus cambios siguen en pantalla: inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  // El CPE con lo que se llenó en Emitir Comprobante (ítems, cuotas,
  // detracción…). Las facturas creadas desde "Nueva Factura" no guardan el
  // enlace `comprobante`, así que se ubica por serie-correlativo.
  // Con el CPE aceptado la factura no se anula internamente (el backend lo rechaza): se anula con NC,
  // que al aceptarse sincroniza la factura. Misma precarga que "Emitir Nota de Crédito" en Comprobantes.
  const emitirNotaCredito = async () => {
    setError("");
    try {
      const comprobante = await buscarComprobante();
      if (!comprobante) { setError("No se encontró el comprobante electrónico de esta factura."); return; }
      navigate("/facturacion-electronica/emitir", { state: { comprobante } });
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  };

  const buscarComprobante = async () => {
    if (inicial.comprobante) {
      const data = await fetchAuth(`/cpe/${inicial.comprobante._id || inicial.comprobante}`).then(r => r.json());
      return data.ok ? data.data : null;
    }
    const [serie, correlativo] = (inicial.numeroFactura || "").split("-");
    if (!serie || !Number(correlativo)) return null;
    const data = await fetchAuth(`/cpe?tipoDoc=01&serie=${encodeURIComponent(serie)}&correlativo=${Number(correlativo)}`).then(r => r.json());
    const coinciden = (data.data || []).filter(c => c.serie === serie && c.correlativo === Number(correlativo));
    return coinciden.find(c => c.estado === "ACEPTADO") || coinciden[0] || null;
  };

  const imprimirPdf = async () => {
    setError(""); setImprimiendo(true);
    try {
      const comprobante = await buscarComprobante();
      // Emitida desde el ERP pero sin XML firmado (ej. SUNAT no respondió y se reintentó en el PSE):
      // el PDF no sería la representación de un documento con validez. Sin comprobante (factura
      // registrada a mano) se imprime como siempre.
      if (comprobante && !comprobante.tieneXml) {
        setError("Este comprobante no tiene el XML firmado. Súbelo en Facturación Electrónica con “Adjuntar XML/CDR” (descárgalo del panel del PSE) y vuelve a imprimir.");
        return;
      }
      await generarFacturaPdf({
        factura: {
          ...inicial,
          numeroFactura:      form.numeroFactura,
          numeroGuiaRemision: form.numeroGuiaRemision,
          numeroOrdenCompra:  ocVinculada?.numeroOrden || inicial.numeroOrdenCompra,
          conformidad:        form.conformidad,
        },
        comprobante,
        // Datos del cliente tal como están guardados en la empresa (la misma
        // de la OC) — no se consulta SUNAT para imprimir.
        empresa: empresas.find(e => e._id === form.empresa) || inicial.empresa,
      });
    } catch {
      setError("No se pudo generar el PDF.");
    } finally {
      setImprimiendo(false);
    }
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/facturas/${inicial._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) { onGuardada(fusionarBloqueo(inicial, await res.json())); }
    else { return mensajeError(res, "Error al anular el documento."); }
  };

  const oc     = ocVinculada;
  const ultimo = informes[informes.length - 1];

  const pasos = [
    { tipo: "cotizacion", activo: !!cot,             codigo: cot?.codigo },
    { tipo: "ot",         activo: !!ot,              codigo: ot?.codigo },
    { tipo: "informe",    activo: informes.length>0, codigo: ultimo?.codigo || (informes.length ? `${informes.length} av.` : "") },
    { tipo: "oc",         activo: !!oc,              codigo: oc?.codigo },
    { tipo: "factura",    activo: true,              codigo: inicial.codigo },
  ];

  return (
    <>
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onClose}
                className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
                <span className="group-hover:-translate-x-0.5 transition">←</span> Facturas
              </button>
              <span className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Factura</p>
                <h1 className="text-lg font-bold font-mono leading-tight">
                  {form.numeroFactura || inicial.codigo}
                </h1>
                <p className="text-xs font-normal text-white/60 leading-tight">
                  {inicial.codigo}{inicial.numeroDocumento != null && ` · Doc. N° ${inicial.numeroDocumento}`}
                </p>
                {inicial.empresa && <p className="text-xs text-white/80 leading-tight">{inicial.empresa.razonSocial}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total a pagar</p>
                <p className="text-lg font-bold leading-tight">{money(calc.totalAPagar)}</p>
                {inicial.estadoPago && (
                  <Chip className="mt-0.5 bg-white/20 text-white">{inicial.estadoPago}</Chip>
                )}
              </div>
              <button onClick={imprimirPdf} disabled={imprimiendo}
                className="border border-white/40 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 disabled:opacity-60 transition font-semibold shrink-0">
                {imprimiendo ? "Generando…" : "Imprimir PDF"}
              </button>
              {!inicial.anulado && !bloqueada && puedeEditar && (cpeAceptado ? (
                <button onClick={emitirNotaCredito}
                  className="text-xs text-white/70 hover:text-white underline transition">
                  Emitir nota de crédito
                </button>
              ) : (
                <BotonAnular onAnular={anular} />
              ))}
              {!inicial.anulado && !bloqueada && puedeEditar && (
                <button onClick={guardar} disabled={guardando}
                  className="bg-white text-emerald-700 text-sm px-5 py-2 rounded-lg hover:bg-emerald-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
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
          <fieldset disabled={inicial.anulado || bloqueada || !puedeEditar} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la factura</h2>
            </div>

            {inicial.anulado && (
              <BannerAnulado motivo={inicial.motivoAnulacion} por={inicial.anuladoPor} fecha={inicial.fechaAnulacion} />
            )}

            {!inicial.anulado && bloqueada && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Factura pagada — de solo lectura. Solo Jefatura puede editarla.
              </p>
            )}

            {cpeAceptado && (
              <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                Comprobante aceptado por SUNAT: número, empresa y montos son los del XML y no se editan aquí. Para corregirlos emite una Nota de Crédito o Débito.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de factura</label>
                <input name="numeroFactura" value={form.numeroFactura} onChange={handleChange}
                  placeholder="Ej. F001-00123" disabled={cpeAceptado} className={cpeAceptado ? INP_RO : INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Orden de Compra</label>
                {oc ? (
                  <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                    <span className="font-mono text-xs text-blue-600 flex-1">
                      {oc.codigo}{oc.numeroOrden ? ` · ${oc.numeroOrden}` : ""}
                    </span>
                    <button onClick={() => setBOC(true)}
                      className="text-xs text-gray-400 hover:text-blue-600 underline shrink-0">Cambiar</button>
                    <button onClick={() => setOC(null)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none">✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setBOC(true)}
                    className="w-full text-xs border border-dashed border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 text-blue-600 transition text-left">
                    + Buscar OC existente
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <select name="empresa" value={form.empresa} onChange={handleChange} disabled={cpeAceptado} className={cpeAceptado ? INP_RO : INP}>
                <option value="">— Sin empresa —</option>
                {empresas.map(e => (
                  <option key={e._id} value={e._id}>
                    {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha emisión</label>
                <input value={inicial.fechaEmision
                  ? formatearFecha(inicial.fechaEmision) : "—"}
                  disabled className={INP_RO} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha cancelación</label>
                <input type="date" name="fechaCancelacion" value={form.fechaCancelacion}
                  onChange={handleChange} className={INP} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <input name="descripcion" value={form.descripcion} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado</label>
                <input name="encargado" value={form.encargado} onChange={handleChange}
                  placeholder="—" className={INP} />
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
                    placeholder="—" className={INP} />
                )}
              </div>
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

            <div>
              <label className="text-xs text-gray-500 block mb-1">Conformidad</label>
              <input name="conformidad" value={form.conformidad} onChange={handleChange}
                placeholder="—" className={INP} />
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

            {/* Cálculos */}
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-emerald-50/40 border border-gray-100 p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Subtotal sin IGV{inicial.moneda === "USD" ? " (US$)" : ""}</label>
                <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange} disabled={cpeAceptado}
                  step="0.01" min="0" placeholder="0.00" className={`${cpeAceptado ? INP_RO : INP} text-lg font-semibold`} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400">IGV 18%</p>
                  <p className="font-semibold text-gray-700">{money(calc.igv, inicial.moneda)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">{money(calc.total, inicial.moneda)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">{retencionPct > 0 ? `Retención ${retencionPct}%` : "Detracción 12%"}</p>
                  <p className="font-semibold text-gray-700">{money(retencionPct > 0 ? calc.retencion : calc.detraccion, inicial.moneda)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                <span className="text-lg font-bold text-emerald-700">{money(calc.totalAPagar, inicial.moneda)}</span>
              </div>
            </div>

            <MensajeError mensaje={error} />
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-teal-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            {consolidadas.length > 0 ? (
              <>
                {consolidadas.map(({ linea, cot: c }) => (
                  <TarjetaRelacion key={linea.cotizacion?._id || linea.cotizacion} tipo="cotizacion"
                    codigo={c?.codigo} numero={c?.numeroCotizacion}
                    onClick={c ? () => onNavegar?.({ tipo: "cotizacion", data: c }) : undefined}>
                    <p className="text-sm text-gray-700 line-clamp-2">{linea.titulo || c?.titulo}</p>
                    {puedeVerPrecios && <p className="text-xs text-gray-500">{money(linea.subtotal, c?.moneda)} sin IGV</p>}
                  </TarjetaRelacion>
                ))}
                {consolidadas.flatMap(p => p.ots).map(o => (
                  <TarjetaRelacion key={o._id} tipo="ot" codigo={o.codigo} numero={o.numeroOT}
                    onClick={() => onNavegar?.({ tipo: "ot", data: o })}>
                    {o.estadoGeneral && <Chip className={badgeGeneral(o.estadoGeneral)}>{o.estadoGeneral}</Chip>}
                    {o.personalEncargado?.nombre && (
                      <p className="text-xs text-gray-500">Técnico: {o.personalEncargado.nombre}</p>
                    )}
                  </TarjetaRelacion>
                ))}
              </>
            ) : (
              <>
                <TarjetaRelacion tipo="cotizacion" codigo={cot?.codigo} numero={cot?.numeroCotizacion} vacio={!cot}
                  onClick={cot ? () => onNavegar?.({ tipo: "cotizacion", data: cot }) : undefined}>
                  <p className="text-sm text-gray-700 line-clamp-2">{cot?.titulo}</p>
                  {puedeVerPrecios && cot?.total > 0 && <p className="text-xs text-gray-500">{money(cot.total)}</p>}
                </TarjetaRelacion>

                <TarjetaRelacion tipo="ot" codigo={ot?.codigo} numero={ot?.numeroOT} vacio={!ot}
                  onClick={ot ? () => onNavegar?.({ tipo: "ot", data: ot }) : undefined}>
                  {ot?.estadoGeneral && <Chip className={badgeGeneral(ot.estadoGeneral)}>{ot.estadoGeneral}</Chip>}
                  {ot?.personalEncargado?.nombre && (
                    <p className="text-xs text-gray-500">Técnico: {ot.personalEncargado.nombre}</p>
                  )}
                </TarjetaRelacion>
              </>
            )}

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

            <TarjetaRelacion tipo="oc" codigo={oc?.codigo} numero={oc?.numeroOrden} vacio={!oc}
              onClick={oc ? abrirOC : undefined} cargando={cargandoOC}>
              {oc?.titulo && <p className="text-xs text-gray-500 line-clamp-2">{oc.titulo}</p>}
              {puedeVerPrecios && (oc?.monto || oc?.total) > 0 && <p className="text-xs text-gray-500">{money(oc.monto ?? oc.total)}</p>}
              {consolidadas.length > 0 && <Chip className="bg-indigo-100 text-indigo-700">Consolidada · {consolidadas.length} cotizaciones</Chip>}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="factura" codigo={inicial.codigo} numero={inicial.numeroFactura} actual>
              {inicial.estadoPago && <Chip className={badgePago(inicial.estadoPago)}>{inicial.estadoPago}</Chip>}
            </TarjetaRelacion>
          </section>
        </div>
      </div>
    </div>

    {buscadorOC && <BuscadorOC onSelect={seleccionarOC} onClose={() => setBOC(false)} />}
    </>
  );
}
