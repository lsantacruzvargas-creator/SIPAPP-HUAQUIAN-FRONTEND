import { useState, useEffect } from "react";
import DosLineas from "../components/DosLineas";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import { formatearFecha, aInputFecha } from "../utils/fecha";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalImportarExcel, { COLS_COT_OT, COLS_COTIZACIONES } from "../components/ModalImportarExcel";
import ModalNuevaOT from "../components/ModalNuevaOT";
import ModalNuevaCotizacion from "../components/ModalNuevaCotizacion";
import { DotChip, badgeGeneral, dotGeneral, ESTADOS_SERVICIO } from "../components/detalleShared";
import TablaScroll from "../components/TablaScroll";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../utils/usePaginacion";
import * as XLSX from "xlsx";
import { r2 } from "../utils/redondeo";

const FILTROS_VACIO = {
  empresa: "", planta: "", oc: "", estadoServicio: "", busqueda: "", informeEnviado: false,
  fechaDesde: "", fechaHasta: "", precioDesde: "", precioHasta: "",
};

// Valores de OrdenTrabajo.estadoGeneral; "sin_ot" = la cotización todavía no tiene OT (columna en "—").
const FILTRO_ESTADOS_SERVICIO = [...ESTADOS_SERVICIO, { valor: "sin_ot", label: "Sin OT" }];

const VISTAS = [
  { valor: "todasLasCotizaciones", label: "Todas las cotizaciones" },
  { valor: "todas",      label: "Todas las tablas" },
  { valor: "sinOT",      label: "Cotizaciones sin OT" },
  { valor: "pendientes", label: "Cotizaciones pendientes de OC" },
  { valor: "conOC",      label: "Cotización con OC" },
  { valor: "enviadas",   label: "Cotizaciones enviadas" },
  { valor: "aprobadas",  label: "Cotizaciones aprobadas" },
  { valor: "noEnviadas", label: "Cotizaciones no enviadas" },
  { valor: "porAprobar", label: "Cotizaciones pendientes de aprobación" },
  { valor: "facturadas", label: "Cotizaciones facturadas" },
];

const TH = "px-3 py-3 font-semibold text-gray-500 whitespace-nowrap align-bottom leading-tight";

const SORTS = [
  { valor: "numeroOT",          label: "N° OT" },
  { valor: "numeroCotizacion",  label: "N° Cotización" },
  { valor: "fecha",             label: "Más reciente" },
];

// Comparador descendente: numérico si ambos parsean como número, si no
// localeCompare; los valores vacíos van al final.
const compararTexto = (na, nb) => {
  if (!na && !nb) return 0;
  if (!na) return 1;
  if (!nb) return -1;
  const numA = Number(na), numB = Number(nb);
  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
  return String(nb).localeCompare(String(na));
};

const numerosOT = (ots) =>
  ots?.length ? ots.map((o) => o.numeroOT).filter(Boolean).join(", ") : null;

const numerosOC = (ocs) =>
  ocs?.length ? ocs.map((o) => o.numeroOrden || o.codigo).filter(Boolean) : [];

// Total real (tal como se guardó, en la moneda de la cotización) + su
// conversión a la otra moneda usando el Tipo de Cambio compartido — la
// cotización nunca recalcula subtotal/igv/total, solo se muestra la
// conversión acá para comparar de un vistazo.
// `c.subtotal` es el subtotal CRUDO de ítems (sin descuento ni margen) — en
// formatos con gastos administrativos + utilidad (Alicorp/Intradevco/
// Masterbread/Gloria) o con un simple descuento (formato estándar), el
// "Total sin IGV" real difiere del subtotal crudo. `c.total` (con IGV) SÍ es
// siempre el monto final y correcto en los 3 formatos (siempre
// `total = round(totalSinIgv + igv)`, ver calcular()/calcularGloria()/
// calcularAlicorp() en DetalleCotizacion.jsx/cotizacionItems.js), así que se
// deriva de ahí en vez de usar el subtotal directamente. Reportado por el
// usuario, 2026-09-07 — la columna quedaba desactualizada para cotizaciones
// con esos factores.
// Se usa `total − igv` (exacto) y no `total / 1.18`: este último arrastra
// decimales que, multiplicados por el TC, descuadraban la conversión en
// ±0.01 (reportado por el usuario, 2026-11-06). `/1.18` queda solo de
// respaldo para filas sin `igv` (pseudo-filas de OT).
const totalesDuales = (c, tipoCambio) => {
  const total = Number(c.total) || 0;
  const igv = Number(c.igv) || 0;
  const sinIgv = r2(igv > 0 ? total - igv : c.total != null ? total / 1.18 : Number(c.subtotal) || 0);
  const tc = Number(tipoCambio) || 0;
  if (c.moneda === "USD") {
    return { pen: tc > 0 ? r2(sinIgv * tc) : null, usd: sinIgv };
  }
  return { pen: sinIgv, usd: tc > 0 ? r2(sinIgv / tc) : null };
};

// Días transcurridos desde el ingreso (fechaRecibida) — mismo cálculo que
// "Días desde recibido" en ListaOrdenesTrabajo.jsx; se toma la de la OT y, si
// no tiene, la de la cotización.
const diasDesdeRecibido = (fecha) => {
  if (!fecha) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000));
};

// Rango "desde/hasta" de un input type=date contra el día calendario de Lima
// (mismo criterio que el filtro de fechas de ListaOrdenesTrabajo.jsx).
const dentroDeRangoFecha = (fecha, desde, hasta) => {
  if (!desde && !hasta) return true;
  if (!fecha) return false;
  const dia = aInputFecha(fecha);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
};

const otPrincipalDe = (otsPorCot, c) => otsPorCot?.get(c._id)?.[0] || null;
const fechaSalidaDe = (otsPorCot, c) => otPrincipalDe(otsPorCot, c)?.fechaSalida || c.fechaSalida || null;
const fechaRecibidaDe = (otsPorCot, c) => otPrincipalDe(otsPorCot, c)?.fechaRecibida || c.fechaRecibida || null;

const VACIO = <span className="text-gray-300">—</span>;

function TablaCotizaciones({ titulo, acento, cotizaciones, onSelect, vacioMsg, tipoCambio, puedeVerPrecios, otsPorCot, ocsPorCot, colOtEstrecha }) {
  const pag = usePaginacion(cotizaciones);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({cotizaciones.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <TablaScroll className="overflow-x-auto" fija scrollKey={pag.pagina}>
        <table className="w-full text-sm" style={{ minWidth: "1000px" }}>
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
            <tr>
              <th className={`${TH} text-left ${colOtEstrecha ? "w-20" : ""}`}><DosLineas>N° OT</DosLineas></th>
              <th className={`${TH} text-left min-w-[13rem]`}><DosLineas>Empresa</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>Planta</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>Supervisor solicitante</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>N° Cotización</DosLineas></th>
              <th className={`${TH} text-left min-w-[13rem]`}><DosLineas>Título cotización</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Estado de servicio</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Fecha de salida a cliente</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>N° OC</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Informe enviado</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Días desde recibido</DosLineas></th>
              {puedeVerPrecios && <th className={`${TH} text-right`}><DosLineas>Total sin IGV (S/)</DosLineas></th>}
              {puedeVerPrecios && <th className={`${TH} text-right`}><DosLineas>Total sin IGV (US$)</DosLineas></th>}
              <th className={`${TH} text-center`}><DosLineas>Estado de aprobación</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Estado enviado</DosLineas></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cotizaciones.length === 0 ? (
              <tr>
                <td colSpan={13 + (puedeVerPrecios ? 2 : 0)} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td>
              </tr>
            ) : (
              pag.visibles.map((c) => {
                const { pen, usd } = totalesDuales(c, tipoCambio);
                const otsDeCot = otsPorCot?.get(c._id);
                const otPrincipal = otsDeCot?.[0];
                const ocs = numerosOC(ocsPorCot?.get(c._id));
                const fechaSalida = fechaSalidaDe(otsPorCot, c);
                const dias = diasDesdeRecibido(fechaRecibidaDe(otsPorCot, c));
                return (
                <tr
                  key={c._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${c.anulado ? "opacity-50" : ""} ${c._esOT ? "bg-indigo-50/30" : ""}`}
                  onClick={() => onSelect(c)}
                >
                  <td className={`px-4 py-3.5 text-gray-600 ${colOtEstrecha ? "w-20 max-w-[5rem] whitespace-normal break-words" : "whitespace-nowrap"}`}>
                    {numerosOT(otsDeCot) || VACIO}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">{c.empresa?.razonSocial || VACIO}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.planta || VACIO}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.jefeSupervisorSolicitante || VACIO}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {c._esOT ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                          Sin cotización
                        </span>
                      ) : (
                        c.numeroCotizacion || <span className="text-gray-300 font-sans">—</span>
                      )}
                      {c.anulado && (
                        <span title={c.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                          Anulada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">{c.titulo}</td>
                  <td className="px-4 py-3.5 text-center">
                    {otPrincipal
                      ? <DotChip chip={badgeGeneral(otPrincipal.estadoGeneral)} dot={dotGeneral(otPrincipal.estadoGeneral)}>{otPrincipal.estadoGeneral}</DotChip>
                      : VACIO}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-500 whitespace-nowrap">
                    {fechaSalida ? formatearFecha(fechaSalida) : VACIO}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                    {ocs.length ? ocs.map((n) => <div key={n}>{n}</div>) : VACIO}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c._esOT ? VACIO : (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${c.informeEnviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.informeEnviado ? "Enviado" : "No enviado"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-600 tabular-nums">
                    {dias != null ? `${dias} día${dias !== 1 ? "s" : ""}` : VACIO}
                  </td>
                  {puedeVerPrecios && (
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {pen != null ? pen.toLocaleString("es-PE", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  )}
                  {puedeVerPrecios && (
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {usd != null ? usd.toLocaleString("es-PE", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-center">
                    {c._esOT ? VACIO : (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${c.aprobado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.aprobado ? "Aprobada" : "Pendiente"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c._esOT ? VACIO : (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${c.enviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.enviado ? "Enviada" : "No enviada"}
                      </span>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </TablaScroll>
        <Paginacion {...pag} />
      </div>
    </div>
  );
}

export default function ListaCotizaciones() {
  const location = useLocation();
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [filtros, setFiltros] = useState({
    ...FILTROS_VACIO,
    oc: location.state?.filtroOC || "",
  });
  const [seleccionada, setSeleccionada] = useState(null);
  const [importarOpen, setImportarOpen] = useState(false);
  const [importarCotizacionesOpen, setImportarCotizacionesOpen] = useState(false);
  const [nuevaOTOpen, setNuevaOTOpen] = useState(false);
  const [nuevaCotizacionOpen, setNuevaCotizacionOpen] = useState(false);
  const [otsPorCot, setOtsPorCot] = useState(new Map());
  const [otsSinCotizacion, setOtsSinCotizacion] = useState([]);
  const [ocPorCot, setOcPorCot] = useState(new Map());
  const [ocPorNumDoc, setOcPorNumDoc] = useState(new Map());
  const [ocsPorCot, setOcsPorCot] = useState(new Map());
  const [facturaPorNumDoc, setFacturaPorNumDoc] = useState(new Map());
  const [sortBy, setSortBy] = useState("numeroCotizacion");
  // "Todas las cotizaciones" (tabla única, sin categorizar por estado) es la
  // vista por defecto al abrir la página — pedido explícito del usuario.
  const [vista, setVista] = useState("todasLasCotizaciones");
  const [tipoCambio, setTipoCambio] = useState(null);
  // Precios: información sensible, solo Admin/Facturación/Jefatura los ven —
  // esta lista es compartida también con Planner y Asistente (Administración).
  // Columnas de precio ocultas "por ahora" a pedido del usuario (2026-11-06),
  // en la tabla y en el Excel. Para volver a mostrarlas: MOSTRAR_PRECIOS = true.
  const MOSTRAR_PRECIOS = false;
  const rolVePrecios = ["admin", "facturacion", "jefatura"].includes(getUsuario()?.rol);
  const puedeVerPrecios = MOSTRAR_PRECIOS && rolVePrecios;

  const buildOtsMap = (ots) => {
    const m = new Map();
    ots.forEach((o) => {
      // Las OT sin cotización se indexan por su propio _id (son su propia fila).
      const id = o.cotizacion?._id || o._id;
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(o);
    });
    return m;
  };

  const buildOcMap = (ocs) => {
    const m = new Map();
    ocs.forEach((oc) => {
      const id = oc.cotizacion?._id || oc.cotizacion;
      if (id && !m.has(id)) m.set(id, oc);
    });
    return m;
  };

  const buildOcPorNumDoc = (ocs) => {
    const m = new Map();
    ocs.forEach((oc) => {
      if (oc.numeroDocumento != null) m.set(oc.numeroDocumento, oc);
    });
    return m;
  };

  // Todas las OC vigentes de cada cotización (varias si hay OCs parciales), por
  // referencia directa o por la cadena (OCs importadas sin `cotizacion`).
  const buildOcsPorCot = (ocs, cots) => {
    const porCot = new Map(), porNumDoc = new Map();
    const agregar = (m, k, oc) => m.set(k, [...(m.get(k) || []), oc]);
    ocs.filter((oc) => !oc.anulado).forEach((oc) => {
      const id = oc.cotizacion?._id || oc.cotizacion;
      if (id) agregar(porCot, id, oc);
      if (oc.numeroDocumento != null) agregar(porNumDoc, oc.numeroDocumento, oc);
    });
    const m = new Map();
    cots.forEach((c) => {
      const suyas = [...new Set([...(porCot.get(c._id) || []), ...(porNumDoc.get(c.numeroDocumento) || [])])];
      if (suyas.length) m.set(c._id, suyas);
    });
    return m;
  };

  const cargar = () =>
    Promise.all([
      fetchAuth("/cotizaciones").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
      fetchAuth("/facturas").then((r) => r.ok ? r.json() : []),
      fetchAuth("/tipo-cambio").then((r) => r.ok ? r.json() : null),
    ]).then(([cots, ots, ocs, facts, tc]) => {
      setCotizaciones(cots);
      setOtsSinCotizacion(ots.filter((o) => !o.cotizacion));
      setOtsPorCot(buildOtsMap(ots));
      setOcPorCot(buildOcMap(ocs));
      setOcPorNumDoc(buildOcPorNumDoc(ocs));
      setOcsPorCot(buildOcsPorCot(ocs, cots));
      setTipoCambio(tc?.valor ?? null);
      // Una cotización está "facturada" si su cadena (mismo numeroDocumento)
      // tiene una factura con número de factura.
      setFacturaPorNumDoc(new Map(
        facts.filter((f) => f.numeroFactura && f.numeroDocumento != null)
             .map((f) => [f.numeroDocumento, f.numeroFactura])
      ));
    });

  useEffect(() => { cargar(); }, []);

  // Las OT creadas sin cotización (flujo directo) se muestran como filas propias,
  // marcadas con `_esOT`, para que también aparezcan en esta vista.
  const pseudoDeOT = (ot) => ({
    _id: ot._id,
    _esOT: true,
    _ot: ot,
    numeroCotizacion: "",
    fecha: ot.fechaRecibida || ot.createdAt,
    fechaRecibida: ot.fechaRecibida,
    empresa: ot.empresa,
    planta: ot.planta,
    encargado: ot.encargado,
    titulo: ot.titulo,
    subtotal: ot.subtotal,
    total: ot.total,
    numeroDocumento: ot.numeroDocumento,
    bloqueadoPorPago: ot.bloqueadoPorPago,
    bloqueo: { facturada: ot.estadoGeneral === "facturado" },
    anulado: ot.anulado,
    motivoAnulacion: ot.motivoAnulacion,
    createdAt: ot.createdAt,
  });

  const filas = [...cotizaciones, ...otsSinCotizacion.map(pseudoDeOT)];

  const empresasLista = [
    ...new Map(
      filas.filter((c) => c.empresa?._id).map((c) => [c.empresa._id, c.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(
    (filtros.empresa ? filas.filter((c) => c.empresa?._id === filtros.empresa) : filas)
      .map((c) => c.planta)
      .filter(Boolean)
  )].sort();

  const handleFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const handleEmpresa = (e) => setFiltros({ ...filtros, empresa: e.target.value, planta: "" });

  const tieneOC = (c) =>
    ocPorCot.has(c._id) || (c.numeroDocumento != null && ocPorNumDoc.has(c.numeroDocumento));

  // Rango de precio: total sin IGV en soles (USD convertido con el tipo de cambio).
  const dentroDeRangoPrecio = (c) => {
    if (!rolVePrecios || (filtros.precioDesde === "" && filtros.precioHasta === "")) return true;
    const { pen } = totalesDuales(c, tipoCambio);
    if (pen == null) return false;
    if (filtros.precioDesde !== "" && pen < Number(filtros.precioDesde)) return false;
    if (filtros.precioHasta !== "" && pen > Number(filtros.precioHasta)) return false;
    return true;
  };

  const filtradas = filas.filter((c) => {
    const q = filtros.busqueda.toLowerCase();
    return (
      (!filtros.empresa || c.empresa?._id === filtros.empresa) &&
      (!filtros.planta || c.planta === filtros.planta) &&
      dentroDeRangoFecha(fechaSalidaDe(otsPorCot, c), filtros.fechaDesde, filtros.fechaHasta) &&
      dentroDeRangoPrecio(c) &&
      (!filtros.oc  || (filtros.oc === "con" ? tieneOC(c) : !tieneOC(c))) &&
      (!filtros.informeEnviado || c.informeEnviado) &&
      (!filtros.estadoServicio || (otsPorCot.get(c._id)?.[0]?.estadoGeneral ?? "sin_ot") === filtros.estadoServicio) &&
      (!q ||
        c.titulo?.toLowerCase().includes(q) ||
        c.numeroCotizacion?.toLowerCase().includes(q) ||
        numerosOT(otsPorCot.get(c._id))?.toLowerCase().includes(q) ||
        numerosOC(ocsPorCot.get(c._id)).some((n) => n.toLowerCase().includes(q)) ||
        facturaPorNumDoc.get(c.numeroDocumento)?.toLowerCase().includes(q) ||
        c.empresa?.razonSocial?.toLowerCase().includes(q) ||
        c.empresa?.ruc?.includes(q))
    );
  });

  const primerNumeroOT = (c) => {
    const ots = otsPorCot.get(c._id);
    return ots?.map((o) => o.numeroOT).find(Boolean) || "";
  };
  filtradas.sort((a, b) => {
    if (sortBy === "numeroCotizacion") return compararTexto(a.numeroCotizacion, b.numeroCotizacion);
    if (sortBy === "fecha") return new Date(b.createdAt) - new Date(a.createdAt);
    return compararTexto(primerNumeroOT(a), primerNumeroOT(b));
  });

  const esFacturada = (c) => !!(c.bloqueo?.facturada || c.bloqueadoPorPago);
  const facturadas = filtradas.filter((c) => esFacturada(c));
  // Pendientes de OC: solo cotizaciones reales — las filas pseudo de OT sin
  // cotización (_esOT) no tienen cotización que esperar OC, así que no
  // cuentan como "pendientes" acá aunque tampoco tengan OC.
  const pendientes = filtradas.filter((c) => !c._esOT && !esFacturada(c) && !tieneOC(c));
  const conOC = filtradas.filter((c) => !esFacturada(c) && tieneOC(c));
  // Cotizaciones (no pseudo-filas de OT) sin ninguna OT relacionada —
  // "Facturadas" tiene prioridad: una cotización facturada y sin OT solo debe
  // vivir en esa tabla, no duplicarse acá.
  const sinOT = filtradas.filter((c) => !c._esOT && !esFacturada(c) && !otsPorCot.get(c._id)?.length);
  const enviadas = filtradas.filter((c) => !c._esOT && c.enviado);
  const aprobadas = filtradas.filter((c) => !c._esOT && c.aprobado);
  // Pendientes de acción: sin anuladas ni facturadas.
  const pendienteDeAccion = (c) => !c._esOT && !c.anulado && !esFacturada(c);
  const noEnviadas = filtradas.filter((c) => pendienteDeAccion(c) && !c.enviado);
  const porAprobar = filtradas.filter((c) => pendienteDeAccion(c) && !c.aprobado);
  const hayFiltro = Object.values(filtros).some(Boolean);

  // Misma columnas que TablaCotizaciones — una hoja por cada tabla visible.
  const filaCotizacion = (c) => {
    const { pen, usd } = totalesDuales(c, tipoCambio);
    const fechaSalida = fechaSalidaDe(otsPorCot, c);
    return {
      "N° OT":                  numerosOT(otsPorCot.get(c._id)) || "—",
      "Empresa":                c.empresa?.razonSocial || "—",
      "Planta":                 c.planta || "—",
      "Supervisor solicitante": c.jefeSupervisorSolicitante || "—",
      "N° Cotización":          c._esOT ? "Sin cotización" : (c.numeroCotizacion || "—"),
      "Título cotización":      c.titulo,
      "Estado de servicio":     otsPorCot.get(c._id)?.[0]?.estadoGeneral || "—",
      "Fecha de salida a cliente": fechaSalida ? formatearFecha(fechaSalida) : "—",
      "N° OC":                  numerosOC(ocsPorCot.get(c._id)).join(", ") || "—",
      "Informe enviado":        c._esOT ? "—" : (c.informeEnviado ? "Enviado" : "No enviado"),
      "Días desde recibido":    diasDesdeRecibido(fechaRecibidaDe(otsPorCot, c)) ?? "—",
      ...(puedeVerPrecios ? {
        "Total sin IGV (S/)":   pen != null ? pen.toFixed(2) : "—",
        "Total sin IGV (US$)":  usd != null ? usd.toFixed(2) : "—",
      } : {}),
      "Estado de aprobación":   c._esOT ? "—" : (c.aprobado ? "Aprobada" : "Pendiente"),
      "Estado enviado":         c._esOT ? "—" : (c.enviado ? "Enviada" : "No enviada"),
      "Fecha recibida":         c.fechaRecibida ? formatearFecha(c.fechaRecibida) : "—",
      "Encargado":              c.encargado || "—",
    };
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    [
      ["Pendientes", pendientes],
      ["Con OC", conOC],
      ["Facturadas", facturadas],
      ["Sin OT", sinOT],
      ["Enviadas", enviadas],
      ["Aprobadas", aprobadas],
      ["No enviadas", noEnviadas],
      ["Pend. aprobación", porAprobar],
    ].forEach(([nombre, lista]) => {
      const ws = XLSX.utils.json_to_sheet(lista.map(filaCotizacion));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, "cotizaciones.xlsx");
  };

  const seleccionarFila = (c) =>
    setSeleccionada(c._esOT ? { tipo: "ot", data: c._ot } : { tipo: "cotizacion", data: c });

  const SELECT =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

  return (
    <>
    <div className="p-6 ">
      <div className="d-flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Cotizaciones</h2>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Exportar Excel
          </button>
          {getUsuario()?.rol === "admin" && (
            <button
              onClick={() => setImportarCotizacionesOpen(true)}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Importar Cotizaciones
            </button>
          )}
          <button
            onClick={() => setNuevaOTOpen(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
          >
            + Crear Orden de Trabajo
          </button>
          <button
            onClick={() => setNuevaCotizacionOpen(true)}
            className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sky-700 transition"
          >
            + Nueva Cotización
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center barra-filtros">
        <select name="empresa" value={filtros.empresa} onChange={handleEmpresa} className={SELECT}>
          <option value="">Toda empresa</option>
          {empresasLista.map((e) => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>

         {plantasLista.length > 0 && (
          <select name="planta" value={filtros.planta} onChange={handleFiltro} className={SELECT}>
            <option value="">Toda planta</option>
            {plantasLista.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Salida</span>
          <input type="date" name="fechaDesde" value={filtros.fechaDesde} onChange={handleFiltro}
            className={SELECT} title="Fecha de salida desde" />
          <span className="text-gray-400 text-xs">a</span>
          <input type="date" name="fechaHasta" value={filtros.fechaHasta} onChange={handleFiltro}
            className={SELECT} title="Fecha de salida hasta" />
        </div>

        {rolVePrecios && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Precio S/</span>
            <input type="number" name="precioDesde" value={filtros.precioDesde} onChange={handleFiltro}
              min="0" step="0.01" placeholder="Desde" title="Total sin IGV desde (S/)" className={`${SELECT} w-28`} />
            <span className="text-gray-400 text-xs">a</span>
            <input type="number" name="precioHasta" value={filtros.precioHasta} onChange={handleFiltro}
              min="0" step="0.01" placeholder="Hasta" title="Total sin IGV hasta (S/)" className={`${SELECT} w-28`} />
          </div>
        )}

        <select value={vista} onChange={(e) => setVista(e.target.value)} className={SELECT}>
          {VISTAS.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>

        <select name="estadoServicio" value={filtros.estadoServicio} onChange={handleFiltro} className={SELECT}>
          <option value="">Todo estado de servicio</option>
          {FILTRO_ESTADOS_SERVICIO.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>

        <input
          name="busqueda"
          value={filtros.busqueda}
          onChange={handleFiltro}
          placeholder="Buscar por N° OT, cotización, OC, factura, título, empresa o RUC…"
          className={`${SELECT} flex-1 min-w-52`}
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={SELECT}>
          {SORTS.map(({ valor, label }) => (
            <option key={valor} value={valor}>Ordenar: {label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFiltros((f) => ({ ...f, informeEnviado: !f.informeEnviado }))}
          className={`px-3 py-2 rounded-lg text-sm border transition ${
            filtros.informeEnviado
              ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Informe enviado
        </button>

        <button
          onClick={() => { setFiltros(FILTROS_VACIO); setVista("todasLasCotizaciones"); }}
          className="text-sm text-gray-400 hover:text-gray-700 transition"
        >
          Limpiar
        </button>
      </div>

      {vista === "todasLasCotizaciones" && (
        <TablaCotizaciones
          titulo="Todas las cotizaciones"
          acento="bg-blue-500"
          cotizaciones={filtradas}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones registradas"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
          colOtEstrecha
        />
      )}

      {(vista === "todas" || vista === "sinOT") && (
        <TablaCotizaciones
          titulo="Cotizaciones sin OT"
          acento="bg-indigo-500"
          cotizaciones={sinOT}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Todas las cotizaciones ya tienen OT"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "pendientes") && (
        <TablaCotizaciones
          titulo="Cotizaciones pendientes de OC"
          acento="bg-amber-500"
          cotizaciones={pendientes}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones pendientes"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "conOC") && (
        <TablaCotizaciones
          titulo="Cotización con OC"
          acento="bg-emerald-500"
          cotizaciones={conOC}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones con OC"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "enviadas") && (
        <TablaCotizaciones
          titulo="Cotizaciones enviadas"
          acento="bg-sky-500"
          cotizaciones={enviadas}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones enviadas"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "aprobadas") && (
        <TablaCotizaciones
          titulo="Cotizaciones aprobadas"
          acento="bg-green-600"
          cotizaciones={aprobadas}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones aprobadas"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "noEnviadas") && (
        <TablaCotizaciones
          titulo="Cotizaciones no enviadas"
          acento="bg-orange-500"
          cotizaciones={noEnviadas}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Todas las cotizaciones ya fueron enviadas"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "porAprobar") && (
        <TablaCotizaciones
          titulo="Cotizaciones pendientes de aprobación"
          acento="bg-yellow-500"
          cotizaciones={porAprobar}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones pendientes de aprobación"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}

      {(vista === "todas" || vista === "facturadas") && (
        <TablaCotizaciones
          titulo="Cotizaciones facturadas"
          acento="bg-gray-500"
          cotizaciones={facturadas}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones facturadas"}
          tipoCambio={tipoCambio}
          ocsPorCot={ocsPorCot}
          otsPorCot={otsPorCot}
          puedeVerPrecios={puedeVerPrecios}
        />
      )}
    </div>

    {importarOpen && (
      <ModalImportarExcel
        tipo="Cotización + Orden de Trabajo"
        columnas={COLS_COT_OT}
        endpoint="/cadena/importar-cotizacion-ot"
        color="blue"
        onClose={() => setImportarOpen(false)}
        onImportado={cargar}
      />
    )}

    {importarCotizacionesOpen && (
      <ModalImportarExcel
        tipo="Cotizaciones"
        columnas={COLS_COTIZACIONES}
        endpoint="/cadena/importar-cotizaciones"
        color="blue"
        nombreColeccion="todas las Cotizaciones"
        instrucciones={
          <>1. Descarga la plantilla, rellena tus datos y súbela. La <strong>Empresa</strong> se busca por
          RUC (11 dígitos); si no existe, se crea sola con la razón social en blanco (edítala después desde
          Empresas para completarla vía SUNAT). El <strong>Título cotización</strong> es propio de esta fila —
          no reemplaza el título de la OT. Si el <strong>N° OT</strong> ya existe (numérico, cargado antes con
          la plantilla de OT), la cotización se relaciona a esa OT en vez de crear una nueva; si no existe o no
          es un número real, se crea una OT independiente. <strong>Estado</strong>: Precotizado (falta aprobación),
          Enviado, o Facturado. <strong>Estado factura</strong> (opcional, texto libre): si vale "Facturado" cierra
          la cadena completa (Cotización/OT/OC) de esa fila, cualquier otro texto la deja abierta; si se deja
          vacío, se usa el mismo criterio sobre la columna Estado.</>
        }
        onClose={() => setImportarCotizacionesOpen(false)}
        onImportado={cargar}
      />
    )}

    {nuevaOTOpen && (
      <ModalNuevaOT
        onClose={() => setNuevaOTOpen(false)}
        onCreada={() => navigate("/ordenes-trabajo")}
      />
    )}

    {nuevaCotizacionOpen && (
      <ModalNuevaCotizacion
        onClose={() => setNuevaCotizacionOpen(false)}
        onCreada={() => { setNuevaCotizacionOpen(false); cargar(); }}
      />
    )}

    {seleccionada && (
      <DetalleDocumento
        tipo={seleccionada.tipo}
        data={seleccionada.data}
        onClose={() => { setSeleccionada(null); cargar(); }}
        onGuardadaCotizacion={(actualizada) => {
          setCotizaciones((prev) =>
            prev.map((c) => (c._id === actualizada._id ? actualizada : c))
          );
        }}
        onGuardadaOT={(actualizada) => {
          setOtsSinCotizacion((prev) =>
            prev.map((o) => (o._id === actualizada._id ? actualizada : o))
          );
        }}
      />
    )}
    </>
  );
}

