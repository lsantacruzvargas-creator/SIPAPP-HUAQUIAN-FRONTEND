import { useState, useEffect } from "react";
import { fetchAuth, uploadAuth, abrirArchivoProtegido, getUsuario } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalCrearOrdenCompra   from "../components/ModalCrearOrdenCompra";
import ModalImportarExcel, { COLS_OC, COLS_CADENA } from "../components/ModalImportarExcel";
import { DotChip, badgeOT, dotOT, badgeInformes, dotInformes } from "../components/detalleShared";
import * as XLSX from "xlsx";

const ESTADOS_OT = ["", "pendiente", "en progreso", "completado"];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const TH = "px-4 py-3 font-semibold text-gray-500 whitespace-nowrap";

const SORTS = [
  { valor: "fecha",             label: "Más reciente" },
  { valor: "numeroOT",          label: "N° OT" },
  { valor: "numeroCotizacion",  label: "N° Cotización" },
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

// El monto de la OC no tiene moneda propia (a diferencia de Cotizacion) —
// se trata como Soles por convención, igual que el resto de la cadena
// (OT/Factura), y se convierte a US$ con el Tipo de Cambio compartido.
const totalesDuales = (monto, tipoCambio) => {
  const m = Number(monto) || 0;
  const tc = Number(tipoCambio) || 0;
  return { pen: m, usd: tc > 0 ? m / tc : null };
};

function PillSiNo({ si }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${si ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {si ? "SI" : "NO"}
    </span>
  );
}

function TablaOC({
  titulo, acento, ordenes, otGroupMap, factMap, factByOCMap, greMap, tipoCambio, onSelect, subirDocumento,
  mostrarFactura = true, mostrarTitulo = true, mostrarDocumento = true, mostrarHesActa = false,
  puedeVerPrecios = true, vacioMsg,
}) {
  const totalColumnas = 8
    + (puedeVerPrecios ? 2 : 0)
    + (mostrarFactura ? 1 : 0) + (mostrarTitulo ? 1 : 0)
    + (mostrarHesActa ? 2 : 0) + (mostrarDocumento ? 1 : 0);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({ordenes.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${totalColumnas * 85}px` }}>
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
            <tr>
              <th className={`${TH} text-left`}>Cotización</th>
              <th className={`${TH} text-left`}>N° OT</th>
              <th className={`${TH} text-left`}>N° Orden de Compra</th>
              {mostrarFactura && <th className={`${TH} text-left`}>N° Factura</th>}
              <th className={`${TH} text-left`}>Empresa</th>
              {mostrarTitulo && <th className={`${TH} text-left`}>Título</th>}
              {puedeVerPrecios && <th className={`${TH} text-right`}>Total (S/)</th>}
              {puedeVerPrecios && <th className={`${TH} text-right`}>Total (US$)</th>}
              <th className={`${TH} text-center`}>Estado Cotización</th>
              <th className={`${TH} text-center`}>Estado OT</th>
              <th className={`${TH} text-center`}>Estado Informes</th>
              <th className={`${TH} text-center`}>GRE</th>
              {mostrarHesActa && <th className={`${TH} text-center`}>HES</th>}
              {mostrarHesActa && <th className={`${TH} text-center`}>Acta de Conformidad</th>}
              {mostrarDocumento && <th className={`${TH} text-center`}>Documento</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenes.length === 0 ? (
              <tr><td colSpan={totalColumnas} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td></tr>
            ) : ordenes.flatMap((o) => {
              const cotId = o.cotizacion?._id || o.cotizacion;
              const grupoOT = otGroupMap[o.numeroDocumento];
              const otPadre = grupoOT?.parent || null;
              const subs = grupoOT?.subs || [];
              const factura = factByOCMap[o._id] || factMap[cotId];
              const { pen, usd } = totalesDuales(o.monto, tipoCambio);

              const filaPrincipal = (
                <tr key={o._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${o.anulado ? "opacity-50" : ""}`}
                  onClick={() => onSelect(o)}>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{o.cotizacion?.numeroCotizacion || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{otPadre?.numeroOT || <span className="text-gray-300 font-sans">Sin OT</span>}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {o.numeroOrden || <span className="text-gray-300">—</span>}
                      {o.anulado && (
                        <span title={o.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                          Anulada
                        </span>
                      )}
                    </div>
                  </td>
                  {mostrarFactura && (
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{o.numeroFactura || factura?.numeroFactura || <span className="text-gray-300">—</span>}</td>
                  )}
                  <td className="px-4 py-3.5 text-gray-700">{o.empresa?.razonSocial || "—"}</td>
                  {mostrarTitulo && <td className="px-4 py-3.5 text-gray-600">{o.titulo}</td>}
                  {puedeVerPrecios && (
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {pen.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {puedeVerPrecios && (
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {usd != null ? usd.toLocaleString("es-PE", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.aprobado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.aprobado ? "Aprobada" : "Pendiente"}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.enviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.enviado ? "Enviada" : "No enviada"}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.informeEnviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.informeEnviado ? "Informe enviado" : "Informe no enviado"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre ? (
                      <DotChip chip={badgeOT(otPadre.estado)} dot={dotOT(otPadre.estado)}>{otPadre.estado}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin OT</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre ? (
                      <DotChip chip={badgeInformes(otPadre.estadoInformes)} dot={dotInformes(otPadre.estadoInformes)}>{otPadre.estadoInformes}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre && greMap[otPadre._id] ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                        GRE {greMap[otPadre._id]}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin GRE</span>
                    )}
                  </td>
                  {mostrarHesActa && <td className="px-4 py-3.5 text-center"><PillSiNo si={!!o.hesConfirmado} /></td>}
                  {mostrarHesActa && <td className="px-4 py-3.5 text-center"><PillSiNo si={!!o.actaConformidadConfirmada} /></td>}
                  {mostrarDocumento && (
                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <label className="cursor-pointer inline-flex flex-col items-center gap-1">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => { if (e.target.files[0]) subirDocumento(o._id, e.target.files[0]); e.target.value = ""; }}
                        />
                        {o.documento ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirArchivoProtegido(o.documento); }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                            >
                              Ver PDF
                            </button>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-400 hover:text-gray-600 underline">Reemplazar</span>
                          </div>
                        ) : (
                          <span className="text-xs text-blue-500 hover:text-blue-700 underline">Subir PDF</span>
                        )}
                      </label>
                    </td>
                  )}
                </tr>
              );

              const filasSub = subs.map((s) => (
                <tr key={s._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors bg-indigo-50/30 ${s.anulado ? "opacity-50" : ""}`}
                  onClick={() => onSelect(o)}>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap pl-8">↳ {s.numeroOT}</td>
                  <td className="px-4 py-3" />
                  {mostrarFactura && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" />
                  {mostrarTitulo && <td className="px-4 py-3" />}
                  {puedeVerPrecios && <td className="px-4 py-3" />}
                  {puedeVerPrecios && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-center">
                    <DotChip chip={badgeOT(s.estado)} dot={dotOT(s.estado)}>{s.estado}</DotChip>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <DotChip chip={badgeInformes(s.estadoInformes)} dot={dotInformes(s.estadoInformes)}>{s.estadoInformes}</DotChip>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {greMap[s._id] ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                        GRE {greMap[s._id]}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin GRE</span>
                    )}
                  </td>
                  {mostrarHesActa && <td className="px-4 py-3" />}
                  {mostrarHesActa && <td className="px-4 py-3" />}
                  {mostrarDocumento && <td className="px-4 py-3" />}
                </tr>
              ));

              return [filaPrincipal, ...filasSub];
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default function ListaOrdenesCompra() {
  // Administración ve la vista de OC pero no montos/costos — mismo criterio
  // que Cotizaciones (Fase 16).
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(getUsuario()?.rol);
  const hoy = new Date();
  const [ordenes, setOrdenes]       = useState([]);
  const [otGroupMap, setOtGroupMap] = useState({});
  const [factMap, setFactMap]       = useState({});
  const [factByOCMap, setFactByOCMap] = useState({});
  const [greMap, setGreMap]         = useState({});
  const [tipoCambio, setTipoCambio] = useState(null);
  const [sortBy, setSortBy]         = useState("fecha");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [crearOpen, setCrearOpen]   = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [importarCadenaOpen, setImportarCadenaOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estadoOT, setEstadoOT] = useState("");
  const [empresa, setEmpresa]   = useState("");
  const [planta, setPlanta]     = useState("");
  const [anio, setAnio]         = useState(hoy.getFullYear());
  const [mes, setMes]           = useState(hoy.getMonth() + 1);

  const cargar = () =>
    Promise.all([
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/facturas").then((r) => r.ok ? r.json() : []),
      fetchAuth("/tipo-cambio").then((r) => r.ok ? r.json() : null),
    ]).then(([ocs, ots, facts, tc]) => {
      setOrdenes(ocs);
      setTipoCambio(tc?.valor ?? null);
      // Agrupa por numeroDocumento (compartido por toda la cadena): la OT
      // padre + sus sub-OTs quedan bajo la misma OC/Cotización/Factura. Una
      // sub-OT hereda el numeroDocumento de su padre al crearse, así que
      // agrupar por este campo agarra padre + hijas sin necesitar `ordenPadre`.
      const otG = {};
      ots.forEach((ot) => {
        if (ot.numeroDocumento == null) return;
        if (!otG[ot.numeroDocumento]) otG[ot.numeroDocumento] = { parent: null, subs: [] };
        if (ot.ordenPadre) otG[ot.numeroDocumento].subs.push(ot);
        else otG[ot.numeroDocumento].parent = ot;
      });
      setOtGroupMap(otG);

      // GRE generadas por OT/sub-OT (mismo mecanismo que el badge de
      // DetalleOrdenTrabajo.jsx) — solo cuentan las ACEPTADAS por SUNAT.
      const otIds = ots.map((ot) => ot._id);
      if (otIds.length) {
        fetchAuth(`/guias?ordenesTrabajo=${otIds.join(",")}&estado=ACEPTADO&limit=1000`)
          .then((r) => r.ok && r.json())
          .then((data) => {
            if (!data?.ok) return;
            const map = {};
            data.data.forEach((g) => {
              const codigo = `${g.serie}-${String(g.correlativo).padStart(4, "0")}`;
              (g.ordenesTrabajo || []).forEach((id) => {
                const key = id?._id || id;
                map[key] = map[key] ? `${map[key]}, ${codigo}` : codigo;
              });
            });
            setGreMap(map);
          });
      } else {
        setGreMap({});
      }

      const ocNumDoc = {};
      ocs.forEach((oc) => { ocNumDoc[oc._id] = oc.numeroDocumento; });
      const factM = {};
      const factByOCM = {};
      facts.forEach((f) => {
        const cotId = f.cotizacion?._id || f.cotizacion;
        if (cotId && !factM[cotId]) factM[cotId] = f;
        const ocId = f.ordenCompra?._id || f.ordenCompra;
        if (ocId) {
          // Preferir la factura cuyo numeroDocumento coincide con el de la OC;
          // solo se cae a la primera vista si ninguna coincide.
          const coincide = f.numeroDocumento != null && f.numeroDocumento === ocNumDoc[ocId];
          const previaCoincide = factByOCM[ocId]?.numeroDocumento === ocNumDoc[ocId];
          if (!factByOCM[ocId] || (coincide && !previaCoincide)) factByOCM[ocId] = f;
        }
      });
      setFactMap(factM);
      setFactByOCMap(factByOCM);
    });

  useEffect(() => { cargar(); }, []);

  const anios = [...new Set(ordenes.map((o) => new Date(o.fecha).getFullYear()))].sort((a, b) => b - a);

  const empresasLista = [
    ...new Map(
      ordenes.filter((o) => o.empresa?._id).map((o) => [o.empresa._id, o.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(
    (empresa ? ordenes.filter((o) => o.empresa?._id === empresa) : ordenes)
      .map((o) => o.planta)
      .filter(Boolean)
  )].sort();

  const handleEmpresa = (e) => { setEmpresa(e.target.value); setPlanta(""); };

  const filtradas = ordenes.filter((o) => {
    const fecha = new Date(o.fecha);
    const matchAnio  = fecha.getFullYear() === anio;
    const matchMes   = fecha.getMonth() + 1 === mes;
    const txt = busqueda.toLowerCase();
    const factura = factByOCMap[o._id] || factMap[o.cotizacion?._id || o.cotizacion];
    const grupoOT = otGroupMap[o.numeroDocumento];
    const numerosOT = grupoOT ? [grupoOT.parent, ...grupoOT.subs].filter(Boolean).map((ot) => ot.numeroOT) : [];
    const matchBusq  = !txt
      || o.numeroOrden?.toLowerCase().includes(txt)
      || o.titulo?.toLowerCase().includes(txt)
      || o.numeroFactura?.toLowerCase().includes(txt)
      || factura?.numeroFactura?.toLowerCase().includes(txt)
      || numerosOT.some((n) => n?.toLowerCase().includes(txt))
      || o.cotizacion?.numeroCotizacion?.toLowerCase().includes(txt)
      || o.empresa?.razonSocial?.toLowerCase().includes(txt)
      || o.empresa?.ruc?.includes(txt);
    const estadoActual = grupoOT?.parent?.estado;
    const matchEstado = !estadoOT || estadoActual === estadoOT;
    const matchEmpresa = !empresa || o.empresa?._id === empresa;
    const matchPlanta = !planta || o.planta === planta;
    return matchAnio && matchMes && matchBusq && matchEstado && matchEmpresa && matchPlanta;
  });

  filtradas.sort((a, b) => {
    if (sortBy === "numeroOT") return compararTexto(otGroupMap[a.numeroDocumento]?.parent?.numeroOT, otGroupMap[b.numeroDocumento]?.parent?.numeroOT);
    if (sortBy === "numeroCotizacion") return compararTexto(a.cotizacion?.numeroCotizacion, b.cotizacion?.numeroCotizacion);
    return new Date(b.fecha) - new Date(a.fecha);
  });

  const hayFiltro = busqueda || estadoOT || empresa || planta || anio !== hoy.getFullYear() || mes !== hoy.getMonth() + 1;

  const tieneFactura = (o) => !!(factByOCMap[o._id] || factMap[o.cotizacion?._id || o.cotizacion]);
  const cerradas   = filtradas.filter((o) => o.estadoCadena === "cerrado");
  const abiertas   = filtradas.filter((o) => o.estadoCadena !== "cerrado");
  const sinFactura = abiertas.filter((o) => !tieneFactura(o));
  const conFactura = abiertas.filter((o) => tieneFactura(o));

  // Mismas columnas que TablaOC (sin "Documento", no aplica a una hoja de cálculo).
  const filaOC = (o) => {
    const cotId = o.cotizacion?._id || o.cotizacion;
    const grupoOT = otGroupMap[o.numeroDocumento];
    const factura = factByOCMap[o._id] || factMap[cotId];
    const { pen, usd } = totalesDuales(o.monto, tipoCambio);
    return {
      "Cotización":         o.cotizacion?.numeroCotizacion || "—",
      "N° Orden de Compra": o.numeroOrden || "—",
      "N° OT":              grupoOT?.parent?.numeroOT || "—",
      "Sub-OTs":            grupoOT?.subs?.map((s) => s.numeroOT).join(", ") || "—",
      "N° Factura":         o.numeroFactura || factura?.numeroFactura || "—",
      "Empresa":            o.empresa?.razonSocial || "—",
      "Título":             o.titulo || "—",
      ...(puedeVerPrecios ? {
        "Total (S/)":       pen.toFixed(2),
        "Total (US$)":      usd != null ? usd.toFixed(2) : "—",
      } : {}),
      "Aprobado":           o.cotizacion?.aprobado ? "Aprobada" : "Pendiente",
      "Enviado":            o.cotizacion?.enviado ? "Enviada" : "No enviada",
      "Informe enviado":    o.cotizacion?.informeEnviado ? "Enviado" : "No enviado",
      "Estado":             grupoOT?.parent?.estado || "Sin OT",
      "Estado Informes":    grupoOT?.parent?.estadoInformes || "—",
      "GRE":                (grupoOT?.parent && greMap[grupoOT.parent._id]) || "Sin GRE",
    };
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    [
      ["Sin factura", sinFactura],
      ["Con factura", conFactura],
      ["Cerradas", cerradas],
    ].forEach(([nombre, lista]) => {
      const ws = XLSX.utils.json_to_sheet(lista.map(filaOC));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, "ordenes-de-compra.xlsx");
  };

  const subirDocumento = async (id, file) => {
    const fd = new FormData();
    fd.append("documento", file);
    const res = await uploadAuth(`/ordenes-compra/${id}/documento`, fd);
    if (res.ok) {
      const actualizada = await res.json();
      setOrdenes((prev) => prev.map((o) => o._id === id ? { ...o, documento: actualizada.documento } : o));
    }
  };

  return (
    <div className="p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Órdenes de Compra</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtradas.length} orden{filtradas.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Exportar Excel
          </button>
          <button onClick={() => setImportarOpen(true)}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Importar Excel
          </button>
          <button onClick={() => setCrearOpen(true)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition font-medium">
            + Nueva OC
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex gap-3 flex-wrap items-center">
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {anios.length === 0
            ? <option value={anio}>{anio}</option>
            : anios.map((a) => <option key={a} value={a}>{a}</option>)
          }
        </select>
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={empresa}
          onChange={handleEmpresa}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Toda empresa</option>
          {empresasLista.map((e) => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>
        {plantasLista.length > 0 && (
          <select
            value={planta}
            onChange={(e) => setPlanta(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Toda planta</option>
            {plantasLista.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por N° OT, cotización, OC, factura, título, empresa o RUC…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={estadoOT}
          onChange={(e) => setEstadoOT(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {ESTADOS_OT.map((e) => (
            <option key={e} value={e}>{e ? e.charAt(0).toUpperCase() + e.slice(1) : "Todo estado OT"}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {SORTS.map(({ valor, label }) => (
            <option key={valor} value={valor}>Ordenar: {label}</option>
          ))}
        </select>
        {hayFiltro && (
          <button
            onClick={() => { setBusqueda(""); setEstadoOT(""); setEmpresa(""); setPlanta(""); setAnio(hoy.getFullYear()); setMes(hoy.getMonth() + 1); }}
            className="text-sm text-gray-400 hover:text-gray-700 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      <TablaOC
        titulo="Órdenes de Compra sin factura"
        acento="bg-amber-500"
        ordenes={sinFactura}
        otGroupMap={otGroupMap} factMap={factMap} factByOCMap={factByOCMap} greMap={greMap} tipoCambio={tipoCambio} puedeVerPrecios={puedeVerPrecios}
        onSelect={setOrdenSeleccionada}
        subirDocumento={subirDocumento}
        mostrarFactura={false}
        mostrarTitulo={false}
        mostrarDocumento={false}
        mostrarHesActa
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes de compra sin factura"}
      />

      <TablaOC
        titulo="Órdenes de Compra con factura"
        acento="bg-emerald-500"
        ordenes={conFactura}
        otGroupMap={otGroupMap} factMap={factMap} factByOCMap={factByOCMap} greMap={greMap} tipoCambio={tipoCambio} puedeVerPrecios={puedeVerPrecios}
        onSelect={setOrdenSeleccionada}
        subirDocumento={subirDocumento}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes de compra con factura"}
      />

      <TablaOC
        titulo="Órdenes de Compra cerradas"
        acento="bg-gray-500"
        ordenes={cerradas}
        otGroupMap={otGroupMap} factMap={factMap} factByOCMap={factByOCMap} greMap={greMap} tipoCambio={tipoCambio} puedeVerPrecios={puedeVerPrecios}
        onSelect={setOrdenSeleccionada}
        subirDocumento={subirDocumento}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes de compra cerradas"}
      />

      {ordenSeleccionada && (
        <DetalleDocumento
          tipo="oc"
          data={ordenSeleccionada}
          extra={
            factByOCMap[ordenSeleccionada._id] ||
            factMap[ordenSeleccionada.cotizacion?._id]
          }
          onClose={() => { setOrdenSeleccionada(null); cargar(); }}
          onGuardadaOC={(actualizada) => {
            setOrdenes((prev) => prev.map((o) => o._id === actualizada._id ? actualizada : o));
          }}
        />
      )}

      {crearOpen && (
        <ModalCrearOrdenCompra
          onClose={() => setCrearOpen(false)}
          onCreada={(nueva) => { setOrdenes(prev => [nueva, ...prev]); setCrearOpen(false); }}
        />
      )}

      {importarOpen && (
        <ModalImportarExcel
          tipo="Ordenes de Compra"
          columnas={COLS_OC}
          endpoint="/ordenes-compra/importar"
          color="blue"
          onClose={() => setImportarOpen(false)}
          onImportado={cargar}
        />
      )}

      {importarCadenaOpen && (
        <ModalImportarExcel
          tipo="Cadena completa (Cotización + OT + OC + Factura)"
          columnas={COLS_CADENA}
          endpoint="/cadena/importar"
          color="blue"
          onClose={() => setImportarCadenaOpen(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}
