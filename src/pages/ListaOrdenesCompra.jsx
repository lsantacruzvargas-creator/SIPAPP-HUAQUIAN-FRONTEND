import { useState, useEffect } from "react";
import { fetchAuth, uploadAuth, imgUrl } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalCrearOrdenCompra   from "../components/ModalCrearOrdenCompra";
import ModalImportarExcel, { COLS_OC, COLS_CADENA } from "../components/ModalImportarExcel";
import { DotChip, badgeOT, badgePago, dotOT, dotPago } from "../components/detalleShared";
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

function TablaOC({ titulo, acento, ordenes, otMap, factMap, factByOCMap, otNumeroMap, onSelect, subirDocumento, vacioMsg }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({ordenes.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
            <tr>
              <th className={`${TH} text-left`}>N° OT</th>
              <th className={`${TH} text-left`}>N° Orden de Compra</th>
              <th className={`${TH} text-left`}>N° Factura</th>
              <th className={`${TH} text-left`}>Cotización</th>
              <th className={`${TH} text-left`}>Empresa</th>
              <th className={`${TH} text-left`}>Planta</th>
              <th className={`${TH} text-left`}>Encargado</th>
              <th className={`${TH} text-left`}>Título</th>
              <th className={`${TH} text-right`}>Total sin IGV (S/)</th>
              <th className={`${TH} text-center`}>Fecha</th>
              <th className={`${TH} text-center`}>Estado OT</th>
              <th className={`${TH} text-center`}>Estado Pago</th>
              <th className={`${TH} text-center`}>Documento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenes.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td></tr>
            ) : ordenes.map((o) => {
              const cotId = o.cotizacion?._id || o.cotizacion;
              const estadoActual = otMap[cotId];
              const factura = factByOCMap[o._id] || factMap[cotId];
              return (
                <tr key={o._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${o.anulado ? "opacity-50" : ""}`}
                  onClick={() => onSelect(o)}>
                  <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                    {otNumeroMap[o.numeroDocumento] || <span className="text-gray-300">—</span>}
                  </td>
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
                  <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{o.numeroFactura || factura?.numeroFactura || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{o.cotizacion?.numeroCotizacion || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-gray-700">{o.empresa?.razonSocial || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600">{o.planta || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-gray-600">{o.encargado || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-gray-600">{o.titulo}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {Number(o.monto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-500 whitespace-nowrap">
                    {new Date(o.fecha).toLocaleDateString("es-PE")}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {estadoActual ? (
                      <DotChip chip={badgeOT(estadoActual)} dot={dotOT(estadoActual)}>{estadoActual}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin OT</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {factura?.estadoPago ? (
                      <DotChip chip={badgePago(factura.estadoPago)} dot={dotPago(factura.estadoPago)}>{factura.estadoPago}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
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
                          <a
                            href={imgUrl(o.documento)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                          >
                            Ver PDF
                          </a>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-gray-400 hover:text-gray-600 underline">Reemplazar</span>
                        </div>
                      ) : (
                        <span className="text-xs text-blue-500 hover:text-blue-700 underline">Subir PDF</span>
                      )}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default function ListaOrdenesCompra() {
  const hoy = new Date();
  const [ordenes, setOrdenes]       = useState([]);
  const [otMap, setOtMap]           = useState({});
  const [otNumeroMap, setOtNumeroMap] = useState({});
  const [factMap, setFactMap]       = useState({});
  const [factByOCMap, setFactByOCMap] = useState({});
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
    ]).then(([ocs, ots, facts]) => {
      setOrdenes(ocs);
      const otM = {};
      const otNumM = {};
      ots.forEach((ot) => {
        const cotId = ot.cotizacion?._id || ot.cotizacion;
        if (cotId) otM[cotId] = ot.estado;
        if (ot.numeroDocumento != null) otNumM[ot.numeroDocumento] = ot.numeroOT;
      });
      setOtMap(otM);
      setOtNumeroMap(otNumM);
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
    const matchBusq  = !txt
      || o.numeroOrden?.toLowerCase().includes(txt)
      || o.titulo?.toLowerCase().includes(txt)
      || o.numeroFactura?.toLowerCase().includes(txt)
      || factura?.numeroFactura?.toLowerCase().includes(txt)
      || otNumeroMap[o.numeroDocumento]?.toLowerCase().includes(txt)
      || o.cotizacion?.numeroCotizacion?.toLowerCase().includes(txt)
      || o.empresa?.razonSocial?.toLowerCase().includes(txt)
      || o.empresa?.ruc?.includes(txt);
    const cotId      = o.cotizacion?._id || o.cotizacion;
    const estadoActual = otMap[cotId];
    const matchEstado = !estadoOT || estadoActual === estadoOT;
    const matchEmpresa = !empresa || o.empresa?._id === empresa;
    const matchPlanta = !planta || o.planta === planta;
    return matchAnio && matchMes && matchBusq && matchEstado && matchEmpresa && matchPlanta;
  });

  filtradas.sort((a, b) => {
    if (sortBy === "numeroOT") return compararTexto(otNumeroMap[a.numeroDocumento], otNumeroMap[b.numeroDocumento]);
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
    const estadoActual = otMap[cotId];
    const factura = factByOCMap[o._id] || factMap[cotId];
    return {
      "N° OT":            otNumeroMap[o.numeroDocumento] || "—",
      "N° Orden de Compra": o.numeroOrden || "—",
      "N° Factura":       o.numeroFactura || factura?.numeroFactura || "—",
      "Cotización":       o.cotizacion?.numeroCotizacion || "—",
      "Empresa":          o.empresa?.razonSocial || "—",
      "Planta":           o.planta || "—",
      "Encargado":        o.encargado || "—",
      "Título":           o.titulo || "—",
      "Total sin IGV":    Number(o.monto).toFixed(2),
      "Fecha":            new Date(o.fecha).toLocaleDateString("es-PE"),
      "Estado OT":        estadoActual || "Sin OT",
      "Estado Pago":      factura?.estadoPago || "—",
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
        otMap={otMap} factMap={factMap} factByOCMap={factByOCMap} otNumeroMap={otNumeroMap}
        onSelect={setOrdenSeleccionada}
        subirDocumento={subirDocumento}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes de compra sin factura"}
      />

      <TablaOC
        titulo="Órdenes de Compra con factura"
        acento="bg-emerald-500"
        ordenes={conFactura}
        otMap={otMap} factMap={factMap} factByOCMap={factByOCMap} otNumeroMap={otNumeroMap}
        onSelect={setOrdenSeleccionada}
        subirDocumento={subirDocumento}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes de compra con factura"}
      />

      <TablaOC
        titulo="Órdenes de Compra cerradas"
        acento="bg-gray-500"
        ordenes={cerradas}
        otMap={otMap} factMap={factMap} factByOCMap={factByOCMap} otNumeroMap={otNumeroMap}
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
